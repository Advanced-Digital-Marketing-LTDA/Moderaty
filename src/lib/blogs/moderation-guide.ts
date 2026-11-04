export const MODERATION_GUIDE = {
	path: '/guides/youtube-comment-moderation/',
	title: 'YouTube comment moderation: settings, filters and tools',
	description: 'Learn how to moderate YouTube comments, choose Basic or Strict filters, review held comments, add moderators and test automation for your channel.'
} as const;

export const MODERATION_GUIDE_EDITION = { updated: '2026-10-24', readingMinutes: 8 } as const;

export const MODERATION_GUIDE_SECTIONS = [
	{ id: 'native-settings', title: 'Set up comment moderation' },
	{ id: 'blocked-words-and-links', title: 'Keep word and link rules narrow' },
	{ id: 'review-comments', title: 'Review Held and Published comments' },
	{ id: 'choose-an-action', title: 'Choose an action for the comment' },
	{ id: 'review-workload', title: 'Give the review queue an owner' },
	{ id: 'audience-feedback', title: 'Use recurring questions as feedback' },
	{ id: 'test-automation', title: 'Test automated moderation' },
	{ id: 'choose-a-tool', title: 'Decide whether another tool helps' },
	{ id: 'frequently-asked-questions', title: 'Common moderation questions' },
	{ id: 'first-check', title: 'A practical first check' },
	{ id: 'about-the-author', title: 'About the author' }
] as const;
