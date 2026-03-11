/**
 * B14C-retest v3: The Second-Guesser — FIX-6 verification
 * student6@apboost.test — Micro test (test_micro_full_1)
 *
 * Fixed version: proper Review navigation (→ not Flag), proper screen detection.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student6@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14C_retest_v3';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14c_retest_v3_results.json';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  scenarioId: 'B14C-retest-v3',
  startedAt: new Date().toISOString(),
  steps: [],
  answers: {},
  answerChanges: [],
  reviewVisits: [],
  findings: [],
  consoleErrors: [],
};

function saveResults() {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function log(msg) {
  console.log(`[B14C] ${msg}`);
  results.steps.push({ time: new Date().toISOString(), msg });
}

async function screenshot(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    log(`Screenshot: ${name}.png`);
  } catch (e) {
    log(`Screenshot FAILED: ${name} — ${e.message}`);
  }
}

async function getCurrentQuestionNumber(page) {
  try {
    const text = await page.locator('text=/Question \\d+ of/i').first().textContent({ timeout: 3000 });
    const match = text.match(/Question (\d+) of/i);
    if (match) return parseInt(match[1]);
  } catch {}
  return null;
}

/**
 * Detect selected answer using brand-primary scan.
 */
async function detectSelectedAnswer(page) {
  return await page.evaluate(() => {
    const result = { selectedIndex: -1, selectedLetter: null, allChoicesCount: 0, method: 'none' };
    const letters = ['A', 'B', 'C', 'D'];

    // Find answer choice buttons - they have rounded border and flex layout
    // and contain short choice text
    const allButtons = document.querySelectorAll('button');
    const answerButtons = [];

    allButtons.forEach(btn => {
      const cls = btn.className || '';
      const text = (btn.textContent || '').trim();
      // Answer choice buttons have specific structure: letter + choice text
      // They are NOT: Nav buttons (numbers), Flag button, Back/Next buttons, Question number button
      if (cls.includes('flex-1') && cls.includes('flex') && cls.includes('items-start') && cls.includes('gap-3')) {
        answerButtons.push(btn);
      }
    });

    result.allChoicesCount = answerButtons.length;

    answerButtons.forEach((btn, i) => {
      const cls = btn.className || '';
      // Selected choice gets bg-brand-primary class
      if (cls.includes('bg-brand-primary')) {
        result.selectedIndex = i;
        result.selectedLetter = letters[i] || String.fromCharCode(65 + i);
        result.method = 'flex-1-scan';
      }
    });

    return result;
  });
}

/**
 * Select an answer choice by index (0=A, 1=B, 2=C, 3=D) using flex-1 structure.
 */
async function selectAnswerByIndex(page, choiceIndex) {
  const letters = ['A', 'B', 'C', 'D'];
  return await page.evaluate((idx) => {
    const allButtons = document.querySelectorAll('button');
    const answerButtons = [];

    allButtons.forEach(btn => {
      const cls = btn.className || '';
      if (cls.includes('flex-1') && cls.includes('flex') && cls.includes('items-start') && cls.includes('gap-3')) {
        answerButtons.push(btn);
      }
    });

    if (answerButtons.length > idx) {
      answerButtons[idx].click();
      return { clicked: true, count: answerButtons.length };
    }
    return { clicked: false, count: answerButtons.length };
  }, choiceIndex);
}

/**
 * Navigate to a specific question by clicking its number in the navigator grid.
 * The navigator is opened via the "Question X of 15" button in the header.
 */
