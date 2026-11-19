import { INCLUDED_COMMENTS, MONTHLY_PLAN_USD } from '$lib/landing/cost';
import { TOP_UP_BUNDLES_COPY } from '$lib/landing/plans';

export const COMMENTSHARK_COMPARISON = {
	path: '/moderaty-vs-commentshark/',
	title: 'Moderaty vs CommentShark',
	description: 'Moderaty vs CommentShark for YouTube comments: what each tool does, how each one bills, and which fits a channel that needs moderation or AI replies.'
} as const;

// Every CommentShark fact on the page was read from its own public pages on this date.
export const COMMENTSHARK_RETRIEVED = '2026-11-19';

export const COMMENTSHARK_COMPARISON_EDITION = { updated: COMMENTSHARK_RETRIEVED, readingMinutes: 8 } as const;

export const COMMENTSHARK_COMPARISON_SECTIONS = [
	{ id: 'at-a-glance', title: 'Moderaty and CommentShark at a glance' },
	{ id: 'pricing', title: 'How do the prices compare?' },
	{ id: 'billing-units', title: 'What does one unit of usage mean?' },
	{ id: 'commentshark-stronger', title: 'Where CommentShark is stronger' },
	{ id: 'moderaty-stronger', title: 'Where Moderaty is stronger' },
	{ id: 'neither', title: 'What neither tool does' },
	{ id: 'choosing', title: 'How to choose' },
	{ id: 'sources', title: 'Sources and dates' },
	{ id: 'faq', title: 'Frequently asked questions' }
] as const;

export const COMMENTSHARK_SOURCES = {
	pricing: { label: 'CommentShark pricing', href: 'https://www.commentshark.com/pricing' },
	faq: { label: 'CommentShark FAQ', href: 'https://www.commentshark.com/faq' },
	commentActions: { label: 'CommentShark comment actions', href: 'https://www.commentshark.com/features/comment-actions' },
	sentiment: { label: 'CommentShark sentiment insights', href: 'https://www.commentshark.com/features/sentiment-insights' },
	teamAccess: { label: 'CommentShark team access', href: 'https://www.commentshark.com/features/team-access' },
	api: { label: 'CommentShark API reference', href: 'https://www.commentshark.com/docs/api' },
	connectClaude: { label: 'CommentShark Connect Claude', href: 'https://www.commentshark.com/connect-claude' }
} as const;

export const COMMENTSHARK_PLANS = [
	{ name: 'Free', price: '$0 a month', rules: '3', actions: '20', checks: 'every 2 hours' },
	{ name: 'Starter', price: '$19 a month', rules: '10', actions: '500', checks: 'every 30 minutes' },
	{ name: 'Creator', price: '$49 a month', rules: '25', actions: '1,500', checks: 'every 30 minutes' },
	{ name: 'Pro', price: '$139 a month', rules: '50', actions: '5,000', checks: 'every 30 minutes' },
	{ name: 'Custom', price: 'Custom pricing', rules: 'Custom', actions: 'Custom', checks: 'every 30 minutes' }
] as const;

export const COMMENTSHARK_ACTION_PACKS = [
	{ name: 'Bite Pack', actions: '500', price: '$29' },
	{ name: 'Feast Pack', actions: '1,500', price: '$79' },
	{ name: 'Frenzy Pack', actions: '5,000', price: '$189' }
] as const;

// Moderaty's own numbers come from the plan constants, so this page cannot drift from the pricing page.
export const MODERATY_PLANS = [
	{ name: 'Self-hosted', price: '$0 from Moderaty', covers: 'Your own infrastructure and OpenAI key; their charges are separate.' },
	{ name: 'Hosted monthly', price: `$${MONTHLY_PLAN_USD} a month`, covers: `${INCLUDED_COMMENTS} AI classifications shared by moderation scoring and enabled feedback digests. Unused monthly allowance does not carry over.` },
	{ name: 'Top-up credits', price: TOP_UP_BUNDLES_COPY, covers: 'Purchased credits stay on your balance until used.' },
	{ name: 'Lifetime', price: '$49 once', covers: '1,000 lifetime places, hosted access with your own OpenAI key.' }
] as const;

export const COMPARISON_ROWS = [
	{
		topic: 'Built for',
		moderaty: 'Moderating published top-level comments with AI scoring, your rules and a human review queue.',
		commentshark: 'Replying to, moderating and deleting comments with rules you write, including AI-written replies.'
	},
	{
		topic: 'Platforms',
		moderaty: 'YouTube comments.',
		commentshark: 'YouTube only.'
	},
	{
		topic: 'How comments are judged',
		moderaty: 'OpenAI moderation scoring, an optional tone pass, keyword and regex rules, blocked users and protected handles.',
		commentshark: 'Rules you write: keyword, starts with, exact match, regex, any comment, or a plain-English description the AI matches.'
	},
	{
		topic: 'Replies',
		moderaty: 'Never writes replies.',
		commentshark: 'Template or AI-written replies, either posted automatically or held for your approval.'
	},
	{
		topic: 'Actions on a comment',
		moderaty: 'Hold for review, reject (hide), delete, or reject and ban.',
		commentshark: 'Reply, hold for review, reject, delete, or email you.'
	},
	{
		topic: 'Review queue',
		moderaty: 'Held comments wait in a queue where you approve, reject, delete or ban.',
		commentshark: 'Drafted replies and moderation actions wait for approval, in the app or by email.'
	},
	{
		topic: 'How often comments are checked',
		moderaty: 'One channel per background run and one page of up to 100 comments per run, so it is not real-time.',
		commentshark: 'New comments every 30 minutes on paid plans and every 2 hours on Free.'
	},
	{
		topic: 'Trying it before it acts',
		moderaty: 'A dry run over 1, 3, 6, 12 or 24 months that changes nothing on YouTube.',
		commentshark: 'Test a rule on a pasted or recent comment; replay rules on older comments on paid plans.'
	},
	{
		topic: 'Teams',
		moderaty: 'Owner, admin and member roles.',
		commentshark: 'Owner, Admin, Editor and Viewer roles; invited teammates sign in by an emailed link.'
	},
	{
		topic: 'Insights',
		moderaty: 'Opt-in weekly feedback digests of questions, criticism, corrections and requests. They never reply or change moderation.',
		commentshark: 'Sentiment scores, AI tags, a trend dashboard and alert emails when negative comments pass a threshold.'
	},
	{
		topic: 'Programmatic access',
		moderaty: 'No public API.',
		commentshark: 'A REST API and a connector for Claude.'
	},
	{
		topic: 'Self-hosting',
		moderaty: 'Yes, free under the PolyForm Shield license.',
		commentshark: 'Described as a hosted service; no self-hosted option appears on its site.'
	}
] as const;
