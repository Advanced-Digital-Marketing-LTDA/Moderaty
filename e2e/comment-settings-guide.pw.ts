import { test, expect } from './support/fixture';

const path = '/guides/youtube-comment-moderation-settings/';

for (const viewport of [
	{ name: 'desktop', width: 1536, height: 1000 },
	{ name: 'mobile', width: 390, height: 844 }
]) {
	test(`comment settings guide is navigable and readable on ${viewport.name}`, async ({ app, page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.goto(`${app.baseURL}/guides/`);
		await page.locator(`a[href="${path}"]`).click();
		await expect(page).toHaveURL(`${app.baseURL}${path}`);
		const article = page.locator('article.blog-article');
		await expect(article.locator('h1')).toBeVisible();
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://moderaty.invalid${path}`);
		await expect(article.locator('time')).toHaveAttribute('datetime', '2026-10-28');
		const regions = article.getByRole('region');
		await expect(regions).toHaveCount(2);
		for (const region of await regions.all()) {
			await expect(region).toHaveAttribute('tabindex', '0');
			await expect(region.locator('table caption')).toBeVisible();
			await expect(region.locator('th[scope="col"]').first()).toBeVisible();
			if (viewport.name === 'mobile') {
				await region.focus();
				await page.keyboard.press('ArrowRight');
				await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
			}
		}
		for (const link of await article.locator('a[href^="https://"]').all()) {
			await expect(link).toHaveAttribute('target', '_blank');
			await expect(link).toHaveAttribute('rel', 'noopener');
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
		await page.waitForLoadState('networkidle');
		const contents = viewport.name === 'mobile' ? article.locator('.mobile-contents') : article.locator('.desktop-contents');
		if (viewport.name === 'mobile') await contents.locator('summary').click();
		const links = contents.locator('a[href^="#"]');
		for (const href of await links.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))) {
			expect(href).toBeTruthy();
			await expect(article.locator(href!)).toHaveCount(1);
		}
		await contents.locator('a[href="#held-comments"]').click();
		await expect(article.locator('#held-comments')).toBeInViewport();
		if (viewport.name === 'mobile') await expect(contents).not.toHaveAttribute('open', '');
	});
}
