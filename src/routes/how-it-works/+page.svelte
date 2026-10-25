<!-- Copyright (C) 2026 Advanced Digital Marketing LTDA. Licensed under PolyForm Shield 1.0.0. See LICENSE. -->
<script lang="ts">
	import Nav from '$lib/components/landing/Nav.svelte';
	import SkipLink from '$lib/components/landing/SkipLink.svelte';
	import FinalCta from '$lib/components/landing/FinalCta.svelte';
	import Footer from '$lib/components/landing/Footer.svelte';
	import { jsonLd } from '$lib/landing/json-ld';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const description =
		'Learn how Moderaty checks published YouTube comments with your rules, AI scoring, human review, moderation history, optional feedback digests, and hosted or self-hosted plans.';
	const sourceReadme =
		'https://github.com/Advanced-Digital-Marketing-LTDA/Moderaty/blob/main/README.md#what-it-does';

	const canonical = $derived.by(() => {
		if (!data.canonical) throw new Error('How it works needs a canonical URL from the public site index.');
		return data.canonical;
	});
	const socialImage = $derived(new URL('/og.png', canonical).href);

	const faqs = [
		{
			question: 'Which comments does Moderaty scan?',
			answer:
				'Moderaty scans published top-level comments on connected, active YouTube channels. It does not scan reply threads or live chat, and it does not run a separate sweep of comments YouTube has already held or marked as spam.',
			link: '/#scope',
			linkText: 'See the published coverage details.'
		},
		{
			question: 'What happens when a score is uncertain or unavailable?',
			answer:
				'Moderaty sends borderline results, flagged screening results, and scoring errors to the human review queue. If a check reaches its time limit, unfinished comments are retried on a later check. An AI score is a moderation signal, not proof that a viewer broke your policy.',
			link: '/#how-it-works',
			linkText: 'Read the public workflow overview.'
		},
		{
			question: 'Can a history scan change published comments?',
			answer:
				'Yes. A moderation history scan can apply moderation actions to published top-level comments in a supported window. A feedback history scan is read-only. Live history scans use the plan’s available allowance, purchased credits, or the lifetime plan’s usable OpenAI key.',
			link: sourceReadme,
			linkText: 'Review history scan limits in the product README.'
		},
		{
			question: 'Does a feedback digest act on comments?',
			answer:
				'No. The optional digest groups recurring questions, corrections, substantive criticism, and requests. It does not reply, post, or change moderation decisions.',
			link: '/#digest',
			linkText: 'See the digest description.'
		},
		{
			question: 'Which hosting option should I choose?',
			answer:
				'Self-hosted Moderaty runs on infrastructure and an OpenAI key you provide. Hosted monthly is operated by Moderaty. The lifetime offer is hosted and requires your own OpenAI key. The pricing page has current offer limits and usage details.',
			link: '/pricing',
			linkText: 'Compare hosting and current prices.'
		}
	];

	const faqPage = {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map(({ question, answer }) => ({
			'@type': 'Question',
			name: question,
			acceptedAnswer: { '@type': 'Answer', text: answer }
		}))
	};
</script>

<svelte:head>
	<title>How Moderaty works | YouTube comment moderation</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="Moderaty" />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content="How Moderaty works | YouTube comment moderation" />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={socialImage} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="How Moderaty works | YouTube comment moderation" />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={socialImage} />
	{@html jsonLd(faqPage)}
</svelte:head>

