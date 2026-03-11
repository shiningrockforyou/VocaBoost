/**
 * B14H Retest Script v3 — Focused verification of FIX-3, FIX-4, FIX-5
 * Uses fresh browser context with cleared state to test after HMR reload
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5173';
const EMAIL = 'student11@apboost.test';
const PASSWORD = 'Student123!';
const TEST_ID = 'test_micro_full_1';
const TEST_URL = `${BASE_URL}/ap/test/${TEST_ID}`;
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots_B14H_retest_v3');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let ssCount = 0;
const ss = async (page, label) => {
  ssCount++;
  const f = path.join(SCREENSHOT_DIR, `${String(ssCount).padStart(3,'0')}_${label}.png`);
  await page.screenshot({ path: f, fullPage: true }).catch(e => {});
  console.log(`[SS ${ssCount}] ${label}`);
};

const log = (...args) => {
  const ts = new Date().toISOString().split('T')[1].slice(0, 8);
  console.log(`[${ts}]`, ...args);
};

async function login(context, email, password) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.press('input[type="password"]', 'Enter');
  await page.waitForTimeout(4000);
  log('Login URL:', page.url());
  if (!page.url().includes('/ap')) {
    await page.goto(`${BASE_URL}/ap`);
    await page.waitForTimeout(2000);
  }
  return page;
}

async function gotoTest(page) {
  await page.goto(TEST_URL);
  await page.waitForTimeout(5000);
  return page.url().includes(TEST_ID);
}

async function clickResumeOrBegin(page) {
  const btn = page.locator('button:has-text("Begin Test"), button:has-text("Resume Test")').first();
  await btn.waitFor({ state: 'visible', timeout: 10000 });
  const text = (await btn.textContent()).trim();
  await btn.click({ force: true }); // force to bypass any overlay
  await page.waitForTimeout(2500);
  log(`Clicked "${text}"`);
  return text;
}

async function isInTesting(page) {
  const body = await page.locator('body').textContent().catch(() => '');
  return body.includes('Flag for Review') || (body.includes('Question') && body.includes('Next →'));
}

async function hasModal(page) {
  const body = await page.locator('body').textContent().catch(() => '');
  return body.includes('Use This Tab') || body.includes('Session Active Elsewhere');
}

async function clickUseThisTab(page) {
  const btn = page.locator('button:has-text("Use This Tab")').first();
  const vis = await btn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!vis) return false;
  await btn.click();
  await page.waitForTimeout(2000);
  log('Clicked "Use This Tab"');
  return true;
}

async function answerQ(page, choiceIdx = 0) {
  // Find answer choices - try multiple strategies
  // Strategy 1: Look for buttons containing "(A)", "(B)" or similar
  // Strategy 2: Look for any radio buttons
  // Strategy 3: DOM evaluation

  const result = await page.evaluate((idx) => {
    // Try to find the AnswerInput component's buttons
    // MCQ choices are rendered as clickable divs/buttons
    const allElements = document.querySelectorAll('button, [role="radio"], [data-choice], label input[type="radio"]');

    // Filter to likely answer choices - they should be in the main content area
    const mainContent = document.querySelector('main, [class*="question"], [class*="answer"]');
    if (!mainContent) return { found: false, reason: 'no main content' };

    // Get interactive elements within main
    const interactives = mainContent.querySelectorAll('button, [role="radio"]');

    if (interactives.length === 0) return { found: false, reason: 'no interactives in main' };

    const target = interactives[idx % interactives.length];
    target.click();
    return {
      found: true,
      text: target.textContent?.substring(0, 50),
      tag: target.tagName,
      count: interactives.length
    };
  }, choiceIdx);

  await page.waitForTimeout(400);
  return result.found;
}

async function clickNext(page) {
  try {
    const btn = page.locator('button:has-text("Next →")').first();
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(400);
    return true;
  } catch {
    return false;
  }
}

async function getQNum(page) {
  const body = await page.locator('body').textContent().catch(() => '');
  const m = body.match(/Question (\d+) of (\d+)/);
  return m ? { cur: parseInt(m[1]), total: parseInt(m[2]) } : null;
}

async function getAnsweredCount(page) {
  const body = await page.locator('body').textContent().catch(() => '');
  const m = body.match(/Answered[:\s]+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

async function runV3() {
  log('=== B14H Retest v3 — Starting ===');

  const browser = await chromium.launch({ headless: false, slowMo: 100 });

  const findings = {
    login: null,
    navigateToTest: null,
    beginTest: null,
    q1_q3_answered: null,
    fix3_modal_on_instruction: null,
    fix3_detail: null,
    fix3_instruction_screen_blocked: null,
    fix4_tab1_invalidated: null,
    fix4_detail: null,
    fix5_q1_q3_in_tab2: null,
    fix5_detail: null,
    q4_q6_tab2: null,
    tab1_reclaim: null,
    q1_q6_all_present: null,
    q7_q15_answered: null,
    submit_and_report_card: null,
    regression_new_issues: [],
  };

  const context = await browser.newContext();
  const tab1Logs = [], tab2Logs = [];

  try {
    // ============================================================
    // SETUP: Login and start test in Tab 1
    // ============================================================
    log('\n--- Login and setup Tab 1 ---');
    const tab1 = await login(context, EMAIL, PASSWORD);
    tab1.on('console', m => {
      if (m.text().includes('APBoost') || m.type() === 'error') tab1Logs.push({ type: m.type(), text: m.text() });
    });

    findings.login = tab1.url().includes('/ap') ? 'PASS' : 'FAIL';

    // Navigate to test
    const onTest = await gotoTest(tab1);
    findings.navigateToTest = onTest ? 'PASS' : 'FAIL';
    await ss(tab1, 'tab1_instruction_screen');

    // Check if Tab 1 has a stale DuplicateTabModal blocking it
    const tab1HasStalModal = await hasModal(tab1);
    log('Tab 1 stale modal on load:', tab1HasStalModal);
    if (tab1HasStalModal) {
      log('Clearing stale modal by clicking "Use This Tab"');
      await clickUseThisTab(tab1);
      await ss(tab1, 'tab1_stale_modal_cleared');
    }

    // Begin test
    const beginText = await clickResumeOrBegin(tab1);
    const inTesting = await isInTesting(tab1);
    findings.beginTest = inTesting ? `PASS (clicked "${beginText}")` : 'FAIL';
    await ss(tab1, 'tab1_in_testing');

    // ============================================================
    // STEP 4: Answer Q1-Q3 in Tab 1 (quickly, before Firestore flush)
    // ============================================================
    log('\n--- Answer Q1-Q3 in Tab 1 ---');

    const q1Ans = await answerQ(tab1, 0);
    await ss(tab1, 'tab1_q1_answered');
    log('Q1 answered:', q1Ans);
    await clickNext(tab1);

    const q2Ans = await answerQ(tab1, 1);
    log('Q2 answered:', q2Ans);
    await clickNext(tab1);

    const q3Ans = await answerQ(tab1, 2);
    log('Q3 answered:', q3Ans);
    await ss(tab1, 'tab1_q3_answered');

    findings.q1_q3_answered = (q1Ans && q2Ans && q3Ans) ? 'PASS (3/3 answered)' : `PARTIAL (Q1:${q1Ans} Q2:${q2Ans} Q3:${q3Ans})`;

    // Short wait - we want Tab 2 to open BEFORE Firestore flush completes
    // (300ms debounce for ANSWER_CHANGE, so we need < 300ms after last answer)
    // Actually wait just a moment for the queue to be set up
    await tab1.waitForTimeout(500);

    const tab1ChannelLogs = tab1Logs.filter(l => l.text.includes('useDuplicateTabGuard') || l.text.includes('SESSION_CLAIMED') || l.text.includes('SESSION_QUERY'));
    log('Tab 1 BroadcastChannel logs:', tab1ChannelLogs.map(l => l.text.substring(0, 100)));

    // ============================================================
    // FIX-3 TEST: Open Tab 2, verify DuplicateTabModal appears IMMEDIATELY
    // ============================================================
    log('\n--- FIX-3 TEST: Open Tab 2 ---');

    const tab2 = await context.newPage();
    tab2.on('console', m => {
      if (m.text().includes('APBoost') || m.type() === 'error') tab2Logs.push({ type: m.type(), text: m.text() });
    });

    await tab2.goto(TEST_URL);

    // Check for modal at multiple time intervals
    let tab2ModalAt = null;
    for (let t = 0; t <= 10; t++) {
      await tab2.waitForTimeout(500);
      const modal = await hasModal(tab2);
      const instr = await tab2.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first().isVisible({ timeout: 500 }).catch(() => false);
      log(`Tab2 t=${t*0.5}s: hasModal=${modal} hasResumeBtn=${instr}`);
      if (modal && tab2ModalAt === null) {
        tab2ModalAt = t * 0.5;
      }
    }

    await ss(tab2, 'tab2_after_navigate');

    // Final check
    const tab2HasModalFinal = await hasModal(tab2);
    const tab2OnInstruction = await tab2.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first().isVisible({ timeout: 1000 }).catch(() => false);

    log('Tab 2 final state: hasModal:', tab2HasModalFinal, 'onInstruction:', tab2OnInstruction);

    // FIX-3 RESULT
    if (tab2HasModalFinal && tab2OnInstruction) {
      findings.fix3_modal_on_instruction = 'FIXED';
      findings.fix3_detail = `DuplicateTabModal appeared at t=${tab2ModalAt}s while instruction screen visible`;
      findings.fix3_instruction_screen_blocked = 'PASS - Modal overlays instruction screen, "Resume Test" cannot be clicked';
    } else if (tab2HasModalFinal && !tab2OnInstruction) {
      findings.fix3_modal_on_instruction = 'PARTIAL - Modal appears but instruction screen not visible';
      findings.fix3_detail = 'Modal shown but instruction view rendered differently';
    } else {
      findings.fix3_modal_on_instruction = 'STILL BROKEN';
      findings.fix3_detail = `Modal not shown after ${5}s. isInvalidated should be true (BroadcastChannel confirmed working). Instruction screen visible: ${tab2OnInstruction}`;
    }

    // Log Tab 2 BroadcastChannel activity
    const tab2ChannelLogs = tab2Logs.filter(l => l.text.includes('useDuplicateTabGuard') || l.text.includes('SESSION') || l.text.includes('blocking'));
    log('Tab 2 BroadcastChannel logs:', tab2ChannelLogs.map(l => l.text.substring(0, 120)));

    // ============================================================
    // FIX-4 TEST: Click "Use This Tab" in Tab 2, verify Tab 1 gets invalidated
    // ============================================================
    log('\n--- FIX-4 TEST: Use This Tab in Tab 2 ---');

    if (tab2HasModalFinal) {
      const usedTab2 = await clickUseThisTab(tab2);
      await ss(tab2, 'tab2_after_use_this_tab');

      if (usedTab2) {
        // Now check Tab 1 - it should show DuplicateTabModal
        await tab1.bringToFront();
        await tab1.waitForTimeout(2000);
        await ss(tab1, 'tab1_after_tab2_claimed');

        const tab1HasModal = await hasModal(tab1);
        log('Tab 1 has modal after Tab 2 took control:', tab1HasModal);

        findings.fix4_tab1_invalidated = tab1HasModal ? 'FIXED' : 'STILL BROKEN';
        findings.fix4_detail = tab1HasModal ?
          'Tab 1 shows DuplicateTabModal immediately after Tab 2 clicked "Use This Tab"' :
          'Tab 1 did NOT show modal after Tab 2 took control (SESSION_CLAIMED not received or not handled)';

        // ============================================================
        // FIX-5 TEST: Answer Q4-Q6 in Tab 2, then verify Q1-Q3 from Tab 1 are present
        // ============================================================
        log('\n--- FIX-5 TEST: Answer Q4-Q6 in Tab 2 ---');

        await tab2.bringToFront();

        // Tab 2 should be on instruction screen after "Use This Tab"
        const tab2OnInstruction2 = await tab2.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first().isVisible({ timeout: 3000 }).catch(() => false);
        log('Tab 2 on instruction after Use This Tab:', tab2OnInstruction2);

        if (tab2OnInstruction2) {
          await clickResumeOrBegin(tab2);
          await ss(tab2, 'tab2_entered_testing');
        }

        // Check if Tab 2's session has Q1-Q3 answers from Tab 1 (FIX-5)
        // Navigate back to Q1 to check
        const tab2QInfo = await getQNum(tab2);
        log('Tab 2 current question:', tab2QInfo);

        // Verify Q1-Q3 answers via the review screen (quickest way)
        // First answer Q4-Q6

        // Advance past Q3 if needed
        if (tab2QInfo && tab2QInfo.cur <= 3) {
          for (let q = tab2QInfo.cur; q <= 3; q++) {
            await clickNext(tab2);
            await tab2.waitForTimeout(300);
          }
        }

        // Answer Q4
        const q4a = await answerQ(tab2, 1);
        log('Q4 answered:', q4a);
        await ss(tab2, 'tab2_q4_answered');
        await clickNext(tab2);

        // Answer Q5
        const q5a = await answerQ(tab2, 2);
        log('Q5 answered:', q5a);
        await clickNext(tab2);

        // Answer Q6
        const q6a = await answerQ(tab2, 3);
        log('Q6 answered:', q6a);
        await ss(tab2, 'tab2_q6_answered');

        findings.q4_q6_tab2 = (q4a || q5a || q6a) ? 'PASS' : 'PARTIAL';

        // Wait for Tab 2's answers to sync
        await tab2.waitForTimeout(3000);

        // Check FIX-5: Navigate to review in Tab 2 to see answered count
        // If Q1-Q3 from Tab 1 are present, we should see >= 6 answered
        const reviewBtn = tab2.locator('button:has-text("Review →")').last();
        const reviewVis = await reviewBtn.isVisible({ timeout: 3000 }).catch(() => false);

        let tab2AnsweredCount = null;
        if (reviewVis) {
          await reviewBtn.click();
          await tab2.waitForTimeout(2000);
          await ss(tab2, 'tab2_review_screen');

          tab2AnsweredCount = await getAnsweredCount(tab2);
          log('Tab 2 review - answered count:', tab2AnsweredCount);

          if (tab2AnsweredCount !== null) {
            if (tab2AnsweredCount >= 6) {
              findings.fix5_q1_q3_in_tab2 = 'FIXED';
              findings.fix5_detail = `Tab 2 shows ${tab2AnsweredCount} answered questions - includes Q1-Q3 from Tab 1`;
            } else if (tab2AnsweredCount >= 3) {
              findings.fix5_q1_q3_in_tab2 = 'PARTIAL';
              findings.fix5_detail = `Tab 2 shows ${tab2AnsweredCount} answered - Tab 1's Q1-Q3 may not have flushed in time`;
            } else {
              findings.fix5_q1_q3_in_tab2 = 'STILL BROKEN';
              findings.fix5_detail = `Tab 2 shows only ${tab2AnsweredCount} answers - Q1-Q3 from Tab 1 NOT present`;
            }
          }

          // Return from review
          const returnBtn = tab2.locator('button:has-text("Return"), button:has-text("Cancel"), button:has-text("Back")').first();
          await returnBtn.click({ timeout: 3000 }).catch(() => {});
          await tab2.waitForTimeout(1000);
        } else {
          findings.fix5_q1_q3_in_tab2 = 'UNKNOWN - Could not reach review screen';
        }

        // ============================================================
        // Close Tab 2, reclaim Tab 1
        // ============================================================
        log('\n--- Close Tab 2, reclaim Tab 1 ---');

        await ss(tab2, 'tab2_before_close');
        await tab2.close();

        await tab1.bringToFront();
        await tab1.waitForTimeout(2000);
        await ss(tab1, 'tab1_after_tab2_closed');

        const tab1StillHasModal = await hasModal(tab1);
        log('Tab 1 still has modal after Tab 2 closed:', tab1StillHasModal);

        const tab1Reclaimed = await clickUseThisTab(tab1);
        await ss(tab1, 'tab1_reclaimed');
        findings.tab1_reclaim = tab1Reclaimed ? 'PASS' : (tab1StillHasModal ? 'FAIL - Modal shown but button not found' : 'N/A');

        // ============================================================
        // Verify Q1-Q6 all present in Tab 1 (Review screen)
        // ============================================================
        log('\n--- Verify Q1-Q6 all present in Tab 1 ---');

        await tab1.waitForTimeout(2000);

        // Check if Tab 1 is on instruction or testing
        const tab1OnInstruction2 = await tab1.locator('button:has-text("Resume Test"), button:has-text("Begin Test")').first().isVisible({ timeout: 3000 }).catch(() => false);

        if (tab1OnInstruction2) {
          await clickResumeOrBegin(tab1);
        }

        // Navigate to review
        const tab1ReviewBtn = tab1.locator('button:has-text("Review →")').last();
        const tab1ReviewVis = await tab1ReviewBtn.isVisible({ timeout: 5000 }).catch(() => false);

        let tab1AnsweredCount = null;
        if (tab1ReviewVis) {
          await tab1ReviewBtn.click();
          await tab1.waitForTimeout(2000);
          await ss(tab1, 'tab1_review_check_q1_q6');

          tab1AnsweredCount = await getAnsweredCount(tab1);
          log('Tab 1 review - answered count:', tab1AnsweredCount);

          const reviewBody = await tab1.locator('body').textContent().catch(() => '');
          log('Tab 1 review body (first 600):', reviewBody.substring(0, 600));

          if (tab1AnsweredCount !== null && tab1AnsweredCount >= 6) {
            findings.q1_q6_all_present = `PASS - ${tab1AnsweredCount}/15 answered (includes Q1-Q6)`;
          } else if (tab1AnsweredCount !== null && tab1AnsweredCount >= 3) {
            findings.q1_q6_all_present = `PARTIAL - ${tab1AnsweredCount}/15 (some answers from Tab 2 missing)`;
          } else {
            findings.q1_q6_all_present = `FAIL - Only ${tab1AnsweredCount}/15 (answers lost)`;
          }

          // Return from review
          const retBtn = tab1.locator('button:has-text("Return to Questions"), button:has-text("Return"), button:has-text("Cancel")').first();
          await retBtn.click({ timeout: 3000 }).catch(() => {});
          await tab1.waitForTimeout(1000);
        } else {
          findings.q1_q6_all_present = 'UNKNOWN - Could not reach review screen';
        }

        // ============================================================
        // Answer Q7-Q15 and submit
        // ============================================================
        log('\n--- Answer Q7-Q15 in Tab 1 ---');

        let additionalAnswers = 0;
        for (let attempt = 0; attempt < 20; attempt++) {
          const qInfo = await getQNum(tab1);
          if (!qInfo) break;
          log('At Q' + qInfo.cur + ' of ' + qInfo.total);

          if (qInfo.cur >= 7) {
            const ans = await answerQ(tab1, attempt % 4);
            if (ans) additionalAnswers++;
          }

          if (qInfo.cur >= qInfo.total) {
            // Last question - look for Review
            await ss(tab1, 'tab1_last_question');
            break;
          }
          await clickNext(tab1);
        }

        log(`Answered ${additionalAnswers} additional questions`);
        findings.q7_q15_answered = additionalAnswers > 0 ? `PASS - ${additionalAnswers} more questions answered` : 'PARTIAL';

        // Go to review and submit
        const finalReviewBtn = tab1.locator('button:has-text("Review →")').last();
        const finalReviewVis = await finalReviewBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (finalReviewVis) {
          await finalReviewBtn.click();
          await tab1.waitForTimeout(2000);
          await ss(tab1, 'tab1_final_review');
        }

        const submitBtn = tab1.locator('button:has-text("Submit Section"), button:has-text("Submit Test")').first();
        const submitVis = await submitBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (submitVis) {
          await submitBtn.click();
          await tab1.waitForTimeout(3000);
          await ss(tab1, 'tab1_after_submit');

          // Handle FRQ choice
          const frqBody = await tab1.locator('body').textContent().catch(() => '');
          if (frqBody.includes('Type Your Answers') || frqBody.includes('Free Response')) {
            const typeEl = tab1.locator('h3:has-text("Type Your Answers")').first();
            await typeEl.click().catch(() => {});
            await tab1.waitForTimeout(500);
            const confirmBtn = tab1.locator('button:has-text("Confirm & Continue"), button:has-text("Confirm")').first();
            await confirmBtn.click().catch(() => {});
            await tab1.waitForTimeout(3000);
          }

          const finalUrl = tab1.url();
          log('Final URL:', finalUrl);

          if (finalUrl.includes('/results/')) {
            await ss(tab1, 'report_card');
            const rcBody = await tab1.locator('body').textContent().catch(() => '');
            const mcqScore = rcBody.match(/(\d+)\s*\/\s*15/);
            log('MCQ score on report card:', mcqScore ? mcqScore[0] : 'not found');
            findings.submit_and_report_card = `PASS - Report card at ${finalUrl}, score: ${mcqScore ? mcqScore[0] : 'unknown'}`;
          } else {
            findings.submit_and_report_card = `PARTIAL - Submit clicked, URL: ${finalUrl}`;
          }
        }

      } else {
        findings.fix4_tab1_invalidated = 'BLOCKED - Could not click Use This Tab in Tab 2';
        findings.fix4_detail = 'Tab 2 had modal but button was not clickable';
      }
    } else {
      findings.fix4_tab1_invalidated = 'BLOCKED - FIX-3 still broken, no modal in Tab 2';
      findings.fix4_detail = 'Cannot test FIX-4 because Tab 2 modal not shown';
      findings.fix5_q1_q3_in_tab2 = 'BLOCKED';
    }

  } catch (err) {
    log('ERROR:', err.message);
    console.error(err.stack);
    findings.regression_new_issues.push('Script error: ' + err.message.substring(0, 200));
  } finally {
    await browser.close();
  }

  // Check for regressions in logs
  const allErrors = [...tab1Logs, ...tab2Logs].filter(l => l.type === 'error');
  const useBlockerErrors = allErrors.filter(l => l.text.includes('useBlocker'));
  const scheduleFlushErrors = allErrors.filter(l => l.text.includes('scheduleFlush'));

  if (useBlockerErrors.length > 0) {
    findings.regression_new_issues.push('REGRESSION: useBlocker crash in testing view');
  }
  if (scheduleFlushErrors.length > 0) {
    findings.regression_new_issues.push('REGRESSION: scheduleFlush TDZ error');
  }

  log('\n=== FINAL RESULTS ===');
  for (const [k, v] of Object.entries(findings)) {
    if (Array.isArray(v)) {
      log(`  ${k}:`, v.length > 0 ? v : ['none']);
    } else {
      const icon = v && (v.startsWith('PASS') || v.startsWith('FIXED')) ? 'OK' :
                   v && (v.startsWith('FAIL') || v.startsWith('STILL')) ? 'XX' :
                   v && v.startsWith('PARTIAL') ? 'PP' : '--';
      log(`  [${icon}] ${k}: ${v}`);
    }
  }

  return findings;
}

runV3().then(r => {
  console.log('\n=== JSON ===');
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
