/**
 * B14C-retest v2: The Second-Guesser — FIX-6 verification
 * student6@apboost.test — Micro test (test_micro_full_1)
 *
 * Tests: Answer all 15, change Q3/Q11/Q14 via navigator, visit Q7/Q2 without changing.
 * Verifies: All answers persist correctly through multiple Review visits.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student6@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14C_retest_v2';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14c_retest_v2_results.json';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  scenarioId: 'B14C-retest-v2',
  startedAt: new Date().toISOString(),
  steps: [],
  answers: {},      // questionIndex -> letter chosen
  answerChanges: [], // {question, from, to}
  reviewVisits: [], // {visitNumber, answeredCount}
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

/**
 * Get the currently selected answer letter on the current question.
 * Returns null if none selected.
 */
async function getSelectedAnswer(page) {
  try {
    // Look for selected answer radio/button — typically marked with aria-checked or a selected class
    const selected = page.locator('[data-testid="answer-choice"].selected, [aria-checked="true"], input[type="radio"]:checked');
    const count = await selected.count();
    if (count > 0) {
      // Try to get the letter from the label or data attribute
      const el = selected.first();
      const label = await el.getAttribute('data-choice') || await el.getAttribute('value') || '';
      if (label) return label.toUpperCase();
    }
    // Alternative: look for answer option with visual selection indicator
    const answerOptions = page.locator('[data-testid="answer-option"], .answer-option, button[data-choice]');
    const optionCount = await answerOptions.count();
    for (let i = 0; i < optionCount; i++) {
      const opt = answerOptions.nth(i);
      const cls = await opt.getAttribute('class') || '';
      if (cls.includes('selected') || cls.includes('brand-primary') || cls.includes('bg-brand')) {
        const letter = await opt.getAttribute('data-choice') || String.fromCharCode(65 + i);
        return letter.toUpperCase();
      }
    }
  } catch {}
  return null;
}

/**
 * Get the current question number from the page header.
 */
async function getCurrentQuestionNumber(page) {
  try {
    const text = await page.locator('text=/Question \\d+ of/i').first().textContent({ timeout: 3000 });
    const match = text.match(/Question (\d+) of/i);
    if (match) return parseInt(match[1]);
  } catch {}
  return null;
}

/**
 * Select an answer choice by index (0=A, 1=B, 2=C, 3=D).
 * Returns the letter chosen.
 */
async function selectAnswer(page, choiceIndex) {
  // Wait for answer choices to be visible
  await page.waitForTimeout(500);

  // Try multiple selectors for answer choices
  const selectors = [
    'button[data-choice]',
    '[data-testid="answer-choice"]',
    '.answer-choice',
    // AnswerInput component likely renders radio-style buttons
    'button.answer-option',
  ];

  for (const sel of selectors) {
    const els = page.locator(sel);
    const count = await els.count();
    if (count > choiceIndex) {
      const el = els.nth(choiceIndex);
      const letter = await el.getAttribute('data-choice') || String.fromCharCode(65 + choiceIndex);
      await el.click();
      await page.waitForTimeout(300);
      return letter.toUpperCase();
    }
  }

  // Fallback: try clicking any clickable choice areas
  // AnswerInput renders choices with labels A, B, C, D
  const choiceLetters = ['A', 'B', 'C', 'D'];
  const letter = choiceLetters[choiceIndex];

  // Try text-based selection
  try {
    const byText = page.locator(`button, label`).filter({ hasText: new RegExp(`^${letter}[\\s\\.]`) }).first();
    if (await byText.isVisible({ timeout: 2000 })) {
      await byText.click();
      await page.waitForTimeout(300);
      return letter;
    }
  } catch {}

  return null;
}

/**
 * Get selected answer text/indicator from the current question.
 * Uses DOM evaluation since the exact class names vary.
 */
async function getAnswerState(page) {
  return await page.evaluate(() => {
    // Check for checked radio inputs
    const radios = document.querySelectorAll('input[type="radio"]:checked');
    if (radios.length > 0) {
      return { method: 'radio', value: radios[0].value };
    }

    // Check for buttons/divs with selected state (brand-primary background)
    const allBtns = document.querySelectorAll('button, div[role="radio"]');
    for (const btn of allBtns) {
      const cls = btn.className || '';
      if (cls.includes('bg-brand-primary') || cls.includes('ring-2') || cls.includes('selected')) {
        const text = btn.textContent?.trim() || '';
        return { method: 'class', value: text.substring(0, 50) };
      }
    }

    // Check data attributes
    const withData = document.querySelectorAll('[data-selected="true"], [aria-selected="true"], [aria-checked="true"]');
    if (withData.length > 0) {
      return { method: 'aria', value: withData[0].textContent?.trim()?.substring(0, 50) };
    }

    return null;
  });
}

/**
 * Click the Next button.
 */
async function clickNext(page) {
  const btn = page.locator('button').filter({ hasText: /Next →/ }).first();
  try {
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(500);
    return true;
  } catch {
    return false;
  }
}

/**
 * Navigate to a specific question via the navigator grid.
 * Returns true if navigation succeeded.
 */
