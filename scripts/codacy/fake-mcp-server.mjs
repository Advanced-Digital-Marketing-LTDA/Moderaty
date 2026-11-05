import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Test support: a stand-in for codacy-mcp-server that answers the two MCP calls
// the gate makes. Per-test behaviour comes from FAKE_PAYLOAD (tool text) or
// FAKE_RPC_ERROR; every analysis call's arguments are appended to FAKE_LOG so
// tests can see which tools and files the gate asked for.
export const FAKE_SERVER_SOURCE = [
	'#!/usr/bin/env node',
	"const fs = require('node:fs');",
	"const readline = require('node:readline');",
	'const send = (message) => process.stdout.write(JSON.stringify(Object.assign({ jsonrpc: \'2.0\' }, message)) + \'\\n\');',
	'readline.createInterface({ input: process.stdin }).on(\'line\', (line) => {',
	'  const msg = JSON.parse(line);',
	'  if (msg.id === undefined) return;',
	'  if (msg.method === \'initialize\') {',
	'    send({ id: msg.id, result: { protocolVersion: \'2024-11-05\', capabilities: {}, serverInfo: { name: \'fake\', version: \'0\' } } });',
	'    return;',
	'  }',
	'  if (process.env.FAKE_LOG) fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify(msg.params.arguments) + \'\\n\');',
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
