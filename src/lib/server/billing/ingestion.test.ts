import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	env: { UNLIMITED_ACCESS_EMAILS: undefined as string | undefined, MODERATY_DEPLOYMENT: undefined as string | undefined }
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
// The real claim runs by default; a test can make one channel claim throw.
vi.mock('$lib/server/dryRun', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/dryRun')>();
	return { ...actual, claimDryRun: vi.fn(actual.claimDryRun) };
});

import { channels, memberships, organizations, stripeSubscriptionPeriods, users } from '$lib/server/db/schema';
import { countDbStatements, freeDryRunStampOf, setupTestDb, statementSql, testDb } from '$lib/server/testdb';
// After testdb: its db mock must be registered before dryRun.ts loads the db.
import { claimDryRun } from '$lib/server/dryRun';
import { claimDryRunForOrg, ingestionBlock, releaseFreeDryRun, unpaidOrgIds } from './ingestion';
import { eq } from 'drizzle-orm';

setupTestDb(['channels', 'memberships', 'organizations', 'stripe_subscription_periods', 'users']);

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

const UNPAID_COPY = 'This organization has used its one free dry run. Buy credits or subscribe on the Usage page to run more.';

async function seedChannel(id: string, over: Partial<typeof channels.$inferInsert> = {}): Promise<void> {
	await testDb().db.insert(channels).values({ id, userId: 'user-1', orgId: 'org-1', title: `Channel ${id}`, refreshTokenEnc: 'enc', ...over });
}

describe('claimDryRunForOrg on the hosted deployment', () => {
	let warnSpy: { mockRestore(): void };

	beforeEach(async () => {
		warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.mocked(claimDryRun).mockClear();
		await seedOrg('org-1');
		await seedChannel('UC1');
		await seedChannel('UC2');
	});

	afterEach(() => {
		warnSpy.mockRestore();
	});

	test('an unpaid org spends its one free dry run on the first channel and is refused on the next', async () => {
		expect(await claimDryRunForOrg('UC1', 'org-1', 'moderation')).toMatchObject({ lease: expect.any(String) });
		expect(await freeDryRunStampOf('org-1')).toEqual(expect.any(String));

		expect(await claimDryRunForOrg('UC2', 'org-1', 'moderation')).toEqual({ status: 402, error: UNPAID_COPY });
		expect(warnSpy).toHaveBeenCalledWith('free dry run refused: organization already used its one free dry run', {
			orgId: 'org-1',
			channelId: 'UC2',
			feature: 'moderation'
		});
	});

	test('moderation and feedback share the one free dry run', async () => {
		expect(await claimDryRunForOrg('UC1', 'org-1', 'feedback')).toMatchObject({ lease: expect.any(String) });
		expect(await claimDryRunForOrg('UC2', 'org-1', 'moderation')).toEqual({ status: 402, error: UNPAID_COPY });
	});

	test('a claim the channel refuses gives the free dry run back', async () => {
		await seedChannel('UC-busy', { leaseExpiresAt: '2099-01-01T00:00:00.000Z' });

		expect(await claimDryRunForOrg('UC-busy', 'org-1', 'moderation')).toMatchObject({ status: 409 });
		expect(await freeDryRunStampOf('org-1')).toBeNull();
		expect(await claimDryRunForOrg('UC1', 'org-1', 'moderation')).toMatchObject({ lease: expect.any(String) });
	});

	test('a channel this feature already used gives the free dry run back', async () => {
		await seedChannel('UC-used', { moderationDryRunUsedAt: '2026-01-01T00:00:00.000Z' });

		expect(await claimDryRunForOrg('UC-used', 'org-1', 'moderation')).toMatchObject({ status: 409 });
		expect(await freeDryRunStampOf('org-1')).toBeNull();
	});

	test('a channel claim that throws gives the free dry run back and rethrows', async () => {
		vi.mocked(claimDryRun).mockRejectedValueOnce(new Error('channel write failed'));

		await expect(claimDryRunForOrg('UC1', 'org-1', 'moderation')).rejects.toThrow('channel write failed');
		expect(await freeDryRunStampOf('org-1')).toBeNull();
	});

	test('a funded org never spends the free dry run', async () => {
		await testDb().db.update(organizations).set({ creditsRemaining: 1 }).where(eq(organizations.id, 'org-1'));

		expect(await claimDryRunForOrg('UC1', 'org-1', 'moderation')).toMatchObject({ lease: expect.any(String) });
		expect(await claimDryRunForOrg('UC2', 'org-1', 'moderation')).toMatchObject({ lease: expect.any(String) });
		expect(await freeDryRunStampOf('org-1')).toBeNull();
	});

	test('a complimentary owner never spends the free dry run', async () => {
		await seedOwner('org-1', 'owner@example.test');
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'owner@example.test';

		expect(await claimDryRunForOrg('UC1', 'org-1', 'moderation')).toMatchObject({ lease: expect.any(String) });
		expect(await claimDryRunForOrg('UC2', 'org-1', 'moderation')).toMatchObject({ lease: expect.any(String) });
		expect(await freeDryRunStampOf('org-1')).toBeNull();
	});

	test('a self-hosted deployment never spends the free dry run', async () => {
		mocks.env.MODERATY_DEPLOYMENT = 'self-hosted';

		expect(await claimDryRunForOrg('UC1', 'org-1', 'moderation')).toMatchObject({ lease: expect.any(String) });
		expect(await claimDryRunForOrg('UC2', 'org-1', 'moderation')).toMatchObject({ lease: expect.any(String) });
		expect(await freeDryRunStampOf('org-1')).toBeNull();
	});

	test('a missing org throws before any channel is claimed', async () => {
		await expect(claimDryRunForOrg('UC1', 'no-such-org', 'moderation')).rejects.toThrow('org not found: no-such-org');
		expect(claimDryRun).not.toHaveBeenCalled();
	});
});

