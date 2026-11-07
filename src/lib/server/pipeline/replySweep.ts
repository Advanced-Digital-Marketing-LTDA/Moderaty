import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { env } from '$env/dynamic/private';
import type { ProtectedIdentities } from '$lib/server/allowlist';
import { ingestionBlock } from '$lib/server/billing/ingestion';
import { db } from '$lib/server/db';
import { channels } from '$lib/server/db/schema';
import { DeadlineExceededError } from '$lib/server/http';
import { fetchNewComments, MAX_REPLY_LOOKUPS_PER_TICK, type CommentPage, type NewComment } from '$lib/server/youtube';
import { isQuotaFailure, markQuotaExhausted, readQuotaExhaustedToday, readReplyCeiling, readYoutubeUnitsToday, YOUTUBE_UNIT_COST } from '$lib/server/quota';
import { assertChannelActive, ChannelDeactivatedError, runEnforcement } from './enforcement';
import { decideAndStage } from './run';
import { storedCommentIds } from './scoring';
import type { Decision } from './types';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** How far back a pass looks: replies to threads whose top-level comment is newer than this. */
export const REPLY_LOOKBACK_MS = 72 * HOUR_MS;
/** Minimum gap between passes, measured from the last check's completion. */
export const REPLY_SWEEP_INTERVAL_MS = HOUR_MS;
/** A pass in flight whose start is older than this restarts, shedding a stale page token. */
export const REPLY_PASS_TTL_MS = 6 * HOUR_MS;
/** A tick with less time than this left before the cron deadline is skipped. */
export const REPLY_SWEEP_MIN_REMAINING_MS = 8_000;
/** Time budget for one tick's fetch, staging and enforcement. */
export const REPLY_SWEEP_SUB_DEADLINE_MS = 10_000;
/** Fresh replies scored per tick; the rest hold the page for the next tick. */
export const REPLY_FRESH_CAP_PER_TICK = 100;
/** Reply deletes per tick (each costs 50 quota units); the rest are hidden as rejects. */
export const REPLY_DELETE_CAP_PER_TICK = 10;

const DELETE_BUDGET_NOTE = 'delete budget reached, hidden instead';

type Channel = typeof channels.$inferSelect;

export type ReplySweepStatus = 'skipped' | 'idle' | 'held' | 'advanced' | 'finished' | 'abandoned' | 'partial';

export interface ReplySweepResult {
	status: ReplySweepStatus;
	reason?: string;
	/** Comments the fetch returned for the page: top-level comments and replies. */
	fetched: number;
	/** Replies after the enable time that are not stored yet, before the per-tick cap. */
	fresh: number;
	staged: number;
	deferred: number;
	acted: number;
	queued: number;
	/** Replies the pass could not reach, as persisted for the owner's status line. */
	shortfall: number;
	ownRepliesSkipped: number;
	/** Reply writes this tick's enforcement parked for the owner. Present only when there were any. */
	replyActionFailures?: number;
	enforcementError?: string;
}

/** Where an in-flight pass stands. */
interface Position {
	boundary: string;
	token: string | null;
	lastAt: string;
	shortfall: number;
}

/** What a checkpoint write stores. A null boundary ends the pass. */
interface Checkpoint {
	boundary: string | null;
	token: string | null;
	lastAt: string;
	shortfall: number;
}

interface CheckpointWriter {
	write(next: Checkpoint): Promise<void>;
}

interface Pass extends Position {
	channel: Channel;
	accessToken: string;
	since: string;
	deadline: number;
	nowMs: number;
	now: () => number;
	checkpoint: CheckpointWriter;
}

/**
 * One bounded reply check for a channel. A tick reads one thread page (at most 100 fresh replies and
 * 10 reply lookups), stages and enforces what it read, then records where the pass stands. A refused
 * gate or a channel that is not due makes no YouTube call and no write.
 *
 * @param now - The clock for the pass's own instants (its start and last check). Tests pass a fixed clock.
 * @param getAccessToken - Asked at most once, and only once the tick is going to call YouTube or write.
 */
