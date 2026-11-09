import type { FaqEntry } from '$lib/landing/faq';

export const YOUTUBE_MONEY_CALCULATOR = {
	path: '/tools/youtube-money-calculator/',
	title: 'YouTube Money Calculator',
	description:
		'Free YouTube money calculator. Enter your monthly views and Studio RPM to see daily, monthly and yearly earnings and the views you need for an income goal.'
} as const;

export const YOUTUBE_MONEY_EDITION = { updated: '2026-11-09' } as const;

export const YOUTUBE_MONEY_SECTIONS = [
	{ id: 'how-it-works', title: 'How the calculator works' },
	{ id: 'cpm-vs-rpm', title: 'CPM vs RPM' },
	{ id: 'revenue-share', title: 'Who keeps what' },
	{ id: 'shorts-revenue', title: 'How Shorts revenue is calculated' },
	{ id: 'niche-cpm', title: 'Niche CPM ranges' },
	{ id: 'partner-program', title: 'Who can earn: the YouTube Partner Program' },
	{ id: 'faq', title: 'Frequently asked questions' },
	{ id: 'comments', title: 'What is in the comments under those views' }
] as const;

export const YOUTUBE_MONEY_SOURCES = {
	adRevenueAnalytics: { label: 'YouTube Help: Understand ad revenue analytics', href: 'https://support.google.com/youtube/answer/9314357' },
	partnerEarnings: { label: 'YouTube Help: Partner earnings', href: 'https://support.google.com/youtube/answer/72902' },
	shortsMonetization: { label: 'YouTube Help: Shorts monetization policies', href: 'https://support.google.com/youtube/answer/12504220' },
	programChanges: { label: 'YouTube Help: Changes to the YouTube Partner Program', href: 'https://support.google.com/youtube/answer/12843009' },
	programBlog: {
		label: 'YouTube Blog: New opportunities to earn and changes to the YouTube Partner Program',
		href: 'https://blog.youtube/news-and-events/youtube-partner-program-updates-2027-new-opportunities-earn/'
	},
	cpmBenchmarks: { label: 'OutlierKit: YouTube RPM benchmarks (figures are CPM)', href: 'https://outlierkit.com/resources/youtube-rpm-benchmarks/' }
} as const;

// CPM is an advertiser-side figure (cost per 1,000 ad impressions), not a creator RPM. Keep the label on every use.
export const NICHE_CPM_NOTE = 'CPM ranges, not RPM. Source: OutlierKit, published 2026-08-19, citing Virlo (modified 2026-07-23).';

export const NICHE_CPM_ROWS = [
	{ niche: 'Investing and stock market', cpmLow: 20, cpmHigh: 40 },
	{ niche: 'Personal finance', cpmLow: 15, cpmHigh: 25 },
	{ niche: 'Real estate', cpmLow: 15, cpmHigh: 30 },
	{ niche: 'Technology reviews', cpmLow: 10, cpmHigh: 18 },
	{ niche: 'Beauty and makeup', cpmLow: 4, cpmHigh: 9 },
	{ niche: 'Gaming', cpmLow: 3, cpmHigh: 6 }
] as const;

export const YOUTUBE_MONEY_FAQ: FaqEntry[] = [
    {
        q: 'How much does YouTube pay per 1,000 views?',
        a: "Your RPM sets it. RPM is what you earned per 1,000 views after YouTube's revenue share, and YouTube Studio shows it under Analytics, Revenue, RPM. Enter it in the calculator and it multiplies that figure by your views."
    },
    {
        q: 'What is the difference between CPM and RPM?',
        a: "CPM is what an advertiser pays for 1,000 ad impressions, before YouTube's revenue share. RPM is what you earned per 1,000 views after the share. RPM usually runs lower than CPM because it comes after the share and counts views that earned no ad revenue."
    },
    {
        q: 'How much does 1 million views pay?',
        a: '1 million views pay your RPM × 1,000. At a $3.50 RPM, an example figure and not a benchmark, that is $3,500.00. The calculator shows this number for your RPM, then the same views at half and double your RPM.'
    },
    {
        q: 'Do Shorts earn less than long-form?',
        a: "Enter each content type's own RPM, because they are paid differently. Long-form creators keep 55% of net ad revenue. Shorts ad revenue goes into a monthly pool, and creators keep 45% of their allocated share. The pool is split by engaged views and music use, so the same view count can pay differently on each."
    },
    {
        q: 'Do all views earn money?',
        a: 'No. Only monetized playbacks earn ad revenue. Your own RPM already counts views that earned nothing, so it needs no monetized share. The niche CPM estimate in the calculator asks for one.'
    },
    {
        q: 'How many views do I need to make $1,000 a month?',
        a: 'Enter $1,000 as your monthly income goal. The calculator divides the goal by your RPM and shows the views you need each month. At a $3.50 RPM, for example, that is at least 285,715 views a month. With both content types entered, it keeps your current mix and shows the total views for that mix.'
    },
    {
        q: 'Do I need the YouTube Partner Program to earn ad revenue?',
        a: 'Yes. YouTube pays ad revenue on your videos through the YouTube Partner Program. The entry thresholds for new applicants change on 1 February 2027; the Partner Program section above lists them.'
    },
    {
        q: 'Is this calculator accurate?',
        a: 'It returns your RPM multiplied by your views, with the formula shown. It reads no channel, audience or payout data, so a real month can differ from the estimate. Use the RPM from your own Studio numbers.'
    }
];
