// Real-analyzer checks: run the commit hook against the real Codacy analyzer and
// expect a known-bad line to block a real commit. Run with `npm run test:real-analyzers`;
// `npm test` does not include them. They need the global @codacy/codacy-mcp install.
// Without it the gate blocks, and these checks fail: they never skip.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixtures = [];
const indexDirs = [];

function privateIndex() {
	const dir = mkdtempSync(join(tmpdir(), 'real-analyzer-idx-'));
	indexDirs.push(dir);
	const indexFile = join(dir, 'index');
	execFileSync('git', ['read-tree', 'HEAD'], { cwd: root, env: { ...process.env, GIT_INDEX_FILE: indexFile } });
	return indexFile;
}

/** Stages a fixture into the private index; the real index is untouched. */
function stageFixture(indexFile, rel, content) {
	fixtures.push(rel);
	writeFileSync(join(root, rel), content);
	execFileSync('git', ['add', rel], { cwd: root, env: { ...process.env, GIT_INDEX_FILE: indexFile } });
	return rel;
}

/** Runs the real commit hook over the staged fixture: sonarjs off, Codacy on, no pinned server. */
function commitWith(indexFile) {
	const env = { ...process.env, GIT_INDEX_FILE: indexFile, SONARJS_GATE_OFF: '1', CODACY_GATE_OFF: '0' };
	delete env.CODACY_MCP_SERVER;
	const result = spawnSync('bash', ['scripts/hooks/pre-commit'], { cwd: root, encoding: 'utf8', env });
	return { status: result.status, output: result.stdout + result.stderr };
}

after(() => {
	for (const rel of fixtures.splice(0)) rmSync(join(root, rel), { force: true });
	for (const dir of indexDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('biome config loads for clean TypeScript, CSS and JSON', () => {
	const fixtureDir = `test-support/biome-fixtures-${process.pid}`;
	after(() => rmSync(join(root, fixtureDir), { recursive: true, force: true }));

	/** Runs the gate's pre-commit path over one file; returns the runner's Biome status lines. */
	function biomeLinesFor(rel) {
		const env = { ...process.env };
		delete env.CODACY_MCP_SERVER;
		const result = spawnSync(process.execPath, ['scripts/codacy/pre-push-gate.mjs', '--hook=pre-commit', root, rel], { cwd: root, encoding: 'utf8', env });
		const lines = `${result.stdout}${result.stderr}`.split('\n');
		return {
			result,
			starting: lines.filter((line) => /^Starting analysis \(Biome,/.test(line)),
			complete: lines.filter((line) => /^Analysis complete \(Biome,/.test(line)),
		};
	}

	const cases = [
		['a clean TypeScript file', 'clean.ts', 'export const clean: number = 1;\n'],
		['a clean CSS file', 'clean.css', 'a {\n\tcolor: red;\n}\n'],
		['a clean package.json', 'package.json', '{\n\t"name": "biome-fixture",\n\t"private": true\n}\n'],
	];
	for (const [label, name, content] of cases) {
		test(`${label} gets 0 Biome errors`, () => {
			mkdirSync(join(root, fixtureDir), { recursive: true });
			const rel = `${fixtureDir}/${name}`;
			writeFileSync(join(root, rel), content);
			const { result, starting, complete } = biomeLinesFor(rel);
			assert.equal(starting.length, 1, result.stdout + result.stderr);
			assert.equal(complete.length, 1, result.stdout + result.stderr);
			assert.doesNotMatch(complete[0], /\d+ errors/, complete[0]);
		});
	}
});

describe('today\'s runner output parses', () => {
	test('a real gate run over a shell script, a Dockerfile and a module passes', () => {
		const env = { ...process.env };
		delete env.CODACY_MCP_SERVER;
		const files = ['install.sh', 'Dockerfile', 'scripts/codacy/pre-push-gate.mjs'];
		const result = spawnSync(process.execPath, ['scripts/codacy/pre-push-gate.mjs', '--hook=pre-commit', root, ...files], { cwd: root, encoding: 'utf8', env });
		assert.equal(result.status, 0, result.stdout + result.stderr);
		assert.match(result.stderr, /OK: no error-level Codacy findings/);
	});
});

describe('real analyzer blocks a known-bad line in a real commit', () => {
	test('a ShellCheck SC2115 line in a staged hook script blocks the commit', () => {
		const indexFile = privateIndex();
		const rel = stageFixture(indexFile, `scripts/hooks/shellcheck-fixture-${process.pid}.sh`, '#!/bin/bash\ndir="$1"\nrm -rf "$dir/"*\n');
		const result = commitWith(indexFile);
		assert.equal(result.status, 1, result.output);
		assert.match(result.output, /\[shellcheck\]/i);
		assert.ok(result.output.includes(rel), result.output);
	});

	test('a Hadolint warning in a staged Dockerfile blocks the commit', () => {
		const indexFile = privateIndex();
		const rel = stageFixture(indexFile, `scripts/hooks/hadolint-fixture-${process.pid}.Dockerfile`, 'FROM ubuntu:22.04\nRUN echo $HOME\n');
		const result = commitWith(indexFile);
		assert.equal(result.status, 1, result.output);
		assert.match(result.output, /\[hadolint\]/i);
		assert.ok(result.output.includes(rel), result.output);
	});

	test('a known-bad line appended to the pre-push body blocks the commit', () => {
		const indexFile = privateIndex();
		const body = readFileSync(join(root, 'scripts/hooks/pre-push.sh'), 'utf8');
		const rel = stageFixture(indexFile, `scripts/hooks/pre-push-fixture-${process.pid}.sh`, `${body}rm -rf "$dir/"*\n`);
		const result = commitWith(indexFile);
		assert.equal(result.status, 1, result.output);
		assert.match(result.output, /\[shellcheck\]/i);
		assert.ok(result.output.includes(rel), result.output);
	});
});
