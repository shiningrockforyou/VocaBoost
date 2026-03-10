/**
 * B0 Audit Script - Setup & Seed
 * Logs in as teacher, seeds full test data, verifies success
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'screenshots_B0');
const STATE_FILE = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'audit_state.json');

// Ensure screenshots dir exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  loginSuccess: false,
  teacherDashboardLoaded: false,
  devToolsSectionFound: false,
  seedButtonFound: false,
  seedClicked: false,
  seedSuccessMessageFound: false,
  seedSuccessText: null,
  testCardsFound: false,
  testCardCount: 0,
  consoleErrors: [],
  screenshots: [],
  verdict: 'PENDING'
};

async function takeScreenshot(page, name) {
  const filename = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  results.screenshots.push(filename);
  console.log(`Screenshot saved: ${name}.png`);
  return filename;
}

async function runB0Audit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Collect console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      results.consoleErrors.push({
        type: msg.type(),
        text: msg.text(),
        url: page.url()
      });
    }
  });

  try {
    console.log('=== STEP 1: Navigate to Login ===');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await takeScreenshot(page, '01_login_page');
    console.log('Login page loaded');

    console.log('=== STEP 2: Enter Credentials ===');
    // Find email field
    const emailField = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    await emailField.waitFor({ timeout: 10000 });
    await emailField.click();
    await emailField.fill('teacher@apboost.test');
    console.log('Email entered');

    // Find password field
    const passwordField = page.locator('input[type="password"]').first();
    await passwordField.click();
    await passwordField.fill('Teacher123!');
    console.log('Password entered');

    await takeScreenshot(page, '02_credentials_entered');

    console.log('=== STEP 3: Submit Login ===');
    // Click submit button
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login"), button:has-text("Log In")').first();
    await submitBtn.click();
    console.log('Login button clicked');

    // Wait for redirect away from login
    await page.waitForURL(/^(?!.*\/login).*$/, { timeout: 15000 });
    console.log('Redirected from login page to:', page.url());
    results.loginSuccess = true;

    await takeScreenshot(page, '03_post_login_redirect');

    console.log('=== STEP 4: Navigate to Teacher Dashboard ===');
    await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Wait for the page content to settle
    await page.waitForTimeout(3000);
    await takeScreenshot(page, '04_teacher_dashboard');

    // Verify teacher dashboard loaded
    const dashboardContent = await page.locator('h1, h2, [class*="dashboard"], [class*="teacher"]').first();
    const dashText = await dashboardContent.textContent().catch(() => '');
    console.log('Dashboard content found:', dashText);
    results.teacherDashboardLoaded = true;

    console.log('=== STEP 5: Scroll to Developer Tools ===');
    // Scroll to bottom to find Dev Tools section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '05_scrolled_to_bottom');

    // Look for Developer Tools section
    const devToolsSection = page.locator('text=Developer Tools, text=Dev Tools, text=developer tools').first();
    const devToolsVisible = await devToolsSection.isVisible().catch(() => false);

    if (devToolsVisible) {
      results.devToolsSectionFound = true;
      console.log('Developer Tools section found');
    } else {
      // Try scrolling more / looking for the section in different ways
      console.log('Developer Tools section not immediately visible, searching more...');
      const allText = await page.evaluate(() => document.body.innerText);
      if (allText.includes('Developer Tools') || allText.includes('Dev Tools') || allText.includes('Seed')) {
        results.devToolsSectionFound = true;
        console.log('Developer Tools content found in page text');
      } else {
        console.log('WARNING: Developer Tools section not found on page');
      }
    }

    console.log('=== STEP 6: Find and Click Seed Button ===');
    // Look for the seed button
    const seedBtn = page.locator('button:has-text("Seed Full Test Data"), button:has-text("Seed"), button:has-text("seed")').first();
    const seedBtnVisible = await seedBtn.isVisible().catch(() => false);

    if (seedBtnVisible) {
      results.seedButtonFound = true;
      console.log('Seed button found');
      await seedBtn.scrollIntoViewIfNeeded();
      await takeScreenshot(page, '06_seed_button_visible');

      await seedBtn.click();
      results.seedClicked = true;
      console.log('Seed button clicked');

      // Wait for success message
      await page.waitForTimeout(5000); // Give it time to seed

      // Look for success message
      const successMsg = page.locator('text=Seeded, text=success, text=✓').first();
      const successVisible = await successMsg.isVisible().catch(() => false);

      // Check page text for success message
      const pageTextAfterSeed = await page.evaluate(() => document.body.innerText);

      if (pageTextAfterSeed.includes('Seeded') || pageTextAfterSeed.includes('seeded') || pageTextAfterSeed.includes('success')) {
        results.seedSuccessMessageFound = true;
        // Extract the success text
        const match = pageTextAfterSeed.match(/Seeded[^\n]*/i);
        results.seedSuccessText = match ? match[0] : 'Success message found';
        console.log('Seed success message found:', results.seedSuccessText);
      } else {
        console.log('WARNING: Seed success message not found');
        console.log('Page text after seed (first 500 chars):', pageTextAfterSeed.substring(0, 500));
      }

      await takeScreenshot(page, '07_after_seed_click');

      // Wait more and check again
      await page.waitForTimeout(3000);
      const pageTextFinal = await page.evaluate(() => document.body.innerText);
      if (!results.seedSuccessMessageFound && (pageTextFinal.includes('Seeded') || pageTextFinal.includes('seeded'))) {
        results.seedSuccessMessageFound = true;
        const match = pageTextFinal.match(/Seeded[^\n]*/i);
        results.seedSuccessText = match ? match[0] : 'Success message found';
        console.log('Seed success message found (delayed):', results.seedSuccessText);
      }

      await takeScreenshot(page, '08_seed_complete');

    } else {
      console.log('ERROR: Seed button not found. Searching entire page for any seed-related elements...');
      // Get all buttons
      const allButtons = await page.locator('button').allTextContents();
      console.log('All buttons on page:', allButtons);
      results.seedButtonFound = false;
    }

    console.log('=== STEP 7: Verify Test Cards ===');
    // Scroll to top to see test cards
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Look for test cards in "My Tests" section
    const testCards = page.locator('[class*="card"], [class*="test-card"]').all();
    const cardCount = (await testCards).length;

    // Also check for specific test names
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasMicro = pageText.includes('Micro') || pageText.includes('micro');
    const hasMacro = pageText.includes('Macro') || pageText.includes('macro');
    const hasCalc = pageText.includes('Calc') || pageText.includes('calc');

    console.log('Test content check - Micro:', hasMicro, '| Macro:', hasMacro, '| Calc:', hasCalc);

    if (hasMicro || hasMacro || hasCalc) {
      results.testCardsFound = true;
      results.testCardCount = [hasMicro, hasMacro, hasCalc].filter(Boolean).length;
      console.log(`Test cards/content found: ${results.testCardCount} tests visible`);
    }

    await takeScreenshot(page, '09_test_cards_visible');

    // Scroll down to check dev tools section appearance
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await takeScreenshot(page, '10_final_state');

  } catch (error) {
    console.error('ERROR during B0 audit:', error.message);
    results.error = error.message;
    await takeScreenshot(page, 'ERROR_state').catch(() => {});
  } finally {
    await browser.close();
  }

  // Determine verdict
  if (!results.loginSuccess) {
    results.verdict = 'BLOCKER - Login failed';
  } else if (!results.seedButtonFound) {
    results.verdict = 'FAIL - Seed button not found';
  } else if (!results.seedClicked) {
    results.verdict = 'FAIL - Could not click seed button';
  } else if (!results.seedSuccessMessageFound) {
    results.verdict = 'PARTIAL - Seeded but success message not confirmed';
  } else if (!results.testCardsFound) {
    results.verdict = 'PARTIAL - Seed completed but test cards not verified';
  } else {
    results.verdict = 'PASS';
  }

  console.log('\n=== B0 AUDIT RESULTS ===');
  console.log(JSON.stringify(results, null, 2));

  // Write results to file
  const resultsFile = path.join(__dirname, '..', 'src', 'apBoost', 'criteria_audit', 'playwright_reports', 'b0_audit_results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log('\nResults written to:', resultsFile);

  return results;
}

runB0Audit().catch(console.error);
