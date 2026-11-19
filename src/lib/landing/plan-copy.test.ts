import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import PlanHosted from '$lib/components/landing/PlanHosted.svelte';
import PricingHero from '$lib/components/landing/pricing/PricingHero.svelte';
import { HOSTED_INCLUDED_CREDITS, validatePlanPrice } from '$lib/server/billing/plans';
import { INCLUDED_COMMENTS, MONTHLY_PLAN_USD } from './cost';
import { PRICING_FAQ_ENTRIES } from './pricing-faq';

vi.mock('$env/dynamic/private', () => ({ env: { APP_URL: 'https://preview.example' } }));

const text = (html: string) => html.replace(/<!--.*?-->/gs, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('the displayed plan and the server grant describe the same hosted plan', () => {
	expect(INCLUDED_COMMENTS).toBe(HOSTED_INCLUDED_CREDITS);
	const hostedPrice = { id: 'price_hosted', active: true, currency: 'usd', type: 'recurring', unit_amount: MONTHLY_PLAN_USD * 100, recurring: { interval: 'month', interval_count: 1 } };
	expect(() => validatePlanPrice('hosted', hostedPrice)).not.toThrow();
});

test('the hosted plan panel shows the plan price and allowance', () => {
	const panel = text(render(PlanHosted).body);
	expect(panel).toContain(`$${MONTHLY_PLAN_USD}`);
	expect(panel).toContain(`${INCLUDED_COMMENTS} AI classifications`);
	expect(panel).toContain(`${INCLUDED_COMMENTS} credits`);
});

test('the pricing hero states the plan price and allowance', () => {
	const hero = text(render(PricingHero).body);
	expect(hero).toContain(`$${MONTHLY_PLAN_USD}`);
	expect(hero).toContain(`${INCLUDED_COMMENTS} AI classifications`);
});

test('the pricing FAQ quotes the plan price and allowance, and prices its worked example from them', () => {
	const faq = PRICING_FAQ_ENTRIES.map((entry) => `${entry.q} ${entry.a}`).join(' ');
	expect(faq).toContain(`$${MONTHLY_PLAN_USD} a month`);
	expect(faq).toContain(`${INCLUDED_COMMENTS} AI classifications`);
	// 900 moderation scores + 100 digests = 1,000 comments, 100 over the allowance: one 500-credit bundle ($20.40).
	expect(faq).toContain('$29.40 including the subscription, with 400 purchased credits left');
});
