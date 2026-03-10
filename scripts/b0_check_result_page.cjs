const { chromium } = require('playwright');
const fs = require('fs');

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B0';

async function checkResultPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  try {
    // Log in first
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.fill('input[type="email"]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    // Navigate to result page
    console.log('Navigating to result_micro_student1...');
    await page.goto('http://localhost:5173/ap/results/result_micro_student1', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);

    const url = page.url();
    console.log('URL:', url);

    // Get full page HTML
    const htmlContent = await page.evaluate(() => document.body.innerHTML.substring(0, 5000));
    console.log('HTML content (first 5000):\n', htmlContent);

    const textContent = await page.evaluate(() => document.body.textContent.trim());
    console.log('Text content (first 1000):', textContent.substring(0, 1000));

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_result_page_full.png`, fullPage: true });

    // Check for error boundaries or crash indicators
    const errorFallback = await page.evaluate(() => {
      const errEls = document.querySelectorAll('[class*="error"], [class*="Error"]');
      return Array.from(errEls).map(el => el.textContent.trim()).filter(t => t.length > 0);
    });
    console.log('\nError elements:', errorFallback);

    // Wait for more time and check again
    await page.waitForTimeout(5000);
    const textAfterWait = await page.evaluate(() => document.body.textContent.trim());
    console.log('\nText after 10s wait (first 1000):', textAfterWait.substring(0, 1000));

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_result_page_after_wait.png`, fullPage: true });

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/b0_result_error.png`, fullPage: true }).catch(() => {});
  } finally {
    console.log('\n--- Console Messages ---');
    consoleMessages.forEach(m => {
      if (m.type !== 'debug' && m.type !== 'info') {
        console.log(`[${m.type}] ${m.text.substring(0, 500)}`);
      }
    });
    await browser.close();
  }
}

checkResultPage().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
