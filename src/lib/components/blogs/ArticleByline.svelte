<script lang="ts">
	import { BLOG_AUTHOR } from '$lib/blogs/author';

	let { authorHref, updated, readingMinutes }: {
		authorHref: string;
		updated: string;
		readingMinutes: number;
	} = $props();

	let updatedLabel = $derived(
		new Date(`${updated}T00:00:00Z`).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		})
	);
</script>

<p class="byline">By <a href={authorHref}>{BLOG_AUTHOR.name}</a> · Updated <time datetime={updated}>{updatedLabel}</time> · {readingMinutes} min read</p>

<style>
	.byline { font-size: 15px; color: var(--text-2); }
</style>
