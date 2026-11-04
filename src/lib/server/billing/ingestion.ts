// Paid-only ingestion. On the official hosted deployment an org may fetch
// YouTube comments or run AI on them only when it is funded: a lifetime plan,
// a positive purchased balance, or an in-window paid subscription period.
// Complimentary owners (unlimitedAccess) are always allowed. Self-hosted
// deployments are never blocked.

import { and, eq, gt, lte } from 'drizzle-orm';
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
