const { chromium } = require('playwright');
const fs = require('fs');

async function ss(page, name) {
  const path = `src/apBoost/criteria_audit/playwright_reports/b14b_retest_${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`[SS] ${name}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  const consoleErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), type: 'console_error', msg: msg.text().substring(0, 400) });
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push({ url: page.url(), type: 'pageerror', msg: err.message.substring(0, 400) });
  });

  // === LOGIN ===
  console.log('\n=== [1] LOGIN ===');
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Login URL:', page.url(), 'PASS:', page.url().includes('/ap'));
  await ss(page, '01_dashboard');

  // === NAVIGATE TO MICRO TEST ===
  console.log('\n=== [2] NAVIGATE TO MICRO TEST ===');
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);
  console.log('Test URL:', page.url());
  
  const bodyText = await page.textContent('body');
  console.log('Page body:', bodyText.replace(/\s+/g, ' ').substring(0, 400));
  await ss(page, '02_micro_instruction');

  // Check for error boundary
  const hasError = bodyText.includes('Something went wrong') || bodyText.includes('unexpected error');
  console.log('Has error boundary:', hasError);
  
  // Check console errors after navigating to test
  const errorsOnTestPage = [...consoleErrors];
  const scheduleFlushError = consoleErrors.find(e => e.msg.includes('scheduleFlush'));
  const codeStartsWithError = consoleErrors.find(e => e.msg.includes('code.startsWith'));
  
  console.log('\n=== VERIFY 1: B14B-NEW-001 logError crash ===');
  console.log('scheduleFlush TDZ error present:', !!scheduleFlushError);
  console.log('code.startsWith error present:', !!codeStartsWithError);
  if (scheduleFlushError) console.log('scheduleFlush error:', scheduleFlushError.msg.substring(0, 200));
  if (codeStartsWithError) console.log('code.startsWith error:', codeStartsWithError.msg.substring(0, 200));

  // Verify logError source fix
  const logErrorSource = fs.readFileSync('src/apBoost/utils/logError.js', 'utf-8');
  const codeLine = logErrorSource.split('\n').find(l => l.trim().startsWith('const code ='));
  console.log('logError.js code line:', codeLine);
  console.log('String() coercion applied:', codeLine && codeLine.includes('String('));

  if (hasError) {
    console.log('ERROR: Cannot continue - error boundary shown. Checking if fix was applied...');
    await browser.close();
    return;
  }

  // === CHECK INSTRUCTION SCREEN ===
  const buttons = await page.$$eval('button', els => els.map(el => el.textContent.trim()));
  console.log('\nButtons on instruction screen:', buttons);

  // Resume or start test
  const resumeBtn = await page.$('button:has-text("Resume Test"), button:has-text("Resume")');
  const startBtn = await page.$('button:has-text("Begin Test"), button:has-text("Start Test"), button:has-text("Begin"), button:has-text("Start")');
  
  console.log('Resume button found:', !!resumeBtn);
  console.log('Start button found:', !!startBtn);
  
  const actionBtn = resumeBtn || startBtn;
  if (actionBtn) {
    const btnText = await actionBtn.textContent();
    console.log('Clicking:', btnText.trim());
    await actionBtn.click();
    await page.waitForTimeout(3000);
    console.log('After click URL:', page.url());
    await ss(page, '03_test_started');
    
    const bodyAfter = await page.textContent('body');
    console.log('Body after start:', bodyAfter.replace(/\s+/g, ' ').substring(0, 400));
  } else {
    // Test is completed - no resume available
    console.log('No resume/start button found - test may be completed');
    // Try Macro test instead
    console.log('\nTrying Macro test...');
    await page.goto('http://localhost:5173/ap/test/test_macro_full_1');
    await page.waitForTimeout(4000);
    console.log('Macro test URL:', page.url());
    const macroBody = await page.textContent('body');
    console.log('Macro test body:', macroBody.replace(/\s+/g, ' ').substring(0, 400));
    await ss(page, '03_macro_instruction');
    
    const macroButtons = await page.$$eval('button', els => els.map(el => el.textContent.trim()));
    console.log('Macro test buttons:', macroButtons);
    
    const macroStartBtn = await page.$('button:has-text("Begin Test"), button:has-text("Start Test"), button:has-text("Begin"), button:has-text("Start")');
    if (macroStartBtn) {
      const btnText = await macroStartBtn.textContent();
      console.log('Clicking Macro:', btnText.trim());
      await macroStartBtn.click();
      await page.waitForTimeout(3000);
      console.log('After Macro click URL:', page.url());
      await ss(page, '04_macro_started');
    }
  }

  await browser.close();
  
  console.log('\n=== ALL CONSOLE ERRORS ===');
  consoleErrors.forEach(e => console.log(`[${e.type}]`, e.msg.substring(0, 200)));
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
