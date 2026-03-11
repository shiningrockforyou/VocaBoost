const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'src/apBoost/criteria_audit/playwright_reports');

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const results = [];
  const consoleErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });
  
  try {
    // === STEP 1: Login as student4 ===
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');
    results.push({ step: '1_navigate_login', url: page.url() });
    
    await page.fill('input[type="email"]', 'student4@apboost.test');
    await page.fill('input[type="password"]', 'Student123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    
    const afterLoginUrl = page.url();
    results.push({ step: '2_after_login', url: afterLoginUrl, isAP: afterLoginUrl.includes('/ap') });
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_01_after_login.png'), fullPage: false });
    
    // === STEP 2: Check B12-006 — APHeader logout button ===
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(b => ({ text: b.textContent.trim(), visible: b.offsetParent !== null }));
    });
    const logoutBtn = allButtons.filter(b => {
      const t = b.text.toLowerCase();
      return t.includes('logout') || t.includes('log out') || t.includes('sign out');
    });
    results.push({ step: '3_check_logout_B12_006', allButtons: allButtons.slice(0, 10), logoutFound: logoutBtn, PASS: logoutBtn.length > 0 });
    
    // Navigate to AP section if not there
    if (!afterLoginUrl.includes('/ap')) {
      await page.goto('http://localhost:5173/ap');
      await page.waitForTimeout(2000);
      const apUrl = page.url();
      results.push({ step: '3b_navigate_ap', url: apUrl });
      
      const logoutOnAP = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.filter(b => {
          const t = b.textContent.toLowerCase().trim();
          return t.includes('logout') || t.includes('sign out');
        }).map(b => ({ text: b.textContent.trim() }));
      });
      results.push({ step: '3c_logout_on_ap_page', found: logoutOnAP, PASS: logoutOnAP.length > 0 });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_02_ap_dashboard.png'), fullPage: false });
    }
    
    // === STEP 3: Navigate to Micro test ===
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'b14a_retest_03_test_page.png'), fullPage: false });
    results.push({ step: '4_test_page', url: page.url() });
    
    const pageBody = await page.evaluate(() => document.body.textContent.substring(0, 500));
    results.push({ step: '4b_page_body', text: pageBody });
    
    // Check for DuplicateTabModal
    const hasDupModal = pageBody.includes('Another Tab') || pageBody.includes('another tab');
    results.push({ step: '4c_duplicate_tab_modal', present: hasDupModal });
    
    // Find Begin button
    const beginBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.filter(b => {
        const t = b.textContent.toLowerCase().trim();
        return t.includes('begin') || t.includes('start') || t.includes('resume');
      }).map(b => ({ text: b.textContent.trim(), disabled: b.disabled }));
    });
    results.push({ step: '4d_begin_buttons', found: beginBtn });
    
  } catch (err) {
    results.push({ step: 'ERROR', error: err.message });
  }
  
  results.push({ step: 'console_errors', errors: consoleErrors });
  
  await browser.close();
  const output = JSON.stringify(results, null, 2);
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'b14a_phase1_results.json'), output);
  console.log(output);
}

runTest().catch(console.error);
