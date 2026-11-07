import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
// Imported first among the app modules: its db mock must be registered before any module loads $lib/server/db.
import { setupTestDb, testDb } from '$lib/server/testdb';
import { channels } from '$lib/server/db/schema';
import { encrypt } from '$lib/server/crypto';
import { ChannelDeactivatedError } from '$lib/server/pipeline/enforcement';
import { REPLY_SWEEP_MIN_REMAINING_MS } from '$lib/server/pipeline/replySweep';
import { MAX_REPLY_LOOKUPS_PER_TICK } from '$lib/server/youtube';

// Synthetic credential fixture: same maintainer-approved exception as cron.test.ts (AGENTS.md).
// The real claim, lease, checkpoint writes and response builder run. Mocked: the live run,
// the reply sweep (unless a test restores the real one), YouTube, the digest and the e-mail
// boundaries. The clock is faked (Date only) so every instant the cron writes is exact.
const FIXED_NOW = Date.parse('2026-11-07T12:00:00.000Z');
const NOW_ISO = new Date(FIXED_NOW).toISOString();
const SINCE = '2026-11-06T00:00:00.000Z';
// The cron's RUN_BUDGET_MS (not exported); the tick deadline is the start plus this.
const RUN_BUDGET_MS = 20_000;
// The sweep's own sub-deadline (REPLY_SWEEP_SUB_DEADLINE_MS, not exported).
const SWEEP_SUB_DEADLINE_MS = 10_000;

const mocks = vi.hoisted(() => ({
	// A hosted deployment with no complimentary accounts, as in cron.gate.test.ts: unset values fail the billing sweeps loudly.
	env: { CRON_SECRET: 'test-secret', DRY_RUN: 'false', ENCRYPTION_KEY: 'cron-replies-test-key', MODERATY_DEPLOYMENT: 'official-hosted', UNLIMITED_ACCESS_EMAILS: 'not-an-email', REPLY_SWEEP_QUOTA_CEILING: '1000000' } as Record<string, string | undefined>,
	order: [] as string[],
	runChannel: vi.fn(),
	runReplySweep: vi.fn(),
	refreshAccessToken: vi.fn(),
	fetchNewComments: vi.fn(),
	generateFeedbackDigest: vi.fn(),
	runFeedbackPreview: vi.fn(),
	sweepWelcomeEmails: vi.fn(),
	retryContactNotifications: vi.fn(),
	sweepAutoTopUp: vi.fn(),
	sweepStalePendingReversals: vi.fn(),
	flushYoutubeUnits: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/welcomeEmail', () => ({ sweepWelcomeEmails: mocks.sweepWelcomeEmails }));
vi.mock('$lib/server/contactNotification', () => ({ retryContactNotifications: mocks.retryContactNotifications }));
vi.mock('$lib/server/pipeline', () => ({ runChannel: mocks.runChannel }));
vi.mock('$lib/server/pipeline/replySweep', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/pipeline/replySweep')>();
	return { ...actual, runReplySweep: mocks.runReplySweep };
});
vi.mock('$lib/server/youtube', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/youtube')>();
	return { ...actual, refreshAccessToken: mocks.refreshAccessToken, fetchNewComments: mocks.fetchNewComments };
});
vi.mock('$lib/server/quota', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/quota')>();
	return { ...actual, flushYoutubeUnits: mocks.flushYoutubeUnits };
});
vi.mock('$lib/server/feedbackDigest', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/feedbackDigest')>();
	return { ...actual, generateFeedbackDigest: mocks.generateFeedbackDigest, runFeedbackPreview: mocks.runFeedbackPreview };
});

// The billing sweeps need Stripe fixtures and cron.test.ts covers them; here they only must not fail the tick.
vi.mock('$lib/server/billing/autotopup', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/billing/autotopup')>();
	return { ...actual, sweepAutoTopUp: mocks.sweepAutoTopUp };
});
vi.mock('$lib/server/billing/ledger', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/billing/ledger')>();
	return { ...actual, sweepStalePendingReversals: mocks.sweepStalePendingReversals };
});

import { GET } from './+server';

