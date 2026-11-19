import { redirect } from '@sveltejs/kit';
import { YOUTUBE_MONEY_CALCULATOR } from '$lib/tools/youtube-money-content';
import type { RequestHandler } from './$types';

// This slug was retired when the page became the YouTube Income Estimator.
// Served on demand so the 301 survives alongside the prerendered pages.
export const prerender = false;
export const trailingSlash = 'always';

export const GET: RequestHandler = ({ url }) => {
	throw redirect(301, `${YOUTUBE_MONEY_CALCULATOR.path}${url.search}`);
};
