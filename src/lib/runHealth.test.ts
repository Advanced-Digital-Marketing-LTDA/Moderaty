import { expect, test } from 'vitest';
import { runFailureAction } from './runHealth';

test('the unpaid category shows the approved paused-state copy', () => {
	expect(runFailureAction('unpaid')).toBe(
		'Moderation is paused: this organization has no credits or subscription. Buy credits or subscribe on the Usage page.'
	);
});
