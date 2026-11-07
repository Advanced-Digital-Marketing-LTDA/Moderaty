import { eq, isNotNull, sql } from 'drizzle-orm';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { OPENAI_API_KEY: 'test-openai-key', DRY_RUN: 'false' } as Record<string, string | undefined>,
	decrypt: vi.fn((enc: string) => `decrypted:${enc}`)
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/crypto', () => ({ decrypt: mocks.decrypt }));
// Only the token refresh is replaced. fetchNewComments stays real, so the
// YouTube request it makes is the one the test observes.
vi.mock('$lib/server/youtube', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/youtube')>()),
	refreshAccessToken: vi.fn(async () => 'access-token')
}));

import { setupTestDb, testDb } from '$lib/server/testdb';
import { channels, comments } from '$lib/server/db/schema';
import { digestDue, generateFeedbackDigest } from './feedbackDigest';
import { fetchFeedbackPage, pendingStoredFeedback } from './feedbackHistory';

setupTestDb(['comments', 'channels', 'feedback_digests', 'feedback_findings', 'finding_evidence', 'feedback_history_comments']);

beforeEach(() => {
	mocks.env.DRY_RUN = 'false';
});

afterEach(() => {
	vi.unstubAllGlobals();
});

async function loadChannel() {
	const channel = await testDb().db.select().from(channels).where(eq(channels.id, 'UC1')).get();
	if (!channel) throw new Error('channel UC1 is not seeded');
	return channel;
}

async function seedChannel(over: Partial<typeof channels.$inferInsert> = {}) {
	await testDb().db.insert(channels).values({ id: 'UC1', title: 'Synthetic Channel', refreshTokenEnc: 'enc', active: 1, feedbackEnabled: 1, ...over });
	return loadChannel();
}

/** A stored comment awaiting digest. A parent id makes it a reply. */
function stored(id: string, text: string, publishedAt: string, parentId?: string): typeof comments.$inferInsert {
	return {
		id,
		channelId: 'UC1',
		text,
		publishedAt,
		status: 'approved',
		decidedBy: 'ai',
		...(parentId === undefined ? {} : { parentId })
	};
}

/**
 * Answers every classification with a 'none' verdict and returns the comment
 * text each request carried, so a test can assert exactly which comments the
 * digest classified.
 */
function stubClassifier(): string[] {
	const classified: string[] = [];
	vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body?: string }) => {
		const { messages } = JSON.parse(String(init.body)) as { messages: { content: string }[] };
		classified.push(/Comment: (.*)\n/.exec(messages[1].content)?.[1] ?? '');
		return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ category: 'none', hasAbuse: false, claim: '' }) } }] }), { status: 200 });
	}));
	return classified;
}

/** Answers YouTube requests in order. A request with no queued answer throws, so an unexpected lookup fails the test. */
function stubYouTube(...responses: Response[]) {
	const queue = [...responses];
	const youtube = vi.fn(async (url: RequestInfo | URL) => {
		const next = queue.shift();
		if (!next) throw new Error(`unexpected request ${String(url)}`);
		return next;
	});
	vi.stubGlobal('fetch', youtube);
	return youtube;
}

async function pendingCount(): Promise<number | undefined> {
	const row = await testDb().db.select({ n: sql<number>`COUNT(*)` }).from(comments).where(pendingStoredFeedback('UC1')).get();
	return row?.n;
}

test('pendingStoredFeedback returns the stored top-level comment and never the stored reply', async () => {
	await seedChannel();
	await testDb().db.insert(comments).values([
		stored('top-1', 'top one', '2026-01-02T00:00:00.000Z'),
		stored('reply-1', 'reply one', '2026-01-01T00:00:00.000Z', 'top-1')
	]);

	const rows = await testDb().db.select({ id: comments.id }).from(comments).where(pendingStoredFeedback('UC1')).orderBy(comments.id).all();

	expect(rows).toEqual([{ id: 'top-1' }]);
});

test('the per-100 cadence counts only top-level comments, so replies never make a digest due', async () => {
	const channel = await seedChannel({ feedbackCadence: 'per_100' });
	await testDb().db.insert(comments).values(Array.from({ length: 99 }, (_, index) => stored(`top-${index + 1}`, `top ${index + 1}`, '2026-01-02T00:00:00.000Z')));
	await testDb().db.insert(comments).values([
		stored('reply-1', 'reply one', '2026-01-03T00:00:00.000Z', 'top-1'),
		stored('reply-2', 'reply two', '2026-01-03T00:00:00.000Z', 'top-1')
	]);

	// 99 top-level plus 2 replies is 101 rows; only the 99 may count toward 100.
	expect(await pendingCount()).toBe(99);
	expect(await digestDue(channel)).toBe(false);

	await testDb().db.insert(comments).values(stored('top-100', 'top 100', '2026-01-02T00:00:00.000Z'));
	expect(await digestDue(channel)).toBe(true);
});

