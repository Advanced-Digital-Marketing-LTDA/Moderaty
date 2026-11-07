import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
	env: {
		DRY_RUN: 'false',
		MODERATY_DEPLOYMENT: 'official-hosted',
		UNLIMITED_ACCESS_EMAILS: '',
		OPENAI_API_KEY: 'test-openai-key'
	} as Record<string, string | undefined>,
	scoreComment: vi.fn(),
	detectJailbreak: vi.fn()
}));

// Only the network is faked: YouTube answers through a fetch router, and the two model calls are stubbed
// at the seam decide() uses. The sweep, staging, enforcement, credit ledger and database are all real.
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/moderation', () => ({ scoreComment: mocks.scoreComment, serializeScores: () => '{}' }));
vi.mock('$lib/server/jailbreak', () => ({ detectJailbreak: mocks.detectJailbreak }));

import { channels, comments, creditTransactions, moderationActions, organizations, rules, stripeSubscriptionPeriods } from '$lib/server/db/schema';
import { setupTestDb, testDb } from '$lib/server/testdb';
import { ChannelDeactivatedError, runEnforcement } from './enforcement';
import { capReplyDeletes, runReplySweep } from './replySweep';
import type { Decision } from './types';

setupTestDb([
	'channels',
	'comments',
	'organizations',
	'credit_transactions',
	'stripe_subscription_periods',
	'audit_log',
	'moderation_actions',
	'rules',
	'channel_allowed_handles'
]);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW_MS = Date.parse('2026-11-07T12:00:00.000Z');
const NOW = new Date(NOW_MS).toISOString();
const SINCE = '2026-11-07T06:00:00.000Z'; // when the owner enabled reply moderation
const CHANGED = '2026-11-07T10:00:00.000Z';
const THREAD_AT = '2026-11-07T08:00:00.000Z'; // top-level comments after SINCE
const REPLY_AT = '2026-11-07T09:00:00.000Z';
const BEFORE_SINCE = '2026-11-07T05:00:00.000Z';
const DECISION_REASON = 'rule #1 (keyword: spam-word)';

// The injected clock and the global Date are the same instant, so the http layer's deadlines agree with the sweep.
let clockMs = NOW_MS;
const now = () => clockMs;
function setClock(ms: number) {
	clockMs = ms;
	vi.setSystemTime(ms);
}
function iso(ms: number): string {
	return new Date(ms).toISOString();
}

type Body = Record<string, unknown>;

/** Per-test YouTube behaviour. The defaults answer an empty page; a request with no route is recorded and fails. */
const youtube = {
	threads: (_url: URL): Body | Response | Promise<Body | Response> => listPage([]),
	replies: (_parentId: string, _url: URL): Body | Response => listPage([]),
	moderation: (): Response => new Response(null, { status: 204 }),
	calls: [] as Array<{ route: string; url: URL }>,
	moderated: [] as Array<{ ids: string[]; status: string | null }>,
	deleted: [] as string[],
	unrouted: [] as string[]
};

const YOUTUBE_PATH = '/youtube/v3';

async function youtubeRouter(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const url = new URL(String(input));
	const route = `${init?.method ?? 'GET'} ${url.pathname.slice(YOUTUBE_PATH.length)}`;
	youtube.calls.push({ route, url });
	switch (route) {
		case 'GET /commentThreads':
			return answer(await youtube.threads(url));
		case 'GET /comments':
			return answer(youtube.replies(url.searchParams.get('parentId') ?? '', url));
		case 'POST /comments/setModerationStatus':
			youtube.moderated.push({ ids: (url.searchParams.get('id') ?? '').split(','), status: url.searchParams.get('moderationStatus') });
			return youtube.moderation();
		case 'DELETE /comments':
			youtube.deleted.push(url.searchParams.get('id') ?? '');
			return new Response(null, { status: 204 });
		case 'GET /channels':
		case 'GET /videos':
			return answer(listPage([]));
		default:
			youtube.unrouted.push(route);
			throw new Error(`unrouted YouTube request: ${route}`);
	}
}

