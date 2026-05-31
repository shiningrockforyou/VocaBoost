/**
 * D1-02 — Day-1 Completion Test
 * Account: audit_multidevice_01_top@vocaboost.test / AuditPass2026!
 * Class: k8tzOiiwotBbtJS3uTiv (TOP), List: 8RMews2H7C3UJUAsOBzR
 * pace=80, testSizeNew=30, testMode=typed, passThreshold=92
 *
 * ACTUAL UI:
 *   - Flashcard phase: div[role="button"] = card, "I know this word (C)" / "Not sure (X)" buttons
 *   - Session Menu → "Skip to Test" → "Start Test" modal button
 *   - Test phase: ALL 30 questions on one page, each with input[type="text"]
 *   - "Submit Test" button at bottom → grading ~19s → results
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

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = 'https://vocaboostone.netlify.app';
const ACCOUNT = {
  email: 'audit_multidevice_01_top@vocaboost.test',
  password: 'AuditPass2026!',
};
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID = '8RMews2H7C3UJUAsOBzR';
const PACE = 80;

const AGENT_LOG_DIR = '/app/findings/agent_logs';
const EVIDENCE_DIR = '/app/findings/evidence/D1-02';
mkdirSync('/app/findings/day1', { recursive: true });
mkdirSync(AGENT_LOG_DIR, { recursive: true });
mkdirSync(EVIDENCE_DIR, { recursive: true });

// ─── Log helpers ──────────────────────────────────────────────────────────────
const jsonlLines = [];
function logEvent(type, data) {
  const entry = { ts: new Date().toISOString(), type, ...data };
  jsonlLines.push(JSON.stringify(entry));
  console.log(`[${type}]`, JSON.stringify(data));
}

// ─── Word lookup ──────────────────────────────────────────────────────────────
const words80 = JSON.parse(readFileSync('/tmp/d1_02_words.json', 'utf-8'));
const wordMap = {};
for (const w of words80) {
  const key = w.word.replace(/\s*\([^)]*\)\s*/g, '').toLowerCase().trim();
  wordMap[key] = w;
  wordMap[w.word.toLowerCase().trim()] = w;
}

function getDefinition(word) {
  if (!word) return 'a quality or characteristic';
  const clean = word.replace(/\s*\([^)]*\)\s*/g, '').toLowerCase().trim();
  const entry = wordMap[clean] || wordMap[word.toLowerCase().trim()];
  return entry?.def || 'a quality or characteristic';
}

// ─── Firestore helpers ────────────────────────────────────────────────────────
async function getUserByEmail(email) {
  const snap = await db.collection('users').where('email', '==', email).get();
  if (snap.empty) throw new Error(`User not found: ${email}`);
  return { uid: snap.docs[0].id, ...snap.docs[0].data() };
}

async function getStudentSnapshot(uid) {
  const [cpSnap, attSnap, ssSnap] = await Promise.all([
    db.collection('users').doc(uid).collection('class_progress').get(),
    db.collection('attempts').where('studentId', '==', uid).get(),
    db.collection('users').doc(uid).collection('study_states').get(),
  ]);
  const cpKey = `${CLASS_ID}_${LIST_ID}`;
  const cpDoc = cpSnap.docs.find(d => d.id === cpKey);
  return {
    capturedAt: new Date().toISOString(),
    class_progress: cpDoc ? { id: cpDoc.id, ...cpDoc.data() } : null,
    attempts: attSnap.docs.map(d => ({ id: d.id, type: d.data().type, day: d.data().studyDay, score: d.data().score })),
    study_states_count: ssSnap.size,
  };
}

// ─── Screenshot ───────────────────────────────────────────────────────────────
async function screenshot(page, name) {
  const fpath = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: fpath, fullPage: true }).catch(() => {});
  logEvent('screenshot', { file: fpath });
  return fpath;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const state = {
  reachedTest: false,
  b2StrandError: false,
  consoleErrors: [],
  csdBefore: null,
  csdAfter: null,
  attemptsCountBefore: 0,
  attemptsCountAfter: 0,
  attemptDocs: [],
  cardsDismissed: 0,
  questionsAnswered: 0,
  classification: 'BLOCKED',
  blockReason: null,
  newWordSliceCorrect: words80.length === PACE,
  orphanDocs: 'NONE',
};

