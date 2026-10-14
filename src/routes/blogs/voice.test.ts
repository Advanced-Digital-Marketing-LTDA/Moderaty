import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import HateArticle from './how-to-deal-with-hate-comments-on-youtube/+page.svelte';
import SpamArticle from './how-to-stop-spam-and-scam-comments-on-youtube/+page.svelte';
import { visibleText } from './article-text';

const data = { locale: 'en' as const, siteOrigin: 'https://moderaty.com' };
const article = (Page: typeof HateArticle) =>
	render(Page, { props: { data } }).body.split('<article')[1].split('</article>')[0];
const paragraphs = (html: string) =>
	[...html.matchAll(/<p\b([^>]*)>(.*?)<\/p>/gs)]
		.filter(([, attrs]) => !/byline|contents-label/.test(attrs))
		.map(([, , text]) => visibleText(text));
const firstPerson = /\b(?:I|I’m|I've|I’ve|I'd|I’d|my|me)\b/;

test.each([
	['hate comments', HateArticle, 'Ackchyually'],
	['spam comments', SpamArticle, 'Crypto Bot']
] as const)('the %s article is written in the founder’s first-person meme voice', (_, Page, castMember) => {
	const body = article(Page);
	const prose = paragraphs(body).filter((text) => !text.includes('is the founder of Moderaty'));
	expect(firstPerson.test(prose[0])).toBe(true);
	const firstPersonShare = prose.filter((text) => firstPerson.test(text)).length / prose.length;
	expect(firstPersonShare).toBeGreaterThan(0.5);
	expect(body).toContain(castMember);
});

test('the hate-comments safety guidance stays sincere', () => {
	const body = article(HateArticle);
	const safety = body.split('id="report-harassment"')[1].split('<h2')[0];
	expect(safety).toContain('contact local emergency services');
	expect(safety).not.toMatch(/bonk|touch grass|lol|hammer|ackchyually/i);
});
