import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { variables } from '../../../env';

// An operator who sets only the variables a runbook lists would leave a Stripe
// Price unconfigured, and a renewal on it is rejected with no credits granted.
const read = (path: string) => readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const PRICE_VARIABLES = Object.keys(variables).filter((name) => name.startsWith('STRIPE_PRICE_'));

describe('Stripe Price variables are documented where operators set them', () => {
	it('finds the Price variables the app reads', () => {
		expect(PRICE_VARIABLES).toContain('STRIPE_PRICE_HOSTED_MONTHLY');
		expect(PRICE_VARIABLES).toContain('STRIPE_PRICE_HOSTED_MONTHLY_LEGACY');
	});

	it.each(['DEPLOY.md', 'docs/COOLIFY.md', '.env.example'])('%s names every Stripe Price variable', (path) => {
		const text = read(path);
		const missing = PRICE_VARIABLES.filter((name) => !new RegExp(`\\b${name}\\b`).test(text));
		expect(missing, `${path} does not mention ${missing.join(', ')}`).toEqual([]);
	});
});
