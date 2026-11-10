import { describe, expect, test } from 'vitest';

import { replyCheckShortfall, replyCheckStatus, type ReplyCheckChannel } from './replyCheckStatus';

const ENABLED_AT = '2026-11-07T10:00:00.000Z';

function channel(overrides: Partial<ReplyCheckChannel> = {}): ReplyCheckChannel {
	return {
		moderateRepliesSince: null,
		replySweepBoundary: null,
		replySweepLastAt: null,
		replySweepShortfall: null,
		...overrides
	};
}

describe('replyCheckStatus', () => {
	test('a channel that never turned replies on is off', () => {
		expect(replyCheckStatus(channel(), '2026-11-07T10:00:00.000Z')).toBe('off');
	});

	test('off wins over a leftover checkpoint, so no pass is invented for a disabled channel', () => {
		const row = channel({ replySweepBoundary: '2026-11-01T00:00:00.000Z', replySweepLastAt: '2026-11-07T09:00:00.000Z' });
		expect(replyCheckStatus(row, '2026-11-07T10:00:00.000Z')).toBe('off');
	});

	test('right after enabling, the first check is pending', () => {
		const row = channel({ moderateRepliesSince: ENABLED_AT, replySweepLastAt: ENABLED_AT });
		expect(replyCheckStatus(row, ENABLED_AT)).toBe('first-check-pending');
	});

	test('first-check-pending holds at one hour minus a millisecond, at exactly one hour and at one hour plus a millisecond, and no completed check exists', () => {
		const row = channel({ moderateRepliesSince: ENABLED_AT, replySweepLastAt: ENABLED_AT });
		expect(replyCheckStatus(row, '2026-11-07T10:59:59.999Z')).toBe('first-check-pending');
		expect(replyCheckStatus(row, '2026-11-07T11:00:00.000Z')).toBe('first-check-pending');
		expect(replyCheckStatus(row, '2026-11-07T11:00:00.001Z')).toBe('first-check-pending');
	});

	test('a channel with no recorded check start is pending, however late the clock is', () => {
		expect(replyCheckStatus(channel({ moderateRepliesSince: ENABLED_AT }), '2026-11-07T18:00:00.000Z')).toBe('first-check-pending');
	});

	test('a pass in flight is in progress while its start is at most six hours old', () => {
		const row = channel({
			moderateRepliesSince: ENABLED_AT,
			replySweepBoundary: '2026-11-04T10:00:00.000Z',
			replySweepLastAt: '2026-11-07T11:00:00.000Z'
		});
		expect(replyCheckStatus(row, '2026-11-07T11:01:00.000Z')).toBe('in-progress');
		// Exactly six hours after the start is not yet stale.
		expect(replyCheckStatus(row, '2026-11-07T17:00:00.000Z')).toBe('in-progress');
	});

	test('a pass in flight for more than six hours is stale', () => {
		const row = channel({
			moderateRepliesSince: ENABLED_AT,
			replySweepBoundary: '2026-11-04T10:00:00.000Z',
			replySweepLastAt: '2026-11-07T11:00:00.000Z'
		});
		expect(replyCheckStatus(row, '2026-11-07T17:00:00.001Z')).toBe('stale');
	});

	test('a pass in flight with no recorded start cannot be shown as progressing, so it is stale', () => {
		const row = channel({ moderateRepliesSince: ENABLED_AT, replySweepBoundary: '2026-11-04T10:00:00.000Z' });
		expect(replyCheckStatus(row, ENABLED_AT)).toBe('stale');
	});

	test('a finished check is the last check, shown as such however old it is', () => {
		const row = channel({ moderateRepliesSince: ENABLED_AT, replySweepLastAt: '2026-11-07T12:00:00.000Z', replySweepShortfall: 0 });
		expect(replyCheckStatus(row, '2026-11-07T12:00:00.000Z')).toBe('last-check');
		expect(replyCheckStatus(row, '2026-11-08T12:00:00.000Z')).toBe('last-check');
	});

	test('a finished check exactly one hour old is shown as the last check', () => {
		const row = channel({ moderateRepliesSince: ENABLED_AT, replySweepLastAt: '2026-11-07T11:00:00.000Z' });
		expect(replyCheckStatus(row, '2026-11-07T12:00:00.000Z')).toBe('last-check');
	});

	test('a row missing the reply columns reads as off', () => {
		// Partial rows (the outage payload and older page fixtures) lack these keys.
		expect(replyCheckStatus({} as ReplyCheckChannel, ENABLED_AT)).toBe('off');
	});

	test('an unparseable timestamp fails loudly instead of guessing a state', () => {
		const row = channel({ moderateRepliesSince: ENABLED_AT, replySweepLastAt: 'yesterday' });
		expect(() => replyCheckStatus(row, ENABLED_AT)).toThrow(/timestamp/);
	});
});

