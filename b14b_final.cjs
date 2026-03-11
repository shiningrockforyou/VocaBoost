// B14B Retest Final - Comprehensive verification
const { chromium } = require('playwright');
const fs = require('fs');

async function ss(page, name) {
  await page.screenshot({ path: 'src/apBoost/criteria_audit/playwright_reports/b14b_retest_' + name + '.png' });
  console.log('[SS] ' + name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push({ u: page.url(), m: m.text().substring(0, 300) }); });
  page.on('pageerror', e => { errors.push({ u: page.url(), t: 'page', m: e.message.substring(0, 300) }); });
  const R = {};

  // LOGIN
  await page.goto('http://localhost:5173/ap');
  await page.waitForURL('**/login**', { timeout: 5000 }).catch(() => {});
  await page.fill('[type=email]', 'student5@apboost.test');
  await page.fill('[type=password]', 'Student123!');
  await page.click('[type=submit]');
  await page.waitForURL('**/ap**', { timeout: 10000 });
  await page.waitForTimeout(2000);
  R.login = !page.url().includes('login');
  console.log('LOGIN:', R.login ? 'PASS' : 'FAIL');
  await ss(page, '01_dash');

  // NAVIGATE TO TEST
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);
  let b = await page.textContent('body');
  if (b.includes('Something went wrong')) {
    console.log('BLOCKER: error boundary shown:', b.substring(0, 200));
    await browser.close();
    return;
  }
  await ss(page, '02_instr');

  const actionBtn = await page.$('button:has-text("Begin Test"), button:has-text("Resume Test")');
  if (actionBtn) { await actionBtn.click(); await page.waitForTimeout(3000); }
  let tb = await page.textContent('body');
  console.log('Test body:', tb.replace(/\s+/g, ' ').substring(0, 200));

  // =================================================
  // VERIFY 1: logError crash (no code.startsWith error)
  // =================================================
  console.log('\n--- VERIFY 1: logError crash ---');
  const v1errs = errors.filter(e => e.m.includes('startsWith is not') || e.m.includes('code.startsWith'));
  R.v1_runtime = v1errs.length === 0;
  const logSrc = fs.readFileSync('src/apBoost/utils/logError.js', 'utf-8');
  R.v1_src = logSrc.includes("String(error?.code");
  console.log('Runtime (no crash):', R.v1_runtime ? 'PASS' : 'FAIL');
  console.log('Source fix (String()):', R.v1_src ? 'PASS' : 'FAIL');

  // =================================================
  // VERIFY 2: MCQ letter badge contrast
  // =================================================
  console.log('\n--- VERIFY 2: MCQ letter badge contrast ---');

  // Make sure no modal is open
  const modalOpen = await page.$('.fixed[class*="inset-0"]');
  if (modalOpen) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }

  await ss(page, '03_before_select');

  const choiceABtn = await page.$('button[aria-label="Choice A"]');
  console.log('Choice A button found:', !!choiceABtn);

  if (choiceABtn) {
    await choiceABtn.click();
    await page.waitForTimeout(500);
    await ss(page, '04_after_select_a');

    // Get spans inside the selected button
    const selectedSpans = await page.$$eval('button[aria-checked="true"] span', spans =>
      spans.map(s => ({ cls: s.className, txt: s.textContent.trim() }))
    );
    console.log('Selected button spans:', JSON.stringify(selectedSpans));

    const letterBadge = selectedSpans.find(s => s.txt.length === 1 && /[A-J]/.test(s.txt));
    console.log('Letter badge:', JSON.stringify(letterBadge));

    const hasBgWhite = letterBadge && letterBadge.cls.includes('bg-white') && !letterBadge.cls.includes('bg-white/');
    const hasBroken = letterBadge && letterBadge.cls.includes('bg-white/20');

    R.v2 = hasBgWhite && !hasBroken;
    console.log('bg-white (not bg-white/20):', hasBgWhite ? 'YES' : 'NO');
    console.log('Letter badge fix:', R.v2 ? 'PASS' : 'FAIL');
  } else {
    R.v2 = false;
    const btnsText = await page.$$eval('button', btns => btns.slice(0, 10).map(b => b.textContent.replace(/\s+/g, ' ').trim().substring(0, 50)));
    console.log('Buttons on page:', btnsText);
  }

  // =================================================
  // VERIFY 6: Timer urgency code
  // =================================================
  console.log('\n--- VERIFY 6: Timer urgency cues ---');
  const timerSrc = fs.readFileSync('src/apBoost/components/TestTimer.jsx', 'utf-8');
  const has60Pulse = timerSrc.includes('<= 60') && timerSrc.includes('animate-pulse');
  const has300Bold = timerSrc.includes('<= 300') && timerSrc.includes('font-bold');
  R.v6 = has60Pulse && has300Bold;
  console.log('Under 60s pulse:', has60Pulse ? 'YES' : 'NO');
  console.log('Under 300s bold:', has300Bold ? 'YES' : 'NO');
  console.log('Timer urgency:', R.v6 ? 'PASS' : 'FAIL');

  // Verify DOM timer structure
  const timerDOM = await page.$$eval('[class*="font-mono"]', els =>
    els.map(el => ({ txt: el.textContent.trim(), cls: el.className, pCls: el.parentElement ? el.parentElement.className : '' }))
  );
  console.log('Timer DOM:', JSON.stringify(timerDOM));

  // =================================================
  // VERIFY 8: Navigator dedup
  // =================================================
  console.log('\n--- VERIFY 8: Navigator dedup ---');

  // Find nav toggle (has "of 15" or "of X")
  const navToggle = await page.$('button:has-text("of 15"), button:has-text("of 7")');
  if (navToggle) {
    const navTxt = await navToggle.textContent();
    console.log('Nav toggle text:', navTxt.trim());
    await navToggle.click();
    await page.waitForTimeout(800);
    await ss(page, '06_nav_modal');

    // Get buttons in the navigator grid (excluding close/review buttons)
    const navItems = await page.$$eval('.fixed .flex.flex-wrap button', btns =>
      btns.map(b => b.textContent.trim()).filter(t => t.length <= 4 && /^\d/.test(t))
    );
    console.log('Nav grid items:', navItems);

    const seen = {};
    const dups = [];
    navItems.forEach(l => { if (seen[l]) dups.push(l); else seen[l] = true; });
    R.v8 = dups.length === 0 && navItems.length > 0;
    console.log('Items:', navItems.length, '| Dups:', dups.length, '->', R.v8 ? 'PASS' : 'FAIL');

    // Close modal with close button (X)
    const closeBtn = await page.$('.fixed button[class*="p-2 min-h"]');
    if (closeBtn) {
      await closeBtn.click();
    } else {
      const backdrop = await page.$('.fixed .absolute.inset-0');
      if (backdrop) await backdrop.click();
      else await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);

    // Verify closed
    const stillOpen = await page.$('.fixed.inset-0, [class*="animate-slide-up"]');
    console.log('Modal closed:', !stillOpen ? 'YES' : 'NO (still open)');
  } else {
    R.v8 = null;
    console.log('Nav toggle not found');
    const btnsAll = await page.$$eval('button', btns => btns.map(b => b.textContent.replace(/\s+/g,' ').trim().substring(0,40)));
    console.log('All buttons:', btnsAll.slice(0, 15));
  }

  // =================================================
  // ANSWER MCQ Q1-Q15
  // =================================================
  console.log('\n--- Answering MCQ Q1-Q15 ---');

  // Ensure modal is closed
  const modalCheck = await page.$('.fixed.inset-0, [class*="fixed"][class*="inset-0"]');
  if (modalCheck) {
    console.log('Modal still open, closing...');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    const bd2 = await page.$('.fixed .absolute.inset-0');
    if (bd2) await bd2.click({ force: true });
    await page.waitForTimeout(500);
  }

  let answeredCount = 0;
  for (let qi = 0; qi < 20; qi++) {
    const currentBody = await page.textContent('body');
    if (currentBody.includes('Review Your Answers')) break;

    const bChoice = await page.$('button[aria-label="Choice B"]:not([aria-checked="true"])');
    const aChoice = await page.$('button[aria-label="Choice A"]:not([aria-checked="true"])');
    const anyChoice = bChoice || aChoice;
    if (anyChoice) { await anyChoice.click(); await page.waitForTimeout(150); answeredCount++; }

    const nxt = await page.$('button:has-text("Next")');
    const rv = await page.$('button:has-text("Review")');
    if (nxt) {
      try { await nxt.click({ timeout: 3000 }); }
      catch (e) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const nxt2 = await page.$('button:has-text("Next")');
        if (nxt2) await nxt2.click({ timeout: 3000 });
      }
      await page.waitForTimeout(400);
    } else if (rv) {
      await rv.click();
      await page.waitForTimeout(2000);
      break;
    } else break;
  }
  console.log('Answered:', answeredCount, 'MCQ questions');

  // =================================================
  // VERIFY 3: Timer on review screen
  // =================================================
  console.log('\n--- VERIFY 3: Timer on review screen ---');
  const reviewBody = await page.textContent('body');
  const onReview = reviewBody.includes('Review Your Answers');
  console.log('On review screen:', onReview);
  await ss(page, '07_review');

  if (onReview) {
    const timerOnReview = await page.$$eval('[class*="font-mono"]', els =>
      els.map(el => ({ txt: el.textContent.trim(), cls: el.className }))
    );
    const timerVal = reviewBody.match(/\d{1,2}:\d{2}/);
    console.log('Timer elements:', JSON.stringify(timerOnReview));
    console.log('Timer value:', timerVal ? timerVal[0] : 'NOT FOUND');
    R.v3 = !!(timerVal && timerOnReview.length > 0);
    console.log('Timer on review:', R.v3 ? 'PASS' : 'FAIL');
  } else {
    R.v3 = null;
  }

  // SUBMIT MCQ SECTION
  if (reviewBody.includes('Submit Section')) {
    const ssBtn = await page.$('button:has-text("Submit Section")');
    if (ssBtn) { await ssBtn.click(); await page.waitForTimeout(4000); }
  }

  // =================================================
  // VERIFY 7a: FRQ two-step confirmation
  // =================================================
  console.log('\n--- VERIFY 7a: FRQ two-step ---');
  const frqChoiceBody = await page.textContent('body');
  const onFRQChoice = frqChoiceBody.includes('Type Your Answers') && frqChoiceBody.includes('Write by Hand');
  console.log('On FRQ choice screen:', onFRQChoice);
  await ss(page, '08_frq_choice');

  if (onFRQChoice) {
    const confirmBefore = await page.$('button:has-text("Confirm")');
    console.log('Confirm button before selection:', !!confirmBefore);

    // Find "Type Your Answers" button
    const allBtns = await page.$$('button');
    let typeBtn = null;
    for (const btn of allBtns) {
      const txt = await btn.textContent();
      if (txt.includes('Type Your Answers')) { typeBtn = btn; break; }
    }
    console.log('Type Your Answers button found:', !!typeBtn);

    if (typeBtn) {
      await typeBtn.click();
      await page.waitForTimeout(700);
      await ss(page, '09_frq_type_sel');

      const postTypeBody = await page.textContent('body');
      const stillOnChoice = postTypeBody.includes('Type Your Answers') && postTypeBody.includes('Write by Hand');
      console.log('Still on choice (not navigated):', stillOnChoice);

      const confirmAfter = await page.$('button:has-text("Confirm")');
      console.log('Confirm button after selection:', !!confirmAfter);
      const confirmTxt = confirmAfter ? await confirmAfter.textContent() : null;
      console.log('Confirm text:', confirmTxt);

      R.v7a = !confirmBefore && !!confirmAfter && stillOnChoice;
      console.log('Two-step confirm:', R.v7a ? 'PASS' : 'FAIL');

      if (confirmAfter) {
        await confirmAfter.click();
        await page.waitForTimeout(3000);
        console.log('After confirm URL:', page.url());
      }
    } else {
      R.v7a = false;
    }
  } else {
    R.v7a = null;
  }

  // =================================================
  // VERIFY 5: FRQ navigator label (Q1 not Q0)
  // =================================================
  console.log('\n--- VERIFY 5: FRQ nav label ---');
  await page.waitForTimeout(1500);
  const frqSectionBody = await page.textContent('body');
  await ss(page, '10_frq_q1');

  const navMatch = frqSectionBody.match(/Question (\d+) of (\d+)/);
  console.log('Nav label:', navMatch ? navMatch[0] : 'NOT FOUND');
  const navIdx = navMatch ? parseInt(navMatch[1]) : null;
  R.v5 = navIdx === 1;
  console.log('FRQ nav index:', navIdx, '->', R.v5 ? 'PASS' : 'FAIL');

  // ANSWER FRQ
  console.log('\n--- Answering FRQ ---');
  for (let fi = 0; fi < 8; fi++) {
    const ta = await page.$('textarea');
    if (ta) {
      await ta.fill('Economic answer ' + fi + ': Supply and demand equilibrium analysis shows that competitive markets efficiently allocate resources when price signals are unimpeded.');
      await page.waitForTimeout(200);
    }
    const fn = await page.$('button:has-text("Next")');
    const fr = await page.$('button:has-text("Review")');
    if (fn) { await fn.click(); await page.waitForTimeout(500); }
    else if (fr) { await fr.click(); await page.waitForTimeout(2000); break; }
    else break;
  }

  const frqRevBody = await page.textContent('body');
  const onFRQRev = frqRevBody.includes('Review Your Answers');
  console.log('On FRQ review:', onFRQRev);
  await ss(page, '11_frq_review');

  // =================================================
  // VERIFY 7b: Submit Test confirmation dialog
  // =================================================
  console.log('\n--- VERIFY 7b: Submit Test dialog ---');
  R.v7b = null;
  R.v7bc = null;

  if (onFRQRev && frqRevBody.includes('Submit Test')) {
    const stBtn = await page.$('button:has-text("Submit Test")');
    if (stBtn) {
      let dialogAppeared = false;
      let dialogMsg = '';

      page.once('dialog', async d => {
        dialogAppeared = true;
        dialogMsg = d.message();
        console.log('DIALOG appeared:', dialogMsg);
        await d.dismiss(); // Cancel
      });

      await stBtn.click();
      await page.waitForTimeout(3000);

      const urlAfterCancel = page.url();
      const wentToResults = urlAfterCancel.includes('/results/');

      R.v7b = dialogAppeared;
      R.v7bc = !wentToResults;
      console.log('Dialog appeared:', dialogAppeared ? 'PASS' : 'FAIL');
      console.log('Dialog message:', dialogMsg);
      console.log('URL after cancel:', urlAfterCancel);
      console.log('Cancel prevents submit:', !wentToResults ? 'PASS' : 'FAIL');
      await ss(page, '12_after_cancel');
    }
  } else {
    console.log('Not on FRQ review or Submit Test not available');
  }

  await browser.close();

  // =================================================
  // FINAL SUMMARY
  // =================================================
  console.log('\n====================================');
  console.log('RETEST FINAL SUMMARY');
  console.log('====================================');
  const p = v => v === null ? 'N/A' : (v ? 'PASS' : 'FAIL');
  console.log('Login:', p(R.login));
  console.log('1. logError crash (runtime):', p(R.v1_runtime));
  console.log('   logError source fix:', p(R.v1_src));
  console.log('2. MCQ letter badge contrast:', p(R.v2));
  console.log('3. Timer on review screen:', p(R.v3));
  console.log('5. FRQ nav starts at Q1:', p(R.v5));
  console.log('6. Timer urgency cues:', p(R.v6));
  console.log('7a. FRQ two-step confirm:', p(R.v7a));
  console.log('7b. Submit Test dialog:', p(R.v7b));
  console.log('7c. Cancel prevents submit:', p(R.v7bc));
  console.log('8. No navigator duplicates:', p(R.v8));

  console.log('\n=== CONSOLE ERRORS ===');
  errors.forEach(e => console.log('[' + (e.t || 'con') + ']', e.u.substring(0, 50) + ':', e.m.substring(0, 200)));
})().catch(e => { console.error('FATAL:', e.message, e.stack ? e.stack.substring(0, 500) : ''); process.exit(1); });
