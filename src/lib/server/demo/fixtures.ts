// Fictional data for the screenshot-only /demo pages. Every comment and
// author is invented, no author identity is stored or shown, and the channel
// title labels the comments fictional. Shapes mirror the real loads in
// src/routes/(app)/ so the real components render unchanged.
import type { SessionUser } from '$lib/server/session';
import { TONE_LEVEL_OMNI_AND_TONE } from '$lib/toneLevels';

export const DEMO_CHANNEL_ID = 'demo-channel';
export const DEMO_CHANNEL_TITLE = 'Demo Channel (fictional comments)';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const STATUSES = ['pending', 'held', 'rejected', 'deleted', 'approved'] as const;

type DemoStatus = (typeof STATUSES)[number];
type DemoTab = 'overview' | 'queue' | 'rules' | 'log';

const DEMO_USER = {
	id: 'demo-user',
	email: 'creator@demo',
	displayName: 'Demo Creator',
	plan: 'free',
	orgId: 'demo-org',
	orgName: 'Demo Creator',
	orgRole: 'owner'
} as const satisfies SessionUser;

const RULES = [
	{ id: 1, pattern: 'free crypto', action: 'reject', daysAgo: 30 },
	{ id: 2, pattern: 'sub4sub', action: 'hold', daysAgo: 29 }
] as const;

type Decision = { by: 'rule'; ruleId: number } | { by: 'ai'; reason: string };

export interface DemoComment {
	key: string;
	text: string;
	hoursAgo: number;
	status: DemoStatus;
	auditAction: 'queue' | 'hold' | 'reject' | 'delete' | 'ban' | 'approve';
	decision: Decision;
}

export const DEMO_COMMENTS: readonly DemoComment[] = [
	{ key: 'free-crypto', hoursAgo: 26, status: 'rejected', auditAction: 'reject', decision: { by: 'rule', ruleId: 1 },
		text: "FREE CRYPTO giveaway. DM me on Telegram to claim 2 ETH before it's gone" },
	{ key: 'sub4sub', hoursAgo: 30, status: 'held', auditAction: 'hold', decision: { by: 'rule', ruleId: 2 },
		text: 'sub4sub? I sub back in 5 minutes, promise' },
	{ key: 'ackchyually-font', hoursAgo: 5, status: 'pending', auditAction: 'queue', decision: { by: 'ai', reason: 'tone score 0.58' },
		text: 'Ackchyually, that font is Helvetica Neue, not Helvetica. I paused at 4:12 to check. Twice.' },
	{ key: 'touch-grass', hoursAgo: 9, status: 'pending', auditAction: 'queue', decision: { by: 'ai', reason: 'tone score 0.66' },
		text: 'This video is mid and so is the lighting. Go touch grass.' },
	{ key: 'gif', hoursAgo: 20, status: 'pending', auditAction: 'queue', decision: { by: 'ai', reason: 'tone score 0.61' },
		text: "First. Also you pronounced gif wrong and I'm not letting it go." },
	{ key: 'edge-lord', hoursAgo: 14, status: 'held', auditAction: 'hold', decision: { by: 'ai', reason: 'tone score 0.97' },
		text: 'Edge Lord checking in. Your take is wrong, your editing is wrong, and your thumbnail is wrong.' },
	{ key: 'brigadier', hoursAgo: 44, status: 'rejected', auditAction: 'ban', decision: { by: 'ai', reason: 'ai score 0.96' },
		text: 'Brigadier here. The whole Discord is on the way to ratio this video. Brace.' },
	{ key: 'camera', hoursAgo: 50, status: 'deleted', auditAction: 'delete', decision: { by: 'ai', reason: 'ai score 0.81' },
		text: 'Worst tutorial on YouTube. Uninstall your camera.' },
	{ key: 'helpful', hoursAgo: 3, status: 'approved', auditAction: 'approve', decision: { by: 'ai', reason: 'ai score 0.02' },
		text: 'Great breakdown. The part at 4:12 finally made it click for me.' },
	{ key: 'correction', hoursAgo: 12, status: 'approved', auditAction: 'approve', decision: { by: 'ai', reason: 'ai score 0.04' },
		text: 'Small correction: the setting is under Advanced, not General. Still a really helpful video.' },
	{ key: 'saving', hoursAgo: 60, status: 'approved', auditAction: 'approve', decision: { by: 'ai', reason: 'ai score 0.01' },
		text: 'Watched this twice and saved it for my team. Thanks for keeping it short.' }
];

const TABS = new Map<string, DemoTab>([
	['/demo/channel', 'overview'],
	['/demo/channel/queue', 'queue'],
	['/demo/channel/rules', 'rules'],
	['/demo/channel/log', 'log']
]);

const iso = (time: number) => new Date(time).toISOString();
const commentId = (comment: DemoComment) => `demo-comment-${comment.key}`;
const publishedAt = (now: number, comment: DemoComment) => now - comment.hoursAgo * HOUR_MS;
const countOf = (status: DemoStatus) => DEMO_COMMENTS.filter((comment) => comment.status === status).length;
const banCount = () => DEMO_COMMENTS.filter((comment) => comment.auditAction === 'ban').length;
const lastRunAt = (now: number) => iso(now - 4 * MINUTE_MS);
// The queue, log and rules loads have an outage arm (maintenance: true), so the
// page type has no maintenance key on its normal arm. undefined fits that arm;
// the channel layout still supplies the real flag to its own overlay.
const PAGE_MAINTENANCE_UNSET: undefined = undefined;

