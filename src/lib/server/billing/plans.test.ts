import { describe, expect, test } from 'vitest';
import { HOSTED_INCLUDED_CREDITS, INCLUDED_CREDITS_METADATA_KEY, LIFETIME_SLOT_LIMIT, includedCreditsFromPriceMetadata, planPriceEnv, validatePlanPrice } from './plans';

describe('plan catalog', () => {
	test('defines the advertised hosted and lifetime contracts', () => {
		expect(HOSTED_INCLUDED_CREDITS).toBe(900);
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

describe('includedCreditsFromPriceMetadata', () => {
	test('reads the allowance the Price itself declares', () => {
		expect(INCLUDED_CREDITS_METADATA_KEY).toBe('included_credits');
		expect(includedCreditsFromPriceMetadata('price_new', { included_credits: '900' })).toBe(900);
		expect(includedCreditsFromPriceMetadata('price_old', { included_credits: '100' })).toBe(100);
	});

	test.each([
		['no metadata at all', undefined],
		['null metadata', null],
		['metadata without the key', { other: '900' }],
		['an empty value', { included_credits: '' }],
		['a non-numeric value', { included_credits: 'nine hundred' }],
		['zero', { included_credits: '0' }],
		['a negative value', { included_credits: '-100' }],
		['a fractional value', { included_credits: '9.5' }],
		['scientific notation', { included_credits: '9e2' }],
		['surrounding whitespace', { included_credits: ' 900 ' }],
		['a non-string value', { included_credits: 900 }]
	])('rejects %s and names the Price and the key', (_name, metadata) => {
		expect(() => includedCreditsFromPriceMetadata('price_bad', metadata)).toThrow(/price_bad.*included_credits/s);
	});
});
