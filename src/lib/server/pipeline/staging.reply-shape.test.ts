import { afterEach, beforeEach, expect, test } from 'vitest';
import { getMocks, moderation, newComment, resetPipelineMocks, restoreDryRun, runChannel } from './test-support';

const mocks = getMocks();

beforeEach(resetPipelineMocks);
afterEach(restoreDryRun);

// Runs the whole live path (fetch, decide, the authorHandle rebuild in
// prepareDecisionBatch, staging) and reads the raw row objects handed to the
// comments insert, so a missing key and a NULL column are told apart.
test('a live run stores a reply with its parent id, and a top-level comment with no parentId key', async () => {
	mocks.scoreComment.mockResolvedValue(moderation(0.1));
	mocks.fetchNewComments.mockResolvedValue({
		comments: [
			newComment({ id: 'top', text: 'a top-level comment' }),
			newComment({ id: 'reply', text: 'a reply', parentId: 'top' })
		],
		nextPageToken: null,
		reachedCursor: true
	});

	await runChannel('channel');

	const rows = mocks.state.insertedComments;
	expect(rows.map((row) => row.id)).toEqual(['top', 'reply']);
	expect(rows[0]).not.toHaveProperty('parentId');
	expect(rows[1]).toHaveProperty('parentId', 'top');
});
