import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import Guide from './+page.svelte';
import { MODERATION_GUIDE, MODERATION_GUIDE_EDITION } from '$lib/blogs/moderation-guide';
import { PUBLIC_BLOG_ROUTE_IDS, sitemapXml } from '$lib/server/siteIndex';
import { readingText } from '../../blogs/article-text';
import HateArticle from '../../blogs/how-to-deal-with-hate-comments-on-youtube/+page.svelte';
import SpamArticle from '../../blogs/how-to-stop-spam-and-scam-comments-on-youtube/+page.svelte';

vi.mock('$env/dynamic/private', () => ({ env: { APP_URL: 'https://preview.example' } }));
const data = { locale: 'en' as const, canonical: null, siteOrigin: 'https://preview.example' };
const page = () => render(Guide, { props: { data } });
const article = () => page().body.split('<article')[1].split('</article>')[0];

test('ROOT has its own configured canonical and public discovery without publishing placeholder clusters', () => {
	const { body, head } = page();
	expect(head).toContain('rel="canonical" href="https://preview.example/guides/youtube-comment-moderation/"');
	expect(head).not.toContain('https://moderaty.com');
	expect(head).toContain('<title>YouTube comment moderation: settings, filters and tools | Moderaty</title>');
	expect(head).toContain(`name="description" content="${MODERATION_GUIDE.description}"`);
	expect(sitemapXml()).toContain('<loc>https://preview.example/guides/youtube-comment-moderation/</loc>');
	expect(PUBLIC_BLOG_ROUTE_IDS).toContain('/guides/youtube-comment-moderation');
	for (const provisional of ['/guides/youtube-comment-overload/', '/guides/youtube-comment-moderation-settings/', '/youtube-comment-moderation-tools/', '/guides/ai-comment-moderation/', '/guides/youtube-comment-feedback/']) {
		expect(body).not.toContain(`href="${provisional}"`);
	}
});

test('ROOT preserves editorial requirements, the decision journey and accessible table semantics', () => {
	const body = article();
	expect(body.indexOf('id="summary"')).toBeLessThan(body.indexOf('id="key-takeaways"'));
	expect(body.indexOf('id="key-takeaways"')).toBeLessThan(body.indexOf('id="choose-an-action"'));
	for (const id of ['native-settings', 'blocked-words-and-links', 'review-comments', 'review-workload', 'choose-a-tool', 'test-automation', 'audience-feedback', 'first-check', 'frequently-asked-questions', 'about-the-author']) expect(body).toContain(`id="${id}"`);
	expect(body).toContain('Andrew Philip Weilbacher');
	expect(body).toContain('founder of Moderaty and a YouTube Creator.');
	expect(body).toContain('datetime="2026-10-24"');
	expect(body.match(/scope="col"/g)).toHaveLength(2);
	expect(body.match(/scope="row"/g)).toHaveLength(4);
	expect(body).toMatch(/<caption\b/);
	expect(body).not.toMatch(/Primary source register|Editorial review notes|—/);
	const words = readingText(body).split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
	expect(MODERATION_GUIDE_EDITION.readingMinutes).toBe(Math.max(1, Math.ceil(words / 200)));
});

test('the refreshed guide renders instructions, a filter comparison and brand copy without raw Markdown', () => {
	const body = article();
	const text = readingText(body);
	expect(body).toContain('<li>Open Settings, then Community moderation.</li>');
	expect(body).toContain('<li>Select Content controls.</li>');
	expect(body).toContain('<caption id="settings-caption">YouTube comment moderation settings</caption>');
	for (const setting of ['None', 'Basic', 'Strict', 'Hold all']) {
		expect(body).toContain(`<th scope="row">${setting}</th>`);
	}
	expect(text).toContain('Even the Ackchyually Guy can spot a mistake worth fixing.');
	expect(text).toContain('Keep “skill issue” in your drafts.');
	expect(text).toContain('My priority is to keep questions and useful criticism visible.');
	expect(body).toContain('href="/#scope"');
	expect(body).toContain('href="/#moderation-preview"');
	expect(text).not.toMatch(/#{1,6}\s|\[[^\]]+\]\(https?:|title:|description:|Editorial note:/);
});

test('all article fragments resolve and external citations open safely', () => {
	const body = article();
	const ids = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id));
	for (const [, id] of body.matchAll(/href="#([^"]+)"/g)) expect(ids.has(id)).toBe(true);
	const external = [...body.matchAll(/<a\b([^>]*href="https?:[^>]+)>/g)];
	expect(external.length).toBeGreaterThan(5);
	for (const [, attrs] of external) {
		expect(attrs).toContain('target="_blank"');
		expect(attrs).toMatch(/rel="[^"]*\bnoopener\b/);
	}
});

test('existing B01 and D01 articles link back to ROOT, which links to their real destinations', () => {
	for (const [Page, path] of [[HateArticle, '/blogs/how-to-deal-with-hate-comments-on-youtube/'], [SpamArticle, '/blogs/how-to-stop-spam-and-scam-comments-on-youtube/']] as const) {
		expect(render(Page, { props: { data } }).body).toContain(`href="${MODERATION_GUIDE.path}"`);
		expect(article()).toContain(`href="${path}"`);
	}
});