export async function runReplySweep(
	channel: Channel,
	getAccessToken: () => Promise<string>,
	deadline: number,
	now: () => number = () => Date.now()
): Promise<ReplySweepResult> {
	const nowMs = now();
	const loadedShortfall = channel.replySweepShortfall ?? 0;
	const since = channel.moderateRepliesSince;
	if (since === null) return outcome('skipped', loadedShortfall, { reason: 'off' });
	const refusal = await refusedBy(channel, deadline, nowMs);
	if (refusal !== null) return outcome('skipped', loadedShortfall, { reason: refusal });
	const quotaRefusal = await refusedByQuota(channel.id, nowMs);
	if (quotaRefusal !== null) return outcome('skipped', loadedShortfall, { reason: quotaRefusal });

	const checkpoint = checkpointWriter(channel);
	const position = await openPass(channel, since, nowMs, checkpoint);
	if (position === null) return outcome('idle', loadedShortfall);
	const accessToken = await getAccessToken();
	const pass: Pass = { ...position, channel, accessToken, since, deadline, nowMs, now, checkpoint };
	try {
		return await sweepPage(pass);
	} catch (error) {
		// A tick that ran out of time keeps the page it was on; the next tick reads it again.
		if (error instanceof DeadlineExceededError) return outcome('partial', position.shortfall, { reason: 'deadline' });
		throw error;
	}
}

/** The first gate that refuses this tick, in plan order, or null when the check may run. Reads only. */
async function refusedBy(channel: Channel, deadline: number, nowMs: number): Promise<string | null> {
	if (channel.historyBoundary !== null) return 'history-running';
	if (!channel.active) return 'inactive';
	if (channel.orgId !== null && (await ingestionBlock(channel.orgId)) === 'unpaid') return 'unpaid';
	if (env.DRY_RUN !== 'true' && env.DRY_RUN !== 'false') throw new Error('DRY_RUN must be true or false');
	if (env.DRY_RUN === 'true') return 'dry-run';
	if (deadline - nowMs < REPLY_SWEEP_MIN_REMAINING_MS) return 'no-time';
	return null;
}

/**
 * The quota gate, after the channel gates. A missing, zero or invalid ceiling disables reply checks only, loudly and
 * without a throw, so top-level moderation keeps running. A day a quota refusal stamped, or a day at or past the
 * ceiling, skips this tick. Reads only.
 */
async function refusedByQuota(channelId: string, nowMs: number): Promise<string | null> {
	const ceiling = readReplyCeiling(env.REPLY_SWEEP_QUOTA_CEILING);
	if (ceiling.kind === 'disabled') {
		logDisabledCeiling(ceiling.reason);
		return ceiling.reason;
	}
	if (await readQuotaExhaustedToday(db, nowMs)) {
		console.warn(`reply recheck skipped for channel ${channelId}: YouTube quota was exhausted today`);
		return 'quota-exhausted-today';
	}
	const used = await readYoutubeUnitsToday(db, nowMs);
	if (used < ceiling.units) return null;
	console.warn(`reply recheck skipped for today: ${used} YouTube units reached REPLY_SWEEP_QUOTA_CEILING (${ceiling.units})`);
	return 'quota-ceiling-reached';
}

/** A zero ceiling is a deliberate off switch; a missing or invalid one is a configuration error and says so. */
function logDisabledCeiling(reason: 'ceiling-not-set' | 'kill-switch' | 'ceiling-invalid'): void {
	if (reason === 'kill-switch') {
		console.warn('reply recheck off: REPLY_SWEEP_QUOTA_CEILING is 0 (kill switch)');
		return;
	}
	const problem = reason === 'ceiling-not-set' ? 'is not set' : 'is invalid';
	console.error(`reply recheck off: REPLY_SWEEP_QUOTA_CEILING ${problem}; set a positive whole number of units, or 0 to disable`);
}

/**
 * The position this tick works from. An in-flight pass continues unless its start is older than the TTL
 * or was never recorded, in which case it restarts. A new pass starts only when due. A start is persisted
 * before any YouTube call. Returns null when the channel is not due.
 */
