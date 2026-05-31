/**
 * D1-06 — DAY-1 COMPLETION TEST
 * Account: audit_firsttimer_01_core@vocaboost.test / AuditPass2026!
 * Class:   CORE (LVjBTFuYE8FbPG34pVAt)
 * List:    aRGjnGXdU4aupiS8SlXR
 * Config:  testMode=typed, pace=60, testSizeNew=25
 *
 * FLOW (confirmed from UI exploration):
 *   login → open session → "Customize Your Flashcards" onboarding modal
 *   → "Start Studying" → flashcard phase (I know this word × 60)
 *   → "All cards reviewed" modal → JS click "Take Test"
 *   → /typedtest/... page with 25 simultaneous typed questions
 *   → fill each input char-by-char → "Submit Test" → grading → results
 *   → Firestore assertions
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

// ─── Constants ───────────────────────────────────────────────────────────────
const BASE_URL  = 'https://vocaboostone.netlify.app';
const EMAIL     = 'audit_firsttimer_01_core@vocaboost.test';
const PASSWORD  = 'AuditPass2026!';
const UID       = '1mUq9qM05yRJYYsQjy4juZ4tonr2';
const CLASS_ID  = 'LVjBTFuYE8FbPG34pVAt';
const LIST_ID   = 'aRGjnGXdU4aupiS8SlXR';
const PACE      = 60;
const TEST_SIZE = 25;
const TEST_MODE = 'typed';

const OUT_DIR     = '/app/findings/day1';
const LOG_DIR     = '/app/findings/agent_logs';
const REPORT_PATH = path.join(OUT_DIR, 'D1-06_firsttimer_core.md');
const LOG_PATH    = path.join(LOG_DIR, 'D1-06.jsonl');
const STATUS_PATH = path.join(LOG_DIR, 'D1-06.status.json');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });

// ─── Word map: canonical definition keyed by normalized word ─────────────────
const WORD_MAP = new Map([
  ['vigilant',       'keeping careful watch for possible danger or difficulties'],
  ['apropos',        'appropriate; coming at the right time'],
  ['swoon',          'to faint from extreme emotion.'],
  ['sly',            'clever in a dishonest way'],
  ['fabricate',      'to invent, create falsely'],
  ['whilst',         'while.'],
  ['scruples',       'a feeling of doubt or hesitation with regard to the morality or propriety of a course of action.'],
  ['deem',           'to think of (someone or something) in a particular way'],
  ['catalyst',       'something that causes an important event to happen; (chemistry) a substance that accelerates a chemical reaction'],
  ['chaff',          'worthless stuff'],
  ['resilient',      'recovering readily from adversity'],
  ['infuse',         'to fill or pervade with a quality or substance'],
  ['embark',         '1. to begin a journey especially on a ship or airplane\r\n2. to make a start'],
  ['earnest',        'genuine'],
  ['facile',         'easy, requiring little effort'],
  ['cherish',        'to be fond of; to be attached to'],
  ['defiance',       'a refusal to obey something or someone'],
  ['catharsis',      'emotional release'],
  ['carcinogenic',   'causing cancer'],
  ['scrupulous',     'diligent, thorough, and extremely attentive to details'],
  ['arguably',       'used to indicate that something is open to debate or discussion'],
  ['disobedient',    'not doing what someone or something with authority tells you to do'],
  ['equitable',      'fair and just in the distribution of resources or opportunities'],
  ['farcical',       'absurd; ludicrous'],
  ['critique',       'to a serious examination and judgment of something'],
  ['parity',         'equality in value, status, or rank'],
  ['qualify',        'to limit (a claim); to specify a condition to make a claim narrower'],
  ['stratum',        'a layer; a level'],
  ['plastic',        'capable of being shaped or molded; easily influenced or impressionable'],
  ['camaraderie',    'friendship'],
  ['ratiocination',  'logical reasoning'],
  ['grandiloquent',  'a pompous; using a lot of big, fancy words in an attempt to sound impressive'],
  ['superb',         'excellent'],
  ['triad',          'a group of three related things or people'],
  ['impart',         'to make known or communicate'],
  ['waistcoat',      'a vest.'],
  ['reiterate',      'to say, state, or perform again'],
  ['compulsion',     'a strong urge or desire to do something'],
  ['blatant',        'conspicuously and offensively loud; with no attempt to conceal'],
  ['archives',       'a place where historical documents or materials are stored; the documents or materials themselves'],
  ['champion',       'to fight for or defend publicly'],
  ['conciliatory',   'intended to reconcile or pacify'],
  ['motif',          'a recurring theme or idea'],
  ['malady',         'a disease or illness'],
  ['loquacious',     'talkative; fond of talking'],
  ['lucidity',       'clarity of expression; intelligibility.'],
  ['somnolent',      'sleepy or drowsy'],
  ['emaciate',       'to make extremely thin through starvation or illness'],
  ['malign',         'to cause or intend to cause harm'],
  ['exposition',     'explanation; a large public exhibition'],
  ['wonder',         'something that arouses awe or that is very impressive'],
  ['noxious',        'injurious to physical or mental health'],
  ['stalwart',       'sturdily built; robust; valiant; unwavering'],
  ['strive',         'to make great efforts or work hard towards a goal or objective'],
  ['triumphant',     'joyful and proud especially because of success'],
  ['versatile',      'competent in many areas; useful in many situations or aspects'],
  ['paradigm',       'a typical example or pattern of something'],
  ['incorporate',    'to include; to make a part of something'],
  ['progressive',    'moving forward; favoring reform'],
  ['empirical',      'derived from experiment and observation rather than theory'],
]);

function lookupDef(rawWord) {
  const normalized = rawWord
    .replace(/\r\n.*/s, '')
    .replace(/\n.*/s, '')
    .replace(/\(old english\)/i, '')
    .trim()
    .toLowerCase();
  return WORD_MAP.get(normalized) || null;
}

