<script lang="ts">
	import { page } from '$app/state';

	const supportReference = $derived(page.error?.supportReference ?? null);
	const message = $derived(supportReference ? 'Something went wrong.' : page.error?.message ?? 'An error occurred.');
</script>

<svelte:head>
	<title>{page.status} | Moderaty</title>
</svelte:head>

<main role="alert" aria-labelledby="error-title">
	<div class="error-box">
		<h1 id="error-title">{page.status}</h1>
		<p>{message}</p>
		{#if supportReference}
			<p>Support reference: <code>{supportReference}</code></p>
		{/if}
		<a href="/">Home</a>
	</div>
</main>

<style>
	main { max-width: 36rem; margin: 15vh auto; padding: 2rem; }
	h1 { margin-top: 0; }
	p { overflow-wrap: anywhere; }
</style>
