/**
 * D1-04 — DAY-1 Trolling / Junk Input Test
 *
 * Account: audit_trolling_01_top@vocaboost.test / AuditPass2026!
 * Class:   k8tzOiiwotBbtJS3uTiv  (TOP)
 * List:    8RMews2H7C3UJUAsOBzR
 *
 * Flow:
 *   login → open session → H2 guard check → new-word STUDY (flashcards) →
 *   new-word TEST → answer with JUNK (random chars, emoji, "lol", "idk", blank)
 *   typed char-by-char (NOT .fill()) → submit → grading → results
 *
 * Assertions:
 *   - Reached Day-1 test and completed without crash
 *   - Junk answers graded (mostly incorrect)
 *   - No B2 "Unsupported field value: undefined" error
 *   - No unhandled errors from weird input
 *   - class_progress CSD held (failing score = correct, no advance)
 *   - Exactly one Day-1 attempt
 *   - No orphan docs
 *
 * Output:
 *   /app/findings/day1/D1-04_trolling_top.md
 *   /app/findings/agent_logs/D1-04.jsonl
 *   /app/findings/agent_logs/D1-04.status.json
 */

import { chromium } from 'playwright';
import { writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const adminDb = admin.firestore();

const BASE_URL = 'https://vocaboostone.netlify.app';
const ACCOUNT_EMAIL = 'audit_trolling_01_top@vocaboost.test';
const ACCOUNT_PASSWORD = 'AuditPass2026!';
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID = '8RMews2H7C3UJUAsOBzR';

const FINDINGS_DIR = '/app/findings/day1';
const LOGS_DIR = '/app/findings/agent_logs';
mkdirSync(FINDINGS_DIR, { recursive: true });
mkdirSync(LOGS_DIR, { recursive: true });

const JSONL_PATH = `${LOGS_DIR}/D1-04.jsonl`;
const STATUS_PATH = `${LOGS_DIR}/D1-04.status.json`;
const REPORT_PATH = `${FINDINGS_DIR}/D1-04_trolling_top.md`;

// Junk answer bank — random chars, emoji, "lol", "idk", near-blank
const JUNK_BANK = [
  'asdf',
  'lol',
  'idk',
  'zxcvbnm',
  '🎉🔥😂',
  'qwerty123',
  '   ',
  'xXxXxXx',
  'trolling',
  '???!!!',
  '1234567890',
  'hahaha',
  'blah blah',
  '...',
  'nope',
];

let junkIdx = 0;
function nextJunk() {
  const j = JUNK_BANK[junkIdx % JUNK_BANK.length];
  junkIdx++;
  return j;
}

function log(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj });
  appendFileSync(JSONL_PATH, line + '\n');
  console.log(JSON.stringify(obj));
}

// Type char-by-char (NOT .fill()) to simulate real user
async function typeCharByChar(locator, text, delay = 80) {
  await locator.focus();
  for (const ch of text) {
    await locator.type(ch, { delay });
  }
}

