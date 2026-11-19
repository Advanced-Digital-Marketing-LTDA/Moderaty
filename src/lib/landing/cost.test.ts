import { describe, expect, test } from 'vitest';

import { estimateHostedMonth, forecastCost, forecastMonths, hostedCostUsd, MAX_CALCULATOR_COMMENTS, validCountInput, validateCommentCount } from './cost';

describe('calculator number inputs', () => {
	test('allows both untouched and cleared fields without treating them as zero', () => {
		expect(validCountInput(undefined)).toBe(true);
		// Svelte's number binding returns null when the visitor clears a field.
		expect(validCountInput(null)).toBe(true);
		expect(() => validateCommentCount(null as unknown as number)).toThrow();
		expect(() => validateCommentCount(undefined as unknown as number)).toThrow();
	});

	test('accepts zero and the maximum but marks out-of-range and fractional form values invalid', () => {
		expect(validCountInput(0)).toBe(true);
		expect(validCountInput(MAX_CALCULATOR_COMMENTS)).toBe(true);
		for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_CALCULATOR_COMMENTS + 1]) {
			expect(validCountInput(value)).toBe(false);
		}
	});
});

describe('hosted cost calculator', () => {
	// Prices below are worked by hand from the published plan: $9 covers the first
	// 900 classifications, and only the 500-for-$20.40 and 2,000-for-$64.65
	// bundles can be bought beyond that.
	test('an active hosted subscription costs $9 even with zero classifications', () => {
		expect(hostedCostUsd(0)).toBe(9);
		expect(hostedCostUsd(900)).toBe(9);
		// 10 top-up credits can't be bought individually — the smallest
		// purchasable bundle is 500 credits for $20.40 (the 100-credit size
		// is retained for historical grants; the remainder carries over).
		expect(hostedCostUsd(910)).toBeCloseTo(29.4, 5);
	});

	test.each([
		[99, 9], [100, 9], [900, 9], [901, 29.4], [1400, 29.4],
		[1401, 49.8], [1900, 49.8], [1901, 70.2], [2400, 70.2],
		[2401, 73.65], [2900, 73.65], [2901, 94.05], [10000, 328.8]
	])('preserves the purchasable-bundle boundary at %i classifications', (classifications, cost) => {
		expect(hostedCostUsd(classifications)).toBeCloseTo(cost, 5);
	});

	test('digest classifications share the allowance and add to moderation scoring', () => {
		expect(hostedCostUsd(900, 0)).toBe(9);
		expect(hostedCostUsd(900, 100)).toBeCloseTo(29.4, 5);
		expect(hostedCostUsd(0, 900)).toBe(9);
		expect(hostedCostUsd(0, 901)).toBeCloseTo(29.4, 5);
		expect(hostedCostUsd(900, 500)).toBeCloseTo(29.4, 5);
		expect(hostedCostUsd(900, 501)).toBeCloseTo(49.8, 5);
	});

	test('separates cash purchases, consumed credits and the purchased balance left', () => {
		expect(estimateHostedMonth(900, 100)).toEqual({
			classifications: 1000,
			includedUsed: 900,
			purchasedUsed: 100,
			topupCredits: 500,
			topupCostUsd: 20.4,
			remainingPurchasedCredits: 400,
			cashCostUsd: 29.4
		});
		expect(estimateHostedMonth(0)).toEqual({
			classifications: 0, includedUsed: 0, purchasedUsed: 0,
			topupCredits: 0, topupCostUsd: 0, remainingPurchasedCredits: 0, cashCostUsd: 9
		});
		expect(estimateHostedMonth(2401).remainingPurchasedCredits).toBe(499);
	});

	test('rejects invalid counts in either scoring input without changing them', () => {
		for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, MAX_CALCULATOR_COMMENTS + 1]) {
			expect(() => hostedCostUsd(value, 0)).toThrow();
			expect(() => hostedCostUsd(0, value)).toThrow();
		}
	});

	test('accepts the maximum moderation and digest counts without losing integer precision', () => {
		const estimate = estimateHostedMonth(MAX_CALCULATOR_COMMENTS, MAX_CALCULATOR_COMMENTS);
		expect(estimate.classifications).toBe(20_000_000);
		expect(estimate.purchasedUsed).toBe(19_999_100);
		// 9,999 two-thousand bundles cover 19,998,000; the last 1,100 are cheapest as three 500 bundles.
		expect(estimate.topupCredits).toBe(19_999_500);
		expect(estimate.cashCostUsd).toBeCloseTo(646_505.55, 2);
		expect(estimate.remainingPurchasedCredits).toBe(400);
	});

	test('top-up comments price as the cheapest purchasable bundle combination', () => {
		// Manual credits only exist as fixed 500/2,000 bundles — the forecast
		// is the cheapest combination covering the usage, never a per-credit
		// rate nobody can buy (codex). Carry-over is real: leftovers persist.
		expect(hostedCostUsd(1000)).toBeCloseTo(29.4, 5); // 100 top-up = one 500-bundle
		expect(hostedCostUsd(910)).toBeCloseTo(29.4, 5); // 10 top-up credits still need the whole bundle
		expect(hostedCostUsd(1400)).toBeCloseTo(29.4, 5); // 500-bundle exactly
		expect(hostedCostUsd(1900)).toBeCloseTo(49.8, 5); // 1,000 top-up = two 500-bundles
		expect(hostedCostUsd(2900)).toBeCloseTo(73.65, 5); // 2,000-bundle
	});

	test('rejects fractional, negative, unsafe, and unbounded inputs', () => {
		for (const value of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, 10_000_001]) {
			expect(() => validateCommentCount(value)).toThrow();
		}
	});

	test('returns a three-month average and a conservative low/high range', () => {
		const forecast = forecastCost([500, 1000, 1500]);
		expect(forecast.averageComments).toBe(1000);
		expect(forecast.lowComments).toBe(500);
		expect(forecast.highComments).toBe(1500);
		expect(forecast.lowCostUsd).toBe(9);
		expect(forecast.averageCostUsd).toBeCloseTo(29.4, 5);
		// 1,500 comments = $9 plan + 600 top-up credits = two 500-bundles ($40.80).
		expect(forecast.highCostUsd).toBeCloseTo(49.8, 5);
	});
});

describe('three-month forecast gate', () => {
		test('returns null until ALL three months are filled — a blank input is never treated as 0', () => {
		// forecastMonths([...]) feeds CostMath's "Forecast a range" calculator:
		// blank months must yield no forecast at all, not an instant low
		// estimate built on zeros (codex).
		expect(forecastMonths([undefined, undefined, undefined])).toBeNull();
		expect(forecastMonths([100, undefined, 300])).toBeNull();
		expect(forecastMonths([100, null, 300])).toBeNull();
		expect(forecastMonths([0, 0, 0])).not.toBeNull();
	});

	test('zero months each retain the recurring subscription in the independent scenarios', () => {
		expect(forecastCost([0, 0, 0])).toMatchObject({ lowCostUsd: 9, averageCostUsd: 9, highCostUsd: 9 });
		expect(forecastCost([0, 600, 1200])).toMatchObject({ lowCostUsd: 9, averageCostUsd: 9, highCostUsd: 29.4 });
	});

	test('returns null when any filled month is invalid, and the forecast when all three are valid', () => {
		expect(forecastMonths([100, -1, 300])).toBeNull();
		expect(forecastMonths([100, 1.5, 300])).toBeNull();
		expect(forecastMonths([100, 200, 300])).toEqual(forecastCost([100, 200, 300]));
	});
});
