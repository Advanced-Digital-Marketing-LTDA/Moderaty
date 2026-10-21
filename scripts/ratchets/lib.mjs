import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Counted by regex, not by parsing: the ratchet only cares about the delta
// between base and candidate, so a stable over-count (a pattern inside a
// string) is harmless. Files in this directory are skipped because they must
// spell out the patterns they search for.
const SOURCE = /\.(?:[cm]?[jt]s|svelte)$/;
const TYPED = /\.(?:ts|svelte)$/;
const TEST = /(?:\.(?:test|spec)\.[cm]?[jt]s$|^e2e\/)/;
const SELF = 'scripts/ratchets/';

export const METRICS = [
	{ ratchet: 'test', id: 'skipped-tests', direction: 'down', files: TEST,
		pattern: /\b(?:it|test|describe)\.(?:skip|todo|fixme)\b|\bx(?:it|describe)\s*\(/g },
	{ ratchet: 'test', id: 'focused-tests', direction: 'down', files: TEST,
		pattern: /\b(?:it|test|describe)\.only\b/g },
	{ ratchet: 'test', id: 'test-cases', direction: 'up', files: TEST,
		pattern: /^\s*(?:it|test)(?:\.\w+)?\s*\(/gm },
	{ ratchet: 'test', id: 'assertions', direction: 'up', files: TEST,
		pattern: /\bexpect\s*\(|\bassert(?:\.\w+)?\s*\(/g },
	{ ratchet: 'suppress', id: 'ts-suppressions', direction: 'down', files: SOURCE,
		pattern: /@ts-(?:ignore|nocheck|expect-error)\b/g },
	{ ratchet: 'suppress', id: 'lint-suppressions', direction: 'down', files: SOURCE,
		pattern: /\beslint-disable|\bbiome-ignore\b|\bsvelte-ignore\b/g },
	{ ratchet: 'suppress', id: 'coverage-suppressions', direction: 'down', files: SOURCE,
		pattern: /\b(?:istanbul|c8|v8)\s+ignore\b/g },
	{ ratchet: 'type', id: 'explicit-any', direction: 'down', files: TYPED,
		pattern: /:\s*any\b|\bas\s+any\b|<any[,>]|,\s*any\s*>|\bany\[\]/g },
	{ ratchet: 'type', id: 'double-casts', direction: 'down', files: TYPED,
		pattern: /\bas\s+unknown\s+as\b/g }
];

export const RATCHETS = [...new Set(METRICS.map(metric => metric.ratchet))];

export function trackedFiles(root) {
	const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
	return out.split('\0').filter(file => file && !file.startsWith(SELF));
}

export function countMatches(text, pattern) {
	return [...text.matchAll(pattern)].length;
}

export function measure(root, ratchets = RATCHETS, files = trackedFiles(root)) {
	const selected = METRICS.filter(metric => ratchets.includes(metric.ratchet));
	const counts = Object.fromEntries(selected.map(metric => [metric.id, 0]));
	for (const file of files) {
		const applicable = selected.filter(metric => metric.files.test(file));
		if (applicable.length === 0) continue;
		const text = readFileSync(join(root, file), 'utf8');
		for (const metric of applicable) counts[metric.id] += countMatches(text, metric.pattern);
	}
	return counts;
}

// A missing or non-integer baseline entry throws: a gate that silently skips a
// metric is the failure mode a ratchet exists to prevent.
export function compare(current, baseline, ratchets = RATCHETS) {
	const failures = [];
	const improvements = [];
	for (const metric of METRICS.filter(m => ratchets.includes(m.ratchet))) {
		const base = baseline?.[metric.id];
		if (!Number.isInteger(base) || base < 0) {
			throw new Error(`Ratchet baseline has no valid integer for "${metric.id}"; run "npm run ratchet:update" and commit the result.`);
		}
		const now = current?.[metric.id];
		if (!Number.isInteger(now)) throw new Error(`Ratchet run has no measured integer for "${metric.id}"; the metric was not measured.`);
		const worse = metric.direction === 'down' ? now > base : now < base;
		const better = metric.direction === 'down' ? now < base : now > base;
		const detail = { id: metric.id, direction: metric.direction, baseline: base, current: now };
		if (worse) failures.push(detail);
		else if (better) improvements.push(detail);
	}
	return { failures, improvements };
}
