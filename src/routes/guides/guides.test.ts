import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import GuidesIndex from './+page.svelte';
import Guide from './youtube-comment-moderation/+page.svelte';
import Footer from '$lib/components/landing/Footer.svelte';
import { MODERATION_GUIDE } from '$lib/blogs/moderation-guide';
import { GUIDES_INDEX } from '$lib/blogs/guides-index';
import { PUBLIC_BLOG_ROUTE_IDS, llmsTxt, sitemapXml } from '$lib/server/siteIndex';

vi.mock('$env/dynamic/private', () => ({ env: { APP_URL: 'https://preview.example' } }));
const data = { locale: 'en' as const, canonical: null, siteOrigin: 'https://preview.example' };
const index = () => render(GuidesIndex, { props: { data } });

const captures = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].map((match) => match[1]);
const hrefs = (source: string) => captures(source, /href="([^"]*)"/g);
const breadcrumb = (body: string) => body.split('aria-label="Breadcrumb"')[1].split('</nav>')[0];

test('guides index has its own canonical, lists the guide, and is discoverable', () => {
	const { body, head } = index();
	expect(head).toContain('rel="canonical" href="https://preview.example/guides/"');
	expect(hrefs(body)).toContain(MODERATION_GUIDE.path);
	expect(captures(body, /<h1[^>]*>(.*?)<\/h1>/g)).toEqual([GUIDES_INDEX.title]);
	expect(captures(sitemapXml(), /<loc>(.*?)<\/loc>/g)).toContain('https://preview.example/guides/');
	expect(llmsTxt()).toContain('https://preview.example/guides/');
	expect(PUBLIC_BLOG_ROUTE_IDS).toContain('/guides');
});

test('guides index renders the configured title and description metadata', () => {
	const { head } = index();
	const pageTitle = `${GUIDES_INDEX.title} | Moderaty`;
	expect(captures(head, /<title>(.*?)<\/title>/g)).toEqual([pageTitle]);
	expect(captures(head, /name="description" content="([^"]*)"/g)).toEqual([GUIDES_INDEX.description]);
	expect(captures(head, /property="og:title" content="([^"]*)"/g)).toEqual([pageTitle]);
	expect(captures(head, /property="og:description" content="([^"]*)"/g)).toEqual([GUIDES_INDEX.description]);
	const schema = JSON.parse(captures(head, /<script type="application\/ld\+json">(.*?)<\/script>/gs)[0]);
	expect(schema).toMatchObject({ '@type': 'CollectionPage', name: GUIDES_INDEX.title, description: GUIDES_INDEX.description, url: 'https://preview.example/guides/' });
});

test('the guide breadcrumb links back to the guides index', () => {
	const crumbs = breadcrumb(render(Guide, { props: { data } }).body);
	expect(hrefs(crumbs)).toEqual(['/', GUIDES_INDEX.path]);
	expect(captures(crumbs, /<a [^>]*>(.*?)<\/a>/g)).toEqual(['Home', 'Guides']);
});

test('footer links to the guides index', () => {
	expect(render(Footer).body).toMatch(/<a href="\/guides\/" class="footer-link[^"]*">Guides<\/a>/);
});
