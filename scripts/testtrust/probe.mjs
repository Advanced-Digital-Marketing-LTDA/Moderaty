import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = process.env.TESTTRUST_CLI;
if (!cli || !cli.endsWith('/dist/cli.js')) throw new Error('TESTTRUST_CLI must point to the pinned TestTrust dist/cli.js');
const policyScript = resolve(dirname(fileURLToPath(import.meta.url)), 'policy.mjs');
const root = mkdtempSync(resolve(tmpdir(), 'moderaty-testtrust-'));
const git = (cwd, ...args) => execFileSync('/usr/bin/git', args, { cwd, encoding: 'utf8' }).trim();
const WEAKENED = "import { expect, test } from 'vitest';\nimport { add } from './add.js';\ntest('adds values', () => { expect(add(2, 3)).toBeTruthy(); });\n";
const BASELINE_TEST = "import { expect, test } from 'vitest';\nimport { add } from './add.js';\ntest('adds values', () => { expect(add(2, 3)).toBe(5); });\n";
const cases = [
	{
		name: 'weakened assertion',
		before: BASELINE_TEST,
		after: WEAKENED,
		policy: 'same',
		expect: (result) => {
			assert.equal(result.score.verdict, 'fail');
			assert(result.findings.some((finding) => finding.ruleId === 'assertion-weakened'));
		}
	},
	{
		name: 'legitimate focused regression test addition',
		before: BASELINE_TEST,
		after: BASELINE_TEST + "test('adds zero', () => { expect(add(0, 3)).toBe(3); });\n",
		policy: 'same',
		expect: (result) => {
			assert.notEqual(result.score.verdict, 'fail');
			assert.equal(result.findings.some((finding) => finding.ruleId === 'assertion-weakened'), false);
		}
	},
	{
		// The PR #229 finding: repository config lands in the candidate checkout
		// and turns detectors off, so the CLI alone emits passing evidence. The
		// policy check is what makes the gate fail closed on the attempt.
		name: 'rc config disables detectors while weakening tests',
		before: BASELINE_TEST,
		after: WEAKENED,
		files: {
			'.testtrustrc.json': JSON.stringify({
				disable: ['assertion-weakened', 'assertion-deleted', 'test-skipped', 'assertion-free', 'trivial-assertion']
			})
		},
		policy: 'changed',
		expect: (result) => {
			assert.notEqual(result.score.verdict, 'fail',
				'fixture must prove the raw CLI is bypassed by candidate config');
		}
	},
	{
		name: 'package.json config disables detectors while weakening tests',
		before: BASELINE_TEST,
		after: WEAKENED,
		files: {
			'package.json': JSON.stringify({
				name: 'fixture',
				testtrust: { rules: { 'assertion-weakened': { enabled: false }, 'trivial-assertion': { enabled: false } } }
			})
		},
		policy: 'changed',
		expect: (result) => {
			assert.notEqual(result.score.verdict, 'fail',
				'fixture must prove the raw CLI is bypassed by candidate config');
		}
	},
	{
		// Any effective-config delta is a policy change — even one that never
		// touches a rule — because the gate's policy belongs to the base
		// revision, not the candidate diff.
		name: 'config-only policy change',
		before: BASELINE_TEST,
		after: BASELINE_TEST,
		files: { '.testtrustrc.json': JSON.stringify({ failUnder: 30 }) },
		policy: 'changed',
		expect: null
	},
	{
		// A config the base already shipped is the trusted policy: an unchanged
		// inherited config must not block an otherwise clean diff.
		name: 'inherited base config stays trusted',
		baseFiles: { '.testtrustrc.json': JSON.stringify({ disable: ['focused-test'] }) },
		before: BASELINE_TEST,
		after: BASELINE_TEST + "test('adds zero', () => { expect(add(0, 3)).toBe(3); });\n",
		policy: 'same',
		expect: (result) => {
			assert.notEqual(result.score.verdict, 'fail');
		}
	}
];

try {
	for (const item of cases) {
		const cwd = resolve(root, item.name.replaceAll(' ', '-'));
		mkdirSync(cwd);
		const write = (path, value) => {
			mkdirSync(dirname(resolve(cwd, path)), { recursive: true });
			writeFileSync(resolve(cwd, path), value);
		};
		git(cwd, 'init', '-q');
		git(cwd, 'config', 'user.name', 'TestTrust probe');
		git(cwd, 'config', 'user.email', 'testtrust-probe@example.invalid');
		write('src/add.ts', 'export const add = (a: number, b: number) => a + b;\n');
		write('src/add.test.ts', item.before);
		for (const [path, value] of Object.entries(item.baseFiles ?? {})) write(path, value);
		git(cwd, 'add', '.');
		git(cwd, 'commit', '-qm', 'baseline');
		const baseSha = git(cwd, 'rev-parse', 'HEAD');
		write('src/add.test.ts', item.after);
		for (const [path, value] of Object.entries(item.files ?? {})) write(path, value);
		git(cwd, 'add', '.');
		git(cwd, 'commit', '-qm', item.name);
		// Move the branch ref after the PR base was recorded. The explicit base SHA must remain authoritative.
		git(cwd, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

		// Policy check: the gate's configuration must equal the trusted base
		// revision's before the diff gate is allowed to run at all.
		const policyRun = spawnSync(process.execPath, [policyScript, '--cwd', cwd, '--base', baseSha, '--cli', cli], {
			encoding: 'utf8', timeout: 30_000
		});
		if (item.policy === 'same') {
			assert.equal(policyRun.status, 0,
				`${item.name}: policy check must pass an unchanged config: ${policyRun.stderr}${policyRun.stdout}`);
		} else {
			assert.notEqual(policyRun.status, 0,
				`${item.name}: policy check must reject a candidate-changed config`);
			assert.match(policyRun.stderr + policyRun.stdout, /policy check failed|effective TestTrust configuration/i,
				`${item.name}: policy rejection must name the policy violation`);
		}

		if (item.expect === null) continue;
		const run = spawnSync(process.execPath, [cli, '--base', baseSha, '--format', 'json', '--fail-under', '86'], {
			cwd, encoding: 'utf8', timeout: 30_000
		});
		assert(run.stdout.trim(), `${item.name}: TestTrust produced empty output: ${run.stderr}`);
		let result;
		try { result = JSON.parse(run.stdout); }
		catch (error) { throw new Error(`${item.name}: invalid TestTrust JSON (${error.message})`); }
		assert(result.score && Number.isInteger(result.score.score), `${item.name}: missing score evidence`);
		assert(Array.isArray(result.findings), `${item.name}: missing findings evidence`);
		item.expect(result);
		assert.equal(run.status, result.score.verdict === 'fail' ? 1 : 0,
			`${item.name}: CLI exit status did not match the verdict: ${run.stderr}`);
		console.info(JSON.stringify({ scenario: item.name, score: result.score.score, verdict: result.score.verdict,
			findings: result.findings.map(({ ruleId, severity }) => ({ ruleId, severity })) }));
	}
} finally {
	rmSync(root, { recursive: true, force: true });
}