test('a digest run classifies and marks only top-level comments, then still stamps the finished channel', async () => {
	await seedChannel();
	await testDb().db.insert(comments).values([
		// The reply is the oldest row, so a selection that included replies would classify it first.
		stored('reply-1', 'reply one', '2026-01-01T00:00:00.000Z', 'top-1'),
		stored('top-1', 'top one', '2026-01-02T00:00:00.000Z'),
		stored('top-2', 'top two', '2026-01-03T00:00:00.000Z')
	]);
	const classified = stubClassifier();

	const result = await generateFeedbackDigest('UC1', { force: true });

	expect(result).toMatchObject({ status: 'complete', commentsClassified: 2, commentsFailed: 0 });
	expect(classified).toHaveLength(2);
	expect(new Set(classified)).toEqual(new Set(['top one', 'top two']));
	expect(await testDb().db.select({ id: comments.id, feedbackDigestedAt: comments.feedbackDigestedAt }).from(comments).orderBy(comments.id).all()).toEqual([
		{ id: 'reply-1', feedbackDigestedAt: null },
		{ id: 'top-1', feedbackDigestedAt: expect.any(String) },
		{ id: 'top-2', feedbackDigestedAt: expect.any(String) }
	]);
	// The channel is stamped only if the remaining-count check also ignores the reply.
	expect(await loadChannel()).toMatchObject({ feedbackLastDigestAt: expect.any(String) });
});

test('a top-level-only channel digests exactly the comments it did before: every top-level row and nothing else', async () => {
	await seedChannel();
	await testDb().db.insert(comments).values([
		stored('top-1', 'top one', '2026-01-01T00:00:00.000Z'),
		stored('top-2', 'top two', '2026-01-02T00:00:00.000Z'),
		stored('top-3', 'top three', '2026-01-03T00:00:00.000Z')
	]);
	const classified = stubClassifier();

	const result = await generateFeedbackDigest('UC1', { force: true });

	expect(result).toMatchObject({ status: 'complete', commentsClassified: 3, commentsFailed: 0 });
	expect(classified).toHaveLength(3);
	expect(new Set(classified)).toEqual(new Set(['top one', 'top two', 'top three']));
	expect(await testDb().db.select({ id: comments.id }).from(comments).where(isNotNull(comments.feedbackDigestedAt)).orderBy(comments.id).all()).toEqual([
		{ id: 'top-1' },
		{ id: 'top-2' },
		{ id: 'top-3' }
	]);
	expect(await loadChannel()).toMatchObject({ feedbackLastDigestAt: expect.any(String) });
});

test('fetchFeedbackPage asks YouTube for snippet only and never returns an embedded reply', async () => {
	const channel = await seedChannel();
	const youtube = stubYouTube(new Response(JSON.stringify({
		items: [{
			id: 'thread-top-1',
			snippet: {
				videoId: 'video-1',
				// Above the one embedded reply: a lookup would be needed if replies were requested.
				totalReplyCount: 2,
				topLevelComment: { id: 'top-1', snippet: { textDisplay: 'top one', publishedAt: '2026-01-02T00:00:00.000Z', authorChannelId: { value: 'author-top' }, authorDisplayName: 'Top author' } }
			},
			replies: { comments: [{ id: 'reply-1', snippet: { textDisplay: 'reply one', publishedAt: '2026-01-03T00:00:00.000Z', parentId: 'top-1', videoId: 'video-1', authorChannelId: { value: 'author-reply' }, authorDisplayName: 'Reply author' } }] }
		}]
	}), { status: 200 }));

	const page = await fetchFeedbackPage(channel, '2026-01-01T00:00:00.000Z', null);

	const requests = youtube.mock.calls.map(([url]) => new URL(String(url)));
	expect(requests.map((url) => url.pathname)).toEqual(['/youtube/v3/commentThreads']);
	expect(requests.map((url) => url.searchParams.get('part'))).toEqual(['snippet']);
	expect(page).toEqual({
		batch: [{ id: 'top-1', text: 'top one', publishedAt: '2026-01-02T00:00:00.000Z' }],
		nextPageToken: null,
		complete: true
	});
});
