import { render } from 'svelte/server';
import { describe, expect, test, vi } from 'vitest';
import Homepage from './+page.svelte';
import PricingPage from './pricing/+page.svelte';
import { HOMEPAGE_FAQ_ENTRIES } from '$lib/landing/faq';
import { PRICING_FAQ_ENTRIES } from '$lib/landing/pricing-faq';

const state = vi.hoisted(() => ({ origin: 'https://moderaty.com' }));
vi.mock('$app/state', () => ({
	page: {
		get data() { return { locale: 'en', canonical: new URL('/pricing', state.origin).href }; },
		url: new URL('https://untrusted-request.example/pricing')
	}
}));

interface Offer {
	'@type': string;
	'@id': string;
	name: string;
	price: string;
	priceCurrency: string;
	url: string;
	description: string;
	seller: { '@id': string };
	priceSpecification?: {
		'@type': string;
		price: string;
		priceCurrency: string;
		referenceQuantity: { '@type': string; value: number; unitCode: string; unitText: string };
	};
}
interface Node {
	'@context'?: string;
	'@type': string;
	'@id': string;
	'@graph'?: Node[];
	name: string;
	url: string;
	license?: string;
	offers?: Offer[];
	publisher?: { '@id': string };
	isPartOf?: { '@id': string };
	mainEntity?: unknown;
}

const pages = [
	['homepage', () => render(Homepage, { props: { data: {
		siteOrigin: state.origin, locale: 'en' as const, canonical: null
	} } }), HOMEPAGE_FAQ_ENTRIES],
	['pricing', () => render(PricingPage), PRICING_FAQ_ENTRIES]
] as const;

