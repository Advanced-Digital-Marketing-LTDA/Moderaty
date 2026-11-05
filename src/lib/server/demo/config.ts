import { error } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';

// Two independent production signals. APP_URL must be the public domain on
// prod (it builds the OAuth redirect_uri, docs/COOLIFY.md §3), and the
// production Google OAuth client is used only by the prod app and the main
// checkout's production .env (AGENTS.md, Environments). NODE_ENV cannot tell
// prod from dev: the Dockerfile sets NODE_ENV=production for both apps.
const PRODUCTION_HOSTS = new Set(['moderaty.com', 'www.moderaty.com']);
const PRODUCTION_GOOGLE_CLIENT_PREFIX = '880114106606-1t4edg0';

function refuse(message: string, detail: string): never {
	console.error(`demo pages refused: ${detail}`);
	throw error(500, message);
}

/**
 * Gate for every /demo load. Off (a plain 404, like a route that does not
 * exist) unless DEMO_PAGES_ENABLED is exactly 'true'. Any other non-empty
 * value, and 'true' on a production deployment, fail loudly.
 */
export function requireDemoPages(): void {
	const value = env.DEMO_PAGES_ENABLED;
	if (!value || value === 'false') throw error(404, 'Not Found');
	if (value !== 'true') refuse('DEMO_PAGES_ENABLED must be true or false', `DEMO_PAGES_ENABLED=${JSON.stringify(value)}`);
	if (!env.APP_URL) refuse('APP_URL is not configured', 'APP_URL is unset');
	const host = new URL(env.APP_URL).hostname.replace(/\.$/, '');
	if (PRODUCTION_HOSTS.has(host)) refuse('Demo pages are not available on this deployment', `APP_URL host ${host} is production`);
	if (env.GOOGLE_CLIENT_ID?.startsWith(PRODUCTION_GOOGLE_CLIENT_PREFIX)) {
		refuse('Demo pages are not available on this deployment', 'GOOGLE_CLIENT_ID is the production client');
	}
}
