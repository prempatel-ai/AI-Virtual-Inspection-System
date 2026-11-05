const path = require('path');
const fs = require('fs');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

async function capture() {
  const outDir = path.resolve(__dirname, '..', 'docs', 'images');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  const page = await context.newPage();

  // 1. Sign in as Admin
  console.log('Signing in as Admin...');
  await page.goto('http://127.0.0.1:3000/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill('aarav.patel.1@demo.invalid');
  await page.locator('input[type="password"]').fill('demoPassword123');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1000);

  // Overview Screen
  console.log('Capturing overview...');
  await page.goto('http://127.0.0.1:3000/overview');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'overview.png') });

  // Areas Screen
  console.log('Capturing areas...');
  await page.goto('http://127.0.0.1:3000/areas');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'areas.png') });

  // Officers Screen
  console.log('Capturing officers...');
  await page.goto('http://127.0.0.1:3000/officers');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'officers.png') });

  // Flags Screen
  console.log('Capturing flags...');
  await page.goto('http://127.0.0.1:3000/flags');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'flags.png') });

  // 2. Sign in as Inspector to capture Queue & Case Detail with action controls
  console.log('Signing in as Inspector...');
  await page.goto('http://127.0.0.1:3000/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill('arjun.mehta.69@demo.invalid');
  await page.locator('input[type="password"]').fill('demoPassword123');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1000);

  // Queue Screen
  console.log('Capturing queue...');
  await page.goto('http://127.0.0.1:3000/queue');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'queue.png') });

  // Case Detail Screen
  console.log('Capturing case detail...');
  await page.goto('http://127.0.0.1:3000/cases/case-FPS-00063-20261102');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'case_detail.png') });

  await browser.close();
  console.log('All screenshots captured successfully into docs/images/!');
}

capture().catch((err) => {
  console.error(err);
  process.exit(1);
});
