<script lang="ts">
	import RulesPage from '../../../(app)/channels/[id]/rules/+page.svelte';

	let { data } = $props();
</script>

<RulesPage {data} form={null} />
