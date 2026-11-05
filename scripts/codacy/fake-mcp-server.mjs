import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Test support: a stand-in for codacy-mcp-server that answers the two MCP calls
// the gate makes. Per-test behaviour comes from env vars:
//   FAKE_PAYLOAD        tool result text (default: a clean, empty result)
//   FAKE_RPC_ERROR      answer every analysis call with a JSON-RPC error
//   FAKE_RUNNER_STDERR  runner status text written to stderr for each call; `{tool}`
//                       stands for the tool's display name. Default: a clean run.
//   FAKE_LOG            every analysis call's arguments are appended here.
export const FAKE_SERVER_SOURCE = [
	'#!/usr/bin/env node',
	"const fs = require('node:fs');",
	"const readline = require('node:readline');",
	"const NAMES = { trivy: 'Trivy', semgrep: 'Semgrep', biome: 'Biome', shellcheck: 'shellcheck', hadolint: 'Hadolint' };",
	'const send = (message) => process.stdout.write(JSON.stringify(Object.assign({ jsonrpc: \'2.0\' }, message)) + \'\\n\');',
	'function runnerStatus(tool) {',
	'  const name = NAMES[tool] || tool;',
	'  if (process.env.FAKE_RUNNER_STDERR !== undefined) return process.env.FAKE_RUNNER_STDERR.split(\'{tool}\').join(name) + \'\\n\';',
	"  return 'Starting analysis (' + name + ', 1 files)\\nAnalysis complete (' + name + ', 0 issues, 0.1s)\\n';",
	'}',
	'readline.createInterface({ input: process.stdin }).on(\'line\', (line) => {',
	'  const msg = JSON.parse(line);',
	'  if (msg.id === undefined) return;',
	'  if (msg.method === \'initialize\') {',
	'    send({ id: msg.id, result: { protocolVersion: \'2024-11-05\', capabilities: {}, serverInfo: { name: \'fake\', version: \'0\' } } });',
	'    return;',
	'  }',
	'  const args = msg.params.arguments;',
	'  if (process.env.FAKE_LOG) fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(args) + \'\\n\');',
	'  process.stderr.write(runnerStatus(args.tool));',
	'  if (process.env.FAKE_RPC_ERROR) {',
	'    send({ id: msg.id, error: { code: -32000, message: process.env.FAKE_RPC_ERROR } });',
	'    return;',
	'  }',
	'  send({ id: msg.id, result: { content: [{ type: \'text\', text: process.env.FAKE_PAYLOAD || \'\' }] } });',
	'});',
	'',
].join('\n');

/** Writes an executable fake server into `dir` and returns its path. */
export function writeFakeServer(dir) {
	const bin = join(dir, 'codacy-mcp-server');
	writeFileSync(bin, FAKE_SERVER_SOURCE);
	chmodSync(bin, 0o755);
	return bin;
}