function reasonFor(comment: DemoComment): string {
	if (comment.decision.by === 'ai') return comment.decision.reason;
	const { ruleId } = comment.decision;
	const rule = RULES.find((candidate) => candidate.id === ruleId);
	if (!rule) throw new Error(`demo fixtures: comment ${comment.key} points at missing rule #${ruleId}`);
	return `rule #${rule.id} (keyword: ${rule.pattern})`;
}

/** The (app) layout's data: one demo owner in one personal org. */
export function demoAppLayoutData() {
	return {
		user: { ...DEMO_USER },
		orgs: [{ orgId: DEMO_USER.orgId, name: DEMO_USER.orgName, role: DEMO_USER.orgRole }],
		maintenance: false
	};
}

/** The dashboard load's data for the single demo channel. */
export function demoDashboardData(now: number) {
	return {
		chs: [{
			id: DEMO_CHANNEL_ID,
			title: DEMO_CHANNEL_TITLE,
			cursor: iso(now - 3 * DAY_MS),
			lastRunAt: lastRunAt(now),
			lastRunStatus: 'success',
			lastSuccessAt: lastRunAt(now),
			lastRunError: null,
			active: 1,
			toneLevel: TONE_LEVEL_OMNI_AND_TONE,
			protectLgbtqia: 0,
			protectWomen: 0,
			scanning: false
		}],
		stats: STATUSES.map((status) => ({ channelId: DEMO_CHANNEL_ID, status, n: countOf(status) })),
		bans: [{ channelId: DEMO_CHANNEL_ID, n: banCount() }],
		maintenance: false,
		orgRole: DEMO_USER.orgRole
	};
}

/** The channel-shell tab for a demo path, or undefined when the path is not a demo channel page. */
export function demoChannelTab(pathname: string): DemoTab | undefined {
	return TABS.get(pathname);
}

/** The channel layout load's data. */
export function demoChannelLayoutData(now: number, tab: DemoTab) {
	return {
		ch: {
			id: DEMO_CHANNEL_ID,
			title: DEMO_CHANNEL_TITLE,
			lastRunAt: lastRunAt(now),
			lastRunStatus: 'success',
			lastRunError: null,
			lastSuccessAt: lastRunAt(now),
			toneLevel: TONE_LEVEL_OMNI_AND_TONE,
			protectLgbtqia: 0,
			protectWomen: 0,
			active: 1,
			scanning: false,
			dryRunScanning: false,
			moderationDryRunUsed: false,
			moderateRepliesSince: null,
			replySweepBoundary: null,
			replySweepPageToken: null,
			replySweepLastAt: null,
			replySweepShortfall: null
		},
		pending: countOf('pending'),
		banned: banCount(),
			replyPause: null,
		tab,
		maintenance: false,
		orgRole: DEMO_USER.orgRole
	};
}

/** The queue load's data: pending comments, newest first, already held on YouTube. */
export function demoQueueData(now: number) {
	const pending = DEMO_COMMENTS.filter((comment) => comment.status === 'pending')
		.toSorted((a, b) => a.hoursAgo - b.hoursAgo)
		.map((comment) => ({
			id: commentId(comment),
			text: comment.text,
			publishedAt: iso(publishedAt(now, comment)),
			holdState: 'completed',
			isReply: false,
			reason: reasonFor(comment)
		}));
	return { ch: { id: DEMO_CHANNEL_ID, title: DEMO_CHANNEL_TITLE }, pending, maintenance: PAGE_MAINTENANCE_UNSET };
}

/** The rules load's data: the two keyword rules, and no protected handles. */
export function demoRulesData(now: number) {
	const rs = RULES.map((rule) => ({
		id: rule.id,
		channelId: DEMO_CHANNEL_ID,
		type: 'keyword',
		pattern: rule.pattern,
		action: rule.action,
		createdAt: iso(now - rule.daysAgo * DAY_MS)
	}));
	return { ch: { id: DEMO_CHANNEL_ID, title: DEMO_CHANNEL_TITLE }, rs, handles: [], maintenance: PAGE_MAINTENANCE_UNSET };
}

/** The log load's data: one system decision per comment, newest first, no undo or recovery. */
export function demoLogData(now: number) {
	const entries = DEMO_COMMENTS.toSorted((a, b) => b.hoursAgo - a.hoursAgo)
		.map((comment, index) => ({
			id: index + 1,
			channelId: DEMO_CHANNEL_ID,
			commentId: commentId(comment),
			action: comment.auditAction,
			reason: reasonFor(comment),
			actor: 'system',
			text: null,
			authorHandle: null,
			createdAt: iso(publishedAt(now, comment) + MINUTE_MS),
			undoable: null,
			isReply: false
		}))
		.reverse();
	return {
		ch: { id: DEMO_CHANNEL_ID, title: DEMO_CHANNEL_TITLE },
		entries,
		recovery: [],
		dispatches: [],
		nextRecoveryHref: null,
		firstRecoveryHref: null,
		nextDispatchHref: null,
		firstDispatchHref: null,
		canRecover: true,
		nextCursor: null,
		hasPrev: false,
		maintenance: PAGE_MAINTENANCE_UNSET
	};
}
