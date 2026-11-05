#!/usr/bin/env node
/**
 * Codacy pre-push gate.
 *
 * Runs Codacy local analysis (via the official Codacy MCP server,
 * @codacy/codacy-mcp, spawned over stdio) on the changed files, then blocks the
 * push when any *changed* file carries error-level (critical/major) findings.
 *
 * Usage: node pre-push-gate.mjs --hook=<pre-commit|pre-push> <repo-root> <changed-file>...
 * Exit 0 = allow push; 1 = block push.
 *
 * Talks plain JSON-RPC 2.0 (newline-delimited) to the MCP server — no SDK
 * dependency, so the hook stays self-contained. Fails closed: a missing server
 * or any analysis failure blocks, with the reason printed. Escape hatches:
 * `git push --no-verify` / `git commit --no-verify`, or CODACY_GATE_OFF=1.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync, rmSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path, { resolve as resolvePath } from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

/**
 * Resolves the npm global prefix WITHOUT spawning npm or resolving anything
 * through PATH (S4036). Source of truth, in order: NPM_CONFIG_PREFIX /
 * npm_config_prefix env, then the user ~/.npmrc `prefix=` line, then the
 * standard Node installation layout (node at <prefix>/bin/node on POSIX,
 * <prefix>/node.exe on Windows).
 *
 * @param env - Environment (defaults to process.env)
 * @param home - Home directory for the .npmrc lookup (defaults to os.homedir())
 * @param execPath - Node executable path (defaults to process.execPath)
 * @param platform - Defaults to process.platform
 * @returns The npm global prefix directory
 */
