const { chromium } = require('playwright');
const fs = require('fs');

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B0';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function debugLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  try {
    console.log('Navigating to login page...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle', timeout: 30000 });

    const pageTitle = await page.title();
    const url = page.url();
    console.log('URL:', url);
    console.log('Title:', pageTitle);

    // Get the page structure
    const pageHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));
    console.log('Page HTML (first 2000 chars):\n', pageHTML);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug_01_login_page.png`, fullPage: true });

    // Find login form fields
    const inputs = await page.$$eval('input', inputs => inputs.map(i => ({
      type: i.type,
      name: i.name,
      id: i.id,
      placeholder: i.placeholder,
      className: i.className,
    })));
    console.log('\nInputs found:', JSON.stringify(inputs, null, 2));

    const buttons = await page.$$eval('button', btns => btns.map(b => ({
      type: b.type,
      text: b.textContent.trim(),
      className: b.className,
    })));
    console.log('\nButtons found:', JSON.stringify(buttons, null, 2));

    // Fill in credentials
    console.log('\nFilling in email...');
    await page.fill('input[type="email"]', 'teacher@apboost.test');

    console.log('Filling in password...');
    await page.fill('input[type="password"]', 'Teacher123!');

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug_02_filled.png`, fullPage: true });

    // Click submit
    console.log('Clicking submit...');
    await page.click('button[type="submit"]');

    // Wait and observe
    await page.waitForTimeout(5000);
    const urlAfterLogin = page.url();
    console.log('URL after login attempt:', urlAfterLogin);

    const bodyText = await page.evaluate(() => document.body.textContent.trim().substring(0, 500));
    console.log('Body text:', bodyText);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug_03_after_submit.png`, fullPage: true });

    // Check for errors
    const errorMsg = await page.evaluate(() => {
      const errEl = document.querySelector('[class*="error"], [class*="Error"], .text-red-500, .text-error');
      return errEl ? errEl.textContent.trim() : null;
    });
    console.log('Error message:', errorMsg);

    // If still on login page, try navigating directly to /ap/teacher
    if (urlAfterLogin.includes('login') || urlAfterLogin === 'http://localhost:5173/') {
      console.log('\nStill on login/root page. Trying direct navigation to /ap/teacher...');
      await page.goto('http://localhost:5173/ap/teacher', { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      const newUrl = page.url();
      const newBody = await page.evaluate(() => document.body.textContent.trim().substring(0, 500));
      console.log('URL after direct nav:', newUrl);
      console.log('Body:', newBody);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug_04_direct_nav.png`, fullPage: true });
    }

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/debug_error.png`, fullPage: true }).catch(() => {});
  } finally {
    console.log('\nConsole messages:');
    consoleMessages.forEach(m => console.log(`  [${m.type}] ${m.text}`));
    await browser.close();
  }
}

debugLogin().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
