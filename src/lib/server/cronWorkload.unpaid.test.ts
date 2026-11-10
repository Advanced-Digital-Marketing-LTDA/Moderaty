import { beforeEach, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
	fetchNewComments: vi.fn(),
	refreshAccessToken: vi.fn(async () => 'access-token'),
	env: { UNLIMITED_ACCESS_EMAILS: '' as string | undefined }
}));

// Only YouTube is mocked. The claim, the billing gate, the drain backstop, and the DB are real.
vi.mock('$env/dynamic/private', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$env/dynamic/private')>();
	return {
		env: {
			...actual.env,
			DRY_RUN: 'false',
			ENCRYPTION_KEY: 'cron-unpaid-test-key',
			OPENAI_API_KEY: 'test-openai-key',
			MODERATY_DEPLOYMENT: 'official-hosted',
			// Read live so a test can change the complimentary list per case.
			get UNLIMITED_ACCESS_EMAILS() {
				return mocks.env.UNLIMITED_ACCESS_EMAILS;
			}
		}
	};
});
vi.mock('$lib/server/youtube', async (original) => ({
	...(await original<typeof import('$lib/server/youtube')>()),
	fetchNewComments: mocks.fetchNewComments,
	refreshAccessToken: mocks.refreshAccessToken
}));

import { encrypt } from '$lib/server/crypto';
import { channels, organizations } from '$lib/server/db/schema';
import { setupTestDb, testDb } from '$lib/server/testdb';

import { claimCronWorkload, releaseCronWorkload } from './cronWorkload';
import { runChannel } from './pipeline/run';
import { countDbStatements } from './testdb';

