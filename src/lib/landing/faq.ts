export type FaqEntry = { q: string; a: string };

/**
 * MC-3 approved homepage FAQ. Shared by the visible accordion and
 * the FAQPage JSON-LD, so structured data always matches visible copy.
 */
export const FAQ_ENTRIES: FaqEntry[] = [
	{
		q: 'Does Moderaty replace YouTube Studio?',
		a: 'No. YouTube Studio already offers AI-based Basic and Strict filters, blocked words, and Hold all. Moderaty adds configurable rules, automated decisions for eligible published top-level comments, its own review queue, and an audit trail.'
	},
	{
		q: 'Can Moderaty remove old comments?',
		a: "Yes, for published top-level comments in supported history windows. A live history moderation scan can take actions on YouTube and requires available paid credits or a usable OpenAI key on an eligible lifetime plan. It does not include reply threads or YouTube's separate Held queue."
	},
	{
		q: "What if AI can't decide?",
		a: 'Uncertain comments and scoring failures go to your review queue. A comment can remain publicly visible until YouTube confirms a requested hold.'
	},
	{
		q: 'Does Moderaty reply to comments for me?',
		a: 'No. Moderaty does not generate replies, post comments, or automate engagement.'
	},
	{
		q: 'Can I undo a moderation action?',
		a: 'Held and rejected comments can be restored. Deletions are permanent, and Moderaty cannot lift an author ban inside the app.'
	}
];
