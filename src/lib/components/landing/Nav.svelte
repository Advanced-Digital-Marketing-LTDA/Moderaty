<script lang="ts">
	import Icon from './Icon.svelte';
	import { FEEDBACK_URL, GITHUB_URL, LOGIN_URL } from '$lib/landing/links';

	const LINKS = [
		{ label: 'How it works', href: '/#how-it-works' },
		{ label: 'Preview', href: '/#moderation-preview' },
		{ label: 'Digest', href: '/#digest' },
		{ label: 'Coverage', href: '/#scope' },
		{ label: 'Pricing', href: '/pricing' },
		{ label: 'FAQ', href: '/#faq' }
	];

	// Tools sits right after this link in both the desktop bar and the mobile list.
	const TOOLS_AFTER = '/pricing';
	const TOOLS = [{ label: 'YouTube money calculator', href: '/tools/youtube-money-calculator/' }];

	let open = $state(false);
	let toolsOpen = $state(false);
	let mobileToolsOpen = $state(false);
	let toolsEl: HTMLElement | undefined = $state();

	const closeToolsOnOutsideClick = (event: MouseEvent) => {
		if (toolsOpen && toolsEl && !toolsEl.contains(event.target as Node)) toolsOpen = false;
	};
	const closeToolsOnEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape') toolsOpen = false;
	};
</script>

<svelte:window onclick={closeToolsOnOutsideClick} onkeydown={closeToolsOnEscape} />

<header class="nav">
	<div class="nav-inner">
		<a href="/#top" class="wordmark">Moderaty</a>
		<nav class="links" aria-label="Primary">
			{#each LINKS as l}
				<a href={l.href} data-moderaty-event={l.href === '/pricing' ? 'pricing_click' : undefined} data-moderaty-placement={l.href === '/pricing' ? 'nav' : undefined} class="link">{l.label}</a>
				{#if l.href === TOOLS_AFTER}
					<div class="tools" bind:this={toolsEl}>
						<button type="button" class="link tools-toggle" aria-expanded={toolsOpen} aria-controls="tools-menu" onclick={() => (toolsOpen = !toolsOpen)}>Tools</button>
						{#if toolsOpen}
							<div id="tools-menu" class="tools-panel">
								{#each TOOLS as tool}
									<a href={tool.href} class="tools-link" onclick={() => (toolsOpen = false)}>{tool.label}</a>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
			<a href={GITHUB_URL} data-moderaty-event="source_click" data-moderaty-placement="nav" target="_blank" rel="noopener noreferrer" class="link">GitHub</a>
			<a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" class="link">Feedback</a>
		</nav>
		<div class="nav-actions">
			<a href={LOGIN_URL} data-moderaty-event="connect_click" data-moderaty-placement="nav" class="btn-press cta">Connect YouTube channel</a>
			<button
				class="btn-press menu-btn"
				onclick={() => (open = !open)}
				aria-label={open ? 'Close menu' : 'Open menu'}
				aria-expanded={open}
			>
				<Icon name={open ? 'x' : 'list'} size={22} />
			</button>
		</div>
	</div>
	{#if open}
		<nav class="mobile-links" aria-label="Mobile">
			{#each LINKS as l}
				<a href={l.href} data-moderaty-event={l.href === '/pricing' ? 'pricing_click' : undefined} data-moderaty-placement={l.href === '/pricing' ? 'nav_mobile' : undefined} class="mobile-link" onclick={() => (open = false)}>{l.label}</a>
				{#if l.href === TOOLS_AFTER}
					<div class="mobile-tools">
						<button type="button" class="mobile-link mobile-tools-toggle" aria-expanded={mobileToolsOpen} aria-controls="tools-menu-mobile" onclick={() => (mobileToolsOpen = !mobileToolsOpen)}>Tools</button>
						{#if mobileToolsOpen}
							<div id="tools-menu-mobile" class="mobile-tools-panel">
								{#each TOOLS as tool}
									<a href={tool.href} class="mobile-link" onclick={() => { mobileToolsOpen = false; open = false; }}>{tool.label}</a>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
			<a href={GITHUB_URL} data-moderaty-event="source_click" data-moderaty-placement="nav_mobile" target="_blank" rel="noopener noreferrer" class="mobile-link">GitHub</a>
			<a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" class="mobile-link">Feedback</a>
			<a href={LOGIN_URL} data-moderaty-event="connect_click" data-moderaty-placement="nav_mobile" class="btn-press cta mobile-cta">Connect YouTube channel</a>
		</nav>
	{/if}
</header>

<style>
	.nav {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 50;
		border-bottom: 1px solid var(--line);
		background: rgb(11 11 20 / 0.85);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}
	.nav-inner {
		max-width: 1152px;
		margin: 0 auto;
		padding: 0 24px;
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
	}
	.wordmark {
		flex-shrink: 0;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.01em;
		color: var(--paper);
		text-decoration: none;
	}
	.links {
		flex-shrink: 0;
		display: none;
		align-items: center;
		gap: 20px;
	}
	.link {
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.01em;
		color: var(--text-muted);
		text-decoration: none;
		transition: color 200ms ease;
	}
	.link:hover {
		color: var(--paper);
	}
	.nav-actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.cta {
		white-space: nowrap;
		display: none;
		border-radius: var(--radius-sm);
		background: var(--ban);
		color: var(--ink);
		font-size: 14px;
		font-weight: 600;
		padding: 12px 20px;
		text-decoration: none;
	}
	.menu-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: 0;
		color: var(--paper);
		cursor: pointer;
		padding: 8px;
	}
	.mobile-links {
		border-top: 1px solid var(--line);
		background: var(--ink);
		padding: 16px 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.mobile-link {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.01em;
		color: rgb(244 244 248 / 0.7);
		text-decoration: none;
	}
	.mobile-cta {
		display: inline-block;
		width: fit-content;
		margin-top: 8px;
	}
	.tools {
		position: relative;
	}
	.tools-toggle,
	.mobile-tools-toggle {
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		text-align: left;
	}
	.tools-panel {
		position: absolute;
		top: calc(100% + 16px);
		right: 0;
		min-width: 240px;
		display: grid;
		gap: 4px;
		padding: 8px;
		border: 1px solid var(--line);
		background: rgb(11 11 20 / 0.98);
	}
	.tools-link {
		display: block;
		padding: 12px 12px;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.01em;
		color: var(--paper);
		text-decoration: none;
	}
	.tools-link:hover {
		background: rgb(244 244 248 / 0.06);
	}
	.mobile-tools {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.mobile-tools-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-left: 16px;
	}
	.tools-toggle:focus-visible,
	.tools-link:focus-visible,
	.mobile-tools-toggle:focus-visible,
	.mobile-tools-panel .mobile-link:focus-visible {
		outline: 2px solid var(--paper);
		outline-offset: 2px;
	}
	/* Keep the compact menu until every desktop group fits with its gap. */
	@media (min-width: 1152px) {
		.links {
			display: flex;
		}
		.cta {
			display: inline-block;
		}
		.menu-btn {
			display: none;
		}
		.mobile-links {
			display: none;
		}
	}
</style>
