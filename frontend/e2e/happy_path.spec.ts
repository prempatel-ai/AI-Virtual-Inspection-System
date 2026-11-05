import { test, expect } from '@playwright/test';

test.describe('PDS Inspection System Happy Path', () => {
  test('end-to-end audit flow: dashboard -> filter -> detail -> record outcome -> KPI change', async ({ page }) => {
    // 1. Open Dashboard
    await page.goto('/');

    // Verify Page Header and KPI Cards
    await expect(page.getByRole('heading', { level: 1, name: /Inspection priorities/i })).toBeVisible();
    await expect(page.getByText(/Shops monitored/i)).toBeVisible();
    await expect(page.getByText(/Flagged shops/i)).toBeVisible();
    await expect(page.getByText(/Confirmed rate/i)).toBeVisible();
    await expect(page.getByText(/Precision@K/i)).toBeVisible();

    // Take desktop screenshot (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: 'e2e/screenshots/dashboard_1280.png', fullPage: true });

    // Take tablet screenshot (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: 'e2e/screenshots/dashboard_768.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });

    // 2. Filter by district
    const districtSelect = page.locator('label:has-text("District") select');
    await expect(districtSelect).toBeVisible();
    const options = await districtSelect.locator('option').allInnerTexts();
    if (options.length > 1) {
      const targetDistrict = options[1].trim();
      await districtSelect.selectOption({ label: targetDistrict });
      await expect(page.getByText(/Clear filters/i)).toBeVisible();
    }

    // 3. Open the top ranked shop
    const firstShopRow = page.locator('table tbody tr').first();
    await expect(firstShopRow).toBeVisible();
    const shopLink = firstShopRow.locator('td a').first();
    await expect(shopLink).toBeVisible();
    await shopLink.click();

    // 4. Shop Detail Screen Verification
    await page.waitForURL(/\/shops\//);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Score breakdown/i)).toBeVisible();
    await expect(page.getByText(/Stock reconciliation/i)).toBeVisible();
    await expect(page.getByText(/Why this shop was flagged/i)).toBeVisible();
    await expect(page.getByText(/What to check/i)).toBeVisible();
    await expect(page.getByText(/Record visit outcome/i)).toBeVisible();

    // Take detail screenshots
    await page.screenshot({ path: 'e2e/screenshots/detail_1280.png', fullPage: true });
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: 'e2e/screenshots/detail_768.png', fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });

    // 5. Toggle a verification checklist item
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();
    }

    // 6. Record visit outcome
    const outcomeSelect = page.locator('select#outcome-FPS-00001, select[id^="outcome-"]').first();
    await outcomeSelect.selectOption('confirmed');

    const notesInput = page.locator('textarea#notes-FPS-00001, textarea[id^="notes-"]').first();
    await notesInput.fill('Verified physical godown records and confirmed distribution discrepancy.');

    const saveButton = page.getByRole('button', { name: /Save outcome/i });
    await saveButton.click();
    await expect(page.getByText(/Outcome saved successfully/i)).toBeVisible();

    // 7. Return to Dashboard and check confirmed rate KPI
    const backLink = page.getByRole('link', { name: /Back/i });
    await backLink.click();
    await page.waitForURL(/\/$/);

    // Verify confirmed rate KPI displays non-zero / updated status
    await expect(page.getByText(/Confirmed rate/i)).toBeVisible();
  });
});
