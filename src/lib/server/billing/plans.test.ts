import { describe, expect, test } from 'vitest';
import { HOSTED_INCLUDED_CREDITS, LEGACY_HOSTED_INCLUDED_CREDITS, LIFETIME_SLOT_LIMIT, hostedIncludedCreditsForPrice, planPriceEnv, validatePlanPrice } from './plans';

describe('plan catalog', () => {
	test('defines the advertised hosted and lifetime contracts', () => {
		expect(HOSTED_INCLUDED_CREDITS).toBe(900);
		expect(LEGACY_HOSTED_INCLUDED_CREDITS).toBe(100);
		expect(LIFETIME_SLOT_LIMIT).toBe(1000);
		expect(planPriceEnv('hosted')).toBe('STRIPE_PRICE_HOSTED_MONTHLY');
		expect(planPriceEnv('lifetime')).toBe('STRIPE_PRICE_LIFETIME');
	});

	test('accepts only an active one-time lifetime USD price at 49 dollars', () => {
		expect(() => validatePlanPrice('lifetime', { id: 'price_lifetime', active: true, currency: 'usd', type: 'one_time', unit_amount: 4900 })).not.toThrow();
		expect(() => validatePlanPrice('lifetime', { id: 'price_lifetime', active: false, currency: 'usd', type: 'one_time', unit_amount: 4900 })).toThrow(/active/);
		expect(() => validatePlanPrice('lifetime', { id: 'price_lifetime', active: true, currency: 'usd', type: 'recurring', unit_amount: 4900 })).toThrow(/one-time/);
		expect(() => validatePlanPrice('lifetime', { id: 'price_lifetime', active: true, currency: 'eur', type: 'one_time', unit_amount: 4900 })).toThrow(/USD/);
	});

	test('accepts only an active monthly hosted USD price at 9 dollars', () => {
		expect(() => validatePlanPrice('hosted', { id: 'price_hosted', active: true, currency: 'usd', type: 'recurring', unit_amount: 900, recurring: { interval: 'month', interval_count: 1 } })).not.toThrow();
		expect(() => validatePlanPrice('hosted', { id: 'price_hosted', active: false, currency: 'usd', type: 'recurring', unit_amount: 900, recurring: { interval: 'month', interval_count: 1 } })).toThrow(/active/);
		expect(() => validatePlanPrice('hosted', { id: 'price_hosted', active: true, currency: 'usd', type: 'recurring', unit_amount: 900, recurring: { interval: 'year', interval_count: 1 } })).toThrow(/monthly/);
		expect(() => validatePlanPrice('hosted', { id: 'price_hosted', active: true, currency: 'usd', type: 'recurring', unit_amount: 500, recurring: { interval: 'month', interval_count: 1 } })).toThrow(/900/);
	});
});

describe('hostedIncludedCreditsForPrice', () => {
	const prices = { current: 'price_new', legacy: 'price_old' };

	test('grants the full allowance for the current hosted price', () => {
		expect(hostedIncludedCreditsForPrice('price_new', prices)).toBe(900);
	});

	test('grants the old allowance for the legacy price during the migration window', () => {
		expect(hostedIncludedCreditsForPrice('price_old', prices)).toBe(100);
	});

	test('rejects the legacy price once no legacy price is configured', () => {
		expect(() => hostedIncludedCreditsForPrice('price_old', { current: 'price_new' })).toThrow(/price_old/);
	});

	test('rejects an unknown price instead of defaulting to an allowance', () => {
		expect(() => hostedIncludedCreditsForPrice('price_other', prices)).toThrow(/price_other/);
	});

	test('fails loudly when the hosted price is not configured', () => {
		expect(() => hostedIncludedCreditsForPrice('price_new', {})).toThrow(/STRIPE_PRICE_HOSTED_MONTHLY/);
	});
});
