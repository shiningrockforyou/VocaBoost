const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RESULTS = [];
const CONSOLE_MSGS = [];
const SCREENSHOTS_DIR = path.join(__dirname, 'b14e_retest_screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

function log(msg) {
  console.log('[B14E-RETEST] ' + msg);
  RESULTS.push(msg);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickAnswerChoice(page, letter) {
  const allBtns = await page.locator('button').all();
  for (const btn of allBtns) {
    const text = await btn.textContent().catch(() => '');
    const isVisible = await btn.isVisible().catch(() => false);
    const trimmed = text ? text.trim() : '';
    if (isVisible && trimmed.startsWith(letter) && trimmed.length > 1 && trimmed.length < 120) {
      if (!trimmed.includes('Back') && !trimmed.includes('Next') && !trimmed.includes('Review') && !trimmed.includes('Submit')) {
        await btn.click();
        return true;
      }
    }
  }
  return false;
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
    // STEP 1: LOGIN
    log('STEP 1: Navigating to login page...');
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('domcontentloaded');
    await sleep(1000);

    log('Login page URL: ' + page.url());
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_login.png') });

    await page.fill('input[type="email"]', 'student8@apboost.test');
    await page.fill('input[type="password"]', 'Student123!');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_filled.png') });

    await page.click('button[type="submit"]');
    await page.waitForLoadState('domcontentloaded');
    await sleep(2500);

    const postLoginUrl = page.url();
    log('Post-login URL: ' + postLoginUrl);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_post_login.png') });

    if (postLoginUrl === 'http://localhost:5173/' || postLoginUrl === 'http://localhost:5173') {
      log('FINDING-B14E-001: Login redirected to / not /ap — STILL PRESENT');
    } else if (postLoginUrl.includes('/ap')) {
      log('FINDING-B14E-001 STATUS: Login redirect to /ap — FIXED');
    }

    if (!postLoginUrl.includes('/ap')) {
      await page.goto('http://localhost:5173/ap');
      await page.waitForLoadState('domcontentloaded');
      await sleep(1500);
    }

    log('AP Dashboard URL: ' + page.url());
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04_dashboard.png') });

    // STEP 2: Check code.startsWith error at test page
    log('STEP 2: Navigating to test page to check for code.startsWith error...');
    const consoleSnapBefore = CONSOLE_MSGS.length;
    await page.goto('http://localhost:5173/ap/test/test_micro_full_1', { waitUntil: 'domcontentloaded' });
    await sleep(4000);

    log('Test page URL: ' + page.url());

    const newMsgs = CONSOLE_MSGS.slice(consoleSnapBefore);
    const startsWithErrors = newMsgs.filter(m => m.text && m.text.includes('startsWith'));
    if (startsWithErrors.length > 0) {
      log('FINDING-B14E-002: code.startsWith STILL PRESENT (' + startsWithErrors.length + 'x): ' + startsWithErrors.map(m => m.text).join(' | '));
    } else {
      log('FINDING-B14E-002: code.startsWith NOT FOUND on test page nav');
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05_test_page.png') });

    // Handle session state
    const resumeCount = await page.locator('button:has-text("Resume Test")').count();
    const beginCount = await page.locator('button:has-text("Begin Test")').count();
    log('Resume: ' + resumeCount + ', Begin: ' + beginCount);

    if (resumeCount > 0) {
      log('Existing session — resuming...');
      await page.locator('button:has-text("Resume Test")').first().click();
    } else if (beginCount > 0) {
      log('Fresh session — beginning...');
      await page.locator('button:has-text("Begin Test")').first().click();
    } else {
      log('WARNING: Neither Resume nor Begin button found');
      fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'session_state.html'), (await page.content()).substring(0, 8000));
    }

    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06_test_started.png') });

    // STEP 3: Answer Q1-Q5
    log('STEP 3: Answering Q1-Q5...');
    const q1to5 = ['A', 'B', 'C', 'D', 'A'];

    for (let i = 0; i < 5; i++) {
      const qNum = i + 1;
      const letter = q1to5[i];
      const clicked = await clickAnswerChoice(page, letter);
      if (clicked) {
        log('Q' + qNum + ': Clicked ' + letter);
        await sleep(600);
        const selectedCount = await page.locator('button[class*="brand-primary"]').count();
        log('Q' + qNum + ': brand-primary buttons: ' + selectedCount);
      } else {
        log('Q' + qNum + ': WARNING — could not find answer ' + letter);
        fs.writeFileSync(path.join(SCREENSHOTS_DIR, 'q' + qNum + '_dom.html'), (await page.content()).substring(0, 6000));
      }
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'q' + qNum + '.png') });

      if (i < 4) {
        const nextBtn = page.locator('button:has-text("Next")').first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(700);
        }
      }
    }

    log('Q1-Q5 answered');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07_q5_done.png') });

    // Get timer before tab switch
    const timerEl1 = await page.locator('[class*="timer"]').first().textContent().catch(() => 'N/A');
    log('Timer before 45s tab switch: ' + timerEl1);

    // STEP 4-5: Open blank tab, wait 45 seconds
    log('STEP 4-5: Opening blank tab for 45s distraction...');
    const blankTab = await context.newPage();
    await blankTab.goto('about:blank');
    log('Blank tab opened — waiting 45 seconds...');
    await sleep(45000);
    log('45 seconds elapsed');

    // STEP 6: Return to test tab
    log('STEP 6: Returning to test tab...');
    await blankTab.close();
    await page.bringToFront();
    await sleep(1500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08_after_tab_switch.png') });
    log('Screenshot 08_after_tab_switch.png taken');

    // Check for DuplicateTabModal
    const dupCount = await page.locator('text=another tab').count()
      + await page.locator('text=Another tab').count()
      + await page.locator('text=Use This Tab').count()
      + await page.locator('text=Take Control').count();
    if (dupCount > 0) {
      log('REGRESSION: DuplicateTabModal appeared after blank tab (count=' + dupCount + ')');
    } else {
      log('PASS: No DuplicateTabModal after 45s blank tab switch');
    }

    const timerEl2 = await page.locator('[class*="timer"]').first().textContent().catch(() => 'N/A');
    log('Timer after 45s tab switch: ' + timerEl2);

    const bodyAfterSwitch = await page.locator('body').textContent().catch(() => '');
    const testIntact = bodyAfterSwitch.includes('Question') || bodyAfterSwitch.includes('Section') || bodyAfterSwitch.includes('answer');
    log('Test still intact: ' + testIntact);

    // Check Q1 answer persistence
    log('Checking Q1 answer persistence (navigating back)...');
    for (let i = 0; i < 4; i++) {
      const backBtn = page.locator('button:has-text("Back"), button:has-text("Previous")').first();
      if (await backBtn.count() > 0) {
        await backBtn.click();
        await sleep(500);
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09_q1_check.png') });
    const q1SelectedCount = await page.locator('button[class*="brand-primary"]').count();
    log('Q1 selected (brand-primary): ' + q1SelectedCount);

    // STEP 7: Navigate to Q6 and answer Q6-Q10
    log('STEP 7: Answering Q6-Q10...');
    for (let i = 0; i < 5; i++) {
      const nextBtn = page.locator('button:has-text("Next")').first();
      if (await nextBtn.count() > 0) {
        await nextBtn.click();
        await sleep(500);
      }
    }

    const q6to10 = ['B', 'C', 'D', 'A', 'B'];
    for (let i = 0; i < 5; i++) {
      const qNum = i + 6;
      const clicked = await clickAnswerChoice(page, q6to10[i]);
      if (clicked) {
        log('Q' + qNum + ': Clicked ' + q6to10[i]);
        await sleep(600);
      } else {
        log('Q' + qNum + ': WARNING — could not click ' + q6to10[i]);
      }
      if (i < 4) {
        const nextBtn = page.locator('button:has-text("Next")').first();
        if (await nextBtn.count() > 0) {
          await nextBtn.click();
          await sleep(600);
        }
      }
    }

    log('Q6-Q10 answered');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10_q10_done.png') });

    // STEP 8: Page blur for 30 seconds
    log('STEP 8: Triggering page blur (30s)...');
    const timerBeforeBlur = await page.locator('[class*="timer"]').first().textContent().catch(() => 'N/A');
    log('Timer before 30s blur: ' + timerBeforeBlur);

    await page.evaluate(function() {
      try { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); } catch(e) {}
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('blur'));
    });
    log('Blur dispatched');

    await sleep(30000);
    log('30 seconds elapsed');

    await page.evaluate(function() {
      try { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); } catch(e) {}
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    log('Focus restored');
    await sleep(1500);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11_after_blur.png') });
    const timerAfterBlur = await page.locator('[class*="timer"]').first().textContent().catch(() => 'N/A');
    log('Timer after 30s blur: ' + timerAfterBlur);

    const blurErrCount = CONSOLE_MSGS.filter(m => (m.type === 'pageerror') && ((m.text || '').includes('visibility') || (m.text || '').includes('blur'))).length;
    log('Visibility/blur console errors after blur phase: ' + blurErrCount);

    // STEP 9: Answer Q11-Q15
    log('STEP 9: Answering Q11-Q15...');
    const nextToQ11 = page.locator('button:has-text("Next")').first();
    if (await nextToQ11.count() > 0) {
      await nextToQ11.click();
      await sleep(500);
    }

    const q11to15 = ['C', 'D', 'A', 'B', 'C'];
    for (let i = 0; i < 5; i++) {
      const qNum = i + 11;
      const clicked = await clickAnswerChoice(page, q11to15[i]);
      if (clicked) {
        log('Q' + qNum + ': Clicked ' + q11to15[i]);
        await sleep(600);
      } else {
        log('Q' + qNum + ': WARNING — could not click ' + q11to15[i]);
      }

      if (i < 4) {
        const nBtn = page.locator('button:has-text("Next")').first();
        if (await nBtn.count() > 0) {
          await nBtn.click();
          await sleep(600);
        }
      } else {
        const reviewBtn = page.locator('button:has-text("Review")').first();
        if (await reviewBtn.count() > 0) {
          await reviewBtn.click();
          log('Clicked Review after Q15');
          await sleep(1500);
        }
      }
    }

    log('Q11-Q15 answered');
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12_q15_review.png') });

    // Verify review screen
    await page.waitForLoadState('domcontentloaded');
    await sleep(1500);
    log('Review screen URL: ' + page.url());

    const reviewBody = await page.locator('body').textContent().catch(() => '');
    const answeredMatch = reviewBody.match(/Answered[:\s]+(\d+)\s*\/\s*(\d+)/i);
    if (answeredMatch) {
      log('Review answered: ' + answeredMatch[0]);
      log('All answered: ' + (answeredMatch[1] === answeredMatch[2]));
    } else {
      const nums = reviewBody.match(/\d+\/\d+/g);
      log('Review numeric patterns: ' + (nums ? nums.join(', ') : 'none found'));
    }

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13_review_screen.png') });

    // Submit MCQ section
    log('STEP 10: Submitting MCQ section...');
    const submitSec = page.locator('button:has-text("Submit Section")').first();
    if (await submitSec.count() > 0) {
      await submitSec.click();
      log('Submit Section clicked');
      await sleep(2000);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14_submit_clicked.png') });

      const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes, Submit")').first();
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
        log('Submit confirmed');
        await sleep(2500);
      }
    } else {
      log('WARNING: Submit Section button not found');
    }

    await page.waitForLoadState('domcontentloaded');
    await sleep(2000);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15_post_mcq_submit.png') });

    const postMcqBody = await page.locator('body').textContent().catch(() => '');
    const onFRQ = postMcqBody.includes('FRQ') || postMcqBody.includes('Type Your') || postMcqBody.includes('Write by Hand') || postMcqBody.includes('Choose');
    log('On FRQ choice screen: ' + onFRQ);

    if (onFRQ) {
      log('PASS: FRQ choice screen appeared');

      // Click Type Your Answers
      const allBtns = await page.locator('button').all();
      let typeClicked = false;
      for (const btn of allBtns) {
        const txt = await btn.textContent().catch(() => '');
        if (txt && txt.includes('Type') && txt.length < 60) {
          await btn.click();
          typeClicked = true;
          log('Clicked Type Your Answers');
          await sleep(1500);
          break;
        }
      }

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16_frq_selected.png') });

      if (typeClicked) {
        const confirmFrq = page.locator('button:has-text("Confirm & Continue"), button:has-text("Confirm"), button:has-text("Continue")').first();
        if (await confirmFrq.count() > 0) {
          await confirmFrq.click();
          log('FRQ type confirmed');
          await sleep(1000);
        }

        const textarea = page.locator('textarea').first();
        if (await textarea.count() > 0) {
          await textarea.fill('Supply and demand analysis demonstrates that market equilibrium occurs where quantity demanded equals quantity supplied at a given price level.');
          log('FRQ answer 1 typed');
          await sleep(400);

          for (let fq = 0; fq < 10; fq++) {
            const submitTestBtn = page.locator('button:has-text("Submit Test")').first();
            const nextFrqBtn = page.locator('button:has-text("Next"), button:has-text("Save & Next")').first();

            if (await submitTestBtn.count() > 0) {
              await submitTestBtn.click();
              log('Submit Test clicked at FRQ sub-q ' + (fq + 1));
              await sleep(2000);
              const yesBtn = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
              if (await yesBtn.count() > 0) {
                await yesBtn.click();
                await sleep(3000);
              }
              break;
            } else if (await nextFrqBtn.count() > 0) {
              await nextFrqBtn.click();
              await sleep(800);
              const nextTa = page.locator('textarea').first();
              if (await nextTa.count() > 0) {
                await nextTa.fill('Microeconomic principles of cost minimization and profit maximization guide firm behavior in competitive markets.');
              }
            } else {
              log('FRQ: No Next or Submit at sub-q ' + (fq + 1));
              break;
            }
          }
        }
      }
    }

    await page.waitForLoadState('domcontentloaded');
    await sleep(2500);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '17_final_state.png') });

    const finalUrl = page.url();
    const finalBody = await page.locator('body').textContent().catch(() => '');
    log('Final URL: ' + finalUrl);

    const reportCardReached = finalUrl.includes('/results/') || finalBody.includes('Report Card') || finalBody.includes('MCQ Score') || finalBody.includes('Score:');
    log('Report card reached: ' + reportCardReached);

    if (reportCardReached) {
      log('PASS: Report card loaded');
      const scoreM = finalBody.match(/(\d+)\s*\/\s*15/);
      if (scoreM) log('MCQ score: ' + scoreM[0]);
    }

    // FINAL: Console error analysis
    log('=== FINAL CONSOLE ERROR ANALYSIS ===');
    const allErrors = CONSOLE_MSGS.filter(m => m.type === 'error' || m.type === 'pageerror');
    log('Total errors: ' + allErrors.length);
    allErrors.forEach(e => {
      log('  ERROR [' + (e.url || '').split('/').pop().substring(0, 30) + ']: ' + (e.text || '').substring(0, 200));
    });

    const startsWithAll = CONSOLE_MSGS.filter(m => m.text && m.text.includes('startsWith'));
    log('code.startsWith total: ' + startsWithAll.length);

    const visErrors = CONSOLE_MSGS.filter(m => m.text && (m.text.includes('visibility') || m.text.includes('visibilitychange')));
    log('visibility-related errors: ' + visErrors.length);

    const focusErrors = CONSOLE_MSGS.filter(m => m.text && (m.text.includes('blur') || m.text.includes('focus')));
    log('focus/blur errors: ' + focusErrors.length);

    const firebaseWarnings = CONSOLE_MSGS.filter(m => m.text && m.text.includes('Cloud Firestore'));
    log('Firebase connection warnings: ' + firebaseWarnings.length);

  } catch (err) {
    log('FATAL ERROR: ' + err.message + '\n' + err.stack);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png') }).catch(() => {});
  }

  const output = { results: RESULTS, consoleMsgs: CONSOLE_MSGS, timestamp: new Date().toISOString() };
  fs.writeFileSync(path.join(__dirname, 'b14e_retest_results.json'), JSON.stringify(output, null, 2));
  log('Results saved to b14e_retest_results.json');

  await browser.close();
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
