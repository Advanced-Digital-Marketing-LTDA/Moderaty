import { describe, expect, test } from 'vitest';
import { createFakeYoutube, listPage, thread } from './fake-youtube';

// The fake answers only the real YouTube host and path. Anything else is recorded as unrouted, so a test fails on it.
describe('the fake YouTube routes', () => {
	test('a YouTube path on another host is unrouted, not answered', async () => {
		const youtube = createFakeYoutube();

		await expect(youtube.fetch('https://example.invalid/youtube/v3/commentThreads?part=snippet')).rejects.toThrow('unrouted YouTube request');
		expect(youtube.unrouted).toEqual(['GET /youtube/v3/commentThreads']);
	});

	test('a path without the /youtube/v3 prefix is unrouted, even on the YouTube host', async () => {
		const youtube = createFakeYoutube();

		await expect(youtube.fetch('https://www.googleapis.com/commentThreads?part=snippet')).rejects.toThrow('unrouted YouTube request');
		expect(youtube.unrouted).toEqual(['GET /commentThreads']);
	});

	test('a Request object is routed like a URL string', async () => {
		const youtube = createFakeYoutube();
		youtube.handlers.threads = () => listPage([thread('top-1', '2026-11-07T08:00:00.000Z')]);

		const response = await youtube.fetch(new Request('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet'));

		expect(response.status).toBe(200);
		expect(youtube.requests.map((request) => request.route)).toEqual(['threads']);
		expect(youtube.unrouted).toEqual([]);
	});
});