async function navigateToQuestion(page, questionNumber) {
  log(`Navigating to Q${questionNumber} via navigator`);

  // Open the navigator
  const navBtn = page.locator('button').filter({ hasText: /Navigator|Questions|Grid/i }).first();
  try {
    await navBtn.waitFor({ timeout: 5000 });
    await navBtn.click();
    await page.waitForTimeout(500);
  } catch {
    // Try hamburger menu or other nav opener
    log(`Navigator button not found, trying hamburger menu`);
    const menuBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]').first();
    try {
      await menuBtn.click();
      await page.waitForTimeout(500);
      const goToQ = page.locator('button, a').filter({ hasText: /Go to Question/i }).first();
      await goToQ.click();
      await page.waitForTimeout(500);
    } catch {
      log(`Could not open navigator for Q${questionNumber}`);
      return false;
    }
  }

  // Look for the question number button in the grid
  // QuestionNavigator renders buttons with the question number
  await screenshot(page, `nav_open_for_Q${questionNumber}`);

  // Click the question number button
  const qBtn = page.locator(`button`).filter({ hasText: new RegExp(`^${questionNumber}$`) }).first();
  try {
    await qBtn.waitFor({ timeout: 5000 });
    await qBtn.click();
    await page.waitForTimeout(800);
    return true;
  } catch {
    // Try by index in the grid
    log(`Could not find Q${questionNumber} button, trying grid cell`);
    const gridCells = page.locator('[data-testid="nav-grid"] button, .question-grid button');
    const idx = questionNumber - 1;
    const count = await gridCells.count();
    if (count > idx) {
      await gridCells.nth(idx).click();
      await page.waitForTimeout(800);
      return true;
    }
    return false;
  }
}

/**
 * Count answered questions from the review screen grid.
 */
async function countAnsweredOnReview(page) {
  return await page.evaluate(() => {
    // Look for the review grid — bg-brand-primary indicates answered
    const answered = document.querySelectorAll('button.bg-brand-primary, button[class*="bg-brand-primary"]');
    // Also check for buttons with the brand-primary in their computed style
    let count = answered.length;
    if (count === 0) {
      // Try white text on blue background (answered state)
      const allBtns = document.querySelectorAll('button');
      for (const btn of allBtns) {
        const style = window.getComputedStyle(btn);
        const bg = style.backgroundColor;
        // bg-brand-primary is typically the brand blue
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          const text = btn.textContent?.trim() || '';
          if (/^\d+$/.test(text) || /^🚩$/.test(text)) {
            count++;
          }
        }
      }
    }
    return count;
  });
}

/**
 * Get the review screen summary text.
 */
async function getReviewSummary(page) {
  try {
    const summaryEl = page.locator('text=/Answered:/').first();
    const text = await summaryEl.textContent({ timeout: 3000 });
    return text;
  } catch {
    return null;
  }
}

/**
 * Detect what answer is currently selected using the AnswerInput structure.
 * Returns object with {selectedIndex, selectedLetter, allChoicesCount}
 */
async function detectSelectedAnswer(page) {
  return await page.evaluate(() => {
    const result = { selectedIndex: -1, selectedLetter: null, allChoicesCount: 0, method: 'none', rawInfo: '' };

    // Method 1: data-choice attribute on clicked elements
    const withDataChoice = document.querySelectorAll('[data-choice]');
    if (withDataChoice.length > 0) {
      result.allChoicesCount = withDataChoice.length;
      withDataChoice.forEach((el, i) => {
        const cls = el.className || '';
        if (cls.includes('bg-brand-primary') || cls.includes('ring') || cls.includes('selected') ||
            el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-checked') === 'true') {
          result.selectedIndex = i;
          result.selectedLetter = el.getAttribute('data-choice') || String.fromCharCode(65 + i);
          result.method = 'data-choice+class';
        }
      });
      if (result.selectedIndex >= 0) return result;
    }

    // Method 2: Look for answer buttons in the standard layout
    // AnswerInput renders choices as buttons with letter + content
    const answerArea = document.querySelector('[data-testid="answer-input"], .answer-input');
    if (answerArea) {
      const btns = answerArea.querySelectorAll('button');
      result.allChoicesCount = btns.length;
      btns.forEach((btn, i) => {
        const cls = btn.className || '';
        if (cls.includes('bg-brand-primary') || cls.includes('bg-brand')) {
          result.selectedIndex = i;
          result.selectedLetter = String.fromCharCode(65 + i);
          result.method = 'answer-area-button';
          result.rawInfo = btn.className?.substring(0, 80) || '';
        }
      });
      if (result.selectedIndex >= 0) return result;
    }

    // Method 3: Scan all buttons for brand-primary background that look like answer choices
    const allButtons = document.querySelectorAll('button');
    const answerButtons = [];
    allButtons.forEach(btn => {
      const cls = btn.className || '';
      // Answer choice buttons in apBoost typically have specific classes
      if (cls.includes('rounded') && cls.includes('border') && cls.includes('flex')) {
        const text = btn.textContent?.trim() || '';
        // Skip nav buttons (1-15), menu buttons, etc.
        if (text.length > 2 || /^[A-D]/.test(text)) {
          answerButtons.push(btn);
        }
      }
    });

    result.allChoicesCount = answerButtons.length;
    answerButtons.forEach((btn, i) => {
      const cls = btn.className || '';
      if (cls.includes('bg-brand-primary')) {
        result.selectedIndex = i;
        result.selectedLetter = String.fromCharCode(65 + i);
        result.method = 'brand-primary-scan';
        result.rawInfo = cls.substring(0, 100);
      }
    });

    return result;
  });
}

test.setTimeout(300000); // 5 minutes

