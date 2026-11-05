<script lang="ts">
	import DashboardPage from '../../(app)/dashboard/+page.svelte';

	let { data } = $props();
</script>

<DashboardPage {data} />