describe('releaseFreeDryRun', () => {
	test('clears an allowance that still carries the stamp it was claimed with', async () => {
		await seedOrg('org-1');
		await testDb().db.update(organizations).set({ freeDryRunUsedAt: 'stamp-a' }).where(eq(organizations.id, 'org-1'));

		await releaseFreeDryRun('org-1', 'stamp-a');

		expect(await freeDryRunStampOf('org-1')).toBeNull();
	});

	test('leaves an allowance that carries a different stamp alone', async () => {
		await seedOrg('org-1');
		await testDb().db.update(organizations).set({ freeDryRunUsedAt: 'stamp-b' }).where(eq(organizations.id, 'org-1'));

		await releaseFreeDryRun('org-1', 'stamp-a');

		expect(await freeDryRunStampOf('org-1')).toBe('stamp-b');
	});
});

describe('free runs and paid periods belong to one organization', () => {
	test('a paid period in one org never funds another org', async () => {
		await seedOrg('org-A');
		await seedOrg('org-B');
		await seedPeriod('org-A');
		expect(await ingestionBlock('org-A')).toBeNull();
		expect(await ingestionBlock('org-B')).toBe('unpaid');
	});

	test('spending the free run of one organization leaves another unpaid organization untouched', async () => {
		await seedOrg('org-A');
		await seedOrg('org-B');
		await seedChannel('UC-A', { orgId: 'org-A' });
		expect(await claimDryRunForOrg('UC-A', 'org-A', 'moderation')).toMatchObject({ lease: expect.any(String) });
		expect(await freeDryRunStampOf('org-A')).toEqual(expect.any(String));
		expect(await freeDryRunStampOf('org-B')).toBeNull();
	});

	test('two claims started together for one unpaid org: exactly one wins', async () => {
		await seedOrg('org-1');
		await seedChannel('UC1');
		await seedChannel('UC2');
		const results = await Promise.all([
			claimDryRunForOrg('UC1', 'org-1', 'moderation'),
			claimDryRunForOrg('UC2', 'org-1', 'moderation')
		]);
		expect(results.filter((result) => 'lease' in result)).toHaveLength(1);
		expect(results.filter((result) => 'status' in result && result.status === 402)).toHaveLength(1);
	});
});

