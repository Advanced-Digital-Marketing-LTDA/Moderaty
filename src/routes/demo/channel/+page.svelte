<script lang="ts">
	import ChannelPage from '../../(app)/channels/[id]/+page.svelte';

	let { data } = $props();
</script>

<ChannelPage {data} form={null} />
