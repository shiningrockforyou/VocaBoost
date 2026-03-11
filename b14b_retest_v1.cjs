const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  const consoleErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), type: 'console_error', msg: msg.text() });
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push({ url: page.url(), type: 'pageerror', msg: err.message });
  });

  // === LOGIN ===
  console.log('=== LOGIN ===');
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  console.log('Login URL:', page.url());
  await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_retest_01_login.png' });

  // Wait for dashboard to load
  await page.waitForTimeout(2000);

  // === VERIFY 1: logError source check ===
  console.log('\n=== VERIFY 1: logError.js source check ===');
  const logErrorSource = fs.readFileSync('src/apBoost/utils/logError.js', 'utf-8');
  const line13 = logErrorSource.split('\n').find(l => l.trim().startsWith('const code ='));
  console.log('logError code line:', line13);
  const hasStringCoercion = line13 && line13.includes('String(');
  console.log('FIX APPLIED (String coercion):', hasStringCoercion);

  // === DASHBOARD EXPLORATION ===
  await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_retest_02_dashboard.png' });
  const bodyText = await page.textContent('body');
  console.log('\nDashboard body:', bodyText.replace(/\s+/g, ' ').substring(0, 1000));

  // Find buttons/links
  const interactiveTexts = await page.$$eval('button, a', els => 
    els.map(el => el.textContent.trim()).filter(t => t.length > 1 && t.length < 150)
  );
  console.log('\nInteractive elements:', JSON.stringify(interactiveTexts.slice(0, 40)));

  // === NAVIGATE TO TEST ===
  console.log('\n=== FINDING MICRO TEST ===');
  
  // Look for Start Test or any test-related button
  try {
    // First look for the test card or start button
    const testCard = await page.$('.cursor-pointer, [class*="test"], [href*="test"]');
    if (testCard) {
      const cardText = await testCard.textContent();
      console.log('Test card text:', cardText.substring(0, 100));
    }
    
    // Try clicking on the Micro test or any "Start" / "Resume" button
    const resumeBtn = await page.$('button:has-text("Resume"), button:has-text("Start Test"), button:has-text("Begin Test")');
    if (resumeBtn) {
      console.log('Found resume/start button');
      await resumeBtn.click();
    } else {
      // Try clicking the test card itself
      const microCard = await page.$('[data-testid*="micro"], [class*="card"]');
      if (microCard) {
        await microCard.click();
      }
    }
    
    await page.waitForTimeout(2000);
    console.log('URL after test click:', page.url());
    await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_retest_03_test_nav.png' });
  } catch(e) {
    console.log('Error navigating to test:', e.message);
  }
  
  // Try direct navigation to test
  if (!page.url().includes('/test/')) {
    console.log('Direct nav to test...');
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
    await page.waitForTimeout(3000);
    console.log('Direct nav URL:', page.url());
    await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_retest_04_direct_nav.png' });
  }
  
  await browser.close();
  console.log('\n=== CONSOLE ERRORS ===');
  console.log(JSON.stringify(consoleErrors, null, 2));
})().catch(e => { console.error('FATAL:', e.message, e.stack); process.exit(1); });
