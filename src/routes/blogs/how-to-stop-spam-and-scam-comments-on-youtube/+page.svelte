<script lang="ts">
	import BlogMeta from '$lib/components/blogs/BlogMeta.svelte';
	import ArticleContents from '$lib/components/blogs/ArticleContents.svelte';
	import { BLOG_AUTHOR } from '$lib/blogs/author';
	import { HATE_COMMENTS } from '$lib/blogs/hate-comments';
	import { SPAM_COMMENTS, SPAM_COMMENT_SECTIONS, SPAM_RULE_EXAMPLES } from '$lib/blogs/spam-comments';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const impersonationPolicy = 'https://support.google.com/youtube/answer/2801947?hl=en';
	const spamPolicy = 'https://support.google.com/youtube/answer/2801973?hl=en';
</script>

<BlogMeta {...SPAM_COMMENTS} origin={data.siteOrigin} article />

<nav class="breadcrumbs" aria-label="Breadcrumb">
	<ol><li><a href="/">Home</a></li><li><a href="/blogs/">Blogs</a></li><li aria-current="page">Spam and scam comments</li></ol>
</nav>
<article class="blog-article">
	<h1>{SPAM_COMMENTS.title}</h1>
	<p class="byline">By <a href="#author">{BLOG_AUTHOR.name}</a></p>
	<p>Every channel eventually meets the Crypto Bot: “I made $8,412 in 3 days thanks to…” No you didn’t, Chad. To stop spam and scam comments on my YouTube channel, I start with YouTube’s comment filters and review queue. I hold links and recurring scam phrases, remove deceptive comments, and report impersonators. Then I add narrow custom rules for the patterns that keep coming back, and check the matches for legitimate comments before I reach for the hammer.</p>
	<section aria-labelledby="takeaways">
		<h2 id="takeaways">Key Takeaways</h2>
		<ul>
			<li>Use native controls first. Check both Published and Held comments, including replies.</li>
			<li>A familiar avatar, repeated message, link, or phone number needs context. None proves a scam on its own.</li>
			<li>Start pattern rules with hold for review. Test warnings and useful links alongside suspicious examples.</li>
			<li>Report impersonation to YouTube and tell viewers which account and contact routes you use.</li>
		</ul>
	</section>
	<ArticleContents headings={SPAM_COMMENT_SECTIONS} />

	<h2 id="native-controls" tabindex="-1">Start with YouTube’s comment controls</h2>
	<p>My first stop is YouTube Studio: I choose Community and review both Published and Held. <a href="https://support.google.com/youtube/answer/9482367?hl=en&co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener noreferrer">YouTube’s review guide</a> explains these tabs. I inspect the replies under my own comments too, because a deceptive reply can look like it is part of my conversation. That is exactly where the fake “giveaway admin” likes to lurk.</p>
	<p><a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener noreferrer">YouTube offers Basic, Strict, and Hold all moderation.</a> Basic holds potentially inappropriate comments; Strict holds a broader range; Hold all requires approval before comments appear. Whichever one I pick, I review what the filters catch.</p>
	<ol>
		<li>For an existing video, open Content, select the video, then Show more. Adjust Comments and ratings and save. <a href="https://support.google.com/youtube/answer/9482556?hl=en&co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener noreferrer">Upload defaults apply to new videos and posts</a>; they do not update your older uploads.</li>
		<li>Open Settings, Community moderation, then Content controls. Turn on Link text to hold comments with hashtags and URLs. Add specific recurring phrases to Blocked words and save. Follow the current <a href="https://support.google.com/youtube/answer/16622701?hl=en&co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener noreferrer">channel moderation settings instructions</a>.</li>
		<li>Review the Held tab and approve legitimate comments. <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener noreferrer">YouTube keeps held comments for up to 60 days.</a> Approved users bypass word and link filters; your own comments and moderators’ comments also bypass link blocking.</li>
	</ol>
	<p>When a bot swarm shows up faster than I can review, I pause comments on that video. Existing comments remain; YouTube stops new ones until I turn comments back on. I run <a href="#false-positives">false-positive checks</a> as I tighten the settings, so the real viewers don’t catch a stray bonk.</p>

	<h2 id="impersonation" tabindex="-1">Check creator impersonation comments</h2>
	<p>Somebody with my profile picture and a handle like “Andrew Weilbacher ✓ Official” is not me. When a message claims to be me or my team, I check the account behind it and compare its handle and channel URL with my real account. A copied photo or similar display name is not enough to establish identity. YouTube’s <a href={impersonationPolicy} target="_blank" rel="noopener noreferrer">impersonation policy</a> covers deceptive copying and comments that falsely suggest another person or entity wrote them.</p>
	<p>A prize message asking a viewer to pay a fee or move to a messaging app gets reviewed, every time. I save the comment and account links somewhere private, then follow the <a href="#reporting">reporting steps</a>. I don’t open the linked destination to investigate; curiosity is how you get pwned.</p>
	<p>I recommend publishing a short notice from your own account describing your real contact routes and giveaway process. For example, if it reflects your practice: “I do not ask winners to pay a delivery fee in comments. Check the channel handle before replying.” Keep the notice accurate for your channel, and don’t repeat the impersonator’s contact details. No free advertising for the scammer.</p>

	<h2 id="repeated-comments" tabindex="-1">Review repeated and copied messages</h2>
	<p>I compare the message with the video and the nearby discussion. Repeated praise can come from real viewers (hi, mom); repeated off-topic promotion or “sub4sub?” under every upload needs a different decision. <a href={spamPolicy} target="_blank" rel="noopener noreferrer">YouTube’s spam policy</a> covers high-volume repetitive or deceptive comments used to drive traffic or engagement, including sub-for-sub schemes.</p>
	<p>I search Studio for a distinctive phrase and inspect the results. If I find the same unwanted solicitation across several videos, I remove the comments and consider hiding that account. <a href="https://support.google.com/youtube/answer/9482361?hl=en" target="_blank" rel="noopener noreferrer">Hide from channel applies across your channel.</a> I check the account before acting; similar text alone does not prove that two viewers are the same person.</p>
	<p>A custom keyword rule can hold a recurring phrase. It matches the text of each comment; it does not count how often someone posted or detect duplicate campaigns. I keep a useful correction even if ten viewers point it out. If ten people noticed, I probably deserved it. For insults or criticism, see my separate guide to <a href={HATE_COMMENTS.path}>dealing with hate comments on YouTube</a>.</p>

	<h2 id="suspicious-links" tabindex="-1">Hold suspicious links for review</h2>
	<p>I turn on YouTube’s link-hold control before I even think about building a long list of domains. I judge a held comment from its wording and relevance without visiting the destination. A request for passwords, payment, or off-platform prize collection gives you a reason to investigate and report; a source link that supports a correction may be useful.</p>
	<p>The invented URL <code>https://example.invalid/prize</code> below is a non-working example. I never post real scam links in a public warning, and you shouldn’t either. A text rule that matches <code>https?://</code> can find that marker, but it cannot establish whether a website is safe or catch every way someone might refer to a destination.</p>
	<p>I review the useful links my filters hold, such as a viewer’s source for a factual correction. If a rule keeps catching the discussion I want, I remove or narrow it.</p>

	<h2 id="phone-number-patterns" tabindex="-1">Check phone-number requests in context</h2>
	<p>I read the number together with the request. “Congrats, you were selected by Andrew! Message me on Telegram” is a scam wearing my face, and it needs scrutiny. A viewer discussing a public support number or quoting a scam warning may have a legitimate reason to include digits.</p>
	<p>The example rule below looks for “WhatsApp” or “Telegram” followed by a number in a limited format. It holds matching text for a person to review. It cannot verify the account’s identity, and it will miss other wording and formats. The number in the example is fictional; none of these examples comes from a real viewer.</p>
	<p>My advice: write a rule for a recurring pattern you have actually observed on your channel. Don’t block all numbers. Timestamps, prices, and technical details are part of ordinary discussion, and “4:12” is not a crime.</p>

	<h2 id="reporting" tabindex="-1">Report scams and impersonation</h2>
	<ol>
		<li>Save the comment link, the account’s channel URL, and a dated screenshot privately before clearing the comment. Redact personal details if you share evidence with someone helping you moderate.</li>
		<li>On YouTube, open the comment’s three-dot menu, select Report, choose the reason that fits, and submit. You can also use Report spam or abuse in Studio. <a href="https://support.google.com/youtube/answer/2802027?hl=en&co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener noreferrer">YouTube reviews reports; reporting does not guarantee removal.</a></li>
		<li>For an impersonating account, open its channel description, select …more, then Report user and follow the prompts. Use the <a href={impersonationPolicy} target="_blank" rel="noopener noreferrer">impersonation reporting route</a> as well as reporting the deceptive comment.</li>
		<li>Remove the comment or hide the account when you need to protect your channel. Hiding and reporting have different scopes; you can do both. Do not ask your audience to confront the account.</li>
	</ol>
	<p>YouTube’s <a href="https://support.google.com/youtube/answer/15535966?hl=en&co=GENIE.Platform%3DDesktop" target="_blank" rel="noopener noreferrer">moderation guide</a> distinguishes removing a comment, reporting spam or abuse, and hiding a user. I would still use those native reporting controls even if another tool handles your routine holds.</p>

	<h2 id="custom-rules" tabindex="-1">Test custom moderation rules</h2>
	<p>I start every new rule on hold for review, so I can inspect matches before making an irreversible choice. These invented examples were tested against Moderaty’s source rule matcher. They illustrate text matching, not scam-detection accuracy or results on a live channel.</p>
	<!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to scroll this named table region.) -->
	<div class="table-scroll" role="region" aria-labelledby="rules-caption" tabindex="0">
		<table>
			<caption id="rules-caption">Synthetic hold rules and their limitations</caption>
			<thead><tr><th scope="col">Rule type and pattern</th><th scope="col">Matching example</th><th scope="col">Review limit</th></tr></thead>
			<tbody>
				{#each SPAM_RULE_EXAMPLES as rule (rule.id)}
					<tr><th scope="row">{rule.purpose}<br /><code>{rule.type}: {rule.pattern}</code><br />Action: hold</th><td>{rule.example}</td><td>{rule.limitation}</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p>In Moderaty, keyword rules match a phrase without regard to case; regex rules match a text pattern. A blocked-user rule takes the author’s channel ID, not a display name. <a href="https://github.com/Bonobo791/Moderaty/blob/main/src/lib/server/rules.ts" target="_blank" rel="noopener noreferrer">The source matcher</a> validates regex patterns and chooses longer patterns first. An overlapping rule can therefore determine the action, so I review my existing rules before adding one.</p>
	<p>Protected handles skip rules and AI scoring. I confirm an account before protecting it. For other retrieved comments, Moderaty applies matching rules before AI scoring. Its <a href="https://github.com/Bonobo791/Moderaty/blob/main/src/lib/server/moderation.ts" target="_blank" rel="noopener noreferrer">toxicity scoring</a> does not establish that an account is genuine or that a link is safe.</p>

	<h2 id="false-positives" tabindex="-1">Protect legitimate comments</h2>
	<p>I test each pattern with comments I want to keep as well as comments I want to hold: a warning that quotes the scam phrase, a useful source URL, and an ordinary question. The following invented cases show why a match needs a human, not just a regex with main-character energy.</p>
	<ul>
		<li>“They asked me to pay a delivery fee. Is that a scam?” matches the fee phrase while warning you about it.</li>
		<li>“The source is https://example.invalid/reference” matches the link marker without establishing harmful intent.</li>
		<li>“The calculation at 4:12 should use 2026 prices” contains numbers but does not match the phone example.</li>
		<li>“Send a message to collect your prize” misses these rules. A non-match gives you no assurance that a comment is safe.</li>
	</ul>
	<p>I check the Held queue after changing native filters. <a href="https://support.google.com/youtube/answer/9483359?hl=en" target="_blank" rel="noopener noreferrer">YouTube acknowledges that its filters can make mistakes.</a> I approve legitimate comments and narrow phrases that keep catching useful discussion.</p>
	<p>I check Moderaty’s action status as well as its review queue. A pending decision can remain public until the YouTube hold succeeds. <a href="/terms#s9">Held and rejected comments can be restored from Moderaty’s audit log.</a> Deletions are permanent, and you cannot lift an author ban in Moderaty.</p>

	<h2 id="preview-rules" tabindex="-1">Check the channel preview before broader use</h2>
	<p>Moderaty’s source implementation retrieves published top-level comments. It does not sweep replies or YouTube’s Held queue. Access, quota, pagination, and failures affect coverage, so I keep using Studio to inspect those areas. These limits come from the <a href="https://github.com/Bonobo791/Moderaty/blob/main/src/lib/server/youtube.ts" target="_blank" rel="noopener noreferrer">current retrieval source</a>; this guide does not verify a hosted channel run.</p>
	<p>If you want to take it for a spin, <a href="/login">sign in to Moderaty</a>, connect a channel you own or are authorized to manage, and open its Rules tab. Saving a rule adds it to active moderation, so I’d begin with a hold action. The channel page’s Dry run control previews a selected history window without changing comments on YouTube. It is not a preview of an unsaved rule.</p>
	<p>You get one free moderation dry-run attempt per channel, used when it starts even if it fails. It spends no credits. I’d inspect the audit log and any partial-run status before relying on the results. This differs from the feedback preview, which covers one page of up to 100 comments. <a href="https://github.com/Bonobo791/Moderaty/blob/main/src/routes/(app)/channels/%5Bid%5D/%2Bpage.svelte" target="_blank" rel="noopener noreferrer">The channel-page source</a> documents the moderation preview controls.</p>
	<p>Channel connection requests Google’s <code>youtube.force-ssl</code> permission with offline access. This scope is broader than comment access alone, and I’d rather tell you that up front. Check the consent screen and <a href="/privacy">Moderaty’s privacy information</a> before granting access. You can revoke it through <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">Google’s third-party access settings</a>.</p>
	<p>At the October 8, 2026 pricing check, hosted Moderaty costs US$5 per month for 100 AI classifications shared between moderation and enabled feedback digests. A digest classification can use an additional credit for the same comment. Rule and protected-handle moderation decisions use no credit. Self-hosting has separate infrastructure and OpenAI costs; the US$49 lifetime offer also uses your own OpenAI key and is limited to 1,000 lifetime places. Check <a href="/pricing">current plans and pricing</a> before purchasing, since they can change.</p>

	<h2 id="faq" tabindex="-1">Frequently asked questions</h2>
	<h3>Can I stop all spam comments?</h3>
	<p>No filter can guarantee that, and anyone who promises otherwise is selling something (probably crypto). I combine native holds, review, and reporting, and I check for missed comments as well as legitimate ones a filter caught.</p>
	<h3>Does a phone number or Telegram mention prove a scam?</h3>
	<p>No. I check the account and the request. A rule match tells me which text matched; a person still needs to assess the comment.</p>
	<h3>Should I delete repeated comments?</h3>
	<p>I read their context first. Repeated corrections or questions may be useful. I apply my channel rules to repetitive promotion and report conduct that violates YouTube’s policy.</p>
	<h3>Does Moderaty replace YouTube’s spam review?</h3>
	<p>No, and I don’t want it to pretend otherwise. I keep reviewing replies and Held comments in Studio and report impersonators there. Moderaty’s source-confirmed retrieval and text rules have the limits described above.</p>

	<section id="author" aria-labelledby="author-heading">
		<h2 id="author-heading">About the author</h2>
		<p>{BLOG_AUTHOR.bio}</p>
	</section>
</article>

<style>
	.byline { font-size: 15px; color: var(--text-2); }
	code { white-space: normal; overflow-wrap: anywhere; font-size: 0.85em; }
	ul, ol { padding-left: 24px; margin-bottom: 24px; }
	li { margin-bottom: 12px; }
	h3 { margin: 28px 0 12px; font-size: 22px; line-height: 1.4; }
</style>
