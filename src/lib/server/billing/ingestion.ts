// Paid-only ingestion. On the official hosted deployment an org may fetch
// YouTube comments or run AI on them only when it is funded: a lifetime plan,
// a positive purchased balance, or an in-window paid subscription period.
// Complimentary owners (unlimitedAccess) are always allowed. Self-hosted
// deployments are never blocked.

import { and, eq, gt, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { claimDryRun, hasUsedDryRun, type DryRunClaim, type PreviewFeature } from '$lib/server/dryRun';
import { db } from '$lib/server/db';
import { channels, memberships, organizations, stripeSubscriptionPeriods, users } from '$lib/server/db/schema';
import { requireDeploymentMode } from '$lib/server/deploymentMode';
import { isUnmeteredPlan, UNMETERED_PLAN_IDS } from './ledger';
import {
	isComplimentaryEmail,
	orgHasUnlimitedAccess,
	unlimitedAccessEmails,
	type ComplimentaryHandle
} from './unlimitedAccess';

export type IngestionBlock = 'unpaid' | null;

/**
 * Returns 'unpaid' when the hosted org may not ingest; null when it may.
 * A missing org throws: the caller must not guess.
 */
export async function ingestionBlock(orgId: string): Promise<IngestionBlock> {
	// Checked first: self-hosted deployments have no gate and never read the org.
	if (requireDeploymentMode() === 'self-hosted') return null;
	const org = await db
		.select({ plan: organizations.plan, creditsRemaining: organizations.creditsRemaining })
		.from(organizations)
		.where(eq(organizations.id, orgId))
		.get();
	if (!org) throw new Error(`org not found: ${orgId}`);
	if (await isFunded(orgId, org.plan, org.creditsRemaining)) return null;
	return (await orgHasUnlimitedAccess(db, orgId)) ? null : 'unpaid';
}

export const FREE_DRY_RUN_USED = 'This organization has used its one free dry run. Buy credits or subscribe on the Usage page to run more.';

/** Shown after a refusal when its reserved free run could not be given back. */
export const FREE_RUN_NOT_RETURNED = 'Your free dry run could not be given back. Contact us from the Contact page.';

type ClaimRefusal = { status: number; error: string; freeRunLost?: true };
/** `orgFreeRun` marks a claim that spent the org's one free run, so the caller caps that preview to one page. */
export type DryRunClaimResult = { lease: string; identity: DryRunClaim; orgFreeRun?: true } | ClaimRefusal;

/** The refusal text, with the lost-run note when the reserved free run could not be given back. */
export function refusalMessage(refusal: ClaimRefusal): string {
	return refusal.freeRunLost ? `${refusal.error} ${FREE_RUN_NOT_RETURNED}` : refusal.error;
}

/**
 * claimDryRun under the org's one free dry run. Only an unpaid hosted org
 * spends it, and only on a claim that starts: a claim the channel refuses, or
 * fails to make, gives it back. Funded, complimentary and self-hosted orgs
 * claim the channel directly.
 */
export async function claimDryRunForOrg(channelId: string, orgId: string, feature: PreviewFeature): Promise<DryRunClaimResult> {
	if ((await ingestionBlock(orgId)) === null) return claimDryRun(channelId, orgId, feature);
	const stamp = new Date().toISOString();
	const reserved = await db
		.update(organizations)
		.set({ freeDryRunUsedAt: stamp })
		.where(and(eq(organizations.id, orgId), isNull(organizations.freeDryRunUsedAt)))
		.returning({ id: organizations.id });
	if (reserved.length === 0) {
		// A channel that already spent its own run keeps the per-channel refusal; claimDryRun refuses it without claiming.
		if (await hasUsedDryRun(channelId, orgId, feature)) return claimDryRun(channelId, orgId, feature);
		console.warn('free dry run refused: organization already used its one free dry run', { orgId, channelId, feature });
		return { status: 402, error: FREE_DRY_RUN_USED };
	}
	let claim: Awaited<ReturnType<typeof claimDryRun>>;
	try {
		claim = await claimDryRun(channelId, orgId, feature);
	} catch (cause) {
		if (await giveBack(orgId, stamp)) throw cause;
		console.error('dry-run claim failed after the free run was reserved; the run is lost', { orgId, channelId, cause });
		return { status: 500, error: 'The dry run could not be started. Check the server log and try again.', freeRunLost: true };
	}
	if (!('status' in claim)) return { ...claim, orgFreeRun: true };
	return (await giveBack(orgId, stamp)) ? claim : { ...claim, freeRunLost: true };
}

/** Gives back a free dry run this claim reserved; a newer claim's stamp is never cleared. */
export async function releaseFreeDryRun(orgId: string, stamp: string): Promise<boolean> {
	const released = await db
		.update(organizations)
		.set({ freeDryRunUsedAt: null })
		.where(and(eq(organizations.id, orgId), eq(organizations.freeDryRunUsedAt, stamp)))
		.returning({ id: organizations.id });
	if (released.length === 0) console.error('free dry run release matched no row', { orgId });
	return released.length === 1;
}

/** True when the reserved free run went back. Never throws: a failed release is logged and reported as lost. */
async function giveBack(orgId: string, stamp: string): Promise<boolean> {
	try {
		return await releaseFreeDryRun(orgId, stamp);
	} catch (cause) {
		console.error('free dry run release failed', { orgId, cause });
		return false;
	}
}

async function isFunded(orgId: string, plan: string, creditsRemaining: number | null): Promise<boolean> {
	if (isUnmeteredPlan(plan)) return true;
	if ((creditsRemaining ?? 0) > 0) return true;
	const nowIso = new Date().toISOString();
	const period = await db
		.select({ id: stripeSubscriptionPeriods.id })
		.from(stripeSubscriptionPeriods)
		.where(
			and(
				eq(stripeSubscriptionPeriods.orgId, orgId),
				eq(stripeSubscriptionPeriods.status, 'paid'),
				lte(stripeSubscriptionPeriods.periodStart, nowIso),
				gt(stripeSubscriptionPeriods.periodEnd, nowIso)
			)
		)
		.limit(1)
		.get();
	return period !== undefined;
}

/**
 * The SQL twin of isFunded, used only by unpaidOrgIds. Parity with isFunded is
 * enforced by the "lists exactly the orgs the per-org gate blocks" and
 * "a period ending exactly now" tests in ingestion.test.ts, not by shared code.
 * The CASE keeps the result non-NULL, so `= 0` cannot read an unknown as funded.
 */
function fundedOrgSql(nowIso: string) {
	// Uncorrelated on purpose: a correlated EXISTS resolves organizations.id against the period table's own id column.
	const paidNow = db
		.select({ orgId: stripeSubscriptionPeriods.orgId })
		.from(stripeSubscriptionPeriods)
		.where(and(eq(stripeSubscriptionPeriods.status, 'paid'), lte(stripeSubscriptionPeriods.periodStart, nowIso), gt(stripeSubscriptionPeriods.periodEnd, nowIso)));
	return sql<number>`CASE WHEN ${inArray(organizations.plan, UNMETERED_PLAN_IDS)} OR coalesce(${organizations.creditsRemaining}, 0) > 0 OR ${organizations.id} IN ${paidNow} THEN 1 ELSE 0 END`;
}

/**
 * The hosted orgs with an active channel that may not ingest. Statements:
 * the candidate read; then, only on hosted, the unfunded filter and, when a
 * complimentary list is set, the owner read. A malformed or unset list fails
 * closed: every unfunded candidate counts as unpaid and the cause goes to
 * onListError, so the caller reports it.
 */
export async function unpaidOrgIds(handle: ComplimentaryHandle, onListError: (cause: unknown) => void): Promise<string[]> {
	const candidateRows = await handle
		.select({ orgId: channels.orgId })
		.from(channels)
		.where(and(eq(channels.active, 1), isNotNull(channels.orgId)))
		.groupBy(channels.orgId)
		.all();
	const candidates = candidateRows.flatMap((row) => (row.orgId === null ? [] : [row.orgId]));
	if (candidates.length === 0) return [];
	if (requireDeploymentMode() === 'self-hosted') return [];
	const nowIso = new Date().toISOString();
	const unfunded = (
		await handle
			.select({ orgId: organizations.id })
			.from(organizations)
			.where(and(inArray(organizations.id, candidates), sql`${fundedOrgSql(nowIso)} = 0`))
			.all()
	).map((row) => row.orgId);
	if (unfunded.length === 0) return [];
	let allowed: ReadonlySet<string>;
	try {
		allowed = unlimitedAccessEmails();
	} catch (cause) {
		onListError(cause);
		return unfunded;
	}
	if (allowed.size === 0) return unfunded;
	const owners = await handle
		.select({ orgId: memberships.orgId, email: users.email })
		.from(memberships)
		.innerJoin(users, eq(users.id, memberships.userId))
		.where(and(inArray(memberships.orgId, unfunded), eq(memberships.role, 'owner')))
		.all();
	const complimentary = new Set(owners.filter((owner) => isComplimentaryEmail(allowed, owner.email)).map((owner) => owner.orgId));
	return unfunded.filter((orgId) => !complimentary.has(orgId));
}
