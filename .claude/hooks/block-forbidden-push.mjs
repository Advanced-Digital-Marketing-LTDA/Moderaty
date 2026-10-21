import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// AGENTS.md: never force-push, never push to main. Exit code 2 blocks the tool
// call and shows the reason to the agent; any malformed input blocks too.
// `git` plus any global options (-C <dir>, -c k=v, --git-dir <dir>, --no-pager, ...), then the
// push subcommand; the arguments after it are captured and judged separately.
// Anchoring on the subcommand keeps `git commit -m "push --force"` allowed.
const PUSH = /\bgit(?:\s+(?:-[Cc]\s+\S+|--(?:git-dir|work-tree|namespace|exec-path|super-prefix|config-env)\s+\S+|-{1,2}[^\s;&|]+))*\s+push\b([^;&|\n]*)/g;
const FORCE_ARGS = /\s--force(?:-with-lease)?\b|\s-[a-zA-Z]*f[a-zA-Z]*\b|\s\+\S/;
const MAIN_ARG = /\s(?:\S+:)?(?:refs\/heads\/)?main\b/;

export function forbiddenPushReason(command) {
	if (typeof command !== 'string') throw new Error('Hook input has no string tool_input.command');
	for (const [, args] of command.matchAll(PUSH)) {
		if (FORCE_ARGS.test(args)) return 'git push --force is forbidden by AGENTS.md';
		if (MAIN_ARG.test(args)) return 'pushing to main is forbidden by AGENTS.md; only the human merges dev to main';
	}
	return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		const input = JSON.parse(readFileSync(0, 'utf8'));
		if (input?.tool_name !== 'Bash') process.exit(0);
		const reason = forbiddenPushReason(input.tool_input?.command);
		if (reason) { console.error(`Blocked: ${reason}`); process.exit(2); }
	} catch (error) {
		console.error(`Blocked: push guard could not read hook input: ${error instanceof Error ? error.message : String(error)}`);
		process.exit(2);
	}
}
