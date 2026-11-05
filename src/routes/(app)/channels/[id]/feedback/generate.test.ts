import { beforeEach, expect, test, vi } from 'vitest';
import { TEST_OWNER, setupTestDb, testDb } from '$lib/server/testdb';
import { channels, organizations } from '$lib/server/db/schema';

const mocks = vi.hoisted(() => ({
	env: { DRY_RUN: 'false' } as Record<string, string | undefined>,
	generateFeedbackDigest: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/feedbackDigest', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/feedbackDigest')>()),
	generateFeedbackDigest: mocks.generateFeedbackDigest
}));

import { actions } from './+page.server';

const PAUSED_COPY = 'Moderation is paused: this organization has no credits or subscription. Buy credits or subscribe on the Usage page.';

setupTestDb(['channels', 'organizations']);

beforeEach(async () => {
	mocks.generateFeedbackDigest.mockReset();
	await testDb().db.insert(organizations).values({ id: 'org-1', name: 'Organization 1' });
	await testDb().db.insert(channels).values({ id: 'UC1', userId: 'user-1', orgId: 'org-1', title: 'UC1', refreshTokenEnc: 'enc', feedbackEnabled: 1 });
});

function generate() {
	return actions.generate({ params: { id: 'UC1' }, locals: { user: TEST_OWNER } } as never);
}

test('an unpaid org gets 402 with the paused copy when it asks for a digest', async () => {
	mocks.generateFeedbackDigest.mockResolvedValueOnce({ status: 'deferred', reason: 'unpaid' });
	expect(await generate()).toMatchObject({ status: 402, data: { scope: 'digest', error: PAUSED_COPY } });
});

test('other deferrals stay 409, so only the unpaid reason changes the status', async () => {
	mocks.generateFeedbackDigest.mockResolvedValueOnce({ status: 'deferred', reason: 'credits' });
	expect(await generate()).toMatchObject({ status: 409 });
});
