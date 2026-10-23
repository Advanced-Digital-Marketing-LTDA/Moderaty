<script lang="ts">
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import TableScroll from '$lib/components/blogs/TableScroll.svelte';
	import ArticleByline from '$lib/components/blogs/ArticleByline.svelte';
	import ArticleContents from '$lib/components/blogs/ArticleContents.svelte';
	import { BLOG_AUTHOR } from '$lib/blogs/author';
	import { HATE_COMMENTS } from '$lib/blogs/hate-comments';
	import { SPAM_COMMENTS } from '$lib/blogs/spam-comments';
	import { MODERATION_GUIDE, MODERATION_GUIDE_EDITION, MODERATION_GUIDE_SECTIONS } from '$lib/blogs/moderation-guide';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<BlogMeta {...MODERATION_GUIDE} origin={data.siteOrigin} article />

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol><li><a href="/">Home</a></li><li><a href="/guides/">Guides</a></li><li aria-current="page">YouTube comment moderation</li></ol>
</nav>
<article class="blog-article">
	<h1>{MODERATION_GUIDE.title}</h1>
	<ArticleByline authorHref="#about-the-author" {...MODERATION_GUIDE_EDITION} />

	<h2 id="summary" tabindex="-1">Summary</h2>
	<p>My goal is to get spam bots out without bonking useful criticism along with them. I judge questions, criticism, spam and abuse on their content and context. I start with the least disruptive response that fits my channel rules: leave a comment visible, reply, review it, remove it, hide the user or report it. YouTube’s controls are my first pass. I check uncertain cases and consider another tool when I can name the workflow gap.</p>

	<h2 id="key-takeaways" tabindex="-1">Key takeaways</h2>
	<ul aria-label="Key takeaways">
		<li><a href="#choose-an-action">Keep good-faith questions and criticism.</a> Tone alone does not tell me whether a comment belongs.</li>
		<li><a href="#native-settings">Choose a hold setting and review what it catches.</a> A filter can make mistakes.</li>
		<li><a href="#review-workload">Set a review routine with a stopping point.</a> I do not need to answer each comment.</li>
		<li><a href="#choose-an-action">Treat suspected spam and scams as a separate problem from disagreement.</a> I avoid opening suspicious links to investigate them.</li>
		<li><a href="#test-automation">Test representative examples before relying on automation.</a> Keep human review for uncertain cases.</li>
	</ul>
	<ArticleContents headings={MODERATION_GUIDE_SECTIONS} />

	<h2 id="choose-an-action" tabindex="-1">Start with the comment</h2>
	<p>One rule for difficult comments can hide a useful correction or leave a harmful pattern untouched. The Crypto Bot does not get to set my channel rules, and neither does a keyword match. I match my response to what the viewer wrote and what my channel rules allow.</p>
	<TableScroll captionId="decision-caption">
		<table>
			<caption id="decision-caption">Choose a response by comment type</caption>
			<thead><tr><th scope="col">If the comment is…</th><th scope="col">My next step</th></tr></thead>
			<tbody>
				<tr><th scope="row">A question, correction or good-faith disagreement</th><td>I leave it visible and reply when an answer will help the commenter or other viewers.</td></tr>
				<tr><th scope="row">A personal attack or repeated harassment</th><td>I may remove the comment or hide the user under my channel rules. I report suspected YouTube policy violations for YouTube to review.</td></tr>
				<tr><th scope="row">Repetitive promotion, impersonation or a suspicious link</th><td>I treat it as possible spam, avoid opening the link, and use the available review, removal or reporting controls.</td></tr>
				<tr><th scope="row">Ambiguous or dependent on context</th><td>I check the surrounding discussion before deciding. I use a hold option where the moderation surface offers one.</td></tr>
			</tbody>
		</table>
	</TableScroll>
	<p>For decisions about criticism, hate and harassment, see <a href={HATE_COMMENTS.path}>how to deal with hate comments on YouTube</a>. For scam and impersonation patterns, see <a href={SPAM_COMMENTS.path}>how to stop spam and scam comments on your YouTube channel</a>.</p>
	<p>A report asks YouTube to assess a suspected violation; it does not guarantee removal. YouTube explains the process in its <a href="https://support.google.com/youtube/answer/2802027?hl=en" target="_blank" rel="noopener">reporting instructions</a>. I keep that decision separate from removing a comment under my own channel rules.</p>
	<p>Hiding a user affects more than one comment. YouTube says it hides activity including comments, live chats and Community posts from the user and associated accounts. The user gets no notification, but past activity from associated accounts remains visible. I check the <a href="https://support.google.com/youtube/answer/9482361?hl=en" target="_blank" rel="noopener">hide or unhide users instructions</a> before choosing this broader action.</p>

	<h2 id="native-settings" tabindex="-1">Use YouTube’s comment settings first</h2>
	<p>With video comments on, I can choose None, Basic, Strict or Hold all. None disables this hold filter; Basic holds potentially inappropriate comments; Strict widens that filter; Hold all sends comments to review. YouTube’s <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">comment settings guide</a> explains these options. Held comments stay private until approval, with up to 60 days to review them.</p>
	<p>I can also filter links and blocked words. Approved users bypass those filters; links from me or moderators have exemptions too. I keep word rules narrow because a harmless question can contain a blocked phrase. A scam can also avoid the terms I chose.</p>
	<p>YouTube warns that its AI filters can make mistakes, and their accuracy and hold volume can change. I check what reaches the queue before treating the labels as correct. A held comment can deserve approval; a published comment can still need attention.</p>

	<h2 id="review-workload" tabindex="-1">Make the review workload manageable</h2>
	<p>As comments build up, I sort the work before answering. My suggested order is to check held items, handle clear spam or abuse, answer questions that affect other viewers, then use any remaining time for replies. I decide who handles borderline cases and when to stop for the day.</p>
	<p>Changing the default comment setting affects new videos and posts, leaving existing ones unchanged. I use the <a href="https://support.google.com/youtube/answer/9482556?hl=en" target="_blank" rel="noopener">instructions for changing comment settings</a> to check older videos and choose individual or bulk edits. I check the actual video instead of assuming my new default updated it.</p>
	<p>Live chat has a separate moderation workflow. For a livestream, I check YouTube’s <a href="https://support.google.com/youtube/answer/9826490?hl=en" target="_blank" rel="noopener">live-chat moderation guide</a>. I verify each control on the surface I am managing; some settings, including blocked words, can affect both comments and chat.</p>

	<h2 id="choose-a-tool" tabindex="-1">Know when another moderation tool helps</h2>
	<p>YouTube Studio may be enough when its settings fit my channel and I can keep up with review. I compare another tool when I can name a gap in that process, such as channel scale or how a team assigns review work. A “best AI” claim gives me little to evaluate.</p>
	<p>Before adopting a tool, I check which YouTube surfaces it covers and the permissions it requests. I verify its actions, the route for uncertain cases, whether I can inspect or reverse decisions, and its retention terms and current price. A tool that scans published comments may leave replies or YouTube’s Held queue to me. I check those limits against its current documentation and actual workflow.</p>
	<p>I test with examples that matter to my channel before relying on automatic decisions. Removing a useful correction is a real failure even when the tool also catches spam. I compare the extra review work with the problem I wanted to solve.</p>

	<h2 id="test-automation" tabindex="-1">Test automation before trusting it</h2>
	<p>I would build a small labeled sample containing clear spam, genuine questions, criticism, jokes and ambiguous cases. For each example, I record the action I want and why. I then check both false positives that hide acceptable comments and misses that leave harmful or deceptive comments visible. I keep examples private or anonymized when they contain personal information.</p>
	<p>I set a rule for cases that need human review and test again after changing a filter, rule or tool. A narrow word rule can still catch a viewer quoting a scam as a warning. I inspect that case alongside the obvious spam, so the easy examples do not hide the mistakes.</p>

	<h2 id="audience-feedback" tabindex="-1">Use recurring questions as audience feedback</h2>
	<p>Repeated questions can point me toward a confusing explanation or a useful follow-up video. I record the question and the part of the video it concerns, then check whether a clarification would help. A handful of comments does not represent the views of my whole audience.</p>
	<p>I keep this work separate from moderation decisions. Removing a spam thread gives me no evidence of demand, and a popular comment still needs scrutiny before I treat it as a reliable product or policy signal.</p>

	<h2 id="first-check" tabindex="-1">A practical first check</h2>
	<p>Before adding another rule or tool, I would review a sample of held and published comments. I would note useful comments a filter held and clear spam it missed, then adjust one setting at a time. Checking only the Held queue would miss the comments that passed the filter.</p>
	<p>YouTube’s <a href="https://support.google.com/youtube/answer/9482362?hl=en" target="_blank" rel="noopener">spam review instructions</a> explain how to open the Held tab. I choose an action for each item after reading it. This is a channel-specific check, so I keep the examples and limits with any conclusion I draw.</p>

	<h2 id="frequently-asked-questions" tabindex="-1">Frequently asked questions</h2>
	<h3>How long do YouTube comments stay in the review queue?</h3>
	<p>Up to 60 days. YouTube’s <a href="https://support.google.com/youtube/answer/9482362?hl=en" target="_blank" rel="noopener">spam review documentation</a> describes that window. I set a review routine that leaves time to check acceptable comments.</p>
	<h3>Does None turn off all YouTube moderation?</h3>
	<p>No. It controls the hold filter. I check other available controls separately in the <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">comment settings documentation</a>.</p>
	<h3>Can a YouTube moderator approve a held comment?</h3>
	<p>YouTube says comment moderators can hold comments for my review but cannot access my channel in Studio. The <a href="https://support.google.com/youtube/answer/15535966?hl=en&amp;co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener">moderator instructions</a> distinguish these roles. A separate grant of channel access needs its own permissions check.</p>
	<h3>Is live-chat moderation the same as video-comment moderation?</h3>
	<p>No. YouTube provides <a href="https://support.google.com/youtube/answer/9826490?hl=en" target="_blank" rel="noopener">live-chat controls</a> for that workflow. I verify the steps for the surface and device I use.</p>
	<h3>Does automated comment moderation get each decision right?</h3>
	<p>No. I review uncertain cases and test the errors that matter to my channel. YouTube’s <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">filter warning</a> also explains that performance can change.</p>

	<h2 id="about-the-author" tabindex="-1">About the author</h2>
	<p>{BLOG_AUTHOR.bio}</p>
</article>