async function openPass(channel: Channel, since: string, nowMs: number, checkpoint: CheckpointWriter): Promise<Position | null> {
	const boundary = channel.replySweepBoundary;
	const lastAt = channel.replySweepLastAt;
	if (boundary !== null && lastAt !== null && !passIsStale(lastAt, nowMs)) {
		return { boundary, token: channel.replySweepPageToken, lastAt, shortfall: channel.replySweepShortfall ?? 0 };
	}
	if (boundary === null) {
		if (!isDue(lastAt, nowMs)) return null;
	} else if (lastAt === null) {
		console.warn(`reply recheck restarting channel ${channel.id}: a pass was in flight with no recorded start`);
	}
	const started: Position = { boundary: passBoundary(since, nowMs), token: null, lastAt: iso(nowMs), shortfall: 0 };
	await checkpoint.write(started);
	return started;
}

function isDue(lastAt: string | null, nowMs: number): boolean {
	return lastAt === null || nowMs >= Date.parse(lastAt) + REPLY_SWEEP_INTERVAL_MS;
}

function passIsStale(lastAt: string, nowMs: number): boolean {
	return nowMs - Date.parse(lastAt) > REPLY_PASS_TTL_MS;
}

/** The later of the lookback and the enable time: the oldest top-level comment a pass walks back to. */
function passBoundary(since: string, nowMs: number): string {
	return iso(Math.max(nowMs - REPLY_LOOKBACK_MS, Date.parse(since)));
}

async function sweepPage(pass: Pass): Promise<ReplySweepResult> {
	const subDeadline = Math.min(pass.deadline, pass.nowMs + REPLY_SWEEP_SUB_DEADLINE_MS);
	const page = await fetchPage(pass, subDeadline);
	const candidates = candidateReplies(page.comments, Date.parse(pass.since));
	const stored = candidates.length ? await storedCommentIds(candidates.map((comment) => comment.id)) : new Set<string>();
	const fresh = candidates.filter((comment) => !stored.has(comment.id));
	const processed = fresh.slice(0, REPLY_FRESH_CAP_PER_TICK);
	const counts: Partial<ReplySweepResult> = {
		fetched: page.comments.length,
		fresh: fresh.length,
		ownRepliesSkipped: page.ownRepliesSkipped ?? 0
	};
	if (processed.length === 0) return finishTick(pass, page, counts);

	const staging = await stageReplies(pass, processed, page, subDeadline);
	const stagedCounts = { ...counts, staged: staging.stagedCount, deferred: staging.deferred, queued: staging.queued };
	if (staging.deferred > 0) {
		console.warn(`reply recheck paused for channel ${pass.channel.id}: ${staging.deferred} reply(ies) deferred for lack of credits; the pass is abandoned`);
		return abandonPass(pass, page, stagedCounts, `out of credits: ${staging.deferred} reply(ies) deferred`);
	}
	const enforcement = await enforceStaged(pass, staging.protection, subDeadline);
	const enforcedCounts = {
		...stagedCounts,
		acted: enforcement.acted,
		enforcementError: enforcement.enforcementError,
		...(enforcement.replyActionFailures > 0 ? { replyActionFailures: enforcement.replyActionFailures } : {})
	};
	if (fresh.length > REPLY_FRESH_CAP_PER_TICK) return outcome('held', pass.shortfall, enforcedCounts);
	return finishTick(pass, page, enforcedCounts);
}

async function fetchPage(pass: Pass, deadline: number): Promise<CommentPage> {
	try {
		return await fetchNewComments(pass.channel.id, pass.accessToken, pass.boundary, {
			maxPages: 1,
			includeReplies: true,
			pageToken: pass.token,
			deadline,
			replyLookupBudget: MAX_REPLY_LOOKUPS_PER_TICK
		});
	} catch (error) {
		if (isQuotaFailure(error)) await stampQuotaExhausted(pass, '');
		throw error;
	}
}

