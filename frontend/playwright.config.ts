import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const isWin = process.platform === 'win32';
const pythonBin = isWin
  ? path.resolve(__dirname, '..', '.venv', 'Scripts', 'python.exe')
  : path.resolve(__dirname, '..', '.venv', 'bin', 'python');

export default defineConfig({
  testDir: './e2e',
  timeout: 45 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
  ],
  webServer: [
    {
      command: `"${pythonBin}" -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`,
      cwd: path.resolve(__dirname, '..'),
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
    {
      command: isWin ? 'npm.cmd run dev' : 'npm run dev',
      cwd: __dirname,
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
  ],
});
