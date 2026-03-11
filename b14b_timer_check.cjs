const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  // Login
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  await page.waitForTimeout(2000);

  // Navigate to test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);

  // Check for error
  const b1 = await page.textContent('body');
  if (b1.includes('Something went wrong')) { console.log('ERROR:', b1.substring(0, 200)); await browser.close(); return; }

  // Begin test
  const ab = await page.$('button:has-text("Begin Test"), button:has-text("Resume Test")');
  if (ab) { await ab.click(); await page.waitForTimeout(3000); }

  // Navigate to review directly via navigator button
  const revBtn = await page.$('button:has-text("Review")');
  if (revBtn) { await revBtn.click(); await page.waitForTimeout(2000); }

  // Check review screen
  const body = await page.textContent('body');
  console.log('On review:', body.includes('Review Your Answers'));
  console.log('Timer in body:', body.match(/\d{1,2}:\d{2}/) ? body.match(/\d{1,2}:\d{2}/)[0] : 'NOT FOUND');

  // Full DOM inspection
  const timerInfo = await page.evaluate(() => {
    const allEls = document.querySelectorAll('*');
    const timerEls = [];
    for (const el of allEls) {
      if (el.className && typeof el.className === 'string' && el.className.includes('font-mono')) {
        timerEls.push({ cls: el.className, txt: el.textContent.trim(), tag: el.tagName });
      }
    }
    return timerEls;
  });
  console.log('font-mono elements:', JSON.stringify(timerInfo));

  // Check if timer-related elements exist
  const timerIconEls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).filter(el => el.textContent.includes('---')).map(el => ({ tag: el.tagName, txt: el.textContent.trim().substring(0, 30), cls: el.className ? el.className.substring(0, 50) : '' }));
  });
  console.log('Timer dash elements:', JSON.stringify(timerIconEls.slice(0, 5)));

  // Check review screen component props via React DevTools
  const reviewProps = await page.evaluate(() => {
    // Find the review screen component
    const reviewEl = document.querySelector('h1');
    if (reviewEl && reviewEl.textContent === 'Review Your Answers') {
      const parent = reviewEl.closest('[class]');
      return parent ? parent.innerHTML.substring(0, 500) : 'no parent';
    }
    return 'no review h1';
  });
  console.log('Review screen HTML snippet:', reviewProps);

  await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_retest_timer_debug.png' });
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
