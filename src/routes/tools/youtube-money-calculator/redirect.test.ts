import { isRedirect } from '@sveltejs/kit';
import { expect, test } from 'vitest';
import { GET, prerender, trailingSlash } from './+server';

function redirectFor(search: string) {
	try {
		GET({ url: new URL(`https://preview.example/tools/youtube-money-calculator/${search}`) } as Parameters<typeof GET>[0]);
	} catch (thrown) {
		if (isRedirect(thrown)) return thrown;
		throw thrown;
	}
	throw new Error('GET returned a response instead of redirecting');
}

test('the retired calculator path permanently redirects to the income estimator', () => {
	const redirect = redirectFor('');
	expect(redirect.status).toBe(301);
	expect(redirect.location).toBe('/tools/youtube-income-estimator/');
});

test('the redirect keeps the query string', () => {
	expect(redirectFor('?utm_source=newsletter').location).toBe('/tools/youtube-income-estimator/?utm_source=newsletter');
});

test('the endpoint is served on demand with the trailing slash the tools layout uses', () => {
	expect(prerender).toBe(false);
	expect(trailingSlash).toBe('always');
});