setupTestDb([
	'cron_workload_state',
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

beforeEach(() => {
	vi.clearAllMocks();
	mocks.env.UNLIMITED_ACCESS_EMAILS = '';
	mocks.fetchNewComments.mockResolvedValue({ comments: [], nextPageToken: null, reachedCursor: true });
});

async function drainRow(id: string) {
	const row = await testDb()
		.db.select({ boundary: channels.dryRunBoundary, token: channels.dryRunPageToken })
		.from(channels)
		.where(eq(channels.id, id))
		.get();
	return { boundary: row?.boundary ?? null, token: row?.token ?? null };
}

test('a pre-cap drain on an unpaid org is picked once, fetches nothing, clears, and is not picked again', async () => {
	// Pre-cap state: an unpaid org's channel with a window planted at page 1, which has no page token.
	const boundary = '2026-05-01T00:00:00.000Z';
	await testDb().db.insert(organizations).values({ id: 'org-1', name: 'Org', creditsRemaining: null });
	await testDb()
		.db.insert(channels)
		.values({ id: 'UC1', userId: 'owner-1', orgId: 'org-1', title: 'Channel', refreshTokenEnc: encrypt('refresh-token'), dryRunBoundary: boundary, dryRunPageToken: null });
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

	try {
		// Tick 1: the drain-state exception puts the channel in the live pick, once.
		const first = await claimCronWorkload(Date.now() + 60_000, () => {});
		expect(first).toMatchObject({ kind: 'live', channel: { id: 'UC1' } });

		// The cron tick then runs the live page (gated as unpaid) and the planted drain, which carries no claim.
		await runChannel('UC1', { deadline: Date.now() + 20_000, maxPages: 1 });
		await runChannel('UC1', { deadline: Date.now() + 20_000, forceDryRun: true, window: { boundary, pageToken: null } });
		if (first.kind === 'live') await releaseCronWorkload(first);

		expect(mocks.fetchNewComments).not.toHaveBeenCalled();
		expect(await drainRow('UC1')).toEqual({ boundary: null, token: null });
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('UC1'));

		// Tick 2: the cleared unpaid channel is no longer a live pick.
		expect(await claimCronWorkload(Date.now() + 60_000, () => {})).toEqual({ kind: 'none' });
	} finally {
		warn.mockRestore();
	}
});

test('a malformed complimentary list leaves the funded channel claimable and reports the bad entry by position', async () => {
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'not-an-email';
	await testDb().db.insert(organizations).values([
		{ id: 'org-funded', name: 'Funded', creditsRemaining: 5 },
		{ id: 'org-unpaid', name: 'Unpaid', creditsRemaining: null }
	]);
	// The unpaid channel is older, so it would win the least-recently-run pick if the gate did not exclude it.
	await testDb().db.insert(channels).values([
		{ id: 'UC-funded', userId: 'owner-funded', orgId: 'org-funded', title: 'Funded', refreshTokenEnc: encrypt('refresh-token'), lastRunAt: '2026-06-01T00:00:00.000Z' },
		{ id: 'UC-unpaid', userId: 'owner-unpaid', orgId: 'org-unpaid', title: 'Unpaid', refreshTokenEnc: encrypt('refresh-token'), lastRunAt: '2026-01-01T00:00:00.000Z' }
	]);
	const onGateError = vi.fn();

	const first = await claimCronWorkload(Date.now() + 60_000, onGateError);
	expect(first).toMatchObject({ kind: 'live', channel: { id: 'UC-funded' } });
	expect(onGateError).toHaveBeenCalledTimes(1);
	const cause = onGateError.mock.calls[0][0] as Error;
	expect(cause.message).toBe('UNLIMITED_ACCESS_EMAILS entry 1 is not a valid email address');
	expect(cause.message).not.toContain('not-an-email');

	// The funded channel holds its lease; the unpaid channel must not be offered on a second claim either.
	expect(await claimCronWorkload(Date.now() + 60_000, onGateError)).toEqual({ kind: 'none' });
});

test('the complimentary list is read in the same number of statements however many orgs are unpaid', async () => {
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'other@example.test';
	async function claimStatementCount(orgCount: number): Promise<number> {
		await testDb().db.delete(channels);
		await testDb().db.delete(organizations);
		const orgIds = Array.from({ length: orgCount }, (_, index) => `org-${orgCount}-${index}`);
		await testDb().db.insert(organizations).values(orgIds.map((id) => ({ id, name: id, creditsRemaining: null })));
		await testDb().db.insert(channels).values(orgIds.map((orgId) => ({
			id: `UC-${orgId}`, userId: `owner-${orgId}`, orgId, title: orgId, refreshTokenEnc: encrypt('refresh-token')
		})));
		const { count } = await countDbStatements(testDb().db, () => claimCronWorkload(Date.now() + 60_000, () => {}));
		return count;
	}

	const oneOrg = await claimStatementCount(1);
	const twentyOrgs = await claimStatementCount(20);
	expect(twentyOrgs).toBe(oneOrg);
});

test('a busy retry of the claim transaction reports the complimentary list error once', async () => {
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'not-an-email';
	await testDb().db.insert(organizations).values([
		{ id: 'org-funded', name: 'Funded', creditsRemaining: 5 },
		{ id: 'org-unpaid', name: 'Unpaid', creditsRemaining: null }
	]);
	await testDb().db.insert(channels).values([
		{ id: 'UC-funded', userId: 'owner-funded', orgId: 'org-funded', title: 'Funded', refreshTokenEnc: encrypt('refresh-token'), lastRunAt: '2026-06-01T00:00:00.000Z' },
		{ id: 'UC-unpaid', userId: 'owner-unpaid', orgId: 'org-unpaid', title: 'Unpaid', refreshTokenEnc: encrypt('refresh-token'), lastRunAt: '2026-01-01T00:00:00.000Z' }
	]);
	const onGateError = vi.fn();
	// The first attempt runs the whole claim, then fails as busy, so withBusyRetry runs it again.
	const realTransaction = testDb().db.transaction.bind(testDb().db);
	let failedOnce = false;
	const transaction = vi.spyOn(testDb().db, 'transaction').mockImplementation(((callback: Parameters<typeof realTransaction>[0], config?: Parameters<typeof realTransaction>[1]) => {
		if (failedOnce) return realTransaction(callback, config);
		failedOnce = true;
		return realTransaction(async (tx) => {
			await callback(tx);
			throw Object.assign(new Error('database is busy'), { code: 'SQLITE_BUSY' });
		}, config);
	}) as never);

	try {
		const claim = await claimCronWorkload(Date.now() + 60_000, onGateError);
		expect(claim).toMatchObject({ kind: 'live', channel: { id: 'UC-funded' } });
		expect(transaction).toHaveBeenCalledTimes(2);
		expect(onGateError).toHaveBeenCalledTimes(1);
	} finally {
		transaction.mockRestore();
	}
});
