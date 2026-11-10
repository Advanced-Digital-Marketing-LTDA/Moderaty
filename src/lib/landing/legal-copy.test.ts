// Copy guards for the legal documents and the privacy claim shared across
// surfaces. Restored from the removed legal.test.ts; these are deliberate
// wording checks, not behaviour tests.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY_NOTICE_TEXT } from '../server/legal';
import { FAQ_ENTRIES } from './faq';
import { LEGAL_DOCS } from './legal';

const COMPONENTS: Record<string, string> = {
	terms: 'Terms.svelte',
	privacy: 'Privacy.svelte',
	dpa: 'Dpa.svelte'
};

const LEGAL_COMPONENTS_DIR = new URL('../components/landing/legal/', import.meta.url);

function readComponent(slug: string): string {
	return readFileSync(new URL(COMPONENTS[slug], LEGAL_COMPONENTS_DIR), 'utf8');
}

describe('legal copy', () => {
	it('spells the statutory Portuguese names with diacritics', () => {
		for (const doc of LEGAL_DOCS) {
			expect(readComponent(doc.slug)).not.toMatch(/Protecao|Politica/);
		}
	});

	it('does not claim a Portuguese version is already published', () => {
		expect(readComponent('terms')).not.toContain('published in English and Portuguese');
		expect(readComponent('privacy')).not.toContain('published in English and Portuguese');
	});

	// Privacy marketing claims (homepage TrustBar, the LGPD FAQ answer, and the
	// consent-page privacy notice) must be scoped to "what your account needs
	// to run": account data IS stored while the account exists (Privacy §2), so
	// an absolute zero-data claim would contradict the Policy.
	it('user-data privacy claims are scoped to account needs, never absolute', () => {
		const trustBar = readFileSync(new URL('../components/landing/TrustBar.svelte', import.meta.url), 'utf8');
		const lgpdFaq = FAQ_ENTRIES.find((f) => f.q === 'Is Moderaty LGPD compliant?');
		expect(lgpdFaq, 'LGPD FAQ entry missing').toBeDefined();
		const ABSOLUTE = [/we (do not|don't) store/i, /stores? nothing about you\b(?![^.]*beyond)/i];
		for (const text of [trustBar, lgpdFaq?.a ?? '', PRIVACY_NOTICE_TEXT]) {
			expect(text).toMatch(/account needs to run/i);
			for (const pattern of ABSOLUTE) {
				expect(text).not.toMatch(pattern);
			}
		}
	});
});
