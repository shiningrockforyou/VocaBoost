import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  outputDir: '/tmp/pw-out',
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  timeout: 60000,
  use: {
    baseURL: 'https://vocaboostone.netlify.app',
    trace: 'off',
    screenshot: 'only-on-failure',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
