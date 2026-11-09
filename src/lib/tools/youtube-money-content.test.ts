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
