import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { variables } from './env';

// SvelteKit 3 exposes through $env/dynamic/private only the names declared in
// src/env.ts, and an undeclared name reads as undefined with no error. This
// guard fails when source code reads a private name that is not declared, and
// when it reads the env in a way the scan cannot follow.
const srcDirectory = fileURLToPath(new URL('.', import.meta.url));
const ENV_MODULE = '$env/dynamic/private';
const UNSUPPORTED_ENV_MODULES = /\$env\/(?:static\/(?:private|public)|dynamic\/public)/;
// These files look names up at run time (env[name]); the names come from the string
// tables in PRICE_TABLES, which the scan reads as literals.
const COMPUTED_LOOKUP_FILES = ['lib/server/stripe/bundles.ts', 'lib/server/mercadopago/bundles.ts', 'lib/server/billing/checkout.ts'];
const PRICE_TABLES = ['lib/server/stripe/bundles.ts', 'lib/server/mercadopago/bundles.ts', 'lib/server/billing/plans.ts'];

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { recursive: true, encoding: 'utf8' })
		.filter((path) => /\.(ts|js|svelte)$/.test(path) && !/\.test\.(ts|js)$/.test(path) && !path.endsWith('.d.ts'))
		.map((path) => join(directory, path));
}

// `env` itself, `import { env as x }`, and `const x = env` (not `const x = env.Y`).
function envIdentifiers(text: string): string[] {
	const identifiers = new Set(['env']);
	for (const match of text.matchAll(/\benv\s+as\s+(\w+)/g)) identifiers.add(match[1]);
	for (const match of text.matchAll(/\b(?:const|let|var)\s+(\w+)\s*=\s*env\b(?!\s*[.[])/g)) identifiers.add(match[1]);
	return [...identifiers];
}

function namesRead(text: string, identifier: string): { names: string[]; computed: boolean } {
	const names: string[] = [];
	const own = `(?<![.\\w])${identifier}`;
	for (const match of text.matchAll(new RegExp(`${own}\\.([A-Z][A-Z0-9_]*)`, 'g'))) names.push(match[1]);
	for (const match of text.matchAll(new RegExp(`${own}\\[\\s*['"]([A-Z][A-Z0-9_]*)['"]\\s*\\]`, 'g'))) names.push(match[1]);
	for (const match of text.matchAll(new RegExp(`\\{([^}]*)\\}\\s*=\\s*${identifier}\\b`, 'g'))) {
		for (const part of match[1].split(',')) {
			const name = part.trim().split(/[:=\s]/)[0];
			if (/^[A-Z][A-Z0-9_]*$/.test(name)) names.push(name);
		}
	}
	return { names, computed: new RegExp(`${own}\\[\\s*(?!['"])`).test(text) };
}

type FileScan = { names: string[]; problems: string[] };

function envModuleScan(file: string, text: string): FileScan {
	const result: FileScan = { names: [], problems: [] };
	if (!text.includes(ENV_MODULE)) return result;
	for (const identifier of envIdentifiers(text)) {
		const { names, computed } = namesRead(text, identifier);
		result.names.push(...names);
		if (computed && !COMPUTED_LOOKUP_FILES.includes(file)) {
			result.problems.push(`${file}: computed env lookup; list the file in COMPUTED_LOOKUP_FILES and its names in a price table`);
		}
	}
	return result;
}

function priceTableNames(file: string, text: string): string[] {
	if (!PRICE_TABLES.includes(file)) return [];
	return [...text.matchAll(/'((?:STRIPE|MERCADOPAGO)_PRICE_[A-Z0-9_]+)'/g)].map((match) => match[1]);
}

function scanFile(file: string, text: string): FileScan {
	const fromModule = envModuleScan(file, text);
	const unsupported = UNSUPPORTED_ENV_MODULES.test(text) ? [`${file}: imports an env module this guard does not scan`] : [];
	return { names: [...fromModule.names, ...priceTableNames(file, text)], problems: [...unsupported, ...fromModule.problems] };
}

function scan(): { uses: Map<string, Set<string>>; problems: string[] } {
	const uses = new Map<string, Set<string>>();
	const problems: string[] = [];
	for (const absolute of sourceFiles(srcDirectory)) {
		const file = relative(srcDirectory, absolute);
		const result = scanFile(file, readFileSync(absolute, 'utf8'));
		problems.push(...result.problems);
		for (const name of result.names) uses.set(name, (uses.get(name) ?? new Set<string>()).add(file));
	}
	return { uses, problems };
}

describe('src/env.ts declarations', () => {
	const { uses, problems } = scan();

	it('declares every private env name the source reads', () => {
		const declared = new Set(Object.keys(variables));
		const missing = [...uses]
			.filter(([name]) => !declared.has(name))
			.map(([name, files]) => `${name} (read in ${[...files].join(', ')})`);
		expect(missing).toEqual([]);
	});

	it('reads the env only in ways the scan can follow', () => {
		expect(problems).toEqual([]);
	});

	it('finds the names it guards, so an empty scan cannot pass', () => {
		// Direct reads, the dynamic price tables, the plan prices, and an aliased read
		// (operationalEvents.ts reads these two through `const identity = env`).
		for (const name of ['TURSO_DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_PRICE_CREDITS_100', 'MERCADOPAGO_PRICE_CREDITS_2000_BRL_CENTS', 'STRIPE_PRICE_LIFETIME', 'MODERATY_ENVIRONMENT', 'MODERATY_RELEASE']) {
			expect(uses.has(name), name).toBe(true);
		}
		expect(uses.size).toBeGreaterThanOrEqual(40);
	});
});
