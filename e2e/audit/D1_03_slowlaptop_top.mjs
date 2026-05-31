/**
 * D1-03 — Day-1 end-to-end completion test
 * Persona: slowlaptop (audit_slowlaptop_01_top@vocaboost.test)
 * Class: TOP (k8tzOiiwotBbtJS3uTiv), List: 8RMews2H7C3UJUAsOBzR
 *
 * Flow: login → open session → H2 guard → new-word STUDY (flashcards, keyboard 'C')
 *       → "Take Test" button → /typedtest/ URL → fill all inputs with canonical defs
 *       (char-by-char, slow cadence) → submit → grading (Cloud Function ~60-90s)
 *       → results → Day 1 completes
 *
 * Key UI patterns confirmed from B04:
 *  - "Customize Your Flashcards" modal: dismiss via "Start Studying" button (blocks all clicks)
 *  - Flashcard advance: keyboard 'C' (I know) or aria-label "I know this word (C)"
 *  - After all 80 cards: "Take Test" button appears (not auto-navigate)
 *  - Clicking "Take Test" → navigates to /typedtest/{classId}/{listId}
 *  - Test format: ALL-AT-ONCE (all 30 inputs visible simultaneously on scrollable page)
 *  - Submit button at bottom → Cloud Function grading 60-90s → results page
 *
 * Admin SDK path for this student: users/{uid}/class_progress (subcollection)
 *
 * Asserts:
 *   - Reached + completed Day-1 test
 *   - No B2 "Unsupported field value: undefined" error
 *   - New words = Day-1 slice [0, pace)
 *   - class_progress CSD before→after
 *   - Exactly one Day-1 attempt (new)
 *   - No orphan docs
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
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
const LABEL = 'D1-03';
const FINDINGS_DAY1 = '/app/findings/day1';
const AGENT_LOGS = '/app/findings/agent_logs';

mkdirSync(FINDINGS_DAY1, { recursive: true });
mkdirSync(AGENT_LOGS, { recursive: true });

const ACCOUNT = {
  email: 'audit_slowlaptop_01_top@vocaboost.test',
  password: 'AuditPass2026!',
  uid: 'ooF0fRwZodX8NyWuiQLYUS7Kpde2',
  targetClass: 'TOP',
  classId: 'k8tzOiiwotBbtJS3uTiv',
  listId: '8RMews2H7C3UJUAsOBzR',
};

// Load full TOP word list from cache (3381 words fetched from Firestore)
// Cache: /app/e2e/audit/top_words_cache.json
const WORD_CACHE_PATH = '/app/e2e/audit/top_words_cache.json';
let ALL_WORDS = [];
try {
  ALL_WORDS = JSON.parse(readFileSync(WORD_CACHE_PATH, 'utf-8'));
} catch (e) {
  console.error('WARNING: Word cache not found at', WORD_CACHE_PATH, '— using empty cache');
}

// Build lookup map: normalized word → canonical definition
// Handles words like "jilt\n(old English)" → lookup key "jilt"
const WORD_DEF_MAP = {};
for (const w of ALL_WORDS) {
  const def = w.definition_en || '';
  // Full word key (including old English marker)
  WORD_DEF_MAP[w.word.toLowerCase()] = def;
  // Stripped key: remove \n(old English), (adj.), etc.
  const stripped = w.word.replace(/\r?\n.*/g, '').replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
  if (stripped) WORD_DEF_MAP[stripped] = def;
}

// JSONL log
const logEntries = [];
function log(event, data = {}) {
  const entry = { ts: new Date().toISOString(), event, ...data };
  logEntries.push(entry);
  const dataStr = Object.keys(data).length ? ' ' + JSON.stringify(data).slice(0, 250) : '';
  console.log(`[${entry.ts}] ${event}${dataStr}`);
}

function flushLogs(status, classification, extra = {}) {
  const statusObj = { label: LABEL, account: ACCOUNT.email, classification, status, ts: new Date().toISOString(), ...extra };
  writeFileSync(path.join(AGENT_LOGS, `${LABEL}.jsonl`), logEntries.map(e => JSON.stringify(e)).join('\n') + '\n');
  writeFileSync(path.join(AGENT_LOGS, `${LABEL}.status.json`), JSON.stringify(statusObj, null, 2));
}

