import { describe, expect, test } from 'vitest';
import { FALLBACK_TITLE_MARKUP, dropShadowedFallbackTitle } from './documentTitle';

const shell = (head: string) => `<html><head>${head}${FALLBACK_TITLE_MARKUP}</head><body></body></html>`;

describe('dropShadowedFallbackTitle', () => {
	test('removes the shell fallback title when a route supplied its own', () => {
		const html = dropShadowedFallbackTitle(shell('<title>Pricing | Moderaty</title>'));
		expect(html).toBe(`<html><head><title>Pricing | Moderaty</title></head><body></body></html>`);
		expect(html.match(/<title/g)).toHaveLength(1);
	});

	test('keeps the fallback when it is the only title', () => {
		const html = shell('<meta charset="utf-8" />');
		expect(dropShadowedFallbackTitle(html)).toBe(html);
	});

	test('only strips the fallback, never a route title that happens to match it', () => {
		const html = dropShadowedFallbackTitle(shell('<title>Moderaty</title>'));
		expect(html).toBe(`<html><head><title>Moderaty</title></head><body></body></html>`);
	});

	test('fails loudly when the document carries duplicate titles the fallback cannot explain', () => {
		const html = '<html><head><title>A</title><title>B</title></head></html>';
		expect(() => dropShadowedFallbackTitle(html)).toThrow(/duplicate <title>/i);
	});
});