describe('a free run that cannot be given back is loud', () => {
	test('a release that matches no row is logged and reported as not given back', async () => {
		await seedOrg('org-1');
		await testDb().db.update(organizations).set({ freeDryRunUsedAt: 'stamp-a' }).where(eq(organizations.id, 'org-1'));
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			expect(await releaseFreeDryRun('org-1', 'stamp-other')).toBe(false);
			expect(errorSpy).toHaveBeenCalledWith('free dry run release matched no row', { orgId: 'org-1' });
			expect(await freeDryRunStampOf('org-1')).toBe('stamp-a');
		} finally {
			errorSpy.mockRestore();
		}
	});

	test('a refused claim whose release write throws keeps the refusal and reports the run as lost', async () => {
		await seedOrg('org-1');
		await seedChannel('UC-busy', { leaseExpiresAt: '2099-01-01T00:00:00.000Z' });
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const realUpdate = testDb().db.update.bind(testDb().db);
		const updateSpy = vi.spyOn(testDb().db, 'update').mockImplementation(((table: unknown) => {
			const builder = realUpdate(table as never);
			return {
				set: (values: Record<string, unknown>) => {
					if (values.freeDryRunUsedAt === null) throw new Error('release write failed');
					return builder.set(values as never);
				}
			};
		}) as never);
		try {
			expect(await claimDryRunForOrg('UC-busy', 'org-1', 'moderation')).toEqual({
				status: 409,
				error: 'This channel is busy. Retry in a minute.',
				freeRunLost: true
			});
			expect(errorSpy).toHaveBeenCalledWith('free dry run release failed', expect.objectContaining({ orgId: 'org-1' }));
		} finally {
			updateSpy.mockRestore();
			errorSpy.mockRestore();
		}
	});
});

describe('ingestionBlock when MODERATY_DEPLOYMENT is unset', () => {
	test('throws instead of treating the deployment as self-hosted', async () => {
		mocks.env.MODERATY_DEPLOYMENT = undefined;
		await seedOrg('org-1');
		await expect(ingestionBlock('org-1')).rejects.toThrow('MODERATY_DEPLOYMENT must be set to official-hosted or self-hosted');
	});
});

describe('ingestionBlock on a self-hosted deployment', () => {
	test('is never blocked, even with no credits and no subscription', async () => {
		mocks.env.MODERATY_DEPLOYMENT = 'self-hosted';
		await seedOrg('org-1');
		expect(await ingestionBlock('org-1')).toBeNull();
	});

	test('does not read the org at all, so a missing org is not an error here', async () => {
		mocks.env.MODERATY_DEPLOYMENT = 'self-hosted';
		expect(await ingestionBlock('no-such-org')).toBeNull();
	});
});

