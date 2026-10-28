import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import { HOMEPAGE_FAQ_ENTRIES } from '$lib/landing/faq';
import Homepage from './+page.svelte';

vi.mock('$app/state', () => ({
	page: { data: { locale: 'en' }, url: new URL('https://moderaty.com/') }
}));

const renderHomepage = (siteOrigin = 'https://moderaty.com') =>
	render(Homepage, { props: { data: { siteOrigin, locale: 'en' as const, canonical: null } } });

const visibleText = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();


test('MC-3 homepage owns the commercial query, metadata, and canonical URL', () => {
	const { head } = renderHomepage();
	expect(head).toContain('AI YouTube Comment Moderation Software | Moderaty');
	expect(head).toContain('Moderate YouTube comments with custom rules, AI scoring, human review, and an audit log.');
	// meta, og:description, twitter:description, and the SoftwareApplication JSON-LD share one description.
	expect(head.match(/Run a free moderation preview on your own channel first\./g)).toHaveLength(4);
	expect(head).not.toContain('Try Moderaty with a free moderation preview.');
	expect(head).toContain('rel="canonical" href="https://moderaty.com/"');
});

test('MC-3 renders the approved rules-first hero and working conversion paths', () => {
	const { body } = renderHomepage();
	expect(body).toContain('AI YouTube comment moderation.');
	expect(body).not.toContain('Your rules come first.');
	expect(body).toContain('Connect your YouTube channel');
	expect(body).toContain('href="/login"');
	expect(body).toContain('href="/pricing"');
});

test('homepage does not promise live-moderation timing or free preview terms in the hero', () => {
	const { body } = renderHomepage();
	const hero = body.split('id="top"')[1]?.split('</section>')[0];
	expect(hero).toBeDefined();
	const heroText = visibleText(hero ?? '');
	expect(heroText).not.toContain(
		'Each connected channel gets one free moderation dry run and one free feedback dry run; neither uses credits. Live moderation may start as soon as you connect a channel if your plan permits it. Previews do not change YouTube comments or pause live moderation.'
	);
	expect(heroText).not.toContain(
		'Each connected channel gets one free moderation dry run and one free feedback dry run; neither uses credits.'
	);
	expect(heroText).not.toContain('Live moderation may start as soon as you connect a channel if your plan permits it.');
	expect(heroText).not.toContain('Previews do not change YouTube comments or pause live moderation.');
	expect(body).not.toMatch(/before enabling live actions|before they go live|before taking action|before allowing irreversible actions/i);
});

test('MC-3 supplies an explicitly synthetic moderation example, not invented performance claims', () => {
	const { body } = renderHomepage();
	const preview = body.split('id="moderation-preview"')[1]?.split('</section>')[0];
	expect(preview).toBeDefined();
	for (const phrase of [
		'Review example moderation decisions',
		'Could you explain step two in another video?',
		'Subscribe to my channel for prizes!',
		'The music is too loud in the first minute.',
		'Fictional comments and example moderation outcomes',
		'Hold for review'
	]) {
		expect(body).toContain(phrase);
	}
	const previewText = visibleText(preview ?? '');
	expect(previewText).not.toContain(
		'The comments and decisions below are Illustrative examples, not real viewers, measured accuracy results, or a live scan. They show how creator-selected rules and review can work together.'
	);
	expect(body).not.toMatch(/\d+% (?:accurate|accuracy|time saved|faster)/i);
});

test('MC-3 states what is and is not moderated and explains access without overpromising', () => {
	const { body } = renderHomepage();
	for (const phrase of [
		'published top-level YouTube comments',
		'reply threads',
		'live chat',
		'youtube.force-ssl',
		'href="/privacy"'
	]) {
		expect(body).toContain(phrase);
	}
	const homepageText = visibleText(body);
	for (const removedDisclosure of [
		'You can restore held and rejected comments.',
		'Deleted comments cannot be restored.',
		'Author bans cannot be reversed inside Moderaty.',
		'Review your rules carefully: active channels can apply irreversible moderation actions automatically.'
	]) {
		expect(homepageText).not.toContain(removedDisclosure);
	}
	expect(homepageText).not.toMatch(/every action reversible|reversible, always/i);
	expect(body).not.toContain('href="/guides/youtube-comment-moderation/"');
});

