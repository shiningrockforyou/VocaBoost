const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login as student5
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Logged in:', page.url());

  // Check dashboard
  await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_debug_01_dash.png' });
  const dash = await page.textContent('body');
  console.log('Dashboard:', dash.replace(/\s+/g, ' ').substring(0, 500));

  // Navigate to MACRO test (Not Started) instead
  await page.goto('http://localhost:5173/ap/test/test_macro_full_1');
  await page.waitForTimeout(4000);
  const macroBody = await page.textContent('body');
  if (macroBody.includes('Something went wrong')) { console.log('ERROR on macro test:', macroBody.substring(0, 200)); }
  console.log('Macro test body:', macroBody.replace(/\s+/g, ' ').substring(0, 400));
  await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_debug_02_macro.png' });

  // Check buttons
  const btns = await page.$$eval('button', bs => bs.map(b => b.textContent.replace(/\s+/g,' ').trim().substring(0,50)));
  console.log('Macro test buttons:', btns);

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
