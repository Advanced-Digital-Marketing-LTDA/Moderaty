import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { UNLIMITED_ACCESS_EMAILS: undefined as string | undefined, MODERATY_DEPLOYMENT: undefined as string | undefined }
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));

import { memberships, organizations, stripeSubscriptionPeriods, users } from '$lib/server/db/schema';
import { setupTestDb, testDb } from '$lib/server/testdb';
import { ingestionBlock } from './ingestion';

setupTestDb(['memberships', 'organizations', 'stripe_subscription_periods', 'users']);

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
	// Hosted deployment by default, with no complimentary list.
	mocks.env.MODERATY_DEPLOYMENT = 'official-hosted';
	mocks.env.UNLIMITED_ACCESS_EMAILS = '';
});

async function seedOrg(orgId: string, options: { plan?: string; credits?: number | null } = {}): Promise<void> {
	await testDb().db.insert(organizations).values({
		id: orgId,
		name: 'Test org',
		plan: options.plan ?? 'free',
		creditsRemaining: options.credits ?? null
	});
}

async function seedPeriod(orgId: string, options: { status?: string; window?: 'live' | 'expired' } = {}): Promise<void> {
	const now = Date.now();
	const [start, end] = options.window === 'expired' ? [now - 2 * DAY_MS, now - DAY_MS] : [now - 60_000, now + 60_000];
	const key = `${orgId}-${options.status ?? 'paid'}-${options.window ?? 'live'}`;
	await testDb().db.insert(stripeSubscriptionPeriods).values({
		orgId,
		subscriptionId: `sub-${orgId}`,
		invoiceId: `in-${key}`,
		periodKey: `period-${key}`,
		periodStart: new Date(start).toISOString(),
		periodEnd: new Date(end).toISOString(),
		includedCredits: 100,
		consumedCredits: 0,
		status: options.status ?? 'paid'
	});
}

async function seedOwner(orgId: string, email: string): Promise<void> {
	const userId = `user-${orgId}`;
	await testDb().db.insert(users).values({ id: userId, googleSub: `sub-${userId}`, email, displayName: userId });
	await testDb().db.insert(memberships).values({ userId, orgId, role: 'owner' });
}

describe('ingestionBlock on the hosted deployment', () => {
	test('an org with no credits and no subscription is unpaid', async () => {
		await seedOrg('org-1');
		expect(await ingestionBlock('org-1')).toBe('unpaid');
	});

	test('zero credits with no subscription is unpaid', async () => {
		await seedOrg('org-1', { credits: 0 });
		expect(await ingestionBlock('org-1')).toBe('unpaid');
	});

	test('any positive credit balance funds the org', async () => {
		await seedOrg('org-1', { credits: 1 });
		expect(await ingestionBlock('org-1')).toBeNull();
	});

	test('zero credits plus an in-window paid period funds the org', async () => {
		await seedOrg('org-1', { credits: 0 });
		await seedPeriod('org-1');
		expect(await ingestionBlock('org-1')).toBeNull();
	});

	test('an expired paid period does not fund the org', async () => {
		await seedOrg('org-1');
		await seedPeriod('org-1', { window: 'expired' });
		expect(await ingestionBlock('org-1')).toBe('unpaid');
	});

	test('a void or refunded in-window period does not fund the org', async () => {
		await seedOrg('org-1');
		await seedPeriod('org-1', { status: 'void' });
		expect(await ingestionBlock('org-1')).toBe('unpaid');
		await testDb().db.delete(stripeSubscriptionPeriods);
		await seedPeriod('org-1', { status: 'refunded' });
		expect(await ingestionBlock('org-1')).toBe('unpaid');
	});

	test('the lifetime plan is funded, with no credits and no subscription', async () => {
		await seedOrg('org-1', { plan: 'lifetime' });
		expect(await ingestionBlock('org-1')).toBeNull();
	});

	test('an unfunded org whose owner is listed is complimentary', async () => {
		await seedOrg('org-1');
		await seedOwner('org-1', 'owner@example.test');
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'owner@example.test';
		expect(await ingestionBlock('org-1')).toBeNull();
	});

	test('a missing org throws instead of guessing', async () => {
		await expect(ingestionBlock('no-such-org')).rejects.toThrow('org not found: no-such-org');
	});
});

describe('ingestionBlock on a self-hosted deployment', () => {
	test('is never blocked, even with no credits and no subscription', async () => {
		mocks.env.MODERATY_DEPLOYMENT = undefined;
		await seedOrg('org-1');
		expect(await ingestionBlock('org-1')).toBeNull();
	});

	test('does not read the org at all, so a missing org is not an error here', async () => {
		mocks.env.MODERATY_DEPLOYMENT = undefined;
		expect(await ingestionBlock('no-such-org')).toBeNull();
	});
});
