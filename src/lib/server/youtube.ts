import { env } from '$env/dynamic/private';
import { fetchSingleAttempt, fetchWithRetry } from '$lib/server/http';

const YT = 'https://www.googleapis.com/youtube/v3';

/**
 * YouTube caps comma-separated `id` list parameters at 50 per request
 * (videos.list, comments.setModerationStatus). Every batching
 * loop that talks to those endpoints must share this bound.
 */
export const YOUTUBE_ID_BATCH_SIZE = 50;

type JsonObject = Record<string, unknown>;

export interface NewComment {
	id: string;
	threadId: string;
	videoId: string | null;
	authorChannelId: string;
	authorName: string;
	/** Verified configured handle, populated by protection matching only. */
	authorHandle?: string | null;
	text: string;
	publishedAt: string;
	/** Top-level comment id for a reply; absent on top-level comments. */
	parentId?: string | null;
}

export interface FetchCommentsOptions {
	maxPages?: number;
	pageToken?: string | null;
	deadline?: number;
	/** Also return replies to the included top-level comments (embedded replies plus bounded lookups). */
	includeReplies?: boolean;
	/** Maximum comments.list lookups for this whole call; used only when includeReplies is true. */
	replyLookupBudget?: number;
}

export interface CommentPage {
	comments: NewComment[];
	nextPageToken: string | null;
	reachedCursor: boolean;
	/** Replies that exist but were not returned: malformed or wrong-typed data, or threads the lookup budget left unfetched. */
	replyShortfall?: number;
	/** Replies by the channel's own account, which are never returned. */
	ownRepliesSkipped?: number;
	/** Threads whose embedded replies fell short of totalReplyCount, and the comments.list calls made for them. */
	overflow?: { threads: number; lookups: number };
}

/** Maximum comments.list pages followed for one thread within one call. */
export const MAX_REPLY_PAGES_PER_THREAD = 5;
/** Default comments.list lookup budget for one fetchNewComments call. */
export const MAX_REPLY_LOOKUPS_PER_TICK = 10;

export type CommentModerationStatus = 'heldForReview' | 'rejected' | 'published' | 'likelySpam';

export class CommentNotFoundError extends Error {
	commentIds: string[];

	constructor(commentIds: string[]) {
		super(`comments not found on YouTube: ${commentIds.join(', ')}`);
		this.name = 'CommentNotFoundError';
		this.commentIds = [...commentIds];
	}
}

/** A settled validation/auth/quota refusal proves this attempt did not apply. */
export class YoutubeWriteRefusedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'YoutubeWriteRefusedError';
	}
}

export class GoogleGrantExpiredError extends Error {
	constructor(message: string) { super(message); this.name = 'GoogleGrantExpiredError'; }
}

function writeFailure(status: number, message: string): Error {
	return [400, 401, 403, 405, 422, 429].includes(status) ? new YoutubeWriteRefusedError(message) : new Error(message);
}