function answer(body: Body | Response): Response {
	return body instanceof Response ? body : new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function listPage(items: Body[], nextPageToken: string | null = null): Body {
	return { items, nextPageToken };
}

/** A comments resource: a top-level comment or a reply. */
function resource(id: string, publishedAt: string, author = `viewer-${id}`, text = `text ${id}`): Body {
	return {
		id,
		snippet: { textDisplay: text, publishedAt, authorChannelId: { value: author }, authorDisplayName: `Name ${id}` }
	};
}

/** A commentThreads item; its embedded replies and totalReplyCount are optional, as YouTube returns them. */
function thread(id: string, publishedAt: string, options: { totalReplyCount?: number; replies?: Body[] } = {}): Body {
	return {
		id,
		snippet: {
			videoId: 'video-1',
			...(options.totalReplyCount === undefined ? {} : { totalReplyCount: options.totalReplyCount }),
			topLevelComment: resource(id, publishedAt, `top-author-${id}`, `text ${id}`)
		},
		...(options.replies === undefined ? {} : { replies: { comments: options.replies } })
	};
}

function resetYoutube() {
	youtube.threads = () => listPage([]);
	youtube.replies = () => listPage([]);
	youtube.moderation = () => new Response(null, { status: 204 });
	youtube.calls = [];
	youtube.moderated = [];
	youtube.deleted = [];
	youtube.unrouted = [];
}

function lookupCalls(): number {
	return youtube.calls.filter((call) => call.route === 'GET /comments').length;
}

async function seed(channel: Partial<typeof channels.$inferInsert> = {}, creditsRemaining: number | null = 1000) {
	await testDb().db.insert(organizations).values({ id: 'org-1', name: 'Org', creditsRemaining });
	await testDb().db.insert(channels).values({
		id: 'UC1',
		userId: 'owner-1',
		orgId: 'org-1',
		title: 'Channel',
		refreshTokenEnc: 'synthetic-grant',
		moderateRepliesSince: SINCE,
		...channel
	});
}

/** Spendable balance zero, but the org still passes the ingestion gate: its only paid period is fully spent. */
async function seedSpentPeriod() {
	await testDb().db.insert(stripeSubscriptionPeriods).values({
		orgId: 'org-1',
		subscriptionId: 'sub-1',
		invoiceId: 'in-1',
		periodKey: 'period-1',
		periodStart: iso(NOW_MS - DAY),
		periodEnd: iso(NOW_MS + 29 * DAY),
		includedCredits: 100,
		consumedCredits: 100,
		status: 'paid'
	});
}

async function addRule(action: 'hold' | 'delete'): Promise<number> {
	const inserted = await testDb().db.insert(rules).values({ channelId: 'UC1', type: 'keyword', pattern: 'spam-word', action }).returning({ id: rules.id }).get();
	return inserted.id;
}

async function loadRow(): Promise<typeof channels.$inferSelect> {
	const row = await testDb().db.select().from(channels).where(eq(channels.id, 'UC1')).get();
	if (!row) throw new Error('channel UC1 is missing from the test database');
	return row;
}

async function tick(deadline = clockMs + HOUR) {
	return runReplySweep(await loadRow(), 'access-token', deadline, now);
}

async function replyColumns() {
	const row = await loadRow();
	return {
		since: row.moderateRepliesSince,
		boundary: row.replySweepBoundary,
		token: row.replySweepPageToken,
		lastAt: row.replySweepLastAt,
		shortfall: row.replySweepShortfall
	};
}

async function storedComments() {
	return testDb().db
		.select({ id: comments.id, parentId: comments.parentId, status: comments.status, decidedBy: comments.decidedBy, matchedRuleId: comments.matchedRuleId })
		.from(comments)
		.orderBy(comments.id)
		.all();
}

async function actionRows() {
	return testDb().db
		.select({ commentId: moderationActions.commentId, action: moderationActions.action, state: moderationActions.state, reason: moderationActions.reason })
		.from(moderationActions)
		.orderBy(moderationActions.commentId)
		.all();
}

async function creditRows() {
	return testDb().db.select({ refType: creditTransactions.refType, refId: creditTransactions.refId, delta: creditTransactions.delta }).from(creditTransactions).all();
}

async function orgCredits(): Promise<number | null> {
	return (await testDb().db.select({ credits: organizations.creditsRemaining }).from(organizations).where(eq(organizations.id, 'org-1')).get())?.credits ?? null;
}

function scoredTexts(): unknown[] {
	return mocks.scoreComment.mock.calls.map((call) => call[0]);
}

function decision(id: string, parentId: string | undefined, youtubeAction: 'hold' | 'delete'): Decision {
	return {
		comment: {
			id,
			threadId: 'top-1',
			videoId: 'video-1',
			authorChannelId: `viewer-${id}`,
			authorName: `Name ${id}`,
			text: 'spam-word',
			publishedAt: REPLY_AT,
			...(parentId === undefined ? {} : { parentId })
		},
		status: youtubeAction === 'delete' ? 'deleted' : 'held',
		decidedBy: 'rule',
		matchedRuleId: 1,
		aiScore: null,
		auditAction: youtubeAction,
		reason: DECISION_REASON,
		youtubeAction
	};
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	setClock(NOW_MS);
	mocks.env.DRY_RUN = 'false';
	mocks.scoreComment.mockReset();
	mocks.scoreComment.mockResolvedValue({ score: 0.1, scores: {} });
	mocks.detectJailbreak.mockReset();
	mocks.detectJailbreak.mockResolvedValue({ flagged: false, confidence: 0.1 });
	resetYoutube();
	vi.stubGlobal('fetch', youtubeRouter);
});

