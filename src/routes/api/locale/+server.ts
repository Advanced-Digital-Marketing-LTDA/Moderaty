import { json, redirect } from '@sveltejs/kit';

import { isLocale, LOCALE_COOKIE } from '$lib/i18n/locale';
import { cookieSecure } from '$lib/server/oauthState';

function safeReturnTo(value: FormDataEntryValue | null): string {
	// A backslash makes browsers resolve '/\evil.example' as protocol-relative
	// ('//evil.example') — an open redirect (codex). Browsers also strip TAB, CR and LF
	// from a URL, so '/<TAB>/evil.example' is protocol-relative too: reject every
	// control character.
	if (typeof value !== 'string' || value === '' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
		throw new Error('locale return path is invalid');
	}
	return value;
}

export async function POST({ request, cookies }) {
	const form = await request.formData();
	const value = form.get('locale');
	if (typeof value !== 'string' || !isLocale(value)) return json({ error: 'Unsupported language.' }, { status: 400 });
	let returnTo: string;
	try {
		returnTo = safeReturnTo(form.get('returnTo'));
	} catch (cause) {
		console.error('locale: invalid return path:', cause);
		return json({ error: 'Invalid return path.' }, { status: 400 });
	}
	cookies.set(LOCALE_COOKIE, value, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: cookieSecure(),
		maxAge: 60 * 60 * 24 * 365
	});
	throw redirect(303, returnTo);
}
