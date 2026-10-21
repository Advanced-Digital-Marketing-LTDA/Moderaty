<script lang="ts">
	import Nav from '$lib/components/landing/Nav.svelte';
	import SkipLink from '$lib/components/landing/SkipLink.svelte';
	import Hero from '$lib/components/landing/Hero.svelte';
	import HomepageContent from '$lib/components/landing/HomepageContent.svelte';
	import Regulars from '$lib/components/landing/Regulars.svelte';
	import Manifesto from '$lib/components/landing/Manifesto.svelte';
	import Faq from '$lib/components/landing/Faq.svelte';
	import FinalCta from '$lib/components/landing/FinalCta.svelte';
	import Footer from '$lib/components/landing/Footer.svelte';
	import { HOMEPAGE_FAQ_ENTRIES } from '$lib/landing/faq';
	import { jsonLd } from '$lib/landing/json-ld';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const canonical = $derived(new URL('/', data.siteOrigin).href);
	const socialImage = $derived(new URL('/og.png', data.siteOrigin).href);

	const productDescription =
		'Moderate YouTube comments with custom rules, AI scoring, human review, and an audit log. Try Moderaty with a free moderation preview.';

	const softwareApplication = {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: 'Moderaty',
		applicationCategory: 'SecurityApplication',
		operatingSystem: 'Web',
		description: productDescription,
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		license: 'https://polyformproject.org/licenses/shield/1.0.0'
	};

	const faqPage = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: HOMEPAGE_FAQ_ENTRIES.map((f) => ({
			'@type': 'Question',
			name: f.q,
			acceptedAnswer: { '@type': 'Answer', text: f.a }
		}))
	};
</script>

<svelte:head>
	<title>AI YouTube Comment Moderation Software | Moderaty</title>
	<meta name="description" content={productDescription} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Moderaty" />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content="AI YouTube Comment Moderation Software | Moderaty" />
	<meta property="og:description" content={productDescription} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="AI YouTube Comment Moderation Software | Moderaty" />
	<meta name="twitter:description" content={productDescription} />
	<meta property="og:image" content={socialImage} />
	<meta name="twitter:image" content={socialImage} />
	{@html jsonLd(softwareApplication)}
	{@html jsonLd(faqPage)}
</svelte:head>

<SkipLink />
<Nav />
<main id="main-content" tabindex="-1">
	<Hero />
	<Regulars />
	<HomepageContent />
	<Manifesto />
	<Faq />
	<FinalCta />
</main>
<Footer />
