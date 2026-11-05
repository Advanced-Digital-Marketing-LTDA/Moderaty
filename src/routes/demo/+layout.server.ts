import { requireDemoPages } from '$lib/server/demo/config';
import { demoAppLayoutData } from '$lib/server/demo/fixtures';

// Screenshot-only demo (AGENTS.md, Demo Pages): fictional data, no database,
// no session. Every demo load guards itself; a client navigation can skip a
// parent layout load.
export function load() {
	requireDemoPages();
	return demoAppLayoutData();
}
