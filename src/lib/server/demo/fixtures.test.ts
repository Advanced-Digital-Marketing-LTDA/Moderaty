import { expect, test } from 'vitest';

import {
	DEMO_CHANNEL_ID,
	DEMO_CHANNEL_TITLE,
	DEMO_COMMENTS,
	demoAppLayoutData,
	demoChannelLayoutData,
	demoChannelTab,
	demoDashboardData,
	demoLogData,
	demoQueueData,
	demoRulesData
} from './fixtures';

const NOW = Date.parse('2026-11-05T12:00:00.000Z');
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const count = (status: string) => DEMO_COMMENTS.filter((c) => c.status === status).length;
const BAN_COUNT = DEMO_COMMENTS.filter((c) => c.auditAction === 'ban').length;
const AUDIT_FOR_STATUS: Record<string, string[]> = {
	pending: ['queue'],
	held: ['hold'],
	rejected: ['reject', 'ban'],
	deleted: ['delete'],
	approved: ['approve']
};

test('the fixture covers every status column, at least one ban, and stays within comment limits', () => {
	expect(new Set(DEMO_COMMENTS.map((c) => c.status))).toEqual(new Set(['pending', 'held', 'rejected', 'deleted', 'approved']));
	expect(BAN_COUNT).toBeGreaterThan(0);
	expect(new Set(DEMO_COMMENTS.map((c) => c.key)).size).toBe(DEMO_COMMENTS.length);
	for (const comment of DEMO_COMMENTS) {
		expect(comment.text.length).toBeGreaterThan(0);
		expect(comment.text.length).toBeLessThanOrEqual(500);
		expect(AUDIT_FOR_STATUS[comment.status]).toContain(comment.auditAction);
		expect(comment.text.toLowerCase()).not.toContain('yt-mod');
	}
});

test('the channel title labels the comments fictional', () => {
	expect(DEMO_CHANNEL_TITLE).toMatch(/fictional/);
});

test('the app shell shows one demo owner in one org, never in maintenance', () => {
	const data = demoAppLayoutData();
	expect(data.maintenance).toBe(false);
	expect(data.user).toMatchObject({ displayName: 'Demo Creator', orgRole: 'owner' });
	expect(data.orgs).toEqual([{ orgId: data.user.orgId, name: data.user.orgName, role: 'owner' }]);
});

test('the dashboard shows the demo channel as recently checked and healthy, with counts matching the fixture', () => {
	const data = demoDashboardData(NOW);
	expect(data.maintenance).toBe(false);
	expect(data.chs).toHaveLength(1);
	expect(data.chs[0]).toMatchObject({ id: DEMO_CHANNEL_ID, title: DEMO_CHANNEL_TITLE, active: 1, lastRunStatus: 'success', lastRunError: null, scanning: false });
	expect(Date.parse(data.chs[0].lastRunAt)).toBe(NOW - 4 * 60_000);
	for (const status of ['pending', 'held', 'rejected', 'deleted', 'approved']) {
		expect(data.stats.find((s) => s.status === status)).toEqual({ channelId: DEMO_CHANNEL_ID, status, n: count(status) });
	}
	expect(data.bans).toEqual([{ channelId: DEMO_CHANNEL_ID, n: BAN_COUNT }]);
});

test.each([
	['/demo/channel', 'overview'],
	['/demo/channel/queue', 'queue'],
	['/demo/channel/rules', 'rules'],
	['/demo/channel/log', 'log']
])('%s maps to the %s tab', (path, tab) => {
	expect(demoChannelTab(path)).toBe(tab);
});

test.each(['/demo/channel/feedback', '/demo/channel/', '/channels/demo-channel/queue', '/demo/channelx'])('%s has no demo tab', (path) => {
	expect(demoChannelTab(path)).toBeUndefined();
});

test('the channel shell carries the tab, the pending count and the ban count', () => {
	const data = demoChannelLayoutData(NOW, 'queue');
	expect(data).toMatchObject({ tab: 'queue', pending: count('pending'), banned: BAN_COUNT, maintenance: false, orgRole: 'owner' });
	expect(data.ch).toMatchObject({ id: DEMO_CHANNEL_ID, title: DEMO_CHANNEL_TITLE, active: 1, lastRunStatus: 'success', scanning: false, dryRunScanning: false });
});

test('the queue lists only pending comments, newest first, with a reason and a completed hold', () => {
	const { ch, pending } = demoQueueData(NOW);
	expect(ch).toEqual({ id: DEMO_CHANNEL_ID, title: DEMO_CHANNEL_TITLE });
	expect(pending).toHaveLength(count('pending'));
	const times = pending.map((row) => Date.parse(row.publishedAt));
	expect(times).toEqual([...times].sort((a, b) => b - a));
	for (const row of pending) {
		expect(row.id.startsWith('demo-comment-')).toBe(true);
		expect(row.holdState).toBe('completed');
		expect(row.reason).toMatch(/^(ai|tone) score 0\.\d\d$/);
		expect(Date.parse(row.publishedAt)).toBeLessThan(NOW);
		expect(Date.parse(row.publishedAt)).toBeGreaterThanOrEqual(NOW - THREE_DAYS_MS);
	}
});

test('the rules page lists the keyword rules every rule-decided comment points at', () => {
	const { rs, handles } = demoRulesData(NOW);
	expect(handles).toEqual([]);
	expect(rs.map((r) => [r.type, r.pattern, r.action])).toEqual([
		['keyword', 'free crypto', 'reject'],
		['keyword', 'sub4sub', 'hold']
	]);
	expect(rs.every((r) => r.channelId === DEMO_CHANNEL_ID && Date.parse(r.createdAt) < NOW)).toBe(true);
});

test('the log has one system entry per comment, newest first, with real reason formats and no author identity', () => {
	const data = demoLogData(NOW);
	const { rs } = demoRulesData(NOW);
	expect(data).toMatchObject({ recovery: [], dispatches: [], canRecover: true, nextCursor: null, hasPrev: false });
	expect(data.entries).toHaveLength(DEMO_COMMENTS.length);
	expect(new Set(data.entries.map((e) => e.id)).size).toBe(data.entries.length);
	const times = data.entries.map((e) => Date.parse(e.createdAt));
	expect(times).toEqual([...times].sort((a, b) => b - a));
	for (const entry of data.entries) {
		const comment = DEMO_COMMENTS.find((c) => `demo-comment-${c.key}` === entry.commentId);
		expect(comment).toBeDefined();
		expect(entry).toMatchObject({ channelId: DEMO_CHANNEL_ID, action: comment?.auditAction, actor: 'system', text: null, authorHandle: null, undoable: null });
		const rule = rs.find((r) => entry.reason === `rule #${r.id} (keyword: ${r.pattern})`);
		if (rule) expect(comment?.text.toLowerCase()).toContain(rule.pattern);
		else expect(entry.reason).toMatch(/^(ai|tone) score 0\.\d\d$/);
	}
	expect(data.entries.filter((e) => e.reason.startsWith('rule #'))).toHaveLength(2);
});

test('demo queue and log rows are top-level comments, shaped like the real loads', () => {
	const { pending } = demoQueueData(NOW);
	const { entries } = demoLogData(NOW);
	expect(pending.map((row) => row.isReply)).toEqual(pending.map(() => false));
	expect(entries.map((entry) => entry.isReply)).toEqual(entries.map(() => false));
});