test('B14C-retest v2: The Second-Guesser — answer persistence verification', async ({ page }) => {

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('net::ERR') && !text.includes('favicon')) {
        consoleErrors.push({ url: page.url(), msg: text, type: 'console-error' });
        log(`[CONSOLE ERROR] ${text.substring(0, 150)}`);
      }
    }
  });
  page.on('pageerror', err => {
    const msg = err.message;
    consoleErrors.push({ url: page.url(), msg, type: 'pageerror' });
    log(`[PAGE ERROR] ${msg.substring(0, 150)}`);
    // Check for the TDZ crash mentioned in the brief
    if (msg.includes('scheduleFlush') || msg.includes('Cannot access') || msg.includes('before initialization')) {
      results.findings.push({
        id: 'B14C-TDZ-CRASH',
        severity: 'Blocker',
        title: 'TDZ crash: scheduleFlush before initialization',
        detail: msg,
        action: 'STOP — report and do not proceed',
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

  // Wait for redirect
  try {
    await page.waitForURL(/\/ap/, { timeout: 20000 });
    log('Login succeeded — redirected to /ap');
  } catch {
    await screenshot(page, '01_login_failed');
    log('ERROR: Login did not redirect to /ap — checking page');
    const url = page.url();
    log(`Current URL: ${url}`);
    if (!url.includes('/ap')) {
      // Try /ap manually
      await page.goto('http://localhost:5173/ap');
      await page.waitForTimeout(3000);
    }
  }

  await screenshot(page, '01_after_login');

  // Check for TDZ crash immediately
  if (results.findings.some(f => f.id === 'B14C-TDZ-CRASH')) {
    log('TDZ crash detected — stopping as instructed');
    saveResults();
    return;
  }

  // ============================================================
  // STEP 2: Navigate to the Micro test
  // ============================================================
  log('STEP 2: Navigate to Micro test (test_micro_full_1)');

  // Go to /ap dashboard
  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(3000);
  await screenshot(page, '02_dashboard');

  // Check for TDZ crash
  if (results.findings.some(f => f.id === 'B14C-TDZ-CRASH')) {
    log('TDZ crash on dashboard — stopping');
    saveResults();
    return;
  }

  // Navigate directly to the test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(4000);
  await screenshot(page, '03_test_page');

  // Check for TDZ crash on test page load
  if (results.findings.some(f => f.id === 'B14C-TDZ-CRASH')) {
    log('TDZ crash on test page — stopping as instructed');
    saveResults();
    return;
  }

  const pageContent = await page.content();
  const hasTDZError = pageContent.includes('scheduleFlush') || pageContent.includes('Cannot access');
  if (hasTDZError) {
    results.findings.push({
      id: 'B14C-TDZ-CRASH',
      severity: 'Blocker',
      title: 'TDZ crash visible in page content',
      detail: 'Page content contains TDZ error text',
    });
    await screenshot(page, '03_tdz_crash');
    log('TDZ crash in page content — stopping');
    saveResults();
    return;
  }

  // Check if there's an existing in-progress session for student6
  // If so, we need to handle it
  const hasResumeBtn = await page.locator('button').filter({ hasText: /Resume|Continue/i }).count();
  if (hasResumeBtn > 0) {
    log('Found existing session — need to handle resume or start fresh');
    await screenshot(page, '03b_existing_session');
    // If there's a resume button, we might have a stale session. Let's document it.
    results.steps.push({ msg: 'EXISTING SESSION FOUND — student6 has prior in-progress test', time: new Date().toISOString() });
    // Click Resume to handle existing session state
    // We'll answer fresh by overriding as we go through questions
    const resumeBtn = page.locator('button').filter({ hasText: /Resume|Continue/i }).first();
    await resumeBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '03c_resumed_session');
  }

  // Check for instruction/begin screen
  const hasBeginBtn = await page.locator('button').filter({ hasText: /Begin Test|Start Test/i }).count();
  if (hasBeginBtn > 0) {
    log('Found Begin Test button — clicking to start');
    await page.locator('button').filter({ hasText: /Begin Test|Start Test/i }).first().click();
    await page.waitForTimeout(3000);
    await screenshot(page, '04_test_started');
  } else {
    log('No Begin Test button found — checking if already in test');
    await screenshot(page, '04_test_state');
  }

  // Check for TDZ crash after starting
  if (results.findings.some(f => f.id === 'B14C-TDZ-CRASH')) {
    log('TDZ crash after starting test — stopping');
    saveResults();
    return;
  }

  // Verify we're on the question page
  const qNumCheck = await getCurrentQuestionNumber(page);
  log(`Current question: ${qNumCheck}`);

  // ============================================================
  // STEP 3: Answer Q1-Q15 in order
  // ============================================================
  log('STEP 3: Answering Q1-Q15 in order');

  // Answer choices to use for each question (cycling A=0, B=1, C=2, D=3)
  // We'll pick based on question number for variety
  const answerPlan = {
    1: 0,  // A
    2: 1,  // B
    3: 2,  // C
    4: 0,  // A
    5: 3,  // D
    6: 1,  // B
    7: 0,  // A
    8: 2,  // C
    9: 1,  // B
    10: 3, // D
    11: 0, // A
    12: 2, // C
    13: 1, // B
    14: 3, // D
    15: 0, // A
  };
  const letters = ['A', 'B', 'C', 'D'];

  for (let qNum = 1; qNum <= 15; qNum++) {
    // Make sure we're on the right question
    const currentQ = await getCurrentQuestionNumber(page);
    log(`Q${qNum}: Currently at Q${currentQ}`);

    if (currentQ !== qNum) {
      log(`WARNING: Expected Q${qNum} but on Q${currentQ} — trying to navigate`);
    }

    await screenshot(page, `Q${qNum.toString().padStart(2,'0')}_before_answer`);

    // Get DOM info about answer choices
    const domInfo = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      const info = [];
      btns.forEach(btn => {
        const text = btn.textContent?.trim() || '';
        const cls = btn.className?.substring(0, 60) || '';
        if (text.length > 0 && text.length < 100) {
          info.push({ text: text.substring(0, 40), cls: cls.substring(0, 40) });
        }
      });
      return info.slice(0, 20); // First 20 buttons
    });
    log(`DOM buttons for Q${qNum}: ${JSON.stringify(domInfo.map(b => b.text).filter(t => t.length < 20))}`);

    // Try to select the planned answer
    const choiceIdx = answerPlan[qNum];
    const expectedLetter = letters[choiceIdx];

    // Try clicking by choice index — look for answer buttons
    // The AnswerInput component renders choices; we'll try several approaches
    let selected = null;

    // Approach 1: Find buttons that look like answer choices (not nav buttons)
    const answerBtnData = await page.evaluate((choiceIdx) => {
      // Answer choices in apBoost are typically rendered in the main content area
      // They should have letters A, B, C, D visible
      const letters = ['A', 'B', 'C', 'D'];

      // Look for elements containing answer choice letters
      const allBtns = document.querySelectorAll('button, div[role="button"]');
      const answerBtns = [];

      allBtns.forEach((btn, i) => {
        const text = btn.textContent?.trim() || '';
        const cls = btn.className || '';
        // Answer buttons typically start with a letter or have letter prefix
        // Skip navigation buttons (numbers 1-15, Next, Previous, etc.)
        if (text.match(/^[A-D][\s\.\)]/i) && !cls.includes('navigator')) {
          answerBtns.push({ index: i, text: text.substring(0, 60), cls: cls.substring(0, 60) });
        }
      });

      return { found: answerBtns.length, buttons: answerBtns };
    }, choiceIdx);

    log(`Q${qNum}: Found ${answerBtnData.found} answer-looking buttons`);

    if (answerBtnData.found > choiceIdx) {
      // Get all buttons in the page and find the answer choice buttons
      const allBtns = page.locator('button, div[role="button"]');
      const count = await allBtns.count();

      // Find buttons starting with A, B, C, D
      let answerChoicesFound = [];
      for (let i = 0; i < count; i++) {
        const btn = allBtns.nth(i);
        try {
          const text = await btn.textContent({ timeout: 500 });
          const trimmed = (text || '').trim();
          if (/^[A-D][\s\.\)]/i.test(trimmed)) {
            answerChoicesFound.push({ idx: i, text: trimmed.substring(0, 40) });
          }
        } catch {}
      }

      log(`Q${qNum}: Answer choices found: ${JSON.stringify(answerChoicesFound.map(a => a.text.substring(0,15)))}`);

      if (answerChoicesFound.length > choiceIdx) {
        const targetBtn = allBtns.nth(answerChoicesFound[choiceIdx].idx);
        await targetBtn.click();
        await page.waitForTimeout(400);
        selected = expectedLetter;
        log(`Q${qNum}: Clicked choice ${expectedLetter} (index ${choiceIdx})`);
      }
    }

    if (!selected) {
      // Fallback: try clicking by role and position in answer area
      // Look for the nth answer choice button in any container
      try {
        // Find all choices via keyboard-accessible elements
        const choices = page.locator('button').filter({ hasText: /^[A-D]/ });
        const choiceCount = await choices.count();
        log(`Q${qNum}: Fallback — found ${choiceCount} choices starting with A-D letter`);

        if (choiceCount > choiceIdx) {
          await choices.nth(choiceIdx).click();
          await page.waitForTimeout(400);
          selected = expectedLetter;
          log(`Q${qNum}: Fallback click succeeded for ${expectedLetter}`);
        }
      } catch (e) {
        log(`Q${qNum}: All selection attempts failed: ${e.message}`);
      }
    }

    // Verify selection
    await page.waitForTimeout(300);
    const selState = await detectSelectedAnswer(page);
    log(`Q${qNum}: Selection state: ${JSON.stringify(selState)}`);

    results.answers[qNum] = {
      planned: expectedLetter,
      detected: selState.selectedLetter || selected,
      state: selState,
    };

    await screenshot(page, `Q${qNum.toString().padStart(2,'0')}_after_answer`);

    // Navigate to next question (except Q15)
    if (qNum < 15) {
      const nextOk = await clickNext(page);
      if (!nextOk) {
        log(`Q${qNum}: Next button click failed — trying alternative`);
        // Try other next button patterns
        try {
          await page.locator('button').filter({ hasText: /Next/ }).first().click();
          await page.waitForTimeout(500);
        } catch {}
      }
    }

    await page.waitForTimeout(300);
  }

  // After Q15, take screenshot
  await screenshot(page, 'Q15_completed_all');
  log('Completed answering Q1-Q15');

  // ============================================================
  // STEP 4: Navigate back to Q3, change answer
  // ============================================================
  log('STEP 4: Navigate to Q3 via navigator, change answer');

  const q3Original = results.answers[3]?.detected || letters[answerPlan[3]];
  log(`Q3 original answer: ${q3Original}`);

  // Open navigator and go to Q3
  const navOk = await navigateToQuestion(page, 3);
  if (!navOk) {
    log('WARNING: Could not navigate to Q3 via navigator — trying other methods');
    // Try going back via Previous buttons
    // We should be on Q15, so need to go back 12 times
    for (let i = 0; i < 12; i++) {
      const prevBtn = page.locator('button').filter({ hasText: /← Prev|Previous/i }).first();
      try {
        await prevBtn.click();
        await page.waitForTimeout(300);
      } catch { break; }
    }
  }

  await screenshot(page, 'Q03_returned_to');

  const q3CurrentQ = await getCurrentQuestionNumber(page);
  log(`After navigation: on Q${q3CurrentQ}`);

  // Change to a different answer (Q3 was C=2, change to A=0)
  const q3NewChoiceIdx = answerPlan[3] === 0 ? 1 : 0; // change to different letter
  const q3NewLetter = letters[q3NewChoiceIdx];

  log(`Changing Q3: ${q3Original} -> ${q3NewLetter}`);

  // Click the new choice
  try {
    const choices = page.locator('button').filter({ hasText: /^[A-D]/ });
    const choiceCount = await choices.count();
    if (choiceCount > q3NewChoiceIdx) {
      await choices.nth(q3NewChoiceIdx).click();
      await page.waitForTimeout(500);
      log(`Q3: Clicked new choice ${q3NewLetter}`);
    }
  } catch (e) {
    log(`Q3: Could not change answer: ${e.message}`);
  }

  const q3PostState = await detectSelectedAnswer(page);
  log(`Q3 post-change state: ${JSON.stringify(q3PostState)}`);
  results.answerChanges.push({ question: 3, from: q3Original, to: q3NewLetter, detectedAfter: q3PostState });
  results.answers[3].changed = q3NewLetter;

  await screenshot(page, 'Q03_after_change');

  // ============================================================
  // STEP 5: Navigate to Q11, change answer
  // ============================================================
  log('STEP 5: Navigate to Q11 via navigator, change answer');

  const q11Original = results.answers[11]?.detected || letters[answerPlan[11]];
  log(`Q11 original: ${q11Original}`);

  const nav11Ok = await navigateToQuestion(page, 11);
  await screenshot(page, 'Q11_navigated_to');

  const q11NewChoiceIdx = answerPlan[11] === 0 ? 1 : 0;
  const q11NewLetter = letters[q11NewChoiceIdx];

  log(`Changing Q11: ${q11Original} -> ${q11NewLetter}`);

  try {
    const choices = page.locator('button').filter({ hasText: /^[A-D]/ });
    const choiceCount = await choices.count();
    if (choiceCount > q11NewChoiceIdx) {
      await choices.nth(q11NewChoiceIdx).click();
      await page.waitForTimeout(500);
      log(`Q11: Clicked new choice ${q11NewLetter}`);
    }
  } catch (e) {
    log(`Q11: Could not change answer: ${e.message}`);
  }

  const q11PostState = await detectSelectedAnswer(page);
  results.answerChanges.push({ question: 11, from: q11Original, to: q11NewLetter, detectedAfter: q11PostState });
  results.answers[11].changed = q11NewLetter;

  await screenshot(page, 'Q11_after_change');

  // ============================================================
  // STEP 6: Navigate to Q7, look but don't change
  // ============================================================
  log('STEP 6: Navigate to Q7, observe but do not change');

  const nav7Ok = await navigateToQuestion(page, 7);
  await page.waitForTimeout(1000);
  await screenshot(page, 'Q07_visited_no_change');

  const q7State = await detectSelectedAnswer(page);
  log(`Q7 state (should stay ${letters[answerPlan[7]]}): ${JSON.stringify(q7State)}`);
  results.answers[7].visitedOnly = true;
  results.answers[7].stateAfterVisit = q7State;

  // ============================================================
  // STEP 7: Open Review screen — verify all 15 answered
  // ============================================================
  log('STEP 7: Opening Review screen (first visit)');

  // Find and click "Review" button or navigate to review
  // In APTestSession, the review is triggered by a Review button
  // Look for it in the header/toolbar area or at end of question
  const reviewBtn = page.locator('button').filter({ hasText: /Review|Go to Review/i }).first();
  try {
    await reviewBtn.waitFor({ timeout: 5000 });
    await reviewBtn.click();
    await page.waitForTimeout(1500);
    log('Clicked Review button');
  } catch {
    log('Review button not found in toolbar — trying hamburger menu');
    // Try via hamburger menu
    const menuBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]').first();
    try {
      await menuBtn.click();
      await page.waitForTimeout(500);
      const goToReviewBtn = page.locator('button, a').filter({ hasText: /Review/i }).first();
      await goToReviewBtn.click();
      await page.waitForTimeout(1500);
      log('Opened Review via menu');
    } catch {
      log('Could not find Review button anywhere');
    }
  }

  await screenshot(page, 'REVIEW_01_first_visit');

  // Verify we're on the review screen
  const isOnReview = await page.locator('text=/Review Your Answers/i').count() > 0;
  log(`On review screen: ${isOnReview}`);

  // Get the summary text
  const reviewSummary1 = await getReviewSummary(page);
  log(`Review summary (visit 1): ${reviewSummary1}`);

  // Count answered questions from grid
  const answeredCount1 = await page.evaluate(() => {
    // Look at the summary text
    const summaryEl = document.querySelector('li, p, span');
    const allText = document.body.textContent || '';
    const match = allText.match(/Answered:\s*(\d+)\/(\d+)/);
    if (match) return { answered: parseInt(match[1]), total: parseInt(match[2]) };
    return null;
  });
  log(`Answered count from summary (visit 1): ${JSON.stringify(answeredCount1)}`);

  // Also check the grid directly
  const gridInfo1 = await page.evaluate(() => {
    // Count blue-background buttons in the grid (answered questions)
    const allBtns = document.querySelectorAll('button');
    let answeredBtns = 0;
    let totalGridBtns = 0;

    allBtns.forEach(btn => {
      const text = (btn.textContent || '').trim();
      const cls = btn.className || '';
      // Grid buttons are either numbered or flagged
      if (/^(\d+|🚩)$/.test(text)) {
        totalGridBtns++;
        if (cls.includes('bg-brand-primary') || cls.includes('text-white')) {
          answeredBtns++;
        }
      }
    });

    return { answeredBtns, totalGridBtns };
  });
  log(`Grid info (visit 1): ${JSON.stringify(gridInfo1)}`);

  results.reviewVisits.push({
    visitNumber: 1,
    summary: reviewSummary1,
    gridInfo: gridInfo1,
    answeredFromSummary: answeredCount1,
  });

  // Check for review grid answer badges
  const hasBadges = await page.evaluate(() => {
    // Look for any letters (A/B/C/D) inside the grid boxes
    const allBtns = document.querySelectorAll('button');
    const badges = [];
    allBtns.forEach(btn => {
      const text = (btn.textContent || '').trim();
      if (/^[A-D]$/.test(text)) {
        badges.push(text);
      }
    });
    return badges;
  });
  results.findings.push({
    id: 'B14C-002',
    observation: 'Review grid answer letter badges',
    hasBadges: hasBadges.length > 0,
    badges: hasBadges,
    detail: hasBadges.length > 0
      ? `Review grid shows answer letter badges: ${hasBadges.join(', ')}`
      : 'Review grid does NOT show answer letter badges — boxes only show number or flag emoji',
  });
  log(`B14C-002: Review grid badges: ${JSON.stringify(hasBadges)}`);

  // ============================================================
  // STEP 8: Click "Return to Questions", navigate to Q14, change answer
  // ============================================================
  log('STEP 8: Click Return to Questions, navigate to Q14, change answer');

  const returnBtn1 = page.locator('button').filter({ hasText: /Return to Questions/i }).first();
  try {
    await returnBtn1.waitFor({ timeout: 5000 });
    await returnBtn1.click();
    await page.waitForTimeout(1500);
    log('Clicked Return to Questions (1st time)');
  } catch {
    log('ERROR: Could not find Return to Questions button');
  }

  await screenshot(page, 'RETURN_TO_QUESTIONS_01');

  // Observe where we land (B14C-001)
  const landingQ1 = await getCurrentQuestionNumber(page);
  const landingURL1 = page.url();
  log(`B14C-001 (first return): Landed on Q${landingQ1}, URL: ${landingURL1}`);
  results.findings.push({
    id: 'B14C-001-return1',
    observation: 'Return to Questions landing position (1st return)',
    landedOnQuestion: landingQ1,
    url: landingURL1,
  });

  // Navigate to Q14
  const nav14Ok = await navigateToQuestion(page, 14);
  await screenshot(page, 'Q14_navigated_to');

  const q14CurrentQ = await getCurrentQuestionNumber(page);
  log(`After navigation: on Q${q14CurrentQ}`);

  const q14Original = results.answers[14]?.detected || letters[answerPlan[14]];
  const q14NewChoiceIdx = answerPlan[14] === 0 ? 1 : 2; // change to a different letter
  const q14NewLetter = letters[q14NewChoiceIdx];

  log(`Changing Q14: ${q14Original} -> ${q14NewLetter}`);

  try {
    const choices = page.locator('button').filter({ hasText: /^[A-D]/ });
    const choiceCount = await choices.count();
    if (choiceCount > q14NewChoiceIdx) {
      await choices.nth(q14NewChoiceIdx).click();
      await page.waitForTimeout(500);
      log(`Q14: Clicked new choice ${q14NewLetter}`);
    }
  } catch (e) {
    log(`Q14: Could not change answer: ${e.message}`);
  }

  const q14PostState = await detectSelectedAnswer(page);
  results.answerChanges.push({ question: 14, from: q14Original, to: q14NewLetter, detectedAfter: q14PostState });
  results.answers[14].changed = q14NewLetter;

  await screenshot(page, 'Q14_after_change');

  // ============================================================
  // STEP 9: Return to Review again — verify all 15 still answered
  // ============================================================
  log('STEP 9: Return to Review (second visit)');

  const reviewBtn2 = page.locator('button').filter({ hasText: /Review|Go to Review/i }).first();
  try {
    await reviewBtn2.waitFor({ timeout: 5000 });
    await reviewBtn2.click();
    await page.waitForTimeout(1500);
    log('Clicked Review button (2nd time)');
  } catch {
    log('Review button not found — trying menu');
    try {
      const menuBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]').first();
      await menuBtn.click();
      await page.waitForTimeout(500);
      await page.locator('button, a').filter({ hasText: /Review/i }).first().click();
      await page.waitForTimeout(1500);
    } catch {
      log('Could not open Review second time');
    }
  }

  await screenshot(page, 'REVIEW_02_second_visit');

  const isOnReview2 = await page.locator('text=/Review Your Answers/i').count() > 0;
  log(`On review screen (visit 2): ${isOnReview2}`);

  const reviewSummary2 = await getReviewSummary(page);
  log(`Review summary (visit 2): ${reviewSummary2}`);

  const gridInfo2 = await page.evaluate(() => {
    const allBtns = document.querySelectorAll('button');
    let answeredBtns = 0;
    let totalGridBtns = 0;

    allBtns.forEach(btn => {
      const text = (btn.textContent || '').trim();
      const cls = btn.className || '';
      if (/^(\d+|🚩)$/.test(text)) {
        totalGridBtns++;
        if (cls.includes('bg-brand-primary') || cls.includes('text-white')) {
          answeredBtns++;
        }
      }
    });

    return { answeredBtns, totalGridBtns };
  });
  log(`Grid info (visit 2): ${JSON.stringify(gridInfo2)}`);

  results.reviewVisits.push({
    visitNumber: 2,
    summary: reviewSummary2,
    gridInfo: gridInfo2,
  });

  // ============================================================
  // STEP 10: Return to Questions again, navigate to Q2, just look
  // ============================================================
  log('STEP 10: Return to Questions (2nd time), navigate to Q2, just look');

  const returnBtn2 = page.locator('button').filter({ hasText: /Return to Questions/i }).first();
  try {
    await returnBtn2.waitFor({ timeout: 5000 });
    await returnBtn2.click();
    await page.waitForTimeout(1500);
    log('Clicked Return to Questions (2nd time)');
  } catch {
    log('ERROR: Could not find Return to Questions button (2nd time)');
  }

  await screenshot(page, 'RETURN_TO_QUESTIONS_02');

  // Observe where we land (B14C-001)
  const landingQ2 = await getCurrentQuestionNumber(page);
  const landingURL2 = page.url();
  log(`B14C-001 (second return): Landed on Q${landingQ2}, URL: ${landingURL2}`);
  results.findings.push({
    id: 'B14C-001-return2',
    observation: 'Return to Questions landing position (2nd return)',
    landedOnQuestion: landingQ2,
    url: landingURL2,
  });

  // Navigate to Q2, just look
  const nav2Ok = await navigateToQuestion(page, 2);
  await screenshot(page, 'Q02_visited_no_change');

  const q2State = await detectSelectedAnswer(page);
  log(`Q2 state (should stay ${letters[answerPlan[2]]}): ${JSON.stringify(q2State)}`);
  results.answers[2].visitedOnly = true;
  results.answers[2].stateAfterVisit = q2State;

  // ============================================================
  // STEP 11: Return to Review third time — verify all 15 still answered
  // ============================================================
  log('STEP 11: Return to Review (third visit)');

  const reviewBtn3 = page.locator('button').filter({ hasText: /Review|Go to Review/i }).first();
  try {
    await reviewBtn3.waitFor({ timeout: 5000 });
    await reviewBtn3.click();
    await page.waitForTimeout(1500);
    log('Clicked Review button (3rd time)');
  } catch {
    log('Review button not found — trying menu (3rd time)');
    try {
      const menuBtn = page.locator('button[aria-label*="menu"], button[aria-label*="Menu"]').first();
      await menuBtn.click();
      await page.waitForTimeout(500);
      await page.locator('button, a').filter({ hasText: /Review/i }).first().click();
      await page.waitForTimeout(1500);
    } catch {
      log('Could not open Review third time');
    }
  }

  await screenshot(page, 'REVIEW_03_third_visit');

  const isOnReview3 = await page.locator('text=/Review Your Answers/i').count() > 0;
  log(`On review screen (visit 3): ${isOnReview3}`);

  const reviewSummary3 = await getReviewSummary(page);
  log(`Review summary (visit 3): ${reviewSummary3}`);

  const gridInfo3 = await page.evaluate(() => {
    const allBtns = document.querySelectorAll('button');
    let answeredBtns = 0;
    let totalGridBtns = 0;

    allBtns.forEach(btn => {
      const text = (btn.textContent || '').trim();
      const cls = btn.className || '';
      if (/^(\d+|🚩)$/.test(text)) {
        totalGridBtns++;
        if (cls.includes('bg-brand-primary') || cls.includes('text-white')) {
          answeredBtns++;
        }
      }
    });

    return { answeredBtns, totalGridBtns };
  });
  log(`Grid info (visit 3): ${JSON.stringify(gridInfo3)}`);

  results.reviewVisits.push({
    visitNumber: 3,
    summary: reviewSummary3,
    gridInfo: gridInfo3,
  });

  // ============================================================
  // STEP 12: Click Submit Test
  // ============================================================
  log('STEP 12: Submit Test from Review screen');

  const submitBtn = page.locator('button').filter({ hasText: /Submit Test|Submit Section/i }).first();
  try {
    await submitBtn.waitFor({ timeout: 5000 });
    await submitBtn.click();
    await page.waitForTimeout(2000);
    log('Clicked Submit button');
  } catch {
    log('ERROR: Could not find Submit button');
  }

  // Wait for navigation to results or FRQ section
  await page.waitForTimeout(3000);
  await screenshot(page, 'AFTER_SUBMIT');

  const postSubmitURL = page.url();
  log(`After submit: URL = ${postSubmitURL}`);

  // Check if this was a section submit (2-section test) or final submit
  const isFRQChoice = await page.locator('text=/FRQ|Free Response|Choose/i').count() > 0;
  const isResults = postSubmitURL.includes('/results/');

  log(`Is FRQ choice screen: ${isFRQChoice}, Is results: ${isResults}`);

  if (isFRQChoice) {
    log('MCQ section submitted, now on FRQ choice screen. Submitting FRQ...');
    await screenshot(page, 'FRQ_CHOICE');

    // Choose typed submission
    const typedBtn = page.locator('button').filter({ hasText: /Type|Typed/i }).first();
    try {
      await typedBtn.click();
      await page.waitForTimeout(2000);
      log('Selected typed FRQ submission');
    } catch {
      // Try clicking any choice button
      const firstChoice = page.locator('button').filter({ hasText: /FRQ|Type|Written|Text/i }).first();
      try {
        await firstChoice.click();
        await page.waitForTimeout(2000);
      } catch {
        log('Could not select FRQ type');
      }
    }

    await screenshot(page, 'FRQ_STARTED');

    // Answer FRQ questions (type something for each)
    const maxFRQAttempts = 15; // Safety limit
    let frqAttempt = 0;

    while (frqAttempt < maxFRQAttempts) {
      frqAttempt++;
      const frqURL = page.url();

      // Check for FRQ textarea
      const textarea = page.locator('textarea').first();
      const hasTextarea = await textarea.count() > 0;

      if (hasTextarea) {
        await textarea.fill('This is my response to this FRQ question about the AP exam topic.');
        await page.waitForTimeout(300);
        log(`FRQ attempt ${frqAttempt}: typed response`);
      }

      // Try to go to next FRQ question
      const nextFRQBtn = page.locator('button').filter({ hasText: /Next →/ }).first();
      const hasNext = await nextFRQBtn.count() > 0 && await nextFRQBtn.isEnabled();

      if (hasNext) {
        await nextFRQBtn.click();
        await page.waitForTimeout(1000);
      } else {
        // Look for Review/Submit for FRQ
        const frqReviewBtn = page.locator('button').filter({ hasText: /Review|Submit/i }).first();
        const hasFRQReview = await frqReviewBtn.count() > 0;

        if (hasFRQReview) {
          await frqReviewBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, `FRQ_REVIEW_${frqAttempt}`);

          // On FRQ review, click submit
          const finalSubmitBtn = page.locator('button').filter({ hasText: /Submit Test/i }).first();
          const hasFinalSubmit = await finalSubmitBtn.count() > 0;

          if (hasFinalSubmit) {
            await finalSubmitBtn.click();
            await page.waitForTimeout(4000);
            log('Submitted FRQ section');
            break;
          }
        }
        break;
      }

      // Check if we've reached results
      const currentURL = page.url();
      if (currentURL.includes('/results/')) {
        log('Reached results page');
        break;
      }
    }
  }

  // Wait for results page
  await page.waitForTimeout(3000);
  await screenshot(page, 'RESULTS_PAGE');

  const resultsURL = page.url();
  log(`Results URL: ${resultsURL}`);

  const isOnResults = resultsURL.includes('/results/');
  log(`On results page: ${isOnResults}`);

  // ============================================================
  // STEP 13: Verify results page content
  // ============================================================
  log('STEP 13: Verifying results page');

  if (isOnResults) {
    await screenshot(page, 'RESULTS_FULL');

    // Check MCQ score is present
    const mcqScoreText = await page.evaluate(() => {
      const allText = document.body.textContent || '';
      const match = allText.match(/(\d+)\s*\/\s*(\d+)/);
      return match ? match[0] : null;
    });
    log(`MCQ score text: ${mcqScoreText}`);
    results.mcqScorePresent = !!mcqScoreText;
    results.mcqScoreText = mcqScoreText;

    // Try to find the MCQ table with per-question answers
    const tableContent = await page.evaluate(() => {
      const tables = document.querySelectorAll('table, [role="table"]');
      const rows = document.querySelectorAll('tr, [role="row"]');
      const rowData = [];

      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th, [role="cell"], [role="columnheader"]');
        if (cells.length > 0) {
          const rowText = Array.from(cells).map(c => c.textContent?.trim() || '').join(' | ');
          if (rowText.trim()) rowData.push(rowText);
        }
      });

      return rowData.slice(0, 20); // First 20 rows
    });
    log(`Table rows: ${JSON.stringify(tableContent.slice(0, 10))}`);
    results.reportTableContent = tableContent;

    // Specifically look for Q3, Q11, Q14 answer entries in the table
    const questionAnswers = await page.evaluate(() => {
      const allText = document.body.textContent || '';
      const result = {};

      // Look for patterns like "Q3" or "3" followed by answer
      const rows = document.querySelectorAll('tr');
      rows.forEach((row, i) => {
        const text = row.textContent?.trim() || '';
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const firstCell = cells[0].textContent?.trim() || '';
          const secondCell = cells[1].textContent?.trim() || '';
          const thirdCell = cells[2]?.textContent?.trim() || '';

          const rowNum = parseInt(firstCell);
          if (rowNum >= 1 && rowNum <= 15) {
            result[rowNum] = {
              row: text.substring(0, 100),
              qNum: rowNum,
              yourAnswer: thirdCell || secondCell,
              cellTexts: Array.from(cells).map(c => c.textContent?.trim()).slice(0, 5),
            };
          }
        }
      });

      return result;
    });
    log(`Question answers from report: ${JSON.stringify(questionAnswers)}`);
    results.reportQuestionAnswers = questionAnswers;

  } else {
    log('Not on results page yet — taking screenshot of current state');
    await screenshot(page, 'NOT_ON_RESULTS');
    results.notOnResults = true;
  }

  // ============================================================
  // Collect console errors
  // ============================================================
  results.consoleErrors = consoleErrors;

  // ============================================================
  // B14C-001 Consolidation
  // ============================================================
  const b14c001Findings = results.findings.filter(f => f.id?.startsWith('B14C-001'));
  const returnLandings = b14c001Findings.map(f => f.landedOnQuestion);
  log(`B14C-001 Summary: Return to Questions landed on: ${JSON.stringify(returnLandings)}`);

  results.findings.push({
    id: 'B14C-001-summary',
    title: 'Return to Questions landing behavior',
    description: `Return to Questions button lands on: ${returnLandings.join(', ')} (from ${b14c001Findings.map(f => f.observation).join('; ')})`,
    returnLandings,
  });

  // Final save
  results.completedAt = new Date().toISOString();
  saveResults();

  log('=== B14C-retest v2 COMPLETE ===');
  log(`Answer changes made: Q3 (${results.answerChanges[0]?.from}→${results.answerChanges[0]?.to}), Q11 (${results.answerChanges[1]?.from}→${results.answerChanges[1]?.to}), Q14 (${results.answerChanges[2]?.from}→${results.answerChanges[2]?.to})`);
  log(`Review visits: ${results.reviewVisits.length}`);
  log(`Console errors: ${consoleErrors.length}`);

  // Assert test submitted successfully
  expect(isOnResults || resultsURL.includes('/results/')).toBeTruthy();
});
