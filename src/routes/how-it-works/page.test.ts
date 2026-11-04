// Copyright (C) 2026 Advanced Digital Marketing LTDA. Licensed under PolyForm Shield 1.0.0. See LICENSE.
import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';
import HowItWorks from './+page.svelte';

vi.mock('$app/state', () => ({
	page: { data: { locale: 'en' }, url: new URL('https://moderaty.example/how-it-works/') }
}));

const renderPage = (canonical = 'https://moderaty.example/how-it-works/') =>
	render(HowItWorks, { props: { data: { canonical, locale: 'en' as const } } });

test('the explainer leaves canonical ownership to the root layout and renders one main heading and FAQ schema', () => {
	const { body, head } = renderPage();
	expect(head).not.toContain('rel="canonical"');
	expect(head).toContain('property="og:url" content="https://moderaty.example/how-it-works/"');
	expect(body.match(/<h1\b/g)).toHaveLength(1);
	expect(body).toContain('id="rules"');
	expect(body).toContain('id="ai-scoring"');
	expect(body).toContain('id="review-history"');
	expect(body).toContain('id="feedback-digests"');
	expect(body).toContain('id="hosting"');
	expect(body).toContain('id="faq"');

	const schema = [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
		.map((match) => JSON.parse(match[1]) as { '@type': string; mainEntity?: unknown[] })
		.find((entry) => entry['@type'] === 'FAQPage');
	expect(schema).toBeDefined();
	expect(schema?.mainEntity).toHaveLength((body.match(/<details\b/g) ?? []).length);
});

test('every external evidence link opens a new tab with noopener', () => {
	const { body } = renderPage();
	const externalLinks = [...body.matchAll(/<a\b([^>]*href="https?:\/\/[^\"]+"[^>]*)>/g)];
	expect(externalLinks.length).toBeGreaterThan(0);
	for (const [, attributes] of externalLinks) {
		expect(attributes).toMatch(/\btarget="_blank"/);
		expect(attributes).toMatch(/\brel="[^\"]*\bnoopener\b[^\"]*"/);
	}
});

test('on-page navigation only points to rendered section ids', () => {
	const { body } = renderPage();
	for (const [, id] of body.matchAll(/<a\b[^>]*href="#([^\"]+)"[^>]*>/g)) {
		expect(body).toContain(`id="${id}"`);
	}
});