/** Replies published at or after the enable time, first occurrence of each id. Top-level comments drop out here. */
function candidateReplies(comments: NewComment[], sinceMs: number): NewComment[] {
	const seen = new Set<string>();
	return comments.filter((comment) => {
		if (!comment.parentId || Date.parse(comment.publishedAt) < sinceMs || seen.has(comment.id)) return false;
		seen.add(comment.id);
		return true;
	});
}

async function stageReplies(pass: Pass, processed: NewComment[], page: CommentPage, deadline: number) {
	const deleteAllowance = await replyDeleteAllowance(pass.nowMs);
	const staging = await decideAndStage(
		pass.channel.id,
		{ comments: processed, nextPageToken: page.nextPageToken, reachedCursor: page.reachedCursor },
		page.comments.length,
		{ channel: pass.channel, accessToken: pass.accessToken, deadline, dryRun: false, window: undefined, rescan: undefined, adjust: (decisions) => capReplyDeletes(decisions, deleteAllowance) }
	);
	if (staging.stagedCount + staging.deferred !== processed.length) {
		throw new Error(`reply recheck staged ${staging.stagedCount} of ${processed.length} fresh replies for channel ${pass.channel.id}; not advancing`);
	}
	return staging;
}

/**
 * Applies what this tick staged. A failure is logged and recorded; its action rows stay outstanding for the next run.
 * A quota refusal is the exception: it is stamped for today and rethrown, so the pass stays in flight for the cron to report.
 * A deadline or a deactivated channel is rethrown too: the pass stops where it is, with no checkpoint beyond its start.
 */
async function enforceStaged(
	pass: Pass,
	protection: ProtectedIdentities,
	deadline: number
): Promise<{ acted: number; replyActionFailures: number; enforcementError?: string }> {
	try {
		const { acted, replyActionFailures } = await runEnforcement(pass.channel.id, pass.accessToken, deadline, pass.channel.orgId, 0, pass.channel, protection);
		return { acted, replyActionFailures };
	} catch (error) {
		if (error instanceof DeadlineExceededError || error instanceof ChannelDeactivatedError) throw error;
		if (isQuotaFailure(error)) {
			await stampQuotaExhausted(pass, '; its actions stay dispatched for a later run');
			throw error;
		}
		console.error(`reply recheck enforcement failed for channel ${pass.channel.id}; its actions stay outstanding for the next run`, error);
		return { acted: 0, replyActionFailures: 0, enforcementError: error instanceof Error ? error.message : String(error) };
	}
}

/**
 * Stamps today as exhausted for the owner's status line and logs it. A stamp that fails is logged with its own error and
 * does not replace the quota refusal: the caller rethrows that refusal.
 */
async function stampQuotaExhausted(pass: Pass, detail: string): Promise<void> {
	try {
		await markQuotaExhausted(db, pass.now());
	} catch (stampError) {
		console.error(`reply recheck could not stamp quota exhaustion for channel ${pass.channel.id}${detail}; the quota refusal is rethrown`, stampError);
		return;
	}
	console.error(`reply recheck stopped: quota exhausted for channel ${pass.channel.id}${detail}`);
}

/** The pass's shortfall once this page's unreachable replies are added. */
function shortfallAfter(pass: Pass, page: CommentPage): number {
	return pass.shortfall + (page.replyShortfall ?? 0);
}

/** Records this page's shortfall, then either finishes the pass (no further page) or advances it to the next page. */
async function finishTick(pass: Pass, page: CommentPage, counts: Partial<ReplySweepResult>): Promise<ReplySweepResult> {
	const shortfall = shortfallAfter(pass, page);
	if (page.reachedCursor || page.nextPageToken === null) {
		await pass.checkpoint.write({ boundary: null, token: null, lastAt: iso(pass.now()), shortfall });
		return outcome('finished', shortfall, counts);
	}
	await pass.checkpoint.write({ boundary: pass.boundary, token: page.nextPageToken, lastAt: pass.lastAt, shortfall });
	return outcome('advanced', shortfall, counts);
}

