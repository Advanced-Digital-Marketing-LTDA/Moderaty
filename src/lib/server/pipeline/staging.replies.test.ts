import { eq } from 'drizzle-orm';
import { beforeEach, expect, test } from 'vitest';
import { setupTestDb, testDb } from '$lib/server/testdb';
import { auditLog, channels, comments } from '$lib/server/db/schema';
import { loadProtectedIdentities } from '$lib/server/allowlist';
import { prepareRules } from '$lib/server/rules';
import type { NewComment } from '$lib/server/youtube';
import { decide } from './decisions';
import { storedCommentIds } from './scoring';
import { stageOrAuditDecisions } from './staging';
import type { Decision } from './types';

setupTestDb(['comments', 'audit_log', 'moderation_actions', 'channels', 'channel_allowed_handles']);

// Rule-matched decisions come from the real decide() with no AI call, so the
// decide -> stage hop runs exactly as it does in a live run.
const rules = prepareRules([{ id: 1, type: 'keyword', pattern: 'spam-word', action: 'hold' }]);
const options = { deadline: undefined, protections: { protectLgbtqia: 0, protectWomen: 0 }, openAiKey: undefined };

beforeEach(async () => {
	await testDb().db.insert(channels).values({ id: 'UC1', title: 'Synthetic Channel', refreshTokenEnc: 'synthetic-grant' });
});

function comment(id: string, text: string, parentId?: string): NewComment {
	return {
		id,
		threadId: `thread-${id}`,
		videoId: 'video-1',
		authorChannelId: `author-${id}`,
		authorName: `Author ${id}`,
		text,
		publishedAt: '2026-01-04T00:00:00.000Z',
		// Top-level comments carry no parentId key, as the fetch layer returns them.
		...(parentId === undefined ? {} : { parentId })
	};
}

async function decided(input: NewComment): Promise<Decision> {
	return decide(input, rules, await loadProtectedIdentities('UC1'), null, { remaining: 0 }, options);
}

test('a live run stores a reply with its parent id, and a top-level comment in the same batch with a NULL parent id', async () => {
	await stageOrAuditDecisions('UC1', [
		await decided(comment('parent-1', 'spam-word parent')),
		await decided(comment('reply-1', 'spam-word reply', 'parent-1'))
	], false);

	expect(await testDb().db.select({ id: comments.id, parentId: comments.parentId }).from(comments).orderBy(comments.id).all()).toEqual([
		{ id: 'parent-1', parentId: null },
		{ id: 'reply-1', parentId: 'parent-1' }
	]);
});

test('a rescan that re-stages a reply without a parent id refreshes the row and keeps the stored parent id', async () => {
	await stageOrAuditDecisions('UC1', [await decided(comment('reply-1', 'spam-word reply one', 'parent-1'))], false);

	await stageOrAuditDecisions('UC1', [await decided(comment('reply-1', 'spam-word reply edited'))], false, { rescan: { scanStamp: 'scan-2' } });

	// The text and scan stamp prove the upsert ran; the parent id proves the conflict update left it alone.
	expect(await testDb().db.select({ text: comments.text, parentId: comments.parentId, scanId: comments.scanId }).from(comments).where(eq(comments.id, 'reply-1')).all()).toEqual([
		{ text: 'spam-word reply edited', parentId: 'parent-1', scanId: 'scan-2' }
	]);
});

test('a dry run writes no comments row for a reply and exactly one dry-run audit row for it', async () => {
	await stageOrAuditDecisions('UC1', [await decided(comment('reply-1', 'spam-word reply', 'parent-1'))], true);

	expect(await testDb().db.select().from(comments).all()).toEqual([]);
	expect(await testDb().db.select({ commentId: auditLog.commentId, action: auditLog.action }).from(auditLog).all()).toEqual([
		{ commentId: 'reply-1', action: 'dry-run' }
	]);
});

test('storedCommentIds returns exactly the requested ids that already have a comments row', async () => {
	await stageOrAuditDecisions('UC1', [
		await decided(comment('parent-1', 'spam-word parent')),
		await decided(comment('reply-1', 'spam-word reply', 'parent-1'))
	], false);

	expect(await storedCommentIds(['parent-1', 'missing-1', 'reply-1'])).toEqual(new Set(['parent-1', 'reply-1']));
	expect(await storedCommentIds([])).toEqual(new Set<string>());
});