function isJsonObject(value: unknown): value is JsonObject {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function object(value: unknown, context: string): JsonObject {
	if (!isJsonObject(value)) {
		throw new Error(`${context} is missing or invalid`);
	}
	return value;
}

function requiredString(value: unknown, context: string): string {
	if (typeof value !== 'string' || !value) throw new Error(`${context} is missing or invalid`);
	return value;
}

function optionalPageToken(value: unknown, operation: string): string | null {
	if (value === undefined || value === null) return null;
	return requiredString(value, `${operation} response nextPageToken`);
}

async function jsonResponse(response: Response, operation: string): Promise<unknown> {
	const body = await response.text();
	if (!response.ok) {
		const failure = new Error(`${operation} failed: ${response.status} ${body}`);
		if (operation === 'token refresh' && [400, 401].includes(response.status)) {
			let payload: unknown;
			try { payload = JSON.parse(body); } catch { throw failure; }
			if (payload && typeof payload === 'object' && !Array.isArray(payload) && (payload as JsonObject).error === 'invalid_grant') {
				throw new GoogleGrantExpiredError(failure.message);
			}
		}
		throw failure;
	}
	try {
		return JSON.parse(body) as unknown;
	} catch {
		throw new Error(`${operation} returned invalid JSON`);
	}
}

function optionalString(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

/** Parses a top-level item. Structural faults throw (I1); the leaf faults that parseCommentResource reports skip the item. */
function parseComment(item: unknown, context: string): NewComment | null {
	const thread = object(item, context);
	const topLevelComment = object(object(thread.snippet, `${context}.snippet`).topLevelComment, `${context}.topLevelComment`);
	const snippet = object(topLevelComment.snippet, `${context}.topLevelComment.snippet`);
	// Stryker disable next-line StringLiteral: equivalent — object() already validated thread.snippet above, so this context string belongs to an unreachable throw
	const videoId = optionalString(snippet.videoId) ?? optionalString(object(thread.snippet, `${context}.snippet`).videoId);
	return parseCommentResource(topLevelComment, snippet, { label: context, threadId: optionalString(thread.id), videoId });
}

/** Where a comments resource sits: names it in warnings, and carries its thread's id and video. */
interface CommentSite {
	label: string;
	threadId: string | null;
	videoId: string | null;
}

/**
 * Parses the comment-level fields of a comments resource (a top-level comment or a reply).
 * The caller has validated the object shapes; leaf faults warn and return null.
 */
function parseCommentResource(resource: JsonObject, snippet: JsonObject, site: CommentSite): NewComment | null {
	const { label, threadId, videoId } = site;
	const id = optionalString(resource.id);
	const publishedAt = optionalString(snippet.publishedAt);
	const text = optionalString(snippet.textDisplay);
	if (!id || !threadId || !text || !publishedAt || Number.isNaN(Date.parse(publishedAt))) {
		console.warn(`${label} is malformed (missing id, text, or a valid publishedAt); skipping it`);
		return null;
	}
	if (!videoId) {
		// Omni moderation and rule matching do not need a videoId — keep the
		// comment and let tone scoring degrade to empty context (best-effort).
		console.warn(`${label} (comment ${id}) has no videoId; tone context will be empty`);
	}
	const channelIdObject = snippet.authorChannelId;
	const authorChannelId =
		// Stryker disable next-line ConditionalExpression: equivalent — authorChannelId comes from JSON.parse, so a truthy non-object is a string/number/boolean primitive, whose .value is always undefined, matching the null branch
		channelIdObject && typeof channelIdObject === 'object' && !Array.isArray(channelIdObject)
			? optionalString((channelIdObject as JsonObject).value)
			: null;
	if (authorChannelId === null) {
		console.warn(`${label} (comment ${id}) has no authorChannelId; the author channel may be deleted`);
	}
	const authorName = optionalString(snippet.authorDisplayName);
	if (authorName === null) {
		console.warn(`${label} (comment ${id}) has no authorDisplayName; the author channel may be deleted`);
	}
	return {
		id,
		threadId,
		videoId,
		authorChannelId: authorChannelId ?? '',
		authorName: authorName ?? '[unavailable author]',
		text,
		publishedAt
	};
}

/** Parses one reply. A reply that is not an object with a snippet warns and returns null instead of throwing. */
function parseReply(raw: unknown, site: CommentSite): NewComment | null {
	const snippet = isJsonObject(raw) ? raw.snippet : undefined;
	if (!isJsonObject(raw) || !isJsonObject(snippet)) {
		console.warn(`${site.label} is malformed (not a comment resource with a snippet); skipping it`);
		return null;
	}
	return parseCommentResource(raw, snippet, site);
}

const MAX_VIDEO_DESCRIPTION_LENGTH = 500;

/**
 * Fetches titles and descriptions for videos, for tone-scoring context.
 *
 * @param videoIds - The video IDs to look up (batched YOUTUBE_ID_BATCH_SIZE per API call).
 * @param accessToken - The OAuth access token for the YouTube API.
 * @param deadline - Optional request deadline.
 * @returns A map from video ID to its title and truncated description; videos
 * whose metadata fails validation are omitted (and logged), never fatal.
 */
export async function fetchVideoMetadata(
	videoIds: string[],
	accessToken: string,
	deadline?: number
): Promise<Map<string, { title: string; description: string }>> {
	const out = new Map<string, { title: string; description: string }>();
	const batches: string[][] = [];
	for (let i = 0; i < videoIds.length; i += YOUTUBE_ID_BATCH_SIZE) {
		batches.push(videoIds.slice(i, i + YOUTUBE_ID_BATCH_SIZE));
	}
	const responses = await Promise.all(
		batches.map(async (batch) => {
			const params = new URLSearchParams({ part: 'snippet', id: batch.join(',') });
			const res = await ytFetch(`/videos?${params}`, accessToken, undefined, deadline);
			const data = object(await jsonResponse(res, 'videos.list'), 'videos.list response');
			if (!Array.isArray(data.items)) throw new Error('videos.list response items is missing or invalid');
			return data.items;
		})
	);
	for (const items of responses) {
		for (const [index, item] of items.entries()) {
			const context = `videos.list response item ${index}`;
			try {
				const video = object(item, context);
				const id = requiredString(video.id, `${context}.id`);
				const snippet = object(video.snippet, `${context}.snippet`);
				const title = requiredString(snippet.title, `${context}.snippet.title`);
				out.set(id, {
					title,
					description: optionalString(snippet.description)?.slice(0, MAX_VIDEO_DESCRIPTION_LENGTH) ?? ''
				});
			} catch (error) {
				console.warn('videos.list response item is malformed; skipping it:', context, error);
			}
		}
	}
	return out;
}

/**
 * Refreshes an OAuth access token using a Google refresh token.
 *
 * @param refreshToken - The Google OAuth refresh token.
 * @returns The refreshed OAuth access token.
 */
export async function refreshAccessToken(refreshToken: string, deadline?: number): Promise<string> {
	if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
		throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
	}
	const res = await fetchWithRetry('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			refresh_token: refreshToken,
			grant_type: 'refresh_token'
		})
	}, deadline);
	const data = object(await jsonResponse(res, 'token refresh'), 'token refresh response');
	return requiredString(data.access_token, 'token refresh response access_token');
}

