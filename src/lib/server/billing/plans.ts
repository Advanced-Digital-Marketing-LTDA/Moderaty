export const HOSTED_INCLUDED_CREDITS = 900;
// The allowance of the retired $5 plan, still granted to its renewals until every subscription has moved to the current Price.
export const LEGACY_HOSTED_INCLUDED_CREDITS = 100;
const HOSTED_PRICE_CENTS = 900;
const LIFETIME_PRICE_CENTS = 4900;
export const LIFETIME_SLOT_LIMIT = 1000;
export const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'unpaid'] as const;

export function isActiveSubscriptionStatus(status: unknown): boolean {
	return typeof status === 'string' && ACTIVE_SUBSCRIPTION_STATUSES.includes(status as (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number]);
}

const HOSTED_PRICE_RECURRING_ERROR = 'hosted Stripe Price must be monthly recurring';
const LIFETIME_PRICE_ONE_TIME_ERROR = 'lifetime Stripe Price must be one-time';

export type PaidPlan = 'hosted' | 'lifetime';

type PriceLike = {
	id?: unknown;
	active?: unknown;
	currency?: unknown;
	type?: unknown;
	unit_amount?: unknown;
	recurring?: { interval?: unknown; interval_count?: unknown } | null;
};

export function planPriceEnv(plan: PaidPlan): 'STRIPE_PRICE_HOSTED_MONTHLY' | 'STRIPE_PRICE_LIFETIME' {
	return plan === 'hosted' ? 'STRIPE_PRICE_HOSTED_MONTHLY' : 'STRIPE_PRICE_LIFETIME';
}

export function validatePlanPrice(plan: PaidPlan, price: PriceLike): void {
	if (price.active !== true) throw new Error(`${plan} Stripe Price is inactive`);
	if (price.currency !== 'usd') throw new Error(`${plan} Stripe Price must be USD`);
	const expectedCents = plan === 'hosted' ? HOSTED_PRICE_CENTS : LIFETIME_PRICE_CENTS;
	if (price.unit_amount !== expectedCents) throw new Error(`${plan} Stripe Price must be ${expectedCents} cents`);
	if (plan === 'hosted') {
		if (price.type !== 'recurring' || price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1) {
			throw new Error(HOSTED_PRICE_RECURRING_ERROR);
		}
		return;
	}
	if (price.type !== 'one_time') throw new Error(LIFETIME_PRICE_ONE_TIME_ERROR);
}

/**
 * Allowance for one paid hosted renewal, decided by the Price the invoice
 * billed. An unknown Price throws: a renewal must never receive an allowance
 * the customer did not pay for, nor lose the one they did.
 */
export function hostedIncludedCreditsForPrice(priceId: string, prices: { current?: string; legacy?: string }): number {
	if (!prices.current) throw new Error('STRIPE_PRICE_HOSTED_MONTHLY is not configured; cannot grant a hosted allowance');
	if (priceId === prices.current) return HOSTED_INCLUDED_CREDITS;
	if (prices.legacy && priceId === prices.legacy) return LEGACY_HOSTED_INCLUDED_CREDITS;
	throw new Error(`invoice price ${priceId} is neither STRIPE_PRICE_HOSTED_MONTHLY nor STRIPE_PRICE_HOSTED_MONTHLY_LEGACY`);
}
