import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { TEST_OWNER, postForm, setupTestDb, testDb, wipeTables } from '$lib/server/testdb';
import { auditLog, channelAllowedHandles, channels, comments, moderationActions, organizations, youtubeQuotaUsage } from '$lib/server/db/schema';
import { flushYoutubeUnits } from '$lib/server/quota';
import { DeadlineExceededError } from '$lib/server/http';
import { YoutubeWriteRefusedError } from '$lib/server/youtube';
import { actions as queueActions } from '../../../routes/(app)/channels/[id]/queue/+page.server';
import { runEnforcement } from './enforcement';
import { createFakeYoutube, listPage, refusal, thread } from './fake-youtube';
import { runChannel } from './run';

const mocks = vi.hoisted(() => ({
	env: {
		DRY_RUN: 'false',
		MODERATY_DEPLOYMENT: 'official-hosted',
		UNLIMITED_ACCESS_EMAILS: '',
		OPENAI_API_KEY: 'test-openai-key',
		GOOGLE_CLIENT_ID: 'synthetic-client-id',
		GOOGLE_CLIENT_SECRET: 'synthetic-client-secret'
	} as Record<string, string | undefined>,
	scoreComment: vi.fn(),
	detectJailbreak: vi.fn()
}));

// Only the network is faked: YouTube answers through the fetch fake, and the model calls are stubbed at the
// seams decide() uses. Enforcement, staging, the credit ledger and the database are all real.
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/moderation', () => ({ scoreComment: mocks.scoreComment, serializeScores: () => '{}' }));
vi.mock('$lib/server/jailbreak', () => ({ detectJailbreak: mocks.detectJailbreak }));
vi.mock('$lib/server/crypto', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/crypto')>()),
	decrypt: () => 'synthetic-refresh-token'
}));

setupTestDb([
	'channels',
	'comments',
	'organizations',
	'credit_transactions',
	'stripe_subscription_periods',
	'audit_log',
	'moderation_actions',
	'rules',
	'channel_allowed_handles',
	'youtube_quota_usage'
]);

const CHANNEL = 'UC1';
const CURSOR = '2026-11-06T00:00:00.000Z';
const NEWEST = '2026-11-07T10:00:00.000Z';
const REPLY_AT = '2026-11-07T09:00:00.000Z';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const QUEUE_URL = 'http://localhost/channels/UC1/queue';

const youtube = createFakeYoutube();
const db = () => testDb().db;
const ENFORCE = () => runEnforcement(CHANNEL, 'access-token', undefined, null, 0);

/** The error a run rejects with; fails the test when the run resolves. */
async function failureOf(run: Promise<unknown>): Promise<Error> {
	try {
		await run;
	} catch (error) {
		return error as Error;
	}
	throw new Error('expected the run to reject');
}

async function seedChannel(values: Partial<typeof channels.$inferInsert> = {}) {
	await db().insert(organizations).values({ id: 'org-1', name: 'Org', creditsRemaining: 1000 });
	await db().insert(channels).values({
		id: CHANNEL,
		userId: TEST_OWNER.id,
		orgId: 'org-1',
		title: 'Channel',
		refreshTokenEnc: 'synthetic-grant',
		cursor: CURSOR,
		moderateRepliesSince: CURSOR,
		...values
	});
}

/** A stored comment; a reply when `parentId` is set. */
async function seedComment(id: string, status: string, parentId: string | null = null, decidedBy = 'rule') {
	await db().insert(comments).values({ id, channelId: CHANNEL, text: `text ${id}`, publishedAt: REPLY_AT, status, decidedBy, parentId });
}

async function seedAction(commentId: string, action: string, state: string) {
	await db().insert(moderationActions).values({ commentId, channelId: CHANNEL, action, reason: 'rule #1 (keyword: spam-word)', state });
}

