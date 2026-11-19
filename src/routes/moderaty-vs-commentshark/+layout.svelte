<script lang="ts">
	import EditorialLayout from '$lib/components/blogs/EditorialLayout.svelte';
	let { children } = $props();
</script>

<EditorialLayout>{@render children()}</EditorialLayout>