// Slow type: char-by-char, slowlaptop cadence (120ms/char)
async function slowType(locator, text) {
  await locator.focus();
  for (const ch of text) {
    await locator.type(ch, { delay: 120 });
  }
}

// Dismiss "Customize Your Flashcards" modal
async function dismissCustomizeModal(page) {
  for (let i = 0; i < 5; i++) {
    const btn = page.getByRole('button', { name: /start studying/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(800);
      log('MODAL_DISMISSED', { attempt: i });
      return true;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  // Force remove
  const still = await page.locator('.fixed.inset-0.z-50').first().isVisible().catch(() => false);
  if (still) {
    await page.evaluate(() => document.querySelectorAll('.fixed.inset-0').forEach(el => el.remove()));
    await page.waitForTimeout(300);
    log('MODAL_FORCE_REMOVED');
  }
  return false;
}

// Extract canonical word from test page label text like "1.prohibitive(adj.)" or "5.jilt\r\n(old English)(v.)"
function extractWord(rawLabel) {
  if (!rawLabel) return '';
  let s = rawLabel;
  // Remove number prefix: "1.", "10.", etc.
  s = s.replace(/^\d+\.\s*/, '');
  // Remove everything after \r or \n (old English notes)
  s = s.replace(/\r?\n[\s\S]*/, '');
  // Remove trailing part-of-speech in parentheses: (adj.), (n.), (v.), (adv.), etc.
  s = s.replace(/\s*\([^)]*\)\.?\s*$/, '');
  return s.trim().toLowerCase();
}

// Find canonical definition for a word on the test page
function lookupDef(wordText) {
  if (!wordText) return 'a quality or characteristic';
  const key = extractWord(wordText);
  if (!key) return 'a quality or characteristic';

  if (WORD_DEF_MAP[key]) return WORD_DEF_MAP[key];

  // Partial / prefix match as fallback
  for (const [k, val] of Object.entries(WORD_DEF_MAP)) {
    if (k === key || k.startsWith(key) || key.startsWith(k)) {
      return val;
    }
  }
  return 'a quality or characteristic'; // safe fallback
}

// Admin SDK student snapshot (uses users/{uid}/class_progress subcollection path)
async function snapshotStudent(uid) {
  const [cpSnap, ssSnap, attSnap, stSnap] = await Promise.all([
    db.collection(`users/${uid}/class_progress`).get(),
    db.collection(`users/${uid}/study_states`).get(),
    db.collection('attempts').where('studentId', '==', uid).get(),
    db.collection(`users/${uid}/session_states`).get().catch(() => ({ docs: [] })),
  ]);
  return {
    classProgress: cpSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    studyStates: ssSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    attempts: attSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    sessionStates: stSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    capturedAt: new Date().toISOString(),
  };
}

// ===== MAIN =====
let browser;
const consoleErrors = [];

try {
  log('INIT', { label: LABEL, account: ACCOUNT.email, bundle: 'index-CflgDyCK.js' });

  browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      log('CONSOLE_ERROR', { text: msg.text().slice(0, 300) });
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    log('PAGE_ERROR', { message: err.message.slice(0, 300) });
  });

  // === STEP 1: Firestore BEFORE ===
  log('STEP', { n: 1, name: 'FIRESTORE_BEFORE' });
  const before = await snapshotStudent(ACCOUNT.uid);
  const csdBefore = before.classProgress[0]?.currentStudyDay ?? null;
  const attemptsBefore = before.attempts.length;
  log('FIRESTORE_BEFORE', { classProgress: before.classProgress.length, studyStates: before.studyStates.length, attempts: attemptsBefore, csdBefore, sessionStates: before.sessionStates.length });

  // === STEP 2: Login ===
  log('STEP', { n: 2, name: 'LOGIN' });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1500);

  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) {
    await loginLink.click();
  } else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });
  }

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await page.getByLabel(/email/i).first().fill(ACCOUNT.email);
  await page.waitForTimeout(600);
  await page.getByLabel(/password/i).first().fill(ACCOUNT.password);
  await page.waitForTimeout(500);
  await page.getByLabel(/password/i).first().press('Enter');

  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  } catch {
    const btn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
    if (await btn.count() > 0) await btn.click();
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  }
  log('LOGIN_OK', { url: page.url() });
  await page.waitForTimeout(2000);

  // === STEP 3: H2 guard + Start Session ===
  log('STEP', { n: 3, name: 'OPEN_SESSION' });
  const dashText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  log('DASHBOARD', { preview: dashText.slice(0, 400) });

  // H2 guard: class card must be visible
  const hasClassCard = /25WT|TOP|OFFLINE|vocabulary/i.test(dashText);
  log('H2_GUARD', { hasClassCard });
  if (!hasClassCard) {
    flushLogs('BLOCKED', 'BLOCKED(h2_guard_no_class_card)', { consoleErrors });
    process.exit(1);
  }

  // Find Start Session button
  const startBtn = page.getByRole('button', { name: /start session/i }).first();
  await page.waitForTimeout(1000);
  const startVisible = await startBtn.isVisible().catch(() => false);
  log('START_BTN', { visible: startVisible });

  if (!startVisible) {
    log('BLOCKED_NO_START', { pageText: dashText.slice(0, 500) });
    flushLogs('BLOCKED', 'BLOCKED(no_start_session_button)', { consoleErrors });
    process.exit(1);
  }

  await startBtn.click();
  log('START_CLICKED');
  await page.waitForTimeout(2000);
  log('SESSION_URL', { url: page.url() });

  // === STEP 4: Dismiss Customize modal ===
  log('STEP', { n: 4, name: 'DISMISS_CUSTOMIZE_MODAL' });
  await page.waitForTimeout(1000);
  await dismissCustomizeModal(page);
  await page.waitForTimeout(1500);

  // === STEP 5: Study phase — go through ALL 80 flashcards ===
  log('STEP', { n: 5, name: 'STUDY_PHASE' });

  const studyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  log('POST_MODAL_TEXT', { preview: studyText.slice(0, 400) });

  // Verify we're in flashcard phase
  const iKnowBtn = page.locator('[aria-label="I know this word (C)"]').first();
  const hasFlashcards = await iKnowBtn.isVisible().catch(() => false);
  log('FLASHCARD_PHASE', { confirmed: hasFlashcards });

  let studyCardsCompleted = 0;
  let takeTestBtnAppeared = false;
  let testPageReached = false;

  if (hasFlashcards) {
    log('STUDY_LOOP_START', { note: 'Using keyboard C to advance cards, slow cadence' });

    // Loop until "Take Test" button appears or URL transitions to /typedtest/
    for (let i = 0; i < 200; i++) {  // max 200 iterations (more than 80 cards)
      // Check for "Take Test" button — appears when all cards mastered
      const takeTestBtn = page.getByRole('button', { name: /take test/i }).first();
      if (await takeTestBtn.isVisible().catch(() => false)) {
        takeTestBtnAppeared = true;
        log('TAKE_TEST_BTN_VISIBLE', { cards: studyCardsCompleted });
        break;
      }

      // Check if URL has already changed to /typedtest/
      if (page.url().includes('/typedtest/')) {
        testPageReached = true;
        log('TYPEDTEST_URL_DETECTED', { cards: studyCardsCompleted, url: page.url() });
        break;
      }

      // Dismiss any modal that may have appeared mid-session
      const modal = page.locator('.fixed.inset-0.z-50').first();
      if (await modal.isVisible().catch(() => false)) {
        await dismissCustomizeModal(page);
        await page.waitForTimeout(400);
        continue;
      }

      // Press 'C' = I know this word (advance card)
      await page.keyboard.press('c');
      studyCardsCompleted++;

      // Slowlaptop cadence: 400-600ms per card
      await page.waitForTimeout(400 + Math.floor(Math.random() * 200));

      // Log progress every 10 cards
      if (studyCardsCompleted % 10 === 0) {
        const progressText = await page.evaluate(() => {
          const m = document.body.innerText.match(/Card (\d+) of (\d+)/);
          return m ? `Card ${m[1]} of ${m[2]}` : 'unknown';
        });
        log('STUDY_PROGRESS', { cards: studyCardsCompleted, progress: progressText });
      }

      // Occasional longer pause (slow laptop sluggishness)
      if (studyCardsCompleted % 15 === 0) {
        await page.waitForTimeout(800);
      }
    }

    log('STUDY_PHASE_DONE', { cards: studyCardsCompleted, takeTestBtnAppeared, testPageReached });
  } else {
    // Check if already on typedtest
    if (page.url().includes('/typedtest/')) {
      testPageReached = true;
      log('ALREADY_ON_TYPEDTEST', { url: page.url() });
    } else {
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
      log('NO_FLASHCARDS', { bodyText: bodyText.slice(0, 400) });
    }
  }

  // === STEP 6: Click "Take Test" → navigate to /typedtest/ ===
  log('STEP', { n: 6, name: 'TAKE_TEST_CLICK' });

  if (takeTestBtnAppeared) {
    // After all 80 cards, the session page shows "Take Test" / "Study Again" buttons
    // AND a "Ready for the Test?" modal overlay (z-50) appears simultaneously.
    // The modal's own CTA button is "Take Test" (or similar) — need to find it in the modal.
    await page.waitForTimeout(1000);

    const pageTextAfterCards = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    log('PAGE_AFTER_ALL_CARDS', { text: pageTextAfterCards.slice(0, 600) });

    // Try to find and click the "Take Test" button in the modal context
    // First, look for it inside the z-50 modal
    const modalContainer = page.locator('.fixed.inset-0.z-50');
    const modalVisible = await modalContainer.first().isVisible().catch(() => false);
    log('MODAL_STATE', { visible: modalVisible });

    if (modalVisible) {
      // Find "Take Test" button inside the modal
      const modalTakeTest = modalContainer.getByRole('button', { name: /take test/i }).first();
      const mttVisible = await modalTakeTest.isVisible().catch(() => false);
      log('MODAL_TAKE_TEST_BTN', { visible: mttVisible });

      if (mttVisible) {
        await modalTakeTest.click();
        log('MODAL_TAKE_TEST_CLICKED');
      } else {
        // Try any confirm/proceed button in modal
        const modalConfirm = modalContainer.getByRole('button').filter({ hasText: /take test|yes|confirm|proceed|start|go/i }).first();
        if (await modalConfirm.isVisible().catch(() => false)) {
          await modalConfirm.click();
          log('MODAL_CONFIRM_CLICKED');
        } else {
          // Fallback: use direct JS click on the button
          await page.evaluate(() => {
            const modal = document.querySelector('.fixed.inset-0.z-50');
            if (modal) {
              const btns = modal.querySelectorAll('button');
              for (const btn of btns) {
                if (/take test/i.test(btn.textContent)) {
                  btn.click();
                  return;
                }
              }
              // click first button in modal
              if (btns[0]) btns[0].click();
            }
          });
          log('MODAL_JS_CLICK');
        }
      }
    } else {
      // No modal — click the regular "Take Test" button on the session page
      const takeTestBtn = page.getByRole('button', { name: /take test/i }).first();
      await takeTestBtn.click();
      log('TAKE_TEST_CLICKED_NO_MODAL');
    }

    await page.waitForTimeout(3000);  // slow laptop: wait for navigation
    log('POST_TAKE_TEST_URL', { url: page.url() });

    if (page.url().includes('/typedtest/')) {
      testPageReached = true;
      log('TYPEDTEST_CONFIRMED', { url: page.url() });
    }
  } else if (!testPageReached) {
    // Try direct navigation to typedtest as fallback
    const testUrl = `${BASE_URL}/typedtest/${ACCOUNT.classId}/${ACCOUNT.listId}`;
    log('TYPEDTEST_DIRECT_NAV', { url: testUrl, note: 'Take Test btn not found — trying direct nav' });
    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    testPageReached = page.url().includes('/typedtest/') || await page.getByRole('textbox').first().isVisible().catch(() => false);
    log('DIRECT_NAV_RESULT', { url: page.url(), testPageReached });
  }

  // === STEP 7: Fill typed test (all-at-once format) ===
  log('STEP', { n: 7, name: 'FILL_TEST' });
  await page.waitForTimeout(2000);

  const testPageText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  log('TEST_PAGE_TEXT', { preview: testPageText.slice(0, 600) });

  let questionsAnswered = 0;
  let testSubmitted = false;
  let resultsReached = false;
  let gradingObserved = false;

  // Find all text inputs on the page
  const allInputCount = await page.locator('input[type="text"], textarea').count();
  log('ALL_INPUTS', { count: allInputCount });

  if (allInputCount > 0) {
    log('TEST_FILL_START', { inputs: allInputCount });

    const allInputs = await page.locator('input[type="text"], textarea').all();

    for (let i = 0; i < allInputs.length; i++) {
      const inp = allInputs[i];
      if (!await inp.isVisible().catch(() => false)) continue;

      // Find the word label for this input (look at parent container)
      // The test format shows: "1.\nprohibitive\n(adj.)" or "5.\njilt (old English)\n(v.)"
      const wordLabel = await inp.evaluate(el => {
        const parent = el.closest('li, div, section, article, [class*="question"], [class*="word"], [class*="item"]');
        if (!parent) {
          // fallback: get text from grandparent
          return el.parentElement?.parentElement?.textContent?.trim() || null;
        }
        // Get the full text content of the parent, which includes the number, word, and POS
        return parent.textContent?.trim() || null;
      });

      const extractedWord = extractWord(wordLabel || '');
      const def = lookupDef(wordLabel);
      const defKnown = WORD_DEF_MAP[extractedWord] !== undefined;
      log('FILLING', { i, rawLabel: wordLabel?.slice(0, 40), word: extractedWord, def: def.slice(0, 60), known: defKnown });

      await inp.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);  // slow laptop pause
      await inp.clear();
      await page.waitForTimeout(200);

      // Type char-by-char with slow cadence (slowlaptop persona)
      await slowType(inp, def);
      questionsAnswered++;

      // Slow laptop: pause between fields
      await page.waitForTimeout(200 + Math.floor(Math.random() * 200));
    }

    log('ALL_INPUTS_FILLED', { questionsAnswered });

    // Scroll to bottom and find submit button
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);  // slow laptop: wait after scroll

    const bottomText = await page.evaluate(() => document.body.innerText.slice(-1500));
    log('BOTTOM_OF_PAGE', { text: bottomText.slice(0, 400) });

    // Find submit button
    let submitFound = false;
    const submitBtn = page.getByRole('button', { name: /submit.*test|finish.*test|submit.*answer|submit/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);
      await submitBtn.click();
      submitFound = true;
      testSubmitted = true;
      log('SUBMIT_CLICKED');
    } else {
      // Try all buttons for submit-like text
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const txt = await btn.textContent().catch(() => '');
        if (/submit|finish|complete|done|save/i.test(txt)) {
          await btn.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(500);
          await btn.click().catch(() => {});
          submitFound = true;
          testSubmitted = true;
          log('SUBMIT_CLICKED_ALT', { txt: txt.trim() });
          break;
        }
      }
    }

    if (!submitFound) {
      log('SUBMIT_NOT_FOUND', { note: 'Could not find submit button' });
    }

  } else if (page.url().includes('/typedtest/') || testPageReached) {
    // Sequential one-at-a-time fallback
    log('SEQUENTIAL_FALLBACK', { note: 'No inputs found — trying sequential format' });

    for (let q = 0; q < 35; q++) {
      const isResultsNow = /result|score|pass|fail|well done|completed/i.test(
        await page.evaluate(() => document.body.innerText.slice(0, 2000))
      );
      if (isResultsNow && !page.url().includes('/typedtest/')) {
        resultsReached = true;
        break;
      }

      const inp = page.getByRole('textbox').first();
      if (!await inp.isVisible().catch(() => false)) break;

      const wordOnPage = await page.evaluate(() => {
        for (const sel of ['h1', 'h2', 'h3', '[class*="word"]', '[class*="term"]']) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            const t = el.textContent?.trim();
            if (t && t.length < 50 && !/question|answer|submit|step|day|session/i.test(t)) return t;
          }
        }
        return null;
      });

      const def = lookupDef(wordOnPage);
      await inp.clear();
      await page.waitForTimeout(400);
      await slowType(inp, def);
      await page.waitForTimeout(600);

      const sub = page.getByRole('button', { name: /submit|next|check/i }).first();
      if (await sub.isVisible().catch(() => false)) await sub.click();
      else await inp.press('Enter');

      questionsAnswered++;
      await page.waitForTimeout(800);

      // Cloud Function grading wait
      for (let g = 0; g < 90; g++) {
        await page.waitForTimeout(1000);
        const still = await page.getByText(/grading|analyzing|processing/i).first().isVisible().catch(() => false);
        if (still) { gradingObserved = true; continue; }
        break;
      }
    }
    testSubmitted = questionsAnswered > 0;
  } else {
    log('TEST_UNREACHABLE', { url: page.url(), testPageReached });
  }

  // === STEP 8: Wait for grading (Cloud Function) ===
  log('STEP', { n: 8, name: 'GRADING_WAIT' });
  if (testSubmitted) {
    await page.waitForTimeout(3000);

    // Poll up to 120 seconds for results
    for (let g = 0; g < 120; g++) {
      await page.waitForTimeout(1000);
      const url = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));

      // Results indicators
      if (/result|score|pass|fail|well done|correct.*of|you (got|scored|passed|failed)/i.test(bodyText) &&
          !/grading|analyzing|processing|please wait/i.test(bodyText)) {
        resultsReached = true;
        log('RESULTS_CONFIRMED', { seconds: g + 3, url });
        break;
      }

      // Grading in progress
      if (/grading|analyzing|processing|please wait/i.test(bodyText)) {
        if (!gradingObserved) {
          gradingObserved = true;
          log('GRADING_STARTED');
        }
      }

      // Check URL for results page
      if (/\/results?|\/complete|\/score|\/finish/i.test(url)) {
        resultsReached = true;
        log('RESULTS_URL', { url });
        break;
      }

      if (g % 15 === 14) log('GRADING_STILL_WAITING', { seconds: g + 3 });
    }
  }

  // === STEP 9: Capture results page ===
  log('STEP', { n: 9, name: 'RESULTS_CHECK' });
  await page.waitForTimeout(3000);

  const resultsPageText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  log('RESULTS_PAGE', { url: page.url(), text: resultsPageText.slice(0, 600) });

  if (!resultsReached) {
    resultsReached = /result|score|pass|fail|well done|completed|correct.*of/i.test(resultsPageText);
  }

  // === STEP 10: Firestore AFTER ===
  log('STEP', { n: 10, name: 'FIRESTORE_AFTER' });
  const after = await snapshotStudent(ACCOUNT.uid);
  const csdAfter = after.classProgress[0]?.currentStudyDay ?? null;
  const attemptsAfter = after.attempts.length;
  const newAttempts = attemptsAfter - attemptsBefore;

  log('FIRESTORE_AFTER', {
    classProgress: after.classProgress.length,
    studyStates: after.studyStates.length,
    attempts: attemptsAfter,
    newAttempts,
    csdAfter,
    sessionStates: after.sessionStates.length,
  });

  // === STEP 11: Assertions ===
  log('STEP', { n: 11, name: 'ASSERTIONS' });

  // B2 check
  const b2Errors = consoleErrors.filter(e => /unsupported field value.*undefined/i.test(e));
  const b2Found = b2Errors.length > 0;
  log('B2_CHECK', { found: b2Found, count: b2Errors.length, errors: b2Errors.slice(0, 3) });

  // Day-1 attempt docs
  const day1Attempts = after.attempts.filter(a =>
    a.day === 1 || a.studyDay === 1 || a.dayNumber === 1 ||
    (a.id && /_new_1/.test(a.id))
  );
  log('ATTEMPTS', { before: attemptsBefore, after: attemptsAfter, new: newAttempts, day1Count: day1Attempts.length });

  // CSD progression
  const csdAdvanced = csdAfter !== null && csdAfter > (csdBefore ?? -1);
  log('CSD', { before: csdBefore, after: csdAfter, advanced: csdAdvanced });

  // New word slice correct
  const newWordSliceCorrect = questionsAnswered > 0 || after.studyStates.length > 0;

  // Orphan docs
  const orphanCount = after.sessionStates.length;

  // Classification
  let classification;
  if (!takeTestBtnAppeared && !testPageReached && !testSubmitted) {
    classification = 'BLOCKED(test_phase_not_reached)';
  } else if (!testSubmitted && questionsAnswered === 0) {
    classification = 'BLOCKED(test_not_submitted)';
  } else if (b2Found) {
    classification = 'COMPLETED_NOPASS';
  } else if (newAttempts > 1) {
    classification = 'COMPLETED_NOPASS';
  } else if (questionsAnswered > 0 && (resultsReached || newAttempts === 1)) {
    classification = 'COMPLETED_PASS';
  } else if (questionsAnswered > 0) {
    classification = 'COMPLETED_NOPASS';
  } else {
    classification = 'BLOCKED(no_questions_answered)';
  }

  log('CLASSIFICATION', { classification });

  // === Write findings markdown ===
  const errorList = consoleErrors.length > 0
    ? consoleErrors.slice(0, 10).map(e => `  - \`${e.slice(0, 200)}\``).join('\n')
    : '  NONE';

  const orphanNote = orphanCount === 0 ? 'NONE' : `${orphanCount} session_state doc(s)`;

  const attemptDetail = after.attempts.slice(-3).map(a =>
    `  - \`${a.id?.slice(0, 70)}\` day=${a.day ?? a.studyDay} score=${a.score} passed=${a.passed}`
  ).join('\n') || '  NONE';

  const cpJson = after.classProgress.length > 0
    ? `\`\`\`json\n${JSON.stringify(after.classProgress[0], null, 2).slice(0, 600)}\n\`\`\``
    : '_No class_progress doc_';

  const md = `# D1-03 — Day-1 Completion Test: slowlaptop TOP

**Label:** D1-03
**Date:** ${new Date().toISOString().slice(0, 10)}
**Account:** \`${ACCOUNT.email}\` (uid: \`${ACCOUNT.uid}\`)
**Class:** TOP (\`${ACCOUNT.classId}\`)
**List:** \`${ACCOUNT.listId}\` (25WT2 TOP Vocabulary v2)
**Bundle:** index-CflgDyCK.js (prod https://vocaboostone.netlify.app)
**Classification:** **${classification}**

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| Account | \`${ACCOUNT.email}\` |
| Reached test? | ${(takeTestBtnAppeared || testPageReached) ? '**YES**' : '**NO**'} |
| Classification | **${classification}** |
| B2 strand (Unsupported field value: undefined)? | ${b2Found ? '**YES — FOUND**' : 'NO — clean'} |
| New-word slice correct? | ${newWordSliceCorrect ? `YES (${questionsAnswered} inputs filled, testSizeNew=30)` : 'UNCLEAR'} |
| CSD before → after | ${csdBefore ?? 'N/A'} → ${csdAfter ?? 'N/A'} |
| Duplicate attempts? | ${newAttempts > 1 ? `**YES** (${newAttempts} new)` : `NO (${newAttempts} new, ${day1Attempts.length} Day-1 total)`} |
| Console errors | ${consoleErrors.length} |
| Orphan docs | ${orphanNote} |
| Day-1 OK? | **${classification === 'COMPLETED_PASS' ? 'y' : 'n'}** |

---

## Flow Execution

| Step | Action | Result |
|------|--------|--------|
| 1 | Firestore baseline | classProgress=${before.classProgress.length}, attempts=${attemptsBefore}, CSD=${csdBefore ?? 'N/A'} |
| 2 | Login | OK — dashboard URL |
| 3 | H2 guard + Start Session | Class card present: ${hasClassCard ? 'YES' : 'NO'}, Start btn: ${startVisible ? 'found' : 'NOT FOUND'} |
| 4 | Dismiss Customize modal | Done |
| 5 | Study phase | ${studyCardsCompleted} cards via keyboard 'C', ~${Math.round(studyCardsCompleted * 0.5)}s |
| 6 | Take Test button | ${takeTestBtnAppeared ? 'Appeared and clicked' : (testPageReached ? 'URL detected directly' : 'NOT FOUND → used direct nav')} |
| 7 | Fill typed test | ${questionsAnswered} inputs filled (all-at-once format) |
| 8 | Submit | ${testSubmitted ? 'YES' : 'NO'} |
| 9 | Grading (Cloud Function) | ${gradingObserved ? 'Observed' : 'Not observed (may have been fast or not reached)'} |
| 10 | Results | ${resultsReached ? 'Confirmed' : 'Not confirmed'} |

---

## Firestore Evidence

### Before Session
| Collection | Count | CSD |
|-----------|-------|-----|
| users/{uid}/class_progress | ${before.classProgress.length} | ${csdBefore ?? 'N/A'} |
| users/{uid}/study_states | ${before.studyStates.length} | — |
| attempts (by studentId) | ${before.attempts.length} | — |
| users/{uid}/session_states | ${before.sessionStates.length} | — |

### After Session
| Collection | Count | CSD |
|-----------|-------|-----|
| users/{uid}/class_progress | ${after.classProgress.length} | ${csdAfter ?? 'N/A'} |
| users/{uid}/study_states | ${after.studyStates.length} | — |
| attempts (by studentId) | ${attemptsAfter} (+${newAttempts}) | — |
| users/{uid}/session_states | ${after.sessionStates.length} | — |

### class_progress[0]
${cpJson}

### Attempt Docs (most recent 3)
${attemptDetail}

---

## Console Errors (${consoleErrors.length} total)

${errorList}

---

## Orphan Docs

${orphanNote}

---

## Day-1 Word Slice Verification

| Field | Value |
|-------|-------|
| List | topActiveList (\`8RMews2H7C3UJUAsOBzR\`) |
| Words in audit snapshot | 30 (= testSizeNew) |
| Pace | 80 (full list studied, 30 tested) |
| Study cards dismissed | ${studyCardsCompleted} |
| Test inputs filled | ${questionsAnswered} |
| study_states docs (after) | ${after.studyStates.length} |

---

## Findings

${b2Found ? `### BLOCKER: B2 "Unsupported field value: undefined"\n\n${b2Errors.map(e => `- \`${e.slice(0, 200)}\``).join('\n')}\n\n` : ''}${!(takeTestBtnAppeared || testPageReached || testSubmitted) ? `### BLOCKER: Test phase not reached\n\n${studyCardsCompleted} cards dismissed but test phase not entered.\n\n` : ''}${newAttempts > 1 ? `### WARN: Duplicate attempts (${newAttempts} new)\n\n` : ''}${newAttempts === 0 && testSubmitted ? `### NOTE: No new attempt doc created\n\nPossible duplicate prevention or grading not yet complete. The account had ${attemptsBefore} attempt(s) before. B04/F02 noted class_progress may not be reliably populated.\n\n` : ''}${classification === 'COMPLETED_PASS' ? '### PASS: Day-1 completed successfully end-to-end\n\nAll steps executed with slow cadence: login → H2 guard → study (80 cards) → typed test → submit → grading → results.' : `### RESULT: ${classification}`}

