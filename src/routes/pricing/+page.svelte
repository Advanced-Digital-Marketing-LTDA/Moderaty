<script lang="ts">
	// I12 exception (approved for static marketing routes, same as the
	// homepage): this page is fully static and prerendered — there is no data
	// loading, so loading/empty/error states cannot occur and SSR always
	// renders the populated page.
	import Nav from '$lib/components/landing/Nav.svelte';
	import SkipLink from '$lib/components/landing/SkipLink.svelte';
	import PricingHero from '$lib/components/landing/pricing/PricingHero.svelte';
	import PricingPlans from '$lib/components/landing/pricing/PricingPlans.svelte';
	import CostMath from '$lib/components/landing/pricing/CostMath.svelte';
	import PricingFaq from '$lib/components/landing/pricing/PricingFaq.svelte';
	import FinalCta from '$lib/components/landing/FinalCta.svelte';
	import Footer from '$lib/components/landing/Footer.svelte';
	import { PRICING_FAQ_ENTRIES } from '$lib/landing/pricing-faq';
	import { TOP_UP_BUNDLES_COPY } from '$lib/landing/plans';
	import { jsonLd } from '$lib/landing/json-ld';
	import { publicSoftwareSchema } from '$lib/landing/public-schema';
	import { page } from '$app/state';

	// The root layout publishes this page's canonical from the configured APP_URL;
	// card URLs reuse that origin so they never point at the request host.
	const pageUrl = $derived.by(() => {
		const canonical = page.data.canonical;
		if (!canonical) throw new Error('Pricing page needs the layout canonical (canonicalUrl in siteIndex.ts must cover /pricing).');
		return canonical;
	});
	const socialImage = $derived(new URL('/og.png', pageUrl).href);
	const socialTitle = 'Protection, priced like a utility.';
	const socialDescription =
		'Self-hosted Moderaty costs $0 from Moderaty under the source-available PolyForm Shield license; infrastructure and OpenAI charges are separate. Hosted: $5 a month for 100 AI classifications shared by moderation scoring and feedback digests, or $49 once for lifetime hosting (1,000 lifetime places, your own OpenAI key).';
	const softwareApplication = $derived(publicSoftwareSchema(pageUrl, socialDescription));

	const faqPage = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: PRICING_FAQ_ENTRIES.map((f) => ({
			'@type': 'Question',
			name: f.q,
			acceptedAnswer: { '@type': 'Answer', text: f.a }
		}))
	};
</script>

<svelte:head>
	<title>Pricing | Moderaty</title>
	<meta
		name="description"
		content={`Self-hosted Moderaty costs $0 from Moderaty under the source-available PolyForm Shield license; infrastructure and OpenAI charges are separate. Hosted: $5 a month for 100 AI classifications shared by moderation scoring and feedback digests; top-ups: ${TOP_UP_BUNDLES_COPY}. 1,000 lifetime places: $49 once for lifetime hosting, with your own OpenAI key.`}
	/>
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Moderaty" />
	<meta property="og:url" content={pageUrl} />
	<meta property="og:title" content={socialTitle} />
	<meta property="og:description" content={socialDescription} />
	<meta property="og:image" content={socialImage} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={socialTitle} />
	<meta name="twitter:description" content={socialDescription} />
	<meta name="twitter:image" content={socialImage} />
	{@html jsonLd(faqPage)}
	{@html jsonLd(softwareApplication)}
</svelte:head>

<SkipLink />
<Nav />
<main id="main-content" tabindex="-1">
	<PricingHero />
	<PricingPlans />
	<CostMath />
	<PricingFaq />
	<FinalCta />
</main>
<Footer />