afterEach(() => {
	// A request the fixtures did not route would otherwise be swallowed (the handle lookup tolerates failures).
	expect(youtube.unrouted).toEqual([]);
	vi.unstubAllGlobals();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

test('a channel checked 59 minutes 59.999 seconds ago is not due: no call and no write', async () => {
	await seed({ replySweepLastAt: iso(NOW_MS - HOUR + 1) });
	const before = await loadRow();

	const result = await tick();

	expect(result).toMatchObject({ status: 'idle', fetched: 0 });
	expect(youtube.calls).toEqual([]);
	expect(await loadRow()).toEqual(before);
});

test('a channel checked exactly one hour ago is due and runs a pass', async () => {
	await seed({ replySweepLastAt: iso(NOW_MS - HOUR) });

	const result = await tick();

	expect(result.status).toBe('finished');
	expect(youtube.calls.map((call) => call.route)).toEqual(['GET /commentThreads']);
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: null, token: null, lastAt: NOW, shortfall: 0 });
});

test('one reply from another account is stored once with its parent id and charged one credit; a later check adds nothing', async () => {
	await seed();
	youtube.threads = () => listPage([thread('top-1', THREAD_AT, { totalReplyCount: 1, replies: [resource('reply-1', REPLY_AT, 'viewer-b', 'a reply')] })]);

	const first = await tick();

	expect(first.status).toBe('finished');
	expect(await storedComments()).toEqual([{ id: 'reply-1', parentId: 'top-1', status: 'approved', decidedBy: 'ai', matchedRuleId: null }]);
	expect(await creditRows()).toEqual([{ refType: 'comment', refId: 'reply-1', delta: -1 }]);
	expect(await orgCredits()).toBe(999);

	setClock(NOW_MS + HOUR);
	const second = await tick();

	expect(second.status).toBe('finished');
	expect(await storedComments()).toHaveLength(1);
	expect(await creditRows()).toHaveLength(1);
	expect(await orgCredits()).toBe(999);
	expect(mocks.scoreComment).toHaveBeenCalledTimes(1);
});

test('a top-level comment and a reply older than the enable time are never stored or scored; the owner reply is counted, not stored', async () => {
	await seed();
	youtube.threads = () =>
		listPage([
			thread('top-1', THREAD_AT, {
				totalReplyCount: 3,
				replies: [
					resource('rep-old', BEFORE_SINCE, 'viewer-c', 'old reply'),
					resource('rep-new', REPLY_AT, 'viewer-b', 'new reply'),
					resource('rep-own', REPLY_AT, 'UC1', 'owner reply')
				]
			})
		]);

	const result = await tick();

	expect(result).toMatchObject({ status: 'finished', fetched: 3, fresh: 1, staged: 1, ownRepliesSkipped: 1 });
	expect(await storedComments()).toEqual([{ id: 'rep-new', parentId: 'top-1', status: 'approved', decidedBy: 'ai', matchedRuleId: null }]);
	expect(scoredTexts()).toEqual(['new reply']);
});

