const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', function(msg) {
    if (msg.type() === 'error') consoleErrors.push({ url: page.url(), msg: msg.text().substring(0, 300) });
  });
  page.on('pageerror', function(err) {
    consoleErrors.push({ url: page.url(), type: 'page', msg: err.message.substring(0, 300) });
  });

  // Login
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(function() {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Logged in. URL:', page.url());

  // Navigate to test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);

  var body = await page.textContent('body');
  var hasError = body.includes('Something went wrong');
  console.log('Has error boundary:', hasError);
  if (hasError) {
    console.log('Body:', body.substring(0, 300));
  } else {
    console.log('Test page loaded OK. Body snippet:', body.substring(0, 200).replace(/\s+/g, ' '));
  }

  console.log('\n=== CONSOLE ERRORS ===');
  consoleErrors.forEach(function(e) {
    console.log('[' + (e.type || 'console') + ']', e.msg.substring(0, 200));
  });

  await browser.close();
})().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
