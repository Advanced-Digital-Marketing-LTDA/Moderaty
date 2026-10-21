// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { SessionUser } from '$lib/server/session';

declare global {
	namespace App {
		interface Error {
			message: string;
			/** Opaque server-generated request ID, safe to share with support. */
			supportReference?: string;
		}
		interface Locals {
			/** Server-generated opaque correlation, never copied from request headers. */
			requestId: string;
			user: SessionUser | null;
			/** Set by hooks when the database is unreachable: pages render a maintenance state instead of a 500. */
			dbDown?: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
