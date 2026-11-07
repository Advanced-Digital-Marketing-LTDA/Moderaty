/**
 * Test-only fake of the YouTube Data API, installed as the global fetch. The
 * network is the only thing faked: each route is answered by a per-test handler,
 * and a request no route covers is recorded in `unrouted`, so a test fails on it
 * instead of passing silently.
 */

export type FakeRoute = 'token' | 'threads' | 'replies' | 'identities' | 'listing' | 'moderation' | 'remove';
export type FakeReply = Response | Record<string, unknown>;
export type FakeHandler = (params: URLSearchParams) => FakeReply | Promise<FakeReply>;

export interface FakeRequest {
	route: FakeRoute;
	params: URLSearchParams;
}

export interface FakeYoutube {
	handlers: Record<FakeRoute, FakeHandler>;
	requests: FakeRequest[];
	unrouted: string[];
	reset(): void;
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

function json(body: Record<string, unknown>, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A YouTube error body with its reason code. `retry-after: 0` keeps a throttled request from sleeping through retries. */
export function refusal(status: number, reason: string): Response {
	const body = { error: { code: status, message: 'synthetic refusal', errors: [{ domain: 'youtube.comment', reason, message: 'synthetic refusal' }] } };
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'retry-after': '0' } });
}

export function listPage(items: unknown[], nextPageToken: string | null = null): Record<string, unknown> {
	return { items, nextPageToken };
}

/** A commentThreads item whose top-level comment is `id`, published at `publishedAt`. */
export function thread(id: string, publishedAt: string): Record<string, unknown> {
	return {
		id,
		snippet: {
			videoId: 'video-1',
			topLevelComment: {
				id,
				snippet: { textDisplay: `text ${id}`, publishedAt, authorChannelId: { value: `top-author-${id}` }, authorDisplayName: `Name ${id}` }
			}
		}
	};
}

const EMPTY_PAGE: FakeHandler = () => listPage([]);

function defaultHandlers(): Record<FakeRoute, FakeHandler> {
	return {
		token: () => ({ access_token: 'access-token', expires_in: 3599, token_type: 'Bearer' }),
		threads: EMPTY_PAGE,
		replies: EMPTY_PAGE,
		identities: EMPTY_PAGE,
		listing: EMPTY_PAGE,
		moderation: () => new Response(null, { status: 204 }),
		remove: () => new Response(null, { status: 204 })
	};
}

const YOUTUBE_HOST = 'www.googleapis.com';
const YOUTUBE_PREFIX = '/youtube/v3';

function routeOf(method: string, url: URL): FakeRoute | undefined {
	if (method === 'POST' && url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token') return 'token';
	if (url.hostname !== YOUTUBE_HOST || !url.pathname.startsWith(`${YOUTUBE_PREFIX}/`)) return undefined;
	const path = url.pathname.slice(YOUTUBE_PREFIX.length);
	if (method === 'GET' && path === '/commentThreads') return 'threads';
	if (method === 'GET' && path === '/comments') return url.searchParams.has('parentId') ? 'replies' : 'identities';
	if (method === 'POST' && path === '/comments/setModerationStatus') return 'moderation';
	if (method === 'DELETE' && path === '/comments') return 'remove';
	if (method === 'GET' && (path === '/channels' || path === '/videos')) return 'listing';
	return undefined;
}

export function createFakeYoutube(): FakeYoutube {
	const youtube: FakeYoutube = {
		handlers: defaultHandlers(),
		requests: [],
		unrouted: [],
		reset() {
			youtube.handlers = defaultHandlers();
			youtube.requests = [];
			youtube.unrouted = [];
		},
		async fetch(input, init = {}) {
			const url = new URL(input instanceof Request ? input.url : String(input));
			const method = (init.method ?? 'GET').toUpperCase();
			const route = routeOf(method, url);
			if (!route) {
				youtube.unrouted.push(`${method} ${url.pathname}`);
				throw new Error(`unrouted YouTube request: ${method} ${url.pathname}`);
			}
			youtube.requests.push({ route, params: url.searchParams });
			const reply = await youtube.handlers[route](url.searchParams);
			return reply instanceof Response ? reply : json(reply, 200);
		}
	};
	return youtube;
}
