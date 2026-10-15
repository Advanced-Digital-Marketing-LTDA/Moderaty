import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RATCHETS, compare, measure } from './lib.mjs';

export function parseArgs(argv) {
	const options = { ratchet: 'all', root: process.cwd(), baseline: null, update: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '--update') options.update = true;
		else if (['--ratchet', '--root', '--baseline'].includes(arg)) {
			const value = argv[++i];
			if (!value) throw new Error(`${arg} needs a value`);
			options[arg.slice(2)] = value;
		} else throw new Error(`Unknown argument: ${arg}`);
	}
	if (options.ratchet !== 'all' && !RATCHETS.includes(options.ratchet)) {
		throw new Error(`Unknown ratchet "${options.ratchet}"; expected one of: all, ${RATCHETS.join(', ')}`);
	}
	options.root = resolve(options.root);
	options.baseline = resolve(options.baseline ?? join(options.root, '.github/ratchets/baselines.json'));
	return options;
}

export function run(argv, log = console) {
	const options = parseArgs(argv);
	const ratchets = options.ratchet === 'all' ? RATCHETS : [options.ratchet];
	const current = measure(options.root, ratchets);
	if (options.update) {
		let existing = {};
		try { existing = JSON.parse(readFileSync(options.baseline, 'utf8')); } catch (error) {
			if (error?.code !== 'ENOENT') throw error;
		}
		mkdirSync(dirname(options.baseline), { recursive: true });
		writeFileSync(options.baseline, JSON.stringify({ ...existing, ...current }, null, '\t') + '\n');
		log.info(`Ratchet baseline updated: ${options.baseline}`);
		return 0;
	}
	const { failures, improvements } = compare(current, JSON.parse(readFileSync(options.baseline, 'utf8')), ratchets);
	for (const item of improvements) {
		log.warn(`::warning::Ratchet "${item.id}" improved (${item.baseline} -> ${item.current}); run "npm run ratchet:update" and commit to lock the gain in.`);
	}
	for (const item of failures) {
		const verb = item.direction === 'down' ? 'rose' : 'fell';
		log.error(`::error::Ratchet "${item.id}" ${verb}: baseline ${item.baseline}, now ${item.current}. Fix the regression; do not raise the baseline to hide it.`);
	}
	log.info(`Ratchet ${options.ratchet}: ${ratchets.length} group(s), ${failures.length} failure(s), ${improvements.length} improvement(s).`);
	return failures.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try { process.exitCode = run(process.argv.slice(2)); } catch (error) {
		console.error(`::error::Ratchet failed: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	}
}
