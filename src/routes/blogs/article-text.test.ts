import { describe, expect, it } from 'vitest';

import { visibleText, withoutHtmlComments } from './article-text';

describe('withoutHtmlComments', () => {
	it('removes the comment markers Svelte renders and keeps everything around them', () => {
		expect(withoutHtmlComments('<dd><!---->$9.00<!--[--><b>x</b><!--]--></dd>')).toBe('<dd>$9.00<b>x</b></dd>');
	});

	it('leaves markup without comments unchanged', () => {
		expect(withoutHtmlComments('<p>plain</p>')).toBe('<p>plain</p>');
	});

	it('removes a comment that the removal of another comment would assemble', () => {
		expect(withoutHtmlComments('a<!<!---->-- x -->b')).toBe('ab');
	});

	it('fails loudly on a comment that never closes', () => {
		expect(() => withoutHtmlComments('a<!-- never closed')).toThrow(/unterminated/i);
	});
});

describe('visibleText', () => {
	it('drops tags and keeps the text between them', () => {
		expect(visibleText('<p>one<b>two</b></p>').replace(/\s+/g, ' ').trim()).toBe('one two');
	});
});
