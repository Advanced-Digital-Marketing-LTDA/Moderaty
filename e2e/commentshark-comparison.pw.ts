import { test, expect } from './support/fixture';

const path = '/moderaty-vs-commentshark/';

for (const viewport of [
	{ name: 'desktop', width: 1536, height: 1000 },
	{ name: 'mobile', width: 390, height: 844 }
]) {
	test(`the CommentShark comparison renders its tables and sources on ${viewport.name}`, async ({ app, page }) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		const response = await page.goto(`${app.baseURL}${path}`);
		expect(response?.status()).toBe(200);
		await expect(page).toHaveTitle('Moderaty vs CommentShark | Moderaty');
		const article = page.locator('article.blog-article');
		await expect(article.getByRole('heading', { level: 1 })).toHaveText('Moderaty vs CommentShark');

		const glance = article.getByRole('table', { name: 'Moderaty and CommentShark compared by topic' });
		await expect(glance.getByRole('columnheader')).toHaveText(['Topic', 'Moderaty', 'CommentShark']);
		await expect(glance.getByRole('rowheader', { name: 'Replies' })).toBeVisible();

		const plans = article.getByRole('table', { name: 'CommentShark plans' });
		await expect(plans.getByRole('rowheader')).toHaveText(['Free', 'Starter', 'Creator', 'Pro', 'Custom']);

		const sources = article.locator('#sources ~ ul').first().getByRole('link');
		expect(await sources.count()).toBeGreaterThan(0);
		for (const rel of await sources.evaluateAll((links) => links.map((link) => link.getAttribute('rel')))) expect(rel).toBe('noopener noreferrer');

		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
	});
}
