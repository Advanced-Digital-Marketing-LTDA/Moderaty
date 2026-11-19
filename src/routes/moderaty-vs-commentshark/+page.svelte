<script lang="ts">
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import TableScroll from '$lib/components/blogs/TableScroll.svelte';
	import ArticleByline from '$lib/components/blogs/ArticleByline.svelte';
	import ArticleContents from '$lib/components/blogs/ArticleContents.svelte';
	import { BLOG_AUTHOR } from '$lib/blogs/author';
	import {
		COMMENTSHARK_ACTION_PACKS,
		COMMENTSHARK_COMPARISON,
		COMMENTSHARK_COMPARISON_EDITION,
		COMMENTSHARK_COMPARISON_SECTIONS,
		COMMENTSHARK_PLANS,
		COMMENTSHARK_RETRIEVED,
		COMMENTSHARK_SOURCES,
		COMPARISON_ROWS,
		MODERATY_PLANS
	} from '$lib/blogs/commentshark-comparison';
	import { INCLUDED_COMMENTS, MONTHLY_PLAN_USD } from '$lib/landing/cost';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	// Moderaty's per-comment price on the monthly plan, derived so it follows the plan constants.
	const centsEach = +((MONTHLY_PLAN_USD * 100) / INCLUDED_COMMENTS).toFixed(2);
</script>

