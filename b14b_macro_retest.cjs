// B14B Retest using Macro test (fresh session for student5)
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

  // Use MACRO test (fresh session)
  await page.goto('http://localhost:5173/ap/test/test_macro_full_1');
  await page.waitForTimeout(4000);
  let b = await page.textContent('body');
  if (b.includes('Something went wrong')) { console.log('BLOCKER: error boundary on Macro:', b.substring(0, 200)); await browser.close(); return; }
  console.log('Macro test instruction loaded OK');
  await ss(page, 'macro_01_instr');

  // Begin test
  const beginBtn = await page.$('button:has-text("Begin Test")');
  if (!beginBtn) { console.log('ERROR: No Begin Test button found. Buttons:', await page.$$eval('button', bs => bs.map(b => b.textContent.trim()))); await browser.close(); return; }
  await beginBtn.click();
  await page.waitForTimeout(4000);

  const testBody = await page.textContent('body');
  console.log('After begin:', testBody.replace(/\s+/g, ' ').substring(0, 200));
  await ss(page, 'macro_02_q1');

  // Check if we're on Q1
  const onQ1 = testBody.includes('Question 1 of');
  console.log('On Q1:', onQ1);

  // VERIFY 1: logError crash
  console.log('\n--- VERIFY 1: logError crash ---');
  const v1errs = errors.filter(e => e.m.includes('startsWith is not') || e.m.includes('code.startsWith'));
  R.v1_runtime = v1errs.length === 0;
  const logSrc = fs.readFileSync('src/apBoost/utils/logError.js', 'utf-8');
  R.v1_src = logSrc.includes("String(error?.code");
  console.log('Runtime (no crash):', R.v1_runtime ? 'PASS' : 'FAIL');
  console.log('Source fix (String()):', R.v1_src ? 'PASS' : 'FAIL');

  // VERIFY 2: MCQ letter badge contrast
  console.log('\n--- VERIFY 2: MCQ letter badge ---');
  await ss(page, 'macro_03_before_select');

  // Check what interactive elements exist
  const interactiveEls = await page.$$eval('button, [role]', els =>
    els.filter(el => el.getAttribute('role') === 'radio' || el.getAttribute('aria-label'))
       .map(el => ({ tag: el.tagName, role: el.getAttribute('role'), ariaLabel: el.getAttribute('aria-label'), cls: el.className.substring(0, 60) }))
  );
  console.log('Interactive els:', JSON.stringify(interactiveEls.slice(0, 8)));

  // Try [role="radio"] selector
  const radios = await page.$$('[role="radio"]');
  console.log('Radio buttons found:', radios.length);

  if (radios.length > 0) {
    const firstRadio = radios[0];
    await firstRadio.click();
    await page.waitForTimeout(500);
    await ss(page, 'macro_04_answer_selected');

    const selectedSpans = await page.$$eval('[role="radio"][aria-checked="true"] span', spans =>
      spans.map(s => ({ cls: s.className, txt: s.textContent.trim() }))
    );
    console.log('Selected spans:', JSON.stringify(selectedSpans));

    const letterBadge = selectedSpans.find(s => s.txt.length === 1 && /[A-J]/.test(s.txt));
    console.log('Letter badge:', JSON.stringify(letterBadge));

    if (letterBadge) {
      const hasBgWhite = letterBadge.cls.includes('bg-white') && !letterBadge.cls.includes('bg-white/');
      const hasBroken = letterBadge.cls.includes('bg-white/20');
      R.v2 = hasBgWhite && !hasBroken;
      console.log('bg-white (not /20):', hasBgWhite ? 'YES' : 'NO');
      console.log('Letter badge fix:', R.v2 ? 'PASS' : 'FAIL');
    } else {
      console.log('No letter badge found in selected answer - checking all spans');
      const allSelectedContent = await page.$$eval('[aria-checked="true"]', els =>
        els.map(el => ({ outerHTML: el.outerHTML.substring(0, 300) }))
      );
      console.log('All aria-checked=true:', JSON.stringify(allSelectedContent));
      R.v2 = false;
    }
  } else {
    // Check the button structure more carefully
    const mcqButtons = await page.$$eval('button', btns =>
      btns.slice(0, 10).map(b => ({
        ariaLabel: b.getAttribute('aria-label'),
        ariaChecked: b.getAttribute('aria-checked'),
        role: b.getAttribute('role'),
        cls: b.className.substring(0, 80),
        txt: b.textContent.replace(/\s+/g, ' ').trim().substring(0, 50)
      }))
    );
    console.log('MCQ buttons detail:', JSON.stringify(mcqButtons));
    R.v2 = false;
  }

  // VERIFY 6: Timer urgency code
  console.log('\n--- VERIFY 6: Timer urgency ---');
  const timerSrc = fs.readFileSync('src/apBoost/components/TestTimer.jsx', 'utf-8');
  R.v6 = timerSrc.includes('<= 60') && timerSrc.includes('animate-pulse') && timerSrc.includes('<= 300') && timerSrc.includes('font-bold');
  console.log('Timer urgency code:', R.v6 ? 'PASS' : 'FAIL');
  const timerDOM = await page.$$eval('[class*="font-mono"]', els =>
    els.map(el => ({ txt: el.textContent.trim(), pCls: el.parentElement ? el.parentElement.className : '' }))
  );
  console.log('Timer DOM:', JSON.stringify(timerDOM));

  // VERIFY 8: Navigator dedup
  console.log('\n--- VERIFY 8: Navigator dedup ---');
  const navToggle = await page.$('button:has-text("of 15"), button:has-text("of 7")');
  if (navToggle) {
    await navToggle.click(); await page.waitForTimeout(800);
    await ss(page, 'macro_05_nav');
    const navItems = await page.$$eval('.fixed .flex.flex-wrap button', btns =>
      btns.map(b => b.textContent.trim()).filter(t => t.length <= 4 && /^\d/.test(t))
    );
    console.log('Nav items:', navItems);
    const seen = {}, dups = [];
    navItems.forEach(l => { if (seen[l]) dups.push(l); else seen[l] = true; });
    R.v8 = dups.length === 0 && navItems.length > 0;
    console.log('Nav items:', navItems.length, '| Dups:', dups.length, '->', R.v8 ? 'PASS' : 'FAIL');
    // Close modal
    const xBtn = await page.$('.fixed button[class*="p-2 min-h"]');
    if (xBtn) await xBtn.click();
    else { const bd = await page.$('.fixed .absolute.inset-0'); if (bd) await bd.click(); else await page.keyboard.press('Escape'); }
    await page.waitForTimeout(500);
  } else { R.v8 = null; console.log('Nav toggle not found'); }

  // ANSWER MCQ Q1-Q15 (using simple approach - click all radios and Next)
  console.log('\n--- Answering MCQ Q1-Q15 ---');

  // Make sure modal is closed first
  const modalOpen = await page.$('.fixed.inset-0');
  if (modalOpen) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }

  let answeredCount = 0;
  for (let qi = 0; qi < 20; qi++) {
    const currBody = await page.textContent('body');
    if (currBody.includes('Review Your Answers')) break;

    // Find all radio buttons and click the first unchecked one
    const allRadios2 = await page.$$('[role="radio"]');
    let didAnswer = false;
    for (const r of allRadios2) {
      const checked = await r.getAttribute('aria-checked');
      if (checked !== 'true') {
        await r.click();
        await page.waitForTimeout(150);
        answeredCount++;
        didAnswer = true;
        break;
      }
    }
    if (!didAnswer) {
      // Try clicking the second radio (B) if first is checked
      if (allRadios2.length >= 2) {
        const checked2 = await allRadios2[1].getAttribute('aria-checked');
        if (checked2 !== 'true') { await allRadios2[1].click(); await page.waitForTimeout(150); answeredCount++; }
      }
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
    } else if (rv) {
      await rv.click(); await page.waitForTimeout(2000); break;
    } else break;
  }
  console.log('Answered:', answeredCount, 'MCQ questions');

  // VERIFY 3: Timer on review
  console.log('\n--- VERIFY 3: Timer on review ---');
  const reviewBody = await page.textContent('body');
  const onReview = reviewBody.includes('Review Your Answers');
  console.log('On review screen:', onReview);
  await ss(page, 'macro_06_review');

  if (onReview) {
    const timerEls = await page.$$eval('[class*="font-mono"]', els =>
      els.map(el => ({ txt: el.textContent.trim(), cls: el.className }))
    );
    const timerVal = reviewBody.match(/\d{1,2}:\d{2}/);
    console.log('Timer elements on review:', JSON.stringify(timerEls));
    console.log('Timer value in body:', timerVal ? timerVal[0] : 'NOT FOUND');
    R.v3 = !!(timerVal && timerEls.length > 0);
    console.log('Timer on review:', R.v3 ? 'PASS' : 'FAIL');

    // Also check via DOM snapshot
    const timerViaEval = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      return allEls.filter(el => el.className && typeof el.className === 'string' && el.className.includes('font-mono'))
        .map(el => ({ cls: el.className, txt: el.textContent.trim() }));
    });
    console.log('Timer via DOM eval:', JSON.stringify(timerViaEval));
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
  console.log('On FRQ choice:', onFRQChoice);
  await ss(page, 'macro_07_frq_choice');

  if (onFRQChoice) {
    const confirmBefore = await page.$('button:has-text("Confirm")');
    console.log('Confirm before:', !!confirmBefore);

    const allBtns = await page.$$('button');
    let typeBtn = null;
    for (const btn of allBtns) {
      const txt = await btn.textContent();
      if (txt.includes('Type Your Answers')) { typeBtn = btn; break; }
    }
    console.log('Type btn found:', !!typeBtn);

    if (typeBtn) {
      await typeBtn.click(); await page.waitForTimeout(700);
      await ss(page, 'macro_08_type_sel');
      const postBody = await page.textContent('body');
      const stillOnChoice = postBody.includes('Type Your Answers') && postBody.includes('Write by Hand');
      const confirmAfter = await page.$('button:has-text("Confirm")');
      console.log('Still on choice:', stillOnChoice, '| Confirm after:', !!confirmAfter);
      R.v7a = !confirmBefore && !!confirmAfter && stillOnChoice;
      console.log('Two-step confirm:', R.v7a ? 'PASS' : 'FAIL');
      if (confirmAfter) { await confirmAfter.click(); await page.waitForTimeout(3000); }
    } else { R.v7a = false; }
  } else { R.v7a = null; }

  // VERIFY 5: FRQ nav label
  console.log('\n--- VERIFY 5: FRQ nav ---');
  await page.waitForTimeout(1500);
  const frqBody = await page.textContent('body');
  await ss(page, 'macro_09_frq_q1');
  const navMatch = frqBody.match(/Question (\d+) of (\d+)/);
  console.log('Nav label:', navMatch ? navMatch[0] : 'NOT FOUND');
  const navIdx = navMatch ? parseInt(navMatch[1]) : null;
  R.v5 = navIdx === 1;
  console.log('FRQ nav starts at 1:', R.v5 ? 'PASS' : 'FAIL');

  // ANSWER FRQ
  console.log('\n--- Answering FRQ ---');
  for (let fi = 0; fi < 8; fi++) {
    const ta = await page.$('textarea');
    if (ta) { await ta.fill('Macroeconomics answer ' + (fi+1) + ': Fiscal policy involves government spending and taxation to influence aggregate demand and national output in the economy.'); await page.waitForTimeout(200); }
    const fn = await page.$('button:has-text("Next")');
    const fr = await page.$('button:has-text("Review")');
    if (fn) { await fn.click(); await page.waitForTimeout(500); }
    else if (fr) { await fr.click(); await page.waitForTimeout(2000); break; }
    else break;
  }

  const frqRevBody = await page.textContent('body');
  const onFRQRev = frqRevBody.includes('Review Your Answers');
  console.log('On FRQ review:', onFRQRev);
  await ss(page, 'macro_10_frq_review');

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
      const urlAC = page.url();
      R.v7b = dialogAppeared;
      R.v7bc = !urlAC.includes('/results/');
      console.log('Dialog appeared:', R.v7b ? 'PASS' : 'FAIL');
      console.log('Dialog message:', dialogMsg);
      console.log('Cancel works:', R.v7bc ? 'PASS' : 'FAIL');
      console.log('URL after cancel:', urlAC);
      await ss(page, 'macro_11_after_cancel');
    }
  } else { console.log('FRQ review not reached'); }

  await browser.close();

  console.log('\n====================================');
  console.log('MACRO RETEST SUMMARY');
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
