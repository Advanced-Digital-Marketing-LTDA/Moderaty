import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = new URL('../../..', import.meta.url).pathname;
const MIN_RATIO = 4.5;
// Lightest surface that landing text sits on (--surface-2 in app.css); the worst case for light-on-dark text.
const LIGHTEST_SURFACE = [0x16, 0x16, 0x1b];
const INK = [244, 244, 248];
// Purely decorative arrow glyphs carry no information.
const DECORATIVE = /t-arrow/;

const channel = (v: number) => {
	const s = v / 255;
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: number[]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: number[], b: number[]) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};
const onSurface = (alpha: number) => contrast(INK.map((c, i) => c * alpha + LIGHTEST_SURFACE[i] * (1 - alpha)), LIGHTEST_SURFACE);

const ALPHA_COLOUR = /(?<![-\w])color:\s*rgb\(244 244 248 \/ ([\d.]+%?)\)/g;

/** Alpha as a 0-1 number from `0.6` or `60%`; anything else is a broken test input, not a pass. */
function alphaOf(raw: string): number {
	const value = raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
	if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Unreadable colour alpha "${raw}"`);
	return value;
}

/** CSS rules of a stylesheet, or of the `<style>` blocks of a component; comments are dropped. */
function cssRules(source: string): { selectors: string[]; body: string }[] {
	const css = source.includes('<style')
		? [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
		: source;
	return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
		selectors: m[1].split(',').map((selector) => selector.trim()),
		body: m[2]
	}));
}

/** Translucent text colours in a stylesheet or component that fall below the minimum contrast. */
function lowContrastColours(source: string): string[] {
	return cssRules(source)
		.filter((rule) => !rule.selectors.every((selector) => DECORATIVE.test(selector)))
		.flatMap((rule) => [...rule.body.matchAll(ALPHA_COLOUR)])
		.filter((m) => onSurface(alphaOf(m[1])) < MIN_RATIO)
		.map((m) => m[0]);
}

const svelteFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? svelteFiles(path) : path.endsWith('.svelte') ? [path] : [];
	});

const publicStyleFiles = [
	...svelteFiles(join(ROOT, 'src/lib/components/landing')),
	join(ROOT, 'src/routes/contact/+page.svelte'),
	join(ROOT, 'src/routes/contact/verify/+page.svelte'),
	join(ROOT, 'src/routes/+page.svelte'),
	join(ROOT, 'src/routes/pricing/+page.svelte'),
	join(ROOT, 'src/routes/blogs/+layout.svelte'),
	join(ROOT, 'src/app.css')
];

describe('contrast test helpers', () => {
	test.each([
		['0.6', 0.6],
		['60%', 0.6],
		['35%', 0.35],
		['.5', 0.5]
	])('alphaOf(%s) normalises to %d', (raw, expected) => {
		expect(alphaOf(raw)).toBeCloseTo(expected);
	});

	test('alphaOf fails loudly instead of returning NaN', () => {
		expect(() => alphaOf('abc')).toThrow(/alpha/i);
		expect(() => alphaOf('150%')).toThrow(/alpha/i);
	});

	test('the scan catches both decimal and percentage alphas below 4.5:1', () => {
		expect(lowContrastColours('a { color: rgb(244 244 248 / 0.35); }')).toEqual(['color: rgb(244 244 248 / 0.35)']);
		expect(lowContrastColours('a { color: rgb(244 244 248 / 35%); }')).toEqual(['color: rgb(244 244 248 / 35%)']);
		expect(lowContrastColours('a { color: rgb(244 244 248 / 60%); }')).toEqual([]);
		expect(lowContrastColours('a { border-color: rgb(244 244 248 / 0.2); }')).toEqual([]);
		expect(lowContrastColours('.t-arrow { color: rgb(244 244 248 / 0.4); }')).toEqual([]);
	});
});

describe('public text contrast (MSG-6)', () => {
	const LOW = 'color: rgb(244 244 248 / 0.35)';

	test('a rule whose selectors are all decorative is exempt', () => {
		expect(lowContrastColours(`<style>.t-arrow { ${LOW}; }</style>`)).toEqual([]);
	});

	test('a grouped rule with one informative selector is still scanned', () => {
		expect(lowContrastColours(`<style>.t-arrow, .row-reason { ${LOW}; }</style>`)).toEqual([LOW]);
	});

	test('a colour declared across several lines is still scanned', () => {
		const multiline = `<style>.note {\n\tcolor:\n\t\trgb(244 244 248 / 0.35);\n}</style>`;
		expect(lowContrastColours(multiline)).toHaveLength(1);
	});

	test('the checker itself rejects the alphas the audit measured below 4.5:1', () => {
		expect(onSurface(0.35)).toBeLessThan(MIN_RATIO);
		expect(onSurface(0.45)).toBeLessThan(MIN_RATIO);
		expect(onSurface(0.6)).toBeGreaterThanOrEqual(MIN_RATIO);
	});

	test('--text-muted meets 4.5:1 on the lightest surface', () => {
		const css = readFileSync(join(ROOT, 'src/app.css'), 'utf8');
		const match = css.match(/--text-muted:\s*rgb\(244 244 248 \/ ([\d.]+%?)\)/);
		if (!match) throw new Error('--text-muted must be defined in app.css as rgb(244 244 248 / alpha)');
		expect(onSurface(alphaOf(match[1]))).toBeGreaterThanOrEqual(MIN_RATIO);
	});

	test('placeholder text resets the browser default opacity so the token alpha is the only alpha', () => {
		const css = readFileSync(join(ROOT, 'src/app.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
		const rule = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, selectors]) =>
			selectors.split(',').some((selector) => selector.trim() === 'input::placeholder')
		);
		if (!rule) throw new Error('app.css must style input::placeholder');
		expect(rule[2].match(/(?<![-\w])opacity:\s*([\d.]+)/)?.[1]).toBe('1');
	});

	test.each(publicStyleFiles.map((file) => [file.replace(ROOT, ''), file]))(
		'%s declares no translucent text colour below 4.5:1',
		(_name, file) => {
			expect(lowContrastColours(readFileSync(file, 'utf8'))).toEqual([]);
		}
	);
});

describe('dimmed rows (review findings on PR #244)', () => {
	const css = (file: string) => readFileSync(join(ROOT, file), 'utf8');
	const tokenAlpha = () => alphaOf(css('src/app.css').match(/--text-muted:\s*rgb\(244 244 248 \/ ([\d.]+%?)\)/)![1]);

	/** Alpha a text colour declaration resolves to; unknown forms throw so a new colour cannot slip past. */
	const colourAlpha = (value: string): number => {
		if (value === 'var(--text-muted)') return tokenAlpha();
		if (value === 'var(--text)' || value === 'var(--paper)') return 1;
		const literal = value.match(/^rgb\(244 244 248 \/ ([\d.]+%?)\)$/);
		if (literal) return alphaOf(literal[1]);
		throw new Error(`Unrecognised text colour "${value}"`);
	};
	/** Text colour set by the rule whose selector list contains `selector`. */
	const declared = (source: string, selector: string): string | undefined => {
		for (const [, selectors, body] of source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
			if (!selectors.split(',').some((candidate) => candidate.trim() === selector)) continue;
			const colour = body.match(/(?<![-\w])color:\s*([^;]+);/)?.[1].trim();
			if (colour) return colour;
		}
		return undefined;
	};

	const declaredOpacity = (source: string, selector: string): string | undefined => {
		for (const [, selectors, body] of source.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
			if (!selectors.split(',').some((candidate) => candidate.trim() === selector)) continue;
			const opacity = body.match(/(?<![-\w])opacity:\s*([\d.]+)/)?.[1];
			if (opacity) return opacity;
		}
		return undefined;
	};

	const source = css('src/lib/components/landing/BonkQueue.svelte');
	const rowOpacity = Number(source.match(/\.row-settled \.row-body,\s*\.row-settled \.row-reason\s*\{[^}]*?opacity:\s*([\d.]+)/)?.[1]);

	test('the settled row dims its body, not the whole row', () => {
		expect(Number.isFinite(rowOpacity)).toBe(true);
	});

	test('the verdict stamp is not dimmed with the settled row', () => {
		// A parent opacity multiplies into the stamp, taking the red and mint labels under 4.5:1.
		expect(declaredOpacity(source, '.row-settled')).toBeUndefined();
		expect(declaredOpacity(source, '.stamp-settled')).toBe('1');
	});

	test.each(['row-reason', 'row-author', 'row-text'])(
		'a settled queue row keeps .%s at 4.5:1 after the row opacity is applied',
		(name) => {
			const value = declared(source, `.row-settled .${name}`) ?? declared(source, `.${name}`);
			if (!value) throw new Error(`.${name} must declare a text colour`);
			expect(onSurface(colourAlpha(value) * rowOpacity)).toBeGreaterThanOrEqual(MIN_RATIO);
		}
	);
});
