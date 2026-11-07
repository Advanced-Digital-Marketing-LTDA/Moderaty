import { isHttpError } from '@sveltejs/kit';

import { env } from '$env/dynamic/private';
import type { ReplyPause } from '$lib/replyCheckStatus';
import { banCountsByChannel, commentCountsByChannel } from '$lib/server/channelStats';
import { db } from '$lib/server/db';
import { readQuotaExhaustedToday, readReplyCeiling, readYoutubeUnitsToday } from '$lib/server/quota';
import { ownedChannel } from '$lib/server/ownership';
import { requireUser } from '$lib/server/session';

/** The channel-detail tabs, derived from the request path so SSR stays prop-driven. */
export type ChannelTab = 'overview' | 'rules' | 'queue' | 'feedback' | 'log';

function tabFromPath(pathname: string): ChannelTab {
	if (pathname.endsWith('/rules')) return 'rules';
	if (pathname.endsWith('/queue')) return 'queue';
	if (pathname.endsWith('/feedback')) return 'feedback';
	if (pathname.endsWith('/log')) return 'log';
	return 'overview';
}

/**
 * The reply recheck's pause for this load: a disabled quota ceiling pauses reply checks by the server. A day a quota
 * refusal stamped, or a day whose units have reached the ceiling, pauses them until the Pacific day rolls over. Reads only.
 */
async function replyPauseNow(): Promise<ReplyPause | null> {
	const ceiling = readReplyCeiling(env.REPLY_SWEEP_QUOTA_CEILING);
	if (ceiling.kind === 'disabled') return 'paused-by-server';
	const now = Date.now();
	if (await readQuotaExhaustedToday(db, now)) return 'paused-quota-today';
	// The same comparison the recheck's own quota gate makes, so the owner's status matches what the recheck does.
	if ((await readYoutubeUnitsToday(db, now)) >= ceiling.units) return 'paused-quota-today';
	return null;
}

/** Outage payload: no identity, no counts — the layout renders its own error state. */
function maintenancePayload(channelId: string, tab: ChannelTab) {
	return {
		ch: {
			id: channelId,
			title: '',
			lastRunAt: null,
			lastRunStatus: null,
			lastRunError: null,
			lastSuccessAt: null,
			toneLevel: null,
			protectLgbtqia: 0,
			protectWomen: 0,
			active: 1,
			scanning: false,
			dryRunScanning: false,
			moderationDryRunUsed: false,
			// Same shape as the loaded channel, so the overview's reply status type-checks on both arms.
			moderateRepliesSince: null,
			replySweepBoundary: null,
			replySweepLastAt: null,
			replySweepShortfall: null
		},
		pending: 0,
		banned: 0,
		tab,
		maintenance: true,
		orgRole: null,
		replyPause: null
	};
}

/**
 * Loads the channel shell: tenancy-gated channel row (404 cross-tenant —
 * never leak existence), the pending-queue count for the Review queue tab
 * label, the ban count for the header Ticker, and the caller's org role for
 * the disconnect danger block on the overview page.
 */
export async function load({ params, locals, url }) {
	const tab = tabFromPath(url.pathname);
	// Database outage: the (app) overlay covers shell-level outages, but a
	// mid-load failure below must degrade the same way instead of 500ing.
	if (locals.dbDown) return maintenancePayload(params.id, tab);
	try {
		const row = await ownedChannel(params.id, locals);
		const user = requireUser(locals);
		const [stats, bans] = await Promise.all([
			commentCountsByChannel([row.id]),
			banCountsByChannel([row.id])
		]);
		const pending = stats.find((s) => s.status === 'pending')?.n ?? 0;
		const banned = bans[0]?.n ?? 0;
		const replyPause = await replyPauseNow();
		// Project only what the header/tabs/overview render — never serialize
		// refreshTokenEnc (or any future secret column) to the browser. The
		// continuation token is internal drain state; only its presence leaks,
		// as the scanning flag (same contract as the dashboard load).
		const ch = {
			id: row.id,
			title: row.title,
			lastRunAt: row.lastRunAt,
			lastRunStatus: row.lastRunStatus,
			lastRunError: row.lastRunError,
			lastSuccessAt: row.lastSuccessAt,
			toneLevel: row.toneLevel,
			protectLgbtqia: row.protectLgbtqia,
			protectWomen: row.protectWomen,
			active: row.active,
			scanning: row.nextPageToken !== null,
			dryRunScanning: row.dryRunBoundary !== null,
			moderationDryRunUsed: row.moderationDryRunUsedAt !== null,
			// The reply recheck's status line: enable time, pass start, last check, shortfall.
			// The continuation token stays server-side, as the drain tokens above do.
			moderateRepliesSince: row.moderateRepliesSince,
			replySweepBoundary: row.replySweepBoundary,
			replySweepLastAt: row.replySweepLastAt,
			replySweepShortfall: row.replySweepShortfall
		};
		return { ch, pending, banned, tab, maintenance: false, orgRole: user.orgRole, replyPause };
	} catch (e) {
		// A deliberate HttpError (401 signed out, 404 cross-tenant) is NOT an
		// outage — fail loudly, same as the dashboard load.
		if (isHttpError(e)) throw e;
		console.error('channel layout load failed:', e);
		return maintenancePayload(params.id, tab);
	}
}
