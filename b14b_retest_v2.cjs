const { chromium } = require('playwright');
const fs = require('fs');

async function screenshot(page, name) {
  const path = `src/apBoost/criteria_audit/playwright_reports/b14b_retest_${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`Screenshot: ${name}`);
  return path;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  const consoleErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), type: 'console_error', msg: msg.text().substring(0, 300) });
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push({ url: page.url(), type: 'pageerror', msg: err.message.substring(0, 300) });
  });

  // === LOGIN ===
  console.log('=== LOGIN ===');
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Login URL:', page.url());
  await screenshot(page, '01_dashboard');

  // === NAVIGATE TO MICRO TEST (already Completed - try anyway) ===
  console.log('\n=== NAVIGATING TO MICRO TEST ===');
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  console.log('Micro test URL:', page.url());
  
  const bodyText = await page.textContent('body');
  console.log('Micro test body:', bodyText.replace(/\s+/g, ' ').substring(0, 500));
  await screenshot(page, '02_micro_instruction');
  
  // Check if instruction screen shows "Resume Test" or "Start Test" or redirected
  const resumeBtn = await page.$('button:has-text("Resume")');
  const startBtn = await page.$('button:has-text("Begin"), button:has-text("Start")');
  
  console.log('Has Resume button:', !!resumeBtn);
  console.log('Has Start button:', !!startBtn);
  
  // Console errors so far (for test 1 - logError crash)
  console.log('\n=== VERIFY 1 RESULT: Console errors on test page ===');
  console.log('Errors:', JSON.stringify(consoleErrors.filter(e => e.msg.includes('startsWith') || e.msg.includes('code.startsWith'))));
  console.log('All errors so far:', consoleErrors.length);
  
  if (resumeBtn || startBtn) {
    const btn = resumeBtn || startBtn;
    const btnText = await btn.textContent();
    console.log('Clicking:', btnText);
    await btn.click();
    await page.waitForTimeout(3000);
    console.log('After button click URL:', page.url());
    await screenshot(page, '03_after_start');
    
    const bodyAfterStart = await page.textContent('body');
    console.log('Body after start:', bodyAfterStart.replace(/\s+/g, ' ').substring(0, 500));
  }

  await browser.close();
  
  console.log('\n=== ALL CONSOLE ERRORS ===');
  consoleErrors.forEach(e => console.log('-', e.type, ':', e.msg.substring(0, 200)));
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
