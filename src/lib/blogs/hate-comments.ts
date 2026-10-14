export const HATE_COMMENTS = {
	path: '/blogs/how-to-deal-with-hate-comments-on-youtube/',
	title: 'How to deal with hate comments on YouTube',
	description: 'Decide when to ignore, reply, remove, hide or report YouTube comments. Keep useful criticism and reduce the abuse you have to read.'
} as const;

// readingMinutes is the rendered article's word count at 200 words per minute,
// rounded up; article-standards.test.ts recomputes it from the final text.
export const HATE_COMMENTS_EDITION = { updated: '2026-10-14', readingMinutes: 9 } as const;

export const HATE_COMMENT_SECTIONS = {
	summary: { id: 'summary', title: 'Summary' },
	takeaways: { id: 'key-takeaways', title: 'Key takeaways' },
	action: { id: 'choose-an-action', title: 'Which action fits the comment?' },
	criticism: { id: 'criticism-or-attack', title: 'Is it criticism or a personal attack?' },
	reply: { id: 'reply-to-negative-comments', title: 'When should you reply to a hate comment?' },
	remove: { id: 'remove-or-hide', title: 'How do you remove a comment, hide a user or report abuse?' },
	reduce: { id: 'reduce-hate-comments', title: 'How can you read fewer harmful comments?' },
	preview: { id: 'preview-moderation', title: 'When does moderation software help?' },
	faq: { id: 'frequently-asked-questions', title: 'Frequently asked questions' },
	author: { id: 'about-the-author', title: 'About the author' }
} as const;
