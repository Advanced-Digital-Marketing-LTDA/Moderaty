<script lang="ts">
	import LogPage from '../../../(app)/channels/[id]/log/+page.svelte';

	let { data } = $props();
</script>

<LogPage {data} form={null} />
