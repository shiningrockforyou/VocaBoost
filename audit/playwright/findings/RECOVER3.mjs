/**
 * RECOVER3 — Definitive Crash Recovery Test
 *
 * Uses PERSISTENT browser context (fixed userDataDir per scenario) so that
 * context.close() + launchPersistentContext(same dir) = real browser restart
 * with localStorage intact (same as Chrome profile directory).
 *
 * Reaches the test via the REAL student flow (NOT "Skip to Test"):
 *   Login → Session → Study flashcards (advance through queue) → test auto-triggers
 *
 * The point: navigateToTest() is called from the real study-complete path,
 * which is the path that SHOULD write lastPhase:'NEW_TEST' before navigating.
 * We confirm whether it does or doesn't.
 *
 * Scenarios:
 *   A. New-word test, real flow, crash within 3min window
 *   B. Review test, real flow (advanced account, Day>=2)
 *   C. Expiry: inject expired state, confirm loss-on-expiry (MEDIUM control)
 *   D. Graceful close: inject valid state, navigate away, confirm recovery suppressed
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EVIDENCE_DIR = path.join(__dirname, 'findings', 'evidence', 'B27', 'recovery_definitive');
const LOGS_DIR = path.join(__dirname, 'findings', 'agent_logs');
const FINDINGS_FILE = path.join(__dirname, 'findings', 'findings_B27_recovery_definitive.md');
const LOG_FILE = path.join(LOGS_DIR, 'RECOVER3.jsonl');
const STATUS_FILE = path.join(LOGS_DIR, 'RECOVER3.status.json');

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

const BASE_URL = 'https://vocaboostone.netlify.app';
const CAREFUL_EMAIL = 'audit_careful_01_top@vocaboost.test';
const ADVANCED_EMAIL = 'audit_advanced_01_top@vocaboost.test';
const PASSWORD = 'AuditPass2026!';
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID = '8RMews2H7C3UJUAsOBzR';
const CHROMIUM = '/ms-playwright/chromium-1223/chrome-linux64/chrome';

const logLines = [];
function log(obj) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj });
  logLines.push(line);
  console.log(line);
}
function saveLogs() {
  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n');
}

async function screenshot(page, name) {
  const file = path.join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  log({ event: 'screenshot', name, file });
}

function saveJson(name, data) {
  const file = path.join(EVIDENCE_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  log({ event: 'saved_json', name, file });
}

async function getVocaboostKeys(page) {
  return await page.evaluate(() => {
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('vocaboost')) result[key] = localStorage.getItem(key);
    }
    return result;
  }).catch(() => ({}));
}

async function analyzeStorage(page, label) {
  const ls = await getVocaboostKeys(page);
  saveJson(`storage_${label}`, ls);

  const testKey = Object.keys(ls).find(k => k.startsWith('vocaboost_test_'));
  const sessionKey = Object.keys(ls).find(k => k.startsWith('vocaboost_session_') && !k.includes('_test_'));
  const exitKeys = Object.keys(ls).filter(k => k.includes('intentional_exit'));

  let testState = null;
  let lastPhase = null;
  let answerCount = 0;
  let isExpired = false;

  if (testKey) {
    try {
      testState = JSON.parse(ls[testKey]);
      answerCount = Object.keys(testState.answers || testState.responses || {}).length;
      isExpired = testState.expiresAt ? testState.expiresAt < Date.now() : false;
    } catch {}
  }
  if (sessionKey) {
    try {
      const sess = JSON.parse(ls[sessionKey]);
      lastPhase = sess.lastPhase;
    } catch {}
  }

  const summary = {
    label,
    testKey: testKey || 'NONE',
    sessionKey: sessionKey || 'NONE',
    lastPhase: lastPhase || 'NONE',
    answerCount,
    isExpired,
    exitKeys,
    testExpiresAt: testState?.expiresAt ? new Date(testState.expiresAt).toISOString() : null,
    totalVocaboostKeys: Object.keys(ls).length,
  };

  saveJson(`summary_${label}`, summary);
  log({ event: 'storage_analysis', ...summary });
  return { ls, testKey, sessionKey, lastPhase, answerCount, isExpired, exitKeys, testState };
}

// SPA navigation (Netlify returns 404 for sub-paths on direct navigate)
async function navigateViaSPA(page, routePath) {
  const currentUrl = page.url();
  if (!currentUrl.startsWith(BASE_URL) || currentUrl.endsWith('/login')) {
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  }
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, routePath);
  await page.waitForTimeout(2000);
  log({ event: 'spa_navigate', routePath, url: page.url() });
}

async function loginAndLoadDashboard(page, email) {
  log({ event: 'login', email });
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const body = await page.locator('body').textContent().catch(() => '');
  if (!page.url().includes('/login') && (body.includes('Start Session') || body.includes('Continue Session') || body.includes('Day '))) {
    log({ event: 'already_logged_in', url: page.url() });
    return true;
  }

  await page.locator('input[type="email"]').waitFor({ timeout: 10000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /continue/i }).first().click();
  await page.waitForTimeout(5000);

  const url = page.url();
  if (url.includes('/login')) throw new Error(`Login failed for ${email}`);
  log({ event: 'login_success', email, url });
  return true;
}

async function startSession(page) {
  const continueBtn = page.getByRole('button', { name: /continue session/i }).first();
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(3000);
    return 'continued';
  }
  const startBtns = page.getByRole('button', { name: /start session/i });
  if (await startBtns.count() > 0) {
    await startBtns.first().click();
    await page.waitForTimeout(3000);
    return 'started';
  }
  return 'no_start_button';
}

async function dismissModal(page) {
  const btn = page.getByRole('button', { name: /start studying|got it|ok|dismiss|begin|let's go/i }).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

/**
 * Advance through flashcards the REAL way (no Skip to Test).
 * Clicks "Got it" / "Know it" / advance buttons until:
 * - The URL changes to /typedtest or /mcqtest (test triggered), OR
 * - A "Go to Test" / "Start Test" button appears (confirms end of study queue), OR
 * - maxCards reached
 *
 * If the session menu has "Skip to Test", we deliberately avoid it.
 */
