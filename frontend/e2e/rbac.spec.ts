import { test, expect } from '@playwright/test';

test.describe('V2 RBAC and Role Workflows', () => {
  test('1. Inspector role: lands on /queue, opens assigned case, acts on case', async ({ page }) => {
    // Sign in as Inspector
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('ananya.patel.13@demo.invalid');
    await page.locator('input[type="password"]').fill('demoPassword123');
    await page.getByRole('button', { name: /Sign In to System/i }).click();

    // Verify redirected to queue
    await page.waitForURL(/\/queue/);
    await expect(page.getByRole('heading', { level: 1, name: /Inspection Queue/i })).toBeVisible();

    // Verify inspector sees their cases
    const firstCaseRow = page.locator('table tbody tr').first();
    await expect(firstCaseRow).toBeVisible();

    // Open first case
    await firstCaseRow.click();
    await page.waitForURL(/\/cases\//);

    // Verify Case Detail Screen
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/Available Officer Actions/i)).toBeVisible();
    await expect(page.getByText(/Case Activity Log/i)).toBeVisible();

    // Capture inspector case screenshot
    await page.screenshot({ path: 'e2e/screenshots/inspector_case_1280.png', fullPage: true });
  });

  test('2. Mamlatdar role: lands on /overview, accesses taluka oversight and queue', async ({ page }) => {
    // Sign in as Mamlatdar
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('saanvi.patel.12@demo.invalid');
    await page.locator('input[type="password"]').fill('demoPassword123');
    await page.getByRole('button', { name: /Sign In to System/i }).click();

    // Verify redirected to overview
    await page.waitForURL(/\/overview/);
    await expect(page.getByRole('heading', { level: 1, name: /Executive Oversight/i })).toBeVisible();

    // Navigate to Queue
    await page.getByRole('button', { name: /My Queue/i }).click();
    await page.waitForURL(/\/queue/);
    await expect(page.getByRole('heading', { level: 1, name: /Inspection Queue/i })).toBeVisible();
  });

  test('3. District Officer role: views district metrics and areas breakdown', async ({ page }) => {
    // Sign in as District Officer
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('vihaan.patel.4@demo.invalid');
    await page.locator('input[type="password"]').fill('demoPassword123');
    await page.getByRole('button', { name: /Sign In to System/i }).click();

    await page.waitForURL(/\/overview/);
    await expect(page.getByRole('heading', { level: 1, name: /Executive Oversight/i })).toBeVisible();

    // Navigate to Areas
    await page.getByRole('button', { name: /Areas/i }).click();
    await page.waitForURL(/\/areas/);
    await expect(page.getByRole('heading', { level: 1, name: /Administrative Area Risk Metrics/i })).toBeVisible();
  });

  test('4. Vigilance role: state oversight, read-only cases (no start/record buttons)', async ({ page }) => {
    // Sign in as Vigilance
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('vivaan.patel.2@demo.invalid');
    await page.locator('input[type="password"]').fill('demoPassword123');
    await page.getByRole('button', { name: /Sign In to System/i }).click();

    await page.waitForURL(/\/overview/);
    await expect(page.getByRole('heading', { level: 1, name: /Executive Oversight/i })).toBeVisible();

    // Open Queue and open a case
    await page.getByRole('button', { name: /My Queue/i }).click();
    await page.waitForURL(/\/queue/);

    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    await page.waitForURL(/\/cases\//);

    // Vigilance does NOT have start_inspection or record_outcome permissions
    await expect(page.getByRole('button', { name: /Start Inspection/i })).not.toBeVisible();
  });

  test('5. Admin role: accesses user management, audit log, and full officer roster', async ({ page }) => {
    // Sign in as Admin
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('aarav.patel.1@demo.invalid');
    await page.locator('input[type="password"]').fill('demoPassword123');
    await page.getByRole('button', { name: /Sign In to System/i }).click();

    await page.waitForURL(/\/overview/);

    // Navigate to Admin Users
    await page.getByRole('button', { name: /Users/i }).click();
    await page.waitForURL(/\/admin\/users/);
    await expect(page.getByRole('heading', { level: 1, name: /User Management & Access Control/i })).toBeVisible();

    // Navigate to Security Audit Log
    await page.getByRole('button', { name: /Audit Log/i }).click();
    await page.waitForURL(/\/admin\/audit/);
    await expect(page.getByRole('heading', { level: 1, name: /Security Access & Audit Log/i })).toBeVisible();

    // Navigate to Officers
    await page.getByRole('button', { name: /Officers/i }).click();
    await page.waitForURL(/\/officers/);
    await expect(page.getByRole('heading', { level: 1, name: /Inspection Officers/i })).toBeVisible();
  });
});
