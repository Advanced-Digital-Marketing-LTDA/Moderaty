<script lang="ts">
	import Reveal from './Reveal.svelte';
	import BonkQueue from './BonkQueue.svelte';
	import { LOGIN_URL } from '$lib/landing/links';
</script>

<section id="top" class="hero">
	<div class="hero-grid">
		<div class="hero-copy">
			<Reveal amount={0.1}>
				<p class="eyebrow"><span class="eyebrow-mark">{'//'}</span> AI YouTube comment moderation. Your rules come first.</p>
			</Reveal>
			<Reveal amount={0.1} delay={0.08}>
				<h1>Trolls get <span class="marker">the hammer.</span></h1>
			</Reveal>
			<Reveal amount={0.1} delay={0.16}>
				<p class="sub">
					Reading the comments is the job nobody hired you for. Moderaty checks published
					top-level comments on your connected YouTube channels: your
					rules swing first, AI scoring handles the rest, and the borderline ones wait in
					your review queue. No auto-replies. No posting as you. Just bonks.
				</p>
			</Reveal>
			<Reveal amount={0.1} delay={0.24}>
				<div class="cta-row">
					<a href={LOGIN_URL} data-moderaty-event="connect_click" data-moderaty-placement="hero" class="btn-press cta-primary">Connect your YouTube channel</a>
					<a href="/pricing" class="btn-press cta-ghost">See pricing</a>
				</div>
					<p class="reassurance">Each connected channel gets one free moderation dry run and one free feedback dry run; neither uses credits. Live moderation may start as soon as you connect a channel if your plan permits it. Previews do not change YouTube comments or pause live moderation.</p>
			</Reveal>
		</div>
		<Reveal class="hero-queue" amount={0.1} delay={0.2}>
			<BonkQueue />
		</Reveal>
	</div>
</section>

<style>
	.hero {
		display: flex;
		align-items: center;
		min-height: 100dvh;
		padding-top: 80px;
	}
	.hero-grid {
		max-width: 1152px;
		width: 100%;
		min-width: 0;
		margin: 0 auto;
		padding: 64px 24px;
		display: grid;
		align-items: center;
		gap: 48px;
	}
	.hero-copy {
		min-width: 0;
	}
	.eyebrow {
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.22em;
		color: var(--text-muted);
		margin: 0;
	}
	.eyebrow-mark {
		color: var(--ban);
	}
	h1 {
		margin: 20px 0 0;
		max-width: 20ch;
		text-wrap: balance;
		font-family: var(--font-display);
		font-size: 48px;
		font-weight: 800;
		line-height: 1.02;
		letter-spacing: -0.02em;
		color: var(--paper);
	}
	.sub {
		margin: 24px 0 0;
		max-width: 52ch;
		font-size: 18px;
		line-height: 1.6;
		color: rgb(244 244 248 / 0.7);
	}
	.cta-row {
		margin-top: 32px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 16px;
	}
	.cta-primary {
		border-radius: 999px;
		background: var(--ban);
		color: var(--ink);
		font-size: 16px;
		font-weight: 600;
		padding: 14px 28px;
		text-decoration: none;
	}
	.cta-ghost {
		border-radius: 999px;
		border: 1px solid var(--line);
		color: var(--paper);
		font-size: 16px;
		font-weight: 500;
		padding: 14px 28px;
		text-decoration: none;
		transition: border-color 200ms ease;
	}
	.cta-ghost:hover {
		border-color: rgb(244 244 248 / 0.4);
	}
	:global(.hero-queue) {
		min-width: 0;
	}
	.reassurance {
		margin: 24px 0 0;
		max-width: 60ch;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.7;
	}
	@media (min-width: 768px) {
		h1 {
			font-size: 60px;
		}
	}
	@media (min-width: 1024px) {
		.hero-grid {
			grid-template-columns: 1.15fr 1fr;
		}
	}
</style>
