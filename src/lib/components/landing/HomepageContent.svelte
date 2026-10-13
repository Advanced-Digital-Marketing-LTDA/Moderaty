<script lang="ts">
	import { GITHUB_URL, LOGIN_URL } from '$lib/landing/links';

	const EXAMPLES = [
		{
			comment: 'Could you explain step two in another video?',
			setup: 'No matching custom rule; ordinary comment',
			outcome: 'Leave published'
		},
		{
			comment: 'Subscribe to my channel for prizes!',
			setup: 'Creator-defined self-promotion rule',
			outcome: 'Hold for review'
		},
		{
			comment: 'The music is too loud in the first minute.',
			setup: 'No matching rule; substantive criticism',
			outcome: 'Leave published'
		},
		{
			comment: 'See my special offer at [link removed].',
			setup: 'Creator-defined URL pattern rule',
			outcome: 'Hold for review'
		}
	];
</script>

<section id="how-it-works" class="section" aria-labelledby="how-title">
	<div class="intro">
		<p class="eyebrow">Moderation that follows your rules</p>
		<h2 id="how-title" class="section-title">Decide what belongs in your comment section</h2>
		<p class="lede">
			YouTube Studio's built-in moderation settings can hold potentially inappropriate
			comments, but they may not match every rule you want for your community. Moderaty
			adds a configurable rules-first workflow, AI scoring, a human review queue, and
			an audit log for your connected channels.
		</p>
		<p class="lede">
			Keep corrections and genuine criticism. Set boundaries for abuse, repeated
			promotion, and unwanted patterns. You decide what your rules should do.
		</p>
	</div>
	<div class="steps">
		<article class="panel">
			<span class="number" aria-hidden="true">01</span>
			<h3>Write the rules</h3>
			<p>
				Create keyword, pattern (regex), or user rules. A matching rule can select
				hold, reject, delete, or ban. Protected handles bypass Moderaty's rules and
				AI scoring.
			</p>
		</article>
		<article class="panel">
			<span class="number" aria-hidden="true">02</span>
			<h3>Let AI assess what your rules don't decide</h3>
			<p>
				For the remaining eligible comments, Moderaty screens for prompt-injection
				attempts and scores toxicity across 13 categories. A model score is a
				moderation signal, not proof that a viewer violated your policy.
			</p>
			<p>
				When scoring fails or a case needs closer review, Moderaty sends it to your
				queue rather than silently approving or rejecting it.
			</p>
		</article>
		<article class="panel">
			<span class="number" aria-hidden="true">03</span>
			<h3>Review the uncertain cases</h3>
			<p>
				Use your review queue to decide what happens next. The audit log shows
				recorded decisions and completed actions. A requested hold may not take
				effect until YouTube confirms it.
			</p>
		</article>
	</div>
	<a href={LOGIN_URL} class="inline-link">Preview moderation on your channel <span aria-hidden="true">→</span></a>
</section>