async function navigateToQuestion(page, targetQ) {
  log(`Navigating to Q${targetQ}`);

  // Try opening the navigator via the "Question X of 15▲" button
  const navToggle = page.locator('button').filter({ hasText: /of 15/i }).first();
  try {
    await navToggle.waitFor({ timeout: 5000 });
    await navToggle.click();
    await page.waitForTimeout(800);
    log(`Opened navigator from question toggle button`);
  } catch {
    log(`Could not open navigator via question toggle`);
    // Try hamburger menu
    const menuBtn = page.locator('[aria-label*="menu" i], [aria-label*="Menu" i]').first();
    try {
      await menuBtn.click();
      await page.waitForTimeout(500);
      const goToQBtn = page.locator('button').filter({ hasText: /Go to Question/i }).first();
      await goToQBtn.waitFor({ timeout: 3000 });
      await goToQBtn.click();
      await page.waitForTimeout(500);
    } catch {
      log(`Could not open navigator via hamburger menu either`);
      return false;
    }
  }

  await screenshot(page, `nav_for_Q${targetQ}`);

  // Click the target question number
  // The navigator grid renders buttons numbered 1-15
  // Need to find a button with JUST the number (not "Question 3 of 15")
  const gridBtn = page.locator('button').filter({ hasText: new RegExp(`^${targetQ}$`) }).first();
  try {
    await gridBtn.waitFor({ timeout: 5000 });
    await gridBtn.click();
    await page.waitForTimeout(800);
    log(`Clicked Q${targetQ} in navigator`);
    return true;
  } catch {
    log(`Q${targetQ} button not found, trying flag emoji pattern`);
    // It might be showing a flag emoji instead if flagged
    // Try nth button in grid — navigator renders Q1 at index 0
    const allNavBtns = page.locator('[class*="w-10"][class*="h-10"]');
    const count = await allNavBtns.count();
    log(`Found ${count} nav-sized buttons`);
    if (count >= targetQ) {
      await allNavBtns.nth(targetQ - 1).click();
      await page.waitForTimeout(800);
      return true;
    }
    return false;
  }
}

/**
 * Navigate to Review screen — specifically using the "Review →" button
 * NOT "Flag for Review". Must be called from Q15 or use menu.
 */
async function openReviewScreen(page) {
  // Try the "Review →" button (the navigation button at Q15)
  // Or the hamburger menu's "Review" option
  // Strategy: look for button with EXACT text matching "Review →" or just the review nav

  let clicked = false;

  // Method 1: Look for "Review →" which appears on Q15
  const reviewNavBtn = page.locator('button').filter({ hasText: /^Review →$/ }).first();
  try {
    const visible = await reviewNavBtn.isVisible({ timeout: 2000 });
    if (visible) {
      await reviewNavBtn.click();
      await page.waitForTimeout(1500);
      log(`Opened review via "Review →" button`);
      clicked = true;
    }
  } catch {}

  if (!clicked) {
    // Method 2: Hamburger menu → "Review Questions" or similar
    // The TestSessionMenu typically has a review option
    const menuBtn = page.locator('[aria-label*="menu" i]').first();
    try {
      await menuBtn.click();
      await page.waitForTimeout(500);
      // Look for review option in menu (not "Flag for Review")
      const menuReviewBtn = page.locator('button, a, li').filter({ hasText: /^Review$|Review Questions|Go to Review/i }).first();
      await menuReviewBtn.waitFor({ timeout: 3000 });
      await menuReviewBtn.click();
      await page.waitForTimeout(1500);
      log(`Opened review via hamburger menu`);
      clicked = true;
    } catch {
      // Close menu if open
      try { await page.keyboard.press('Escape'); } catch {}
    }
  }

  if (!clicked) {
    // Method 3: Navigate to Q15 first, then click Review →
    log(`Navigating to Q15 first to access Review button`);
    await navigateToQuestion(page, 15);
    await page.waitForTimeout(500);

    // Now try Review → again
    const reviewBtn15 = page.locator('button').filter({ hasText: /^Review →$/ }).first();
    try {
      await reviewBtn15.waitFor({ timeout: 3000 });
      await reviewBtn15.click();
      await page.waitForTimeout(1500);
      log(`Opened review via Q15 → Review →`);
      clicked = true;
    } catch {
      log(`Still could not open review from Q15`);
    }
  }

  return clicked;
}

/**
 * Check if we're on the review screen.
 */
async function isOnReviewScreen(page) {
  try {
    // The review screen has "Review Your Answers" heading
    const heading = page.locator('h1, h2').filter({ hasText: /Review Your Answers/i }).first();
    const visible = await heading.isVisible({ timeout: 2000 });
    return visible;
  } catch {
    return false;
  }
}

/**
 * Get review screen data.
 */