test('130 fresh replies: the first check stores 100 and holds the page; the next check stores the other 30 and finishes', async () => {
	await seed();
	const replies = Array.from({ length: 130 }, (_, index) =>
		resource(`r-${String(index + 1).padStart(3, '0')}`, iso(Date.parse(REPLY_AT) + index * 1000), `viewer-${index}`, `reply ${index + 1}`)
	);
	youtube.threads = () => listPage([thread('top-big', THREAD_AT, { totalReplyCount: 130 })]);
	youtube.replies = (_parentId, url) =>
		url.searchParams.get('pageToken') === null ? listPage(replies.slice(0, 100), 'lookup-2') : listPage(replies.slice(100), null);

	const first = await tick();

	expect(first).toMatchObject({ status: 'held', fresh: 130, staged: 100 });
	expect(await storedComments()).toHaveLength(100);
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: SINCE, token: null, lastAt: NOW, shortfall: 0 });

	const second = await tick();

	expect(second).toMatchObject({ status: 'finished', fresh: 30, staged: 30 });
	expect(await storedComments()).toHaveLength(130);
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: null, token: null, lastAt: NOW, shortfall: 0 });
	expect(mocks.scoreComment).toHaveBeenCalledTimes(130);
	expect(await orgCredits()).toBe(870);
});

test('a thread with more replies than five lookup pages can reach reports the exact shortfall', async () => {
	await seed();
	youtube.threads = () => listPage([thread('top-deep', THREAD_AT, { totalReplyCount: 700 })]);
	youtube.replies = (_parentId, url) => {
		const page = Number((url.searchParams.get('pageToken') ?? 'p0').slice(1));
		const olderReplies = Array.from({ length: 100 }, (_, index) => resource(`old-${page}-${index}`, BEFORE_SINCE));
		return listPage(olderReplies, `p${page + 1}`);
	};

	const result = await tick();

	// 700 total, 5 pages of 100 reachable: 200 replies are not covered.
	expect(result).toMatchObject({ status: 'finished', fresh: 0, staged: 0, shortfall: 200 });
	expect(lookupCalls()).toBe(5);
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: null, token: null, lastAt: NOW, shortfall: 200 });
});

test('a zero spendable balance defers the reply: nothing is stored, no model call is made, and the pass is abandoned', async () => {
	await seed({}, 0);
	await seedSpentPeriod();
	youtube.threads = () => listPage([thread('top-1', THREAD_AT, { totalReplyCount: 1, replies: [resource('reply-1', REPLY_AT)] })]);

	const result = await tick();

	expect(result).toMatchObject({ status: 'abandoned', deferred: 1, staged: 0, reason: 'out of credits: 1 reply(ies) deferred' });
	expect(await storedComments()).toEqual([]);
	expect(await creditRows()).toEqual([]);
	expect(mocks.scoreComment).not.toHaveBeenCalled();
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: null, token: null, lastAt: NOW, shortfall: 0 });
});

test('control: the same spent-period org with one purchased credit stores and charges the reply', async () => {
	await seed({}, 1);
	await seedSpentPeriod();
	youtube.threads = () => listPage([thread('top-1', THREAD_AT, { totalReplyCount: 1, replies: [resource('reply-1', REPLY_AT)] })]);

	const result = await tick();

	expect(result).toMatchObject({ status: 'finished', staged: 1, deferred: 0 });
	expect(await creditRows()).toEqual([{ refType: 'comment', refId: 'reply-1', delta: -1 }]);
	expect(await orgCredits()).toBe(0);
});

