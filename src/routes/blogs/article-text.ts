// Visible text of rendered article HTML for test assertions. Walks the markup
// instead of regex-replacing tags so partial tags cannot survive stripping.
export function visibleText(html: string): string {
	let text = '';
	let inTag = false;
	for (const char of html) {
		if (char === '<') inTag = true;
		else if (char === '>' && inTag) {
			inTag = false;
			text += ' ';
		} else if (!inTag) text += char;
	}
	return text;
}

// Text a reader reads once: the contents navigation renders twice (desktop rail
// and mobile disclosure), so it is excluded from reading-time counts.
export function readingText(html: string): string {
	const start = html.indexOf('<aside class="contents-rail');
	if (start === -1) return visibleText(html);
	const close = '</details>';
	const end = html.indexOf(close, start);
	if (end === -1) throw new Error('Article contents rail has no closing mobile disclosure');
	return visibleText(html.slice(0, start) + html.slice(end + close.length));
}
