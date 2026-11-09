import { expect, test } from 'vitest';
import { CalcInputError, MAX_MONTHLY_VIEWS, calculate, cpmToLongFormRpm, guardUnexpected, parseRequiredNumber, runCalculator, runNiche } from './youtube-money';

const RPM_OPTIONS = { max: 1000 };

test('parseRequiredNumber accepts plain positive numbers, trimmed', () => {
	expect(parseRequiredNumber('3.50', 'RPM', RPM_OPTIONS)).toBe(3.5);
	expect(parseRequiredNumber(' 250000 ', 'Views', { max: 1e9, whole: true })).toBe(250000);
});

test.each([
	['', 'is empty'],
	['   ', 'is empty'],
	['0', 'greater than zero'],
	['-1', 'plain number'],
	['abc', 'plain number'],
	['Infinity', 'plain number'],
	['1e3', 'plain number'],
	['1,000', 'commas'],
	['5000', 'or less']
])('parseRequiredNumber rejects %j loudly with a message containing %j', (raw, fragment) => {
	expect(() => parseRequiredNumber(raw, 'RPM', RPM_OPTIONS)).toThrow(CalcInputError);
	expect(() => parseRequiredNumber(raw, 'RPM', RPM_OPTIONS)).toThrow(fragment);
});

test('parseRequiredNumber rejects fractional views when whole numbers are required', () => {
	expect(() => parseRequiredNumber('1.5', 'Views', { max: 1e9, whole: true })).toThrow('whole number');
});

test('calculate returns exact single-stream earnings', () => {
	const out = calculate([{ label: 'Long-form', views: 250_000, rpm: 3.5 }], 1000);
	expect(out.monthlyUsd).toBe(875);
	expect(out.yearlyUsd).toBe(10_500);
	expect(out.dailyUsd).toBeCloseTo(875 / 30, 10);
	expect(out.perMillionUsd).toBe(3_500);
	expect(out.halfRpmMonthlyUsd).toBe(437.5);
	expect(out.doubleRpmMonthlyUsd).toBe(1_750);
	expect(out.viewsNeeded).toBe(285_715);
});

test('calculate blends both rows and keeps the goal at the current mix', () => {
	const out = calculate(
		[
			{ label: 'Long-form', views: 100_000, rpm: 4 },
			{ label: 'Shorts', views: 900_000, rpm: 0.05 }
		],
		1000
	);
	expect(out.monthlyUsd).toBeCloseTo(445, 10);
	expect(out.totalViews).toBe(1_000_000);
	expect(out.blendedRpm).toBeCloseTo(0.445, 10);
	expect(out.perMillionUsd).toBeCloseTo(445, 10);
	expect(out.halfRpmMonthlyUsd).toBeCloseTo(222.5, 10);
	expect(out.doubleRpmMonthlyUsd).toBeCloseTo(890, 10);
	expect(out.viewsNeeded).toBe(2_247_192);
});

test('calculate leaves views needed null when no goal is given', () => {
	expect(calculate([{ label: 'Shorts', views: 10_000, rpm: 0.1 }], null).viewsNeeded).toBeNull();
});

test('calculate refuses an empty stream list instead of returning zeros', () => {
	expect(() => calculate([], null)).toThrow(CalcInputError);
});

test('cpmToLongFormRpm applies monetized share and the 55% long-form share', () => {
	expect(cpmToLongFormRpm(15, 60)).toBeCloseTo(4.95, 10);
	expect(cpmToLongFormRpm(25, 60)).toBeCloseTo(8.25, 10);
});

test('runNiche rejects a missing or out-of-range monetized share', () => {
	expect(runNiche('', 15, 25)).toEqual({ ok: false, error: expect.stringContaining('% of views that are monetized') });
	expect(runNiche('150', 15, 25)).toEqual({ ok: false, error: expect.stringContaining('100 or less') });
	expect(runNiche('60', 15, 25)).toEqual({ ok: true, rpmLow: expect.closeTo(4.95, 10), rpmHigh: expect.closeTo(8.25, 10) });
});

test('runCalculator refuses a blank RPM instead of falling back to a default', () => {
	const run = runCalculator({ contentType: 'long-form', longFormViews: '100000', longFormRpm: '', shortsViews: '', shortsRpm: '', goalUsd: '' });
	expect(run).toEqual({ ok: false, error: expect.stringContaining('Long-form RPM is empty') });
});

