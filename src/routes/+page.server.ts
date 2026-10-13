import type { PageServerLoad } from './$types';
import { siteOrigin } from '$lib/server/siteIndex';

/** Use the configured deployment origin for canonical and social metadata. */
export const load: PageServerLoad = () => ({ siteOrigin: siteOrigin() });
