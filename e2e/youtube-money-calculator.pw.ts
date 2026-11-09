import { test, expect } from './support/fixture';

const path = '/tools/youtube-money-calculator/';

test.beforeEach(async ({ app, page }) => {
	await page.goto(`${app.baseURL}${path}`);
	// A click before the page hydrates falls back to a plain form GET, which reloads and drops typed input.
	await page.waitForLoadState('networkidle');
});

test('submitting shows the earnings for the entered views and RPM', async ({ page }) => {
	await page.getByRole('textbox', { name: 'Long-form monthly views', exact: true }).fill('250000');
	await page.getByRole('textbox', { name: 'Long-form RPM (USD per 1,000 views)', exact: true }).fill('3.5');
	await page.getByRole('button', { name: 'Calculate earnings' }).click();
	await expect(page.getByText('$875.00', { exact: true })).toBeVisible();
	await expect(page.getByText('$10,500.00', { exact: true })).toBeVisible();
	await expect(page.getByText('250,000 views ÷ 1,000 × $3.50 = $875.00 a month')).toBeVisible();
});

test('editing an input after a result clears it rather than leaving stale numbers', async ({ page }) => {
	const rpm = page.getByRole('textbox', { name: 'Long-form RPM (USD per 1,000 views)', exact: true });
	await page.getByRole('textbox', { name: 'Long-form monthly views', exact: true }).fill('250000');
	await rpm.fill('3.5');
	await page.getByRole('button', { name: 'Calculate earnings' }).click();
	await expect(page.getByText('$875.00', { exact: true })).toBeVisible();
	await rpm.fill('4');
	await expect(page.getByText('No estimate yet.')).toBeVisible();
	await expect(page.getByText('$875.00', { exact: true })).toHaveCount(0);
});

test('a blank RPM shows its message and moves focus to the results', async ({ page }) => {
	await page.getByRole('textbox', { name: 'Long-form monthly views', exact: true }).fill('250000');
	await page.getByRole('button', { name: 'Calculate earnings' }).click();
	await expect(page.getByRole('alert')).toContainText('Long-form RPM is empty');
	await expect(page.locator('.results')).toBeFocused();
});

test('choosing a content type hides the fields for the other type', async ({ page }) => {
	const shortsViews = page.getByRole('textbox', { name: 'Shorts monthly views', exact: true });
	const longFormViews = page.getByRole('textbox', { name: 'Long-form monthly views', exact: true });
	await page.getByRole('radio', { name: 'Long-form', exact: true }).check();
	await expect(shortsViews).toBeHidden();
	await expect(longFormViews).toBeVisible();
	await page.getByRole('radio', { name: 'Shorts', exact: true }).check();
	await expect(longFormViews).toBeHidden();
	await expect(shortsViews).toBeVisible();
});

test('the calculator fits a 390px phone without horizontal scrolling', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('textbox', { name: 'Long-form monthly views', exact: true }).fill('250000');
	await page.getByRole('textbox', { name: 'Long-form RPM (USD per 1,000 views)', exact: true }).fill('3.5');
	await page.getByRole('button', { name: 'Calculate earnings' }).click();
	await expect(page.getByText('$875.00', { exact: true })).toBeVisible();
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow).toBe(0);
});

test('on a desktop screen the result panel sits beside the form', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	const form = await page.locator('form.calculator').boundingBox();
	const results = await page.locator('.results').boundingBox();
	if (!form || !results) throw new Error('form or results panel has no box');
	expect(results.x).toBeGreaterThanOrEqual(form.x + form.width - 1);
	expect(Math.abs(results.y - form.y)).toBeLessThan(8);
});

test('on a phone the result panel sits under the form', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const form = await page.locator('form.calculator').boundingBox();
	const results = await page.locator('.results').boundingBox();
	if (!form || !results) throw new Error('form or results panel has no box');
	expect(results.y).toBeGreaterThanOrEqual(form.y + form.height - 1);
});
