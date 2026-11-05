import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFakeServer } from '../scripts/codacy/fake-mcp-server.mjs';
import { writeCodacyConfig } from './codacy-config.mjs';

// Test support for hook tests: a scratch git repo with a hook, the shared scope
// helper and the Codacy gate copied in, and a fake MCP server whose calls are
// logged, so tests can see exactly which tools and files a hook asked for.

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const scratchDirs = [];

export const ZERO_SHA = '0000000000000000000000000000000000000000';

export function makeHookRepo(hook) {
	const dir = mkdtempSync(join(tmpdir(), `hook-repo-${hook}-`));
	scratchDirs.push(dir);
	execFileSync('git', ['init', '-q'], { cwd: dir });
	for (const rel of [`scripts/hooks/${hook}`, `scripts/hooks/${hook}.sh`, 'scripts/hooks/analysis-scope.sh', 'scripts/codacy/pre-push-gate.mjs', 'scripts/codacy/runner-contract.mjs']) {
		mkdirSync(dirname(join(dir, rel)), { recursive: true });
		copyFileSync(join(repoRoot, rel), join(dir, rel));
	}
	writeCodacyConfig(dir);
	const fakeServer = writeFakeServer(dir);
	return { dir, fakeServer, callLog: join(dir, 'calls.jsonl') };
}

export function stageFile(dir, rel, content = 'export const one = 1;\n') {
	mkdirSync(dirname(join(dir, rel)), { recursive: true });
	writeFileSync(join(dir, rel), content);
	execFileSync('git', ['add', rel], { cwd: dir });
}

export function commitAll(dir) {
	execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'fixture'], { cwd: dir });
	return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
}

/** Runs a hook in `dir` against the fake server; `stdin` is the pre-push ref list. */
export function runHook(dir, hook, { fakeServer, callLog, stdin = '', env = {} }) {
	return spawnSync('bash', [`scripts/hooks/${hook}`], {
		cwd: dir,
		input: stdin,
		encoding: 'utf8',
		env: {
			...process.env,
			SONARJS_GATE_OFF: '1',
			CODACY_GATE_OFF: '0',
			CODACY_MCP_SERVER: fakeServer,
			FAKE_LOG: callLog,
			FAKE_PAYLOAD: JSON.stringify({ success: true, result: [] }),
			...env,
		},
	});
}

/** The codacy_cli_analyze arguments the fake server received, in order. */
export function readCalls(callLog) {
	if (!existsSync(callLog)) return [];
	return readFileSync(callLog, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

export function cleanupHookRepos() {
	for (const dir of scratchDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
}
