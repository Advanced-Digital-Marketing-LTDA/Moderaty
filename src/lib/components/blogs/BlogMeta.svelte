<script lang="ts">
	import { BLOG_AUTHOR } from '$lib/blogs/author';
	import { jsonLd } from '$lib/landing/json-ld';

	let { title, description, path, origin, article = false, schema: customSchema }: {
		title: string;
		description: string;
		path: string;
		origin: string;
		article?: boolean;
		// Replaces the default CollectionPage/BlogPosting block, for pages with their own JSON-LD.
		schema?: object;
	} = $props();

	let image = $derived(new URL('/og.png', origin).href);
	let canonical = $derived(new URL(path, origin).href);
	let defaultSchema = $derived({
		'@context': 'https://schema.org',
		'@type': article ? 'BlogPosting' : 'CollectionPage',
		...(article ? { headline: title, mainEntityOfPage: canonical } : { name: title }),
		...(article ? { author: { '@type': 'Person', name: BLOG_AUTHOR.name } } : {}),
		description,
		url: canonical,
		inLanguage: 'en'
	});
	let schema = $derived(customSchema ?? defaultSchema);
</script>

<svelte:head>
	<title>{title} | Moderaty</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta property="og:type" content={article ? 'article' : 'website'} />
	<meta property="og:site_name" content="Moderaty" />
	<meta property="og:title" content="{title} | Moderaty" />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={image} />
	<meta property="og:image:alt" content="Moderaty comment protection for YouTube creators" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="{title} | Moderaty" />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
	<meta name="twitter:image:alt" content="Moderaty comment protection for YouTube creators" />
	{@html jsonLd(schema)}
</svelte:head>
