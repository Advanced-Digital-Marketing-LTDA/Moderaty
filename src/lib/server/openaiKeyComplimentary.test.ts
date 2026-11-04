import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { OPENAI_API_KEY: 'env-openai-key', UNLIMITED_ACCESS_EMAILS: '' } as Record<string, string | undefined>
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/crypto', () => ({ decrypt: vi.fn((enc: string) => `decrypted:${enc}`) }));

import { memberships, organizations, users } from '$lib/server/db/schema';
import { setupTestDb, testDb } from '$lib/server/testdb';
import { resolveOpenAiKey } from './openaiKey';

setupTestDb(['memberships', 'organizations', 'users']);

beforeEach(() => {
	mocks.env.OPENAI_API_KEY = 'env-openai-key';
	mocks.env.UNLIMITED_ACCESS_EMAILS = '';
});

async function seedLifetimeOrg(orgId: string, openaiKeyEnc: string | null, ownerEmail: string): Promise<void> {
	await testDb().db.insert(organizations).values({ id: orgId, name: 'Test org', plan: 'lifetime', openaiKeyEnc });
	const userId = `user-${orgId}`;
	await testDb().db.insert(users).values({ id: userId, googleSub: `sub-${userId}`, email: ownerEmail, displayName: userId });
	await testDb().db.insert(memberships).values({ userId, orgId, role: 'owner' });
}

test('a complimentary lifetime org scores on the deployment key without a stored key', async () => {
	await seedLifetimeOrg('org-1', null, 'owner@example.test');
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'owner@example.test';
	expect(await resolveOpenAiKey('org-1')).toBe('env-openai-key');
});

test('a complimentary lifetime org ignores a stored key and uses the deployment key', async () => {
	await seedLifetimeOrg('org-1', 'stored-ciphertext', 'owner@example.test');
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'owner@example.test';
	expect(await resolveOpenAiKey('org-1')).toBe('env-openai-key');
});

test('an unlisted lifetime org without a stored key still resolves nothing', async () => {
	await seedLifetimeOrg('org-1', null, 'owner@example.test');
	mocks.env.UNLIMITED_ACCESS_EMAILS = 'someone-else@example.test';
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		expect(await resolveOpenAiKey('org-1')).toBeUndefined();
	} finally {
		error.mockRestore();
	}
});

test('a failing complimentary check resolves nothing and logs loudly, with no deployment-key fallback', async () => {
	await seedLifetimeOrg('org-1', null, 'owner@example.test');
	mocks.env.UNLIMITED_ACCESS_EMAILS = undefined;
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		expect(await resolveOpenAiKey('org-1')).toBeUndefined();
		expect(error).toHaveBeenCalledWith(expect.stringContaining('complimentary'), expect.anything());
	} finally {
		error.mockRestore();
	}
});

test('a failing complimentary check rethrows when the caller asked for read errors', async () => {
	await seedLifetimeOrg('org-1', null, 'owner@example.test');
	mocks.env.UNLIMITED_ACCESS_EMAILS = undefined;
	const error = vi.spyOn(console, 'error').mockImplementation(() => {});
	try {
		await expect(resolveOpenAiKey('org-1', { throwOnReadError: true })).rejects.toThrow('UNLIMITED_ACCESS_EMAILS is not set');
	} finally {
		error.mockRestore();
	}
});
