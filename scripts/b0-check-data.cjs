/**
 * B0 Check - Verify what data is in Firestore after seed attempt
 * Takes detailed screenshots and reads DOM state
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'screenshots_B0');

async function takeScreenshot(page, name) {
  const filename = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${name}.png`);
  return filename;
}

async function checkData() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`CONSOLE ${msg.type().toUpperCase()}: ${msg.text()}`);
    }
  });

  try {
    // Login
    console.log('=== Logging in ===');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('input[type="email"]').fill('teacher@apboost.test');
    await page.locator('input[type="password"]').fill('Teacher123!');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
    console.log('Logged in, current URL:', page.url());

    // Navigate to teacher dashboard
    console.log('=== Navigating to teacher dashboard ===');
    await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Get full page text
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log('\n=== FULL PAGE TEXT (teacher dashboard) ===\n', pageText);
    await takeScreenshot(page, 'check_01_teacher_dashboard_full');

    // Scroll to see dev tools
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'check_02_teacher_dashboard_bottom');

    // Now try the seed button and capture all console output
    console.log('\n=== Clicking seed button ===');
    const seedBtn = page.locator('button:has-text("Seed Full Test Data")');
    const visible = await seedBtn.isVisible().catch(() => false);
    if (visible) {
      await seedBtn.scrollIntoViewIfNeeded();
      await seedBtn.click();
      console.log('Seed button clicked, waiting 10 seconds...');
      await page.waitForTimeout(10000);
      const pageTextAfter = await page.evaluate(() => document.body.innerText);
      console.log('\n=== PAGE TEXT AFTER SEED ===\n', pageTextAfter.substring(0, 2000));
      await takeScreenshot(page, 'check_03_after_seed');
    } else {
      console.log('Seed button not visible');
    }

    // Check gradebook
    console.log('\n=== Checking Gradebook ===');
    await page.goto('http://localhost:5173/ap/gradebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const gradebookText = await page.evaluate(() => document.body.innerText);
    console.log('Gradebook text:', gradebookText.substring(0, 1000));
    await takeScreenshot(page, 'check_04_gradebook');

    // Check student dashboard
    console.log('\n=== Checking Student Dashboard ===');
    await page.goto('http://localhost:5173/ap', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const studentDashText = await page.evaluate(() => document.body.innerText);
    console.log('Student dashboard text:', studentDashText.substring(0, 1000));
    await takeScreenshot(page, 'check_05_student_dashboard');

    // Try to access seed result
    console.log('\n=== Checking Seed Result ===');
    await page.goto('http://localhost:5173/ap/results/result_micro_student1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    const resultText = await page.evaluate(() => document.body.innerText);
    console.log('Result page text:', resultText.substring(0, 500));
    await takeScreenshot(page, 'check_06_seed_result');

  } finally {
    // Print all console messages
    console.log('\n=== ALL CONSOLE MESSAGES ===');
    consoleMessages.forEach(m => {
      if (m.type !== 'log') {
        console.log(`[${m.type}] ${m.text}`);
      }
    });
    await browser.close();
  }
}

checkData().catch(console.error);
