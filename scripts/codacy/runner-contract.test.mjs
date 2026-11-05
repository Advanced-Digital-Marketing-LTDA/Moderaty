import { describe, expect, test } from 'vitest';
import { appliesTo, configFailures, parseRunnerLine, runnerFailures } from './runner-contract.mjs';

// Summary lines copied from real runs of codacy-mcp 0.6.24 (see runner-contract.mjs).
const REAL_LINES = [
	'Starting analysis (Trivy, 3 files)',
	'Analysis complete (Trivy, 0 issues, 0.2s)',
	'Analysis complete (Trivy, 2 issues, 127.3s)',
	'Starting analysis (Semgrep, 1 files)',
	'Analysis complete (Semgrep, 0 issues, 4.8s)',
	'Starting analysis (Biome, 1 files)',
	'Analysis complete (Biome, 0 issues, 1 errors, 0.1s)',
	'Starting analysis (shellcheck, 1 files)',
	'Analysis complete (shellcheck, 1 issues, 0.0s)',
	'Starting analysis (Hadolint, 1 files)',
	'Analysis complete (Hadolint, 5 issues, 0.1s)',
];

describe('parseRunnerLine — the runner summary formats', () => {
	test('parses a starting line', () => {
		expect(parseRunnerLine('Starting analysis (shellcheck, 1 files)')).toEqual({ kind: 'starting', tool: 'shellcheck', files: 1 });
	});

	test('parses a complete line with no errors field as zero errors', () => {
		expect(parseRunnerLine('Analysis complete (Semgrep, 0 issues, 4.8s)')).toEqual({ kind: 'complete', tool: 'Semgrep', issues: 0, errors: 0 });
	});

	test('parses a complete line that reports errors', () => {
		expect(parseRunnerLine('Analysis complete (Biome, 0 issues, 1 errors, 0.1s)')).toEqual({ kind: 'complete', tool: 'Biome', issues: 0, errors: 1 });
	});

	test('every real summary line parses', () => {
		for (const line of REAL_LINES) expect(parseRunnerLine(line), line).not.toBeNull();
	});

	test('a status-looking line in an unrecognized format is reported as unrecognized, not parsed', () => {
		expect(parseRunnerLine('Analysis complete (semgrep, weird output)')).toEqual({ kind: 'unrecognized', tool: 'semgrep', line: 'Analysis complete (semgrep, weird output)' });
	});

	test('other runner lines are not status lines', () => {
		expect(parseRunnerLine('Pipeline complete (0 issues, 0.2s)')).toBeNull();
		expect(parseRunnerLine('Starting tool execution')).toBeNull();
	});
});

describe('runnerFailures — every tool in the hook needs a starting and a complete line', () => {
	test('matching start and complete lines with no errors pass', () => {
		const lines = ['Starting analysis (Semgrep, 1 files)', 'Analysis complete (Semgrep, 0 issues, 4.8s)'];
		expect(runnerFailures(lines, new Map([['semgrep', 1]]))).toEqual([]);
	});

	test('a missing complete line blocks and names the tool', () => {
		const failures = runnerFailures(['Starting analysis (Semgrep, 1 files)'], new Map([['semgrep', 1]]));
		expect(failures.map((f) => f.tool)).toEqual(['semgrep']);
	});

	test('a missing starting line blocks and names the tool', () => {
		const failures = runnerFailures(['Analysis complete (Biome, 0 issues, 0.1s)'], new Map([['biome', 1]]));
		expect(failures.map((f) => f.tool)).toContain('biome');
	});

	test('a complete line reporting errors blocks and names the tool', () => {
		const lines = ['Starting analysis (Biome, 1 files)', 'Analysis complete (Biome, 0 issues, 1 errors, 0.1s)'];
		const failures = runnerFailures(lines, new Map([['biome', 1]]));
		expect(failures.map((f) => f.tool)).toEqual(['biome']);
		expect(failures[0].reason).toContain('1 errors');
	});

	test('an unrecognized status line blocks and names the tool', () => {
		const lines = ['Starting analysis (semgrep, 1 files)', 'Analysis complete (semgrep, weird output)'];
		const failures = runnerFailures(lines, new Map([['semgrep', 1]]));
		expect(failures.map((f) => f.tool)).toContain('semgrep');
	});

	test('a tool run more times than it was asked for blocks', () => {
		const lines = ['Starting analysis (Semgrep, 1 files)', 'Analysis complete (Semgrep, 0 issues, 0.1s)'];
		expect(runnerFailures(lines, new Map([['semgrep', 2]])).map((f) => f.tool)).toContain('semgrep');
	});
});

describe('configFailures — every tool in the hook must be in the Codacy config', () => {
	const config = (toolIds) => JSON.stringify({ version: 1, tools: toolIds.map((toolId) => ({ toolId, patterns: [] })) });

	test('a tool missing from the config blocks and is named', () => {
		const failures = configFailures(config(['Trivy', 'Semgrep', 'Biome', 'Hadolint']), ['trivy', 'shellcheck']);
		expect(failures.map((f) => f.tool)).toEqual(['shellcheck']);
	});

	test('a toolId with the wrong case is missing (the runner skips it silently)', () => {
		const failures = configFailures(config(['Trivy', 'ShellCheck']), ['shellcheck']);
		expect(failures.map((f) => f.tool)).toEqual(['shellcheck']);
	});

	test('a config that is absent or unparseable blocks', () => {
		expect(configFailures(null, ['trivy']).length).toBeGreaterThan(0);
		expect(configFailures('{not json', ['trivy']).length).toBeGreaterThan(0);
	});

	test('a complete config passes', () => {
		expect(configFailures(config(['Trivy', 'shellcheck']), ['trivy', 'shellcheck'])).toEqual([]);
	});
});

describe('appliesTo — which files each tool analyzes, as observed on the real runner', () => {
	test.each([
		['trivy', 'anything.md', true],
		['semgrep', 'README.md', true],
		['biome', 'src/a.ts', true],
		['biome', 'package.json', true],
		['biome', 'scripts/a.mjs', false],
		['biome', 'a.jsonc', false],
		['shellcheck', 'install.sh', true],
		['shellcheck', 'scripts/hooks/pre-commit', false],
		['hadolint', 'Dockerfile', true],
		['hadolint', 'api.Dockerfile', true],
		['hadolint', 'scripts/a.mjs', false],
	])('%s applies to %s: %s', (tool, file, expected) => {
		expect(appliesTo(tool, file)).toBe(expected);
	});
});

describe('appliesTo — a tool with no file-type mapping throws', () => {
	test.each(['constructor', 'toString', '__proto__'])('%s throws instead of matching', (tool) => {
		expect(() => appliesTo(tool, 'src/a.ts')).toThrow(`no file-type mapping for tool ${tool}`);
	});
});
