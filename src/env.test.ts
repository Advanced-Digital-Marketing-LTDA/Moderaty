import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { variables } from './env';

// SvelteKit 3 exposes through $env/dynamic/private only the names declared in
// src/env.ts, and an undeclared name reads as undefined with no error. This
// guard fails when source code reads a private name that is not declared.
const srcDirectory = fileURLToPath(new URL('.', import.meta.url));
const PRIVATE_ENV_MODULE = '$env/dynamic/private';
// These tables name their env variables as string values read through env[name].
const PRICE_TABLES = ['lib/server/stripe/bundles.ts', 'lib/server/mercadopago/bundles.ts', 'lib/server/billing/plans.ts'];

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { recursive: true, encoding: 'utf8' })
		.filter((path) => /\.(ts|js|svelte)$/.test(path) && !/\.test\.(ts|js)$/.test(path) && !path.endsWith('.d.ts'))
		.map((path) => join(directory, path));
}

function addUse(uses: Map<string, Set<string>>, name: string, file: string): void {
	const files = uses.get(name) ?? new Set<string>();
	files.add(relative(srcDirectory, file));
	uses.set(name, files);
}

function privateEnvUses(): Map<string, Set<string>> {
	const uses = new Map<string, Set<string>>();
	for (const file of sourceFiles(srcDirectory)) {
		const text = readFileSync(file, 'utf8');
		if (text.includes(PRIVATE_ENV_MODULE)) {
			for (const match of text.matchAll(/(?<!process\.)\benv\.([A-Z][A-Z0-9_]*)/g)) addUse(uses, match[1], file);
		}
		if (PRICE_TABLES.some((table) => file === join(srcDirectory, table))) {
			for (const match of text.matchAll(/'((?:STRIPE|MERCADOPAGO)_PRICE_[A-Z0-9_]+)'/g)) addUse(uses, match[1], file);
		}
	}
	return uses;
}

describe('src/env.ts declarations', () => {
	const uses = privateEnvUses();

	it('declares every private env name the source reads', () => {
		const declared = new Set(Object.keys(variables));
		const missing = [...uses]
			.filter(([name]) => !declared.has(name))
			.map(([name, files]) => `${name} (read in ${[...files].join(', ')})`);
		expect(missing).toEqual([]);
	});

	it('finds the names it guards, so an empty scan cannot pass', () => {
		// Direct reads, the dynamic Stripe/Mercado Pago price tables, and the plan prices.
		for (const name of ['TURSO_DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_PRICE_CREDITS_100', 'MERCADOPAGO_PRICE_CREDITS_2000_BRL_CENTS', 'STRIPE_PRICE_LIFETIME']) {
			expect(uses.has(name), name).toBe(true);
		}
		expect(uses.size).toBeGreaterThanOrEqual(40);
	});
});
