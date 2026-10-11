import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { backupCodacyConfig, candidateHomes, npmPrefix, resolveServerBin } from './pre-push-gate.mjs';

const tempDirs = [];

function tempHome() {
	const dir = mkdtempSync(join(tmpdir(), 'codacy-gate-home-'));
	tempDirs.push(dir);
	return dir;
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
		const binDir = mkdtempSync(join(tmpdir(), 'codacy-gate-path-'));
		tempDirs.push(binDir);
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
		const root = mkdtempSync(join(tmpdir(), 'codacy-gate-root-'));
		tempDirs.push(root);
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
});
