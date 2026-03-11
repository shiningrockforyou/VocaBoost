/**
 * Quick login test to verify which student accounts work
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:5173';
const accounts = [
  { email: 'student7@apboost.test', password: 'Student123!' },
  { email: 'student@apboost.test', password: 'Student123!' },
  { email: 'teacher@apboost.test', password: 'Teacher123!' },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  for (const account of accounts) {
    console.log(`\nTesting login: ${account.email}`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text().substring(0, 100));
    });

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(1500);

    await page.locator('input[type="email"]').first().fill(account.email);
    await page.locator('input[type="password"]').first().fill(account.password);
    await page.locator('input[type="password"]').first().press('Enter');
    await sleep(4000);

    const url = page.url();
    const bodyText = await page.innerText('body').catch(() => '');
    const loginFailed = url.includes('/login');
    const loginError = bodyText.match(/invalid|incorrect|not found|wrong/i);

    console.log(`  URL: ${url}`);
    console.log(`  Login: ${loginFailed ? 'FAILED' : 'SUCCESS'}`);
    if (loginError) console.log(`  Error text: ${loginError[0]}`);
    if (errors.length > 0) console.log(`  Console errors: ${errors.slice(0, 3).join('; ')}`);

    await context.close();
  }

  await browser.close();
  console.log('\nDone');
})();
