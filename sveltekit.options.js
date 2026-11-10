import adapterNetlify from '@sveltejs/adapter-netlify';
import adapterNode from '@sveltejs/adapter-node';

// Passed to the `sveltekit()` plugin in vite.config.ts (SvelteKit 3 no longer
// reads svelte.config.js). Two supported deployment targets (docs/COOLIFY.md):
// - Netlify (default): MODERATY_ADAPTER unset — every existing Netlify build
//   is unchanged.
// - Coolify (self-hosted): the Dockerfile builds with MODERATY_ADAPTER=node.
// The choice is made at BUILD time, so a single repo serves both targets.
// Any other value fails loudly — a build must never silently pick a target.
const deployTarget = process.env.MODERATY_ADAPTER;
if (deployTarget && deployTarget !== 'node') {
	throw new Error(
		`Unknown MODERATY_ADAPTER=${deployTarget} — use 'node' (Coolify) or leave it unset (Netlify)`
	);
}
const useNode = deployTarget === 'node';

export default {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in Svelte 6.
		runes: (/** @type {{ filename: string }} */ { filename }) => filename.split(/[/\\]/).includes('node_modules') ? undefined : true,
		// Developer notes belong in source, not repeated in published HTML.
		preserveComments: false
	},
	adapter: useNode ? adapterNode() : adapterNetlify(),
	// `alias` is deprecated in SvelteKit 3 in favour of subpath imports (`#lib`).
	// Kept so `$lib` keeps resolving without rewriting every import; migrate in a follow-up.
	alias: { $lib: 'src/lib' }
};
