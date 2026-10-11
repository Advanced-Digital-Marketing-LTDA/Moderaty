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

// Read a file at a revision. Absent is benign (the config source does not
// exist there); every other git failure propagates loudly — a corrupt or
// unreadable base must never masquerade as an empty policy.
function readAtRevision(cwd, revision, name) {
	const listed = git(cwd, 'ls-tree', '--name-only', revision, '--', name);
	if (listed !== name) return undefined;
	return execFileSync('/usr/bin/git', ['show', `${revision}:${name}`], {
		cwd,
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024
	});
}

// Resolve the effective config a revision presents, using the pinned tool's own
// loader so precedence and validation cannot drift from what the CLI applies.
export function effectiveConfigAtRevision(loadConfig, cwd, revision) {
	if (!revision) return loadConfig(cwd);
	const root = mkdtempSync(resolve(tmpdir(), 'testtrust-base-config-'));
	try {
		for (const name of CONFIG_SOURCES) {
			const text = readAtRevision(cwd, revision, name);
			if (text !== undefined) writeFileSync(resolve(root, name), text);
		}
		return loadConfig(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

const REJECTION_HEADER =
	'::error::TestTrust policy check failed: the PR changes the effective TestTrust configuration.';
const REJECTION_GUIDANCE =
	'::error::The integrity gate only runs under the policy the base revision shipped. ' +
	'Remove .testtrustrc/.testtrustrc.json/package.json "testtrust" changes from this diff.';

// Canonicalize for comparison: serialize with sorted keys so key order in a
// hand-written config file cannot produce a false delta.
function canon(value) {
	if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.keys(value)
			.sort((a, b) => a.localeCompare(b))
			.map((key) => `${JSON.stringify(key)}:${canon(value[key])}`);
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(value);
}

function requireInputs() {
	const cwd = arg('cwd') ?? process.cwd();
	const base = arg('base', process.env.TESTTRUST_BASE_SHA);
	const cli = arg('cli', process.env.TESTTRUST_CLI);
	if (!base) throw new Error('TestTrust policy check requires --base <sha> or TESTTRUST_BASE_SHA');
	if (!/^[0-9a-f]{40}$/.test(base)) throw new Error(`TestTrust policy check got a malformed base SHA: ${base}`);
	try {
		execFileSync('/usr/bin/git', ['cat-file', '-e', base + '^{commit}'], { cwd, stdio: 'ignore' });
	} catch {
		throw new Error(`TestTrust policy check cannot read base commit ${base}; refusing to gate on an unverifiable policy`);
	}
	if (!cli?.endsWith('/dist/cli.js')) {
		throw new Error('TestTrust policy check requires --cli or TESTTRUST_CLI pointing at the pinned dist/cli.js');
	}
	return { cwd, base, cli };
}

function rejectPolicyDelta(candidate, trusted) {
	const lines = [
		REJECTION_HEADER,
		`::error::candidate config: ${candidate}`,
		`::error::base config:      ${trusted}`,
		REJECTION_GUIDANCE
	];
	for (const line of lines) console.error(line);
	process.exitCode = 1;
}

async function main() {
	const { cwd, base, cli } = requireInputs();
	const { loadConfig } = await import(pathToFileURL(resolve(dirname(cli), 'core', 'config.js')).href);
	if (typeof loadConfig !== 'function') {
		throw new TypeError('Pinned TestTrust build does not export loadConfig; refusing to gate on an unverifiable policy');
	}
	const candidate = canon(effectiveConfigAtRevision(loadConfig, cwd));
	const trusted = canon(effectiveConfigAtRevision(loadConfig, cwd, base));
	if (candidate !== trusted) {
		rejectPolicyDelta(candidate, trusted);
		return;
	}
	console.info(`testtrust policy: candidate config matches base revision (${trusted})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		await main();
	} catch (error) {
		console.error(`::error::${error.message}`);
		process.exitCode = 1;
	}
}