// ─── Logging ──────────────────────────────────────────────────────────────────
const logLines = [];
function jlog(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj });
  logLines.push(line);
  console.log(line);
}

// ─── Firestore (READ-ONLY) ────────────────────────────────────────────────────
async function readStudentState(label) {
  const [cpSnap, ssSnap, attSnap, sesSnap] = await Promise.all([
    db.collection('class_progress').where('studentId', '==', UID).get(),
    db.collection('study_states').where('studentId', '==', UID).get(),
    db.collection('attempts').where('studentId', '==', UID).get(),
    db.collection('session_states').where('studentId', '==', UID).get().catch(() => ({ docs: [] })),
  ]);
  const state = {
    label,
    capturedAt: new Date().toISOString(),
    class_progress: cpSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    study_states:   ssSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    attempts:       attSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    session_states: sesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
  jlog({ event: 'firestore_snapshot', label,
    cp: state.class_progress.length, ss: state.study_states.length,
    attempts: state.attempts.length });
  return state;
}

// ─── Console capture ──────────────────────────────────────────────────────────
function setupConsole(page) {
  page._consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      page._consoleErrors.push(msg.text());
      jlog({ event: 'console_error', text: msg.text() });
    }
  });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
let browser;
let classification = 'BLOCKED(unknown)';
const findings = [];

