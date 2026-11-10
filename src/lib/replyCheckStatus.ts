/**
 * Reply recheck status for the owner's status line. Pure: the caller supplies
 * the clock, so every state can be pinned at exact instants.
 */

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/** A server-side pause the layout reads per load: a disabled quota ceiling, a day a quota refusal stamped, or a day at the ceiling. */
export type ReplyPause = 'paused-by-server' | 'paused-quota-today';

export type ReplyCheckState = 'off' | 'first-check-pending' | 'in-progress' | 'stale' | 'last-check' | ReplyPause;

/** The channel columns the status reads. Timestamps are ISO strings; null means never set. */
export interface ReplyCheckChannel {
	moderateRepliesSince: string | null;
	replySweepBoundary: string | null;
	replySweepLastAt: string | null;
	replySweepShortfall: number | null;
}

function instantMs(iso: string): number {
	const ms = Date.parse(iso);
	if (Number.isNaN(ms)) throw new Error(`reply check timestamp is not an ISO-8601 timestamp: ${iso}`);
	return ms;
}

/**
 * Invariant the recheck writers keep: enabling stamps reply_sweep_last_at with
 * the same instant as moderate_replies_since, and a pass only ever moves
 * last_at later. So last_at after since means a pass has run since enabling.
 * A pause, when given, wins over every checkpoint state while the setting is on.
 */
export function replyCheckStatus(channel: ReplyCheckChannel, nowIso: string, pause?: ReplyPause | null): ReplyCheckState {
	const since = channel.moderateRepliesSince ?? null;
	if (since === null) return 'off';
	if (pause) return pause;
	const lastAt = channel.replySweepLastAt ?? null;
	if ((channel.replySweepBoundary ?? null) !== null) {
		// A pass with no recorded start cannot be shown as progressing.
		if (lastAt === null) return 'stale';
		return instantMs(nowIso) - instantMs(lastAt) > SIX_HOURS_MS ? 'stale' : 'in-progress';
	}
	return lastAt !== null && instantMs(lastAt) > instantMs(since) ? 'last-check' : 'first-check-pending';
}

/** Replies the last pass could not cover. A null count (never passed, or disabled) is zero. */
export function replyCheckShortfall(channel: Pick<ReplyCheckChannel, 'replySweepShortfall'>): number {
	return channel.replySweepShortfall ?? 0;
}
