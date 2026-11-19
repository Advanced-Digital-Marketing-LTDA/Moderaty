import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { variables } from '../../../env';
import { INCLUDED_CREDITS_METADATA_KEY } from './plans';

// An operator who sets only the variables a runbook lists would leave a Stripe
// Price unconfigured. A renewal on a Price without its allowance metadata is
// rejected with no credits granted, so the runbooks must name that metadata too.
const read = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const PRICE_VARIABLES = Object.keys(variables).filter((name) => name.startsWith('STRIPE_PRICE_'));

describe('Stripe Price variables are documented where operators set them', () => {
	it('finds the Price variables the app reads', () => {
		expect(PRICE_VARIABLES).toContain('STRIPE_PRICE_HOSTED_MONTHLY');
	});

	it('does not read a per-Price allowance from an environment variable', () => {
		expect(PRICE_VARIABLES).not.toContain('STRIPE_PRICE_HOSTED_MONTHLY_LEGACY');
	});

	it.each(['DEPLOY.md', 'docs/COOLIFY.md', 'docs/stripe-checkout-webhooks.md'])('%s tells operators to set the allowance on the Stripe Price', (path) => {
		expect(read(path)).toContain(INCLUDED_CREDITS_METADATA_KEY);
	});

	it.each(['DEPLOY.md', 'docs/COOLIFY.md', '.env.example'])('%s names every Stripe Price variable', (path) => {
		const text = read(path);
		const missing = PRICE_VARIABLES.filter((name) => !new RegExp(`\\b${name}\\b`).test(text));
		expect(missing, `${path} does not mention ${missing.join(', ')}`).toEqual([]);
	});
});
