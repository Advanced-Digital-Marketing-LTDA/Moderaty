import { render } from 'svelte/server';
import { parse, type AST } from 'svelte/compiler';
import { expect, test, vi } from 'vitest';
import Guide from './+page.svelte';
import { MODERATION_GUIDE, MODERATION_GUIDE_EDITION } from '$lib/blogs/moderation-guide';
import { PUBLIC_BLOG_ROUTE_IDS, sitemapXml } from '$lib/server/siteIndex';
import { readingText } from '../../blogs/article-text';
import HateArticle from '../../blogs/how-to-deal-with-hate-comments-on-youtube/+page.svelte';
import SpamArticle from '../../blogs/how-to-stop-spam-and-scam-comments-on-youtube/+page.svelte';
import HomepageContent from '$lib/components/landing/HomepageContent.svelte';

vi.mock('$env/dynamic/private', () => ({ env: { APP_URL: 'https://preview.example' } }));
const data = { locale: 'en' as const, canonical: null, siteOrigin: 'https://preview.example' };
const page = () => render(Guide, { props: { data } });
const article = () => page().body.split('<article')[1].split('</article>')[0];

function textContent(node: AST.Fragment['nodes'][number]): string {
	if (node.type === 'Text') return node.data;
	if (node.type === 'RegularElement') return node.fragment.nodes.map(textContent).join('');
	return '';
}

function elementTexts(html: string, tag: string): string[] {
	const collect = (nodes: AST.Fragment['nodes']): string[] => nodes.flatMap((node) => {
		if (node.type !== 'RegularElement') return [];
		const own = node.name === tag ? [textContent(node)] : [];
		return own.concat(collect(node.fragment.nodes));
	});
	// Nest JSON-LD scripts so the parser reads HTML rather than component JavaScript.
	return collect(parse(`<div>${html}</div>`, { modern: true }).fragment.nodes);
}

function expectGuideTitle(head: string) {
	expect(elementTexts(head, 'title')).toEqual(['YouTube comment moderation: settings, filters and tools | Moderaty']);
}

function expectGuideInstructions(body: string) {
	expect(elementTexts(body, 'li')).toEqual(expect.arrayContaining([
		'Open Settings, then Community moderation.',
		'Select Content controls.'
	]));
	expect(elementTexts(body, 'caption')).toEqual(['YouTube comment moderation settings']);
}

test('ROOT has its own configured canonical and public discovery without publishing placeholder clusters', () => {
	const { body, head } = page();
	expect(head).toContain('rel="canonical" href="https://preview.example/guides/youtube-comment-moderation/"');
	expect(head).not.toContain('https://moderaty.com');
	expectGuideTitle(head);
	expect(head).toContain(`name="description" content="${MODERATION_GUIDE.description}"`);
	expect(sitemapXml()).toContain('<loc>https://preview.example/guides/youtube-comment-moderation/</loc>');
	expect(PUBLIC_BLOG_ROUTE_IDS).toContain('/guides/youtube-comment-moderation');
	expect(body).toContain('href="/guides/youtube-comment-moderation-settings/"');
	for (const provisional of ['/guides/youtube-comment-overload/', '/youtube-comment-moderation-tools/', '/guides/ai-comment-moderation/', '/guides/youtube-comment-feedback/']) {
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
	expectGuideInstructions(body);
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

test.each([
	{ name: 'title', part: 'head', pattern: /<title>[^<]*<\/title>/ },
	{ name: 'settings instruction', part: 'body', pattern: /<li>Open Settings, then Community moderation\.<\/li>/ },
	{ name: 'content-controls instruction', part: 'body', pattern: /<li>Select Content controls\.<\/li>/ },
	{ name: 'table caption', part: 'body', pattern: /<caption id="settings-caption">[^<]*<\/caption>/ }
] as const)('commented-out $name cannot satisfy the rendering checks', ({ part, pattern }) => {
	const original = page()[part];
	const commented = original.replace(pattern, (markup) => `<!--${markup}-->`);
	expect(commented).not.toBe(original);
	expect(() => {
		if (part === 'head') expectGuideTitle(commented);
		else expectGuideInstructions(commented);
	}).toThrow();
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

test('homepage fragment targets referenced by the guide exist on the rendered homepage', () => {
	const home = render(HomepageContent).body;
	const ids = new Set([...home.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => id));
	const fragments = [...article().matchAll(/href="\/#([^"]+)"/g)].map(([, id]) => id);
	expect(fragments).toHaveLength(2);
	for (const id of fragments) expect(ids.has(id), `Missing homepage section: ${id}`).toBe(true);
});

test('product coverage and preview limits remain explicit in the rendered guide', () => {
	const text = readingText(article());
	expect(text).toContain('Its coverage excludes reply threads, live chat and a separate sweep of comments YouTube already holds.');
	expect(text).toContain('Moderaty doesn’t write replies under your name.');
	expect(text).toContain('A comment may remain visible until YouTube confirms a requested hold.');
	expect(text).toContain('A preview can re-score comments from earlier moderation runs without changing them on YouTube.');
});

test('existing B01 and D01 articles link back to ROOT, which links to their real destinations', () => {
	for (const [Page, path] of [[HateArticle, '/blogs/how-to-deal-with-hate-comments-on-youtube/'], [SpamArticle, '/blogs/how-to-stop-spam-and-scam-comments-on-youtube/']] as const) {
		expect(render(Page, { props: { data } }).body).toContain(`href="${MODERATION_GUIDE.path}"`);
		expect(article()).toContain(`href="${path}"`);
	}
});
