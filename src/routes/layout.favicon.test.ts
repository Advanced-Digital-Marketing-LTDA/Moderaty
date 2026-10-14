import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the favicon is the square Moderaty mark served from a stable public URL', () => {
	const svg = read('../../static/favicon.svg');
	expect(svg).toMatch(/viewBox="0 0 64 64"/);
	expect(svg).toMatch(/width="64"\s+height="64"/);
	expect(svg).toContain('<title>Moderaty</title>');
	expect(svg).not.toMatch(/svelte/i);
});

test('the layout links the stable favicon and touch icon, never the starter asset', () => {
	const layout = read('./+layout.svelte');
	expect(layout).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
	expect(layout).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
	expect(layout).not.toContain('$lib/assets/favicon.svg');
});

test('the touch icon is a 180x180 PNG', () => {
	const png = readFileSync(new URL('../../static/apple-touch-icon.png', import.meta.url));
	expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
	expect(png.readUInt32BE(16)).toBe(180);
	expect(png.readUInt32BE(20)).toBe(180);
});
