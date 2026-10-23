<script lang="ts">
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import { MODERATION_GUIDE } from '$lib/blogs/moderation-guide';
	import { GUIDES_INDEX } from '$lib/blogs/guides-index';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<BlogMeta title={GUIDES_INDEX.title} description={GUIDES_INDEX.description} path={GUIDES_INDEX.path} origin={data.siteOrigin} />

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol><li><a href="/">Home</a></li><li aria-current="page">Guides</li></ol>
</nav>
<h1>{GUIDES_INDEX.title}</h1>
<p>{GUIDES_INDEX.description}</p>
<article>
	<h2><a href={MODERATION_GUIDE.path}>{MODERATION_GUIDE.title}</a></h2>
	<p>{MODERATION_GUIDE.description}</p>
</article>
