export const COMMENT_REVIEW_ROUTINE = {
	path: '/guides/comment-review-routine/',
	title: 'YouTube Comment Review Routine: Timer On, Endless Scrolling Off',
	description: 'Run a 15-minute YouTube comment review routine on a timer: clear Held for review first, skim published comments next, then turn repeat trolls into rules.'
} as const;

export const COMMENT_REVIEW_ROUTINE_EDITION = { updated: '2026-11-06', readingMinutes: 9 } as const;

export const COMMENT_REVIEW_ROUTINE_SECTIONS = [
	{ id: 'why-a-timer', title: 'Why a timer beats scrolling comments all day' },
	{ id: 'set-filters-once', title: 'Before the timer starts: set the filters once' },
	{ id: 'held-first', title: 'Minutes 0 to 5: clear the Held for review tab' },
	{ id: 'skim-published', title: 'Minutes 5 to 10: skim what already went public' },
	{ id: 'turn-trolls-into-rules', title: "Minutes 10 to 15: turn today's trolls into tomorrow's rules" },
	{ id: 'when-more-than-routine', title: 'When a comment needs more than the routine' },
	{ id: 'what-the-routine-cannot-see', title: "What the routine can't see" },
	{ id: 'hand-part-to-a-tool', title: 'When to hand part of the routine to a tool' },
	{ id: 'frequently-asked-questions', title: 'Frequently asked questions' },
	{ id: 'about-the-author', title: 'About the author' }
] as const;
