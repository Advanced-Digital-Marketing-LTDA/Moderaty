import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import { readingText } from './blogs/article-text';
import Homepage from './+page.svelte';
import HowItWorks from './how-it-works/+page.svelte';
import Pricing from './pricing/+page.svelte';
import BlogsIndex from './blogs/+page.svelte';
import HateArticle from './blogs/how-to-deal-with-hate-comments-on-youtube/+page.svelte';
import SpamArticle from './blogs/how-to-stop-spam-and-scam-comments-on-youtube/+page.svelte';
import GuidesIndex from './guides/+page.svelte';
import RoutineGuide from './guides/comment-review-routine/+page.svelte';
import ModerationGuide from './guides/youtube-comment-moderation/+page.svelte';
import SettingsGuide from './guides/youtube-comment-moderation-settings/+page.svelte';
import Terms from '$lib/components/landing/legal/Terms.svelte';
import { HOMEPAGE_FAQ_ENTRIES } from '$lib/landing/faq';
import { PRICING_FAQ_ENTRIES } from '$lib/landing/pricing-faq';
import { HATE_COMMENTS, HATE_COMMENTS_EDITION } from '$lib/blogs/hate-comments';
import { SPAM_COMMENTS, SPAM_COMMENTS_EDITION } from '$lib/blogs/spam-comments';
import { COMMENT_REVIEW_ROUTINE, COMMENT_REVIEW_ROUTINE_EDITION } from '$lib/blogs/comment-review-routine';
import { MODERATION_GUIDE, MODERATION_GUIDE_EDITION } from '$lib/blogs/moderation-guide';
import { COMMENT_SETTINGS_GUIDE, COMMENT_SETTINGS_GUIDE_EDITION } from '$lib/blogs/comment-settings-guide';

// Structure only: canonical and social-preview addresses, link attributes,
// anchors, reading-time arithmetic, and JSON-LD shape. No assertion here reads
// rendered wording, so editing copy never requires editing this file.
const ORIGIN = 'https://moderaty.example';
const PRICING_CANONICAL = `${ORIGIN}/pricing`;

const mocks = vi.hoisted(() => ({ canonical: 'https://moderaty.example/pricing' as string | null }));
vi.mock('$app/state', () => ({
	page: { get data() { return { locale: 'en', canonical: mocks.canonical }; }, url: new URL('https://moderaty.example/') }
}));
vi.mock('$env/dynamic/private', () => ({ env: { APP_URL: 'https://moderaty.example' } }));

const pageData = (path: string, siteOrigin = ORIGIN) => ({
	locale: 'en' as const,
	canonical: new URL(path, siteOrigin).href,
	siteOrigin
});
const articleData = { locale: 'en' as const, canonical: null, siteOrigin: ORIGIN };

const attribute = (html: string, selector: 'property' | 'name' | 'rel', value: string, field: 'content' | 'href') => {
	const tags = [...html.matchAll(/<(?:meta|link)\b[^>]*>/g)].map((match) => match[0]);
	const tag = tags.find((candidate) => new RegExp(`\\b${selector}="${value}"`).test(candidate));
	return tag?.match(new RegExp(`\\b${field}="([^"]*)"`))?.[1];
};

const idsIn = (html: string) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id));

