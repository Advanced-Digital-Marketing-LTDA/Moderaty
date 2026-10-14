import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import { HOMEPAGE_FAQ_ENTRIES } from '$lib/landing/faq';
import Homepage from './+page.svelte';

vi.mock('$app/state', () => ({
	page: { data: { locale: 'en' }, url: new URL('https://moderaty.com/') }
}));

const renderHomepage = (siteOrigin = 'https://moderaty.com') =>
	render(Homepage, { props: { data: { siteOrigin, locale: 'en' as const } } });


test('MC-3 homepage owns the commercial query, metadata, and canonical URL', () => {
	const { head } = renderHomepage();
	expect(head).toContain('AI YouTube Comment Moderation Software | Moderaty');
	expect(head).toContain('Moderate YouTube comments with custom rules, AI scoring, human review, and an audit log.');
	expect(head).toContain('rel="canonical" href="https://moderaty.com/"');
});

test('MC-3 renders the approved rules-first hero and working conversion paths', () => {
	const { body } = renderHomepage();
	expect(body).toContain('AI YouTube comment moderation.');
	expect(body).toContain('Your rules come first.');
	expect(body).toContain('Connect your YouTube channel');
	expect(body).toContain('href="/login"');
	expect(body).toContain('href="/pricing"');
});

test('MC-3 supplies an explicitly synthetic moderation example, not invented performance claims', () => {
	const { body } = renderHomepage();
	for (const phrase of [
		'Review example moderation decisions',
		'Could you explain step two in another video?',
		'Subscribe to my channel for prizes!',
		'The music is too loud in the first minute.',
		'Illustrative examples',
		'Hold for review'
	]) {
		expect(body).toContain(phrase);
	}
	expect(body).not.toMatch(/\d+% (?:accurate|accuracy|time saved|faster)/i);
});

test('MC-3 states what is and is not moderated and explains access without overpromising', () => {
	const { body } = renderHomepage();
	for (const phrase of [
		'published top-level YouTube comments',
		'reply threads',
		'live chat',
		'youtube.force-ssl',
		'Deleted comments cannot be restored.',
		'Author bans cannot be reversed inside Moderaty.',
		'href="/privacy"'
	]) {
		expect(body).toContain(phrase);
	}
	expect(body).not.toContain('href="/guides/youtube-comment-moderation/"');
});

test('MC-3 shows the approved five FAQs and matching structured data', () => {
	const { body, head } = renderHomepage();
	expect(HOMEPAGE_FAQ_ENTRIES).toHaveLength(5);
	for (const { q } of HOMEPAGE_FAQ_ENTRIES) expect(body).toContain(q);
	const scripts = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) =>
		JSON.parse(match[1]) as { '@type': string; mainEntity?: unknown }
	);
	const faq = scripts.find((entry) => entry['@type'] === 'FAQPage');
	expect(faq?.mainEntity).toEqual(HOMEPAGE_FAQ_ENTRIES.map(({ q, a }) => ({
		'@type': 'Question',
		name: q,
		acceptedAnswer: { '@type': 'Answer', text: a }
	})));
});

test('MC-3 primary navigation anchors resolve on the homepage', () => {
	const { body } = renderHomepage();
	for (const anchor of ['how-it-works', 'moderation-preview', 'digest', 'scope', 'faq']) {
		expect(body).toContain('href="/#' + anchor + '"');
		expect(body).toContain('id="' + anchor + '"');
	}
});

test.each(['https://moderaty.com', 'https://selfhost.example', 'http://localhost:5173'])(
	'homepage metadata follows configured origin %s, not the Moderaty production domain',
	(siteOrigin) => {
		const { head } = renderHomepage(siteOrigin);
		const home = new URL('/', siteOrigin).href;
		const image = new URL('/og.png', siteOrigin).href;
		expect(head).toContain(`rel="canonical" href="${home}"`);
		expect(head).toContain(`property="og:url" content="${home}"`);
		expect(head).toContain(`property="og:image" content="${image}"`);
		expect(head).toContain(`name="twitter:image" content="${image}"`);
		if (siteOrigin !== 'https://moderaty.com') expect(head).not.toContain('https://moderaty.com');
	}
);

test('history-scan FAQ includes monthly paid allowances, purchased credits and lifetime BYOK', () => {
	const answer = HOMEPAGE_FAQ_ENTRIES.find(({ q }) => q === 'Can Moderaty remove old comments?')?.a;
	expect(answer).toContain('available paid subscription allowance');
	expect(answer).toContain('purchased credits');
	expect(answer).toContain('usable OpenAI key');
});

test('explains that connecting an eligible channel may start live moderation before any preview', () => {
	const { body } = renderHomepage();
	expect(body).toContain('Live moderation may start as soon as you connect a channel');
	expect(body).toContain('Previews do not change YouTube comments or pause live moderation');
	expect(body).not.toMatch(/before enabling live actions|before they go live|before taking action|before allowing irreversible actions/i);
});

test('direct preview links disclose that an active channel can keep moderating', () => {
	const { body } = renderHomepage();
	const preview = body.split('id="moderation-preview"')[1]?.split('</section>')[0];
	expect(preview).toBeDefined();
	expect(preview).toMatch(/A dry run does not change YouTube comments or pause\s+live moderation\./);
	expect(preview).toContain('live actions may continue while you preview');
});

test('hero shows the animated review-queue demo with its labeled illustrative counters', () => {
	const { body } = renderHomepage();
	const hero = body.split('id="top"')[1]?.split('</section>')[0];
	expect(hero).toBeDefined();
	expect(hero).toMatch(/role="figure"[^>]*aria-label="Illustrative demonstration of the Moderaty review queue"/);
	expect(hero).toContain('an illustrative night');
	expect(hero).toContain('live-dot');
	expect(hero).toContain('Illustrative moderation workflow');
});