async function getReviewData(page) {
  return await page.evaluate(() => {
    const data = {
      heading: null,
      summaryText: null,
      answeredCount: null,
      totalCount: null,
      gridButtons: [],
      answeredGridCount: 0,
    };

    // Get heading
    const h1 = document.querySelector('h1, h2');
    data.heading = h1?.textContent?.trim();

    // Get summary
    const allText = document.body.textContent || '';
    data.summaryText = allText.substring(allText.indexOf('Summary'), allText.indexOf('Summary') + 200).trim();

    // Parse answered count
    const answeredMatch = allText.match(/Answered:\s*(\d+)\/(\d+)/);
    if (answeredMatch) {
      data.answeredCount = parseInt(answeredMatch[1]);
      data.totalCount = parseInt(answeredMatch[2]);
    }

    // Count grid buttons (w-10 h-10 sized buttons)
    const gridBtns = document.querySelectorAll('button');
    gridBtns.forEach(btn => {
      const cls = btn.className || '';
      const text = (btn.textContent || '').trim();
      // Navigator grid buttons are w-10 h-10 and contain question numbers or flag emoji
      if (cls.includes('w-10') && cls.includes('h-10') && (/^(\d+|🚩)$/.test(text))) {
        const isAnswered = cls.includes('bg-brand-primary');
        data.gridButtons.push({ num: text, isAnswered, cls: cls.substring(0, 60) });
        if (isAnswered) data.answeredGridCount++;
      }
    });

    return data;
  });
}

test.setTimeout(300000); // 5 minutes