<BlogMeta {...COMMENTSHARK_COMPARISON} origin={data.siteOrigin} article />

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol><li><a href="/">Home</a></li><li aria-current="page">Moderaty vs CommentShark</li></ol>
</nav>
<article class="blog-article">
	<h1>{COMMENTSHARK_COMPARISON.title}</h1>
	<ArticleByline authorHref="#about-the-author" {...COMMENTSHARK_COMPARISON_EDITION} />
	<p>One of these answers your fans. The other swings the hammer at your trolls. Both read your YouTube comments, so here is what each one does, how each one bills, and which one fits your channel.</p>

	<h2 id="summary" tabindex="-1">Summary</h2>
	<p>CommentShark writes and posts replies and runs moderation rules. Moderaty scores published top-level comments with AI, applies your rules and protected handles, and holds uncertain comments for your review. Moderaty never writes a reply. Both tools work on YouTube only. I built Moderaty, so weigh this page accordingly. Moderaty is not affiliated with CommentShark, and I read every CommentShark figure below from its own public pages on {COMMENTSHARK_RETRIEVED}.</p>

	<h2 id="key-takeaways" tabindex="-1">Key takeaways</h2>
	<ul aria-label="Key takeaways">
		<li>If you want AI to answer your fans, CommentShark is built for that. If you want AI scoring of harmful top-level comments with a review queue, Moderaty is built for that.</li>
		<li>The prices do not compare one to one. CommentShark counts an action each time a rule matches a comment. Moderaty spends a credit on each comment it scores with AI.</li>
		<li>Moderaty's hosted plan is ${MONTHLY_PLAN_USD} a month for {INCLUDED_COMMENTS} AI classifications, which is {centsEach}¢ per comment on the monthly plan. CommentShark's paid plans run from $19 to $139 a month.</li>
		<li>Neither tool can heart or pin comments through YouTube, and neither moderates live chat.</li>
	</ul>
	<ArticleContents headings={COMMENTSHARK_COMPARISON_SECTIONS} />

	<h2 id="at-a-glance" tabindex="-1">Moderaty and CommentShark at a glance</h2>
	<p>The table lists what each product does today. The CommentShark column comes from its own pages, listed under <a href="#sources">sources and dates</a>.</p>
	<TableScroll captionId="at-a-glance-caption">
		<table>
			<caption id="at-a-glance-caption">Moderaty and CommentShark compared by topic</caption>
			<thead><tr><th scope="col">Topic</th><th scope="col">Moderaty</th><th scope="col">CommentShark</th></tr></thead>
			<tbody>
				{#each COMPARISON_ROWS as row (row.topic)}
					<tr><th scope="row">{row.topic}</th><td>{row.moderaty}</td><td>{row.commentshark}</td></tr>
				{/each}
			</tbody>
		</table>
	</TableScroll>

	<h2 id="pricing" tabindex="-1">How do the prices compare?</h2>
	<p>CommentShark prices by how many actions its rules take each month. These are its published plans as of {COMMENTSHARK_RETRIEVED}.</p>
	<TableScroll captionId="commentshark-plans-caption">
		<table>
			<caption id="commentshark-plans-caption">CommentShark plans</caption>
			<thead><tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">Rules</th><th scope="col">Actions a month</th><th scope="col">New comments checked</th></tr></thead>
			<tbody>
				{#each COMMENTSHARK_PLANS as plan (plan.name)}
					<tr><th scope="row">{plan.name}</th><td>{plan.price}</td><td>{plan.rules}</td><td>{plan.actions}</td><td>{plan.checks}</td></tr>
				{/each}
			</tbody>
		</table>
	</TableScroll>
	<p>CommentShark also sells one-time action packs, which expire 12 months after purchase: {#each COMMENTSHARK_ACTION_PACKS as pack, index (pack.name)}{pack.name}, {pack.actions} actions for {pack.price}{index < COMMENTSHARK_ACTION_PACKS.length - 1 ? '; ' : '.'}{/each} Its pricing page also shows an annual option that saves about 17%.</p>
	<p>Moderaty's numbers come from the same plan data as its <a href="/pricing">pricing page</a>.</p>
	<TableScroll captionId="moderaty-plans-caption">
		<table>
			<caption id="moderaty-plans-caption">Moderaty plans</caption>
			<thead><tr><th scope="col">Plan</th><th scope="col">Price</th><th scope="col">What it covers</th></tr></thead>
			<tbody>
				{#each MODERATY_PLANS as plan (plan.name)}
					<tr><th scope="row">{plan.name}</th><td>{plan.price}</td><td>{plan.covers}</td></tr>
				{/each}
			</tbody>
		</table>
	</TableScroll>

	<h2 id="billing-units" tabindex="-1">What does one unit of usage mean?</h2>
	<p>CommentShark counts an action when a rule matches a comment, whether the rule replies, deletes, holds the comment or emails you. Comments that match no rule are free. Moderaty spends one credit on each comment it scores with AI, and a feedback digest that classifies the same comment spends another. Rule matches and protected-handle decisions use no moderation credit.</p>
	<p>So an action and a credit measure different things. Take a made-up channel with 1,000 comments a month. If its CommentShark rules match 200 of them, that is 200 actions. On Moderaty the same 1,000 comments cost up to 1,000 credits, fewer when rules or protected handles decide some of them first. Compare your own comment volume and your own rules before comparing the prices.</p>

	<h2 id="commentshark-stronger" tabindex="-1">Where CommentShark is stronger</h2>
	<ul>
		<li><strong>Replies.</strong> It writes template or AI replies, learns your voice from your past replies, and posts them automatically or waits for your approval, rule by rule.</li>
		<li><strong>Insights.</strong> It scores sentiment, tags comments, charts trends and emails you when negative comments pass a threshold you set.</li>
		<li><strong>Reach.</strong> It has a REST API, a connector for Claude, email approval and push notifications from an installable web app.</li>
		<li><strong>Rule controls.</strong> Rules can be limited to chosen videos, delayed, exported and imported.</li>
		<li><strong>A free hosted plan.</strong> Free is 3 rules and 20 actions a month, with no card. Moderaty's hosted service has one free dry run in total; self-hosting is free.</li>
	</ul>

	<h2 id="moderaty-stronger" tabindex="-1">Where Moderaty is stronger</h2>
	<ul>
		<li><strong>Ban.</strong> A rule or a review can reject a comment and ban its author. CommentShark's pages list no ban action.</li>
		<li><strong>Protected handles.</strong> Up to 100 handles per channel skip rules and AI and are approved.</li>
		<li><strong>Screening beyond keywords.</strong> AI moderation scoring covers harm categories, an optional tone pass looks for demeaning or sarcastic comments, and a jailbreak screen holds suspicious comments for you. The tone and jailbreak signals only ever hold a comment for your review.</li>
		<li><strong>Preview before it acts.</strong> A dry run covers 1, 3, 6, 12 or 24 months of past comments and changes nothing on YouTube. A history scan can then moderate that window for real.</li>
		<li><strong>Undo.</strong> Hold and reject actions can be restored from the activity log. Delete is permanent, and so is a ban.</li>
		<li><strong>Ownership.</strong> You can self-host it for free, or buy lifetime hosted access for $49 once. Top-up credits stay on your balance. Commenter handles in the log are erased after 30 days.</li>
	</ul>

	<h2 id="neither" tabindex="-1">What neither tool does</h2>
	<ul>
		<li>Neither can heart, like or pin comments. CommentShark's FAQ says YouTube's API does not allow it, and Moderaty has no such action either.</li>
		<li>Neither moderates live chat. CommentShark covers video comments only, and Moderaty covers published top-level comments only.</li>
		<li>Neither stops a comment from being public first. Both check comments that have already been posted, so keep YouTube's own Basic or Strict filter on whichever tool you choose.</li>
		<li>Neither is real-time. CommentShark checks every 30 minutes on paid plans. Moderaty works through one channel and one page of up to 100 comments per background run.</li>
	</ul>

	<h2 id="choosing" tabindex="-1">How to choose</h2>
	<p>If you want AI to answer your fans, I'd use CommentShark. It's good at that, and Moderaty will never write a reply. If you want AI scoring for harmful top-level comments, with a review queue, protected handles, bans and optional rules, I'd use Moderaty.</p>
	<ul>
		<li>Choose CommentShark when the work is answering questions, thanking fans and tracking sentiment.</li>
		<li>Choose Moderaty when the work is catching hate, spam and scams before you read them, and you want to preview the rules on old comments first.</li>
		<li>Choose by unit, too. A channel whose rules match few comments can spend few CommentShark actions. A channel that wants every comment scored by AI is closer to Moderaty's credit model.</li>
	</ul>

	<h2 id="sources" tabindex="-1">Sources and dates</h2>
	<p>Every CommentShark fact on this page was read from the pages below on <time datetime={COMMENTSHARK_RETRIEVED}>{COMMENTSHARK_RETRIEVED}</time>. Plans, prices and limits change, so check CommentShark's own pages before you decide.</p>
	<ul>
		{#each Object.values(COMMENTSHARK_SOURCES) as source (source.href)}
			<li><a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}</a></li>
		{/each}
	</ul>

	<h2 id="faq" tabindex="-1">Frequently asked questions</h2>
	<h3>Is Moderaty an alternative to CommentShark?</h3>
	<p>For moderation, yes. For replies, no. Moderaty does not write replies, so a channel that wants AI replies needs a tool built for them.</p>
	<h3>Can Moderaty reply to comments?</h3>
	<p>No. Moderaty works on published top-level comments and never writes a reply.</p>
	<h3>Does Moderaty have a free plan?</h3>
	<p>Self-hosting is free from Moderaty, and you pay your own infrastructure and OpenAI costs. On the hosted service, an unpaid account gets one free dry run in total, which scores the newest 100 comments. See the <a href="/pricing">pricing page</a>.</p>
	<h3>How does Moderaty decide what to hold?</h3>
	<p>Protected handles are approved first, then your rules apply, then a jailbreak screen, AI scoring and an optional tone pass. Uncertain comments go to your review queue. The <a href="/how-it-works/">how it works page</a> has the full order.</p>

	<h2 id="about-the-author" tabindex="-1">About the author</h2>
	<p>{BLOG_AUTHOR.bio}</p>
</article>