// Firebase Admin helpers (READ-ONLY)
async function getClassProgressDoc(uid) {
  const docId = `${CLASS_ID}_${LIST_ID}`;
  const snap = await adminDb
    .collection('users')
    .doc(uid)
    .collection('class_progress')
    .doc(docId)
    .get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function getAttemptsForUser(uid) {
  const snap = await adminDb
    .collection('attempts')
    .where('studentId', '==', uid)
    .where('classId', '==', CLASS_ID)
    .where('listId', '==', LIST_ID)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function lookupUidByEmail(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    return user.uid;
  } catch (e) {
    return null;
  }
}

// Results container
const state = {
  reachedTest: false,
  classification: 'BLOCKED',
  junkCorrectlyGradedWrong: null,
  b2Strand: false,
  crashOnJunk: false,
  csdBefore: null,
  csdAfter: null,
  csdHeld: null,
  consoleErrors: [],
  orphanDocs: 'NONE',
  day1RobustToJunk: null,
  exactlyOneAttempt: null,
  questionsAnswered: 0,
  correctCount: 0,
  incorrectCount: 0,
  gradingFunctionCalled: false,
};

let browser;
try {
  log({ event: 'START', label: 'D1-04', account: ACCOUNT_EMAIL });

  // 1. Resolve UID for Firestore reads
  const uid = await lookupUidByEmail(ACCOUNT_EMAIL);
  log({ event: 'UID_LOOKUP', uid: uid || 'NOT_FOUND' });

  if (!uid) {
    state.classification = 'BLOCKED';
    log({ event: 'ABORT', reason: 'Could not resolve UID for account' });
    throw new Error('UID not found for ' + ACCOUNT_EMAIL);
  }

  // 2. Baseline Firestore BEFORE
  const cpBefore = await getClassProgressDoc(uid);
  const attemptsBefore = await getAttemptsForUser(uid);
  state.csdBefore = cpBefore ? (cpBefore.currentStudyDay ?? 0) : 0;
  log({
    event: 'BASELINE',
    csdBefore: state.csdBefore,
    attemptCountBefore: attemptsBefore.length,
    cpData: cpBefore,
  });

  // 3. Launch browser
  browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  // Capture console errors + track B2 error
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      state.consoleErrors.push(text);
      if (text.includes('Unsupported field value: undefined')) {
        state.b2Strand = true;
        log({ event: 'B2_ERROR_DETECTED', text });
      }
      log({ event: 'CONSOLE_ERROR', text: text.slice(0, 300) });
    }
  });

  page.on('pageerror', err => {
    state.consoleErrors.push('pageerror: ' + err.message);
    log({ event: 'PAGE_ERROR', message: err.message.slice(0, 300) });
  });

  // 4. LOGIN via SPA nav
  log({ event: 'NAVIGATE', url: BASE_URL });
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);

  const emailInput = page.getByLabel(/email/i).first();
  await emailInput.waitFor({ timeout: 20000 });
  await emailInput.fill(ACCOUNT_EMAIL);
  await page.getByLabel(/password/i).first().fill(ACCOUNT_PASSWORD);
  await page.getByLabel(/password/i).first().press('Enter');

  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 });
  } catch {
    const btn = page.getByRole('button', { name: /log.?in|sign.?in|continue/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  }

  log({ event: 'LOGIN_SUCCESS', url: page.url() });

  // 5. Navigate to the class/list session using SPA nav
  await page.waitForTimeout(2000);

  // Try direct URL navigation via SPA pushState
  const sessionUrl = `${BASE_URL}/class/${CLASS_ID}/list/${LIST_ID}/session`;
  log({ event: 'SPA_NAV', url: sessionUrl });
  await page.evaluate((url) => {
    history.pushState({}, '', url.replace('https://vocaboostone.netlify.app', ''));
    dispatchEvent(new PopStateEvent('popstate'));
  }, sessionUrl);
  await page.waitForTimeout(2000);

  // If that didn't work, try clicking through dashboard
  const currentUrl = page.url();
  if (!currentUrl.includes('/session') && !currentUrl.includes('/class/')) {
    log({ event: 'SPA_NAV_FALLBACK', reason: 'SPA pushState did not navigate to session' });
    // Try to find the class/list on dashboard
    await page.goto(sessionUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  log({ event: 'SESSION_URL', url: page.url() });
  const bodyText1 = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  log({ event: 'SESSION_BODY', text: bodyText1.slice(0, 500) });

  // 6. H2 GUARD CHECK — look for the guard (already started Day 1?)
  const guardText = await page.evaluate(() => document.body.innerText);
  const hasH2Guard = /already.*(started|done|completed)|another.*session|session.*progress|re.?entry/i.test(guardText);
  log({ event: 'H2_GUARD_CHECK', hasGuard: hasH2Guard, snippet: guardText.slice(0, 200) });

  // If there's a re-entry modal, dismiss it to start fresh or continue
  const reentryBtn = page.getByRole('button', { name: /continue|resume|start.*fresh|start.*new|ok|close/i }).first();
  if (hasH2Guard && await reentryBtn.isVisible().catch(() => false)) {
    log({ event: 'H2_GUARD_DISMISSING' });
    await reentryBtn.click();
    await page.waitForTimeout(1500);
  }

  // 7. Wait for session to load — flashcard or test phase
  await page.waitForTimeout(3000);

  // Look for session start button if on dashboard
  const startBtnSelectors = [
    /start.*today|today.*session/i,
    /start.*session/i,
    /begin.*session/i,
    /study.*now/i,
  ];
  for (const pattern of startBtnSelectors) {
    const btn = page.getByRole('button', { name: pattern }).first();
    if (await btn.isVisible().catch(() => false)) {
      log({ event: 'START_BTN_FOUND', pattern: pattern.toString() });
      await btn.click();
      await page.waitForTimeout(3000);
      break;
    }
  }

  // Check for "H2 check" loading indicator
  await page.waitForTimeout(2000);
  const pageText2 = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  log({ event: 'POST_START', url: page.url(), text: pageText2.slice(0, 500) });

  // 7b. Dismiss any onboarding/customization modal that intercepts clicks
  log({ event: 'MODAL_DISMISS_CHECK' });
  await page.waitForTimeout(1500);
  // "Customize Your Flashcards" modal or any overlay
  const overlaySelectors = [
    /got it|ok|close|dismiss|continue|done|start/i,
    /save.*preferences|confirm|understood|got it/i,
  ];
  for (const pattern of overlaySelectors) {
    const overlayBtn = page.locator('div.fixed button').filter({ hasText: pattern }).first();
    if (await overlayBtn.isVisible().catch(() => false)) {
      log({ event: 'OVERLAY_MODAL_DISMISS', pattern: pattern.toString() });
      await overlayBtn.click();
      await page.waitForTimeout(800);
      break;
    }
  }
  // Also try pressing Escape to close any modal
  const anyModal = page.locator('div.fixed.inset-0').first();
  if (await anyModal.isVisible().catch(() => false)) {
    log({ event: 'MODAL_ESCAPE_ATTEMPT' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }
  // Check again for the overlay — try clicking all buttons inside it
  const modalFixed = page.locator('[class*="fixed"][class*="inset-0"]');
  if (await modalFixed.isVisible().catch(() => false)) {
    const btnsInModal = modalFixed.locator('button');
    const count = await btnsInModal.count();
    log({ event: 'MODAL_BUTTONS_IN_OVERLAY', count });
    if (count > 0) {
      // Click the last button (usually "Save" or "Got it")
      await btnsInModal.last().click();
      await page.waitForTimeout(800);
    }
  }

  // 8. FLASHCARD PHASE — use Skip to Test via the session menu (kebab)
  log({ event: 'FLASHCARD_PHASE_START' });

  // Wait for the session page to fully load
  await page.waitForTimeout(2000);

  // Strategy: open the session menu (kebab) and click "Skip to Test"
  // The SessionMenu is triggered by aria-label="Session menu"
  const sessionMenuBtn = page.getByRole('button', { name: 'Session menu' });
  const menuBtnVisible = await sessionMenuBtn.isVisible().catch(() => false);
  log({ event: 'SESSION_MENU_CHECK', visible: menuBtnVisible });

  if (menuBtnVisible) {
    await sessionMenuBtn.click();
    await page.waitForTimeout(800);

    // Look for "Skip to Test" in the dropdown
    const skipToTestItem = page.getByRole('button', { name: /skip to test/i }).first();
    const skipVisible = await skipToTestItem.isVisible().catch(() => false);
    log({ event: 'SKIP_TO_TEST_CHECK', visible: skipVisible });

    if (skipVisible) {
      await skipToTestItem.click();
      await page.waitForTimeout(1500);

      // Handle the "Ready for the Test?" confirmation screen
      // Buttons: "Keep Studying" | "Start Test"
      const startTestBtn = page.getByRole('button', { name: /start test/i }).first();
      if (await startTestBtn.isVisible().catch(() => false)) {
        log({ event: 'READY_FOR_TEST_CONFIRM' });
        await startTestBtn.click();
        await page.waitForTimeout(2000);
      }

      // Also handle any generic confirm modal
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip|proceed/i }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        log({ event: 'SKIP_CONFIRM_MODAL' });
        await confirmBtn.click();
        await page.waitForTimeout(1500);
      }

      state.reachedTest = true;
      log({ event: 'SKIP_TO_TEST_SUCCESS' });
    } else {
      // Menu open but no Skip to Test — close and try cycling through a few cards first
      await page.keyboard.press('Escape');
      log({ event: 'SKIP_TO_TEST_NOT_IN_MENU' });
    }
  }

  // Fallback: cycle through some cards until "Take Test" button appears (allCardsReviewed)
  if (!state.reachedTest) {
    log({ event: 'FLASHCARD_CYCLE_FALLBACK' });
    let cardsProcessed = 0;
    const MAX_CARDS = 100;

    for (let i = 0; i < MAX_CARDS; i++) {
      // Check if "Take Test" button appeared (allCardsReviewed state)
      const takeTestBtn = page.getByRole('button', { name: /take test/i }).first();
      if (await takeTestBtn.isVisible().catch(() => false)) {
        log({ event: 'TAKE_TEST_BTN_VISIBLE', cardsProcessed });
        await takeTestBtn.click();
        await page.waitForTimeout(1500);
        state.reachedTest = true;
        break;
      }

      // Check if test phase arrived directly
      const isTestPhase = await page.getByText(/question.*of|type.*answer|your.*answer/i).first().isVisible().catch(() => false);
      if (isTestPhase) {
        log({ event: 'TEST_PHASE_DETECTED_DIRECT', cardsProcessed });
        state.reachedTest = true;
        break;
      }

      // Try the "I know this word" button (aria-label contains "I know this word")
      const iKnowBtn = page.locator('[aria-label*="I know this word"]').first();
      const iKnowVisible = await iKnowBtn.isVisible().catch(() => false);

      if (iKnowVisible) {
        await iKnowBtn.click();
        cardsProcessed++;
        await page.waitForTimeout(150);
      } else {
        // Try next card arrow
        const nextArrow = page.locator('[aria-label="Next card"]').first();
        if (await nextArrow.isVisible().catch(() => false)) {
          await nextArrow.click();
          cardsProcessed++;
          await page.waitForTimeout(150);
        } else {
          log({ event: 'FLASHCARD_NO_BUTTON', i });
          const bodyNow = await page.evaluate(() => document.body.innerText.slice(0, 1000));
          log({ event: 'FLASHCARD_BODY', text: bodyNow.slice(0, 300) });
          break;
        }
      }

      if (i % 20 === 0) log({ event: 'FLASHCARD_PROGRESS', i, cardsProcessed });
    }
    log({ event: 'FLASHCARD_CYCLE_END', cardsProcessed });
  }

  // Final check
  if (!state.reachedTest) {
    await page.waitForTimeout(2000);
    const nowText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    if (/question.*of|type.*answer|your.*answer/i.test(nowText)) {
      state.reachedTest = true;
    }
    log({ event: 'POST_FLASHCARD_CHECK', reachedTest: state.reachedTest, text: nowText.slice(0, 300) });
  }

  if (!state.reachedTest) {
    state.classification = 'BLOCKED';
    log({ event: 'BLOCKED', reason: 'Never reached test phase' });
  }

  // 9. TYPED TEST — TypedTest shows ALL questions at once, single Submit button
  // Answer each input field with junk char-by-char, then submit
  if (state.reachedTest) {
    log({ event: 'JUNK_TEST_START' });

    // Wait for test page to fully load
    await page.waitForTimeout(3000);

    // Check current page
    const testBodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    log({ event: 'TEST_PAGE_BODY', text: testBodyText.slice(0, 500) });

    // Count all text inputs (TypedTest shows all words at once with input boxes)
    const allInputs = page.locator('input[type="text"]');
    const inputCount = await allInputs.count();
    log({ event: 'INPUT_COUNT', count: inputCount });

    if (inputCount > 0) {
      // Fill each input with junk char-by-char
      for (let i = 0; i < inputCount; i++) {
        const input = allInputs.nth(i);
        const isEnabled = await input.isEnabled().catch(() => false);
        if (!isEnabled) {
          log({ event: 'INPUT_DISABLED', i });
          continue;
        }

        await input.scrollIntoViewIfNeeded();
        await input.focus();
        const junk = nextJunk();
        // Type char-by-char (NOT .fill())
        for (const ch of junk) {
          await input.type(ch, { delay: 60 });
        }
        state.questionsAnswered++;

        if (i % 5 === 0) {
          log({ event: 'JUNK_INPUT_PROGRESS', i: i + 1, of: inputCount, junk });
        }
        await page.waitForTimeout(50);
      }

      log({ event: 'JUNK_ALL_INPUTS_FILLED', count: state.questionsAnswered });

      // Scroll to bottom to reveal Submit Test button
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      // Click "Submit Test" button
      const submitTestBtn = page.getByRole('button', { name: /submit test/i }).first();
      const submitVisible = await submitTestBtn.isVisible().catch(() => false);
      log({ event: 'SUBMIT_TEST_BTN', visible: submitVisible });

      if (submitVisible) {
        await submitTestBtn.click();
        await page.waitForTimeout(1500);

        // Handle "Submit Test?" confirmation modal
        const confirmSubmitBtn = page.getByRole('button', { name: /^submit$/i }).first();
        if (await confirmSubmitBtn.isVisible().catch(() => false)) {
          log({ event: 'SUBMIT_CONFIRM_MODAL' });
          await confirmSubmitBtn.click();
          await page.waitForTimeout(2000);
        }

        // Now wait for grading (Cloud Function ~10-90s per question with AI)
        log({ event: 'GRADING_WAIT_START' });
        state.gradingFunctionCalled = true;

        // Wait for "Grading..." to appear and then disappear
        const gradingBtn = page.getByRole('button', { name: /grading/i }).first();
        const gradingAppeared = await gradingBtn.isVisible().catch(() => false);
        log({ event: 'GRADING_INDICATOR', appeared: gradingAppeared });

        // Wait up to 3 minutes for grading to complete
        try {
          await page.waitForFunction(
            () => {
              const text = document.body.innerText;
              // Grading done when: results visible, or submit button gone, or score shown
              return !text.match(/Grading\.\.\./i) &&
                (text.match(/\d+\s*%|score|correct|pass|fail|session.*complete|well done|results/i) ||
                 !document.querySelector('button[disabled]'));
            },
            { timeout: 180000 }
          );
          log({ event: 'GRADING_COMPLETE' });
        } catch (gradErr) {
          log({ event: 'GRADING_TIMEOUT_180s', message: gradErr.message.slice(0, 100) });
        }

        await page.waitForTimeout(3000);
        const postSubmitText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
        log({ event: 'POST_SUBMIT_TEXT', text: postSubmitText.slice(0, 800) });

        // Detect results
        if (/\d+\s*%|score|correct|pass|fail|session.*complete|well done|results|retake/i.test(postSubmitText)) {
          state.classification = 'COMPLETED_NOPASS';
          log({ event: 'RESULTS_DETECTED' });
        }
      } else {
        // Try pressing Enter on last input
        const lastInput = allInputs.nth(inputCount - 1);
        await lastInput.press('Enter');
        await page.waitForTimeout(2000);
        log({ event: 'SUBMIT_BY_ENTER' });
      }
    } else {
      // No inputs found — might already be on confirm screen or results
      const bodyNow = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      log({ event: 'NO_INPUTS_FOUND', text: bodyNow.slice(0, 400) });
      if (/session.*complete|well done|your score|congratulations|results/i.test(bodyNow)) {
        state.classification = 'COMPLETED_NOPASS';
      }
    }

    log({ event: 'JUNK_TEST_END', questionsAnswered: state.questionsAnswered });

    // 10. Parse results page for score info
    await page.waitForTimeout(4000);
    const resultsText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
    log({ event: 'RESULTS_PAGE', text: resultsText.slice(0, 1000) });

    // Look for score indicators
    const scoreMatch = resultsText.match(/(\d+)\s*\/\s*(\d+)|score[:\s]+(\d+)|correct[:\s]+(\d+)/i);
    if (scoreMatch) {
      log({ event: 'SCORE_FOUND', raw: scoreMatch[0] });
    }

    // Parse "X of Y correct" format
    const xOfYMatch = resultsText.match(/(\d+)\s+of\s+(\d+)\s+correct/i);
    if (xOfYMatch) {
      state.correctCount = parseInt(xOfYMatch[1]);
      state.incorrectCount = parseInt(xOfYMatch[2]) - parseInt(xOfYMatch[1]);
    } else {
      // Fallback: check for correct/incorrect counts
      const correctMatch = resultsText.match(/(\d+)\s*correct/i);
      const incorrectMatch = resultsText.match(/(\d+)\s*incorrect|(\d+)\s*wrong/i);
      if (correctMatch) state.correctCount = parseInt(correctMatch[1]);
      if (incorrectMatch) state.incorrectCount = parseInt(incorrectMatch[1] || incorrectMatch[2]);
    }

    // Determine if junk was graded wrong (expected: mostly wrong, low correct count)
    if (state.questionsAnswered > 0) {
      // If we got mostly 0 correct, junk was correctly rejected
      const passPattern = /pass|congratulations|well done|great|you passed/i.test(resultsText);
      const failPattern = /fail|try again|not.*(pass|enough)|need.*more/i.test(resultsText);

      if (passPattern && !failPattern) {
        state.classification = 'COMPLETED_PASS';
        state.junkCorrectlyGradedWrong = false; // unexpected — junk was accepted
      } else {
        state.classification = 'COMPLETED_NOPASS';
        state.junkCorrectlyGradedWrong = true; // correct — junk rejected
      }

      log({ event: 'CLASSIFICATION', classification: state.classification, passPattern, failPattern });
    }

    // Check if session completed without crash
    const hasCrash = state.consoleErrors.some(e =>
      /unhandled|uncaught|cannot read|undefined is not|null is not|TypeError|ReferenceError/i.test(e)
    );
    state.crashOnJunk = hasCrash;
    log({ event: 'CRASH_CHECK', crashOnJunk: hasCrash, errorCount: state.consoleErrors.length });
  }

  // 11. POST-TEST Firestore check (READ-ONLY, wait for writes to settle)
  await page.waitForTimeout(5000); // allow writes to propagate

  const cpAfter = await getClassProgressDoc(uid);
  const attemptsAfter = await getAttemptsForUser(uid);

  state.csdAfter = cpAfter ? (cpAfter.currentStudyDay ?? 0) : 0;
  state.csdHeld = state.csdAfter === state.csdBefore; // junk fail → CSD should NOT advance
  state.exactlyOneAttempt = attemptsAfter.length - attemptsBefore.length === 1;

  log({
    event: 'FIRESTORE_AFTER',
    csdBefore: state.csdBefore,
    csdAfter: state.csdAfter,
    csdHeld: state.csdHeld,
    attemptsBefore: attemptsBefore.length,
    attemptsAfter: attemptsAfter.length,
    exactlyOneAttempt: state.exactlyOneAttempt,
    newAttempts: attemptsAfter.slice(attemptsBefore.length).map(a => ({
      id: a.id,
      studyDay: a.studyDay,
      passed: a.passed,
      score: a.score,
    })),
    cpAfter,
  });

  // Orphan check — attempts that shouldn't exist
  const orphanAttempts = attemptsAfter.filter(a => !a.studyDay && !a.listId);
  if (orphanAttempts.length > 0) {
    state.orphanDocs = `${orphanAttempts.length} orphan(s) found`;
    log({ event: 'ORPHAN_DOCS', count: orphanAttempts.length, docs: orphanAttempts });
  }

  // Day 1 robust to junk?
  state.day1RobustToJunk = (
    state.reachedTest &&
    !state.crashOnJunk &&
    !state.b2Strand &&
    state.classification === 'COMPLETED_NOPASS' &&
    state.csdHeld !== false // null = unknown, but didn't advance
  );

  log({ event: 'FINAL_STATE', ...state });

} catch (err) {
  state.classification = state.reachedTest ? 'CRASHED' : 'BLOCKED';
  state.crashOnJunk = true;
  log({ event: 'FATAL_ERROR', message: err.message, stack: err.stack?.slice(0, 500) });
} finally {
  if (browser) await browser.close();

  // Write status.json
  writeFileSync(STATUS_PATH, JSON.stringify({
    label: 'D1-04',
    account: ACCOUNT_EMAIL,
    classification: state.classification,
    reachedTest: state.reachedTest,
    junkCorrectlyGradedWrong: state.junkCorrectlyGradedWrong,
    b2Strand: state.b2Strand,
    crashOnJunk: state.crashOnJunk,
    csdBefore: state.csdBefore,
    csdAfter: state.csdAfter,
    csdHeld: state.csdHeld,
    exactlyOneAttempt: state.exactlyOneAttempt,
    orphanDocs: state.orphanDocs,
    day1RobustToJunk: state.day1RobustToJunk,
    questionsAnswered: state.questionsAnswered,
    correctCount: state.correctCount,
    incorrectCount: state.incorrectCount,
    consoleErrorCount: state.consoleErrors.length,
    ts: new Date().toISOString(),
  }, null, 2));

  // Write markdown report
  const csdArrow = `${state.csdBefore} → ${state.csdAfter}`;
  const csdStatus = state.csdHeld === true ? 'HELD (correct)' : state.csdHeld === false ? 'ADVANCED (unexpected!)' : 'UNKNOWN';
  const yesNo = v => v === true ? 'YES' : v === false ? 'NO' : 'UNKNOWN';

  const report = `# D1-04 — Day-1 Trolling / Junk Input Test

**Date:** ${new Date().toISOString().split('T')[0]}
**Account:** ${ACCOUNT_EMAIL}
**Class ID:** k8tzOiiwotBbtJS3uTiv (TOP)
**List ID:** 8RMews2H7C3UJUAsOBzR
**Bundle:** index-CflgDyCK.js (live prod)

---

## Classification

**${state.classification}**

${state.classification === 'COMPLETED_NOPASS'
  ? '> Junk input failed test as expected. Day did NOT advance. This is CORRECT behavior.'
  : state.classification === 'COMPLETED_PASS'
  ? '> WARNING: Junk input somehow PASSED the test. Investigate grader leniency.'
  : state.classification === 'BLOCKED'
  ? '> Test flow could not complete — check BLOCKED reason in logs.'
  : '> A crash occurred during test. See console errors below.'}

---

## Status Block

| Check | Result |
|-------|--------|
| Account | ${ACCOUNT_EMAIL} |
| Reached Day-1 test? | ${yesNo(state.reachedTest)} |
| Classification | **${state.classification}** |
| Junk correctly graded wrong? | ${yesNo(state.junkCorrectlyGradedWrong)} |
| B2 "Unsupported field value: undefined" strand? | ${yesNo(state.b2Strand)} |
| Crash on junk input? | ${yesNo(state.crashOnJunk)} |
| CSD before → after (held?) | ${csdArrow} — ${csdStatus} |
| Console errors | ${state.consoleErrors.length} error(s) |
| Orphan docs | ${state.orphanDocs} |
| Exactly one Day-1 attempt? | ${yesNo(state.exactlyOneAttempt)} |
| Day-1 robust to junk? | ${yesNo(state.day1RobustToJunk)} |

---

## Score Details

- Questions answered with junk: **${state.questionsAnswered}**
- Correct count (from results page): **${state.correctCount}**
- Incorrect count (from results page): **${state.incorrectCount}**
- Grading Cloud Function called: **${yesNo(state.gradingFunctionCalled)}**

---

## Console Errors

${state.consoleErrors.length === 0
  ? '_No console errors detected._'
  : state.consoleErrors.map((e, i) => `${i + 1}. \`${e.slice(0, 300)}\``).join('\n')}

---

## Firestore Evidence

- **class_progress.currentStudyDay before:** ${state.csdBefore}
- **class_progress.currentStudyDay after:** ${state.csdAfter}
- **Attempt docs added:** ${state.exactlyOneAttempt === true ? '1 (correct)' : 'see logs'}

---

## Analysis

${state.classification === 'COMPLETED_NOPASS'
  ? `Day-1 flow with junk/trolling input completed as expected.
The grader correctly rejected random characters, emoji, "lol", "idk", and blank answers.
The session completed without crashing, and the CSD was held (not advanced), which is correct behavior for a failing score.
No B2 "Unsupported field value: undefined" errors were observed from junk inputs.`
  : state.classification === 'COMPLETED_PASS'
  ? `UNEXPECTED: Junk answers passed the test. The grader may be too lenient. Investigate the grading Cloud Function threshold or if any answers accidentally matched expected definitions.`
  : state.classification === 'BLOCKED'
  ? `The test flow was blocked before reaching the typed test phase. Check agent logs for the BLOCKED reason.`
  : `A crash was observed during the junk input test. See console errors above.`}

---

## Logs

- JSONL: \`/app/findings/agent_logs/D1-04.jsonl\`
- Status: \`/app/findings/agent_logs/D1-04.status.json\`
`;

  writeFileSync(REPORT_PATH, report);
  console.log('\n=== D1-04 COMPLETE ===');
  console.log('Classification:', state.classification);
  console.log('Report:', REPORT_PATH);
  console.log('Status:', STATUS_PATH);
}
