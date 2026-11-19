import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import Page from './+page.svelte';
import {
	COMMENTSHARK_ACTION_PACKS,
	COMMENTSHARK_COMPARISON,
	COMMENTSHARK_COMPARISON_SECTIONS,
	COMMENTSHARK_PLANS,
	COMMENTSHARK_RETRIEVED,
	COMMENTSHARK_SOURCES,
	COMPARISON_ROWS,
	MODERATY_PLANS
} from '$lib/blogs/commentshark-comparison';
import { INCLUDED_COMMENTS, MONTHLY_PLAN_USD } from '$lib/landing/cost';
import { TOP_UP_BUNDLES_COPY } from '$lib/landing/plans';
import { PUBLIC_BLOG_ROUTE_IDS, PUBLIC_PAGES, canonicalUrl, llmsTxt, sitemapXml } from '$lib/server/siteIndex';

vi.mock('$env/dynamic/private', () => ({ env: { APP_URL: 'https://preview.example' } }));

const data = { siteOrigin: 'https://preview.example', canonical: null, locale: 'en' as const };
const pageUrl = `https://preview.example${COMMENTSHARK_COMPARISON.path}`;
const rendered = () => render(Page, { props: { data } });
const text = (html: string) => html.replace(/<!--.*?-->/gs, '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const rowsOf = (html: string, captionId: string) => {
	const table = html.match(new RegExp(`<table>\\s*<caption id="${captionId}">.*?</table>`, 's'))?.[0] ?? '';
	return [...table.matchAll(/<tbody>(.*?)<\/tbody>/gs)].flatMap(([, body]) => [...body.matchAll(/<tr>(.*?)<\/tr>/gs)].map(([, row]) => row));
};

test('the comparison page is a public, sitemap-listed page that survives a database outage', () => {
	expect(COMMENTSHARK_COMPARISON.path).toBe('/moderaty-vs-commentshark/');
	expect(PUBLIC_PAGES).toContain(COMMENTSHARK_COMPARISON.path);
	expect(PUBLIC_BLOG_ROUTE_IDS).toContain('/moderaty-vs-commentshark');
	expect(sitemapXml()).toContain(`<loc>${pageUrl}</loc>`);
	expect(llmsTxt()).toContain(`](${pageUrl})`);
	expect(canonicalUrl(COMMENTSHARK_COMPARISON.path)).toBeNull();
});

test('the title and description fit search results with the site suffix', () => {
	expect(`${COMMENTSHARK_COMPARISON.title} | Moderaty`.length).toBeLessThanOrEqual(60);
	expect(COMMENTSHARK_COMPARISON.description.length).toBeLessThanOrEqual(160);
	expect(rendered().head).toContain(`<title>${COMMENTSHARK_COMPARISON.title} | Moderaty</title>`);
});

test('the page has one H1 and every contents entry points at a real heading', () => {
	const { body } = rendered();
	expect((body.match(/<h1\b/g) ?? []).length).toBe(1);
	for (const section of COMMENTSHARK_COMPARISON_SECTIONS) expect(body, section.id).toContain(`<h2 id="${section.id}" tabindex="-1">${section.title}</h2>`);
});

test('the comparison table renders every row of the data, in both columns', () => {
	const rows = rowsOf(rendered().body, 'at-a-glance-caption');
	expect(rows).toHaveLength(COMPARISON_ROWS.length);
	COMPARISON_ROWS.forEach((row, index) => {
		const cells = [...rows[index].matchAll(/<t[hd]\b[^>]*>(.*?)<\/t[hd]>/gs)].map(([, cell]) => text(cell).trim());
		expect(cells).toEqual([row.topic, row.moderaty, row.commentshark]);
	});
});

test('the CommentShark plan table lists every plan with its price and limits', () => {
	const rows = rowsOf(rendered().body, 'commentshark-plans-caption');
	expect(rows).toHaveLength(COMMENTSHARK_PLANS.length);
	COMMENTSHARK_PLANS.forEach((plan, index) => {
		const cells = [...rows[index].matchAll(/<t[hd]\b[^>]*>(.*?)<\/t[hd]>/gs)].map(([, cell]) => text(cell).trim());
		expect(cells).toEqual([plan.name, plan.price, plan.rules, plan.actions, plan.checks]);
	});
	const prose = text(rendered().body);
	for (const pack of COMMENTSHARK_ACTION_PACKS) expect(prose).toContain(`${pack.name}, ${pack.actions} actions for ${pack.price}`);
});

test("Moderaty's own prices come from the plan constants, not from copy on this page", () => {
	const rows = rowsOf(rendered().body, 'moderaty-plans-caption');
	const flat = rows.map((row) => text(row));
	expect(flat.join(' ')).toContain(`$${MONTHLY_PLAN_USD} a month`);
	expect(flat.join(' ')).toContain(`${INCLUDED_COMMENTS} AI classifications`);
	expect(flat.join(' ')).toContain(TOP_UP_BUNDLES_COPY);
	expect(MODERATY_PLANS.map((plan) => plan.name)).toEqual(['Self-hosted', 'Hosted monthly', 'Top-up credits', 'Lifetime']);
	const centsEach = (MONTHLY_PLAN_USD * 100) / INCLUDED_COMMENTS;
	expect(text(rendered().body)).toContain(`${+centsEach.toFixed(2)}¢ per comment on the monthly plan`);
});

test('every CommentShark source is an https link opened safely, and the retrieval date is shown', () => {
	const { body } = rendered();
	expect(COMMENTSHARK_RETRIEVED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	expect(body).toContain(`<time datetime="${COMMENTSHARK_RETRIEVED}">${COMMENTSHARK_RETRIEVED}</time>`);
	for (const source of Object.values(COMMENTSHARK_SOURCES)) {
		expect(source.href).toMatch(/^https:\/\/www\.commentshark\.com\//);
		expect(body).toContain(`<a href="${source.href}" target="_blank" rel="noopener noreferrer">${source.label}</a>`);
	}
});

test('the page states the billing-unit difference and that Moderaty never writes replies', () => {
	const prose = text(rendered().body);
	expect(prose).toContain('CommentShark counts an action when a rule matches a comment');
	expect(prose).toContain('Moderaty spends one credit on each comment it scores with AI');
	expect(prose).toContain('Moderaty never writes a reply');
});

test('the page does not use the homepage-only tagline or claim to catch everything', () => {
	const prose = text(rendered().body);
	expect(prose).not.toContain('Never read another hate comment');
	expect(prose).not.toMatch(/catch(es)? every|never see|100% /i);
});
