// Quick targeted retest — just check if the error is still reproducible
// and capture the exact console sequence
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'b14e_retest_screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const RESULTS = [];
const CONSOLE_MSGS = [];

function log(msg) {
  console.log('[B14E-RETEST2] ' + msg);
  RESULTS.push(msg);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => {
    CONSOLE_MSGS.push({ type: msg.type(), text: msg.text(), url: page.url() });
  });
  page.on('pageerror', err => {
    CONSOLE_MSGS.push({ type: 'pageerror', text: err.message, url: page.url() });
  });

  // LOGIN
  log('Login...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await page.fill('input[type="email"]', 'student8@apboost.test');
  await page.fill('input[type="password"]', 'Student123!');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('domcontentloaded');
  await sleep(2500);
  log('Post-login URL: ' + page.url());

  // Navigate to test page
  log('Navigating to test page...');
  const consoleSnap = CONSOLE_MSGS.length;
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1', { waitUntil: 'domcontentloaded' });
  await sleep(5000);

  log('Test page URL: ' + page.url());

  // Take screenshot
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'retest2_01_test_page.png') });
  log('Screenshot: retest2_01_test_page.png');

  // Check DOM
  const bodyText = await page.locator('body').textContent().catch(() => '');
  log('Body contains "Something went wrong": ' + bodyText.includes('Something went wrong'));
  log('Body contains "scheduleFlush": ' + bodyText.includes('scheduleFlush'));
  log('Body contains "Resume Test": ' + bodyText.includes('Resume Test'));
  log('Body contains "Begin Test": ' + bodyText.includes('Begin Test'));
  log('Body contains "Cannot access": ' + bodyText.includes('Cannot access'));
  log('Body (first 200 chars): ' + bodyText.substring(0, 200).replace(/\s+/g, ' '));

  // DOM snapshot for detail
  const snapshot = await page.content();
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'retest2_dom.html'), snapshot.substring(0, 10000));

  // Check new console messages
  const newMsgs = CONSOLE_MSGS.slice(consoleSnap);
  const errors = newMsgs.filter(m => m.type === 'error' || m.type === 'pageerror');
  log('Console errors on test page nav: ' + errors.length);
  errors.forEach(e => log('  ERROR: ' + (e.text || '').substring(0, 300)));

  const startsWithErrs = newMsgs.filter(m => m.text && m.text.includes('startsWith'));
  log('code.startsWith errors: ' + startsWithErrs.length);

  const scheduleFlushErrs = newMsgs.filter(m => m.text && m.text.includes('scheduleFlush'));
  log('scheduleFlush errors: ' + scheduleFlushErrs.length);

  // Try clicking Try Again if error boundary is shown
  const tryAgainBtn = page.locator('button:has-text("Try Again")').first();
  if (await tryAgainBtn.count() > 0) {
    log('Error boundary visible — clicking Try Again...');
    await tryAgainBtn.click();
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'retest2_02_try_again.png') });

    const bodyAfterRetry = await page.locator('body').textContent().catch(() => '');
    log('After Try Again — "Something went wrong" still: ' + bodyAfterRetry.includes('Something went wrong'));
    log('After Try Again — "Resume Test": ' + bodyAfterRetry.includes('Resume Test'));
    log('After Try Again — "Begin Test": ' + bodyAfterRetry.includes('Begin Test'));

    const errorsAfterRetry = CONSOLE_MSGS.filter(m => m.type === 'error' || m.type === 'pageerror');
    log('Total console errors after retry: ' + errorsAfterRetry.length);
    errorsAfterRetry.forEach(e => log('  ERROR: ' + (e.text || '').substring(0, 200)));
  } else {
    log('No Try Again button — error boundary NOT shown (good)');
  }

  // Try hard reload
  log('Trying hard reload (page.reload)...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(4000);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'retest2_03_after_reload.png') });

  const bodyAfterReload = await page.locator('body').textContent().catch(() => '');
  log('After reload — "Something went wrong": ' + bodyAfterReload.includes('Something went wrong'));
  log('After reload — "Resume Test": ' + bodyAfterReload.includes('Resume Test'));
  log('After reload — "Begin Test": ' + bodyAfterReload.includes('Begin Test'));

  const allErrors = CONSOLE_MSGS.filter(m => m.type === 'error' || m.type === 'pageerror');
  log('All console errors in session: ' + allErrors.length);
  allErrors.forEach(e => log('  [' + (e.url || '').split('/').pop().substring(0, 20) + '] ERROR: ' + (e.text || '').substring(0, 200)));

  const output = { results: RESULTS, consoleMsgs: CONSOLE_MSGS, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, 'b14e_retest2_results.json'), JSON.stringify(output, null, 2));
  log('Done.');

  await browser.close();
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
