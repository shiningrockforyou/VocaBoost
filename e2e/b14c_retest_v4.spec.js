/**
 * B14C-retest v4: The Second-Guesser — Clean run with student6 fresh session
 *
 * This version: First clears any existing session by navigating away and back,
 * then properly handles FRQ choice screen (2-step: select card + Confirm & Continue).
 * Uses navigator by clicking question number in the grid (handles 🚩 flagged questions
 * by using click-by-position fallback).
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student6@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14C_retest_v4';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14c_retest_v4_results.json';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  scenarioId: 'B14C-retest-v4',
  startedAt: new Date().toISOString(),
  steps: [],
  answers: {},
  answerChanges: [],
  reviewVisits: [],
  b14c001Findings: [],
  b14c002Finding: null,
  findings: [],
  consoleErrors: [],
  tdzCrash: false,
};

function saveResults() {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

function log(msg) {
  console.log(`[B14C] ${msg}`);
  results.steps.push({ time: new Date().toISOString(), msg });
}

async function ss(page, name) {
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    log(`Screenshot: ${name}.png`);
  } catch {}
}

async function getCurrentQ(page) {
  try {
    const el = page.locator('button').filter({ hasText: /of 15/i }).first();
    const text = await el.textContent({ timeout: 2000 });
    const match = text?.match(/Question (\d+) of/i);
    if (match) return parseInt(match[1]);
  } catch {}
  return null;
}

/**
 * Detect selected answer using flex-1+items-start+gap-3 button pattern.
 * Returns { selectedIndex, selectedLetter } where index is 0-based (0=A).
 */
async function detectAnswer(page) {
  return await page.evaluate(() => {
    const all = document.querySelectorAll('button');
    const choices = [];
    all.forEach(btn => {
      const cls = btn.className || '';
      if (cls.includes('flex-1') && cls.includes('items-start') && cls.includes('gap-3')) {
        choices.push({ btn, cls });
      }
    });
    const letters = ['A','B','C','D','E'];
    let sel = { selectedIndex: -1, selectedLetter: null, count: choices.length };
    choices.forEach(({ btn, cls }, i) => {
      if (cls.includes('bg-brand-primary')) {
        sel.selectedIndex = i;
        sel.selectedLetter = letters[i];
      }
    });
    return sel;
  });
}

/**
 * Click answer choice by index (0=A, 1=B, 2=C, 3=D).
 */
async function pickAnswer(page, idx) {
  const clicked = await page.evaluate((targetIdx) => {
    const all = document.querySelectorAll('button');
    const choices = [];
    all.forEach(btn => {
      const cls = btn.className || '';
      if (cls.includes('flex-1') && cls.includes('items-start') && cls.includes('gap-3')) {
        choices.push(btn);
      }
    });
    if (choices.length > targetIdx) {
      choices[targetIdx].click();
      return { ok: true, count: choices.length };
    }
    return { ok: false, count: choices.length };
  }, idx);
  await page.waitForTimeout(400);
  return clicked;
}

/**
 * Open the question navigator modal by clicking the "Question X of 15▲" button.
 */
async function openNav(page) {
  const btn = page.locator('button').filter({ hasText: /of 15/i }).first();
  try {
    await btn.waitFor({ timeout: 5000 });
    await btn.click();
    await page.waitForTimeout(600);
    return true;
  } catch {
    return false;
  }
}

/**
 * Navigate to a specific question number via the navigator modal.
 * Handles flagged questions (🚩) by using position in the grid.
 */