setupTestDb(['cron_workload_state', 'channels', 'organizations', 'feedback_digests']);

beforeEach(() => {
	vi.resetAllMocks();
	vi.useFakeTimers({ toFake: ['Date'], now: FIXED_NOW });
	mocks.order.length = 0;
	mocks.env.CRON_SECRET = 'test-secret';
	mocks.env.DRY_RUN = 'false';
	mocks.runChannel.mockImplementation(async (_channelId: string, options?: { forceDryRun?: boolean }) => {
		mocks.order.push(options?.forceDryRun ? 'runChannel:drain' : 'runChannel:live');
		return runResult();
	});
	mocks.runReplySweep.mockImplementation(async () => {
		mocks.order.push('runReplySweep');
		return sweepResult();
	});
	mocks.refreshAccessToken.mockResolvedValue('access-token');
	mocks.fetchNewComments.mockResolvedValue({ comments: [], nextPageToken: null, reachedCursor: true });
	mocks.generateFeedbackDigest.mockImplementation(async () => {
		mocks.order.push('digest');
		return { status: 'skipped', reason: 'disabled' };
	});
	mocks.runFeedbackPreview.mockResolvedValue({ commentsClassified: 0, commentsFailed: 0, pooled: 0, hasMore: false, findings: [] });
	mocks.sweepWelcomeEmails.mockResolvedValue({ scanned: 0, queued: 0, enrollmentErrors: 0, accepted: 0, errors: 0, ambiguous: 0, suppressed: 0 });
	mocks.retryContactNotifications.mockResolvedValue({ sent: 0, errors: 0 });
	mocks.sweepAutoTopUp.mockResolvedValue(0);
	mocks.sweepStalePendingReversals.mockResolvedValue(0);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function call() {
	const url = new URL('http://localhost/api/cron');
	return GET({ url, request: new Request(url, { headers: { authorization: 'Bearer test-secret' } }) } as never);
}

async function callBody(expectedStatus = 200) {
	const response = await call();
	expect(response.status).toBe(expectedStatus);
	return response.json();
}

/** Seeds a minimal active channel whose stored refresh token decrypts. */
async function seedChannel(id: string, extra: Record<string, unknown> = {}) {
	await testDb().db.insert(channels).values({ id, title: `Channel ${id}`, refreshTokenEnc: encrypt('refresh-token'), ...extra });
}

function channelRow(id: string) {
	return testDb().db.select().from(channels).where(eq(channels.id, id)).get();
}

/** A runChannel result; override only the fields a test asserts on. */
function runResult(overrides: Record<string, unknown> = {}) {
	return { fetched: 0, acted: 0, queued: 0, partial: false, skipped: false, dryRun: false, ...overrides };
}

/** A reply sweep result with no work done; the default is a finished pass. */
function sweepResult(overrides: Record<string, unknown> = {}) {
	return { status: 'finished', fetched: 0, fresh: 0, staged: 0, deferred: 0, acted: 0, queued: 0, shortfall: 0, ownRepliesSkipped: 0, ...overrides };
}

function expectResponseDiagnostic(body: Record<string, unknown>, sweep: string, operation: string, fields: Record<string, unknown> = {}) {
	expect(body.failureDiagnostics).toContainEqual(expect.objectContaining({ sweep, operation, cronRunId: body.cronRunId, ...fields }));
}

function quietErrors() {
	return vi.spyOn(console, 'error').mockImplementation(() => {});
}

test.each([
	{ label: 'skipped', live: { skipped: true } },
	{ label: 'dry run', live: { dryRun: true } },
	{ label: 'partial', live: { partial: true, stoppedReason: 'deadline' } },
	{ label: 'out of credits', live: { outOfCredits: true } },
	{ label: 'unpaid', live: { unpaid: true } }
])('a live run that is $label makes no reply recheck call', async ({ live }) => {
	await seedChannel('UC-matrix', { moderateRepliesSince: SINCE });
	mocks.runChannel.mockResolvedValueOnce(runResult(live));
	const body = await callBody();
	expect(mocks.runReplySweep).not.toHaveBeenCalled();
	expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
	expect(body.results['UC-matrix']).not.toHaveProperty('replySweep');
	expect(body.results['UC-matrix']).not.toHaveProperty('replySweepError');
});

test('a channel with reply moderation off makes no reply recheck call and fetches no token', async () => {
	await seedChannel('UC-off');
	const body = await callBody();
	expect(mocks.runReplySweep).not.toHaveBeenCalled();
	expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
	expect(body.results['UC-off']).not.toHaveProperty('replySweep');
	expect(body.results['UC-off']).not.toHaveProperty('replySweepError');
});

test('a channel with a history scan running makes no reply recheck call and fetches no token', async () => {
	await seedChannel('UC-history', { moderateRepliesSince: SINCE, historyBoundary: '2026-05-01T00:00:00.000Z' });
	const body = await callBody();
	expect(mocks.runReplySweep).not.toHaveBeenCalled();
	expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
	expect(body.results['UC-history']).not.toHaveProperty('replySweep');
});

test.each([
	{ label: 'exactly the minimum left', remaining: REPLY_SWEEP_MIN_REMAINING_MS, calls: 1 },
	{ label: 'one millisecond under the minimum left', remaining: REPLY_SWEEP_MIN_REMAINING_MS - 1, calls: 0 }
])('with $label after the live run, the recheck is called $calls time(s)', async ({ remaining, calls }) => {
	await seedChannel('UC-time', { moderateRepliesSince: SINCE });
	// The live run spends the budget, leaving `remaining` ms before the tick deadline.
	mocks.runChannel.mockImplementationOnce(async () => {
		vi.setSystemTime(FIXED_NOW + RUN_BUDGET_MS - remaining);
		return runResult();
	});
	await callBody();
	expect(mocks.runReplySweep).toHaveBeenCalledTimes(calls);
});

test('an eligible channel runs one recheck with the fresh row, the tick token and the tick deadline', async () => {
	await seedChannel('UC-replies', { moderateRepliesSince: SINCE });
	const body = await callBody();
	expect(mocks.refreshAccessToken).toHaveBeenCalledWith('refresh-token', FIXED_NOW + RUN_BUDGET_MS);
	expect(mocks.runReplySweep).toHaveBeenCalledTimes(1);
	const [passed, token, deadline] = mocks.runReplySweep.mock.calls[0];
	expect(passed).toMatchObject({ id: 'UC-replies', moderateRepliesSince: SINCE });
	expect(token).toBe('access-token');
	expect(deadline).toBe(FIXED_NOW + RUN_BUDGET_MS);
	expect(body.results['UC-replies']).toMatchObject({ dryRun: false, replySweep: sweepResult() });
	expect(body.results['UC-replies'].replySweep.status).toBe('finished');
	expect(body.results['UC-replies']).not.toHaveProperty('replySweepError');
});

test('the recheck receives the setting as it stands after the live run', async () => {
	const newer = '2026-11-07T11:00:00.000Z';
	await seedChannel('UC-newer', { moderateRepliesSince: SINCE });
	mocks.runChannel.mockImplementationOnce(async () => {
		await testDb().db.update(channels).set({ moderateRepliesSince: newer }).where(eq(channels.id, 'UC-newer'));
		return runResult();
	});
	await callBody();
	expect(mocks.runReplySweep).toHaveBeenCalledTimes(1);
	expect(mocks.runReplySweep.mock.calls[0][0]).toMatchObject({ id: 'UC-newer', moderateRepliesSince: newer });
});

test('a setting turned off during the live run makes no reply recheck call', async () => {
	await seedChannel('UC-toggled', { moderateRepliesSince: SINCE });
	mocks.runChannel.mockImplementationOnce(async () => {
		await testDb().db.update(channels).set({ moderateRepliesSince: null }).where(eq(channels.id, 'UC-toggled'));
		return runResult();
	});
	const body = await callBody();
	expect(mocks.runReplySweep).not.toHaveBeenCalled();
	expect(body.results['UC-toggled']).not.toHaveProperty('replySweep');
});

test('the recheck runs after the live run and before the dry-run drain and the digest', async () => {
	await seedChannel('UC-order', { moderateRepliesSince: SINCE, dryRunBoundary: '2026-05-01T00:00:00.000Z' });
	await callBody();
	expect(mocks.order).toEqual(['runChannel:live', 'runReplySweep', 'runChannel:drain', 'digest']);
});

test('a recheck error is reported in its own field, leaves run health as the live run wrote it, and the digest still runs', async () => {
	await seedChannel('UC-boom', { moderateRepliesSince: SINCE, lastRunStatus: 'failed', lastRunError: 'quota', lastSuccessAt: '2026-11-01T00:00:00.000Z' });
	mocks.runReplySweep.mockImplementationOnce(async () => {
		mocks.order.push('runReplySweep');
		throw new Error('boom');
	});
	const log = quietErrors();
	const body = await callBody();
	expect(body.ok).toBe(true);
	expect(body.results['UC-boom']).toEqual({ ...runResult(), replySweepError: `unknown service=youtube operation=reply_recheck run=${body.cronRunId} causes=Error` });
	expectResponseDiagnostic(body, 'replySweepError', 'reply_recheck', { category: 'unknown', service: 'youtube' });
	// The live run's verdict, not the recheck's: a success that stamps the success columns.
	expect(await channelRow('UC-boom')).toMatchObject({ lastRunStatus: 'success', lastRunError: null, lastSuccessAt: NOW_ISO, lastRunAt: NOW_ISO });
	expect(mocks.order).toEqual(['runChannel:live', 'runReplySweep', 'digest']);
	expect(log).toHaveBeenCalledWith('cron: reply recheck failed for channel UC-boom');
});

test('a channel deactivated during the recheck reports a deactivated partial, with no error and no health change', async () => {
	await seedChannel('UC-gone', { moderateRepliesSince: SINCE, lastRunStatus: 'failed', lastRunError: 'quota', lastSuccessAt: '2026-11-01T00:00:00.000Z' });
	mocks.runReplySweep.mockRejectedValueOnce(new ChannelDeactivatedError('channel deactivated mid-run: UC-gone'));
	const body = await callBody();
	expect(body.ok).toBe(true);
	expect(body.results['UC-gone'].replySweep).toEqual({ status: 'partial', reason: 'deactivated' });
	expect(body.results['UC-gone']).not.toHaveProperty('replySweepError');
	expect(body.failureDiagnostics).not.toContainEqual(expect.objectContaining({ sweep: 'replySweepError' }));
	expect(await channelRow('UC-gone')).toMatchObject({ lastRunStatus: 'success', lastRunError: null, lastSuccessAt: NOW_ISO });
});

test('an enforcement failure inside the recheck is classified, never returned, and its text stays out of the body and the logs', async () => {
	// Synthetic secret-like text: it must not reach the response body or any console call.
	await seedChannel('UC-enforce', { moderateRepliesSince: SINCE });
	mocks.runReplySweep.mockImplementationOnce(async () => {
		mocks.order.push('runReplySweep');
		return sweepResult({ status: 'advanced', enforcementError: 'quotaExceeded test-secret https://private.invalid/comments' });
	});
	const log = quietErrors();
	const body = await callBody();
	expect(body.results['UC-enforce'].replySweep).toEqual(sweepResult({ status: 'advanced' }));
	expect(body.results['UC-enforce'].replySweepError).toBe(`unknown service=youtube operation=reply_recheck run=${body.cronRunId} causes=Error`);
	expect(JSON.stringify([body, log.mock.calls])).not.toMatch(/test-secret|private\.invalid|quotaExceeded/);
});

test('under DRY_RUN=true a dry live run never reaches the recheck', async () => {
	mocks.env.DRY_RUN = 'true';
	await seedChannel('UC-dry-env', { moderateRepliesSince: SINCE });
	mocks.runChannel.mockResolvedValueOnce(runResult({ dryRun: true }));
	const body = await callBody();
	expect(mocks.runReplySweep).not.toHaveBeenCalled();
	expect(body.results['UC-dry-env']).not.toHaveProperty('replySweep');
});

test('a non-dry live run under DRY_RUN=true reaches the real gate, which refuses with dry-run and writes no reply column', async () => {
	mocks.env.DRY_RUN = 'true';
	const actual = await vi.importActual<typeof import('$lib/server/pipeline/replySweep')>('$lib/server/pipeline/replySweep');
	mocks.runReplySweep.mockImplementationOnce(actual.runReplySweep);
	await seedChannel('UC-env-dry', { moderateRepliesSince: SINCE });
	mocks.runChannel.mockResolvedValueOnce(runResult({ dryRun: false }));
	const body = await callBody();
	expect(mocks.runReplySweep).toHaveBeenCalledTimes(1);
	expect(body.results['UC-env-dry'].replySweep).toEqual({ fetched: 0, fresh: 0, staged: 0, deferred: 0, acted: 0, queued: 0, ownRepliesSkipped: 0, reason: 'dry-run', status: 'skipped', shortfall: 0 });
	expect(await channelRow('UC-env-dry')).toMatchObject({ moderateRepliesSince: SINCE, replySweepBoundary: null, replySweepPageToken: null, replySweepLastAt: null, replySweepShortfall: null });
});

test('the real recheck on an empty fetch finishes the pass and writes only its checkpoint columns', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/pipeline/replySweep')>('$lib/server/pipeline/replySweep');
	mocks.runReplySweep.mockImplementationOnce(actual.runReplySweep);
	await seedChannel('UC-empty', { moderateRepliesSince: SINCE });
	const body = await callBody();
	// The pass starts at the enable time: later than the 72 h lookback.
	expect(mocks.fetchNewComments).toHaveBeenCalledWith('UC-empty', 'access-token', SINCE, expect.objectContaining({
		maxPages: 1, includeReplies: true, pageToken: null, deadline: FIXED_NOW + SWEEP_SUB_DEADLINE_MS, replyLookupBudget: MAX_REPLY_LOOKUPS_PER_TICK
	}));
	expect(body.results['UC-empty'].replySweep).toEqual({ fetched: 0, fresh: 0, staged: 0, deferred: 0, acted: 0, queued: 0, ownRepliesSkipped: 0, status: 'finished', shortfall: 0 });
	expect(await channelRow('UC-empty')).toMatchObject({
		moderateRepliesSince: SINCE, historyBoundary: null, replySweepBoundary: null, replySweepPageToken: null, replySweepLastAt: NOW_ISO, replySweepShortfall: 0
	});
});

test('a normal tick flushes the quota units exactly once, and the flush adds no quotaFlushError', async () => {
	await seedChannel('UC-once');

	const body = await callBody();

	expect(mocks.flushYoutubeUnits).toHaveBeenCalledTimes(1);
	expect(mocks.flushYoutubeUnits).toHaveBeenCalledWith(expect.anything(), FIXED_NOW);
	expect(body).not.toHaveProperty('quotaFlushError');
});

test('a failed quota flush is reported as quotaFlushError and leaves the run health alone', async () => {
	await seedChannel('UC-flush');
	mocks.flushYoutubeUnits.mockRejectedValueOnce(new Error('database is locked'));
	const error = quietErrors();

	const body = await callBody();

	expect(body.quotaFlushError).toEqual(expect.stringContaining('operation=quota_flush'));
	expectResponseDiagnostic(body, 'quotaFlushError', 'quota_flush');
	expect(error).toHaveBeenCalledWith('cron failure:', expect.any(String));
	expect(await channelRow('UC-flush')).toMatchObject({ lastRunStatus: 'success', lastRunError: null });
});

test('under DRY_RUN=true the quota units are not flushed, so a dry tick writes nothing durable', async () => {
	mocks.env.DRY_RUN = 'true';
	await seedChannel('UC-dry-flush');

	const body = await callBody();

	expect(mocks.flushYoutubeUnits).not.toHaveBeenCalled();
	expect(body).not.toHaveProperty('quotaFlushError');
});

test('a tick that throws before responding still attempts its quota flush', async () => {
	mocks.env.DRY_RUN = 'yes';

	await expect(call()).rejects.toMatchObject({ status: 500, body: { message: 'DRY_RUN must be true or false' } });

	expect(mocks.flushYoutubeUnits).toHaveBeenCalledTimes(1);
});
