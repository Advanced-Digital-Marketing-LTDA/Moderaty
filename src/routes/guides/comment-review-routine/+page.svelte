<script lang="ts">
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import ArticleByline from '$lib/components/blogs/ArticleByline.svelte';
	import ArticleContents from '$lib/components/blogs/ArticleContents.svelte';
	import { BLOG_AUTHOR } from '$lib/blogs/author';
	import { COMMENT_REVIEW_ROUTINE, COMMENT_REVIEW_ROUTINE_EDITION, COMMENT_REVIEW_ROUTINE_SECTIONS } from '$lib/blogs/comment-review-routine';
	import { MODERATION_GUIDE } from '$lib/blogs/moderation-guide';
	import { COMMENT_SETTINGS_GUIDE } from '$lib/blogs/comment-settings-guide';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<BlogMeta {...COMMENT_REVIEW_ROUTINE} origin={data.siteOrigin} article />

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol><li><a href="/">Home</a></li><li><a href="/guides/">Guides</a></li><li aria-current="page">YouTube comment review routine</li></ol>
</nav>
<article class="blog-article">
	<h1>{COMMENT_REVIEW_ROUTINE.title}</h1>
	<ArticleByline authorHref="#about-the-author" {...COMMENT_REVIEW_ROUTINE_EDITION} />

	<p>You open your channel's comments to check one reply. Forty minutes later you are still scrolling, and the held queue has grown again. If that sounds like your evenings, run one fixed session in the same order each time, 15 minutes or whatever length fits your channel, and stop when the timer rings.</p>
	<ArticleContents headings={COMMENT_REVIEW_ROUTINE_SECTIONS} />

	<h2 id="why-a-timer" tabindex="-1">Why a timer beats scrolling comments all day</h2>
	<p>Checking whenever you have a spare minute feels harmless. Each visit reopens the same small decisions: answer or ignore, approve or leave, report or wait. Nothing tells you when you're done, so the review spreads into the rest of your evening.</p>
	<p>Picture two Tuesdays on the same channel. On the first, you check comments between dinner and bed, answer three people, and forget the held queue. At midnight you realize spam has been sitting under your newest video since lunch. On the second, you start a timer at 7:30, clear the held comments, skim what went public, and call it a night at 7:45. That Tuesday ends with a short follow-up list and a clear evening.</p>
	<p>A timer gives the session a starting point and a stop. Fifteen minutes is an example you can change. A quiet week can fit in ten minutes, and a launch week can take thirty. The routine does not promise to save you any set amount of time. It gives every session the same ground to cover, so the minutes go to the comments themselves.</p>

	<h2 id="set-filters-once" tabindex="-1">Before the timer starts: set the filters once</h2>
	<p>Open the comment settings in YouTube Studio and set three controls. You only do this once, then leave them alone until your rules change. If you want the wider picture first, read the <a href={MODERATION_GUIDE.path}>guide to YouTube comment moderation</a> or the <a href={COMMENT_SETTINGS_GUIDE.path}>guide to YouTube's comment settings</a>.</p>
	<p>Start with blocked words. <a href="https://support.google.com/youtube/answer/16622701?hl=en" target="_blank" rel="noopener">Add words and phrases separated by commas</a>, and any comment that contains one waits in the <a href="https://support.google.com/youtube/answer/58123?hl=en" target="_blank" rel="noopener">held queue</a> until you approve it. Pick the phrases you see again and again, such as the Crypto Bot's favorite offer or a fake giveaway. My advice: keep the list short enough that you still remember why each word is on it.</p>
	<p>Next, turn on holding for comments with <a href="https://support.google.com/youtube/answer/16622701?hl=en" target="_blank" rel="noopener">hashtags and URLs</a>. A spam comment with a link to a “free gift card” page then waits for you instead of sitting under your video.</p>
	<p>Last, decide who can comment. You can <a href="https://support.google.com/youtube/answer/58123?hl=en" target="_blank" rel="noopener">limit comments to subscribers and paid members</a>, so viewers who are not subscribers or paid members can't post while it's on. A channel that wants every new question can leave it off. A channel that gets a flood of brand-new accounts can switch it on for a while. Once those three are on, you start each session with the link, hashtag and blocked-word spam already set aside.</p>

	<h2 id="held-first" tabindex="-1">Minutes 0 to 5: clear the Held for review tab</h2>
	<p>Start here, because these comments stay off the public page until you act. I read each one before I decide. A comment asking which lens you used, with no link, is an easy approve. A comment with three links and an invitation to message someone privately gets <a href="https://support.google.com/youtube/answer/9482362?hl=en" target="_blank" rel="noopener">reported as spam</a>.</p>
	<p><a href="https://support.google.com/youtube/answer/58123?hl=en" target="_blank" rel="noopener">Held comments stay in Studio for up to 60 days</a>, and the public can't see them unless you approve them. The <a href="https://support.google.com/youtube/answer/58123?hl=en" target="_blank" rel="noopener">hold settings use AI</a>, and that AI can get it wrong. A real question can land in the queue, so read every held comment, including the ones that look like spam.</p>
	<p>Give this block five minutes. Approve the real questions now, and answer them in the next block. Anything you don't reach stays held, so keep the backlog short.</p>

	<h2 id="skim-published" tabindex="-1">Minutes 5 to 10: skim what already went public</h2>
	<p>Choose your fighter. Every published comment gets one of four moves: answer, fix, leave or remove.</p>
	<p>Answer a question you can settle in a sentence. A viewer asks which camera you used, so you name it and move on.</p>
	<p>Fix a comment that finds a real mistake. The Ackchyually Guy turns up under your latest upload. He corrects your timestamp and adds a jab about your mic on the side. He is right about the timestamp, so you fix it, and then you apply your rule to the jab.</p>
	<p>Leave a take you disagree with. The Edge Lord calls your thumbnail “mid” in all caps. It is an opinion, so it stays up, and you move on.</p>
	<p>Remove spam, scams and abuse. I check each one first. The Crypto Bot posts the same offer under six of your videos. Trolls get the hammer.</p>
	<p>The Brigadier brings twenty friends. Twenty near-identical hostile comments land within minutes, all from accounts made this week. Each one goes to the remove move, and the limit on who can comment, from the setup section, is the setting for a flood like that.</p>

	<h2 id="turn-trolls-into-rules" tabindex="-1">Minutes 10 to 15: turn today's trolls into tomorrow's rules</h2>
	<p>Use the last five minutes to look back at what you held, approved and removed. Any phrase that showed up twice goes on your blocked words list, separated by commas. Test it against a few real comments first. A phrase like “send me” could catch a viewer who asks you to send a recipe, and a blocked word holds that comment too.</p>
	<p>When the Crypto Bot swaps one letter in its offer, the new spelling earns an entry of its own. Patterns that aren't a single phrase, such as a link shape or the same opening line, go in a notes file for your next session. A note can read: long link in the reply, same typo in every post, all from accounts made this week. Skip common words for the same reason. A blocked word holds every comment that contains it, so “love” would catch your fans along with the bots. Each entry is one less decision when you sit down again.</p>

	<h2 id="when-more-than-routine" tabindex="-1">When a comment needs more than the routine</h2>
	<p>Stop the timer for any comment that threatens someone, exposes a person's private details, or refers to self-harm. Handle that comment on its own before you return to the queue.</p>
	<p>For a threat or a doxxing post, save a copy of the comment and the link to it. Write down the video and the time, so you can find it again. If someone is in immediate danger, contact your local emergency number first. For a comment that refers to self-harm, check whether the person is safe if you can, and point them to local crisis support.</p>

	<h2 id="what-the-routine-cannot-see" tabindex="-1">What the routine can't see</h2>
	<p><a href="https://support.google.com/youtube/answer/58123?hl=en" target="_blank" rel="noopener">Comments from hidden users don't show in YouTube Studio</a>, so no session will surface them.</p>
	<p>Links from you, your moderators and your approved users aren't blocked, so check a moderator's link yourself. Ask your moderators to flag any link they aren't sure about, so a link doesn't slip through on trust alone.</p>
	<p>I'd say it plainly: no filter catches everything. Spam gets through, and real comments get held. Plan for both by keeping time in every session for held comments and the published list.</p>

	<h2 id="hand-part-to-a-tool" tabindex="-1">When to hand part of the routine to a tool</h2>
	<p>If you want a tool for the repeat work, start with <a href="/how-it-works/">how Moderaty fits your routine</a>. Moderaty covers published top-level comments on connected, active YouTube channels, and those comments are eligible for screening and automatic moderation actions. Protected handles bypass rules and AI.</p>
	<p>Picture a busy Sunday with the same crypto offer under every upload. Uncertain results and scoring failures go to a review queue, and you make the call on those.</p>
	<p>Replies, live chat and YouTube's own Held or spam queues are <a href="/how-it-works/">outside its scope</a>, so the Held for review step stays with you. Requested holds wait for YouTube's confirmation. Deletions are permanent, and a ban can't be lifted inside Moderaty.</p>
	<p><a href="/pricing">Moderaty's pricing page</a> lists the hosted plan at $5 a month, and the monthly allowance is 100 AI classifications shared across moderation and enabled digests. That means $5 does not buy unlimited AI. Extra credits cost $20.40 for 500 or $64.65 for 2,000, and automatic top-up is off by default. Lifetime hosting costs $49 once, limited to 1,000 places, and you bring and pay for your own OpenAI key separately. Self-hosting costs nothing from Moderaty under PolyForm Shield 1.0.0, but infrastructure and OpenAI usage cost extra.</p>
	<p>Access uses the youtube.force-ssl permission, and you can revoke it in your Google account settings.</p>
	<p>Your next session starts with the Held for review tab. Set a timer, work the three blocks in order, and end when the time is up.</p>

	<h2 id="about-the-author" tabindex="-1">About the author</h2>
	<p>{BLOG_AUTHOR.bio}</p>
</article>
