/**
 * B04 Run 2 — Day-1 Happy Path
 * Focus: CORE careful student (confirmed Day 1 fresh state)
 * Handle the "Customize Your Flashcards" modal that blocks clicks
 * Use Skip to Test for speed; also test one NORMAL flow card
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B04';
mkdirSync(EVIDENCE_DIR, { recursive: true });

const seeded = JSON.parse(readFileSync('/app/audit/playwright/seeded_accounts.json', 'utf-8'));
const auditState = JSON.parse(readFileSync('/app/audit/playwright/audit_state.json', 'utf-8'));

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

async function loginAs(page, personaId, targetClass) {
  const account = getAccount(personaId, targetClass);
  console.log(`  Login as ${account.email}`);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

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
  return account;
}

// Dismiss any blocking modals
async function dismissModal(page) {
  // "Customize Your Flashcards" modal - click Start Studying or the primary CTA
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first();
  if (await startStudyingBtn.isVisible().catch(() => false)) {
    await startStudyingBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Generic confirm/close buttons
  const closeBtn = page.getByRole('button', { name: /close|dismiss|confirm|ok|got it|continue/i }).first();
  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
    return true;
  }

  // Press Escape to dismiss modals
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return false;
}

// Check if a modal overlay is blocking
async function isModalOpen(page) {
  const overlay = page.locator('.fixed.inset-0, [data-modal], [role="dialog"]').first();
  return await overlay.isVisible().catch(() => false);
}

async function getFirestoreState(uid) {
  const [cp, ss, attempts] = await Promise.all([
    db.collection('class_progress').where('studentId', '==', uid).get(),
    db.collection('study_states').where('studentId', '==', uid).get(),
    db.collection('attempts').where('studentId', '==', uid).get(),
  ]);
  return {
    class_progress: cp.docs.map(d => ({ id: d.id, ...d.data() })),
    study_states: ss.docs.map(d => ({ id: d.id, ...d.data() })),
    attempts: attempts.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

async function saveFirestoreEvidence(uid, label) {
  const state = await getFirestoreState(uid);
  const evPath = path.join(EVIDENCE_DIR, `${label}_firestore.json`);
  writeFileSync(evPath, JSON.stringify(state, null, 2));
  console.log(`  💾 ${label}_firestore.json (cp:${state.class_progress.length} ss:${state.study_states.length} attempts:${state.attempts.length})`);
  return state;
}

const results = {};
const findings = [];
const consoleLog = [];

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
  });

  // ================================================================
  // PRIMARY TEST: CORE careful student (Day 1, fresh)
  // ================================================================
  const coreAccount = getAccount('careful', 'CORE');
  const uidCore = coreAccount.uid;
  console.log(`\nPrimary student: ${coreAccount.email} (uid: ${uidCore})`);

  const beforeFs = await saveFirestoreEvidence(uidCore, 'B04_run2_CORE_before');
  console.log(`  Baseline: cp=${beforeFs.class_progress.length}, ss=${beforeFs.study_states.length}, attempts=${beforeFs.attempts.length}`);

  // ================================================================
  // S01 — NEW_WORDS flashcard phase (CORE Day 1 fresh)
  // Normal flow: study at least a few cards, then skip to test for speed
  // ================================================================
  console.log('\n=== S01: NEW_WORDS Flashcard Phase (CORE Day 1) ===');

  const ctx1 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  });
  const page = await ctx1.newPage();
  page._consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      page._consoleErrors.push(msg.text());
      consoleLog.push({ type: 'error', text: msg.text() });
    }
  });

  await loginAs(page, 'careful', 'CORE');
  await screenshot(page, 'B04_r2_S01_01_dashboard');

  // Find session start button
  await page.waitForTimeout(2000);
  const dashText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('  Dashboard text:', dashText.slice(0, 300));

  // Look for "Start Session" button
  let startBtn = page.getByRole('button', { name: /start session|start today|begin session/i }).first();
  if (await startBtn.count() === 0) {
    startBtn = page.getByText(/start session/i).first();
  }
  const startVisible = await startBtn.isVisible().catch(() => false);
  console.log('  Start button visible:', startVisible);

  if (!startVisible) {
    console.log('  Looking for any session-related button...');
    const allBtns = await page.locator('button').allTextContents();
    console.log('  All buttons:', allBtns.slice(0, 20));
  }

  results.S01 = { result: 'pending', notes: [] };

  if (startVisible) {
    await startBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'B04_r2_S01_02_session_started');

    const sessionUrl = page.url();
    console.log('  Session URL:', sessionUrl);
    results.S01.notes.push(`Session URL: ${sessionUrl}`);

    // Handle "Customize Your Flashcards" modal first
    let modalDismissed = false;
    for (let i = 0; i < 5; i++) {
      if (await isModalOpen(page)) {
        await screenshot(page, `B04_r2_S01_modal_${i}`);
        const dismissed = await dismissModal(page);
        if (dismissed) {
          modalDismissed = true;
          console.log(`  Modal dismissed on attempt ${i+1}`);
          break;
        }
      } else {
        break;
      }
      await page.waitForTimeout(500);
    }

    await screenshot(page, 'B04_r2_S01_03_after_modal');
    const sessionText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    console.log('  Session text:', sessionText.slice(0, 500));

    // Check for flashcard elements — look for "Next card" button (aria-label)
    const nextCardBtn = page.locator('[aria-label="Next card"]').first();
    const nextCardVisible = await nextCardBtn.isVisible().catch(() => false);
    console.log('  Next card button visible:', nextCardVisible);

    // Also check for "I know" / "Still learning" / card flip buttons
    const iKnowBtn = page.getByRole('button', { name: /i know|know|mastered/i }).first();
    const stillLearningBtn = page.getByRole('button', { name: /still learning|learning|didn't know/i }).first();
    const iKnowVisible = await iKnowBtn.isVisible().catch(() => false);
    const stillVisible = await stillLearningBtn.isVisible().catch(() => false);

    console.log('  "I know" button visible:', iKnowVisible);
    console.log('  "Still learning" button visible:', stillVisible);

    if (nextCardVisible || iKnowVisible || stillVisible) {
      results.S01.notes.push('Flashcard phase confirmed active');

      // Study a few cards the normal way to validate the flow
      let cardsStudied = 0;
      const studyCount = 3; // Study 3 cards normally, then Skip to Test

      for (let i = 0; i < studyCount * 3; i++) { // extra iterations for modal handling
        // Check if we moved beyond flashcards
        const skipBtn = page.getByRole('button', { name: /skip to test/i }).first();
        const skipVisible = await skipBtn.isVisible().catch(() => false);

        if (cardsStudied >= studyCount && skipVisible) {
          console.log(`  Studied ${cardsStudied} cards, will use Skip to Test`);
          break;
        }

        // Check for modal overlay
        const modalOverlay = page.locator('.fixed.inset-0').first();
        if (await modalOverlay.isVisible().catch(() => false)) {
          await dismissModal(page);
          await page.waitForTimeout(500);
          continue;
        }

        // Look for card front (before flip)
        const cardFront = page.locator('[class*="card"], [class*="flashcard"]').first();

        // Try to click the card to flip it, then click "I know" or "Next card"
        const iKnow2 = page.getByRole('button', { name: /i know|know|mastered/i }).first();
        const nextCard2 = page.locator('[aria-label="Next card"]').first();
        const stillLearning2 = page.getByRole('button', { name: /still learning/i }).first();

        // Check if "show answer" or flip is needed first
        const showAnswerBtn = page.getByRole('button', { name: /show answer|flip|reveal/i }).first();
        if (await showAnswerBtn.isVisible().catch(() => false)) {
          await showAnswerBtn.click();
          await page.waitForTimeout(500);
        }

        if (await iKnow2.isVisible().catch(() => false)) {
          await iKnow2.click();
          cardsStudied++;
          await page.waitForTimeout(500);
        } else if (await nextCard2.isVisible().catch(() => false)) {
          await nextCard2.click();
          cardsStudied++;
          await page.waitForTimeout(400);
        } else if (await stillLearning2.isVisible().catch(() => false)) {
          await stillLearning2.click();
          cardsStudied++;
          await page.waitForTimeout(400);
        } else {
          // Try clicking the card itself
          const card = page.locator('[class*="cursor-pointer"][class*="card"], .cursor-pointer').first();
          if (await card.isVisible().catch(() => false)) {
            await card.click();
            await page.waitForTimeout(500);
          } else {
            console.log(`  No advance button found at iteration ${i}`);
            break;
          }
        }

        if (i === 0) await screenshot(page, 'B04_r2_S01_card_1');
        if (i === 2) await screenshot(page, 'B04_r2_S01_card_3');
      }

      console.log(`  Cards studied: ${cardsStudied}`);
      results.S01.notes.push(`Cards studied (normal flow): ${cardsStudied}`);

      if (cardsStudied > 0) {
        results.S01.result = 'pass';
        results.S01.notes.push('Normal flashcard navigation works ✓');
      } else {
        results.S01.result = 'partial';
        results.S01.notes.push('No cards successfully navigated — buttons may have different labels');
        await screenshot(page, 'B04_r2_S01_debug');
        const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
        console.log('  Current body:', bodyText.slice(0, 800));
      }
    } else {
      // Check if we're already at test phase or some other state
      const currentText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
      console.log('  Current page state:', currentText.slice(0, 500));
      results.S01.result = 'partial';
      results.S01.notes.push('Flashcard UI not detected — may be on different page state');
    }
  } else {
    results.S01.result = 'fail';
    results.S01.notes.push('Start Session button not found on dashboard');
    const allBtns = await page.locator('button').allTextContents();
    console.log('  Available buttons:', allBtns);
    findings.push({
      id: 'F01',
      severity: 'BLOCKER',
      title: 'Session start button not found on CORE Day-1 dashboard',
      scenario: 'S01',
    });
  }

  // ================================================================
  // S02 — NEW_WORD_TEST via Skip to Test (CORE, 25 questions, typed)
  // ================================================================
  console.log('\n=== S02: NEW_WORD_TEST via Skip to Test ===');
  results.S02 = { result: 'pending', notes: [] };

  // Look for Skip to Test button
  await page.waitForTimeout(1000);
  const skipBtn = page.getByRole('button', { name: /skip to test/i }).first();
  let skipVisible = await skipBtn.isVisible().catch(() => false);
  console.log('  Skip to Test visible:', skipVisible);

  if (!skipVisible) {
    // Try to navigate the session menu
    const menuBtn = page.locator('[aria-label*="menu"], button[class*="menu"]').first();
    const moreBtn = page.locator('button').filter({ hasText: /⋮|menu|options/i }).first();
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.click();
      await page.waitForTimeout(500);
      skipVisible = await skipBtn.isVisible().catch(() => false);
    }
    await screenshot(page, 'B04_r2_S02_menu_check');
  }

  if (skipVisible) {
    await skipBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'B04_r2_S02_skip_modal');

    // Confirm modal
    const confirmBtn = page.getByRole('button', { name: /confirm|yes|skip|proceed|start test/i }).first();
    const confirmVisible = await confirmBtn.isVisible().catch(() => false);
    console.log('  Confirm button visible:', confirmVisible);
    if (confirmVisible) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
    await screenshot(page, 'B04_r2_S02_01_test_start');
  } else {
    // Try accessing the test directly if already there
    const testText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log('  Current state (no skip btn):', testText.slice(0, 400));
    results.S02.notes.push('Skip to Test not available');
    await screenshot(page, 'B04_r2_S02_no_skip');
  }

  // Check if we're now on the test
  await page.waitForTimeout(2000);
  const testText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('  Test page text:', testText.slice(0, 600));

  const coreWords = auditState.lists.coreActiveList.words;

  // Answer test questions
  let questionsAnswered = 0;
  let questionsCorrect = 0;
  const maxQ = 30;

  for (let q = 0; q < maxQ; q++) {
    // Check if at results
    const isResults = await page.getByText(/result|score|you (got|scored)|passed|failed|well done/i).first().isVisible().catch(() => false);
    const isComplete = await page.getByText(/session complete|all done/i).first().isVisible().catch(() => false);
    if (isResults || isComplete) {
      console.log(`  Results reached after ${questionsAnswered} questions`);
      break;
    }

    // Find the answer input
    const answerInput = page.getByRole('textbox').first();
    if (!await answerInput.isVisible().catch(() => false)) {
      // Check for MCQ mode
      const radioOptions = page.locator('input[type="radio"]');
      if (await radioOptions.count() > 0) {
        await radioOptions.first().click();
        const submitMCQ = page.getByRole('button', { name: /submit|next|check/i }).first();
        if (await submitMCQ.isVisible().catch(() => false)) await submitMCQ.click();
        questionsAnswered++;
        await page.waitForTimeout(300);
        continue;
      }
      const currentState = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      console.log(`  Q${q+1}: No textbox found. Page: ${currentState.slice(0, 200)}`);
      break;
    }

    // Identify the word being tested
    const wordOnPage = await page.evaluate(() => {
      // Common patterns for word display
      const selectors = [
        '[class*="word"][class*="display"]',
        '[class*="test"] h1, [class*="test"] h2',
        'h1:not([class*="title"])',
        '[data-testid*="word"]',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          const txt = el.textContent?.trim();
          if (txt && txt.length < 60) return txt;
        }
      }
      // Fallback: find a standalone word near the top
      const headings = [...document.querySelectorAll('h1, h2, h3')];
      for (const h of headings) {
        const txt = h.textContent?.trim();
        if (txt && txt.length < 60 && !/(question|answer|submit|step|day|progress|session)/i.test(txt)) {
          return txt;
        }
      }
      return null;
    });

    // Find matching definition
    let definition = 'a quality or characteristic';
    if (wordOnPage) {
      const cleanWord = wordOnPage.replace(/\r?\n.*/g, '').trim().toLowerCase();
      const match = coreWords.find(w => {
        const wClean = w.word.replace(/\r?\n.*/g, '').trim().toLowerCase();
        return wClean === cleanWord || wClean.startsWith(cleanWord) || cleanWord.startsWith(wClean.split('\r')[0]);
      });
      if (match) {
        definition = match.definition_en;
      } else {
        console.log(`  Q${q+1}: Word "${cleanWord}" not in word list, using fallback`);
      }
    }

    if (q === 0) console.log(`  Q1: word="${wordOnPage}", definition="${definition.slice(0, 50)}..."`);

    // Type the answer char by char
    await answerInput.clear();
    await answerInput.focus();
    for (const ch of definition) {
      await answerInput.type(ch, { delay: 80 });
    }

    if (q === 0) await screenshot(page, 'B04_r2_S02_02_first_answer');

    // Submit
    const submitBtn = page.getByRole('button', { name: /submit|next|check|confirm/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    } else {
      await answerInput.press('Enter');
    }

    questionsAnswered++;
    await page.waitForTimeout(800);

    // Handle grading wait (typed = real Cloud Function)
    const gradingVisible = await page.getByText(/grading|analyzing|checking|please wait|processing/i).first().isVisible().catch(() => false);
    if (gradingVisible) {
      console.log(`  Q${questionsAnswered}: Waiting for Cloud Function grading...`);
      // Wait up to 30s for grading
      for (let g = 0; g < 6; g++) {
        await page.waitForTimeout(5000);
        const stillGrading = await page.getByText(/grading|analyzing|checking|please wait|processing/i).first().isVisible().catch(() => false);
        if (!stillGrading) break;
      }
    }
  }

  console.log(`  Questions answered: ${questionsAnswered}`);
  await screenshot(page, 'B04_r2_S02_03_after_test');
  const afterTestText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('  After test text:', afterTestText.slice(0, 500));

  results.S02.notes.push(`Questions answered: ${questionsAnswered}`);

  if (questionsAnswered > 0) {
    // Check for results page
    const hasResults = /result|score|pass|fail|well done/i.test(afterTestText);
    results.S02.result = hasResults ? 'pass' : 'partial';
    results.S02.notes.push(`Results page visible: ${hasResults}`);
  } else {
    results.S02.result = 'fail';
    results.S02.notes.push('No questions answered — test phase not reached');
    findings.push({
      id: 'F02',
      severity: 'BLOCKER',
      title: 'NEW_WORD_TEST phase not reached via Skip to Test in Day-1 session',
      scenario: 'S02',
    });
  }

  // ================================================================
  // S03 — Firestore verification
  // ================================================================
  console.log('\n=== S03: Firestore Verification ===');
  results.S03 = { result: 'pending', notes: [] };

  await page.waitForTimeout(5000); // propagation delay

  const afterFs = await saveFirestoreEvidence(uidCore, 'B04_run2_CORE_after_test');

  // 1. Check attempt docs (expect 1 for this deterministic session id)
  console.log(`  Attempts: ${afterFs.attempts.length}`);
  afterFs.attempts.forEach(a => console.log(`    attempt: ${a.id} day=${a.day} score=${a.score} passed=${a.passed}`));

  // 2. Check class_progress
  console.log(`  class_progress docs: ${afterFs.class_progress.length}`);
  afterFs.class_progress.forEach(cp => console.log(`    cp: currentStudyDay=${cp.currentStudyDay} streak=${cp.streakDays}`));

  // 3. Check study_states
  console.log(`  study_states docs: ${afterFs.study_states.length}`);

  let s03Pass = true;

  // Attempt doc check
  if (afterFs.attempts.length === 0) {
    s03Pass = false;
    results.S03.notes.push('FAIL: No attempt doc created');
    findings.push({
      id: 'F03',
      severity: 'BLOCKER',
      title: 'No attempt doc in Firestore after Day-1 typed test submission',
      scenario: 'S03',
      observed: '0 attempt docs for student after test completion',
      expected: '1 attempt doc',
    });
  } else {
    const dayAttempts = afterFs.attempts.filter(a => a.day === 1);
    results.S03.notes.push(`Total attempt docs: ${afterFs.attempts.length}, Day-1 attempts: ${dayAttempts.length}`);

    if (dayAttempts.length > 1) {
      findings.push({
        id: 'F03',
        severity: 'BLOCKER',
        title: `Duplicate attempt docs: ${dayAttempts.length} Day-1 attempt docs`,
        scenario: 'S03',
      });
    } else {
      results.S03.notes.push('Attempt doc count OK ✓');
    }
  }

  // class_progress.currentStudyDay check
  if (afterFs.class_progress.length === 0) {
    // WARN — may be that session not fully complete (no explicit submit of session)
    results.S03.notes.push('WARN: No class_progress doc yet (session may still be in progress)');
    // This may not be a blocker if the student hasn't hit "Continue" after results
  } else {
    const cp = afterFs.class_progress[0];
    const csd = cp.currentStudyDay;
    results.S03.notes.push(`currentStudyDay: ${csd}, streakDays: ${cp.streakDays}`);
    if (csd !== 1) {
      results.S03.notes.push(`NOTE: currentStudyDay=${csd} (expected 1 for first completion)`);
    }
  }

  results.S03.result = s03Pass ? 'pass' : 'fail';

  // ================================================================
  // Check results screen and continue button
  // ================================================================
  console.log('\n=== Checking results screen ===');
  await screenshot(page, 'B04_r2_S03_01_results');
  const resultsText = await page.evaluate(() => document.body.innerText.slice(0, 3000));

  // Look for "Continue" button on results
  const continueBtn = page.getByRole('button', { name: /continue|go to dashboard|finish|done/i }).first();
  const continueVisible = await continueBtn.isVisible().catch(() => false);
  console.log('  Continue button visible:', continueVisible);

  if (continueVisible) {
    await continueBtn.click();
    await page.waitForTimeout(3000);
    await screenshot(page, 'B04_r2_S03_02_after_continue');

    // Re-check Firestore after clicking Continue
    const afterContinueFs = await saveFirestoreEvidence(uidCore, 'B04_run2_CORE_after_continue');
    console.log(`  After continue: cp=${afterContinueFs.class_progress.length} ss=${afterContinueFs.study_states.length}`);
    afterContinueFs.class_progress.forEach(cp => console.log(`    cp: csd=${cp.currentStudyDay} streak=${cp.streakDays}`));

    if (afterContinueFs.class_progress.length > 0) {
      const cp = afterContinueFs.class_progress[0];
      results.S03.notes.push(`After Continue: currentStudyDay=${cp.currentStudyDay}, streakDays=${cp.streakDays}`);
      if (cp.currentStudyDay === 1 || cp.currentStudyDay === 2) {
        results.S03.notes.push(`currentStudyDay advanced correctly ✓`);
      }
    }
  }

  // ================================================================
  // S04 — Day-1 fail → retake (use different student to avoid state pollution)
  // ================================================================
  console.log('\n=== S04: Day-1 Fail → Retake ===');
  results.S04 = { result: 'pending', notes: [] };

  // Use firsttimer student for S04 to get fresh Day-1
  const firsttimerAcct = seeded.accounts.find(a => a.personaId === 'firsttimer' && a.targetClass === 'CORE');
  const lazyCoreAcct = seeded.accounts.find(a => a.personaId === 'lazy' && a.targetClass === 'CORE');
  const s04Account = firsttimerAcct || lazyCoreAcct;

  if (!s04Account) {
    results.S04.result = 'skipped';
    results.S04.notes.push('No suitable fresh student account for S04');
  } else {
    const uid04 = s04Account.uid;
    const before04Fs = await saveFirestoreEvidence(uid04, 'B04_r2_S04_before');
    console.log(`  S04 student: ${s04Account.email} (Day progress: cp=${before04Fs.class_progress.length})`);

    const page4 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
    }).then(ctx => ctx.newPage());
    page4._consoleErrors = [];
    page4.on('console', msg => { if (msg.type() === 'error') page4._consoleErrors.push(msg.text()); });

    try {
      await loginAs(page4, s04Account.personaId, s04Account.targetClass);
      await page4.waitForTimeout(2000);
      await screenshot(page4, 'B04_r2_S04_01_dashboard');

      // Start session
      const startBtn4 = page4.getByRole('button', { name: /start session/i }).first();
      await page4.waitForTimeout(2000);
      if (await startBtn4.isVisible().catch(() => false)) {
        await startBtn4.click();
        await page4.waitForTimeout(2000);
      }

      // Dismiss customize modal if present
      for (let i = 0; i < 3; i++) {
        const modal = page4.locator('.fixed.inset-0').first();
        if (await modal.isVisible().catch(() => false)) {
          await dismissModal(page4);
          await page4.waitForTimeout(500);
        }
      }

      // Use Skip to Test
      const skip4 = page4.getByRole('button', { name: /skip to test/i }).first();
      await page4.waitForTimeout(1000);
      if (await skip4.isVisible().catch(() => false)) {
        await skip4.click();
        await page4.waitForTimeout(1000);
        const confirm4 = page4.getByRole('button', { name: /confirm|yes|skip|proceed|start test/i }).first();
        if (await confirm4.isVisible().catch(() => false)) await confirm4.click();
        await page4.waitForTimeout(2000);
      } else {
        const body4 = await page4.evaluate(() => document.body.innerText.slice(0, 2000));
        console.log('  S04: Skip btn not found. Body:', body4.slice(0, 300));
      }

      await screenshot(page4, 'B04_r2_S04_02_test');

      // Answer INCORRECTLY (but need to fill something to submit)
      const coreWords4 = auditState.lists.coreActiveList.words;
      let answered4 = 0;
      const wrongAnswers = ['wrong', 'incorrect', 'bad answer', 'not right', 'false'];

      for (let q = 0; q < 30; q++) {
        const isResults4 = await page4.getByText(/result|score|pass|fail|retake|try again/i).first().isVisible().catch(() => false);
        if (isResults4) break;

        const input4 = page4.getByRole('textbox').first();
        if (!await input4.isVisible().catch(() => false)) break;

        const wrongAns = wrongAnswers[q % wrongAnswers.length];
        await input4.clear();
        await input4.type(wrongAns, { delay: 30 });

        const submit4 = page4.getByRole('button', { name: /submit|next|check/i }).first();
        if (await submit4.isVisible().catch(() => false)) await submit4.click();
        else await input4.press('Enter');

        answered4++;
        await page4.waitForTimeout(500);

        // Wait for grading
        const grading4 = await page4.getByText(/grading|analyzing|processing/i).first().isVisible().catch(() => false);
        if (grading4) {
          for (let g = 0; g < 6; g++) {
            await page4.waitForTimeout(5000);
            if (!await page4.getByText(/grading|analyzing|processing/i).first().isVisible().catch(() => false)) break;
          }
        }
      }

      await screenshot(page4, 'B04_r2_S04_03_results');
      const results4Text = await page4.evaluate(() => document.body.innerText.slice(0, 3000));
      console.log(`  S04 results (${answered4} wrong answers):`, results4Text.slice(0, 400));

      const hasRetake = /retake|try again/i.test(results4Text);
      const hasFail = /fail|below.*threshold|need.*improve|did not pass/i.test(results4Text);
      const hasPass = /pass|well done|great job|congratulations/i.test(results4Text);

      console.log(`  Has retake button: ${hasRetake}, fail msg: ${hasFail}, pass msg: ${hasPass}`);
      results.S04.notes.push(`Answered ${answered4} wrong answers`);
      results.S04.notes.push(`Results: retake=${hasRetake}, fail=${hasFail}, pass=${hasPass}`);

      if (hasRetake) {
        results.S04.notes.push('Retake option available ✓');
        // Click retake
        const retakeBtn4 = page4.getByRole('button', { name: /retake|try again/i }).first();
        await retakeBtn4.click();
        await page4.waitForTimeout(2000);
        await screenshot(page4, 'B04_r2_S04_04_retake');
        results.S04.result = 'pass';
        results.S04.notes.push('Retake test launched ✓');
      } else if (hasPass) {
        // AI grader may have accepted wrong answers as partial credit
        results.S04.result = 'partial';
        results.S04.notes.push('WARN: With wrong answers, test still shows PASS — AI grader may be too lenient OR retakeThreshold met incidentally');
        findings.push({
          id: 'F04',
          severity: 'MEDIUM',
          title: 'Clearly wrong typed answers (e.g. "wrong", "incorrect") result in PASS instead of requiring retake',
          scenario: 'S04',
          observed: 'Submitting "wrong", "incorrect" etc. for all answers results in PASS status',
          expected: 'Score should be below retakeThreshold (0.9 for CORE) causing FAIL/retake',
        });
      } else {
        results.S04.result = 'partial';
        results.S04.notes.push('Ambiguous: neither retake nor clear pass/fail detected');
      }

    } catch (e) {
      results.S04.result = 'fail';
      results.S04.notes.push(`Error: ${e.message.slice(0, 200)}`);
      console.log('  S04 error:', e.message.slice(0, 200));
      await screenshot(page4, 'B04_r2_S04_error');
    } finally {
      await page4.context().close();
    }
  }

  // ================================================================
  // S05 — Dashboard reflection after completion
  // ================================================================
  console.log('\n=== S05: Dashboard Reflection ===');
  results.S05 = { result: 'pending', notes: [] };

  // page still logged in as CORE careful student
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'B04_r2_S05_01_dashboard');

  const dashText5 = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  console.log('  Dashboard after completion:', dashText5.slice(0, 600));

  const hasCompleted = /day 1.*complete|complete.*day 1|session complete|completed today|done for today|session done|well done/i.test(dashText5);
  const hasActivityBar = /7.day|rhythm|streak|activity/i.test(dashText5);
  const hasDay2 = /day 2/i.test(dashText5);

  results.S05.notes.push(`Completion indicator: ${hasCompleted}`);
  results.S05.notes.push(`Activity/streak bar: ${hasActivityBar}`);
  results.S05.notes.push(`Day 2 reference: ${hasDay2}`);

  // Also check Firestore state now
  const fs5 = await saveFirestoreEvidence(uidCore, 'B04_run2_S05_firestore');
  if (fs5.class_progress.length > 0) {
    const cp5 = fs5.class_progress[0];
    results.S05.notes.push(`Firestore: currentStudyDay=${cp5.currentStudyDay}, streak=${cp5.streakDays}`);
    results.S05.result = cp5.currentStudyDay >= 1 ? 'pass' : 'partial';
  } else {
    results.S05.notes.push('No class_progress doc yet');
    results.S05.result = 'partial';
  }

  // ================================================================
  // S06 — Practice mode check
  // ================================================================
  console.log('\n=== S06: Practice Mode ===');
  results.S06 = { result: 'pending', notes: [] };

  const practiceBtnVisible = await page.getByRole('button', { name: /practice/i }).first().isVisible().catch(() => false);
  const practiceInText = /practice/i.test(dashText5);
  results.S06.notes.push(`Practice button: ${practiceBtnVisible}, in page text: ${practiceInText}`);

  if (practiceBtnVisible) {
    results.S06.result = 'pass';
    results.S06.notes.push('Practice mode option available ✓');
  } else {
    results.S06.result = 'partial';
    results.S06.notes.push('Practice button not found on dashboard after completion');
  }

  // ================================================================
  // S07 — Tiny list — SKIPPED
  // ================================================================
  results.S07 = { result: 'skipped', notes: ['No tiny list seeded (audit_state.json tinyList: null)'] };

  // ================================================================
  // S08 — Abandon mid-flashcards → resume
  // ================================================================
  console.log('\n=== S08: Abandon mid-flashcards → Resume ===');
  results.S08 = { result: 'pending', notes: [] };

  // Find a student with fresh session not started yet
  // Use "distracted" persona CORE
  const distractedCore = seeded.accounts.find(a => a.personaId === 'distracted' && a.targetClass === 'CORE');

  if (!distractedCore) {
    results.S08.result = 'skipped';
    results.S08.notes.push('No distracted CORE account found');
  } else {
    const uid08 = distractedCore.uid;
    const before08 = await saveFirestoreEvidence(uid08, 'B04_r2_S08_before');
    console.log(`  S08 student: ${distractedCore.email}, cp=${before08.class_progress.length}`);

    const ctx08 = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    const page8 = await ctx08.newPage();

    try {
      await loginAs(page8, distractedCore.personaId, distractedCore.targetClass);
      await page8.waitForTimeout(2000);

      const startBtn8 = page8.getByRole('button', { name: /start session/i }).first();
      await page8.waitForTimeout(2000);

      if (!await startBtn8.isVisible().catch(() => false)) {
        const allBtns8 = await page8.locator('button').allTextContents();
        console.log('  S08: No start btn. Buttons:', allBtns8.slice(0, 10));
        results.S08.result = 'skipped';
        results.S08.notes.push('Start session button not found');
        await ctx08.close();
        goto_S09:
        results.S09 = { result: 'skipped', notes: ['S08 failed to start'] };
      } else {
        await startBtn8.click();
        await page8.waitForTimeout(2000);

        // Dismiss customize modal
        for (let i = 0; i < 3; i++) {
          const modal8 = page8.locator('.fixed.inset-0').first();
          if (await modal8.isVisible().catch(() => false)) {
            await dismissModal(page8);
            await page8.waitForTimeout(500);
          }
        }

        await screenshot(page8, 'B04_r2_S08_01_session_started');
        const sessionText8 = await page8.evaluate(() => document.body.innerText.slice(0, 2000));
        console.log('  S08 session state:', sessionText8.slice(0, 300));

        // Try to advance some cards
        let dismissed8 = 0;
        for (let i = 0; i < 10; i++) {
          // Try various card advancement buttons
          const iKnow8 = page8.getByRole('button', { name: /i know|know|mastered/i }).first();
          const nextCard8 = page8.locator('[aria-label="Next card"]').first();
          const stillLearning8 = page8.getByRole('button', { name: /still learning/i }).first();
          const showAnswer8 = page8.getByRole('button', { name: /show answer|flip|reveal/i }).first();

          if (await showAnswer8.isVisible().catch(() => false)) {
            await showAnswer8.click();
            await page8.waitForTimeout(400);
            continue;
          } else if (await iKnow8.isVisible().catch(() => false)) {
            await iKnow8.click();
            dismissed8++;
            await page8.waitForTimeout(400);
            if (dismissed8 >= 3) break;
          } else if (await nextCard8.isVisible().catch(() => false)) {
            await nextCard8.click();
            dismissed8++;
            await page8.waitForTimeout(400);
            if (dismissed8 >= 3) break;
          } else if (await stillLearning8.isVisible().catch(() => false)) {
            await stillLearning8.click();
            dismissed8++;
            await page8.waitForTimeout(400);
            if (dismissed8 >= 3) break;
          } else {
            const bodyCheck = await page8.evaluate(() => document.body.innerText.slice(0, 1000));
            console.log(`  S08 iter ${i}: No advance btn. Body: ${bodyCheck.slice(0, 200)}`);
            break;
          }
        }

        console.log(`  Dismissed ${dismissed8} cards`);
        await screenshot(page8, 'B04_r2_S08_02_mid_session');

        // Navigate to dashboard
        await page8.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page8.waitForTimeout(2000);
        await screenshot(page8, 'B04_r2_S08_03_dashboard_after_abandon');

        const dashText8 = await page8.evaluate(() => document.body.innerText.slice(0, 3000));
        console.log('  Dashboard after abandon:', dashText8.slice(0, 400));

        const hasResume = /resume|continue|in progress/i.test(dashText8);
        const hasStart = /start session/i.test(dashText8);
        results.S08.notes.push(`Cards dismissed before abandon: ${dismissed8}`);
        results.S08.notes.push(`Resume indicator: ${hasResume}, Start button: ${hasStart}`);

        // Click resume or start again
        const resumeBtn8 = page8.getByRole('button', { name: /resume|continue|start session/i }).first();
        if (await resumeBtn8.isVisible().catch(() => false)) {
          await resumeBtn8.click();
          await page8.waitForTimeout(2000);

          // Dismiss modal
          for (let i = 0; i < 3; i++) {
            const modal8 = page8.locator('.fixed.inset-0').first();
            if (await modal8.isVisible().catch(() => false)) {
              await dismissModal(page8);
              await page8.waitForTimeout(500);
            }
          }

          await screenshot(page8, 'B04_r2_S08_04_resumed');
          const resumedText = await page8.evaluate(() => document.body.innerText.slice(0, 2000));
          console.log('  Resumed text:', resumedText.slice(0, 400));

          results.S08.result = 'pass';
          results.S08.notes.push('Session resumed after abandon ✓');
        } else {
          results.S08.result = 'partial';
          results.S08.notes.push('No clear resume button found; may have reset or require re-navigation');
        }

        await ctx08.close();
      }
    } catch (e) {
      results.S08.result = 'fail';
      results.S08.notes.push(`Error: ${e.message.slice(0, 200)}`);
      console.log('  S08 error:', e.message.slice(0, 200));
      await ctx08.close().catch(() => {});
    }
  }

  // ================================================================
  // S09 — Try to start again after completion
  // ================================================================
  console.log('\n=== S09: Try to Start Again After Completion ===');
  results.S09 = { result: 'pending', notes: [] };

  // page is on dashboard as CORE careful (who completed their session)
  // Check if start button is enabled or shows "completed" state
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await screenshot(page, 'B04_r2_S09_01_dashboard');

  const dashText9 = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  console.log('  S09 dashboard text:', dashText9.slice(0, 600));

  const startBtn9 = page.getByRole('button', { name: /start session/i }).first();
  const startVisible9 = await startBtn9.isVisible().catch(() => false);
  const startEnabled9 = await startBtn9.isEnabled().catch(() => false);

  const hasCompletedMsg = /day.*complete|completed.*today|session.*complete|done.*today|completed|already.*done/i.test(dashText9);
  const hasPracticeOption = /practice/i.test(dashText9);

  console.log(`  Start btn: visible=${startVisible9}, enabled=${startEnabled9}`);
  console.log(`  Has completion message: ${hasCompletedMsg}`);
  console.log(`  Has practice: ${hasPracticeOption}`);

  results.S09.notes.push(`Start button: visible=${startVisible9}, enabled=${startEnabled9}`);
  results.S09.notes.push(`Completion message: ${hasCompletedMsg}`);
  results.S09.notes.push(`Practice option: ${hasPracticeOption}`);

  // Check Firestore to know if session was actually completed
  const fs9 = await saveFirestoreEvidence(uidCore, 'B04_run2_S09_firestore');
  const sessionActuallyCompleted = fs9.attempts.length > 0 || fs9.class_progress.length > 0;
  console.log(`  Session actually completed in Firestore: ${sessionActuallyCompleted}`);
  results.S09.notes.push(`Firestore confirmed completion: ${sessionActuallyCompleted}`);

  if (!sessionActuallyCompleted) {
    // If Firestore shows no progress, the session may not have completed
    results.S09.result = 'partial';
    results.S09.notes.push('Session did not complete in Firestore; S09 test invalid');
  } else if (hasCompletedMsg || (!startEnabled9 && startVisible9)) {
    results.S09.result = 'pass';
    results.S09.notes.push('Correctly shows completion state; start blocked ✓');
  } else if (startEnabled9 && startVisible9) {
    // Click to test behavior
    await startBtn9.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'B04_r2_S09_02_after_click');

    const afterClickText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    const launchedNewTest = /question.*1.*of|type.*answer/i.test(afterClickText);
    const showsCompleted = /complete|done|practice/i.test(afterClickText);

    console.log(`  After click: launched new test=${launchedNewTest}, shows completed=${showsCompleted}`);
    results.S09.notes.push(`After clicking start: new_test=${launchedNewTest}, completed_msg=${showsCompleted}`);

    if (launchedNewTest) {
      results.S09.result = 'fail';
      results.S09.notes.push('FAIL: Re-starting session after completion launches new test');
      findings.push({
        id: 'F05',
        severity: 'HIGH',
        title: 'Session start button allows re-start after Day-1 completion',
        scenario: 'S09',
        observed: 'After completing Day-1 test, "Start Session" button still active; clicking launches new test',
        expected: 'Should show completion state; practice mode offered instead',
      });
    } else {
      results.S09.result = 'pass';
      results.S09.notes.push('Click handled correctly — no new test launched');
    }
  } else {
    results.S09.result = 'pass';
    results.S09.notes.push('Start button not available — correct behavior after completion');
  }

  // Final state capture
  const finalFs = await saveFirestoreEvidence(uidCore, 'B04_run2_final');
  console.log(`\nFinal Firestore: cp=${finalFs.class_progress.length}, ss=${finalFs.study_states.length}, attempts=${finalFs.attempts.length}`);
  if (finalFs.class_progress.length > 0) {
    const cp = finalFs.class_progress[0];
    console.log(`  currentStudyDay=${cp.currentStudyDay}, streakDays=${cp.streakDays}`);
  }

  // Console errors
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_run2_console_errors.json'), JSON.stringify(consoleLog, null, 2));

  // Write final results
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_run2_results.json'), JSON.stringify({ results, findings }, null, 2));

  console.log('\n========== RESULTS SUMMARY ==========');
  Object.entries(results).forEach(([s, r]) => {
    console.log(`  ${s}: ${r.result}`);
    r.notes.forEach(n => console.log(`    - ${n}`));
  });

  if (findings.length > 0) {
    console.log('\nFINDINGS:');
    findings.forEach(f => console.log(`  ${f.id} [${f.severity}]: ${f.title}`));
  }

} catch (err) {
  console.error('\nFATAL ERROR:', err.message);
  writeFileSync(path.join(EVIDENCE_DIR, 'B04_run2_fatal.json'), JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
  throw err;
} finally {
  if (browser) await browser.close();
  console.log('\nBrowser closed.');
}
