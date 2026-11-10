// SSR render tests for the reply moderation section of the channel overview.
// Structure only: attributes, roles, labels and the data-state contract.
// Svelte's SSR render is lazy: assert on render(...).body.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'svelte/server';

import Page from './+page.svelte';

const NOW = '2026-11-07T12:00:00.000Z';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const isoBefore = (ms: number) => new Date(Date.parse(NOW) - ms).toISOString();

type ChannelRow = {
	id: string;
	title: string;
	active: number;
	toneLevel: number;
	protectLgbtqia: number;
	protectWomen: number;
	scanning: boolean;
	dryRunScanning: boolean;
	moderationDryRunUsed: boolean;
	moderateRepliesSince: string | null;
	replySweepBoundary: string | null;
	replySweepLastAt: string | null;
	replySweepShortfall: number | null;
};

const CHANNEL: ChannelRow = {
	id: 'UC1',
	title: 'My Channel',
	active: 1,
	toneLevel: 1,
	protectLgbtqia: 0,
	protectWomen: 0,
	scanning: false,
	dryRunScanning: false,
	moderationDryRunUsed: false,
	moderateRepliesSince: null,
	replySweepBoundary: null,
	replySweepLastAt: null,
	replySweepShortfall: null
};

type ChannelOverrides = Partial<ChannelRow>;

function renderOverview(options: { role?: string; ch?: ChannelOverrides; form?: unknown; replyPause?: 'paused-by-server' | 'paused-quota-today' | null } = {}) {
	const data = {
		ch: { ...CHANNEL, ...options.ch },
		pending: 0,
		banned: 0,
		tab: 'overview',
		maintenance: false,
		orgRole: options.role ?? 'owner',
		replyPause: options.replyPause ?? null
	};
	return render(Page, { props: { data, form: options.form ?? null } as never }).body;
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(NOW));
});

afterEach(() => {
	vi.useRealTimers();
});

function statusTag(body: string): string {
	const tag = body.match(/<p[^>]*data-state="[^"]*"[^>]*>/)?.[0];
	if (!tag) throw new Error('reply status element was not rendered');
	return tag;
}

function checkboxTag(body: string): string {
	const tag = body.match(/<input[^>]*name="enabled"[^>]*>/)?.[0];
	if (!tag) throw new Error('reply checkbox was not rendered');
	return tag;
}

function replyForm(body: string): string {
	const form = body.match(/<form[^>]*action="\?\/setModerateReplies"[\s\S]*?<\/form>/)?.[0];
	if (!form) throw new Error('reply form was not rendered');
	return form;
}

const isChecked = (tag: string) => /\schecked(?=[\s=/>])/.test(tag);

test('an owner gets a labelled checkbox that posts true, and a save button that names the channel', () => {
	const body = renderOverview();
	const tag = checkboxTag(body);

	expect(tag).toContain('type="checkbox"');
	expect(tag).toContain('value="true"');
	expect(tag).toContain('id="moderate-replies-UC1"');
	expect(body).toContain('for="moderate-replies-UC1"');

	const button = replyForm(body).match(/<button[^>]*>/)?.[0] ?? '';
	expect(button).toContain('type="submit"');
	expect(button).toMatch(/aria-label="[^"]*My Channel[^"]*"/);
});

test('the reply checkbox is ticked while reply moderation is on and unticked while it is off', () => {
	expect(isChecked(checkboxTag(renderOverview()))).toBe(false);
	const on = renderOverview({ ch: { moderateRepliesSince: NOW, replySweepLastAt: NOW } });
	expect(isChecked(checkboxTag(on))).toBe(true);
});

test('the unticked fallback follows the checkbox, so a ticked box is the first value the action reads', () => {
	const body = renderOverview({ ch: { moderateRepliesSince: NOW, replySweepLastAt: NOW } });
	const checkboxAt = body.indexOf(checkboxTag(body));
	const fallbackAt = body.indexOf('<input type="hidden" name="enabled" value="false"');

	expect(fallbackAt).toBeGreaterThan(checkboxAt);
});

test.each([{ role: 'member' }, { role: 'admin' }])('a team $role sees the status but no reply form', ({ role }) => {
	const body = renderOverview({ role, ch: { moderateRepliesSince: NOW, replySweepLastAt: NOW } });

	expect(body).not.toContain('action="?/setModerateReplies"');
	expect(body).not.toContain('name="enabled"');
	expect(statusTag(body)).toContain('data-state="first-check-pending"');
});

test.each([
	{
		name: 'a channel that never turned replies on',
		ch: {},
		state: 'off'
	},
	{
		name: 'a channel switched on a moment ago',
		ch: { moderateRepliesSince: NOW, replySweepLastAt: NOW },
		state: 'first-check-pending'
	},
	{
		name: 'a channel with a pass running within six hours',
		ch: { moderateRepliesSince: isoBefore(2 * DAY), replySweepBoundary: isoBefore(3 * DAY), replySweepLastAt: isoBefore(HOUR) },
		state: 'in-progress'
	},
	{
		name: 'a channel with a pass running for six hours and one millisecond',
		ch: { moderateRepliesSince: isoBefore(2 * DAY), replySweepBoundary: isoBefore(3 * DAY), replySweepLastAt: isoBefore(6 * HOUR + 1) },
		state: 'stale'
	},
	{
		name: 'a channel with a finished check',
		ch: { moderateRepliesSince: isoBefore(2 * DAY), replySweepLastAt: isoBefore(2 * HOUR) },
		state: 'last-check'
	}
])('the status element reads $state for $name', ({ ch, state }) => {
	const body = renderOverview({ ch });

	expect(statusTag(body)).toContain(`data-state="${state}"`);
});

test('a shortfall above zero is exposed on the status element with its number', () => {
	const body = renderOverview({
		ch: { moderateRepliesSince: isoBefore(2 * DAY), replySweepLastAt: isoBefore(2 * HOUR), replySweepShortfall: 3 }
	});

	expect(statusTag(body)).toContain('data-shortfall="3"');
});

test.each([{ shortfall: null }, { shortfall: 0 }])('no shortfall attribute is rendered when the shortfall is $shortfall', ({ shortfall }) => {
	const body = renderOverview({
		ch: { moderateRepliesSince: isoBefore(2 * DAY), replySweepLastAt: isoBefore(2 * HOUR), replySweepShortfall: shortfall }
	});

	expect(statusTag(body)).not.toContain('data-shortfall');
});

test.each(['paused-by-server', 'paused-quota-today'] as const)('a %s pause shows as its own status state, not as the checkpoint it hides', (replyPause) => {
	const body = renderOverview({
		replyPause,
		ch: { moderateRepliesSince: isoBefore(2 * DAY), replySweepBoundary: isoBefore(3 * DAY), replySweepLastAt: isoBefore(HOUR) }
	});

	expect(statusTag(body)).toContain(`data-state="${replyPause}"`);
	expect(isChecked(checkboxTag(body))).toBe(true);
});

test('a pause does not show while reply moderation is off', () => {
	const body = renderOverview({ replyPause: 'paused-quota-today' });

	expect(statusTag(body)).toContain('data-state="off"');
	expect(isChecked(checkboxTag(body))).toBe(false);
});

test('a failed save renders its error in the page alert box', () => {
	const body = renderOverview({ form: { scope: 'replies', channelId: 'UC1', error: 'save failed in test' } });

	expect(body).toMatch(/<p class="error-box"[^>]*role="alert"/);
	expect(body).toContain('save failed in test');
});
