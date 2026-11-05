import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));

import { requireDemoPages } from './config';

const DEV_CLIENT = '880114106606-kmn2b9p-synthetic.apps.googleusercontent.com';
const PROD_CLIENT = '880114106606-1t4edg0-synthetic.apps.googleusercontent.com';

function setEnv(values: Record<string, string | undefined>) {
	for (const key of Object.keys(mocks.env)) delete mocks.env[key];
	Object.assign(mocks.env, values);
}

// SvelteKit's HttpError is not an Error subclass, so capture it directly.
function thrownBy(run: () => unknown): unknown {
	try {
		run();
	} catch (thrown) {
		return thrown;
	}
	throw new Error('expected requireDemoPages() to throw');
}

afterEach(() => vi.restoreAllMocks());

test.each([undefined, '', 'false'])('flag %j is off: a plain 404 with no log', (value) => {
	setEnv({ DEMO_PAGES_ENABLED: value, APP_URL: 'http://localhost:5173', GOOGLE_CLIENT_ID: DEV_CLIENT });
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(thrownBy(() => requireDemoPages())).toMatchObject({ status: 404, body: { message: 'Not Found' } });
	expect(log).not.toHaveBeenCalled();
});

test('flag off never inspects APP_URL or the client id', () => {
	setEnv({ APP_URL: 'https://moderaty.com', GOOGLE_CLIENT_ID: PROD_CLIENT });
	expect(thrownBy(() => requireDemoPages())).toMatchObject({ status: 404 });
});

test.each(['yes', 'TRUE', '1', 'true '])('flag %j fails loudly', (value) => {
	setEnv({ DEMO_PAGES_ENABLED: value, APP_URL: 'http://localhost:5173', GOOGLE_CLIENT_ID: DEV_CLIENT });
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(thrownBy(() => requireDemoPages())).toMatchObject({ status: 500, body: { message: 'DEMO_PAGES_ENABLED must be true or false' } });
	expect(log).toHaveBeenCalledOnce();
});

test('flag true on a dev host passes', () => {
	setEnv({ DEMO_PAGES_ENABLED: 'true', APP_URL: 'http://localhost:5173', GOOGLE_CLIENT_ID: DEV_CLIENT });
	expect(requireDemoPages()).toBeUndefined();
});

test('flag true with no Google client configured passes', () => {
	setEnv({ DEMO_PAGES_ENABLED: 'true', APP_URL: 'http://localhost:5173' });
	expect(requireDemoPages()).toBeUndefined();
});

test.each(['https://moderaty.com', 'https://www.moderaty.com', 'https://MODERATY.com/', 'https://moderaty.com./'])(
	'flag true refuses on production APP_URL %s',
	(appUrl) => {
		setEnv({ DEMO_PAGES_ENABLED: 'true', APP_URL: appUrl, GOOGLE_CLIENT_ID: DEV_CLIENT });
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(thrownBy(() => requireDemoPages())).toMatchObject({ status: 500, body: { message: 'Demo pages are not available on this deployment' } });
		expect(log).toHaveBeenCalledOnce();
	}
);

test('a subdomain of the production domain is not blocked by the host guard', () => {
	setEnv({ DEMO_PAGES_ENABLED: 'true', APP_URL: 'https://dev.moderaty.com', GOOGLE_CLIENT_ID: DEV_CLIENT });
	expect(requireDemoPages()).toBeUndefined();
});

test('flag true refuses with the production Google client, whatever the host', () => {
	setEnv({ DEMO_PAGES_ENABLED: 'true', APP_URL: 'http://localhost:5173', GOOGLE_CLIENT_ID: PROD_CLIENT });
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(thrownBy(() => requireDemoPages())).toMatchObject({ status: 500, body: { message: 'Demo pages are not available on this deployment' } });
	expect(log).toHaveBeenCalledOnce();
});

test('flag true without APP_URL fails loudly', () => {
	setEnv({ DEMO_PAGES_ENABLED: 'true', GOOGLE_CLIENT_ID: DEV_CLIENT });
	const log = vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(thrownBy(() => requireDemoPages())).toMatchObject({ status: 500, body: { message: 'APP_URL is not configured' } });
	expect(log).toHaveBeenCalledOnce();
});