test('an enable-time change made during the fetch aborts the checkpoint and leaves the changed value in place', async () => {
	await seed();
	youtube.threads = async () => {
		await testDb().db.update(channels).set({ moderateRepliesSince: CHANGED }).where(eq(channels.id, 'UC1'));
		return listPage([thread('top-1', THREAD_AT, { totalReplyCount: 1, replies: [resource('reply-1', REPLY_AT)] })], 'page-2');
	};

	await expect(tick()).rejects.toThrow('reply recheck checkpoint changed for channel UC1 — aborting');

	// The sweep's would-be token ('page-2') and advance never reached the row.
	expect(await replyColumns()).toEqual({ since: CHANGED, boundary: SINCE, token: null, lastAt: NOW, shortfall: 0 });
});

test('a pass in flight for more than six hours restarts from the lookback, with no page token', async () => {
	await seed({
		moderateRepliesSince: iso(NOW_MS - 10 * DAY),
		replySweepBoundary: iso(NOW_MS - 5 * DAY),
		replySweepPageToken: 'stale-token',
		replySweepLastAt: iso(NOW_MS - 7 * HOUR),
		replySweepShortfall: 5
	});
	youtube.threads = () => listPage([thread('top-1', iso(NOW_MS - DAY))], 'page-2');

	const result = await tick();

	expect(result.status).toBe('advanced');
	expect(youtube.calls[0]?.url.searchParams.get('pageToken')).toBeNull();
	expect(await replyColumns()).toEqual({ since: iso(NOW_MS - 10 * DAY), boundary: iso(NOW_MS - 3 * DAY), token: 'page-2', lastAt: NOW, shortfall: 0 });
});

test('a pass in flight for exactly six hours is not restarted: it resumes from its token and keeps its shortfall', async () => {
	await seed({ replySweepBoundary: SINCE, replySweepPageToken: 'page-2', replySweepLastAt: iso(NOW_MS - 6 * HOUR), replySweepShortfall: 3 });
	youtube.threads = () => listPage([thread('top-1', THREAD_AT)], 'page-3');

	const result = await tick();

	expect(result).toMatchObject({ status: 'advanced', shortfall: 3 });
	expect(youtube.calls[0]?.url.searchParams.get('pageToken')).toBe('page-2');
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: SINCE, token: 'page-3', lastAt: iso(NOW_MS - 6 * HOUR), shortfall: 3 });
});

test('an in-flight pass with no recorded start is restarted, and the restart is logged', async () => {
	await seed({ replySweepBoundary: SINCE, replySweepPageToken: 'page-2', replySweepLastAt: null, replySweepShortfall: 4 });
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	youtube.threads = () => listPage([thread('top-1', THREAD_AT)], 'page-3');

	const result = await tick();

	expect(result.status).toBe('advanced');
	expect(warn).toHaveBeenCalledWith('reply recheck restarting channel UC1: a pass was in flight with no recorded start');
	expect(youtube.calls[0]?.url.searchParams.get('pageToken')).toBeNull();
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: SINCE, token: 'page-3', lastAt: NOW, shortfall: 0 });
});

test.each([
	{ reason: 'off', channel: { moderateRepliesSince: null }, credits: 1000, dryRun: 'false', deadlineMs: HOUR },
	{ reason: 'history-running', channel: { historyBoundary: iso(NOW_MS - DAY) }, credits: 1000, dryRun: 'false', deadlineMs: HOUR },
	{ reason: 'inactive', channel: { active: 0 }, credits: 1000, dryRun: 'false', deadlineMs: HOUR },
	{ reason: 'unpaid', channel: {}, credits: null, dryRun: 'false', deadlineMs: HOUR },
	{ reason: 'dry-run', channel: {}, credits: 1000, dryRun: 'true', deadlineMs: HOUR },
	{ reason: 'no-time', channel: {}, credits: 1000, dryRun: 'false', deadlineMs: 5_000 }
])('the $reason gate stops the check before any YouTube call or write', async ({ reason, channel, credits, dryRun, deadlineMs }) => {
	await seed(channel, credits);
	mocks.env.DRY_RUN = dryRun;
	const before = await loadRow();

	const result = await tick(clockMs + deadlineMs);

	expect(result).toMatchObject({ status: 'skipped', reason });
	expect(youtube.calls).toEqual([]);
	expect(await loadRow()).toEqual(before);
});

