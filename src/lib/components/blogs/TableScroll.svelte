<script lang="ts">
	import type { Snippet } from 'svelte';
	let { captionId, children }: { captionId: string; children: Snippet } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll this named table region.) -->
<div class="table-scroll" role="region" aria-labelledby={captionId} tabindex="0">
	{@render children()}
</div>
