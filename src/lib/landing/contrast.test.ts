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

const svelteFiles = (dir: string): string[] =>
	readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? svelteFiles(path) : path.endsWith('.svelte') ? [path] : [];
	});

const publicStyleFiles = [
	...svelteFiles(join(ROOT, 'src/lib/components/landing')),
	join(ROOT, 'src/routes/contact/+page.svelte')
];

describe('public text contrast (MSG-6)', () => {
	test('the checker itself rejects the alphas the audit measured below 4.5:1', () => {
		expect(onSurface(0.35)).toBeLessThan(MIN_RATIO);
		expect(onSurface(0.45)).toBeLessThan(MIN_RATIO);
		expect(onSurface(0.6)).toBeGreaterThanOrEqual(MIN_RATIO);
	});

	test('--text-muted meets 4.5:1 on the lightest surface', () => {
		const css = readFileSync(join(ROOT, 'src/app.css'), 'utf8');
		const match = css.match(/--text-muted:\s*rgb\(244 244 248 \/ ([\d.]+)\)/);
		if (!match) throw new Error('--text-muted must be defined in app.css as rgb(244 244 248 / alpha)');
		expect(onSurface(Number(match[1]))).toBeGreaterThanOrEqual(MIN_RATIO);
	});

	test.each(publicStyleFiles.map((file) => [file.replace(ROOT, ''), file]))(
		'%s declares no translucent text colour below 4.5:1',
		(_name, file) => {
			const failures = readFileSync(file, 'utf8')
				.split('\n')
				.filter((line) => !DECORATIVE.test(line))
				.flatMap((line) => [...line.matchAll(/(?<![-\w])color:\s*rgb\(244 244 248 \/ ([\d.]+)\)/g)])
				.filter((m) => onSurface(Number(m[1])) < MIN_RATIO)
				.map((m) => m[0]);
			expect(failures).toEqual([]);
		}
	);
});
