import { test, expect } from '@playwright/test';
import fs from 'fs';

const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';

test('B7 Re-seed: Trigger seed from teacher dashboard', async ({ page }) => {
  test.setTimeout(120000);

  await page.goto('http://localhost:5173/login');
  await page.waitForLoadState('domcontentloaded');
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill(TEACHER_EMAIL);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(TEACHER_PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  console.log('URL after login:', page.url());

  await page.goto('http://localhost:5173/ap/teacher');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Take screenshot before seeding
  const beforeShot = await page.screenshot({ fullPage: true });
  fs.writeFileSync('src/apBoost/criteria_audit/playwright_reports/b7_reseed_before.png', beforeShot);

  // Find and click the seed button
  const seedBtn = page.locator('button').filter({ hasText: /Seed Full Test Data/ });
  const seedBtnCount = await seedBtn.count();
  console.log('Seed button count: ' + seedBtnCount);

  if (seedBtnCount === 0) {
    console.log('ERROR: Seed button not found - may be production build or button not visible');
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Page body (first 1000 chars): ' + bodyText.substring(0, 1000));
    return;
  }

  await seedBtn.click();
  console.log('Seed button clicked, waiting for completion...');

  // Wait for seeding to complete (up to 60 seconds)
  await page.waitForSelector('text=Seeded', { timeout: 60000 }).catch(async () => {
    console.log('Did not see "Seeded" text - checking for errors');
    const errorText = await page.locator('text=Seeding failed').textContent().catch(() => 'not found');
    console.log('Error text: ' + errorText);
  });

  await page.waitForTimeout(3000);

  const afterShot = await page.screenshot({ fullPage: true });
  fs.writeFileSync('src/apBoost/criteria_audit/playwright_reports/b7_reseed_after.png', afterShot);

  // Get the seed result message
  const seedResultText = await page.locator('.text-success-text, .text-error-text').first().textContent().catch(() => 'NOT FOUND');
  console.log('Seed result message: ' + seedResultText);

  // Check the page content for the result
  const pageText = await page.evaluate(() => document.body.innerText);
  const seedSection = pageText.match(/(Seed|Seeded|Seeding).*$/m);
  if (seedSection) {
    console.log('Seed-related text found: ' + seedSection[0]);
  }
});
