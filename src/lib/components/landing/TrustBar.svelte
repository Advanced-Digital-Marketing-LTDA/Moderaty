<script lang="ts">
	const SIGNALS = ['YouTube Data API', 'OpenAI Moderation', 'Source available on GitHub'];
</script>

<section class="trust">
	<div class="trust-inner">
		<ul class="signals">
			{#each SIGNALS as s}
				<li class="signal">{s}</li>
			{/each}
		</ul>
		<p class="microcopy">
			Google asks for standard YouTube access. Moderaty uses it for channel setup, comment moderation, and video titles and descriptions for context. Source-available under PolyForm Shield, self-hosting costs $0 from Moderaty. Infrastructure and OpenAI charges are separate. Dry runs spend no credits and never change comments on YouTube: 1 per feature per channel, or 1 in total, scoring the newest 100 comments, on a hosted account without credits, a subscription, or the lifetime plan. Moderation previews drain the selected window in the background; feedback previews cover the first page, up to 100 comments.
			We keep no data on you beyond what your account needs to run, and nothing after you leave that
			the LGPD does not require.
		</p>
	</div>
</section>

<style>
	.trust {
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.trust-inner {
		max-width: 1152px;
		margin: 0 auto;
		padding: 32px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}
	.signals {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 8px 24px;
		opacity: 0.6;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.signal {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.01em;
		color: rgb(244 244 248 / 0.8);
	}
	.microcopy {
		max-width: 52ch;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
		letter-spacing: 0.01em;
		color: var(--text-muted);
		margin: 0;
	}
	@media (min-width: 768px) {
		.trust-inner {
			flex-direction: row;
			justify-content: space-between;
		}
		.microcopy {
			text-align: right;
		}
	}
</style>