/**
 * Sends an authenticated request to the YouTube Data API.
 *
 * @param path - The API path to append to the YouTube API base URL
 * @param accessToken - The OAuth access token used for authorization
 * @param init - Optional request configuration
 * @param deadline - Optional request deadline
 * @returns The raw API response
 */
async function ytFetch(
	path: string,
	accessToken: string,
	init?: RequestInit,
	deadline?: number,
	singleAttempt = false
): Promise<Response> {
	const request = singleAttempt ? fetchSingleAttempt : fetchWithRetry;
	const res = await request(`${YT}${path}`, {
		...init,
		// Normalize the caller's headers into a plain object before spreading:
		// spreading a Headers instance (or tuple array) yields an empty object,
		// silently dropping the caller's headers. Authorization is set LAST so
		// it always wins.
		headers: { ...callerHeaders(init), Authorization: `Bearer ${accessToken}` }
	}, deadline);
	return res;
}

/** Normalizes RequestInit.headers (Headers | tuples | record | undefined) to a plain record. */
function callerHeaders(init?: RequestInit): Record<string, string> {
	if (!init?.headers) return {};
	if (init.headers instanceof Headers) return Object.fromEntries(init.headers.entries());
	if (Array.isArray(init.headers)) return Object.fromEntries(init.headers);
	return init.headers as Record<string, string>;
}

/**
 * Fetches recent top-level comments for a YouTube channel.
 *
 * Stops when the cursor boundary is reached or the configured page limit is exhausted.
 *
 * @param cursor - Timestamp boundary; comments published earlier than this instant are excluded.
 * Any `Date.parse`-valid timestamp is accepted and compared by instant, not lexicographically.
 * @param maxPages - Maximum number of API pages to fetch.
 * @param pageToken - Token for the initial API page.
 * @param deadline - Optional request deadline.
 * @param includeReplies - Also return replies to top-level comments inside the cursor window (embedded replies, plus bounded comments.list lookups).
 * @param replyLookupBudget - Maximum comments.list lookups for this whole call; used only when includeReplies is true.
 * @returns The fetched comments, a token for the next page when applicable, and whether the cursor boundary was reached.
 * With includeReplies, also the reply accounting that is non-zero (replyShortfall, ownRepliesSkipped, overflow).
 */
