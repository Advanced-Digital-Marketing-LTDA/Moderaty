<script lang="ts">
	import Reveal from './Reveal.svelte';
	import { LOGIN_URL } from '$lib/landing/links';
</script>

<section class="final-cta">
	<div class="inner">
		<Reveal>
			<h2 class="title">Go touch grass. <span class="marker">Your rules have the comments.</span></h2>
		</Reveal>
		<Reveal delay={0.08}>
			<p class="intro">Set your boundaries, dry-run the bonks, and decide what deserves your attention.</p>
			<a href={LOGIN_URL} data-moderaty-event="connect_click" data-moderaty-placement="final_cta" class="btn-press cta">Connect your YouTube channel</a>
			<a href="/pricing" class="secondary">Explore all pricing options</a>
			<p class="microcopy">Google asks for standard YouTube access. Moderaty uses it for channel setup, comment moderation, and video titles and descriptions for context. Read the Privacy Policy for details.</p>
		</Reveal>
	</div>
</section>

<style>
	.final-cta {
		border-top: 1px solid var(--line);
	}
	.inner {
		max-width: 1152px;
		margin: 0 auto;
		padding: 128px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.title {
		max-width: 16ch;
		text-wrap: balance;
		font-family: var(--font-display);
		font-size: 48px;
		font-weight: 800;
		line-height: 1.02;
		letter-spacing: -0.02em;
		color: var(--paper);
		margin: 0;
	}
	.intro {
		margin: 24px auto 0;
		max-width: 54ch;
		line-height: 1.6;
		color: rgb(244 244 248 / 0.7);
	}
	.secondary {
		display: block;
		margin-top: 18px;
		color: var(--paper);
		text-underline-offset: 5px;
		text-decoration-color: var(--ban);
	}
	.cta {
		margin-top: 40px;
		display: inline-block;
		border-radius: 999px;
		background: var(--ban);
		color: var(--ink);
		font-size: 18px;
		font-weight: 600;
		padding: 16px 32px;
		text-decoration: none;
	}
	.microcopy {
		margin: 24px 0 0;
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--text-muted);
	}
	@media (min-width: 768px) {
		.title {
			font-size: 60px;
		}
	}
</style>