describe('unpaidOrgIds agrees with the per-org gate', () => {
	beforeEach(() => {
		mocks.env.UNLIMITED_ACCESS_EMAILS = 'owner-listed@example.test,admin-listed@example.test';
	});

	async function seedMember(orgId: string, email: string, role: 'owner' | 'admin'): Promise<void> {
		const userId = `user-${orgId}-${role}-${email}`;
		await testDb().db.insert(users).values({ id: userId, googleSub: `sub-${userId}`, email, displayName: userId });
		await testDb().db.insert(memberships).values({ userId, orgId, role });
	}

	test('lists exactly the orgs the per-org gate blocks', async () => {
		await seedOrg('org-credits', { credits: 1 });
		await seedOrg('org-paid-period', { credits: 0 });
		await seedPeriod('org-paid-period');
		await seedOrg('org-expired');
		await seedPeriod('org-expired', { window: 'expired' });
		await seedOrg('org-void');
		await seedPeriod('org-void', { status: 'void' });
		await seedOrg('org-refunded');
		await seedPeriod('org-refunded', { status: 'refunded' });
		await seedOrg('org-lifetime', { plan: 'lifetime' });
		await seedOrg('org-null-credits');
		await seedOrg('org-owner-listed');
		await seedMember('org-owner-listed', 'owner-listed@example.test', 'owner');
		await seedOrg('org-admin-listed');
		await seedMember('org-admin-listed', 'admin-listed@example.test', 'admin');
		await seedMember('org-admin-listed', 'owner-unlisted@example.test', 'owner');
		const orgIds = [
			'org-credits', 'org-paid-period', 'org-expired', 'org-void', 'org-refunded',
			'org-lifetime', 'org-null-credits', 'org-owner-listed', 'org-admin-listed'
		];
		for (const orgId of orgIds) await seedChannel(`UC-${orgId}`, { orgId });

		const onListError = vi.fn();
		const unpaid = await unpaidOrgIds(testDb().db, onListError);

		expect([...unpaid].sort()).toEqual(['org-admin-listed', 'org-expired', 'org-null-credits', 'org-refunded', 'org-void']);
		expect(onListError).not.toHaveBeenCalled();
		for (const orgId of orgIds) {
			expect(unpaid.includes(orgId), orgId).toBe((await ingestionBlock(orgId)) === 'unpaid');
		}
	});

	test('on a self-hosted deployment the list is empty after one candidate read that never touches funding or owners', async () => {
		mocks.env.MODERATY_DEPLOYMENT = 'self-hosted';
		await seedOrg('org-1');
		await seedChannel('UC1', { orgId: 'org-1' });
		const client = testDb().client;
		const execute = client.execute.bind(client);
		const executed: string[] = [];
		const spy = vi.spyOn(client, 'execute').mockImplementation((statement) => {
			executed.push(statementSql(statement));
			return execute(statement);
		});

		try {
			expect(await unpaidOrgIds(testDb().db, vi.fn())).toEqual([]);
		} finally {
			spy.mockRestore();
		}
		expect(executed).toHaveLength(1);
		expect(executed[0]).toContain('"channels"');
		expect(executed[0]).not.toMatch(/stripe_subscription_periods|memberships/);
	});

	test('with the deployment mode unset and no active org channel, the list is empty and nothing throws', async () => {
		mocks.env.MODERATY_DEPLOYMENT = undefined;
		await seedOrg('org-1');

		expect(await unpaidOrgIds(testDb().db, vi.fn())).toEqual([]);
	});

	test('with the deployment mode unset and an active org channel, the descriptive error is thrown', async () => {
		mocks.env.MODERATY_DEPLOYMENT = undefined;
		await seedOrg('org-1');
		await seedChannel('UC1', { orgId: 'org-1' });

		await expect(unpaidOrgIds(testDb().db, vi.fn())).rejects.toThrow('MODERATY_DEPLOYMENT must be set to official-hosted or self-hosted');
	});

	test('a period ending exactly now does not fund the org on either path', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			const now = new Date('2026-11-05T12:00:00.000Z');
			vi.setSystemTime(now);
			await seedOrg('org-ended');
			await testDb().db.insert(stripeSubscriptionPeriods).values({
				orgId: 'org-ended',
				subscriptionId: 'sub-org-ended',
				invoiceId: 'in-org-ended',
				periodKey: 'period-org-ended',
				periodStart: new Date(now.getTime() - 60 * 60_000).toISOString(),
				periodEnd: now.toISOString(),
				includedCredits: 100,
				consumedCredits: 0,
				status: 'paid'
			});
			await seedChannel('UC-ended', { orgId: 'org-ended' });

			expect(await ingestionBlock('org-ended')).toBe('unpaid');
			expect(await unpaidOrgIds(testDb().db, vi.fn())).toEqual(['org-ended']);
		} finally {
			vi.useRealTimers();
		}
	});

	test('an unset complimentary list on hosted fails closed: every unfunded org is unpaid and the error is reported once', async () => {
		mocks.env.UNLIMITED_ACCESS_EMAILS = undefined;
		await seedOrg('org-1');
		await seedChannel('UC1', { orgId: 'org-1' });
		const onListError = vi.fn();

		expect(await unpaidOrgIds(testDb().db, onListError)).toEqual(['org-1']);
		expect(onListError).toHaveBeenCalledTimes(1);
		expect((onListError.mock.calls[0][0] as Error).message).toContain('UNLIMITED_ACCESS_EMAILS is not set');
	});
});