test('B14C-retest v3: The Second-Guesser — answer persistence verification', async ({ page }) => {

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('net::ERR') && !text.includes('favicon') && !text.includes('ERR_BLOCKED')) {
        consoleErrors.push({ url: page.url(), msg: text, type: 'console-error' });
        log(`[CONSOLE ERROR] ${text.substring(0, 150)}`);
      }
    }
  });
  page.on('pageerror', err => {
    const msg = err.message;
    consoleErrors.push({ url: page.url(), msg, type: 'pageerror' });
    log(`[PAGE ERROR] ${msg.substring(0, 150)}`);
    if (msg.includes('scheduleFlush') || msg.includes('Cannot access') || msg.includes('before initialization')) {
      results.findings.push({
        id: 'B14C-TDZ-CRASH',
        severity: 'Blocker',
        title: 'TDZ crash: Cannot access before initialization',
        detail: msg,
      });
      saveResults();
    }
  });

  // ============================================================
  // STEP 1: Login
  // ============================================================
  log('STEP 1: Login as student6@apboost.test');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.locator('input[type="email"]').first().fill(STUDENT_EMAIL);
  await page.locator('input[type="password"]').first().fill(STUDENT_PASSWORD);
  await screenshot(page, '01_login_filled');
  await page.keyboard.press('Enter');

  // Wait for auth — may redirect to / (known bug B4-006) or /ap
  await page.waitForTimeout(5000);
  const postLoginURL = page.url();
  log(`After login: URL = ${postLoginURL}`);
  await screenshot(page, '01_after_login');

  // Known bug: student login goes to / not /ap
  // Manually navigate to /ap
  if (!postLoginURL.includes('/ap')) {
    log('Login redirected to / — navigating to /ap manually (known bug B4-006)');
    results.findings.push({
      id: 'B4-006-confirmed',
      severity: 'Medium-Priority',
      title: 'Student login redirects to / not /ap (pre-existing bug B4-006)',
      detail: `After login, redirected to ${postLoginURL} instead of /ap`,
    });
  }

  // ============================================================
  // STEP 2: Navigate to Micro test
  // ============================================================
  log('STEP 2: Navigate to Micro test');

  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(5000);
  await screenshot(page, '02_test_page');

  // Check for TDZ crash
  if (results.findings.some(f => f.id === 'B14C-TDZ-CRASH')) {
    log('TDZ crash detected — stopping as instructed');
    saveResults();
    return;
  }

  const pageText = await page.textContent('body');
  if (pageText.includes('scheduleFlush') || pageText.includes('Cannot access')) {
    results.findings.push({
      id: 'B14C-TDZ-CRASH',
      severity: 'Blocker',
      title: 'TDZ crash in page body',
      detail: pageText.substring(0, 200),
    });
    await screenshot(page, '02_tdz_crash');
    log('TDZ crash in body text — stopping');
    saveResults();
    return;
  }

  // Check if there's a session in progress - look for instruction screen or testing state
  const pageState = await page.evaluate(() => {
    const body = document.body.textContent || '';
    return {
      hasBeginBtn: body.includes('Begin Test') || body.includes('Start Test'),
      hasResumeBtn: body.includes('Resume') || body.includes('Continue'),
      hasQuestionText: body.includes('Question') && body.includes('of 15'),
      hasInstructions: body.includes('Instructions') || body.includes('Section'),
      currentQ: null,
    };
  });
  log(`Page state: ${JSON.stringify(pageState)}`);

  // Handle instruction screen
  if (pageState.hasBeginBtn) {
    log('Instruction screen detected — clicking Begin Test');
    await page.locator('button').filter({ hasText: /Begin Test|Start Test/i }).first().click();
    await page.waitForTimeout(3000);
    await screenshot(page, '02_after_begin');
  } else if (pageState.hasResumeBtn) {
    log('Resume screen detected — this is a stale session from B13-P3');
    // We need to handle this. There might be an existing session.
    // Let's just try to proceed to the test
    await screenshot(page, '02_resume_state');
  }

  // ============================================================
  // STEP 3: Answer Q1-Q15 in order
  // ============================================================
  log('STEP 3: Answering Q1-Q15 in order');

  // Answer plan: letter index (0=A, 1=B, 2=C, 3=D) for each question
  const answerPlan = [null, 0, 1, 2, 0, 3, 1, 0, 2, 1, 3, 0, 2, 1, 3, 0]; // index 0 unused, 1-15 used
  const letters = ['A', 'B', 'C', 'D'];

  for (let qNum = 1; qNum <= 15; qNum++) {
    const currentQ = await getCurrentQuestionNumber(page);
    log(`Q${qNum}: On Q${currentQ}`);

    // If off by one (from existing session resume), we might need to handle it
    if (currentQ !== qNum && currentQ !== null) {
      log(`  Off by 1 — expected Q${qNum} but on Q${currentQ}. Will navigate.`);
    }

    await screenshot(page, `Q${String(qNum).padStart(2,'0')}_before`);

    // Get current answer state before selecting
    const priorState = await detectSelectedAnswer(page);
    log(`  Q${qNum} prior state: ${JSON.stringify(priorState)}`);

    // Select the planned answer
    const choiceIdx = answerPlan[qNum];
    const result = await selectAnswerByIndex(page, choiceIdx);
    await page.waitForTimeout(500);
    log(`  Q${qNum} selection result: ${JSON.stringify(result)}`);

    // Verify selection
    const postState = await detectSelectedAnswer(page);
    log(`  Q${qNum} post-select state: ${JSON.stringify(postState)}`);

    results.answers[qNum] = {
      planned: letters[choiceIdx],
      detectedAfterSelect: postState.selectedLetter,
      selectionResult: result,
    };

    await screenshot(page, `Q${String(qNum).padStart(2,'0')}_after`);

    // Move to next question (Q15 will show Review → instead of Next →)
    if (qNum < 15) {
      // Click Next →
      const nextBtn = page.locator('button').filter({ hasText: /^Next →$/ }).first();
      try {
        await nextBtn.waitFor({ timeout: 3000 });
        await nextBtn.click();
        await page.waitForTimeout(500);
      } catch {
        log(`  Q${qNum}: Next button not found, trying keyboard`);
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(500);
      }
    }
  }

  await screenshot(page, 'Q15_completed');
  log('Answered Q1-Q15');

  // Record planned answers for key questions
  log(`Key answers: Q2=${letters[answerPlan[2]]}, Q3=${letters[answerPlan[3]]}, Q7=${letters[answerPlan[7]]}, Q11=${letters[answerPlan[11]]}, Q14=${letters[answerPlan[14]]}`);

  // ============================================================
  // STEP 4: Navigate to Q3 via navigator, change answer C→A
  // ============================================================
  log('STEP 4: Navigate to Q3, change answer');
  const q3Original = letters[answerPlan[3]]; // C
  const q3New = letters[0]; // A (different from C=2)

  await navigateToQuestion(page, 3);
  await screenshot(page, 'Q03_after_nav');

  const q3CurrentQ = await getCurrentQuestionNumber(page);
  log(`On Q${q3CurrentQ} (expected Q3)`);
  const q3BeforeState = await detectSelectedAnswer(page);
  log(`Q3 before change: ${JSON.stringify(q3BeforeState)}`);

  // Change to A (index 0)
  await selectAnswerByIndex(page, 0);
  await page.waitForTimeout(500);
  const q3AfterState = await detectSelectedAnswer(page);
  log(`Q3 after change: ${JSON.stringify(q3AfterState)}`);
  results.answerChanges.push({ question: 3, from: q3Original, to: q3New, before: q3BeforeState, after: q3AfterState });
  results.answers[3].changed = q3New;
  results.answers[3].changedState = q3AfterState;

  await screenshot(page, 'Q03_after_change');

  // ============================================================
  // STEP 5: Navigate to Q11, change answer A→B
  // ============================================================
  log('STEP 5: Navigate to Q11, change answer');
  const q11Original = letters[answerPlan[11]]; // A
  const q11New = letters[1]; // B

  await navigateToQuestion(page, 11);
  await screenshot(page, 'Q11_after_nav');

  const q11CurrentQ = await getCurrentQuestionNumber(page);
  log(`On Q${q11CurrentQ} (expected Q11)`);
  const q11BeforeState = await detectSelectedAnswer(page);
  log(`Q11 before change: ${JSON.stringify(q11BeforeState)}`);

  // Change to B (index 1)
  await selectAnswerByIndex(page, 1);
  await page.waitForTimeout(500);
  const q11AfterState = await detectSelectedAnswer(page);
  log(`Q11 after change: ${JSON.stringify(q11AfterState)}`);
  results.answerChanges.push({ question: 11, from: q11Original, to: q11New, before: q11BeforeState, after: q11AfterState });
  results.answers[11].changed = q11New;
  results.answers[11].changedState = q11AfterState;

  await screenshot(page, 'Q11_after_change');

  // ============================================================
  // STEP 6: Navigate to Q7, look but don't change
  // ============================================================
  log('STEP 6: Navigate to Q7, observe only');

  await navigateToQuestion(page, 7);
  await page.waitForTimeout(800);
  await screenshot(page, 'Q07_visit_only');

  const q7CurrentQ = await getCurrentQuestionNumber(page);
  log(`On Q${q7CurrentQ} (expected Q7)`);
  const q7State = await detectSelectedAnswer(page);
  log(`Q7 state (should be ${letters[answerPlan[7]]}): ${JSON.stringify(q7State)}`);
  results.answers[7].visitedOnly = true;
  results.answers[7].stateOnVisit = q7State;

  // ============================================================
  // STEP 7: Open Review screen — verify all 15 answered
  // ============================================================
  log('STEP 7: Opening Review screen (first visit)');

  // Navigate to Q15 first to access Review →
  await navigateToQuestion(page, 15);
  await page.waitForTimeout(500);
  await screenshot(page, 'Q15_before_review');

  const reviewOpened1 = await openReviewScreen(page);
  log(`Review opened: ${reviewOpened1}`);
  await screenshot(page, 'REVIEW_01');

  const onReview1 = await isOnReviewScreen(page);
  const reviewData1 = await getReviewData(page);
  log(`On review screen: ${onReview1}`);
  log(`Review data (visit 1): ${JSON.stringify(reviewData1)}`);

  results.reviewVisits.push({
    visitNumber: 1,
    onReviewScreen: onReview1,
    reviewData: reviewData1,
    pass: reviewData1.answeredCount === 15 && reviewData1.totalCount === 15,
  });

  // Check for answer letter badges in review grid (B14C-002)
  const hasBadges1 = reviewData1.gridButtons.filter(b => /^[A-D]$/.test(b.num)).length > 0;
  results.findings.push({
    id: 'B14C-002',
    observation: 'Review grid answer letter badges',
    hasBadges: hasBadges1,
    detail: hasBadges1
      ? `Review grid shows answer letter badges`
      : `Review grid does NOT show answer letter badges — shows question numbers/flags only`,
    gridSample: reviewData1.gridButtons.slice(0, 5),
  });

  // ============================================================
  // STEP 8: Return to Questions, navigate to Q14, change answer D→C
  // ============================================================
  log('STEP 8: Return to Questions, navigate to Q14, change answer');

  const returnBtn1 = page.locator('button').filter({ hasText: /^Return to Questions$/ }).first();
  try {
    await returnBtn1.waitFor({ timeout: 5000 });

    // Record where we are before clicking
    log('Return to Questions button found — clicking');
    await returnBtn1.click();
    await page.waitForTimeout(1500);
  } catch {
    log('Return to Questions button not found with exact text, trying partial match');
    const returnBtnPartial = page.locator('button').filter({ hasText: /Return to Question/i }).first();
    try {
      await returnBtnPartial.click();
      await page.waitForTimeout(1500);
    } catch {
      log('ERROR: Could not find Return to Questions button');
    }
  }

  await screenshot(page, 'RETURN_TO_Q_01');

  // B14C-001: Record landing position
  const landingQ1 = await getCurrentQuestionNumber(page);
  const landingURL1 = page.url();
  log(`B14C-001 (return 1): Landed on Q${landingQ1}`);
  results.findings.push({
    id: 'B14C-001',
    returnNumber: 1,
    landedOnQuestion: landingQ1,
    expected: 'Q1, Q15, or last visited question (Q7)',
    note: 'Where does Return to Questions land the user?',
  });

  // Navigate to Q14
  await navigateToQuestion(page, 14);
  await screenshot(page, 'Q14_after_nav');

  const q14CurrentQ = await getCurrentQuestionNumber(page);
  log(`On Q${q14CurrentQ} (expected Q14)`);

  const q14Original = letters[answerPlan[14]]; // D
  const q14New = letters[2]; // C (different from D)
  const q14BeforeState = await detectSelectedAnswer(page);
  log(`Q14 before change: ${JSON.stringify(q14BeforeState)}`);

  // Change to C (index 2)
  await selectAnswerByIndex(page, 2);
  await page.waitForTimeout(500);
  const q14AfterState = await detectSelectedAnswer(page);
  log(`Q14 after change: ${JSON.stringify(q14AfterState)}`);
  results.answerChanges.push({ question: 14, from: q14Original, to: q14New, before: q14BeforeState, after: q14AfterState });
  results.answers[14].changed = q14New;
  results.answers[14].changedState = q14AfterState;

  await screenshot(page, 'Q14_after_change');

  // ============================================================
  // STEP 9: Return to Review (second visit) — verify all 15 still answered
  // ============================================================
  log('STEP 9: Opening Review screen (second visit)');

  await navigateToQuestion(page, 15);
  await page.waitForTimeout(500);
  const reviewOpened2 = await openReviewScreen(page);
  log(`Review opened (2): ${reviewOpened2}`);
  await screenshot(page, 'REVIEW_02');

  const onReview2 = await isOnReviewScreen(page);
  const reviewData2 = await getReviewData(page);
  log(`On review screen (2): ${onReview2}`);
  log(`Review data (visit 2): ${JSON.stringify(reviewData2)}`);

  results.reviewVisits.push({
    visitNumber: 2,
    onReviewScreen: onReview2,
    reviewData: reviewData2,
    pass: reviewData2.answeredCount === 15 && reviewData2.totalCount === 15,
  });

  // ============================================================
  // STEP 10: Return to Questions (2nd time), navigate to Q2, just look
  // ============================================================
  log('STEP 10: Return to Questions (2nd time), navigate to Q2, just observe');

  const returnBtn2 = page.locator('button').filter({ hasText: /^Return to Questions$/ }).first();
  try {
    await returnBtn2.waitFor({ timeout: 5000 });
    await returnBtn2.click();
    await page.waitForTimeout(1500);
  } catch {
    log('Return to Questions button not found (2nd)');
    const returnBtnPartial2 = page.locator('button').filter({ hasText: /Return to Question/i }).first();
    try {
      await returnBtnPartial2.click();
      await page.waitForTimeout(1500);
    } catch {
      log('ERROR: Could not find Return to Questions button (2nd)');
    }
  }

  await screenshot(page, 'RETURN_TO_Q_02');

  // B14C-001: Record landing position (2nd return)
  const landingQ2 = await getCurrentQuestionNumber(page);
  log(`B14C-001 (return 2): Landed on Q${landingQ2}`);
  results.findings.push({
    id: 'B14C-001-return2',
    returnNumber: 2,
    landedOnQuestion: landingQ2,
  });

  // Navigate to Q2, just look
  await navigateToQuestion(page, 2);
  await page.waitForTimeout(800);
  await screenshot(page, 'Q02_visit_only');

  const q2CurrentQ = await getCurrentQuestionNumber(page);
  log(`On Q${q2CurrentQ} (expected Q2)`);
  const q2State = await detectSelectedAnswer(page);
  log(`Q2 state (should still be ${letters[answerPlan[2]]}=B): ${JSON.stringify(q2State)}`);
  results.answers[2].visitedOnly = true;
  results.answers[2].stateOnVisit = q2State;

  // ============================================================
  // STEP 11: Return to Review (third visit) — verify all 15 still answered
  // ============================================================
  log('STEP 11: Opening Review screen (third visit)');

  await navigateToQuestion(page, 15);
  await page.waitForTimeout(500);
  const reviewOpened3 = await openReviewScreen(page);
  log(`Review opened (3): ${reviewOpened3}`);
  await screenshot(page, 'REVIEW_03');

  const onReview3 = await isOnReviewScreen(page);
  const reviewData3 = await getReviewData(page);
  log(`On review screen (3): ${onReview3}`);
  log(`Review data (visit 3): ${JSON.stringify(reviewData3)}`);

  results.reviewVisits.push({
    visitNumber: 3,
    onReviewScreen: onReview3,
    reviewData: reviewData3,
    pass: reviewData3.answeredCount === 15 && reviewData3.totalCount === 15,
  });

  // ============================================================
  // STEP 12: Submit Test
  // ============================================================
  log('STEP 12: Submit Test from review screen');

  // Find submit button on review screen
  const submitBtn = page.locator('button').filter({ hasText: /Submit Test|Submit Section/i }).first();
  try {
    await submitBtn.waitFor({ timeout: 5000 });
    await submitBtn.click();
    await page.waitForTimeout(3000);
    log('Clicked Submit button');
  } catch {
    log('ERROR: Submit button not found on review screen');
    await screenshot(page, 'SUBMIT_NOT_FOUND');
  }

  await screenshot(page, 'AFTER_SUBMIT_CLICK');
  const afterSubmitURL = page.url();
  log(`After submit: URL = ${afterSubmitURL}`);

  // Check if we landed on FRQ section or results
  const onFRQChoice = await page.locator('text=/FRQ|Free Response|Choose.*submission|Handwritten|Typed/i').count() > 0;
  const onResults = afterSubmitURL.includes('/results/');

  log(`On FRQ choice: ${onFRQChoice}, On results: ${onResults}`);

  if (onFRQChoice) {
    log('MCQ section submitted — now handling FRQ section');
    await screenshot(page, 'FRQ_CHOICE_SCREEN');

    // Select typed FRQ submission
    const typedBtn = page.locator('button').filter({ hasText: /^Type it|^Typed|Submit Typed|Type Your/i }).first();
    try {
      await typedBtn.waitFor({ timeout: 5000 });
      await typedBtn.click();
      await page.waitForTimeout(2000);
      log('Selected typed FRQ submission');
    } catch {
      // Try any button that's not "Handwritten"
      const anyFRQBtn = page.locator('button').filter({ hasText: /Type|Text/i }).first();
      try {
        await anyFRQBtn.click();
        await page.waitForTimeout(2000);
        log('Selected FRQ type via fallback');
      } catch {
        log('Could not select FRQ submission type');
      }
    }

    await screenshot(page, 'FRQ_TYPING_START');

    // Answer FRQ questions
    for (let frqAttempt = 0; frqAttempt < 10; frqAttempt++) {
      const currURL = page.url();
      if (currURL.includes('/results/')) {
        log('Reached results page');
        break;
      }

      // Type in any textarea
      const textarea = page.locator('textarea').first();
      const hasTA = await textarea.count() > 0;
      if (hasTA) {
        await textarea.fill('This is my answer to the FRQ question about economic principles and market structures.');
        await page.waitForTimeout(300);
      }

      // Try Next
      const nextBtn = page.locator('button').filter({ hasText: /^Next →$/ }).first();
      const hasNext = await nextBtn.count() > 0;
      if (hasNext) {
        const isEnabled = await nextBtn.isEnabled();
        if (isEnabled) {
          await nextBtn.click();
          await page.waitForTimeout(1000);
          continue;
        }
      }

      // Try Review → on FRQ
      const reviewFRQBtn = page.locator('button').filter({ hasText: /^Review →$/ }).first();
      const hasReviewFRQ = await reviewFRQBtn.count() > 0;
      if (hasReviewFRQ) {
        await reviewFRQBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, `FRQ_REVIEW_${frqAttempt}`);

        // Submit from FRQ review
        const finalSubmit = page.locator('button').filter({ hasText: /Submit Test/i }).first();
        const hasFinalSubmit = await finalSubmit.count() > 0;
        if (hasFinalSubmit) {
          await finalSubmit.click();
          await page.waitForTimeout(5000);
          log('Submitted FRQ section');
          break;
        }
      }

      break; // Safety break
    }
  }

  // Wait for results
  await page.waitForTimeout(3000);
  await screenshot(page, 'RESULTS_PAGE');
  const resultsURL = page.url();
  log(`Results URL: ${resultsURL}`);
  const isOnResults = resultsURL.includes('/results/');

  // ============================================================
  // STEP 13: Verify results page
  // ============================================================
  log('STEP 13: Verifying results');
  results.submittedSuccessfully = isOnResults;
  results.resultsURL = resultsURL;

  if (isOnResults) {
    await screenshot(page, 'RESULTS_FULL');

    // Get MCQ table data
    const reportData = await page.evaluate(() => {
      const data = {
        mcqScoreText: null,
        questionRows: [],
        headingText: null,
      };

      // Get overall score
      const allText = document.body.textContent || '';
      const scoreMatch = allText.match(/(\d+)\s*\/\s*(\d+)/);
      if (scoreMatch) data.mcqScoreText = scoreMatch[0];

      // Get report heading
      const h1 = document.querySelector('h1');
      data.headingText = h1?.textContent?.trim();

      // Get table rows
      const rows = document.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const cellTexts = Array.from(cells).map(c => (c.textContent || '').trim());
          const firstNum = parseInt(cellTexts[0]);
          if (firstNum >= 1 && firstNum <= 15) {
            data.questionRows.push({
              qNum: firstNum,
              cells: cellTexts,
            });
          }
        }
      });

      return data;
    });

    log(`Results data: ${JSON.stringify(reportData)}`);
    results.reportData = reportData;
    results.mcqScorePresent = !!reportData.mcqScoreText;

    // Verify Q3, Q11, Q14 show CHANGED answers, Q7 and Q2 show ORIGINAL answers
    const changeMap = {
      3: { expected: results.answerChanges[0]?.to, original: results.answerChanges[0]?.from, changed: true },
      11: { expected: results.answerChanges[1]?.to, original: results.answerChanges[1]?.from, changed: true },
      14: { expected: results.answerChanges[2]?.to, original: results.answerChanges[2]?.from, changed: true },
      7: { expected: letters[answerPlan[7]], original: letters[answerPlan[7]], changed: false },
      2: { expected: letters[answerPlan[2]], original: letters[answerPlan[2]], changed: false },
    };

    // Note: Report card may show "Your Answer" in a specific column
    // We'll record what we find and compare
    results.changeVerification = changeMap;
    results.questionRows = reportData.questionRows;

  } else {
    log('Not on results page after submit');
    results.submittedSuccessfully = false;
  }

  // ============================================================
  // Console errors summary
  // ============================================================
  results.consoleErrors = consoleErrors;
  results.completedAt = new Date().toISOString();

  // ============================================================
  // Summary of B14C-001 findings
  // ============================================================
  const returnLanding1 = results.findings.find(f => f.id === 'B14C-001');
  const returnLanding2 = results.findings.find(f => f.id === 'B14C-001-return2');
  log(`B14C-001: Return 1 landed on Q${returnLanding1?.landedOnQuestion}, Return 2 landed on Q${returnLanding2?.landedOnQuestion}`);

  saveResults();
  log('=== B14C-retest v3 COMPLETE ===');

  // Final assertion — test should have submitted
  expect(isOnResults, 'Should reach results page after submission').toBeTruthy();
});
