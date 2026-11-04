import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FAQ_ENTRIES } from './faq';
import { TICKS_SELF_HOSTED, TICKS_SELF_HOSTED_DETAILED } from './plans';
import { SCRIPT } from './queue-script';

describe('landing copy guardrails', () => {
	it('ships exactly the 12 FAQ pairs, each a real question with a real answer', () => {
		expect(FAQ_ENTRIES).toHaveLength(12);
		for (const { q, a } of FAQ_ENTRIES) {
			expect(q.endsWith('?')).toBe(true);
			expect(a.length).toBeGreaterThan(40);
		}
	});

	it('uses no em-dashes or en-dashes anywhere in FAQ or queue copy', () => {
		for (const { q, a } of FAQ_ENTRIES) {
			expect(q).not.toMatch(/[—–]/);
			expect(a).not.toMatch(/[—–]/);
		}
		for (const item of SCRIPT) {
			expect(item.text).not.toMatch(/[—–]/);
			expect(item.reason).not.toMatch(/[—–]/);
		}
	});

	it('states separate one-time moderation and first-page feedback previews accurately', () => {
		const previewFaq = FAQ_ENTRIES.find(({ q }) => q === 'Can I test Moderaty without changing anything on my channel?');
		expect(previewFaq?.a).toContain('With credits, a subscription, or the lifetime plan, each channel gets 1 free moderation dry run and 1 free feedback dry run.');
			expect(previewFaq?.a).toContain('A hosted account without any of those gets 1 free dry run in total, which scores the newest 100 comments.');
			expect(previewFaq?.a).toContain('Dry runs spend no credits and never change comments on YouTube.');
		expect(previewFaq?.a).toContain('Moderation previews drain the selected window in the background; feedback previews cover the first page, up to 100 comments.');
		expect(TICKS_SELF_HOSTED.join(' ')).toContain('1 free dry run per feature per channel');
		expect(TICKS_SELF_HOSTED_DETAILED.join(' ')).toContain('1 free dry run per feature per channel');
		const howItWorks = readFileSync(new URL('../components/landing/HowItWorks.svelte', import.meta.url), 'utf8').replace(/\s+/g, ' ');
		const trustBar = readFileSync(new URL('../components/landing/TrustBar.svelte', import.meta.url), 'utf8').replace(/\s+/g, ' ');
			const helpPage = readFileSync(new URL('../../routes/(app)/help/+page.svelte', import.meta.url), 'utf8').replace(/\s+/g, ' ');
			expect(helpPage).toContain('With credits, a subscription, or the lifetime plan, each channel gets 1 free moderation dry run and 1 free feedback dry run. A hosted account without any of those gets 1 free dry run in total, which scores the newest 100 comments. Dry runs spend no credits and never change comments on YouTube.');
		expect(howItWorks).toContain('With credits, a subscription, or the lifetime plan, each channel gets 1 free moderation dry run and 1 free feedback dry run. A hosted account without any of those gets 1 free dry run in total, which scores the newest 100 comments. Dry runs spend no credits and never change comments on YouTube.');
		expect(howItWorks).toContain('Moderation previews drain the selected window in the background; feedback previews cover the first page, up to 100 comments.');
		// The full preview sentence — dropping "no credits" or the feedback
		// scope half must fail, not slip through as a substring (cubic).
		expect(trustBar).toContain(
			'Dry runs spend no credits and never change comments on YouTube: 1 per feature per channel, or 1 in total, scoring the newest 100 comments, on a hosted account without credits, a subscription, or the lifetime plan. Moderation previews drain the selected window in the background; feedback previews cover the first page, up to 100 comments.'
		);
	});
});
