<script lang="ts">
	// Keyboard users jump past the nav to the page's <main id={target}>.
	let { target = 'main-content' }: { target?: string } = $props();
</script>

<a href={`#${target}`} class="skip-link">Skip to content</a>

<style>
	.skip-link {
		position: fixed;
		top: 8px;
		left: 16px;
		z-index: 100;
		padding: 12px 16px;
		background: var(--paper);
		color: var(--ink);
		transform: translateY(-160%);
	}
	.skip-link:focus { transform: translateY(0); }
</style>
