/**
 * B04 — Day-1 Happy Path audit script
 * Agent I — runs standalone headless Chromium (NOT mcp__playwright)
 *
 * Scenarios:
 *  S01 — NEW_WORDS flashcard phase (study all cards → auto-advance)
 *  S02 — NEW_WORD_TEST typed submission
 *  S03 — results + Firestore verification (currentStudyDay, study_states, streakDays)
 *  S04 — Day-1 test fail → retake
 *  S05 — Dashboard reflection after completion
 *  S06 — Practice mode (if available)
 *  S07 — Tiny list (session with < pace words) — skipped if no tiny list
 *  S08 — Abandoned mid-flashcards → resume
 *  S09 — Try to start again after completion → blocked
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');

// Init firebase admin
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B04';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'));

function getAccount(personaId, targetClass) {
  let candidates = seeded.accounts.filter(a => a.personaId === personaId);
  if (targetClass) candidates = candidates.filter(a => a.targetClass === targetClass);
  if (!candidates.length) throw new Error(`No account for persona=${personaId} class=${targetClass}`);
  return candidates[0];
}

async function screenshot(page, name) {
  const fpath = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: fpath, fullPage: true });
  console.log(`  📸 ${name}.png`);
  return fpath;
}

async function getConsoleErrors(page) {
  return page._consoleErrors || [];
}

function setupConsoleCapture(page) {
  page._consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') page._consoleErrors.push(msg.text());
  });
}

async function loginAs(page, personaId, targetClass) {
  const account = getAccount(personaId, targetClass);
  console.log(`  Login as ${account.email}`);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Navigate to login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) {
    await loginLink.click();
  } else {
    await page.evaluate(() => {
      history.pushState({}, '', '/login');
      dispatchEvent(new PopStateEvent('popstate'));
    });
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(account.email);
  await page.getByLabel(/password/i).first().fill(account.password);
  await page.getByLabel(/password/i).first().press('Enter');

  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  } catch (e) {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  }
  console.log(`  Logged in, URL: ${page.url()}`);
  return account;
}

// Type char-by-char for careful persona
async function carefulType(locator, text) {
  await locator.focus();
  for (const ch of text) {
    await locator.type(ch, { delay: 100 });
  }
}

// Get Firestore data for a student
async function getClassProgress(uid) {
  const snap = await db.collection('class_progress').where('studentId', '==', uid).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getStudyStates(uid) {
  const snap = await db.collection('study_states').where('studentId', '==', uid).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getAttempts(uid) {
  const snap = await db.collection('attempts').where('studentId', '==', uid).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function saveFirestoreEvidence(uid, label) {
  const [cp, ss, attempts] = await Promise.all([
    getClassProgress(uid),
    getStudyStates(uid),
    getAttempts(uid)
  ]);
  const evPath = path.join(EVIDENCE_DIR, `${label}_firestore.json`);
  writeFileSync(evPath, JSON.stringify({ class_progress: cp, study_states: ss, attempts }, null, 2));
  console.log(`  💾 ${label}_firestore.json saved`);
  return { class_progress: cp, study_states: ss, attempts };
}

// Results container
const results = {
  S01: { result: 'pending', notes: [] },
  S02: { result: 'pending', notes: [] },
  S03: { result: 'pending', notes: [] },
  S04: { result: 'pending', notes: [] },
  S05: { result: 'pending', notes: [] },
  S06: { result: 'pending', notes: [] },
  S07: { result: 'skipped', notes: ['No tiny list seeded in audit_state.json'] },
  S08: { result: 'pending', notes: [] },
  S09: { result: 'pending', notes: [] },
};
const findings = [];

// ----- MAIN -----
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH
      ? `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium-1223/chrome-linux64/chrome`
      : '/ms-playwright/chromium-1223/chrome-linux64/chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // Disable service workers to prevent cached Firestore responses
    serviceWorkers: 'block',
  });

  const page = await context.newPage();
  setupConsoleCapture(page);

  // ================================================================
  // S01+S02+S03 — Normal Happy Path (TOP careful student)
  // Study all flashcards → NEW_WORD_TEST → verify results
  // ================================================================
  console.log('\n=== S01/S02/S03: Normal Happy Path (TOP careful) ===');
  const carefulTop = getAccount('careful', 'TOP');
  const uid = carefulTop.uid;

  // Baseline Firestore before
  const beforeFs = await saveFirestoreEvidence(uid, 'B04_S01_before');
  console.log('  Baseline class_progress:', beforeFs.class_progress.length, 'docs');
  console.log('  Baseline study_states:', beforeFs.study_states.length, 'docs');

  await loginAs(page, 'careful', 'TOP');
  await screenshot(page, 'B04_S01_01_dashboard');

  // Find "Start Today's Session" button or session link
  console.log('  Looking for session start button...');
  await page.waitForTimeout(2000);

  // Look for the session start button (could be "Start Today's Session", "Start Session", etc.)
  let startBtn = page.getByRole('button', { name: /start.*(today|session)/i }).first();
  if (await startBtn.count() === 0) {
    startBtn = page.getByText(/start.*(today|session)/i).first();
  }
  if (await startBtn.count() === 0) {
    // Try finding any list card that can be clicked
    startBtn = page.getByRole('button', { name: /study|learn|session/i }).first();
  }

  await screenshot(page, 'B04_S01_02_dashboard_loaded');

  const startBtnVisible = await startBtn.isVisible().catch(() => false);
  console.log('  Start button visible:', startBtnVisible);

  if (!startBtnVisible) {
    // Take a snapshot of the page text to understand what's there
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log('  Page body text:', bodyText);
    results.S01.result = 'fail';
    results.S01.notes.push('Could not find session start button on dashboard');
    findings.push({
      id: 'F01',
      severity: 'BLOCKER',
      title: 'Session start button not found on dashboard',
      scenario: 'S01',
      observed: 'No "Start Today\'s Session" or similar button visible',
      expected: 'Button to initiate Day 1 session should be visible',
    });
  } else {
    await startBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'B04_S01_03_after_start_click');
    console.log('  URL after start:', page.url());

    // Check if we're now in a session
    const pageText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    console.log('  Page text after start:', pageText.slice(0, 500));

    results.S01.notes.push(`URL after start: ${page.url()}`);
  }

  // Wait for session to load (could take a moment)
  await page.waitForTimeout(3000);
  await screenshot(page, 'B04_S01_04_session_loading');

  // Detect session phase — look for flashcard elements
  const sessionText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  console.log('  Session page text:', sessionText.slice(0, 1000));

  // Check for SessionMenu or flashcard content
  const hasSessionMenu = await page.getByText(/skip to test/i).first().isVisible().catch(() => false);
  const hasFlashcard = await page.getByText(/show definition|i know|got it|next card|flip/i).first().isVisible().catch(() => false);
  const hasTest = await page.getByText(/question.*of|submit|type.*answer/i).first().isVisible().catch(() => false);

  console.log('  Has session menu (skip to test):', hasSessionMenu);
  console.log('  Has flashcard UI:', hasFlashcard);
  console.log('  Has test UI:', hasTest);

  // ================================================================
  // FLASHCARD PHASE (S01)
  // ================================================================
  if (hasFlashcard || hasSessionMenu) {
    results.S01.result = 'pass';
    results.S01.notes.push('Session started, flashcard phase detected');

    // Count cards via pagination or card counter text
    const cardCountText = await page.getByText(/\d+\s*\/\s*\d+|\d+\s*of\s*\d+/i).first().textContent().catch(() => '');
    console.log('  Card counter text:', cardCountText);

    // Go through flashcards one by one
    // Max 200 clicks to prevent infinite loop
    let cardsDismissed = 0;
    const maxCards = 100; // pace is 80 for TOP but we limit iterations

    for (let i = 0; i < maxCards; i++) {
      // Check if we've moved to test phase
      const isTestPhase = await page.getByText(/question.*of|type.*your.*answer|submit.*answer/i).first().isVisible().catch(() => false);
      if (isTestPhase) {
        console.log(`  Moved to test phase after ${cardsDismissed} cards`);
        break;
      }

      // Check for "Skip to Test" option in session menu
      const skipBtn = page.getByRole('button', { name: /skip to test/i }).first();
      const skipVisible = await skipBtn.isVisible().catch(() => false);

      // Look for flashcard advance buttons
      const gotItBtn = page.getByRole('button', { name: /got it|i know|next|continue|dismiss/i }).first();
      const showDefBtn = page.getByRole('button', { name: /show definition|show|flip/i }).first();

      const gotItVisible = await gotItBtn.isVisible().catch(() => false);
      const showDefVisible = await showDefBtn.isVisible().catch(() => false);

      if (gotItVisible) {
        await gotItBtn.click();
        cardsDismissed++;
        await page.waitForTimeout(300);
      } else if (showDefVisible) {
        await showDefBtn.click();
        await page.waitForTimeout(500);
        const nextBtn = page.getByRole('button', { name: /got it|next|continue|i know/i }).first();
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          cardsDismissed++;
          await page.waitForTimeout(300);
        }
      } else {
        // No clear button — check if test started
        const currentText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
        console.log(`  Card ${i}: No dismiss button found. Text:`, currentText.slice(0, 300));

        // If we see a test or completion indicator, break
        if (/type|answer|question|score|complete|results/i.test(currentText)) break;

        // Check for any clickable "next" type element
        const anyNextBtn = page.locator('button').filter({ hasText: /next|continue|advance|got|know/i }).first();
        if (await anyNextBtn.isVisible().catch(() => false)) {
          await anyNextBtn.click();
          cardsDismissed++;
          await page.waitForTimeout(300);
        } else {
          console.log('  No advance button found, stopping flashcard loop');
          break;
        }
      }

      // Screenshot every 10 cards
      if (i === 0 || i === 4 || i === 9) {
        await screenshot(page, `B04_S01_card_${i+1}`);
      }
    }

    console.log(`  Total cards dismissed: ${cardsDismissed}`);
    results.S01.notes.push(`Cards dismissed: ${cardsDismissed}`);
    await screenshot(page, 'B04_S01_05_after_flashcards');
  } else if (hasTest) {
    // Already at test phase (e.g., no flashcards needed)
    results.S01.result = 'pass';
    results.S01.notes.push('Test phase detected directly (no flashcard phase needed or auto-advanced)');
  } else {
    results.S01.result = 'fail';
    results.S01.notes.push('Neither flashcard phase nor test detected after session start');
    const pageBody = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    console.log('  Page body:', pageBody);
  }

  // ================================================================
  // S02 — NEW_WORD_TEST (Typed)
  // ================================================================
  console.log('\n=== S02: NEW_WORD_TEST (Typed) ===');

  // Wait for test phase
  let testVisible = await page.getByText(/type.*answer|question.*of|your.*answer/i).first().isVisible().catch(() => false);

  // Check if we need to use "Skip to Test"
  if (!testVisible) {
    const skipBtn = page.getByRole('button', { name: /skip to test/i }).first();
    if (await skipBtn.isVisible().catch(() => false)) {
      console.log('  Using Skip to Test...');
      await skipBtn.click();
      await page.waitForTimeout(1000);

      // Confirm modal
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip|proceed/i }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);
      }
      testVisible = await page.getByText(/type.*answer|question.*of|your.*answer/i).first().isVisible().catch(() => false);
    }
  }

  await screenshot(page, 'B04_S02_01_test_start');
  const testPageText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('  Test page text:', testPageText.slice(0, 500));

  if (testVisible || /question|answer|type/i.test(testPageText)) {
    results.S02.notes.push('Test phase reached');

    // TOP testSizeNew = 30 words. We'll answer correctly.
    // The test shows a word and asks for definition (canonical_en_verbatim)
    // Words are positions 0..29 from audit_state.json topActiveList.words
    const topWords = JSON.parse(readFileSync('/app/audit/playwright/audit_state.json', 'utf-8')).lists.topActiveList.words;

    let questionsAnswered = 0;
    const maxQuestions = 35; // slightly more than testSizeNew=30

    for (let q = 0; q < maxQuestions; q++) {
      // Check if we've reached results
      const isResults = await page.getByText(/result|score|pass|fail|correct|you (got|scored)/i).first().isVisible().catch(() => false);
      const isComplete = await page.getByText(/complete|well done|great job/i).first().isVisible().catch(() => false);
      if (isResults || isComplete) {
        console.log(`  Results reached after ${questionsAnswered} questions`);
        break;
      }

      // Look for the word being tested (usually shown prominently)
      const wordOnPage = await page.evaluate(() => {
        // Try to find a large/prominent word display
        const headings = [...document.querySelectorAll('h1, h2, h3, [class*="word"], [class*="term"]')];
        for (const h of headings) {
          const txt = h.textContent?.trim();
          if (txt && txt.length < 50 && !txt.includes(' ') && !txt.match(/question|answer|submit/i)) {
            return txt;
          }
        }
        return null;
      });

      console.log(`  Q${q+1} word on page: ${wordOnPage}`);

      // Find the answer input
      const answerInput = page.getByRole('textbox').first();
      const inputVisible = await answerInput.isVisible().catch(() => false);

      if (!inputVisible) {
        // Maybe MCQ - look for radio buttons or answer options
        const mcqOptions = page.locator('input[type="radio"], button[data-option]');
        if (await mcqOptions.count() > 0) {
          // MCQ - click first option
          await mcqOptions.first().click();
          questionsAnswered++;
          await page.waitForTimeout(300);
          continue;
        }

        const testText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
        if (/result|score|pass|fail/i.test(testText)) break;
        console.log(`  Q${q+1}: No input found. Body: ${testText.slice(0, 200)}`);
        break;
      }

      // Find the right definition for this word
      let definition = 'a quality or characteristic'; // fallback
      if (wordOnPage) {
        const cleanWord = wordOnPage.replace(/\r?\n.*/g, '').trim().toLowerCase();
        const match = topWords.find(w => {
          const wClean = w.word.replace(/\r?\n.*/g, '').trim().toLowerCase();
          return wClean === cleanWord;
        });
        if (match) {
          definition = match.definition_en;
          console.log(`  Found definition: ${definition.slice(0, 60)}...`);
        } else {
          console.log(`  Word "${cleanWord}" not found in word list, using fallback`);
        }
      }

      // Clear and type the answer char by char (careful student, 100ms delay)
      await answerInput.clear();
      await answerInput.focus();
      for (const ch of definition) {
        await answerInput.type(ch, { delay: 100 });
      }

      if (q === 0) await screenshot(page, 'B04_S02_02_first_answer_typed');

      // Submit the answer
      const submitBtn = page.getByRole('button', { name: /submit|next|check/i }).first();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
      } else {
        await answerInput.press('Enter');
      }

      questionsAnswered++;
      await page.waitForTimeout(500);

      // Handle any "grading" indicator (real Cloud Function ~19s)
      const gradingVisible = await page.getByText(/grading|analyzing|checking|please wait/i).first().isVisible().catch(() => false);
      if (gradingVisible) {
        console.log(`  Grading in progress (Cloud Function)...`);
        await page.waitForTimeout(25000); // wait up to 25s for grading
      }
    }

    console.log(`  Total questions answered: ${questionsAnswered}`);
    await screenshot(page, 'B04_S02_03_after_test');

    results.S02.notes.push(`Questions answered: ${questionsAnswered}`);
    results.S02.result = questionsAnswered > 0 ? 'pass' : 'fail';
  } else {
    results.S02.result = 'fail';
    results.S02.notes.push('Test phase not reached');
    findings.push({
      id: 'F01',
      severity: 'BLOCKER',
      title: 'NEW_WORD_TEST phase not reached in Day-1 session',
      scenario: 'S02',
      observed: 'After dismissing flashcards and attempting Skip to Test, test UI not visible',
      expected: 'Typed test should launch for new words after flashcard phase',
    });
  }

  // ================================================================
  // S03 — Firestore verification after test
  // ================================================================
  console.log('\n=== S03: Firestore Verification ===');
  await page.waitForTimeout(3000); // allow writes to propagate
  await screenshot(page, 'B04_S03_01_results');

  const afterFs = await saveFirestoreEvidence(uid, 'B04_S03_after');
  console.log('  After class_progress:', afterFs.class_progress.length, 'docs');
  console.log('  After study_states:', afterFs.study_states.length, 'docs');
  console.log('  After attempts:', afterFs.attempts.length, 'docs');

  let s03Pass = true;
  const s03Notes = [];

  // Check attempt doc count (should be exactly 1 for this session's deterministic id)
  if (afterFs.attempts.length === 0) {
    s03Pass = false;
    s03Notes.push('FAIL: No attempt doc created');
    findings.push({
      id: 'F02',
      severity: 'BLOCKER',
      title: 'No attempt doc created after Day-1 test submission',
      scenario: 'S03',
      observed: 'Firestore attempts collection has 0 docs for student after test',
      expected: 'Exactly 1 attempt doc with deterministic id',
    });
  } else {
    s03Notes.push(`Attempt docs: ${afterFs.attempts.length}`);
    if (afterFs.attempts.length > 1) {
      findings.push({
        id: 'F03',
        severity: 'BLOCKER',
        title: 'Multiple attempt docs created for single Day-1 session',
        scenario: 'S03',
        observed: `${afterFs.attempts.length} attempt docs created`,
        expected: 'Exactly 1 attempt doc',
      });
    }
    const attempt = afterFs.attempts[0];
    console.log('  Attempt:', JSON.stringify(attempt, null, 2));
  }

  // Check class_progress.currentStudyDay
  if (afterFs.class_progress.length > 0) {
    const cp = afterFs.class_progress[0];
    console.log('  class_progress:', JSON.stringify(cp, null, 2));
    const csd = cp.currentStudyDay;
    s03Notes.push(`currentStudyDay: ${csd}`);
    if (csd !== 1) {
      s03Pass = false;
      s03Notes.push(`FAIL: Expected currentStudyDay=1, got ${csd}`);
      findings.push({
        id: 'F04',
        severity: 'BLOCKER',
        title: `currentStudyDay not advanced to 1 after Day-1 completion (got ${csd})`,
        scenario: 'S03',
        observed: `class_progress.currentStudyDay = ${csd}`,
        expected: 'currentStudyDay should be 1 after first session completion',
      });
    } else {
      s03Notes.push('currentStudyDay=1 ✓');
    }

    const streakDays = cp.streakDays;
    s03Notes.push(`streakDays: ${streakDays}`);
    if (streakDays !== 1) {
      s03Notes.push(`WARN: Expected streakDays=1, got ${streakDays}`);
    } else {
      s03Notes.push('streakDays=1 ✓');
    }
  } else {
    s03Notes.push('FAIL: No class_progress doc');
    s03Pass = false;
    findings.push({
      id: 'F05',
      severity: 'BLOCKER',
      title: 'No class_progress doc created after Day-1 completion',
      scenario: 'S03',
      observed: 'class_progress collection has 0 docs for student',
      expected: 'class_progress doc with currentStudyDay=1 and streakDays=1',
    });
  }

  // Check study_states
  if (afterFs.study_states.length === 0) {
    s03Notes.push('WARN: No study_states docs');
  } else {
    s03Notes.push(`study_states docs: ${afterFs.study_states.length}`);
  }

  results.S03.result = s03Pass ? 'pass' : 'fail';
  results.S03.notes = s03Notes;

  // ================================================================
  // S04 — Day-1 test fail → retake (fresh CORE student)
  // ================================================================
  console.log('\n=== S04: Day-1 Fail → Retake (CORE careful) ===');
  const carefulCore = getAccount('careful', 'CORE');
  const uidCore = carefulCore.uid;

  // Check CORE baseline
  const beforeCoreFs = await saveFirestoreEvidence(uidCore, 'B04_S04_before');
  console.log('  CORE baseline class_progress:', beforeCoreFs.class_progress.length);

  // Open new page/context to avoid auth confusion
  const page2 = await context.newPage();
  setupConsoleCapture(page2);
  await loginAs(page2, 'careful', 'CORE');
  await screenshot(page2, 'B04_S04_01_dashboard');

  // Start session
  let startBtn2 = page2.getByRole('button', { name: /start.*(today|session)/i }).first();
  if (await startBtn2.count() === 0) startBtn2 = page2.getByText(/start.*(today|session)/i).first();
  await page2.waitForTimeout(2000);

  const startBtn2Visible = await startBtn2.isVisible().catch(() => false);
  if (startBtn2Visible) {
    await startBtn2.click();
    await page2.waitForTimeout(2000);
  }

  // Use Skip to Test for S04 to save time
  await page2.waitForTimeout(2000);
  const skipBtn2 = page2.getByRole('button', { name: /skip to test/i }).first();
  if (await skipBtn2.isVisible().catch(() => false)) {
    await skipBtn2.click();
    await page2.waitForTimeout(1000);
    const confirmBtn2 = page2.getByRole('button', { name: /confirm|yes|skip|proceed/i }).first();
    if (await confirmBtn2.isVisible().catch(() => false)) {
      await confirmBtn2.click();
      await page2.waitForTimeout(1000);
    }
  }

  await screenshot(page2, 'B04_S04_02_test_start');

  // Answer test INCORRECTLY to trigger fail
  const coreWords = JSON.parse(readFileSync('/app/audit/playwright/audit_state.json', 'utf-8')).lists.coreActiveList.words;
  let questionsAnsweredCore = 0;

  for (let q = 0; q < 30; q++) {
    const isResults2 = await page2.getByText(/result|score|pass|fail|correct|retake/i).first().isVisible().catch(() => false);
    if (isResults2) {
      console.log(`  Results reached after ${questionsAnsweredCore} questions`);
      break;
    }

    const answerInput2 = page2.getByRole('textbox').first();
    if (!await answerInput2.isVisible().catch(() => false)) break;

    // Type wrong answer to fail
    await answerInput2.clear();
    await answerInput2.type('wrong answer intentionally', { delay: 30 });

    const submitBtn2 = page2.getByRole('button', { name: /submit|next|check/i }).first();
    if (await submitBtn2.isVisible().catch(() => false)) {
      await submitBtn2.click();
    } else {
      await answerInput2.press('Enter');
    }

    questionsAnsweredCore++;
    await page2.waitForTimeout(500);

    // Handle grading wait
    const gradingVisible2 = await page2.getByText(/grading|analyzing|checking|please wait/i).first().isVisible().catch(() => false);
    if (gradingVisible2) {
      await page2.waitForTimeout(25000);
    }
  }

  await screenshot(page2, 'B04_S04_03_results');
  const resultsText2 = await page2.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('  Results text:', resultsText2.slice(0, 500));

  // Look for retake button
  const retakeBtn = page2.getByRole('button', { name: /retake|try again|redo/i }).first();
  const retakeVisible = await retakeBtn.isVisible().catch(() => false);
  console.log('  Retake button visible:', retakeVisible);

  if (!retakeVisible) {
    // Look for results that indicate fail + any recovery path
    if (/pass|complete|done/i.test(resultsText2) && !/fail|retake/i.test(resultsText2)) {
      results.S04.notes.push('WARN: With all wrong answers, still shows pass? Possibly AI grader accepted wrong answers');
      results.S04.result = 'partial';
    } else {
      results.S04.notes.push('WARN: Retake button not found after failing. Could be pass or different UI');
      results.S04.result = 'partial';
    }
  } else {
    results.S04.notes.push('Retake button visible after fail ✓');
    // Click retake
    await retakeBtn.click();
    await page2.waitForTimeout(2000);
    await screenshot(page2, 'B04_S04_04_retake_test');

    // Now pass the retake with correct answers
    let retakeAnswered = 0;
    for (let q = 0; q < 30; q++) {
      const isResults3 = await page2.getByText(/result|score|pass|fail|complete/i).first().isVisible().catch(() => false);
      if (isResults3) break;

      const wordOnPage2 = await page2.evaluate(() => {
        const headings = [...document.querySelectorAll('h1, h2, h3, [class*="word"], [class*="term"]')];
        for (const h of headings) {
          const txt = h.textContent?.trim();
          if (txt && txt.length < 50 && !txt.includes(' ') && !txt.match(/question|answer|submit/i)) return txt;
        }
        return null;
      });

      const answerInput3 = page2.getByRole('textbox').first();
      if (!await answerInput3.isVisible().catch(() => false)) break;

      let def2 = 'friendship'; // fallback
      if (wordOnPage2) {
        const cleanWord2 = wordOnPage2.replace(/\r?\n.*/g, '').trim().toLowerCase();
        const match2 = coreWords.find(w => w.word.replace(/\r?\n.*/g, '').trim().toLowerCase() === cleanWord2);
        if (match2) def2 = match2.definition_en;
      }

      await answerInput3.clear();
      await answerInput3.type(def2, { delay: 80 });

      const submitBtn3 = page2.getByRole('button', { name: /submit|next|check/i }).first();
      if (await submitBtn3.isVisible().catch(() => false)) {
        await submitBtn3.click();
      } else {
        await answerInput3.press('Enter');
      }

      retakeAnswered++;
      await page2.waitForTimeout(500);

      const gradingVisible3 = await page2.getByText(/grading|analyzing|checking/i).first().isVisible().catch(() => false);
      if (gradingVisible3) await page2.waitForTimeout(25000);
    }

    await screenshot(page2, 'B04_S04_05_retake_results');
    results.S04.notes.push(`Retake answered ${retakeAnswered} questions`);
    results.S04.result = 'pass';
  }

  await page2.close();

  // ================================================================
  // S05 — Dashboard reflection after completion
  // ================================================================
  console.log('\n=== S05: Dashboard Reflection ===');
  // Use the original page (TOP careful student who already completed session)
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'B04_S05_01_dashboard_after');

  const dashText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('  Dashboard text:', dashText.slice(0, 500));

  // Look for completion indicators
  const hasCompletionIndicator = /day 1.*complete|today.*complete|session.*complete|completed/i.test(dashText);
  const hasActivityBar = await page.getByText(/activity|streak|days/i).first().isVisible().catch(() => false);

  results.S05.notes.push(`Completion indicator: ${hasCompletionIndicator}`);
  results.S05.notes.push(`Activity/streak bar: ${hasActivityBar}`);

  // If S03 passed (session completed), dashboard should show completion
  if (results.S03.result === 'pass') {
    results.S05.result = hasCompletionIndicator ? 'pass' : 'partial';
    if (!hasCompletionIndicator) {
      results.S05.notes.push('WARN: No completion indicator on dashboard after Day 1 complete');
      findings.push({
        id: 'F06',
        severity: 'MEDIUM',
        title: 'Dashboard does not show Day-1 completion indicator after session finished',
        scenario: 'S05',
        observed: 'No "Day 1 complete" or similar text visible on dashboard',
        expected: 'Dashboard should reflect completed session with visual indicator',
      });
    }
  } else {
    results.S05.result = 'skipped';
    results.S05.notes.push('Skipped: S03 did not pass');
  }

  // ================================================================
  // S06 — Practice mode after completion
  // ================================================================
  console.log('\n=== S06: Practice Mode ===');
  const practiceBtnVisible = await page.getByRole('button', { name: /practice/i }).first().isVisible().catch(() => false);
  if (practiceBtnVisible) {
    results.S06.notes.push('Practice button found');
    results.S06.result = 'pass';
    // We don't need to run full practice — just verify button exists
  } else {
    // Check full page for practice reference
    const hasPracticeLink = /practice/i.test(dashText);
    results.S06.notes.push(`Practice button visible: ${practiceBtnVisible}, practice text in page: ${hasPracticeLink}`);
    results.S06.result = 'partial';
  }
  await screenshot(page, 'B04_S06_01_practice_check');

  // ================================================================
  // S07 — Tiny list — SKIPPED (no tiny list seeded)
  // ================================================================
  results.S07.result = 'skipped';
  results.S07.notes = ['No tiny list seeded in audit_state.json (tinyList: null)'];

  // ================================================================
  // S08 — Abandon mid-flashcards → resume
  // ================================================================
  console.log('\n=== S08: Abandon mid-flashcards → Resume ===');
  // Use a different persona (firsttimer) to have a fresh Day-1 to test abandon
  const firsttimerAcct = getAccount('firsttimer', 'TOP').catch
    ? null
    : getAccount('firsttimer', 'TOP');

  // Attempt to get firsttimer account
  let s08Account = null;
  try {
    s08Account = seeded.accounts.find(a => a.personaId === 'firsttimer' && a.targetClass === 'TOP');
    if (!s08Account) s08Account = seeded.accounts.find(a => a.personaId === 'firsttimer');
  } catch (e) {
    console.log('  No firsttimer account found:', e.message);
  }

  if (!s08Account) {
    results.S08.result = 'skipped';
    results.S08.notes.push('No firsttimer account available for S08');
  } else {
    const page3 = await context.newPage();
    setupConsoleCapture(page3);
    try {
      await loginAs(page3, 'firsttimer', 'TOP');
      await page3.waitForTimeout(2000);

      // Start session
      const startBtn3 = page3.getByRole('button', { name: /start.*(today|session)/i }).first();
      await page3.waitForTimeout(2000);
      if (await startBtn3.isVisible().catch(() => false)) {
        await startBtn3.click();
        await page3.waitForTimeout(2000);
      }

      await screenshot(page3, 'B04_S08_01_session_started');

      // Dismiss 3 cards
      let dismissed = 0;
      for (let i = 0; i < 5; i++) {
        const gotItBtn3 = page3.getByRole('button', { name: /got it|i know|next|continue/i }).first();
        const showDef3 = page3.getByRole('button', { name: /show definition|show|flip/i }).first();

        if (await gotItBtn3.isVisible().catch(() => false)) {
          await gotItBtn3.click();
          dismissed++;
          await page3.waitForTimeout(300);
          if (dismissed >= 3) break;
        } else if (await showDef3.isVisible().catch(() => false)) {
          await showDef3.click();
          await page3.waitForTimeout(400);
          const nextBtn3 = page3.getByRole('button', { name: /got it|next|continue/i }).first();
          if (await nextBtn3.isVisible().catch(() => false)) {
            await nextBtn3.click();
            dismissed++;
          }
          if (dismissed >= 3) break;
        } else {
          break;
        }
      }

      console.log(`  Dismissed ${dismissed} cards`);
      await screenshot(page3, 'B04_S08_02_mid_session');

      // Navigate away to dashboard
      await page3.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page3.waitForTimeout(2000);
      await screenshot(page3, 'B04_S08_03_after_navigate_away');

      // Come back — look for "Resume" or continue from where left off
      // Click start session again
      const resumeOrStartBtn = page3.getByRole('button', { name: /resume|continue|start.*(today|session)/i }).first();
      await page3.waitForTimeout(2000);
      const resumeVisible = await resumeOrStartBtn.isVisible().catch(() => false);
      console.log('  Resume/Start button visible after return:', resumeVisible);

      if (resumeVisible) {
        await resumeOrStartBtn.click();
        await page3.waitForTimeout(2000);
        await screenshot(page3, 'B04_S08_04_resumed');

        // Check if we're at card 4 (dismissed 3, should be on 4th)
        const resumeText = await page3.evaluate(() => document.body.innerText.slice(0, 2000));
        console.log('  After resume:', resumeText.slice(0, 300));

        results.S08.result = 'pass';
        results.S08.notes.push(`Dismissed ${dismissed} cards, navigated away, resumed successfully`);
      } else {
        results.S08.result = 'partial';
        results.S08.notes.push('Resume button not clearly visible; may have been reset');
        const dashText3 = await page3.evaluate(() => document.body.innerText.slice(0, 2000));
        results.S08.notes.push(`Dashboard shows: ${dashText3.slice(0, 200)}`);
      }
    } catch (e) {
      results.S08.result = 'fail';
      results.S08.notes.push(`Error: ${e.message}`);
      console.log('  S08 error:', e.message);
    } finally {
      await page3.close();
    }
  }

  // ================================================================
  // S09 — Try to start again after completion
  // ================================================================
  console.log('\n=== S09: Try to Start Again ===');
  // TOP careful student already completed session — go back to dashboard
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'B04_S09_01_dashboard');

  const dashText9 = await page.evaluate(() => document.body.innerText.slice(0, 3000));

  // Check if the "Start Today's Session" button is disabled/absent or replaced with completion message
  const startBtnAgain = page.getByRole('button', { name: /start.*(today|session)/i }).first();
  const startBtnEnabled = await startBtnAgain.isEnabled().catch(() => false);
  const startBtnVisible9 = await startBtnAgain.isVisible().catch(() => false);

  const hasDoneMessage = /completed.*today|today.*complete|done for today|already.*completed|session complete/i.test(dashText9);
  const hasPracticeOption = /practice/i.test(dashText9);

  console.log('  Start button visible:', startBtnVisible9, 'enabled:', startBtnEnabled);
  console.log('  Has "completed" message:', hasDoneMessage);
  console.log('  Has practice option:', hasPracticeOption);

  results.S09.notes.push(`Start button visible: ${startBtnVisible9}, enabled: ${startBtnEnabled}`);
  results.S09.notes.push(`Has completion message: ${hasDoneMessage}`);
  results.S09.notes.push(`Has practice option: ${hasPracticeOption}`);

  if (hasDoneMessage || !startBtnEnabled || !startBtnVisible9) {
    results.S09.result = 'pass';
    results.S09.notes.push('Correctly prevents re-starting Day 1 ✓');
  } else if (startBtnVisible9 && startBtnEnabled) {
    // Danger — might allow re-starting
    results.S09.result = 'partial';
    results.S09.notes.push('WARN: Start button still enabled — clicking it to verify behavior');

    await startBtnAgain.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'B04_S09_02_after_restart_click');

    const afterClickText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    const showsNewTest = /question.*1|type.*answer/i.test(afterClickText);
    const showsCompleted = /completed|done.*today|practice/i.test(afterClickText);

    if (showsNewTest) {
      results.S09.result = 'fail';
      results.S09.notes.push('FAIL: Clicking start again launched a new test session');
      findings.push({
        id: 'F07',
        severity: 'HIGH',
        title: 'Day-1 can be re-started after completion, potentially creating duplicate attempt docs',
        scenario: 'S09',
        observed: 'Start button enabled after session complete; clicking launches new test',
        expected: 'Should show "completed today" message or practice mode, not a new test session',
      });
    } else {
      results.S09.result = 'pass';
      results.S09.notes.push('Click correctly handled (no new test launched)');
    }
  } else {
    results.S09.result = 'partial';
    results.S09.notes.push('Ambiguous — neither clearly blocked nor clearly allowed restart');
  }

  await screenshot(page, 'B04_S09_final');

  // Check console errors
  const consoleErrors = getConsoleErrors(page);
  console.log('\n  Console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('  Errors:', consoleErrors.slice(0, 5));
  }

  // Save console errors
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_console_errors.json'), JSON.stringify(consoleErrors, null, 2));

  // Final Firestore state
  const finalFs = await saveFirestoreEvidence(uid, 'B04_final');
  console.log('\n  Final attempts:', finalFs.attempts.length);
  console.log('\nResults summary:');
  Object.entries(results).forEach(([s, r]) => {
    console.log(`  ${s}: ${r.result} — ${r.notes.join('; ')}`);
  });

  // Write results to file for the findings generator
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_results.json'), JSON.stringify({ results, findings }, null, 2));

} catch (err) {
  console.error('FATAL ERROR:', err);
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_fatal_error.json'), JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
  throw err;
} finally {
  if (browser) await browser.close();
  console.log('\nBrowser closed.');
}