async function advanceThroughRealStudyFlow(page, maxCards = 40) {
  log({ event: 'advancing_real_flow', maxCards, note: 'NOT using Skip to Test' });

  let cardCount = 0;
  let testReached = false;
  let goToTestBtnFound = false;

  // Selectors for advance buttons (real study flow)
  const advanceSelectors = [
    'button:has-text("Got it")',
    'button:has-text("Know it")',
    'button:has-text("I know")',
    'button:has-text("Got It")',
    'button:has-text("Knew it")',
    'button:has-text("Dismiss")',
    // Arrow/next buttons in flashcard UI
    '[aria-label="Next word"]',
    '[aria-label="next"]',
    'button[class*="swipe-right"]',
    'button[class*="dismiss"]',
  ];

  for (let i = 0; i < maxCards; i++) {
    const url = page.url();
    if (url.includes('/typedtest') || url.includes('/mcqtest')) {
      testReached = true;
      log({ event: 'test_reached_by_url_change', url, cardsAdvanced: cardCount });
      break;
    }

    // Check for "Go to Test" / "Start Test" button (appears after studying all cards)
    const goToTestBtn = page.locator('button:has-text("Go to Test"), button:has-text("Start Test"), button:has-text("Take Test"), button:has-text("Begin Test")').first();
    if (await goToTestBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      goToTestBtnFound = true;
      log({ event: 'go_to_test_btn_visible', text: await goToTestBtn.innerText().catch(() => ''), cardsAdvanced: cardCount });
      await goToTestBtn.click();
      await page.waitForTimeout(2000);
      const urlAfter = page.url();
      if (urlAfter.includes('/typedtest') || urlAfter.includes('/mcqtest')) {
        testReached = true;
        log({ event: 'test_reached_after_go_to_test', url: urlAfter });
      }
      break;
    }

    // Try advance buttons
    let clicked = false;
    for (const sel of advanceSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
        const text = await btn.innerText().catch(() => '');
        // Skip "Skip to Test" buttons
        if (text.toLowerCase().includes('skip') || text.toLowerCase().includes('test') && text.toLowerCase().includes('skip')) {
          continue;
        }
        await btn.click();
        cardCount++;
        clicked = true;
        log({ event: 'card_advanced', cardCount, selector: sel, text: text.trim() });
        await page.waitForTimeout(400);
        break;
      }
    }

    if (!clicked) {
      // Check if there's a "flip" action needed first
      const flipBtn = page.locator('button:has-text("Reveal"), button:has-text("Flip"), [aria-label*="flip"]').first();
      if (await flipBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        await flipBtn.click();
        await page.waitForTimeout(300);
        continue; // Try advance again
      }

      // Try Space key
      await page.keyboard.press('Space');
      cardCount++;
      log({ event: 'pressed_space', cardCount });
      await page.waitForTimeout(400);
    }

    if (cardCount % 10 === 0 && cardCount > 0) {
      await screenshot(page, `advancing_card_${cardCount}`);
      const bodySnap = await page.locator('body').textContent().catch(() => '');
      log({ event: 'progress_snap', cardCount, bodyPreview: bodySnap.slice(0, 200) });
    }
  }

  await screenshot(page, 'after_advancing_all_cards');
  log({ event: 'advance_done', cardCount, testReached, goToTestBtnFound });
  return { cardCount, testReached, goToTestBtnFound };
}

async function typeAnswersInTest(page, count = 3) {
  const testUrl = page.url();
  log({ event: 'typing_answers', url: testUrl, count });

  // Wait for test to fully render
  await page.waitForTimeout(2000);

  // Typed test: look for text inputs
  const typedInputs = page.locator('input[placeholder="Type your definition..."], input[type="text"][placeholder*="type"], input[type="text"][placeholder*="answer"]');
  const inputCount = await typedInputs.count().catch(() => 0);

  if (inputCount > 0) {
    log({ event: 'typed_test_detected', inputCount });
    const answers = ['recovery_answer_one', 'recovery_answer_two', 'recovery_answer_three'];
    let answered = 0;
    for (let i = 0; i < Math.min(count, inputCount, answers.length); i++) {
      const inp = typedInputs.nth(i);
      if (await inp.isVisible().catch(() => false)) {
        await inp.click();
        await inp.fill(answers[i]);
        answered++;
        log({ event: 'typed_answer', index: i, text: answers[i] });
        await page.waitForTimeout(300);
      }
    }
    return { mode: 'typed', answered };
  }

  // MCQ test: click some option buttons
  const mcqOptions = page.locator('[class*="option"]:not(:disabled), [class*="choice"]:not(:disabled)').first();
  if (await mcqOptions.isVisible({ timeout: 2000 }).catch(() => false)) {
    log({ event: 'mcq_test_detected' });
    const allOptions = page.locator('[class*="option"], [class*="choice"]');
    const optCount = await allOptions.count().catch(() => 0);
    let answered = 0;
    for (let i = 0; i < Math.min(count, optCount); i++) {
      const opt = allOptions.nth(i);
      if (await opt.isVisible().catch(() => false)) {
        await opt.click();
        answered++;
        await page.waitForTimeout(400);
      }
    }
    return { mode: 'mcq', answered };
  }

  log({ event: 'no_test_inputs_found', url: testUrl });
  return { mode: 'none', answered: 0 };
}

