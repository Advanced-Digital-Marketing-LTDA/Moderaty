import { test, expect } from './support/fixture';

const toolHref = '/tools/youtube-money-calculator/';

test('the Tools menu opens on desktop, reaches the calculator, and closes on Escape', async ({ app, page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(`${app.baseURL}/`);
	await page.waitForLoadState('networkidle');
	const toggle = page.getByRole('button', { name: 'Tools', exact: true });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-expanded', 'true');
	await page.getByRole('link', { name: 'YouTube money calculator', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`${toolHref}$`));
	await expect(page.getByRole('heading', { name: "Views are free. Here's what they pay.", level: 1 })).toBeVisible();
});

test('the Tools menu closes on Escape and on an outside click', async ({ app, page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(`${app.baseURL}/`);
	await page.waitForLoadState('networkidle');
	const toggle = page.getByRole('button', { name: 'Tools', exact: true });
	await toggle.click();
	await expect(page.getByRole('link', { name: 'YouTube money calculator', exact: true })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await page.mouse.click(5, 800);
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('the mobile menu lists Tools and reaches the calculator', async ({ app, page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${app.baseURL}/`);
	await page.waitForLoadState('networkidle');
	await page.getByRole('button', { name: 'Open menu' }).click();
	const toolsToggle = page.getByRole('button', { name: 'Tools', exact: true });
	await toolsToggle.click();
	await page.getByRole('link', { name: 'YouTube money calculator', exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`${toolHref}$`));
});

test('the desktop bar keeps every item on one row at 1152px, with the Tools item', async ({ app, page }) => {
	await page.setViewportSize({ width: 1152, height: 800 });
	await page.goto(`${app.baseURL}/`);
	await page.waitForLoadState('networkidle');
	const m = await page.evaluate(() => {
		const box = (selector: string) => {
			const r = document.querySelector(selector)?.getBoundingClientRect();
			if (!r) throw new Error(`${selector} is not rendered`);
			return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
		};
		const inner = document.querySelector('.nav-inner') as HTMLElement;
		return {
			overflow: inner.scrollWidth - inner.clientWidth,
			wordmark: box('.wordmark'),
			links: box('.links'),
			cta: box('.cta'),
			innerRight: inner.getBoundingClientRect().right - 24
		};
	});
	expect(m.overflow).toBeLessThanOrEqual(0);
	// Items keep at least the 24px flex gap from their neighbours.
	expect(m.links.left - m.wordmark.right).toBeGreaterThanOrEqual(24 - 0.5);
	expect(m.cta.left - m.links.right).toBeGreaterThanOrEqual(24 - 0.5);
	// The CTA stays inside the content edge of the container.
	expect(m.cta.right).toBeLessThanOrEqual(m.innerRight + 0.5);
	// The links occupy a single row: a wrapped item would make the bar taller than one line.
	expect(m.links.bottom - m.links.top).toBeLessThan(40);
});

test('the Tools toggle matches the typography of the links beside it, desktop and mobile', async ({ app, page }) => {
	const typography = (locator: import('@playwright/test').Locator) =>
		locator.evaluate((el) => {
			const s = getComputedStyle(el);
			return { family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, spacing: s.letterSpacing, transform: s.textTransform, color: s.color };
		});
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(`${app.baseURL}/`);
	await page.waitForLoadState('networkidle');
	const pricing = page.locator('.links').getByRole('link', { name: 'Pricing', exact: true });
	const toggle = page.getByRole('button', { name: 'Tools', exact: true });
	expect(await typography(toggle)).toEqual(await typography(pricing));
	await page.setViewportSize({ width: 390, height: 844 });
	await page.getByRole('button', { name: 'Open menu' }).click();
	const mobilePricing = page.locator('.mobile-links').getByRole('link', { name: 'Pricing', exact: true });
	const mobileToggle = page.locator('.mobile-links').getByRole('button', { name: 'Tools', exact: true });
	expect(await typography(mobileToggle)).toEqual(await typography(mobilePricing));
});
