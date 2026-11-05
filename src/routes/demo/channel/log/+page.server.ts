import { requireDemoPages } from '$lib/server/demo/config';
import { demoLogData } from '$lib/server/demo/fixtures';

export function load() {
	requireDemoPages();
	return demoLogData(Date.now());
}