export function npmPrefix(env = process.env, home = os.homedir(), execPath = process.execPath, platform = process.platform) {
	const fromEnv = env.NPM_CONFIG_PREFIX || env.npm_config_prefix;
	if (fromEnv) return fromEnv;
	try {
		const npmrc = path.join(home, '.npmrc');
		if (existsSync(npmrc)) {
			for (const line of readFileSync(npmrc, 'utf8').split(/\r?\n/)) {
				// Parse `prefix=value` (or `prefix = value`) directly instead of
				// with `\s*(.+)` (sonarcloud: super-linear backtracking).
				const equals = line.indexOf('=');
				if (equals === -1 || line.slice(0, equals).trim() !== 'prefix') continue;
				const prefix = line.slice(equals + 1).trim();
				if (prefix) return prefix.replace(/^["']|["']$/g, '');
			}
		}
	} catch { /* fall through to the Node-layout derivation */ }
	return platform === 'win32' ? path.dirname(execPath) : path.dirname(path.dirname(execPath));
}

/** Passwd-entry home; null where the user has no passwd record (some containers). */
function passwdHome() {
	try { return os.userInfo().homedir; } catch { return null; }
}

/**
 * Home directories a global npm install may live under: $HOME (os.homedir)
 * and the passwd-entry home. They diverge inside distrobox/container homes —
 * npm resolves ~/.npmrc and `npm prefix -g` against the passwd home while
 * os.homedir() follows $HOME — so both must be checked to find a
 * codacy-mcp-server installed by the host's npm.
 */
export function candidateHomes(homedir = os.homedir(), userInfoHome = passwdHome()) {
	return [...new Set([homedir, userInfoHome].filter((h) => typeof h === 'string' && h.length > 0))];
}

/**
 * Resolves the codacy-mcp-server binary. Order:
 *   1. CODACY_MCP_SERVER env pin (any install layout)
 *   2. npm-prefix candidates derived from each candidate home's .npmrc
 *   3. a read-only PATH scan for the binary itself — distrobox shells commonly
 *      export the host's npm bin dir even when the host .npmrc is invisible to
 *      os.homedir()/os.userInfo(). The hit is executed by absolute path only.
 * Returns undefined when the server is not installed anywhere reachable.
 */
export function resolveServerBin(homes = candidateHomes(), env = process.env) {
	const pinned = env.CODACY_MCP_SERVER;
	if (pinned && existsSync(pinned)) return pinned;
	const candidates = homes.map((home) => path.join(npmPrefix(env, home), 'bin', 'codacy-mcp-server'));
	for (const dir of (env.PATH || '').split(path.delimiter)) {
		if (dir) candidates.push(path.join(dir, 'codacy-mcp-server'));
	}
	return candidates.find((candidate) => existsSync(candidate));
}

/**
 * Gate entrypoint.
 *
 * @param argv - [repo-root, changed-file...] (defaults to process.argv.slice(2))
 * @returns {Promise<number>} Exit code
 */
/**
 * Copies the committed .codacy config aside so the runner can regenerate it,
 * and returns the restore function that puts it back afterwards.
 *
 * @param repoRoot - Repository root containing .codacy
 * @returns restore function (idempotent; failures are swallowed)
 */
export function backupCodacyConfig(repoRoot) {
	const codacyDir = path.join(repoRoot, '.codacy');
	const configFiles = ['codacy.config.json', 'codacy.config.baseline.json', 'configure-codacy-summary.json'];
	const backupDir = path.join(os.tmpdir(), `codacy-gate-${process.pid}`);
	const backedUp = [];
	const initiallyAbsent = [];
	mkdirSync(backupDir, { recursive: true });
	for (const name of configFiles) {
		const target = path.join(codacyDir, name);
		if (existsSync(target)) {
			copyFileSync(target, path.join(backupDir, name));
			backedUp.push(name);
		} else {
			// The runner may GENERATE this file during analysis; a file that was
			// absent before must not survive the gate as a repo change.
			initiallyAbsent.push(name);
		}
	}
	return () => {
		// Restore the originals, then remove anything the runner generated that
		// was not committed. A failed step is a loud warning, and the backup
		// directory is kept (its path printed) so the only copy survives.
		const failures = [];
		for (const name of backedUp) {
			try { copyFileSync(path.join(backupDir, name), path.join(codacyDir, name)); } catch (err) { failures.push(`restore ${name}: ${err.message}`); }
		}
		for (const name of initiallyAbsent) {
			try { rmSync(path.join(codacyDir, name), { force: true }); } catch (err) { failures.push(`remove ${name}: ${err.message}`); }
		}
		if (failures.length > 0) {
			console.error(`[codacy-gate] WARNING: could not restore .codacy config (${failures.join('; ')}); backup kept at ${backupDir}`);
			return;
		}
		try { rmSync(backupDir, { recursive: true, force: true }); } catch (err) {
			console.error(`[codacy-gate] WARNING: could not remove ${backupDir}: ${err.message}`);
		}
	};
}

/**
 * Environment for the MCP server: the process env plus the optional agent
 * CODACY_ACCOUNT_TOKEN (keeps analysis cloud-synced; token is optional).
 */
function mcpEnv() {
	const env = { ...process.env };
	try {
		const envFile = path.join(os.homedir(), '.prime', 'agent', 'codacy', 'server.env');
		if (existsSync(envFile)) {
			for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
				const match = line.match(/^CODACY_ACCOUNT_TOKEN=(.*)$/);
				const token = match?.[1]?.trim();
				if (token) env.CODACY_ACCOUNT_TOKEN = token.replace(/^["']|["']$/g, '');
			}
		}
	} catch { /* token is optional */ }
	return env;
}

/**
 * Runs the Codacy MCP server over stdio and requests a repository analysis.
 *
 * @param serverBin - Absolute path to the codacy-mcp-server binary
 * @param env - Environment for the spawned server
 * @param scope - codacy_cli_analyze arguments, one entry per analysis run
 * @returns The parsed analysis payloads (one per run) plus any error
 */
async function analyzeRepository(serverBin, env, scope) {
	const payloads = [];
	let analysisError = null;
	const proc = spawn(serverBin, [], { env, stdio: ['pipe', 'pipe', 'pipe'] });
	// Minimal MCP stdio client (JSON-RPC 2.0, newline-delimited).
	function rpc(rl, id, method, params) {
		return new Promise((resolve, reject) => {
			const onLine = (line) => {
				let msg;
				try { msg = JSON.parse(line); } catch { return; }
				if (msg.id === id) {
					rl.off('line', onLine);
					if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
					else resolve(msg.result);
				}
			};
			rl.on('line', onLine);
			proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
		});
	}
	// The analysis runner streams a lot of per-tool progress to stderr; collapse
	// consecutive repeats so a 40s analysis doesn't bury the gate's verdict.
	let lastLine = null;
	let repeatCount = 0;
	proc.stderr.setEncoding('utf8');
	proc.stderr.on('data', (chunk) => {
		for (const line of chunk.split(/\r?\n/)) {
			if (!line) continue;
			if (line === lastLine) {
				repeatCount += 1;
				continue;
			}
			if (repeatCount > 3) console.error(`   ... (${repeatCount} repeats)`);
			repeatCount = 0;
			lastLine = line;
			console.error(line);
		}
	});
	try {
		const rl = readline.createInterface({ input: proc.stdout });
		await rpc(rl, 1, 'initialize', {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: { name: 'codacy-pre-push-gate', version: '1.0.0' },
		});
		proc.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
		console.error('[codacy-gate] analyzing repository (first run may download tool runtimes) ...');
		for (const [index, args] of scope.entries()) {
			const result = await rpc(rl, index + 2, 'tools/call', { name: 'codacy_cli_analyze', arguments: args });
			const text = result?.content?.[0]?.text;
			payloads.push(text ? JSON.parse(text) : { success: false, output: 'empty response' });
		}
	} catch (err) {
		analysisError = err;
	} finally {
		try { proc.kill(); } catch { /* ignore */ }
	}
	return { payloads, analysisError };
}

/** Tools whose warning-level findings also block. Hadolint is the only one. */
export const WARNING_BLOCKING_TOOLS = ['hadolint'];

/** Error-level findings block for every tool; warnings block only for WARNING_BLOCKING_TOOLS. */
export function isBlockingFinding(finding) {
	if (finding.level === 'error') return true;
	return finding.level === 'warning' && WARNING_BLOCKING_TOOLS.includes(String(finding.tool).toLowerCase());
}

/** Changed-file count up to which each file is analyzed on its own; above it the whole repository is analyzed. */
export const PER_FILE_SCOPE_LIMIT = 5;

/**
 * Codacy tools each hook runs. Trivy runs on pre-push only: it is the slow
 * dependency and secret scan, and it can need network for its database.
 */
export const HOOK_TOOLS = {
	'pre-commit': ['semgrep', 'biome', 'shellcheck', 'hadolint'],
	'pre-push': ['trivy', 'semgrep', 'biome', 'shellcheck', 'hadolint'],
};

/**
 * The codacy_cli_analyze calls for a push: one per changed file and tool for
 * small pushes, otherwise one per tool for the whole repository.
 * shortcut: the limit is a fixed count, not timed per tool; upgrade by timing both paths on real pushes.
 */
export function analysisScope(repoRoot, files, tools) {
	const targets = files.length > 0 && files.length <= PER_FILE_SCOPE_LIMIT
		? files.map((file) => ({ rootPath: repoRoot, file: path.join(repoRoot, file) }))
		: [{ rootPath: repoRoot }];
	return targets.flatMap((target) => tools.map((tool) => ({ ...target, tool })));
}

export async function main(argv = process.argv.slice(2), { locateServer = () => resolveServerBin() } = {}) {
	const [hookFlag, ...args] = argv;
	const hook = hookFlag?.startsWith('--hook=') ? hookFlag.slice('--hook='.length) : undefined;
	const log = (...a) => console.error('[codacy-gate]', ...a);
	if (!Object.hasOwn(HOOK_TOOLS, hook)) {
		log('unknown or missing --hook (got %s); blocking (fail closed). Use --hook=pre-commit or --hook=pre-push', hook ?? 'none');
		return 1;
	}
	const tools = HOOK_TOOLS[hook];
	const ROOT = args[0];
	const changed = new Set((args.slice(1) || []).map((f) => f.replace(/^\.\//, '')));

	if (!ROOT || !existsSync(path.join(ROOT, '.git'))) {
		log('no repo root given; skipping gate');
		return 0;
	}
	if (changed.size === 0) {
		log('no changed files; skipping gate');
		return 0;
	}

	// --- resolve the global Codacy MCP server binary -----------------------------
	// S4036: never resolve executables through PATH — no `npm` subprocess.
	// npmPrefix() derives the prefix from env/.npmrc/Node layout, and the
	// server binary is then an absolute path under <prefix>/bin.
	const serverBin = locateServer();
	if (!serverBin) {
		log('@codacy/codacy-mcp is not installed; blocking (fail closed)');
		log('  install with: npm install -g @codacy/codacy-mcp');
		log('  override this gate only: CODACY_GATE_OFF=1 git push (or git commit)');
		return 1;
	}

	// --- preserve committed .codacy config (the runner regenerates it) -----------
	const restoreConfig = backupCodacyConfig(ROOT);
	let payloads;
	let analysisError;
	try {
		({ payloads, analysisError } = await analyzeRepository(serverBin, mcpEnv(), analysisScope(ROOT, [...changed], tools)));
	} finally {
		restoreConfig(); // restore the initial .codacy state on EVERY exit path
	}
	if (analysisError) {
		log('analysis failed (%s); blocking (fail closed, tooling error)', analysisError?.message || analysisError);
		log('  override this gate only: CODACY_GATE_OFF=1 git push (or git commit)');
		return 1;
	}

	const failed = payloads.find((p) => !p.success || !Array.isArray(p.result));
	if (failed) {
		log('analysis failed: %s; blocking (fail closed, tooling error)', failed.success ? 'response result is not an array' : failed.output || 'unknown');
		log('  override this gate only: CODACY_GATE_OFF=1 git push (or git commit)');
		return 1;
	}

	const findings = payloads.flatMap((p) => (Array.isArray(p.result) ? p.result : []));
	const blockers = findings.filter(
		(f) => f && isBlockingFinding(f) && changed.has(String(f.filePath || '').replace(/^\.\//, '')),
	);

	if (blockers.length === 0) {
		log('OK: no error-level Codacy findings in changed files');
		return 0;
	}

	console.error('');
	console.error('Codacy gate: blocked — %d error-level finding(s) in changed files:', blockers.length);
	for (const f of blockers) {
		const column = f.region?.startColumn ? `:${f.region.startColumn}` : '';
		const at = f.region ? `${f.filePath}:${f.region.startLine ?? '?'}${column}` : f.filePath;
		console.error(`  [${f.tool}] ${f.rule?.name || f.rule?.id || '?'}  ${at}`);
		console.error(`      ${f.message}`);
	}
	console.error('');
	console.error('Fix the findings above (or suppress the pattern in .codacy/), then retry.');
	console.error('Override this gate only: CODACY_GATE_OFF=1 git push (or git commit).');
	return 1;
}

// Only run when executed directly, not when imported by tests.
const invokedPath = process.argv[1];
if (invokedPath && resolvePath(invokedPath) === fileURLToPath(import.meta.url)) {
	try {
		process.exitCode = await main();
	} catch (cause) {
		console.error('[codacy-gate] fatal:', cause);
		process.exit(1);
	}
}
