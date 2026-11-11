<script lang="ts">
	import EmptyState from '$lib/EmptyState.svelte';
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import ArticleContents from '$lib/components/blogs/ArticleContents.svelte';
	import TableScroll from '$lib/components/blogs/TableScroll.svelte';
	import { calculate, guardUnexpected, runCalculator, runNiche, type CalcRun, type NicheRun } from '$lib/tools/youtube-money';
	import { formatCount, formatRpm, formatUsd } from '$lib/tools/youtube-money-format';
	import {
		NICHE_CPM_NOTE,
		NICHE_CPM_ROWS,
		YOUTUBE_MONEY_CALCULATOR,
		YOUTUBE_MONEY_EDITION,
		YOUTUBE_MONEY_FAQ,
		YOUTUBE_MONEY_SECTIONS,
		YOUTUBE_MONEY_SOURCES
	} from '$lib/tools/youtube-money-content';
	import { tick, untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const pageUrl = $derived(new URL(YOUTUBE_MONEY_CALCULATOR.path, data.siteOrigin).href);
	const schema = $derived({
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebApplication',
				name: 'YouTube money calculator',
				url: pageUrl,
				applicationCategory: 'FinanceApplication',
				operatingSystem: 'Any',
				description: YOUTUBE_MONEY_CALCULATOR.description,
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
				inLanguage: 'en'
			},
			{
				'@type': 'FAQPage',
				mainEntity: YOUTUBE_MONEY_FAQ.map((entry) => ({
					'@type': 'Question',
					name: entry.q,
					acceptedAnswer: { '@type': 'Answer', text: entry.a }
				}))
			}
		]
	});

	type ContentType = 'long-form' | 'shorts' | 'both';
	type Stream = { views: string; rpm: string };
	type NicheResult = { niche: string; cpmLow: number; cpmHigh: number; monetized: string; run: NicheRun };

	const CONTENT_TYPES = [
		{ value: 'long-form', label: 'Long-form' },
		{ value: 'shorts', label: 'Shorts' },
		{ value: 'both', label: 'Both (mixed)' }
	] as const;
	const PRESETS = [
		{ label: '10K', views: 10_000 },
		{ label: '100K', views: 100_000 },
		{ label: '500K', views: 500_000 },
		{ label: '1M', views: 1_000_000 },
		{ label: '5M', views: 5_000_000 }
	];

	const updatedLabel = new Date(`${YOUTUBE_MONEY_EDITION.updated}T00:00:00Z`).toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	});

	let contentType = $state<ContentType>('long-form');
	let longForm = $state<Stream>({ views: '', rpm: '' });
	let shorts = $state<Stream>({ views: '', rpm: '' });
	let goalUsd = $state('');
	let nicheName = $state('');
	let monetizedShare = $state('');

	// Nothing is computed until the visitor submits, so a blank RPM shows its message only after they ask.
	let run = $state<CalcRun | null>(null);
	let nicheResult = $state<NicheResult | null>(null);
	let resultsEl: HTMLDivElement | undefined;

	const rows = $derived(run?.ok ? run.streams.map((stream) => ({ stream, monthlyUsd: calculate([stream], null).monthlyUsd })) : []);

	// Any edit after a calculation makes it stale: clear it rather than leave numbers that no longer match the inputs.
	const inputsKey = $derived(JSON.stringify([contentType, longForm, shorts, goalUsd, nicheName, monetizedShare]));
	$effect(() => {
		void inputsKey;
		untrack(() => {
			run = null;
			nicheResult = null;
		});
	});

	async function calculateNow(event: SubmitEvent) {
		event.preventDefault();
		// Bad input is a message from the engine. Anything else is a fault: it is logged and the visitor sees a generic message.
		const report = (error: unknown) => console.error('YouTube money calculator: submit failed', error);
		run = guardUnexpected(
			() =>
				runCalculator({
					contentType,
					longFormViews: longForm.views,
					longFormRpm: longForm.rpm,
					shortsViews: shorts.views,
					shortsRpm: shorts.rpm,
					goalUsd
				}),
			report
		);
		const row = NICHE_CPM_ROWS.find((candidate) => candidate.niche === nicheName);
		nicheResult =
			row && contentType !== 'shorts'
				? {
						...row,
						monetized: monetizedShare,
						run: guardUnexpected(() => runNiche(monetizedShare, row.cpmLow, row.cpmHigh), report)
					}
				: null;
		// Moving focus to the results lets a screen reader read them once, in order, instead of re-reading live text.
		await tick();
		resultsEl?.focus();
	}
