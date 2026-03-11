/**
 * B14-A v4: Realistic Student Simulation — "The Careful One"
 * Final version — handles session resume, correct button selectors.
 *
 * Key fixes from v3:
 * 1. Handles "Resume Test" instruction screen (existing session)
 * 2. Answer choice selector uses flex-1 class to skip strikethrough buttons
 * 3. FRQ completion with proper navigation
 *
 * The .space-y-3 container has pairs: [answer-choice(flex-1), strikethrough(shrink-0)]
 * We must select only the flex-1 buttons (answer choices), not the X buttons.
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
  reportCard: {},
  simulationNotes: []
};

function addStep(label, status, notes = '') {
  console.log(`[STEP] ${label} — ${status}${notes ? ' | ' + notes : ''}`);
  results.steps.push({ label, status, notes, time: new Date().toISOString() });
}

function addFinding(severity, title, what, expected, evidence = '') {
  console.log(`[FINDING][${severity}] ${title}`);
  results.findings.push({ severity, title, what, expected, evidence, time: new Date().toISOString() });
}

function addNote(note) {
  console.log(`[NOTE] ${note}`);
  results.simulationNotes.push(note);
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

/**
 * Get ONLY the answer choice buttons (not strikethrough buttons).
 * Answer choices have class "flex-1" in their className.
 * Strikethrough buttons have class "shrink-0".
 */
async function getAnswerChoiceButtons(page) {
  // Answer buttons: button[type="button"] with flex-1 class (inside .space-y-3)
  // The flex-1 is applied as a Tailwind class
  return page.locator('.space-y-3 button[type="button"].flex-1');
}

async function selectAnswer(page, letterIndex) {
  // letterIndex: 0=A, 1=B, 2=C, 3=D
  const answerBtns = await getAnswerChoiceButtons(page);
  const count = await answerBtns.count().catch(() => 0);

  if (count === 0) {
    // Fallback: look for buttons without the strikethrough SVG (they have text content)
    // The answer buttons contain text (letter + choice text), strikethrough has only SVG
    const allBtns = page.locator('.space-y-3 button[type="button"]');
    const allCount = await allBtns.count().catch(() => 0);
    // Answer buttons are at even indices (0, 2, 4, 6) = indices 0, 2, 4, 6 → map to A, B, C, D
    const actualIndex = letterIndex * 2; // A→0, B→2, C→4, D→6
    if (actualIndex < allCount) {
      await allBtns.nth(actualIndex).click();
      return true;
    }
    return false;
  }

  const idx = Math.min(letterIndex, count - 1);
  await answerBtns.nth(idx).click();
  return true;
}

async function clickNext(page) {
  const btn = page.locator('button').filter({ hasText: /^Next →$/ }).first();
  try {
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    if (!await btn.isDisabled()) {
      await btn.click();
      await page.waitForTimeout(600);
      return true;
    }
  } catch {}
  return false;
}

async function getCurrentQ(page) {
  try {
    const txt = await page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first()
      .textContent({ timeout: 5000 });
    const m = txt.match(/Question (\d+) of (\d+)/);
    return { q: m ? parseInt(m[1]) : -1, total: m ? parseInt(m[2]) : -1, text: txt.trim() };
  } catch {
    return { q: -1, total: -1, text: '' };
  }
}

async function openNavigator(page) {
  const btn = page.locator('button').filter({ hasText: /Question \d+ of \d+/ }).first();
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}

async function jumpToQ(page, targetQ) {
  // Question boxes: button.w-10 or button.w-12 inside .fixed
  const qBoxes = page.locator('.fixed button.w-10, .fixed button.w-12');
  const count = await qBoxes.count().catch(() => 0);
  if (count >= targetQ) {
    await qBoxes.nth(targetQ - 1).click();
    await page.waitForTimeout(1200);
    return true;
  }
  return false;
}

// ============================================================

test.setTimeout(360000); // 6 min

