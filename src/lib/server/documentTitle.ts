/** The shell's last-resort title (`src/app.html`), emitted after `%sveltekit.head%`. */
export const FALLBACK_TITLE_MARKUP = '<title>Moderaty</title>';

const TITLE_OPEN = /<title[\s>]/g;

/**
 * Pages must carry exactly one `<title>`. The shell always ends its head with
 * the fallback title so title-less pages still get one, but a route's own
 * `<svelte:head><title>` is injected earlier, which leaves two titles in the
 * served document. Drop the fallback when a route title precedes it. Any other
 * duplicate is a defect in a route and throws instead of being masked.
 */
export function dropShadowedFallbackTitle(html: string): string {
	const count = html.match(TITLE_OPEN)?.length ?? 0;
	if (count <= 1) return html;
	const fallbackAt = html.lastIndexOf(FALLBACK_TITLE_MARKUP);
	if (count === 2 && fallbackAt !== -1 && html.indexOf('<title') < fallbackAt) {
		return html.slice(0, fallbackAt) + html.slice(fallbackAt + FALLBACK_TITLE_MARKUP.length);
	}
	throw new Error(`Rendered document has ${count} duplicate <title> elements; each page must set exactly one.`);
}
