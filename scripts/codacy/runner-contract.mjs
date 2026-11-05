// Everything the gate assumes about the Codacy analysis runner, in one place.
// Observed with codacy-mcp 0.6.24 (its bundled @codacy/analysis-runner) against
// .codacy/codacy.config.json on 2026-11-05. The real-analyzer checks parse today's
// output; re-verify these patterns and the applicability table whenever codacy-mcp
// or the runner changes.

/** Config toolId per gate tool. ShellCheck's id is lowercase: the runner resolves tools by directory name. */
export const TOOL_IDS = {
	trivy: 'Trivy',
	semgrep: 'Semgrep',
	biome: 'Biome',
	shellcheck: 'shellcheck',
	hadolint: 'Hadolint',
};

// One starting and one complete line per tool run:
//   Starting analysis (<tool>, <n> files)
//   Analysis complete (<tool>, <n> issues[, <m> errors], <t>s)
// The runner prints the errors field only when it is non-zero, so an absent field is zero.
const STARTING = /^Starting analysis \(([^(),]+), (\d+) files\)$/;
const COMPLETE = /^Analysis complete \(([^(),]+), (\d+) issues(?:, (\d+) errors)?, \d+(?:\.\d+)?s\)$/;
const STATUS_LINE = /^(Starting analysis|Analysis complete)\b/;

/** The tool name in a status line that did not match either format, or 'unknown'. */
function toolFromLine(line) {
	const match = /\(([^(),]+),/.exec(line);
	return match ? match[1].trim() : 'unknown';
}

/**
 * Parses one runner line: a starting or complete record, an unrecognized status
 * line, or null for any line that is not a status line.
 */
export function parseRunnerLine(line) {
	if (!STATUS_LINE.test(line)) return null;
	const starting = STARTING.exec(line);
	if (starting) return { kind: 'starting', tool: starting[1], files: Number(starting[2]) };
	const complete = COMPLETE.exec(line);
	if (complete) return { kind: 'complete', tool: complete[1], issues: Number(complete[2]), errors: Number(complete[3] ?? 0) };
	return { kind: 'unrecognized', tool: toolFromLine(line), line };
}

/** Counts each tool's status lines, and records failures found in the lines themselves. */
function tallyStatusLines(lines) {
	const seen = new Map();
	const failures = [];
	for (const line of lines) {
		const parsed = parseRunnerLine(line);
		if (!parsed) continue;
		const key = parsed.tool.toLowerCase();
		if (parsed.kind === 'unrecognized') {
			failures.push({ tool: key, reason: `unrecognized runner line: ${line}` });
			continue;
		}
		const record = seen.get(key) ?? { started: 0, completed: 0 };
		seen.set(key, record);
		if (parsed.kind === 'starting') {
			record.started += 1;
			continue;
		}
		record.completed += 1;
		if (parsed.errors > 0) failures.push({ tool: key, reason: `${parsed.errors} errors reported` });
	}
	return { seen, failures };
}

/** Failures where the counted lines do not match how many runs each tool was asked for. */
function countFailures(seen, expected) {
	const failures = [];
	for (const [tool, runs] of expected) {
		const record = seen.get(tool) ?? { started: 0, completed: 0 };
		if (record.started !== runs) failures.push({ tool, reason: `expected ${runs} "Starting analysis" line(s), got ${record.started}` });
		if (record.completed !== runs) failures.push({ tool, reason: `expected ${runs} "Analysis complete" line(s), got ${record.completed}` });
	}
	for (const tool of seen.keys()) {
		if (!expected.has(tool)) failures.push({ tool, reason: 'the runner reported a tool that was not asked to run' });
	}
	return failures;
}

/**
 * Failures in one run's runner output. `expected` maps each lowercase tool to the
 * number of times the gate asked it to run. Every run needs one starting and one
 * complete line, no errors, and no unrecognized status line.
 */
export function runnerFailures(lines, expected) {
	const { seen, failures } = tallyStatusLines(lines);
	return [...failures, ...countFailures(seen, expected)];
}

/** Failures for gate tools missing from .codacy/codacy.config.json; `configText` is null when the file could not be read. */
export function configFailures(configText, tools) {
	if (configText === null) return [{ tool: 'config', reason: 'cannot read .codacy/codacy.config.json' }];
	let config;
	try {
		config = JSON.parse(configText);
	} catch {
		return [{ tool: 'config', reason: '.codacy/codacy.config.json is not valid JSON' }];
	}
	const toolIds = new Set(Array.isArray(config?.tools) ? config.tools.map((entry) => entry?.toolId) : []);
	return tools
		.filter((tool) => !toolIds.has(TOOL_IDS[tool]))
		.map((tool) => ({ tool, reason: `missing from .codacy/codacy.config.json (toolId ${TOOL_IDS[tool]})` }));
}

// Which files the runner analyzes with each tool, as observed on the real runner:
// Trivy and Semgrep take every file; Biome takes TypeScript, JavaScript (not .mjs or
// .cjs), CSS and JSON; ShellCheck takes .sh only (not extensionless hook scripts);
// Hadolint takes Dockerfiles.
const APPLIES = new Map([
	['trivy', () => true],
	['semgrep', () => true],
	['biome', (file) => /\.(ts|tsx|js|jsx|css|json)$/.test(file)],
	['shellcheck', (file) => /\.sh$/.test(file)],
	['hadolint', (file) => /(^|\/)([^/]*\.)?Dockerfile$/.test(file)],
]);

/** Whether the gate has a file-type mapping for `tool`. */
export function hasFileMapping(tool) {
	return APPLIES.has(tool);
}

/** The reason a tool with no file-type mapping blocks. */
function unmappedReason(tool) {
	return `no file-type mapping for tool ${tool}`;
}

/** Failures for hook tools with no file-type mapping; the gate cannot tell which files they take. */
export function mappingFailures(tools) {
	return tools.filter((tool) => !hasFileMapping(tool)).map((tool) => ({ tool, reason: unmappedReason(tool) }));
}

/** Whether the runner analyzes `file` with `tool`. Throws for a tool with no file-type mapping. */
export function appliesTo(tool, file) {
	const applies = APPLIES.get(tool);
	if (applies === undefined) throw new Error(unmappedReason(tool));
	return applies(file);
}