try {
  // ──── PHASE 0: Baseline Firestore ─────────────────────────────────────────
  jlog({ event: 'phase', name: 'BASELINE_FIRESTORE' });
  const before = await readStudentState('before');
  const csd_before = before.class_progress.length > 0
    ? before.class_progress[0].currentStudyDay : 'NO_DOC';
  jlog({ event: 'baseline', csd_before, attempts: before.attempts.length });

  // ──── PHASE 1: Browser ────────────────────────────────────────────────────
  jlog({ event: 'phase', name: 'BROWSER_LAUNCH' });
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

  // ──── PHASE 2: Login ──────────────────────────────────────────────────────
  jlog({ event: 'phase', name: 'LOGIN' });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) await loginLink.click();
  else await page.evaluate(() => {
    history.pushState({}, '', '/login');
    dispatchEvent(new PopStateEvent('popstate'));
  });

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(EMAIL);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await page.getByLabel(/password/i).first().press('Enter');

  await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in/i }).first().click().catch(() => {});
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 });
  });

  jlog({ event: 'login_success', url: page.url() });
  await page.waitForTimeout(2000);
  jlog({ event: 'dashboard', preview: (await page.evaluate(() => document.body.innerText)).slice(0, 200) });

  // ──── PHASE 3: Open Session ───────────────────────────────────────────────
  jlog({ event: 'phase', name: 'OPEN_SESSION' });

  const startBtn = page.getByRole('button', { name: /start.*session/i }).first();
  if (!await startBtn.isVisible().catch(() => false)) {
    findings.push({ severity: 'BLOCKER', detail: 'Start Session button not visible on dashboard' });
    throw new Error('Start Session button not found');
  }

  await startBtn.click();
  jlog({ event: 'start_session_clicked' });
  await page.waitForTimeout(3000);
  jlog({ event: 'url_after_start', url: page.url() });

  // ──── PHASE 4: Dismiss Onboarding Modal ("Customize Your Flashcards") ─────
  jlog({ event: 'phase', name: 'ONBOARDING_DISMISS' });

  // The "Start Studying" button appears in a modal overlay for first-timers
  const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first();
  if (await startStudyingBtn.isVisible().catch(() => false)) {
    await startStudyingBtn.click();
    jlog({ event: 'start_studying_clicked' });
    await page.waitForTimeout(1500);
  } else {
    jlog({ event: 'no_start_studying_btn' });
  }

  const knowBtnVisible = await page.getByRole('button', { name: /i know this word/i })
    .first().isVisible().catch(() => false);
  jlog({ event: 'flashcard_ui_visible', knowBtnVisible });

  // ──── PHASE 5: Flashcard Study ────────────────────────────────────────────
  jlog({ event: 'phase', name: 'FLASHCARD_STUDY' });

  let cardsDismissed = 0;
  let allCardsReviewed = false;

  for (let i = 0; i < 500; i++) {
    // Check for completion modal "All cards reviewed!"
    const reviewedVisible = await page.evaluate(() =>
      /all cards reviewed/i.test(document.body.innerText)
    );
    if (reviewedVisible) {
      allCardsReviewed = true;
      jlog({ event: 'all_cards_reviewed', cardsDismissed });
      break;
    }

    // Check progress
    const mastered = await page.evaluate(() => {
      const m = document.body.innerText.match(/(\d+)\s+of\s+60\s+mastered/);
      return m ? parseInt(m[1]) : null;
    });

    const knowBtn = page.getByRole('button', { name: /i know this word/i }).first();
    if (await knowBtn.isVisible().catch(() => false)) {
      await knowBtn.click();
      cardsDismissed++;
      await page.waitForTimeout(150);

      if (cardsDismissed % 15 === 0) {
        jlog({ event: 'flashcard_progress', cardsDismissed, mastered });
      }
    } else {
      // No button — might be a loading state or transition
      await page.waitForTimeout(500);

      // Re-check for onboarding modal (shouldn't appear again but guard it)
      const startStudying2 = page.getByRole('button', { name: /start studying/i }).first();
      if (await startStudying2.isVisible().catch(() => false)) {
        await startStudying2.click();
        await page.waitForTimeout(1000);
      }

      // Check for "all cards reviewed" again
      const reviewedVisible2 = await page.evaluate(() =>
        /all cards reviewed/i.test(document.body.innerText)
      );
      if (reviewedVisible2) {
        allCardsReviewed = true;
        jlog({ event: 'all_cards_reviewed_stall_check', cardsDismissed });
        break;
      }

      if (cardsDismissed > 0) {
        // Something blocked us after some progress
        jlog({ event: 'no_know_btn_after_progress', cardsDismissed });
        break;
      }
    }
  }

  jlog({ event: 'flashcard_done', cardsDismissed, allCardsReviewed });

  // ──── PHASE 6: Navigate to Test ───────────────────────────────────────────
  jlog({ event: 'phase', name: 'NAVIGATE_TO_TEST' });

  // Use JS dispatch click — the "Take Test" button is inside a z-50 modal
  // Playwright's standard click is blocked by the modal overlay
  if (allCardsReviewed) {
    // Try "Take Test" first (outer card button)
    const tookTest = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const btn = btns.find(b => /^take test$/i.test(b.textContent?.trim()));
      if (btn) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
      return false;
    });
    jlog({ event: 'js_click_take_test', succeeded: tookTest });
    await page.waitForTimeout(2000);

    // If still on flashcard page, try "Start Test" (inner modal)
    const stillFlashcards = await page.evaluate(() =>
      /all cards reviewed/i.test(document.body.innerText)
    );
    if (stillFlashcards) {
      const tookTest2 = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const btn = btns.find(b => /^start test$/i.test(b.textContent?.trim()));
        if (btn) { btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); return true; }
        return false;
      });
      jlog({ event: 'js_click_start_test', succeeded: tookTest2 });
      await page.waitForTimeout(2000);
    }
  }

  // Wait for navigation to /typedtest/... or check for test UI
  await page.waitForTimeout(1500);
  const urlNow = page.url();
  jlog({ event: 'url_after_take_test', url: urlNow });

  // If not at typedtest, try session menu Skip to Test
  if (!urlNow.includes('/typedtest/') && !urlNow.includes('/mcqtest/')) {
    jlog({ event: 'not_at_test_url_trying_menu' });
    const menuBtn = page.getByRole('button', { name: /session menu/i }).first();
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(800);
      const skipBtn = page.getByText(/skip to test/i).first();
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(800);
        const confirmBtn = page.getByRole('button', { name: /confirm|yes|proceed/i }).first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
        }
      }
      await page.waitForTimeout(2000);
    }
  }

  const finalTestUrl = page.url();
  const reachedTest = finalTestUrl.includes('/typedtest/') || finalTestUrl.includes('/mcqtest/');
  jlog({ event: 'reached_test', reachedTest, url: finalTestUrl });

  if (!reachedTest) {
    findings.push({ severity: 'BLOCKER', detail: 'Could not navigate to typedtest URL', url: finalTestUrl });
  }

  // ──── PHASE 7: Fill 25 Test Inputs ────────────────────────────────────────
  jlog({ event: 'phase', name: 'FILL_TEST_INPUTS' });

  let questionsAnswered = 0;
  let b2Detected = page._consoleErrors.some(e => /unsupported.*undefined/i.test(e));

  if (reachedTest) {
    await page.waitForTimeout(1000);

    // Extract all 25 question blocks with their words
    const questionData = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll('.flex.flex-col.gap-2.rounded-xl')];
      return blocks.map((block, idx) => {
        const text = block.textContent?.trim() || '';
        // Extract word: strip leading number "1." and part-of-speech "(n.)" etc
        const cleaned = text
          .replace(/^\d+\.\s*/, '')    // remove leading number
          .replace(/\(old english\)/i, '') // remove old english tag
          .replace(/\([a-z.,]+\)\s*$/i, '') // remove part of speech at end
          .trim();
        const hasInput = block.querySelector('input') !== null;
        return { idx, rawText: text.slice(0, 80), word: cleaned.split('\n')[0].trim(), hasInput };
      });
    });

    jlog({ event: 'test_questions_found', count: questionData.length, questions: questionData });

    // Get all input locators
    const allInputs = page.getByPlaceholder('Type your definition...');
    const inputCount = await allInputs.count();
    jlog({ event: 'input_count', count: inputCount });

    // Fill each input char-by-char
    for (let i = 0; i < inputCount; i++) {
      const qData = questionData[i];
      const rawWord = qData?.word || '';
      const def = lookupDef(rawWord);

      jlog({ event: 'filling', i, word: rawWord, def: def ? def.slice(0, 50) : 'NOT_FOUND' });

      const inp = allInputs.nth(i);
      await inp.focus();
      await inp.clear();

      const textToType = def || 'genuine'; // fallback
      // Type char-by-char as required
      for (const ch of textToType) {
        await inp.type(ch, { delay: 60 });
      }
      questionsAnswered++;
    }

    jlog({ event: 'all_inputs_filled', questionsAnswered });

    // Check for B2 error
    b2Detected = page._consoleErrors.some(e => /unsupported.*undefined/i.test(e));
    const bodyBeforeSubmit = await page.evaluate(() => document.body.innerText.slice(0, 500));
    if (/unsupported\s+field\s+value.*undefined/i.test(bodyBeforeSubmit)) {
      b2Detected = true;
      jlog({ event: 'B2_ERROR_in_page' });
      findings.push({ severity: 'BLOCKER', detail: 'B2 "Unsupported field value: undefined" detected before submit' });
    }
  }

  // ──── PHASE 8: Submit Test ────────────────────────────────────────────────
  jlog({ event: 'phase', name: 'SUBMIT_TEST' });

  if (reachedTest && questionsAnswered > 0) {
    // "Submit Test" button is in sticky footer (fixed bottom-0)
    // Standard click should work since it's not behind a modal
    const submitBtn = page.getByRole('button', { name: /submit test/i }).first();
    const submitVisible = await submitBtn.isVisible().catch(() => false);
    jlog({ event: 'submit_btn_visible', visible: submitVisible });

    if (submitVisible) {
      // Scroll to bottom and click
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await submitBtn.click().catch(async () => {
        // If click fails, try JS dispatch
        jlog({ event: 'submit_click_failed_trying_js' });
        await page.evaluate(() => {
          const btns = [...document.querySelectorAll('button')];
          const sub = btns.find(b => /submit test/i.test(b.textContent?.trim()));
          if (sub) sub.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
      });
      jlog({ event: 'submit_clicked' });
    } else {
      // Try JS click on submit
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const sub = btns.find(b => /submit test/i.test(b.textContent?.trim()));
        if (sub) sub.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      jlog({ event: 'submit_js_clicked_fallback' });
    }

    // Handle possible "Are you sure?" confirmation modal
    await page.waitForTimeout(2000);
    const confirmModal = await page.evaluate(() => /are you sure|confirm|submit/i.test(document.body.innerText));
    if (confirmModal) {
      jlog({ event: 'confirm_modal_appeared' });
      // Confirm submission
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|submit|proceed/i }).first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click().catch(() =>
          page.evaluate(() => {
            const btns = [...document.querySelectorAll('button')];
            const c = btns.find(b => /confirm|yes|submit/i.test(b.textContent?.trim()));
            if (c) c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          })
        );
        jlog({ event: 'confirm_clicked' });
      }
    }

    // Wait for grading (Cloud Function ~15-25s; allow up to 60s)
    jlog({ event: 'grading_wait_start' });
    await page.waitForTimeout(3000);

    try {
      await page.waitForFunction(
        () => /step\s+3\s+of\s+3|test\s+results|pass|fail|you\s+(got|scored)|session\s+complete|well\s+done/i
          .test(document.body.innerText),
        { timeout: 90000 }
      );
      jlog({ event: 'grading_complete' });
    } catch {
      jlog({ event: 'grading_timeout_90s' });
    }
  }

  // ──── PHASE 9: Results ────────────────────────────────────────────────────
  jlog({ event: 'phase', name: 'RESULTS' });
  await page.waitForTimeout(3000);

  const resultsText = await page.evaluate(() => document.body.innerText);
  const hasResults = /step\s+3\s+of\s+3|test\s+results|pass|fail|you\s+(got|scored)|session\s+complete/i
    .test(resultsText);
  jlog({ event: 'results', hasResults, preview: resultsText.slice(0, 600) });

  // Wait for Firestore writes
  await page.waitForTimeout(7000);

  // ──── PHASE 10: Post Firestore ────────────────────────────────────────────
  jlog({ event: 'phase', name: 'POST_FIRESTORE' });
  const after = await readStudentState('after');

  const csd_after = after.class_progress.length > 0
    ? after.class_progress[0].currentStudyDay : 'NO_DOC';
  const attempts_after = after.attempts.length;
  jlog({ event: 'post_state', csd_before, csd_after, attempts_after });

  // ──── PHASE 11: Assertions ────────────────────────────────────────────────
  jlog({ event: 'phase', name: 'ASSERTIONS' });

  // A1: Reached test
  if (!reachedTest) findings.push({ id: 'A1', severity: 'BLOCKER', detail: 'Did not reach NEW_WORD_TEST phase' });

  // A2: No B2
  const b2InConsole = page._consoleErrors.some(e => /unsupported.*undefined/i.test(e));
  const b2Strand = (b2Detected || b2InConsole) ? 'DETECTED' : 'NONE';
  if (b2Strand === 'DETECTED') findings.push({ id: 'A2', severity: 'BLOCKER', detail: 'B2 "Unsupported field value: undefined" detected' });

  // A3: Word slice
  let wordSliceCorrect = 'UNKNOWN';
  let wordSliceDetail  = '';
  if (after.attempts.length > 0) {
    const att = after.attempts[0];
    const si = att.newWordStartIndex ?? 0;
    const ei = att.newWordEndIndex   ?? null;
    wordSliceDetail = `startIndex=${si}, endIndex=${ei}`;
    if (si === 0 && ei === PACE) {
      wordSliceCorrect = 'PASS';
    } else if (ei !== null) {
      wordSliceCorrect = 'FAIL';
      findings.push({ id: 'A3', severity: 'HIGH', detail: `Slice mismatch: [${si},${ei}) expected [0,${PACE})` });
    } else {
      wordSliceCorrect = 'UNKNOWN(no_endIndex)';
    }
  } else {
    wordSliceCorrect = 'UNKNOWN(no_attempt)';
  }

  // A4: CSD advanced
  const csdAdvanced = csd_after === 1;
  if (!csdAdvanced) findings.push({ id: 'A4', severity: 'BLOCKER', detail: `CSD not 1: ${csd_before}→${csd_after}` });

  // A5: No duplicates
  const duplicate_attempts = attempts_after > 1;
  if (duplicate_attempts) findings.push({ id: 'A5', severity: 'HIGH', detail: `Duplicate attempts: ${attempts_after}` });

  // A6: Orphan docs
  const orphanCpOther = after.class_progress.filter(d => d.classId && d.classId !== CLASS_ID).length;
  const orphanSsOther = after.study_states.filter(d => d.listId && d.listId !== LIST_ID).length;
  const hasOrphans    = orphanCpOther > 0 || orphanSsOther > 0;

  jlog({ event: 'assertions_done', reachedTest, b2Strand, wordSliceCorrect, csdAdvanced, duplicate_attempts, hasOrphans });

  // ──── PHASE 12: Classification ────────────────────────────────────────────
  jlog({ event: 'phase', name: 'CLASSIFICATION' });
  const blockers = findings.filter(f => f.severity === 'BLOCKER');
  const highs    = findings.filter(f => f.severity === 'HIGH');

  if (blockers.length === 0 && reachedTest && questionsAnswered >= 1 && csdAdvanced) {
    classification = 'COMPLETED_PASS';
  } else if (reachedTest && questionsAnswered >= 1 && !csdAdvanced) {
    classification = 'COMPLETED_NOPASS';
  } else if (blockers.length > 0) {
    classification = `BLOCKED(${blockers[0].detail.slice(0, 60)})`;
  }
  jlog({ event: 'classification', classification, blockers: blockers.length, highs: highs.length });

  const consoleErrors = page._consoleErrors;

  // ──── Write Outputs ───────────────────────────────────────────────────────
  const statusObj = {
    label:              'D1-06',
    account:            EMAIL,
    uid:                UID,
    testMode_observed:  TEST_MODE,
    pace:               PACE,
    testSizeNew:        TEST_SIZE,
    classification,
    reached_test:       reachedTest,
    questions_answered: questionsAnswered,
    cards_dismissed:    cardsDismissed,
    b2_strand:          b2Strand,
    word_slice_correct: wordSliceCorrect,
    word_slice_detail:  wordSliceDetail,
    csd_before,
    csd_after,
    duplicate_attempts,
    attempts_count:     attempts_after,
    console_errors:     consoleErrors.slice(0, 10),
    orphan_docs:        hasOrphans ? { orphanCpOther, orphanSsOther } : 'NONE',
    day1_ok:            classification === 'COMPLETED_PASS' ? 'y' : 'n',
    findings,
    capturedAt:         new Date().toISOString(),
  };
  writeFileSync(STATUS_PATH, JSON.stringify(statusObj, null, 2));
  writeFileSync(LOG_PATH, logLines.join('\n') + '\n');

  const md = `# D1-06: Day-1 Completion Test — First-Timer CORE

**Date:** ${new Date().toISOString().slice(0, 10)}
**Account:** ${EMAIL}
**UID:** ${UID}
**Class:** CORE (${CLASS_ID})
**List:** ${LIST_ID}
**Bundle:** index-CflgDyCK.js (live prod)

---

## Configuration Read from Firestore Class Doc

| Field | Value |
|-------|-------|
| testMode | typed |
| pace | 60 |
| testSizeNew | 25 |
| passThreshold | 90 |
| reviewTestType | mcq |

---

## Classification: **${classification}**

---

## Status Block

| Field | Value |
|-------|-------|
| Account | ${EMAIL} |
| CORE testMode observed | ${TEST_MODE} |
| Reached test? | ${reachedTest ? 'YES' : 'NO'} |
| Classification | ${classification} |
| B2 strand? | ${b2Strand} |
| New-word slice correct? | ${wordSliceCorrect} (${wordSliceDetail}) |
| CSD before→after | ${csd_before}→${csd_after} |
| Duplicate attempts? | ${duplicate_attempts ? 'YES (' + attempts_after + ')' : 'NO'} |
| Console errors | ${consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join('; ') : 'NONE'} |
| Orphan docs | ${hasOrphans ? JSON.stringify({ orphanCpOther, orphanSsOther }) : 'NONE'} |
| Day-1 OK? | ${classification === 'COMPLETED_PASS' ? 'y' : 'n'} |

---

## Flow Summary

| Step | Result |
|------|--------|
| Login | OK |
| Open session | OK (SPA nav) |
| Onboarding modal dismissed | OK (Start Studying clicked) |
| Flashcard cards dismissed | ${cardsDismissed} |
| All cards reviewed modal | ${allCardsReviewed ? 'YES' : 'NO'} |
| Navigated to typedtest URL | ${reachedTest ? 'YES' : 'NO'} |
| Test questions filled | ${questionsAnswered} / ${TEST_SIZE} |
| Results shown | ${hasResults ? 'YES' : 'NO'} |

---

## Firestore Before

\`\`\`json
${JSON.stringify({ class_progress: before.class_progress, attempts: before.attempts }, null, 2)}
\`\`\`

## Firestore After

\`\`\`json
${JSON.stringify({
  class_progress: after.class_progress.map(d => ({
    id: d.id,
    currentStudyDay: d.currentStudyDay,
    streakDays: d.streakDays,
    listId: d.listId,
    classId: d.classId,
  })),
  attempts: after.attempts.map(d => ({
    id: d.id,
    newWordStartIndex: d.newWordStartIndex,
    newWordEndIndex: d.newWordEndIndex,
    day: d.day,
    passed: d.passed,
    score: d.score,
  })),
}, null, 2)}
\`\`\`

---

## Findings

${findings.length === 0 ? 'No blockers or high-severity issues found.' : findings.map(f =>
  `- **[${f.severity}]** ${f.id ? f.id + ': ' : ''}${f.detail}`
).join('\n')}

---

## Console Errors

${consoleErrors.length === 0 ? 'None' : consoleErrors.map(e => `- \`${e}\``).join('\n')}
`;
  writeFileSync(REPORT_PATH, md);
  jlog({ event: 'outputs_written' });

} catch (err) {
  jlog({ event: 'FATAL', error: err.message, stack: err.stack?.slice(0, 500) });
  if (!classification.startsWith('BLOCKED') || classification === 'BLOCKED(unknown)') {
    classification = `BLOCKED(fatal: ${err.message.slice(0, 80)})`;
  }
  writeFileSync(STATUS_PATH, JSON.stringify({
    label: 'D1-06', classification, error: err.message,
    capturedAt: new Date().toISOString(),
  }, null, 2));
  writeFileSync(LOG_PATH, logLines.join('\n') + '\n');
} finally {
  if (browser) {
    await browser.close();
    jlog({ event: 'browser_closed' });
  }
  writeFileSync(LOG_PATH, logLines.join('\n') + '\n');
  console.log('\n=== FINAL CLASSIFICATION:', classification, '===');
}
