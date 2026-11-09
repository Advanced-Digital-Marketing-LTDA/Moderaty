import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import Page from './+page.svelte';
import { NICHE_CPM_NOTE, YOUTUBE_MONEY_CALCULATOR, YOUTUBE_MONEY_EDITION, YOUTUBE_MONEY_FAQ, NICHE_CPM_ROWS } from '$lib/tools/youtube-money-content';

const data = { siteOrigin: 'https://preview.example', canonical: null, locale: 'en' as const };
const rendered = () => render(Page, { props: { data } });
const articleUrl = `https://preview.example${YOUTUBE_MONEY_CALCULATOR.path}`;

function jsonLdBlocks(html: string): unknown[] {
	return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1].replace(/\\u003c/g, '<')));
}

test('the page has its own title, canonical URL and a visible H1', () => {
	const { head, body } = rendered();
	expect(head).toContain(`<title>${YOUTUBE_MONEY_CALCULATOR.title} | Moderaty</title>`);
	expect(head).toContain(`<link rel="canonical" href="${articleUrl}"`);
	expect(body).toMatch(/<h1>[^<]+<\/h1>/);
});

test('the JSON-LD graph carries a WebApplication and an FAQPage whose questions match the visible FAQ', () => {
	const { head, body } = rendered();
	const graph = jsonLdBlocks(head).find((block) => (block as { '@graph'?: unknown[] })['@graph']) as { '@graph': Record<string, unknown>[] };
	const app = graph['@graph'].find((node) => node['@type'] === 'WebApplication');
	const faq = graph['@graph'].find((node) => node['@type'] === 'FAQPage') as { mainEntity: { name: string }[] };
	expect(app).toBeDefined();
	expect(faq.mainEntity.map((question) => question.name)).toEqual(YOUTUBE_MONEY_FAQ.map((entry) => entry.q));
	for (const entry of YOUTUBE_MONEY_FAQ) expect(body).toContain(`>${entry.q}</summary>`);
});

test('every calculator field has a visible label', () => {
	const { body } = rendered();
	for (const label of [
		'Long-form monthly views',
		'Long-form RPM',
		'Shorts monthly views',
		'Shorts RPM',
		'Monthly income goal',
		'Niche',
		'Share of views that are monetized'
	]) {
		expect(body, label).toMatch(new RegExp(`<label[^>]*>[^<]*${label}`));
	}
});

test('before any submit the result area shows a prompt and no error or numbers', () => {
	const { body } = rendered();
	expect(body).toContain('Nothing is estimated until you do');
	expect(body).not.toContain('role="alert"');
});

test('the last-updated date is visible', () => {
	const { body } = rendered();
	expect(body).toContain(`datetime="${YOUTUBE_MONEY_EDITION.updated}"`);
	expect(body).toContain('9 November 2026');
});

test('the niche table is labelled as CPM with its source and date, and lists every row', () => {
	const { body } = rendered();
	expect(body).toContain(NICHE_CPM_NOTE);
	expect(body).toContain('2026-08-19');
	for (const row of NICHE_CPM_ROWS) expect(body).toContain(row.niche);
});

test('the Moderaty block stays literal and makes no earnings promise', () => {
	const { body } = rendered();
	expect(body).toContain('What is in the comments under those views');
	expect(body).toContain('does not reply to viewers');
	expect(body).not.toMatch(/grow your (earnings|income)|earn more|guarantee|we raise your rpm/i);
	expect(body).toContain('href="/login"');
	expect(body).toContain('href="/pricing"');
});

test('the page links only to site-relative pages and the cited YouTube sources', () => {
	const { body } = rendered();
	expect(body).not.toMatch(/href="https:\/\/moderaty\.com/);
	expect(body).toContain('href="https://support.google.com/youtube/answer/72902"');
});

test('the page source makes no network calls and has no placeholder copy', () => {
	const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
	expect(source).not.toMatch(/\bfetch\(/);
	expect(source).not.toMatch(/lorem ipsum/i);
});
