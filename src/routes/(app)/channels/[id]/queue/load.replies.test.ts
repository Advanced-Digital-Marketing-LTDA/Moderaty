import { beforeEach, expect, test } from 'vitest';
import { TEST_OWNER, setupTestDb, testDb } from '$lib/server/testdb';
import { channels, comments } from '$lib/server/db/schema';

import { load } from './+page.server';

setupTestDb(['audit_log', 'comments', 'channels', 'moderation_actions']);

beforeEach(async () => {
	await testDb()
		.db.insert(channels)
		.values({ id: 'UC1', userId: TEST_OWNER.id, orgId: 'org-1', title: 'One', refreshTokenEnc: 'enc-1' });
});

test('a stored reply loads with isReply true and a stored top-level comment with isReply false', async () => {
	await testDb().db.insert(comments).values([
		{ id: 'top-1', channelId: 'UC1', text: 'a top-level comment', publishedAt: '2026-01-03T00:00:00.000Z', status: 'pending', decidedBy: 'ai', parentId: null },
		{ id: 'reply-1', channelId: 'UC1', text: 'a reply', publishedAt: '2026-01-04T00:00:00.000Z', status: 'pending', decidedBy: 'ai', parentId: 'top-1' }
	]);

	const result = await load({ params: { id: 'UC1' }, locals: { user: TEST_OWNER } } as never);

	// Exact rows: parentId is read to derive isReply and never returned.
	expect(result.pending).toEqual([
		{ id: 'reply-1', text: 'a reply', publishedAt: '2026-01-04T00:00:00.000Z', holdState: null, reason: null, isReply: true },
		{ id: 'top-1', text: 'a top-level comment', publishedAt: '2026-01-03T00:00:00.000Z', holdState: null, reason: null, isReply: false }
	]);
});
