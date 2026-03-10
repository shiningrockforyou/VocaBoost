/**
 * B11 Highlighter Color Check - checking for raw Tailwind in active test session
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/b11_fresh');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      consoleMessages.push({ type: msg.type(), text: msg.text(), url: page.url() });
    }
  });

  // Login
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', 'teacher@apboost.test');
  await page.fill('input[type="password"]', 'Teacher123!');
  await page.keyboard.press('Enter');

  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 15000 });
  console.log('Logged in. URL:', page.url());

  // Go to test session - Calc AB (has math/LaTeX questions)
  await page.goto(`${BASE_URL}/ap/test/test_calc_ab_full_1`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);
  console.log('Test session URL:', page.url());

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'x01_test_instruction.png'), fullPage: true });

  // Check for highlighter colors in instruction screen
  const instructionViolations = await page.evaluate(() => {
    const violations = [];
    for (const el of document.querySelectorAll('[class]')) {
      for (const cls of el.classList) {
        if (/^bg-(yellow|green|pink|blue)-\d+$/.test(cls)) {
          violations.push({ class: cls, tag: el.tagName });
        }
      }
    }
    return violations;
  });
  console.log('Instruction screen violations:', instructionViolations);

  // Try to click Begin Test
  const beginBtn = page.locator('button:text("Begin Test"), button:text("Resume Test")');
  if (await beginBtn.count() > 0) {
    await beginBtn.first().click();
    await page.waitForTimeout(3000);
    console.log('In test session. URL:', page.url());

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'x01_test_active.png'), fullPage: true });

    // Check for highlighter colors in active test
    const testViolations = await page.evaluate(() => {
      const violations = [];
      for (const el of document.querySelectorAll('[class]')) {
        for (const cls of el.classList) {
          if (/^bg-(yellow|green|pink|blue)-\d+$/.test(cls)) {
            violations.push({
              class: cls,
              tag: el.tagName,
              parent: el.parentElement ? el.parentElement.tagName : 'none'
            });
          }
        }
      }
      return violations;
    });
    console.log('Active test violations:', JSON.stringify(testViolations, null, 2));

    // Also check toolbar specifically
    const toolbarEl = await page.$('[class*="toolbar"], [class*="Toolbar"], [data-testid*="toolbar"]');
    if (toolbarEl) {
      console.log('Toolbar element found');
      const toolbarHtml = await toolbarEl.innerHTML();
      console.log('Toolbar HTML (first 500):', toolbarHtml.substring(0, 500));
    } else {
      console.log('No toolbar element found in DOM');
    }

  } else {
    console.log('No Begin/Resume Test button found');
    const btns = await page.$$('button');
    for (const btn of btns.slice(0, 10)) {
      console.log('Button:', await btn.textContent());
    }
  }

  // Additional X-03 checks: What console errors showed up?
  console.log('\nConsole messages during this run:');
  consoleMessages.forEach(m => console.log(`  [${m.type}] ${m.url}: ${m.text.substring(0, 200)}`));

  await browser.close();
}

main().catch(console.error);
