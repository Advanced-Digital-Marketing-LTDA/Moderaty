// Complimentary access for named owners. An org whose owner's e-mail is listed
// in the runtime env var UNLIMITED_ACCESS_EMAILS is always funded, never
// metered, and scores on the deployment OpenAI key. The list lives only in
// runtime config, never in the repo.

import { and, eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { db } from '$lib/server/db';
import { memberships, users } from '$lib/server/db/schema';

export type ComplimentaryHandle = Pick<typeof db, 'select'>;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parses UNLIMITED_ACCESS_EMAILS. Unset fails loudly; an empty value means no
 * exemptions. A malformed entry is reported by position, never by value.
 */
export function unlimitedAccessEmails(): ReadonlySet<string> {
	const raw = env.UNLIMITED_ACCESS_EMAILS;
	if (raw === undefined) {
		throw new Error('UNLIMITED_ACCESS_EMAILS is not set; set it to a comma-separated email list, or to an empty value for none');
	}
	if (raw.trim() === '') return new Set();
	const entries = raw.split(',').map((entry) => entry.trim().toLowerCase());
	entries.forEach((entry, index) => {
		if (!EMAIL_SHAPE.test(entry)) throw new Error(`UNLIMITED_ACCESS_EMAILS entry ${index + 1} is not a valid email address`);
	});
	return new Set(entries);
}

/** True when an owner of the org holds a listed e-mail. Admins and members never count. */
export async function orgHasUnlimitedAccess(handle: ComplimentaryHandle, orgId: string): Promise<boolean> {
	const allowed = unlimitedAccessEmails();
	if (allowed.size === 0) return false;
	const owners = await handle
		.select({ email: users.email })
		.from(memberships)
		.innerJoin(users, eq(users.id, memberships.userId))
		.where(and(eq(memberships.orgId, orgId), eq(memberships.role, 'owner')))
		.all();
	return owners.some((owner) => allowed.has(owner.email.trim().toLowerCase()));
}
