const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '../src/apBoost/criteria_audit/playwright_reports/screenshots_b9');

async function run() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[console error] ${msg.text()}`);
  });

  console.log('Navigating to login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  console.log('Current URL:', page.url());

  await page.screenshot({ path: `${SCREENSHOT_DIR}/login_debug_01.png`, fullPage: true });

  // Inspect the form
  const emailInputs = await page.locator('input[type="email"]').all();
  const passwordInputs = await page.locator('input[type="password"]').all();
  const allInputs = await page.locator('input').all();
  console.log(`Email inputs: ${emailInputs.length}`);
  console.log(`Password inputs: ${passwordInputs.length}`);
  console.log(`All inputs: ${allInputs.length}`);

  for (let i = 0; i < allInputs.length; i++) {
    const type = await allInputs[i].getAttribute('type');
    const placeholder = await allInputs[i].getAttribute('placeholder');
    const name = await allInputs[i].getAttribute('name');
    console.log(`  Input ${i}: type=${type}, placeholder=${placeholder}, name=${name}`);
  }

  const buttons = await page.locator('button').all();
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    const type = await buttons[i].getAttribute('type');
    console.log(`  Button ${i}: type=${type}, text="${text?.trim()}"`);
  }

  // Fill the form
  if (emailInputs.length > 0) {
    await emailInputs[0].fill('teacher@apboost.test');
    console.log('Email filled');
  }
  if (passwordInputs.length > 0) {
    await passwordInputs[0].fill('Teacher123!');
    console.log('Password filled');
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/login_debug_02_filled.png`, fullPage: true });

  // Submit
  const submitBtn = await page.locator('button[type="submit"]').first();
  console.log('Clicking submit...');
  await submitBtn.click();

  // Wait and watch for URL changes
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(500);
    console.log(`  [${i * 500}ms] URL: ${page.url()}`);
    if (page.url().includes('/ap') || page.url().includes('/teacher') || page.url().includes('/dashboard')) {
      console.log('  Found AP route!');
      break;
    }
  }

  await page.screenshot({ path: `${SCREENSHOT_DIR}/login_debug_03_after.png`, fullPage: true });
  console.log('Final URL:', page.url());

  // Check page content
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page content snippet:', bodyText);

  await browser.close();
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
