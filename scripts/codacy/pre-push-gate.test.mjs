import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { writeCodacyConfig } from '../../test-support/codacy-config.mjs';
import { writeFakeServer } from './fake-mcp-server.mjs';
import {
	HOOK_TOOLS,
	PER_FILE_SCOPE_LIMIT,
	analysisScope,
	backupCodacyConfig,
	candidateHomes,
	main,
	npmPrefix,
	resolveServerBin,
} from './pre-push-gate.mjs';

const tempDirs = [];

function tempDir(prefix = 'codacy-gate-') {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function tempHome() {
	return tempDir('codacy-gate-home-');
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('npmPrefix — no npm subprocess, no PATH resolution (S4036)', () => {
	test('prefers NPM_CONFIG_PREFIX', () => {
		expect(npmPrefix({ NPM_CONFIG_PREFIX: '/env/prefix' }, tempHome(), '/bin/node', 'linux')).toBe('/env/prefix');
	});

	test('accepts the lowercase npm_config_prefix form npm sets', () => {
		expect(npmPrefix({ npm_config_prefix: '/lower/prefix' }, tempHome(), '/bin/node', 'linux')).toBe('/lower/prefix');
	});

	test('reads prefix from ~/.npmrc', () => {
		const home = tempHome();
		writeFileSync(join(home, '.npmrc'), 'registry=https://example.com\nprefix=/npmrc/prefix\n');
		expect(npmPrefix({}, home, '/bin/node', 'linux')).toBe('/npmrc/prefix');
	});

	test('derives the prefix from the node installation layout when no config exists', () => {
		expect(npmPrefix({}, tempHome(), '/opt/node/bin/node', 'linux')).toBe('/opt/node');
	});
});


describe('resolveServerBin — host-npm fallback (distrobox homes)', () => {
	// Each candidate home gets an .npmrc whose prefix points at itself; the
	// "installed" marker is <home>/npm/bin/codacy-mcp-server.
	function homeWithInstall() {
		const home = tempHome();
		writeFileSync(join(home, '.npmrc'), `prefix=${join(home, 'npm')}\n`);
		mkdirSync(join(home, 'npm', 'bin'), { recursive: true });
		writeFileSync(join(home, 'npm', 'bin', 'codacy-mcp-server'), '#!/bin/sh\n');
		return home;
	}

	test('finds the server under the passwd home when $HOME has no install', () => {
		const missing = tempHome(); // no .npmrc, no install
		const installed = homeWithInstall();
		expect(resolveServerBin([missing, installed], {}))
			.toBe(join(installed, 'npm', 'bin', 'codacy-mcp-server'));
	});

	test('prefers the earlier home when both have installs', () => {
		const first = homeWithInstall();
		const second = homeWithInstall();
		expect(resolveServerBin([first, second], {}))
			.toBe(join(first, 'npm', 'bin', 'codacy-mcp-server'));
	});

	test('returns undefined when no candidate home has the server', () => {
		expect(resolveServerBin([tempHome(), tempHome()], {})).toBeUndefined();
	});

	test('honours the CODACY_MCP_SERVER env pin before any home', () => {
		const dir = tempHome();
		const bin = join(dir, 'codacy-mcp-server');
		writeFileSync(bin, '#!/bin/sh\n');
		expect(resolveServerBin([homeWithInstall()], { CODACY_MCP_SERVER: bin })).toBe(bin);
	});

	test('falls back to a PATH scan when no home resolves an install', () => {
		const binDir = tempDir('codacy-gate-path-');
		const bin = join(binDir, 'codacy-mcp-server');
		writeFileSync(bin, '#!/bin/sh\n');
		expect(resolveServerBin([tempHome()], { PATH: `${binDir}${delimiter}/usr/bin` })).toBe(bin);
	});
});

describe('candidateHomes', () => {
	test('dedupes when $HOME and the passwd home agree', () => {
		expect(candidateHomes('/same/home', '/same/home')).toEqual(['/same/home']);
	});
	test('keeps both homes when they diverge, $HOME first', () => {
		expect(candidateHomes('/home/box', '/home/host')).toEqual(['/home/box', '/home/host']);
	});
	test('drops a missing passwd home', () => {
		expect(candidateHomes('/home/box', null)).toEqual(['/home/box']);
	});
});

describe('backupCodacyConfig', () => {
	test('restores committed files and removes files the runner generated', () => {
		const root = tempDir('codacy-gate-root-');
		const codacyDir = join(root, '.codacy');
		mkdirSync(codacyDir, { recursive: true });
		// committed before the run:
		writeFileSync(join(codacyDir, 'codacy.config.json'), '{"committed":true}');

		const restore = backupCodacyConfig(root);
		// the runner regenerates the committed file and creates a NEW one:
		writeFileSync(join(codacyDir, 'codacy.config.json'), '{"regenerated":true}');
		writeFileSync(join(codacyDir, 'configure-codacy-summary.json'), '{"generated":true}');

		restore();

		// committed file restored, generated file removed, nothing else created:
		expect(readFileSync(join(codacyDir, 'codacy.config.json'), 'utf8')).toBe('{"committed":true}');
		expect(existsSync(join(codacyDir, 'configure-codacy-summary.json'))).toBe(false);
	});

	test('a failed restore is reported loudly and keeps the backup copy', () => {
		const root = tempDir('codacy-gate-root-');
		const codacyDir = join(root, '.codacy');
		mkdirSync(codacyDir, { recursive: true });
		writeFileSync(join(codacyDir, 'codacy.config.json'), '{"committed":true}');

		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const restore = backupCodacyConfig(root);
		rmSync(codacyDir, { recursive: true, force: true }); // the restore target disappears
		restore();
		const logged = errorSpy.mock.calls.map((args) => args.join(' ')).join('\n');
		errorSpy.mockRestore();

		expect(logged).toContain('WARNING');
		expect(logged).toContain('codacy.config.json');
		const backupDir = logged.match(/backup kept at (\S+)/)?.[1];
		expect(backupDir).toBeDefined();
		expect(existsSync(join(backupDir, 'codacy.config.json'))).toBe(true);
		rmSync(backupDir, { recursive: true, force: true });
	});
});

describe('HOOK_TOOLS — which Codacy tools each hook runs', () => {
	test('pre-commit never runs trivy', () => {
		expect(HOOK_TOOLS['pre-commit']).not.toContain('trivy');
	});

	test('pre-push runs trivy alongside the commit tools', () => {
		expect(HOOK_TOOLS['pre-push']).toEqual(expect.arrayContaining(['trivy', ...HOOK_TOOLS['pre-commit']]));
	});
});

describe('analysisScope', () => {
	const tools = ['semgrep', 'shellcheck'];

	test('one call per changed file and tool that applies to it, for a small push', () => {
		expect(analysisScope('/repo', ['src/a.ts', 'install.sh'], tools)).toEqual([
			{ rootPath: '/repo', file: '/repo/src/a.ts', tool: 'semgrep' },
			{ rootPath: '/repo', file: '/repo/install.sh', tool: 'semgrep' },
			{ rootPath: '/repo', file: '/repo/install.sh', tool: 'shellcheck' },
		]);
	});

	test('a file no requested tool applies to gets no call', () => {
		expect(analysisScope('/repo', ['scripts/hooks/pre-commit'], ['biome', 'shellcheck'])).toEqual([]);
	});

	test('one whole-repository call per tool above the per-file limit', () => {
		const files = Array.from({ length: PER_FILE_SCOPE_LIMIT + 1 }, (_, i) => `src/f${i}.ts`);
		expect(analysisScope('/repo', files, tools)).toEqual([
			{ rootPath: '/repo', tool: 'semgrep' },
			{ rootPath: '/repo', tool: 'shellcheck' },
		]);
	});

	test('the whole repository when nothing changed in code', () => {
		expect(analysisScope('/repo', [], tools)).toEqual([
			{ rootPath: '/repo', tool: 'semgrep' },
			{ rootPath: '/repo', tool: 'shellcheck' },
		]);
	});
});

// The fake server's behaviour is set per test through these env vars.
function fakeServer() {
	return writeFakeServer(tempDir('codacy-gate-fake-'));
}

function gitRoot() {
	const root = tempDir('codacy-gate-repo-');
	mkdirSync(join(root, '.git'));
	writeCodacyConfig(root);
	return root;
}

function analysis(result) {
	return JSON.stringify({ success: true, result });
}

describe('runner status and config checks (fail closed)', () => {
	let errorSpy;

	beforeEach(() => {
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		// A clean tool result, so only the runner-status and config checks can block.
		process.env.FAKE_PAYLOAD = JSON.stringify({ success: true, result: [] });
	});

	afterEach(() => {
		errorSpy.mockRestore();
		delete process.env.FAKE_RUNNER_STDERR;
		delete process.env.FAKE_PAYLOAD;
	});

	// Only the gate's own block messages: the echoed runner lines are not evidence.
	const blockMessages = () => errorSpy.mock.calls.map((args) => args.join(' ')).filter((line) => line.startsWith('[codacy-gate]')).join('\n');

	test('removing a tool from the Codacy config blocks and names it', async () => {
		const root = gitRoot();
		writeCodacyConfig(root, ['trivy', 'semgrep', 'biome', 'hadolint']);
		const code = await main(['--hook=pre-commit', root, 'install.sh'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(blockMessages()).toContain('shellcheck');
		expect(blockMessages()).toContain('codacy.config.json');
	});

	test('a runner status with no Analysis complete line blocks and names the tool', async () => {
		process.env.FAKE_RUNNER_STDERR = 'Starting analysis ({tool}, 1 files)';
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(blockMessages()).toContain('semgrep');
		expect(blockMessages()).toContain('Analysis complete');
	});

	test('"1 errors" in the runner summary blocks and names the tool', async () => {
		process.env.FAKE_RUNNER_STDERR = 'Starting analysis ({tool}, 1 files)\nAnalysis complete ({tool}, 0 issues, 1 errors, 0.1s)';
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(blockMessages()).toContain('biome');
		expect(blockMessages()).toContain('check failed for biome: 1 errors reported');
	});

	test('an unrecognized runner summary blocks: it is never a pass', async () => {
		process.env.FAKE_RUNNER_STDERR = 'Starting analysis ({tool}, 1 files)\nAnalysis complete ({tool}, weird output)';
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(blockMessages()).toContain('unrecognized runner line');
	});

	test('clean runner output passes', async () => {
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(0);
	});
});

describe('main — the gate fails closed', () => {
	let errorSpy;

	beforeEach(() => {
		errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		errorSpy.mockRestore();
		delete process.env.FAKE_PAYLOAD;
		delete process.env.FAKE_RPC_ERROR;
		delete process.env.FAKE_LOG;
	});

	const logged = () => errorSpy.mock.calls.map((args) => args.join(' ')).join('\n');
	const callsIn = (logFile) => readFileSync(logFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));

	test('a missing --hook blocks before any analysis', async () => {
		const code = await main([gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(logged()).toContain('unknown or missing --hook');
	});

	test('an unresolved repository root blocks with a message', async () => {
		const missing = join(tempDir(), 'no-such-repo');
		const code = await main(['--hook=pre-push', missing, 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(logged()).toContain('cannot resolve the repository root');
	});

	test('an unreadable Codacy token file blocks with a message', async () => {
		const home = tempDir('codacy-gate-home-');
		mkdirSync(join(home, '.prime', 'agent', 'codacy', 'server.env'), { recursive: true });
		const originalHome = process.env.HOME;
		process.env.HOME = home;
		try {
			const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
			expect(code).toBe(1);
			expect(logged()).toContain('cannot read the Codacy token file');
		} finally {
			process.env.HOME = originalHome;
		}
	});

	test('an unknown --hook blocks, including prototype names', async () => {
		expect(await main(['--hook=pre-merge', gitRoot(), 'src/a.ts'], { locateServer: fakeServer })).toBe(1);
		expect(await main(['--hook=constructor', gitRoot(), 'src/a.ts'], { locateServer: fakeServer })).toBe(1);
	});

	test('a hook set with a tool that has no file-type mapping blocks and names it', async () => {
		const locateServer = vi.fn(fakeServer);
		const code = await main(['--hook=pre-commit', gitRoot(), 'src/a.ts'], { locateServer, hookTools: { 'pre-commit': ['semgrep', 'constructor'] } });
		expect(code).toBe(1);
		expect(logged()).toContain('check failed for constructor: no file-type mapping for tool constructor');
		expect(locateServer).not.toHaveBeenCalled();
	});

	test('a missing server blocks and names the override', async () => {
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: () => undefined });
		expect(code).toBe(1);
		expect(logged()).toContain('not installed');
		expect(logged()).toContain('CODACY_GATE_OFF=1');
	});

	test('an analysis the server reports as failed blocks', async () => {
		process.env.FAKE_PAYLOAD = JSON.stringify({ success: false, output: 'runner crashed' });
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(logged()).toContain('runner crashed');
	});

	test('a failure in any one per-file analysis blocks the push', async () => {
		process.env.FAKE_PAYLOAD = JSON.stringify({ success: false, output: 'runner crashed' });
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts', 'src/b.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
	});

	test('a JSON-RPC error from the server blocks', async () => {
		process.env.FAKE_RPC_ERROR = 'tool exploded';
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(logged()).toContain('tool exploded');
	});

	test('a success response without a result array blocks', async () => {
		process.env.FAKE_PAYLOAD = JSON.stringify({ success: true });
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(logged()).toContain('not an array');
	});

	test('an unparseable analysis payload blocks', async () => {
		process.env.FAKE_PAYLOAD = 'not json';
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
	});

	test('an error-level finding in a changed file blocks', async () => {
		process.env.FAKE_PAYLOAD = analysis([
			{ level: 'error', filePath: 'src/a.ts', tool: 'Biome', rule: { id: 'rule-x' }, message: 'bad' },
		]);
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(logged()).toContain('src/a.ts');
	});

	test('a Hadolint warning in a changed file blocks', async () => {
		process.env.FAKE_PAYLOAD = analysis([
			{ level: 'warning', filePath: 'Dockerfile', tool: 'Hadolint', rule: { id: 'Hadolint_DL3002' }, message: 'root' },
		]);
		const code = await main(['--hook=pre-commit', gitRoot(), 'Dockerfile'], { locateServer: fakeServer });
		expect(code).toBe(1);
		expect(logged()).toContain('Dockerfile');
	});

	test('a warning from any tool other than Hadolint does not block', async () => {
		process.env.FAKE_PAYLOAD = analysis([
			{ level: 'warning', filePath: 'src/a.ts', tool: 'Biome', rule: { id: 'rule-x' }, message: 'style' },
		]);
		const code = await main(['--hook=pre-commit', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(0);
	});

	test('error-level findings in unchanged files do not block', async () => {
		process.env.FAKE_PAYLOAD = analysis([
			{ level: 'error', filePath: 'src/other.ts', tool: 'Biome', rule: { id: 'rule-x' }, message: 'bad' },
		]);
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(0);
	});

	test('a clean analysis allows the commit', async () => {
		process.env.FAKE_PAYLOAD = analysis([]);
		const code = await main(['--hook=pre-push', gitRoot(), 'src/a.ts'], { locateServer: fakeServer });
		expect(code).toBe(0);
	});

	test('pre-commit calls the tools that apply to the file, never trivy', async () => {
		const root = gitRoot();
		const logFile = join(root, 'calls.jsonl');
		process.env.FAKE_LOG = logFile;
		process.env.FAKE_PAYLOAD = analysis([]);
		await main(['--hook=pre-commit', root, 'src/a.ts'], { locateServer: fakeServer });
		const tools = new Set(callsIn(logFile).map((call) => call.tool));
		expect(tools).toEqual(new Set(['semgrep', 'biome']));
		expect(tools.has('trivy')).toBe(false);
	});

	test('pre-push calls trivy and every tool that applies to the file', async () => {
		const root = gitRoot();
		const logFile = join(root, 'calls.jsonl');
		process.env.FAKE_LOG = logFile;
		process.env.FAKE_PAYLOAD = analysis([]);
		await main(['--hook=pre-push', root, 'src/a.ts'], { locateServer: fakeServer });
		const tools = new Set(callsIn(logFile).map((call) => call.tool));
		expect(tools).toEqual(new Set(['trivy', 'semgrep', 'biome']));
	});

	test('a small push is analyzed one changed file at a time', async () => {
		const root = gitRoot();
		const logFile = join(root, 'calls.jsonl');
		process.env.FAKE_LOG = logFile;
		process.env.FAKE_PAYLOAD = analysis([]);
		await main(['--hook=pre-push', root, 'src/a.ts', 'src/b.ts'], { locateServer: fakeServer });
		const files = callsIn(logFile).filter((call) => call.tool === 'biome').map((call) => call.file);
		expect(files).toEqual([join(root, 'src/a.ts'), join(root, 'src/b.ts')]);
	});

	test('a push above the per-file limit is analyzed as one whole-repository run per tool', async () => {
		const root = gitRoot();
		const logFile = join(root, 'calls.jsonl');
		process.env.FAKE_LOG = logFile;
		process.env.FAKE_PAYLOAD = analysis([]);
		const files = Array.from({ length: PER_FILE_SCOPE_LIMIT + 1 }, (_, i) => `src/f${i}.ts`);
		await main(['--hook=pre-push', root, ...files], { locateServer: fakeServer });
		const calls = callsIn(logFile);
		expect(calls.every((call) => call.file === undefined)).toBe(true);
		expect(new Set(calls.map((call) => call.tool))).toEqual(new Set(HOOK_TOOLS['pre-push']));
	});
});
