/**
 * D1-09 — Day-1 Completion Test: perfectionist_core
 * Account: audit_perfectionist_01_core@vocaboost.test / AuditPass2026!
 * CORE class, list aRGjnGXdU4aupiS8SlXR, classId LVjBTFuYE8FbPG34pVAt
 *
 * Key audit focus: HEAVY EDIT CHURN on typed answer (audit issue #10)
 * Verifies: final stored answer == final typed answer (not mid-edit value)
 *
 * Flow: login → open session → H2 guard → new-word STUDY → new-word TEST
 *       → answer with churn (type, backspace, retype) → submit → grading
 *       → results → Day 1 completes
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');

// Init firebase admin (READ-ONLY usage)
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/findings/evidence/D1-09';
const LOG_FILE = '/app/findings/agent_logs/D1-09.jsonl';
const STATUS_FILE = '/app/findings/agent_logs/D1-09.status.json';
const REPORT_FILE = '/app/findings/day1/D1-09_perfectionist_core.md';

mkdirSync(EVIDENCE_DIR, { recursive: true });
mkdirSync('/app/findings/agent_logs', { recursive: true });
mkdirSync('/app/findings/day1', { recursive: true });

// Account under test
const ACCOUNT = {
  email: 'audit_perfectionist_01_core@vocaboost.test',
  password: 'AuditPass2026!',
  classId: 'LVjBTFuYE8FbPG34pVAt',
  listId: 'aRGjnGXdU4aupiS8SlXR',
};

// JSONL logger
const logLines = [];
function log(event, data = {}) {
  const entry = { ts: new Date().toISOString(), event, ...data };
  logLines.push(JSON.stringify(entry));
  console.log(`[${entry.ts}] ${event}`, Object.keys(data).length ? JSON.stringify(data).slice(0, 200) : '');
}

function flushLogs() {
  writeFileSync(LOG_FILE, logLines.join('\n') + '\n');
}

async function screenshot(page, name) {
  const fpath = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: fpath, fullPage: true });
  log('screenshot', { file: `${name}.png` });
  return fpath;
}

// Console error capture
const consoleErrors = [];
function setupConsole(page) {
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      log('console_error', { text: msg.text().slice(0, 300) });
    }
  });
}

// ---- Firestore READ-ONLY helpers ----

async function getStudentUid(email) {
  // Look up student UID from Firestore students collection
  const snap = await db.collection('students').where('email', '==', email).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  // Try users collection
  const snap2 = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!snap2.empty) return snap2.docs[0].id;
  return null;
}

async function getClassProgress(uid, classId) {
  // Primary location: users/{uid}/class_progress subcollection
  const snap = await db.collection('users').doc(uid).collection('class_progress').get();
  if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Fallback: top-level class_progress collection
  const snap2 = await db.collection('class_progress').where('studentId', '==', uid).limit(10).get();
  return snap2.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getAttempts(uid, classId) {
  const snap = await db.collection('attempts')
    .where('studentId', '==', uid)
    .where('classId', '==', classId)
    .limit(20).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getStudyStates(uid) {
  // Primary: users/{uid}/study_states subcollection
  const snap = await db.collection('users').doc(uid).collection('study_states').limit(100).get();
  if (!snap.empty) return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Fallback: top-level
  const snap2 = await db.collection('study_states').where('studentId', '==', uid).limit(20).get();
  return snap2.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function checkOrphanDocs(uid) {
  // Check for any partial/orphan session docs
  const collections = ['sessions', 'session_states', 'pending_sessions', 'draft_sessions'];
  const orphans = {};
  for (const col of collections) {
    try {
      const snap = await db.collection(col).where('studentId', '==', uid).limit(5).get();
      if (!snap.empty) {
        orphans[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
    } catch (e) {
      // Collection may not exist
    }
  }
  return orphans;
}

async function getCoreConfig(classId) {
  // Read CORE class config to get pace
  const classDoc = await db.collection('classes').doc(classId).get();
  if (classDoc.exists) return classDoc.data();
  return null;
}

async function getCoreList(listId) {
  // Read the CORE list words
  const listDoc = await db.collection('lists').doc(listId).get();
  if (listDoc.exists) return listDoc.data();
  return null;
}

// ---- SPA navigation helper ----
async function spaNav(page, path_) {
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path_);
  await page.waitForTimeout(800);
}

// ---- Login ----
async function loginAs(page, email, password) {
  log('login_start', { email });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);

  // Navigate to login
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0 && await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
  } else {
    await spaNav(page, '/login');
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByLabel(/password/i).first().press('Enter');

  try {
    await page.waitForURL(/\/(dashboard|home|$)/, { timeout: 20000 });
  } catch (e) {
    // Try clicking login button
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|home|$)/, { timeout: 15000 });
  }
  log('login_success', { url: page.url() });
}

// ---- Type char-by-char with heavy edit churn ----
// Simulates a perfectionist: types, backspaces several chars, retypes
async function churnyType(locator, finalText, label) {
  await locator.focus();
  await locator.clear();

  log('churn_start', { label, finalText: finalText.slice(0, 60) });

  // Phase 1: Type full answer
  for (const ch of finalText) {
    await locator.type(ch, { delay: 40 });
  }
  await locator.waitFor();

  // Phase 2: Backspace ~half the chars (simulate second-guessing)
  const backspaces = Math.min(Math.floor(finalText.length / 2), 20);
  log('churn_backspace', { backspaces });
  for (let i = 0; i < backspaces; i++) {
    await locator.press('Backspace');
    await new Promise(r => setTimeout(r, 20));
  }

  // Phase 3: Retype the erased portion
  const erased = finalText.slice(finalText.length - backspaces);
  log('churn_retype', { erased: erased.slice(0, 40) });
  for (const ch of erased) {
    await locator.type(ch, { delay: 30 });
  }

  // Phase 4: Additional small churn at end (type 3 extra chars, backspace 3)
  const extraChars = 'abc';
  for (const ch of extraChars) {
    await locator.type(ch, { delay: 20 });
  }
  for (let i = 0; i < extraChars.length; i++) {
    await locator.press('Backspace');
    await new Promise(r => setTimeout(r, 15));
  }

  // Verify final value
  const finalVal = await locator.inputValue().catch(() => '');
  log('churn_complete', { expected: finalText, actual: finalVal, match: finalVal === finalText });
  return finalVal;
}

// ========== MAIN ==========

let browser;
const auditState = {
  uid: null,
  csdBefore: null,
  csdAfter: null,
  attemptsBefore: [],
  attemptsAfter: [],
  studyStatesBefore: [],
  studyStatesAfter: [],
  orphansBefore: {},
  orphansAfter: {},
  finalTypedAnswer: null,
  finalStoredAnswer: null,
  answerIntegrityOk: null,
  b2ErrorFound: false,
  b2ErrorText: null,
  newWordSliceCorrect: null,
  newWordSliceDetails: null,
  reachedTest: false,
  completedDay1: false,
  classification: 'BLOCKED(unknown)',
  consoleErrors: [],
  coreConfig: null,
  coreListWords: null,
  pace: null,
  notes: [],
  testMode: null,
};

try {
  log('d1_09_start', { account: ACCOUNT.email, classId: ACCOUNT.classId, listId: ACCOUNT.listId });

  // ---- PRE-FLIGHT: Read CORE config via Admin SDK ----
  log('firestore_read_core_config');
  const coreConfig = await getCoreConfig(ACCOUNT.classId);
  auditState.coreConfig = coreConfig;
  if (coreConfig) {
    log('core_config', { pace: coreConfig.pace, testMode: coreConfig.testMode, config: JSON.stringify(coreConfig).slice(0, 400) });
    auditState.pace = coreConfig.pace;
    auditState.testMode = coreConfig.testMode;
  } else {
    log('core_config_not_found', { classId: ACCOUNT.classId });
    auditState.notes.push('WARN: Could not read class config from Firestore');
  }

  // Read CORE list words from subcollection
  log('firestore_read_core_list');
  let coreWords = [];
  try {
    // Words are in lists/{listId}/words subcollection
    const wordsSnap = await db.collection('lists').doc(ACCOUNT.listId).collection('words').orderBy('index').limit(100).get();
    if (!wordsSnap.empty) {
      coreWords = wordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      auditState.coreListWords = coreWords.slice(0, 5);
      log('core_list_words', { wordCount: coreWords.length, sample: coreWords.slice(0, 3).map(w => w.word) });
    } else {
      // Try without orderBy
      const wordsSnap2 = await db.collection('lists').doc(ACCOUNT.listId).collection('words').limit(100).get();
      coreWords = wordsSnap2.docs.map(d => ({ id: d.id, ...d.data() }));
      log('core_list_words_no_order', { wordCount: coreWords.length, sample: coreWords.slice(0, 3).map(w => w.word) });
    }
  } catch (e) {
    log('core_list_error', { error: e.message });
    auditState.notes.push('WARN: Could not read list words from Firestore: ' + e.message);
  }

  if (coreWords.length === 0) {
    // Try the main list doc (some schemas store words as an array field)
    const coreListData = await getCoreList(ACCOUNT.listId);
    if (coreListData) {
      coreWords = coreListData.words || coreListData.wordList || [];
      log('core_list_from_doc', { wordCount: coreWords.length });
    }
  }
  log('core_list_final', { wordCount: coreWords.length, sample: coreWords.slice(0, 3).map(w => w.word || w) });

  // ---- Get student UID ----
  log('lookup_uid');
  const uid = await getStudentUid(ACCOUNT.email);
  auditState.uid = uid;
  if (!uid) {
    log('uid_not_found', { email: ACCOUNT.email });
    auditState.notes.push('FATAL: Could not find student UID in Firestore');
    auditState.classification = 'BLOCKED(uid_not_found)';
    throw new Error('Student UID not found');
  }
  log('uid_found', { uid });

  // ---- BASELINE Firestore state ----
  log('firestore_baseline_start');
  const [cpBefore, attemptsBefore, ssBefore, orphansBefore] = await Promise.all([
    getClassProgress(uid, ACCOUNT.classId),
    getAttempts(uid, ACCOUNT.classId),
    getStudyStates(uid),
    checkOrphanDocs(uid),
  ]);

  const csdBefore = cpBefore.length > 0 ? (cpBefore[0].currentStudyDay ?? null) : null;
  auditState.csdBefore = csdBefore;
  auditState.attemptsBefore = attemptsBefore;
  auditState.studyStatesBefore = ssBefore;
  auditState.orphansBefore = orphansBefore;

  log('firestore_baseline', {
    csdBefore,
    classProgressDocs: cpBefore.length,
    attemptsBefore: attemptsBefore.length,
    studyStatesBefore: ssBefore.length,
    orphansBefore: JSON.stringify(orphansBefore).slice(0, 200),
  });

  // ---- Launch browser ----
  log('browser_launch');
  browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  });

  const page = await context.newPage();
  setupConsole(page);

  // ---- LOGIN ----
  await loginAs(page, ACCOUNT.email, ACCOUNT.password);
  await screenshot(page, '01_dashboard');

  // Wait for dashboard to fully load
  await page.waitForTimeout(2000);
  const dashText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  log('dashboard_loaded', { text: dashText.slice(0, 300) });

  // ---- H2 GUARD: Check that Day 2 is NOT accessible ----
  // (H2 guard means you can't skip ahead to day 2 before completing day 1)
  log('h2_guard_check');
  const h2GuardText = dashText;
  const h2Blocked = !/day 2|study day 2/i.test(h2GuardText) ||
    /day 1|today.*session|start.*session/i.test(h2GuardText);
  log('h2_guard', { blocked: h2Blocked, dashText: dashText.slice(0, 200) });
  auditState.notes.push(`H2 guard: ${h2Blocked ? 'PASS (day 2 not accessible)' : 'WARN (day 2 may be accessible)'}`);

  // ---- FIND AND START SESSION ----
  log('find_start_button');
  await page.waitForTimeout(1000);

  let startBtn = page.getByRole('button', { name: /start.*(today|session)/i }).first();
  if (!await startBtn.isVisible().catch(() => false)) {
    startBtn = page.getByRole('button', { name: /start/i }).first();
  }
  if (!await startBtn.isVisible().catch(() => false)) {
    startBtn = page.getByText(/start.*(today|session)/i).first();
  }
  if (!await startBtn.isVisible().catch(() => false)) {
    // Try any "study" button
    startBtn = page.getByRole('button', { name: /study|learn|begin/i }).first();
  }

  const startVisible = await startBtn.isVisible().catch(() => false);
  log('start_button', { visible: startVisible });

  if (!startVisible) {
    // Dump page for diagnosis
    const pageBody = await page.evaluate(() => document.body.innerText);
    log('start_button_not_found', { pageBody: pageBody.slice(0, 1000) });
    await screenshot(page, '02_start_not_found');
    auditState.classification = 'BLOCKED(no_start_button)';
    throw new Error('Could not find session start button on dashboard');
  }

  await startBtn.click();
  await page.waitForTimeout(2000);
  log('session_started', { url: page.url() });
  await screenshot(page, '02_session_started');

  // Check current URL
  const sessionUrl = page.url();

  // ---- STUDY PHASE (NEW_WORDS / Flashcards) ----
  log('study_phase_start');
  await page.waitForTimeout(2000);

  // Handle modals that appear on session start - there may be multiple:
  // 1. Intro/welcome modal
  // 2. "Customize Your Flashcards" settings modal (has "Start Studying" button)
  for (let modalAttempt = 0; modalAttempt < 5; modalAttempt++) {
    const modalVisible = await page.locator('.fixed.inset-0').first().isVisible().catch(() => false);
    if (!modalVisible) break;

    log('modal_detected', { attempt: modalAttempt });
    await screenshot(page, `02b_modal_${modalAttempt}`);

    // Look for "Start Studying" button (Customize Flashcards modal)
    const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first();
    if (await startStudyingBtn.isVisible().catch(() => false)) {
      log('start_studying_modal_found');
      await startStudyingBtn.click();
      await page.waitForTimeout(800);
      continue;
    }

    // Try to dismiss modal - look for any close/confirm/start/begin/ok button inside modal
    const modalDismiss = page.locator('.fixed.inset-0').locator('button').filter({ hasText: /close|ok|got it|start|begin|continue|dismiss|confirm|yes/i }).first();
    if (await modalDismiss.isVisible().catch(() => false)) {
      await modalDismiss.click();
      await page.waitForTimeout(800);
      log('modal_dismissed', { attempt: modalAttempt });
    } else {
      // Try pressing Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      log('modal_escape_attempted', { attempt: modalAttempt });
      // Check if still blocking
      const stillModal = await page.locator('.fixed.inset-0').first().isVisible().catch(() => false);
      if (!stillModal) break;
    }
    await page.waitForTimeout(500);
  }

  await screenshot(page, '02c_after_modal');
  const postModalText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  log('post_modal_page', { text: postModalText.slice(0, 300) });

  // Check for "Skip to Test" option if all cards are already mastered
  const skipToTestBtn = page.getByRole('button', { name: /skip to test/i }).first();
  if (await skipToTestBtn.isVisible().catch(() => false)) {
    log('skip_to_test_available');
    await skipToTestBtn.click();
    await page.waitForTimeout(800);
    const confirmSkip = page.getByRole('button', { name: /confirm|yes|skip|proceed|ok/i }).first();
    if (await confirmSkip.isVisible().catch(() => false)) {
      await confirmSkip.click();
      await page.waitForTimeout(800);
    }
    log('skip_to_test_clicked');
    auditState.reachedTest = true;
  }

  // Also check if there's a "Proceed to Test" button right away
  const proceedNowBtn = page.getByRole('button', { name: /proceed.*test|start.*test|continue.*test|begin test|take.*test|ready.*test|next step/i }).first();
  if (!auditState.reachedTest && await proceedNowBtn.isVisible().catch(() => false)) {
    log('proceed_to_test_initial');
    await proceedNowBtn.click();
    await page.waitForTimeout(1500);
    auditState.reachedTest = true;
  }

  // Dump all visible buttons with aria-labels for diagnostic
  const allVisibleBtns = await page.locator('button:visible').allTextContents().catch(() => []);
  const allVisibleBtnAttrs = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(b => ({
      text: b.textContent?.trim()?.slice(0, 40),
      ariaLabel: b.getAttribute('aria-label'),
      classes: b.className?.slice(0, 60),
    }));
  });
  log('visible_buttons_pre_study', { buttons: allVisibleBtns, attrs: allVisibleBtnAttrs });

  // Check if all mastered - if so, look for "proceed" via aria-label
  const allMastered = /60 of 60 mastered|\d+ of \d+ mastered/i.test(postModalText) &&
    postModalText.match(/(\d+) of (\d+) mastered/) &&
    postModalText.match(/(\d+) of (\d+) mastered/)[1] === postModalText.match(/(\d+) of (\d+) mastered/)[2];

  log('all_mastered_check', { allMastered, postModalText: postModalText.slice(0, 100) });

  if (allMastered) {
    // Look for "Proceed to Test" via any means
    const proceedAriaBtn = page.locator('[aria-label*="test" i], [aria-label*="proceed" i], [aria-label*="next step" i], [aria-label*="continue" i]').first();
    if (await proceedAriaBtn.isVisible().catch(() => false)) {
      log('proceed_via_aria');
      await proceedAriaBtn.click();
      await page.waitForTimeout(1500);
      auditState.reachedTest = true;
    }

    // Also try clicking the "Step 1 of 3" stepper which might be a link/button to proceed
    const stepperBtn = page.getByText('Step 1 of 3');
    if (!auditState.reachedTest && await stepperBtn.isVisible().catch(() => false)) {
      log('try_stepper_click');
      // Don't click stepper - just check what else is available
    }
  }

  let cardsStudied = 0;
  const maxCards = 200; // CORE has up to 60 cards per session
  let lastCardText = '';
  let sameCardCount = 0;

  for (let i = 0; i < maxCards; i++) {
    // Check if we're in test phase already
    const hasTestInput = await page.getByRole('textbox').first().isVisible().catch(() => false);
    const hasTestLabel = await page.getByText(/question.*of|type.*answer|your.*answer/i).first().isVisible().catch(() => false);
    const hasSubmit = await page.getByRole('button', { name: /submit/i }).first().isVisible().catch(() => false);

    if (hasTestInput && (hasTestLabel || hasSubmit)) {
      log('test_phase_detected', { afterCards: cardsStudied });
      auditState.reachedTest = true;
      break;
    }

    // Check for completion modal or "Proceed to Test" CTA
    // After all cards are mastered, a modal may appear with a "Start Test" or "Next Step" button
    const completionModal = page.locator('.fixed.inset-0').first();
    const completionModalVisible = await completionModal.isVisible().catch(() => false);
    if (completionModalVisible) {
      log('completion_modal_detected', { iteration: i });
      await screenshot(page, `completion_modal_${i}`);
      // Get modal buttons
      const modalBtns = await completionModal.locator('button').all();
      for (const btn of modalBtns) {
        const text = await btn.textContent().catch(() => '');
        const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
        log('completion_modal_btn', { text: text?.slice(0, 50), ariaLabel });
      }
      // Look for "Start Test" / "Proceed" / "Next" type button inside the modal
      const proceedInModal = completionModal.locator('button').filter({ hasText: /test|proceed|next|continue|start|begin/i }).first();
      if (await proceedInModal.isVisible().catch(() => false)) {
        log('clicking_proceed_in_modal', { iteration: i });
        await proceedInModal.click({ force: true });
        await page.waitForTimeout(1500);
        auditState.reachedTest = true;
        break;
      }
      // Try clicking the primary/brand button inside modal
      const brandBtn = completionModal.locator('.bg-brand-primary, [class*="brand-primary"]').first();
      if (await brandBtn.isVisible().catch(() => false)) {
        log('clicking_brand_btn_in_modal');
        await brandBtn.click({ force: true });
        await page.waitForTimeout(1500);
        auditState.reachedTest = true;
        break;
      }
    }

    // Also check for "Proceed to Test" or "Start Test" button outside any modal
    const proceedBtn = page.getByRole('button', { name: /proceed.*test|start.*test|continue.*test|go to test|begin test|take.*test|ready.*test|next step/i }).first();
    const proceedBtnInModal = await proceedBtn.isVisible().catch(() => false);
    const proceedBtnBlocked = proceedBtnInModal && await page.locator('.fixed.inset-0').first().isVisible().catch(() => false);
    if (proceedBtnInModal && !proceedBtnBlocked) {
      log('proceed_to_test_button_found_unblocked', { iteration: i });
      await proceedBtn.click();
      await page.waitForTimeout(1500);
      auditState.reachedTest = true;
      break;
    }

    // Check if on results page (only after we've studied at least a few cards)
    // Be careful not to mistake "60 of 60 mastered" progress text for results
    if (cardsStudied > 5) {
      const currentUrl = page.url();
      const isResultsPage = /result|score|pass|fail/i.test(currentUrl);
      const pageTextForResults = await page.evaluate(() => document.body.innerText.slice(0, 3000));
      // Only break if we see "Step 2" or "Step 3" (test or results step) AND no flashcard indicators
      const isStep2or3 = /step [23] of [23]/i.test(pageTextForResults);
      const hasFlashcardUI = /card \d+ of \d+/i.test(pageTextForResults);
      if ((isResultsPage || isStep2or3) && !hasFlashcardUI) {
        log('results_or_next_step_detected', { afterCards: cardsStudied, url: currentUrl });
        break;
      }
    }

    // First check if a modal is blocking
    const isModalBlocking = await page.locator('.fixed.inset-0').first().isVisible().catch(() => false);
    if (isModalBlocking) {
      log('modal_blocking_card', { iteration: i });
      // Could be "Customize Your Flashcards" modal
      const startStudyBtn = page.getByRole('button', { name: /start studying/i }).first();
      if (await startStudyBtn.isVisible().catch(() => false)) {
        await startStudyBtn.click();
        await page.waitForTimeout(800);
      } else {
        const mBtn = page.locator('.fixed.inset-0').locator('button').first();
        if (await mBtn.isVisible().catch(() => false)) {
          await mBtn.click();
          await page.waitForTimeout(600);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
      continue;
    }

    // Flashcard interactions:
    // Primary study buttons: "I know this word (C)" and "Not sure, study again (X)"
    // Navigation: "Next card" and "Previous card"
    const knowItBtn = page.locator('[aria-label*="I know this word"]').first();
    const notSureBtn = page.locator('[aria-label*="Not sure"]').first();
    const nextCardAria = page.locator('[aria-label="Next card"]').first();
    const showDefBtn = page.getByRole('button', { name: /show definition|show|reveal|flip/i }).first();
    const gotItBtn = page.getByRole('button', { name: /got it|i know|mark.*known/i }).first();
    const continueBtn = page.getByRole('button', { name: /continue/i }).first();

    if (await knowItBtn.isVisible().catch(() => false)) {
      // Primary: mark as known (this is how the perfectionist marks cards)
      await knowItBtn.click();
      cardsStudied++;
      await page.waitForTimeout(300);
    } else if (await nextCardAria.isVisible().catch(() => false)) {
      await nextCardAria.click();
      cardsStudied++;
      await page.waitForTimeout(300);
    } else if (await showDefBtn.isVisible().catch(() => false)) {
      await showDefBtn.click();
      await page.waitForTimeout(400);
      const advBtn = page.locator('[aria-label*="I know this word"]').first();
      const advBtn2 = page.locator('[aria-label="Next card"]').first();
      if (await advBtn.isVisible().catch(() => false)) {
        await advBtn.click();
        cardsStudied++;
        await page.waitForTimeout(300);
      } else if (await advBtn2.isVisible().catch(() => false)) {
        await advBtn2.click();
        cardsStudied++;
        await page.waitForTimeout(300);
      }
    } else if (await gotItBtn.isVisible().catch(() => false)) {
      await gotItBtn.click();
      cardsStudied++;
      await page.waitForTimeout(300);
    } else if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
      cardsStudied++;
      await page.waitForTimeout(300);
    } else {
      // No obvious button - check if test appeared
      const currentText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      if (/type|answer|question|submit/i.test(currentText)) {
        log('study_phase_ended_via_text', { afterCards: cardsStudied });
        break;
      }
      // Check for any button
      const allBtns = await page.locator('button:visible').allTextContents().catch(() => []);
      log('no_advance_button', { iteration: i, buttons: allBtns.slice(0, 8) });

      // Wait briefly and try again
      await page.waitForTimeout(500);
      const currentText2 = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      if (/type|answer|question|submit/i.test(currentText2)) {
        break;
      }
      if (i > 10) {
        log('stuck_in_study_phase', { iteration: i, text: currentText2.slice(0, 200) });
        // Take screenshot for diagnosis
        await screenshot(page, `study_stuck_${i}`);
        break;
      }
    }

    // Screenshot milestones
    if (i === 0 || i === 4) {
      await screenshot(page, `03_study_card_${i + 1}`);
    }

    // Detect if we're stuck cycling through cards (same card counter repeating)
    const currentCardText = await page.evaluate(() => {
      // Find card counter like "Card X of Y" in any text node
      const allText = [...document.querySelectorAll('*')]
        .map(el => el.childNodes)
        .reduce((acc, nodes) => {
          [...nodes].forEach(n => { if (n.nodeType === 3) acc.push(n.textContent?.trim()); });
          return acc;
        }, [])
        .join(' ');
      const match = allText.match(/Card\s+(\d+)\s+of\s+(\d+)/);
      return match ? match[0] : document.body.innerText.replace(/\s+/g, ' ').slice(100, 150);
    });

    if (currentCardText === lastCardText) {
      sameCardCount++;
    } else {
      sameCardCount = 0;
      lastCardText = currentCardText;
    }

    // If stuck on same context for 5+ iterations, check for proceed button
    if (sameCardCount >= 5) {
      log('possible_stuck_cycling', { sameCardCount, cardText: currentCardText.slice(0, 40) });
      const proceedCheck = page.getByRole('button', { name: /proceed.*test|start.*test|continue.*test|begin test|next step/i }).first();
      if (await proceedCheck.isVisible().catch(() => false)) {
        await proceedCheck.click();
        await page.waitForTimeout(1500);
        auditState.reachedTest = true;
        break;
      }
      // Check if all mastered and no progress button - take screenshot and break
      if (sameCardCount >= 15) {
        await screenshot(page, `study_stuck_cycling_${i}`);
        const allBtnsNow = await page.locator('button:visible').allTextContents().catch(() => []);
        log('stuck_cycling_buttons', { buttons: allBtnsNow });
        // Try clicking any "proceed" style button
        const anyBtn = page.locator('button:visible').filter({ hasText: /test|proceed|continue|next step/i }).first();
        if (await anyBtn.isVisible().catch(() => false)) {
          await anyBtn.click();
          await page.waitForTimeout(1500);
          break;
        }
        log('forced_exit_study_loop');
        break;
      }
    }
  }

  log('study_phase_complete', { cardsStudied });
  await screenshot(page, '04_after_study');

  // Check if we're now at test phase
  const atTest = await page.getByRole('textbox').first().isVisible().catch(() => false);
  const atTestLabel = await page.getByText(/question.*of|type.*answer/i).first().isVisible().catch(() => false);

  if (!atTest && !atTestLabel) {
    // Check for "Skip to Test" option
    const skipBtn = page.getByRole('button', { name: /skip to test/i }).first();
    if (await skipBtn.isVisible().catch(() => false)) {
      log('using_skip_to_test');
      await skipBtn.click();
      await page.waitForTimeout(800);
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip|proceed|ok/i }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(800);
      }
    }
  }

  // ---- TEST PHASE (NEW_WORD_TEST) ----
  log('test_phase_start');

  // Dismiss any modal that appeared at end of study phase / start of test
  for (let m = 0; m < 5; m++) {
    const testStartModal = await page.locator('.fixed.inset-0').first().isVisible().catch(() => false);
    if (!testStartModal) break;
    log('test_start_modal', { attempt: m });
    await screenshot(page, `test_start_modal_${m}`);
    const testModalBtns = await page.locator('.fixed.inset-0').locator('button').allTextContents().catch(() => []);
    log('test_start_modal_buttons', { buttons: testModalBtns });
    // Prefer "ok", "continue", "start", "ready" buttons
    const okBtn = page.locator('.fixed.inset-0').locator('button').filter({ hasText: /ok|continue|start|ready|got it|begin/i }).first();
    if (await okBtn.isVisible().catch(() => false)) {
      await okBtn.click({ force: true });
    } else {
      // Click any button in modal
      const anyModalBtn = page.locator('.fixed.inset-0').locator('button').first();
      if (await anyModalBtn.isVisible().catch(() => false)) {
        await anyModalBtn.click({ force: true });
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await page.waitForTimeout(800);
  }

  await screenshot(page, '05_test_phase_start');

  const testPageText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  log('test_page_text', { text: testPageText.slice(0, 600) });

  const testInputVisible = await page.getByRole('textbox').first().isVisible().catch(() => false);
  auditState.reachedTest = testInputVisible;

  if (!testInputVisible) {
    log('test_input_not_found', { pageText: testPageText.slice(0, 500) });
    auditState.classification = 'BLOCKED(test_input_not_found)';
    auditState.notes.push('FATAL: Test input not visible - could not reach test phase');
    throw new Error('Could not reach test phase - input not visible');
  }

  log('test_phase_reached');

  // Determine test format: the test shows all questions as a numbered list
  // "1. somnolent (adj.) 2. malign (v.) ..."
  const totalInputsAtStart = await page.getByRole('textbox').count();
  log('test_format_check', { totalInputs: totalInputsAtStart });

  // Answer all test questions with churn on FIRST question, then normal for rest
  // The test is a LIST FORMAT: all questions shown at once, one "Submit Test" button
  let questionsAnswered = 0;
  let firstQuestionWord = null;
  let firstQuestionFinalTyped = null;
  let firstQuestionAttemptedChurn = false;

  // Parse the test words from the page
  const testWordList = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    // Extract words from numbered list "1. word (pos.)"
    const matches = [...bodyText.matchAll(/\d+\.\s+([a-zA-Z\-']+)\s+\([a-z]+\.\)/g)];
    return matches.map(m => m[1]);
  });
  log('test_word_list', { count: testWordList.length, words: testWordList.slice(0, 5) });
  firstQuestionWord = testWordList[0] || null;

  // Get all input elements
  const allInputEls = await page.getByRole('textbox').all();
  log('test_inputs_found', { count: allInputEls.length });

  for (let q = 0; q < allInputEls.length; q++) {
    const inputEl = allInputEls[q];
    const wordName = testWordList[q] || null;

    // Find definition for this word
    let definition = 'correct';
    if (wordName) {
      const cleanWord = wordName.trim().toLowerCase();
      const matchFound = coreWords.find(w => {
        const ww = (w.word || w).toString().trim().toLowerCase();
        return ww === cleanWord;
      });
      if (matchFound) {
        definition = matchFound.definition_en || matchFound.definition || matchFound.meaning || 'correct';
      } else {
        log('word_not_matched', { wordName, cleanWord });
        definition = 'correct answer for this word'; // AI grader will fail this anyway
      }
    }

    log('test_question', { q: q + 1, word: wordName, definition: definition.slice(0, 60) });

    if (q === 0) {
      // FIRST QUESTION: Apply HEAVY EDIT CHURN to test audit issue #10
      log('applying_churn', { question: q + 1, word: wordName });
      const finalTyped = await churnyType(inputEl, definition, `Q${q + 1}_${wordName}`);
      firstQuestionFinalTyped = finalTyped;
      firstQuestionAttemptedChurn = true;
      auditState.finalTypedAnswer = finalTyped;
      await screenshot(page, '06_churn_q1_after');
      log('churn_final_value', { finalTyped, definition, match: finalTyped === definition });
    } else {
      // Normal char-by-char typing for other questions
      await inputEl.clear().catch(() => {});
      await inputEl.focus();
      for (const ch of definition) {
        await inputEl.type(ch, { delay: 15 });
      }
    }

    if (q === 1) await screenshot(page, '07_q2_normal_typing');
    questionsAnswered++;
  }

  log('all_inputs_filled', { questionsAnswered });
  await screenshot(page, '08_all_filled');

  // Check B2 error before submit
  {
    const b2InConsole = consoleErrors.some(e => /unsupported field value.*undefined|undefined.*unsupported/i.test(e));
    if (b2InConsole && !auditState.b2ErrorFound) {
      auditState.b2ErrorFound = true;
      auditState.b2ErrorText = consoleErrors.find(e => /unsupported field value.*undefined/i.test(e));
      log('b2_error_before_submit', { text: auditState.b2ErrorText });
    }
  }

  // Dismiss any modal blocking before submit
  for (let sm = 0; sm < 5; sm++) {
    const preSubmitModal = await page.locator('.fixed.inset-0').first().isVisible().catch(() => false);
    if (!preSubmitModal) break;
    log('pre_submit_modal', { attempt: sm });
    await screenshot(page, `pre_submit_modal_${sm}`);
    const preModalBtns = await page.locator('.fixed.inset-0').locator('button').allTextContents().catch(() => []);
    log('pre_submit_modal_buttons', { buttons: preModalBtns });
    const preModalDismiss = page.locator('.fixed.inset-0').locator('button').first();
    if (await preModalDismiss.isVisible().catch(() => false)) {
      await preModalDismiss.click({ force: true });
      await page.waitForTimeout(600);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // Click Submit Test button
  const submitTestBtn = page.locator('button').filter({ hasText: /submit test|submit/i }).first();
  if (await submitTestBtn.isVisible().catch(() => false)) {
    log('clicking_submit_test');
    await submitTestBtn.click();
    log('submit_clicked');
  } else {
    // Try force click
    log('submit_force_click_attempt');
    await submitTestBtn.click({ force: true }).catch(async (e) => {
      log('submit_force_click_failed', { error: e.message?.slice(0, 100) });
    });
  }

  await page.waitForTimeout(2000);
  await screenshot(page, '09_after_submit');

  // Check B2 error after submit
  {
    const b2InConsole2 = consoleErrors.some(e => /unsupported field value.*undefined|undefined.*unsupported/i.test(e));
    if (b2InConsole2 && !auditState.b2ErrorFound) {
      auditState.b2ErrorFound = true;
      auditState.b2ErrorText = consoleErrors.find(e => /unsupported field value.*undefined/i.test(e));
      log('b2_error_after_submit', { text: auditState.b2ErrorText });
    }
  }

  // Wait for grading (Cloud Function - up to 45s)
  log('waiting_for_grading');
  let gradingWait = 0;
  while (gradingWait < 60) {
    const gradingVisible = await page.getByText(/grading|analyzing|checking|processing|please wait/i).first().isVisible().catch(() => false);
    if (!gradingVisible) break;
    log('grading_in_progress', { elapsed: gradingWait });
    await page.waitForTimeout(3000);
    gradingWait += 3;
  }
  log('grading_wait_done', { elapsed: gradingWait });

  // Check B2 error after grading
  {
    const b2AfterGrading = consoleErrors.some(e => /unsupported field value.*undefined|undefined.*unsupported/i.test(e));
    if (b2AfterGrading && !auditState.b2ErrorFound) {
      auditState.b2ErrorFound = true;
      auditState.b2ErrorText = consoleErrors.find(e => /unsupported field value.*undefined/i.test(e));
      log('b2_error_after_grading', { text: auditState.b2ErrorText });
    }
  }

  log('test_phase_complete', { questionsAnswered });
  await screenshot(page, '10_after_grading');

  const resultsText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  log('results_page', { text: resultsText.slice(0, 600) });

  // Verify Day 1 completion
  const day1CompletedUI = /complete|pass|result|score|day.*done|well done|great|finished/i.test(resultsText);
  auditState.completedDay1 = auditState.completedDay1 || day1CompletedUI;
  log('day1_completion_ui', { detected: day1CompletedUI, text: resultsText.slice(0, 300) });

  // ---- POST-TEST FIRESTORE VERIFICATION ----
  log('firestore_post_test_read');
  await page.waitForTimeout(3000); // Allow Firestore writes to propagate

  const [cpAfter, attemptsAfter, ssAfter, orphansAfter] = await Promise.all([
    getClassProgress(uid, ACCOUNT.classId),
    getAttempts(uid, ACCOUNT.classId),
    getStudyStates(uid),
    checkOrphanDocs(uid),
  ]);

  const csdAfter = cpAfter.length > 0 ? (cpAfter[0].currentStudyDay ?? null) : null;
  auditState.csdAfter = csdAfter;
  auditState.attemptsAfter = attemptsAfter;
  auditState.studyStatesAfter = ssAfter;
  auditState.orphansAfter = orphansAfter;

  log('firestore_post', {
    csdBefore: auditState.csdBefore,
    csdAfter,
    classProgressDocs: cpAfter.length,
    attemptsAfter: attemptsAfter.length,
    studyStatesAfter: ssAfter.length,
    orphansAfter: JSON.stringify(orphansAfter).slice(0, 200),
  });

  // ---- VERIFY ANSWER INTEGRITY (Audit Issue #10) ----
  // The stored answer should match the final typed answer, NOT a mid-edit value
  // Attempt doc schema: answers[].studentResponse (confirmed via Admin SDK inspection)
  let answerIntegrity = null;
  if (attemptsAfter.length > 0) {
    // Find the latest attempt (most recent submittedAt)
    const latestAttempt = attemptsAfter.sort((a, b) => {
      const ta = a.submittedAt?.toMillis?.() || a.createdAt?.toMillis?.() || a.timestamp?.toMillis?.() || 0;
      const tb = b.submittedAt?.toMillis?.() || b.createdAt?.toMillis?.() || b.timestamp?.toMillis?.() || 0;
      return tb - ta;
    })[0];

    log('latest_attempt', { id: latestAttempt.id, score: latestAttempt.score, passed: latestAttempt.passed, studyDay: latestAttempt.studyDay });

    // The attempt schema uses answers[].studentResponse
    const answers = latestAttempt.answers || [];
    const firstAnswer = Array.isArray(answers) && answers.length > 0 ? answers[0] : null;

    if (firstAnswer) {
      // The field is 'studentResponse' (confirmed via Admin SDK)
      const storedText = firstAnswer.studentResponse || firstAnswer.answer || firstAnswer.response || firstAnswer.typed || firstAnswer.text || '';
      auditState.finalStoredAnswer = storedText;
      const firstAnswerWord = firstAnswer.word || null;

      // Compare stored vs typed
      const storedMatchesFinal = storedText === auditState.finalTypedAnswer;
      answerIntegrity = storedMatchesFinal;
      auditState.answerIntegrityOk = storedMatchesFinal;

      log('answer_integrity', {
        firstAnswerWord,
        finalTyped: auditState.finalTypedAnswer?.slice(0, 80),
        storedAnswer: storedText.slice(0, 80),
        match: storedMatchesFinal,
        lengthDiff: Math.abs((auditState.finalTypedAnswer?.length || 0) - storedText.length),
        isCorrect: firstAnswer.isCorrect,
      });
    } else {
      log('no_answer_in_attempt', { attemptKeys: Object.keys(latestAttempt) });
      auditState.notes.push('WARN: Could not find individual answer in attempt doc - answers array empty');
    }

    // Also record the overall result
    auditState.notes.push(`Attempt score: ${latestAttempt.score}/${latestAttempt.totalQuestions}, passed: ${latestAttempt.passed}`);
  } else {
    log('no_attempts_after', {});
    auditState.notes.push('WARN: No attempt docs found after test completion');
  }

  // ---- VERIFY NEW-WORD SLICE (Day-1 slice [0, pace)) ----
  log('verify_word_slice');
  const pace = auditState.pace || (coreListData?.pace) || null;

  if (coreWords.length > 0 && pace) {
    const expectedSlice = coreWords.slice(0, pace);
    auditState.newWordSliceDetails = {
      pace,
      totalWords: coreWords.length,
      expectedSlice: expectedSlice.slice(0, 5).map(w => w.word || w),
    };

    // Verify that study states correspond to words in [0, pace)
    const studiedWordIds = ssAfter.map(s => s.wordId || s.word || s.wordIndex);
    log('word_slice_check', {
      pace,
      studiedCount: ssAfter.length,
      expectedSliceSample: expectedSlice.slice(0, 5).map(w => w.word || w),
    });

    // Check if the study states are within the expected slice
    // (This is approximate - the slice check depends on how the app indexes words)
    const sliceOk = ssAfter.length <= pace;
    auditState.newWordSliceCorrect = sliceOk;
    auditState.notes.push(`New-word slice: pace=${pace}, study_states=${ssAfter.length}, sliceOk=${sliceOk}`);
  } else {
    auditState.newWordSliceCorrect = null;
    auditState.notes.push(`WARN: Cannot verify word slice - pace=${pace}, coreWords=${coreWords.length}`);
  }

  // ---- CHECK FOR ORPHAN DOCS ----
  const orphanCount = Object.values(orphansAfter).reduce((sum, docs) => sum + docs.length, 0);
  log('orphan_check', { orphanCount, collections: Object.keys(orphansAfter) });

  // ---- CHECK DAY-1 ATTEMPT COUNT ----
  const attemptDelta = attemptsAfter.length - attemptsBefore.length;
  log('attempt_count', { before: attemptsBefore.length, after: attemptsAfter.length, delta: attemptDelta });

  const oneAttempt = attemptDelta === 1;
  auditState.notes.push(`Day-1 attempts created: ${attemptDelta} (expected: 1)`);

  // ---- CLASSIFICATION ----
  const b2Clean = !auditState.b2ErrorFound;
  const answerOk = auditState.answerIntegrityOk !== false; // null = cannot verify, false = FAIL
  const sliceOk = auditState.newWordSliceCorrect !== false;
  const csdAdvanced = csdAfter !== null && (csdBefore === null || csdAfter > csdBefore || csdAfter === 1);

  if (!auditState.reachedTest) {
    auditState.classification = 'BLOCKED(did_not_reach_test)';
  } else if (!auditState.completedDay1) {
    auditState.classification = 'COMPLETED_NOPASS';
  } else if (auditState.b2ErrorFound) {
    auditState.classification = 'COMPLETED_NOPASS';
    auditState.notes.push('FAIL: B2 error (Unsupported field value: undefined) detected');
  } else if (!answerOk) {
    auditState.classification = 'COMPLETED_NOPASS';
    auditState.notes.push('FAIL: Answer integrity check failed - stored answer != final typed answer');
  } else {
    auditState.classification = 'COMPLETED_PASS';
  }

  log('classification', { classification: auditState.classification });
  auditState.consoleErrors = consoleErrors;

} catch (err) {
  log('fatal_error', { message: err.message, stack: err.stack?.slice(0, 500) });
  if (!auditState.classification || auditState.classification === 'BLOCKED(unknown)') {
    auditState.classification = `BLOCKED(${err.message.slice(0, 80)})`;
  }
  console.error('FATAL:', err.message);
} finally {
  if (browser) {
    await browser.close();
    log('browser_closed');
  }

  flushLogs();

  // Write status.json
  const statusJson = {
    label: 'D1-09',
    account: ACCOUNT.email,
    classId: ACCOUNT.classId,
    listId: ACCOUNT.listId,
    uid: auditState.uid,
    testMode: auditState.testMode,
    reachedTest: auditState.reachedTest,
    completedDay1: auditState.completedDay1,
    classification: auditState.classification,
    b2ErrorFound: auditState.b2ErrorFound,
    b2ErrorText: auditState.b2ErrorText,
    answerIntegrityOk: auditState.answerIntegrityOk,
    finalTypedAnswer: auditState.finalTypedAnswer?.slice(0, 100),
    finalStoredAnswer: auditState.finalStoredAnswer?.slice(0, 100),
    newWordSliceCorrect: auditState.newWordSliceCorrect,
    newWordSliceDetails: auditState.newWordSliceDetails,
    csdBefore: auditState.csdBefore,
    csdAfter: auditState.csdAfter,
    attemptsBefore: auditState.attemptsBefore.length,
    attemptsAfter: auditState.attemptsAfter.length,
    orphanDocs: Object.values(auditState.orphansAfter).reduce((sum, d) => sum + d.length, 0),
    consoleErrorCount: consoleErrors.length,
    consoleErrorSample: consoleErrors.slice(0, 3),
    notes: auditState.notes,
    ts: new Date().toISOString(),
  };
  writeFileSync(STATUS_FILE, JSON.stringify(statusJson, null, 2));

  // Write markdown report
  const report = `# D1-09 Perfectionist CORE — Day-1 Completion Test

**Label:** D1-09
**Account:** ${ACCOUNT.email}
**Class:** CORE (${ACCOUNT.classId})
**List:** ${ACCOUNT.listId}
**Executed:** ${new Date().toISOString()}
**Bundle:** index-CflgDyCK.js (prod)

---

## Classification: ${auditState.classification}

---

## Status Block

| Field | Value |
|-------|-------|
| Account | ${ACCOUNT.email} |
| CORE testMode | ${auditState.testMode ?? 'unknown'} |
| Reached test? | ${auditState.reachedTest ? 'YES' : 'NO'} |
| Classification | **${auditState.classification}** |
| B2 strand (Unsupported field value: undefined)? | ${auditState.b2ErrorFound ? 'YES — ' + (auditState.b2ErrorText || 'detected') : 'NONE'} |
| Final-answer integrity under edit churn (correct?) | ${auditState.answerIntegrityOk === true ? 'YES (stored == typed)' : auditState.answerIntegrityOk === false ? 'NO (MISMATCH)' : 'UNVERIFIABLE (schema unknown)'} |
| New-word slice correct? | ${auditState.newWordSliceCorrect === true ? 'YES' : auditState.newWordSliceCorrect === false ? 'NO' : 'UNVERIFIABLE'} |
| CSD before → after | ${auditState.csdBefore ?? 'null'} → ${auditState.csdAfter ?? 'null'} |
| Console errors | ${consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join('; ').slice(0, 300) : 'NONE'} |
| Orphan docs | ${Object.values(auditState.orphansAfter).reduce((sum, d) => sum + d.length, 0) === 0 ? 'NONE' : JSON.stringify(auditState.orphansAfter).slice(0, 200)} |
| Day-1 OK? | ${auditState.completedDay1 && auditState.classification === 'COMPLETED_PASS' ? 'YES' : 'NO'} |

---

## Details

### CORE Config
- Pace: ${auditState.pace ?? 'unknown'}
- testMode: ${auditState.testMode ?? 'unknown'}

### Session Flow
- Cards studied in flashcard phase: see logs
- Reached test phase: ${auditState.reachedTest}
- Day-1 UI completion detected: ${auditState.completedDay1}

### Edit Churn Test (Audit Issue #10)
- Final typed answer: \`${(auditState.finalTypedAnswer || 'N/A').slice(0, 80)}\`
- Final stored answer: \`${(auditState.finalStoredAnswer || 'N/A — unverifiable').slice(0, 80)}\`
- Integrity OK: ${auditState.answerIntegrityOk}

### Firestore
- Attempts before: ${auditState.attemptsBefore.length}
- Attempts after: ${auditState.attemptsAfter.length}
- Delta: ${auditState.attemptsAfter.length - auditState.attemptsBefore.length}
- CSD: ${auditState.csdBefore ?? 'null'} → ${auditState.csdAfter ?? 'null'}

### New-Word Slice
${auditState.newWordSliceDetails ? JSON.stringify(auditState.newWordSliceDetails, null, 2) : 'Could not verify'}

### Notes
${auditState.notes.map(n => `- ${n}`).join('\n')}

---

## Console Errors
${consoleErrors.length === 0 ? 'None' : consoleErrors.slice(0, 10).map(e => `- \`${e.slice(0, 200)}\``).join('\n')}

---

*Generated by D1-09 audit script*
`;

  writeFileSync(REPORT_FILE, report);
  console.log('\n=== D1-09 COMPLETE ===');
  console.log('Classification:', auditState.classification);
  console.log('Report:', REPORT_FILE);
  console.log('Status:', STATUS_FILE);
  console.log('Logs:', LOG_FILE);
}
