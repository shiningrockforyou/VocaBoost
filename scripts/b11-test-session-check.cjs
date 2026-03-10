/**
 * B11 Test Session Check - detailed examination of test session state and toolbar
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
    consoleMessages.push({ type: msg.type(), text: msg.text().substring(0, 200), url: page.url() });
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

  // Go to Calc test
  await page.goto(`${BASE_URL}/ap/test/test_calc_ab_full_1`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Click Begin Test
  const beginBtn = page.locator('button:text("Begin Test"), button:text("Resume Test")');
  if (await beginBtn.count() > 0) {
    await beginBtn.first().click();
    await page.waitForTimeout(4000);
  }

  console.log('URL after starting test:', page.url());

  // Take screenshot of the test session
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'x01_test_session_full.png'), fullPage: true });

  // Check what's on the page
  const pageState = await page.evaluate(() => {
    // Find all buttons
    const btns = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent.trim().substring(0, 50),
      classes: Array.from(b.classList).slice(0, 5).join(' ')
    }));

    // Find toolbar-related elements
    const toolElements = Array.from(document.querySelectorAll('[class*="tool"], [class*="Tool"]')).map(el => ({
      tag: el.tagName,
      classes: Array.from(el.classList).slice(0, 5).join(' '),
      text: el.textContent.trim().substring(0, 30)
    }));

    // Check for color swatches
    const colorSwatches = Array.from(document.querySelectorAll('[class]')).filter(el => {
      return Array.from(el.classList).some(cls => /bg-(yellow|green|pink|blue)-\d+/.test(cls));
    }).map(el => ({
      classes: Array.from(el.classList).join(' '),
      tag: el.tagName
    }));

    return {
      buttons: btns.slice(0, 20),
      toolElements: toolElements.slice(0, 10),
      colorSwatches,
      url: window.location.href,
      bodyText: document.body.textContent.substring(0, 300)
    };
  });

  console.log('Page state:');
  console.log('URL:', pageState.url);
  console.log('Buttons:', JSON.stringify(pageState.buttons, null, 2));
  console.log('Tool elements:', JSON.stringify(pageState.toolElements, null, 2));
  console.log('Color swatch violations:', JSON.stringify(pageState.colorSwatches, null, 2));

  // Check if the Highlighter tool button is visible and try to click it
  const highlighterBtn = page.locator('button:has-text("Highlight"), [aria-label*="Highlight"], [title*="Highlight"]');
  const highlighterCount = await highlighterBtn.count();
  console.log('\nHighlighter button count:', highlighterCount);

  if (highlighterCount > 0) {
    await highlighterBtn.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'x01_highlighter_open.png'), fullPage: true });

    // Now check for violations with highlighter open
    const afterHighlightViolations = await page.evaluate(() => {
      const violations = [];
      for (const el of document.querySelectorAll('[class]')) {
        for (const cls of el.classList) {
          if (/^bg-(yellow|green|pink|blue)-\d+$/.test(cls)) {
            violations.push({ class: cls, tag: el.tagName, classes: Array.from(el.classList).join(' ') });
          }
        }
      }
      return violations;
    });
    console.log('Violations with highlighter open:', JSON.stringify(afterHighlightViolations, null, 2));
  }

  // Also check for any toolbar icons visible
  const toolbarArea = page.locator('[class*="toolbar"], [class*="tools"]');
  const toolbarCount = await toolbarArea.count();
  console.log('\nToolbar elements found:', toolbarCount);

  // Check console errors specifically
  const errors = consoleMessages.filter(m => m.type === 'error');
  const warnings = consoleMessages.filter(m => m.type === 'warn');
  console.log('\nConsole errors:', errors.length);
  console.log('Console warnings:', warnings.length);
  if (errors.length > 0) {
    errors.slice(0, 5).forEach(e => console.log(`  ERROR: ${e.text.substring(0, 200)}`));
  }

  await browser.close();
}

main().catch(console.error);