async function actionOf(commentId: string) {
	return db()
		.select({ action: moderationActions.action, state: moderationActions.state, lastAttemptAt: moderationActions.lastAttemptAt, reason: moderationActions.reason })
		.from(moderationActions)
		.where(eq(moderationActions.commentId, commentId))
		.get();
}

async function statusOf(id: string) {
	return db().select({ status: comments.status, decidedBy: comments.decidedBy }).from(comments).where(eq(comments.id, id)).get();
}

async function auditRows() {
	return db()
		.select({ commentId: auditLog.commentId, action: auditLog.action, reason: auditLog.reason, actor: auditLog.actor, authorHandle: auditLog.authorHandle, text: auditLog.text })
		.from(auditLog)
		.orderBy(auditLog.id)
		.all();
}

async function checkpointOf() {
	return db()
		.select({ cursor: channels.cursor, scanCursor: channels.scanCursor, nextPageToken: channels.nextPageToken })
		.from(channels)
		.where(eq(channels.id, CHANNEL))
		.get();
}

/** Requests to one route that name the given comment id. */
function writesFor(route: 'moderation' | 'remove', id: string) {
	return youtube.requests.filter((request) => request.route === route && (request.params.get('id') ?? '').split(',').includes(id));
}

beforeEach(() => {
	youtube.reset();
	vi.stubGlobal('fetch', youtube.fetch);
	mocks.env.DRY_RUN = 'false';
	mocks.env.REPLY_SWEEP_QUOTA_CEILING = '1000000';
	mocks.scoreComment.mockReset();
	mocks.scoreComment.mockResolvedValue({ score: 0.1, scores: {} });
	mocks.detectJailbreak.mockReset();
	mocks.detectJailbreak.mockResolvedValue({ flagged: false, confidence: 0.1 });
});

afterEach(() => {
	// A request the fixtures did not route would otherwise be swallowed by a caller that tolerates failures.
	expect(youtube.unrouted).toEqual([]);
	vi.unstubAllGlobals();
});