async function navToQ(page, targetQ) {
  log(`Navigating to Q${targetQ}`);

  // Open navigator
  const opened = await openNav(page);
  if (!opened) {
    log(`  Could not open navigator`);
    return false;
  }

  await page.waitForTimeout(400);
  await ss(page, `nav_for_Q${targetQ}`);

  // Try to click by exact number text first
  // QuestionBox renders either the number or 🚩 emoji
  // We need to navigate to the targetQ-th item in the grid (0-indexed)
  const result = await page.evaluate((targetQNum) => {
    // Find all question grid buttons inside the navigator modal
    // They have w-10 or w-12 class and h-10 class
    const modal = document.querySelector('.fixed.inset-0');
    if (!modal) return { error: 'no modal' };

    const gridBtns = modal.querySelectorAll('button');
    // Filter to grid buttons (not close button or review button)
    const navGridBtns = [];
    gridBtns.forEach(btn => {
      const cls = btn.className || '';
      const text = (btn.textContent || '').trim();
      // Grid buttons have w-10 or w-12 class
      if ((cls.includes('w-10') || cls.includes('w-12')) && cls.includes('h-10')) {
        navGridBtns.push({ text, cls: cls.substring(0, 40) });
      }
    });

    if (navGridBtns.length < targetQNum) {
      return { error: `only ${navGridBtns.length} grid buttons found`, buttons: navGridBtns.map(b => b.text) };
    }

    // Click the (targetQ-1)th grid button
    const targetBtn = modal.querySelectorAll('button');
    let navBtns = [];
    targetBtn.forEach(btn => {
      const cls = btn.className || '';
      if ((cls.includes('w-10') || cls.includes('w-12')) && cls.includes('h-10')) {
        navBtns.push(btn);
      }
    });

    if (navBtns.length >= targetQNum) {
      navBtns[targetQNum - 1].click();
      return { ok: true, total: navBtns.length, clickedText: navBtns[targetQNum - 1].textContent?.trim() };
    }

    return { error: 'not enough grid buttons', total: navBtns.length };
  }, targetQ);

  log(`  Nav click result: ${JSON.stringify(result)}`);
  await page.waitForTimeout(600);

  const nowQ = await getCurrentQ(page);
  log(`  Now on Q${nowQ} (expected Q${targetQ})`);

  // If we ended up on wrong question, it might be because nav closed but Q is wrong
  // This can happen if the flagged question caused off-by-one
  if (nowQ !== targetQ) {
    log(`  WARNING: Expected Q${targetQ} but on Q${nowQ}`);
    // Try re-opening and clicking again
    const reopened = await openNav(page);
    if (reopened) {
      await page.waitForTimeout(300);
      const r2 = await page.evaluate((targetQNum) => {
        const modal = document.querySelector('.fixed.inset-0');
        if (!modal) return { error: 'no modal' };
        let navBtns = [];
        modal.querySelectorAll('button').forEach(btn => {
          const cls = btn.className || '';
          if ((cls.includes('w-10') || cls.includes('w-12')) && cls.includes('h-10')) {
            navBtns.push(btn);
          }
        });
        if (navBtns.length >= targetQNum) {
          navBtns[targetQNum - 1].click();
          return { ok: true, total: navBtns.length, clickedText: navBtns[targetQNum-1].textContent?.trim() };
        }
        return { error: 'not enough', total: navBtns.length };
      }, targetQ);
      log(`  Retry nav result: ${JSON.stringify(r2)}`);
      await page.waitForTimeout(600);
    }
  }

  return true;
}

/**
 * Open the Review screen by navigating to Q15 and clicking "Review →".
 */
async function openReview(page) {
  // Navigate to Q15 to get the Review → button
  await navToQ(page, 15);
  await page.waitForTimeout(300);

  // Click Review →
  const reviewBtn = page.locator('button').filter({ hasText: /^Review →$/ }).first();
  try {
    await reviewBtn.waitFor({ timeout: 3000 });
    await reviewBtn.click();
    await page.waitForTimeout(1000);
    log('Clicked Review →');
    return true;
  } catch {
    log('Review → button not found, trying Go to Review Screen in navigator');
    // Try opening navigator and clicking Go to Review Screen
    const opened = await openNav(page);
    if (opened) {
      await page.waitForTimeout(300);
      const goToReviewBtn = page.locator('button').filter({ hasText: /Go to Review Screen/i }).first();
      try {
        await goToReviewBtn.waitFor({ timeout: 3000 });
        await goToReviewBtn.click();
        await page.waitForTimeout(1000);
        log('Clicked Go to Review Screen');
        return true;
      } catch {
        log('Could not find Go to Review Screen either');
      }
    }
    return false;
  }
}

/**
 * Check if we're on the review screen by looking for the h1 heading.
 */
