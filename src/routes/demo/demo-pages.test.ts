import { render } from 'svelte/server';
import { expect, test } from 'vitest';

import { DEMO_CHANNEL_TITLE, DEMO_COMMENTS, demoDashboardData, demoQueueData } from '$lib/server/demo/fixtures';
import DashboardPage from './dashboard/+page.svelte';
import QueuePage from './channel/queue/+page.svelte';

const NOW = Date.now();

test('the demo dashboard renders the demo channel as Protected through the real dashboard', () => {
	const body = render(DashboardPage, { props: { data: demoDashboardData(NOW) } as never }).body;
	expect(body).toContain(DEMO_CHANNEL_TITLE);
	expect(body).toContain('Protected');
});

test('the demo queue renders every pending fixture comment through the real queue page', () => {
	const body = render(QueuePage, { props: { data: demoQueueData(NOW), form: null } as never }).body;
	for (const comment of DEMO_COMMENTS.filter((c) => c.status === 'pending')) {
		// SSR escapes apostrophes; these three pending comments contain none.
		expect(body).toContain(comment.text);
	}
});
