<script lang="ts">
	import { page } from '$app/state';

	const supportReference = $derived(page.error?.supportReference ?? null);
	const message = $derived(supportReference ? 'Something went wrong.' : page.error?.message ?? 'An error occurred.');
</script>

<svelte:head>
	<title>{page.status} | Moderaty</title>
</svelte:head>

<main role="alert" aria-labelledby="error-title">
	<section>
		<h1 id="error-title">{page.status}</h1>
		<p>{message}</p>
		{#if supportReference}
			<p>Support reference: <code>{supportReference}</code></p>
		{/if}
		<a href="/">Home</a>
	</section>
</main>

<style>
	main { max-width: 36rem; margin: 15vh auto; padding: 2rem; }
	section { padding: 1.5rem; border: 1px solid var(--border, #cbd5e1); border-radius: 0.5rem; background: var(--surface, white); }
	h1 { margin-top: 0; }
	p { overflow-wrap: anywhere; }
</style>