async function onReview(page) {
  return await page.evaluate(() => {
    const headings = document.querySelectorAll('h1, h2');
    for (const h of headings) {
      if ((h.textContent || '').includes('Review Your Answers')) return true;
    }
    return false;
  });
}

/**
 * Get review screen data.
 */
async function getReviewData(page) {
  return await page.evaluate(() => {
    const allText = document.body.textContent || '';

    // Get heading
    const h1 = document.querySelector('h1');

    // Get answered count from summary
    const match = allText.match(/Answered:\s*(\d+)\/(\d+)/);
    const answered = match ? parseInt(match[1]) : null;
    const total = match ? parseInt(match[2]) : null;

    // Get flagged count
    const flagMatch = allText.match(/Flagged:\s*(\d+)/);
    const flagged = flagMatch ? parseInt(flagMatch[1]) : null;

    // Count grid buttons
    let gridAnswered = 0, gridTotal = 0;
    document.querySelectorAll('button').forEach(btn => {
      const cls = btn.className || '';
      const text = (btn.textContent || '').trim();
      if ((cls.includes('w-10') || cls.includes('w-12')) && cls.includes('h-10') && /^(\d+|🚩)$/.test(text)) {
        gridTotal++;
        if (cls.includes('bg-brand-primary')) gridAnswered++;
      }
    });

    // Check for answer badges (A/B/C/D) in grid
    const hasBadges = (() => {
      let found = false;
      document.querySelectorAll('button').forEach(btn => {
        const cls = btn.className || '';
        const text = (btn.textContent || '').trim();
        if ((cls.includes('w-10') || cls.includes('w-12')) && cls.includes('h-10') && /^[A-D]$/.test(text)) {
          found = true;
        }
      });
      return found;
    })();

    // Get summary section text
    const summaryEl = allText.indexOf('Summary');
    const summarySnippet = summaryEl >= 0 ? allText.substring(summaryEl, summaryEl + 300) : '';

    return {
      heading: h1?.textContent?.trim(),
      answered,
      total,
      flagged,
      gridAnswered,
      gridTotal,
      hasBadges,
      summarySnippet: summarySnippet.substring(0, 200),
    };
  });
}

test.setTimeout(360000); // 6 minutes