/** Ends the pass without a verdict on its remaining replies, keeping this page's shortfall: the next pass starts again from the lookback. */
async function abandonPass(pass: Pass, page: CommentPage, counts: Partial<ReplySweepResult>, reason: string): Promise<ReplySweepResult> {
	const shortfall = shortfallAfter(pass, page);
	await pass.checkpoint.write({ boundary: null, token: null, lastAt: iso(pass.now()), shortfall });
	return outcome('abandoned', shortfall, { ...counts, reason });
}

/**
 * How many reply deletes the day's remaining ceiling can pay for, each at the delete's unit cost. Read at staging time,
 * so this tick's own fetch is already counted. Reply checks with a disabled ceiling never reach staging, so only a cap is measured.
 */
async function replyDeleteAllowance(nowMs: number): Promise<number> {
	const ceiling = readReplyCeiling(env.REPLY_SWEEP_QUOTA_CEILING);
	if (ceiling.kind === 'disabled') return REPLY_DELETE_CAP_PER_TICK;
	const remaining = ceiling.units - (await readYoutubeUnitsToday(db, nowMs));
	return Math.max(0, Math.floor(remaining / YOUTUBE_UNIT_COST['comments.delete']));
}

/**
 * Keeps the first reply deletes this tick may send, and hides each further one as a reject, so the budget never refuses
 * a decision outright. The tick allows REPLY_DELETE_CAP_PER_TICK, or fewer when `affordable` (the day's allowance) is
 * lower. Top-level decisions pass through unchanged.
 */
export function capReplyDeletes(decisions: Decision[], affordable = REPLY_DELETE_CAP_PER_TICK): Decision[] {
	const allowed = Math.min(REPLY_DELETE_CAP_PER_TICK, affordable);
	let kept = 0;
	return decisions.map((decision) => {
		if (!decision.comment.parentId || decision.youtubeAction !== 'delete') return decision;
		kept += 1;
		if (kept <= allowed) return decision;
		const hidden: Decision = {
			...decision,
			status: 'rejected',
			auditAction: 'reject',
			youtubeAction: 'reject',
			reason: [decision.reason, DELETE_BUDGET_NOTE].filter(Boolean).join('; ')
		};
		return hidden;
	});
}

/** Writes the checkpoint as a compare-and-set on the values this writer last saw (or loaded). */
function checkpointWriter(channel: Channel): CheckpointWriter {
	let seen = { boundary: channel.replySweepBoundary, token: channel.replySweepPageToken };
	return {
		async write(next) {
			await db.transaction(async (transaction) => {
				await assertChannelActive(channel.id, transaction, channel);
				const updated = await transaction
					.update(channels)
					.set({
						replySweepBoundary: next.boundary,
						replySweepPageToken: next.token,
						replySweepLastAt: next.lastAt,
						replySweepShortfall: next.shortfall
					})
					.where(
						and(
							eq(channels.id, channel.id),
							sameOrNull(channels.moderateRepliesSince, channel.moderateRepliesSince),
							sameOrNull(channels.replySweepBoundary, seen.boundary),
							sameOrNull(channels.replySweepPageToken, seen.token),
							sameOrNull(channels.leaseExpiresAt, channel.leaseExpiresAt),
							isNull(channels.historyBoundary)
						)
					)
					.returning({ id: channels.id });
				if (!updated.length) throw new Error(`reply recheck checkpoint changed for channel ${channel.id} — aborting`);
			});
			seen = { boundary: next.boundary, token: next.token };
		}
	};
}

/** Column equality that also matches NULL, for the compare-and-set predicates. */
function sameOrNull(column: SQLiteColumn, value: string | null): SQL {
	return value === null ? isNull(column) : sql`${column} = ${value}`;
}

function outcome(status: ReplySweepStatus, shortfall: number, fields: Partial<ReplySweepResult> = {}): ReplySweepResult {
	return { fetched: 0, fresh: 0, staged: 0, deferred: 0, acted: 0, queued: 0, ownRepliesSkipped: 0, ...fields, status, shortfall };
}

function iso(ms: number): string {
	return new Date(ms).toISOString();
}
