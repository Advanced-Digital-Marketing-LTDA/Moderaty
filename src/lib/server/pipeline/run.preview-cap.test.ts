import { beforeEach, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
	fetchNewComments: vi.fn(),
	refreshAccessToken: vi.fn(async () => 'access-token'),
	fetchVideoMetadata: vi.fn(),
	fetchAuthorHandles: vi.fn(),
	scoreComment: vi.fn(),
	scoreTone: vi.fn(),
	detectJailbreak: vi.fn()
}));

// YouTube and the three model calls are mocked. The billing gate, the DB, and the run itself are real.
vi.mock('$env/dynamic/private', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$env/dynamic/private')>();
	return {
		env: {
			...actual.env,
			DRY_RUN: 'false',
			ENCRYPTION_KEY: 'preview-cap-test-key',
			OPENAI_API_KEY: 'test-openai-key',
			UNLIMITED_ACCESS_EMAILS: '',
			MODERATY_DEPLOYMENT: 'official-hosted'
		}
	};
});
vi.mock('$lib/server/youtube', async (original) => ({
	...(await original<typeof import('$lib/server/youtube')>()),
	fetchNewComments: mocks.fetchNewComments,
	refreshAccessToken: mocks.refreshAccessToken,
	fetchVideoMetadata: mocks.fetchVideoMetadata,
	fetchAuthorHandles: mocks.fetchAuthorHandles
}));
vi.mock('$lib/server/moderation', () => ({ scoreComment: mocks.scoreComment, serializeScores: () => '{}' }));
vi.mock('$lib/server/tone', () => ({ scoreTone: mocks.scoreTone }));
vi.mock('$lib/server/jailbreak', () => ({ detectJailbreak: mocks.detectJailbreak }));

import { encrypt } from '$lib/server/crypto';
import { auditLog, channels, organizations } from '$lib/server/db/schema';
import { setupTestDb, testDb } from '$lib/server/testdb';

import { runChannel } from './run';

const EPOCH = '1970-01-01T00:00:00.000Z';

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
	mocks.scoreComment.mockResolvedValue({ score: 0.1, scores: {} });
	mocks.scoreTone.mockResolvedValue({ score: 0 });
	mocks.detectJailbreak.mockResolvedValue({ flagged: false, confidence: 0.1 });
	mocks.fetchVideoMetadata.mockResolvedValue(new Map());
	mocks.fetchAuthorHandles.mockResolvedValue(new Map());
});

function comment(i: number) {
	return {
		id: `c${i}`,
		threadId: `c${i}`,
		videoId: 'video-1',
		authorChannelId: `author-${i}`,
		authorName: `Author ${i}`,
		text: `comment ${i}`,
		publishedAt: '2026-01-01T00:00:00.000Z'
	};
}

async function seedChannelWithOrg(creditsRemaining: number | null) {
	await testDb().db.insert(organizations).values({ id: 'org-1', name: 'Org', creditsRemaining });
	await testDb()
		.db.insert(channels)
		.values({ id: 'UC1', userId: 'owner-1', orgId: 'org-1', title: 'Channel', refreshTokenEnc: encrypt('refresh-token') });
}

test('a one-page preview for an unpaid org fetches once and audits exactly its 100 comments', async () => {
	await seedChannelWithOrg(null);
	const page = Array.from({ length: 100 }, (_, i) => comment(i));
	mocks.fetchNewComments.mockResolvedValue({ comments: page, nextPageToken: 'page-2', reachedCursor: false });

	await runChannel('UC1', { forceDryRun: true, maxPages: 1, window: { boundary: EPOCH, pageToken: null } });

	expect(mocks.fetchNewComments).toHaveBeenCalledTimes(1);
	const audited = await testDb().db.select().from(auditLog).where(eq(auditLog.action, 'dry-run')).all();
	expect(audited).toHaveLength(100);
});

test('a funded window with a planted page token still drains in the background', async () => {
	await seedChannelWithOrg(100);
	mocks.fetchNewComments.mockResolvedValue({ comments: [], nextPageToken: null, reachedCursor: true });

	const result = await runChannel('UC1', { forceDryRun: true, window: { boundary: EPOCH, pageToken: 'page-2' } });

	expect(result.unpaid).toBeUndefined();
	expect(mocks.fetchNewComments).toHaveBeenCalledTimes(1);
	expect(await testDb().db.select({ boundary: channels.dryRunBoundary }).from(channels).where(eq(channels.id, 'UC1')).get()).toBeDefined();
	expect(await testDb().db.select().from(organizations).where(eq(organizations.id, 'org-1')).get()).toMatchObject({ creditsRemaining: 100 });
});
