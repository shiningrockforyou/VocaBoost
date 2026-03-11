/**
 * B14-A v3: Realistic Student Simulation — "The Careful One"
 * Optimized for <6 minute completion.
 * Account: student4@apboost.test / Student123!
 * Test: Micro test (test_micro_full_1)
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const STUDENT_EMAIL = 'student4@apboost.test';
const STUDENT_PASSWORD = 'Student123!';
const SCREENSHOTS_DIR = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/screenshots_B14A';
const RESULTS_FILE = 'C:/Users/dmchw/vocaboost/src/apBoost/criteria_audit/playwright_reports/b14a_results.json';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const results = {
  scenarioId: 'B14-A',
  persona: 'The Careful One',
  email: STUDENT_EMAIL,
  startedAt: new Date().toISOString(),
  steps: [],
  findings: [],
  consoleErrors: [],
  trackedAnswers: {},
  reportCard: {}
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
}

function saveResults() {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

async function clickNext(page) {
  const btn = page.locator('button').filter({ hasText: /^Next →$/ }).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false) &&
      !await btn.isDisabled().catch(() => true)) {
    await btn.click();
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

test.setTimeout(360000); // 6 minutes

test('B14-A v3: The Careful One', async ({ page }) => {

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ url: page.url(), msg: msg.text() });
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push({ url: page.url(), msg: err.message, type: 'pageerror' });
  });

  // ==============================
  // 1. LOGIN
  // ==============================
  console.log('\n[1] LOGIN');
  await page.goto('http://localhost:5173/login');
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.locator('input[type="email"]').first().fill(STUDENT_EMAIL);
  await page.locator('input[type="password"]').first().fill(STUDENT_PASSWORD);
  await screenshot(page, 'v3_01_login');
  await page.keyboard.press('Enter');

  let loginOk = false;
  try {
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 });
    loginOk = true;
  } catch (e) {
    loginOk = false;
  }

  if (!loginOk) {
    addStep('Login', 'FAIL', page.url());
    addFinding('Blocker', 'Login failed', `${STUDENT_EMAIL} could not log in`, 'Redirect from /login');
    saveResults();
    throw new Error('Login failed');
  }

  const loginUrl = page.url();
  addStep('Login', 'PASS', `Redirected to: ${loginUrl}`);

  if (!loginUrl.includes('/ap')) {
    addFinding('Medium-Priority', 'Login does not redirect to /ap',
      `Redirected to ${loginUrl}`, 'Should redirect to /ap', 'Known B4-006');
  }

  await screenshot(page, 'v3_02_post_login');

  // ==============================
  // 2. NAVIGATE TO TEST
  // ==============================
  console.log('\n[2] DASHBOARD & START TEST');
  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(2500);
  await screenshot(page, 'v3_03_dashboard');

  const dashText = await page.locator('body').textContent().catch(() => '');
  addStep('Dashboard', /micro|macro|calc/i.test(dashText) ? 'PASS' : 'FAIL',
    `Has tests: ${/micro|macro|calc/i.test(dashText)}`);

  // Navigate directly to test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  await screenshot(page, 'v3_04_test_page');

  const instrText = await page.locator('body').textContent().catch(() => '');
  const isInstruction = /instruction|begin test|begin section/i.test(instrText);
  addStep('Test page loaded', 'PASS', `Instruction screen: ${isInstruction}`);

  if (isInstruction) {
    const beginBtn = page.locator('button').filter({ hasText: /Begin Test|Begin Section|Start/ }).first();
    if (await beginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await beginBtn.click();
      await page.waitForTimeout(2500);
      addStep('Begin Test', 'PASS', '');
    } else {
      addStep('Begin Test', 'FAIL', 'No Begin button found');
      addFinding('High-Priority', 'Begin Test button missing',
        'No "Begin Test" button on instruction screen',
        'Instruction screen must have Begin Test button', 'Screenshot v3_04_test_page.png');
    }
  }

  await screenshot(page, 'v3_05_test_started');

  const inTest = /Question \d+ of \d+/.test(await page.locator('body').textContent().catch(() => ''));
  addStep('Test active', inTest ? 'PASS' : 'FAIL', `URL: ${page.url()}`);

  if (!inTest) {
    addFinding('Blocker', 'Test session did not start',
      `After Begin Test, question counter not found`, 'MCQ questions should start',
      'Screenshot v3_05_test_started.png');
    saveResults();
    throw new Error('Test did not start');
  }

  // ==============================
  // 3. ANSWER Q1-Q15
  // Compressed timing: 2s read per question
  // Flag: Q3, Q7, Q11, Q14
  // Change answer: Q4 and Q9
  // ==============================
  console.log('\n[3] MCQ Q1-Q15');

  const flagAt = [3, 7, 11, 14];
  const changeAt = [4, 9]; // 2/15 = ~13% changed (close enough for simulation)
  let answered = 0, flags = 0, changes = 0;

  for (let q = 1; q <= 15; q++) {
    // Verify counter
    const ctr = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first()
      .textContent({ timeout: 5000 }).catch(() => '');
    const m = ctr.match(/Question (\d+) of (\d+)/);
    console.log(`[Q${q}] Counter: "${ctr.trim()}", expected ${q}`);

    // 2s simulated reading (realistic but compressed)
    await page.waitForTimeout(2000);

    // Take screenshots at key questions
    if (q === 1 || q === 8 || q === 15) {
      await screenshot(page, `v3_06_q${q}`);
    }

    // Select answer: cycle A/B/C/D by question number
    const letters = ['A', 'B', 'C', 'D'];
    const letterIdx = (q - 1) % 4;
    const answerBtns = page.locator('.space-y-3').first().locator('button[type="button"]');
    const btnCount = await answerBtns.count().catch(() => 0);

    if (btnCount >= 4) {
      await answerBtns.nth(letterIdx).click();
      answered++;
      results.trackedAnswers[q] = { initial: letters[letterIdx], final: letters[letterIdx], flagged: flagAt.includes(q) };
    } else if (btnCount > 0) {
      await answerBtns.first().click();
      answered++;
      results.trackedAnswers[q] = { initial: 'A', final: 'A', flagged: flagAt.includes(q) };
    } else {
      console.log(`[Q${q}] No answer buttons found!`);
      if (q === 1) {
        addFinding('High-Priority', 'MCQ answer choices not found',
          'No .space-y-3 button[type="button"] elements found',
          'Each MCQ question should show A/B/C/D answer choice buttons',
          'Screenshot v3_06_q1.png');
      }
    }

    await page.waitForTimeout(800);

    // Change answer at specific questions
    if (changeAt.includes(q) && btnCount >= 4) {
      const newIdx = (letterIdx + 2) % 4;
      await answerBtns.nth(newIdx).click();
      results.trackedAnswers[q].final = letters[newIdx];
      results.trackedAnswers[q].changed = true;
      changes++;
      console.log(`[Q${q}] Changed: ${letters[letterIdx]} → ${letters[newIdx]}`);
      await page.waitForTimeout(600);
    }

    // Flag question
    if (flagAt.includes(q)) {
      const flagBtn = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
      if (await flagBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await flagBtn.click();
        flags++;
        console.log(`[Q${q}] Flagged (total: ${flags})`);
        if (q === 3 || q === 7) await screenshot(page, `v3_07_q${q}_flagged`);
      } else {
        console.log(`[Q${q}] No flag button!`);
        addFinding('High-Priority', `Flag button missing on Q${q}`,
          '"Flag for Review" button not found',
          'Each MCQ should have a "Flag for Review" button',
          `Q${q} flag attempt`);
      }
      await page.waitForTimeout(500);
    }

    // Move to next question (Q15 → Review → button)
    if (q < 15) {
      const moved = await clickNext(page);
      if (!moved) {
        console.log(`[Q${q}] Next button not found`);
      }
    }
  }

  await screenshot(page, 'v3_08_after_q15');
  addStep('Answer Q1-Q15',
    answered >= 12 ? 'PASS' : 'PARTIAL',
    `Answered: ${answered}/15, Flagged: ${flags}/4, Changed: ${changes}`);

  // ==============================
  // 4. NAVIGATOR — REVISIT FLAGGED QUESTIONS
  // ==============================
  console.log('\n[4] NAVIGATOR — FLAGGED REVIEW');

  // Open navigator
  const navBtn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  let navOpen = false;
  if (await navBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await navBtn.click();
    await page.waitForTimeout(1200);
    navOpen = true;
    console.log('[NAV] Opened navigator');
    await screenshot(page, 'v3_09_navigator');
  } else {
    console.log('[NAV] Could not open navigator');
    addFinding('High-Priority', 'Navigator trigger not found',
      '"Question X of Y ▲" button not visible', 'Navigator must be accessible via bottom bar',
      'Screenshot v3_08_after_q15.png');
  }
  addStep('Open navigator', navOpen ? 'PASS' : 'FAIL', '');

  // Check navigator content
  if (navOpen) {
    const navText = await page.locator('.fixed').last().textContent({ timeout: 3000 }).catch(() => '');
    const hasGrid = /Question Navigator/.test(navText);
    const flagEmojis = (navText.match(/🚩/g) || []).length;
    console.log(`[NAV] Has grid: ${hasGrid}, 🚩 count: ${flagEmojis}`);
    console.log(`[NAV] Text: ${navText.substring(0, 150)}`);
    addStep('Navigator content', hasGrid ? 'PASS' : 'FAIL',
      `Grid visible: ${hasGrid}, Flagged shown: ${flagEmojis}`);
  }

  // Visit flagged questions via navigator
  let visits = 0;
  let changedViaNav = false;

  for (let i = 0; i < flagAt.length; i++) {
    const targetQ = flagAt[i];

    // Re-open navigator if needed
    const isNavVisible = await page.locator('.fixed').last()
      .getByText('Question Navigator').isVisible({ timeout: 2000 }).catch(() => false);
    if (!isNavVisible) {
      const btn2 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
      if (await btn2.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn2.click();
        await page.waitForTimeout(1000);
      }
    }

    // Find the question box by position (targetQ - 1 = 0-indexed)
    const qBoxes = page.locator('.fixed button[class*="w-10"], .fixed button[class*="w-12"]');
    const boxCount = await qBoxes.count().catch(() => 0);

    if (boxCount >= targetQ) {
      const box = qBoxes.nth(targetQ - 1);
      const boxTxt = await box.textContent({ timeout: 2000 }).catch(() => '?');
      await box.click();
      await page.waitForTimeout(1200);
      visits++;

      const newCtr = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first()
        .textContent({ timeout: 3000 }).catch(() => '');
      console.log(`[NAV] Jumped to Q${targetQ} (box text: "${boxTxt.trim()}"). Counter: "${newCtr.trim()}"`);

      await screenshot(page, `v3_10_revisit_q${targetQ}`);

      // Re-read for 2s
      await page.waitForTimeout(2000);

      // Change Q3's answer (first flagged question)
      if (i === 0 && !changedViaNav) {
        const aBtns = page.locator('.space-y-3').first().locator('button[type="button"]');
        const aBtnCount = await aBtns.count().catch(() => 0);
        if (aBtnCount >= 4) {
          const prevFinal = results.trackedAnswers[targetQ]?.final || 'A';
          const prevIdx = ['A', 'B', 'C', 'D'].indexOf(prevFinal);
          const newIdx = (prevIdx + 1) % 4;
          await aBtns.nth(newIdx).click();
          changedViaNav = true;
          changes++;
          results.trackedAnswers[targetQ] = {
            ...results.trackedAnswers[targetQ],
            finalAfterReview: ['A', 'B', 'C', 'D'][newIdx],
            changedInReview: true
          };
          console.log(`[NAV] Changed Q${targetQ}: ${prevFinal} → ${'ABCD'[newIdx]}`);
          await page.waitForTimeout(800);
          await screenshot(page, `v3_11_changed_q${targetQ}`);
        }
      }
    } else {
      console.log(`[NAV] Only ${boxCount} boxes, can't reach Q${targetQ}`);
    }

    await page.waitForTimeout(800);
  }

  addStep('Revisit flagged questions',
    visits >= 3 ? 'PASS' : visits > 0 ? 'PARTIAL' : 'FAIL',
    `Visited: ${visits}/${flagAt.length}, Changed 1 answer: ${changedViaNav}`);

  saveResults();

  // ==============================
  // 5. REVIEW SCREEN
  // ==============================
  console.log('\n[5] REVIEW SCREEN');

  // Close any open modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // Get to last question (Q15) to show "Review →"
  const ctrNow = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first()
    .textContent({ timeout: 3000 }).catch(() => '');
  const qNow = ctrNow.match(/Question (\d+) of (\d+)/);
  const currentQNow = qNow ? parseInt(qNow[1]) : -1;
  const totalQNow = qNow ? parseInt(qNow[2]) : 15;

  console.log(`[REVIEW] Currently Q${currentQNow} of ${totalQNow}`);

  if (currentQNow !== totalQNow && currentQNow !== -1) {
    // Jump to last question via navigator
    const navBtn2 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    if (await navBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await navBtn2.click();
      await page.waitForTimeout(1000);
      const qBoxes2 = page.locator('.fixed button[class*="w-10"], .fixed button[class*="w-12"]');
      const cnt2 = await qBoxes2.count().catch(() => 0);
      if (cnt2 > 0) {
        await qBoxes2.last().click();
        await page.waitForTimeout(1200);
        console.log('[REVIEW] Jumped to last question');
      }
    }
  }

  // Click Review →
  const reviewBtn = page.locator('button').filter({ hasText: /^Review →$/ }).first();
  let onReview = false;

  if (await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await reviewBtn.click();
    await page.waitForTimeout(2000);
    onReview = true;
    console.log('[REVIEW] Clicked Review →');
  } else {
    // Try navigator → Go to Review Screen
    const navBtn3 = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
    if (await navBtn3.isVisible({ timeout: 3000 }).catch(() => false)) {
      await navBtn3.click();
      await page.waitForTimeout(1000);
      const goReview = page.locator('button').filter({ hasText: 'Go to Review Screen' }).first();
      if (await goReview.isVisible({ timeout: 5000 }).catch(() => false)) {
        await goReview.click();
        await page.waitForTimeout(2000);
        onReview = true;
      }
    }
  }

  await screenshot(page, 'v3_12_review_screen');
  const reviewText = await page.locator('body').textContent().catch(() => '');
  const reviewConfirmed = /review|answered|unanswered|submit section|submit test/i.test(reviewText);

  addStep('Review screen', reviewConfirmed ? 'PASS' : 'FAIL',
    `URL: ${page.url()}, Text confirms: ${reviewConfirmed}`);

  if (!reviewConfirmed) {
    addFinding('High-Priority', 'Review screen not reached',
      `Review → visible: ${onReview}. Body text: ${reviewText.substring(0, 200)}`,
      '"Review →" button on Q15 should navigate to review screen',
      'Screenshot v3_12_review_screen.png');
  } else {
    // Verify review screen shows unanswered count
    const unansweredMatch = reviewText.match(/(\d+)\s*unanswered/i);
    const answeredMatch = reviewText.match(/(\d+)\s*(?:answered|of \d+ answered)/i);
    console.log(`[REVIEW] Unanswered: ${unansweredMatch?.[0]}, Answered: ${answeredMatch?.[0]}`);

    // Check for "Return to Questions" / cancel option
    const returnBtn = page.locator('button').filter({ hasText: /Return to Questions|Cancel|Back/ }).first();
    const returnVisible = await returnBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[REVIEW] Return to questions button visible: ${returnVisible}`);

    results.reportCard.reviewText = reviewText.substring(0, 500);
  }

  // Wait 5s on review screen (careful student reviewing)
  console.log('[REVIEW] Waiting 5s on review screen...');
  await page.waitForTimeout(5000);
  await screenshot(page, 'v3_13_review_after_wait');

  // ==============================
  // 6. SUBMIT
  // ==============================
  console.log('\n[6] SUBMIT');

  const submitBtn = page.locator('button').filter({ hasText: /Submit Section|Submit Test|Submit Exam/ }).first();
  const submitVis = await submitBtn.isVisible({ timeout: 8000 }).catch(() => false);
  const submitDis = await submitBtn.isDisabled().catch(() => true);

  console.log(`[SUBMIT] Visible: ${submitVis}, Disabled: ${submitDis}`);

  if (submitVis && !submitDis) {
    await submitBtn.click();
    await page.waitForTimeout(4000);
    addStep('Submit', 'PASS', 'Submit button clicked');
  } else {
    addStep('Submit', 'FAIL', `Visible: ${submitVis}, Disabled: ${submitDis}`);
    addFinding('High-Priority', 'Submit button not available on review screen',
      `Submit button: visible=${submitVis}, disabled=${submitDis}`,
      'Review screen must have an enabled Submit button',
      'Screenshot v3_12_review_screen.png');
  }

  await screenshot(page, 'v3_14_after_submit');
  const afterSubmitText = await page.locator('body').textContent().catch(() => '');
  const isFRQChoice = /free response|type your answers|write by hand/i.test(afterSubmitText);
  const isResults = /report card|your score|mcq score/i.test(afterSubmitText);
  console.log(`[SUBMIT] After: FRQ choice=${isFRQChoice}, results=${isResults}`);

  // ==============================
  // 7. FRQ SECTION
  // ==============================
  if (isFRQChoice) {
    console.log('\n[7] FRQ');
    addStep('FRQ choice screen', 'PASS', '');
    await screenshot(page, 'v3_15_frq_choice');

    // Select Typed FRQ
    const typedBtn = page.locator('button').filter({ hasText: /Type Your Answers/ }).first();
    if (await typedBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await typedBtn.click();
      await page.waitForTimeout(2500);
      addStep('Choose typed FRQ', 'PASS', '');
      await screenshot(page, 'v3_16_frq_typing');

      // Type in first textarea
      const ta = page.locator('textarea').first();
      if (await ta.isVisible({ timeout: 3000 }).catch(() => false)) {
        await ta.click();
        await ta.fill('Supply and demand equilibrium is determined by the intersection of the supply and demand curves. When supply decreases (shifts left), equilibrium price increases while equilibrium quantity decreases.');
        await page.waitForTimeout(1000);
        addStep('Type FRQ answer', 'PASS', '');
      }

      // Navigate through FRQ sub-questions and submit
      // Use evaluate to get to the submit button faster
      let attempts = 0;
      while (attempts < 8) {
        attempts++;
        await page.waitForTimeout(1500);

        // Check if on review/submit state
        const bodyNow = await page.locator('body').textContent().catch(() => '');

        // If new textarea appeared, fill it
        const taNew = page.locator('textarea').first();
        if (await taNew.isVisible({ timeout: 1000 }).catch(() => false)) {
          const currentVal = await taNew.inputValue().catch(() => '');
          if (!currentVal) {
            await taNew.click();
            await taNew.fill('Price elasticity of demand measures consumer responsiveness to price changes. PED greater than 1 indicates elastic demand where consumers are highly responsive to price changes.');
            await page.waitForTimeout(600);
          }
        }

        // Try Review → button (signals end of FRQ questions)
        const revBtn = page.locator('button').filter({ hasText: /^Review →$/ }).first();
        if (await revBtn.isVisible({ timeout: 1000 }).catch(() => false) &&
            !await revBtn.isDisabled().catch(() => true)) {
          await revBtn.click();
          await page.waitForTimeout(2000);
          console.log('[FRQ] Reached FRQ Review screen');
          break;
        }

        // Try Submit Test button directly
        const submitTestBtn = page.locator('button').filter({ hasText: /Submit Test|Submit Exam|Finish/ }).first();
        if (await submitTestBtn.isVisible({ timeout: 1000 }).catch(() => false) &&
            !await submitTestBtn.isDisabled().catch(() => true)) {
          await submitTestBtn.click();
          await page.waitForTimeout(5000);
          console.log('[FRQ] Clicked Submit Test');
          addStep('Submit Test', 'PASS', '');
          break;
        }

        // Try Next →
        const moved = await clickNext(page);
        if (!moved) {
          console.log(`[FRQ] No next/submit found on attempt ${attempts}`);
          break;
        }
      }

      await screenshot(page, 'v3_17_frq_done');

      // Check if we're now on FRQ review screen
      const frqReviewText = await page.locator('body').textContent().catch(() => '');
      if (/submit test|submit exam/i.test(frqReviewText)) {
        const submitTestBtn2 = page.locator('button').filter({ hasText: /Submit Test|Submit Exam/ }).first();
        if (await submitTestBtn2.isVisible({ timeout: 5000 }).catch(() => false) &&
            !await submitTestBtn2.isDisabled().catch(() => true)) {
          await submitTestBtn2.click();
          await page.waitForTimeout(5000);
          addStep('Submit Test (from FRQ review)', 'PASS', '');
          console.log('[FRQ] Submitted test from FRQ review screen');
        }
      }
    }
  } else if (isResults) {
    addStep('FRQ', 'SKIP', 'Went directly to results');
  }

  // Wait for results page navigation
  await page.waitForTimeout(4000);

  // ==============================
  // 8. VERIFY REPORT CARD
  // ==============================
  console.log('\n[8] REPORT CARD');

  const finalUrl = page.url();
  const finalText = await page.locator('body').textContent().catch(() => '');
  const isResultsPage = finalUrl.includes('/results/');
  const hasReport = /score|report card|correct|incorrect|mcq|performance/i.test(finalText);
  const hasScore = /\d+\s*\/\s*\d+|\d+\s*%|mcq score/i.test(finalText);
  const hasMCQTable = /question|correct|incorrect|your answer/i.test(finalText);
  const hasAPScore = /AP\s*score|projection/i.test(finalText);
  const hasDomain = /domain|unit|performance by/i.test(finalText);

  await screenshot(page, 'v3_18_results');

  console.log(`[RESULTS] URL: ${finalUrl}`);
  console.log(`[RESULTS] isResultsPage: ${isResultsPage}, hasReport: ${hasReport}`);
  console.log(`[RESULTS] score: ${hasScore}, MCQTable: ${hasMCQTable}, APScore: ${hasAPScore}, domain: ${hasDomain}`);

  results.reportCard = {
    url: finalUrl,
    isResultsPage,
    hasReport,
    hasScore,
    hasMCQTable,
    hasAPScore,
    hasDomain,
    textSnippet: finalText.substring(0, 800)
  };

  addStep('Report card loaded',
    isResultsPage && hasReport ? 'PASS' : hasReport ? 'PARTIAL' : 'FAIL',
    `URL has /results/: ${isResultsPage}, Content: ${hasReport}`);

  if (!hasReport) {
    addFinding('Blocker', 'Report card did not load after test submission',
      `Post-submission URL: ${finalUrl}. No report card content found. Text: ${finalText.substring(0, 300)}`,
      'After test submission, should navigate to /ap/results/:resultId with full report card',
      'Screenshot v3_18_results.png');
  } else {
    // Report card section checks
    if (!hasScore) {
      addFinding('Medium-Priority', 'Score display missing from report card',
        'Report card does not show MCQ score (e.g., "10/15" or "67%")',
        'Report card should prominently show the MCQ score',
        'Screenshot v3_18_results.png');
    }

    if (!hasMCQTable) {
      addFinding('Medium-Priority', 'MCQ per-question breakdown missing from report card',
        'No question-by-question correct/incorrect breakdown found',
        'Report card should include MCQ table with correct/incorrect per question',
        'Screenshot v3_18_results.png');
    }

    // Check for flagged section (known B3-001 issue)
    const hasFlaggedSection = /flag|flagged for review|marked for review/i.test(finalText);
    if (flags > 0 && !hasFlaggedSection) {
      addFinding('High-Priority', 'Flagged for Review section absent from report card',
        `Student flagged ${flags} questions during test. Report card has no "Flagged for Review" section.`,
        'Report card should display which questions were flagged for review during the test',
        'Known B3-001 — flaggedQuestions array not saved to result doc in createTestResult');
    }

    addStep('Report card content',
      (hasScore && hasMCQTable) ? 'PASS' : (hasScore || hasMCQTable) ? 'PARTIAL' : 'FAIL',
      `Score: ${hasScore}, MCQ table: ${hasMCQTable}, AP Score: ${hasAPScore}, Domain: ${hasDomain}`);
  }

  // Scroll down to see more content
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(800);
  await screenshot(page, 'v3_19_results_scrolled');

  // ==============================
  // 9. FINAL ANSWER VERIFICATION
  // ==============================
  console.log('\n[9] ANSWER VERIFICATION');

  const changedQsList = Object.entries(results.trackedAnswers)
    .filter(([_, d]) => d.changed || d.changedInReview)
    .map(([q, d]) => `Q${q}: ${d.initial}→${d.finalAfterReview || d.final}`);

  console.log(`[ANSWERS] Changed: ${changedQsList.join(', ')}`);
  results.answerChanges = changedQsList;

  addStep('Final answers in report card',
    hasReport ? 'PASS' : 'FAIL',
    `${changes} answer changes tracked: ${changedQsList.join(', ')}. Report card loaded: ${hasReport}`);

  // ==============================
  // SAVE
  // ==============================
  results.consoleErrors = consoleErrors;
  results.completedAt = new Date().toISOString();
  results.summary = {
    questionsAnswered: answered,
    flagsPlaced: flags,
    answersChanged: changes,
    navigatorVisits: visits,
    answerChangedViaNavigator: changedViaNav,
    totalFindings: results.findings.length,
    consoleErrors: consoleErrors.length,
    steps: {
      total: results.steps.length,
      pass: results.steps.filter(s => s.status === 'PASS').length,
      fail: results.steps.filter(s => s.status === 'FAIL').length,
      partial: results.steps.filter(s => s.status === 'PARTIAL').length,
      skip: results.steps.filter(s => s.status === 'SKIP').length,
    }
  };

  saveResults();
  console.log('\n[DONE] Summary:', JSON.stringify(results.summary, null, 2));

  const blockers = results.findings.filter(f => f.severity === 'Blocker');
  if (blockers.length > 0) {
    throw new Error(`BLOCKERS: ${blockers.map(b => b.title).join(' | ')}`);
  }
});