export async function fetchNewComments(
	channelId: string,
	accessToken: string,
	cursor: string | null,
	{
		maxPages = 3,
		pageToken: initialPageToken = null,
		deadline,
		includeReplies = false,
		replyLookupBudget = MAX_REPLY_LOOKUPS_PER_TICK
	}: FetchCommentsOptions = {}
): Promise<CommentPage> {
	const out: NewComment[] = [];
	let pageToken = initialPageToken;
	const cursorMs = cursor === null ? null : Date.parse(cursor);
	// Stryker disable next-line ConditionalExpression: equivalent — cursorMs is null only when cursor is null, and Number.isNaN(null) is false, so replacing the null check with `true` cannot change the outcome
	if (cursorMs !== null && Number.isNaN(cursorMs)) {
		throw new Error(`fetchNewComments cursor is invalid: ${cursor}`);
	}
	const replies = includeReplies ? newReplyTally(channelId, accessToken, deadline, replyLookupBudget) : null;
	for (let page = 0; page < maxPages; page++) {
		const { items, nextPageToken } = await fetchCommentPage(channelId, accessToken, pageToken, deadline, includeReplies);
		const reachedCursor = await collectUntilCursor(items, cursorMs, out, replies);
		if (reachedCursor || !nextPageToken) {
			return withReplyAccounting({ comments: out, nextPageToken: null, reachedCursor }, replies);
		}
		pageToken = nextPageToken;
	}
	return withReplyAccounting({ comments: out, nextPageToken: pageToken, reachedCursor: false }, replies);
}

/** Page-wide reply state for one fetchNewComments call. Threads are handled in order, so the budget is spent deterministically. */
interface ReplyTally {
	readonly channelId: string;
	readonly accessToken: string;
	readonly deadline: number | undefined;
	lookupsRemaining: number;
	lookups: number;
	overflowThreads: number;
	replyShortfall: number;
	ownRepliesSkipped: number;
}

function newReplyTally(channelId: string, accessToken: string, deadline: number | undefined, replyLookupBudget: number): ReplyTally {
	if (!Number.isSafeInteger(replyLookupBudget) || replyLookupBudget < 0) {
		throw new Error(`fetchNewComments replyLookupBudget is invalid: ${replyLookupBudget}`);
	}
	return {
		channelId,
		accessToken,
		deadline,
		lookupsRemaining: replyLookupBudget,
		lookups: 0,
		overflowThreads: 0,
		replyShortfall: 0,
		ownRepliesSkipped: 0
	};
}

/** Adds the reply accounting to a page; each key appears only when it has something to report. */
function withReplyAccounting(page: CommentPage, replies: ReplyTally | null): CommentPage {
	if (!replies) return page;
	return {
		...page,
		...(replies.replyShortfall > 0 ? { replyShortfall: replies.replyShortfall } : {}),
		...(replies.ownRepliesSkipped > 0 ? { ownRepliesSkipped: replies.ownRepliesSkipped } : {}),
		...(replies.overflowThreads > 0 ? { overflow: { threads: replies.overflowThreads, lookups: replies.lookups } } : {})
	};
}

/** Fetches one page of comment threads for the channel (≤100 comments, I10). */
async function fetchCommentPage(
	channelId: string,
	accessToken: string,
	pageToken: string | null,
	deadline: number | undefined,
	includeReplies: boolean
): Promise<{ items: unknown[]; nextPageToken: string | null }> {
	const params = new URLSearchParams({
		part: includeReplies ? 'snippet,replies' : 'snippet',
		allThreadsRelatedToChannelId: channelId,
		order: 'time',
		maxResults: '100',
		textFormat: 'plainText'
	});
	if (pageToken) params.set('pageToken', pageToken);
	return fetchCommentListPage('commentThreads', params, accessToken, deadline);
}

/** Sends one list request. The page's items must be an array and its token a string or absent (I1, I2). */
async function fetchCommentListPage(
	resource: 'commentThreads' | 'comments',
	params: URLSearchParams,
	accessToken: string,
	deadline: number | undefined
): Promise<{ items: unknown[]; nextPageToken: string | null }> {
	const operation = `${resource}.list`;
	const res = await ytFetch(`/${resource}?${params}`, accessToken, undefined, deadline);
	const data = object(await jsonResponse(res, operation), `${operation} response`);
	if (!Array.isArray(data.items)) throw new Error(`${operation} response items is missing or invalid`);
	return { items: data.items as unknown[], nextPageToken: optionalPageToken(data.nextPageToken, operation) };
}

