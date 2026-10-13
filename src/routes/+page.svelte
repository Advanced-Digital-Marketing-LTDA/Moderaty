<script lang="ts">
	import Nav from '$lib/components/landing/Nav.svelte';
	import Hero from '$lib/components/landing/Hero.svelte';
	import HomepageContent from '$lib/components/landing/HomepageContent.svelte';
	import Faq from '$lib/components/landing/Faq.svelte';
	import FinalCta from '$lib/components/landing/FinalCta.svelte';
	import Footer from '$lib/components/landing/Footer.svelte';
	import { HOMEPAGE_FAQ_ENTRIES } from '$lib/landing/faq';
	import { jsonLd } from '$lib/landing/json-ld';

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
	<link rel="canonical" href="https://moderaty.com/" />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="https://moderaty.com/" />
	<meta property="og:title" content="AI YouTube Comment Moderation Software | Moderaty" />
	<meta property="og:description" content={productDescription} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="AI YouTube Comment Moderation Software | Moderaty" />
	<meta name="twitter:description" content={productDescription} />
	<meta property="og:image" content="https://moderaty.com/og.png" />
	<meta name="twitter:image" content="https://moderaty.com/og.png" />
	{@html jsonLd(softwareApplication)}
	{@html jsonLd(faqPage)}
</svelte:head>

<Nav />
<main>
	<Hero />
	<HomepageContent />
	<Faq />
	<FinalCta />
</main>
<Footer />
