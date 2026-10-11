import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyTestTrustOutput } from './verify-output.mjs';

test('rejects missing or invalid score evidence', () => {
	for (const score of [undefined, '', 'NaN', '-1', '101', '1.5']) {
		assert.throws(() => verifyTestTrustOutput({ score, verdict: 'neutral' }), /valid score/);
	}
});

test('rejects missing and invalid verdict evidence', () => {
	for (const verdict of [undefined, '', 'unknown']) {
		assert.throws(() => verifyTestTrustOutput({ score: '100', verdict }), /recognized verdict/);
	}
});

test('rejects a failed verdict and any score at or below the configured threshold', () => {
	assert.throws(() => verifyTestTrustOutput({ score: '100', verdict: 'fail' }), /gate failed/);
	for (const score of ['0', '60', '85']) {
		assert.throws(() => verifyTestTrustOutput({ score, verdict: 'pass' }), /gate failed/);
	}
});

test('accepts nonempty passing or neutral evidence above the threshold', () => {
	assert.equal(verifyTestTrustOutput({ score: '86', verdict: 'pass' }), true);
	assert.equal(verifyTestTrustOutput({ score: '100', verdict: 'neutral' }), true);
});
