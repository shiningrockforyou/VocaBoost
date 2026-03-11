// Full B14E distraction simulation — authoritative run
// Uses correct button selectors based on DOM inspection
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, 'b14e_retest_screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const RESULTS = [];
const CONSOLE_MSGS = [];

function log(msg) {
  console.log('[B14E-SIM] ' + msg);
  RESULTS.push(msg);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Find and click an MCQ answer choice by letter prefix
async function clickAnswer(page, letter) {
  // Try multiple strategies for finding MCQ answer buttons
  const allBtns = await page.locator('button').all();
  for (const btn of allBtns) {
    const text = await btn.textContent().catch(() => '');
    const isVisible = await btn.isVisible().catch(() => false);
    if (!isVisible || !text) continue;
    const trimmed = text.trim();
    // Match "A Something..." but not "Back", "Next", etc
    if (trimmed.startsWith(letter) && trimmed.length > 2 && trimmed.length < 200) {
      const cls = await btn.getAttribute('class').catch(() => '');
      // Exclude navigation/action buttons
      const isNavBtn = /back|next|review|submit|flag|navigator|section/i.test(trimmed.substring(0, 20));
      if (!isNavBtn) {
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        return { success: true, text: trimmed.substring(0, 60) };
      }
    }
  }
  // Fallback: try by role
  const answerBtns = page.locator('[role="radio"], [role="option"]').filter({ hasText: new RegExp('^' + letter) });
  if (await answerBtns.count() > 0) {
    await answerBtns.first().click();
    return { success: true, text: 'radio/option: ' + letter };
  }
  return { success: false, text: null };
}

// Get timer text from page
async function getTimerText(page) {
  // Try various timer selectors
  const selectors = [
    '[data-testid="timer"]',
    '[class*="Timer"]',
    '[class*="timer"]',
    'time',
    '.timer',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count() > 0) {
      const txt = await el.textContent().catch(() => '');
      if (txt && txt.match(/\d+:\d+/)) return txt.trim();
    }
  }
  // Try find by text content
  const allEls = await page.locator('*').all();
  for (const el of allEls) {
    const txt = await el.textContent().catch(() => '');
    if (txt && txt.trim().match(/^\d{1,2}:\d{2}$/)) return txt.trim();
  }
  return null;
}

