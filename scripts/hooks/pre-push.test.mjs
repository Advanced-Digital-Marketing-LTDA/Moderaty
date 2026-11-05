import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { HOOK_TOOLS } from '../codacy/pre-push-gate.mjs';
import * as fakeHook from '../../test-support/hook-repo.mjs';

const root = new URL('../..', import.meta.url);
const rootPath = fileURLToPath(root);

afterEach(() => {
	fakeHook.cleanupHookRepos();
});

function runPrePush(cwd, input) {
	return spawnSync('bash', ['scripts/hooks/pre-push'], {
		cwd,
		input,
		encoding: 'utf8',
		env: { ...process.env, CODACY_GATE_OFF: '0' }
	});
}

const blockingFinding = (filePath) => JSON.stringify({
	success: true,
	result: [{ level: 'error', filePath, tool: 'Biome', rule: { id: 'rule-x' }, message: 'bad' }],
});

test('an empty push diff exits cleanly under set -u', () => {
	const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	const input = `refs/heads/dev ${head} refs/heads/dev ${head}\n`;
	const result = runPrePush(rootPath, input);
	expect(result.status).toBe(0);
	expect(result.stderr).not.toContain('unbound variable');
	expect(result.stdout).toBe('');
});

test('a diff that cannot be listed blocks the push (fail closed)', () => {
	const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
	const missingBase = '1111111111111111111111111111111111111111';
	const input = `refs/heads/dev ${head} refs/heads/dev ${missingBase}\n`;
	const result = runPrePush(rootPath, input);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain('cannot list changed files');
});

test('a root-commit push analyzes its code files against the empty tree', () => {
	const repo = fakeHook.makeHookRepo('pre-push');
	fakeHook.stageFile(repo.dir, 'src/a.ts');
	const head = fakeHook.commitAll(repo.dir);
	const input = `refs/heads/main ${head} refs/heads/main ${fakeHook.ZERO_SHA}\n`;
	const result = fakeHook.runHook(repo.dir, 'pre-push', { ...repo, stdin: input, env: { FAKE_PAYLOAD: blockingFinding('src/a.ts') } });
	expect(result.status).toBe(1);
	expect(result.stderr).toContain('src/a.ts');
	expect(result.stderr).not.toContain('cannot list changed files');
});

test('pre-push runs every push tool, trivy included', () => {
	const repo = fakeHook.makeHookRepo('pre-push');
	fakeHook.stageFile(repo.dir, 'src/a.ts');
	const head = fakeHook.commitAll(repo.dir);
	const input = `refs/heads/main ${head} refs/heads/main ${fakeHook.ZERO_SHA}\n`;
	const result = fakeHook.runHook(repo.dir, 'pre-push', { ...repo, stdin: input });
	expect(result.status).toBe(0);
	const tools = new Set(fakeHook.readCalls(repo.callLog).map((call) => call.tool));
	expect(tools).toEqual(new Set(HOOK_TOOLS['pre-push']));
});

test('a file that differs from the pushed commit blocks the push and is named', () => {
	const repo = fakeHook.makeHookRepo('pre-push');
	fakeHook.stageFile(repo.dir, 'src/a.ts', 'export const v = 1;\n');
	const head = fakeHook.commitAll(repo.dir);
	writeFileSync(join(repo.dir, 'src/a.ts'), 'export const v = 2;\n');
	const input = `refs/heads/main ${head} refs/heads/main ${fakeHook.ZERO_SHA}\n`;
	const result = fakeHook.runHook(repo.dir, 'pre-push', { ...repo, stdin: input });
	expect(result.status).toBe(1);
	expect(result.stderr).toContain('src/a.ts');
	expect(result.stderr).toContain('git stash --keep-index');
	expect(fakeHook.readCalls(repo.callLog)).toEqual([]);
});

test('a non-ASCII file name is analyzed on push, not dropped by git quoting', () => {
	const repo = fakeHook.makeHookRepo('pre-push');
	fakeHook.stageFile(repo.dir, 'src/café.ts');
	const head = fakeHook.commitAll(repo.dir);
	const input = `refs/heads/main ${head} refs/heads/main ${fakeHook.ZERO_SHA}\n`;
	fakeHook.runHook(repo.dir, 'pre-push', { ...repo, stdin: input });
	const files = fakeHook.readCalls(repo.callLog).map((call) => call.file);
	expect(files).toContain(join(repo.dir, 'src/café.ts'));
});
