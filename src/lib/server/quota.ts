import { eq, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type * as schema from '$lib/server/db/schema';
import { youtubeQuotaUsage } from '$lib/server/db/schema';

/**
 * YouTube Data API quota meter. ytFetch records each call's documented cost in memory; the cron flushes the
 * pending total once per invocation into youtube_quota_usage, one row per Pacific day (Google resets quota at
 * midnight Pacific). The count is a lower bound: retries inside fetchWithRetry are not counted, and the OAuth
 * token refresh is not a Data API call.
 */

export type YoutubeEndpoint =
	| 'commentThreads.list'
	| 'comments.list'
	| 'channels.list'
	| 'videos.list'
	| 'comments.setModerationStatus'
	| 'comments.delete';

/** Documented unit costs. Typed against the endpoint union so a new endpoint cannot ship without a cost. */
export const YOUTUBE_UNIT_COST: Record<YoutubeEndpoint, number> = {
	'commentThreads.list': 1,
	'comments.list': 1,
	'channels.list': 1,
	'videos.list': 1,
	'comments.setModerationStatus': 50,
	'comments.delete': 50
};

/** Units recorded since the last successful flush, keyed by the Pacific day they were recorded on. Lives in memory, so a flush is what makes it durable. */
const pendingByDay = new Map<string, number>();

export function recordYoutubeUnits(endpoint: YoutubeEndpoint, nowMs: number): void {
	const day = pacificDay(nowMs);
	pendingByDay.set(day, (pendingByDay.get(day) ?? 0) + YOUTUBE_UNIT_COST[endpoint]);
}

const PACIFIC_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });

/** The quota day for an instant: its calendar date in America/Los_Angeles, as YYYY-MM-DD. */
export function pacificDay(nowMs: number): string {
	return PACIFIC_DAY.format(nowMs);
}

export type QuotaDb = LibSQLDatabase<typeof schema>;

/**
 * Adds each Pacific day's pending units to that day's row, one upsert per day. A day's units are released only after its
 * write succeeds, so a failed write propagates and the rest wait for the next flush. Writes nothing when nothing is pending.
 */
export async function flushYoutubeUnits(database: QuotaDb): Promise<void> {
	for (const [day, units] of [...pendingByDay]) {
		await database
			.insert(youtubeQuotaUsage)
			.values({ day, units })
			.onConflictDoUpdate({ target: youtubeQuotaUsage.day, set: { units: sql`${youtubeQuotaUsage.units} + excluded.units` } });
		const left = (pendingByDay.get(day) ?? 0) - units;
		if (left > 0) pendingByDay.set(day, left);
		else pendingByDay.delete(day);
	}
}

/** Today's stored units plus the units still pending, so a tick's own calls count before its flush. */
export async function readYoutubeUnitsToday(database: QuotaDb, nowMs: number): Promise<number> {
	const row = await database
		.select({ units: youtubeQuotaUsage.units })
		.from(youtubeQuotaUsage)
		.where(eq(youtubeQuotaUsage.day, pacificDay(nowMs)))
		.get();
	return (row?.units ?? 0) + (pendingByDay.get(pacificDay(nowMs)) ?? 0);
}

/** Stamps today with the instant a quota refusal stopped reply checks. Units are left as they are. */
export async function markQuotaExhausted(database: QuotaDb, nowMs: number): Promise<void> {
	const exhaustedAt = new Date(nowMs).toISOString();
	await database
		.insert(youtubeQuotaUsage)
		.values({ day: pacificDay(nowMs), exhaustedAt })
		.onConflictDoUpdate({ target: youtubeQuotaUsage.day, set: { exhaustedAt } });
	console.error('YouTube quota exhausted; reply checks stop until the Pacific day rolls over');
}

/** True when a quota refusal has stamped today. Reads only. */
export async function readQuotaExhaustedToday(database: QuotaDb, nowMs: number): Promise<boolean> {
	const row = await database
		.select({ exhaustedAt: youtubeQuotaUsage.exhaustedAt })
		.from(youtubeQuotaUsage)
		.where(eq(youtubeQuotaUsage.day, pacificDay(nowMs)))
		.get();
	if (!row) return false;
	return row.exhaustedAt !== null;
}

export type ReplyCeiling =
	| { kind: 'cap'; units: number }
	| { kind: 'disabled'; reason: 'ceiling-not-set' | 'kill-switch' | 'ceiling-invalid' };

/**
 * Reads REPLY_SWEEP_QUOTA_CEILING. Never throws: a bad value disables reply checks only, so top-level moderation
 * keeps running. The caller logs the reason.
 */
export function readReplyCeiling(raw: string | undefined): ReplyCeiling {
	const value = (raw ?? '').trim();
	if (value === '') return { kind: 'disabled', reason: 'ceiling-not-set' };
	if (value === '0') return { kind: 'disabled', reason: 'kill-switch' };
	const units = /^[1-9][0-9]*$/.test(value) ? Number(value) : Number.NaN;
	if (Number.isSafeInteger(units)) return { kind: 'cap', units };
	return { kind: 'disabled', reason: 'ceiling-invalid' };
}

/** The reasons YouTube gives for a quota or rate budget that is spent (the text youtube.ts puts in the error). */
export const QUOTA_REASONS = ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'userRateLimitExceeded'];

export function isQuotaFailure(error: unknown): boolean {
	return error instanceof Error && QUOTA_REASONS.some((reason) => error.message.includes(reason));
}
