import { beforeEach, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
	fetchNewComments: vi.fn(),
	refreshAccessToken: vi.fn(async () => 'access-token')
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
			UNLIMITED_ACCESS_EMAILS: '',
			MODERATY_DEPLOYMENT: 'official-hosted'
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
		const first = await claimCronWorkload(Date.now() + 60_000);
		expect(first).toMatchObject({ kind: 'live', channel: { id: 'UC1' } });

		// The cron tick then runs the live page (gated as unpaid) and the planted drain, which carries no claim.
		await runChannel('UC1', { deadline: Date.now() + 20_000, maxPages: 1 });
		await runChannel('UC1', { deadline: Date.now() + 20_000, forceDryRun: true, window: { boundary, pageToken: null } });
		if (first.kind === 'live') await releaseCronWorkload(first);

		expect(mocks.fetchNewComments).not.toHaveBeenCalled();
		expect(await drainRow('UC1')).toEqual({ boundary: null, token: null });
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('UC1'));

		// Tick 2: the cleared unpaid channel is no longer a live pick.
		expect(await claimCronWorkload(Date.now() + 60_000)).toEqual({ kind: 'none' });
	} finally {
		warn.mockRestore();
	}
});
