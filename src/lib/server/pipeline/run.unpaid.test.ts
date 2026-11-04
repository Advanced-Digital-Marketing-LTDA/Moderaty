import { beforeEach, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
	fetchNewComments: vi.fn(),
	refreshAccessToken: vi.fn(async () => 'access-token')
}));

// Only YouTube is mocked. The billing gate, the org row, and the channel row are real, in the in-memory test DB.
vi.mock('$env/dynamic/private', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$env/dynamic/private')>();
	return {
		env: {
			...actual.env,
			DRY_RUN: 'false',
			ENCRYPTION_KEY: 'run-gate-test-key',
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

import { runChannel } from './run';

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

beforeEach(() => {
	vi.clearAllMocks();
	mocks.fetchNewComments.mockResolvedValue({ comments: [], nextPageToken: null, reachedCursor: true });
});

async function seedChannelWithOrg(creditsRemaining: number | null) {
	await testDb().db.insert(organizations).values({ id: 'org-1', name: 'Org', creditsRemaining });
	await testDb()
		.db.insert(channels)
		.values({ id: 'UC1', userId: 'owner-1', orgId: 'org-1', title: 'Channel', refreshTokenEnc: encrypt('refresh-token') });
}

test('an unpaid hosted org stops the live run before any YouTube fetch', async () => {
	await seedChannelWithOrg(null);

	const result = await runChannel('UC1');

	expect(result).toMatchObject({ unpaid: true, fetched: 0 });
	expect(mocks.fetchNewComments).not.toHaveBeenCalled();
});

// Control: the same channel fetches once its org is funded, so the test above measures the gate, not a dead path.
test('a funded hosted org runs the same channel and fetches from YouTube', async () => {
	await seedChannelWithOrg(100);

	const result = await runChannel('UC1');

	expect(result.unpaid).toBeUndefined();
	expect(mocks.fetchNewComments).toHaveBeenCalledTimes(1);
});

// Backstop: a dry-run window page token for an unpaid org (a cron drain) is refused before any fetch, and its drain state is cleared so cron never retries it.
test('a planted page token for an unpaid org is refused with no fetch and its drain state is cleared', async () => {
	const boundary = '2026-05-01T00:00:00.000Z';
	await seedChannelWithOrg(null);
	await testDb().db.update(channels).set({ dryRunBoundary: boundary, dryRunPageToken: 'page-2' }).where(eq(channels.id, 'UC1'));
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

	try {
		const result = await runChannel('UC1', { forceDryRun: true, window: { boundary, pageToken: 'page-2' } });

		expect(result).toMatchObject({ unpaid: true, fetched: 0 });
		expect(mocks.fetchNewComments).not.toHaveBeenCalled();
		expect(await testDb().db.select({ boundary: channels.dryRunBoundary, token: channels.dryRunPageToken }).from(channels).where(eq(channels.id, 'UC1')).get()).toEqual({ boundary: null, token: null });
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('UC1'));
	} finally {
		warn.mockRestore();
	}
});