describe('a refused reply write', () => {
	test('parks the reply: failed row, comment back in the queue, one failed audit row', async () => {
		await seedChannel();
		await seedComment('reply-1', 'pending', 'top-1', 'none');
		await seedAction('reply-1', 'hold', 'pending');
		youtube.handlers.moderation = () => refusal(400, 'operationNotSupported');

		await expect(ENFORCE()).resolves.toMatchObject({ acted: 0, replyActionFailures: 1 });

		expect(await actionOf('reply-1')).toMatchObject({ action: 'hold', state: 'failed', lastAttemptAt: expect.stringMatching(ISO) });
		expect(await statusOf('reply-1')).toEqual({ status: 'pending', decidedBy: 'none' });
		expect(await auditRows()).toEqual([
			{
				commentId: 'reply-1',
				action: 'failed',
				reason: 'reply hold refused by YouTube: 400 operationNotSupported',
				actor: 'system',
				authorHandle: null,
				text: null
			}
		]);
	});

	test('does not stop a top-level reject in the same run', async () => {
		await seedChannel();
		await seedComment('reply-1', 'pending', 'top-1', 'none');
		await seedAction('reply-1', 'hold', 'pending');
		await seedComment('top-2', 'rejected');
		await seedAction('top-2', 'reject', 'pending');
		youtube.handlers.moderation = (params) =>
			params.get('id') === 'reply-1' ? refusal(400, 'operationNotSupported') : new Response(null, { status: 204 });

		await expect(ENFORCE()).resolves.toMatchObject({ replyActionFailures: 1 });

		const rejects = writesFor('moderation', 'top-2');
		expect(rejects.map((request) => request.params.get('moderationStatus'))).toEqual(['rejected']);
		expect(await actionOf('top-2')).toMatchObject({ state: 'completed' });
		expect(await actionOf('reply-1')).toMatchObject({ state: 'failed' });
	});

	test('a refused top-level reject in the same run as a reply reject stops the run first: the reply is never written and stays dispatched', async () => {
		await seedChannel();
		await seedComment('reply-r', 'rejected', 'top-1');
		await seedAction('reply-r', 'reject', 'pending');
		await seedComment('top-r', 'rejected');
		await seedAction('top-r', 'reject', 'pending');
		youtube.handlers.moderation = (params) =>
			params.get('id') === 'top-r' ? refusal(400, 'operationNotSupported') : new Response(null, { status: 204 });

		const error = await failureOf(ENFORCE());

		expect(error).toBeInstanceOf(YoutubeWriteRefusedError);
		expect(error.message).toBe('setModerationStatus failed: 400 {"error":{"code":400,"message":"synthetic refusal","errors":[{"domain":"youtube.comment","reason":"operationNotSupported","message":"synthetic refusal"}]}}');
		// One write was sent, for the top-level comment alone: the reply never shares a request with it.
		expect(youtube.requests.filter((request) => request.route === 'moderation').map((request) => request.params.get('id'))).toEqual(['top-r']);
		expect(await actionOf('top-r')).toMatchObject({ state: 'dispatched' });
		expect(await actionOf('reply-r')).toMatchObject({ state: 'dispatched' });
		expect(await statusOf('top-r')).toEqual({ status: 'rejected', decidedBy: 'rule' });
		expect(await statusOf('reply-r')).toEqual({ status: 'rejected', decidedBy: 'rule' });
		expect(await auditRows()).toEqual([]);
	});

	test('a 403 forbidden on a reply reject parks the row with its status', async () => {
		await seedChannel();
		await seedComment('reply-3', 'rejected', 'top-1');
		await seedAction('reply-3', 'reject', 'pending');
		youtube.handlers.moderation = () => refusal(403, 'forbidden');

		await expect(ENFORCE()).resolves.toMatchObject({ replyActionFailures: 1 });

		expect(await actionOf('reply-3')).toMatchObject({ action: 'reject', state: 'failed' });
		expect(await statusOf('reply-3')).toEqual({ status: 'pending', decidedBy: 'none' });
		expect(await auditRows()).toEqual([
			expect.objectContaining({ commentId: 'reply-3', action: 'failed', actor: 'system', reason: 'reply reject refused by YouTube: 403 forbidden' })
		]);
	});

	test.each([
		{ action: 'reject', route: 'moderation' },
		{ action: 'ban', route: 'moderation' },
		{ action: 'delete', route: 'remove' }
	] as const)('a refused reply $action is parked with its operation named', async ({ action, route }) => {
		await seedChannel();
		await seedComment('reply-x', 'rejected', 'top-1');
		await seedAction('reply-x', action, 'pending');
		youtube.handlers[route] = () => refusal(403, 'forbidden');

		await expect(ENFORCE()).resolves.toMatchObject({ replyActionFailures: 1 });

		expect(await actionOf('reply-x')).toMatchObject({ action, state: 'failed' });
		expect(await auditRows()).toEqual([expect.objectContaining({ action: 'failed', reason: `reply ${action} refused by YouTube: 403 forbidden` })]);
	});

	test('a deadline during the write propagates and the row is not parked', async () => {
		await seedChannel();
		await seedComment('reply-e', 'pending', 'top-1', 'none');
		await seedAction('reply-e', 'hold', 'pending');
		youtube.handlers.moderation = () => {
			throw new DeadlineExceededError();
		};

		expect(await failureOf(ENFORCE())).toBeInstanceOf(DeadlineExceededError);
		expect(await actionOf('reply-e')).toMatchObject({ state: 'dispatched' });
		expect(await auditRows()).toEqual([]);
	});

	test('a quota refusal propagates and the row stays dispatched for a later retry', async () => {
		await seedChannel();
		await seedComment('reply-q', 'pending', 'top-1', 'none');
		await seedAction('reply-q', 'hold', 'pending');
		youtube.handlers.moderation = () => refusal(403, 'quotaExceeded');

		const error = await failureOf(ENFORCE());

		expect(error).toBeInstanceOf(YoutubeWriteRefusedError);
		expect(error.message).toContain('quotaExceeded');
		expect(await actionOf('reply-q')).toMatchObject({ state: 'dispatched' });
		expect(await auditRows()).toEqual([]);
	});

	test.each([
		{ status: 401, reason: 'authError' },
		{ status: 429, reason: 'rateLimitExceeded' }
	])('a $status on a reply write is run-level: it propagates and the row stays dispatched', async ({ status, reason }) => {
		await seedChannel();
		await seedComment('reply-r', 'pending', 'top-1', 'none');
		await seedAction('reply-r', 'hold', 'pending');
		youtube.handlers.moderation = () => refusal(status, reason);

		expect(await failureOf(ENFORCE())).toBeInstanceOf(YoutubeWriteRefusedError);
		expect(await actionOf('reply-r')).toMatchObject({ state: 'dispatched' });
		expect(await auditRows()).toEqual([]);
	});

	test('a parked reply is not selected by a later run, so no YouTube request is made', async () => {
		await seedChannel();
		await seedComment('reply-g', 'pending', 'top-1', 'none');
		await seedAction('reply-g', 'hold', 'failed');

		await expect(ENFORCE()).resolves.toMatchObject({ acted: 0 });

		expect(youtube.requests).toEqual([]);
		expect(await actionOf('reply-g')).toMatchObject({ state: 'failed' });
		expect(await auditRows()).toEqual([]);
	});

	test('the owner approves a parked reply from the queue, and the failed row is superseded', async () => {
		await seedChannel();
		await seedComment('reply-h', 'pending', 'top-1', 'none');
		await seedAction('reply-h', 'hold', 'failed');

		const result = await queueActions.approve({
			params: { id: CHANNEL },
			request: postForm({ commentId: 'reply-h' }, QUEUE_URL),
			locals: { user: TEST_OWNER }
		} as never);

		expect(result).toMatchObject({ success: expect.stringContaining('Approved') });
		expect(writesFor('moderation', 'reply-h').map((request) => request.params.get('moderationStatus'))).toEqual(['published']);
		expect(await actionOf('reply-h')).toMatchObject({ state: 'superseded' });
		expect(await statusOf('reply-h')).toEqual({ status: 'approved', decidedBy: 'human' });
	});
});

