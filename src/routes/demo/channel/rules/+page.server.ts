import { requireDemoPages } from '$lib/server/demo/config';
import { demoRulesData } from '$lib/server/demo/fixtures';

export function load() {
	requireDemoPages();
	return demoRulesData(Date.now());
}
