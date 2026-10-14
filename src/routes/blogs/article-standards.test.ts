import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import { HATE_COMMENTS, HATE_COMMENTS_EDITION } from '$lib/blogs/hate-comments';
import { SPAM_COMMENTS, SPAM_COMMENTS_EDITION } from '$lib/blogs/spam-comments';
import HateArticle from './how-to-deal-with-hate-comments-on-youtube/+page.svelte';
import SpamArticle from './how-to-stop-spam-and-scam-comments-on-youtube/+page.svelte';
import { readingText, visibleText } from './article-text';

const data = { locale: 'en' as const, siteOrigin: 'https://moderaty.com' };
const article = (Page: typeof HateArticle) =>
	render(Page, { props: { data } }).body.split('<article')[1].split('</article>')[0];
const wordCount = (html: string) => readingText(html).split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

const articles = [
	['hate comments', HateArticle, HATE_COMMENTS_EDITION, SPAM_COMMENTS.path],
	['spam comments', SpamArticle, SPAM_COMMENTS_EDITION, HATE_COMMENTS.path]
] as const;

test.each(articles)('the %s article shows its last-updated date and a reading time computed at 200 words per minute', (_, Page, edition) => {
	const body = article(Page);
	const byline = body.match(/<p class="byline[^"]*">(.*?)<\/p>/s)?.[1] ?? '';
	expect(edition.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	const formatted = new Date(`${edition.updated}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
	expect(byline).toContain(`<time datetime="${edition.updated}">${formatted}</time>`);
	const minutes = Math.max(1, Math.ceil(wordCount(body) / 200));
	expect(edition.readingMinutes).toBe(minutes);
	expect(byline).toContain(`${minutes} min read`);
});

test.each(articles)('the %s reading time skips both copies of the contents list', (_, Page) => {
	const body = article(Page);
	expect(visibleText(body)).toContain('On this page');
	expect(readingText(body)).not.toContain('On this page');
	expect(readingText(body)).toContain('Frequently asked questions');
});

test.each(articles)('the %s article links to the other guide and keeps prose free of em dashes', (_, Page, __, otherPath) => {
	const body = article(Page);
	expect(body).toContain(`href="${otherPath}"`);
	expect(visibleText(body)).not.toContain('—');
});

test('the spam article opens with a summary, then key takeaways, then the contents', () => {
	const body = article(SpamArticle);
	const summary = body.indexOf('id="summary"');
	const takeaways = body.indexOf('id="takeaways"');
	const contents = body.indexOf('aria-label="On this page"');
	expect(summary).toBeGreaterThan(-1);
	expect(summary).toBeLessThan(takeaways);
	expect(takeaways).toBeLessThan(contents);
});

test.each(articles)('the %s article uses question headings readers and answer engines can match', (_, Page) => {
	const headings = [...article(Page).matchAll(/<h2\b[^>]*>(.*?)<\/h2>/gs)].map(([, text]) => visibleText(text).trim());
	expect(headings.filter((text) => text.endsWith('?')).length).toBeGreaterThanOrEqual(4);
});