describe('a top-level refusal', () => {
	test('still throws the same error and leaves its row dispatched', async () => {
		await seedChannel();
		await seedComment('top-f', 'rejected');
		await seedAction('top-f', 'reject', 'pending');
		youtube.handlers.moderation = () => refusal(400, 'operationNotSupported');

		const error = await failureOf(ENFORCE());

		expect(error).toBeInstanceOf(YoutubeWriteRefusedError);
		expect(error.message).toMatch(/^setModerationStatus failed: 400 /);
		expect(await actionOf('top-f')).toMatchObject({ state: 'dispatched' });
		expect(await statusOf('top-f')).toEqual({ status: 'rejected', decidedBy: 'rule' });
		expect(await auditRows()).toEqual([]);
	});
});

describe('the live run result and checkpoint', () => {
	test('counts the reply rows it parked', async () => {
		await seedChannel();
		await seedComment('reply-i1', 'pending', 'top-1', 'none');
		await seedAction('reply-i1', 'hold', 'pending');
		await seedComment('reply-i2', 'pending', 'top-1', 'none');
		await seedAction('reply-i2', 'hold', 'pending');
		youtube.handlers.moderation = () => refusal(400, 'operationNotSupported');

		await expect(runChannel(CHANNEL)).resolves.toMatchObject({ replyActionFailures: 2 });
	});

	test('omits the count when no reply write fails', async () => {
		await seedChannel();
		await seedComment('reply-i3', 'pending', 'top-1', 'none');
		await seedAction('reply-i3', 'hold', 'pending');

		const result = await runChannel(CHANNEL);

		expect(result).not.toHaveProperty('replyActionFailures');
		expect(await actionOf('reply-i3')).toMatchObject({ state: 'completed' });
	});

	test('a refused reply write does not hold the live scan checkpoint', async () => {
		await seedChannel();
		await seedComment('reply-j', 'pending', 'top-1', 'none');
		await seedAction('reply-j', 'hold', 'pending');
		youtube.handlers.threads = () => listPage([thread('top-9', NEWEST)], 'page-2');
		youtube.handlers.moderation = () => refusal(400, 'operationNotSupported');

		await expect(runChannel(CHANNEL)).resolves.toMatchObject({ replyActionFailures: 1 });

		expect(await checkpointOf()).toEqual({ cursor: CURSOR, scanCursor: NEWEST, nextPageToken: 'page-2' });
	});

	test('a reply write that succeeds writes the same checkpoint', async () => {
		await seedChannel();
		await seedComment('reply-j', 'pending', 'top-1', 'none');
		await seedAction('reply-j', 'hold', 'pending');
		youtube.handlers.threads = () => listPage([thread('top-9', NEWEST)], 'page-2');

		await expect(runChannel(CHANNEL)).resolves.not.toHaveProperty('replyActionFailures');

		expect(await checkpointOf()).toEqual({ cursor: CURSOR, scanCursor: NEWEST, nextPageToken: 'page-2' });
		expect(await actionOf('reply-j')).toMatchObject({ state: 'completed' });
	});
});

