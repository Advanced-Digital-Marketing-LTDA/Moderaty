import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import Page from './+page.svelte';
import { NICHE_CPM_NOTE, YOUTUBE_MONEY_CALCULATOR, YOUTUBE_MONEY_EDITION, YOUTUBE_MONEY_FAQ, YOUTUBE_MONEY_SECTIONS, YOUTUBE_MONEY_SOURCES, NICHE_CPM_ROWS } from '$lib/tools/youtube-money-content';
import { PUBLIC_BLOG_ROUTE_IDS, llmsTxt, sitemapXml } from '$lib/server/siteIndex';

vi.mock('$env/dynamic/private', () => ({ env: { APP_URL: 'https://preview.example' } }));

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
	expect(app).toMatchObject({ name: 'YouTube money calculator', url: articleUrl, applicationCategory: 'FinanceApplication' });
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

test('the copy keeps the sourced meaning of the Shorts pool and the entry thresholds', () => {
	const text = rendered().body.replace(/\s+/g, ' ');
	expect(text).toContain('only half of the revenue associated with engaged views is allocated to the Creator Pool');
	expect(text).toContain('with two tracks, one third');
	expect(text).toContain('The new entry thresholds do not apply to creators already in the program.');
	expect(text).toContain('you need at least 10 million qualified Shorts views in the last 90 days');
	expect(text).not.toMatch(/set aside/);
});

test('the calculator is listed in the sitemap, llms.txt and the blog route list', () => {
	expect(sitemapXml()).toContain(`<loc>${articleUrl}</loc>`);
	expect(llmsTxt()).toContain(`](${articleUrl})`);
	expect(PUBLIC_BLOG_ROUTE_IDS).toContain('/tools/youtube-money-calculator');
});

