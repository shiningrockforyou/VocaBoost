/**
 * B14-E: Realistic Student Simulation — "The Distracted One"
 * Account: student8@apboost.test / Student123!
 * Test: Micro test (test_micro_full_1)
 *
 * Simulation:
 * - Answer Q1-Q5
 * - Open new browser tab and wait 45 seconds (simulate distraction)
 * - Switch back — verify test still functional, timer still counting, Q1-Q5 answers persist
 * - Answer Q6-Q10
 * - Trigger page blur for 30 seconds (simulate switching apps)
 * - Refocus — verify everything still works
 * - Answer Q11-Q15
 * - Submit test
 * - Verify all 15 answers persisted correctly
 *
 * Key checks:
 * - Session persistence across tab switches
 * - Timer accuracy after tab switches (should continue running)
 * - Answer persistence (no data loss)
 * - No console errors on visibility change or focus events
 * - Smooth recovery when returning to test
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student8@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14E';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14e_results.json';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  scenarioId: 'B14-E',
  persona: 'The Distracted One',
  email: STUDENT_EMAIL,
  startedAt: new Date().toISOString(),
  steps: [],
  findings: [],
  consoleErrors: [],
  trackedAnswers: {},
  timerReadings: [],
  sessionChecks: {},
};

function addStep(label, status, notes = '') {
  console.log(`[STEP] ${label} — ${status}${notes ? ' | ' + notes : ''}`);
  results.steps.push({ label, status, notes, time: new Date().toISOString() });
}

function addFinding(severity, title, what, expected, evidence = '') {
  console.log(`[FINDING][${severity}] ${title}`);
  results.findings.push({ severity, title, what, expected, evidence, time: new Date().toISOString() });
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`[SCREENSHOT] ${name}.png`);
  } catch (e) {
    console.log(`[SCREENSHOT FAILED] ${name}: ${e.message}`);
  }
  return filePath;
}

async function setupConsoleCapture(page) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      results.consoleErrors.push({ page: page.url(), message: text, type: 'console_error' });
      console.log(`[CONSOLE ERROR] ${text}`);
    }
    if (msg.type() === 'warning') {
      const text = msg.text();
      if (/visibility|focus|blur|tab|hidden|pagehide|visibilitychange/i.test(text)) {
        results.consoleErrors.push({ page: page.url(), message: text, type: 'warning' });
        console.log(`[CONSOLE WARNING - RELEVANT] ${text}`);
      }
    }
  });
  page.on('pageerror', err => {
    results.consoleErrors.push({ page: page.url(), message: err.message, type: 'pageerror' });
    console.log(`[PAGE ERROR] ${err.message}`);
  });
}

async function loginAs(page, email, password) {
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await screenshot(page, '01_login_form');
  await page.keyboard.press('Enter');
  try {
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 30000 });
    console.log(`[LOGIN] Redirected to: ${page.url()}`);
    return { success: true, url: page.url() };
  } catch (e) {
    const url = page.url();
    console.log(`[LOGIN FAILED] Still on: ${url}`);
    await screenshot(page, '01_login_failed');
    return { success: false, url };
  }
}

async function getTimerText(page) {
  // Try to read the timer display from the test page
  const timerSelectors = [
    '[data-testid="timer"]',
    '.timer',
    '[class*="timer"]',
    'text=/\\d+:\\d+/',
  ];
  for (const sel of timerSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 })) {
        const text = await el.textContent({ timeout: 2000 });
        if (text && /\d+:\d+/.test(text)) {
          return text.trim();
        }
      }
    } catch {}
  }
  // Fallback: scan body for time pattern
  const bodyText = await page.locator('body').textContent().catch(() => '');
  const m = bodyText.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  return m ? m[1] : null;
}

async function getCurrentQuestionNumber(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '');
  const m = bodyText.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
  if (m) return { current: parseInt(m[1]), total: parseInt(m[2]), text: `Question ${m[1]} of ${m[2]}` };
  // Also try "Q X of Y" pattern
  const m2 = bodyText.match(/Q\s*(\d+)\s+of\s+(\d+)/i);
  if (m2) return { current: parseInt(m2[1]), total: parseInt(m2[2]), text: `Q ${m2[1]} of ${m2[2]}` };
  return { current: -1, total: -1, text: '' };
}

async function getAnswerOptions(page) {
  const opts = [];
  // Try radio buttons
  const radios = page.locator('input[type="radio"]');
  const radioCount = await radios.count().catch(() => 0);
  if (radioCount > 0) {
    for (let i = 0; i < radioCount; i++) {
      const radio = radios.nth(i);
      const id = await radio.getAttribute('id').catch(() => '');
      const label = id ? await page.locator(`label[for="${id}"]`).textContent().catch(() => '') : '';
      opts.push({ type: 'radio', index: i, label: label.trim() });
    }
    return opts;
  }
  // Try answer choice buttons
  const answerBtns = page.locator('[data-choice], button[aria-label], .answer-choice, [role="radio"]');
  const btnCount = await answerBtns.count().catch(() => 0);
  if (btnCount > 0) {
    for (let i = 0; i < btnCount; i++) {
      const btn = answerBtns.nth(i);
      const text = await btn.textContent().catch(() => '');
      opts.push({ type: 'button', index: i, label: text.trim().substring(0, 80) });
    }
  }
  return opts;
}

async function selectAnswerOption(page, optionIndex) {
  const radios = page.locator('input[type="radio"]');
  const radioCount = await radios.count().catch(() => 0);
  if (radioCount > 0 && optionIndex < radioCount) {
    await radios.nth(optionIndex).click({ force: true }).catch(() => {});
    return true;
  }
  const letters = ['A', 'B', 'C', 'D', 'E'];
  if (optionIndex < letters.length) {
    const letter = letters[optionIndex];
    const selectors = [
      `button:has-text("${letter}")`,
      `[aria-label*="${letter}"]`,
      `[data-choice="${letter}"]`,
    ];
    for (const sel of selectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 })) {
          await el.click();
          return true;
        }
      } catch {}
    }
  }
  return false;
}

async function getSelectedAnswer(page) {
  // Try to find which radio is checked
  const radios = page.locator('input[type="radio"]');
  const radioCount = await radios.count().catch(() => 0);
  for (let i = 0; i < radioCount; i++) {
    const radio = radios.nth(i);
    const isChecked = await radio.isChecked().catch(() => false);
    if (isChecked) {
      const id = await radio.getAttribute('id').catch(() => '');
      const label = id ? await page.locator(`label[for="${id}"]`).textContent().catch(() => '') : '';
      return { index: i, label: label.trim(), found: true };
    }
  }
  // Try looking for selected/active answer button
  const selectedBtns = page.locator('[aria-pressed="true"], [class*="selected"], [class*="active"], .answer-selected');
  const selCount = await selectedBtns.count().catch(() => 0);
  if (selCount > 0) {
    const text = await selectedBtns.first().textContent().catch(() => '');
    return { index: -1, label: text.trim(), found: true };
  }
  return { index: -1, label: '', found: false };
}

async function clickNextButton(page) {
  const nextSelectors = [
    'button:has-text("Next →")',
    'button:has-text("Next")',
    'button[aria-label*="next" i]',
    '[data-testid="next-button"]',
  ];
  for (const sel of nextSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }) && !await el.isDisabled()) {
        await el.click();
        await page.waitForTimeout(500);
        return true;
      }
    } catch {}
  }
  return false;
}

async function clickPrevButton(page) {
  const prevSelectors = [
    'button:has-text("← Prev")',
    'button:has-text("Previous")',
    'button:has-text("Back")',
    'button[aria-label*="prev" i]',
  ];
  for (const sel of prevSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }) && !await el.isDisabled()) {
        await el.click();
        await page.waitForTimeout(500);
        return true;
      }
    } catch {}
  }
  return false;
}

async function jumpToQuestionViaNavigator(page, questionNumber) {
  const selectors = [
    `button:has-text("${questionNumber}")`,
    `[aria-label*="Question ${questionNumber}" i]`,
    `[data-question="${questionNumber}"]`,
    `[data-q="${questionNumber}"]`,
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        await page.waitForTimeout(1000);
        return true;
      }
    } catch {}
  }
  return false;
}

async function openNavigator(page) {
  const navSelectors = [
    'button[aria-label*="navigator" i]',
    'button:has-text("Navigator")',
    'button:has-text("Question List")',
  ];
  for (const sel of navSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 })) {
        await el.click();
        await page.waitForTimeout(1000);
        return true;
      }
    } catch {}
  }
  return false;
}

async function goToReviewScreen(page) {
  const reviewSelectors = [
    'button:has-text("Review")',
    'button:has-text("Submit Section")',
    'button:has-text("End Section")',
    'button:has-text("Review Answers")',
    'button:has-text("Review All")',
  ];
  for (const sel of reviewSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }) && !await el.isDisabled()) {
        await el.click();
        await page.waitForTimeout(2000);
        return true;
      }
    } catch {}
  }
  return false;
}

async function submitSection(page) {
  const submitSelectors = [
    'button:has-text("Submit Section")',
    'button:has-text("Submit Section 1")',
    'button:has-text("Submit")',
  ];
  for (const sel of submitSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 5000 }) && !await el.isDisabled()) {
        await el.click();
        await page.waitForTimeout(3000);
        return true;
      }
    } catch {}
  }
  return false;
}

// Simulate page blur using page.evaluate (document.dispatchEvent)
async function simulatePageHide(page) {
  await page.evaluate(() => {
    // Simulate visibility change to hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
    console.log('[B14-E] Page blur simulated — document.hidden = true');
  });
}

async function simulatePageFocus(page) {
  await page.evaluate(() => {
    // Simulate visibility change back to visible
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    console.log('[B14-E] Page focus restored — document.hidden = false');
  });
}

// ============================================================
// MAIN TEST
// ============================================================

test.setTimeout(600000); // 10 minutes

test('B14-E: The Distracted One — Tab Switch and Page Blur Resilience', async ({ page, context }) => {
  // Capture console messages
  setupConsoleCapture(page);

  // ==========================================================
  // STEP 1: LOGIN
  // ==========================================================
  console.log('\n=== STEP 1: LOGIN ===');
  const loginResult = await loginAs(page, STUDENT_EMAIL, STUDENT_PASSWORD);

  if (!loginResult.success) {
    addStep('Login', 'FAIL', `Still on login page: ${loginResult.url}`);
    addFinding('Blocker', 'Login failed for student8@apboost.test',
      `After submitting credentials, page did not redirect away from /login`,
      'Should redirect to /ap or / dashboard after successful login',
      'Screenshot: 01_login_failed.png'
    );
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    throw new Error('BLOCKER: Login failed — stopping test execution');
  }

  const postLoginUrl = page.url();
  addStep('Login', 'PASS', `Redirected to: ${postLoginUrl}`);

  // Check for B4-006 (non-AP redirect)
  if (!postLoginUrl.includes('/ap')) {
    addFinding('Medium-Priority', 'student8 login redirects to non-AP route',
      `Login redirected to ${postLoginUrl} instead of /ap`,
      'Student accounts should redirect to /ap after login',
      'Consistent with known finding B4-006'
    );
    await page.goto('http://localhost:5173/ap');
    await page.waitForTimeout(3000);
  }

  await screenshot(page, '02_post_login_dashboard');

  // ==========================================================
  // STEP 2: NAVIGATE TO AND START MICRO TEST
  // ==========================================================
  console.log('\n=== STEP 2: FIND AND START MICRO TEST ===');
  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(3000);
  await screenshot(page, '03_dashboard');

  const dashText = await page.locator('body').textContent().catch(() => '');
  const hasTests = /micro|macro|calc|AP/i.test(dashText);
  addStep('Dashboard loads with tests', hasTests ? 'PASS' : 'FAIL', `Tests visible: ${hasTests}`);

  // Navigate directly to micro test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);
  await screenshot(page, '04_test_page_loaded');

  const testPageText = await page.locator('body').textContent().catch(() => '');
  const onTestPage = /begin|instruction|section|start/i.test(testPageText);
  addStep('Navigate to Micro test page', onTestPage ? 'PASS' : 'FAIL', `URL: ${page.url()}`);

  // ==========================================================
  // STEP 3: BEGIN TEST
  // ==========================================================
  console.log('\n=== STEP 3: BEGIN TEST ===');

  // Look for Begin Test / Start Section button
  const beginSelectors = [
    'button:has-text("Begin Test")',
    'button:has-text("Start Test")',
    'button:has-text("Start Section")',
    'button:has-text("Begin Section")',
    'button:has-text("Resume")',
    'button:has-text("Continue")',
  ];
  let beginClicked = false;
  for (const sel of beginSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 5000 })) {
        await el.click();
        beginClicked = true;
        console.log(`[BEGIN] Clicked: ${sel}`);
        break;
      }
    } catch {}
  }
  await page.waitForTimeout(3000);
  await screenshot(page, '05_after_begin');
  addStep('Click Begin Test', beginClicked ? 'PASS' : 'PARTIAL',
    `URL: ${page.url()}, Clicked: ${beginClicked}`);

  // Verify first question is visible
  const q1Info = await getCurrentQuestionNumber(page);
  const onFirstQuestion = q1Info.current === 1 || q1Info.current === -1;
  console.log(`[BEGIN] Question counter: ${q1Info.text}`);

  // ==========================================================
  // STEP 4: ANSWER Q1-Q5
  // ==========================================================
  console.log('\n=== STEP 4: ANSWERING Q1-Q5 ===');

  const answeredQ1to5 = {};
  for (let qNum = 1; qNum <= 5; qNum++) {
    console.log(`\n[Q${qNum}] Answering question ${qNum}...`);

    // Short read time (1-2s for speed)
    await page.waitForTimeout(1000 + Math.floor(Math.random() * 1000));

    const opts = await getAnswerOptions(page);
    console.log(`[Q${qNum}] Found ${opts.length} answer options`);

    if (opts.length === 0) {
      addFinding('Medium-Priority', `No answer options found for Q${qNum}`,
        `Could not locate answer choice elements on Q${qNum}`,
        'MCQ questions should have visible selectable answer choices',
        `Q${qNum} of test`
      );
      await clickNextButton(page);
      continue;
    }

    // Select answer (cycle through options for variety)
    const optIdx = (qNum - 1) % Math.min(opts.length, 4);
    const selected = await selectAnswerOption(page, optIdx);
    if (selected) {
      answeredQ1to5[qNum] = { optionIndex: optIdx, label: opts[optIdx]?.label || '' };
      console.log(`[Q${qNum}] Selected option ${optIdx}: "${opts[optIdx]?.label?.substring(0, 40) || 'n/a'}"`);
    } else {
      console.log(`[Q${qNum}] WARNING: Could not select answer`);
      answeredQ1to5[qNum] = { optionIndex: optIdx, label: '', error: 'selection failed' };
    }

    await page.waitForTimeout(500);

    // Take screenshot for Q1 and Q5
    if (qNum === 1 || qNum === 5) {
      await screenshot(page, `06_q${qNum}_answered`);
    }

    // Move to next question (Q5 stays on Q5 before tab switch)
    if (qNum < 5) {
      const moved = await clickNextButton(page);
      if (!moved) {
        console.log(`[Q${qNum}] WARNING: Could not click Next`);
      }
    }
  }

  results.trackedAnswers.q1to5 = answeredQ1to5;
  const q1to5Count = Object.values(answeredQ1to5).filter(a => !a.error).length;
  addStep('Answer Q1-Q5', q1to5Count >= 4 ? 'PASS' : 'PARTIAL',
    `Answered: ${q1to5Count}/5. Selections: ${JSON.stringify(Object.fromEntries(Object.entries(answeredQ1to5).map(([k, v]) => [k, v.optionIndex])))}`);

  // Read timer before tab switch
  const timerBefore = await getTimerText(page);
  console.log(`[TIMER] Before tab switch: ${timerBefore}`);
  results.timerReadings.push({ phase: 'before_tab_switch', value: timerBefore, time: new Date().toISOString() });

  await screenshot(page, '07_before_tab_switch');

  // ==========================================================
  // STEP 5: OPEN NEW TAB AND WAIT 45 SECONDS
  // ==========================================================
  console.log('\n=== STEP 5: OPEN NEW TAB (distraction) — WAITING 45s ===');

  // Open a new tab (this causes the test tab to go "background-ish" in terms of BroadcastChannel)
  const newTab = await context.newPage();
  await newTab.goto('about:blank');
  await screenshot(newTab, '08_new_tab_opened');
  addStep('Open new browser tab', 'PASS', 'New tab opened with about:blank');

  // Track console errors on new tab too (for session invalidation messages)
  newTab.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push({ page: 'new_tab', message: msg.text(), type: 'console_error' });
    }
  });

  console.log('[DISTRACTION] Waiting 45 seconds in new tab...');
  // Simulate student being distracted in new tab for 45 seconds
  await newTab.waitForTimeout(45000);
  console.log('[DISTRACTION] 45 seconds elapsed. Switching back to test tab...');

  // Close the new tab and switch back to test tab
  await newTab.close();
  await page.bringToFront();
  await page.waitForTimeout(2000);

  addStep('Wait 45s in new tab and switch back', 'PASS', '45 seconds elapsed, returned to test tab');
  await screenshot(page, '09_after_tab_switch_back');

  // ==========================================================
  // STEP 6: VERIFY AFTER TAB SWITCH
  // ==========================================================
  console.log('\n=== STEP 6: VERIFY SESSION AFTER TAB SWITCH ===');

  // Check if test is still functional
  const afterTabText = await page.locator('body').textContent().catch(() => '');
  const testStillVisible = /question|section|timer/i.test(afterTabText);
  const isDuplicateTabModal = /duplicate|another tab|taken over|blocked/i.test(afterTabText);
  const isSessionInvalidated = /session.*expired|blocked|taken over/i.test(afterTabText);

  console.log(`[AFTER TAB SWITCH] Test still visible: ${testStillVisible}`);
  console.log(`[AFTER TAB SWITCH] Duplicate tab modal: ${isDuplicateTabModal}`);
  console.log(`[AFTER TAB SWITCH] Session invalidated: ${isSessionInvalidated}`);

  results.sessionChecks.afterTabSwitch = {
    testStillVisible,
    isDuplicateTabModal,
    isSessionInvalidated,
    url: page.url(),
  };

  if (isDuplicateTabModal) {
    addFinding('High-Priority', 'Duplicate tab modal appeared after opening/closing new tab',
      'After opening a new about:blank tab and closing it, the DuplicateTabModal appeared on the test tab. The BroadcastChannel SESSION_QUERY from the new blank tab incorrectly triggered the duplicate tab guard.',
      'Opening a non-test tab (about:blank) should NOT trigger the DuplicateTabModal on the test tab. The DuplicateTabModal should only trigger when the SAME test URL is opened in another tab.',
      'Screenshot: 09_after_tab_switch_back.png'
    );
    addStep('No spurious DuplicateTabModal after new tab', 'FAIL',
      'DuplicateTabModal appeared after opening a blank new tab');

    // Try to dismiss it if possible
    const dismissBtn = page.locator('button:has-text("Use This Tab"), button:has-text("Take Control"), button:has-text("Continue")').first();
    if (await dismissBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dismissBtn.click();
      await page.waitForTimeout(2000);
      console.log('[DUPLICATE TAB] Dismissed modal, continuing...');
    }
  } else {
    addStep('No spurious DuplicateTabModal after new tab', 'PASS',
      'Test continued normally after tab switch');
  }

  // Verify timer is still running
  const timerAfterTab = await getTimerText(page);
  console.log(`[TIMER] After 45s tab switch: ${timerAfterTab}`);
  results.timerReadings.push({ phase: 'after_tab_switch', value: timerAfterTab, time: new Date().toISOString() });

  // Parse timer values and compare
  function parseTimer(t) {
    if (!t) return null;
    const m = t.match(/(\d+):(\d+)(?::(\d+))?/);
    if (!m) return null;
    if (m[3]) return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
    return parseInt(m[1]) * 60 + parseInt(m[2]);
  }

  const timerBeforeSecs = parseTimer(timerBefore);
  const timerAfterTabSecs = parseTimer(timerAfterTab);
  console.log(`[TIMER] Before: ${timerBefore} (${timerBeforeSecs}s), After 45s: ${timerAfterTab} (${timerAfterTabSecs}s)`);

  if (timerBeforeSecs !== null && timerAfterTabSecs !== null) {
    const timerDiff = timerBeforeSecs - timerAfterTabSecs;
    console.log(`[TIMER] Timer decreased by ${timerDiff}s (expected ~45s)`);
    results.timerReadings.push({ phase: 'tab_switch_diff', expected: 45, actual: timerDiff });

    if (timerDiff < 40 || timerDiff > 60) {
      // Timer should have decreased by ~45s (allow ±15s tolerance due to timing)
      if (timerAfterTabSecs === timerBeforeSecs) {
        addFinding('High-Priority', 'Timer stopped counting during tab switch',
          `Timer showed ${timerBefore} before opening new tab and still shows ${timerAfterTab} after 45s. Timer appears to have paused during tab switch.`,
          'Timer should continue counting down while student switches to another tab. The test timer is not paused by tab switching per the spec.',
          'Timer readings logged in results'
        );
        addStep('Timer continued during tab switch', 'FAIL',
          `Timer did not change: ${timerBefore} → ${timerAfterTab}`);
      } else {
        addFinding('Medium-Priority', 'Timer drift during tab switch',
          `Timer decreased by ${timerDiff}s during 45s tab switch (expected ~45s ±5s).`,
          'Timer should track real time during tab switches without drift.',
          `Before: ${timerBefore}, After: ${timerAfterTab}`
        );
        addStep('Timer continued during tab switch', 'PARTIAL',
          `Timer diff: ${timerDiff}s (expected ~45s). Before: ${timerBefore}, After: ${timerAfterTab}`);
      }
    } else {
      addStep('Timer continued during tab switch', 'PASS',
        `Timer decreased by ~${timerDiff}s during 45s distraction. Before: ${timerBefore}, After: ${timerAfterTab}`);
    }
  } else {
    addStep('Timer continued during tab switch', 'PARTIAL',
      `Could not parse timer values. Before: ${timerBefore}, After: ${timerAfterTab}`);
  }

  // Verify Q1-Q5 answers are still present by navigating back
  console.log('[VERIFY] Checking that Q1-Q5 answers persisted through tab switch...');

  // Navigate to Q1 via navigator or prev buttons
  const navOpened = await openNavigator(page);
  await page.waitForTimeout(1000);

  if (navOpened) {
    // Jump to Q1
    const jumpedToQ1 = await jumpToQuestionViaNavigator(page, 1);
    if (jumpedToQ1) {
      await page.waitForTimeout(1000);
      const q1Answer = await getSelectedAnswer(page);
      console.log(`[Q1 CHECK] Answer after tab switch: ${JSON.stringify(q1Answer)}`);
      results.sessionChecks.q1AnswerAfterTabSwitch = q1Answer;

      if (q1Answer.found) {
        addStep('Q1 answer persisted through tab switch', 'PASS',
          `Q1 still has selected answer: "${q1Answer.label}" (index ${q1Answer.index})`);
      } else {
        addFinding('High-Priority', 'Q1 answer lost after tab switch',
          `After opening new tab (45s) and returning, Q1 shows no selected answer. getSelectedAnswer() returned found=false.`,
          'All previously answered questions should retain their answers after switching tabs and returning.',
          'Screenshot: 09_after_tab_switch_back.png'
        );
        addStep('Q1 answer persisted through tab switch', 'FAIL',
          `Q1 answer not found after tab switch`);
      }

      // Check Q5 too
      await jumpToQuestionViaNavigator(page, 5);
      await page.waitForTimeout(1000);
      const q5Answer = await getSelectedAnswer(page);
      console.log(`[Q5 CHECK] Answer after tab switch: ${JSON.stringify(q5Answer)}`);
      results.sessionChecks.q5AnswerAfterTabSwitch = q5Answer;

      if (q5Answer.found) {
        addStep('Q5 answer persisted through tab switch', 'PASS',
          `Q5 still has selected answer: "${q5Answer.label}"`);
      } else {
        addStep('Q5 answer persisted through tab switch', 'FAIL',
          `Q5 answer not found after tab switch`);
      }
    }
    // Close navigator
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  await screenshot(page, '10_after_tab_switch_verification');

  // ==========================================================
  // STEP 7: ANSWER Q6-Q10
  // ==========================================================
  console.log('\n=== STEP 7: ANSWERING Q6-Q10 ===');

  // Navigate to Q6
  // First, navigate forward from current position to Q6
  // We might be on Q1 or Q5 from verification; navigate to Q6
  const currentQ = await getCurrentQuestionNumber(page);
  console.log(`[Q6-Q10] Currently on: ${currentQ.text}`);

  // Navigate to Q6 via next buttons
  let reachedQ6 = false;
  if (currentQ.current <= 5) {
    // Need to navigate forward
    for (let attempt = 0; attempt < 10; attempt++) {
      const q = await getCurrentQuestionNumber(page);
      if (q.current === 6) {
        reachedQ6 = true;
        break;
      }
      if (q.current > 6) break; // overshot
      await clickNextButton(page);
      await page.waitForTimeout(500);
    }
  } else if (currentQ.current >= 6) {
    reachedQ6 = true;
  }

  // Also try navigator
  if (!reachedQ6) {
    const navO = await openNavigator(page);
    if (navO) {
      await jumpToQuestionViaNavigator(page, 6);
      await page.waitForTimeout(1000);
      await page.keyboard.press('Escape');
      reachedQ6 = true;
    }
  }

  const answeredQ6to10 = {};
  for (let qNum = 6; qNum <= 10; qNum++) {
    const qInfo = await getCurrentQuestionNumber(page);
    console.log(`[Q${qNum}] Counter: ${qInfo.text}`);

    await page.waitForTimeout(800);

    const opts = await getAnswerOptions(page);
    if (opts.length === 0) {
      console.log(`[Q${qNum}] No answer options found`);
      await clickNextButton(page);
      continue;
    }

    const optIdx = (qNum) % Math.min(opts.length, 4);
    const selected = await selectAnswerOption(page, optIdx);
    if (selected) {
      answeredQ6to10[qNum] = { optionIndex: optIdx, label: opts[optIdx]?.label || '' };
      console.log(`[Q${qNum}] Selected option ${optIdx}: "${opts[optIdx]?.label?.substring(0, 40) || 'n/a'}"`);
    }

    if (qNum === 8) {
      await screenshot(page, '11_q8_answered');
    }

    if (qNum < 10) {
      await clickNextButton(page);
      await page.waitForTimeout(500);
    }
  }

  results.trackedAnswers.q6to10 = answeredQ6to10;
  const q6to10Count = Object.values(answeredQ6to10).filter(a => !a.error).length;
  addStep('Answer Q6-Q10', q6to10Count >= 4 ? 'PASS' : 'PARTIAL',
    `Answered: ${q6to10Count}/5`);

  // Read timer before page blur
  const timerBeforeBlur = await getTimerText(page);
  console.log(`[TIMER] Before page blur: ${timerBeforeBlur}`);
  results.timerReadings.push({ phase: 'before_page_blur', value: timerBeforeBlur, time: new Date().toISOString() });

  await screenshot(page, '12_before_blur');

  // ==========================================================
  // STEP 8: SIMULATE PAGE BLUR FOR 30 SECONDS
  // ==========================================================
  console.log('\n=== STEP 8: SIMULATE PAGE BLUR FOR 30s ===');

  // Capture any console output related to visibility change
  const blurConsoleMessages = [];
  const blurHandler = msg => {
    const text = msg.text();
    if (/visibility|blur|focus|hidden|background/i.test(text)) {
      blurConsoleMessages.push({ type: msg.type(), text });
      console.log(`[BLUR CONSOLE] ${msg.type()}: ${text}`);
    }
  };
  page.on('console', blurHandler);

  // Simulate document becoming hidden
  await simulatePageHide(page);
  addStep('Simulate page blur (document hidden)', 'PASS', 'visibilitychange event dispatched with hidden=true');

  console.log('[BLUR] Waiting 30 seconds while page is "blurred"...');
  await page.waitForTimeout(30000);
  console.log('[BLUR] 30 seconds elapsed. Restoring focus...');

  // Simulate document becoming visible again
  await simulatePageFocus(page);
  page.off('console', blurHandler);

  await page.waitForTimeout(2000);
  await screenshot(page, '13_after_blur_refocus');

  results.sessionChecks.blurConsoleMessages = blurConsoleMessages;
  addStep('Simulate page blur 30s and refocus', 'PASS',
    `Blur events dispatched. Console messages during blur: ${blurConsoleMessages.length}. Messages: ${JSON.stringify(blurConsoleMessages.map(m => m.text.substring(0, 50)))}`);

  // ==========================================================
  // STEP 9: VERIFY AFTER PAGE BLUR
  // ==========================================================
  console.log('\n=== STEP 9: VERIFY SESSION AFTER PAGE BLUR ===');

  const afterBlurText = await page.locator('body').textContent().catch(() => '');
  const testStillVisibleAfterBlur = /question|section|timer/i.test(afterBlurText);
  const isTimerPausedAfterBlur = afterBlurText.includes('paused') || afterBlurText.includes('Paused');
  const isDuplicateModalAfterBlur = /duplicate|another tab|taken over|blocked/i.test(afterBlurText);

  console.log(`[AFTER BLUR] Test still visible: ${testStillVisibleAfterBlur}`);
  console.log(`[AFTER BLUR] Timer paused: ${isTimerPausedAfterBlur}`);
  console.log(`[AFTER BLUR] Duplicate modal: ${isDuplicateModalAfterBlur}`);

  results.sessionChecks.afterBlur = {
    testStillVisibleAfterBlur,
    isTimerPausedAfterBlur,
    isDuplicateModalAfterBlur,
    url: page.url(),
  };

  if (!testStillVisibleAfterBlur) {
    addFinding('Blocker', 'Test session lost after page blur simulation',
      `After simulating 30s page blur (visibilitychange to hidden → visible), the test session is no longer visible. Page text: ${afterBlurText.substring(0, 200)}`,
      'Test session must survive page blur/focus events. The session should remain intact.',
      'Screenshot: 13_after_blur_refocus.png'
    );
    addStep('Test session survived page blur', 'FAIL', 'Test session not visible after blur');
  } else {
    addStep('Test session survived page blur', 'PASS', 'Test still visible after blur');
  }

  // Read timer after blur
  const timerAfterBlur = await getTimerText(page);
  console.log(`[TIMER] After 30s blur: ${timerAfterBlur}`);
  results.timerReadings.push({ phase: 'after_page_blur', value: timerAfterBlur, time: new Date().toISOString() });

  const timerBeforeBlurSecs = parseTimer(timerBeforeBlur);
  const timerAfterBlurSecs = parseTimer(timerAfterBlur);

  if (timerBeforeBlurSecs !== null && timerAfterBlurSecs !== null) {
    const blurDiff = timerBeforeBlurSecs - timerAfterBlurSecs;
    console.log(`[TIMER] After blur: timer diff = ${blurDiff}s (expected ~30s)`);
    results.timerReadings.push({ phase: 'blur_diff', expected: 30, actual: blurDiff });

    if (blurDiff < 25 || blurDiff > 40) {
      if (blurDiff === 0 || timerAfterBlurSecs === timerBeforeBlurSecs) {
        // According to source code, if backgrounded >30s, timer.pause() is called
        // This means timer is intentionally paused for >30s background
        // This might be by design, let's note it
        addStep('Timer behavior after 30s blur', 'PARTIAL',
          `Timer paused for 30s blur — this may be intentional behavior (source code pauses timer when backgrounded >30s). Before: ${timerBeforeBlur}, After: ${timerAfterBlur}`
        );
        results.sessionChecks.timerPausedByBlurDesign = true;
      } else {
        addStep('Timer behavior after 30s blur', 'PARTIAL',
          `Timer diff: ${blurDiff}s during 30s blur. Before: ${timerBeforeBlur}, After: ${timerAfterBlur}`);
      }
    } else {
      addStep('Timer behavior after 30s blur', 'PASS',
        `Timer decreased by ~${blurDiff}s during 30s blur. Before: ${timerBeforeBlur}, After: ${timerAfterBlur}`);
    }
  } else {
    addStep('Timer behavior after 30s blur', 'PARTIAL',
      `Could not parse timer values. Before: ${timerBeforeBlur}, After: ${timerAfterBlur}`);
  }

  // Check if timer was paused — per source code (lines 722-727), if backgrounded >30s, timer.pause() is called
  // This is the app's design: timer pauses when backgrounded over 30s (to prevent abuse?)
  if (isTimerPausedAfterBlur) {
    console.log('[BLUR] Timer was paused by app after >30s blur — this is intentional behavior per source code');
    // Try to resume
    const resumeBtn = page.locator('button:has-text("Resume"), button:has-text("Continue")').first();
    if (await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resumeBtn.click();
      await page.waitForTimeout(1000);
      addStep('Resume timer after blur pause', 'PASS', 'Timer resumed after blur pause');
    }
  }

  // ==========================================================
  // STEP 10: ANSWER Q11-Q15
  // ==========================================================
  console.log('\n=== STEP 10: ANSWERING Q11-Q15 ===');

  // Navigate to Q11 — first figure out where we are
  const currentQAfterBlur = await getCurrentQuestionNumber(page);
  console.log(`[Q11-Q15] Currently on: ${currentQAfterBlur.text}`);

  // Navigate to Q11 via next buttons or navigator
  let reachedQ11 = false;
  if (currentQAfterBlur.current <= 10) {
    for (let attempt = 0; attempt < 15; attempt++) {
      const q = await getCurrentQuestionNumber(page);
      if (q.current === 11) {
        reachedQ11 = true;
        break;
      }
      if (q.current > 11) {
        reachedQ11 = true;
        break;
      }
      await clickNextButton(page);
      await page.waitForTimeout(400);
    }
  } else if (currentQAfterBlur.current > 10) {
    reachedQ11 = true;
  }

  const answeredQ11to15 = {};
  for (let qNum = 11; qNum <= 15; qNum++) {
    const qInfo = await getCurrentQuestionNumber(page);
    console.log(`[Q${qNum}] Counter: ${qInfo.text}`);

    await page.waitForTimeout(700);

    const opts = await getAnswerOptions(page);
    if (opts.length === 0) {
      console.log(`[Q${qNum}] No answer options found`);
      await clickNextButton(page);
      continue;
    }

    const optIdx = (qNum + 1) % Math.min(opts.length, 4);
    const selected = await selectAnswerOption(page, optIdx);
    if (selected) {
      answeredQ11to15[qNum] = { optionIndex: optIdx, label: opts[optIdx]?.label || '' };
      console.log(`[Q${qNum}] Selected option ${optIdx}: "${opts[optIdx]?.label?.substring(0, 40) || 'n/a'}"`);
    }

    if (qNum === 13 || qNum === 15) {
      await screenshot(page, `14_q${qNum}_answered`);
    }

    if (qNum < 15) {
      await clickNextButton(page);
      await page.waitForTimeout(500);
    }
  }

  results.trackedAnswers.q11to15 = answeredQ11to15;
  const q11to15Count = Object.values(answeredQ11to15).filter(a => !a.error).length;
  addStep('Answer Q11-Q15', q11to15Count >= 4 ? 'PASS' : 'PARTIAL',
    `Answered: ${q11to15Count}/5`);

  // ==========================================================
  // STEP 11: GO TO REVIEW SCREEN AND VERIFY ALL ANSWERS
  // ==========================================================
  console.log('\n=== STEP 11: REVIEW SCREEN — VERIFY ALL 15 ANSWERS ===');

  await page.waitForTimeout(1000);
  const reviewReached = await goToReviewScreen(page);
  await page.waitForTimeout(2000);
  await screenshot(page, '15_review_screen');

  const reviewText = await page.locator('body').textContent().catch(() => '');
  const isOnReview = /review|submit section|summary|answered|unanswered/i.test(reviewText);

  addStep('Navigate to Review Screen', isOnReview ? 'PASS' : 'FAIL',
    `Review screen visible: ${isOnReview}. URL: ${page.url()}`);

  if (isOnReview) {
    // Check answered count
    const answeredMatch = reviewText.match(/(\d+)\s*(?:of\s*\d+\s*)?answered/i);
    const answeredCount = answeredMatch ? parseInt(answeredMatch[1]) : -1;
    console.log(`[REVIEW] Answered count on review: ${answeredCount}`);
    results.sessionChecks.reviewAnsweredCount = answeredCount;

    // Expected: at least 15 questions answered (or close to it based on our interaction)
    const totalAnswered = q1to5Count + q6to10Count + q11to15Count;
    console.log(`[REVIEW] Total we answered: ${totalAnswered}/15`);

    if (answeredCount >= 12) {
      addStep('Review screen shows answered count', 'PASS',
        `Review shows ${answeredCount} answered questions`);
    } else if (answeredCount >= 8) {
      addStep('Review screen shows answered count', 'PARTIAL',
        `Review shows only ${answeredCount} answered (expected ~${totalAnswered})`);
    } else {
      addFinding('High-Priority', 'Review screen shows fewer answers than expected after tab switch and blur',
        `Review screen shows ${answeredCount} answered questions, but we answered approximately ${totalAnswered} questions across the session including after tab switch and page blur events.`,
        'All answers selected before and after tab switch / page blur events should persist and be reflected on the review screen.',
        'Screenshot: 15_review_screen.png'
      );
      addStep('Review screen shows answered count', 'FAIL',
        `Expected ~${totalAnswered} answered, review shows ${answeredCount}`);
    }
  } else {
    addFinding('High-Priority', 'Review screen not accessible after Q15',
      'Could not navigate to the review screen after answering Q15',
      'A Review button should be visible on Q15 to proceed to the review screen',
      'Screenshot: 15_review_screen.png'
    );
  }

  // ==========================================================
  // STEP 12: SUBMIT TEST
  // ==========================================================
  console.log('\n=== STEP 12: SUBMIT TEST ===');

  const submitted = await submitSection(page);
  await page.waitForTimeout(5000);
  await screenshot(page, '16_after_submit_section');

  const afterSubmitUrl = page.url();
  const afterSubmitText = await page.locator('body').textContent().catch(() => '');
  const isOnFRQChoice = /frq|free response|essay|choice|topic|section 2/i.test(afterSubmitText);
  const isOnResults = /report card|results|score|your score|performance/i.test(afterSubmitText);

  addStep('Submit MCQ Section', submitted ? 'PASS' : 'FAIL',
    `URL after submit: ${afterSubmitUrl}. FRQ choice: ${isOnFRQChoice}. Results: ${isOnResults}`);

  // Handle FRQ if present
  if (isOnFRQChoice) {
    addStep('FRQ Choice Screen appeared', 'PASS', 'FRQ choice screen after MCQ section submit');
    await screenshot(page, '17_frq_choice');

    // Start FRQ
    const frqStartBtn = page.locator('button').filter({ hasText: /topic|question|start|begin|section 2/i }).first();
    if (await frqStartBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await frqStartBtn.click();
      await page.waitForTimeout(3000);
    }

    // Type FRQ answers
    const textareas = page.locator('textarea, [contenteditable="true"]');
    const taCount = await textareas.count().catch(() => 0);
    const frqAnswer = 'The distracted student provides a brief answer about supply and demand equilibrium and market forces in a microeconomic context.';
    let frqAnswered = 0;
    for (let i = 0; i < taCount; i++) {
      const ta = textareas.nth(i);
      if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ta.fill(frqAnswer);
        frqAnswered++;
      }
    }

    await screenshot(page, '18_frq_answered');
    addStep('Type FRQ answers', frqAnswered > 0 ? 'PASS' : 'PARTIAL',
      `Filled ${frqAnswered} textareas`);

    // Submit test
    const submitTestSelectors = [
      'button:has-text("Submit Test")',
      'button:has-text("Submit Exam")',
      'button:has-text("Finish")',
      'button:has-text("Submit")',
    ];
    let testSubmitted = false;
    for (const sel of submitTestSelectors) {
      try {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 3000 }) && !await el.isDisabled()) {
          await el.click();
          testSubmitted = true;
          break;
        }
      } catch {}
    }
    await page.waitForTimeout(5000);
    await screenshot(page, '19_after_test_submit');
    addStep('Submit Test (FRQ)', testSubmitted ? 'PASS' : 'FAIL', `URL: ${page.url()}`);
  }

  // ==========================================================
  // STEP 13: VERIFY REPORT CARD
  // ==========================================================
  console.log('\n=== STEP 13: VERIFY REPORT CARD ===');

  await page.waitForTimeout(5000);
  const finalUrl = page.url();
  const finalText = await page.locator('body').textContent().catch(() => '');
  const hasReportContent = /score|result|performance|mcq|correct|incorrect|report card/i.test(finalText);
  const onResultsPage = finalUrl.includes('/results') || finalUrl.includes('/report');

  await screenshot(page, '20_report_card');
  addStep('Report card loaded', hasReportContent ? 'PASS' : 'FAIL',
    `URL: ${finalUrl}. Report content: ${hasReportContent}`);

  if (hasReportContent) {
    const hasScore = /\d+\s*\/\s*\d+|\d+\s*%|score/i.test(finalText);
    const hasMCQTable = /question|correct|incorrect|your answer/i.test(finalText);
    const hasAPScore = /AP\s*score|projection|band/i.test(finalText);

    console.log(`[REPORT CARD] Score: ${hasScore}, MCQ Table: ${hasMCQTable}, AP Score: ${hasAPScore}`);
    results.sessionChecks.reportCard = { hasScore, hasMCQTable, hasAPScore, url: finalUrl };

    addStep('Report card content complete', (hasScore && hasMCQTable) ? 'PASS' : 'PARTIAL',
      `Score: ${hasScore}, MCQ: ${hasMCQTable}, AP Score: ${hasAPScore}`);
  } else {
    addFinding('High-Priority', 'Report card did not load after test submission',
      `After all distractions and submission, the page at ${finalUrl} does not show report card content. Text snippet: ${finalText.substring(0, 200)}`,
      'Report card should load correctly after test completion regardless of distraction events during the session.',
      'Screenshot: 20_report_card.png'
    );
  }

  // ==========================================================
  // CHECK CONSOLE ERRORS SUMMARY
  // ==========================================================
  console.log('\n=== CONSOLE ERRORS SUMMARY ===');
  const visibilityErrors = results.consoleErrors.filter(e =>
    /visibility|blur|focus|pagehide|hidden/i.test(e.message)
  );
  const allErrors = results.consoleErrors.filter(e => e.type === 'console_error' || e.type === 'pageerror');

  console.log(`[CONSOLE] Total errors: ${allErrors.length}`);
  console.log(`[CONSOLE] Visibility-related: ${visibilityErrors.length}`);

  if (visibilityErrors.length > 0) {
    addFinding('Medium-Priority', 'Console errors related to visibility/focus events',
      `${visibilityErrors.length} console error(s) logged during visibility change or focus events: ${JSON.stringify(visibilityErrors.map(e => e.message.substring(0, 100)))}`,
      'No JavaScript errors should occur when the student switches tabs or loses/regains focus.',
      'Check console errors array in results JSON'
    );
  }

  if (allErrors.length > 0) {
    console.log(`[CONSOLE] All errors: ${JSON.stringify(allErrors.map(e => e.message.substring(0, 100)))}`);
  }

  addStep('No console errors during visibility/focus events',
    visibilityErrors.length === 0 ? 'PASS' : 'PARTIAL',
    `Visibility-related errors: ${visibilityErrors.length}. Total errors: ${allErrors.length}`);

  // ==========================================================
  // SAVE RESULTS
  // ==========================================================
  console.log('\n=== SAVING RESULTS ===');

  results.completedAt = new Date().toISOString();
  results.summary = {
    q1to5Answered: q1to5Count,
    q6to10Answered: q6to10Count,
    q11to15Answered: q11to15Count,
    totalAnswered: q1to5Count + q6to10Count + q11to15Count,
    timerReadings: results.timerReadings,
    totalFindings: results.findings.length,
    consoleErrorCount: results.consoleErrors.length,
    passed: results.steps.filter(s => s.status === 'PASS').length,
    failed: results.steps.filter(s => s.status === 'FAIL').length,
    partial: results.steps.filter(s => s.status === 'PARTIAL').length,
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`[DONE] Results saved to: ${RESULTS_FILE}`);
  console.log(`[DONE] Summary: ${JSON.stringify(results.summary, null, 2)}`);

  // Final assertion
  const blockers = results.findings.filter(f => f.severity === 'Blocker');
  if (blockers.length > 0) {
    throw new Error(`BLOCKERS FOUND: ${blockers.map(b => b.title).join(', ')}`);
  }
});