describe('an unresolvable protected identity on a reply', () => {
	beforeEach(async () => {
		await seedChannel();
		await db().insert(channelAllowedHandles).values({ channelId: CHANNEL, handle: 'protected-person' });
	});

	test('a pending reply reject is downgraded to a hold, not thrown', async () => {
		await seedComment('reply-k1', 'rejected', 'top-1');
		await seedAction('reply-k1', 'reject', 'pending');

		await expect(ENFORCE()).resolves.toBeDefined();

		expect(await actionOf('reply-k1')).toMatchObject({ action: 'hold', reason: 'protected identity unresolved', state: 'completed' });
		expect(await statusOf('reply-k1')).toEqual({ status: 'pending', decidedBy: 'none' });
		expect(writesFor('moderation', 'reply-k1').map((request) => request.params.get('moderationStatus'))).toEqual(['heldForReview']);
	});

	test('a dispatched reply reject is parked without a YouTube write', async () => {
		await seedComment('reply-k2', 'rejected', 'top-1');
		await seedAction('reply-k2', 'reject', 'dispatched');

		await expect(ENFORCE()).resolves.toMatchObject({ acted: 0, replyActionFailures: 1 });

		expect(await actionOf('reply-k2')).toMatchObject({ state: 'failed' });
		expect(await statusOf('reply-k2')).toEqual({ status: 'pending', decidedBy: 'none' });
		expect(await auditRows()).toEqual([
			expect.objectContaining({ commentId: 'reply-k2', action: 'failed', reason: 'reply reject not sent: protected identity unavailable' })
		]);
		expect(writesFor('moderation', 'reply-k2')).toEqual([]);
	});

	test('a dispatched top-level reject still throws as before', async () => {
		await seedComment('top-k', 'rejected');
		await seedAction('top-k', 'reject', 'dispatched');

		const error = await failureOf(ENFORCE());

		expect(error.message).toBe('Protected identity is unavailable for a dispatched action; destructive retry deferred');
		expect(await actionOf('top-k')).toMatchObject({ state: 'dispatched' });
		expect(writesFor('moderation', 'top-k')).toEqual([]);
	});
});

