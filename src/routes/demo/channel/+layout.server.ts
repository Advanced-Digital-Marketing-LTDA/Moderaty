import { error } from '@sveltejs/kit';

import { requireDemoPages } from '$lib/server/demo/config';
import { demoChannelLayoutData, demoChannelTab } from '$lib/server/demo/fixtures';

export function load({ url }) {
	requireDemoPages();
	const tab = demoChannelTab(url.pathname);
	if (!tab) throw error(404, 'Not Found');
	return demoChannelLayoutData(Date.now(), tab);
}
