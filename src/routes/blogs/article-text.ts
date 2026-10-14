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
