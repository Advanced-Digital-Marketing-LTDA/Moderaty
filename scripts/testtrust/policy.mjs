// TestTrust policy enforcement for the PR gate.
//
// The pinned action runs inside the candidate checkout, where the CLI resolves
// .testtrustrc.json, .testtrustrc, or the package.json "testtrust" key. Config
// `disable` entries are merged into the CLI's disable list and cannot be
// re-enabled by any flag, so a PR could switch detectors off while weakening
// tests and still emit passing evidence. This check rejects that: the
// effective config resolved by the tool's own loader must be identical at the
// candidate HEAD and at the trusted base revision, so the gate only ever runs
// under the policy the base shipped. A PR that adds or edits TestTrust config
// fails here before the gate runs.
//
// Usage: node scripts/testtrust/policy.mjs --cwd <dir> --base <sha> --cli <path-to-dist/cli.js>

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CONFIG_SOURCES = ['.testtrustrc.json', '.testtrustrc', 'package.json'];

function arg(name, env) {
	const flag = process.argv.indexOf(`--${name}`);
	if (flag !== -1) {
		const value = process.argv[flag + 1];
		if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value`);
		return value;
	}
	if (env) return env;
	return undefined;
}

const git = (cwd, ...args) =>
	execFileSync('/usr/bin/git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

function gitShow(cwd, spec) {
	try {
		return execFileSync('/usr/bin/git', ['show', spec], {
			cwd,
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'ignore']
		});
	} catch {
		return undefined;
	}
}

// Resolve the effective config a revision presents, using the pinned tool's own
// loader so precedence and validation cannot drift from what the CLI applies.
export function effectiveConfigAtRevision(loadConfig, cwd, revision) {
	if (!revision) return loadConfig(cwd);
	const root = mkdtempSync(resolve(tmpdir(), 'testtrust-base-config-'));
	try {
		for (const name of CONFIG_SOURCES) {
			const text = gitShow(cwd, `${revision}:${name}`);
			if (text !== undefined) writeFileSync(resolve(root, name), text);
		}
		return loadConfig(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

// Canonicalize for comparison: object key order in a hand-written config file
// must not produce a false delta.
function canon(value) {
	if (Array.isArray(value)) return value.map(canon);
	if (value && typeof value === 'object') {
		return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canon(value[k])]));
	}
	return value;
}

async function main() {
	const cwd = arg('cwd') ?? process.cwd();
	const base = arg('base', process.env.TESTTRUST_BASE_SHA);
	const cli = arg('cli', process.env.TESTTRUST_CLI);
	if (!base) throw new Error('TestTrust policy check requires --base <sha> or TESTTRUST_BASE_SHA');
	if (!/^[0-9a-f]{40}$/.test(base)) throw new Error(`TestTrust policy check got a malformed base SHA: ${base}`);
	try {
		execFileSync('/usr/bin/git', ['cat-file', '-e', `${base}^{commit}`], { cwd, stdio: 'ignore' });
	} catch {
		throw new Error(`TestTrust policy check cannot read base commit ${base}; refusing to gate on an unverifiable policy`);
	}
	if (!cli || !cli.endsWith('/dist/cli.js')) {
		throw new Error('TestTrust policy check requires --cli or TESTTRUST_CLI pointing at the pinned dist/cli.js');
	}

	const { loadConfig } = await import(pathToFileURL(resolve(dirname(cli), 'core', 'config.js')).href);
	if (typeof loadConfig !== 'function') {
		throw new Error('Pinned TestTrust build does not export loadConfig; refusing to gate on an unverifiable policy');
	}

	const candidate = effectiveConfigAtRevision(loadConfig, cwd);
	const trusted = effectiveConfigAtRevision(loadConfig, cwd, base);
	if (JSON.stringify(canon(candidate)) !== JSON.stringify(canon(trusted))) {
		console.error('::error::TestTrust policy check failed: the PR changes the effective TestTrust configuration.');
		console.error(`::error::candidate config: ${JSON.stringify(candidate)}`);
		console.error(`::error::base config:      ${JSON.stringify(trusted)}`);
		console.error('::error::The integrity gate only runs under the policy the base revision shipped. Remove .testtrustrc/.testtrustrc.json/package.json "testtrust" changes from this diff.');
		process.exitCode = 1;
		return;
	}
	console.info(`testtrust policy: candidate config matches base revision (${JSON.stringify(trusted)})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		await main();
	} catch (error) {
		console.error(`::error::${error.message}`);
		process.exitCode = 1;
	}
}
