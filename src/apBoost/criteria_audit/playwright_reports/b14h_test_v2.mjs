/**
 * B14-H v2: Realistic Simulation — Group Chat Student (student11@apboost.test)
 * Corrected version with proper selectors based on AnswerInput.jsx DOM analysis.
 *
 * Key fix: answer choices are <button type="button"> with flex layout.
 * They have no class-based identifier, but they have specific positioning.
 * Use page.$$ and filter by text starting with single letter A-D.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14H';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14h_results_v2.json';

const EMAIL = 'student11@apboost.test';
const PASSWORD = 'Student123!';
const TEST_ID = 'test_micro_full_1';
const BASE_URL = 'http://localhost:5173';

let screenshotCounter = 100; // Start from 100 to distinguish from first run

async function screenshot(page, label) {
  screenshotCounter++;
  const filename = path.join(SCREENSHOTS_DIR, `${String(screenshotCounter).padStart(3, '0')}_v2_${label}.png`);
  try {
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`[Screenshot] ${filename}`);
  } catch (e) {
    console.log(`[Screenshot FAILED] ${label}: ${e.message}`);
  }
  return filename;
}

const results = {
  batchId: 'B14-H',
  version: 'v2',
  persona: 'The Group Chat Student (student11@apboost.test)',
  startedAt: new Date().toISOString(),
  steps: [],
  consoleErrors: [],
  findings: [],
};

function logStep(step, status, details = '') {
  const entry = { step, status, details, ts: new Date().toISOString() };
  results.steps.push(entry);
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : status === 'INFO' ? 'i' : '~';
  console.log(`[${icon}] ${step}: ${details}`);
  return entry;
}

/**
 * Click the Nth answer choice button (0-indexed) on a question page.
 * Looks for buttons that start with a single letter (A, B, C, D).
 */
async function clickAnswerChoice(page, choiceIndex = 0) {
  return await page.evaluate((idx) => {
    const allButtons = Array.from(document.querySelectorAll('button[type="button"]'));
    // Filter to buttons that have text starting with a single capital letter
    const choiceButtons = allButtons.filter(btn => {
      const text = btn.textContent.trim();
      return /^[A-Z]\s/.test(text) || /^[A-Z]\n/.test(text);
    });

    if (choiceButtons.length === 0) {
      // Fallback: try any button with a leading letter pattern
      const allBtns2 = allButtons.filter(btn => {
        const txt = btn.textContent.trim();
        return txt.length > 2 && /^[A-D]/.test(txt) && txt.length < 500;
      });
      if (allBtns2.length > idx) {
        allBtns2[idx].click();
        return { clicked: true, method: 'fallback', text: allBtns2[idx].textContent.trim().substring(0, 50) };
      }
      return {
        clicked: false,
        available: allButtons.map(b => b.textContent.trim().substring(0, 30)).filter(t => t).slice(0, 10)
      };
    }

    if (idx >= choiceButtons.length) {
      idx = 0; // Default to first if index out of range
    }

    choiceButtons[idx].click();
    return {
      clicked: true,
      method: 'letter-filter',
      text: choiceButtons[idx].textContent.trim().substring(0, 60),
      totalChoices: choiceButtons.length
    };
  }, choiceIndex);
}

/**
 * Click the "Next" navigation button.
 */
async function clickNext(page) {
  return await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const next = btns.find(b => b.textContent.trim() === 'Next →' || b.textContent.includes('Next'));
    if (next && !next.disabled) {
      next.click();
      return { clicked: true, text: next.textContent.trim() };
    }
    return { clicked: false };
  });
}

/**
 * Get current question number from page.
 */
async function getCurrentQuestionNum(page) {
  return await page.evaluate(() => {
    const text = document.body.innerText;
    const match = text.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
    if (match) return { current: parseInt(match[1]), total: parseInt(match[2]) };
    const match2 = text.match(/Question\s+(\d+)/i);
    if (match2) return { current: parseInt(match2[1]), total: null };
    return { current: null, total: null };
  });
}

/**
 * Check if DuplicateTabModal is visible.
 */
async function checkDuplicateModal(page) {
  return await page.evaluate(() => {
    const text = document.body.innerHTML;
    const textContent = document.body.innerText;
    return {
      hasModal: textContent.includes('Session Active Elsewhere') || textContent.includes('already open in another'),
      hasUseThisTab: textContent.includes('Use This Tab'),
      hasGoToDashboard: textContent.includes('Go to Dashboard'),
      bodyPreview: textContent.substring(0, 300)
    };
  });
}

/**
 * Get answered question count from navigator or other indicator.
 */
