<script lang="ts">
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
	import { t } from '$lib/i18n/messages';

	let { data } = $props();
</script>

<svelte:head>
	<title>{t(data.locale, 'signInTitle')}</title>
</svelte:head>

<!-- This page is fully translated — it may offer the selector (MOD-11). -->
<div class="switcher-bar"><LanguageSwitcher locale={data.locale} /></div>
<!-- Static sign-in prompt; the guard redirect lives in +page.server.ts. -->
<main class="login-main">
	<div class="card login-card">
		<h1>{t(data.locale, 'signInTitle')}</h1>
		<p class="muted">
			{t(data.locale, 'signInDescription')}
		</p>
		<!-- MSG-9: the login request asks only for identity scopes; youtube.force-ssl is a separate consent (api/auth/google). -->
		<p class="muted small">{t(data.locale, 'signInScope')}</p>
		<p class="muted small">{t(data.locale, 'signInPreview')}</p>
		<a class="btn" href="/api/auth/google/login">{t(data.locale, 'signInGoogle')}</a>
	</div>
	<!-- Ways back for a visitor who arrived from a CTA and is not ready to sign in (MSG-9). -->
	<nav class="login-links" aria-label={t(data.locale, 'signInMoreLinks')}>
		<a href="/">{t(data.locale, 'home')}</a>
		<a href="/privacy">{t(data.locale, 'privacyPolicy')}</a>
		<a href="/terms">{t(data.locale, 'termsOfService')}</a>
		<a href="/contact">{t(data.locale, 'contactSupport')}</a>
	</nav>
</main>

<style>
	/* Out of flow so the 100vh main below stays exactly one viewport tall. */
	.switcher-bar {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
	}
	.login-main {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 20px;
		min-height: 100vh;
		padding: 24px;
	}
	.login-card {
		max-width: 420px;
		text-align: center;
	}
	.login-card .btn {
		margin-top: 16px;
	}
	.login-card .small {
		font-size: 13px;
	}
	.login-links {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px 20px;
		font-size: 13px;
	}
</style>
