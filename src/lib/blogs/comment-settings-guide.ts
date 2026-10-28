export const COMMENT_SETTINGS_GUIDE = {
	path: '/guides/youtube-comment-moderation-settings/',
	title: 'YouTube Comment Settings: Basic, Strict, Hold All, and Community Viewer Posts',
	description: 'Compare YouTube comment moderation settings, blocked words and held comments, and learn how viewer-post controls differ.'
} as const;

export const COMMENT_SETTINGS_GUIDE_EDITION = { updated: '2026-10-28', readingMinutes: 6 } as const;

export const COMMENT_SETTINGS_GUIDE_SECTIONS = [
	{ id: 'video-settings', title: 'Choose a comment setting for videos' },
	{ id: 'defaults', title: 'Defaults, existing videos, and future comments' },
	{ id: 'viewer-posts', title: 'Viewer posts in your Community' },
	{ id: 'held-comments', title: 'What to check in comments held for review' },
	{ id: 'choose', title: 'A practical way to choose' },
	{ id: 'faq', title: 'Frequently asked questions' },
	{ id: 'about-the-author', title: 'About the author' }
] as const;
