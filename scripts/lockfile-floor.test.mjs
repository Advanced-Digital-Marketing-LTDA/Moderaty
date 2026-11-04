import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

/** Parse an exact `major.minor.patch` version; anything else is a malformed lockfile entry. */
function parseVersion(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
	if (!match) throw new Error(`Lockfile version is not an exact major.minor.patch: ${JSON.stringify(version)}`);
	return match.slice(1).map(Number);
}

/** True when `version` is at or above `floor`, compared numerically per segment. */
function atLeast(version, floor) {
	const [a, b] = [parseVersion(version), parseVersion(floor)];
	for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
	return true;
}

/** Every lockfile entry for `name`, including nested copies. */
function lockedVersions(name) {
	return Object.entries(lockfile.packages)
		.filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`))
		.map(([path, entry]) => ({ path, version: entry.version }));
}

test('the lockfile keeps brace-expansion at or above the 5.0.12 security fix', () => {
	const entries = lockedVersions('brace-expansion');
	expect(entries.length).toBeGreaterThan(0);
	for (const { path, version } of entries) {
		expect(atLeast(version, '5.0.12'), `${path} resolves ${version}`).toBe(true);
	}
});

test('the floor comparison rejects versions below the floor and accepts newer ones', () => {
	expect(atLeast('5.0.9', '5.0.12')).toBe(false);
	expect(atLeast('5.0.11', '5.0.12')).toBe(false);
	expect(atLeast('4.9.99', '5.0.12')).toBe(false);
	expect(atLeast('5.0.12', '5.0.12')).toBe(true);
	expect(atLeast('5.0.100', '5.0.12')).toBe(true);
	expect(atLeast('5.1.0', '5.0.12')).toBe(true);
	expect(atLeast('6.0.0', '5.0.12')).toBe(true);
	expect(() => atLeast('5.0.12-beta', '5.0.12')).toThrow(/exact major\.minor\.patch/);
	expect(() => atLeast(undefined, '5.0.12')).toThrow(/exact major\.minor\.patch/);
});
