import { expect, test } from 'vitest';
import { NICHE_CPM_ROWS, YOUTUBE_MONEY_CALCULATOR, YOUTUBE_MONEY_FAQ, YOUTUBE_MONEY_SOURCES } from './youtube-money-content';

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
