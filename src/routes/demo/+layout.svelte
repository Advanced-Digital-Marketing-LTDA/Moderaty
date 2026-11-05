<script lang="ts">
	// The real signed-in app shell, fed demo data.
	import AppLayout from '../(app)/+layout.svelte';

	let { data, children } = $props();
</script>

<AppLayout {data} {children} />
