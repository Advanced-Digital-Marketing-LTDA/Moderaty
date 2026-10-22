import { INCLUDED_COMMENTS, MONTHLY_PLAN_USD } from './cost';
import { POLYFORM_URL } from './links';

function publicOffers(home: string, organizationId: string) {
	const common = {
		'@type': 'Offer',
		url: new URL('/pricing', home).href,
		priceCurrency: 'USD',
		seller: { '@id': organizationId }
	};
	return [
		{
			...common, '@id': new URL('/pricing#self-hosted-offer', home).href,
			name: 'Self-hosted', price: '0',
			description: 'Self-hosted Moderaty costs $0 from Moderaty under the source-available PolyForm Shield 1.0.0 license. You provide your own infrastructure and your own OpenAI key. Infrastructure and OpenAI charges are separate.'
		},
		{
			...common, '@id': new URL('/pricing#hosted-offer', home).href,
			name: 'Hosted', price: String(MONTHLY_PLAN_USD),
			description: `Hosted Moderaty renews monthly at $${MONTHLY_PLAN_USD}, including ${INCLUDED_COMMENTS} AI classifications per paid month shared by moderation scoring and enabled feedback digests. Unused monthly allowance does not carry over. Additional credits are purchased separately; automatic top-up is opt-in and off by default.`,
			priceSpecification: {
				'@type': 'UnitPriceSpecification', price: String(MONTHLY_PLAN_USD), priceCurrency: 'USD',
				referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON', unitText: 'month' }
			}
		},
		{
			...common, '@id': new URL('/pricing#lifetime-offer', home).href,
			name: 'Lifetime', price: '49',
			description: 'A one-time $49 payment for lifetime hosting, limited to 1,000 lifetime places. AI scoring, including feedback digests, requires your own OpenAI API key, which you must provide and keep valid. OpenAI charges your account separately.'
		}
	];
}

/** Public business facts apply to the verified official site, not other operators' installations. */
export function publicSoftwareSchema(siteUrl: string, description: string) {
	const home = new URL('/', siteUrl).href;
	const application = {
		'@type': 'SoftwareApplication',
		'@id': new URL('/#software', home).href,
		name: 'Moderaty', url: home,
		applicationCategory: 'SecurityApplication', operatingSystem: 'Web',
		description, license: POLYFORM_URL
	};
	if (home !== 'https://moderaty.com/') {
		return { '@context': 'https://schema.org', ...application };
	}
	const organizationId = new URL('/#organization', home).href;
	const websiteId = new URL('/#website', home).href;
	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Organization', '@id': organizationId,
				name: 'Advanced Digital Marketing LTDA', url: home
			},
			{
				'@type': 'WebSite', '@id': websiteId, name: 'Moderaty', url: home,
				publisher: { '@id': organizationId }
			},
			{
				...application, publisher: { '@id': organizationId },
				isPartOf: { '@id': websiteId }, offers: publicOffers(home, organizationId)
			}
		]
	};
}
