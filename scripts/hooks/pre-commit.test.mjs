import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { HOOK_TOOLS } from '../codacy/pre-push-gate.mjs';
import * as fakeHook from '../../test-support/hook-repo.mjs';

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

/** Like stageViolatingFile, but for an arbitrary repo-relative path. */
function stageFixture(indexFile, rel, content) {
	fixtureFiles.push(rel);
	writeFileSync(join(rootPath, rel), content);
	execFileSync('git', ['add', rel], {
		cwd: root,
		env: { ...process.env, GIT_INDEX_FILE: indexFile }
	});
	return rel;
}

function runHookIn(dir, env) {
	return spawnSync('bash', ['scripts/hooks/pre-commit'], {
		cwd: dir,
		encoding: 'utf8',
		env: { ...process.env, ...env }
	});
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	for (const rel of fixtureFiles.splice(0)) rmSync(join(rootPath, rel), { force: true });
	fakeHook.cleanupHookRepos();
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

	test('a missing eslint blocks the commit (fail closed)', () => {
		const repo = fakeHook.makeHookRepo('pre-commit');
		fakeHook.stageFile(repo.dir, 'a.mjs');
		const result = runHookIn(repo.dir, { SONARJS_GATE_OFF: '0', CODACY_GATE_OFF: '1' });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('eslint is not installed');
	});

	test('an eslint tooling failure (exit 2) blocks the commit (fail closed)', () => {
		const repo = fakeHook.makeHookRepo('pre-commit');
		fakeHook.stageFile(repo.dir, 'a.mjs');
		const eslintBin = join(repo.dir, 'node_modules', 'eslint', 'bin');
		mkdirSync(eslintBin, { recursive: true });
		writeFileSync(join(eslintBin, 'eslint.js'), '#!/usr/bin/env node\nprocess.exit(2);\n');
		const result = runHookIn(repo.dir, { SONARJS_GATE_OFF: '0', CODACY_GATE_OFF: '1' });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('eslint tooling failed (exit 2)');
	});
});

describe('scripts/hooks/pre-commit runs Codacy per hook (fake server)', () => {
	test('the commit tools run and trivy never does', () => {
		const repo = fakeHook.makeHookRepo('pre-commit');
		fakeHook.stageFile(repo.dir, 'src/a.ts');
		const result = fakeHook.runHook(repo.dir, 'pre-commit', repo);
		expect(result.status).toBe(0);
		const tools = new Set(fakeHook.readCalls(repo.callLog).map((call) => call.tool));
		expect(tools).toEqual(new Set(HOOK_TOOLS['pre-commit']));
		expect(tools.has('trivy')).toBe(false);
	});

	test('Dockerfiles and hook scripts are analyzed; other staged files are not', () => {
		const repo = fakeHook.makeHookRepo('pre-commit');
		fakeHook.stageFile(repo.dir, 'Dockerfile', 'FROM node:24\n');
		fakeHook.stageFile(repo.dir, 'scripts/hooks/example.sh', '#!/bin/sh\necho hi\n');
		fakeHook.stageFile(repo.dir, 'README.md', '# readme\n');
		fakeHook.runHook(repo.dir, 'pre-commit', repo);
		const files = new Set(fakeHook.readCalls(repo.callLog).map((call) => call.file));
		expect(files).toEqual(new Set([join(repo.dir, 'Dockerfile'), join(repo.dir, 'scripts/hooks/example.sh')]));
	});

	test('a commit with nothing in scope runs no analysis', () => {
		const repo = fakeHook.makeHookRepo('pre-commit');
		fakeHook.stageFile(repo.dir, 'README.md', '# readme\n');
		const result = fakeHook.runHook(repo.dir, 'pre-commit', repo);
		expect(result.status).toBe(0);
		expect(fakeHook.readCalls(repo.callLog)).toEqual([]);
	});
});

describe('scripts/hooks/pre-commit fails closed on unlistable paths and keeps non-ASCII names', () => {
	test('an unreadable index blocks the commit', () => {
		const dir = mkdtempSync(join(tmpdir(), 'pre-commit-badindex-'));
		tempDirs.push(dir);
		const badIndex = join(dir, 'index');
		writeFileSync(badIndex, 'not a git index\n');
		const result = runHook({ GIT_INDEX_FILE: badIndex, SONARJS_GATE_OFF: '1', CODACY_GATE_OFF: '1' });
		expect(result.status).toBe(1);
		expect(result.stderr).toContain('cannot list staged files');
	});

	test('a staged file with a non-ASCII name is analyzed', () => {
		const repo = fakeHook.makeHookRepo('pre-commit');
		fakeHook.stageFile(repo.dir, 'src/café.ts');
		fakeHook.runHook(repo.dir, 'pre-commit', repo);
		const files = fakeHook.readCalls(repo.callLog).map((call) => call.file);
		expect(files).toContain(join(repo.dir, 'src/café.ts'));
	});
});

describe('scripts/hooks/pre-commit blocks a known-bad line (real analyzer)', () => {
	test('a ShellCheck SC2115 line in a staged hook script blocks the commit', () => {
		const indexFile = privateIndex();
		const rel = stageFixture(indexFile, `scripts/hooks/pre-commit-fixture-${process.pid}.sh`, '#!/bin/bash\ndir="$1"\nrm -rf "$dir/"*\n');
		const env = { ...process.env, GIT_INDEX_FILE: indexFile, SONARJS_GATE_OFF: '1', CODACY_GATE_OFF: '0' };
		delete env.CODACY_MCP_SERVER;
		const result = spawnSync('bash', ['scripts/hooks/pre-commit'], { cwd: root, encoding: 'utf8', env });
		const output = result.stdout + result.stderr;
		expect(result.status).toBe(1);
		expect(output).toContain('[shellcheck]');
		expect(output).toContain(rel);
		expect(output).toContain('[codacy] commit blocked');
	}, 120000);
});