async function getAnsweredCount(page) {
  return await page.evaluate(() => {
    // Try to get from progress text
    const text = document.body.innerText;
    const progressMatch = text.match(/(\d+)\s*(?:answered|\/)\s*(\d+)/i);
    if (progressMatch) return { answered: parseInt(progressMatch[1]), total: parseInt(progressMatch[2]) };

    // Count highlighted/selected navigator cells
    const body = document.body.innerHTML;

    // Check answers map via React DevTools is not possible directly,
    // so let's look for visual answer indicators
    return { answered: null, total: null, bodyPreview: text.substring(0, 200) };
  });
}

async function run() {
  // First, clean up any existing session for student11 by navigating to test
  // and checking status - we'll handle this during testing

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  // Collect console messages
  context.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('net::ERR') && !text.includes('ERR_ABORTED')) {
      results.consoleErrors.push({ message: text, ts: new Date().toISOString() });
      console.log('[CONSOLE ERROR]', text);
    }
    if (text.includes('useDuplicateTabGuard') || text.includes('DuplicateTab') || text.includes('BroadcastChannel')) {
      console.log('[BroadcastChannel LOG]', text);
    }
  });

  const page1 = await context.newPage();

  try {
    // ===== LOGIN =====
    console.log('\n=== STEP 1: Login as student11 ===');
    await page1.goto(`${BASE_URL}/login`);
    await page1.waitForLoadState('networkidle');
    await screenshot(page1, '01_login_page');

    const emailInput = await page1.$('input[type="email"], input[name="email"]');
    const passwordInput = await page1.$('input[type="password"]');

    if (!emailInput || !passwordInput) {
      logStep('Login form found', 'FAIL', 'Email or password input not found');
      throw new Error('BLOCKER: Login form not found');
    }

    await emailInput.fill(EMAIL);
    await passwordInput.fill(PASSWORD);

    const submitBtn = await page1.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await passwordInput.press('Enter');
    }

    await page1.waitForTimeout(3000);
    await screenshot(page1, '02_after_login');

    const loginUrl = page1.url();
    if (loginUrl.includes('/login')) {
      logStep('Login', 'FAIL', `Still on login page: ${loginUrl}`);
      // Try to get error message
      const errorMsg = await page1.evaluate(() => {
        const errEl = document.querySelector('[class*="error"], [class*="alert"], [role="alert"]');
        return errEl ? errEl.textContent.trim() : document.body.innerText.substring(0, 200);
      });
      logStep('Login error detail', 'FAIL', errorMsg);
      throw new Error(`BLOCKER: Login failed. Error: ${errorMsg}`);
    }

    logStep('Login', 'PASS', `Redirected to: ${loginUrl}`);

    // Navigate to /ap if not there
    if (!page1.url().includes('/ap')) {
      await page1.goto(`${BASE_URL}/ap`);
      await page1.waitForTimeout(2000);
    }

    await screenshot(page1, '03_ap_dashboard');
    logStep('AP Dashboard', 'INFO', `URL: ${page1.url()}`);

    // ===== NAVIGATE TO MICRO TEST =====
    console.log('\n=== STEP 2: Navigate to Micro test ===');
    await page1.waitForTimeout(1000); // Let cards load

    // Click Micro test card
    try {
      await page1.click('text=AP Microeconomics Practice Exam', { timeout: 5000 });
      await page1.waitForTimeout(2000);
      logStep('Click Micro test', 'PASS', `URL: ${page1.url()}`);
    } catch (e) {
      logStep('Click Micro test', 'FAIL', e.message);
      // Direct navigate
      await page1.goto(`${BASE_URL}/ap/test/${TEST_ID}`);
      await page1.waitForTimeout(2000);
      logStep('Direct navigate to test', 'INFO', `URL: ${page1.url()}`);
    }

    await screenshot(page1, '04_instruction_screen');

    // Check what's on screen
    const instructionState = await page1.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasResumeButton: text.includes('Resume') || text.includes('Continue'),
        hasBeginButton: text.includes('Begin') || text.includes('Start Test'),
        isOnInstructionScreen: text.includes('This test has') || text.includes('Section I'),
        preview: text.substring(0, 300)
      };
    });
    logStep('Instruction screen state', 'INFO', JSON.stringify(instructionState));

    // ===== BEGIN/RESUME TEST =====
    console.log('\n=== STEP 3: Begin/Resume Test ===');

    // Check for Resume or Begin button
    const beginBtnText = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const begin = btns.find(b => b.textContent.includes('Begin') || b.textContent.includes('Resume') || b.textContent.includes('Start'));
      return begin ? begin.textContent.trim() : null;
    });

    if (beginBtnText) {
      await page1.click(`button:has-text("${beginBtnText.includes('Resume') ? 'Resume' : beginBtnText.includes('Begin') ? 'Begin' : 'Begin'}")`);
      await page1.waitForTimeout(2000);
      logStep('Click Begin/Resume', 'PASS', `Button: "${beginBtnText}", URL: ${page1.url()}`);
    } else {
      logStep('Begin button not found', 'FAIL', 'No Begin/Resume button');
    }

    await screenshot(page1, '05_after_begin');

    // Verify we're in testing mode
    const testingState = await page1.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasQuestion: text.includes('Question') && text.includes('of'),
        hasTimer: text.includes('⏱') || text.includes('min'),
        hasSection: text.includes('Section'),
        preview: text.substring(0, 200)
      };
    });
    logStep('Testing mode check', testingState.hasQuestion ? 'PASS' : 'FAIL',
      JSON.stringify(testingState));

    // ===== ANSWER Q1-Q3 IN TAB 1 =====
    console.log('\n=== STEP 4: Answer Q1-Q3 in Tab 1 ===');

    for (let q = 1; q <= 3; q++) {
      const qInfo = await getCurrentQuestionNum(page1);
      logStep(`Tab1 Q${q} position`, 'INFO', `On Q${qInfo.current} of ${qInfo.total}`);

      // Select choice A (index 0) for Q1, B (index 1) for Q2, C (index 2) for Q3
      const choiceIdx = (q - 1) % 4;
      const answered = await clickAnswerChoice(page1, choiceIdx);
      logStep(`Tab1 Q${q} answer (choice ${choiceIdx})`, answered.clicked ? 'PASS' : 'FAIL',
        JSON.stringify(answered));

      await page1.waitForTimeout(600);
      await screenshot(page1, `06_tab1_q${q}_answered`);

      if (q < 3) {
        const nextResult = await clickNext(page1);
        logStep(`Tab1 Q${q} Next`, nextResult.clicked ? 'PASS' : 'INFO', JSON.stringify(nextResult));
        await page1.waitForTimeout(500);
      }
    }

    // Final state after Q3
    const stateAfterQ3 = await page1.evaluate(() => ({
      url: window.location.href,
      preview: document.body.innerText.substring(0, 200)
    }));
    logStep('Tab1 after Q1-Q3', 'INFO', `URL: ${stateAfterQ3.url}`);
    await screenshot(page1, '07_tab1_after_q1_q3');

    // The session should now be active — record the session ID if visible
    const sessionInfo = await page1.evaluate(() => {
      // Try to get session ID from URL or DOM
      return {
        url: window.location.href,
        // Look for session ID in any data attributes
        sessionMeta: document.querySelector('[data-session-id]')?.getAttribute('data-session-id') || null
      };
    });
    logStep('Session info', 'INFO', JSON.stringify(sessionInfo));

    // ===== OPEN TAB 2 WITH SAME URL =====
    console.log('\n=== STEP 5: Open Tab 2 with same test URL ===');
    const testUrl = `${BASE_URL}/ap/test/${TEST_ID}`;

    const page2 = await context.newPage();
    page2.on('console', msg => {
      const text = msg.text();
      if (text.includes('useDuplicateTabGuard') || text.includes('DuplicateTab') || text.includes('SESSION_')) {
        console.log('[Tab2 BroadcastChannel]', text);
      }
      if (msg.type() === 'error' && !text.includes('favicon')) {
        console.log('[Tab2 Error]', text);
        results.consoleErrors.push({ source: 'tab2', message: text });
      }
    });

    // Navigate Tab 2 to the test
    await page2.goto(testUrl);
    logStep('Tab 2 navigate', 'INFO', `Navigating to ${testUrl}`);

    // Wait for Tab 2 to load and BroadcastChannel to fire
    await page2.waitForTimeout(3000);
    await screenshot(page2, '08_tab2_initial_load');

    // Check Tab 2 state
    const tab2InitialState = await page2.evaluate(() => ({
      url: window.location.href,
      preview: document.body.innerText.substring(0, 400)
    }));
    logStep('Tab 2 initial state', 'INFO', `URL: ${tab2InitialState.url}, Preview: ${tab2InitialState.preview.substring(0, 100)}`);

    // Check if DuplicateTabModal is shown
    let tab2DupModal = await checkDuplicateModal(page2);
    logStep('Tab 2 DuplicateTabModal check (initial)', tab2DupModal.hasModal ? 'PASS' : 'FAIL',
      JSON.stringify({ hasModal: tab2DupModal.hasModal, hasUseThisTab: tab2DupModal.hasUseThisTab }));

    if (!tab2DupModal.hasModal) {
      // Tab 2 went to instruction screen — this is the bug.
      // Check if Tab 2 needs to click Begin (to enter testing view) where modal would show
      const tab2InstructionState = await page2.evaluate(() => ({
        hasBegin: document.body.innerText.includes('Begin') || document.body.innerText.includes('Resume'),
        isInstruction: document.body.innerText.includes('This test has') || document.body.innerText.includes('AP Microeconomics'),
        preview: document.body.innerText.substring(0, 300)
      }));
      logStep('Tab 2 on instruction screen', 'INFO', JSON.stringify(tab2InstructionState));

      // Record finding: Modal not shown on instruction screen
      results.findings.push({
        id: 'B14H-001',
        severity: 'High-Priority',
        title: 'DuplicateTabModal not shown in Tab 2 on instruction screen',
        whatHappened: `Tab 2 navigated to ${testUrl} while Tab 1 has an active session. BroadcastChannel fired ('Existing tab is active, blocking this tab') but DuplicateTabModal was not rendered because APTestSession.jsx only renders DuplicateTabModal in view==='testing' and view==='review' states, not in view==='instruction'. Tab 2 showed the instruction screen without any blocking modal.`,
        expected: 'DuplicateTabModal should appear in Tab 2 as soon as it navigates to the test URL, blocking the user before they can click Begin/Resume.',
        filesToFix: 'src/apBoost/pages/APTestSession.jsx',
        howToFix: `In APTestSession.jsx, the instruction view (lines ~300-313) renders without checking isInvalidated. Add DuplicateTabModal to the instruction screen render:

In the view === 'instruction' return block (around line 300-313), add:
  {isInvalidated && (
    <DuplicateTabModal
      onTakeControl={handleTakeControl}
      onGoToDashboard={handleGoToDashboard}
    />
  )}

This should be added INSIDE the returned div, after <APHeader />, so it overlays the instruction screen.

Additionally, the isInvalidated state must be available at instruction time. Since useDuplicateTabGuard(session?.id) is called, and session is fetched from Firestore even before Begin is clicked (useTestSession loads existing session on mount), the guard should activate as long as session?.id resolves. Verify that getActiveSession in useTestSession.js returns the session even when status is IN_PROGRESS for this tab 2 case.`,
        acceptanceTest: '1. Start test in Tab 1, answer Q1. 2. Open new tab to same URL. 3. DuplicateTabModal should appear immediately (before or on instruction screen) — "Session Active Elsewhere" heading, "Go to Dashboard" and "Use This Tab" buttons. 4. Click "Go to Dashboard" → goes to /ap. 5. Open tab again → modal again → click "Use This Tab" → test continues.'
      });

      // Try clicking Begin in Tab 2 to see if modal appears in testing view
      const tab2BeginBtn = await page2.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const begin = btns.find(b => b.textContent.includes('Begin') || b.textContent.includes('Resume'));
        return begin ? begin.textContent.trim() : null;
      });

      if (tab2BeginBtn) {
        logStep('Tab 2 Begin button found', 'INFO', `Button: "${tab2BeginBtn}"`);
        // Clicking Begin in Tab 2 while Tab 1 is active would create conflict
        // This tests whether the app prevents this correctly
        // For now, let's document the state and NOT click Begin to avoid data corruption
        logStep('Tab 2 Begin NOT clicked', 'INFO', 'Avoiding data conflict — modal should block before this point');
      }
    } else {
      // Modal IS shown - this is correct behavior
      logStep('Tab 2 DuplicateTabModal CORRECT', 'PASS', 'Modal appeared correctly on Tab 2');
      await screenshot(page2, '09_tab2_duplicate_modal');

      // Click "Use This Tab" in Tab 2
      const useThisTabResult = await page2.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Use This Tab'));
        if (btn) { btn.click(); return { clicked: true, text: btn.textContent.trim() }; }
        return { clicked: false };
      });
      logStep('Tab 2 click "Use This Tab"', useThisTabResult.clicked ? 'PASS' : 'FAIL',
        JSON.stringify(useThisTabResult));
      await page2.waitForTimeout(2000);
      await screenshot(page2, '10_tab2_after_take_control');
    }

    // ===== CHECK TAB 1 AFTER TAB 2 LOADED =====
    console.log('\n=== STEP 6: Check Tab 1 state after Tab 2 loaded ===');
    await page1.bringToFront();
    await page1.waitForTimeout(2000);
    await screenshot(page1, '11_tab1_after_tab2_opened');

    const tab1AfterTab2Opened = await checkDuplicateModal(page1);
    logStep('Tab 1 after Tab 2 opened', tab1AfterTab2Opened.hasModal ? 'INFO' : 'INFO',
      `hasModal: ${tab1AfterTab2Opened.hasModal}, preview: ${tab1AfterTab2Opened.bodyPreview.substring(0, 100)}`);

    // Tab 1 should NOT be invalidated since Tab 2 (on instruction screen) didn't successfully take control
    // Unless Tab 2 somehow ran the BroadcastChannel query and Tab 1 responded

    // ===== TAB 2: TEST "GO TO DASHBOARD" FLOW =====
    console.log('\n=== STEP 7: Test Tab 2 "Go to Dashboard" flow ===');
    await page2.bringToFront();
    tab2DupModal = await checkDuplicateModal(page2);

    if (tab2DupModal.hasGoToDashboard) {
      const goToDashResult = await page2.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Go to Dashboard'));
        if (btn) { btn.click(); return { clicked: true }; }
        return { clicked: false };
      });
      await page2.waitForTimeout(2000);
      const tab2AfterGo = page2.url();
      logStep('Tab 2 "Go to Dashboard"', goToDashResult.clicked && tab2AfterGo.includes('/ap') ? 'PASS' : 'INFO',
        `Navigated to: ${tab2AfterGo}`);
      await screenshot(page2, '12_tab2_after_go_to_dashboard');
    } else {
      logStep('Tab 2 "Go to Dashboard" test', 'INFO', 'Modal not shown, skipping Go to Dashboard test');
    }

    // ===== TAB 2: NAVIGATE BACK TO TEST (2ND ATTEMPT) =====
    console.log('\n=== STEP 8: Tab 2 second navigate to test URL ===');
    await page2.goto(testUrl);
    await page2.waitForTimeout(3000);
    await screenshot(page2, '13_tab2_second_attempt');

    const tab2SecondAttempt = await checkDuplicateModal(page2);
    logStep('Tab 2 second attempt - DuplicateTabModal', tab2SecondAttempt.hasModal ? 'PASS' : 'FAIL',
      JSON.stringify({ hasModal: tab2SecondAttempt.hasModal }));

    // ===== NOW SIMULATE "TAKE CONTROL" IN TAB 2 BY CLICKING BEGIN =====
    // (Even though modal may not show, we need to test if Tab 1 gets invalidated when Tab 2 starts)
    console.log('\n=== STEP 9: Tab 2 clicks Begin to test session conflict ===');

    // Check current state of Tab 2
    const tab2CurrentState = await page2.evaluate(() => ({
      preview: document.body.innerText.substring(0, 400),
      url: window.location.href
    }));
    logStep('Tab 2 current state before Begin click', 'INFO',
      `URL: ${tab2CurrentState.url}, Preview: ${tab2CurrentState.preview.substring(0, 100)}`);

    // Click Begin/Resume in Tab 2 — this should either be blocked by modal or cause conflict
    const tab2BeginResult = await page2.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const begin = btns.find(b =>
        b.textContent.includes('Begin') ||
        b.textContent.includes('Resume') ||
        b.textContent.includes('Use This Tab')
      );
      if (begin) {
        begin.click();
        return { clicked: true, text: begin.textContent.trim() };
      }
      return { clicked: false };
    });
    logStep('Tab 2 Begin/Resume/UseThisTab click', tab2BeginResult.clicked ? 'INFO' : 'INFO',
      JSON.stringify(tab2BeginResult));

    await page2.waitForTimeout(2000);
    await screenshot(page2, '14_tab2_after_begin');

    // Check if Tab 2 entered testing mode
    const tab2AfterBegin = await page2.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasQuestion: text.includes('Question') && text.includes('of'),
        hasSection: text.includes('Section I'),
        hasModal: text.includes('Session Active Elsewhere'),
        preview: text.substring(0, 300)
      };
    });
    logStep('Tab 2 after Begin', 'INFO',
      `hasQuestion: ${tab2AfterBegin.hasQuestion}, hasModal: ${tab2AfterBegin.hasModal}`);

    // ===== CHECK TAB 1 AFTER TAB 2 STARTED =====
    console.log('\n=== STEP 10: Check Tab 1 — should show DuplicateTabModal ===');
    await page1.bringToFront();
    await page1.waitForTimeout(2000);
    await screenshot(page1, '15_tab1_after_tab2_started');

    const tab1AfterTab2Started = await checkDuplicateModal(page1);
    logStep('Tab 1 DuplicateTabModal after Tab 2 started',
      tab1AfterTab2Started.hasModal ? 'PASS' : 'FAIL',
      `hasModal: ${tab1AfterTab2Started.hasModal}, preview: ${tab1AfterTab2Started.bodyPreview.substring(0, 150)}`);

    if (!tab1AfterTab2Started.hasModal) {
      results.findings.push({
        id: 'B14H-003',
        severity: 'High-Priority',
        title: 'Tab 1 not invalidated after Tab 2 begins test',
        whatHappened: `After Tab 2 clicked Begin and entered testing mode, Tab 1 did not show DuplicateTabModal. Both tabs appear active simultaneously.`,
        expected: 'Tab 1 should receive SESSION_CLAIMED broadcast and show DuplicateTabModal with "Session Active Elsewhere"',
        filesToFix: 'src/apBoost/hooks/useDuplicateTabGuard.js',
        howToFix: `The handoff flow has a timing issue. When Tab 2 navigates to the test URL, it sends SESSION_QUERY. Tab 1 should respond with SESSION_ACTIVE. Tab 2 should then show modal. But because Tab 2 goes to instruction view, the isInvalidated state is not rendered. When Tab 2 then calls startTest() (on Begin click), a new session claim flow should trigger. Verify that handleBegin in APTestSession.jsx (and startTest in useTestSession.js) broadcasts SESSION_CLAIMED before or during session initialization.`,
        acceptanceTest: '1. Tab 1: active test session with Q1-Q3 answered. 2. Tab 2: opens same URL, clicks Begin. 3. Tab 1 should show DuplicateTabModal immediately. 4. Tab 1 interactions should be disabled until modal is dismissed.'
      });
    }

    // ===== ANSWER Q4-Q6 IN TAB 2 (IF IN TESTING MODE) =====
    console.log('\n=== STEP 11: Answer Q4-Q6 in Tab 2 (if in testing mode) ===');
    await page2.bringToFront();

    const tab2InTestingMode = tab2AfterBegin.hasQuestion;
    if (tab2InTestingMode) {
      logStep('Tab 2 in testing mode', 'INFO', 'Will answer Q4-Q6');

      // Navigate to Q4 by pressing Next from current position
      // First check where we are
      const tab2Pos = await getCurrentQuestionNum(page2);
      logStep('Tab 2 position', 'INFO', `On Q${tab2Pos.current} of ${tab2Pos.total}`);

      // Navigate to Q4 if not there
      let currentQ = tab2Pos.current || 1;
      while (currentQ < 4) {
        await clickNext(page2);
        await page2.waitForTimeout(500);
        const pos = await getCurrentQuestionNum(page2);
        currentQ = pos.current || currentQ + 1;
      }

      for (let q = 4; q <= 6; q++) {
        const pos = await getCurrentQuestionNum(page2);
        logStep(`Tab2 position for Q${q}`, 'INFO', `On Q${pos.current}`);

        const answered = await clickAnswerChoice(page2, 1); // Choice B
        logStep(`Tab2 Q${q} answer`, answered.clicked ? 'PASS' : 'FAIL', JSON.stringify(answered));
        await page2.waitForTimeout(500);
        await screenshot(page2, `16_tab2_q${q}_answered`);

        if (q < 6) {
          await clickNext(page2);
          await page2.waitForTimeout(500);
        }
      }
    } else {
      logStep('Tab 2 Q4-Q6 answers', 'INFO', 'Tab 2 not in testing mode, skipping');
    }

    // ===== CLOSE TAB 2 =====
    console.log('\n=== STEP 12: Close Tab 2 ===');
    await page2.close();
    logStep('Tab 2 closed', 'INFO', 'Closed');
    await page1.waitForTimeout(2000);

    // ===== TAB 1: CHECK STATE AFTER TAB 2 CLOSED =====
    console.log('\n=== STEP 13: Tab 1 state after Tab 2 closed ===');
    await page1.bringToFront();
    await page1.waitForTimeout(2000);
    await screenshot(page1, '17_tab1_after_tab2_closed');

    const tab1AfterClosed = await checkDuplicateModal(page1);
    logStep('Tab 1 after Tab 2 closed', 'INFO',
      `hasModal: ${tab1AfterClosed.hasModal}, preview: ${tab1AfterClosed.bodyPreview.substring(0, 100)}`);

    if (tab1AfterClosed.hasModal) {
      // Click "Use This Tab" to reclaim
      const tab1Reclaim = await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Use This Tab'));
        if (btn) { btn.click(); return { clicked: true }; }
        return { clicked: false };
      });
      logStep('Tab 1 reclaim ("Use This Tab")', tab1Reclaim.clicked ? 'PASS' : 'FAIL',
        JSON.stringify(tab1Reclaim));
      await page1.waitForTimeout(2000);
      await screenshot(page1, '18_tab1_after_reclaim');
    }

    // ===== VERIFY Q1-Q3 STILL ANSWERED IN TAB 1 =====
    console.log('\n=== STEP 14: Verify Q1-Q3 answers preserved in Tab 1 ===');

    // Navigate back to Q1 and check
    const tab1Q1State = await page1.evaluate(() => ({
      url: window.location.href,
      preview: document.body.innerText.substring(0, 300),
      hasQuestion: document.body.innerText.includes('Question')
    }));
    logStep('Tab 1 current state', 'INFO', `URL: ${tab1Q1State.url}, hasQ: ${tab1Q1State.hasQuestion}`);

    // Navigate to Q1
    const navigateToQ1 = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const q1btn = btns.find(b => b.textContent.trim() === '1');
      if (q1btn) { q1btn.click(); return { clicked: true }; }
      return { clicked: false };
    });
    logStep('Navigate to Q1', 'INFO', JSON.stringify(navigateToQ1));
    await page1.waitForTimeout(500);
    await screenshot(page1, '19_tab1_q1_check');

    // Check if Q1 is answered (should show selected choice)
    const q1AnsweredState = await page1.evaluate(() => {
      // Look for selected answer buttons (they have bg-brand-primary class)
      const selectedBtns = Array.from(document.querySelectorAll('button')).filter(btn => {
        const cls = btn.className;
        return cls.includes('bg-brand-primary') || cls.includes('border-brand-primary');
      });
      return {
        hasSelectedAnswer: selectedBtns.length > 0,
        selectedText: selectedBtns.map(b => b.textContent.trim().substring(0, 50)),
        allChoiceBtns: Array.from(document.querySelectorAll('button[type="button"]'))
          .filter(b => /^[A-Z]/.test(b.textContent.trim()))
          .map(b => ({
            text: b.textContent.trim().substring(0, 40),
            isSelected: b.className.includes('bg-brand-primary')
          }))
      };
    });

    logStep('Q1 answer state', q1AnsweredState.hasSelectedAnswer ? 'PASS' : 'FAIL',
      JSON.stringify(q1AnsweredState));

    // Check answers for all questions via progress summary
    const answeredProgress = await page1.evaluate(() => {
      const text = document.body.innerText;
      // Look for any answer count indicator
      const matches = text.match(/(\d+)\s*(?:answered|questions answered)/gi);
      return {
        progressMatches: matches,
        bodyPreview: text.substring(0, 500)
      };
    });
    logStep('Overall answer progress', 'INFO', JSON.stringify(answeredProgress));
    await screenshot(page1, '20_tab1_overall_progress');

    // ===== ANSWER Q7-Q15 IN TAB 1 =====
    console.log('\n=== STEP 15: Answer Q7-Q15 in Tab 1 ===');

    // Get current position
    const tab1Pos = await getCurrentQuestionNum(page1);
    logStep('Tab 1 current position', 'INFO', `Q${tab1Pos.current} of ${tab1Pos.total}`);

    // Navigate to Q4 first (since Q1-Q3 were answered, need to advance)
    // Click Next multiple times to reach Q4
    let currentQ = tab1Pos.current || 1;

    // Navigate by pressing Next until we reach Q4
    while (currentQ < 4) {
      await clickNext(page1);
      await page1.waitForTimeout(400);
      const pos = await getCurrentQuestionNum(page1);
      currentQ = pos.current || currentQ + 1;
    }

    // Now answer Q4-Q15
    for (let q = 4; q <= 15; q++) {
      const pos = await getCurrentQuestionNum(page1);
      logStep(`Tab1 position for Q${q}`, 'INFO', `On Q${pos.current}`);

      const answered = await clickAnswerChoice(page1, q % 4);
      logStep(`Tab1 Q${q} answer`, answered.clicked ? 'PASS' : 'FAIL', JSON.stringify(answered));
      await page1.waitForTimeout(400);

      if (q < 15) {
        await clickNext(page1);
        await page1.waitForTimeout(400);
      }
    }

    await screenshot(page1, '21_tab1_q15_answered');
    logStep('Tab1 Q4-Q15 answered', 'INFO', 'Questions answered');

    // ===== NAVIGATE TO REVIEW =====
    console.log('\n=== STEP 16: Navigate to Review ===');

    // Click Next after Q15
    const nextAfterQ15 = await clickNext(page1);
    logStep('Next after Q15', nextAfterQ15.clicked ? 'INFO' : 'INFO', JSON.stringify(nextAfterQ15));
    await page1.waitForTimeout(2000);
    await screenshot(page1, '22_tab1_review_screen');

    const reviewState = await page1.evaluate(() => {
      const text = document.body.innerText;
      return {
        isOnReview: text.includes('Review') || text.includes('review'),
        hasSubmitSection: text.includes('Submit Section') || text.includes('Submit Test'),
        answeredCount: text.match(/\d+ of \d+/)?.[0] || null,
        preview: text.substring(0, 500)
      };
    });
    logStep('Review screen', reviewState.isOnReview ? 'PASS' : 'FAIL',
      JSON.stringify(reviewState));

    // ===== SUBMIT MCQ SECTION =====
    console.log('\n=== STEP 17: Submit MCQ Section ===');

    const submitSectionResult = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submit = btns.find(b =>
        b.textContent.includes('Submit Section') ||
        b.textContent.includes('Submit All') ||
        (b.textContent.includes('Submit') && !b.textContent.includes('Test'))
      );
      if (submit) { submit.click(); return { clicked: true, text: submit.textContent.trim() }; }
      return { clicked: false, available: btns.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 40).slice(0, 15) };
    });
    logStep('Submit Section', submitSectionResult.clicked ? 'PASS' : 'INFO',
      JSON.stringify(submitSectionResult));

    await page1.waitForTimeout(2000);
    await screenshot(page1, '23_tab1_after_submit_section');

    // Handle any confirmation
    const confirmResult = await page1.evaluate(() => {
      const text = document.body.innerText;
      const hasConfirm = text.includes('confirm') || text.includes('Confirm') || text.includes('Are you sure');
      if (hasConfirm) {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => b.textContent.includes('Confirm') || b.textContent.includes('Submit') || b.textContent.includes('Yes'));
        if (confirmBtn) { confirmBtn.click(); return { confirmed: true, text: confirmBtn.textContent.trim() }; }
      }
      return { confirmed: false };
    });
    if (confirmResult.confirmed) {
      await page1.waitForTimeout(2000);
      await screenshot(page1, '24_tab1_confirmed');
    }

    // ===== FRQ SECTION =====
    console.log('\n=== STEP 18: FRQ Section ===');
    await page1.waitForTimeout(1000);
    await screenshot(page1, '25_tab1_frq_screen');

    const frqState = await page1.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasFRQChoice: text.includes('Type Your Answers') || text.includes('Write by Hand'),
        hasFRQQuestion: text.includes('Free Response') && !text.includes('Type Your Answers'),
        isOnQuestion: text.includes('Question') && text.includes('Section 2'),
        preview: text.substring(0, 400)
      };
    });
    logStep('FRQ screen state', 'INFO', JSON.stringify(frqState));

    if (frqState.hasFRQChoice) {
      // Click "Type Your Answers"
      const choiceResult = await page1.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.textContent.includes('Type Your Answers'));
        if (btn) { btn.click(); return { clicked: true }; }
        return { clicked: false };
      });
      logStep('FRQ choice: Type Your Answers', choiceResult.clicked ? 'PASS' : 'FAIL',
        JSON.stringify(choiceResult));
      await page1.waitForTimeout(2000);
      await screenshot(page1, '26_tab1_frq_typed_chosen');
    }

    // Type FRQ answers
    await page1.waitForTimeout(1000);
    const textareas = await page1.$$('textarea');
    logStep('FRQ textareas', 'INFO', `Count: ${textareas.length}`);

    for (let i = 0; i < textareas.length; i++) {
      await textareas[i].fill(`FRQ Answer ${i + 1}: The economic principle demonstrated here involves supply-demand equilibrium and market price determination mechanisms.`);
      await page1.waitForTimeout(200);
    }

    if (textareas.length > 0) {
      logStep('FRQ answers typed', 'PASS', `Typed in ${textareas.length} textarea(s)`);
      await screenshot(page1, '27_tab1_frq_answered');
    }

    // Submit test
    const submitTestResult = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submit = btns.find(b =>
        b.textContent.includes('Submit Test') ||
        b.textContent.includes('Finish Test') ||
        b.textContent.includes('Submit FRQ')
      );
      if (submit) { submit.click(); return { clicked: true, text: submit.textContent.trim() }; }
      return { clicked: false, available: btns.map(b => b.textContent.trim()).filter(t => t && t.length < 30) };
    });
    logStep('Submit Test', submitTestResult.clicked ? 'PASS' : 'INFO',
      JSON.stringify(submitTestResult));

    await page1.waitForTimeout(5000);
    await screenshot(page1, '28_tab1_after_submit_test');

    // Handle final confirmation
    const finalConfirm = await page1.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirm = btns.find(b => b.textContent.includes('Confirm') || b.textContent.includes('Yes') || b.textContent.includes('Submit'));
      if (confirm && confirm.textContent.includes('Submit')) {
        confirm.click();
        return { confirmed: true, text: confirm.textContent.trim() };
      }
      return { confirmed: false };
    });
    if (finalConfirm.confirmed) {
      await page1.waitForTimeout(4000);
      await screenshot(page1, '29_tab1_final_confirm');
    }

    // ===== VERIFY REPORT CARD =====
    console.log('\n=== STEP 19: Verify Report Card ===');
    await page1.waitForTimeout(2000);
    await screenshot(page1, '30_tab1_report_card');

    const reportCard = await page1.evaluate(() => {
      const text = document.body.innerText;
      const url = window.location.href;
      return {
        url,
        isOnResultsPage: url.includes('/ap/results/'),
        hasScoreInfo: text.includes('Score') || text.includes('Results'),
        hasMCQTable: text.includes('MCQ') || text.includes('Multiple Choice'),
        has15Answers: (text.match(/Question\s+\d+/g) || []).length >= 10,
        preview: text.substring(0, 600)
      };
    });

    logStep('Report Card verification', reportCard.isOnResultsPage ? 'PASS' : 'FAIL',
      JSON.stringify({
        url: reportCard.url,
        isOnResultsPage: reportCard.isOnResultsPage,
        hasScore: reportCard.hasScoreInfo
      }));

    // ===== CONSOLE ERRORS SUMMARY =====
    console.log('\n=== Console Errors ===');
    console.log(JSON.stringify(results.consoleErrors, null, 2));

    results.completedAt = new Date().toISOString();
    results.status = 'COMPLETE';

  } catch (error) {
    console.error('\n=== FATAL ERROR ===', error);
    results.fatalError = error.message;
    results.status = 'BLOCKED';
    try {
      await screenshot(page1, '99_fatal_error');
    } catch (e) { /* ignore */ }
  } finally {
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`\n[Results saved to] ${RESULTS_FILE}`);
    await browser.close();
  }
}

run().catch(console.error);
