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

test('guides index has its own canonical, lists the guide, and is discoverable', () => {
	const { body, head } = render(GuidesIndex, { props: { data } });
	expect(head).toContain('rel="canonical" href="https://preview.example/guides/"');
	expect(body).toContain(`href="${MODERATION_GUIDE.path}"`);
	expect(body).toContain(`<h1>${GUIDES_INDEX.title}</h1>`);
	expect(sitemapXml()).toContain('<loc>https://preview.example/guides/</loc>');
	expect(llmsTxt()).toContain('https://preview.example/guides/');
	expect(PUBLIC_BLOG_ROUTE_IDS).toContain('/guides');
});

test('the guide breadcrumb links back to the guides index', () => {
	const { body } = render(Guide, { props: { data } });
	expect(body).toContain('<li><a href="/guides/">Guides</a></li>');
});

test('footer links to the guides index', () => {
	expect(render(Footer).body).toMatch(/<a href="\/guides\/" class="footer-link[^"]*">Guides<\/a>/);
});