test('B14-A v4: The Careful One (handles resume + correct selectors)', async ({ page }) => {

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('Heartbeat')) { // skip heartbeat noise
        consoleErrors.push({ url: page.url(), msg: text });
        console.log(`[CONSOLE ERROR] ${text.substring(0, 120)}`);
      }
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
  await screenshot(page, 'v4_01_login');
  await page.locator('input[type="email"]').first().fill(STUDENT_EMAIL);
  await page.locator('input[type="password"]').first().fill(STUDENT_PASSWORD);
  await page.keyboard.press('Enter');

  let loginOk = false;
  try {
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 });
    loginOk = true;
  } catch {}

  if (!loginOk) {
    addStep('Login', 'FAIL', `Still on ${page.url()}`);
    addFinding('Blocker', 'Login failed', `${STUDENT_EMAIL} login failed`, 'Redirect from /login');
    saveResults();
    throw new Error('Login failed');
  }

  const loginUrl = page.url();
  addStep('Login', 'PASS', `→ ${loginUrl}`);

  if (!loginUrl.includes('/ap')) {
    addFinding('Medium-Priority', 'Login does not redirect to /ap',
      `Redirected to ${loginUrl}`, 'Should go to /ap', 'Known finding B4-006');
  }

  await screenshot(page, 'v4_02_after_login');

  // ==============================
  // 2. NAVIGATE TO MICRO TEST
  // ==============================
  console.log('\n[2] NAVIGATE TO TEST');

  // First check dashboard
  await page.goto('http://localhost:5173/ap');
  await page.waitForTimeout(2500);
  await screenshot(page, 'v4_03_dashboard');
  const dashText = await page.locator('body').textContent().catch(() => '');
  addStep('Dashboard', /micro|macro|AP/i.test(dashText) ? 'PASS' : 'FAIL',
    `Has AP tests: ${/micro|macro|AP/i.test(dashText)}`);

  // Navigate to test
  await page.goto('http://localhost:5173/ap/test/test_micro_full_1');
  await page.waitForTimeout(3000);
  await screenshot(page, 'v4_04_test_page');

  const testPageText = await page.locator('body').textContent().catch(() => '');
  console.log(`[TEST PAGE] Text snippet: ${testPageText.substring(0, 200)}`);

  // Detect what screen we're on
  const isInstruction = /This test has|Begin Test|Resume Test|section breakdown/i.test(testPageText);
  const isAlreadyInTest = /Question \d+ of \d+/.test(testPageText);
  const isOnFRQ = /free response section|section ii|frq/i.test(testPageText) && !isInstruction;
  const isCompleted = /already completed|test complete|view results/i.test(testPageText);

  console.log(`[SCREEN] isInstruction: ${isInstruction}, inTest: ${isAlreadyInTest}, isFRQ: ${isOnFRQ}, completed: ${isCompleted}`);
  addNote(`Test page state: instruction=${isInstruction}, inTest=${isAlreadyInTest}, frq=${isOnFRQ}, completed=${isCompleted}`);

  if (isInstruction) {
    // Click either "Begin Test" or "Resume Test"
    const beginOrResume = page.locator('button').filter({ hasText: /Begin Test|Resume Test/ }).first();
    if (await beginOrResume.isVisible({ timeout: 5000 }).catch(() => false)) {
      const btnText = await beginOrResume.textContent().catch(() => '');
      console.log(`[INSTRUCTION] Clicking "${btnText.trim()}"`);
      addNote(`Clicked: "${btnText.trim()}" (session resume/fresh start)`);

      if (/Resume Test/i.test(btnText)) {
        addNote('Session resume detected — student4 has existing IN_PROGRESS session from previous run');
        addFinding('Nitpick', 'Session state persists between test runs',
          'student4 has an existing in-progress session from a previous run — clicking Resume Test',
          'This is expected behavior — the simulation is resuming a real student session state',
          'Screenshot v4_04_test_page.png');
      }

      await beginOrResume.click();
      await page.waitForTimeout(3000);
      addStep('Begin/Resume Test', 'PASS', `Clicked: ${btnText.trim()}`);
    } else {
      addStep('Begin Test', 'FAIL', 'No Begin/Resume button found');
      addFinding('High-Priority', 'Begin Test button missing on instruction screen',
        'No "Begin Test" or "Resume Test" button found',
        'Instruction screen must have a Begin Test button',
        'Screenshot v4_04_test_page.png');
    }
  } else if (isAlreadyInTest) {
    addNote('Already in test session (no instruction screen shown)');
    addStep('Begin Test', 'SKIP', 'Already in test');
  } else if (isCompleted) {
    addNote('Test already completed for this student');
    addFinding('Medium-Priority', 'Test session already completed for student4',
      'Test session shows completed state — cannot run fresh simulation',
      'For B14-A fresh simulation, a fresh student account should be used',
      'Screenshot v4_04_test_page.png');
  }

  await screenshot(page, 'v4_05_test_started');

  // Verify we're in the test
  const afterBeginText = await page.locator('body').textContent().catch(() => '');
  let inTest = /Question \d+ of \d+/.test(afterBeginText);

  // Also check if we're in FRQ section (that counts as "in test" for our purposes)
  const inFRQSection = /section.*free response|frq choice|type your answers/i.test(afterBeginText);

  if (!inTest && !inFRQSection) {
    addStep('Test session active', 'FAIL', `URL: ${page.url()}, Text: ${afterBeginText.substring(0, 100)}`);
    addFinding('Blocker', 'Could not enter test session',
      `After Begin/Resume Test, neither question counter nor FRQ section found. URL: ${page.url()}`,
      'After Begin Test, MCQ section should start with Q1-Q15 question counter',
      'Screenshot v4_05_test_started.png');
    saveResults();
    throw new Error('Cannot enter test');
  }

  if (inFRQSection) {
    addStep('Test session active', 'PASS', 'In FRQ section (MCQ was already completed)');
    addNote('MCQ section was already completed in a previous run. Proceeding with FRQ section.');
  } else {
    addStep('Test session active', 'PASS', `In MCQ section`);
  }

  // ==============================
  // 3. MCQ ANSWERING (if in MCQ)
  // ==============================
  let answered = 0, flags = 0, changes = 0;
  const flagAt = [3, 7, 11, 14];
  const changeAt = [4, 9];

  if (inTest) {
    console.log('\n[3] MCQ ANSWERING');

    // Get current question to know where we are (resume state)
    const startQ = await getCurrentQ(page);
    console.log(`[MCQ] Starting at: ${startQ.text}`);
    addNote(`MCQ start position: Q${startQ.q} of ${startQ.total}`);

    // Detect if we need to start from beginning or resume
    const startingQ = startQ.q > 0 ? startQ.q : 1;
    const totalQ = startQ.total > 0 ? startQ.total : 15;

    await screenshot(page, `v4_06_q${startingQ}_start`);

    for (let q = startingQ; q <= totalQ; q++) {
      const qInfo = await getCurrentQ(page);
      console.log(`[Q${q}] Counter: "${qInfo.text}"`);

      if (qInfo.q !== -1 && qInfo.q !== q) {
        console.log(`[Q${q}] Counter mismatch — on Q${qInfo.q}, expected Q${q}`);
      }

      // Simulated reading time: 2s
      await page.waitForTimeout(2000);

      // Screenshots at key questions
      if (q === startingQ || q === 8 || q === 15) {
        await screenshot(page, `v4_07_q${q}`);
      }

      // Select answer using CORRECT selector (flex-1 answer buttons only)
      const letters = ['A', 'B', 'C', 'D'];
      const letterIdx = (q - 1) % 4; // A=Q1,Q5,Q9,Q13 / B=Q2,Q6,Q10,Q14 / C=Q3,Q7,Q11,Q15 / D=Q4,Q8,Q12

      const answerSelected = await selectAnswer(page, letterIdx);

      if (answerSelected) {
        answered++;
        results.trackedAnswers[q] = {
          initial: letters[letterIdx],
          final: letters[letterIdx],
          flagged: flagAt.includes(q)
        };
        console.log(`[Q${q}] Selected ${letters[letterIdx]}`);
      } else {
        console.log(`[Q${q}] WARNING: No answer button found!`);
        if (q === startingQ) {
          // Try to understand the DOM structure
          const bodyHTML = await page.locator('.space-y-3').first().innerHTML().catch(() => 'not found');
          console.log(`[Q${q}] .space-y-3 HTML (first 500 chars): ${bodyHTML.substring(0, 500)}`);
          addFinding('High-Priority', 'Answer choice buttons not found with flex-1 selector',
            `selectAnswer() failed for Q${q}. .space-y-3 flex-1 button[type="button"] returned 0 elements`,
            'Each MCQ question should show 4 answer choice buttons (A/B/C/D) with flex-1 class',
            `Screenshot v4_07_q${q}.png`);
        }
      }

      await page.waitForTimeout(700);

      // Change answer at Q4, Q9
      if (changeAt.includes(q) && results.trackedAnswers[q]) {
        const newIdx = (letterIdx + 2) % 4;
        const newSelected = await selectAnswer(page, newIdx);
        if (newSelected) {
          results.trackedAnswers[q].changed = true;
          results.trackedAnswers[q].final = letters[newIdx];
          changes++;
          console.log(`[Q${q}] Changed ${letters[letterIdx]} → ${letters[newIdx]}`);
        }
        await page.waitForTimeout(600);
      }

      // Flag at Q3, Q7, Q11, Q14
      if (flagAt.includes(q)) {
        const flagBtn = page.locator('button').filter({ hasText: /Flag for Review/ }).first();
        if (await flagBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await flagBtn.click();
          flags++;
          console.log(`[Q${q}] Flagged (total: ${flags})`);
          await screenshot(page, `v4_08_q${q}_flagged`);
        } else {
          const alreadyFlagged = await page.locator('button').filter({ hasText: /^🚩Flagged$|^Flagged$/ }).first()
            .isVisible({ timeout: 2000 }).catch(() => false);
          if (alreadyFlagged) {
            flags++;
            console.log(`[Q${q}] Already flagged`);
          } else {
            console.log(`[Q${q}] No flag button found`);
            addFinding('High-Priority', `Flag button absent on Q${q}`,
              '"Flag for Review" button not found',
              'Each MCQ should have visible "Flag for Review" button',
              `Q${q} attempt`);
          }
        }
        await page.waitForTimeout(500);
      }

      // Navigate
      if (q < totalQ) {
        const moved = await clickNext(page);
        if (!moved) console.log(`[Q${q}] Next button not found/clickable`);
      }
    }

    await screenshot(page, 'v4_09_after_all_mcq');
    addStep('Answer MCQ questions',
      answered >= 10 ? 'PASS' : answered > 0 ? 'PARTIAL' : 'FAIL',
      `Answered: ${answered}/${totalQ - startingQ + 1}, Flagged: ${flags}, Changed: ${changes}`);

    // ==============================
    // 4. NAVIGATOR — REVISIT FLAGGED QUESTIONS
    // ==============================
    console.log('\n[4] NAVIGATOR — FLAGGED REVIEW');

    await page.waitForTimeout(1000);

    // Open navigator
    const navOpened = await openNavigator(page);
    if (!navOpened) {
      addFinding('High-Priority', 'Navigator trigger not clickable after all MCQ answered',
        '"Question X of Y ▲" button not found',
        'Navigator button must always be accessible in the bottom bar',
        'Screenshot v4_09_after_all_mcq.png');
    }
    addStep('Open navigator', navOpened ? 'PASS' : 'FAIL', '');

    await screenshot(page, 'v4_10_navigator');

    if (navOpened) {
      // Check navigator content
      const navText = await page.locator('.fixed').last().textContent({ timeout: 3000 }).catch(() => '');
      const hasNavGrid = /Question Navigator/.test(navText);
      const flagEmojis = (navText.match(/🚩/g) || []).length;
      console.log(`[NAV] hasGrid: ${hasNavGrid}, 🚩: ${flagEmojis}`);
      console.log(`[NAV] Text: ${navText.substring(0, 150)}`);
      addStep('Navigator modal', hasNavGrid ? 'PASS' : 'FAIL',
        `Grid: ${hasNavGrid}, Flagged shown: ${flagEmojis}`);

      if (flags > 0 && flagEmojis === 0) {
        addFinding('Medium-Priority', 'Flagged questions not shown with 🚩 in navigator grid',
          `Placed ${flags} flags, but navigator shows ${flagEmojis} 🚩 emojis`,
          'Flagged questions should display 🚩 instead of number in navigator',
          'Screenshot v4_10_navigator.png');
      }
    }

    // Revisit flagged questions
    let visits = 0;
    let changedViaNav = false;
    const flaggedToVisit = flagAt.filter(q => q >= startingQ); // Only visit flags we set this run

    for (let i = 0; i < flaggedToVisit.length; i++) {
      const targetQ = flaggedToVisit[i];

      // Re-open navigator
      const navVisible = await page.locator('.fixed').last()
        .getByText('Question Navigator').isVisible({ timeout: 1500 }).catch(() => false);
      if (!navVisible) {
        await openNavigator(page);
      }

      const jumped = await jumpToQ(page, targetQ);
      if (jumped) {
        visits++;
        const qAfter = await getCurrentQ(page);
        console.log(`[NAV] Jumped to Q${targetQ}. Counter now: ${qAfter.text}`);
        await screenshot(page, `v4_11_revisit_q${targetQ}`);

        // Re-read 2s
        await page.waitForTimeout(2000);

        // Change first flagged question's answer
        if (i === 0 && !changedViaNav) {
          const prevFinal = results.trackedAnswers[targetQ]?.final || 'A';
          const prevIdx = ['A', 'B', 'C', 'D'].indexOf(prevFinal);
          const newIdx = (prevIdx + 1) % 4;
          const changed = await selectAnswer(page, newIdx);
          if (changed) {
            changedViaNav = true;
            changes++;
            results.trackedAnswers[targetQ] = {
              ...(results.trackedAnswers[targetQ] || {}),
              finalAfterReview: 'ABCD'[newIdx],
              changedInReview: true
            };
            console.log(`[NAV] Changed Q${targetQ}: ${prevFinal} → ${'ABCD'[newIdx]}`);
            await page.waitForTimeout(700);
            await screenshot(page, `v4_12_changed_q${targetQ}`);
          }
        }
      } else {
        console.log(`[NAV] Could not jump to Q${targetQ}`);
      }
      await page.waitForTimeout(700);
    }

    addStep('Navigator flagged revisit',
      visits >= Math.min(3, flaggedToVisit.length) ? 'PASS' : visits > 0 ? 'PARTIAL' : 'FAIL',
      `Visited: ${visits}/${flaggedToVisit.length}, Changed 1: ${changedViaNav}`);

    saveResults();

    // ==============================
    // 5. REVIEW SCREEN
    // ==============================
    console.log('\n[5] REVIEW SCREEN');

    // Close navigator modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);

    // Get to Q15 (last question) to show "Review →" button
    const curQ = await getCurrentQ(page);
    const lastQ = curQ.total > 0 ? curQ.total : 15;
    console.log(`[REVIEW] Currently at Q${curQ.q} of ${lastQ}`);

    if (curQ.q !== lastQ && curQ.q !== -1) {
      // Jump to last question via navigator
      const nav2 = await openNavigator(page);
      if (nav2) {
        const boxes = page.locator('.fixed button.w-10, .fixed button.w-12');
        const cnt = await boxes.count().catch(() => 0);
        if (cnt > 0) {
          await boxes.last().click();
          await page.waitForTimeout(1200);
          console.log('[REVIEW] Jumped to last question');
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }

    // Click "Review →"
    let reviewReached = false;
    const reviewArrow = page.locator('button').filter({ hasText: /^Review →$/ }).first();
    if (await reviewArrow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reviewArrow.click();
      await page.waitForTimeout(2000);
      reviewReached = true;
      console.log('[REVIEW] Clicked Review →');
    } else {
      // Try navigator → "Go to Review Screen"
      const nav3 = await openNavigator(page);
      if (nav3) {
        const gtr = page.locator('button').filter({ hasText: 'Go to Review Screen' }).first();
        if (await gtr.isVisible({ timeout: 5000 }).catch(() => false)) {
          await gtr.click();
          await page.waitForTimeout(2000);
          reviewReached = true;
          console.log('[REVIEW] Reached via Go to Review Screen');
        }
      }
    }

    await screenshot(page, 'v4_13_review');
    const revText = await page.locator('body').textContent().catch(() => '');
    const onReview = /review|answered|unanswered|submit section|submit test/i.test(revText);

    addStep('Review screen', onReview ? 'PASS' : 'FAIL',
      `Reached: ${reviewReached}, Confirmed: ${onReview}`);

    if (!onReview) {
      addFinding('High-Priority', 'Review screen not reached',
        `After Q${lastQ}, Review → not found. reviewReached=${reviewReached}`,
        '"Review →" button must appear on last MCQ question',
        'Screenshot v4_13_review.png');
    } else {
      const unanswered = revText.match(/(\d+)\s*unanswered/i)?.[0] || 'n/a';
      console.log(`[REVIEW] Unanswered: ${unanswered}`);
      results.reportCard.reviewScreen = {
        unanswered,
        textSnippet: revText.substring(0, 400)
      };
    }

    // Careful review: wait 5s
    await page.waitForTimeout(5000);
    await screenshot(page, 'v4_14_review_after_wait');

    // ==============================
    // 6. SUBMIT SECTION
    // ==============================
    console.log('\n[6] SUBMIT SECTION');

    const submitBtn = page.locator('button').filter({ hasText: /Submit Section|Submit Test|Submit Exam/ }).first();
    const subVis = await submitBtn.isVisible({ timeout: 8000 }).catch(() => false);
    const subDis = await submitBtn.isDisabled().catch(() => true);

    console.log(`[SUBMIT] Visible: ${subVis}, Disabled: ${subDis}`);

    if (subVis && !subDis) {
      await submitBtn.click();
      await page.waitForTimeout(4000);
      addStep('Submit Section', 'PASS', '');
    } else {
      addStep('Submit Section', 'FAIL', `vis=${subVis}, dis=${subDis}`);
      addFinding('High-Priority', 'Submit Section button not available',
        `Visible: ${subVis}, Disabled: ${subDis}`,
        'Review screen must have enabled Submit button',
        'Screenshot v4_13_review.png');
    }

    await screenshot(page, 'v4_15_after_submit');
  }

  // ==============================
  // 7. FRQ SECTION
  // ==============================
  console.log('\n[7] FRQ SECTION');

  const afterSubmitText = await page.locator('body').textContent().catch(() => '');
  const isFRQChoice = /free response|type your answers|write by hand/i.test(afterSubmitText);
  const isOnFRQQ = /Question \d+ of \d+/.test(afterSubmitText); // Already in FRQ questions
  const isResults = /report card|your score|mcq score/i.test(afterSubmitText);
  console.log(`[FRQ] isFRQChoice: ${isFRQChoice}, isOnFRQQ: ${isOnFRQQ}, isResults: ${isResults}`);

  if (isFRQChoice) {
    addStep('FRQ choice screen', 'PASS', '');
    await screenshot(page, 'v4_16_frq_choice');

    const typedBtn = page.locator('button').filter({ hasText: /Type Your Answers/ }).first();
    if (await typedBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await typedBtn.click();
      await page.waitForTimeout(2500);
      addStep('Choose typed FRQ', 'PASS', '');
      await screenshot(page, 'v4_17_frq_q1');

      // Type answer in each FRQ textarea
      const frqAnswers = [
        'Supply and demand equilibrium is determined by the intersection of supply and demand curves. A leftward shift in supply raises equilibrium price and reduces equilibrium quantity.',
        'Price elasticity of demand (PED) measures responsiveness of Qd to price changes. |PED| > 1 is elastic; |PED| < 1 is inelastic. Elastic goods have many substitutes.',
      ];

      for (let frqQ = 0; frqQ < 5; frqQ++) {
        // Type answer if textarea exists
        const ta = page.locator('textarea').first();
        if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
          const existingVal = await ta.inputValue().catch(() => '');
          if (!existingVal) {
            const ansText = frqAnswers[frqQ % frqAnswers.length];
            await ta.click();
            await ta.fill(ansText);
            await page.waitForTimeout(600);
            console.log(`[FRQ] Typed answer ${frqQ + 1}`);
          }
        }

        // Check for Review → (end of FRQ questions) or Submit Test
        const reviewFRQ = page.locator('button').filter({ hasText: /^Review →$/ }).first();
        const submitTest = page.locator('button').filter({ hasText: /Submit Test|Submit Exam/ }).first();

        const reviewVisible = await reviewFRQ.isVisible({ timeout: 1000 }).catch(() => false);
        const submitVisible = await submitTest.isVisible({ timeout: 1000 }).catch(() => false);

        if (submitVisible && !await submitTest.isDisabled().catch(() => true)) {
          console.log('[FRQ] Submit Test button found — clicking');
          await submitTest.click();
          await page.waitForTimeout(5000);
          addStep('Submit Test (FRQ)', 'PASS', '');
          break;
        }

        if (reviewVisible && !await reviewFRQ.isDisabled().catch(() => true)) {
          console.log('[FRQ] Review → for FRQ found — clicking');
          await reviewFRQ.click();
          await page.waitForTimeout(2000);
          await screenshot(page, 'v4_18_frq_review');

          // Now find Submit Test
          const submitAfterReview = page.locator('button').filter({ hasText: /Submit Test|Submit Exam/ }).first();
          if (await submitAfterReview.isVisible({ timeout: 8000 }).catch(() => false)) {
            await submitAfterReview.click();
            await page.waitForTimeout(5000);
            addStep('Submit Test (from FRQ review)', 'PASS', '');
          }
          break;
        }

        // Otherwise, go next
        const moved = await clickNext(page);
        if (!moved) {
          console.log(`[FRQ] No next/submit on iteration ${frqQ}`);
          break;
        }
        await page.waitForTimeout(1500);
      }

      await screenshot(page, 'v4_19_after_frq');
    } else {
      addStep('FRQ typed choice', 'FAIL', '"Type Your Answers" button not found');
      addFinding('Medium-Priority', '"Type Your Answers" button not found on FRQ choice screen',
        'No button with text "Type Your Answers" on FRQ choice screen',
        'FRQ choice screen should offer typed and handwritten options',
        'Screenshot v4_16_frq_choice.png');
    }
  } else if (isOnFRQQ) {
    // Already on FRQ questions (session resumed to FRQ section)
    addStep('FRQ section', 'PARTIAL', 'Already on FRQ questions — skipping FRQ choice screen');
    addNote('Session resumed to FRQ question section directly');

    // Type into first textarea and navigate to Submit
    for (let frqQ = 0; frqQ < 5; frqQ++) {
      const ta = page.locator('textarea').first();
      if (await ta.isVisible({ timeout: 2000 }).catch(() => false)) {
        const val = await ta.inputValue().catch(() => '');
        if (!val) {
          await ta.click();
          await ta.fill('Economic equilibrium occurs where supply equals demand. Price signals coordinate economic activity and allocate resources efficiently in competitive markets.');
          await page.waitForTimeout(600);
        }
      }

      const submitTest = page.locator('button').filter({ hasText: /Submit Test|Submit Exam/ }).first();
      if (await submitTest.isVisible({ timeout: 1000 }).catch(() => false)) {
        await submitTest.click();
        await page.waitForTimeout(5000);
        addStep('Submit Test (from FRQ)', 'PASS', '');
        break;
      }

      const reviewFRQ = page.locator('button').filter({ hasText: /^Review →$/ }).first();
      if (await reviewFRQ.isVisible({ timeout: 1000 }).catch(() => false)) {
        await reviewFRQ.click();
        await page.waitForTimeout(2000);
        const submitAfter = page.locator('button').filter({ hasText: /Submit Test|Submit Exam/ }).first();
        if (await submitAfter.isVisible({ timeout: 8000 }).catch(() => false)) {
          await submitAfter.click();
          await page.waitForTimeout(5000);
          addStep('Submit Test (FRQ review)', 'PASS', '');
        }
        break;
      }

      const moved = await clickNext(page);
      if (!moved) break;
      await page.waitForTimeout(1500);
    }
  } else if (isResults) {
    addStep('FRQ section', 'SKIP', 'Already on results page');
  } else {
    addStep('FRQ section', 'SKIP', `Unknown state after MCQ submit. Text: ${afterSubmitText.substring(0, 150)}`);
  }

  // Wait for navigation to results
  await page.waitForTimeout(4000);

  // ==============================
  // 8. REPORT CARD
  // ==============================
  console.log('\n[8] REPORT CARD');

  const finalUrl = page.url();
  const finalText = await page.locator('body').textContent().catch(() => '');
  await screenshot(page, 'v4_20_results');

  const isResultsPage = finalUrl.includes('/results/');
  const hasReport = /score|report card|correct|incorrect|mcq|performance/i.test(finalText);
  const hasScore = /\d+\s*\/\s*\d+|\d+%|mcq score/i.test(finalText);
  const hasMCQTable = /question|your answer|correct/i.test(finalText);
  const hasAPScore = /AP\s*score|projection|band/i.test(finalText);
  const hasDomain = /domain|unit|performance by/i.test(finalText);
  const hasFlaggedSection = /flag|flagged for review|marked for review/i.test(finalText);

  console.log(`[RESULTS] URL: ${finalUrl}`);
  console.log(`[RESULTS] isResultsPage: ${isResultsPage}, hasReport: ${hasReport}`);
  console.log(`[RESULTS] score: ${hasScore}, MCQTable: ${hasMCQTable}, AP: ${hasAPScore}, domain: ${hasDomain}`);
  console.log(`[RESULTS] flaggedSection: ${hasFlaggedSection} (placed ${flags} flags)`);

  results.reportCard = {
    url: finalUrl,
    isResultsPage,
    hasReport,
    hasScore,
    hasMCQTable,
    hasAPScore,
    hasDomain,
    hasFlaggedSection,
    textSnippet: finalText.substring(0, 1000)
  };

  addStep('Report card',
    isResultsPage && hasReport ? 'PASS' : hasReport ? 'PARTIAL' : 'FAIL',
    `URL: /results/: ${isResultsPage}, Content: ${hasReport}`);

  if (!hasReport) {
    addFinding('Blocker', 'Report card did not load after test submission',
      `URL: ${finalUrl}. No report card content. Text: ${finalText.substring(0, 300)}`,
      'After test submission, app should navigate to /ap/results/:resultId with report card',
      'Screenshot v4_20_results.png');
  } else {
    if (!hasScore) {
      addFinding('Medium-Priority', 'MCQ score not displayed on report card',
        'Report card loaded but no score (X/15 or %) found in text',
        'Report card should show MCQ score prominently',
        'Screenshot v4_20_results.png');
    }

    if (!hasMCQTable) {
      addFinding('Medium-Priority', 'MCQ per-question breakdown not on report card',
        'No question-level correct/incorrect breakdown found',
        'Report card should include MCQ table showing each question result',
        'Screenshot v4_20_results.png');
    }

    if (flags > 0 && !hasFlaggedSection) {
      addFinding('High-Priority', 'Flagged for Review section absent from report card',
        `Student flagged ${flags} questions. Report card has no "Flagged for Review" section.`,
        'Report card should show which questions were flagged during the test',
        'Consistent with B3-001: flaggedQuestions not saved to result document');
    }

    addStep('Report card content',
      (hasScore && hasMCQTable) ? 'PASS' : (hasScore || hasMCQTable) ? 'PARTIAL' : 'FAIL',
      `Score: ${hasScore}, MCQ table: ${hasMCQTable}, AP: ${hasAPScore}, Domain: ${hasDomain}, Flagged: ${hasFlaggedSection}`);
  }

  // Scroll to verify full content
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(800);
  await screenshot(page, 'v4_21_results_scrolled');

  // ==============================
  // SAVE FINAL RESULTS
  // ==============================
  results.consoleErrors = consoleErrors;
  results.completedAt = new Date().toISOString();
  results.summary = {
    questionsAnswered: answered,
    flagsPlaced: flags,
    answersChanged: changes,
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
  console.log('\n[DONE]', JSON.stringify(results.summary, null, 2));

  const blockers = results.findings.filter(f => f.severity === 'Blocker');
  if (blockers.length > 0) {
    throw new Error(`BLOCKERS: ${blockers.map(b => b.title).join(' | ')}`);
  }
});