/**
 * Pushes parsed comments into out until the cursor boundary, returning whether it was reached.
 * A thread's replies are gathered only after its top-level comment passes the cursor check,
 * so the walk that stops at an older comment starts no reply work for it.
 */
async function collectUntilCursor(
	items: unknown[],
	cursorMs: number | null,
	out: NewComment[],
	replies: ReplyTally | null
): Promise<boolean> {
	for (const [index, item] of items.entries()) {
		const context = `commentThreads.list response item ${index}`;
		const comment = parseComment(item, context);
		if (!comment) continue;
		if (cursorMs !== null && Date.parse(comment.publishedAt) < cursorMs) return true;
		out.push(comment);
		if (replies) out.push(...(await collectThreadReplies(object(item, context), comment, context, replies)));
	}
	return false;
}

/** Replies gathered for one thread so far, keyed by reply id so embedded and lookup copies collapse. */
interface ThreadReplies {
	kept: Map<string, NewComment>;
	own: Set<string>;
	malformed: number;
}

/**
 * Returns one included thread's kept replies in received order. Embedded replies come first; comments.list
 * lookups follow only when totalReplyCount says the embedded list is short, within the page-wide budget.
 */
async function collectThreadReplies(
	thread: JsonObject,
	parent: NewComment,
	context: string,
	tally: ReplyTally
): Promise<NewComment[]> {
	const threadSnippet = object(thread.snippet, `${context}.snippet`);
	const total = replyTotal(threadSnippet, context);
	const embedded = embeddedReplyItems(thread.replies, context);
	if (embedded === null) {
		// An untrusted container gets no lookup: its shortfall is the reported total, or one when the total is unknown.
		tally.replyShortfall += total ?? 1;
		return [];
	}
	const threadVideoId = optionalString(threadSnippet.videoId);
	const found: ThreadReplies = { kept: new Map(), own: new Set(), malformed: 0 };
	const receive = (raw: unknown, label: string) =>
		fileReply(found, raw, { label, threadId: parent.threadId, videoId: threadVideoId }, parent, tally.channelId);
	for (const [index, raw] of embedded.entries()) receive(raw, `${context} reply ${index}`);
	if (total === null) {
		tally.replyShortfall += found.malformed;
	} else {
		const needsLookup = total > found.kept.size + found.own.size + found.malformed;
		if (needsLookup) {
			tally.overflowThreads += 1;
			await lookUpReplies(parent.id, receive, tally, context);
		}
		const uncovered = Math.max(0, total - found.kept.size - found.own.size);
		if (needsLookup && uncovered > 0) {
			console.warn(`${context} has ${uncovered} replies still unfetched after lookups (budget or page limit reached); reported as replyShortfall`);
		}
		tally.replyShortfall += uncovered;
	}
	tally.ownRepliesSkipped += found.own.size;
	return [...found.kept.values()];
}

/** Follows comments.list pages for one thread, up to MAX_REPLY_PAGES_PER_THREAD pages and the page-wide budget. */
async function lookUpReplies(
	parentId: string,
	receive: (raw: unknown, label: string) => void,
	tally: ReplyTally,
	context: string
): Promise<void> {
	let pageToken: string | null = null;
	for (let page = 0; page < MAX_REPLY_PAGES_PER_THREAD && tally.lookupsRemaining > 0; page++) {
		tally.lookupsRemaining -= 1;
		tally.lookups += 1;
		const { items, nextPageToken } = await fetchReplyPage(parentId, tally.accessToken, pageToken, tally.deadline);
		for (const [index, raw] of items.entries()) receive(raw, `${context} reply lookup item ${index}`);
		if (!nextPageToken) return;
		pageToken = nextPageToken;
	}
}