test('runCalculator ignores fields for content types that are not selected', () => {
	const run = runCalculator({ contentType: 'shorts', longFormViews: 'junk', longFormRpm: 'abc', shortsViews: '10000', shortsRpm: '0.1', goalUsd: '' });
	expect(run.ok).toBe(true);
	if (run.ok) expect(run.outputs.monthlyUsd).toBeCloseTo(1, 10);
});

test('runCalculator names the missing row in mixed mode', () => {
	const run = runCalculator({ contentType: 'both', longFormViews: '1000', longFormRpm: '2', shortsViews: '', shortsRpm: '0.1', goalUsd: '' });
	expect(run).toEqual({ ok: false, error: expect.stringContaining('Shorts monthly views is empty') });
});

test('runCalculator computes the goal when one is given and skips it when blank', () => {
	const base = { contentType: 'long-form' as const, longFormViews: '250000', longFormRpm: '3.5', shortsViews: '', shortsRpm: '', goalUsd: '1000' };
	const withGoal = runCalculator(base);
	expect(withGoal.ok && withGoal.outputs.viewsNeeded).toBe(285_715);
	const noGoal = runCalculator({ ...base, goalUsd: '  ' });
	expect(noGoal.ok && noGoal.outputs.viewsNeeded).toBe(null);
});

test('runCalculator reports the goal it was calculated with', () => {
	const run = runCalculator({ contentType: 'long-form', longFormViews: '250000', longFormRpm: '3.5', shortsViews: '', shortsRpm: '', goalUsd: '1000' });
	expect(run.ok && run.goalUsd).toBe(1000);
});

test('a positive goal needs at least one view, however small the goal', () => {
	expect(calculate([{ label: 'Long-form', views: 250_000, rpm: 3.5 }], 1e-10).viewsNeeded).toBe(1);
});

test('a goal that needs more views than the calculator accepts is an error, not a number', () => {
	expect(() => calculate([{ label: 'Long-form', views: 1000, rpm: 0.001 }], 1_000_000)).toThrow(CalcInputError);
});

test('an RPM so small that the goal needs unbounded views is an error, not Infinity', () => {
	expect(() => calculate([{ label: 'Shorts', views: 1000, rpm: 1e-308 }], 1)).toThrow(CalcInputError);
});

test('views needed is exact when the answer is a whole number', () => {
	expect(calculate([{ label: 'Long-form', views: 250_000, rpm: 3.5 }], 875).viewsNeeded).toBe(250_000);
});

test('the largest accepted values pass and one above them is rejected', () => {
	expect(parseRequiredNumber('1000', 'RPM', RPM_OPTIONS)).toBe(1000);
	expect(() => parseRequiredNumber('1000.01', 'RPM', RPM_OPTIONS)).toThrow('or less');
	expect(parseRequiredNumber(String(MAX_MONTHLY_VIEWS), 'Views', { max: MAX_MONTHLY_VIEWS, whole: true })).toBe(MAX_MONTHLY_VIEWS);
	expect(() => parseRequiredNumber(String(MAX_MONTHLY_VIEWS + 1), 'Views', { max: MAX_MONTHLY_VIEWS, whole: true })).toThrow('or less');
});

test('an RPM with more decimals than it can show is an error, not a silently rounded figure', () => {
	expect(parseRequiredNumber('3.123456', 'RPM', { max: 1000, decimals: 6 })).toBe(3.123456);
	expect(() => parseRequiredNumber('3.1234567', 'RPM', { max: 1000, decimals: 6 })).toThrow('at most 6 decimal places');
});

test('a goal with more than two decimals is an error, because money is shown to the cent', () => {
	const run = runCalculator({ contentType: 'long-form', longFormViews: '250000', longFormRpm: '3.5', shortsViews: '', shortsRpm: '', goalUsd: '1000.555' });
	expect(run).toEqual({ ok: false, error: expect.stringContaining('at most 2 decimal places') });
});

test('an unexpected failure is reported and shown as a generic message, without its internals', () => {
	const reported: unknown[] = [];
	const run = guardUnexpected(
		() => {
			throw new TypeError('internal detail');
		},
		(error) => reported.push(error)
	);
	expect(run).toEqual({ ok: false, error: expect.stringContaining('Reload the page') });
	expect(JSON.stringify(run)).not.toContain('internal detail');
	expect(reported).toHaveLength(1);
	expect(reported[0]).toBeInstanceOf(TypeError);
});

test('a computation that succeeds passes through unchanged and is not reported', () => {
	const reported: unknown[] = [];
	const result = guardUnexpected(() => ({ ok: true as const, value: 42 }), (error) => reported.push(error));
	expect(result).toEqual({ ok: true, value: 42 });
	expect(reported).toHaveLength(0);
});