test('when several gates apply, the first one in order is the reason reported', async () => {
	await seed({ historyBoundary: iso(NOW_MS - DAY), active: 0 }, null);
	mocks.env.DRY_RUN = 'true';
	const shortDeadline = clockMs + 5_000;

	expect(await tick(shortDeadline)).toMatchObject({ status: 'skipped', reason: 'history-running' });
	await testDb().db.update(channels).set({ historyBoundary: null }).where(eq(channels.id, 'UC1'));
	expect(await tick(shortDeadline)).toMatchObject({ status: 'skipped', reason: 'inactive' });
	await testDb().db.update(channels).set({ active: 1 }).where(eq(channels.id, 'UC1'));
	expect(await tick(shortDeadline)).toMatchObject({ status: 'skipped', reason: 'unpaid' });
	await testDb().db.update(organizations).set({ creditsRemaining: 1000 }).where(eq(organizations.id, 'org-1'));
	expect(await tick(shortDeadline)).toMatchObject({ status: 'skipped', reason: 'dry-run' });
	mocks.env.DRY_RUN = 'false';
	expect(await tick(shortDeadline)).toMatchObject({ status: 'skipped', reason: 'no-time' });
	expect(youtube.calls).toEqual([]);

	expect(await tick()).toMatchObject({ status: 'finished' });
	expect(youtube.calls).toHaveLength(1);
});

test('a malformed DRY_RUN value throws instead of running the check live', async () => {
	await seed();
	mocks.env.DRY_RUN = 'yes';

	await expect(tick()).rejects.toThrow('DRY_RUN must be true or false');
	expect(youtube.calls).toEqual([]);
});

test('a quota refusal on the fetch stops the pass with no checkpoint write and logs loudly', async () => {
	await seed({ replySweepBoundary: SINCE, replySweepPageToken: 'page-2', replySweepLastAt: iso(NOW_MS - 5 * MINUTE), replySweepShortfall: 0 });
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	youtube.threads = () => new Response(JSON.stringify({ error: { code: 403, errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 });
	const before = await replyColumns();

	await expect(tick()).rejects.toThrow('quotaExceeded');

	expect(error).toHaveBeenCalledWith('reply recheck stopped: quota exhausted for channel UC1');
	expect(await replyColumns()).toEqual(before);
});

test('a deadline reached during the fetch returns partial, and the pass start is the only write', async () => {
	await seed();
	youtube.threads = () => {
		// Past the 10 s sub-deadline, then the transport fails: the http layer reports the deadline.
		setClock(NOW_MS + 11 * 1000);
		throw new TypeError('fetch failed');
	};

	const result = await tick();

	expect(result).toMatchObject({ status: 'partial', reason: 'deadline' });
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: SINCE, token: null, lastAt: NOW, shortfall: 0 });
});

test('a channel deactivated during the check propagates ChannelDeactivatedError with no advance', async () => {
	await seed();
	youtube.threads = async () => {
		await testDb().db.update(channels).set({ active: 0 }).where(eq(channels.id, 'UC1'));
		return listPage([thread('top-1', THREAD_AT)], 'page-2');
	};

	await expect(tick()).rejects.toBeInstanceOf(ChannelDeactivatedError);
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: SINCE, token: null, lastAt: NOW, shortfall: 0 });
});

test('an enforcement failure is logged and recorded, its action stays outstanding, and the pass still finishes', async () => {
	const ruleId = await addRule('hold');
	await seed();
	youtube.threads = () => listPage([thread('top-1', THREAD_AT, { totalReplyCount: 1, replies: [resource('reply-1', REPLY_AT, 'viewer-b', 'spam-word reply')] })]);
	youtube.moderation = () => new Response('bad request', { status: 400 });
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});

	const result = await tick();

	expect(result.status).toBe('finished');
	expect(result.enforcementError).toContain('setModerationStatus failed: 400');
	expect(error).toHaveBeenCalledWith('reply recheck enforcement failed for channel UC1; its actions stay outstanding for the next run', expect.any(Error));
	expect(await actionRows()).toEqual([{ commentId: 'reply-1', action: 'hold', state: 'dispatched', reason: `rule #${ruleId} (keyword: spam-word)` }]);
	expect(await replyColumns()).toEqual({ since: SINCE, boundary: null, token: null, lastAt: NOW, shortfall: 0 });
});

