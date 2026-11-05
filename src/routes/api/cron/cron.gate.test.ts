import { beforeEach, expect, test, vi } from 'vitest';
import { organizations, channels } from '$lib/server/db/schema';
import { encrypt } from '$lib/server/crypto';
import { setupTestDb, testDb } from '$lib/server/testdb';

// The real claim, billing gate and response builder run. Only the outbound
// channel run and the e-mail, digest and payment boundaries are mocked.
const mocks = vi.hoisted(() => ({
	env: {
		CRON_SECRET: 'test-secret',
		DRY_RUN: 'false',
		ENCRYPTION_KEY: 'cron-gate-test-key',
		MODERATY_DEPLOYMENT: 'official-hosted',
		UNLIMITED_ACCESS_EMAILS: 'not-an-email'
	} as Record<string, string | undefined>,
	runChannel: vi.fn(),
	generateFeedbackDigest: vi.fn(),
	runFeedbackPreview: vi.fn(),
	sweepWelcomeEmails: vi.fn(async () => ({ scanned: 0, queued: 0, enrollmentErrors: 0, accepted: 0, errors: 0, ambiguous: 0, suppressed: 0 })),
	retryContactNotifications: vi.fn(async () => ({ sent: 0, errors: 0 }))
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/welcomeEmail', () => ({ sweepWelcomeEmails: mocks.sweepWelcomeEmails }));
vi.mock('$lib/server/contactNotification', () => ({ retryContactNotifications: mocks.retryContactNotifications }));
vi.mock('$lib/server/pipeline', () => ({ runChannel: mocks.runChannel }));
vi.mock('$lib/server/feedbackDigest', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/feedbackDigest')>();
	return { ...actual, generateFeedbackDigest: mocks.generateFeedbackDigest, runFeedbackPreview: mocks.runFeedbackPreview };
});

import { GET } from './+server';

setupTestDb(['cron_workload_state', 'channels', 'organizations', 'feedback_digests']);

beforeEach(() => {
	vi.clearAllMocks();
	mocks.env.DRY_RUN = 'false';
	mocks.env.MODERATY_DEPLOYMENT = 'official-hosted';
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'not-an-email';
	mocks.generateFeedbackDigest.mockResolvedValue({ status: 'skipped', reason: 'disabled' });
	mocks.runFeedbackPreview.mockResolvedValue({ commentsClassified: 0, commentsFailed: 0, pooled: 0, hasMore: false, findings: [] });
	mocks.runChannel.mockResolvedValue({ fetched: 0, acted: 0, queued: 0, partial: false, skipped: false, dryRun: false });
});

function call() {
	const url = new URL('http://localhost/api/cron');
	return GET({ url, request: new Request(url, { headers: { authorization: 'Bearer test-secret' } }) } as never);
}

test('a malformed complimentary list turns the tick red, reports the list, and still runs the funded channel', async () => {
	await testDb().db.insert(organizations).values([
		{ id: 'org-funded', name: 'Funded', creditsRemaining: 5 },
		{ id: 'org-unpaid', name: 'Unpaid', creditsRemaining: null }
	]);
	// The unpaid channel is older, so it would be the least-recently-run pick if the gate did not exclude it.
	await testDb().db.insert(channels).values([
		{ id: 'UC-funded', userId: 'owner-funded', orgId: 'org-funded', title: 'Funded', refreshTokenEnc: encrypt('refresh-token'), lastRunAt: '2026-06-01T00:00:00.000Z' },
		{ id: 'UC-unpaid', userId: 'owner-unpaid', orgId: 'org-unpaid', title: 'Unpaid', refreshTokenEnc: encrypt('refresh-token'), lastRunAt: '2026-01-01T00:00:00.000Z' }
	]);
	const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

	try {
		const response = await call();
		expect(response.status).toBe(200);
		const body = await response.json();

		expect(body.ok).toBe(false);
		expect(body.failureDiagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ operation: 'complimentary_access' })]));
		expect(body.results['UC-funded']).toBeDefined();
		const ranChannelIds = mocks.runChannel.mock.calls.map((call) => call[0]);
		expect(ranChannelIds).toContain('UC-funded');
		expect(ranChannelIds).not.toContain('UC-unpaid');
	} finally {
		errorSpy.mockRestore();
	}
});