test('the page source makes no network calls and has no placeholder copy', () => {
	const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
	expect(source).not.toMatch(/\bfetch\(/);
	expect(source).not.toMatch(/lorem ipsum/i);
});

test('the lead says only a required number triggers a message, since the goal is optional', () => {
	expect(rendered().body.replace(/\s+/g, ' ')).toMatch(/if a required number is missing or wrong/i);
});

test('the niche conversion states its one-impression-per-playback assumption', () => {
	expect(rendered().body.replace(/\s+/g, ' ')).toContain('This assumes each monetized playback shows one ad impression.');
});

test('source links name their page instead of the bare word Source', () => {
	const { body } = rendered();
	expect(body).not.toContain('>Source</a>');
	expect(body).toContain(`>${YOUTUBE_MONEY_SOURCES.partnerEarnings.label}</a>`);
});

// Source guards for styling, which server-rendered tests cannot measure. Browser checks cover the rendered result.
const pageSource = () => readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

test('calculator inputs are 16px, so iOS Safari does not zoom on focus', () => {
	expect(pageSource()).toMatch(/\.calculator input\[type='text'\],\s*\.calculator select \{[^}]*font-size: 16px/);
});

test('field and preset borders use a token that reaches 3:1 against the page background', () => {
	const source = pageSource();
	expect(source).toMatch(/\.calculator input\[type='text'\],\s*\.calculator select \{[^}]*border: 1px solid var\(--text-2\)/);
	expect(source).toMatch(/\.preset \{[^}]*border: 1px solid var\(--text-2\)/);
});

test('preset and submit buttons inherit the page font', () => {
	const source = pageSource();
	expect(source).toMatch(/\.preset \{[^}]*font: inherit/);
	expect(source).toMatch(/\.submit \{[^}]*font: inherit/);
});

test('the yearly figure wraps inside its box instead of breaking mid-number', () => {
	expect(pageSource()).toMatch(/\.figures dd \{[^}]*overflow-wrap: anywhere/);
});

test('FAQ answer paragraphs beat the editorial paragraph margin', () => {
	expect(pageSource()).toMatch(/details\.faq-item > p \{/);
});

test('FAQ questions show an expand marker', () => {
	const source = pageSource();
	expect(source).toMatch(/\.faq-item summary::after/);
	expect(source).toMatch(/\.faq-item\[open\] summary::after/);
});

test('results are a focus target and not a live region that re-reads the whole block', () => {
	const { body } = rendered();
	expect(body).toMatch(/class="results[^"]*" tabindex="-1"/);
	expect(body).not.toContain('aria-live="polite"');
});

test('RPM figures use the RPM formatter, so typed decimals are shown rather than rounded to cents', () => {
	const source = pageSource();
	expect(source).not.toMatch(/formatUsd\((row\.stream\.rpm|run\.outputs\.blendedRpm|nicheResult\.run\.rpm(Low|High))\)/);
	expect(source).toMatch(/formatRpm\(row\.stream\.rpm\)/);
});

test('the submit handler reports unexpected failures and shows a generic message', () => {
	const source = pageSource();
	// Anchored to a live statement at line start, so commented-out code cannot satisfy it.
	expect(source).toMatch(/^\s*run = guardUnexpected\(/m);
	expect(source).toContain("console.error('YouTube money calculator: submit failed'");
});

test('every label points at a control that exists, so the label names the field', () => {
	const { body } = rendered();
	const targets = [...body.matchAll(/<label[^>]* for="([^"]+)"/g)].map((match) => match[1]);
	expect(targets.length).toBeGreaterThan(5);
	for (const id of targets) expect(body, id).toContain(`id="${id}"`);
});

test('the revenue text colour reaches 3:1 against the page background, from the tokens in app.css', () => {
	const css = readFileSync(new URL('../../../app.css', import.meta.url), 'utf8');
	const token = (name: string) => {
		const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
		if (!match) throw new Error(`token --${name} not found in app.css`);
		return match[1];
	};
	const luminance = (hex: string) => {
		const channels = [1, 3, 5].map((index) => {
			const value = parseInt(hex.slice(index, index + 2), 16) / 255;
			return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	};
	const [light, dark] = [luminance(token('text-2')), luminance(token('bg'))].sort((a, b) => b - a);
	expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(3);
});

test('the FAQ paragraph rule sets the answer spacing', () => {
	expect(pageSource()).toMatch(/details\.faq-item > p \{[^}]*margin: 12px 0 0/);
});

test('the H1 and the title tag are exactly YouTube Money Calculator', () => {
	const { head, body } = rendered();
	expect(body).toMatch(/<h1>YouTube Money Calculator<\/h1>/);
	expect(head).toContain('<title>YouTube Money Calculator | Moderaty</title>');
});

test('the last-updated date sits once, above the calculator', () => {
	const { body } = rendered();
	expect((body.match(/Last updated/g) ?? []).length).toBe(1);
	expect(body.indexOf('Last updated')).toBeLessThan(body.indexOf('id="calculator-heading"'));
});

test('the content type is three real radios in a segmented group', () => {
	const { body } = rendered();
	expect((body.match(/type="radio"/g) ?? []).length).toBe(3);
	expect(body).toMatch(/class="choice segmented[^"]*"/);
});

test('the niche estimate is a collapsed details block, not an open section of the form', () => {
	const { body } = rendered();
	expect(body).toMatch(/<details class="niche[^"]*"(?![^>]*\bopen\b)[^>]*>/);
	expect(body).toContain("Don't know your RPM? Estimate it from a niche CPM");
});

test('the form and the result share one workspace, sticky beside the form from 760px', () => {
	const source = pageSource();
	expect(rendered().body).toMatch(/class="workspace[^"]*"/);
	expect(source).toMatch(/@media \(min-width: 760px\) \{[^}]*\.workspace \{ grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
	expect(source).toMatch(/\.workspace \.results \{ position: sticky/);
});

test('the monthly figure leads the figures and carries the accent bar', () => {
	const source = pageSource();
	expect(source).toMatch(/<div class="figure-main"><dt>Monthly<\/dt>/);
	expect(source).toMatch(/\.figures \.figure-main \{[^}]*border-left: 4px solid var\(--accent\)/);
});

test('the submit button uses the accent colour', () => {
	expect(pageSource()).toMatch(/\.submit \{[^}]*background: var\(--accent\)/);
});

test('the revenue shares are a table that keeps the sourced percentages', () => {
	const text = rendered().body.replace(/\s+/g, ' ');
	expect(text).toContain('Share of revenue you keep, by revenue type');
	expect(text).toContain('55% of net ad revenue on Watch Page ads');
	expect(text).toContain('45% of the revenue allocated to your Shorts');
	expect(text).toContain('70% of net revenue');
});

test('the Moderaty block is an aside with one button-style link to sign in and a plain pricing link', () => {
	const { body } = rendered();
	expect(body).toMatch(/<aside class="closing[^"]*"/);
	expect(body).toMatch(/class="cta[^"]*" href="\/login"/);
	expect(body).toContain('href="/pricing"');
});

const bodyText = () => rendered().body.replace(/\s+/g, ' ');
const JOKE = 'Views are free. Here is what they pay. Then there are the comments.';

test('the lead states the task and the answer', () => {
	expect(bodyText()).toContain(
		'and the YouTube Money Calculator returns daily, monthly and yearly earnings plus the views you need for an income goal. If a required number is missing or wrong, you get a message instead of a result.'
	);
});

test('the only joke sits once, in the closing block under the comments heading', () => {
	const text = bodyText();
	expect(text.split(JOKE)).toHaveLength(2);
	expect(text.indexOf(JOKE)).toBeGreaterThan(text.indexOf('id="comments"'));
});

test('each contents entry matches the h2 of its section', () => {
	const { body } = rendered();
	for (const section of YOUTUBE_MONEY_SECTIONS) expect(body, section.id).toContain(`<h2 id="${section.id}" tabindex="-1">${section.title}</h2>`);
});

test('the section headings are the questions the sections answer', () => {
	expect(YOUTUBE_MONEY_SECTIONS.map((section) => section.title)).toEqual([
		'How is YouTube revenue calculated?',
		'What is the difference between CPM and RPM?',
		'How much of the revenue do you keep?',
		'How is Shorts revenue calculated?',
		'What are typical CPM ranges by niche?',
		'Who can monetize: YouTube Partner Program requirements',
		'Frequently asked questions',
		'What is in the comments under those views'
	]);
});

test("the CPM section carries YouTube's worked example", () => {
	const text = bodyText();
	expect(text).toContain('$7 earned over 2,000 ad impressions is a $3.50 CPM');
	expect(text).toContain('the same $7 over 1,500 monetized playbacks is a $4.67 playback-based CPM');
});

test('the Shorts section covers the no-music case', () => {
	expect(bodyText()).toContain('A Short with no music sends all of its associated revenue to the pool.');
});

test('the niche intro names the highest and lowest CPM rows from the table data', () => {
	const highest = NICHE_CPM_ROWS.reduce((best, row) => (row.cpmHigh > best.cpmHigh ? row : best));
	const lowest = NICHE_CPM_ROWS.reduce((best, row) => (row.cpmHigh < best.cpmHigh ? row : best));
	const range = (row: (typeof NICHE_CPM_ROWS)[number]) => `$${row.cpmLow} to $${row.cpmHigh} in ${row.niche.toLowerCase()}`;
	expect(bodyText()).toContain(`They run from ${range(highest)} down to ${range(lowest)}.`);
});

const partnerSection = () => {
	const text = bodyText();
	const start = text.indexOf('id="partner-program"');
	const end = text.indexOf('id="faq"');
	if (start === -1 || end === -1 || end <= start) throw new Error('partner-program or faq heading not found in order');
	return text.slice(start, end);
};

test('the Partner Program section carries the thresholds, the terms deadline and the active-channel rule', () => {
	const section = partnerSection();
	for (const phrase of [
		'8,000 qualified watch hours in the previous 365 days, or 20 million qualified Shorts views in the previous 90 days',
		'1,000 subscribers',
		'500 subscribers and either 3,000 qualified watch hours in the last year or 3 million qualified Shorts views in the last 90 days',
		'you need at least 10 million qualified Shorts views in the last 90 days',
		'must accept the updated terms in YouTube Studio by 31 January 2027',
		'can regain access by accepting later, and stay in the program',
		'counts a channel as active',
		'1,000 qualified watch hours in the past 365 days, 1 million qualified Shorts views in the last 90 days, or 2 long-form videos or 5 Shorts uploaded every 90 days',
		'an extended 90-day window to meet the watch-hours or the Shorts-views requirement to stay in the program'
	]) {
		expect(section, phrase).toContain(phrase);
	}
});

test('the Partner Program section has no Sources paragraph and links both YouTube pages', () => {
	const section = partnerSection();
	expect(section).not.toContain('Sources:');
	expect(section).toContain(`href="${YOUTUBE_MONEY_SOURCES.programBlog.href}"`);
	expect(section).toContain(`href="${YOUTUBE_MONEY_SOURCES.programChanges.href}"`);
});

test('every external link opens in a new tab with rel noopener', () => {
	const anchors = [...rendered().body.matchAll(/<a\b[^>]*href="https?:\/\/[^"]*"[^>]*>/g)].map((match) => match[0]);
	expect(anchors.length).toBeGreaterThan(6);
	for (const anchor of anchors) {
		expect(anchor).toContain('target="_blank"');
		expect(anchor).toContain('rel="noopener"');
	}
});
