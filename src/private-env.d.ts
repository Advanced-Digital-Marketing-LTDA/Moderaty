// SvelteKit 3 ships types only for $app/env/private. The app still imports the
// deprecated $env/dynamic/private (its migration is a follow-up), so declare it as
// SvelteKit 2 did. Which names exist at runtime is controlled by src/env.ts.
declare module '$env/dynamic/private' {
	export const env: Record<string, string | undefined>;
}
