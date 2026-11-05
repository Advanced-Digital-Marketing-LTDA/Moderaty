<script lang="ts">
	// The real channel shell (header, counts, tabs), fed demo data.
	import ChannelLayout from '../../(app)/channels/[id]/+layout.svelte';

	let { data, children } = $props();
</script>

<ChannelLayout {data} {children} />
