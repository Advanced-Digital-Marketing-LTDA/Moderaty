<script lang="ts">
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import TableScroll from '$lib/components/blogs/TableScroll.svelte';
	import ArticleByline from '$lib/components/blogs/ArticleByline.svelte';
	import ArticleContents from '$lib/components/blogs/ArticleContents.svelte';
	import { BLOG_AUTHOR } from '$lib/blogs/author';
	import { COMMENT_SETTINGS_GUIDE, COMMENT_SETTINGS_GUIDE_EDITION, COMMENT_SETTINGS_GUIDE_SECTIONS } from '$lib/blogs/comment-settings-guide';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<BlogMeta {...COMMENT_SETTINGS_GUIDE} origin={data.siteOrigin} article />

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol><li><a href="/">Home</a></li><li><a href="/guides/">Guides</a></li><li aria-current="page">YouTube comment settings</li></ol>
</nav>
<article class="blog-article">
	<h1>{COMMENT_SETTINGS_GUIDE.title}</h1>
	<ArticleByline authorHref="#about-the-author" {...COMMENT_SETTINGS_GUIDE_EDITION} />

	<h2 id="summary" tabindex="-1">Summary</h2>
	<p>YouTube offers four video-comment moderation settings. Viewer posts in your YouTube Community use separate controls from video comments and comments under posts.</p>

	<h2 id="key-takeaways" tabindex="-1">Key takeaways</h2>
	<ul aria-label="Key takeaways">
		<li><strong>Basic</strong> holds comments YouTube’s moderation system identifies as potentially inappropriate. <strong>Strict</strong> holds a broader range. YouTube says its AI may not always get the decision right.</li>
		<li><strong>Hold all</strong> sends every comment to review. <strong>None</strong> means this moderation setting does not hold comments; it does not turn comments off.</li>
		<li>A channel default applies to new uploads; changing it does not change settings on existing videos. Check the individual video when you need to change an existing setting.</li>
		<li>Viewer posts in your Community use <strong>None, Basic, or Hold all</strong>, not Strict; these are not video comments or comments under posts.</li>
		<li>Held comments stay private unless approved and are kept for up to 60 days.</li>
	</ul>
	<ArticleContents headings={COMMENT_SETTINGS_GUIDE_SECTIONS} />

	<h2 id="video-settings" tabindex="-1">Choose a comment setting for videos</h2>
	<p>YouTube’s video-comment controls offer four moderation choices. The setting changes how much content waits in the Held queue, so choose based on the review workload you can manage. <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">Learn about YouTube comment settings</a>. The trade-offs below describe documented behavior, not measured accuracy or workload estimates.</p>
	<TableScroll captionId="video-settings-caption">
		<table>
			<caption id="video-settings-caption">YouTube comment settings for videos</caption>
			<thead><tr><th scope="col">Setting</th><th scope="col">What YouTube says it does</th><th scope="col">Review trade-off</th></tr></thead>
			<tbody>
				<tr><th scope="row">None (don’t hold any)</th><td>Does not hold comments for review through this setting.</td><td>Fewest comments are queued by this control. Other controls, such as blocked words or links, can still affect content.</td></tr>
				<tr><th scope="row">Basic</th><td>Holds comments YouTube’s moderation system identifies as potentially inappropriate.</td><td>Some comments wait for review; a comment may be held or missed incorrectly.</td></tr>
				<tr><th scope="row">Strict</th><td>Holds a broader range of potentially inappropriate comments than Basic.</td><td>More comments may need review than with Basic. YouTube says its AI may not always get it right.</td></tr>
				<tr><th scope="row">Hold all</th><td>Holds all comments for review.</td><td>Every comment must be reviewed before it appears publicly.</td></tr>
			</tbody>
		</table>
	</TableScroll>
	<p>Basic and Strict use AI, which YouTube says may miss or misclassify comments. <strong>None is not Off:</strong> None holds no comments through that filter while comments remain on. Pause stops new comments but keeps existing ones; Off prevents new comments and hides existing ones until re-enabled.</p>

	<h2 id="defaults" tabindex="-1">Defaults, existing videos, and future comments</h2>
	<p>YouTube says the default comment setting applies to new video uploads. Changing that default does <strong>not</strong> change the setting on existing videos. You can also change a comment setting for an individual video after upload. The <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">comment-settings FAQ</a> says changes to channel-level or video-level settings, blocked words, hidden users, and blocked links apply to future comments; existing comments are affected only if you turn off comments on a video or hide a user.</p>
	<p>These settings are forward-looking. If an older video needs different handling, open its video-level settings; changing the default will not change that upload’s setting.</p>
	<p>Blocked-word and link controls are separate from Basic, Strict, and Hold all. YouTube says blocked words and link blocking apply across all videos and the channel homepage, not to one video only. Comments containing or closely matching a blocked term may be held for up to 60 days; comments from approved users bypass those filters. Link text holds comments with URLs, except links from you, moderators, or approved users. The same configured words and links apply to viewer posts in your Community; Link text can hold viewer posts containing URLs or hashtags. <a href="https://support.google.com/youtube/answer/16622701?hl=en" target="_blank" rel="noopener">YouTube’s channel moderation settings</a> describe these controls, and <a href="https://support.google.com/youtube/answer/15739725?hl=en" target="_blank" rel="noopener">Community moderation guidance</a> confirms that configured comment words and links also apply to Community posts.</p>

	<h2 id="viewer-posts" tabindex="-1">Viewer posts in your Community use separate moderation settings</h2>
	<p>This section is about <strong>viewer posts in your YouTube Community</strong>, not comments on videos or comments under posts. YouTube’s <a href="https://support.google.com/youtube/answer/15739725?hl=en" target="_blank" rel="noopener">Community-post guidance</a> lists <strong>None, Basic, and Hold all</strong> for viewer posts. It does not list Strict for this control.</p>
	<TableScroll captionId="viewer-posts-caption">
		<table>
			<caption id="viewer-posts-caption">Viewer-post settings in YouTube Community</caption>
			<thead><tr><th scope="col">Viewer-post setting (YouTube Community feature)</th><th scope="col">Practical effect</th></tr></thead>
			<tbody>
				<tr><th scope="row">None</th><td>Does not hold viewer posts for review through this setting.</td></tr>
				<tr><th scope="row">Basic</th><td>Holds viewer posts identified as potentially inappropriate for review.</td></tr>
				<tr><th scope="row">Hold all</th><td>Holds every viewer post for review.</td></tr>
			</tbody>
		</table>
	</TableScroll>
	<p>If you turn off your Community, YouTube says existing posts are hidden; turning it back on makes them visible again. Check the viewer-post controls directly rather than assuming the video-comment setting carries over.</p>
	<p>Video comments and viewer posts have separate Held queues: <strong>Comments &gt; Held</strong> for comments and <strong>Community &gt; Viewer posts &gt; Held</strong> for viewer posts.</p>

	<h2 id="held-comments" tabindex="-1">What to check in comments held for review</h2>
	<p>Open YouTube Studio’s <strong>Held</strong> tab and read each comment in context. Comments held by a moderation setting or by blocked-word or link filters stay out of public view unless you approve them. YouTube keeps held comments for up to 60 days. <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">Learn about comment settings</a>.</p>
	<p>Treat the queue as a request to review, not a final ruling. YouTube says Basic and Strict moderation use AI and may not get every call right. Compare the wording with the surrounding conversation and your channel rules before you decide. For example, a viewer may repeat a phrase to criticize it rather than endorse it.</p>
	<p>From Held, you can approve a comment, remove it, or report it as spam or abuse. If you are unsure, leave it there and return before it expires. <a href="https://support.google.com/youtube/answer/15535966?hl=en" target="_blank" rel="noopener">Moderate comments</a>.</p>

	<h2 id="choose" tabindex="-1">A practical way to choose</h2>
	<ol>
		<li>Start with the least restrictive setting that fits the channel’s moderation capacity and needs.</li>
		<li>Check the Held queue regularly. Review examples that were held and comments that appeared but should have been held.</li>
		<li>If unwanted comments still appear publicly, try a stricter setting or targeted filters. If too many suitable comments are held, try a less restrictive setting or narrow the blocked-word list.</li>
		<li>Review Community posts separately from video comments.</li>
		<li>Recheck the channel default and video-level settings after a change. YouTube can update its interface and behavior, so confirm the current controls in Studio.</li>
	</ol>
	<p>Review needs vary by channel; no setting guarantees results.</p>

	<h2 id="faq" tabindex="-1">Frequently asked questions</h2>
	<h3>Does Strict apply to viewer posts in my Community?</h3>
	<p>YouTube’s current guidance for viewer posts lists None, Basic, and Hold all. It does not list Strict for that control. Do not confuse viewer posts with video comments or comments under posts.</p>
	<h3>Will changing my default update existing videos?</h3>
	<p>No. YouTube says the default comment setting applies to new uploads and changing it does not change existing videos. Use an individual video’s settings when you need to change that video.</p>
	<h3>How long do held comments stay available?</h3>
	<p>YouTube says held comments remain in Studio for up to 60 days. Review the Held tab before they expire.</p>
	<h3>Does Basic or Strict reliably identify every inappropriate comment?</h3>
	<p>No. YouTube says its AI may not always get it right. Treat the filter as a way to route comments for review, not a final decision.</p>

	<h2 id="about-the-author" tabindex="-1">About the author</h2>
	<p>{BLOG_AUTHOR.bio}</p>
</article>