test('an eleventh reply delete in one check becomes a reject that is enforced, and a later enforcement run deletes nothing more', async () => {
	const ruleId = await addRule('delete');
	await seed();
	const ids = Array.from({ length: 11 }, (_, index) => `del-${String(index + 1).padStart(2, '0')}`);
	youtube.threads = () =>
		listPage([thread('top-1', THREAD_AT, { totalReplyCount: 11, replies: ids.map((id, index) => resource(id, REPLY_AT, `viewer-${index}`, 'spam-word reply')) })]);
	const ruleReason = `rule #${ruleId} (keyword: spam-word)`;

	const result = await tick();

	expect(result).toMatchObject({ status: 'finished', fresh: 11, staged: 11 });
	expect([...youtube.deleted].sort()).toEqual(ids.slice(0, 10));
	expect(youtube.moderated).toEqual([{ ids: ['del-11'], status: 'rejected' }]);
	expect(await storedComments()).toEqual([
		...ids.slice(0, 10).map((id) => ({ id, parentId: 'top-1', status: 'deleted', decidedBy: 'rule', matchedRuleId: ruleId })),
		{ id: 'del-11', parentId: 'top-1', status: 'rejected', decidedBy: 'rule', matchedRuleId: ruleId }
	]);
	expect(await actionRows()).toEqual([
		...ids.slice(0, 10).map((id) => ({ commentId: id, action: 'delete', state: 'completed', reason: ruleReason })),
		{ commentId: 'del-11', action: 'reject', state: 'completed', reason: `${ruleReason}; delete budget reached, hidden instead` }
	]);

	await runEnforcement('UC1', 'access-token', clockMs + HOUR, 'org-1', 0);

	expect(youtube.deleted).toHaveLength(10);
	expect(youtube.moderated).toHaveLength(1);
});

test('a keyword hold rule applies to a reply the same way it applies to a top-level comment', async () => {
	const ruleId = await addRule('hold');
	await seed();
	youtube.threads = () => listPage([thread('top-1', THREAD_AT, { totalReplyCount: 1, replies: [resource('reply-1', REPLY_AT, 'viewer-b', 'spam-word reply')] })]);

	const result = await tick();

	expect(result).toMatchObject({ status: 'finished', staged: 1, acted: 1 });
	expect(await storedComments()).toEqual([{ id: 'reply-1', parentId: 'top-1', status: 'held', decidedBy: 'rule', matchedRuleId: ruleId }]);
	expect(youtube.moderated).toEqual([{ ids: ['reply-1'], status: 'heldForReview' }]);
	expect(await actionRows()).toEqual([{ commentId: 'reply-1', action: 'hold', state: 'completed', reason: `rule #${ruleId} (keyword: spam-word)` }]);
	expect(mocks.scoreComment).not.toHaveBeenCalled();
});

test('capReplyDeletes keeps the first ten reply deletes, hides the rest as rejects, and leaves other decisions unchanged', () => {
	const topLevel = decision('top-del', undefined, 'delete');
	const deletes = Array.from({ length: 12 }, (_, index) => decision(`del-${index + 1}`, 'top-1', 'delete'));
	const hold = decision('hold-1', 'top-1', 'hold');
	const input = [topLevel, ...deletes, hold];
	const hidden = (item: Decision): Decision => ({
		...item,
		status: 'rejected',
		auditAction: 'reject',
		youtubeAction: 'reject',
		reason: `${DECISION_REASON}; delete budget reached, hidden instead`
	});

	const output = capReplyDeletes(input);

	expect(output).toEqual([topLevel, ...deletes.slice(0, 10), hidden(deletes[10] as Decision), hidden(deletes[11] as Decision), hold]);
	expect(deletes.every((item) => item.youtubeAction === 'delete')).toBe(true);
});