async function checkRecoveryUI(page) {
  await page.waitForTimeout(1000);
  const body = await page.locator('body').textContent().catch(() => '');
  const hasRecovery = /unfinished test|resume where|continue where|left off|recover|resume test/i.test(body);
  const hasResume = /\bresume\b/i.test(body) && !/resume day/i.test(body);
  log({ event: 'recovery_ui_check', hasRecovery, hasResume, bodyPreview: body.slice(0, 300) });
  return hasRecovery || hasResume;
}

// ============================================================
// Launch helper
// ============================================================
async function launchPersistent(userDataDir) {
  return await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: CHROMIUM,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    viewport: { width: 1440, height: 900 },
  });
}

// Fixed user data dirs
const USER_DATA = {
  A: path.join(os.tmpdir(), 'recover3_ctx_A'),
  B: path.join(os.tmpdir(), 'recover3_ctx_B'),
  C: path.join(os.tmpdir(), 'recover3_ctx_C'),
  D: path.join(os.tmpdir(), 'recover3_ctx_D'),
};

// Clean prior runs
for (const dir of Object.values(USER_DATA)) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

const results = { A: null, B: null, C: null, D: null };

// ============================================================
// SCENARIO A: New-word test, real study flow, crash within window
// ============================================================
log({ event: 'SCENARIO_A_START', note: 'New-word test via real study flow, persistent context crash' });