</script>

<BlogMeta
	title={YOUTUBE_MONEY_CALCULATOR.title}
	description={YOUTUBE_MONEY_CALCULATOR.description}
	path={YOUTUBE_MONEY_CALCULATOR.path}
	origin={data.siteOrigin}
	{schema}
/>

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol><li><a href="/">Home</a></li><li aria-current="page">YouTube money calculator</li></ol>
</nav>

<h1>YouTube Money Calculator</h1>
<p>
	Enter your monthly views and your RPM from YouTube Studio, and the YouTube Money Calculator returns daily, monthly and yearly earnings plus the views you need for an income goal. If a required number is missing or wrong, you get a message instead of a result.
</p>
<p class="updated">Last updated <time datetime={YOUTUBE_MONEY_EDITION.updated}>{updatedLabel}</time>.</p>

{#snippet presetButtons(title: string, onPick: (views: number) => void)}
	<div class="presets" role="group" aria-label="{title} views presets">
		{#each PRESETS as preset (preset.label)}
			<button type="button" class="preset btn-press" aria-label="Set {title.toLowerCase()} monthly views to {preset.label}" onclick={() => onPick(preset.views)}>
				{preset.label}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet streamFields(title: string, stream: Stream, hidden: boolean)}
	{@const id = title.toLowerCase()}
	<fieldset class="stream" {hidden}>
		<legend>{title}</legend>
		<label for="{id}-views">{title} monthly views</label>
		<input id="{id}-views" type="text" inputmode="numeric" bind:value={stream.views} />
		{@render presetButtons(title, (views) => (stream.views = String(views)))}
		<label for="{id}-rpm">{title} RPM (USD per 1,000 views)</label>
		<input id="{id}-rpm" type="text" inputmode="decimal" bind:value={stream.rpm} aria-describedby="{id}-rpm-hint" />
		<p id="{id}-rpm-hint" class="hint">From YouTube Studio: Analytics &gt; Revenue &gt; RPM. Your own figure, not a niche average.</p>
	</fieldset>
{/snippet}

<section class="calculator-block" aria-labelledby="calculator-heading">
	<h2 id="calculator-heading">Calculate your month</h2>
	<div class="workspace">
		<form class="calculator" onsubmit={calculateNow} novalidate>
			<fieldset class="choice segmented">
				<legend>Content type</legend>
				{#each CONTENT_TYPES as option (option.value)}
					<label class="choice-option">
						<input type="radio" name="content-type" value={option.value} bind:group={contentType} />
						<span>{option.label}</span>
					</label>
				{/each}
			</fieldset>

			<!-- Hidden, not removed: both rows stay in the DOM so their labels and values survive a switch of content type. -->
			{@render streamFields('Long-form', longForm, contentType === 'shorts')}
			{@render streamFields('Shorts', shorts, contentType === 'long-form')}

			<label for="goal">Monthly income goal (USD, optional)</label>
			<input id="goal" type="text" inputmode="decimal" placeholder="1000" bind:value={goalUsd} aria-describedby="goal-hint" />
			<p id="goal-hint" class="hint">Leave blank to skip. The calculator shows the views you need each month to reach the goal.</p>

			<details class="niche" hidden={contentType === 'shorts'}>
				<summary>Don't know your RPM? Estimate it from a niche CPM (long-form only)</summary>
				<div class="niche-body">
					<p class="hint">{NICHE_CPM_NOTE} This turns a CPM range into an RPM range. It does not fill in your RPM.</p>
					<label for="niche">Niche</label>
					<select id="niche" bind:value={nicheName}>
						<option value="">No niche</option>
						{#each NICHE_CPM_ROWS as row (row.niche)}
							<option value={row.niche}>{row.niche}: {formatUsd(row.cpmLow)} to {formatUsd(row.cpmHigh)} CPM</option>
						{/each}
					</select>
					<label for="monetized">Share of views that are monetized (%)</label>
					<input id="monetized" type="text" inputmode="decimal" bind:value={monetizedShare} aria-describedby="monetized-hint" />
					<p id="monetized-hint" class="hint">Converted RPM = monetized share × CPM × 55%. This assumes each monetized playback shows one ad impression. Required when a niche is picked. There is no preset.</p>
				</div>
			</details>

			<button type="submit" class="submit btn-press">Calculate earnings</button>
		</form>

		<div class="results" tabindex="-1" bind:this={resultsEl}>
			{#if run === null}
				<EmptyState title="No estimate yet." hint="Enter your numbers and calculate. Nothing is estimated until you do." />
			{:else if !run.ok}
				<div class="error-box" role="alert">{run.error}</div>
			{:else}
				<div class="figures-block">
					<dl class="figures">
						<div class="figure-main"><dt>Monthly</dt><dd>{formatUsd(run.outputs.monthlyUsd)}</dd></div>
						<div><dt>Daily</dt><dd>{formatUsd(run.outputs.dailyUsd)}</dd></div>
						<div><dt>Yearly</dt><dd>{formatUsd(run.outputs.yearlyUsd)}</dd></div>
						<div>
							<dt>{run.streams.length > 1 ? 'Per 1 million views, blended' : 'Per 1 million views'}</dt>
							<dd>{formatUsd(run.outputs.perMillionUsd)}</dd>
						</div>
					</dl>

					{#if rows.length > 1}
						<TableScroll captionId="earnings-caption">
							<table>
								<caption id="earnings-caption">Earnings by content type</caption>
								<thead>
									<tr><th scope="col">Type</th><th scope="col">Views a month</th><th scope="col">RPM</th><th scope="col">Earned a month</th></tr>
								</thead>
								<tbody>
									{#each rows as row (row.stream.label)}
										<tr>
											<th scope="row">{row.stream.label}</th>
											<td>{formatCount(row.stream.views)}</td>
											<td>{formatRpm(row.stream.rpm)}</td>
											<td>{formatUsd(row.monthlyUsd)}</td>
										</tr>
									{/each}
									<tr>
										<th scope="row">Total</th>
										<td>{formatCount(run.outputs.totalViews)}</td>
										<td>{formatRpm(run.outputs.blendedRpm)} blended</td>
										<td>{formatUsd(run.outputs.monthlyUsd)}</td>
									</tr>
								</tbody>
							</table>
						</TableScroll>
					{/if}

					<p>At half your RPM: {formatUsd(run.outputs.halfRpmMonthlyUsd)} a month. At double: {formatUsd(run.outputs.doubleRpmMonthlyUsd)} a month.</p>

					{#if run.outputs.viewsNeeded !== null && run.goalUsd !== null}
						<p>To earn {formatUsd(run.goalUsd)} a month at this mix, you need at least {formatCount(run.outputs.viewsNeeded)} views a month.</p>
					{/if}

					<h3>The formula with your numbers</h3>
					<ul class="formula">
						{#each rows as row (row.stream.label)}
							<li>{row.stream.label}: {formatCount(row.stream.views)} views ÷ 1,000 × {formatRpm(row.stream.rpm)} = {formatUsd(row.monthlyUsd)} a month</li>
						{/each}
					</ul>
					<p class="hint">Daily figures divide the month by 30.</p>
				</div>
			{/if}

			{#if nicheResult}
				{#if nicheResult.run.ok}
					<p>
						{nicheResult.niche} is {formatUsd(nicheResult.cpmLow)} to {formatUsd(nicheResult.cpmHigh)} CPM. With {nicheResult.monetized}% of views monetized,
						the long-form RPM range is {formatRpm(nicheResult.run.rpmLow)} to {formatRpm(nicheResult.run.rpmHigh)}. Compare it with your Studio RPM; it does not replace it.
					</p>
				{:else}
					<div class="error-box" role="alert">{nicheResult.run.error}</div>
				{/if}
			{/if}
		</div>
	</div>
</section>

<ArticleContents headings={YOUTUBE_MONEY_SECTIONS} />

<h2 id="how-it-works" tabindex="-1">How is YouTube revenue calculated?</h2>
<p>
	Estimated revenue is monthly views ÷ 1,000 × RPM. RPM, or revenue per mille, is the figure YouTube Studio reports: what you earned per 1,000 views after YouTube's revenue share. For long-form videos, RPM counts all views. For Shorts, it counts engaged views. The calculator uses one RPM per content type, treats a month as 30 days for the daily figure, and looks up nothing for you.
	<a href={YOUTUBE_MONEY_SOURCES.adRevenueAnalytics.href} target="_blank" rel="noopener">{YOUTUBE_MONEY_SOURCES.adRevenueAnalytics.label}</a>.
</p>

<h2 id="cpm-vs-rpm" tabindex="-1">What is the difference between CPM and RPM?</h2>
<p>
	CPM is what an advertiser pays for 1,000 ad impressions, before YouTube's revenue share. RPM is what you earned per 1,000 views after the share. RPM usually runs lower than CPM because it comes after the share and counts views that earned no ad revenue. YouTube's own example: $7 earned over 2,000 ad impressions is a $3.50 CPM, and the same $7 over 1,500 monetized playbacks is a $4.67 playback-based CPM.
	<a href={YOUTUBE_MONEY_SOURCES.adRevenueAnalytics.href} target="_blank" rel="noopener">{YOUTUBE_MONEY_SOURCES.adRevenueAnalytics.label}</a>.
</p>

<h2 id="revenue-share" tabindex="-1">How much of the revenue do you keep?</h2>
<p>You keep 55% of net ad revenue on long-form Watch Page ads, 45% of the revenue allocated to your Shorts, and 70% of net revenue from channel memberships, Super Chat, Super Stickers and Super Thanks. YouTube Help sets these shares. <a href={YOUTUBE_MONEY_SOURCES.partnerEarnings.href} target="_blank" rel="noopener">{YOUTUBE_MONEY_SOURCES.partnerEarnings.label}</a>.</p>
<TableScroll captionId="share-caption">
	<table>
		<caption id="share-caption">Share of revenue you keep, by revenue type</caption>
		<thead>
			<tr><th scope="col">Revenue type</th><th scope="col">You keep</th></tr>
		</thead>
		<tbody>
			<tr><th scope="row">Long-form ads</th><td>55% of net ad revenue on Watch Page ads</td></tr>
			<tr><th scope="row">Shorts ads</th><td>45% of the revenue allocated to your Shorts</td></tr>
			<tr><th scope="row">Memberships, Super Chat, Super Stickers and Super Thanks</th><td>70% of net revenue</td></tr>
		</tbody>
	</table>
</TableScroll>

<h2 id="shorts-revenue" tabindex="-1">How is Shorts revenue calculated?</h2>
<p>
	Shorts ad revenue for each month goes into one pool, the Creator Pool. A Short with no music sends all of its associated revenue to the pool. Music changes how much reaches it: with one music track, only half of the revenue associated with engaged views is allocated to the Creator Pool; with two tracks, one third. Each creator's share of the pool follows their share of engaged views, country by country, and you keep 45% of that share.
	<a href={YOUTUBE_MONEY_SOURCES.shortsMonetization.href} target="_blank" rel="noopener">{YOUTUBE_MONEY_SOURCES.shortsMonetization.label}</a>.
</p>

<h2 id="niche-cpm" tabindex="-1">What are typical CPM ranges by niche?</h2>
<p>
	These are advertiser-side CPM ranges, not RPM: what advertisers pay per 1,000 ad impressions before YouTube's share. They run from $20 to $40 in investing and stock market down to $3 to $6 in gaming. Use them as a starting point, then replace them with your own RPM from Studio.
</p>
<TableScroll captionId="niche-caption">
	<table>
		<caption id="niche-caption">Niche CPM ranges (USD)</caption>
		<thead>
			<tr><th scope="col">Niche</th><th scope="col">CPM range</th></tr>
		</thead>
		<tbody>
			{#each NICHE_CPM_ROWS as row (row.niche)}
				<tr><th scope="row">{row.niche}</th><td>{formatUsd(row.cpmLow)} to {formatUsd(row.cpmHigh)}</td></tr>
			{/each}
		</tbody>
	</table>
</TableScroll>
<p class="hint">
	{NICHE_CPM_NOTE} <a href={YOUTUBE_MONEY_SOURCES.cpmBenchmarks.href} target="_blank" rel="noopener">{YOUTUBE_MONEY_SOURCES.cpmBenchmarks.label}</a>.
</p>

<h2 id="partner-program" tabindex="-1">Who can monetize: YouTube Partner Program requirements</h2>
<p>
	Ads on your videos are paid through the YouTube Partner Program. From 1 February 2027, new applicants need <a href={YOUTUBE_MONEY_SOURCES.programBlog.href} target="_blank" rel="noopener">8,000 qualified watch hours in the previous 365 days, or 20 million qualified Shorts views in the previous 90 days</a>. YouTube Help adds that <a href={YOUTUBE_MONEY_SOURCES.programChanges.href} target="_blank" rel="noopener">1,000 subscribers</a> are still required. The new entry thresholds do not apply to creators already in the program. Fan Funding and shopping thresholds stay the same: 500 subscribers and either 3,000 qualified watch hours in the last year or 3 million qualified Shorts views in the last 90 days. To earn a share of Shorts ad revenue from the Creator Pool from 1 February 2027, you need at least 10 million qualified Shorts views in the last 90 days.
</p>
<p>
	Creators already in the program must accept the updated terms in YouTube Studio by 31 January 2027. Creators who do not accept stop earning from the associated monetization features from 1 February 2027, can regain access by accepting later, and stay in the program. From 1 February 2027, YouTube Help <a href={YOUTUBE_MONEY_SOURCES.programChanges.href} target="_blank" rel="noopener">counts a channel as active</a> if it meets any one of these: 1,000 qualified watch hours in the past 365 days, 1 million qualified Shorts views in the last 90 days, or 2 long-form videos or 5 Shorts uploaded every 90 days. Creators who drop below get an extended 90-day window to meet the watch-hours or the Shorts-views requirement to stay in the program.
</p>

<h2 id="faq" tabindex="-1">Frequently asked questions</h2>
{#each YOUTUBE_MONEY_FAQ as entry (entry.q)}
	<details class="faq-item">
		<summary>{entry.q}</summary>
		<p>{entry.a}</p>
	</details>
{/each}


<aside class="closing" aria-labelledby="comments">
	<h2 id="comments" tabindex="-1">What is in the comments under those views</h2>
	<p>
		Views are free. Here is what they pay. Then there are the comments.
		Moderaty screens published top-level comments on your channel with your rules and AI scoring, and sends uncertain ones to your review
		queue. It does not reply to viewers. It does not change your RPM.
	</p>
	<p class="closing-links"><a class="cta" href="/login">Connect your YouTube channel</a><a href="/pricing">See pricing</a></p>
</aside>

<style>
	.calculator-block { margin: 32px 0 48px; }
	.workspace { display: grid; gap: 24px; align-items: start; }
	@media (min-width: 760px) {
		.workspace { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
		.workspace .results { position: sticky; top: 96px; }
	}
	.calculator { display: grid; gap: 16px; border: 1px solid var(--line-strong); padding: 24px; min-width: 0; }
	.calculator input[type='text'],
	.calculator select { width: 100%; font-size: 16px; border: 1px solid var(--text-2); }
	.calculator fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 8px; min-width: 0; }
	.calculator fieldset[hidden],
	.calculator details[hidden] { display: none; }
	.calculator legend { font-weight: 600; margin-bottom: 4px; }
	.calculator .hint { margin: 0; }
	.calculator .segmented { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.choice-option {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 8px;
		border: 1px solid var(--text-2);
		font-size: 16px;
		line-height: 1.2;
		text-align: center;
		cursor: pointer;
	}
	.choice-option input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; opacity: 0; cursor: pointer; }
	.choice-option:has(input:checked) { background: var(--paper); color: var(--bg); font-weight: 600; }
	.choice-option:has(input:focus-visible) { outline: 2px solid var(--paper); outline-offset: 3px; }
	.presets { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
	.preset { min-height: 44px; min-width: 0; padding: 0; background: var(--surface); color: var(--text); border: 1px solid var(--text-2); font: inherit; }
	.hint { color: var(--text-2); font-size: 14px; margin: 0; line-height: 1.6; }
	.niche { border: 1px solid var(--line-strong); }
	.niche summary { display: flex; align-items: center; min-height: 44px; padding: 8px 16px; cursor: pointer; font-size: 16px; font-weight: 600; line-height: 1.4; list-style: none; }
	.niche summary::-webkit-details-marker { display: none; }
	.niche summary::after { content: '+'; margin-left: auto; padding-left: 12px; }
	.niche[open] summary::after { content: '\2212'; }
	.niche-body { display: grid; gap: 8px; padding: 0 16px 16px; }
	.submit { min-height: 48px; padding: 0 20px; background: var(--accent); color: var(--bg); border: 0; font: inherit; font-weight: 600; cursor: pointer; }
	.submit:hover { background: var(--accent-press); }
	.preset:focus-visible,
	.submit:focus-visible,
	.calculator input:focus-visible,
	.calculator select:focus-visible,
	summary:focus-visible {
		outline: 2px solid var(--paper);
		outline-offset: 3px;
	}
	.results { display: grid; gap: 16px; padding: 24px; border: 1px solid var(--line-strong); background: var(--surface); scroll-margin-top: 96px; }
	/* Grid items default to min-width: auto, so the wide earnings table would push the page sideways instead of scrolling inside its box. */
	.results > *,
	.figures-block { min-width: 0; }
	.figures-block { display: grid; gap: 16px; }
	.workspace .results p { margin: 0; font-size: 16px; line-height: 1.6; }
	.workspace .results h3 { margin: 0; font-size: 18px; line-height: 1.3; }
	.figures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin: 0; }
	.figures div { border-top: 1px solid var(--line-strong); padding-top: 12px; }
	.figures .figure-main { grid-column: 1 / -1; border-top: 0; border-left: 4px solid var(--accent); padding: 0 0 0 16px; }
	.figures dt { color: var(--text-2); font-size: 14px; }
	.figures dd { margin: 4px 0 0; font-size: clamp(18px, 5vw, 24px); overflow-wrap: anywhere; }
	.figures .figure-main dd { font-size: clamp(40px, 9vw, 64px); line-height: 1.1; }
	.formula { padding-left: 20px; margin: 0; }
	.faq-item { border-top: 1px solid var(--line-strong); padding: 16px 0; }
	.faq-item summary { cursor: pointer; font-weight: 600; list-style: none; }
	.faq-item summary::-webkit-details-marker { display: none; }
	.faq-item summary::after { content: '+'; float: right; }
	.faq-item[open] summary::after { content: '\2212'; }
	details.faq-item > p { margin: 12px 0 0; }
	.updated { color: var(--text-2); font-size: 14px; }
	.closing { margin-top: 64px; border-top: 1px solid var(--line-strong); }
	.closing .closing-links { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 24px; }
	.closing a.cta { display: inline-flex; align-items: center; min-height: 48px; padding: 0 20px; background: var(--accent); color: var(--bg); font-weight: 600; text-decoration: none; }
	.closing a.cta:hover { background: var(--accent-press); }
</style>
