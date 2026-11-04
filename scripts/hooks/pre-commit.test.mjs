import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

const root = new URL('../..', import.meta.url);
const rootPath = fileURLToPath(root);
const tempDirs = [];
const fixtureFiles = [];

/** A private git index seeded with HEAD, so `git diff --cached` is hermetic. */
function privateIndex() {
	const dir = mkdtempSync(join(tmpdir(), 'pre-commit-idx-'));
	tempDirs.push(dir);
	const indexFile = join(dir, 'index');
	execFileSync('git', ['read-tree', 'HEAD'], {
		cwd: root,
		env: { ...process.env, GIT_INDEX_FILE: indexFile }
	});
	return indexFile;
}

function runHook(env) {
	return spawnSync('bash', ['scripts/hooks/pre-commit'], {
		cwd: root,
		encoding: 'utf8',
		env: { ...process.env, ...env }
	});
}

/** Stage a fixture file into the private index (the real index is untouched). */
function stageViolatingFile(indexFile, content = 'export const same = 1 === 1;\n') {
	const rel = `scripts/pre-commit-fixture-${process.pid}.mjs`;
	fixtureFiles.push(rel);
	writeFileSync(join(rootPath, rel), content);
	execFileSync('git', ['add', rel], {
		cwd: root,
		env: { ...process.env, GIT_INDEX_FILE: indexFile }
	});
	return rel;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	for (const rel of fixtureFiles.splice(0)) rmSync(join(rootPath, rel), { force: true });
});

describe('scripts/hooks/pre-commit', () => {
	test('nothing staged exits cleanly under set -u', () => {
		const result = runHook({ GIT_INDEX_FILE: privateIndex(), SONARJS_GATE_OFF: '0', CODACY_GATE_OFF: '0' });
		expect(result.status).toBe(0);
		expect(result.stderr).not.toContain('unbound variable');
		expect(result.stdout).toBe('');
	});

	test('a staged sonarjs violation blocks the commit', () => {
		const indexFile = privateIndex();
		stageViolatingFile(indexFile);
		// Codacy disabled: this test exercises only the sonarjs gate.
		const result = runHook({ GIT_INDEX_FILE: indexFile, SONARJS_GATE_OFF: '0', CODACY_GATE_OFF: '1' });
		const output = result.stdout + result.stderr;
		expect(result.status).toBe(1);
		expect(output).toContain('sonarjs/no-identical-expressions');
		expect(output).toContain('[sonarjs] commit blocked');
	});

	test('a staged clean file passes the sonarjs gate', () => {
		const indexFile = privateIndex();
		stageViolatingFile(indexFile, 'export const one = 1;\n');
		const result = runHook({ GIT_INDEX_FILE: indexFile, SONARJS_GATE_OFF: '0', CODACY_GATE_OFF: '1' });
		expect(result.stderr).not.toContain('unbound variable');
		expect(result.status).toBe(0);
	});

	test('SONARJS_GATE_OFF=1 skips the sonarjs gate', () => {
		const indexFile = privateIndex();
		stageViolatingFile(indexFile);
		const result = runHook({ GIT_INDEX_FILE: indexFile, SONARJS_GATE_OFF: '1', CODACY_GATE_OFF: '1' });
		expect(result.status).toBe(0);
		expect(result.stdout).not.toContain('sonarjs/');
	});
});
