import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { DRY_RUN: 'false', OPENAI_API_KEY: 'test-openai-key' } as Record<string, string | undefined>,
	fetchNewComments: vi.fn(),
	ingestionBlock: vi.fn(async (_orgId: string) => null as 'unpaid' | null)
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/billing/ingestion', () => ({ ingestionBlock: mocks.ingestionBlock }));
vi.mock('$lib/server/crypto', () => ({ decrypt: vi.fn((enc: string) => `decrypted:${enc}`) }));
vi.mock('$lib/server/youtube', () => ({
	refreshAccessToken: vi.fn(async () => 'access-token'),
	fetchNewComments: mocks.fetchNewComments
}));

import { setupTestDb, testDb } from '$lib/server/testdb';
import { channels, organizations } from '$lib/server/db/schema';
import { generateFeedbackDigest } from './feedbackDigest';

setupTestDb(['channels', 'organizations', 'feedback_digests', 'feedback_findings', 'finding_evidence', 'feedback_history_comments', 'comments', 'credit_transactions']);

beforeEach(async () => {
	mocks.fetchNewComments.mockReset();
	mocks.ingestionBlock.mockClear();
	mocks.ingestionBlock.mockResolvedValue(null);
	await testDb().db.insert(organizations).values({ id: 'org-1', name: 'Organization 1' });
	await testDb().db.insert(channels).values({ id: 'UC1', userId: 'user-1', orgId: 'org-1', title: 'UC1', refreshTokenEnc: 'enc', feedbackEnabled: 1 });
});

test('an unpaid org is deferred with reason unpaid, before any YouTube fetch', async () => {
	mocks.ingestionBlock.mockResolvedValueOnce('unpaid');
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	try {
		expect(await generateFeedbackDigest('UC1', { force: true })).toEqual({ status: 'deferred', reason: 'unpaid' });
		expect(mocks.ingestionBlock).toHaveBeenCalledWith('org-1');
		expect(mocks.fetchNewComments).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('UC1'));
	} finally {
		warn.mockRestore();
	}
});

test('a funded org proceeds past the unpaid gate', async () => {
	mocks.ingestionBlock.mockResolvedValueOnce(null);
	const result = await generateFeedbackDigest('UC1', { force: true });
	expect(mocks.ingestionBlock).toHaveBeenCalledWith('org-1');
	expect(result).toEqual({ status: 'empty' });
});