test('homepage retains a concise irreversible-action disclosure in the visible FAQ', () => {
	const { body } = renderHomepage();
	expect(visibleText(body)).toContain(
		'Held and rejected comments can be restored. Deletions are permanent, and Moderaty cannot lift an author ban inside the app.'
	);
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

test('direct preview links remain available without the removed live-action dry-run disclaimer', () => {
	const { body } = renderHomepage();
	const preview = body.split('id="moderation-preview"')[1]?.split('</section>')[0];
	expect(preview).toBeDefined();
	const previewText = visibleText(preview ?? '');
	expect(previewText).toContain('Review example moderation decisions');
	expect(previewText).toContain('Fictional comments and example moderation outcomes');
	expect(preview).toContain('href="/login"');
	expect(previewText).not.toContain(
		'Important: A dry run does not change YouTube comments or pause live moderation. On an active connected channel, live actions may continue while you preview.'
	);
	expect(previewText).not.toContain('A dry run does not change YouTube comments or pause live moderation.');
	expect(previewText).not.toContain('On an active connected channel, live actions may continue while you preview.');
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

test('hero shows the animated review-queue demo with its labeled illustrative counters', () => {
	const { body } = renderHomepage();
	const hero = body.split('id="top"')[1]?.split('</section>')[0];
	expect(hero).toBeDefined();
	expect(hero).toMatch(/role="figure"[^>]*aria-label="Illustrative demonstration of the Moderaty review queue: fictional comments arrive one at a time, rules and AI scores stamp each one approved, held, rejected, deleted or banned, and counters track incoming, actioned and read-by-you totals\."/);
	expect(hero).toContain('an illustrative night');
	expect(hero).toContain('live-dot');
	expect(hero).not.toContain('Illustrative moderation workflow');
	expect(hero).not.toContain('workflow-example');
});

test('homepage keeps the meme-culture voice alongside the factual disclosures', () => {
	const { body } = renderHomepage();
	const hero = body.split('id="top"')[1]?.split('</section>')[0];
	expect(hero).toMatch(/<h1[^>]*>Never read another hate comment\.<\/h1>/);
	expect(hero).toMatch(/<p class="tagline[^"]*">Trolls get <span class="marker">the hammer<\/span><\/p>/);
	expect(hero).not.toMatch(/<h2/);
	expect(visibleText(hero ?? '')).toContain('connected YouTube channels. Your rules swing first');
	const regulars = body.split('id="regulars"')[1]?.split('</section>')[0];
	expect(regulars).toContain('Meet the regulars.');
	for (const rogue of ['The Ackchyually Guy', 'The Edge Lord', 'The Crypto Bot', 'The Brigadier']) {
		expect(regulars).toContain(rogue);
	}
	expect(visibleText(body)).not.toContain(
		'Illustrative comments and possible decisions. Your rules and AI scores determine the outcome.'
	);
	expect(body).toContain('Moderaty wants to');
	expect(body).toMatch(/<h2[^>]*class="section-title[^"]*">Asked, answered\.<\/h2>/);
	const finalCta = body.split('class="final-cta')[1]?.split('</section>')[0];
	expect(finalCta).toMatch(/<h2[^>]*>Go touch grass\. <span class="marker">/);
});

test('the Regulars, Manifesto and FAQ sections are named landmarks', () => {
	const { body } = renderHomepage();
	for (const [section, heading] of [['regulars', 'Meet the regulars.'], ['manifesto', 'Moderaty wants to'], ['faq', 'Asked, answered.']] as const) {
		const open = body.match(new RegExp(`<section[^>]*aria-labelledby="${section}-title"[^>]*>`));
		expect(open).not.toBeNull();
		expect(body).toMatch(new RegExp(`<h2[^>]*id="${section}-title"[^>]*>[^<]*${heading.replace('.', '\\.')}`));
	}
});

test('the meme copy does not overclaim against competitors or the review queue', () => {
	const { body } = renderHomepage();
	expect(body).not.toMatch(/Every other comment tool/);
	const hero = body.split('id="top"')[1]?.split('</section>')[0];
	expect(hero).not.toContain("so you don't have to");
	const finalCta = body.split('class="final-cta')[1]?.split('</section>')[0];
	expect(finalCta).not.toMatch(/\bonly look at\b/i);
});

test('the hero keeps threats out of the punchline', () => {
	const hero = renderHomepage().body.split('id="top"')[1]?.split('</section>')[0];
	expect(hero).toContain('Just bonks.');
	expect(hero).not.toMatch(/threat/i);
});

test('the Regulars section comes right after the hero', () => {
	const { body } = renderHomepage();
	const hero = body.indexOf('id="top"');
	const regulars = body.indexOf('id="regulars"');
	const howItWorks = body.indexOf('id="how-it-works"');
	expect(hero).toBeGreaterThan(-1);
	expect(regulars).toBeGreaterThan(hero);
	expect(howItWorks).toBeGreaterThan(regulars);
});

test('each animated Regulars card carries a descriptive label naming the fictional archetype and its stamp', () => {
	const { body } = renderHomepage();
	const regulars = body.split('id="regulars"')[1]?.split('</section>')[0] ?? '';
	const labels = [...regulars.matchAll(/<article[^>]*aria-label="([^"]*)"/g)].map((match) => match[1]);
	expect(labels).toEqual([
		'Fictional example: the Ackchyually Guy posts a long, polite correction of your video. Stamp: held for review.',
		'Fictional example: the Edge Lord posts slurs and calls them dark humor. Stamp: banned.',
		'Fictional example: the Crypto Bot posts a fake get-rich-quick crypto claim. Stamp: deleted by a rule.',
		'Fictional example: the Brigadier arrives from a drama video to pile on. Stamp: held for review.'
	]);
});

test('homepage links to no individual blog post or guide', () => {
	const { body } = renderHomepage();
	expect(body).not.toMatch(/href="\/(?:blogs|guides)\/[^"]+"/);
});

test('homepage keeps its Source code link and the footer Blogs link', () => {
	const { body } = renderHomepage();
	expect(body).toMatch(/<a href="https:\/\/github\.com\/[^"]+"[^>]*>Source code/);
	expect(body).toMatch(/<a href="\/blogs\/" class="footer-link[^"]*">Blogs<\/a>/);
});

test('every homepage pricing link uses the one "See pricing" label', () => {
	const { body } = renderHomepage();
	const pricingLabels = [...body.matchAll(/<a[^>]*href="\/pricing"[^>]*>([\s\S]*?)<\/a>/g)]
		.map(([, label]) => visibleText(label).replace(/\s*→$/, ''))
		.filter((label) => label !== 'Pricing');
	expect(pricingLabels.length).toBeGreaterThanOrEqual(5);
	expect(new Set(pricingLabels)).toEqual(new Set(['See pricing']));
	expect(visibleText(body)).toContain('Preview your feedback digest');
	expect(visibleText(body)).not.toContain('Connect a channel to preview the feedback digest');
});