/** Fetches one page of a thread's complete reply list (comments.list with parentId, ≤100 replies). */
function fetchReplyPage(parentId: string, accessToken: string, pageToken: string | null, deadline: number | undefined) {
	const params = new URLSearchParams({ part: 'snippet', parentId, maxResults: '100', textFormat: 'plainText' });
	if (pageToken) params.set('pageToken', pageToken);
	return fetchCommentListPage('comments', params, accessToken, deadline);
}

/** snippet.totalReplyCount when it is a non-negative integer. Otherwise null, and a present value is warned about. */
function replyTotal(snippet: JsonObject, context: string): number | null {
	const raw = snippet.totalReplyCount;
	if (raw === undefined) return null;
	if (typeof raw === 'number' && Number.isSafeInteger(raw) && raw >= 0) return raw;
	console.warn(`${context} totalReplyCount ${JSON.stringify(raw)} is not a non-negative integer; the reply count is unknown`);
	return null;
}

/** Embedded reply items: [] when the replies key is absent, null when present but not an object with a comments array. */
function embeddedReplyItems(replies: unknown, context: string): unknown[] | null {
	if (replies === undefined) return [];
	const comments = isJsonObject(replies) ? replies.comments : undefined;
	if (Array.isArray(comments)) return comments;
	console.warn(`${context}.replies is not an object with a comments array; dropping its embedded replies`);
	return null;
}

/** Files one parsed reply: kept by id, skipped when it is the channel's own, counted when malformed. */
function fileReply(found: ThreadReplies, raw: unknown, site: CommentSite, parent: NewComment, channelId: string): void {
	const reply = parseReply(raw, site);
	if (!reply) {
		found.malformed += 1;
		return;
	}
	if (reply.authorChannelId === channelId) {
		found.own.add(reply.id);
		return;
	}
	if (!found.kept.has(reply.id)) found.kept.set(reply.id, { ...reply, parentId: parent.id });
}

/**
 * Updates the moderation status of comments, optionally banning their authors.
 *
 * `'published'` restores a held or rejected comment (undo). A deleted comment
 * is gone for good and an author ban cannot be lifted — YouTube offers no API
 * for either.
 *
 * @param ids - The comment IDs to update
 * @param status - The moderation status to apply
 * @param banAuthor - Whether to ban the authors of the comments
 */
export async function setModerationStatus(
	ids: string[],
	status: 'heldForReview' | 'rejected' | 'published',
	banAuthor: boolean,
	accessToken: string,
	deadline?: number,
	singleAttempt = false
): Promise<void> {
	for (let i = 0; i < ids.length; i += YOUTUBE_ID_BATCH_SIZE) {
		const batch = ids.slice(i, i + YOUTUBE_ID_BATCH_SIZE);
		const params = new URLSearchParams({
			id: batch.join(','),
			moderationStatus: status
		});
		// banAuthor is only valid alongside 'rejected' (and defaults to false) —
		// sending it with 'heldForReview'/'published' risks a 400 from YouTube.
		if (banAuthor) params.set('banAuthor', 'true');
		const res = await ytFetch(
			`/comments/setModerationStatus?${params}`,
			accessToken,
			{ method: 'POST' },
			deadline,
			singleAttempt
		);
		if (res.status === 404) throw new CommentNotFoundError(batch);
		if (!res.ok) {
			const body = await res.text();
			throw writeFailure(res.status, `setModerationStatus failed: ${res.status} ${body}`);
		}
	}
}

/**
 * Deletes a YouTube comment.
 *
 * A missing comment is treated as a successful deletion.
 *
 * @param id - The ID of the comment to delete
 * @param accessToken - The OAuth access token for the YouTube API
 * @param deadline - Optional request deadline
 */
export async function deleteComment(id: string, accessToken: string, deadline?: number, singleAttempt = false): Promise<void> {
	const res = await ytFetch(
		`/comments?id=${encodeURIComponent(id)}`,
		accessToken,
		{ method: 'DELETE' },
		deadline,
		singleAttempt
	);
	if (!res.ok && res.status !== 404) {
		const body = await res.text();
		throw writeFailure(res.status, `comments.delete failed: ${res.status} ${body}`);
	}
}

/** A verified empty lookup, safe to explain to the channel owner. */
export class HandleNotFoundError extends Error {
	constructor() {
		super('No YouTube channel uses this handle');
		this.name = 'HandleNotFoundError';
	}
}