describe('a human claim that lands during a refused reply write', () => {
	async function claimOf(id: string) {
		return db()
			.select({ token: comments.humanDispatchToken, state: comments.humanDispatchState })
			.from(comments)
			.where(eq(comments.id, id))
			.get();
	}

	test.each([
		{ claim: 'the restoring status', status: 'restoring', token: null, state: null },
		{ claim: 'a dispatch token', status: 'approved', token: 'claim-token', state: null },
		{ claim: 'an in-flight dispatch state', status: 'approved', token: null, state: 'in_flight' }
	] as const)('the refused reply is parked, and $claim is kept', async ({ status, token, state }) => {
		await seedChannel();
		await seedComment('reply-c', 'pending', 'top-1', 'rule');
		await seedAction('reply-c', 'hold', 'pending');
		youtube.handlers.moderation = async () => {
			// The claim commits after the run read the comment, while the hold write is in flight.
			await db().update(comments).set({ status, humanDispatchToken: token, humanDispatchState: state }).where(eq(comments.id, 'reply-c'));
			return refusal(400, 'operationNotSupported');
		};

		await expect(ENFORCE()).resolves.toMatchObject({ acted: 0, replyActionFailures: 1 });

		expect(await statusOf('reply-c')).toEqual({ status, decidedBy: 'rule' });
		expect(await claimOf('reply-c')).toEqual({ token, state });
		// The action row is parked by design: finalizeHumanIntent supersedes a failed reply row when the human decision lands.
		expect(await actionOf('reply-c')).toMatchObject({ action: 'hold', state: 'failed' });
		expect(await auditRows()).toEqual([
			{
				commentId: 'reply-c',
				action: 'failed',
				reason: 'reply hold refused by YouTube: 400 operationNotSupported',
				actor: 'system',
				authorHandle: null,
				text: null
			}
		]);
	});
});

describe('the reply write budget', () => {
	beforeEach(async () => {
		mocks.env.REPLY_SWEEP_QUOTA_CEILING = '1000';
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(Date.parse('2026-11-07T12:00:00.000Z'));
		// Units recorded by earlier tests in this file are still pending in memory. Drain them, then start the day empty.
		await flushYoutubeUnits(db());
		await wipeTables(['youtube_quota_usage']);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('a reply reject waits when the day cannot pay for a whole batch of reply writes', async () => {
		await seedChannel({ moderateRepliesSince: CURSOR });
		await db().insert(youtubeQuotaUsage).values({ day: '2026-11-07', units: 950 });
		await seedComment('reply-1', 'rejected', 'top-1', 'rule');
		await seedAction('reply-1', 'reject', 'pending');

		await ENFORCE();

		expect(writesFor('moderation', 'reply-1')).toEqual([]);
		expect(await actionOf('reply-1')).toMatchObject({ state: 'pending' });
	});

	test('a pending reply reject is not written once the owner has turned reply moderation off', async () => {
		await seedChannel({ moderateRepliesSince: null });
		await seedComment('reply-1', 'rejected', 'top-1', 'rule');
		await seedAction('reply-1', 'reject', 'pending');

		await ENFORCE();

		expect(writesFor('moderation', 'reply-1')).toEqual([]);
		expect(await actionOf('reply-1')).toMatchObject({ state: 'pending' });
	});

	test('pending reply deletes are admitted only up to what the day pays for after one batch is reserved', async () => {
		await seedChannel({ moderateRepliesSince: CURSOR });
		// 700 used of 1000 leaves 300. A batch reserves 100, so 200 remain: four deletes at 50 each.
		await db().insert(youtubeQuotaUsage).values({ day: '2026-11-07', units: 700 });
		for (let i = 1; i <= 6; i += 1) {
			await seedComment(`reply-${i}`, 'rejected', 'top-1', 'rule');
			await seedAction(`reply-${i}`, 'delete', 'pending');
		}

		await ENFORCE();

		const deleted = [1, 2, 3, 4, 5, 6].filter((i) => writesFor('remove', `reply-${i}`).length > 0);
		expect(deleted).toHaveLength(4);
	});
});
