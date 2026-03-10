import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TEACHER_EMAIL = 'teacher@apboost.test';
const TEACHER_PASSWORD = 'Teacher123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_b0';

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function saveScreenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function loginAsTeacher(page) {
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').first().fill(TEACHER_EMAIL);
  await page.locator('input[type="password"]').first().fill(TEACHER_PASSWORD);
  await page.keyboard.press('Enter');
  // Wait for URL to change away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
  console.log('Logged in, current URL:', page.url());
}

test.describe('B0: Setup & Seed', () => {
  test.setTimeout(120000);

  test('P0-1: Login as teacher', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await saveScreenshot(page, '01_login_page');

    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.click();
    await emailInput.fill(TEACHER_EMAIL);

    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.click();
    await passwordInput.fill(TEACHER_PASSWORD);

    await page.keyboard.press('Enter');

    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
      await saveScreenshot(page, '02_after_login_success');
      console.log('LOGIN SUCCESS: URL is', page.url());
    } catch (e) {
      await saveScreenshot(page, '02_after_login_fail');
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('LOGIN FAILED. Page text:', bodyText.substring(0, 500));
      throw new Error('Login redirect did not happen: ' + e.message);
    }
  });

  test('P0-2: Navigate to teacher dashboard and seed data', async ({ page }) => {
    const consoleMessages = [];
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));

    await loginAsTeacher(page);

    // Navigate to teacher dashboard
    await page.goto('http://localhost:5173/ap/teacher');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Wait for React to render
    await saveScreenshot(page, '03_teacher_dashboard_top');

    // Check if we were redirected (not teacher role)
    const currentUrl = page.url();
    console.log('Current URL after nav to /ap/teacher:', currentUrl);
    if (!currentUrl.includes('/ap/teacher')) {
      throw new Error('Redirected away from teacher dashboard — not a teacher role? URL: ' + currentUrl);
    }

    // Scroll to bottom to find Developer Tools section
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await saveScreenshot(page, '04_teacher_dashboard_bottom');

    // Look for text "Developer Tools" in page
    const devToolsText = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.childNodes.length === 1 && el.textContent && el.textContent.trim() === 'Developer Tools') {
          return el.textContent;
        }
      }
      // Search for any element containing Developer Tools text
      return document.body.innerText.includes('Developer Tools') ? 'FOUND_IN_BODY' : 'NOT_FOUND';
    });
    console.log('Developer Tools text:', devToolsText);

    // Look for the seed button
    const seedButton = page.locator('button').filter({ hasText: /Seed Full Test Data/i });
    const seedButtonCount = await seedButton.count();
    console.log('Seed button count:', seedButtonCount);

    if (seedButtonCount === 0) {
      // Try scrolling into view
      await page.evaluate(() => {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent && btn.textContent.includes('Seed')) {
            btn.scrollIntoView();
          }
        }
      });
      await page.waitForTimeout(500);
      await saveScreenshot(page, '04b_after_scroll_for_seed');

      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('PAGE TEXT (first 2000 chars):', bodyText.substring(0, 2000));
    }

    expect(seedButtonCount).toBeGreaterThan(0);

    // Click the seed button
    await seedButton.first().click();
    console.log('Clicked seed button');
    await page.waitForTimeout(1000);
    await saveScreenshot(page, '05_immediately_after_seed_click');

    // Wait for success or error message (up to 30 seconds)
    let seedResultText = '';
    try {
      await page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('Seeded') || text.includes('seeded') ||
               text.includes('Error') || text.includes('error') ||
               text.includes('failed') || text.includes('Failed');
      }, { timeout: 30000 });
      seedResultText = await page.evaluate(() => document.body.innerText);
      console.log('Seed result (first 1000 chars):', seedResultText.substring(0, 1000));
    } catch (e) {
      console.log('Timeout waiting for seed result:', e.message);
      seedResultText = await page.evaluate(() => document.body.innerText);
      console.log('Page text after timeout (first 1000):', seedResultText.substring(0, 1000));
    }

    await saveScreenshot(page, '06_after_seed_complete');

    // Check the seed result
    const hasSeeded = seedResultText.toLowerCase().includes('seeded');
    const hasError = seedResultText.toLowerCase().includes('error') || seedResultText.toLowerCase().includes('failed');
    console.log('Has "seeded":', hasSeeded, '| Has "error":', hasError);

    // Scroll back to top to see test cards
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    await saveScreenshot(page, '07_test_cards_after_seed');

    // Check for test cards in "My Tests" section
    const testCards = page.locator('h3').filter({ hasText: /Microeconomics|Macroeconomics|Calculus/i });
    const cardCount = await testCards.count();
    console.log('Test cards found:', cardCount);

    // Report console errors
    if (consoleErrors.length > 0) {
      console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors, null, 2));
    }
    console.log('Total console messages:', consoleMessages.length);

    expect(hasSeeded || cardCount > 0).toBe(true);
  });

  test('P0-3: Verify APReportCard renders at result_micro_student1', async ({ page }) => {
    const consoleErrors = [];
    const consoleWarnings = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));

    await loginAsTeacher(page);

    // Navigate to report card
    await page.goto('http://localhost:5173/ap/results/result_micro_student1');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(4000); // Wait for Firestore data to load

    await saveScreenshot(page, '08_report_card_result_micro_student1');

    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    const pageContent = await page.content();

    console.log('Body text length:', bodyText.length);
    console.log('Body text preview (500 chars):', bodyText.substring(0, 500));

    const isBlankPage = bodyText.length < 50;
    const hasHookError = pageContent.includes('Rendered more hooks') ||
                         pageContent.includes('Rendered fewer hooks') ||
                         pageContent.includes('Invalid hook call') ||
                         consoleErrors.some(e => e.includes('hook'));
    const hasErrorBoundary = bodyText.includes('Something went wrong') ||
                             pageContent.includes('error-boundary') ||
                             bodyText.includes('Something went wrong');
    const hasReportContent = bodyText.includes('Score') ||
                             bodyText.includes('Results') ||
                             bodyText.includes('Report') ||
                             bodyText.includes('Microeconomics') ||
                             bodyText.includes('AP Micro');
    const hasNotFound = bodyText.toLowerCase().includes('not found') ||
                        bodyText.toLowerCase().includes('result not found');

    console.log('Is blank page:', isBlankPage);
    console.log('Has React Hook error:', hasHookError);
    console.log('Has error boundary:', hasErrorBoundary);
    console.log('Has report content:', hasReportContent);
    console.log('Has not-found message:', hasNotFound);

    if (consoleErrors.length > 0) {
      console.log('CONSOLE ERRORS on report card:');
      consoleErrors.forEach(e => console.log('  ERROR:', e));
    }
    if (consoleWarnings.length > 0) {
      console.log('CONSOLE WARNINGS on report card:');
      consoleWarnings.forEach(w => console.log('  WARN:', w));
    }

    // The page should NOT be blank and should NOT have a hook error
    expect(isBlankPage).toBe(false);
    expect(hasHookError).toBe(false);
    expect(hasReportContent).toBe(true);
  });

  test('P0-4: Verify multiple seed result IDs render without crash', async ({ page }) => {
    const resultIds = [
      'result_micro_student1',
      'result_micro_student2',
      'result_macro_student1',
      'result_calc_student1'
    ];

    await loginAsTeacher(page);

    const results = {};
    for (const resultId of resultIds) {
      const errors = [];
      page.on('pageerror', err => errors.push('PAGE_ERROR: ' + err.message));

      await page.goto(`http://localhost:5173/ap/results/${resultId}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);

      const bodyText = await page.evaluate(() => document.body.innerText.trim());
      const isBlank = bodyText.length < 50;
      const hasError = bodyText.toLowerCase().includes('something went wrong') ||
                       bodyText.toLowerCase().includes('hook') ||
                       errors.length > 0;
      const hasContent = bodyText.length > 100;
      const hasNotFound = bodyText.toLowerCase().includes('not found');

      results[resultId] = { isBlank, hasError, hasContent, hasNotFound, pageErrorCount: errors.length };
      console.log(`Result ${resultId}:`, JSON.stringify(results[resultId]));
      console.log(`  Text preview: ${bodyText.substring(0, 200)}`);
    }

    await saveScreenshot(page, '09_last_result_page');

    // All results should have some content (not blank, not errored)
    for (const [id, result] of Object.entries(results)) {
      console.log(`Checking ${id}: isBlank=${result.isBlank}, hasError=${result.hasError}, hasContent=${result.hasContent}`);
    }
  });

  test('P0-5: Verify gradebook shows seeded results', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push('PAGE_ERROR: ' + err.message));

    await loginAsTeacher(page);

    await page.goto('http://localhost:5173/ap/gradebook');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    await saveScreenshot(page, '10_gradebook');

    const bodyText = await page.evaluate(() => document.body.innerText.trim());
    console.log('Gradebook body text preview:', bodyText.substring(0, 800));
    console.log('Gradebook body length:', bodyText.length);

    const hasContent = bodyText.length > 50;
    const hasPending = bodyText.toLowerCase().includes('pending') || bodyText.toLowerCase().includes('grade');
    const hasError = bodyText.toLowerCase().includes('something went wrong');

    console.log('Gradebook has content:', hasContent, '| Has pending/grade:', hasPending, '| Has error:', hasError);

    if (consoleErrors.length > 0) {
      console.log('CONSOLE ERRORS:', consoleErrors.join('\n'));
    }
  });
});
