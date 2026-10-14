export const SPAM_COMMENTS = {
	path: '/blogs/how-to-stop-spam-and-scam-comments-on-youtube/',
	title: 'How to stop spam and scam comments on your YouTube channel',
	description: 'Use YouTube’s native controls, review suspicious comments, and test narrow rules for impersonation, repeated messages, links, and phone-number patterns.'
} as const;

// readingMinutes is the rendered article's word count at 200 words per minute,
// rounded up; article-standards.test.ts recomputes it from the final text.
export const SPAM_COMMENTS_EDITION = { updated: '2026-10-14', readingMinutes: 12 } as const;

export const SPAM_COMMENT_SECTIONS = [
	{ id: 'native-controls', title: 'Which YouTube comment controls stop spam?' },
	{ id: 'impersonation', title: 'How do you spot creator impersonation comments?' },
	{ id: 'repeated-comments', title: 'What should you do about repeated and copied comments?' },
	{ id: 'suspicious-links', title: 'How should you handle suspicious links?' },
	{ id: 'phone-number-patterns', title: 'Does a phone number in a comment mean a scam?' },
	{ id: 'reporting', title: 'How do you report scams and impersonation on YouTube?' },
	{ id: 'custom-rules', title: 'How do you test custom moderation rules?' },
	{ id: 'false-positives', title: 'How do you protect legitimate comments?' },
	{ id: 'preview-rules', title: 'How do you preview moderation on your channel?' },
	{ id: 'faq', title: 'Frequently asked questions' }
] as const;

// The article displays these exact examples; tests exercise the real matcher.
// They are educational hold rules, not a production detection configuration.
export const SPAM_RULE_EXAMPLES = [
	{ id: 1, type: 'keyword', pattern: 'pay a delivery fee', action: 'hold', purpose: 'A recurring prize-fee phrase', example: 'You won a prize. Pay a delivery fee to claim it.', limitation: 'Also catches a viewer quoting that phrase to warn others.' },
	{ id: 2, type: 'keyword', pattern: 'sub4sub', action: 'hold', purpose: 'A recurring promotion phrase', example: 'Sub4sub? Visit my channel.', limitation: 'Also catches “Please stop posting sub4sub.” It does not count duplicates.' },
	{ id: 3, type: 'regex', pattern: 'https?://', action: 'hold', purpose: 'A web-link marker', example: 'Claim at https://example.invalid/prize', limitation: 'Also catches a useful source link. It cannot assess the destination’s safety.' },
	{ id: 4, type: 'regex', pattern: String.raw`\b(?:whatsapp|telegram)[ :]+[+]?[0-9][0-9 ()-]{7,20}[0-9]\b`, action: 'hold', purpose: 'An app name followed by a number', example: 'Contact Telegram: +1 202 555 0147 to claim a prize.', limitation: 'Also catches a legitimate contact message. Other wording and number formats can pass.' }
] as const;
