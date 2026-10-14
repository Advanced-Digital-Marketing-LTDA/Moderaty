<script lang="ts">
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import ArticleContents from '$lib/components/blogs/ArticleContents.svelte';
	import ArticleByline from '$lib/components/blogs/ArticleByline.svelte';
	import { BLOG_AUTHOR } from '$lib/blogs/author';
	import { HATE_COMMENTS, HATE_COMMENTS_EDITION, HATE_COMMENT_SECTIONS as sections } from '$lib/blogs/hate-comments';
	import { SPAM_COMMENTS } from '$lib/blogs/spam-comments';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<BlogMeta {...HATE_COMMENTS} origin={data.siteOrigin} article />

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol><li><a href="/">Home</a></li><li><a href="/blogs/">Blogs</a></li><li aria-current="page">Hate comments on YouTube</li></ol>
</nav>
<article class="blog-article">
	<h1>{HATE_COMMENTS.title}</h1>
	<ArticleByline authorHref="#about-the-author" {...HATE_COMMENTS_EDITION} />
	<ArticleContents headings={Object.values(sections)} />

	<h2 id={sections.summary.id} tabindex="-1">{sections.summary.title}</h2>
	<p>To deal with hate comments on YouTube, I match my response to what the commenter is doing, not to how much it stung. I keep useful criticism, reply when a clear answer helps other viewers, remove personal attacks that break my channel rules, hide repeat offenders from my channel, and report threats or doxxing to YouTube. When a comment gets under my skin, I close YouTube Studio for a bit. You decide what stays on your own channel.</p>

	<h2 id={sections.takeaways.id} tabindex="-1">{sections.takeaways.title}</h2>
	<ul aria-label="Key takeaways">
		<li><a href="#criticism-or-attack">A negative comment can still contain useful feedback.</a> Separate the point from the insult before you decide what to do.</li>
		<li><a href="#reply-to-negative-comments">Reply when you can answer a question, correct a mistake or clarify your video.</a> You owe a personal attack nothing.</li>
		<li><a href="#remove-or-hide">Let your channel rules decide when you remove or hide comments.</a> Report threats, doxxing and serious harassment to YouTube.</li>
		<li><a href="#reduce-hate-comments">YouTube filters and review queues can reduce what you have to read</a>, but check what they hold before you approve or reject it.</li>
	</ul>

	<h2 id={sections.action.id} tabindex="-1">{sections.action.title}</h2>
	<p>Here is the cheat sheet I use. These fictional examples show the difference between common moderation choices. They are not quotes from real viewers. I often combine actions, and I report a serious threat right away without replying or warning the person first.</p>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll this named table region.) -->
	<div class="table-scroll" role="region" aria-labelledby="actions-caption" tabindex="0">
		<table>
			<caption id="actions-caption">Actions for hate comments</caption>
			<thead><tr><th scope="col">What you see</th><th scope="col">Possible action</th><th scope="col">Why</th></tr></thead>
			<tbody>
				<tr><th scope="row">“This video was boring.”</th><td>Leave it alone.</td><td>A negative opinion needs no reply if it fits your channel rules.</td></tr>
				<tr><th scope="row">“The total at 4:12 leaves out shipping.”</th><td>Check and reply if useful.</td><td>Acknowledge a valid correction and update the video or description.</td></tr>
				<tr><th scope="row">“You are an idiot.”</th><td>Remove the comment if it breaks your rules.</td><td>You can keep any useful feedback without leaving a personal attack up.</td></tr>
				<tr><th scope="row">One account repeatedly targets you or viewers.</th><td>Hide the commenter from your channel.</td><td>Hiding sets a broader boundary than removing one comment.</td></tr>
				<tr><th scope="row">A threat or someone sharing your private address.</th><td>Save evidence, report it and consider hiding the person.</td><td>Get help outside YouTube if you feel unsafe.</td></tr>
			</tbody>
		</table>
	</div>

	<h2 id={sections.criticism.id} tabindex="-1">{sections.criticism.title}</h2>
	<p>Criticism gives you something specific to check; a personal attack targets you. “The music makes your voice hard to hear” is an audio bug report. “Your voice is disgusting” is someone having a bad day at my expense. On YouTube, “hate comment” covers both, plus everything in between, so I ask one question first: can I verify anything in this comment?</p>
	<p>Some comments come as a combo meal. A viewer spots a wrong price and adds an insult on the side. That is the Ackchyually Guy with extra salt, and he is sometimes right. I verify the price, fix it if needed, then apply my rule to the insult. Removing his comment does not stop me from correcting the video.</p>
	<p>A hurtful comment does not automatically break YouTube policy. YouTube’s <a href="https://support.google.com/youtube/answer/2802268?hl=en" target="_blank" rel="noopener">harassment and cyberbullying policy</a> covers conduct such as threats, doxxing and certain targeted abuse. Your channel can still remove behavior that breaks its own rules. Your comment section, your house rules.</p>
	<p>For a borderline case, I ask whether I would make the same call if the person agreed with me. I hold fans and critics to the same standard, including the people who call me based. When someone helps me moderate, I give them examples of comments I keep and comments I remove, so we bonk consistently.</p>

	<h2 id={sections.reply.id} tabindex="-1">{sections.reply.title}</h2>
	<p>Reply to a hate comment only when you have a useful answer, correction or clarification. Other viewers probably share the question, so my short reply helps them even if the original commenter stays mad online.</p>
	<p>For a shipping-cost correction, I might write: “You’re right. I left shipping out of that total. I’ve added the full cost to the description.” I post a reply like that only after I check the claim and make the fix.</p>
	<p>If someone misunderstood my point, I explain it once and link the timestamp. If they come back with another personal attack, I end the exchange and let my moderation rules handle it. And if all I have is a sick comeback, I skip the reply, because the ratio costs more than it pays.</p>
	<p>If a comment upsets me, I step away before answering. A moderation decision can wait until I have some distance, unless someone has made a threat or shared private information that needs attention now.</p>

	<h2 id={sections.remove.id} tabindex="-1">{sections.remove.title}</h2>
	<p>To remove a published comment, open it in YouTube Studio and choose Remove from its menu. The <a href="https://support.google.com/youtube/answer/15535966?hl=en&amp;co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener">YouTube moderation guide</a> walks through each comment action.</p>
	<p>For the regulars who keep coming back, I open a comment&#x27;s menu on YouTube and choose Hide from channel, which hides that commenter across my whole channel. YouTube says it does not notify hidden users, and their past comments disappear from your Studio comments page, so they keep yelling into the void. Read <a href="https://support.google.com/youtube/answer/9482361?hl=en" target="_blank" rel="noopener">YouTube&#x27;s instructions for hiding a user</a> before you use it.</p>
	<h3 id="report-harassment" tabindex="-1">Report abuse and save the evidence</h3>
	<p>I <a href="https://support.google.com/youtube/answer/2802027?hl=en&amp;co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener">report a comment</a> when it violates YouTube&#x27;s policies. A report asks YouTube to review the comment; it does not guarantee removal. For personal information, you can also use YouTube&#x27;s <a href="https://support.google.com/youtube/answer/142443" target="_blank" rel="noopener">privacy complaint process</a>.</p>
	<p>If a comment contains a specific threat or private information, I save a screenshot and the available link before I remove it, and I record the date and account name somewhere private. Do not repost someone’s private details or ask viewers to confront them.</p>
	<p>If someone makes a specific threat and you feel unsafe, YouTube advises <a href="https://support.google.com/youtube/answer/2802268?hl=en" target="_blank" rel="noopener">contacting local law enforcement</a>.</p>
	<p>If you are in immediate danger, contact local emergency services.</p>

	<h2 id={sections.reduce.id} tabindex="-1">{sections.reduce.title}</h2>
	<p>YouTube’s <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">comment settings</a> let you hold potentially inappropriate comments for review, use stricter filters, hold all comments, or turn comments off for a video. Held comments stay hidden until you approve them, and YouTube keeps them for review for up to 60 days. I check my queue before that window closes, because I don’t want a good comment to expire in comment jail.</p>
	<p>YouTube is also <a href="https://blog.youtube/news-and-events/made-on-youtube-new-tools-power-creation-journey/" target="_blank" rel="noopener">testing opt-in AI comment moderation</a> that learns a channel&#x27;s moderation style. Check whether your channel has it before you rely on it.</p>
	<p>I keep blocked-word rules narrow. Blocking a word such as “wrong” could hide a correction I want to see. After I change a filter, I check whether it held legitimate comments and adjust the rule if it went full friendly fire.</p>
	<p>For an existing video, I review its comment controls in YouTube Studio. The <a href="https://support.google.com/youtube/answer/9482556?hl=en" target="_blank" rel="noopener">YouTube settings instructions</a> explain how to update one video and your channel defaults. Changing defaults affects new uploads only, so update existing videos one by one.</p>
	<p>I set a review window I can stop at. When I catch myself rereading the same insult, I close the thread and step away from YouTube Studio for a while. You can also ask someone you trust to pass on useful feedback without repeating the abusive wording.</p>
	<p>Spam is a different problem from hate. For crypto bots, fake giveaways and impersonators, see my guide on <a href={SPAM_COMMENTS.path}>how to stop spam and scam comments on YouTube</a>.</p>
	<h3 id="channel-rules" tabindex="-1">Apply your channel rules consistently</h3>
	<p>A short channel policy helps me act the same way every time. For example: “Disagreement and corrections are welcome. Keep replies about the video or the point being discussed. We remove personal attacks, threats and private information. Repeated abuse may lead us to hide your account from the channel.”</p>
	<p>I base moderation decisions on my channel rules and my safety. Don’t leave abuse up for an assumed boost in reach: a comment count alone cannot tell you what removing a comment will do to recommendations.</p>

	<h2 id={sections.preview.id} tabindex="-1">{sections.preview.title}</h2>
	<p>YouTube&#x27;s built-in controls may be all you need, and if they are, great. If you want automated comment decisions, I built <a href="/">Moderaty</a> for that job. Moderaty is a YouTube comment moderation tool that applies your rules first, uses AI scoring for the remaining published top-level comments, and sends uncertain decisions to a human review queue.</p>
	<p>Use <a href="/#moderation-preview">Moderaty&#x27;s free moderation dry run</a> to preview decisions without changing comments. Live moderation may start when you connect a channel, depending on your plan and settings; the preview does not pause it. Review the preview for mistakes, including criticism it would remove or abuse it would leave up, and check that it includes the cases that matter to your channel. Deleted comments cannot be restored, and Moderaty cannot lift an author ban.</p>
	<p>Before you turn on automatic actions, confirm which comment types and history window the tool covers. Keep reviewing replies and YouTube&#x27;s own Held queue until you have confirmed coverage, and test the setup against examples you want to keep and examples you want to remove.</p>

	<h2 id={sections.faq.id} tabindex="-1">{sections.faq.title}</h2>
	<h3>Is every negative YouTube comment hate?</h3>
	<p>No. A comment can be negative and still contain useful criticism. I check whether it points to something I can verify, then separate that point from any personal attack.</p>
	<h3>Will a commenter know if I hide them from my channel?</h3>
	<p>No. YouTube says it does not notify a user when you hide them, and their past comments stop appearing on your Studio comments page. Read the current <a href="https://support.google.com/youtube/answer/9482361?hl=en" target="_blank" rel="noopener">hide-user instructions</a> before you choose this channel-wide action.</p>
	<h3>How long do held YouTube comments stay in review?</h3>
	<p>YouTube keeps held comments in the review queue for up to 60 days. I check my queue before that period ends. The <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener">comment settings guide</a> explains the review controls.</p>
	<h3>Should I reply to someone who is insulting me?</h3>
	<p>Only if you can add something useful, such as a factual correction or a clear answer. You can remove or report abuse under your rules without debating the commenter. Not every troll deserves a main-character moment.</p>

	<h2 id={sections.author.id} tabindex="-1">{sections.author.title}</h2>
	<p>{BLOG_AUTHOR.bio}</p>
</article>
