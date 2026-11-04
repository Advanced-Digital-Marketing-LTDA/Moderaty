import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { UNLIMITED_ACCESS_EMAILS: undefined as string | undefined }
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));

import { memberships, organizations, users } from '$lib/server/db/schema';
import { setupTestDb, testDb } from '$lib/server/testdb';
import { orgHasUnlimitedAccess, unlimitedAccessEmails } from './unlimitedAccess';

setupTestDb(['memberships', 'organizations', 'users']);

beforeEach(() => {
	mocks.env.UNLIMITED_ACCESS_EMAILS = undefined;
});

async function seedOrg(orgId: string): Promise<void> {
	await testDb().db.insert(organizations).values({ id: orgId, name: 'Test org' });
}

async function seedMember(orgId: string, role: 'owner' | 'admin' | 'member', email: string): Promise<void> {
	const userId = `user-${orgId}-${role}`;
	await testDb().db.insert(users).values({ id: userId, googleSub: `sub-${userId}`, email, displayName: userId });
	await testDb().db.insert(memberships).values({ userId, orgId, role });
}

describe('unlimitedAccessEmails', () => {
	test('throws loudly when the env var is unset', () => {
		expect(() => unlimitedAccessEmails()).toThrow(
			'UNLIMITED_ACCESS_EMAILS is not set; set it to a comma-separated email list, or to an empty value for none'
		);
	});

	test('an empty value means no exemptions', () => {
		mocks.env.UNLIMITED_ACCESS_EMAILS = '';
		expect(unlimitedAccessEmails().size).toBe(0);
	});

	test('a malformed entry throws naming its position, never its value', () => {
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'ok@example.test, not-an-email';
		let message = '';
		try {
			unlimitedAccessEmails();
		} catch (error) {
			message = (error as Error).message;
		}
		expect(message).toContain('entry 2');
		expect(message).not.toContain('not-an-email');
	});

	test('an empty entry (trailing comma) throws naming its position', () => {
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'ok@example.test,';
		expect(() => unlimitedAccessEmails()).toThrow('entry 2');
	});

	test('entries are trimmed and lowercased', () => {
		mocks.env.UNLIMITED_ACCESS_EMAILS = ' Owner@Example.TEST , other@example.test ';
		expect([...unlimitedAccessEmails()].sort()).toEqual(['other@example.test', 'owner@example.test']);
	});
});

describe('orgHasUnlimitedAccess', () => {
	test('a listed owner grants unlimited access', async () => {
		await seedOrg('org-1');
		await seedMember('org-1', 'owner', 'owner@example.test');
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'owner@example.test';
		expect(await orgHasUnlimitedAccess(testDb().db, 'org-1')).toBe(true);
	});

	test('the match is case-insensitive against the stored email', async () => {
		await seedOrg('org-1');
		await seedMember('org-1', 'owner', 'OWNER@Example.TEST');
		mocks.env.UNLIMITED_ACCESS_EMAILS = ' owner@example.test ';
		expect(await orgHasUnlimitedAccess(testDb().db, 'org-1')).toBe(true);
	});

	test('a listed admin does not grant access; only an owner does', async () => {
		await seedOrg('org-1');
		await seedMember('org-1', 'owner', 'owner@example.test');
		await seedMember('org-1', 'admin', 'admin@example.test');
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'admin@example.test';
		expect(await orgHasUnlimitedAccess(testDb().db, 'org-1')).toBe(false);
	});

	test('a listed member does not grant access', async () => {
		await seedOrg('org-1');
		await seedMember('org-1', 'owner', 'owner@example.test');
		await seedMember('org-1', 'member', 'member@example.test');
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'member@example.test';
		expect(await orgHasUnlimitedAccess(testDb().db, 'org-1')).toBe(false);
	});

	test('an unlisted owner does not grant access', async () => {
		await seedOrg('org-1');
		await seedMember('org-1', 'owner', 'owner@example.test');
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'someone-else@example.test';
		expect(await orgHasUnlimitedAccess(testDb().db, 'org-1')).toBe(false);
	});

	test('an empty list grants no access', async () => {
		await seedOrg('org-1');
		await seedMember('org-1', 'owner', 'owner@example.test');
		mocks.env.UNLIMITED_ACCESS_EMAILS = '';
		expect(await orgHasUnlimitedAccess(testDb().db, 'org-1')).toBe(false);
	});
});
