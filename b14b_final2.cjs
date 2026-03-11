// B14B Retest Final v2 - Fixed selectors
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
  if (b.includes('Something went wrong')) { console.log('BLOCKER: error boundary'); await browser.close(); return; }
  await ss(page, '02_instr');
  const actionBtn = await page.$('button:has-text("Begin Test"), button:has-text("Resume Test")');
  if (actionBtn) { await actionBtn.click(); await page.waitForTimeout(3000); }
  await ss(page, '02b_test_loaded');
  let tb = await page.textContent('body');
  console.log('Test body:', tb.replace(/\s+/g, ' ').substring(0, 200));

  // CHECK INTERACTIVE ELEMENTS on test page
  const interactiveEls = await page.$$eval('[role="radio"], [role="checkbox"], button[aria-label]', els =>
    els.map(el => ({ tag: el.tagName, role: el.getAttribute('role'), ariaLabel: el.getAttribute('aria-label'), ariaChecked: el.getAttribute('aria-checked'), txt: el.textContent.trim().substring(0, 40) }))
  );
  console.log('\nInteractive elements (radio/checkbox/labeled buttons):', JSON.stringify(interactiveEls.slice(0, 10)));

  // VERIFY 1
  console.log('\n--- VERIFY 1: logError crash ---');
  const v1errs = errors.filter(e => e.m.includes('startsWith is not') || e.m.includes('code.startsWith'));
  R.v1_runtime = v1errs.length === 0;
  const logSrc = fs.readFileSync('src/apBoost/utils/logError.js', 'utf-8');
  R.v1_src = logSrc.includes("String(error?.code");
  console.log('Runtime (no crash):', R.v1_runtime ? 'PASS' : 'FAIL');
  console.log('Source fix (String()):', R.v1_src ? 'PASS' : 'FAIL');

  // VERIFY 2: MCQ letter badge
  console.log('\n--- VERIFY 2: MCQ letter badge ---');
  await ss(page, '03_before_select');

  // Use role="radio" selector instead of aria-label
  const allRadios = await page.$$('[role="radio"]');
  console.log('Radio buttons found:', allRadios.length);

  if (allRadios.length >= 1) {
    const firstRadio = allRadios[0];
    const firstRadioInfo = await firstRadio.evaluate(el => ({
      ariaLabel: el.getAttribute('aria-label'),
      ariaChecked: el.getAttribute('aria-checked'),
      cls: el.className.substring(0, 100),
      txt: el.textContent.trim().substring(0, 50)
    }));
    console.log('First radio:', JSON.stringify(firstRadioInfo));

    // If already checked, uncheck it first
    if (firstRadioInfo.ariaChecked === 'true') {
      await firstRadio.click();
      await page.waitForTimeout(200);
    }

    // Click the first radio (Choice A)
    await firstRadio.click();
    await page.waitForTimeout(500);
    await ss(page, '04_after_select_a');

    // Get spans inside the selected element
    const selectedSpans = await page.$$eval('[role="radio"][aria-checked="true"] span', spans =>
      spans.map(s => ({ cls: s.className, txt: s.textContent.trim() }))
    );
    console.log('Selected button spans:', JSON.stringify(selectedSpans));

    const letterBadge = selectedSpans.find(s => s.txt.length === 1 && /[A-J]/.test(s.txt));
    console.log('Letter badge span:', JSON.stringify(letterBadge));

    if (letterBadge) {
      const hasBgWhite = letterBadge.cls.includes('bg-white') && !letterBadge.cls.includes('bg-white/');
      const hasBroken = letterBadge.cls.includes('bg-white/20');
      R.v2 = hasBgWhite && !hasBroken;
      console.log('bg-white (not bg-white/20):', hasBgWhite ? 'YES' : 'NO');
      console.log('Letter badge fix:', R.v2 ? 'PASS' : 'FAIL');
    } else {
      console.log('No letter badge span found in selected answer');
      R.v2 = false;
    }
  } else {
    console.log('No radio buttons found on page');
    R.v2 = false;
  }

  // VERIFY 6: Timer urgency code
  console.log('\n--- VERIFY 6: Timer urgency cues ---');
  const timerSrc = fs.readFileSync('src/apBoost/components/TestTimer.jsx', 'utf-8');
  const has60Pulse = timerSrc.includes('<= 60') && timerSrc.includes('animate-pulse');
  const has300Bold = timerSrc.includes('<= 300') && timerSrc.includes('font-bold');
  R.v6 = has60Pulse && has300Bold;
  console.log('Under 60s pulse:', has60Pulse ? 'YES' : 'NO');
  console.log('Under 300s bold:', has300Bold ? 'YES' : 'NO');
  console.log('Timer urgency:', R.v6 ? 'PASS' : 'FAIL');
  const timerDOM = await page.$$eval('[class*="font-mono"]', els =>
    els.map(el => ({ txt: el.textContent.trim(), pCls: el.parentElement ? el.parentElement.className : '' }))
  );
  console.log('Timer DOM:', JSON.stringify(timerDOM));

  // VERIFY 8: Navigator dedup
  console.log('\n--- VERIFY 8: Navigator dedup ---');
  const navToggle = await page.$('button:has-text("of 15"), button:has-text("of 7")');
  if (navToggle) {
    await navToggle.click(); await page.waitForTimeout(800);
    await ss(page, '06_nav_modal');
    const navItems = await page.$$eval('.fixed .flex.flex-wrap button, .fixed [class*="flex-wrap"] button', btns =>
      btns.map(b => b.textContent.trim()).filter(t => t.length <= 4 && /^\d/.test(t))
    );
    console.log('Nav items:', navItems);
    const seen = {}, dups = [];
    navItems.forEach(l => { if (seen[l]) dups.push(l); else seen[l] = true; });
    R.v8 = dups.length === 0 && navItems.length > 0;
    console.log('Items:', navItems.length, '| Dups:', dups.length, '->', R.v8 ? 'PASS' : 'FAIL');
    // Close
    const xBtn = await page.$('.fixed button[class*="p-2 min-h"]');
    if (xBtn) await xBtn.click();
    else { const bd = await page.$('.fixed .absolute.inset-0'); if (bd) await bd.click(); else await page.keyboard.press('Escape'); }
    await page.waitForTimeout(500);
  } else { R.v8 = null; console.log('Nav toggle not found'); }

  // ANSWER MCQ - now using correct selectors
  console.log('\n--- Answering MCQ Q1-Q15 ---');
  let answeredCount = 0;
  for (let qi = 0; qi < 20; qi++) {
    const currBody = await page.textContent('body');
    if (currBody.includes('Review Your Answers')) break;

    // Find unchecked radio buttons and click the second one (B) or first (A)
    const radios = await page.$$('[role="radio"]');
    let targetRadio = null;
    for (const r of radios) {
      const checked = await r.getAttribute('aria-checked');
      const label = await r.getAttribute('aria-label');
      if (checked !== 'true' && label && (label.includes('B') || label.includes('A'))) {
        if (label.includes('B')) { targetRadio = r; break; }
        if (!targetRadio) targetRadio = r; // fallback to A
      }
    }
    if (!targetRadio && radios.length > 0) targetRadio = radios[0]; // fallback

    if (targetRadio) {
      const isAlreadyChecked = await targetRadio.getAttribute('aria-checked') === 'true';
      if (!isAlreadyChecked) { await targetRadio.click(); await page.waitForTimeout(150); answeredCount++; }
    }

    const nxt = await page.$('button:has-text("Next")');
    const rv = await page.$('button:has-text("Review")');
    if (nxt) {
      try { await nxt.click({ timeout: 5000 }); } catch (e2) {
        await page.keyboard.press('Escape'); await page.waitForTimeout(300);
        const nxt2 = await page.$('button:has-text("Next")');
        if (nxt2) await nxt2.click({ timeout: 3000 });
      }
      await page.waitForTimeout(400);
    } else if (rv) { await rv.click(); await page.waitForTimeout(2000); break; }
    else break;
  }
  console.log('Answered:', answeredCount, 'MCQ questions');

  // VERIFY 3: Timer on review screen
  console.log('\n--- VERIFY 3: Timer on review ---');
  const reviewBody = await page.textContent('body');
  const onReview = reviewBody.includes('Review Your Answers');
  console.log('On review screen:', onReview);
  await ss(page, '07_review');
  if (onReview) {
    const timerEls = await page.$$eval('[class*="font-mono"]', els => els.map(el => ({ txt: el.textContent.trim(), cls: el.className })));
    const timerVal = reviewBody.match(/\d{1,2}:\d{2}/);
    console.log('Timer elements on review:', JSON.stringify(timerEls));
    console.log('Timer value:', timerVal ? timerVal[0] : 'NOT FOUND');
    R.v3 = !!(timerVal && timerEls.length > 0);
    console.log('Timer on review:', R.v3 ? 'PASS' : 'FAIL');
  } else { R.v3 = null; }

  // SUBMIT MCQ SECTION
  if (reviewBody.includes('Submit Section')) {
    const ssBtn = await page.$('button:has-text("Submit Section")');
    if (ssBtn) { await ssBtn.click(); await page.waitForTimeout(4000); }
  }

  // VERIFY 7a: FRQ two-step
  console.log('\n--- VERIFY 7a: FRQ two-step ---');
  const frqChoiceBody = await page.textContent('body');
  const onFRQChoice = frqChoiceBody.includes('Type Your Answers') && frqChoiceBody.includes('Write by Hand');
  console.log('On FRQ choice screen:', onFRQChoice);
  await ss(page, '08_frq_choice');
  if (onFRQChoice) {
    const confirmBefore = await page.$('button:has-text("Confirm")');
    console.log('Confirm before:', !!confirmBefore);

    const allBtns = await page.$$('button');
    let typeBtn = null;
    for (const btn of allBtns) {
      const txt = await btn.textContent();
      if (txt.includes('Type Your Answers')) { typeBtn = btn; break; }
    }
    console.log('Type Your Answers button found:', !!typeBtn);

    if (typeBtn) {
      await typeBtn.click(); await page.waitForTimeout(700);
      await ss(page, '09_frq_type_sel');
      const postTypeBody = await page.textContent('body');
      const stillOnChoice = postTypeBody.includes('Type Your Answers') && postTypeBody.includes('Write by Hand');
      const confirmAfter = await page.$('button:has-text("Confirm")');
      console.log('Still on choice:', stillOnChoice, '| Confirm after:', !!confirmAfter);
      R.v7a = !confirmBefore && !!confirmAfter && stillOnChoice;
      console.log('Two-step confirm:', R.v7a ? 'PASS' : 'FAIL');
      if (confirmAfter) { await confirmAfter.click(); await page.waitForTimeout(3000); }
    } else { R.v7a = false; }
  } else { R.v7a = null; }

  // VERIFY 5: FRQ nav label
  console.log('\n--- VERIFY 5: FRQ nav label ---');
  await page.waitForTimeout(1500);
  const frqSecBody = await page.textContent('body');
  await ss(page, '10_frq_q1');
  const navLabelMatch = frqSecBody.match(/Question (\d+) of (\d+)/);
  console.log('Nav label:', navLabelMatch ? navLabelMatch[0] : 'NOT FOUND');
  const navIdx = navLabelMatch ? parseInt(navLabelMatch[1]) : null;
  R.v5 = navIdx === 1;
  console.log('FRQ nav index:', navIdx, '->', R.v5 ? 'PASS' : 'FAIL');

  // ANSWER FRQ
  console.log('\n--- Answering FRQ ---');
  for (let fi = 0; fi < 8; fi++) {
    const ta = await page.$('textarea');
    if (ta) { await ta.fill('Economic analysis answer ' + (fi+1) + ': The market equilibrium occurs at the intersection of supply and demand curves, determining the efficient price and quantity.'); await page.waitForTimeout(200); }
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

  // VERIFY 7b: Submit Test dialog
  console.log('\n--- VERIFY 7b: Submit Test dialog ---');
  R.v7b = null; R.v7bc = null;
  if (onFRQRev && frqRevBody.includes('Submit Test')) {
    const stBtn = await page.$('button:has-text("Submit Test")');
    if (stBtn) {
      let dialogAppeared = false, dialogMsg = '';
      page.once('dialog', async d => {
        dialogAppeared = true; dialogMsg = d.message();
        console.log('DIALOG:', dialogMsg);
        await d.dismiss();
      });
      await stBtn.click(); await page.waitForTimeout(3000);
      const urlAfterCancel = page.url();
      R.v7b = dialogAppeared;
      R.v7bc = !urlAfterCancel.includes('/results/');
      console.log('Dialog appeared:', R.v7b ? 'PASS' : 'FAIL');
      console.log('Cancel works:', R.v7bc ? 'PASS' : 'FAIL');
      console.log('URL after cancel:', urlAfterCancel);
      await ss(page, '12_after_cancel');
    }
  } else { console.log('FRQ review not reached or Submit Test not available'); }

  await browser.close();

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
