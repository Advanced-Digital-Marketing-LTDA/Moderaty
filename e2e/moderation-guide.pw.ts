import { test, expect } from './support/fixture';

for (const viewport of [
	{ name: 'desktop', width: 1536, height: 1000 },
	{ name: 'mobile', width: 390, height: 844 }
]) {
	test(`moderation guide renders semantic content and working links on ${viewport.name}`, async ({ app, page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		const response = await page.goto(`${app.baseURL}/guides/youtube-comment-moderation/`);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle('YouTube comment moderation: settings, filters and tools | Moderaty');
		const article = page.locator('article.blog-article');
		const heading = article.getByRole('heading', { level: 1 });
		await expect(heading).toHaveText('YouTube comment moderation: settings, filters and tools');
		const box = await heading.boundingBox();
		expect(box?.height).toBeGreaterThan(10);
		await expect(article.locator('ol > li')).toContainText(['Open Settings, then Community moderation.', 'Select Content controls.']);
		const table = article.getByRole('table', { name: 'YouTube comment moderation settings' });
		await expect(table.locator('caption')).toHaveText('YouTube comment moderation settings');
		await expect(table.getByRole('columnheader')).toHaveText(['Setting', 'What YouTube does']);
		await expect(table.getByRole('rowheader')).toHaveText(['None', 'Basic', 'Strict', 'Hold all']);
		await expect(article).toContainText('My priority is to keep questions and useful criticism visible.');
		await expect(article).not.toContainText('Editorial note:');
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
		if (viewport.name === 'mobile') {
			const contents = article.locator('.mobile-contents');
			await contents.locator('summary').click();
			await contents.locator('a[href="#native-settings"]').click();
			await expect(contents).not.toHaveAttribute('open', '');
			await expect(article.locator('#native-settings')).toBeInViewport();
		}
		const homepageLinks = await article.locator('a[href^="/#"]').evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
		expect(homepageLinks).toHaveLength(2);
		for (const href of homepageLinks) {
			await page.goto(new URL(href, app.baseURL).href);
			await expect(page.locator(new URL(href, app.baseURL).hash)).toBeInViewport();
		}
	});
}
