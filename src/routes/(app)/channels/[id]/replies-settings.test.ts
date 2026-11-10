import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { TEST_OWNER, setupTestDb, testDb } from '$lib/server/testdb';
import { channels, organizations } from '$lib/server/db/schema';

const mocks = vi.hoisted(() => ({
	runChannel: vi.fn(),
	// The same exact-value DRY_RUN contract analyzeHistory enforces.
	env: { DRY_RUN: 'false' } as Record<string, string | undefined>
}));
vi.mock('$lib/server/pipeline', () => ({ runChannel: mocks.runChannel }));
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));

import { actions } from './+page.server';

setupTestDb(['channels', 'organizations']);

const OWNER = TEST_OWNER;
const MEMBER = { ...TEST_OWNER, orgRole: 'member' } as const;
const ADMIN = { ...TEST_OWNER, orgRole: 'admin' } as const;

const T_FIRST = '2026-11-07T12:00:00.000Z';
const T_LATER = '2026-11-07T18:30:00.000Z';
const T_LATEST = '2026-11-08T09:15:00.000Z';

/** A ticked box posts 'true' ahead of the hidden fallback; an unticked box posts only the fallback. */
const TICKED = ['true', 'false'];
const UNTICKED = ['false'];

const REPLY_COLUMNS = {
	moderateRepliesSince: null,
	replySweepBoundary: null,
	replySweepPageToken: null,
	replySweepLastAt: null,
	replySweepShortfall: null
};

const CHECKPOINT = {
	moderateRepliesSince: '2026-11-01T00:00:00.000Z',
	replySweepBoundary: '2026-10-31T00:00:00.000Z',
	replySweepPageToken: 'reply-page-token',
	replySweepLastAt: '2026-11-07T09:00:00.000Z',
	replySweepShortfall: 4
};