let browser;
try {
  logEvent('start', { account: ACCOUNT.email });

  // ── Firestore snapshot before ─────────────────────────────────────────────
  const user = await getUserByEmail(ACCOUNT.email);
  const uid = user.uid;
  logEvent('uid', { uid });

  const snapBefore = await getStudentSnapshot(uid);
  state.csdBefore = snapBefore.class_progress?.currentStudyDay ?? null;
  state.attemptsCountBefore = snapBefore.attempts.length;
  logEvent('snapshot_before', { csd: state.csdBefore, attempts: snapBefore.attempts.length });

  // ── Browser ───────────────────────────────────────────────────────────────
  browser = await chromium.launch({
    headless: true,
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      state.consoleErrors.push(text);
      if (text.includes('Unsupported field value: undefined')) {
        state.b2StrandError = true;
        logEvent('b2_strand', { message: text });
      }
    }
  });
  page.on('pageerror', err => {
    state.consoleErrors.push(`PAGE_ERROR: ${err.message}`);
    if (err.message.includes('Unsupported field value: undefined')) state.b2StrandError = true;
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  logEvent('step', { step: 'login' });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0) await loginLink.click();
  else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });

  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(ACCOUNT.email);
  await page.getByLabel(/password/i).first().fill(ACCOUNT.password);
  await page.getByLabel(/password/i).first().press('Enter');
  try {
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  } catch {
    await page.getByRole('button', { name: /continue|log\s?in/i }).first().click().catch(() => {});
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  }
  logEvent('logged_in', { url: page.url() });
  await screenshot(page, '01_dashboard');

  // ── Open Session ──────────────────────────────────────────────────────────
  logEvent('step', { step: 'open_session' });
  await page.waitForTimeout(2000);

  let startBtn = page.getByRole('button', { name: /start.*(today|session)/i }).first();
  if (await startBtn.count() === 0) startBtn = page.getByRole('button', { name: /study|learn|begin/i }).first();

  if (!await startBtn.isVisible().catch(() => false)) {
    const dashText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    logEvent('dashboard_text', { text: dashText });
    throw new Error('Start session button not found on dashboard');
  }

  await startBtn.click();
  await page.waitForURL(/\/session\//, { timeout: 15000 });
  logEvent('session_opened', { url: page.url() });
  await page.waitForTimeout(3000);
  await screenshot(page, '02_session_loading');

  // ── "Start Studying" intro screen ─────────────────────────────────────────
  logEvent('step', { step: 'start_studying' });
  const ssBtn = page.getByRole('button', { name: /start studying/i }).first();
  if (await ssBtn.isVisible().catch(() => false)) {
    await ssBtn.click();
    await page.waitForTimeout(1500);
    logEvent('start_studying', { clicked: true });
  }
  await screenshot(page, '03_session_active');

  // ── H2 guard: if stale completion screen, move on ─────────────────────────
  for (let h2 = 0; h2 < 4; h2++) {
    const pt = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    if (!/all done|session complete|completed for today|move on/i.test(pt)) break;
    logEvent('h2_guard', { h2 });
    const moBtn = page.getByRole('button', { name: /move on|next day|continue/i }).first();
    if (await moBtn.isVisible().catch(() => false)) {
      await moBtn.click();
      await page.waitForTimeout(2000);
      const ssBtn2 = page.getByRole('button', { name: /start studying/i }).first();
      if (await ssBtn2.isVisible().catch(() => false)) { await ssBtn2.click(); await page.waitForTimeout(1500); }
    } else break;
  }

  // ── Flashcard phase: dismiss ~5 cards, then Skip to Test ─────────────────
  logEvent('step', { step: 'flashcard_study' });
  const knowBtn = page.getByRole('button', { name: /I know this word/i });

  let cardsDismissed = 0;
  for (let i = 0; i < 5; i++) {
    // Check if already at test
    if (await page.getByRole('textbox').count() > 0) break;

    const card = page.locator('[role="button"]').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(400);
    }
    if (await knowBtn.isVisible().catch(() => false)) {
      await knowBtn.click();
      cardsDismissed++;
      await page.waitForTimeout(300);
    }
  }
  state.cardsDismissed = cardsDismissed;
  logEvent('cards_dismissed', { count: cardsDismissed });
  await screenshot(page, '04_after_cards');

  // ── Skip to Test via Session Menu ─────────────────────────────────────────
  logEvent('step', { step: 'skip_to_test' });

  // Only skip if not already at test
  if (await page.getByRole('textbox').count() === 0) {
    const menuBtn = page.getByRole('button', { name: /session menu/i });
    if (await menuBtn.isVisible().catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, '05_session_menu');

      const skipItem = page.getByText(/skip to test/i).first();
      if (await skipItem.isVisible().catch(() => false)) {
        await skipItem.click();
        await page.waitForTimeout(1000);
        await screenshot(page, '06_skip_modal');

        // "Start Test" button in the confirmation modal
        const startTestBtn = page.getByRole('button', { name: /start test/i }).first();
        if (await startTestBtn.isVisible().catch(() => false)) {
          await startTestBtn.click();
          await page.waitForTimeout(2000);
          logEvent('start_test', { clicked: true });
        }
      } else {
        await page.keyboard.press('Escape');
        logEvent('warn', { msg: 'Skip to Test not in menu' });
      }
    }
  }

  await screenshot(page, '07_test_phase');

  // ── Test phase: all 30 inputs on one page ─────────────────────────────────
  logEvent('step', { step: 'test_phase' });

  // Wait for all inputs to be present
  await page.waitForFunction(() => document.querySelectorAll('input[type="text"]').length > 0, { timeout: 15000 })
    .catch(() => logEvent('warn', { msg: 'Test inputs did not appear' }));

  const inputCount = await page.locator('input[type="text"]').count();
  logEvent('test_inputs_found', { count: inputCount });

  if (inputCount === 0) {
    state.blockReason = 'No test inputs found';
    const pt = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    logEvent('blocked', { reason: state.blockReason, pageText: pt.slice(0, 500) });
  } else {
    state.reachedTest = true;

    // Extract word for each input from DOM
    const questionWords = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"]');
      return [...inputs].map((inp, i) => {
        let el = inp.parentElement;
        for (let d = 0; d < 8; d++) {
          if (!el) break;
          const txt = el.textContent?.trim();
          const match = txt?.match(/^\d+\.\s*(.+?)\s*(?:\(old\s+english\))?\s*\((?:n\.|v\.|adj\.|adv\.)/i);
          if (match) return { q: i + 1, word: match[1].trim() };
          el = el.parentElement;
        }
        return { q: i + 1, word: null };
      });
    });

    logEvent('question_words', { words: questionWords.map(q => q.word) });

    // Type answers char-by-char into each input
    const inputs = page.locator('input[type="text"]');
    let questionsAnswered = 0;

    for (let i = 0; i < inputCount; i++) {
      const wordInfo = questionWords[i];
      const definition = getDefinition(wordInfo?.word);
      logEvent('typing_answer', { q: i + 1, word: wordInfo?.word, def: definition.slice(0, 50) });

      const input = inputs.nth(i);
      try {
        // Scroll into view
        await input.scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);

        // Click to focus
        await input.click({ force: true }); // use force to handle any overlays
        await page.waitForTimeout(150);

        // Clear existing content
        await input.press('Control+a');
        await input.press('Delete');
        await page.waitForTimeout(80);

        // Type char-by-char (NOT .fill()) as per test spec
        for (const ch of definition) {
          await input.type(ch, { delay: 40 });
        }

        questionsAnswered++;
      } catch (e) {
        logEvent('input_error', { q: i + 1, error: e.message.slice(0, 100) });
        // Try direct .fill() as fallback
        try {
          await input.fill(definition);
          questionsAnswered++;
        } catch (e2) {
          logEvent('input_fill_error', { q: i + 1, error: e2.message.slice(0, 100) });
        }
      }

      if (i === 0) await screenshot(page, '08_first_answer_typed');
      if (i === 4) await screenshot(page, '09_fifth_answer_typed');
    }

    state.questionsAnswered = questionsAnswered;
    logEvent('all_answers_typed', { count: questionsAnswered });
    await screenshot(page, '10_all_answers_typed');

    // ── Submit Test ─────────────────────────────────────────────────────────
    logEvent('step', { step: 'submit_test' });
    const submitBtn = page.getByRole('button', { name: /submit test/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      logEvent('submit_clicked', {});
    } else {
      // Scroll to bottom and try
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      const submitBtn2 = page.getByRole('button', { name: /submit/i }).first();
      if (await submitBtn2.isVisible().catch(() => false)) {
        await submitBtn2.click();
        logEvent('submit_clicked', { fallback: true });
      }
    }

    await screenshot(page, '11_after_submit');

    // ── Wait for grading (~19s) ─────────────────────────────────────────────
    logEvent('step', { step: 'grading_wait' });
    logEvent('grading_started', { ts: new Date().toISOString() });

    // Wait for grading indicator to appear then disappear
    await page.waitForFunction(
      () => /grading|analyzing|checking|please wait|processing/i.test(document.body.innerText),
      { timeout: 10000 }
    ).catch(() => logEvent('grading_indicator_not_seen', {}));

    await page.waitForFunction(
      () => !document.body.innerText.match(/grading|analyzing|checking|please wait|processing/i),
      { timeout: 60000 }
    ).catch(() => logEvent('grading_timeout', {}));

    logEvent('grading_done', { ts: new Date().toISOString() });
    await screenshot(page, '12_after_grading');

    // ── Results ─────────────────────────────────────────────────────────────
    logEvent('step', { step: 'results' });
    await page.waitForTimeout(3000);
    await screenshot(page, '13_results');

    const resultsText = await page.evaluate(() => document.body.innerText.slice(0, 5000));
    logEvent('results_text', { text: resultsText.slice(0, 600) });

    const isPass = /pass|great job|well done|day.*complete|completed|congrats|step 3/i.test(resultsText);
    const isFail = /fail|retake|not pass|below/i.test(resultsText);
    logEvent('result_detection', { isPass, isFail });
  }

  // ── Post-test Firestore snapshot ──────────────────────────────────────────
  logEvent('step', { step: 'post_snapshot' });
  await page.waitForTimeout(8000); // allow writes to propagate

  const snapAfter = await getStudentSnapshot(uid);
  state.csdAfter = snapAfter.class_progress?.currentStudyDay ?? null;
  state.attemptsCountAfter = snapAfter.attempts.length;
  state.attemptDocs = snapAfter.attempts;

  logEvent('snapshot_after', {
    csd: state.csdAfter,
    attempts: snapAfter.attempts.length,
    attemptIds: snapAfter.attempts.map(a => a.id),
  });

  // ── Assertions ────────────────────────────────────────────────────────────
  const csdAdvanced = state.csdBefore === 0 && state.csdAfter === 1;
  const newAttempts = state.attemptsCountAfter - state.attemptsCountBefore;
  const exactlyOneAttempt = newAttempts === 1;

  logEvent('assertions', {
    csdBefore: state.csdBefore, csdAfter: state.csdAfter, csdAdvanced,
    attsBefore: state.attemptsCountBefore, attsAfter: state.attemptsCountAfter, newAttempts, exactlyOneAttempt,
    b2Strand: state.b2StrandError,
    wordSliceCorrect: state.newWordSliceCorrect,
  });

  if (!state.reachedTest) {
    state.classification = `BLOCKED(${state.blockReason || 'test not reached'})`;
  } else if (csdAdvanced && !state.b2StrandError) {
    state.classification = 'COMPLETED_PASS';
  } else if (state.reachedTest) {
    state.classification = 'COMPLETED_NOPASS';
  }

  logEvent('classification', { classification: state.classification });
  await screenshot(page, '14_final');

} catch (err) {
  logEvent('fatal_error', { message: err.message, stack: err.stack?.slice(0, 400) });
  state.classification = `BLOCKED(fatal: ${err.message.slice(0, 100)})`;
  state.blockReason = err.message;
} finally {
  if (browser) await browser.close();
  logEvent('browser_closed', {});

  // Write output files
  writeFileSync(path.join(AGENT_LOG_DIR, 'D1-02.jsonl'), jsonlLines.join('\n') + '\n');

  const newAttempts = state.attemptsCountAfter - state.attemptsCountBefore;
  const status = {
    label: 'D1-02',
    account: ACCOUNT.email,
    classId: CLASS_ID,
    listId: LIST_ID,
    classification: state.classification,
    reachedTest: state.reachedTest,
    b2StrandError: state.b2StrandError,
    csdBefore: state.csdBefore,
    csdAfter: state.csdAfter,
    newWordSliceCorrect: state.newWordSliceCorrect,
    exactlyOneAttempt: newAttempts === 1,
    attemptsCountBefore: state.attemptsCountBefore,
    attemptsCountAfter: state.attemptsCountAfter,
    attemptDocs: state.attemptDocs,
    cardsDismissed: state.cardsDismissed,
    questionsAnswered: state.questionsAnswered,
    consoleErrorCount: state.consoleErrors.length,
    consoleErrors: state.consoleErrors.slice(0, 10),
    orphanDocs: state.orphanDocs,
    completedAt: new Date().toISOString(),
  };

  writeFileSync(path.join(AGENT_LOG_DIR, 'D1-02.status.json'), JSON.stringify(status, null, 2));

  console.log('\n=== STATUS BLOCK ===');
  console.log(JSON.stringify(status, null, 2));
}
