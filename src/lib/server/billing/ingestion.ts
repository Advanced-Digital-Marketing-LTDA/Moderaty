// Paid-only ingestion. On the official hosted deployment an org may fetch
// YouTube comments or run AI on them only when it is funded: a lifetime plan,
// a positive purchased balance, or an in-window paid subscription period.
// Complimentary owners (unlimitedAccess) are always allowed. Self-hosted
// deployments are never blocked.

import { and, eq, gt, isNull, lte } from 'drizzle-orm';
import { claimDryRun, type PreviewFeature } from '$lib/server/dryRun';
import { db } from '$lib/server/db';
import { organizations, stripeSubscriptionPeriods } from '$lib/server/db/schema';
import { isOfficialHosted } from '$lib/server/welcomeEnrollment';
import { isUnmeteredPlan } from './ledger';
import { orgHasUnlimitedAccess } from './unlimitedAccess';

export type IngestionBlock = 'unpaid' | null;

/**
 * Returns 'unpaid' when the hosted org may not ingest; null when it may.
 * A missing org throws: the caller must not guess.
 */
export async function ingestionBlock(orgId: string): Promise<IngestionBlock> {
	// Checked first: self-hosted deployments have no gate and never read the org.
	if (!isOfficialHosted()) return null;
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

export type DryRunClaimResult = Awaited<ReturnType<typeof claimDryRun>> | { status: 402; error: string };

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
		console.warn('free dry run refused: organization already used its one free dry run', { orgId, channelId, feature });
		return { status: 402, error: FREE_DRY_RUN_USED };
	}
	let claim: Awaited<ReturnType<typeof claimDryRun>>;
	try {
		claim = await claimDryRun(channelId, orgId, feature);
	} catch (error) {
		await releaseFreeDryRun(orgId, stamp);
		throw error;
	}
	if ('status' in claim) await releaseFreeDryRun(orgId, stamp);
	return claim;
}

/** Gives back a free dry run this claim reserved; a newer claim's stamp is never cleared. */
export async function releaseFreeDryRun(orgId: string, stamp: string): Promise<void> {
	await db
		.update(organizations)
		.set({ freeDryRunUsedAt: null })
		.where(and(eq(organizations.id, orgId), eq(organizations.freeDryRunUsedAt, stamp)));
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