beforeEach(async () => {
	mocks.env.DRY_RUN = 'false';
	mocks.runChannel.mockReset();
	await testDb().db.insert(organizations).values({ id: 'org-1', name: 'Organization 1', plan: 'free', creditsRemaining: 100 });
	vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

async function seedChannel(id = 'UC1', over: Record<string, unknown> = {}) {
	await testDb().db.insert(channels).values({ id, userId: OWNER.id, orgId: 'org-1', title: `Channel ${id}`, refreshTokenEnc: 'enc', ...over });
}

async function rowOf(id = 'UC1') {
	return testDb().db.select().from(channels).where(eq(channels.id, id)).get();
}

function saveReplies(channelId: string, values: string[], user: unknown = OWNER) {
	const form = new FormData();
	for (const value of values) form.append('enabled', value);
	return actions.setModerateReplies({
		params: { id: channelId },
		request: new Request('http://localhost/', { method: 'POST', body: form }),
		locals: { user }
	} as never);
}

describe('setModerateReplies: who may change it', () => {
	test.each([
		{ role: 'member', user: MEMBER },
		{ role: 'admin', user: ADMIN }
	])('a team $role cannot turn reply moderation on: 403 and the row is unchanged', async ({ user }) => {
		await seedChannel('UC1');
		const before = await rowOf();

		await expect(saveReplies('UC1', TICKED, user)).rejects.toMatchObject({ status: 403 });
		expect(await rowOf()).toEqual(before);
	});

	test.each([
		{ role: 'member', user: MEMBER },
		{ role: 'admin', user: ADMIN }
	])('a team $role cannot turn reply moderation off: 403 and the row is unchanged', async ({ user }) => {
		await seedChannel('UC1', CHECKPOINT);
		const before = await rowOf();

		await expect(saveReplies('UC1', UNTICKED, user)).rejects.toMatchObject({ status: 403 });
		expect(await rowOf()).toEqual(before);
	});

	test('a signed-out request is refused with 401 and changes nothing', async () => {
		await seedChannel('UC1');
		const before = await rowOf();

		await expect(saveReplies('UC1', TICKED, null)).rejects.toMatchObject({ status: 401 });
		expect(await rowOf()).toEqual(before);
	});

	test('a channel owned by another team reads as not found and is unchanged', async () => {
		await seedChannel('UC1', { orgId: 'org-2', userId: 'user-2' });
		const before = await rowOf();

		await expect(saveReplies('UC1', TICKED)).rejects.toMatchObject({ status: 404 });
		expect(await rowOf()).toEqual(before);
	});

	test('an unknown channel reads as not found', async () => {
		await expect(saveReplies('UC-missing', TICKED)).rejects.toMatchObject({ status: 404 });
	});
});

describe('setModerateReplies: input and environment', () => {
	test.each([{ value: 'maybe' }, { value: 'on' }, { value: '' }])('enabled "$value" is refused with 400 and changes nothing', async ({ value }) => {
		await seedChannel('UC1');
		const before = await rowOf();

		const res = await saveReplies('UC1', [value]);

		expect(res).toMatchObject({ status: 400, data: { scope: 'replies' } });
		expect(await rowOf()).toEqual(before);
	});

	test('a request without the enabled field is refused with 400 and changes nothing', async () => {
		await seedChannel('UC1');
		const before = await rowOf();

		const res = await saveReplies('UC1', []);

		expect(res).toMatchObject({ status: 400, data: { scope: 'replies' } });
		expect(await rowOf()).toEqual(before);
	});

	test('under env dry-run both directions are refused with 409 and the row is unchanged', async () => {
		mocks.env.DRY_RUN = 'true';
		await seedChannel('UC1', CHECKPOINT);
		const before = await rowOf();

		expect(await saveReplies('UC1', TICKED)).toMatchObject({ status: 409, data: { scope: 'replies' } });
		expect(await saveReplies('UC1', UNTICKED)).toMatchObject({ status: 409, data: { scope: 'replies' } });
		expect(await rowOf()).toEqual(before);
	});

	test.each([{ dryRun: undefined }, { dryRun: 'ture' }])('an unset or misspelled DRY_RUN ("$dryRun") fails loudly with 500 and changes nothing', async ({ dryRun }) => {
		mocks.env.DRY_RUN = dryRun;
		await seedChannel('UC1');
		const before = await rowOf();

		await expect(saveReplies('UC1', TICKED)).rejects.toMatchObject({ status: 500 });
		expect(await rowOf()).toEqual(before);
	});
});

describe('setModerateReplies: enabling and disabling', () => {
	test.each([
		{ start: 'off', over: {} }
	])('enabling from $start stamps the enable time into since and last check and clears the checkpoint', async ({ over }) => {
		await seedChannel('UC1', over);
		const before = await rowOf();
		vi.setSystemTime(new Date(T_FIRST));

		const res = await saveReplies('UC1', TICKED);

		expect(res).toMatchObject({ ok: true, scope: 'replies' });
		expect(await rowOf()).toEqual({
			...before,
			moderateRepliesSince: T_FIRST,
			replySweepLastAt: T_FIRST,
			replySweepBoundary: null,
			replySweepPageToken: null,
			replySweepShortfall: null
		});
	});

	test('re-saving an enabled setting changes nothing: the enable time and the checkpoint survive', async () => {
		await seedChannel('UC1', CHECKPOINT);
		const before = await rowOf();
		vi.setSystemTime(new Date(T_LATER));

		const res = await saveReplies('UC1', TICKED);

		expect(res).toMatchObject({ ok: true, scope: 'replies' });
		expect(await rowOf()).toEqual(before);
	});

	test('disabling clears all five reply columns and leaves the rest of the row alone', async () => {
		await seedChannel('UC1', CHECKPOINT);
		const before = await rowOf();

		const res = await saveReplies('UC1', UNTICKED);

		expect(res).toMatchObject({ ok: true, scope: 'replies' });
		expect(await rowOf()).toEqual({ ...before, ...REPLY_COLUMNS });
	});

	test('enabling again after a disable starts from the new enable time, not the old one', async () => {
		await seedChannel('UC1');
		vi.setSystemTime(new Date(T_FIRST));
		await saveReplies('UC1', TICKED);
		vi.setSystemTime(new Date(T_LATER));
		await saveReplies('UC1', UNTICKED);
		vi.setSystemTime(new Date(T_LATEST));
		await saveReplies('UC1', TICKED);

		expect(await rowOf()).toMatchObject({ moderateRepliesSince: T_LATEST, replySweepLastAt: T_LATEST });
	});
});

describe('setModerateReplies: database failure', () => {
	test('a failed save is logged on the server and answered with a generic 502 that carries no internal detail', async () => {
		await seedChannel('UC1');
		const before = await rowOf();
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(testDb().db, 'update').mockImplementation(() => {
			throw new Error('hrana 502: connect to upstream failed');
		});

		const res = (await saveReplies('UC1', TICKED)) as { status: number; data: unknown };

		expect(res.status).toBe(502);
		expect(JSON.stringify(res)).not.toContain('hrana');
		expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('setModerateReplies'), 'UC1', expect.any(Error));
		vi.restoreAllMocks();
		expect(await rowOf()).toEqual(before);
	});
});
