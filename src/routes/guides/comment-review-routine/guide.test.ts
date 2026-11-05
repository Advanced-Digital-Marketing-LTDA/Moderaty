import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import Guide from './+page.svelte';
import GuidesIndex from '../+page.svelte';
import { COMMENT_REVIEW_ROUTINE, COMMENT_REVIEW_ROUTINE_SECTIONS } from '$lib/blogs/comment-review-routine';
import { MODERATION_GUIDE } from '$lib/blogs/moderation-guide';
import { COMMENT_SETTINGS_GUIDE } from '$lib/blogs/comment-settings-guide';
import { PUBLIC_BLOG_ROUTE_IDS, llmsTxt, sitemapXml } from '$lib/server/siteIndex';

vi.mock('$env/dynamic/private', () => ({ env: { APP_URL: 'https://preview.example' } }));
const data = { locale: 'en' as const, canonical: null, siteOrigin: 'https://preview.example' };
const page = () => render(Guide, { props: { data } });
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
const articleUrl = `https://preview.example${COMMENT_REVIEW_ROUTINE.path}`;

test('the article has its own title, canonical URL, and heading', () => {
	const { head, body } = page();
	expect(head).toContain(`<title>${COMMENT_REVIEW_ROUTINE.title} | Moderaty</title>`);
	expect(head).toContain(`<link rel="canonical" href="${articleUrl}"`);
	expect(body).toContain(`<h1>${COMMENT_REVIEW_ROUTINE.title}</h1>`);
});

test('every table-of-contents section has a matching heading anchor in the article', () => {
	const { body } = page();
	for (const section of COMMENT_REVIEW_ROUTINE_SECTIONS) {
		expect(body).toMatch(new RegExp(`<h2 id="${section.id}"[^>]*>`));
	}
});

test('related guides and product pages are linked with site-relative paths', () => {
	const links = hrefs(page().body);
	expect(links).toEqual(expect.arrayContaining([MODERATION_GUIDE.path, COMMENT_SETTINGS_GUIDE.path, '/how-it-works/', '/pricing']));
	expect(links.filter((href) => href.includes('moderaty.com'))).toEqual([]);
});

test('the breadcrumb links back to the guides index, and the index lists the article', () => {
	const crumbs = page().body.split('aria-label="Breadcrumb"')[1].split('</nav>')[0];
	expect(hrefs(crumbs)).toEqual(['/', '/guides/']);
	expect(hrefs(render(GuidesIndex, { props: { data } }).body)).toContain(COMMENT_REVIEW_ROUTINE.path);
});

test('the article is discoverable through the sitemap, llms.txt, and the blog route list', () => {
	expect(sitemapXml()).toContain(`<loc>${articleUrl}</loc>`);
	expect(llmsTxt()).toContain(`](${articleUrl})`);
	expect(PUBLIC_BLOG_ROUTE_IDS).toContain('/guides/comment-review-routine');
});
