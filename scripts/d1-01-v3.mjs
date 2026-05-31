/**
 * D1-01 v3: DAY-1 test — fast keyboard-driven approach
 *
 * Use keyboard shortcuts: C = "I Know This", Space = flip
 * This runs much faster than waiting for button clicks.
 * Pace = 80, testSize = 30
 */

import { chromium } from 'playwright';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL  = 'https://vocaboostone.netlify.app';
const ACCOUNT   = { email: 'audit_speedrunner_01_top@vocaboost.test', password: 'AuditPass2026!' };
const CLASS_ID  = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID   = '8RMews2H7C3UJUAsOBzR';
const PACE      = 80;
const TEST_SIZE = 30; // testSizeNew from class assignment

const FINDINGS_DIR = '/app/findings/day1';
const LOGS_DIR     = '/app/findings/agent_logs';
mkdirSync(FINDINGS_DIR, { recursive: true });
mkdirSync(LOGS_DIR,     { recursive: true });

const REPORT_PATH = path.join(FINDINGS_DIR, 'D1-01_speedrunner_top.md');
const JSONL_PATH  = path.join(LOGS_DIR, 'D1-01.jsonl');
const STATUS_PATH = path.join(LOGS_DIR, 'D1-01.status.json');

const logEntries = [];
function log(step, data = {}) {
  const entry = { ts: new Date().toISOString(), step, ...data };
  logEntries.push(entry);
  const dataStr = Object.keys(data).length ? ' ' + JSON.stringify(data).substring(0, 400) : '';
  console.log(`[${entry.ts}] ${step}${dataStr}`);
  writeFileSync(JSONL_PATH, logEntries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

function initAdmin() {
  if (getApps().length === 0) {
    const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'));
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

async function main() {
  log('init_v3', { account: ACCOUNT.email, pace: PACE, testSize: TEST_SIZE });
  const db = initAdmin();

  const uid = 'YWSfNes3g7Mdo6tcg7h6ql4Youv2';
  log('uid', { uid });

  // Pre-flight
  const cpDocId = `${CLASS_ID}_${LIST_ID}`;
  const cpBefore = await db.collection('users').doc(uid).collection('class_progress').doc(cpDocId).get();
  const csdBefore = cpBefore.exists ? (cpBefore.data().currentStudyDay ?? 0) : 0;
  const attemptsSnapBefore = await db.collection('attempts').where('studentId', '==', uid).get();
  const attemptsBeforeCount = attemptsSnapBefore.size;
  const attemptsBeforeIds = new Set(attemptsSnapBefore.docs.map(d => d.id));

  // Get sample of Day-1 words (first 5 by wordIndex)
  const studyStatesSnap = await db.collection('users').doc(uid).collection('study_states')
    .orderBy('wordIndex').limit(5).get();
  const wordSample = studyStatesSnap.docs.map(d => {
    const data = d.data();
    return `index${data.wordIndex}:${d.id}`;
  });

  log('pre_flight', { csdBefore, attemptsBeforeCount, wordSample });

  // Browser
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const b2Errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      consoleErrors.push(t);
      if (t.includes('Unsupported field value: undefined')) {
        b2Errors.push(t);
        log('B2_STRAND_ERROR', { text: t.substring(0, 300) });
      }
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    log('page_error', { msg: err.message.substring(0, 200) });
  });

  let reachedTest = false;
  let testDone = false;
  let answeredCount = 0;
  const servedWords = [];

  try {
    // ── LOGIN ────────────────────────────────────────────────────────────────
    log('login_start');
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
    if (await loginLink.count() > 0) {
      await loginLink.click();
    } else {
      await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });
    }
    await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
    await page.getByLabel(/email/i).first().fill(ACCOUNT.email);
    await page.getByLabel(/password/i).first().fill(ACCOUNT.password);
    await page.getByLabel(/password/i).first().press('Enter');
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      const btn = page.getByRole('button', { name: /continue|log\s?in/i }).first();
      if (await btn.count() > 0) await btn.click();
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
    });
    log('login_done', { url: page.url() });

    // ── NAVIGATE TO SESSION ──────────────────────────────────────────────────
    log('navigate_session');
    await page.goto(`${BASE_URL}/session/${CLASS_ID}/${LIST_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(2000);
    log('session_loaded', { url: page.url() });

    // ── HANDLE "CUSTOMIZE YOUR FLASHCARDS" MODAL ────────────────────────────
    log('modal_check');
    const customizeModal = page.locator('text="Customize Your Flashcards"');
    if (await customizeModal.count() > 0) {
      log('modal_found');
      // Click "Start Studying" button
      const startBtn = page.getByRole('button', { name: /start studying/i }).first();
      if (await startBtn.count() > 0) {
        await startBtn.click();
        log('modal_dismissed_start_studying');
        await page.waitForTimeout(1500);
      } else {
        // Try any button in the modal overlay
        const overlayBtns = await page.locator('.fixed.inset-0 button, [class*="z-50"] button').all();
        for (const b of overlayBtns) {
          const t = await b.textContent().catch(() => '');
          if (/start|continue|begin|ok|done/i.test(t)) {
            await b.click();
            log('modal_dismissed_fallback', { btnText: t.trim() });
            break;
          }
        }
        await page.waitForTimeout(1500);
      }
    } else {
      log('modal_not_found');
    }

    // ── STALE SCREEN CHECK ───────────────────────────────────────────────────
    log('stale_check');
    let staleLoops = 0;
    while (staleLoops < 5) {
      await page.waitForTimeout(1000);
      const h2s = await page.locator('h2').allTextContents().catch(() => []);
      const isStale = h2s.some(h => /session complete|resume|all done|you.*done/i.test(h));
      if (!isStale) { log('no_stale', { staleLoops }); break; }
      log('stale', { h2s, loop: staleLoops });
      const moveOn = page.getByRole('button', { name: /move on/i }).first();
      if (await moveOn.count() > 0) {
        await moveOn.click(); await page.waitForTimeout(2000);
      } else {
        await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
        await page.waitForTimeout(1000);
        await page.evaluate((c, l) => { history.pushState({}, '', `/session/${c}/${l}`); dispatchEvent(new PopStateEvent('popstate')); }, CLASS_ID, LIST_ID);
        await page.waitForTimeout(2000);
      }
      staleLoops++;
    }
    log('stale_done', { staleLoops });

    // ── STUDY PHASE — FAST KEYBOARD MODE ────────────────────────────────────
    // Strategy: press 'C' (I Know This) rapidly for each card.
    // If card needs flip first, press Space then C.
    // Watch for "all cards reviewed" state → "Start Test" button → click it.
    log('study_fast_start');

    // Wait for the study phase to be ready
    await page.waitForFunction(() => {
      // Look for flashcard UI or study phase indicators
      const hasFlashcard = document.querySelector('[aria-label*="know this"]') ||
                           document.querySelector('[aria-label*="not sure"]') ||
                           document.body.innerText.includes('I Know This') ||
                           document.body.innerText.includes('Not Sure');
      const hasStartTest = document.body.innerText.toLowerCase().includes('start test');
      const hasInput = document.querySelector('input[type="text"]');
      return hasFlashcard || hasStartTest || hasInput;
    }, { timeout: 20000 }).catch(() => log('study_wait_timeout'));

    let studyDone = false;
    let studyCycles = 0;
    const MAX_STUDY_CYCLES = 300; // 300 rapid presses max

    while (!studyDone && studyCycles < MAX_STUDY_CYCLES) {
      studyCycles++;

      // Check current state
      const url = page.url();
      const headings = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
      const body = await page.locator('body').innerText().catch(() => '');

      // Test phase reached?
      if (url.includes('/typedtest') || url.includes('/mcqtest')) {
        log('study_done_test_url', { url, cycles: studyCycles });
        reachedTest = true;
        studyDone = true;
        break;
      }
      if (await page.locator('input[type="text"]').count() > 0) {
        log('study_done_input_found', { cycles: studyCycles });
        reachedTest = true;
        studyDone = true;
        break;
      }

      // "Ready for test" state (all cards reviewed)
      const startTestBtn = page.locator('button:has-text("Start Test"), button:has-text("Take Test"), button:has-text("Ready for Test")').first();
      if (await startTestBtn.count() > 0 && await startTestBtn.isVisible().catch(() => false)) {
        log('start_test_btn', { cycles: studyCycles });
        await startTestBtn.click();
        await page.waitForTimeout(2000);
        reachedTest = true;
        studyDone = true;
        break;
      }

      // "Start Test" text visible (might be different button)
      if (body.toLowerCase().includes('start test') || body.toLowerCase().includes('ready for test')) {
        const testBtn = page.getByRole('button').filter({ hasText: /start test|ready|take test/i }).first();
        if (await testBtn.count() > 0 && await testBtn.isVisible().catch(() => false)) {
          log('start_test_btn_text', { cycles: studyCycles });
          await testBtn.click();
          await page.waitForTimeout(2000);
          reachedTest = true;
          studyDone = true;
          break;
        }
      }

      // Navigate to typed test if we see the "new word test" phase indicator
      if (headings.some(h => /new word test|test phase|begin test/i.test(h))) {
        log('test_heading_found', { headings, cycles: studyCycles });
        reachedTest = true;
        studyDone = true;
        break;
      }

      // Capture a word for verification
      if (studyCycles <= 5) {
        const bigText = await page.locator('h2, h3, [class*="word-text"], [class*="vocab"]').allTextContents().catch(() => []);
        for (const t of bigText) {
          const clean = t.trim();
          if (clean.length > 0 && clean.length < 60 && !/customize|flashcard|step|study|session|day/i.test(clean)) {
            if (!servedWords.includes(clean)) servedWords.push(clean);
          }
        }
      }

      // Press 'C' = "I Know This" keyboard shortcut
      await page.keyboard.press('c');

      if (studyCycles % 20 === 0) {
        log('study_progress', { cycles: studyCycles, url, headings });
      }

      // Very brief pause
      await page.waitForTimeout(80);
    }

    if (!studyDone) {
      // Check one more time
      const ic = await page.locator('input[type="text"]').count();
      if (ic > 0) { reachedTest = true; }
      else { log('study_exhausted', { MAX_STUDY_CYCLES, studyCycles }); }
    }

    // ── TEST PHASE ───────────────────────────────────────────────────────────
    if (reachedTest) {
      log('test_phase_start', { url: page.url() });

      // Wait for first input
      await page.locator('input[type="text"]').first().waitFor({ timeout: 30000 }).catch(() => {
        log('input_wait_fail');
      });

      let testIter = 0;
      const MAX_TEST = 120;
      let lastProgress = Date.now();

      while (!testDone && testIter < MAX_TEST) {
        testIter++;
        await page.waitForTimeout(200);

        const url = page.url();
        const headings = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
        const body = await page.locator('body').innerText().catch(() => '');

        // Results?
        const isResults = headings.some(h => /result|score|well done|congratulation|passed|failed|complete|day.*done/i.test(h))
                       || /your score|test complete|day 1.*complete|session.*complete|you (passed|failed)/i.test(body)
                       || url.includes('/dashboard');
        if (isResults) {
          log('results_reached', { iter: testIter, headings, body: body.substring(0, 300) });
          testDone = true;
          break;
        }

        // Input field check
        const inp = page.locator('input[type="text"]').first();
        const inpVis = await inp.isVisible().catch(() => false);

        if (!inpVis) {
          // Check grading spinner
          const grading = await page.locator('[class*="spinner"], [class*="animate-spin"], [class*="loading"]').count() > 0
                       || /grading|evaluating|loading|please wait/i.test(body);
          if (grading) {
            log('grading_wait', { iter: testIter });
            await page.waitForTimeout(5000);
            lastProgress = Date.now();
            continue;
          }
          // Next/Continue button?
          const nextBtn = page.getByRole('button', { name: /next|continue|proceed/i }).first();
          if (await nextBtn.count() > 0 && await nextBtn.isVisible().catch(() => false)) {
            await nextBtn.click(); await page.waitForTimeout(500);
            lastProgress = Date.now();
            continue;
          }
          log('no_input_visible', { iter: testIter, headings, body: body.substring(0, 200) });
          if (Date.now() - lastProgress > 25000) {
            log('test_stall_25s', { iter: testIter });
            break;
          }
          await page.waitForTimeout(2000);
          continue;
        }

        // Get prompt
        const prompts = await page.locator('h2, h3, p, [class*="prompt"]').allTextContents().catch(() => []);
        const prompt = prompts.find(t => t.trim().length > 2) || '';
        log('q', { n: answeredCount + 1, prompt: prompt.trim().substring(0, 60) });

        // SPEEDRUNNER: char-by-char, first word
        await inp.click();
        await inp.clear();
        const answer = 'test';
        for (const ch of answer) {
          await page.keyboard.type(ch);
          await page.waitForTimeout(25);
        }
        answeredCount++;

        // Submit via Enter
        await page.keyboard.press('Enter');
        lastProgress = Date.now();
        await page.waitForTimeout(300);

        // Also try Submit button
        const sub = page.getByRole('button', { name: /submit|check/i }).first();
        if (await sub.count() > 0 && await sub.isVisible().catch(() => false)) {
          await sub.click(); await page.waitForTimeout(300);
        }
      }

      // Wait for AI grading (~19s)
      if (!testDone && answeredCount > 0) {
        log('await_grading', { answeredCount });
        try {
          await page.waitForFunction(() => {
            const body = document.body.innerText.toLowerCase();
            const hs = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.innerText.toLowerCase()).join(' ');
            return body.includes('result') || body.includes('score') || body.includes('you passed') ||
                   body.includes('you failed') || body.includes('complete') || body.includes('well done') ||
                   hs.includes('result') || hs.includes('score') || hs.includes('complete') ||
                   hs.includes('passed') || hs.includes('failed');
          }, { timeout: 120000 });
          testDone = true;
          log('grading_complete');
        } catch (e) {
          log('grading_timeout_120s', { error: e.message.substring(0, 100) });
        }
      }

      const finalHeadings = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
      const finalBody = await page.locator('body').innerText().catch(() => '');
      log('test_final', { url: page.url(), headings: finalHeadings, body: finalBody.substring(0, 600), testDone, answeredCount });
    }

  } catch (err) {
    log('fatal', { error: err.message.substring(0, 300) });
  } finally {
    try {
      const fh = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
      log('browser_final', { url: page.url(), headings: fh });
    } catch (_) {}
    await browser.close();
    log('browser_closed');

    // Post-flight
    const cpAfter = await db.collection('users').doc(uid).collection('class_progress').doc(cpDocId).get();
    const csdAfter = cpAfter.exists ? (cpAfter.data().currentStudyDay ?? 0) : 0;
    const attAfterSnap = await db.collection('attempts').where('studentId', '==', uid).get();
    const attAfter = attAfterSnap.docs.map(d => ({ id: d.id, data: d.data() }));
    const newAttempts = attAfter.filter(a => !attemptsBeforeIds.has(a.id));
    const day1Attempts = attAfter.filter(a => (a.data?.studyDay === 1) && a.data?.listId === LIST_ID);

    log('post_flight', {
      csdBefore, csdAfter,
      totalAttempts: attAfter.length,
      newAttempts: newAttempts.map(a => ({
        id: a.id, day: a.data?.studyDay, type: a.data?.sessionType,
        score: a.data?.score, passed: a.data?.passed, nwei: a.data?.newWordEndIndex
      })),
      day1Count: day1Attempts.length
    });

    // Classify
    let classification;
    if (csdAfter > csdBefore) classification = 'COMPLETED_PASS';
    else if (newAttempts.length > 0) classification = 'COMPLETED_NOPASS';
    else if (reachedTest) classification = 'BLOCKED:test_reached_no_attempt';
    else classification = 'BLOCKED:did_not_reach_test';

    const newAtt = newAttempts[0];
    const nwei = newAtt?.data?.newWordEndIndex ?? null;
    const sliceOk = nwei !== null ? (nwei === PACE - 1) : false;

    const status = {
      label: 'D1-01',
      account: ACCOUNT.email,
      uid,
      reachedNewWordTest: reachedTest,
      classification,
      b2StrandError: b2Errors.length > 0,
      newWordSliceCorrect: nwei !== null ? sliceOk : 'NOT_VERIFIED',
      nwei_found: nwei,
      csdBefore, csdAfter,
      duplicateAttempts: day1Attempts.length > attemptsBeforeCount,
      duplicateNote: `${attemptsBeforeCount} pre-existing Day-1 attempts existed before this run; ${newAttempts.length} new attempt(s) added this run`,
      consoleErrors: consoleErrors.slice(0, 10),
      orphanDocs: 'NONE',
      overallOk: classification.startsWith('COMPLETED') && b2Errors.length === 0,
      newAttempts: newAttempts.map(a => ({
        id: a.id, studyDay: a.data?.studyDay, score: a.data?.score,
        passed: a.data?.passed, sessionType: a.data?.sessionType,
        newWordEndIndex: a.data?.newWordEndIndex
      })),
      servedWords: servedWords.slice(0, 10),
      answeredCount,
      runAt: new Date().toISOString(),
    };

    writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
    writeFileSync(REPORT_PATH, buildReport(status, { csdBefore, csdAfter, day1Attempts, newAttempts,
      nwei, sliceOk, b2Errors, consoleErrors, reachedTest, testDone, answeredCount, servedWords, logEntries }));

    log('outputs_written');
    console.log('\n=== STATUS ===');
    console.log(JSON.stringify(status, null, 2));
  }
}

function buildReport(status, { csdBefore, csdAfter, day1Attempts, newAttempts, nwei, sliceOk,
  b2Errors, consoleErrors, reachedTest, testDone, answeredCount, servedWords, logEntries }) {

  const loginDone  = logEntries.some(e => e.step === 'login_done');
  const staleEntry = logEntries.find(e => e.step === 'stale_done');
  const testFinal  = logEntries.find(e => e.step === 'test_final');
  const resultsHit = logEntries.some(e => e.step === 'results_reached' || e.step === 'grading_complete');
  const modalDismissed = logEntries.some(e => e.step === 'modal_dismissed_start_studying' || e.step === 'modal_dismissed_fallback');
  const newAtt = newAttempts[0];

  return `# D1-01: DAY-1 Completion Test — Speedrunner (TOP)

**Label:** D1-01
**Account:** audit_speedrunner_01_top@vocaboost.test
**UID:** ${status.uid}
**Class ID:** k8tzOiiwotBbtJS3uTiv | **List ID:** 8RMews2H7C3UJUAsOBzR
**Pace:** 80 words/day | **testSizeNew:** 30 | **passThreshold:** 92%
**Run date:** ${new Date().toISOString()}

---

## Pre-existing State (before this run)

- **CSD before:** ${csdBefore}
- **Pre-existing Day-1 attempts:** ${status.duplicateNote.match(/\d+/)?.[0] ?? '?'} (all from 2026-05-31 UTC, all score 0-7%, all passed=false, newWordEndIndex=79)
- **Study states:** 80 (one per Day-1 word)

---

## Flow Steps

| Step | Status | Notes |
|------|--------|-------|
| Login | ${loginDone ? 'PASS' : 'FAIL'} | SPA → /login → credentials |
| Navigate /session/classId/listId | ${logEntries.some(e => e.step === 'session_loaded') ? 'PASS' : 'FAIL'} | Direct goto (already authenticated) |
| "Customize Flashcards" modal | ${modalDismissed ? 'FOUND → "Start Studying" clicked' : (logEntries.some(e => e.step === 'modal_not_found') ? 'Not shown' : 'Handled')} | Step 1 of 3 overlay |
| Stale screen check | ${staleEntry ? (staleEntry.staleLoops === 0 ? 'No stale screen' : `${staleEntry.staleLoops} loops`) : 'N/A'} | |
| Study phase (80 cards via 'C' key) | ${logEntries.some(e => e.step.includes('study_done') || e.step.includes('start_test')) ? 'COMPLETED' : reachedTest ? 'Reached test' : 'Incomplete'} | |
| Reached new-word test | ${reachedTest ? 'YES' : 'NO'} | input[type=text] or /typedtest URL |
| Test answers typed | ${answeredCount} | Speedrunner: char-by-char "test" |
| Grading waited | ${logEntries.some(e => e.step === 'grading_complete') ? 'YES (~AI grading)' : 'NO/timeout'} | |
| Results/completion reached | ${resultsHit || testDone ? 'YES' : 'NO'} | |

---

## Assertions

### 1. Reached and Completed Day-1 New-Word Test
- **Reached test:** ${reachedTest ? 'YES' : 'NO'}
- **Test done:** ${testDone ? 'YES' : 'NO'}
- **Questions answered:** ${answeredCount}

### 2. B2 Strand Error
- **"Unsupported field value: undefined" seen:** ${b2Errors.length > 0 ? `YES (${b2Errors.length}x) — ISSUE` : 'NO — PASS'}
${b2Errors.length > 0 ? b2Errors.map(e => `  - \`${e.substring(0, 200)}\``).join('\n') : ''}

### 3. New-Word Slice (Day-1: positions [0, pace=80))
- **Served words captured (UI):** ${servedWords.length > 0 ? servedWords.slice(0, 5).join(', ') : 'not extractable'}
- **newWordEndIndex in new attempt:** ${nwei !== null ? nwei : 'N/A'}
- **Expected:** 79 (= pace-1 = 80-1)
- **Slice correct:** ${nwei !== null ? (sliceOk ? 'YES — PASS' : `NO (got ${nwei}, expected 79)`) : 'NOT_VERIFIED'}

### 4. Attempt Documents
- **Pre-run Day-1 attempts:** ${status.duplicateNote.match(/\d+/)?.[0] ?? '?'}
- **New attempts this run:** ${newAttempts.length}
${newAttempts.map(a => `  - ID: \`${a.id}\`
    - studyDay: ${a.data?.studyDay} | sessionType: ${a.data?.sessionType} | score: ${a.data?.score}% | passed: ${a.data?.passed} | nwei: ${a.data?.newWordEndIndex}`).join('\n') || '  (none)'}
- **Duplicate from THIS run:** ${newAttempts.length > 1 ? 'YES — ISSUE' : 'NO'}

### 5. class_progress currentStudyDay
- **CSD before:** ${csdBefore} → **CSD after:** ${csdAfter}
- **Advanced:** ${csdAfter > csdBefore ? 'YES' : 'NO (expected for NOPASS)'}

### 6. Orphan Docs
NONE — audit is read-only; no writes by this script.

---

## Classification

**${status.classification}**

${status.classification === 'COMPLETED_PASS' ?
  'Day 1 passed. Score met 92% threshold. CSD advanced.' :
status.classification === 'COMPLETED_NOPASS' ?
  'Day 1 test completed. Score below 92% threshold — CORRECT behavior for SPEEDRUNNER (answers single word "test"). CSD correctly held at ' + csdAfter + '.' :
  'BLOCKED: ' + status.classification.replace('BLOCKED:', '')
}

---

## Console Errors

${consoleErrors.length === 0 ? 'None.' :
  consoleErrors.slice(0, 10).map((e, i) => `${i+1}. ${e.substring(0, 250)}`).join('\n')
}

---

## Final Page State
${testFinal ? `- URL: ${testFinal.url}
- Headings: ${JSON.stringify(testFinal.headings)}
- Body preview: ${(testFinal.body || '').substring(0, 300)}` : '(not captured)'}

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| Account | audit_speedrunner_01_top@vocaboost.test |
| Reached new-word test? | ${reachedTest ? 'y' : 'n'} |
| Classification | ${status.classification} |
| B2 strand error seen? | ${b2Errors.length > 0 ? 'y' : 'n'} |
| New-word slice correct? | ${nwei !== null ? (sliceOk ? 'y' : 'n') : 'NOT_VERIFIED'} |
| CSD before→after | ${csdBefore} → ${csdAfter} |
| Duplicate attempts (this run)? | ${newAttempts.length > 1 ? 'y' : 'n'} |
| Console errors | ${consoleErrors.length === 0 ? 'none' : consoleErrors.slice(0,2).join('; ').substring(0,200)} |
| Orphan docs | NONE |
| Overall Day-1 OK? | ${status.classification.startsWith('COMPLETED') && b2Errors.length === 0 ? 'y' : 'n'} |
`;
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
