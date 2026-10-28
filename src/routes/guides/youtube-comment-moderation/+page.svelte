<script lang="ts">
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import TableScroll from '$lib/components/blogs/TableScroll.svelte';
	import ArticleByline from '$lib/components/blogs/ArticleByline.svelte';
	import ArticleContents from '$lib/components/blogs/ArticleContents.svelte';
	import { BLOG_AUTHOR } from '$lib/blogs/author';
	import { HATE_COMMENTS } from '$lib/blogs/hate-comments';
	import { SPAM_COMMENTS } from '$lib/blogs/spam-comments';
	import { MODERATION_GUIDE, MODERATION_GUIDE_EDITION, MODERATION_GUIDE_SECTIONS } from '$lib/blogs/moderation-guide';
	import { COMMENT_SETTINGS_GUIDE } from '$lib/blogs/comment-settings-guide';
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
	<p>To moderate YouTube comments, choose what Studio should hold for review, then check the comments that pass through. From there, you can approve useful contributions or take action on comments that break your channel rules.</p>
	<p>My priority is to keep questions and useful criticism visible. Even the Ackchyually Guy can spot a mistake worth fixing. Spam, personal attacks and suspicious links need different decisions, even when they arrive under the same video.</p>

	<h2 id="key-takeaways" tabindex="-1">Key takeaways</h2>
	<ul aria-label="Key takeaways">
		<li><a href="#native-settings">Set defaults for new videos and check older uploads separately.</a> A new default does not update the back catalog.</li>
		<li><a href="#blocked-words-and-links">Keep word and link rules narrow.</a> A viewer quoting a scam may be warning other people.</li>
		<li><a href="#review-comments">Review Held and Published comments.</a> Filters can hold useful contributions or miss abuse.</li>
		<li><a href="#review-workload">Give the review queue an owner and a stopping point.</a> Agree on who handles uncertain cases.</li>
		<li><a href="#test-automation">Preview automated decisions before enabling actions.</a> Include comments that need context.</li>
	</ul>
	<ArticleContents headings={MODERATION_GUIDE_SECTIONS} />

	<h2 id="native-settings" tabindex="-1">Set up comment moderation in YouTube Studio</h2>
	<p>On a computer, configure the defaults for new videos and posts:</p>
	<ol>
		<li>Sign in to YouTube Studio.</li>
		<li>Open Settings, then Community moderation.</li>
		<li>Select Content controls.</li>
		<li>Under Comments on new videos and posts, choose your comment and moderation settings.</li>
		<li>Select Save.</li>
	</ol>
	<p>Content controls also contains blocked-word and link settings. YouTube documents the current menu in its <a href="https://support.google.com/youtube/answer/16622701?co=GENIE.Platform%3DDesktop&amp;hl=en" target="_blank" rel="noopener">channel moderation settings guide</a>.</p>

	<h3>Basic, Strict or Hold all?</h3>
	<p>With comments on, YouTube offers four moderation levels:</p>
	<TableScroll captionId="settings-caption">
		<table>
			<caption id="settings-caption">YouTube comment moderation settings</caption>
			<thead><tr><th scope="col">Setting</th><th scope="col">What YouTube does</th></tr></thead>
			<tbody>
				<tr><th scope="row">None</th><td>Turns off this hold filter.</td></tr>
				<tr><th scope="row">Basic</th><td>Holds comments it considers inappropriate.</td></tr>
				<tr><th scope="row">Strict</th><td>Holds a broader range of comments.</td></tr>
				<tr><th scope="row">Hold all</th><td>Sends comments to review before viewers can see them.</td></tr>
			</tbody>
		</table>
	</TableScroll>
	<p>These are <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">YouTube’s documented comment moderation options</a>.</p>
	<p>Compare the settings and their review trade-offs in the <a href={COMMENT_SETTINGS_GUIDE.path}>YouTube comment settings guide</a>.</p>
	<p>Choose a setting based on what you can review. Moving from Basic to Strict may catch more unwanted comments, so check whether it also holds contributions you want to keep. Hold all puts you on door duty: someone needs to approve the comments you want viewers to see.</p>

	<h3>Update existing videos separately</h3>
	<p>Changing the default doesn’t update older uploads. To change an existing video on a computer:</p>
	<ol>
		<li>Open Content in YouTube Studio.</li>
		<li>Select the video’s thumbnail.</li>
		<li>Open Show more.</li>
		<li>Find Comments and ratings and choose the settings.</li>
		<li>Select Save.</li>
	</ol>
	<p>You can also change multiple videos through bulk edits. Follow <a href="https://support.google.com/youtube/answer/9482556?hl=en" target="_blank" rel="noopener">YouTube’s instructions for changing comment settings</a> rather than assuming a new default reached the back catalog.</p>

	<h2 id="blocked-words-and-links" tabindex="-1">Keep blocked-word and link rules narrow</h2>
	<p>In Content controls, add words or phrases to the Blocked words list, separating entries with commas. The Link text setting can hold comments containing hashtags or URLs for review. See <a href="https://support.google.com/youtube/answer/16622701?co=GENIE.Platform%3DDesktop&amp;hl=en" target="_blank" rel="noopener">YouTube’s content controls</a>.</p>
	<p>I keep word rules narrow because context can change the meaning. A viewer might repeat a scammer’s wording to warn other people. Bonking the person who raised the alarm would lose a useful contribution.</p>
	<p>Check the exceptions, too. Approved users bypass blocked-word and link filters, and links from the channel owner or moderators have exemptions. <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">YouTube’s comment settings guide</a> explains which controls apply.</p>
	<p>For suspicious links and impersonation patterns, use the <a href={SPAM_COMMENTS.path}>guide to stopping spam and scam comments on YouTube</a>.</p>

	<h2 id="review-comments" tabindex="-1">Review both Held and Published comments</h2>
	<p>On a computer, open Community in YouTube Studio. The Published tab contains visible comments; Held contains comments caught by your settings or YouTube’s spam detection. You can filter the list by criteria such as questions or response status. Follow <a href="https://support.google.com/youtube/answer/9482367?co=GENIE.Platform%3DDesktop&amp;hl=en" target="_blank" rel="noopener">YouTube’s comment review instructions</a>.</p>
	<p>Checking both tabs matters. A useful comment can end up in Held, and an abusive comment can remain published. YouTube keeps held comments for up to 60 days, so leave enough time to review contributions you may want to approve. See <a href="https://support.google.com/youtube/answer/9482362?hl=en" target="_blank" rel="noopener">YouTube’s spam review guide</a>.</p>

	<h3 id="choose-an-action" tabindex="-1">Choose an action that fits the comment</h3>
	<p>Read the surrounding discussion before deciding on an ambiguous comment. Then choose the action that fits:</p>
	<ul>
		<li>Approve a held comment that belongs in the discussion.</li>
		<li>Reply when an answer or correction would help viewers. Keep “skill issue” in your drafts.</li>
		<li>Remove a comment that breaks your channel rules.</li>
		<li>Hide a user when you need to address their activity across the channel.</li>
		<li>Report a suspected Community Guidelines violation for YouTube to review.</li>
	</ul>
	<p>YouTube provides these <a href="https://support.google.com/youtube/answer/15535966?co=GENIE.Platform%3DDesktop&amp;hl=en" target="_blank" rel="noopener">comment moderation actions</a>. Hiding has a wider scope than removing one comment, and YouTube doesn’t notify a user when you hide them. See <a href="https://support.google.com/youtube/answer/9482361?hl=en" target="_blank" rel="noopener">YouTube’s hiding instructions</a>.</p>
	<p>Reporting asks YouTube to assess the content; it doesn’t guarantee removal. You can enforce your channel’s rules while YouTube considers a report. Read <a href="https://support.google.com/youtube/answer/2802027?hl=en" target="_blank" rel="noopener">YouTube’s reporting process</a>.</p>
	<p>For the harder judgment calls, the <a href={HATE_COMMENTS.path}>guide to dealing with hate comments on YouTube</a> covers criticism, personal attacks and harassment in more detail.</p>

	<h2 id="review-workload" tabindex="-1">Give the review queue an owner and a stopping point</h2>
	<p>Set a review window that fits the channel’s workload, including a time to close Studio and touch grass. Agree on who handles straightforward decisions and who takes the cases that need more context. A queue is easier to manage when a reviewer knows which decisions they can make.</p>
	<p>YouTube lets you appoint comment moderators. In the YouTube app, open a comment on your video, select More, then Add as moderator, and choose the role. Let the person know you’ve added them; YouTube doesn’t send that notification.</p>
	<p>The comment-moderator role doesn’t grant access to your channel in Studio. YouTube describes moderators as holding comments for the channel owner’s review. Anyone who needs Studio access requires a separate permissions decision. See <a href="https://support.google.com/youtube/answer/15535966?co=GENIE.Platform%3DDesktop&amp;hl=en" target="_blank" rel="noopener">YouTube’s moderator guide</a>.</p>

	<h3 id="audience-feedback" tabindex="-1">Use recurring questions as audience feedback</h3>
	<p>Keep a note of recurring questions during review. Several viewers struggling with the same explanation may give you a useful follow-up topic. That feedback still comes from people who chose to comment, so check other audience evidence before treating it as broad demand.</p>

	<h2 id="test-automation" tabindex="-1">Test automated moderation with comments from your channel</h2>
	<p>Before relying on automation, I’d compare its decisions with a small sample labeled according to my channel rules. The sample should include acceptable comments alongside spam and abuse.</p>
	<p>Include cases that need context: a viewer quoting a scam as a warning, a blunt correction, or an inside joke. For each case, record the action you want and the reason.</p>
	<p>Check both kinds of error. Look for acceptable comments the tool would hide, then look for harmful or deceptive comments it would leave visible. Keep examples private or anonymized if they contain personal information.</p>
	<p>Repeat that check after changing a filter or rule. Obvious spam is the tutorial level; include the awkward cases that need context in the preview too.</p>

	<h2 id="choose-a-tool" tabindex="-1">Decide whether another moderation tool fills a gap</h2>
	<p>YouTube Studio may cover the work your channel needs. Before connecting another service, I check which comments it can reach and what Google permissions it requests. I also want a clear route for uncertain cases and a record of completed actions.</p>
	<p>A tool that scans published comments may leave replies or YouTube’s Held queue for you to manage. Check its coverage against the work you want help with, along with its current price and retention terms.</p>
	<p>Moderaty scans published top-level comments on connected, active channels. It applies custom rules before AI scoring, sends uncertain cases and scoring failures to a review queue, and records completed actions.</p>
	<p>Its coverage excludes reply threads, live chat and a separate sweep of comments YouTube already holds. Moderaty doesn’t write replies under your name. A comment may remain visible until YouTube confirms a requested hold. Deleted comments cannot be restored. <a href="/#scope">Review Moderaty’s coverage and controls</a>.</p>
	<p>Start with a <a href="/#moderation-preview">moderation preview</a> and compare the proposed decisions with your rules before enabling actions. A preview can re-score comments from earlier moderation runs without changing them on YouTube. Check the comments it would keep as carefully as those it would remove.</p>

	<h2 id="frequently-asked-questions" tabindex="-1">Common YouTube comment moderation questions</h2>
	<h3>Does None turn off all moderation?</h3>
	<p>None controls the hold filter. Other controls, including hidden users and blocked-word settings, still need their own review. Don’t use the label as a shortcut for understanding the whole setup. See <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">YouTube’s comment settings</a>.</p>
	<h3>Why can’t I turn comments on for a video?</h3>
	<p>YouTube restricts comment settings in some situations. Comments are off on videos designated as made for kids, private videos don’t allow comments, and supervised accounts have restrictions. Check the video and account conditions in <a href="https://support.google.com/youtube/answer/9482556?hl=en" target="_blank" rel="noopener">YouTube’s settings instructions</a>.</p>
	<h3>Does this setup cover live chat?</h3>
	<p>Live chat has its own moderation workflow. Review those controls before a stream; some channel settings, such as blocked words, can affect comments and chat. <a href="https://support.google.com/youtube/answer/9826490?hl=en" target="_blank" rel="noopener">YouTube’s live chat moderation guide</a> covers the available tools.</p>

	<h2 id="first-check" tabindex="-1">A practical first check</h2>
	<p>Before adding another rule or service, my first check would be a sample of Held and Published comments. Note the useful contributions a filter caught and the unwanted comments it missed, then change one setting at a time.</p>

	<h2 id="about-the-author" tabindex="-1">About the author</h2>
	<p>{BLOG_AUTHOR.bio}</p>
</article>