// Verify selected answer on current question
async function getSelectedAnswer(page) {
  const selected = await page.locator('button[class*="brand-primary"]').all();
  if (selected.length > 0) {
    const txt = await selected[0].textContent().catch(() => '');
    return txt ? txt.trim().substring(0, 30) : '(selected)';
  }
  return null;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', msg => {
    CONSOLE_MSGS.push({ type: msg.type(), text: msg.text(), url: page.url() });
  });
  page.on('pageerror', err => {
    CONSOLE_MSGS.push({ type: 'pageerror', text: err.message, url: page.url() });
  });

  try {
    // === STEP 1: LOGIN ===
    log('=== STEP 1: LOGIN ===');
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_01_login.png') });

    await page.fill('input[type="email"]', 'student8@apboost.test');
    await page.fill('input[type="password"]', 'Student123!');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2500);

    const postLoginUrl = page.url();
    log('Post-login URL: ' + postLoginUrl);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_02_post_login.png') });

    if (postLoginUrl === 'http://localhost:5173/' || postLoginUrl === 'http://localhost:5173') {
      log('FINDING-B14E-001: Login -> / (STILL PRESENT, not /ap)');
    } else if (postLoginUrl.includes('/ap')) {
      log('FINDING-B14E-001: Login -> /ap (FIXED)');
    }

    if (!postLoginUrl.includes('/ap')) {
      await page.goto('http://localhost:5173/ap', { waitUntil: 'domcontentloaded' });
      await sleep(1500);
    }
    log('Dashboard URL: ' + page.url());
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_03_dashboard.png') });

    // === Check code.startsWith error ===
    log('=== Check code.startsWith error on test page nav ===');
    const consoleSnap1 = CONSOLE_MSGS.length;
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1', { waitUntil: 'domcontentloaded' });
    await sleep(4000);
    log('Test page URL: ' + page.url());
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_04_test_page.png') });

    const newMsgs1 = CONSOLE_MSGS.slice(consoleSnap1);
    const startsWithErrs = newMsgs1.filter(m => m.text && m.text.includes('startsWith'));
    const scheduleFlushErrs = newMsgs1.filter(m => m.text && m.text.includes('scheduleFlush'));
    log('code.startsWith errors: ' + startsWithErrs.length + ' (FINDING-B14E-002: ' + (startsWithErrs.length > 0 ? 'STILL PRESENT' : 'NOT FOUND — appears FIXED') + ')');
    log('scheduleFlush errors: ' + scheduleFlushErrs.length);

    // Check error boundary
    const pageBody1 = await page.locator('body').textContent().catch(() => '');
    const hasErrorBoundary = pageBody1.includes('Something went wrong');
    log('Error boundary shown: ' + hasErrorBoundary + (hasErrorBoundary ? ' WARNING — APErrorBoundary triggered!' : ''));

    // Handle session state
    const beginCount = await page.locator('button:has-text("Begin Test")').count();
    const resumeCount = await page.locator('button:has-text("Resume Test")').count();
    log('Begin: ' + beginCount + ', Resume: ' + resumeCount);

    if (resumeCount > 0) {
      log('Existing session — resuming...');
      await page.locator('button:has-text("Resume Test")').first().click();
      await sleep(2000);
    } else if (beginCount > 0) {
      log('New session — beginning test...');
      await page.locator('button:has-text("Begin Test")').first().click();
      await sleep(2000);
    } else {
      log('WARN: No Begin/Resume button');
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'sim_no_start_dom.html'), pageBody1.substring(0, 5000));
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_05_test_started.png') });
    log('Test session started. URL: ' + page.url());

    // Get current DOM state
    const testBody = await page.locator('body').textContent().catch(() => '');
    const inTest = testBody.includes('Section') || testBody.includes('Question') || testBody.includes('Answer');
    log('In test session: ' + inTest);

    // === STEP 3: Answer Q1-Q5 ===
    log('=== STEP 3: Answer Q1-Q5 ===');
    const answers1to5 = ['A', 'B', 'C', 'D', 'A'];

    for (let i = 0; i < 5; i++) {
      const qNum = i + 1;
      const letter = answers1to5[i];

      const result = await clickAnswer(page, letter);
      if (result.success) {
        log('Q' + qNum + ': Clicked ' + letter + ' ("' + result.text + '")');
        await sleep(700);

        // Verify selection
        const selected = await getSelectedAnswer(page);
        log('Q' + qNum + ': Selected answer: ' + (selected || '(none visible)'));
      } else {
        log('Q' + qNum + ': WARN — could not find answer ' + letter);
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'sim_q' + qNum + '_dom.html'), (await page.content()).substring(0, 6000));
      }

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_q' + qNum + '.png') });

      // Navigate to next question
      if (i < 4) {
        const nextBtn = page.locator('button:has-text("Next")').first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(800);
        }
      }
    }

    log('Q1-Q5 answered');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_06_q5_done.png') });

    // Get timer before distraction
    const timerBefore1 = await getTimerText(page);
    log('Timer before 45s tab switch: ' + (timerBefore1 || 'N/A'));

    // === STEP 4-5: Open blank tab, wait 45 seconds ===
    log('=== STEP 4-5: 45-second tab switch distraction ===');
    const blankTab = await context.newPage();
    await blankTab.goto('about:blank');
    log('Blank tab opened (about:blank) — waiting 45 seconds...');
    await sleep(45000);
    log('45 seconds elapsed — returning to test tab');

    // === STEP 6: Return to test tab ===
    log('=== STEP 6: Return to test tab ===');
    await blankTab.close();
    await page.bringToFront();
    await sleep(1500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_07_after_tab_switch.png') });
    log('Screenshot after tab switch: sim_07_after_tab_switch.png');

    // Check for DuplicateTabModal
    const dupeCount = await page.locator('text=Use This Tab').count()
      + await page.locator('text=Take Control').count()
      + await page.locator('text=Another tab is open').count()
      + await page.locator('text=another tab').count();
    if (dupeCount > 0) {
      log('REGRESSION: DuplicateTabModal appeared after 45s blank tab switch! (count=' + dupeCount + ')');
    } else {
      log('PASS: No DuplicateTabModal after 45s blank tab switch');
    }

    // Check timer after tab switch
    const timerAfter1 = await getTimerText(page);
    log('Timer after 45s tab switch: ' + (timerAfter1 || 'N/A'));
    if (timerBefore1 && timerAfter1) {
      const parse = t => {
        const [m, s] = t.split(':').map(Number);
        return m * 60 + s;
      };
      const diff = parse(timerBefore1) - parse(timerAfter1);
      log('Timer diff: ' + diff + 's (expected ~45s) — ' + (Math.abs(diff - 45) <= 10 ? 'PASS' : 'FAIL'));
    }

    // Test intact check
    const bodyAfterSwitch = await page.locator('body').textContent().catch(() => '');
    const testIntact = bodyAfterSwitch.includes('Section') || bodyAfterSwitch.includes('Question') || bodyAfterSwitch.includes('MCQ');
    log('Test still intact after tab switch: ' + testIntact);

    // Check Q1 answer persistence — navigate back
    log('Checking Q1 answer persistence...');
    for (let i = 0; i < 4; i++) {
      const backBtn = page.locator('button:has-text("Back"), button:has-text("Previous")').first();
      if (await backBtn.count() > 0) {
        await backBtn.click();
        await sleep(500);
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_08_q1_check.png') });

    const q1Selected = await getSelectedAnswer(page);
    log('Q1 answer after 45s switch: ' + (q1Selected || '(no selection found)'));
    if (q1Selected) {
      log('PASS: Q1 answer persisted after 45s tab switch');
    } else {
      log('FAIL: Q1 answer NOT persisted after 45s tab switch');
    }

    // === STEP 7: Answer Q6-Q10 ===
    log('=== STEP 7: Answer Q6-Q10 ===');
    // Navigate forward past Q1-Q5
    for (let i = 0; i < 5; i++) {
      const nextBtn = page.locator('button:has-text("Next")').first();
      if (await nextBtn.count() > 0) {
        await nextBtn.click();
        await sleep(600);
      }
    }

    const answers6to10 = ['B', 'C', 'D', 'A', 'B'];
    for (let i = 0; i < 5; i++) {
      const qNum = i + 6;
      const result = await clickAnswer(page, answers6to10[i]);
      if (result.success) {
        log('Q' + qNum + ': Clicked ' + answers6to10[i]);
        await sleep(700);
      } else {
        log('Q' + qNum + ': WARN — could not find answer ' + answers6to10[i]);
      }
      if (i < 4) {
        const nextBtn = page.locator('button:has-text("Next")').first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(700);
        }
      }
    }
    log('Q6-Q10 answered');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_09_q10_done.png') });

    // === STEP 8: Page blur (30 seconds) ===
    log('=== STEP 8: 30-second page blur ===');
    const timerBeforeBlur = await getTimerText(page);
    log('Timer before 30s blur: ' + (timerBeforeBlur || 'N/A'));

    // Dispatch visibilitychange to hidden
    await page.evaluate(function() {
      try {
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true, writable: false });
      } catch(e) {}
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('blur'));
    });
    log('Blur events dispatched (visibilitychange + window.blur)');

    const blurConsoleBefore = CONSOLE_MSGS.length;
    await sleep(30000);
    log('30 seconds elapsed during blur');

    // Check for errors during blur period
    const blurMsgs = CONSOLE_MSGS.slice(blurConsoleBefore);
    const blurErrors = blurMsgs.filter(m => m.type === 'error' || m.type === 'pageerror');
    log('Console errors during blur period: ' + blurErrors.length);
    blurErrors.forEach(e => log('  BLUR ERROR: ' + (e.text || '').substring(0, 150)));

    // Restore focus
    await page.evaluate(function() {
      try {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: false });
      } catch(e) {}
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    log('Focus restored');
    await sleep(2000);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_10_after_blur.png') });

    const timerAfterBlur = await getTimerText(page);
    log('Timer after 30s blur: ' + (timerAfterBlur || 'N/A'));
    if (timerBeforeBlur && timerAfterBlur) {
      const parse = t => {
        const [m, s] = t.split(':').map(Number);
        return m * 60 + s;
      };
      const diff = parse(timerBeforeBlur) - parse(timerAfterBlur);
      log('Blur timer diff: ' + diff + 's (expected ~30s) — ' + (Math.abs(diff - 30) <= 10 ? 'PASS' : 'FAIL'));
    }

    // Check for DuplicateTabModal after blur
    const dupAfterBlur = await page.locator('text=Use This Tab').count()
      + await page.locator('text=Take Control').count();
    log('DuplicateTabModal after blur: ' + (dupAfterBlur > 0 ? 'YES (regression!)' : 'NO (good)'));

    // === STEP 9: Answer Q11-Q15 ===
    log('=== STEP 9: Answer Q11-Q15 ===');
    const nextAfterBlur = page.locator('button:has-text("Next")').first();
    if (await nextAfterBlur.count() > 0) {
      await nextAfterBlur.click();
      await sleep(600);
    }

    const answers11to15 = ['C', 'D', 'A', 'B', 'C'];
    for (let i = 0; i < 5; i++) {
      const qNum = i + 11;
      const result = await clickAnswer(page, answers11to15[i]);
      if (result.success) {
        log('Q' + qNum + ': Clicked ' + answers11to15[i]);
        await sleep(700);
      } else {
        log('Q' + qNum + ': WARN — could not find answer ' + answers11to15[i]);
      }
      if (i < 4) {
        const nextBtn = page.locator('button:has-text("Next")').first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(700);
        }
      } else {
        // On Q15 — click Review
        const reviewBtn = page.locator('button:has-text("Review")').first();
        if (await reviewBtn.count() > 0) {
          await reviewBtn.click();
          log('Clicked Review button on Q15');
          await sleep(1500);
        } else {
          log('No Review button on Q15 — trying Next anyway');
          const nextBtn = page.locator('button:has-text("Next")').first();
          if (await nextBtn.count() > 0) {
            await nextBtn.click();
            await sleep(1000);
          }
        }
      }
    }

    log('Q11-Q15 answered');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_11_q15_done.png') });

    // === Review screen verification ===
    log('=== Verify Review Screen ===');
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await sleep(2000);
    log('Review URL: ' + page.url());

    const reviewBody = await page.locator('body').textContent().catch(() => '');
    const answeredMatch = reviewBody.match(/Answered[:\s]+(\d+)\s*\/\s*(\d+)/i);
    if (answeredMatch) {
      log('Review answered count: ' + answeredMatch[0]);
      log('All answered: ' + (answeredMatch[1] === answeredMatch[2] ? 'PASS' : 'FAIL (' + answeredMatch[1] + '/' + answeredMatch[2] + ')'));
    } else {
      const countPattern = reviewBody.match(/(\d+)\s*\/\s*(\d+)/g);
      log('Review count patterns: ' + (countPattern ? countPattern.slice(0, 5).join(', ') : 'none'));
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_12_review.png') });

    // === STEP 10: Submit MCQ Section ===
    log('=== STEP 10: Submit MCQ Section ===');
    const submitSecBtn = page.locator('button:has-text("Submit Section")').first();
    const submitSecCount = await submitSecBtn.count();
    log('Submit Section buttons: ' + submitSecCount);

    if (submitSecCount > 0) {
      await submitSecBtn.click();
      log('Clicked Submit Section');
      await sleep(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_13_submit_section.png') });

      // Handle any confirmation modal
      const confirmBtns = await page.locator('button:has-text("Confirm"), button:has-text("Yes, Submit")').count();
      if (confirmBtns > 0) {
        await page.locator('button:has-text("Confirm"), button:has-text("Yes, Submit")').first().click();
        log('Confirmed submission');
        await sleep(2500);
      }
    } else {
      log('WARN: No Submit Section button found — looking for any submit variant');
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const txt = await btn.textContent().catch(() => '');
        if (txt && txt.includes('Submit')) {
          log('  Found submit-like button: "' + txt.trim().substring(0, 40) + '"');
        }
      }
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_14_post_mcq_submit.png') });

    const postMcqBody = await page.locator('body').textContent().catch(() => '');
    const onFRQChoice = postMcqBody.includes('Type Your Answers') || postMcqBody.includes('Write by Hand') || postMcqBody.includes('FRQ') || postMcqBody.includes('Free Response');
    log('FRQ choice screen: ' + onFRQChoice);

    // === FRQ Section ===
    if (onFRQChoice) {
      log('PASS: FRQ choice screen appeared correctly');

      // Find and click Type Your Answers
      const allBtns = await page.locator('button').all();
      let typeClicked = false;
      for (const btn of allBtns) {
        const txt = await btn.textContent().catch(() => '');
        const vis = await btn.isVisible().catch(() => false);
        if (vis && txt && (txt.includes('Type') || txt.includes('Typed')) && txt.length < 80) {
          await btn.click();
          typeClicked = true;
          log('Clicked "Type Your Answers" button: "' + txt.trim().substring(0, 40) + '"');
          await sleep(1500);
          break;
        }
      }

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_15_frq_type.png') });

      if (typeClicked) {
        // Handle two-step confirm if present
        const confirmFrq = page.locator('button:has-text("Confirm & Continue"), button:has-text("Confirm"), button:has-text("Continue")').first();
        if (await confirmFrq.count() > 0) {
          await confirmFrq.click();
          log('FRQ type selection confirmed');
          await sleep(1000);
        }

        // Type FRQ answers for up to 10 sub-questions
        const frqText1 = 'In a perfectly competitive market, firms are price takers and produce where P = MC. Consumer surplus equals the area between the demand curve and market price. Producer surplus is the area between the supply curve and market price.';
        const frqText2 = 'Economic profit is zero in the long run for competitive firms due to free entry and exit. If economic profit exists, new firms enter, increasing supply and reducing price until profit equals zero.';

        const firstTextarea = page.locator('textarea').first();
        if (await firstTextarea.count() > 0) {
          await firstTextarea.fill(frqText1);
          log('FRQ sub-q 1 typed');
          await sleep(400);
        }

        let frqSubQ = 1;
        for (let fq = 0; fq < 12; fq++) {
          const submitTestBtn = page.locator('button:has-text("Submit Test")').first();
          const nextFrqBtn = page.locator('button:has-text("Next"), button:has-text("Save & Next"), button:has-text("Next Question")').first();

          if (await submitTestBtn.count() > 0) {
            log('PASS: Submit Test button found at FRQ sub-q ' + (frqSubQ + 1));
            await submitTestBtn.click();
            log('Clicked Submit Test');
            await sleep(2000);

            const confirmFinal = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
            if (await confirmFinal.count() > 0) {
              await confirmFinal.click();
              log('Final submission confirmed');
              await sleep(4000);
            }
            break;
          } else if (await nextFrqBtn.count() > 0) {
            await nextFrqBtn.click();
            frqSubQ++;
            await sleep(800);
            const nextTa = page.locator('textarea').first();
            if (await nextTa.count() > 0) {
              await nextTa.fill(frqText2 + ' (sub-question ' + frqSubQ + ')');
            }
          } else {
            log('FRQ: No Next or Submit Test at sub-q ' + (frqSubQ + 1));
            break;
          }
        }
      } else {
        log('WARN: Could not click Type Your Answers');
      }
    }

    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_16_final.png') });

    const finalUrl = page.url();
    const finalBody = await page.locator('body').textContent().catch(() => '');
    log('Final URL: ' + finalUrl);

    const onReportCard = finalUrl.includes('/results/') || finalBody.includes('Report Card') || finalBody.includes('MCQ Score') || finalBody.includes('Your Score');
    log('Report card reached: ' + (onReportCard ? 'PASS' : 'FAIL'));

    if (onReportCard) {
      const scoreM = finalBody.match(/(\d+)\s*\/\s*15/);
      log('MCQ score: ' + (scoreM ? scoreM[0] : 'pattern not found'));
      const pendingFRQ = finalBody.includes('Pending') || finalBody.includes('FRQ');
      log('FRQ section visible: ' + pendingFRQ);
    }

    // === FINAL: Console error analysis ===
    log('=== FINAL CONSOLE ANALYSIS ===');
    const allErrors = CONSOLE_MSGS.filter(m => m.type === 'error' || m.type === 'pageerror');
    log('Total console errors: ' + allErrors.length);
    allErrors.forEach(e => {
      log('  ERROR [' + (e.url || '').split('/').pop().substring(0, 25) + ']: ' + (e.text || '').substring(0, 200));
    });

    const finalStartsWithErrs = CONSOLE_MSGS.filter(m => m.text && m.text.includes('startsWith'));
    log('code.startsWith errors (total): ' + finalStartsWithErrs.length);
    if (finalStartsWithErrs.length > 0) {
      log('FINDING-B14E-002: STILL PRESENT (' + finalStartsWithErrs.length + 'x)');
    } else {
      log('FINDING-B14E-002: NOT FOUND — appears FIXED or not triggered');
    }

    const visErrors = CONSOLE_MSGS.filter(m => m.text && m.text.includes('visibilitychange'));
    log('visibilitychange errors: ' + visErrors.length);

    const focusErrors = CONSOLE_MSGS.filter(m => m.text && (m.text.includes('focus') || m.text.includes('blur')));
    log('focus/blur errors: ' + focusErrors.length);

    const firebaseWarns = CONSOLE_MSGS.filter(m => m.text && m.text.includes('Cloud Firestore'));
    log('Firebase warnings: ' + firebaseWarns.length);

  } catch (err) {
    log('FATAL: ' + err.message + '\n' + err.stack.substring(0, 500));
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sim_error.png') }).catch(() => {});
  }

  const output = { results: RESULTS, consoleMsgs: CONSOLE_MSGS, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, 'b14e_full_sim_results.json'), JSON.stringify(output, null, 2));
  log('Saved b14e_full_sim_results.json');

  await browser.close();
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