/** Resolve the handle filter to its authoritative channel identity. */
export async function resolveHandleChannelId(handle: string, accessToken: string, deadline?: number): Promise<string> {
	const params = new URLSearchParams({ part: 'id', forHandle: handle });
	const response = await ytFetch(`/channels?${params}`, accessToken, {}, deadline);
	if (!response.ok) throw new YoutubeLookupError(response.status, await response.text());
	const payload = object(await response.json(), 'YouTube handle lookup response');
	const items: unknown = payload.items;
	if (!Array.isArray(items)) throw new Error('YouTube handle lookup returned malformed data');
	if (items.length === 0) throw new HandleNotFoundError();
	if (items.length !== 1) throw new Error('YouTube handle must resolve to exactly one channel');
	const item = object(items[0], 'YouTube handle lookup channel');
	const id = requiredString(item.id, 'YouTube handle lookup channel identity');
	if (!id.trim() || id !== id.trim()) throw new Error('YouTube handle lookup returned an invalid channel identity');
	return id;
}

/** Provider details remain server-side; form actions return fixed messages. */
export class YoutubeLookupError extends Error {
	constructor(readonly httpStatus: number, body: string) {
		super(`YouTube handle lookup failed: HTTP ${httpStatus} ${body}`);
	}
}

async function fetchIdentitySnippets(resource: 'channels' | 'comments', ids: string[], accessToken: string, deadline?: number) {
	const result = new Map<string, Record<string, unknown>>();
	let skippedItems = 0;
	const unique = [...new Set(ids.filter(Boolean))];
	for (let index = 0; index < unique.length; index += YOUTUBE_ID_BATCH_SIZE) {
		const batch = unique.slice(index, index + YOUTUBE_ID_BATCH_SIZE);
		const params = new URLSearchParams({part: 'snippet', id: batch.join(','), maxResults: '50'});
		const response = await ytFetch(`/${resource}?${params}`, accessToken, {}, deadline);
		const payload = object(await jsonResponse(response, `${resource}.list identity lookup`), 'identity lookup response');
		if (!Array.isArray(payload.items)) throw new Error('Identity lookup returned malformed items');
		for (const raw of payload.items) {
			try {
				const item = object(raw, 'identity lookup item');
				const id = requiredString(item.id, 'identity lookup ID');
				if (!batch.includes(id)) throw new Error('Unexpected identity lookup ID');
				result.set(id, object(item.snippet, 'identity lookup snippet'));
			} catch { skippedItems += 1; }
		}
	}
	if (skippedItems) console.warn('YouTube identity lookup skipped malformed items', { resource, skippedItems });
	return { snippets: result, skippedItems };
}

/** Authoritative normalized handles for audit retention; IDs stay in memory. */
export async function fetchAuthorHandles(ids: string[], accessToken: string, deadline?: number): Promise<Map<string, string> & { skippedItems?: number }> {
	const { snippets, skippedItems } = await fetchIdentitySnippets('channels', ids, accessToken, deadline);
	const result = new Map<string, string>();
	for (const [id, snippet] of snippets) {
		const raw = snippet.customUrl;
		if (typeof raw !== 'string' || !raw.startsWith('@')) continue;
		const handle = raw.slice(1).toLowerCase();
		if (/^[\p{L}\p{N}._-]{3,30}$/u.test(handle)) result.set(id, handle);
	}
	return skippedItems ? Object.assign(result, { skippedItems }) : result;
}

/** Re-read pending comment authors before destructive enforcement, without storage. */
export async function fetchCommentAuthorIds(ids: string[], accessToken: string, deadline?: number): Promise<Map<string, string>> {
	const { snippets } = await fetchIdentitySnippets('comments', ids, accessToken, deadline);
	const result = new Map<string, string>();
	for (const [id, snippet] of snippets) {
		const author = snippet.authorChannelId;
		if (author && typeof author === 'object' && !Array.isArray(author)) {
			const value = (author as Record<string, unknown>).value;
			if (typeof value === 'string' && value.trim() === value && value) result.set(id, value);
		}
	}
	return result;
}
