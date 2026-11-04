// Paid-only ingestion. On the official hosted deployment an org may fetch
// YouTube comments or run AI on them only when it is funded: a lifetime plan,
// a positive purchased balance, or an in-window paid subscription period.
// Complimentary owners (unlimitedAccess) are always allowed. Self-hosted
// deployments are never blocked.

import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { claimDryRun, hasUsedDryRun, type DryRunClaim, type PreviewFeature } from '$lib/server/dryRun';
import { db } from '$lib/server/db';
import { organizations, stripeSubscriptionPeriods } from '$lib/server/db/schema';
import { requireDeploymentMode } from '$lib/server/deploymentMode';
import { isUnmeteredPlan } from './ledger';
import { orgHasUnlimitedAccess } from './unlimitedAccess';

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
export type DryRunClaimResult = { lease: string; identity: DryRunClaim } | ClaimRefusal;

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
	if (!('status' in claim)) return claim;
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