<SkipLink />
<Nav />
<main id="main-content" tabindex="-1">
	<header class="hero page-width">
		<p class="eyebrow">Comment protection for YouTube creators</p>
		<h1>How Moderaty works: trolls, meet your rulebook.</h1>
		<p class="hero-copy">
			Moderaty checks published top-level comments on connected, active channels. Your protected handles
			and rules come before AI scoring. Borderline results wait for a person, and the audit log records
			what happened.
		</p>
		<div class="hero-links">
			<a class="button-primary" href="/login">Connect your YouTube channel</a>
			<a class="button-secondary" href="/pricing">Compare hosting plans</a>
		</div>
		<p class="scope-note">
			Moderaty does not scan replies, live chat, or a separate queue of comments YouTube has already held or
			marked as spam. <a href="/#scope">Check the current coverage and access details.</a>
		</p>
	</header>

	<nav class="contents page-width" aria-label="On this page">
		<a href="#rules">Rules</a>
		<a href="#ai-scoring">AI scoring</a>
		<a href="#review-history">Review and history</a>
		<a href="#feedback-digests">Feedback digests</a>
		<a href="#hosting">Hosting choices</a>
		<a href="#faq">Questions</a>
	</nav>

	<section class="section page-width" id="rules" aria-labelledby="rules-title">
		<p class="eyebrow">01 / Rules first</p>
		<div class="section-grid">
			<div>
				<h2 id="rules-title">Your rules swing first.</h2>
				<p>
					Set keyword, regex, or user rules for the comments on a connected channel. Each matching rule can
					hold, reject, delete, or ban. Protected handles bypass both rule matching and AI scoring.
				</p>
				<p>
					<a href="/#how-it-works">The public workflow overview</a> shows this rules-first order. The
					<a href={sourceReadme} target="_blank" rel="noopener">product README</a> lists the rule types and
					actions.
				</p>
			</div>
			<aside class="fact-card" aria-label="Rule behavior">
				<p class="card-label">Rule match</p>
				<ol>
					<li>Check protected handles.</li>
					<li>Match your rule.</li>
					<li>Use the action you chose.</li>
				</ol>
			</aside>
		</div>
	</section>

	<section class="section page-width" id="ai-scoring" aria-labelledby="ai-title">
		<p class="eyebrow">02 / AI scores what rules leave open</p>
		<div class="section-grid">
			<div>
				<h2 id="ai-title">A score helps route the comment.</h2>
				<p>
					When no rule decides the outcome, Moderaty screens for prompt-injection attempts and sends eligible
					comments to OpenAI moderation. The model scores toxicity across 13 categories, and the score helps
					decide what happens next. Depending on the result and your channel settings, a comment can remain
					published, go to review, or receive an automatic moderation action. A score is a moderation signal,
					not proof that a viewer broke your policy.
				</p>
				<p>
					Some channels can also use an optional tone pass. Borderline results, flagged screening results, and
					scoring errors go to the review queue. If a check reaches its time limit, unfinished comments are
					retried on a later check. The <a href="/#how-it-works">public overview</a> describes scoring and review;
					the <a href={sourceReadme} target="_blank" rel="noopener">product README</a> documents the tone pass
					and retry behavior.
				</p>
			</div>
			<aside class="fact-card" aria-label="AI scoring notes">
				<p class="card-label">AI scoring</p>
				<p>The model supplies a signal. Your rules set the channel’s policy.</p>
				<p>Scoring errors go to review. A timed-out check retries unfinished comments later.</p>
			</aside>
		</div>
	</section>

	<section class="section page-width" id="review-history" aria-labelledby="review-title">
		<p class="eyebrow">03 / People and records</p>
		<div class="section-grid">
			<div>
				<h2 id="review-title">Review the calls that need context.</h2>
				<p>
					Use the review queue to approve, reject, delete, or ban a comment. Moderaty records the intended
					action before it contacts YouTube, then records whether YouTube completed it. A comment can remain
					public until YouTube confirms a requested hold. <a href="/#history">The public history overview</a>
					explains what the audit log shows.
				</p>
				<p>
					Held and rejected comments can be restored. Deleted comments are permanent, and Moderaty cannot
					lift an author ban inside the app. The <a href="/terms">Terms of Service</a> describe these action
					limits.
				</p>
				<p>
					Moderation outcome records include comment text truncated to 500 characters. The commenter’s public
					handle appears in the activity log for up to 30 days and can be erased sooner. Other author identifiers
					are processed in memory, except identifiers you enter in user rules or protected handles. See the
					<a href="/privacy">Privacy Policy</a> for record-retention details.
				</p>
			</div>
			<aside class="fact-card" aria-label="Moderation history">
				<p class="card-label">Moderation history</p>
				<p>The audit log records decisions and completed YouTube actions.</p>
				<p>A separate history scan can re-evaluate published comments from a supported window. It can take
					moderation actions; live scans require available paid allowance, purchased credits, or a usable
					OpenAI key for lifetime teams.</p>
				<p><a href={sourceReadme} target="_blank" rel="noopener">See history scan windows and limits in the product README.</a></p>
			</aside>
		</div>
	</section>

	<section class="section page-width" id="feedback-digests" aria-labelledby="digest-title">
		<p class="eyebrow">04 / Optional audience feedback</p>
		<div class="section-grid">
			<div>
				<h2 id="digest-title">Somewhere under the trolls, an actually good idea.</h2>
				<p>
					Turn on the optional, read-only digest to group recurring questions, corrections, substantive
					criticism, and viewer requests from scanned top-level comments. Run it weekly, after 100 new
					comments, or when you ask for it.
				</p>
				<p>
					The digest does not reply to viewers, post comments, or change moderation decisions. Its history
					scan is read-only too. <a href="/#digest">The public digest overview</a> explains the report and
					its schedule; <a href="/pricing">pricing</a> explains how digest classifications use AI credits.
				</p>
			</div>
			<aside class="fact-card" aria-label="Feedback digest behavior">
				<p class="card-label">Read-only by design</p>
				<p>Digests group audience feedback. They do not change a comment’s moderation status.</p>
			</aside>
		</div>
	</section>

	<section class="section page-width" id="hosting" aria-labelledby="hosting-title">
		<p class="eyebrow">05 / Hosting and usage</p>
		<h2 id="hosting-title">Choose your fighter.</h2>
		<div class="plans">
			<article class="plan-card">
				<h3>Self-hosted</h3>
				<p><strong>$0 from Moderaty.</strong> Run the source-available software on your own infrastructure and provide your OpenAI key. Provider and API costs are separate.</p>
				<a href={sourceReadme} target="_blank" rel="noopener">Read the source and self-hosting notes.</a>
			</article>
			<article class="plan-card">
				<h3>Hosted monthly</h3>
				<p><strong>$5 per month.</strong> Moderaty runs the service and supplies the AI key. The paid month includes 100 AI classifications shared by moderation scoring and enabled feedback digests.</p>
				<a href="/pricing">See current plan details and top-up prices.</a>
			</article>
			<article class="plan-card">
				<h3>Lifetime hosting</h3>
				<p><strong>$49 once, limited to 1,000 lifetime places.</strong> Moderaty runs the service; you provide and pay for your OpenAI key.</p>
				<a href="/pricing">Check availability and terms.</a>
			</article>
		</div>
		<p class="pricing-note">
			Self-hosting costs for infrastructure and OpenAI usage vary by provider and use. The
			<a href="/pricing">pricing page</a> has current prices, offer availability, and usage conditions.
		</p>
	</section>

	<section class="section page-width faq" id="faq" aria-labelledby="faq-title">
		<p class="eyebrow">Questions</p>
		<h2 id="faq-title">Before you connect a channel</h2>
		{#each faqs as faq (faq.question)}
			<details>
				<summary>{faq.question}</summary>
				<p>{faq.answer} <a href={faq.link} target={faq.link.startsWith('https://') ? '_blank' : undefined} rel={faq.link.startsWith('https://') ? 'noopener' : undefined}>{faq.linkText}</a></p>
			</details>
		{/each}
	</section>

	<FinalCta />
</main>
<Footer />

<style>
	.page-width {
		max-width: 1152px;
		margin: 0 auto;
		padding-left: 24px;
		padding-right: 24px;
	}
	.hero {
		padding-top: 132px;
		padding-bottom: 72px;
	}
	.eyebrow, .card-label {
		margin: 0 0 16px;
		font: 11px var(--font-mono);
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--mint);
	}
	h1, h2, h3 {
		font-family: var(--font-display);
		color: var(--paper);
		letter-spacing: -0.02em;
	}
	h1 {
		max-width: 16ch;
		margin: 0;
		font-size: clamp(44px, 7vw, 68px);
		line-height: 1.04;
	}
	.hero-copy {
		max-width: 68ch;
		margin: 24px 0 0;
		font-size: clamp(18px, 2.5vw, 22px);
		line-height: 1.6;
		color: rgb(244 244 248 / 0.78);
	}
	.hero-links {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin-top: 32px;
	}
	.button-primary, .button-secondary {
		display: inline-block;
		border-radius: 999px;
		padding: 13px 22px;
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
	}
	.button-primary { background: var(--ban); color: var(--ink); }
	.button-secondary { border: 1px solid var(--line); color: var(--paper); }
	.scope-note {
		max-width: 78ch;
		margin: 28px 0 0;
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-muted);
	}
	a { color: var(--paper); text-underline-offset: 4px; }
	a:hover { color: var(--mint); }
	.contents {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 24px;
		padding-top: 20px;
		padding-bottom: 20px;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
		font: 11px var(--font-mono);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.section {
		padding-top: 80px;
		padding-bottom: 80px;
		border-bottom: 1px solid var(--line);
	}
	.section h2 {
		max-width: 24ch;
		margin: 0 0 24px;
		font-size: clamp(32px, 5vw, 46px);
		line-height: 1.12;
	}
	.section p:not(.eyebrow, .card-label) {
		max-width: 74ch;
		color: rgb(244 244 248 / 0.74);
		font-size: 16px;
		line-height: 1.75;
	}
	.section-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(240px, 0.8fr);
		gap: 48px;
		align-items: start;
	}
	.fact-card, .plan-card {
		min-width: 0;
		padding: 24px;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	.fact-card p { margin-top: 12px; }
	.fact-card .card-label { margin-top: 0; }
	.fact-card ol { margin: 0; padding-left: 22px; color: rgb(244 244 248 / 0.78); line-height: 1.9; }
	.plans {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		margin-top: 32px;
	}
	.plan-card { display: flex; flex-direction: column; align-items: flex-start; }
	.plan-card h3 { margin: 0; font-size: 22px; }
	.plan-card p { margin: 16px 0 24px; }
	.plan-card a { margin-top: auto; font: 12px/1.7 var(--font-mono); }
	.pricing-note { margin-top: 24px; }
	.faq details { border-top: 1px solid var(--line); }
	.faq details:last-child { border-bottom: 1px solid var(--line); }
	.faq summary {
		padding: 20px 0;
		color: var(--paper);
		font-family: var(--font-display);
		font-size: 19px;
		font-weight: 600;
		cursor: pointer;
	}
	.faq details p { margin: 0 0 22px; }
	@media (max-width: 720px) {
		.section-grid, .plans { grid-template-columns: 1fr; }
		.section { padding-top: 64px; padding-bottom: 64px; }
		.fact-card { margin-top: 8px; }
	}
</style>
