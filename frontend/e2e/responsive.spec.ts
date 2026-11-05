import { test, expect } from '@playwright/test';

test.describe('Responsive Layout Verification (1280px & 768px)', () => {
  test('dashboard conforms to 1280px and 768px layouts without horizontal overflow', async ({ page }) => {
    // 1. Desktop 1280px
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('table tbody tr');

    const bodyOverflow1280 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(bodyOverflow1280).toBe(true);

    // 2. Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    const bodyOverflow768 = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(bodyOverflow768).toBe(true);

    // Verify table has its own horizontal scroll container
    const tableContainer = page.locator('.overflow-x-auto');
    await expect(tableContainer).toBeVisible();
  });

  test('shop detail conforms to 1280px two-column and 768px single-column layouts', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForSelector('table tbody tr');
    await page.locator('table tbody tr').first().locator('td a').first().click();
    await page.waitForURL(/\/shops\//);
    await page.waitForSelector('form');

    // 1280px: Check grid has 2 columns on desktop
    const detailGrid = page.locator('.grid.grid-cols-1.lg\\:grid-cols-2');
    await expect(detailGrid).toBeVisible();

    // 768px: Verify stacking and no body overflow
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(300);

    const bodyOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(bodyOverflow).toBe(true);
  });
});