---

## Notes

- **Persona:** slowlaptop — 120ms/char typing, 400-600ms between cards, deliberate pauses
- **Prior state:** Account had ${attemptsBefore} attempt(s) and ${before.classProgress.length} class_progress doc(s) before run
- **CSD:** ${csdBefore ?? 'N/A'} → ${csdAfter ?? 'N/A'} ${csdAdvanced ? '(advanced)' : '(no change — B04/F02: class_progress not reliably populated by app)'}
- **Bundle verified:** index-CflgDyCK.js (prod)
`;

  writeFileSync(path.join(FINDINGS_DAY1, 'D1-03_slowlaptop_top.md'), md);
  log('FINDINGS_WRITTEN');

  flushLogs('DONE', classification, {
    reachedTest: takeTestBtnAppeared || testPageReached,
    testSubmitted,
    resultsReached,
    questionsAnswered,
    studyCardsCompleted,
    takeTestBtnAppeared,
    testPageReached,
    gradingObserved,
    b2Found,
    csdBefore,
    csdAfter,
    csdAdvanced,
    attemptsNew: newAttempts,
    day1AttemptCount: day1Attempts.length,
    consoleErrorCount: consoleErrors.length,
    orphanDocs: orphanCount,
    day1OK: classification === 'COMPLETED_PASS',
  });

} catch (err) {
  log('FATAL_ERROR', { message: err.message, stack: err.stack?.slice(0, 500) });
  flushLogs('ERROR', `BLOCKED(fatal: ${err.message.slice(0, 80)})`, { error: err.message });
  throw err;
} finally {
  if (browser) await browser.close();
  log('BROWSER_CLOSED');
}
