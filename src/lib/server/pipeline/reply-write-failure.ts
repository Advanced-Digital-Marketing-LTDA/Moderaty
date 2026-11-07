import { HttpTransportError } from '$lib/server/http';
import { QUOTA_REASONS } from '$lib/server/quota';
import { YoutubeWriteRefusedError } from '$lib/server/youtube';

/**
 * Failure rules for the YouTube write behind a reply action row (step 8). A
 * failed write parks that one row so the channel's run can continue. Quota,
 * throttling and auth failures are run-level: they propagate and the row retries.
 */

/** HTTP statuses for an expired or throttled credential, which a later run can clear. */
const RUN_LEVEL_STATUSES = new Set([401, 429]);

/** The HTTP status youtube.ts writes into its error message (`... failed: 403 {body}`). */
function writeStatus(message: string): number | undefined {
	const raw = /\bfailed: (\d{3})\b/.exec(message)?.[1];
	return raw === undefined ? undefined : Number(raw);
}

/** The response's reason code, token characters only. The body itself is never copied into a reason. */
function reasonCode(message: string): string | undefined {
	return /"reason"\s*:\s*"([A-Za-z0-9_]{1,64})"/.exec(message)?.[1];
}

/** True when a reply row may be parked on this write failure: a YouTube refusal or HTTP error, or a transport failure. */
export function isParkableWriteFailure(error: unknown): boolean {
	if (error instanceof HttpTransportError) return true;
	if (!(error instanceof Error)) return false;
	const status = writeStatus(error.message);
	if (status === undefined && !(error instanceof YoutubeWriteRefusedError)) return false;
	if (status !== undefined && RUN_LEVEL_STATUSES.has(status)) return false;
	return !QUOTA_REASONS.some((reason) => error.message.includes(reason));
}

/** The audit reason for a parked write: the operation, then the YouTube status and reason code. */
export function writeFailureReason(verb: string, error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	const status = writeStatus(message);
	const verdict = error instanceof YoutubeWriteRefusedError ? 'refused by YouTube' : 'failed at YouTube';
	const detail = status === undefined ? 'no HTTP status' : `${status} ${reasonCode(message) ?? 'no reason code'}`;
	return `reply ${verb} ${verdict}: ${detail}`;
}

/** The audit reason for a destructive reply that was never sent because its protected identity could not be resolved. */
export function unresolvedIdentityReason(verb: string): string {
	return `reply ${verb} not sent: protected identity unavailable`;
}
