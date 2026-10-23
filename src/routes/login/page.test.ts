// SSR render tests for the sign-in page (MSG-9): a visitor arriving from a
// "Connect YouTube channel" CTA must be able to get back home and reach the
// legal pages and support without signing in, and the copy must separate the
// identity sign-in from the later YouTube permission.

import { render } from 'svelte/server';
import { expect, test, vi } from 'vitest';

vi.mock('$app/state', () => ({
	page: { url: new URL('https://moderaty.example/login') }
}));

import Page from './+page.svelte';

function renderPage(locale: 'en' | 'pt-BR') {
	return render(Page, { props: { data: { locale } } as never }).body;
}

test.each(['en', 'pt-BR'] as const)('the Google button stays the only call to action (%s)', (locale) => {
	const body = renderPage(locale);
	// Svelte appends a scoping class; the switcher's "btn secondary small" is not a call to action.
	expect(body.match(/class="btn(?: svelte-\w+)?"/g)).toHaveLength(1);
	expect(body).toContain('href="/api/auth/google/login"');
});

test.each(['en', 'pt-BR'] as const)('links home, to the legal pages and to support (%s)', (locale) => {
	const body = renderPage(locale);
	for (const href of ['/', '/privacy', '/terms', '/contact']) expect(body).toContain(`href="${href}"`);
});

test('the return links sit in a labelled navigation landmark', () => {
	expect(renderPage('en')).toMatch(/<nav[^>]*aria-label="More about Moderaty"/);
	expect(renderPage('pt-BR')).toMatch(/<nav[^>]*aria-label="Mais sobre o Moderaty"/);
});

test('explains that signing in grants no YouTube access, before the button', () => {
	const body = renderPage('en');
	const scope = body.indexOf('Signing in only confirms who you are');
	expect(scope).toBeGreaterThan(-1);
	expect(body).toContain('Connecting a channel is a separate step, with its own Google permission screen.');
	expect(scope).toBeLessThan(body.indexOf('href="/api/auth/google/login"'));
});

test('explains the free preview without promising more than it does (en)', () => {
	expect(renderPage('en')).toContain(
		'Once a channel is connected, a free preview shows what Moderaty would do without changing any comments on YouTube.'
	);
});

test('the explainer is translated (pt-BR)', () => {
	const body = renderPage('pt-BR');
	expect(body).toContain('Entrar apenas confirma quem você é');
	expect(body).toContain('uma prévia gratuita mostra o que o Moderaty faria sem alterar nenhum comentário no YouTube');
});
