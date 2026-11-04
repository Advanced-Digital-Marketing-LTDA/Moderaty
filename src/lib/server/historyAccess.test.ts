import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { UNLIMITED_ACCESS_EMAILS: '' as string | undefined, MODERATY_DEPLOYMENT: 'official-hosted' as string | undefined } as Record<string, string | undefined>
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));

import { memberships, organizations, users } from '$lib/server/db/schema';
import { setupTestDb, testDb } from '$lib/server/testdb';
import { historyAccessError } from './historyAccess';

setupTestDb(['memberships', 'organizations', 'stripe_subscription_periods', 'users']);

beforeEach(() => {
	mocks.env.MODERATY_DEPLOYMENT = 'official-hosted';
	mocks.env.UNLIMITED_ACCESS_EMAILS = '';
});

async function seedOrg(orgId: string, plan: string): Promise<void> {
	await testDb().db.insert(organizations).values({ id: orgId, name: 'Test org', plan });
}

async function seedOwner(orgId: string, email: string): Promise<void> {
	const userId = `user-${orgId}`;
	await testDb().db.insert(users).values({ id: userId, googleSub: `sub-${userId}`, email, displayName: userId });
	await testDb().db.insert(memberships).values({ userId, orgId, role: 'owner' });
}

test('a listed owner has history access without credits or a subscription', async () => {
	await seedOrg('org-1', 'free');
	await seedOwner('org-1', 'owner@example.test');
	mocks.env.MODERATY_DEPLOYMENT = 'official-hosted';
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'owner@example.test';
	expect(await historyAccessError('org-1')).toBeNull();
});

test('a listed owner on the lifetime plan has history access even without a stored key', async () => {
	await seedOrg('org-1', 'lifetime');
	await seedOwner('org-1', 'owner@example.test');
	mocks.env.MODERATY_DEPLOYMENT = 'official-hosted';
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'owner@example.test';
	expect(await historyAccessError('org-1')).toBeNull();
});

test('an unlisted, unfunded org still needs a purchase', async () => {
	await seedOrg('org-1', 'free');
	await seedOwner('org-1', 'owner@example.test');
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'someone-else@example.test';
	expect(await historyAccessError('org-1')).toBe('purchase');
});
