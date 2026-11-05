import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOOL_IDS } from '../scripts/codacy/runner-contract.mjs';

/** Writes a .codacy/codacy.config.json under `root` that enables the given gate tools. */
export function writeCodacyConfig(root, toolKeys = Object.keys(TOOL_IDS)) {
	const dir = join(root, '.codacy');
	mkdirSync(dir, { recursive: true });
	const tools = toolKeys.map((key) => ({ toolId: TOOL_IDS[key], patterns: [] }));
	writeFileSync(join(dir, 'codacy.config.json'), JSON.stringify({ version: 1, tools, exclude: [] }, null, 2));
}
