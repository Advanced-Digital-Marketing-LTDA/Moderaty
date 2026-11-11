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
			comment: 'You clearly have never made a video in your life.',
				setup: 'No matching rule; AI score in the review range',
				outcome: 'Hold for review'
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
		<p class="eyebrow">AI moderation, with optional rules</p>
		<h2 id="how-title" class="section-title">Your rules swing first. The AI mops up. You get the final say.</h2>
		<p class="lede">
			YouTube Studio's built-in settings can hold potentially inappropriate
			comments, and that's a start. Moderaty
			adds AI scoring, a human review queue, and
			an audit log for your connected channels. Custom rules are an optional extra, for the trolls you see every week.
		</p>
		<p class="lede">
			Keep the corrections and the genuine criticism (yes, even the Ackchyually Guy is
			sometimes right). Set boundaries for abuse, crypto bots, and the same self-promo
			pasted under every video. If you add rules, you decide what they do.
		</p>
	</div>
	<div class="steps">
		<article class="panel">
			<span class="number" aria-hidden="true">01</span>
			<h3>The AI scores what your rules leave.</h3>
			<p>
				Moderaty scores each published top-level comment that no rule or protected handle decides, across 13 moderation categories, and
				screens for prompt-injection attempts. Protected handles skip both rules and AI scoring. High scores from the main AI check delete the comment, and the very highest also ban the author on YouTube. Deletions are permanent, and Moderaty cannot lift a ban inside the app.			</p>
		</article>
		<article class="panel">
			<span class="number" aria-hidden="true">02</span>
			<h3>Doubt is still yours to decide.</h3>
			<p>
				Middle scores, scoring failures, and comments that trip the prompt-injection screen are held on YouTube until you decide. A model score is a moderation signal, not proof that a viewer violated your
				policy.
			</p>
			<p>
				Low scores pass untouched, unless your channel runs the optional tone pass. Scoring failures go to your queue, never approved or
				rejected silently.
			</p>
		</article>
		<article class="panel">
			<span class="number" aria-hidden="true">03</span>
			<h3>Every bonk leaves a receipt.</h3>
			<p>
				Use your review queue to decide what happens next. The audit log shows
				recorded decisions and completed actions. A requested hold may not take
				effect until YouTube confirms it.
			</p>
		</article>
	</div>
	<a href="/how-it-works/" class="inline-link">See the full moderation workflow <span aria-hidden="true">→</span></a>
	<a href={LOGIN_URL} class="inline-link">Preview moderation on your channel <span aria-hidden="true">→</span></a>
</section>

<section id="moderation-preview" class="section preview-section" aria-labelledby="preview-title">
	<p class="eyebrow">Try before you bonk</p>
	<h2 id="preview-title" class="section-title">Review example moderation decisions</h2>
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
	<p class="eyebrow">Receipts</p>
	<h2 id="history-title" class="section-title">Every bonk comes with a receipt</h2>
	<p class="lede">
		Moderaty records moderation intent before sending changes to YouTube and logs
		completed actions. You can inspect what was held, rejected, deleted, or banned,
		and what still needs attention.
	</p>
</section>

<section id="digest" class="section digest-section" aria-labelledby="digest-title">
	<div class="two-col">
		<div>
			<p class="eyebrow">Optional audience feedback</p>
			<h2 id="digest-title" class="section-title">Somewhere under the trolls, an actually good idea</h2>
			<p class="lede">
				Turn on the optional, read-only feedback digest to group recurring questions,
				corrections, substantive criticism, and viewer requests from scanned
				top-level comments.
			</p>
			<p class="lede">
				Use those themes to decide what to clarify or cover next. The digest
				does not reply to viewers, post comments, or change moderation decisions.
				It can run weekly, after 100 new comments, or when you request it. Abusive wording stays hidden in the digest unless you choose to reveal it.
			</p>
			<a href={LOGIN_URL} class="inline-link">Preview your feedback digest <span aria-hidden="true">→</span></a>
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
	<h2 id="pricing-title" class="section-title">Choose your fighter</h2>
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
			<a href="/pricing" data-moderaty-event="pricing_click" data-moderaty-placement="home_pricing">See pricing <span aria-hidden="true">→</span></a>
		</article>
		<article class="plan panel">
			<p class="plan-tag">Lifetime hosting</p>
			<p class="plan-price">$49 <span>one-time</span></p>
			<p>
				Limited to 1,000 lifetime places, subject to availability. No Moderaty monthly
				subscription or per-comment meter under this offer. You supply and
				pay for your own OpenAI API key.
			</p>
			<a href="/pricing" data-moderaty-event="pricing_click" data-moderaty-placement="home_pricing">See pricing <span aria-hidden="true">→</span></a>
		</article>
	</div>
	<a href="/pricing" class="inline-link" data-moderaty-event="pricing_click" data-moderaty-placement="home_pricing">See pricing <span aria-hidden="true">→</span></a>
</section>

<section id="scope" class="section scope-section" aria-labelledby="scope-title">
	<p class="eyebrow">Coverage and control</p>
	<h2 id="scope-title" class="section-title">What gets bonked, and what doesn't</h2>
	<p class="lede">
		Moderaty scans <strong>published top-level YouTube comments</strong> on connected,
		active channels. It can also scan published top-level comment history in supported
		windows, subject to the plan's usage requirements.
	</p>
	<p class="lede">
		Live chat moderation is <strong>coming soon</strong>. Until it ships, Moderaty does <strong>not</strong> moderate live chat, and it does
		<strong>not</strong> run a separate sweep of comments already held by YouTube for
		review or marked as spam. It never writes a reply under your name.
	</p>
	<p class="lede">
		YouTube Studio may be all you need if its native controls fit your channel.
		Moderaty is for creators who want AI scoring, a separate review queue, and
		a record of each decision. Custom rules are there when you want them.
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
		font-size: 12px;
		letter-spacing: 0.01em;
		color: var(--mint);
	}
	.section-title {
		max-width: 21ch;
		font-family: var(--font-display);
		font-size: clamp(32px, 5vw, 48px);
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
		margin: 20px 0 16px;
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
	th, td { padding: 20px 20px; text-align: left; vertical-align: top; border-top: 1px solid var(--line); line-height: 1.55; }
	th { font-size: 12px; letter-spacing: 0.01em; color: var(--mint); }
	td { color: rgb(244 244 248 / 0.78); }
	td strong { color: var(--paper); }
	.note { max-width: 76ch; font-size: 14px; margin: 20px 0 0; }
	.two-col { display: grid; grid-template-columns: 1fr; gap: 32px; align-items: start; }
	.digest-example {
		border: 1px solid var(--line); border-radius: var(--radius);
		padding: 24px; background: var(--surface);
	}
	.digest-example dl { margin: 0; }
	.digest-example dl > div { border-top: 1px solid var(--line); padding: 16px 0; }
	.digest-example dt { color: var(--mint); font: 11px var(--font-mono); letter-spacing: 0.01em; }
	.digest-example dd { color: var(--paper); margin: 8px 0 0; line-height: 1.5; }
	.plan { display: flex; flex-direction: column; align-items: flex-start; }
	.plan-tag { margin: 0; }
	.plan-price { font: 700 38px var(--font-display); color: var(--paper) !important; margin: 20px 0 8px !important; }
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
