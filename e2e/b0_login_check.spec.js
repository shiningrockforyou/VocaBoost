import { test, expect } from '@playwright/test';

const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';

test('Login check', async ({ page }) => {
  test.setTimeout(30000);

  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('domcontentloaded');
  console.log('Login page URL:', page.url());

  // Fill form
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill(TEACHER_EMAIL);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(TEACHER_PASSWORD);

  console.log('Submitting form...');
  await page.keyboard.press('Enter');

  // Wait for navigation
  await page.waitForTimeout(5000);
  console.log('URL after 5s wait:', page.url());

  // Check if there's an error
  const bodyText = await page.evaluate(() => document.body.innerText.trim());
  console.log('Body text (first 500):', bodyText.substring(0, 500));
});
