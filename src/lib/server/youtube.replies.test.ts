import { beforeEach, afterEach, expect, test, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { fetchNewComments, MAX_REPLY_LOOKUPS_PER_TICK, MAX_REPLY_PAGES_PER_THREAD } from './youtube';

const CHANNEL = 'channel';

// Pins the reply lookup limits; a change is a quota decision, not a refactor.
test('the reply lookup limits match the documented values', () => {
	expect(MAX_REPLY_PAGES_PER_THREAD).toBe(5);
	expect(MAX_REPLY_LOOKUPS_PER_TICK).toBe(10);
});

/** A commentThreads item. `replies` is omitted when undefined, so `replies: 'garbage'` is a wrong-typed container. */
function thread(id: string, options: { publishedAt?: string; totalReplyCount?: unknown; replies?: unknown; videoId?: string } = {}) {
	const snippet: Record<string, unknown> = {
		videoId: options.videoId ?? `video-${id}`,
		topLevelComment: {
			id,
			snippet: {
				textDisplay: `Comment ${id}`,
				publishedAt: options.publishedAt ?? '2026-01-04T00:00:00.000Z',
				authorChannelId: { value: `author-${id}` },
				authorDisplayName: `Author ${id}`
			}
		}
	};
	if (options.totalReplyCount !== undefined) snippet.totalReplyCount = options.totalReplyCount;
	const item: Record<string, unknown> = { id: `thread-${id}`, snippet };
	if (options.replies !== undefined) item.replies = options.replies;
	return item;
}

/** A comments resource. `text: null` drops textDisplay; `videoId` is set on the reply itself. */
function reply(id: string, options: { author?: string; text?: string | null; videoId?: string } = {}) {
	return {
		id,
		snippet: {
			textDisplay: options.text === null ? undefined : (options.text ?? `Reply ${id}`),
			publishedAt: '2026-01-04T01:00:00.000Z',
			authorChannelId: { value: options.author ?? `replier-${id}` },
			authorDisplayName: `Replier ${id}`,
			...(options.videoId === undefined ? {} : { videoId: options.videoId })
		}
	};
}

function json(payload: unknown): Response {
	return new Response(JSON.stringify(payload), { status: 200 });
}

/**
 * Answers fetch calls in order. A call with no queued response throws a plain
 * Error (never retried by fetchWithRetry), so an unexpected request fails the test.
 */
function stubFetch(...responses: Response[]) {
	const queue = [...responses];
	const fetch = vi.fn(async (url: RequestInfo | URL) => {
		const next = queue.shift();
		if (!next) throw new Error(`unexpected fetch ${String(url)}`);
		return next;
	});
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

function calledUrls(fetch: ReturnType<typeof stubFetch>): URL[] {
	return fetch.mock.calls.map(([url]) => new URL(String(url)));
}

beforeEach(() => {
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

test('without includeReplies it requests part=snippet, never looks up replies, ignores embedded replies, and returns exactly three keys', async () => {
	const fetch = stubFetch(json({
		items: [thread('p', { totalReplyCount: 5, replies: { comments: [reply('r1')] } })]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null);

	expect(calledUrls(fetch).map((url) => url.pathname)).toEqual(['/youtube/v3/commentThreads']);
	expect(calledUrls(fetch)[0]?.searchParams.get('part')).toBe('snippet');
	expect(result.comments.map((comment) => comment.id)).toEqual(['p']);
	expect(result.comments[0]).not.toHaveProperty('parentId');
	expect(Object.keys(result).sort()).toEqual(['comments', 'nextPageToken', 'reachedCursor']);
});

test('includeReplies requests part=snippet,replies and returns each embedded reply after its parent, with the thread video', async () => {
	const fetch = stubFetch(json({
		items: [thread('p', {
			videoId: 'video-thread',
			totalReplyCount: 2,
			replies: { comments: [reply('r1', { videoId: 'video-reply-own' }), reply('r2', { videoId: 'video-reply-own' })] }
		})]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(calledUrls(fetch).map((url) => url.searchParams.get('part'))).toEqual(['snippet,replies']);
	expect(result.comments).toEqual([
		{
			id: 'p',
			threadId: 'thread-p',
			videoId: 'video-thread',
			authorChannelId: 'author-p',
			authorName: 'Author p',
			text: 'Comment p',
			publishedAt: '2026-01-04T00:00:00.000Z'
		},
		{
			id: 'r1',
			threadId: 'thread-p',
			parentId: 'p',
			videoId: 'video-thread',
			authorChannelId: 'replier-r1',
			authorName: 'Replier r1',
			text: 'Reply r1',
			publishedAt: '2026-01-04T01:00:00.000Z'
		},
		{
			id: 'r2',
			threadId: 'thread-p',
			parentId: 'p',
			videoId: 'video-thread',
			authorChannelId: 'replier-r2',
			authorName: 'Replier r2',
			text: 'Reply r2',
			publishedAt: '2026-01-04T01:00:00.000Z'
		}
	]);
	expect(Object.keys(result).sort()).toEqual(['comments', 'nextPageToken', 'reachedCursor']);
});

test('a reply without textDisplay is warned and counted in replyShortfall while its siblings and parent are kept', async () => {
	const warn = vi.mocked(console.warn);
	stubFetch(json({
		items: [thread('p', { totalReplyCount: 3, replies: { comments: [reply('r1'), reply('bad', { text: null }), reply('r2')] } })]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(result.comments.map((comment) => comment.id)).toEqual(['p', 'r1', 'r2']);
	expect(result.replyShortfall).toBe(1);
	expect(warn).toHaveBeenCalledWith(expect.stringContaining('commentThreads.list response item 0 reply 1 is malformed'));
	expect(Object.keys(result).sort()).toEqual(['comments', 'nextPageToken', 'reachedCursor', 'replyShortfall']);
});

test('without a total, each malformed reply is counted in replyShortfall and no lookup runs', async () => {
	const fetch = stubFetch(json({
		items: [thread('p', { replies: { comments: [reply('r1'), reply('bad', { text: null })] } })]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(calledUrls(fetch)).toHaveLength(1);
	expect(result.comments.map((comment) => comment.id)).toEqual(['p', 'r1']);
	expect(result.replyShortfall).toBe(1);
});

test.each([
	['a string', 'garbage'],
	['an object whose comments is not an array', { comments: 'nope' }]
])('a replies container that is %s keeps the parent, drops the replies, warns, and counts totalReplyCount as shortfall', async (_label, replies) => {
	const warn = vi.mocked(console.warn);
	const fetch = stubFetch(json({ items: [thread('p', { totalReplyCount: 3, replies })] }));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(calledUrls(fetch)).toHaveLength(1);
	expect(result.comments.map((comment) => comment.id)).toEqual(['p']);
	expect(result.replyShortfall).toBe(3);
	expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropping its embedded replies'));
});

test('a wrong-typed replies container without a total counts one shortfall', async () => {
	stubFetch(json({ items: [thread('p', { replies: 'garbage' })] }));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(result.comments.map((comment) => comment.id)).toEqual(['p']);
	expect(result.replyShortfall).toBe(1);
});

test('embedded replies short of totalReplyCount are completed by lookups that follow pageToken and dedupe against kept replies', async () => {
	const embedded = [1, 2, 3, 4, 5].map((n) => reply(`r${n}`));
	const fetch = stubFetch(
		json({ items: [thread('p', { videoId: 'video-thread', totalReplyCount: 7, replies: { comments: embedded } })] }),
		json({ items: [reply('r5'), reply('r6')], nextPageToken: 'reply-page-2' }),
		json({ items: [reply('r2'), reply('r7')] })
	);

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	const urls = calledUrls(fetch);
	expect(urls.map((url) => url.pathname)).toEqual([
		'/youtube/v3/commentThreads',
		'/youtube/v3/comments',
		'/youtube/v3/comments'
	]);
	expect(urls[1]?.searchParams.get('parentId')).toBe('p');
	expect(urls[1]?.searchParams.get('maxResults')).toBe('100');
	expect(urls[1]?.searchParams.get('textFormat')).toBe('plainText');
	expect(urls[1]?.searchParams.has('pageToken')).toBe(false);
	expect(urls[2]?.searchParams.get('pageToken')).toBe('reply-page-2');
	expect(result.comments.map((comment) => comment.id)).toEqual(['p', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
	expect(result.comments.slice(1).map((comment) => comment.parentId)).toEqual(['p', 'p', 'p', 'p', 'p', 'p', 'p']);
	expect(result.comments.slice(1).map((comment) => comment.videoId)).toEqual([
		'video-thread', 'video-thread', 'video-thread', 'video-thread', 'video-thread', 'video-thread', 'video-thread'
	]);
	expect(result.overflow).toEqual({ threads: 1, lookups: 2 });
	expect(result).not.toHaveProperty('replyShortfall');
});

test('a comments.list response whose items is not an array fails the call and names comments.list', async () => {
	stubFetch(
		json({ items: [thread('p', { totalReplyCount: 1 })] }),
		json({ items: 'nope' })
	);

	await expect(fetchNewComments(CHANNEL, 'token', null, { includeReplies: true })).rejects.toThrow(
		'comments.list response items is missing or invalid'
	);
});

test('a reply by the channel itself is not returned, is counted in ownRepliesSkipped, and is not shortfall when the total covers it', async () => {
	const fetch = stubFetch(json({
		items: [thread('p', { totalReplyCount: 2, replies: { comments: [reply('own', { author: CHANNEL }), reply('r1')] } })]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(calledUrls(fetch)).toHaveLength(1);
	expect(result.comments.map((comment) => comment.id)).toEqual(['p', 'r1']);
	expect(result.ownRepliesSkipped).toBe(1);
	expect(result).not.toHaveProperty('replyShortfall');
	expect(result).not.toHaveProperty('overflow');
});

test('the lookup budget caps comments.list calls across the call and the uncovered threads become shortfall, logged loudly', async () => {
	const warn = vi.mocked(console.warn);
	const fetch = stubFetch(
		json({ items: [thread('a', { totalReplyCount: 2 }), thread('b', { totalReplyCount: 1 }), thread('c', { totalReplyCount: 2 })] }),
		json({ items: [reply('a1'), reply('a2')] }),
		json({ items: [reply('b1')] })
	);

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true, replyLookupBudget: 2 });

	const lookups = calledUrls(fetch).filter((url) => url.pathname === '/youtube/v3/comments');
	expect(lookups.map((url) => url.searchParams.get('parentId'))).toEqual(['a', 'b']);
	expect(result.comments.map((comment) => comment.id)).toEqual(['a', 'a1', 'a2', 'b', 'b1', 'c']);
	expect(result.replyShortfall).toBe(2);
	expect(result.overflow).toEqual({ threads: 3, lookups: 2 });
	expect(warn).toHaveBeenCalledTimes(1);
	expect(warn).toHaveBeenCalledWith(expect.stringContaining('commentThreads.list response item 2 has 2 replies still unfetched'));
});

test('a total smaller than the replies found never makes the shortfall negative', async () => {
	stubFetch(json({
		items: [
			thread('p', { totalReplyCount: 1, replies: { comments: [reply('r1'), reply('r2')] } }),
			thread('q', { totalReplyCount: 2 })
		]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true, replyLookupBudget: 0 });

	expect(result.comments.map((comment) => comment.id)).toEqual(['p', 'r1', 'r2', 'q']);
	// Thread p's extra reply must not cancel thread q's two unfetched replies.
	expect(result.replyShortfall).toBe(2);
});

test('the lookup budget defaults to MAX_REPLY_LOOKUPS_PER_TICK when no budget is given', async () => {
	const threads = Array.from({ length: 11 }, (_, index) => thread(`t${index}`, { totalReplyCount: 1 }));
	const lookupPages = Array.from({ length: 10 }, () => json({ items: [] }));
	const fetch = stubFetch(json({ items: threads }), ...lookupPages);

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(calledUrls(fetch)).toHaveLength(11);
	expect(result.overflow).toEqual({ threads: 11, lookups: 10 });
	expect(result.replyShortfall).toBe(11);
});

test('a thread stops after MAX_REPLY_PAGES_PER_THREAD lookup pages even when the token keeps coming', async () => {
	const lookupPages = Array.from({ length: 5 }, (_, index) => json({
		items: [reply(`n${index}`)],
		nextPageToken: `token-${index + 1}`
	}));
	const fetch = stubFetch(json({ items: [thread('p', { totalReplyCount: 100 })] }), ...lookupPages);

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(calledUrls(fetch)).toHaveLength(6);
	expect(result.comments).toHaveLength(6);
	expect(result.replyShortfall).toBe(95);
	expect(result.overflow).toEqual({ threads: 1, lookups: 5 });
});

test.each([-1, 1.5, Number.NaN])('a replyLookupBudget of %s is rejected before any request', async (replyLookupBudget) => {
	stubFetch();

	await expect(fetchNewComments(CHANNEL, 'token', null, { includeReplies: true, replyLookupBudget })).rejects.toThrow(
		'fetchNewComments replyLookupBudget is invalid'
	);
});

test.each([-1, 2.5, '3', null])('an invalid totalReplyCount (%j) is warned and treated as unknown, so no lookup runs', async (totalReplyCount) => {
	const warn = vi.mocked(console.warn);
	const fetch = stubFetch(json({
		items: [thread('p', { totalReplyCount, replies: { comments: [reply('r1')] } })]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(calledUrls(fetch)).toHaveLength(1);
	expect(result.comments.map((comment) => comment.id)).toEqual(['p', 'r1']);
	expect(result).not.toHaveProperty('replyShortfall');
	expect(warn).toHaveBeenCalledWith(expect.stringContaining('totalReplyCount'));
});

test('an embedded reply listed twice is kept once', async () => {
	stubFetch(json({
		items: [thread('p', { totalReplyCount: 2, replies: { comments: [reply('r1'), reply('r1'), reply('r2')] } })]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(result.comments.map((comment) => comment.id)).toEqual(['p', 'r1', 'r2']);
	expect(result).not.toHaveProperty('replyShortfall');
});

test('a page whose second top-level comment is older than the cursor ends the walk without fetching the older thread replies', async () => {
	const fetch = stubFetch(json({
		items: [
			thread('new', { publishedAt: '2026-01-04T00:00:00.000Z', totalReplyCount: 1, replies: { comments: [reply('n1')] } }),
			thread('old', { publishedAt: '2026-01-01T00:00:00.000Z', totalReplyCount: 5, replies: { comments: [reply('o1')] } })
		],
		nextPageToken: 'page-2'
	}));

	const result = await fetchNewComments(CHANNEL, 'token', '2026-01-02T00:00:00.000Z', { includeReplies: true });

	expect(calledUrls(fetch)).toHaveLength(1);
	expect(result.comments.map((comment) => comment.id)).toEqual(['new', 'n1']);
	expect(result).toMatchObject({ nextPageToken: null, reachedCursor: true });
	expect(result).not.toHaveProperty('overflow');
});

test('reply faults of every shape are skipped and counted without throwing', async () => {
	const warn = vi.mocked(console.warn);
	stubFetch(json({
		items: [thread('p', { totalReplyCount: 4, replies: { comments: ['not-an-object', { id: 'no-snippet' }, reply('r1'), null] } })]
	}));

	const result = await fetchNewComments(CHANNEL, 'token', null, { includeReplies: true });

	expect(result.comments.map((comment) => comment.id)).toEqual(['p', 'r1']);
	expect(result.replyShortfall).toBe(3);
	expect(warn).toHaveBeenCalledTimes(3);
});

test('a structurally malformed top-level item still throws when replies are requested', async () => {
	stubFetch(json({ items: [{ snippet: {} }] }));

	await expect(fetchNewComments(CHANNEL, 'token', null, { includeReplies: true })).rejects.toThrow(
		'commentThreads.list response item 0.topLevelComment is missing or invalid'
	);
});