describe('replyCheckShortfall', () => {
	test.each([
		{ shortfall: null, expected: 0 },
		{ shortfall: 0, expected: 0 },
		{ shortfall: 3, expected: 3 }
	])('a shortfall of $shortfall reads as $expected', ({ shortfall, expected }) => {
		expect(replyCheckShortfall(channel({ replySweepShortfall: shortfall }))).toBe(expected);
	});
});

describe('replyCheckStatus with a pause', () => {
	const NOW_ISO = '2026-11-07T11:30:00.000Z';
	// Four checkpoints that read as four different states at NOW_ISO, so a pause that is ignored shows up.
	const CHECKPOINTS = [
		{ name: 'no check yet', row: channel({ moderateRepliesSince: ENABLED_AT }), state: 'first-check-pending' },
		{
			name: 'a pass in flight',
			row: channel({ moderateRepliesSince: ENABLED_AT, replySweepBoundary: '2026-11-04T10:00:00.000Z', replySweepLastAt: '2026-11-07T11:00:00.000Z' }),
			state: 'in-progress'
		},
		{
			name: 'a stalled pass',
			row: channel({ moderateRepliesSince: ENABLED_AT, replySweepBoundary: '2026-11-04T10:00:00.000Z', replySweepLastAt: '2026-11-07T04:00:00.000Z' }),
			state: 'stale'
		},
		{
			name: 'a finished check',
			row: channel({ moderateRepliesSince: ENABLED_AT, replySweepLastAt: '2026-11-07T11:00:00.000Z', replySweepShortfall: 0 }),
			state: 'last-check'
		}
	];

	test('the checkpoints read as four distinct states without a pause', () => {
		expect(CHECKPOINTS.map(({ row }) => replyCheckStatus(row, NOW_ISO))).toEqual(['first-check-pending', 'in-progress', 'stale', 'last-check']);
	});

	test.each(CHECKPOINTS)('a server pause shows as paused-by-server over $name', ({ row }) => {
		expect(replyCheckStatus(row, NOW_ISO, 'paused-by-server')).toBe('paused-by-server');
	});

	test.each(CHECKPOINTS)('a quota pause shows as paused-quota-today over $name', ({ row }) => {
		expect(replyCheckStatus(row, NOW_ISO, 'paused-quota-today')).toBe('paused-quota-today');
	});

	test.each(['paused-by-server', 'paused-quota-today'] as const)('a %s pause does not show while reply moderation is off', (pause) => {
		expect(replyCheckStatus(channel({ replySweepLastAt: '2026-11-07T11:00:00.000Z' }), NOW_ISO, pause)).toBe('off');
	});

	test.each([undefined, null])('a pause of %s leaves the checkpoint states unchanged', (pause) => {
		expect(replyCheckStatus(CHECKPOINTS[0].row, NOW_ISO, pause)).toBe('first-check-pending');
		expect(replyCheckStatus(CHECKPOINTS[3].row, NOW_ISO, pause)).toBe('last-check');
	});
});
