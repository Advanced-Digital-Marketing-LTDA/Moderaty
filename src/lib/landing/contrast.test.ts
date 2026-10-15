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

/** Translucent text colours in a stylesheet or component that fall below the minimum contrast. */
function lowContrastColours(source: string): string[] {
	return source
		.split('\n')
		.filter((line) => !DECORATIVE.test(line))
		.flatMap((line) => [...line.matchAll(ALPHA_COLOUR)])
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
	join(ROOT, 'src/routes/contact/+page.svelte')
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

	test.each(publicStyleFiles.map((file) => [file.replace(ROOT, ''), file]))(
		'%s declares no translucent text colour below 4.5:1',
		(_name, file) => {
			expect(lowContrastColours(readFileSync(file, 'utf8'))).toEqual([]);
		}
	);
});

describe('dimmed rows (CodeAnt finding on PR #244)', () => {
	test('a settled queue row keeps its reason text at 4.5:1 after the row opacity is applied', () => {
		const source = readFileSync(join(ROOT, 'src/lib/components/landing/BonkQueue.svelte'), 'utf8');
		const rowOpacity = Number(source.match(/\.row-settled\s*\{[^}]*?opacity:\s*([\d.]+)/)?.[1]);
		if (!Number.isFinite(rowOpacity)) throw new Error('.row-settled must declare an opacity');
		const settledReason = source.match(/\.row-settled\s+\.row-reason\s*\{[^}]*?(?<![-\w])color:\s*([^;]+);/)?.[1].trim();
		const reasonColour = settledReason ?? source.match(/\.row-reason\s*\{[^}]*?(?<![-\w])color:\s*([^;]+);/)?.[1].trim();
		const tokenAlpha = alphaOf(readFileSync(join(ROOT, 'src/app.css'), 'utf8').match(/--text-muted:\s*rgb\(244 244 248 \/ ([\d.]+%?)\)/)![1]);
		const alpha = reasonColour === 'var(--text-muted)' ? tokenAlpha : reasonColour === 'var(--text)' ? 1 : NaN;
		if (Number.isNaN(alpha)) throw new Error(`Unrecognised reason colour "${reasonColour}"`);
		expect(onSurface(alpha * rowOpacity)).toBeGreaterThanOrEqual(MIN_RATIO);
	});
});

