import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import { FAQ_ENTRIES } from '$lib/landing/faq';
import Homepage from './+page.svelte';

vi.mock('$app/state', () => ({
	page: { data: { locale: 'en' }, url: new URL('https://moderaty.com/') }
}));

test('MC-3 homepage owns the commercial query, metadata, and canonical URL', () => {
	const { head } = render(Homepage);
	expect(head).toContain('AI YouTube Comment Moderation Software | Moderaty');
	expect(head).toContain('Moderate YouTube comments with custom rules, AI scoring, human review, and an audit log.');
	expect(head).toContain('rel="canonical" href="https://moderaty.com/"');
});

test('MC-3 renders the approved rules-first hero and working conversion paths', () => {
	const { body } = render(Homepage);
	expect(body).toContain('AI YouTube comment moderation.');
	expect(body).toContain('Your rules come first.');
	expect(body).toContain('Connect your YouTube channel');
	expect(body).toContain('href="/login"');
	expect(body).toContain('href="/pricing"');
});

test('MC-3 supplies an explicitly synthetic moderation example, not invented performance claims', () => {
	const { body } = render(Homepage);
	for (const phrase of [
		'See the decisions before they go live',
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
	const { body } = render(Homepage);
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
	const { body, head } = render(Homepage);
	expect(FAQ_ENTRIES).toHaveLength(5);
	for (const { q } of FAQ_ENTRIES) expect(body).toContain(q);
	const scripts = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) =>
		JSON.parse(match[1]) as { '@type': string; mainEntity?: unknown }
	);
	const faq = scripts.find((entry) => entry['@type'] === 'FAQPage');
	expect(faq?.mainEntity).toEqual(FAQ_ENTRIES.map(({ q, a }) => ({
		'@type': 'Question',
		name: q,
		acceptedAnswer: { '@type': 'Answer', text: a }
	})));
});

test('MC-3 primary navigation anchors resolve on the homepage', () => {
	const { body } = render(Homepage);
	for (const anchor of ['how-it-works', 'moderation-preview', 'digest', 'scope', 'faq']) {
		expect(body).toContain('href="/#' + anchor + '"');
		expect(body).toContain('id="' + anchor + '"');
	}
});
