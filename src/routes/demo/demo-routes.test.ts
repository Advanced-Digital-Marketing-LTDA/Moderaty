import { afterEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ env: {} as Record<string, string | undefined> }));
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/db', () => {
	throw new Error('demo pages must never load the database module');
});

import { DEMO_CHANNEL_ID, DEMO_COMMENTS } from '$lib/server/demo/fixtures';
import { load as appLayoutLoad } from './+layout.server';
import { load as dashboardLoad } from './dashboard/+page.server';
import { load as channelLayoutLoad } from './channel/+layout.server';
import { load as queueLoad } from './channel/queue/+page.server';
import { load as rulesLoad } from './channel/rules/+page.server';
import { load as logLoad } from './channel/log/+page.server';

const channelUrl = (path: string) => ({ url: new URL(`http://localhost:5173${path}`) }) as never;

const LOADS: Array<[string, () => unknown]> = [
	['app layout', () => appLayoutLoad()],
	['dashboard', () => dashboardLoad()],
	['channel layout', () => channelLayoutLoad(channelUrl('/demo/channel'))],
	['queue', () => queueLoad()],
	['rules', () => rulesLoad()],
	['log', () => logLoad()]
];

function setEnv(values: Record<string, string | undefined>) {
	for (const key of Object.keys(mocks.env)) delete mocks.env[key];
	Object.assign(mocks.env, values);
}

async function rejection(run: () => unknown): Promise<unknown> {
	try {
		await run();
	} catch (thrown) {
		return thrown;
	}
	throw new Error('expected the load to throw');
}

afterEach(() => vi.restoreAllMocks());

test.each(LOADS)('with the flag unset the %s load is a plain 404', async (_name, run) => {
	setEnv({ APP_URL: 'http://localhost:5173' });
	expect(await rejection(run)).toMatchObject({ status: 404 });
});

test.each(LOADS)('on the production domain the %s load refuses loudly', async (_name, run) => {
	setEnv({ DEMO_PAGES_ENABLED: 'true', APP_URL: 'https://moderaty.com' });
	vi.spyOn(console, 'error').mockImplementation(() => {});
	expect(await rejection(run)).toMatchObject({ status: 500 });
});

test('with the flag on every load returns demo data only', async () => {
	setEnv({ DEMO_PAGES_ENABLED: 'true', APP_URL: 'http://localhost:5173' });
	const shell = await appLayoutLoad();
	expect(shell).toMatchObject({ maintenance: false, user: { displayName: 'Demo Creator' } });
	const dashboard = await dashboardLoad();
	expect(dashboard.chs.map((ch) => ch.id)).toEqual([DEMO_CHANNEL_ID]);
	const channel = await channelLayoutLoad(channelUrl('/demo/channel/log'));
	expect(channel).toMatchObject({ tab: 'log', ch: { id: DEMO_CHANNEL_ID } });
	const queue = await queueLoad();
	expect(queue.pending.length).toBeGreaterThan(0);
	expect(queue.pending.every((row) => row.id.startsWith('demo-comment-'))).toBe(true);
	const rules = await rulesLoad();
	expect(rules.rs.map((r) => r.pattern)).toEqual(['free crypto', 'sub4sub']);
	const log = await logLoad();
	expect(log.entries).toHaveLength(DEMO_COMMENTS.length);
});

test('the channel layout 404s on a path that is not a demo channel page', async () => {
	setEnv({ DEMO_PAGES_ENABLED: 'true', APP_URL: 'http://localhost:5173' });
	expect(await rejection(() => channelLayoutLoad(channelUrl('/demo/channel/feedback')))).toMatchObject({ status: 404 });
});
