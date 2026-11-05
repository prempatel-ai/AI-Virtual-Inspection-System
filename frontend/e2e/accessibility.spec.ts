import { test, expect } from '@playwright/test';
import path from 'path';

const axePath = require.resolve('axe-core/axe.min.js');

test.describe('Accessibility & Keyboard Navigation (WCAG AA)', () => {
  test('dashboard has zero serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr');

    // Inject axe-core
    await page.addScriptTag({ path: axePath });

    const results = await page.evaluate(async () => {
      // @ts-expect-error axe attached to window
      return await window.axe.run();
    });

    const criticalOrSerious = results.violations.filter(
      (v: { impact: string }) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalOrSerious.length > 0) {
      console.error('Axe violations found:', JSON.stringify(criticalOrSerious, null, 2));
    }

    expect(criticalOrSerious).toHaveLength(0);
  });

  test('shop detail has zero serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr');

    // Click first shop row
    await page.locator('table tbody tr').first().locator('td a').first().click();
    await page.waitForURL(/\/shops\//);
    await page.waitForSelector('form');

    // Inject axe-core
    await page.addScriptTag({ path: axePath });

    const results = await page.evaluate(async () => {
      // @ts-expect-error axe attached to window
      return await window.axe.run();
    });

    const criticalOrSerious = results.violations.filter(
      (v: { impact: string }) => v.impact === 'critical' || v.impact === 'serious'
    );

    if (criticalOrSerious.length > 0) {
      console.error('Axe violations found on shop detail:', JSON.stringify(criticalOrSerious, null, 2));
    }

    expect(criticalOrSerious).toHaveLength(0);
  });

  test('keyboard operation through the main flow', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('table tbody tr');

    // Tab through header and filters
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus first row in table and press Enter
    const firstRowLink = page.locator('table tbody tr').first().locator('td a').first();
    await firstRowLink.focus();
    await expect(firstRowLink).toBeFocused();

    await page.keyboard.press('Enter');
    await page.waitForURL(/\/shops\//);

    // Verify detail loaded
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Tab through back button
    const backLink = page.getByRole('link', { name: /Back/i });
    await backLink.focus();
    await expect(backLink).toBeFocused();

    // Tab to checklist and toggle with Space
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.focus();
      await expect(firstCheckbox).toBeFocused();
      await page.keyboard.press('Space');
      await expect(firstCheckbox).toBeChecked();
    }
  });
});
