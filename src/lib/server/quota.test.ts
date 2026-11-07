import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { youtubeQuotaUsage } from '$lib/server/db/schema';
import { setupTestDb, testDb, wipeTables } from '$lib/server/testdb';
import { youtubeEndpoint } from './youtube';
import {
	flushYoutubeUnits,
	isQuotaFailure,
	markQuotaExhausted,
	pacificDay,
	readQuotaExhaustedToday,
	readReplyCeiling,
	readYoutubeUnitsToday,
	recordYoutubeUnits,
	YOUTUBE_UNIT_COST
} from './quota';

setupTestDb(['youtube_quota_usage']);

// 2026-11-07 04:00 in Los Angeles (PST), so the Pacific day is 2026-11-07 for every test below.
const NOON_UTC_MS = Date.parse('2026-11-07T12:00:00.000Z');
const TODAY = '2026-11-07';

/** The stored units for a Pacific day, or undefined when the day has no row. */
async function storedUnits(day = TODAY): Promise<number | undefined> {
	return (await testDb().db.select({ units: youtubeQuotaUsage.units }).from(youtubeQuotaUsage).where(eq(youtubeQuotaUsage.day, day)).get())?.units;
}

beforeEach(async () => {
	// Units recorded by earlier tests in this file are still pending in memory. Drain them, then start from an empty meter.
	await flushYoutubeUnits(testDb().db, NOON_UTC_MS);
	await wipeTables(['youtube_quota_usage']);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('unit costs', () => {
	test('each documented YouTube endpoint has its documented unit cost', () => {
		expect(YOUTUBE_UNIT_COST).toEqual({
			'commentThreads.list': 1,
			'comments.list': 1,
			'channels.list': 1,
			'videos.list': 1,
			'comments.setModerationStatus': 50,
			'comments.delete': 50
		});
	});

	test.each([
		['GET', '/commentThreads?part=snippet', 'commentThreads.list'],
		['GET', '/comments?part=snippet', 'comments.list'],
		['POST', '/comments/setModerationStatus?id=c1', 'comments.setModerationStatus'],
		['DELETE', '/comments?id=c1', 'comments.delete'],
		['GET', '/channels?part=id', 'channels.list'],
		['GET', '/videos?part=snippet', 'videos.list']
	])('%s %s is billed to %s', (method, path, endpoint) => {
		expect(youtubeEndpoint(method, path)).toBe(endpoint);
	});

	test('a request with no documented endpoint throws, naming the route', () => {
		expect(() => youtubeEndpoint('POST', '/channels?part=id')).toThrow('no quota endpoint for YouTube request POST /channels');
	});
});

describe('pacificDay', () => {
	test('one second before Pacific midnight in winter is still the previous day', () => {
		expect(pacificDay(Date.parse('2026-11-08T07:59:59.000Z'))).toBe('2026-11-07');
	});

	test('the Pacific day rolls over at 08:00 UTC in winter', () => {
		expect(pacificDay(Date.parse('2026-11-08T08:00:00.000Z'))).toBe('2026-11-08');
	});

	test('the Pacific day follows daylight saving time, so 06:59:59 UTC in July is still the previous day', () => {
		expect(pacificDay(Date.parse('2026-07-01T06:59:59.000Z'))).toBe('2026-06-30');
	});
});

describe('readReplyCeiling', () => {
	test.each<[string | undefined, ReturnType<typeof readReplyCeiling>]>([
		[undefined, { kind: 'disabled', reason: 'ceiling-not-set' }],
		['', { kind: 'disabled', reason: 'ceiling-not-set' }],
		['   ', { kind: 'disabled', reason: 'ceiling-not-set' }],
		['0', { kind: 'disabled', reason: 'kill-switch' }],
		['1', { kind: 'cap', units: 1 }],
		['250000', { kind: 'cap', units: 250000 }],
		[' 12 ', { kind: 'cap', units: 12 }],
		['-5', { kind: 'disabled', reason: 'ceiling-invalid' }],
		['1.5', { kind: 'disabled', reason: 'ceiling-invalid' }],
		['1e3', { kind: 'disabled', reason: 'ceiling-invalid' }],
		['0x10', { kind: 'disabled', reason: 'ceiling-invalid' }],
		['abc', { kind: 'disabled', reason: 'ceiling-invalid' }],
		['99999999999999999999', { kind: 'disabled', reason: 'ceiling-invalid' }]
	])('the ceiling setting %j reads as %j', (raw, expected) => {
		expect(readReplyCeiling(raw)).toEqual(expected);
	});
});

describe('isQuotaFailure', () => {
	test.each([
		'setModerationStatus failed: 403 {"reason":"quotaExceeded"}',
		'commentThreads.list failed: 403 {"reason":"dailyLimitExceeded"}',
		'comments.list failed: 429 {"reason":"rateLimitExceeded"}',
		'comments.delete failed: 403 {"reason":"userRateLimitExceeded"}'
	])('%s is a quota failure', (message) => {
		expect(isQuotaFailure(new Error(message))).toBe(true);
	});

	test('a refused comment and a non-error value are not quota failures', () => {
		expect(isQuotaFailure(new Error('setModerationStatus failed: 400 {"reason":"badRequest"}'))).toBe(false);
		expect(isQuotaFailure('quotaExceeded')).toBe(false);
	});
});

describe('the day meter', () => {
	test('one commentThreads.list call and one setModerationStatus call flush as exactly 51 units for today', async () => {
		recordYoutubeUnits('commentThreads.list');
		recordYoutubeUnits('comments.setModerationStatus');

		await flushYoutubeUnits(testDb().db, NOON_UTC_MS);

		expect(await storedUnits()).toBe(51);
	});

	test('a later flush with one comments.delete adds exactly 50, for a total of 101', async () => {
		recordYoutubeUnits('commentThreads.list');
		recordYoutubeUnits('comments.setModerationStatus');
		await flushYoutubeUnits(testDb().db, NOON_UTC_MS);

		recordYoutubeUnits('comments.delete');
		await flushYoutubeUnits(testDb().db, NOON_UTC_MS);

		expect(await storedUnits()).toBe(101);
	});

	test('a flush with nothing pending writes nothing', async () => {
		const insert = vi.spyOn(testDb().db, 'insert');

		await flushYoutubeUnits(testDb().db, NOON_UTC_MS);

		expect(insert).not.toHaveBeenCalled();
		expect(await storedUnits()).toBeUndefined();
	});

	test('a failed flush propagates and keeps the pending units for the next flush', async () => {
		recordYoutubeUnits('comments.delete');
		await testDb().client.execute('DROP TABLE youtube_quota_usage');

		await expect(flushYoutubeUnits(testDb().db, NOON_UTC_MS)).rejects.toThrow(/youtube_quota_usage/);

		await testDb().client.execute('CREATE TABLE youtube_quota_usage (day TEXT PRIMARY KEY NOT NULL, units INTEGER NOT NULL DEFAULT 0, exhausted_at TEXT)');
		await flushYoutubeUnits(testDb().db, NOON_UTC_MS);
		expect(await storedUnits()).toBe(50);
	});

	test('readYoutubeUnitsToday includes units recorded but not yet flushed', async () => {
		await testDb().db.insert(youtubeQuotaUsage).values({ day: TODAY, units: 7 });
		recordYoutubeUnits('comments.delete');

		expect(await readYoutubeUnitsToday(testDb().db, NOON_UTC_MS)).toBe(57);

		await flushYoutubeUnits(testDb().db, NOON_UTC_MS);
		expect(await readYoutubeUnitsToday(testDb().db, NOON_UTC_MS)).toBe(57);
	});

	test("readYoutubeUnitsToday counts only today: yesterday's row is ignored", async () => {
		await testDb().db.insert(youtubeQuotaUsage).values({ day: '2026-11-06', units: 900 });

		expect(await readYoutubeUnitsToday(testDb().db, NOON_UTC_MS)).toBe(0);
	});
});

describe('readQuotaExhaustedToday', () => {
	test('is false when today has no row', async () => {
		expect(await readQuotaExhaustedToday(testDb().db, NOON_UTC_MS)).toBe(false);
	});

	test('is false for today when units were recorded but no quota refusal stamped the day', async () => {
		await testDb().db.insert(youtubeQuotaUsage).values({ day: TODAY, units: 900 });

		expect(await readQuotaExhaustedToday(testDb().db, NOON_UTC_MS)).toBe(false);
	});

	test("is false when only yesterday's Pacific day was stamped", async () => {
		await testDb().db.insert(youtubeQuotaUsage).values({ day: '2026-11-06', units: 0, exhaustedAt: '2026-11-06T12:00:00.000Z' });

		expect(await readQuotaExhaustedToday(testDb().db, NOON_UTC_MS)).toBe(false);
	});

	test('is true once a quota refusal has stamped today', async () => {
		await testDb().db.insert(youtubeQuotaUsage).values({ day: TODAY, units: 0, exhaustedAt: '2026-11-07T12:00:00.000Z' });

		expect(await readQuotaExhaustedToday(testDb().db, NOON_UTC_MS)).toBe(true);
	});

	test('the stamp holds until the Pacific day rolls over at 08:00 UTC in winter', async () => {
		await testDb().db.insert(youtubeQuotaUsage).values({ day: TODAY, units: 0, exhaustedAt: '2026-11-07T12:00:00.000Z' });

		expect(await readQuotaExhaustedToday(testDb().db, Date.parse('2026-11-08T07:59:59.000Z'))).toBe(true);
		expect(await readQuotaExhaustedToday(testDb().db, Date.parse('2026-11-08T08:00:00.000Z'))).toBe(false);
	});
});

describe('markQuotaExhausted', () => {
	test('stamps today with the exact instant and leaves its units unchanged', async () => {
		await testDb().db.insert(youtubeQuotaUsage).values({ day: TODAY, units: 900 });
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});

		await markQuotaExhausted(testDb().db, NOON_UTC_MS);

		const row = await testDb().db.select().from(youtubeQuotaUsage).where(eq(youtubeQuotaUsage.day, TODAY)).get();
		expect(row).toEqual({ day: TODAY, units: 900, exhaustedAt: '2026-11-07T12:00:00.000Z' });
		expect(error).toHaveBeenCalledWith('YouTube quota exhausted; reply checks stop until the Pacific day rolls over');
	});

	test('with no row for today, the stamp creates it with zero units', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await markQuotaExhausted(testDb().db, NOON_UTC_MS);

		const row = await testDb().db.select().from(youtubeQuotaUsage).where(eq(youtubeQuotaUsage.day, TODAY)).get();
		expect(row).toEqual({ day: TODAY, units: 0, exhaustedAt: '2026-11-07T12:00:00.000Z' });
	});
});
