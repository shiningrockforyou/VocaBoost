const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().substring(0,200)); });
  page.on('pageerror', e => { errors.push('PAGE:' + e.message.substring(0,200)); });

  // Login
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Logged in');

  // Navigate to Macro test (fresh)
  await page.goto('http://localhost:5173/ap/test/test_macro_full_1');
  await page.waitForTimeout(4000);
  const b1 = await page.textContent('body');
  if (b1.includes('Something went wrong')) { console.log('ERROR:', b1.substring(0, 200)); await browser.close(); return; }

  // Begin test
  const beginBtn = await page.$('button:has-text("Begin Test")');
  if (beginBtn) { await beginBtn.click(); await page.waitForTimeout(4000); }

  const testBody = await page.textContent('body');
  console.log('Test body:', testBody.replace(/\s+/g, ' ').substring(0, 200));

  // Take screenshot
  await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_v2_check_01_q1.png' });

  // === CHECK V2: Letter badge ===
  // Get detailed info about the MCQ buttons
  const mcqBtnsDetail = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.slice(0, 15).map(b => ({
      tag: b.tagName,
      role: b.getAttribute('role'),
      ariaLabel: b.getAttribute('aria-label'),
      ariaChecked: b.getAttribute('aria-checked'),
      cls: b.className.substring(0, 100),
      txt: b.textContent.replace(/\s+/g, ' ').trim().substring(0, 40),
      spans: Array.from(b.querySelectorAll('span')).map(s => ({ cls: s.className.substring(0, 80), txt: s.textContent.trim() }))
    }));
  });
  console.log('\n=== MCQ BUTTONS DETAIL ===');
  console.log(JSON.stringify(mcqBtnsDetail, null, 2));

  // Find a choice button and click it
  const choiceBtns = await page.$$eval('button', btns => {
    return btns.filter(b => {
      const txt = b.textContent.replace(/\s+/g, ' ').trim();
      // MCQ choice buttons have text like "AGoods..." "BLand..." etc.
      return txt.length > 1 && /^[A-J]/.test(txt) && txt.length < 200 && b.classList.toString().includes('flex-1');
    }).map(b => ({ txt: b.textContent.replace(/\s+/g,' ').trim().substring(0,50), cls: b.className.substring(0,80) }));
  });
  console.log('\nChoice buttons:', JSON.stringify(choiceBtns));

  // Click the first choice button (Q1 option A)
  const firstChoiceBtn = await page.$('button.flex-1');
  if (firstChoiceBtn) {
    console.log('\nClicking first choice button...');
    await firstChoiceBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_v2_check_02_selected.png' });

    // Check state of all choice buttons
    const afterSelectDetail = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button.flex-1, button[class*="flex-1"]'));
      return btns.map(b => ({
        cls: b.className.substring(0, 120),
        spans: Array.from(b.querySelectorAll('span')).map(s => ({ cls: s.className.substring(0, 80), txt: s.textContent.trim() }))
      }));
    });
    console.log('\nAfter select (choice buttons):', JSON.stringify(afterSelectDetail, null, 2));
  } else {
    console.log('Could not find flex-1 button');
    // Try all buttons again
    const allBtnCls = await page.$$eval('button', btns => btns.map(b => b.className.substring(0, 60)));
    console.log('All button classes:', allBtnCls.slice(0, 10));
  }

  // === CHECK V3: Timer on review ===
  console.log('\n=== V3: Timer on review ===');
  // Navigate through all 15 MCQ and get to review
  // We need to find and click each choice button
  const allChoiceBtns = await page.$$('button[class*="flex-1 flex items-start"]');
  console.log('All flex-1 choice buttons:', allChoiceBtns.length);

  // Navigate to review by clicking "Review" button directly
  const reviewNavBtn = await page.$('button:has-text("Review")');
  if (reviewNavBtn) {
    const reviewNavTxt = await reviewNavBtn.textContent();
    console.log('Review nav button:', reviewNavTxt.trim());
  }

  // Check timer on test page
  const timerOnTest = await page.$$eval('[class*="font-mono"]', els =>
    els.map(el => ({ txt: el.textContent.trim(), pCls: el.parentElement ? el.parentElement.className : '' }))
  );
  console.log('Timer on test page:', JSON.stringify(timerOnTest));

  await browser.close();
  console.log('\n=== ERRORS ===');
  errors.forEach(e => console.log(e));
})().catch(e => { console.error('FATAL:', e.message, e.stack ? e.stack.substring(0, 300) : ''); process.exit(1); });