function schemas(head: string): Node[] {
	return [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
		.map((match) => JSON.parse(match[1]) as Node);
}

describe.each(pages)('%s public structured data', (_name, renderPage, faqEntries) => {
	function publicGraph() {
		state.origin = 'https://moderaty.com';
		const documents = schemas(renderPage().head);
		const applications = documents.flatMap((item) => item['@graph'] ?? [item])
			.filter((item) => item['@type'] === 'SoftwareApplication');
		expect(applications).toHaveLength(1);
		const graph = documents.find((item) => item['@graph']);
		if (!graph) throw new Error('Public structured data graph was not rendered');
		const graphNodes = graph['@graph'];
		if (!graphNodes) throw new Error('Public structured data graph has no nodes');
		expect(graph['@context']).toBe('https://schema.org');
		expect(graphNodes).toHaveLength(3);
		return graphNodes;
	}

	test('links the software, website and verified legal publisher using stable absolute identities', () => {
		const graph = publicGraph();
		const organization = graph.find((item) => item['@type'] === 'Organization');
		const website = graph.find((item) => item['@type'] === 'WebSite');
		const app = graph.find((item) => item['@type'] === 'SoftwareApplication');
		expect(organization).toMatchObject({
			'@id': 'https://moderaty.com/#organization',
			name: 'Advanced Digital Marketing LTDA', url: 'https://moderaty.com/'
		});
		expect(website).toMatchObject({
			'@id': 'https://moderaty.com/#website', name: 'Moderaty', url: 'https://moderaty.com/',
			publisher: { '@id': organization?.['@id'] }
		});
		if (!website) throw new Error('WebSite schema node was not rendered');
		expect(app).toMatchObject({
			'@id': 'https://moderaty.com/#software', name: 'Moderaty', url: 'https://moderaty.com/',
			publisher: { '@id': organization?.['@id'] }, isPartOf: { '@id': website['@id'] },
			license: 'https://polyformproject.org/licenses/shield/1.0.0'
		});
	});

	test('describes all three published offers with their separate cost and billing conditions', () => {
		const app = publicGraph().find((item) => item['@type'] === 'SoftwareApplication');
		if (!app) throw new Error('SoftwareApplication schema node was not rendered');
		if (!app.offers) throw new Error('SoftwareApplication offers were not rendered');
		expect(app.offers).toHaveLength(3);
		const offers = app.offers;
		expect(offers.map((item) => [item.name, item.price, item.priceCurrency])).toEqual([
			['Self-hosted', '0', 'USD'], ['Hosted', '5', 'USD'], ['Lifetime', '49', 'USD']
		]);
		const [selfHosted, hosted, lifetime] = offers;
		expect(selfHosted.description).toMatch(/own infrastructure/i);
		expect(selfHosted.description).toMatch(/own OpenAI key/i);
		expect(selfHosted.description).toMatch(/infrastructure and OpenAI charges are separate/i);
		expect(selfHosted.description).toContain('PolyForm Shield 1.0.0');
		expect(selfHosted).not.toHaveProperty('priceSpecification');
		expect(hosted.description).toMatch(/renews monthly/i);
		expect(hosted.description).toMatch(/100 AI classifications.*shared.*moderation scoring.*enabled feedback digests/i);
		expect(hosted.description).toMatch(/unused.*does not carry over/i);
		expect(hosted.priceSpecification).toEqual({
			'@type': 'UnitPriceSpecification', price: '5', priceCurrency: 'USD',
			referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON', unitText: 'month' }
		});
		expect(lifetime.description).toMatch(/one-time.*lifetime hosting/i);
		expect(lifetime.description).toContain('1,000 lifetime places');
		expect(lifetime.description).toMatch(/requires your own OpenAI API key/i);
		expect(lifetime.description).toMatch(/OpenAI charges.*separately/i);
		expect(lifetime).not.toHaveProperty('priceSpecification');
		for (const offer of offers) {
			expect(offer['@type']).toBe('Offer');
			expect(offer.url).toBe('https://moderaty.com/pricing');
			expect(offer.seller).toEqual({ '@id': 'https://moderaty.com/#organization' });
		}
		expect(offers.map((item) => item['@id'])).toEqual([
			'https://moderaty.com/pricing#self-hosted-offer',
			'https://moderaty.com/pricing#hosted-offer',
			'https://moderaty.com/pricing#lifetime-offer'
		]);
	});

	test('omits unverified profiles, ratings, reviews and live availability claims', () => {
		const graph = JSON.stringify(publicGraph());
		for (const key of ['sameAs', 'aggregateRating', 'review', 'ratingValue', 'availability', 'inventoryLevel', 'priceValidUntil']) {
			expect(graph).not.toContain(`"${key}":`);
		}
	});

	test('preserves every FAQ answer from the visible FAQ source', () => {
		state.origin = 'https://moderaty.com';
		const rendered = renderPage();
		const faqs = schemas(rendered.head).filter((item) => item['@type'] === 'FAQPage');
		expect(faqs).toHaveLength(1);
		expect(faqs[0].mainEntity).toEqual(faqEntries.map(({ q, a }) => ({
			'@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a }
		})));
		for (const { q } of faqEntries) expect(rendered.body).toContain(q);
	});

	test.each(['https://selfhost.example', 'http://localhost:5173', 'https://moderaty.com.attacker.example'])(
		'does not identify an unverified deployment %s as the official operator or seller', (origin) => {
			state.origin = origin;
			try {
				const documents = schemas(renderPage().head);
				const nodes = documents.flatMap((item) => item['@graph'] ?? [item]);
				const applications = nodes.filter((item) => item['@type'] === 'SoftwareApplication');
				expect(applications).toHaveLength(1);
				expect(applications[0]).toMatchObject({ name: 'Moderaty', url: new URL('/', origin).href });
				expect(nodes).not.toEqual(expect.arrayContaining([expect.objectContaining({ '@type': 'Organization' })]));
				for (const node of nodes) {
					expect(node).not.toHaveProperty('offers');
					expect(node).not.toHaveProperty('publisher');
				}
				expect(JSON.stringify(documents)).not.toContain('https://moderaty.com/');
			} finally {
				state.origin = 'https://moderaty.com';
			}
		}
	);
});