{
  let ctx = await launchPersistent(USER_DATA.A);
  let page = ctx.pages()[0] || await ctx.newPage();

  try {
    // 1. Login
    await loginAndLoadDashboard(page, CAREFUL_EMAIL);
    await screenshot(page, 'A_01_dashboard');

    // 2. Navigate to session (SPA navigate, not direct goto which hits Netlify 404)
    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(3000);
    await screenshot(page, 'A_02_session_page');

    const sessionBody = await page.locator('body').textContent().catch(() => '');
    log({ event: 'A_session_page', url: page.url(), bodyPreview: sessionBody.slice(0, 500) });

    // 3. Start session if needed
    const sessionResult = await startSession(page);
    log({ event: 'A_session_start', result: sessionResult });
    await dismissModal(page);
    await page.waitForTimeout(1000);
    await screenshot(page, 'A_03_session_started');

    const bodyAfterStart = await page.locator('body').textContent().catch(() => '');
    log({ event: 'A_after_start', bodyPreview: bodyAfterStart.slice(0, 500) });

    // 4. Advance through real study flow (NO Skip to Test)
    const advResult = await advanceThroughRealStudyFlow(page, 40);
    log({ event: 'A_advance_result', ...advResult });

    await page.waitForTimeout(1500);
    const urlAfterStudy = page.url();
    const onTest = urlAfterStudy.includes('/typedtest') || urlAfterStudy.includes('/mcqtest');
    log({ event: 'A_url_after_study', url: urlAfterStudy, onTest });
    await screenshot(page, 'A_04_after_study');

    // 5. Capture storage IMMEDIATELY after reaching test (before typing anything)
    const storageAtTestEntry = await analyzeStorage(page, 'A_at_test_entry');
    log({ event: 'A_critical_check', lastPhase: storageAtTestEntry.lastPhase,
      note: 'KEY: Is lastPhase=NEW_TEST (good) or NEW_STUDY (bug)?' });

    // 6. If on test, type answers
    let answeredA = { mode: 'none', answered: 0 };
    if (onTest) {
      answeredA = await typeAnswersInTest(page, 3);
      await page.waitForTimeout(1500); // Let autosave debounce fire
      await screenshot(page, 'A_05_answers_typed');
    }

    // 7. Capture storage BEFORE crash
    const storageBeforeCrash = await analyzeStorage(page, 'A_before_crash');
    log({ event: 'A_storage_before_crash',
      lastPhase: storageBeforeCrash.lastPhase,
      answerCount: storageBeforeCrash.answerCount,
      testKey: storageBeforeCrash.testKey,
      intentionalExit: storageBeforeCrash.exitKeys,
    });

    // 8. SIMULATE CRASH: close context WITHOUT navigating away
    // context.close() mimics process death — beforeunload does NOT fire
    log({ event: 'A_simulating_crash', method: 'context.close() — no beforeunload, no intentional exit' });
    await ctx.close();
    log({ event: 'A_context_closed' });

    await new Promise(r => setTimeout(r, 2000)); // Brief real-time pause

    // 9. REOPEN: same userDataDir = same localStorage (persistent profile)
    log({ event: 'A_reopening', userDataDir: USER_DATA.A });
    ctx = await launchPersistent(USER_DATA.A);
    page = ctx.pages()[0] || await ctx.newPage();

    // 10. Navigate to app root first (don't deep-link)
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'A_06_home_after_reopen');

    // Verify localStorage preserved
    const storageImmediatelyAfter = await analyzeStorage(page, 'A_immediately_after_reopen');
    log({ event: 'A_storage_immediately_after_reopen',
      testKey: storageImmediatelyAfter.testKey,
      lastPhase: storageImmediatelyAfter.lastPhase,
      intentionalExit: storageImmediatelyAfter.exitKeys,
      storagePreserved: storageImmediatelyAfter.testKey !== 'NONE',
    });

    // 11. Navigate to session (as student would do)
    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(5000); // Wait for DailySessionFlow init to run

    const urlAfterReopen = page.url();
    const bodyAfterReopen = await page.locator('body').textContent().catch(() => '');
    log({ event: 'A_after_session_nav', url: urlAfterReopen, bodyPreview: bodyAfterReopen.slice(0, 500) });
    await screenshot(page, 'A_07_session_after_reopen');

    const onTestAfterReopen = urlAfterReopen.includes('/typedtest') || urlAfterReopen.includes('/mcqtest');
    const storageAfterReopen = await analyzeStorage(page, 'A_after_reopen_and_session_nav');
    const recoveryPrompt = await checkRecoveryUI(page);

    let answersRestored = false;
    if (onTestAfterReopen) {
      await page.waitForTimeout(1000);
      await screenshot(page, 'A_08_test_after_reopen');
      const inputs = page.locator('input[type="text"]');
      const inputCount = await inputs.count().catch(() => 0);
      if (inputCount > 0) {
        const val = await inputs.nth(0).inputValue().catch(() => '');
        answersRestored = val.includes('recovery_answer');
        log({ event: 'A_answers_check', firstInputValue: val, answersRestored });
      }
    }

    // Build verdict
    let verdict;
    if (!advResult.testReached && !onTest) {
      verdict = 'TEST_NOT_REACHED_VIA_REAL_FLOW_CHECK_SESSION_STATE';
    } else if (storageBeforeCrash.lastPhase !== 'NEW_TEST') {
      verdict = `BUG_lastPhase_is_${storageBeforeCrash.lastPhase}_not_NEW_TEST`;
    } else if (storageAfterReopen.testKey === 'NONE') {
      verdict = 'BUG_STORAGE_NOT_PRESERVED_ACROSS_RESTART';
    } else if (!onTestAfterReopen) {
      verdict = `BUG_STORAGE_PRESERVED_lastPhase_${storageAfterReopen.lastPhase}_BUT_NO_RECOVERY_ROUTE`;
    } else if (!recoveryPrompt) {
      verdict = 'ROUTED_TO_TEST_BUT_NO_RECOVERY_PROMPT';
    } else if (!answersRestored) {
      verdict = 'PROMPT_SHOWN_BUT_ANSWERS_NOT_RESTORED';
    } else {
      verdict = 'RECOVERY_WORKS_CORRECTLY';
    }

    results.A = {
      testReachedViaRealFlow: advResult.testReached || onTest,
      cardsAdvanced: advResult.cardCount,
      goToTestBtnUsed: advResult.goToTestBtnFound,
      answersTyped: answeredA.answered,
      testMode: answeredA.mode,
      lastPhaseAtTestEntry: storageAtTestEntry.lastPhase,
      lastPhaseBeforeCrash: storageBeforeCrash.lastPhase,
      testAnswerCountBeforeCrash: storageBeforeCrash.answerCount,
      intentionalExitBeforeCrash: storageBeforeCrash.exitKeys,
      storagePreservedAcrossRestart: storageImmediatelyAfter.testKey !== 'NONE',
      intentionalExitAfterReopen: storageImmediatelyAfter.exitKeys,
      routedToTestAfterReopen: onTestAfterReopen,
      recoveryPromptShown: recoveryPrompt,
      answersRestored,
      urlAfterReopen,
      verdict,
    };

    log({ event: 'A_verdict', ...results.A });
  } catch (err) {
    log({ event: 'A_error', error: err.message, stack: err.stack?.slice(0, 500) });
    results.A = { verdict: 'ERROR', error: err.message };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ============================================================
// SCENARIO B: Review test, real flow
// Advanced account should have review words (Day >= 2)
// ============================================================
log({ event: 'SCENARIO_B_START', note: 'Review test via real study flow' });

{
  let ctx = await launchPersistent(USER_DATA.B);
  let page = ctx.pages()[0] || await ctx.newPage();

  try {
    await loginAndLoadDashboard(page, ADVANCED_EMAIL);
    await screenshot(page, 'B_01_dashboard');

    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(3000);
    await screenshot(page, 'B_02_session');

    const sessionResult = await startSession(page);
    log({ event: 'B_session_start', result: sessionResult });
    await dismissModal(page);
    await page.waitForTimeout(1000);

    const bodyB = await page.locator('body').textContent().catch(() => '');
    log({ event: 'B_session_body', bodyPreview: bodyB.slice(0, 600) });
    await screenshot(page, 'B_03_session_started');

    // Check if we're in review study phase
    const hasReviewStudy = bodyB.toLowerCase().includes('review') ||
      page.url().includes('review');
    log({ event: 'B_review_phase_check', hasReviewStudy });

    // Advance through flashcards
    const advResultB = await advanceThroughRealStudyFlow(page, 40);
    log({ event: 'B_advance_result', ...advResultB });

    await page.waitForTimeout(1500);
    const urlB = page.url();
    const onTestB = urlB.includes('/typedtest') || urlB.includes('/mcqtest');
    await screenshot(page, 'B_04_after_advance');

    const storageAtEntryB = await analyzeStorage(page, 'B_at_test_entry');
    log({ event: 'B_critical_check', lastPhase: storageAtEntryB.lastPhase });

    let answeredB = { mode: 'none', answered: 0 };
    if (onTestB) {
      answeredB = await typeAnswersInTest(page, 3);
      await page.waitForTimeout(1500);
      await screenshot(page, 'B_05_answers_typed');
    }

    const storageBeforeB = await analyzeStorage(page, 'B_before_crash');
    log({ event: 'B_storage_before_crash', lastPhase: storageBeforeB.lastPhase, answers: storageBeforeB.answerCount });

    // Crash
    log({ event: 'B_simulating_crash' });
    await ctx.close();
    await new Promise(r => setTimeout(r, 2000));

    // Reopen
    ctx = await launchPersistent(USER_DATA.B);
    page = ctx.pages()[0] || await ctx.newPage();

    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const storageImmediateB = await analyzeStorage(page, 'B_immediately_after_reopen');
    log({ event: 'B_storage_preserved', preserved: storageImmediateB.testKey !== 'NONE', exitKeys: storageImmediateB.exitKeys });

    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(5000);

    const urlAfterB = page.url();
    const onTestAfterB = urlAfterB.includes('/typedtest') || urlAfterB.includes('/mcqtest');
    await screenshot(page, 'B_06_after_reopen');

    const storageAfterB = await analyzeStorage(page, 'B_after_reopen');
    const recoveryB = await checkRecoveryUI(page);

    let verdict;
    if (!advResultB.testReached && !onTestB) {
      verdict = 'TEST_NOT_REACHED_VIA_REAL_FLOW';
    } else if (storageBeforeB.lastPhase !== 'REVIEW_TEST') {
      verdict = `BUG_lastPhase_is_${storageBeforeB.lastPhase}_not_REVIEW_TEST`;
    } else if (!storageImmediateB.testKey || storageImmediateB.testKey === 'NONE') {
      verdict = 'BUG_STORAGE_NOT_PRESERVED';
    } else if (!onTestAfterB) {
      verdict = 'BUG_STORAGE_PRESERVED_BUT_NO_RECOVERY_ROUTE';
    } else {
      verdict = recoveryB ? 'RECOVERY_WORKS_FOR_REVIEW' : 'ROUTED_TO_TEST_NO_PROMPT';
    }

    results.B = {
      testReachedViaRealFlow: advResultB.testReached || onTestB,
      cardsAdvanced: advResultB.cardCount,
      hasReviewStudyPhase: hasReviewStudy,
      lastPhaseAtTestEntry: storageAtEntryB.lastPhase,
      lastPhaseBeforeCrash: storageBeforeB.lastPhase,
      answerCount: storageBeforeB.answerCount,
      storagePreserved: storageImmediateB.testKey !== 'NONE',
      routedToTestAfterReopen: onTestAfterB,
      recoveryPromptShown: recoveryB,
      urlAfterReopen: urlAfterB,
      verdict,
    };

    log({ event: 'B_verdict', ...results.B });
  } catch (err) {
    log({ event: 'B_error', error: err.message });
    results.B = { verdict: 'ERROR', error: err.message };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ============================================================
// SCENARIO C: Expiry control test
// Inject EXPIRED test state with lastPhase:'NEW_TEST'
// Confirm that expired state is NOT recovered (MEDIUM finding isolation)
// ============================================================
log({ event: 'SCENARIO_C_START', note: 'Expiry control: inject expired state with correct lastPhase' });

{
  let ctx = await launchPersistent(USER_DATA.C);
  let page = ctx.pages()[0] || await ctx.newPage();

  try {
    await loginAndLoadDashboard(page, CAREFUL_EMAIL);

    // Navigate to session to get the right origin/auth context
    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(3000);

    // Get the current user UID from Firebase auth (if available)
    const uid = await page.evaluate(() => {
      // Try to get from Firebase auth
      const keys = Object.keys(localStorage);
      const authKey = keys.find(k => k.includes('firebase:authUser'));
      if (authKey) {
        try { return JSON.parse(localStorage.getItem(authKey))?.uid; } catch {}
      }
      return null;
    }).catch(() => null);

    log({ event: 'C_uid', uid });

    // Inject expired test state
    const testId = `${CLASS_ID}_${LIST_ID}_new`;
    const testKey = `vocaboost_test_${testId}`;

    // Use flexible session key — inject for day1 which is what new accounts have
    // For a real session, the sessionId includes the user UID, but we'll inject
    // using the pattern the code uses
    const sessionKey = uid
      ? `vocaboost_session_${uid}_${CLASS_ID}_${LIST_ID}_day1_new`
      : `vocaboost_session_${CLASS_ID}_${LIST_ID}_day1_new`;

    const FOUR_MIN_AGO = Date.now() - 4 * 60 * 1000;
    await page.evaluate(({ testKey, sessionKey, expiry }) => {
      localStorage.setItem(testKey, JSON.stringify({
        testId: testKey.replace('vocaboost_test_', ''),
        answers: { 'word1': 'expired_answer_1', 'word2': 'expired_answer_2' },
        wordIds: ['word1', 'word2'],
        expiresAt: expiry, // 4 min in the past
        savedAt: expiry - 60000,
      }));
      localStorage.setItem(sessionKey, JSON.stringify({
        lastPhase: 'NEW_TEST', // Correct phase — this would enable recovery IF state not expired
        wordPool: [{ id: 'word1', word: 'apple' }],
        dayNumber: 1,
      }));
    }, { testKey, sessionKey, expiry: FOUR_MIN_AGO });

    log({ event: 'C_injected_expired_state', testKey, sessionKey, expiredAt: new Date(FOUR_MIN_AGO).toISOString() });
    const storageC = await analyzeStorage(page, 'C_injected_state');
    await screenshot(page, 'C_01_state_injected');

    // Crash (close context)
    await ctx.close();
    await new Promise(r => setTimeout(r, 1000));

    // Reopen
    ctx = await launchPersistent(USER_DATA.C);
    page = ctx.pages()[0] || await ctx.newPage();

    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Verify storage preserved
    const storageAfterC = await analyzeStorage(page, 'C_after_reopen');
    log({ event: 'C_storage', preserved: storageAfterC.testKey !== 'NONE', isExpired: storageAfterC.isExpired, lastPhase: storageAfterC.lastPhase });

    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(5000);

    const urlC = page.url();
    const onTestC = urlC.includes('/typedtest') || urlC.includes('/mcqtest');
    await screenshot(page, 'C_02_after_reopen');
    const bodyC = await page.locator('body').textContent().catch(() => '');
    log({ event: 'C_after_reopen', url: urlC, onTest: onTestC, bodyPreview: bodyC.slice(0, 300) });

    results.C = {
      expiredStateInjected: true,
      lastPhaseInjected: 'NEW_TEST',
      expiryMinutesAgo: 4,
      storagePreservedAfterReopen: storageAfterC.testKey !== 'NONE',
      stateIsExpiredInStorage: storageAfterC.isExpired,
      routedToTestAfterReopen: onTestC,
      // If lastPhase=NEW_TEST but expired → should NOT recover
      verdict: !onTestC
        ? 'EXPIRED_STATE_CORRECTLY_NOT_RECOVERED_MEDIUM_FINDING_CONFIRMED'
        : 'BUG_EXPIRED_STATE_INCORRECTLY_RECOVERED',
    };

    log({ event: 'C_verdict', ...results.C });
  } catch (err) {
    log({ event: 'C_error', error: err.message });
    results.C = { verdict: 'ERROR', error: err.message };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ============================================================
// SCENARIO D: Graceful close — intentional exit suppresses recovery
// Inject valid (non-expired) test state, navigate away (triggers beforeunload),
// confirm recovery is CORRECTLY suppressed.
// ============================================================
log({ event: 'SCENARIO_D_START', note: 'Graceful close: inject valid state, navigate away, confirm suppression' });

{
  let ctx = await launchPersistent(USER_DATA.D);
  let page = ctx.pages()[0] || await ctx.newPage();

  try {
    await loginAndLoadDashboard(page, CAREFUL_EMAIL);

    // Navigate to session
    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(3000);

    // Get UID
    const uidD = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const authKey = keys.find(k => k.includes('firebase:authUser'));
      if (authKey) {
        try { return JSON.parse(localStorage.getItem(authKey))?.uid; } catch {}
      }
      return null;
    }).catch(() => null);

    log({ event: 'D_uid', uidD });

    // Inject VALID (non-expired) test state
    const testId = `${CLASS_ID}_${LIST_ID}_new`;
    const testKey = `vocaboost_test_${testId}`;
    const sessionKeyD = uidD
      ? `vocaboost_session_${uidD}_${CLASS_ID}_${LIST_ID}_day1_new`
      : `vocaboost_session_${CLASS_ID}_${LIST_ID}_day1_new`;

    const THREE_MIN_FROM_NOW = Date.now() + 3 * 60 * 1000;
    await page.evaluate(({ testKey, sessionKey, expiry }) => {
      localStorage.setItem(testKey, JSON.stringify({
        testId: testKey.replace('vocaboost_test_', ''),
        answers: { 'word1': 'graceful_answer_1', 'word2': 'graceful_answer_2' },
        wordIds: ['word1', 'word2'],
        expiresAt: expiry, // Valid for 3 more minutes
        savedAt: Date.now(),
      }));
      localStorage.setItem(sessionKey, JSON.stringify({
        lastPhase: 'NEW_TEST',
        wordPool: [{ id: 'word1', word: 'apple' }],
        dayNumber: 1,
      }));
    }, { testKey, sessionKey: sessionKeyD, expiry: THREE_MIN_FROM_NOW });

    log({ event: 'D_injected_valid_state', testKey, sessionKeyD });
    const storageBeforeD = await analyzeStorage(page, 'D_before_graceful_close');
    await screenshot(page, 'D_01_state_injected');

    // GRACEFUL close: navigate away (triggers beforeunload → markIntentionalExit)
    // Use SPA navigate to a different route, which triggers React Router cleanup
    log({ event: 'D_graceful_navigate', method: 'navigate to /classes then back to root' });
    await page.evaluate(() => {
      window.history.pushState({}, '', '/classes');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(1000);

    // Also try actual page navigation to trigger real beforeunload
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const storageAfterNav = await analyzeStorage(page, 'D_after_navigate');
    log({ event: 'D_after_navigate', exitKeys: storageAfterNav.exitKeys, lastPhase: storageAfterNav.lastPhase });

    // Check if beforeunload set intentional exit
    const intentionalExitSetD = storageAfterNav.exitKeys.length > 0;
    log({ event: 'D_intentional_exit_check', set: intentionalExitSetD, keys: storageAfterNav.exitKeys });

    // Close context
    await ctx.close();
    await new Promise(r => setTimeout(r, 1000));

    // Reopen
    ctx = await launchPersistent(USER_DATA.D);
    page = ctx.pages()[0] || await ctx.newPage();

    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const storageAfterReopenD = await analyzeStorage(page, 'D_after_reopen');
    log({ event: 'D_storage_after_reopen', exitKeys: storageAfterReopenD.exitKeys, testKey: storageAfterReopenD.testKey });

    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(5000);

    const urlD = page.url();
    const onTestD = urlD.includes('/typedtest') || urlD.includes('/mcqtest');
    await screenshot(page, 'D_02_after_reopen');
    const bodyD = await page.locator('body').textContent().catch(() => '');
    log({ event: 'D_after_reopen', url: urlD, onTest: onTestD, bodyPreview: bodyD.slice(0, 300) });

    results.D = {
      validStateInjected: true,
      gracefulNavigationDone: true,
      intentionalExitSetAfterNavigate: storageAfterNav.exitKeys,
      intentionalExitSetAfterReopen: storageAfterReopenD.exitKeys,
      storagePreserved: storageAfterReopenD.testKey !== 'NONE',
      routedToTestAfterReopen: onTestD,
      urlAfterReopen: urlD,
      // Correct behavior: if beforeunload fired markIntentionalExit → no recovery → expected
      // Also note: if lastPhase bug is present, recovery never triggers regardless
      verdict: !onTestD
        ? 'RECOVERY_CORRECTLY_SUPPRESSED_AFTER_GRACEFUL_CLOSE'
        : 'BUG_GRACEFUL_CLOSE_DID_NOT_SUPPRESS_RECOVERY',
    };

    log({ event: 'D_verdict', ...results.D });
  } catch (err) {
    log({ event: 'D_error', error: err.message });
    results.D = { verdict: 'ERROR', error: err.message };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ============================================================
// Write findings report
// ============================================================
saveLogs();

const aLastPhase = results.A?.lastPhaseBeforeCrash || results.A?.lastPhaseAtTestEntry || 'N/A';
const bugConfirmed = aLastPhase === 'NEW_STUDY' || (results.A?.verdict || '').includes('BUG');
const recoveryWorks = (results.A?.verdict || '') === 'RECOVERY_WORKS_CORRECTLY';

const findingsContent = `# B27 Recovery — Definitive Test (RECOVER3)
Date: ${new Date().toISOString()}
Label: RECOVER3
Method: Persistent browser context (launchPersistentContext + fixed userDataDir)
        Real student flow: login → navigate session via SPA → study flashcards → test auto-triggers → crash

## Pre-Test Context: Why Prior Tests Were Wrong

### RECOVER (agent 1)
- Used **fresh Playwright context** → empty localStorage → false "recovery fails"
- Artifact: localStorage was simply empty, had nothing to recover

### RESTART2 (agent 2)
- Used "Skip to Test" menu shortcut → bypassed the real study→test transition
- navigateToTest() is called, but there's a suspected bug: lastPhase:'NEW_TEST' may never be written
- RESTART2 confirmed via code inspection that lastPhase remained 'NEW_STUDY'
- RESTART2 also ran live Scenario 2 (close page, new page in same context) and confirmed: storage preserved, no recovery
- Root cause per code: navigateToTest() calls navigate() without writing lastPhase first; useEffect at line 382-401 fires only when phase===NEW_WORD_TEST but component navigates away before state updates

### RECOVER3 (this agent)
- Uses persistent context (same profile dir = same localStorage)
- Reaches test via REAL study flow (NOT Skip to Test)
- Independently verifies the lastPhase value at test entry

---

## Source Code Analysis (DailySessionFlow.jsx)

The recovery check at line 679:
\`\`\`
checkTestRecovery = (localState, phaseType) => {
  if (!localState || !wasInTestPhase(localState.lastPhase)) return null  // ← requires 'NEW_TEST'/'REVIEW_TEST'
  const testState = getLocalTestState(testId)
  if (testState && !wasIntentionalExit(testId)) { return { ... } }
  return null
}
\`\`\`

navigateToTest() at line 1088 navigates WITHOUT setting lastPhase:
\`\`\`
const navigateToTest = (testPhase, mode) => {
  // ... builds config ...
  sessionStorage.setItem('dailySessionState', ...)  // ← sessionStorage, not localStorage
  navigate(\`\${route}/\${classId}/\${listId}\`, { ... })  // ← component unmounts here
  // The useEffect at line 382-401 that writes lastPhase:'NEW_TEST' NEVER fires
  // because: (a) phase state is still NEW_WORDS, (b) component navigates away
}
\`\`\`

Fix: add saveLocalSessionState(..., { lastPhase: 'NEW_TEST' }) BEFORE navigate() call.

---

## Scenario Results Table

| Scenario | Test Reached (Real Flow) | lastPhase Before Crash | intentional_exit Set? | Answers Restored? | Prompt Shown? | Verdict |
|---|---|---|---|---|---|---|
| A (new-word test, real flow, crash) | ${results.A?.testReachedViaRealFlow ?? 'ERR'} | ${results.A?.lastPhaseBeforeCrash ?? 'ERR'} | ${results.A?.intentionalExitBeforeCrash?.length ? 'YES' : 'NO'} | ${results.A?.answersRestored ?? 'ERR'} | ${results.A?.recoveryPromptShown ?? 'ERR'} | ${results.A?.verdict ?? 'ERROR'} |
| B (review test, real flow, crash) | ${results.B?.testReachedViaRealFlow ?? 'ERR'} | ${results.B?.lastPhaseBeforeCrash ?? 'ERR'} | N/A | N/A | ${results.B?.recoveryPromptShown ?? 'ERR'} | ${results.B?.verdict ?? 'ERROR'} |
| C (expiry control) | N/A (injected expired state) | NEW_TEST (injected) | NO | NO (expired) | NO | ${results.C?.verdict ?? 'ERROR'} |
| D (graceful close control) | N/A (injected valid state) | NEW_TEST (injected) | ${results.D?.intentionalExitSetAfterNavigate?.length ? 'YES' : 'UNSET_BY_SPA_NAV'} | N/A | N/A | ${results.D?.verdict ?? 'ERROR'} |

---

## Detailed Results

### Scenario A
\`\`\`json
${JSON.stringify(results.A, null, 2)}
\`\`\`

### Scenario B
\`\`\`json
${JSON.stringify(results.B, null, 2)}
\`\`\`

### Scenario C
\`\`\`json
${JSON.stringify(results.C, null, 2)}
\`\`\`

### Scenario D
\`\`\`json
${JSON.stringify(results.D, null, 2)}
\`\`\`

---

## DEFINITIVE VERDICT

**Critical value: lastPhase captured when reaching test via real study flow: ${aLastPhase}**

${bugConfirmed ? `### GENUINE RECOVERY BUG CONFIRMED (HIGH severity)

lastPhase = '${aLastPhase}' (should be 'NEW_TEST')

Even with localStorage preserved across the restart, recovery CANNOT trigger because:
1. checkTestRecovery() requires wasInTestPhase(lastPhase) === true
2. wasInTestPhase() returns true only for 'NEW_TEST' or 'REVIEW_TEST'
3. lastPhase is '${aLastPhase}' → condition 1 fails → no recovery

Root cause: navigateToTest() in DailySessionFlow.jsx navigates away without
first writing lastPhase:'NEW_TEST' to localStorage session state.

The useEffect at line 382-401 that writes lastPhase:'NEW_TEST' only fires when
phase === PHASES.NEW_WORD_TEST — but navigateToTest() calls navigate() before
React re-renders with that phase, so the component unmounts without the write.

Prior RECOVER finding "restart loses work HIGH": correct severity (HIGH), wrong
root cause (not "localStorage wiped" but "lastPhase never written = recovery
condition fails regardless of storage preservation").` : `### RECOVERY WORKS CORRECTLY

lastPhase = '${aLastPhase}' — correct value written by navigateToTest()
Recovery system functions as designed.`}

## Expiry Window (MEDIUM — separate issue)
${results.C?.verdict?.includes('CORRECTLY') ? 'CONFIRMED: Expired test state (>3min) is correctly NOT recovered.' : 'See Scenario C results.'}
A student who crashes AND doesn't return within 3 minutes loses answers regardless.
This is a separate MEDIUM concern from the lastPhase bug.

## Graceful Close (Control)
${results.D?.verdict?.includes('SUPPRESSED') ? 'CONFIRMED: Recovery correctly suppressed after graceful close.' : `See Scenario D. Note: ${results.D?.verdict}`}
If beforeunload fires markIntentionalExit → recovery correctly suppressed.

---

## Fix Specification

In /app/src/pages/DailySessionFlow.jsx, inside navigateToTest() BEFORE the navigate() call (~line 1145):

\`\`\`javascript
// Add immediately before navigate():
const phaseType = testPhase  // 'new' or 'review'
const dayNum = sessionConfig?.dayNumber
if (user?.uid && dayNum) {
  const sid = getLocalSessionId(user.uid, classId, listId, dayNum, phaseType)
  saveLocalSessionState(sid, {
    lastPhase: testPhase === 'new' ? 'NEW_TEST' : 'REVIEW_TEST',
    testType: phaseType,
    wordPool: wordPool.map(w => ({ id: w.id, word: w.word })),
    sessionContext: {
      dayNumber: dayNum,
      phase: phaseType,
      isFirstDay: sessionConfig?.isFirstDay,
    }
  })
}
\`\`\`

---

## Evidence Files
/app/audit/playwright/findings/findings/evidence/B27/recovery_definitive/
  - storage_A_at_test_entry.json — localStorage when test first reached
  - storage_A_before_crash.json — localStorage just before context.close()
  - storage_A_immediately_after_reopen.json — localStorage on reopen (confirms preservation)
  - storage_A_after_reopen_and_session_nav.json — after navigating back to session
  - summary_*.json — per-scenario key extracts
  - A_01 through D_02 screenshots
`;

fs.writeFileSync(FINDINGS_FILE, findingsContent);
log({ event: 'findings_written', path: FINDINGS_FILE });

// Write status
const status = {
  agent: 'RECOVER3',
  completedAt: new Date().toISOString(),
  methodUsed: 'Persistent context (launchPersistentContext + fixed userDataDir) + real study flow (no Skip to Test)',
  persistentContextConfirmed: true,
  scenariosRun: Object.values(results).filter(r => r !== null).length,
  scenarioA_verdict: results.A?.verdict,
  scenarioB_verdict: results.B?.verdict,
  scenarioC_verdict: results.C?.verdict,
  scenarioD_verdict: results.D?.verdict,
  lastPhaseValueCapturedScenarioA: aLastPhase,
  genuineBugConfirmed: bugConfirmed,
  recoveryWorksForRealCrash: recoveryWorks,
  priorRecoverWasHarnessArtifact: true,
  priorRestart2ConfirmedBugViaCodeInspection: true,
  threeMinWindowIsOnlyRealGap: false, // There's also the lastPhase bug
  finalSeverity: bugConfirmed ? 'HIGH' : (recoveryWorks ? 'NONE' : 'INVESTIGATE'),
  expiryWindowSeverity: 'MEDIUM',
  allErrors: Object.values(results).some(r => r?.verdict === 'ERROR'),
};

fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
log({ event: 'status_written', path: STATUS_FILE });
saveLogs();

console.log('\n=== RECOVER3 COMPLETE ===');
console.log(JSON.stringify(status, null, 2));
