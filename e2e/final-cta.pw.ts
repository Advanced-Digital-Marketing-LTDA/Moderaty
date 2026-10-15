import { test, expect } from './support/fixture';

test('the final CTA copy is centered under its headline', async ({ app, page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(`${app.baseURL}/`);
	const section = page.locator('section.final-cta');
	const headline = section.getByRole('heading', { name: /Go touch grass\./ });
	await headline.scrollIntoViewIfNeeded();
	const center = async (selector: string) => {
		const box = await section.locator(selector).first().boundingBox();
		if (!box) throw new Error(`final CTA element ${selector} has no layout box`);
		return box.x + box.width / 2;
	};
	const headlineBox = await headline.boundingBox();
	if (!headlineBox) throw new Error('final CTA headline has no layout box');
	const headlineCenter = headlineBox.x + headlineBox.width / 2;
	for (const selector of ['.intro', '.cta', '.secondary', '.microcopy']) {
		expect(Math.abs((await center(selector)) - headlineCenter), selector).toBeLessThanOrEqual(1);
	}
});
