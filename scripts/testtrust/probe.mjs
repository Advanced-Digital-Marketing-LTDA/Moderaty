import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

const cli = process.env.TESTTRUST_CLI;
if (!cli || !cli.endsWith('/dist/cli.js')) throw new Error('TESTTRUST_CLI must point to the pinned TestTrust dist/cli.js');
const root = mkdtempSync(resolve(tmpdir(), 'moderaty-testtrust-'));
const git = (cwd, ...args) => execFileSync('/usr/bin/git', args, { cwd, encoding: 'utf8' }).trim();
const cases = [
	{
		name: 'weakened assertion',
		before: "import { expect, test } from 'vitest';\nimport { add } from './add.js';\ntest('adds values', () => { expect(add(2, 3)).toBe(5); });\n",
		after: "import { expect, test } from 'vitest';\nimport { add } from './add.js';\ntest('adds values', () => { expect(add(2, 3)).toBeTruthy(); });\n",
		expect: (result) => {
			assert.equal(result.score.verdict, 'fail');
			assert(result.findings.some((finding) => finding.ruleId === 'assertion-weakened'));
		}
	},
	{
		name: 'legitimate focused regression test addition',
		before: "import { expect, test } from 'vitest';\nimport { add } from './add.js';\ntest('adds values', () => { expect(add(2, 3)).toBe(5); });\n",
		after: "import { expect, test } from 'vitest';\nimport { add } from './add.js';\ntest('adds values', () => { expect(add(2, 3)).toBe(5); });\ntest('adds zero', () => { expect(add(0, 3)).toBe(3); });\n",
		expect: (result) => {
			assert.notEqual(result.score.verdict, 'fail');
			assert.equal(result.findings.some((finding) => finding.ruleId === 'assertion-weakened'), false);
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
		git(cwd, 'add', '.');
		git(cwd, 'commit', '-qm', 'baseline');
		write('src/add.test.ts', item.after);
		git(cwd, 'add', '.');
		git(cwd, 'commit', '-qm', item.name);
		const run = spawnSync(process.execPath, [cli, '--base', 'HEAD^', '--format', 'json', '--fail-under', '85'], {
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