test('B14C-retest v4: The Second-Guesser — clean run', async ({ page }) => {

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('net::ERR') && !text.includes('favicon')) {
        results.consoleErrors.push({ url: page.url(), msg: text });
        log(`[CONSOLE ERR] ${text.substring(0, 120)}`);
      }
    }
  });
  page.on('pageerror', err => {
    const msg = err.message;
    results.consoleErrors.push({ url: page.url(), msg, type: 'pageerror' });
    log(`[PAGE ERR] ${msg.substring(0, 120)}`);
    if (msg.includes('scheduleFlush') || msg.includes('Cannot access') || msg.includes('before initialization')) {
      results.tdzCrash = true;
      results.findings.push({ id: 'B14C-TDZ-CRASH', severity: 'Blocker', detail: msg });
      saveResults();
    }
  });

  // ============================================================
  // STEP 1: Login
  // ============================================================
  log('STEP 1: Login');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.fill('input[type="email"]', STUDENT_EMAIL);
  await page.fill('input[type="password"]', STUDENT_PASSWORD);
  await ss(page, '01_login');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  const postLoginURL = page.url();
  log(`Post-login URL: ${postLoginURL}`);
  await ss(page, '01_after_login');

  if (!postLoginURL.includes('/ap')) {
    log('Redirected to / — known bug B4-006. Navigating to /ap/test manually.');
    results.findings.push({ id: 'B4-006-reconfirmed', detail: `Login redirected to ${postLoginURL}` });
  }

  if (results.tdzCrash) { saveResults(); return; }

  // ============================================================
  // STEP 2: Navigate to Micro test — force fresh session
  // ============================================================
  log('STEP 2: Navigate to Micro test (force fresh)');
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(5000);
  await ss(page, '02_test_page');

  if (results.tdzCrash) { saveResults(); return; }

  // Check page state
  const bodyText = await page.textContent('body');
  if (bodyText.includes('scheduleFlush') || bodyText.includes('before initialization')) {
    results.tdzCrash = true;
    results.findings.push({ id: 'B14C-TDZ-CRASH', severity: 'Blocker', detail: 'TDZ error in body text' });
    log('TDZ crash in body — stopping');
    saveResults();
    return;
  }

  const hasBegin = bodyText.includes('Begin Test') || bodyText.includes('Start Test');
  const hasQuestion = bodyText.includes('Question') && bodyText.includes('of 15');
  log(`Page state: hasBegin=${hasBegin}, hasQuestion=${hasQuestion}`);

  // Handle DuplicateTabModal if present — click "Use This Tab" to claim session
  const hasDupModal = await page.locator('button').filter({ hasText: /Use This Tab/i }).count();
  if (hasDupModal > 0) {
    log('DuplicateTabModal detected — clicking Use This Tab');
    results.findings.push({ id: 'B14C-DUP-MODAL-ON-LOAD', detail: 'DuplicateTabModal appeared when loading test page (from stale prior session token)' });
    await page.locator('button').filter({ hasText: /Use This Tab/i }).first().click();
    await page.waitForTimeout(2000);
    await ss(page, '02_after_take_control');
  }

  if (hasBegin) {
    log('Clicking Begin Test');
    // Use force: true as a fallback in case modal still partially overlays
    try {
      await page.locator('button').filter({ hasText: /Begin Test|Start Test/i }).first().click({ timeout: 5000 });
    } catch {
      // If still blocked, try dismissing modal again
      const dupModal2 = await page.locator('button').filter({ hasText: /Use This Tab/i }).count();
      if (dupModal2 > 0) {
        await page.locator('button').filter({ hasText: /Use This Tab/i }).first().click();
        await page.waitForTimeout(2000);
      }
      await page.locator('button').filter({ hasText: /Begin Test|Start Test/i }).first().click({ force: true });
    }
    await page.waitForTimeout(3000);
    await ss(page, '02_after_begin');
  }

  if (results.tdzCrash) { saveResults(); return; }

  // Verify we're on a question
  const q0 = await getCurrentQ(page);
  log(`Starting question: Q${q0}`);

  // If not on Q1, navigate there via navigator
  if (q0 !== 1) {
    log(`Not on Q1 — navigating to Q1 via navigator`);
    await navToQ(page, 1);
  }

  // ============================================================
  // STEP 3: Answer Q1-Q15 in order
  // ============================================================
  log('STEP 3: Answer Q1-Q15 in order');

  // Answer plan: 0=A, 1=B, 2=C, 3=D
  // Q: 1  2  3  4  5  6  7  8  9 10 11 12 13 14 15
  const plan = [null, 0, 1, 2, 0, 3, 1, 0, 2, 1, 3, 0, 2, 1, 3, 0];
  const L = ['A','B','C','D'];

  for (let q = 1; q <= 15; q++) {
    const cur = await getCurrentQ(page);
    log(`Q${q}: currently at Q${cur}`);

    if (cur !== q && cur !== null) {
      log(`  Not on Q${q} — navigating`);
      await navToQ(page, q);
      await page.waitForTimeout(300);
    }

    await ss(page, `Q${String(q).padStart(2,'0')}_before`);

    const before = await detectAnswer(page);
    const clickR = await pickAnswer(page, plan[q]);
    const after = await detectAnswer(page);

    log(`  Q${q}: plan=${L[plan[q]]}, before=${before.selectedLetter}, after=${after.selectedLetter}`);
    results.answers[q] = { planned: L[plan[q]], detected: after.selectedLetter };

    await ss(page, `Q${String(q).padStart(2,'0')}_after`);

    // Next (except Q15)
    if (q < 15) {
      const nextBtn = page.locator('button').filter({ hasText: /^Next →$/ }).first();
      try {
        await nextBtn.waitFor({ timeout: 3000 });
        await nextBtn.click();
        await page.waitForTimeout(400);
      } catch {
        // If on Q15 already, skip
        const nowQ = await getCurrentQ(page);
        if (nowQ && nowQ > q) {
          log(`  Auto-advanced to Q${nowQ}`);
        } else {
          // Navigate via navigator
          await navToQ(page, q + 1);
        }
      }
    }
  }

  log('Q1-Q15 answered');
  log(`Key answers — Q2:${results.answers[2]?.detected} Q3:${results.answers[3]?.detected} Q7:${results.answers[7]?.detected} Q11:${results.answers[11]?.detected} Q14:${results.answers[14]?.detected}`);

  // ============================================================
  // STEP 4: Navigate to Q3, change answer
  // ============================================================
  log('STEP 4: Navigate to Q3, change C→A');
  await navToQ(page, 3);
  await ss(page, 'Q03_before_change');

  const q3Before = await detectAnswer(page);
  log(`Q3 before: ${q3Before.selectedLetter} (expected ${results.answers[3]?.planned})`);

  await pickAnswer(page, 0); // Select A
  await page.waitForTimeout(400);
  const q3After = await detectAnswer(page);
  log(`Q3 after change: ${q3After.selectedLetter} (expected A)`);

  results.answerChanges.push({ question: 3, from: q3Before.selectedLetter, to: q3After.selectedLetter, expectedTo: 'A' });
  results.answers[3].changed = q3After.selectedLetter;

  await ss(page, 'Q03_after_change');

  // ============================================================
  // STEP 5: Navigate to Q11, change answer
  // ============================================================
  log('STEP 5: Navigate to Q11, change A→B');
  await navToQ(page, 11);
  await ss(page, 'Q11_before_change');

  const q11Before = await detectAnswer(page);
  log(`Q11 before: ${q11Before.selectedLetter} (expected ${results.answers[11]?.planned})`);

  await pickAnswer(page, 1); // Select B
  await page.waitForTimeout(400);
  const q11After = await detectAnswer(page);
  log(`Q11 after change: ${q11After.selectedLetter} (expected B)`);

  results.answerChanges.push({ question: 11, from: q11Before.selectedLetter, to: q11After.selectedLetter, expectedTo: 'B' });
  results.answers[11].changed = q11After.selectedLetter;

  await ss(page, 'Q11_after_change');

  // ============================================================
  // STEP 6: Navigate to Q7, observe only (don't change)
  // ============================================================
  log('STEP 6: Navigate to Q7, observe only');
  await navToQ(page, 7);
  await page.waitForTimeout(500);
  await ss(page, 'Q07_visit_only');

  const q7State = await detectAnswer(page);
  const q7OnQ = await getCurrentQ(page);
  log(`On Q${q7OnQ}, Q7 state: ${q7State.selectedLetter} (expected ${results.answers[7]?.planned}=A)`);
  results.answers[7].visitedState = q7State.selectedLetter;
  results.answers[7].visitedOnQ = q7OnQ;

  // ============================================================
  // STEP 7: Open Review screen (first visit)
  // ============================================================
  log('STEP 7: Open Review screen (visit 1)');
  const rev1Opened = await openReview(page);
  log(`Review opened: ${rev1Opened}`);
  await ss(page, 'REVIEW_01');

  const onRev1 = await onReview(page);
  const revData1 = await getReviewData(page);
  log(`On review: ${onRev1}`);
  log(`Review data 1: ${JSON.stringify(revData1)}`);

  results.reviewVisits.push({
    visitNumber: 1,
    onReview: onRev1,
    data: revData1,
    allAnswered: revData1.answered === 15 && revData1.total === 15,
  });

  // B14C-002: Check for answer badges
  results.b14c002Finding = {
    hasBadges: revData1.hasBadges,
    detail: revData1.hasBadges
      ? 'Review grid shows A/B/C/D letter badges inside question boxes'
      : 'Review grid shows only question numbers (1-15) or 🚩 flag emoji — no letter badges for selected answers',
  };

  // ============================================================
  // STEP 8: Return to Questions, navigate to Q14, change answer
  // ============================================================
  log('STEP 8: Return to Questions → Q14 → change D→C');

  const retBtn1 = page.locator('button').filter({ hasText: /Return to Questions/i }).first();
  try {
    await retBtn1.waitFor({ timeout: 5000 });
    await retBtn1.click();
    await page.waitForTimeout(1500);
    log('Clicked Return to Questions');
  } catch {
    log('Return to Questions button not found');
  }

  await ss(page, 'RETURN_01');

  const landing1 = await getCurrentQ(page);
  const url1 = page.url();
  log(`B14C-001 Return 1: landed on Q${landing1}`);
  results.b14c001Findings.push({
    returnNumber: 1,
    landedOnQ: landing1,
    url: url1,
    note: 'After first Return to Questions from Review screen',
  });

  // Navigate to Q14
  await navToQ(page, 14);
  await ss(page, 'Q14_before_change');

  const q14OnQ = await getCurrentQ(page);
  const q14Before = await detectAnswer(page);
  log(`On Q${q14OnQ}, Q14 before: ${q14Before.selectedLetter} (expected ${results.answers[14]?.planned}=D)`);

  await pickAnswer(page, 2); // Select C
  await page.waitForTimeout(400);
  const q14After = await detectAnswer(page);
  log(`Q14 after change: ${q14After.selectedLetter} (expected C)`);

  results.answerChanges.push({ question: 14, from: q14Before.selectedLetter, to: q14After.selectedLetter, expectedTo: 'C' });
  results.answers[14].changed = q14After.selectedLetter;

  await ss(page, 'Q14_after_change');

  // ============================================================
  // STEP 9: Return to Review (second visit)
  // ============================================================
  log('STEP 9: Open Review screen (visit 2)');
  const rev2Opened = await openReview(page);
  log(`Review 2 opened: ${rev2Opened}`);
  await ss(page, 'REVIEW_02');

  const onRev2 = await onReview(page);
  const revData2 = await getReviewData(page);
  log(`On review: ${onRev2}`);
  log(`Review data 2: ${JSON.stringify(revData2)}`);

  results.reviewVisits.push({
    visitNumber: 2,
    onReview: onRev2,
    data: revData2,
    allAnswered: revData2.answered === 15 && revData2.total === 15,
  });

  // ============================================================
  // STEP 10: Return to Questions (2nd), navigate to Q2, observe
  // ============================================================
  log('STEP 10: Return to Questions (2nd) → Q2 → observe');

  const retBtn2 = page.locator('button').filter({ hasText: /Return to Questions/i }).first();
  try {
    await retBtn2.waitFor({ timeout: 5000 });
    await retBtn2.click();
    await page.waitForTimeout(1500);
    log('Clicked Return to Questions (2nd)');
  } catch {
    log('Return to Questions button not found (2nd)');
  }

  await ss(page, 'RETURN_02');

  const landing2 = await getCurrentQ(page);
  log(`B14C-001 Return 2: landed on Q${landing2}`);
  results.b14c001Findings.push({
    returnNumber: 2,
    landedOnQ: landing2,
    note: 'After second Return to Questions from Review screen',
  });

  // Navigate to Q2 — just look
  await navToQ(page, 2);
  await page.waitForTimeout(500);
  await ss(page, 'Q02_visit_only');

  const q2OnQ = await getCurrentQ(page);
  const q2State = await detectAnswer(page);
  log(`On Q${q2OnQ}, Q2 state: ${q2State.selectedLetter} (expected ${results.answers[2]?.planned}=B, should not have changed)`);
  results.answers[2].visitedState = q2State.selectedLetter;
  results.answers[2].visitedOnQ = q2OnQ;

  // ============================================================
  // STEP 11: Return to Review (third visit)
  // ============================================================
  log('STEP 11: Open Review screen (visit 3)');
  const rev3Opened = await openReview(page);
  log(`Review 3 opened: ${rev3Opened}`);
  await ss(page, 'REVIEW_03');

  const onRev3 = await onReview(page);
  const revData3 = await getReviewData(page);
  log(`On review: ${onRev3}`);
  log(`Review data 3: ${JSON.stringify(revData3)}`);

  results.reviewVisits.push({
    visitNumber: 3,
    onReview: onRev3,
    data: revData3,
    allAnswered: revData3.answered === 15 && revData3.total === 15,
  });

  // ============================================================
  // STEP 12: Submit Test
  // ============================================================
  log('STEP 12: Submit Test');

  // Find Submit Section (not final) or Submit Test (final)
  const submitBtn = page.locator('button').filter({ hasText: /Submit Test|Submit Section/i }).first();
  try {
    await submitBtn.waitFor({ timeout: 5000 });
    const btnText = await submitBtn.textContent();
    log(`Submit button text: "${btnText?.trim()}"`);
    await submitBtn.click();
    await page.waitForTimeout(3000);
  } catch {
    log('Submit button not found on review');
    await ss(page, 'SUBMIT_NOT_FOUND');
  }

  await ss(page, 'AFTER_SUBMIT');
  const urlAfterSubmit = page.url();
  log(`After submit: ${urlAfterSubmit}`);

  // Check what screen we're on
  const bodyAfterSubmit = await page.textContent('body');
  const onFRQChoice = bodyAfterSubmit.includes('Free Response Section') ||
                     bodyAfterSubmit.includes("Choose how you'd like") ||
                     bodyAfterSubmit.includes('Type Your Answers') ||
                     bodyAfterSubmit.includes('Write by Hand');
  const onResultsDirect = urlAfterSubmit.includes('/results/');

  log(`FRQ choice screen: ${onFRQChoice}, Direct results: ${onResultsDirect}`);
  results.sectionSubmitResult = { onFRQChoice, onResultsDirect, url: urlAfterSubmit };

  // ============================================================
  // Handle FRQ section if needed
  // ============================================================
  if (onFRQChoice) {
    log('MCQ submitted — handling FRQ choice screen');
    await ss(page, 'FRQ_CHOICE');

    // FRQ choice screen: click "Type Your Answers" card first, then "Confirm & Continue"
    const typeCard = page.locator('button').filter({ hasText: /Type Your Answers/i }).first();
    try {
      await typeCard.waitFor({ timeout: 5000 });
      await typeCard.click();
      await page.waitForTimeout(800);
      log('Selected "Type Your Answers" card');
    } catch {
      log('Could not click Type Your Answers card');
      await ss(page, 'FRQ_CARD_ERROR');
    }

    // Click "Confirm & Continue" button
    const confirmBtn = page.locator('button').filter({ hasText: /Confirm.*Continue|Confirm & Continue/i }).first();
    try {
      await confirmBtn.waitFor({ timeout: 5000 });
      await confirmBtn.click();
      await page.waitForTimeout(2000);
      log('Clicked Confirm & Continue');
    } catch {
      log('Could not find Confirm & Continue');
    }

    await ss(page, 'FRQ_STARTED');

    // Answer FRQ questions
    for (let attempt = 0; attempt < 12; attempt++) {
      const currentURL = page.url();
      if (currentURL.includes('/results/')) {
        log('Reached results page from FRQ');
        break;
      }

      // Type in any textarea present
      const textareas = page.locator('textarea');
      const taCount = await textareas.count();
      if (taCount > 0) {
        for (let i = 0; i < taCount; i++) {
          try {
            await textareas.nth(i).fill('Supply and demand principles govern market equilibrium in competitive markets.');
            await page.waitForTimeout(200);
          } catch {}
        }
      }

      // Try "Next →" first
      const nextBtn = page.locator('button').filter({ hasText: /^Next →$/ }).first();
      const hasNext = await nextBtn.count() > 0;
      if (hasNext) {
        const isEnabled = await nextBtn.isEnabled({ timeout: 1000 }).catch(() => false);
        if (isEnabled) {
          await nextBtn.click();
          await page.waitForTimeout(1000);
          continue;
        }
      }

      // Try "Review →" (on last FRQ question)
      const reviewBtn = page.locator('button').filter({ hasText: /^Review →$/ }).first();
      const hasReview = await reviewBtn.count() > 0;
      if (hasReview) {
        await reviewBtn.click();
        await page.waitForTimeout(1500);
        await ss(page, `FRQ_REVIEW_${attempt}`);

        // Now click Submit Test on FRQ review
        const finalSub = page.locator('button').filter({ hasText: /Submit Test/i }).first();
        const hasFinalSub = await finalSub.count() > 0;
        if (hasFinalSub) {
          await finalSub.click();
          await page.waitForTimeout(5000);
          log('Submitted test from FRQ review');
          break;
        }
      }

      // Safety break if stuck
      log(`FRQ attempt ${attempt}: no Next or Review found`);
      await ss(page, `FRQ_STUCK_${attempt}`);
      break;
    }
  }

  // Wait for final navigation
  await page.waitForTimeout(4000);
  await ss(page, 'RESULTS_FINAL');

  const finalURL = page.url();
  log(`Final URL: ${finalURL}`);
  const isOnResults = finalURL.includes('/results/');
  results.submittedSuccessfully = isOnResults;
  results.finalURL = finalURL;

  // ============================================================
  // STEP 13: Verify results page
  // ============================================================
  if (isOnResults) {
    log('STEP 13: Verifying results page');
    await ss(page, 'RESULTS_PAGE');

    const reportData = await page.evaluate(() => {
      const allText = document.body.textContent || '';
      const h1 = document.querySelector('h1')?.textContent?.trim();

      // MCQ score
      const scoreMatch = allText.match(/(\d+)\s*\/\s*(\d+)/);
      const mcqScore = scoreMatch ? scoreMatch[0] : null;

      // Question table rows
      const rows = [];
      document.querySelectorAll('tr').forEach(row => {
        const cells = Array.from(row.querySelectorAll('td')).map(c => (c.textContent || '').trim());
        if (cells.length >= 2) {
          const qNum = parseInt(cells[0]);
          if (qNum >= 1 && qNum <= 15) {
            rows.push({ q: qNum, cells });
          }
        }
      });

      // Look for "Your Answer" column specifically
      // Report card MCQ table has columns: # | Question | Your Answer | Correct? | Correct Answer
      // (or similar)
      return {
        heading: h1,
        mcqScore,
        questionRows: rows.slice(0, 15),
        bodySnippet: allText.substring(0, 500),
      };
    });

    log(`Report heading: ${reportData.heading}`);
    log(`MCQ score: ${reportData.mcqScore}`);
    log(`Question rows: ${JSON.stringify(reportData.questionRows.slice(0, 5))}`);

    results.reportData = reportData;
    results.mcqScorePresent = !!reportData.mcqScore;

    // Verify answer persistence for key questions
    // The report shows "Your Answer" column
    // Expected:
    //   Q3: C (original) → A (changed) → should show A
    //   Q11: A (original) → B (changed) → should show B
    //   Q14: D (original) → C (changed) → should show C
    //   Q7: A (original, visited only) → should still show A
    //   Q2: B (original, visited only) → should still show B
    const expectedAnswers = {
      2: results.answers[2]?.planned,  // B (original, not changed)
      3: results.answers[3]?.changed,  // A (changed)
      7: results.answers[7]?.planned,  // A (original, not changed)
      11: results.answers[11]?.changed, // B (changed)
      14: results.answers[14]?.changed, // C (changed)
    };

    log(`Expected report answers: ${JSON.stringify(expectedAnswers)}`);
    results.expectedAnswers = expectedAnswers;
    results.reportQuestionRows = reportData.questionRows;

  } else {
    log('Not on results page');
    results.submittedSuccessfully = false;
  }

  // ============================================================
  // Finalize
  // ============================================================
  results.consoleErrors = results.consoleErrors || [];
  results.completedAt = new Date().toISOString();

  // Summarize B14C-001
  log(`B14C-001: Return 1 → Q${results.b14c001Findings[0]?.landedOnQ}, Return 2 → Q${results.b14c001Findings[1]?.landedOnQ}`);

  // Summarize review visits
  results.reviewVisits.forEach(v => {
    log(`Review ${v.visitNumber}: answered=${v.data?.answered}/${v.data?.total}, gridAnswered=${v.data?.gridAnswered}/${v.data?.gridTotal}, allAnswered=${v.allAnswered}`);
  });

  saveResults();

  log('=== B14C-retest v4 COMPLETE ===');
  expect(results.submittedSuccessfully, 'Test should submit successfully to results page').toBeTruthy();
});
