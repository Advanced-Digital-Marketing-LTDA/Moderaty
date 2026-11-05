<script lang="ts">
	import QueuePage from '../../../(app)/channels/[id]/queue/+page.svelte';

	let { data } = $props();
</script>

<QueuePage {data} form={null} />