const externalAnchors = (html: string) => [...html.matchAll(/<a\b([^>]*href="https?:\/\/[^"]*"[^>]*)>/g)].map(([, attributes]) => attributes);

const homepageBody = render(Homepage, { props: { data: pageData('/') } }).body;

const PAGES = [
	{ name: 'homepage', path: '/', render: () => render(Homepage, { props: { data: pageData('/') } }) },
	{ name: 'how it works', path: '/how-it-works/', render: () => render(HowItWorks, { props: { data: pageData('/how-it-works/') } }) },
	{ name: 'pricing', path: '/pricing', render: () => render(Pricing) },
	{ name: 'blogs index', path: '/blogs/', render: () => render(BlogsIndex, { props: { data: articleData } }) },
	{ name: 'hate comments article', path: HATE_COMMENTS.path, render: () => render(HateArticle, { props: { data: articleData } }) },
	{ name: 'spam comments article', path: SPAM_COMMENTS.path, render: () => render(SpamArticle, { props: { data: articleData } }) },
	{ name: 'guides index', path: '/guides/', render: () => render(GuidesIndex, { props: { data: articleData } }) },
	{ name: 'comment review routine guide', path: COMMENT_REVIEW_ROUTINE.path, render: () => render(RoutineGuide, { props: { data: articleData } }) },
	{ name: 'moderation guide', path: MODERATION_GUIDE.path, render: () => render(ModerationGuide, { props: { data: articleData } }) },
	{ name: 'comment settings guide', path: COMMENT_SETTINGS_GUIDE.path, render: () => render(SettingsGuide, { props: { data: articleData } }) }
] as const;

// These pages leave the canonical tag to the root layout (see how-it-works
// /page.test history); their social URL must still match the address they serve.
const LAYOUT_CANONICAL = new Set<string>(['/how-it-works/', '/pricing']);
// Pages that must contain at least one link of the given kind, so an empty
// loop cannot pass silently.
const EXTERNAL_LINK_PATHS = new Set<string>(['/', '/how-it-works/', '/pricing', HATE_COMMENTS.path, SPAM_COMMENTS.path, COMMENT_REVIEW_ROUTINE.path, MODERATION_GUIDE.path, COMMENT_SETTINGS_GUIDE.path]);
const IN_PAGE_ANCHOR_PATHS = new Set<string>(['/how-it-works/', HATE_COMMENTS.path, SPAM_COMMENTS.path, COMMENT_REVIEW_ROUTINE.path, MODERATION_GUIDE.path, COMMENT_SETTINGS_GUIDE.path]);

test.each(PAGES)('$name declares its canonical address and matching social URL', ({ path, render: renderPage }) => {
	const { head } = renderPage();
	const expected = path === '/pricing' ? PRICING_CANONICAL : new URL(path, ORIGIN).href;
	if (LAYOUT_CANONICAL.has(path)) {
		// The root layout owns this tag; a page-level canonical would duplicate it.
		expect(attribute(head, 'rel', 'canonical', 'href')).toBeUndefined();
	} else {
		expect(attribute(head, 'rel', 'canonical', 'href')).toBe(expected);
	}
	expect(attribute(head, 'property', 'og:url', 'content')).toBe(expected);
});

test.each(PAGES)('$name ships only parseable JSON-LD blocks', ({ render: renderPage }) => {
	const { head } = renderPage();
	for (const [, json] of head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
		expect(() => JSON.parse(json)).not.toThrow();
	}
});

test.each(PAGES)('$name opens every external link in a new tab with noopener', ({ path, render: renderPage }) => {
	const { body } = renderPage();
	const anchors = externalAnchors(body);
	if (EXTERNAL_LINK_PATHS.has(path)) expect(anchors.length).toBeGreaterThan(0);
	for (const attributes of anchors) {
		expect(attributes).toMatch(/\btarget="_blank"/);
		expect(attributes).toMatch(/\brel="[^"]*\bnoopener\b[^"]*"/);
	}
});

test.each(PAGES)('$name anchors resolve within the page', ({ path, render: renderPage }) => {
	const { body } = renderPage();
	const ids = idsIn(body);
	const fragments = [...body.matchAll(/<a\b[^>]*href="#([^"]+)"/g)];
		if (IN_PAGE_ANCHOR_PATHS.has(path)) expect(fragments.length).toBeGreaterThan(0);
		for (const [, fragment] of fragments) {
		expect(ids.has(fragment)).toBe(true);
	}
});

test.each(PAGES)('$name links to homepage sections only when the homepage defines them', ({ render: renderPage }) => {
	const homepageIds = idsIn(homepageBody);
	const { body } = renderPage();
	for (const [, fragment] of body.matchAll(/<a\b[^>]*href="\/#([^"]+)"/g)) {
		expect(homepageIds.has(fragment)).toBe(true);
	}
});

test.each(PAGES)('$name never links to a hard-coded production host', ({ render: renderPage }) => {
	const { body, head } = renderPage();
	const hrefs = [...`${body}${head}`.matchAll(/href="([^"]*)"/g)].map(([, href]) => href);
	expect(hrefs.filter((href) => href.includes('moderaty.com'))).toEqual([]);
});

test('the homepage FAQ structured data mirrors the homepage FAQ constant', () => {
	const { head } = render(Homepage, { props: { data: pageData('/') } });
	const faq = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
		.map(([, json]) => JSON.parse(json) as { '@type': string; mainEntity?: unknown })
		.find((entry) => entry['@type'] === 'FAQPage');
	expect(faq?.mainEntity).toEqual(HOMEPAGE_FAQ_ENTRIES.map(({ q, a }) => ({
		'@type': 'Question',
		name: q,
		acceptedAnswer: { '@type': 'Answer', text: a }
	})));
});

test('the homepage links to no individual blog post or guide', () => {
	expect(homepageBody).not.toMatch(/href="\/(?:blogs|guides)\/[^"]+"/);
});

test.each(['https://selfhost.example', 'http://localhost:5173'])('homepage addresses follow the configured origin %s', (siteOrigin) => {
	const { head } = render(Homepage, { props: { data: pageData('/', siteOrigin) } });
	const home = new URL('/', siteOrigin).href;
	const image = new URL('/og.png', siteOrigin).href;
	expect(attribute(head, 'rel', 'canonical', 'href')).toBe(home);
	expect(attribute(head, 'property', 'og:url', 'content')).toBe(home);
	expect(attribute(head, 'property', 'og:image', 'content')).toBe(image);
	expect(attribute(head, 'name', 'twitter:image', 'content')).toBe(image);
	expect(head).not.toContain('https://moderaty.com');
});

test('pricing links to terms sections that exist on the terms page', () => {
	const { body } = render(Pricing);
	const terms = idsIn(render(Terms).body);
	const termsLinks = [...body.matchAll(/href="\/terms#([^"]+)"/g)];
	expect(termsLinks.length).toBeGreaterThan(0);
	for (const [, id] of termsLinks) {
		expect(terms.has(id)).toBe(true);
	}
});

test('pricing refuses to render without the layout canonical', () => {
	mocks.canonical = null;
	try {
		expect(() => render(Pricing).head).toThrow(/canonical/i);
	} finally {
		mocks.canonical = 'https://moderaty.example/pricing';
	}
});

test('pricing FAQ structured data mirrors the pricing FAQ constant', () => {
	const { head } = render(Pricing);
	const faq = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
		.map(([, json]) => JSON.parse(json) as { '@type': string; mainEntity?: unknown })
		.find((entry) => entry['@type'] === 'FAQPage');
	expect(faq?.mainEntity).toEqual(PRICING_FAQ_ENTRIES.map(({ q, a }) => ({
		'@type': 'Question',
		name: q,
		acceptedAnswer: { '@type': 'Answer', text: a }
	})));
});

const ARTICLES = [
	{ name: 'hate comments', body: () => render(HateArticle, { props: { data: articleData } }).body, path: HATE_COMMENTS.path, edition: HATE_COMMENTS_EDITION },
	{ name: 'spam comments', body: () => render(SpamArticle, { props: { data: articleData } }).body, path: SPAM_COMMENTS.path, edition: SPAM_COMMENTS_EDITION },
	{ name: 'comment review routine', body: () => render(RoutineGuide, { props: { data: articleData } }).body, path: COMMENT_REVIEW_ROUTINE.path, edition: COMMENT_REVIEW_ROUTINE_EDITION },
	{ name: 'moderation guide', body: () => render(ModerationGuide, { props: { data: articleData } }).body, path: MODERATION_GUIDE.path, edition: MODERATION_GUIDE_EDITION },
	{ name: 'comment settings guide', body: () => render(SettingsGuide, { props: { data: articleData } }).body, path: COMMENT_SETTINGS_GUIDE.path, edition: COMMENT_SETTINGS_GUIDE_EDITION }
] as const;

test.each(ARTICLES)('$name reports the reading time its text supports and a machine-readable update date', ({ body: renderBody, edition }) => {
	const body = renderBody().split('<article')[1].split('</article>')[0];
	expect(edition.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	const words = readingText(body).split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
	const minutes = Math.max(1, Math.ceil(words / 200));
	expect(edition.readingMinutes).toBe(minutes);
	expect(body).toContain(`<time datetime="${edition.updated}">`);
});