<section id="moderation-preview" class="section preview-section" aria-labelledby="preview-title">
	<p class="eyebrow">Proof of process</p>
	<h2 id="preview-title" class="section-title">See the decisions before they go live</h2>
	<p class="lede">
		The comments and decisions below are <strong>Illustrative examples</strong>, not
		real viewers, measured accuracy results, or a live scan. They show how
		creator-selected rules and review can work together.
	</p>
	<div class="table-wrap">
		<table>
			<caption>Fictional comments and example moderation outcomes</caption>
			<thead>
				<tr>
					<th scope="col">Fictional incoming comment</th>
					<th scope="col">Example setup</th>
					<th scope="col">Illustrative outcome</th>
				</tr>
			</thead>
			<tbody>
				{#each EXAMPLES as example (example.comment)}
					<tr>
						<td>“{example.comment}”</td>
						<td>{example.setup}</td>
						<td><strong>{example.outcome}</strong></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="note">
		Actual outcomes depend on your rules, AI settings, and YouTube's confirmation of
		requested actions. Preview your own comments to check both false positives and
		comments that might be missed.
	</p>
	<a href={LOGIN_URL} class="inline-link">Run your free moderation preview <span aria-hidden="true">→</span></a>
</section>

<section id="history" class="section" aria-labelledby="history-title">
	<p class="eyebrow">Decision visibility</p>
	<h2 id="history-title" class="section-title">See what happened, not just what the model predicted</h2>
	<p class="lede">
		Moderaty records moderation intent before sending changes to YouTube and logs
		completed actions. You can inspect what was held, rejected, deleted, or banned,
		and what still needs attention.
	</p>
	<p class="lede">
		You can restore held and rejected comments.
		<strong>Deleted comments cannot be restored. Author bans cannot be reversed inside Moderaty.</strong>
		Check the preview and your rules before allowing irreversible actions.
	</p>
</section>

<section id="digest" class="section digest-section" aria-labelledby="digest-title">
	<div class="two-col">
		<div>
			<p class="eyebrow">Optional audience feedback</p>
			<h2 id="digest-title" class="section-title">Don't lose the useful feedback</h2>
			<p class="lede">
				Turn on the optional, read-only feedback digest to group recurring questions,
				corrections, substantive criticism, and viewer requests from scanned
				top-level comments.
			</p>
			<p class="lede">
				Use those themes to decide what to clarify or cover next. The digest
				does not reply to viewers, post comments, or change moderation decisions.
				It can run weekly, after 100 new comments, or when you request it.
			</p>
			<a href={LOGIN_URL} class="inline-link">Connect a channel to preview the feedback digest <span aria-hidden="true">→</span></a>
		</div>
		<div class="digest-example">
			<p class="example-label">Illustrative feedback themes</p>
			<dl>
				<div><dt>Recurring question</dt><dd>Can you explain the setup in more detail?</dd></div>
				<div><dt>Correction</dt><dd>The date mentioned at 2:15 appears incorrect.</dd></div>
				<div><dt>Request</dt><dd>Could you make a follow-up on this topic?</dd></div>
			</dl>
			<p class="note">Synthetic examples only. Actual digests depend on the comments scanned.</p>
		</div>
	</div>
</section>

<section id="pricing" class="section" aria-labelledby="pricing-title">
	<p class="eyebrow">Hosting and usage</p>
	<h2 id="pricing-title" class="section-title">Choose how you want to run Moderaty</h2>
	<div class="plans">
		<article class="plan panel">
			<p class="plan-tag">Self-hosted</p>
			<p class="plan-price">$0 <span>Moderaty subscription</span></p>
			<p>
				Run the source-available software on your own infrastructure under the
				PolyForm Shield 1.0.0 license. Supply your own OpenAI API key for AI
				features. Infrastructure and API costs are separate.
			</p>
			<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" data-moderaty-event="source_click" data-moderaty-placement="plan_self_hosted">View the source on GitHub <span aria-hidden="true">↗</span></a>
		</article>
		<article class="plan panel">
			<p class="plan-tag">Hosted</p>
			<p class="plan-price">$5 <span>per month</span></p>
			<p>
				Moderaty operates the service. The subscription includes 100 AI
				classifications per month, shared between moderation scoring and
				enabled feedback digests. Additional credits are sold in bundles.
				Automatic top-up is optional and off by default.
			</p>
			<a href="/pricing" data-moderaty-event="pricing_click" data-moderaty-placement="home_pricing">See hosted usage and costs <span aria-hidden="true">→</span></a>
		</article>
		<article class="plan panel">
			<p class="plan-tag">Lifetime hosting</p>
			<p class="plan-price">$49 <span>one-time</span></p>
			<p>
				Limited to 1,000 lifetime places, subject to availability. No Moderaty monthly
				subscription or per-comment meter under this offer. You supply and
				pay for your own OpenAI API key.
			</p>
			<a href="/pricing" data-moderaty-event="pricing_click" data-moderaty-placement="home_pricing">Check offer availability <span aria-hidden="true">→</span></a>
		</article>
	</div>
	<a href="/pricing" class="inline-link" data-moderaty-event="pricing_click" data-moderaty-placement="home_pricing">Compare plans and estimate usage <span aria-hidden="true">→</span></a>
</section>

<section id="scope" class="section scope-section" aria-labelledby="scope-title">
	<p class="eyebrow">Coverage and control</p>
	<h2 id="scope-title" class="section-title">What Moderaty does and doesn't moderate</h2>
	<p class="lede">
		Moderaty scans <strong>published top-level YouTube comments</strong> on connected,
		active channels. It can also scan published top-level comment history in supported
		windows, subject to the plan's usage requirements.
	</p>
	<p class="lede">
		It does <strong>not</strong> moderate reply threads or live chat, and it does
		<strong>not</strong> run a separate sweep of comments already held by YouTube for
		review or marked as spam. It never writes a reply under your name.
	</p>
	<p class="lede">
		YouTube Studio may be all you need if its native controls fit your channel.
		Moderaty is for creators who want explicit moderation rules, a separate review
		workflow, and visibility into recorded decisions.
	</p>
	<div class="access">
		<h3>Your channel access, explained</h3>
		<p>
			Connecting a YouTube channel involves a separate Google permission request
			using the <code>youtube.force-ssl</code> scope. YouTube does not provide a narrower
			comments-only scope for the moderation actions Moderaty uses.
		</p>
		<p>
			Moderaty uses the permission to select your channels, retrieve and moderate
			eligible comments, and read video titles and descriptions for context. You can
			revoke its access through your Google account settings.
		</p>
		<div class="trust-links">
			<a href="/privacy">Privacy Policy <span aria-hidden="true">→</span></a>
			<a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">Source code <span aria-hidden="true">↗</span></a>
			<a href="/blogs/how-to-deal-with-hate-comments-on-youtube/">How to deal with hate comments on YouTube <span aria-hidden="true">→</span></a>
		</div>
	</div>
</section>

<style>
	.section {
		max-width: 1152px;
		margin: 0 auto;
		padding: 96px 24px;
	}
	.intro { max-width: 76ch; }
	.eyebrow, .example-label, .plan-tag {
		margin: 0 0 16px;
		font-family: var(--font-mono);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.18em;
		color: var(--mint);
	}
	.section-title {
		max-width: 21ch;
		font-family: var(--font-display);
		font-size: clamp(34px, 5vw, 48px);
		line-height: 1.1;
		letter-spacing: -0.02em;
		color: var(--paper);
		margin: 0 0 24px;
	}
	.lede, .panel p, .access p, .note {
		font-size: 16px;
		line-height: 1.7;
		color: rgb(244 244 248 / 0.73);
	}
	.lede { max-width: 76ch; margin: 16px 0 0; }
	.lede strong { color: var(--paper); }
	.steps, .plans { display: grid; grid-template-columns: 1fr; gap: 20px; margin-top: 48px; }
	.panel {
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
		padding: 24px;
		min-width: 0;
	}
	.number {
		font: 500 14px var(--font-mono);
		color: var(--ban);
	}
	.panel h3, .access h3 {
		color: var(--paper);
		font-family: var(--font-display);
		font-size: 23px;
		line-height: 1.2;
		margin: 18px 0 16px;
	}
	.panel p { margin: 12px 0 0; }
	.inline-link, .plan a, .trust-links a {
		display: inline-block;
		font-family: var(--font-mono);
		color: var(--paper);
		text-underline-offset: 5px;
		text-decoration-color: var(--ban);
		line-height: 1.6;
	}
	.inline-link { margin-top: 32px; }
	.inline-link:hover, .plan a:hover, .trust-links a:hover { color: var(--mint); }
	.preview-section, .digest-section, .scope-section { border-top: 1px solid var(--line); }
	.table-wrap { overflow-x: auto; margin-top: 32px; border: 1px solid var(--line); border-radius: var(--radius); }
	table { border-collapse: collapse; width: 100%; min-width: 600px; background: var(--surface); }
	caption { text-align: left; padding: 16px 20px; color: rgb(244 244 248 / 0.6); font-size: 12px; }
	th, td { padding: 18px 20px; text-align: left; vertical-align: top; border-top: 1px solid var(--line); line-height: 1.55; }
	th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mint); }
	td { color: rgb(244 244 248 / 0.78); }
	td strong { color: var(--paper); }
	.note { max-width: 76ch; font-size: 13px; margin: 18px 0 0; }
	.two-col { display: grid; grid-template-columns: 1fr; gap: 32px; align-items: start; }
	.digest-example {
		border: 1px solid var(--line); border-radius: var(--radius);
		padding: 24px; background: var(--surface);
	}
	.digest-example dl { margin: 0; }
	.digest-example dl > div { border-top: 1px solid var(--line); padding: 14px 0; }
	.digest-example dt { color: var(--mint); text-transform: uppercase; font: 11px var(--font-mono); letter-spacing: 0.12em; }
	.digest-example dd { color: var(--paper); margin: 8px 0 0; line-height: 1.5; }
	.plan { display: flex; flex-direction: column; align-items: flex-start; }
	.plan-tag { margin: 0; }
	.plan-price { font: 700 38px var(--font-display); color: var(--paper) !important; margin: 18px 0 8px !important; }
	.plan-price span { font: 400 13px var(--font-mono); color: rgb(244 244 248 / 0.6); }
	.plan a { margin-top: auto; padding-top: 24px; }
	.access { margin-top: 48px; padding: 28px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
	.access h3 { margin: 0; }
	.access code { overflow-wrap: anywhere; color: var(--mint); }
	.trust-links { display: flex; flex-wrap: wrap; gap: 16px 28px; margin-top: 24px; }
	@media (min-width: 768px) {
		.steps, .plans { grid-template-columns: repeat(3, minmax(0, 1fr)); }
		.two-col { grid-template-columns: 1fr 1fr; gap: 64px; }
	}
</style>
