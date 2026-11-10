import { expect, test } from 'vitest';
import { calculate } from './youtube-money';
import { NICHE_CPM_ROWS, YOUTUBE_MONEY_CALCULATOR, YOUTUBE_MONEY_FAQ, YOUTUBE_MONEY_SOURCES } from './youtube-money-content';
import { formatCount, formatUsd } from './youtube-money-format';

test('every niche CPM row is a real range with a unique name', () => {
	for (const row of NICHE_CPM_ROWS) expect(row.cpmLow).toBeLessThan(row.cpmHigh);
	expect(new Set(NICHE_CPM_ROWS.map((row) => row.niche)).size).toBe(NICHE_CPM_ROWS.length);
});

test('the FAQ has the eight spec questions, each phrased as a question and answered', () => {
	expect(YOUTUBE_MONEY_FAQ).toHaveLength(8);
	for (const entry of YOUTUBE_MONEY_FAQ) {
		expect(entry.q.endsWith('?')).toBe(true);
		expect(entry.a.length).toBeGreaterThan(40);
		expect(entry.a).not.toMatch(/lorem|todo/i);
	}
});

test('the calculator path is a site-relative path with a trailing slash', () => {
	expect(YOUTUBE_MONEY_CALCULATOR.path).toBe('/tools/youtube-money-calculator/');
});

test('every cited source is an https link', () => {
	for (const source of Object.values(YOUTUBE_MONEY_SOURCES)) {
		expect(new URL(source.href).protocol).toBe('https:');
	}
});

const faqAnswer = (question: string) => {
	const entry = YOUTUBE_MONEY_FAQ.find((candidate) => candidate.q === question);
	if (!entry) throw new Error(`FAQ question missing: ${question}`);
	return entry.a;
};

test('the Shorts FAQ says the pool is split by engaged views and music use, as YouTube Help does', () => {
	expect(faqAnswer('Do Shorts earn less than long-form?')).toContain('engaged views and music use');
});

test('the monetized-share FAQ points to the niche estimate in the calculator, not below it', () => {
	const answer = faqAnswer('Do all views earn money?');
	expect(answer).not.toContain('does not ask for a monetized share');
	expect(answer).toContain('niche CPM estimate in the calculator');
});

test('the OutlierKit link label says its figures are CPM, because the page does not measure RPM', () => {
	expect(YOUTUBE_MONEY_SOURCES.cpmBenchmarks.label).toContain('CPM');
});

test('the meta description is the approved sentence and fits a search snippet', () => {
	expect(YOUTUBE_MONEY_CALCULATOR.description).toBe(
		'Free YouTube money calculator. Enter your monthly views and Studio RPM to see daily, monthly and yearly earnings and the views you need for an income goal.'
	);
	expect(YOUTUBE_MONEY_CALCULATOR.description.length).toBeLessThanOrEqual(160);
});

test.each([
	['How much does YouTube pay per 1,000 views?', 'Your RPM sets it.'],
	['What is the difference between CPM and RPM?', 'what an advertiser pays for 1,000 ad impressions'],
	['Do I need the YouTube Partner Program to earn ad revenue?', 'YouTube pays ad revenue on your videos'],
	['Is this calculator accurate?', 'reads no channel, audience or payout data']
])('the rewritten FAQ answer to %j says %j', (question, phrase) => {
	expect(faqAnswer(question)).toContain(phrase);
});

test('the 1 million views FAQ quotes what the calculator returns for 1,000,000 views at a $3.50 RPM', () => {
	const out = calculate([{ label: 'Long-form', views: 1_000_000, rpm: 3.5 }], null);
	expect(faqAnswer('How much does 1 million views pay?')).toContain(`$3.50 RPM, an example figure and not a benchmark, that is ${formatUsd(out.perMillionUsd)}`);
});

test('the $1,000 FAQ quotes the views the calculator says are needed at a $3.50 RPM', () => {
	const out = calculate([{ label: 'Long-form', views: 1_000_000, rpm: 3.5 }], 1000);
	if (out.viewsNeeded === null) throw new Error('a goal was given, so viewsNeeded must be set');
	expect(faqAnswer('How many views do I need to make $1,000 a month?')).toContain(`at least ${formatCount(out.viewsNeeded)} views a month`);
});
