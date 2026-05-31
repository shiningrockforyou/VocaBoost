/**
 * RECOVER3 Scenario A Only — Final Fix
 *
 * After 80 cards, modal "Ready for the Test?" appears with "Start Test" button.
 * The auto-confirm fires after 200ms (sim.speed.cardDelay default).
 * Need to click "Start Test" on the modal, then capture lastPhase.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EVIDENCE_DIR = path.join(__dirname, 'findings', 'evidence', 'B27', 'recovery_definitive');
const LOGS_DIR = path.join(__dirname, 'findings', 'agent_logs');
const LOG_FILE = path.join(LOGS_DIR, 'RECOVER3.jsonl');
const STATUS_FILE = path.join(LOGS_DIR, 'RECOVER3.status.json');

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
fs.mkdirSync(LOGS_DIR, { recursive: true });

const BASE_URL = 'https://vocaboostone.netlify.app';
const ADVANCED_EMAIL = 'audit_advanced_01_top@vocaboost.test';
const PASSWORD = 'AuditPass2026!';
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID = '8RMews2H7C3UJUAsOBzR';
const CHROMIUM = '/ms-playwright/chromium-1223/chrome-linux64/chrome';

// Read existing logs and append
const existingLogs = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
const logLines = existingLogs ? existingLogs.trim().split('\n') : [];

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
  log({ event: 'screenshot', name });
}

function saveJson(name, data) {
  const file = path.join(EVIDENCE_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function getVocaboostKeys(page) {
  return await page.evaluate(() => {
    const r = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('vocaboost')) r[k] = localStorage.getItem(k);
    }
    return r;
  }).catch(() => ({}));
}

async function analyzeStorage(page, label) {
  const ls = await getVocaboostKeys(page);
  saveJson(`storage_${label}`, ls);

  const testKey = Object.keys(ls).find(k => k.startsWith('vocaboost_test_'));
  const sessionKeys = Object.keys(ls).filter(k => k.startsWith('vocaboost_session_'));
  const exitKeys = Object.keys(ls).filter(k => k.includes('intentional_exit'));

  let lastPhase = null;
  let answerCount = 0;
  let isExpired = false;

  for (const sk of sessionKeys) {
    try {
      const parsed = JSON.parse(ls[sk]);
      if (parsed.lastPhase) lastPhase = parsed.lastPhase;
    } catch {}
  }

  if (testKey) {
    try {
      const ts = JSON.parse(ls[testKey]);
      answerCount = Object.keys(ts.answers || ts.responses || {}).length;
      isExpired = ts.expiresAt ? ts.expiresAt < Date.now() : false;
    } catch {}
  }

  const summary = { label, testKey: testKey || 'NONE', sessionKeys, lastPhase, answerCount, isExpired, exitKeys };
  saveJson(`summary_${label}`, summary);
  log({ event: 'storage_analysis', ...summary });
  return { ls, testKey, sessionKeys, lastPhase, answerCount, isExpired, exitKeys };
}

async function navigateViaSPA(page, routePath) {
  const url = page.url();
  if (!url.startsWith(BASE_URL) || url.includes('/login')) {
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
  }
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, routePath);
  await page.waitForTimeout(2500);
  log({ event: 'spa_navigate', routePath, url: page.url() });
}

async function loginAndLoadDashboard(page, email) {
  log({ event: 'login', email });
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  const body = await page.locator('body').textContent().catch(() => '');
  if (!page.url().includes('/login') && !body.includes('Sign in')) {
    log({ event: 'already_on_app', url: page.url() });
    return true;
  }

  await page.locator('input[type="email"]').waitFor({ timeout: 15000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /continue/i }).first().click();
  await page.waitForTimeout(5000);

  if (page.url().includes('/login')) throw new Error(`Login failed for ${email}`);
  log({ event: 'login_success', url: page.url() });
  return true;
}

async function launchPersistent(userDataDir) {
  return await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    executablePath: CHROMIUM,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    viewport: { width: 1440, height: 900 },
  });
}

const USER_DATA_A = path.join(os.tmpdir(), 'recover3_scenario_A_v2');
if (fs.existsSync(USER_DATA_A)) fs.rmSync(USER_DATA_A, { recursive: true, force: true });
fs.mkdirSync(USER_DATA_A, { recursive: true });

log({ event: 'SCENARIO_A_V2_START', note: 'Fixed: handle test-confirm modal after 80 cards' });

let resultA = { verdict: 'NOT_RUN' };

{
  let ctx = await launchPersistent(USER_DATA_A);
  let page = ctx.pages()[0] || await ctx.newPage();

  try {
    await loginAndLoadDashboard(page, ADVANCED_EMAIL);
    await screenshot(page, 'Av2_01_dashboard');

    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(3000);
    await screenshot(page, 'Av2_02_session');

    const bodyInit = await page.locator('body').textContent().catch(() => '');
    log({ event: 'Av2_session', url: page.url(), preview: bodyInit.slice(0, 400) });

    // Dismiss opening modal if any
    const modalDismiss = page.getByRole('button', { name: /start studying|got it|ok|dismiss|begin/i }).first();
    if (await modalDismiss.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modalDismiss.click();
      await page.waitForTimeout(500);
      log({ event: 'Av2_modal_dismissed' });
    }

    // Advance through all cards using "I know this word" button
    log({ event: 'Av2_advance_start', note: '80 cards expected' });
    let cardCount = 0;
    let testReached = false;
    let confirmModalSeen = false;
    let startTestClicked = false;

    for (let i = 0; i < 100; i++) {
      const url = page.url();
      if (url.includes('/typedtest') || url.includes('/mcqtest')) {
        testReached = true;
        log({ event: 'Av2_test_reached', url, cardCount });
        break;
      }

      // Check for the test-confirm modal ("Ready for the Test?")
      // Modal has "Start Test" confirm button
      const startTestInModal = page.getByRole('button', { name: /start test/i }).first();
      if (await startTestInModal.isVisible({ timeout: 300 }).catch(() => false)) {
        confirmModalSeen = true;
        log({ event: 'Av2_confirm_modal_appeared', cardCount });
        await screenshot(page, `Av2_confirm_modal`);

        // Wait for auto-confirm (200ms delay) OR click manually
        // The auto-confirm will call goToNewWordTest() after the delay
        // Let's wait for it since the delay is 200ms
        await page.waitForTimeout(500); // Wait past the auto-confirm delay

        // If still visible, click it manually
        if (await startTestInModal.isVisible({ timeout: 500 }).catch(() => false)) {
          await startTestInModal.click({ force: true });
          startTestClicked = true;
          log({ event: 'Av2_start_test_clicked_manually' });
        } else {
          log({ event: 'Av2_auto_confirm_fired' });
        }

        await page.waitForTimeout(3000);
        const urlAfterConfirm = page.url();
        log({ event: 'Av2_url_after_confirm', url: urlAfterConfirm });
        if (urlAfterConfirm.includes('/typedtest') || urlAfterConfirm.includes('/mcqtest')) {
          testReached = true;
        }
        break;
      }

      // "Take Test" button (shown when all cards done — fallback)
      const takeTest = page.getByRole('button', { name: /take test/i }).first();
      if (await takeTest.isVisible({ timeout: 300 }).catch(() => false)) {
        log({ event: 'Av2_take_test_visible', cardCount });
        // Click with force to bypass any overlay
        await takeTest.click({ force: true });
        await page.waitForTimeout(2000);
        const urlPost = page.url();
        if (urlPost.includes('/typedtest') || urlPost.includes('/mcqtest')) {
          testReached = true;
          log({ event: 'Av2_test_reached_via_take_test', url: urlPost });
        } else {
          // Modal may have appeared
          log({ event: 'Av2_after_take_test_force_click', url: urlPost });
        }
        break;
      }

      // Advance: "I know this word" button
      const knowBtn = page.locator('[aria-label="I know this word (C)"]').first();
      if (await knowBtn.isVisible({ timeout: 200 }).catch(() => false)) {
        await knowBtn.click();
        cardCount++;
        if (cardCount % 20 === 0) {
          log({ event: 'Av2_progress', cardCount });
          await screenshot(page, `Av2_cards_${cardCount}`);
        }
        await page.waitForTimeout(150);
        continue;
      }

      // Next card button
      const nextBtn = page.locator('[aria-label="Next card"]').first();
      if (await nextBtn.isVisible({ timeout: 200 }).catch(() => false)) {
        await nextBtn.click();
        cardCount++;
        await page.waitForTimeout(150);
        continue;
      }

      // Keyboard: 'c' for "know this"
      await page.keyboard.press('c');
      cardCount++;
      await page.waitForTimeout(150);

      if (cardCount % 20 === 0) {
        const snap = await page.locator('body').textContent().catch(() => '');
        log({ event: 'Av2_keyboard_progress', cardCount, preview: snap.slice(0, 200) });
      }
    }

    await screenshot(page, 'Av2_04_after_advance');
    log({ event: 'Av2_advance_complete', cardCount, testReached, confirmModalSeen, startTestClicked });

    // Wait for test to fully load if reached
    if (testReached) await page.waitForTimeout(2000);

    const urlNow = page.url();
    const onTest = urlNow.includes('/typedtest') || urlNow.includes('/mcqtest');
    log({ event: 'Av2_current_state', url: urlNow, onTest });

    // CAPTURE STORAGE AT TEST ENTRY — THE CRITICAL CHECK
    await page.waitForTimeout(1000);
    const storageAtEntry = await analyzeStorage(page, 'Av2_at_test_entry');
    log({ event: 'Av2_CRITICAL_lastPhase_at_entry',
      lastPhase: storageAtEntry.lastPhase,
      question: 'Is lastPhase=NEW_TEST (correct, recovery works) or NEW_STUDY (bug, recovery fails)?',
    });

    // Type answers if on test
    let answeredA = 0;
    if (onTest) {
      await screenshot(page, 'Av2_05_test_page');
      const inputs = page.locator('input[placeholder="Type your definition..."]');
      const ic = await inputs.count().catch(() => 0);
      log({ event: 'Av2_test_inputs', ic });
      for (let i = 0; i < Math.min(3, ic); i++) {
        const inp = inputs.nth(i);
        if (await inp.isVisible().catch(() => false)) {
          await inp.click();
          await inp.fill(`recovery_ans_${i + 1}`);
          answeredA++;
          await page.waitForTimeout(300);
        }
      }
      if (answeredA > 0) await page.waitForTimeout(1500); // autosave debounce
      await screenshot(page, 'Av2_06_answers');
      log({ event: 'Av2_answered', answeredA });
    }

    // CAPTURE BEFORE CRASH
    const storageBeforeCrash = await analyzeStorage(page, 'Av2_before_crash');
    log({ event: 'Av2_BEFORE_CRASH',
      lastPhase: storageBeforeCrash.lastPhase,
      testKey: storageBeforeCrash.testKey,
      answerCount: storageBeforeCrash.answerCount,
      exitKeys: storageBeforeCrash.exitKeys,
      VERDICT: storageBeforeCrash.lastPhase === 'NEW_TEST'
        ? 'CORRECT — recovery should trigger'
        : `BUG — lastPhase=${storageBeforeCrash.lastPhase} means recovery will NOT trigger`,
    });

    // SIMULATE CRASH
    log({ event: 'Av2_CRASH', method: 'ctx.close() without navigate' });
    await ctx.close();
    await new Promise(r => setTimeout(r, 2000));

    // REOPEN
    log({ event: 'Av2_REOPEN', userDataDir: USER_DATA_A });
    ctx = await launchPersistent(USER_DATA_A);
    page = ctx.pages()[0] || await ctx.newPage();

    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, 'Av2_07_home_after_reopen');

    const storageImmediate = await analyzeStorage(page, 'Av2_immediately_after_reopen');
    log({ event: 'Av2_storage_immediate',
      testKeyPreserved: storageImmediate.testKey !== 'NONE',
      lastPhase: storageImmediate.lastPhase,
      exitKeys: storageImmediate.exitKeys,
    });

    await navigateViaSPA(page, `/session/${CLASS_ID}/${LIST_ID}`);
    await page.waitForTimeout(5000);

    const urlReopen = page.url();
    const onTestReopen = urlReopen.includes('/typedtest') || urlReopen.includes('/mcqtest');
    const bodyReopen = await page.locator('body').textContent().catch(() => '');
    log({ event: 'Av2_AFTER_REOPEN', url: urlReopen, onTest: onTestReopen, preview: bodyReopen.slice(0, 500) });
    await screenshot(page, 'Av2_08_session_after_reopen');

    const storageAfterReopen = await analyzeStorage(page, 'Av2_after_reopen');
    const recoveryText = /unfinished test|resume where|left off|recover/i.test(bodyReopen);
    const resumeBtn = await page.locator('button:has-text("Resume")').first().isVisible({ timeout: 2000 }).catch(() => false);
    const recoveryPrompt = recoveryText || resumeBtn;

    let answersRestored = false;
    if (onTestReopen) {
      await screenshot(page, 'Av2_09_test_after_reopen');
      const inp = page.locator('input[placeholder="Type your definition..."]').nth(0);
      const val = await inp.inputValue().catch(() => '');
      answersRestored = val.includes('recovery_ans');
      log({ event: 'Av2_answers_check', firstInputValue: val, restored: answersRestored });
    }

    // VERDICT
    let verdict;
    if (!onTest && !testReached) {
      verdict = 'TEST_NOT_REACHED';
    } else if (storageBeforeCrash.lastPhase === 'NEW_TEST') {
      if (storageImmediate.testKey === 'NONE') verdict = 'BUG_STORAGE_NOT_PRESERVED';
      else if (storageImmediate.exitKeys.length > 0) verdict = 'BUG_INTENTIONAL_EXIT_ON_CRASH';
      else if (!onTestReopen) verdict = 'BUG_lastPhase_CORRECT_BUT_NO_RECOVERY_ROUTE';
      else if (!recoveryPrompt && !answersRestored) verdict = 'ROUTED_TO_TEST_NO_PROMPT_NO_ANSWERS';
      else verdict = 'RECOVERY_WORKS';
    } else {
      verdict = `BUG_lastPhase_is_${storageBeforeCrash.lastPhase}_not_NEW_TEST`;
    }

    resultA = {
      testReachedViaRealFlow: onTest || testReached,
      cardsAdvancedViaUI: cardCount,
      confirmModalSeen,
      startTestClicked,
      answersTyped: answeredA,
      lastPhaseAtTestEntry: storageAtEntry.lastPhase,
      lastPhaseBeforeCrash: storageBeforeCrash.lastPhase,
      answerCountBeforeCrash: storageBeforeCrash.answerCount,
      testKeyBeforeCrash: storageBeforeCrash.testKey,
      intentionalExitBeforeCrash: storageBeforeCrash.exitKeys,
      storagePreservedAcrossRestart: storageImmediate.testKey !== 'NONE',
      intentionalExitAfterReopen: storageImmediate.exitKeys,
      routedToTestAfterReopen: onTestReopen,
      recoveryPromptShown: recoveryPrompt,
      answersRestored,
      urlAfterReopen: urlReopen,
      verdict,
    };

    log({ event: 'Av2_FINAL_VERDICT', ...resultA });
  } catch (err) {
    log({ event: 'Av2_ERROR', error: err.message, stack: err.stack?.slice(0, 300) });
    resultA = { verdict: 'ERROR', error: err.message };
  } finally {
    await ctx.close().catch(() => {});
  }
}

saveLogs();

// Update status file
const existingStatus = fs.existsSync(STATUS_FILE) ? JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')) : {};
const updatedStatus = {
  ...existingStatus,
  agent: 'RECOVER3',
  scenarioA_v2_verdict: resultA.verdict,
  lastPhaseValueCapturedScenarioA: resultA.lastPhaseBeforeCrash || resultA.lastPhaseAtTestEntry || 'N/A',
  testReachedViaRealFlow: resultA.testReachedViaRealFlow,
  storagePreservedAcrossRestart: resultA.storagePreservedAcrossRestart,
  intentionalExitBeforeCrash: resultA.intentionalExitBeforeCrash,
  intentionalExitAfterReopen: resultA.intentionalExitAfterReopen,
  recoveryWorksForRealCrash: resultA.verdict === 'RECOVERY_WORKS',
  genuineBugConfirmed: (resultA.verdict || '').includes('BUG') && resultA.testReachedViaRealFlow,
  // Update summary
  scenarioA_verdict: resultA.verdict,
  scenarioA_details: resultA,
  updatedAt: new Date().toISOString(),
};

fs.writeFileSync(STATUS_FILE, JSON.stringify(updatedStatus, null, 2));
log({ event: 'status_updated', path: STATUS_FILE });

console.log('\n=== SCENARIO A V2 COMPLETE ===');
console.log('Verdict:', resultA.verdict);
console.log('lastPhase at test entry:', resultA.lastPhaseAtTestEntry);
console.log('lastPhase before crash:', resultA.lastPhaseBeforeCrash);
console.log('Storage preserved:', resultA.storagePreservedAcrossRestart);
console.log('Routed to test after reopen:', resultA.routedToTestAfterReopen);
console.log(JSON.stringify(resultA, null, 2));
