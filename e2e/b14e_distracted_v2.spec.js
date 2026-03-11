/**
 * B14-E v2: Realistic Student Simulation — "The Distracted One"
 * Account: student8@apboost.test / Student123!
 * Test: Micro test (test_micro_full_1)
 *
 * CORRECTED VERSION: Uses proper button selectors for MCQ answer choices.
 * Answer buttons have text like "AConstant opportunity costs" (letter + text).
 */
import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student8@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14E';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14e_v2_results.json';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  scenarioId: 'B14-E-v2',
  persona: 'The Distracted One (corrected selectors)',
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
  const filePath = path.join(SCREENSHOTS_DIR, `v2_${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`[SCREENSHOT] v2_${name}.png`);
  } catch (e) {
    console.log(`[SCREENSHOT FAILED] ${name}: ${e.message}`);
  }
  return filePath;
}

async function setupConsoleCapture(page) {
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      results.consoleErrors.push({ page: page.url(), message: text, type: 'console_error' });
      console.log(`[CONSOLE ERROR] ${text.substring(0, 120)}`);
    }
  });
  page.on('pageerror', err => {
    results.consoleErrors.push({ page: page.url(), message: err.message, type: 'pageerror' });
    console.log(`[PAGE ERROR] ${err.message.substring(0, 120)}`);
  });
}

async function getTimerText(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '');
  const m = bodyText.match(/\u23f1(\d{1,2}:\d{2})/);
  if (m) return m[1];
  const m2 = bodyText.match(/\b(\d{1,2}:\d{2})\b/);
  return m2 ? m2[1] : null;
}

function parseTimerToSeconds(t) {
  if (!t) return null;
  const m = t.match(/^(\d+):(\d+)$/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

async function getCurrentQuestionNumber(page) {
  const bodyText = await page.locator('body').textContent().catch(() => '');
  const m = bodyText.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
  if (m) return { current: parseInt(m[1]), total: parseInt(m[2]) };
  return { current: -1, total: -1 };
}

async function selectAnswerByLetter(page, letter) {
  const allBtns = page.locator('button[type="button"]');
  const count = await allBtns.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const btn = allBtns.nth(i);
    const text = await btn.textContent().catch(() => '');
    const trimmed = text.trim();
    if (trimmed.startsWith(letter) && trimmed.length > 2) {
      const isVisible = await btn.isVisible().catch(() => false);
      if (isVisible) {
        await btn.click();
        await page.waitForTimeout(400);
        return { success: true, letter, text: trimmed.substring(0, 60) };
      }
    }
  }
  return { success: false, letter };
}

async function getSelectedAnswerLetter(page) {
  const result = await page.evaluate(() => {
    const allBtns = document.querySelectorAll('button[type="button"]');
    const letters = ['A', 'B', 'C', 'D', 'E'];
    for (const btn of allBtns) {
      if (btn.className.includes('bg-brand-primary')) {
        const text = btn.textContent.trim();
        for (const l of letters) {
          if (text.startsWith(l) && text.length > 2) {
            return { letter: l, text: text.substring(0, 60), found: true };
          }
        }
      }
    }
    return { letter: null, text: '', found: false };
  });
  return result;
}

async function clickNext(page) {
  const selectors = ['button:has-text("Next \u2192")', 'button:has-text("Next")'];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false) && !await btn.isDisabled()) {
      await btn.click();
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

async function clickReview(page) {
  const selectors = ['button:has-text("Review \u2192")', 'button:has-text("Review")', 'button:has-text("Submit Section")'];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(2000);
      return true;
    }
  }
  return false;
}

async function submitSection(page) {
  const selectors = ['button:has-text("Submit Section")', 'button:has-text("Submit")'];
  for (const sel of selectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false) && !await btn.isDisabled()) {
      await btn.click();
      await page.waitForTimeout(3000);
      return true;
    }
  }
  return false;
}

async function jumpToQuestion(page, qNum) {
  // Try clicking a number in the navigator
  const numBtns = page.locator('button').filter({ hasText: new RegExp(`^\\s*${qNum}\\s*$`) });
  const numCount = await numBtns.count().catch(() => 0);
  if (numCount > 0) {
    await numBtns.first().click();
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

const ANSWER_PATTERN = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C'];

test.setTimeout(600000);

test('B14-E v2: The Distracted One — Tab Switch and Blur Resilience', async ({ page, context }) => {
  setupConsoleCapture(page);

  // ============================================================
  // LOGIN
  // ============================================================
  console.log('\n=== LOGIN ===');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.locator('input[type="email"]').fill(STUDENT_EMAIL);
  await page.locator('input[type="password"]').fill(STUDENT_PASSWORD);
  await screenshot(page, '01_login_form');
  await page.keyboard.press('Enter');

  try {
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 });
    const postUrl = page.url();
    addStep('Login', 'PASS', `Redirected to: ${postUrl}`);
    if (!postUrl.includes('/ap')) {
      addFinding('Medium-Priority', 'Login redirects to non-AP route (B4-006)',
        `Redirected to ${postUrl}`, 'Should redirect to /ap', 'Known B4-006');
      await page.goto('http://localhost:5173/ap');
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    addStep('Login', 'FAIL', 'Redirect failed');
    addFinding('Blocker', 'Login failed', 'No redirect from /login', 'Should redirect to /ap', '');
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    throw new Error('BLOCKER: Login failed');
  }

  // ============================================================
  // NAVIGATE TO MICRO TEST
  // ============================================================
  console.log('\n=== NAVIGATE TO MICRO TEST ===');
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);
  await screenshot(page, '02_test_page');

  const pageText1 = await page.locator('body').textContent().catch(() => '');
  console.log('[NAV] Initial page text:', pageText1.substring(0, 200));

  // Handle resume/begin
  const resumeBtn = page.locator('button:has-text("Resume Test")').first();
  const beginBtn = page.locator('button:has-text("Begin Test")').first();

  if (await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('[BEGIN] Resume dialog — clicking Resume Test');
    await resumeBtn.click();
    addStep('Resume existing session', 'PASS', 'Resumed from previous session state');
  } else if (await beginBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('[BEGIN] Begin Test visible — clicking');
    await beginBtn.click();
    addStep('Begin new test session', 'PASS', 'Clicked Begin Test');
  } else {
    console.log('[BEGIN] No begin/resume button found, checking if already in test');
    addStep('Begin test', 'PARTIAL', 'No begin/resume button found — possibly already in test view');
  }

  await page.waitForTimeout(3000);
  await screenshot(page, '03_after_begin');

  // ============================================================
  // ANSWER Q1-Q5
  // ============================================================
  console.log('\n=== ANSWER Q1-Q5 ===');

  // Navigate to Q1 first if needed
  let qInfo = await getCurrentQuestionNumber(page);
  console.log(`[Q1 START] Currently on Q${qInfo.current}`);

  // If not on Q1, go to it via the navigator
  if (qInfo.current !== 1 && qInfo.current !== -1) {
    // Try navigator to get to Q1
    const opened = await jumpToQuestion(page, 1);
    if (!opened) {
      // Use Prev button
      for (let i = 0; i < 20; i++) {
        const q = await getCurrentQuestionNumber(page);
        if (q.current === 1 || q.current === -1) break;
        const prevBtn = page.locator('button:has-text("\u2190 Back")').first();
        if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await prevBtn.click();
          await page.waitForTimeout(400);
        } else break;
      }
    }
  }

  const answeredQ1to5 = {};
  for (let qNum = 1; qNum <= 5; qNum++) {
    qInfo = await getCurrentQuestionNumber(page);
    console.log(`\n[Q${qNum}] Currently on Q${qInfo.current}`);
    await page.waitForTimeout(600);

    const letter = ANSWER_PATTERN[qNum - 1];
    const selResult = await selectAnswerByLetter(page, letter);
    console.log(`[Q${qNum}] Select ${letter}: ${JSON.stringify(selResult)}`);

    if (selResult.success) {
      await page.waitForTimeout(300);
      const verified = await getSelectedAnswerLetter(page);
      const isVerified = verified.letter === letter;
      answeredQ1to5[qNum] = { letter, text: selResult.text, verified: isVerified };
      console.log(`[Q${qNum}] Verified: ${isVerified}. Selected: ${verified.letter}`);
    } else {
      answeredQ1to5[qNum] = { letter, error: 'selection failed' };
      addFinding('High-Priority', `Could not select answer for Q${qNum}`,
        `selectAnswerByLetter("${letter}") failed — no button found starting with letter ${letter}`,
        'MCQ answer buttons should be selectable by their letter prefix',
        `Q${qNum}`);
    }

    if (qNum === 1 || qNum === 5) await screenshot(page, `04_q${qNum}_selected`);

    if (qNum < 5) {
      const moved = await clickNext(page);
      if (!moved) console.log(`[Q${qNum}] WARNING: Could not click Next`);
    }
  }

  results.trackedAnswers.q1to5 = answeredQ1to5;
  const q1to5Verified = Object.values(answeredQ1to5).filter(a => a.verified === true).length;
  const q1to5Selected = Object.values(answeredQ1to5).filter(a => a.success !== false).length;

  addStep('Answer Q1-Q5', q1to5Verified >= 4 ? 'PASS' : q1to5Selected >= 4 ? 'PARTIAL' : 'FAIL',
    `Verified: ${q1to5Verified}/5. Selections: ${JSON.stringify(Object.fromEntries(Object.entries(answeredQ1to5).map(([k,v]) => [k, v.letter])))}`);

  if (q1to5Verified < 4) {
    addFinding('High-Priority', `Only ${q1to5Verified}/5 Q1-Q5 answer selections verified`,
      `selectAnswerByLetter() succeeded on button click but getSelectedAnswerLetter() (bg-brand-primary check) did not confirm selection for ${5 - q1to5Verified} questions.`,
      'Clicking an MCQ answer button should immediately update the button style to bg-brand-primary.',
      'Screenshots: v2_04_q1_selected.png, v2_04_q5_selected.png');
  }

  // Read timer before tab switch
  const timerBefore = await getTimerText(page);
  console.log(`[TIMER] Before tab switch: ${timerBefore}`);
  results.timerReadings.push({ phase: 'before_tab_switch', value: timerBefore, wallClock: new Date().toISOString() });
  await screenshot(page, '05_before_tab_switch');

  // ============================================================
  // OPEN NEW TAB AND WAIT 45 SECONDS
  // ============================================================
  console.log('\n=== OPEN NEW TAB (45s distraction) ===');

  const newTab = await context.newPage();
  await newTab.goto('about:blank');
  addStep('Open blank new tab (distraction start)', 'PASS', 'New tab opened');
  console.log('[DISTRACTION] Waiting 45 seconds in new tab...');

  await newTab.waitForTimeout(45000);

  console.log('[DISTRACTION] 45s elapsed — closing new tab');
  await newTab.close();
  await page.bringToFront();
  await page.waitForTimeout(1500);

  await screenshot(page, '06_returned_after_45s');
  addStep('Return from 45s tab distraction', 'PASS', '45 seconds elapsed, returned');

  // ============================================================
  // VERIFY AFTER TAB SWITCH
  // ============================================================
  console.log('\n=== VERIFY AFTER TAB SWITCH ===');

  const textAfterTab = await page.locator('body').textContent().catch(() => '');
  const testVisibleAfterTab = /question/i.test(textAfterTab) && /section/i.test(textAfterTab);
  const isDupModal = /duplicate|another tab|taken over/i.test(textAfterTab);
  const isExpired = /expired|ended.*session/i.test(textAfterTab);

  console.log(`[AFTER TAB] Visible=${testVisibleAfterTab}, DupModal=${isDupModal}, Expired=${isExpired}`);
  results.sessionChecks.afterTabSwitch = { testVisibleAfterTab, isDupModal, isExpired, url: page.url() };

  if (isDupModal) {
    addFinding('High-Priority', 'DuplicateTabModal fired after opening blank new tab (45s)',
      'After opening about:blank in a new tab for 45s and closing it, the DuplicateTabModal appeared on the original test tab. The BroadcastChannel SESSION_QUERY from the blank tab triggered the duplicate tab guard on the original tab.',
      'Opening a non-test blank tab should NOT trigger the DuplicateTabModal. The guard should only fire when the SAME TEST URL is opened in a second tab.',
      'Screenshot: v2_06_returned_after_45s.png');
    addStep('No spurious DuplicateTabModal after blank tab switch', 'FAIL', 'Modal appeared unexpectedly');

    // Try to dismiss
    const useThisBtn = page.locator('button:has-text("Use This Tab"), button:has-text("Take Control")').first();
    if (await useThisBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await useThisBtn.click();
      await page.waitForTimeout(2000);
    }
  } else if (!testVisibleAfterTab) {
    addFinding('Blocker', 'Test session lost after 45s tab switch',
      `Session not visible after returning. URL: ${page.url()}. Text: ${textAfterTab.substring(0, 200)}`,
      'Test must survive tab switching.',
      'Screenshot: v2_06_returned_after_45s.png');
    addStep('Test survived 45s tab switch', 'FAIL', 'Test not visible');
  } else {
    addStep('Test survived 45s tab switch', 'PASS', 'Test visible, no modal, not expired');
  }

  // Timer check
  const timerAfterTab = await getTimerText(page);
  console.log(`[TIMER] After 45s tab switch: ${timerAfterTab}`);
  results.timerReadings.push({ phase: 'after_tab_switch', value: timerAfterTab, wallClock: new Date().toISOString() });

  const t1 = parseTimerToSeconds(timerBefore);
  const t2 = parseTimerToSeconds(timerAfterTab);
  if (t1 !== null && t2 !== null) {
    const diff = t1 - t2;
    console.log(`[TIMER] Tab switch diff: ${diff}s (expected ~45s)`);
    results.timerReadings.push({ phase: 'tab_switch_diff', diff, expected: 45 });

    if (diff >= 35 && diff <= 60) {
      addStep('Timer continued during 45s tab switch', 'PASS',
        `Timer counted ~${diff}s. Before: ${timerBefore}, After: ${timerAfterTab}`);
    } else if (diff <= 5) {
      addFinding('High-Priority', 'Timer froze/paused during 45s tab switch',
        `Timer before: ${timerBefore}, after 45s new tab: ${timerAfterTab}. Diff: ${diff}s — timer appears paused.`,
        'The test timer should continue counting down while the student switches to another browser tab.',
        'Timer readings in results JSON');
      addStep('Timer continued during 45s tab switch', 'FAIL',
        `Timer froze: diff=${diff}s. Before: ${timerBefore}, After: ${timerAfterTab}`);
    } else {
      addStep('Timer continued during 45s tab switch', 'PARTIAL',
        `Timer diff: ${diff}s (expected ~45). Before: ${timerBefore}, After: ${timerAfterTab}`);
    }
  } else {
    addStep('Timer reading after tab switch', 'PARTIAL',
      `Could not parse. Before: ${timerBefore}, After: ${timerAfterTab}`);
  }

  // Check Q1-Q5 answers persisted
  // Navigate to Q1 to verify
  qInfo = await getCurrentQuestionNumber(page);
  console.log(`[VERIFY Q1-Q5] Currently on Q${qInfo.current}`);

  // Open navigator (click the "Q X of 15 ▲" button)
  const qCounterBtn = page.locator('button').filter({ hasText: /of 15/ }).first();
  if (await qCounterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await qCounterBtn.click();
    await page.waitForTimeout(1000);
  }
  await screenshot(page, '06b_navigator_open');

  const q1Jumped = await jumpToQuestion(page, 1);
  await page.waitForTimeout(800);
  const qOnQ1 = await getCurrentQuestionNumber(page);
  console.log(`[Q1 VERIFY] After nav jump, on Q${qOnQ1.current}`);

  if (qOnQ1.current === 1) {
    const q1Sel = await getSelectedAnswerLetter(page);
    console.log(`[Q1 VERIFY] Selected: ${JSON.stringify(q1Sel)}`);
    results.sessionChecks.q1AfterTabSwitch = q1Sel;

    if (q1Sel.found) {
      addStep('Q1 answer persisted after 45s tab switch', 'PASS',
        `Q1 shows letter ${q1Sel.letter}: "${q1Sel.text}"`);
    } else {
      addFinding('High-Priority', 'Q1 answer lost after 45s tab switch',
        `After returning from 45s blank-tab distraction, Q1 shows no selected answer. Expected letter ${ANSWER_PATTERN[0]}.`,
        'All answered questions must retain answers through tab switches.',
        'Screenshot: v2_06b_navigator_open.png');
      addStep('Q1 answer persisted after 45s tab switch', 'FAIL', 'No answer selected on Q1');
    }
  } else {
    addStep('Q1 answer check', 'PARTIAL', `Could not navigate to Q1 (on Q${qOnQ1.current})`);
  }

  await screenshot(page, '07_q1_after_tab_switch');

  // ============================================================
  // ANSWER Q6-Q10
  // ============================================================
  console.log('\n=== ANSWER Q6-Q10 ===');

  // Navigate forward to Q6
  for (let attempt = 0; attempt < 15; attempt++) {
    const q = await getCurrentQuestionNumber(page);
    if (q.current === 6) break;
    if (q.current > 6) break;
    await clickNext(page);
    await page.waitForTimeout(400);
  }

  const answeredQ6to10 = {};
  for (let qNum = 6; qNum <= 10; qNum++) {
    qInfo = await getCurrentQuestionNumber(page);
    console.log(`[Q${qNum}] On Q${qInfo.current}`);

    const letter = ANSWER_PATTERN[qNum - 1];
    const selResult = await selectAnswerByLetter(page, letter);
    if (selResult.success) {
      await page.waitForTimeout(300);
      const verified = await getSelectedAnswerLetter(page);
      answeredQ6to10[qNum] = { letter, text: selResult.text, verified: verified.letter === letter };
    } else {
      answeredQ6to10[qNum] = { letter, error: 'selection failed' };
    }

    if (qNum === 8) await screenshot(page, '08_q8_answered');
    if (qNum < 10) await clickNext(page);
  }

  results.trackedAnswers.q6to10 = answeredQ6to10;
  const q6to10Verified = Object.values(answeredQ6to10).filter(a => a.verified === true).length;
  addStep('Answer Q6-Q10', q6to10Verified >= 4 ? 'PASS' : 'PARTIAL', `Verified: ${q6to10Verified}/5`);

  const timerBeforeBlur = await getTimerText(page);
  console.log(`[TIMER] Before blur: ${timerBeforeBlur}`);
  results.timerReadings.push({ phase: 'before_blur', value: timerBeforeBlur, wallClock: new Date().toISOString() });
  await screenshot(page, '09_before_blur');

  // ============================================================
  // SIMULATE PAGE BLUR FOR 30 SECONDS
  // ============================================================
  console.log('\n=== PAGE BLUR 30s ===');

  await page.evaluate(() => {
    try {
      Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
    } catch(e) {}
    try {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true, configurable: true });
    } catch(e) {}
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('blur'));
    console.log('[B14E-v2] PAGE BLUR: visibilitychange hidden dispatched');
  });

  addStep('Page blur simulated', 'PASS', 'document.visibilitychange=hidden fired');
  console.log('[BLUR] Waiting 30s...');
  await page.waitForTimeout(30000);

  await page.evaluate(() => {
    try {
      Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
    } catch(e) {}
    try {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    } catch(e) {}
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    console.log('[B14E-v2] PAGE FOCUS: visibilitychange visible dispatched');
  });

  await page.waitForTimeout(2000);
  await screenshot(page, '10_after_blur');
  addStep('30s page blur complete and refocused', 'PASS', '30s elapsed, focus restored');

  // ============================================================
  // VERIFY AFTER BLUR
  // ============================================================
  console.log('\n=== VERIFY AFTER BLUR ===');

  const textAfterBlur = await page.locator('body').textContent().catch(() => '');
  const testVisibleAfterBlur = /question/i.test(textAfterBlur) && /section/i.test(textAfterBlur);
  const isDupModalBlur = /duplicate|another tab|taken over/i.test(textAfterBlur);
  const timerPausedText = /paused|timer.*paused/i.test(textAfterBlur);

  console.log(`[AFTER BLUR] Visible=${testVisibleAfterBlur}, DupModal=${isDupModalBlur}, Paused=${timerPausedText}`);
  results.sessionChecks.afterBlur = { testVisibleAfterBlur, isDupModalBlur, timerPausedText, url: page.url() };

  if (!testVisibleAfterBlur) {
    addFinding('Blocker', 'Test session lost after 30s page blur',
      `Test not visible after simulated 30s blur. URL: ${page.url()}`,
      'Session must survive page blur events.',
      'Screenshot: v2_10_after_blur.png');
    addStep('Test survived 30s blur', 'FAIL', 'Not visible after blur');
  } else {
    addStep('Test survived 30s blur', 'PASS', 'Test visible after 30s blur');
  }

  // Timer check after blur
  const timerAfterBlur = await getTimerText(page);
  console.log(`[TIMER] After 30s blur: ${timerAfterBlur}`);
  results.timerReadings.push({ phase: 'after_blur', value: timerAfterBlur, wallClock: new Date().toISOString() });

  const t3 = parseTimerToSeconds(timerBeforeBlur);
  const t4 = parseTimerToSeconds(timerAfterBlur);
  if (t3 !== null && t4 !== null) {
    const blurDiff = t3 - t4;
    console.log(`[TIMER] Blur diff: ${blurDiff}s (expected ~30s)`);
    results.timerReadings.push({ phase: 'blur_diff', diff: blurDiff, expected: 30, before: timerBeforeBlur, after: timerAfterBlur });

    // Per source code useTestSession.js lines 702-737:
    // If backgrounded >30s, timer.pause() is called — by design
    if (blurDiff >= 25 && blurDiff <= 40) {
      addStep('Timer continued during 30s blur', 'PASS',
        `Diff: ~${blurDiff}s. Before: ${timerBeforeBlur}, After: ${timerAfterBlur}`);
    } else if (blurDiff < 5) {
      // This could mean timer was paused by the app's >30s backgrounded rule
      addStep('Timer behavior during 30s blur', 'PARTIAL',
        `Timer diff: ${blurDiff}s — timer appears paused. This may be intentional: source code (useTestSession.js ~L722) calls timer.pause() when backgrounded >30s. Before: ${timerBeforeBlur}, After: ${timerAfterBlur}`);
      results.sessionChecks.timerPausedBy30sRule = true;
    } else {
      addStep('Timer behavior during 30s blur', 'PARTIAL',
        `Timer diff: ${blurDiff}s. Before: ${timerBeforeBlur}, After: ${timerAfterBlur}`);
    }
  }

  // ============================================================
  // ANSWER Q11-Q15
  // ============================================================
  console.log('\n=== ANSWER Q11-Q15 ===');

  // Navigate to Q11
  for (let attempt = 0; attempt < 15; attempt++) {
    const q = await getCurrentQuestionNumber(page);
    if (q.current >= 11) break;
    await clickNext(page);
    await page.waitForTimeout(400);
  }

  const answeredQ11to15 = {};
  for (let qNum = 11; qNum <= 15; qNum++) {
    qInfo = await getCurrentQuestionNumber(page);
    console.log(`[Q${qNum}] On Q${qInfo.current}`);

    const letter = ANSWER_PATTERN[qNum - 1];
    const selResult = await selectAnswerByLetter(page, letter);
    if (selResult.success) {
      await page.waitForTimeout(300);
      const verified = await getSelectedAnswerLetter(page);
      answeredQ11to15[qNum] = { letter, text: selResult.text, verified: verified.letter === letter };
    } else {
      answeredQ11to15[qNum] = { letter, error: 'selection failed' };
    }

    if (qNum === 15) await screenshot(page, '11_q15_answered');
    if (qNum < 15) await clickNext(page);
  }

  results.trackedAnswers.q11to15 = answeredQ11to15;
  const q11to15Verified = Object.values(answeredQ11to15).filter(a => a.verified === true).length;
  addStep('Answer Q11-Q15', q11to15Verified >= 4 ? 'PASS' : 'PARTIAL', `Verified: ${q11to15Verified}/5`);

  // ============================================================
  // REVIEW SCREEN
  // ============================================================
  console.log('\n=== REVIEW SCREEN ===');

  const reviewClicked = await clickReview(page);
  await page.waitForTimeout(2000);
  await screenshot(page, '12_review_screen');

  const reviewBodyText = await page.locator('body').textContent().catch(() => '');
  const isOnReview = /review your answers|answered:|submit section/i.test(reviewBodyText);

  addStep('Navigate to Review Screen', isOnReview ? 'PASS' : 'FAIL',
    `Review visible: ${isOnReview}. URL: ${page.url()}`);

  if (isOnReview) {
    // Format: "Answered: X/15"
    const answeredMatch = reviewBodyText.match(/Answered:\s*(\d+)\s*\/\s*(\d+)/i);
    const answeredCount = answeredMatch ? parseInt(answeredMatch[1]) : -1;
    const totalCountOnReview = answeredMatch ? parseInt(answeredMatch[2]) : -1;
    const unansweredMatch = reviewBodyText.match(/Unanswered:\s*(\d+)/i);
    const unansweredCount = unansweredMatch ? parseInt(unansweredMatch[1]) : -1;

    console.log(`[REVIEW] Answered: ${answeredCount}/${totalCountOnReview}, Unanswered: ${unansweredCount}`);
    results.sessionChecks.review = { answeredCount, totalCountOnReview, unansweredCount };

    const totalExpected = q1to5Verified + q6to10Verified + q11to15Verified;
    console.log(`[REVIEW] We verified ${totalExpected}/15 answers across all phases`);

    if (answeredCount >= 14) {
      addStep('Review screen: 15 answers present', 'PASS', `${answeredCount}/${totalCountOnReview} answered`);
    } else if (answeredCount >= 10) {
      addStep('Review screen: answers mostly present', 'PARTIAL',
        `${answeredCount}/${totalCountOnReview} — some may be lost`);
      addFinding('Medium-Priority', `Review screen shows ${answeredCount}/15 answers after distractions`,
        `After 45s tab switch and 30s blur, review shows only ${answeredCount}/${totalCountOnReview} answered.`,
        'All 15 answers should persist through distraction events.',
        'Screenshot: v2_12_review_screen.png');
    } else if (answeredCount >= 0) {
      addFinding('High-Priority', `Review shows only ${answeredCount}/15 answers — significant loss`,
        `After tab switch and blur events, review screen shows only ${answeredCount}/${totalCountOnReview} answered questions.`,
        'All answered questions must persist through tab switches and page blur.',
        'Screenshot: v2_12_review_screen.png');
      addStep('Review screen: answer count', 'FAIL', `Only ${answeredCount} answers present`);
    } else {
      addStep('Review screen: answer count parsing', 'PARTIAL',
        'Could not parse answered count from review screen text');
    }
  } else {
    addFinding('High-Priority', 'Review screen not accessible',
      `Could not reach review screen. URL: ${page.url()}`,
      'Review screen must be accessible after Q15.',
      'Screenshot: v2_12_review_screen.png');
  }

  // ============================================================
  // SUBMIT MCQ SECTION
  // ============================================================
  console.log('\n=== SUBMIT ===');

  const subResult = await submitSection(page);
  await page.waitForTimeout(5000);
  await screenshot(page, '13_after_submit');

  const afterSubText = await page.locator('body').textContent().catch(() => '');
  const hasFRQChoice = /free response|section 2|choose.*topic|frq/i.test(afterSubText);
  const hasResults = /report card|your score|performance/i.test(afterSubText);

  addStep('Submit MCQ Section', subResult ? 'PASS' : 'FAIL',
    `FRQ: ${hasFRQChoice}, Results: ${hasResults}`);

  if (hasFRQChoice) {
    addStep('FRQ choice screen appeared', 'PASS', 'Correct flow after MCQ submit');
    await screenshot(page, '14_frq_choice');

    // Start FRQ
    const frqBtn = page.locator('button').filter({ hasText: /start|begin|section 2|topic/i }).first();
    if (await frqBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await frqBtn.click();
      await page.waitForTimeout(3000);
    }

    // Fill textareas
    const tas = page.locator('textarea');
    const taCount = await tas.count().catch(() => 0);
    let filled = 0;
    for (let i = 0; i < taCount; i++) {
      const ta = tas.nth(i);
      if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ta.fill('Distracted student FRQ answer: Supply and demand equilibrium analysis in microeconomics context.');
        filled++;
      }
    }
    addStep('FRQ answers typed', filled > 0 ? 'PASS' : 'PARTIAL', `Filled ${filled} textareas`);
    await screenshot(page, '14b_frq_filled');

    // Submit test
    for (const sel of ['button:has-text("Submit Test")', 'button:has-text("Finish")', 'button:has-text("Submit")']) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false) && !await btn.isDisabled()) {
        await btn.click();
        await page.waitForTimeout(5000);
        break;
      }
    }
    await screenshot(page, '15_after_test_submit');
  }

  // ============================================================
  // REPORT CARD
  // ============================================================
  console.log('\n=== REPORT CARD ===');

  await page.waitForTimeout(5000);
  const finalUrl = page.url();
  const finalText = await page.locator('body').textContent().catch(() => '');
  const hasReportContent = /report card|performance|your score|mcq.*correct/i.test(finalText);
  const onResultsUrl = finalUrl.includes('/results');

  await screenshot(page, '16_final_report_card');
  addStep('Report card loaded', (hasReportContent || onResultsUrl) ? 'PASS' : 'FAIL',
    `URL: ${finalUrl}, Content: ${hasReportContent}`);

  if (!hasReportContent && !onResultsUrl) {
    addFinding('High-Priority', 'Report card did not load after submission',
      `Final URL: ${finalUrl}. Content: ${finalText.substring(0, 200)}`,
      'Report card must load after all distraction events and submission.',
      'Screenshot: v2_16_final_report_card.png');
  } else {
    // Verify report card contents
    const hasScore = /\d+\s*\/\s*\d+|\d+%/i.test(finalText);
    const hasMCQTable = /your answer|correct answer|question \d+/i.test(finalText);
    const hasAPScore = /AP\s*score|projection/i.test(finalText);
    results.sessionChecks.reportCard = { hasScore, hasMCQTable, hasAPScore, url: finalUrl };
    addStep('Report card content', (hasScore && hasMCQTable) ? 'PASS' : 'PARTIAL',
      `Score: ${hasScore}, MCQ table: ${hasMCQTable}, AP: ${hasAPScore}`);
  }

  // ============================================================
  // CONSOLE ERRORS SUMMARY
  // ============================================================
  const allErrors = results.consoleErrors;
  const visibilityRelatedErrors = allErrors.filter(e =>
    /visibility|blur|focus|pagehide|hidden/i.test(e.message)
  );
  const codeStartsWithErrors = allErrors.filter(e => /code.startsWith/i.test(e.message));
  const firestoreOfflineErrors = allErrors.filter(e => /firestore.*unavailable|Could not reach/i.test(e.message));

  console.log(`\n[CONSOLE SUMMARY] Total: ${allErrors.length}, Visibility-related: ${visibilityRelatedErrors.length}`);

  if (visibilityRelatedErrors.length > 0) {
    addFinding('Medium-Priority', 'Console errors during visibility/focus events',
      `${visibilityRelatedErrors.length} errors related to visibility change: ${JSON.stringify(visibilityRelatedErrors.map(e => e.message.substring(0, 100)))}`,
      'No JS errors during tab switch or page blur.',
      'Console output');
  }

  if (codeStartsWithErrors.length > 0) {
    console.log('[KNOWN] code.startsWith errors (B14G-003) confirmed still present:', codeStartsWithErrors.length);
  }

  addStep('No console errors from visibility/focus events',
    visibilityRelatedErrors.length === 0 ? 'PASS' : 'PARTIAL',
    `Visibility errors: ${visibilityRelatedErrors.length}, Total: ${allErrors.length}`);

  // ============================================================
  // SAVE RESULTS
  // ============================================================
  results.completedAt = new Date().toISOString();
  results.summary = {
    q1to5Verified,
    q6to10Verified,
    q11to15Verified,
    totalVerifiedAnswers: q1to5Verified + q6to10Verified + q11to15Verified,
    timerReadings: results.timerReadings,
    totalFindings: results.findings.length,
    consoleErrorCount: allErrors.length,
    knownErrors: {
      codeStartsWith: codeStartsWithErrors.length,
      firestoreOffline: firestoreOfflineErrors.length,
    },
    passed: results.steps.filter(s => s.status === 'PASS').length,
    failed: results.steps.filter(s => s.status === 'FAIL').length,
    partial: results.steps.filter(s => s.status === 'PARTIAL').length,
  };

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n[DONE] Saved to ${RESULTS_FILE}`);
  console.log(`[DONE] Summary: ${JSON.stringify(results.summary, null, 2)}`);

  const blockers = results.findings.filter(f => f.severity === 'Blocker');
  if (blockers.length > 0) {
    throw new Error(`BLOCKERS: ${blockers.map(b => b.title).join(', ')}`);
  }
});
