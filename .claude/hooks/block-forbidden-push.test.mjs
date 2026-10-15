import { spawnSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { forbiddenPushReason } from './block-forbidden-push.mjs';

describe('forbiddenPushReason', () => {
	test.each([
		'git push --force origin dev',
		'git push --force-with-lease',
		'git push -f origin dev',
		'git push origin +dev',
		'git push origin main',
		'git push origin HEAD:main',
		'git push origin HEAD:refs/heads/main',
		'git push origin dev\ngit push --force',
		'git -C ../repo push --force origin dev',
		'git -c core.x=1 push origin main',
		'git --no-pager push -f'
	])('blocks %s', command => expect(forbiddenPushReason(command)).not.toBeNull());

	test.each([
		'git push -u origin claude/project-thread-tc7jie',
		'git push origin dev',
		'git push origin feature/maintain-docs',
		'git commit -m "never push --force"',
		'git push origin dev\ngit log main',
		'git push origin dev\ngit checkout -f main',
		'git status',
		'git -C ../repo log --oneline main'
	])('allows %s', command => expect(forbiddenPushReason(command)).toBeNull());

	test('a non-string command throws instead of passing', () => {
		expect(() => forbiddenPushReason(undefined)).toThrow(/no string/);
	});
});

describe('hook process', () => {
	const hook = new URL('./block-forbidden-push.mjs', import.meta.url).pathname;
	const run = input => spawnSync(process.execPath, [hook], { input, encoding: 'utf8' });

	test('exits 2 with a reason for a forbidden push', () => {
		const result = run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push --force' } }));
		expect(result.status).toBe(2);
		expect(result.stderr).toMatch(/--force is forbidden/);
	});

	test('exits 0 for an allowed command and for non-Bash tools', () => {
		expect(run(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git push origin dev' } })).status).toBe(0);
		expect(run(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: 'x' } })).status).toBe(0);
	});

	test('malformed input blocks loudly', () => {
		const result = run('not json');
		expect(result.status).toBe(2);
		expect(result.stderr).toMatch(/could not read hook input/);
	});
});
