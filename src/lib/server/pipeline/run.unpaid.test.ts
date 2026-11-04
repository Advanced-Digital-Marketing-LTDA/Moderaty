import { beforeEach, expect, test, vi } from 'vitest';

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
