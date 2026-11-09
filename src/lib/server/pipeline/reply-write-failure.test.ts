import { describe, expect, test } from 'vitest';

import { HttpTransportError } from '$lib/server/http';
import { YoutubeWriteRefusedError } from '$lib/server/youtube';
import { isParkableWriteFailure, writeFailureReason } from './reply-write-failure';

describe('a failed reply write', () => {
	test('a 503 on a reply hold parks the row, with the status in its reason', () => {
		const error = new Error('setModerationStatus failed: 503 backend error');

		expect(isParkableWriteFailure(error)).toBe(true);
		expect(writeFailureReason('hold', error)).toBe('reply hold failed at YouTube: 503 no reason code');
	});

	test('a transport failure parks the row, with no HTTP status in its reason', () => {
		const error = new HttpTransportError('socket hang up');

		expect(isParkableWriteFailure(error)).toBe(true);
		expect(writeFailureReason('hold', error)).toBe('reply hold failed at YouTube: no HTTP status');
	});

	test('a status-less error that is not a YouTube refusal is rethrown, not parked', () => {
		expect(isParkableWriteFailure(new Error('boom'))).toBe(false);
	});

	test('a run-level 429 is rethrown, not parked', () => {
		// The message carries no quota reason, so only the 429 status can rule it out.
		expect(isParkableWriteFailure(new YoutubeWriteRefusedError('setModerationStatus failed: 429 too many requests'))).toBe(false);
	});
});
