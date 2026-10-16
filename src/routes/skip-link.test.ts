import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { expect, test } from 'vitest';
import SkipLink from '$lib/components/landing/SkipLink.svelte';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the skip link points at the default main target', () => {
	expect(render(SkipLink).body).toContain('href="#main-content"');
});

test('the skip link accepts another target', () => {
	expect(render(SkipLink, { props: { target: 'blog-content' } }).body).toContain('href="#blog-content"');
});

test.each([
	['homepage', './+page.svelte'],
	['pricing', './pricing/+page.svelte'],
	['contact', './contact/+page.svelte'],
	['contact verify', './contact/verify/+page.svelte'],
	['legal pages', '../lib/components/landing/legal/LegalPage.svelte']
])('%s renders the skip link and a focusable #main-content target', (_name, path) => {
	const source = read(path);
	expect(source).toContain('<SkipLink />');
	expect(source).toMatch(/<main id="main-content" tabindex="-1"/);
});

test('blog pages keep their own #blog-content target behind the shared component', () => {
	const source = read('./blogs/+layout.svelte');
	expect(source).toContain('<SkipLink target="blog-content" />');
	expect(source).toContain('<main id="blog-content"');
});
