<script lang="ts">
	import '../app.css';
	import Analytics from '$lib/components/Analytics.svelte';

	let { children, data } = $props();

	// hooks.server.ts rewrites <html lang> only on a full page load; after
	// client-side navigation the layout load re-runs (data.locale is already
	// gated to the surface's coverage) but the attribute would go stale —
	// keep it describing the rendered surface (cubic, PR #142).
	$effect(() => {
		document.documentElement.lang = data.locale;
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
	{#if data.canonical}
		<link rel="canonical" href={data.canonical} />
	{/if}
</svelte:head>

{@render children()}

<Analytics />
