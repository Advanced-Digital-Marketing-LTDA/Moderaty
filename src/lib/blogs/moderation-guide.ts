export const MODERATION_GUIDE = {
	path: '/guides/youtube-comment-moderation/',
	title: 'YouTube comment moderation for creators',
	description: 'Choose a response to YouTube comments, use native settings, manage review work, and test automation while keeping useful criticism.'
} as const;

export const MODERATION_GUIDE_EDITION = { updated: '2026-10-20', readingMinutes: 7 } as const;

export const MODERATION_GUIDE_SECTIONS = [
	{ id: 'choose-an-action', title: 'Choose an action for the comment' },
	{ id: 'native-settings', title: 'Start with YouTube settings' },
	{ id: 'review-workload', title: 'Manage the review workload' },
	{ id: 'choose-a-tool', title: 'Decide whether another tool helps' },
	{ id: 'test-automation', title: 'Test automation' },
	{ id: 'audience-feedback', title: 'Use audience feedback' },
	{ id: 'first-check', title: 'A practical first check' },
	{ id: 'frequently-asked-questions', title: 'Frequently asked questions' },
	{ id: 'about-the-author', title: 'About the author' }
] as const;
