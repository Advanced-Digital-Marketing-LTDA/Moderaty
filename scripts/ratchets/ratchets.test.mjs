import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { compare, measure } from './lib.mjs';
import { parseArgs, run } from './run.mjs';

const roots = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function repo(files) {
	const root = mkdtempSync(join(tmpdir(), 'ratchet-'));
	roots.push(root);
	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(root, name)), { recursive: true });
		writeFileSync(join(root, name), text);
	}
	execFileSync('git', ['init', '-q'], { cwd: root });
	execFileSync('git', ['add', '-A'], { cwd: root });
	return root;
}

const quietLog = () => {
	const lines = [];
	return { lines, info: m => lines.push(m), warn: m => lines.push(m), error: m => lines.push(m) };
};

describe('measure', () => {
	test('counts each metric in the files it applies to, exactly', () => {
		const root = repo({
			'src/a.test.ts': "it('a', () => { expect(1).toBe(1); expect(2).toBe(2); });\nit.skip('b', () => {});\ntest.only('c', () => {});\nxit('d', () => {});\n",
			'src/b.ts': '// @ts-ignore\nconst x: any = 1;\nconst y = x as any;\nconst z = y as unknown as string;\n// eslint-disable-next-line\n',
			'src/c.svelte': '<!-- svelte-ignore a11y_x -->\n<script lang="ts">let v: any[] = [];</script>\n',
			'src/d.js': 'const q: any = 1; // not typed source, so not counted as a type escape\n',
			'scripts/ratchets/self.test.mjs': "it.skip('x'); // skipped: ratchet files are excluded\n"
		});
		expect(measure(root)).toEqual({
			'skipped-tests': 2, 'focused-tests': 1, 'test-cases': 3, assertions: 2,
			'ts-suppressions': 1, 'lint-suppressions': 2, 'coverage-suppressions': 0,
			'explicit-any': 3, 'double-casts': 1
		});
	});

	test('type metrics ignore test-only and non-typed files; test metrics ignore plain sources', () => {
		const root = repo({ 'src/x.ts': "it.skip('not a test file', () => {});\n", 'src/y.test.js': 'const a: any = 1;\n' });
		const counts = measure(root);
		expect(counts['skipped-tests']).toBe(0);
		expect(counts['explicit-any']).toBe(0);
	});
});

describe('compare', () => {
	const base = { 'skipped-tests': 1, 'focused-tests': 0, 'test-cases': 10, assertions: 20, 'ts-suppressions': 2, 'lint-suppressions': 2, 'coverage-suppressions': 0, 'explicit-any': 5, 'double-casts': 3 };

	test('a rise in a lower-is-better metric fails', () => {
		const { failures } = compare({ ...base, 'explicit-any': 6 }, base);
		expect(failures).toEqual([{ id: 'explicit-any', direction: 'down', baseline: 5, current: 6 }]);
	});

	test('a fall in a higher-is-better metric fails', () => {
		const { failures } = compare({ ...base, assertions: 19 }, base);
		expect(failures).toEqual([{ id: 'assertions', direction: 'up', baseline: 20, current: 19 }]);
	});

	test('improvements are reported, not failed', () => {
		const { failures, improvements } = compare({ ...base, 'skipped-tests': 0, 'test-cases': 11 }, base);
		expect(failures).toEqual([]);
		expect(improvements.map(i => i.id).sort()).toEqual(['skipped-tests', 'test-cases']);
	});

	test('an unchanged tree passes silently', () => {
		expect(compare(base, base)).toEqual({ failures: [], improvements: [] });
	});

	test.each([[{}], [{ ...base, assertions: '20' }], [{ ...base, assertions: -1 }], [null]])('a missing or invalid baseline throws loudly (%j)', baseline => {
		expect(() => compare(base, baseline)).toThrow(/no valid integer/);
	});

	test('only the selected ratchet is judged', () => {
		const { failures } = compare({ ...base, 'explicit-any': 99 }, { ...base, 'explicit-any': 1 }, ['test']);
		expect(failures).toEqual([]);
	});
});

describe('run', () => {
	test('--update writes a baseline that then passes, and a later regression exits 1', () => {
		const root = repo({ 'src/a.ts': 'const a: any = 1;\n' });
		const log = quietLog();
		expect(run(['--root', root, '--update'], log)).toBe(0);
		expect(JSON.parse(readFileSync(join(root, '.github/ratchets/baselines.json'), 'utf8'))['explicit-any']).toBe(1);
		expect(run(['--root', root], log)).toBe(0);
		writeFileSync(join(root, 'src/a.ts'), 'const a: any = 1;\nconst b: any = 2;\n');
		expect(run(['--root', root], log)).toBe(1);
		expect(log.lines.join('\n')).toMatch(/Ratchet "explicit-any" rose: baseline 1, now 2/);
	});

	test('--update for one ratchet preserves the other ratchets\' entries', () => {
		const root = repo({ 'src/a.ts': 'const a: any = 1;\n' });
		const baseline = join(root, 'base.json');
		writeFileSync(baseline, JSON.stringify({ 'ts-suppressions': 7 }));
		run(['--root', root, '--baseline', baseline, '--ratchet', 'type', '--update'], quietLog());
		const saved = JSON.parse(readFileSync(baseline, 'utf8'));
		expect(saved['ts-suppressions']).toBe(7);
		expect(saved['explicit-any']).toBe(1);
	});

	test('a missing baseline file fails loudly instead of passing', () => {
		const root = repo({ 'src/a.ts': 'export {};\n' });
		expect(() => run(['--root', root], quietLog())).toThrow(/ENOENT/);
	});

	test('unknown arguments and ratchet names are rejected', () => {
		expect(() => parseArgs(['--nope'])).toThrow(/Unknown argument/);
		expect(() => parseArgs(['--ratchet', 'bogus'])).toThrow(/Unknown ratchet/);
		expect(() => parseArgs(['--root'])).toThrow(/needs a value/);
	});
});

describe('ratchets workflow', () => {
	const workflow = readFileSync(new URL('../../.github/workflows/ratchets.yml', import.meta.url), 'utf8');

	test('judges the candidate with the base revision\'s scripts and baselines', () => {
		expect(workflow).toContain('ref: ${{ github.event.pull_request.base.sha }}');
		expect(workflow).toContain('--baseline "$policy/.github/ratchets/baselines.json"');
		expect(workflow).toContain('node "$policy/scripts/ratchets/run.mjs"');
		expect(workflow).toContain('--root "$GITHUB_WORKSPACE/candidate"');
	});

	test('bootstrap fallback is loud and never silent', () => {
		expect(workflow).toMatch(/::warning::Bootstrap/);
		expect(workflow).not.toContain('continue-on-error');
	});
});
