const { chromium } = require('playwright');
const fs = require('fs');

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B0';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function testApRoutes() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  try {
    // First log in as teacher
    console.log('Logging in...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.fill('input[type="email"]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.click('button[type="submit"]');

    // Wait for main app to load
    await page.waitForTimeout(5000);
    const urlAfterLogin = page.url();
    console.log('URL after login:', urlAfterLogin);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/ap_01_after_login.png`, fullPage: true });

    // Now try navigating to /ap/teacher with domcontentloaded (not networkidle)
    console.log('Navigating to /ap/teacher...');
    await page.goto('http://localhost:5173/ap/teacher', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);

    const apTeacherUrl = page.url();
    console.log('URL at /ap/teacher:', apTeacherUrl);

    const bodyText = await page.evaluate(() => document.body.textContent.trim().substring(0, 1000));
    console.log('Body text:', bodyText);

    await page.screenshot({ path: `${SCREENSHOTS_DIR}/ap_02_ap_teacher.png`, fullPage: true });

    // Check if page is loading or has content
    const hasLoadingIndicator = await page.evaluate(() => {
      const text = document.body.textContent;
      return text.includes('Loading') || text.includes('loading') || text.includes('spinner');
    });
    console.log('Has loading indicator:', hasLoadingIndicator);

    // Get current page title and h1
    const title = await page.title();
    const h1 = await page.textContent('h1').catch(() => 'no h1');
    console.log('Title:', title);
    console.log('H1:', h1);

    // Check console errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    console.log('\nConsole errors:', errors.length);
    errors.forEach(e => console.log(' -', e.text));

    // Try navigating to /ap (student dashboard)
    console.log('\nNavigating to /ap...');
    await page.goto('http://localhost:5173/ap', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(5000);

    const apUrl = page.url();
    const apBody = await page.evaluate(() => document.body.textContent.trim().substring(0, 500));
    console.log('URL at /ap:', apUrl);
    console.log('Body:', apBody);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/ap_03_ap_dashboard.png`, fullPage: true });

  } catch (err) {
    console.error('Error:', err.message);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/ap_error.png`, fullPage: true }).catch(() => {});
  } finally {
    console.log('\nAll console messages:');
    consoleMessages.slice(-20).forEach(m => console.log(`  [${m.type}] ${m.text.substring(0, 200)}`));
    await browser.close();
  }
}

testApRoutes().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
