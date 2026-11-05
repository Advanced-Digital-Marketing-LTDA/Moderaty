import { requireDemoPages } from '$lib/server/demo/config';
import { demoDashboardData } from '$lib/server/demo/fixtures';

export function load() {
	requireDemoPages();
	return demoDashboardData(Date.now());
}
