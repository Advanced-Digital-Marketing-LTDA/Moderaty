import { requireDemoPages } from '$lib/server/demo/config';
import { demoQueueData } from '$lib/server/demo/fixtures';

export function load() {
	requireDemoPages();
	return demoQueueData(Date.now());
}
