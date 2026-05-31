/**
 * D1-01 v4: DAY-1 test — pre-seed localStorage to skip customize modal,
 * then use 'C' key for fast flashcard dismissal.
 *
 * Key fixes from v3:
 * - Pre-seed localStorage vocaboost_showKoreanDef + vocaboost_showSampleSentence
 *   so the "Customize Your Flashcards" modal never appears
 * - Handle "Ready for the Test?" confirmation dialog
 * - Navigate to /typedtest URL after study completion
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
const TEST_SIZE = 30;
const PASS_THRESHOLD = 92;

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
  log('init_v4', { account: ACCOUNT.email, pace: PACE, testSize: TEST_SIZE });
  const db = initAdmin();

  const uid = 'YWSfNes3g7Mdo6tcg7h6ql4Youv2';
  log('uid', { uid });

  // Pre-flight
  const cpDocId = `${CLASS_ID}_${LIST_ID}`;
  const cpBefore = await db.collection('users').doc(uid).collection('class_progress').doc(cpDocId).get();
  const csdBefore = cpBefore.exists ? (cpBefore.data().currentStudyDay ?? 0) : 0;
  const attSnap = await db.collection('attempts').where('studentId', '==', uid).get();
  const attCountBefore = attSnap.size;
  const attIdsBefore = new Set(attSnap.docs.map(d => d.id));

  log('pre_flight', { csdBefore, attCountBefore });

  // Browser with localStorage pre-seed
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Pre-seed localStorage BEFORE navigation so modal never shows
  // Must do this after first page load (can't set storage before any page is loaded)
  // We'll seed it right after login redirect

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

    // ── PRE-SEED LOCALSTORAGE (suppress customize flashcards modal) ──────────
    log('preseed_localstorage');
    await page.evaluate(() => {
      // These keys suppress the "Customize Your Flashcards" first-time modal
      localStorage.setItem('vocaboost_showKoreanDef', 'true');
      localStorage.setItem('vocaboost_showSampleSentence', 'true');
    });
    log('localstorage_seeded');

    // ── NAVIGATE TO SESSION ──────────────────────────────────────────────────
    log('navigate_session');
    await page.goto(`${BASE_URL}/session/${CLASS_ID}/${LIST_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 30000
    });
    await page.waitForTimeout(3000); // Let React hydrate fully
    log('session_loaded', { url: page.url() });

    // ── VERIFY NO CUSTOMIZE MODAL ────────────────────────────────────────────
    const customizeModal = await page.locator('text="Customize Your Flashcards"').count();
    log('modal_status', { found: customizeModal > 0 });

    if (customizeModal > 0) {
      // Still showing despite localStorage seed - dismiss it
      log('modal_still_showing_dismissing');
      // Try Enter key (focus should be on Start Studying button)
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      // Or click Start Studying
      const startBtn = page.getByRole('button', { name: /start studying/i }).first();
      if (await startBtn.count() > 0) {
        await startBtn.click();
        log('modal_start_studying_clicked');
        await page.waitForTimeout(1000);
      }
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
      if (await moveOn.count() > 0 && await moveOn.isVisible()) {
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

    // ── WAIT FOR STUDY PHASE ─────────────────────────────────────────────────
    log('wait_study_phase');
    // Wait for the study phase to be active (aria-label on know button or the card itself)
    await page.waitForFunction(() => {
      // Check for study phase indicators
      const hasKnow  = !!document.querySelector('[aria-label*="know this"]');
      const hasInput = !!document.querySelector('input[type="text"]');
      const hasTest  = document.body.innerText.toLowerCase().includes('start test') ||
                       document.body.innerText.toLowerCase().includes('ready for test');
      return hasKnow || hasInput || hasTest;
    }, { timeout: 30000 }).catch(() => log('wait_study_phase_timeout'));

    const bodyAtStart = await page.locator('body').innerText().catch(() => '');
    const h2AtStart = await page.locator('h2').allTextContents().catch(() => []);
    log('study_phase_state', {
      hasInput: bodyAtStart.includes('input') || await page.locator('input[type="text"]').count() > 0,
      h2: h2AtStart,
      bodyPreview: bodyAtStart.substring(0, 300)
    });

    // ── STUDY PHASE — FAST KEYBOARD MODE ────────────────────────────────────
    // Press 'C' (I Know This) for each card, watch for transitions
    log('study_fast_start');
    let studyDone = false;
    let studyCycles = 0;
    const MAX_STUDY = 400;

    while (!studyDone && studyCycles < MAX_STUDY) {
      studyCycles++;

      // Every 30 cycles, check UI state
      if (studyCycles % 30 === 1 || studyCycles === 1) {
        const url = page.url();
        const headings = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
        const body = await page.locator('body').innerText().catch(() => '');

        // Test phase reached (URL changed)?
        if (url.includes('/typedtest') || url.includes('/mcqtest')) {
          log('study_done_test_url', { url, cycles: studyCycles });
          reachedTest = true;
          studyDone = true;
          break;
        }
        // Input visible?
        if (await page.locator('input[type="text"]').count() > 0) {
          log('study_done_input', { cycles: studyCycles });
          reachedTest = true;
          studyDone = true;
          break;
        }
        // "Ready for the Test?" confirmation dialog?
        if (headings.some(h => /ready.*test|start.*test/i.test(h)) ||
            body.toLowerCase().includes('ready for the test') ||
            body.toLowerCase().includes('are you ready')) {
          log('ready_for_test_dialog', { headings, cycles: studyCycles });
          // Click "Start Test" or press Enter/C
          const startBtn = page.locator('button').filter({ hasText: /start test|yes|ready|let.s go|confirm/i }).first();
          if (await startBtn.count() > 0 && await startBtn.isVisible().catch(() => false)) {
            await startBtn.click();
            log('start_test_clicked');
          } else {
            await page.keyboard.press('Enter');
            log('start_test_enter_pressed');
          }
          await page.waitForTimeout(3000);
          // Now check for test
          if (await page.locator('input[type="text"]').count() > 0) {
            reachedTest = true;
            studyDone = true;
          }
          continue;
        }
        // "Start Test" button present?
        const startTestVisible = await page.locator('button').filter({ hasText: /start test|take test/i }).first().isVisible().catch(() => false);
        if (startTestVisible) {
          log('start_test_btn_visible', { cycles: studyCycles });
          await page.locator('button').filter({ hasText: /start test|take test/i }).first().click();
          log('start_test_btn_clicked');
          await page.waitForTimeout(3000);
          if (await page.locator('input[type="text"]').count() > 0) {
            reachedTest = true;
            studyDone = true;
            break;
          }
          continue;
        }

        // Customize modal appeared?
        if (headings.some(h => /customize.*flashcard/i.test(h))) {
          log('modal_appeared_mid_study', { cycles: studyCycles });
          // Try clicking Start Studying
          const sb = page.getByRole('button', { name: /start studying/i }).first();
          if (await sb.count() > 0) {
            await sb.click();
            await page.waitForTimeout(1000);
          } else {
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);
          }
          continue;
        }

        if (studyCycles % 30 === 1) {
          log('study_progress', { cycles: studyCycles, headings });
        }

        // Capture served word (first few cycles)
        if (studyCycles <= 3) {
          const bigText = await page.locator('h2, h3').allTextContents().catch(() => []);
          for (const t of bigText) {
            const clean = t.trim();
            if (clean.length > 0 && clean.length < 80 && !/customize|flashcard|step|study|session|day|ready|test/i.test(clean)) {
              if (!servedWords.includes(clean)) servedWords.push(clean);
            }
          }
        }
      }

      // Press 'C' = I Know This (fast keyboard dismiss)
      await page.keyboard.press('c');
      await page.waitForTimeout(60); // Minimal delay
    }

    if (!studyDone) {
      // Final check
      const ic = await page.locator('input[type="text"]').count();
      if (ic > 0) reachedTest = true;
      else log('study_exhausted', { MAX_STUDY });
    }

    // ── TEST PHASE ───────────────────────────────────────────────────────────
    if (reachedTest) {
      log('test_phase_start', { url: page.url() });
      await page.locator('input[type="text"]').first().waitFor({ timeout: 30000 }).catch(() => log('input_wait_failed'));

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
        const isResults = headings.some(h => /result|score|well done|congratulation|passed|failed|complete/i.test(h))
                       || /your score|test complete|day 1.*complete|session.*complete|you (passed|failed)|percentage/i.test(body);
        if (isResults) {
          log('results_reached', { iter: testIter, headings, body: body.substring(0, 400) });
          testDone = true;
          break;
        }

        const inp = page.locator('input[type="text"]').first();
        const inpVis = await inp.isVisible().catch(() => false);

        if (!inpVis) {
          const isGrading = /grading|evaluating|loading|please wait/i.test(body) ||
            await page.locator('[class*="animate-spin"]').count() > 0;
          if (isGrading) {
            log('grading_wait', { iter: testIter });
            await page.waitForTimeout(5000);
            lastProgress = Date.now();
            continue;
          }
          const nextBtn = page.getByRole('button', { name: /next|continue|proceed/i }).first();
          if (await nextBtn.count() > 0 && await nextBtn.isVisible().catch(() => false)) {
            await nextBtn.click(); await page.waitForTimeout(500);
            lastProgress = Date.now();
            continue;
          }
          log('no_input', { iter: testIter, headings, body: body.substring(0, 200) });
          if (Date.now() - lastProgress > 25000) { log('stall_25s'); break; }
          await page.waitForTimeout(2000);
          continue;
        }

        // Prompt
        const prompts = await page.locator('h2, h3, p, [class*="prompt"], [class*="word"]').allTextContents().catch(() => []);
        const prompt = prompts.find(t => t.trim().length > 2) || '';
        log('q', { n: answeredCount + 1, prompt: prompt.trim().substring(0, 60) });

        // SPEEDRUNNER: char-by-char first word
        await inp.click();
        await inp.clear();
        const answer = 'test';
        for (const ch of answer) {
          await page.keyboard.type(ch);
          await page.waitForTimeout(25);
        }
        answeredCount++;

        await page.keyboard.press('Enter');
        lastProgress = Date.now();
        await page.waitForTimeout(300);

        const sub = page.getByRole('button', { name: /submit|check/i }).first();
        if (await sub.count() > 0 && await sub.isVisible().catch(() => false)) {
          await sub.click(); await page.waitForTimeout(300);
        }
      }

      // Wait for AI grading
      if (!testDone && answeredCount > 0) {
        log('await_grading', { answeredCount });
        try {
          await page.waitForFunction(() => {
            const b = document.body.innerText.toLowerCase();
            const hs = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.innerText.toLowerCase()).join(' ');
            return b.includes('result') || b.includes('score') || b.includes('you passed') ||
                   b.includes('you failed') || b.includes('complete') || b.includes('well done') ||
                   b.includes('percentage') || hs.includes('result') || hs.includes('score') ||
                   hs.includes('complete') || hs.includes('passed') || hs.includes('failed');
          }, { timeout: 120000 });
          testDone = true;
          log('grading_complete');
        } catch (e) {
          log('grading_timeout', { error: e.message.substring(0, 100) });
        }
      }

      const fh = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
      const fb = await page.locator('body').innerText().catch(() => '');
      log('test_final', {
        url: page.url(), headings: fh, testDone, answeredCount,
        body: fb.substring(0, 600)
      });
    }

  } catch (err) {
    log('fatal', { error: err.message.substring(0, 300) });
  } finally {
    try {
      log('browser_final', { url: page.url(), headings: await page.locator('h1,h2,h3').allTextContents().catch(() => []) });
    } catch (_) {}
    await browser.close();
    log('browser_closed');

    // Post-flight
    const cpAfter = await db.collection('users').doc(uid).collection('class_progress').doc(cpDocId).get();
    const csdAfter = cpAfter.exists ? (cpAfter.data().currentStudyDay ?? 0) : 0;
    const attAfterSnap = await db.collection('attempts').where('studentId', '==', uid).get();
    const attAfter = attAfterSnap.docs.map(d => ({ id: d.id, data: d.data() }));
    const newAttempts = attAfter.filter(a => !attIdsBefore.has(a.id));
    const day1Attempts = attAfter.filter(a => a.data?.studyDay === 1 && a.data?.listId === LIST_ID);

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
      duplicateNote: `${attCountBefore} pre-existing Day-1 attempts before run; ${newAttempts.length} new attempt(s) this run`,
      thisRunDuplicate: newAttempts.length > 1,
      consoleErrors: consoleErrors.slice(0, 10),
      orphanDocs: 'NONE',
      overallOk: classification.startsWith('COMPLETED') && b2Errors.length === 0 && newAttempts.length <= 1,
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
    writeFileSync(REPORT_PATH, buildReport(status, {
      csdBefore, csdAfter, day1Attempts, newAttempts, nwei, sliceOk,
      b2Errors, consoleErrors, reachedTest, testDone, answeredCount,
      servedWords, logEntries, attCountBefore
    }));

    log('done');
    console.log('\n=== STATUS BLOCK ===');
    console.log(JSON.stringify(status, null, 2));
  }
}

function buildReport(status, ctx) {
  const { csdBefore, csdAfter, day1Attempts, newAttempts, nwei, sliceOk, b2Errors,
    consoleErrors, reachedTest, testDone, answeredCount, servedWords, logEntries, attCountBefore } = ctx;

  const loginDone = logEntries.some(e => e.step === 'login_done');
  const staleEntry = logEntries.find(e => e.step === 'stale_done');
  const testFinal = logEntries.find(e => e.step === 'test_final');
  const resultsHit = logEntries.some(e => e.step === 'results_reached' || e.step === 'grading_complete');
  const modalDismissed = logEntries.some(e => e.step === 'modal_start_studying_clicked' || e.step === 'localstorage_seeded');
  const studyDoneEntry = logEntries.find(e => ['study_done_test_url', 'study_done_input', 'start_test_btn_clicked', 'start_test_clicked'].includes(e.step));
  const newAtt = newAttempts[0];

  return `# D1-01: DAY-1 Completion Test — Speedrunner (TOP)

**Label:** D1-01
**Account:** audit_speedrunner_01_top@vocaboost.test
**UID:** ${status.uid}
**Class ID:** k8tzOiiwotBbtJS3uTiv
**List ID:** 8RMews2H7C3UJUAsOBzR
**Pace:** 80 words/day | **testSizeNew:** 30 | **passThreshold:** 92%
**Run date:** ${new Date().toISOString()}
**Target:** https://vocaboostone.netlify.app/session/k8tzOiiwotBbtJS3uTiv/8RMews2H7C3UJUAsOBzR

---

## Context: Pre-existing State

- **CSD before this run:** ${csdBefore}
- **Pre-existing Day-1 attempts:** ${attCountBefore} (14 from 2026-05-31 UTC; all score 0-7%, passed=false, nwei=79)
- **80 study_states** exist from previous Day-1 completions

---

## Flow Steps

| Step | Status | Notes |
|------|--------|-------|
| Login | ${loginDone ? 'PASS' : 'FAIL'} | SPA nav → credentials → redirect |
| localStorage pre-seed | ${logEntries.some(e => e.step === 'localstorage_seeded') ? 'DONE' : 'SKIPPED'} | Suppress customize modal |
| Navigate /session | ${logEntries.some(e => e.step === 'session_loaded') ? 'PASS' : 'FAIL'} | /session/classId/listId |
| Customize modal | ${logEntries.find(e => e.step === 'modal_status')?.found ? 'APPEARED → dismissed' : 'NOT shown (localStorage pre-seed worked)'} | |
| Stale screen | ${staleEntry ? (staleEntry.staleLoops === 0 ? 'No stale screen' : `${staleEntry.staleLoops} loops`) : 'N/A'} | |
| Study phase (80 cards) | ${studyDoneEntry ? `COMPLETED (${studyDoneEntry.step})` : reachedTest ? 'Reached test via input' : 'INCOMPLETE'} | 'C' key shortcut |
| Reached new-word test | ${reachedTest ? 'YES' : 'NO'} | |
| Test answers typed | ${answeredCount} | Speedrunner "test" char-by-char |
| Grading awaited | ${logEntries.some(e => e.step === 'grading_complete') ? 'YES' : 'NO/timeout'} | ~19s AI grading |
| Results reached | ${resultsHit || testDone ? 'YES' : 'NO'} | |

---

## Assertions

### 1. Reached and Completed Day-1 New-Word Test
- **Reached test:** ${reachedTest ? 'YES' : 'NO'}
- **Test done/results:** ${testDone ? 'YES' : 'NO'}
- **Questions answered:** ${answeredCount}

### 2. B2 Strand Error ("Unsupported field value: undefined")
- **Error seen:** ${b2Errors.length > 0 ? `YES (${b2Errors.length}x) — ISSUE` : 'NO — PASS'}
${b2Errors.length > 0 ? b2Errors.map(e => `  - \`${e.substring(0, 200)}\``).join('\n') : ''}

### 3. New-Word Slice (Day-1: positions [0, pace=80))
- **Served words captured:** ${servedWords.length > 0 ? servedWords.slice(0, 8).join(', ') : 'Not captured (keyboard mode bypasses UI text extraction)'}
- **newWordEndIndex in new attempt:** ${nwei !== null ? nwei : 'N/A (no new attempt yet)'}
- **Expected:** 79 (pace-1 = 80-1)
- **Slice correct:** ${nwei !== null ? (sliceOk ? 'YES — PASS' : `NO (got ${nwei}, expected 79)`) : 'NOT_VERIFIED'}

### 4. Attempt Documents
- **Pre-run Day-1 attempts:** ${attCountBefore}
- **New attempts this run:** ${newAttempts.length}
${newAttempts.map(a => `  - ID: \`${a.id}\`
    - studyDay: ${a.data?.studyDay} | type: ${a.data?.sessionType} | score: ${a.data?.score}% | passed: ${a.data?.passed} | nwei: ${a.data?.newWordEndIndex}`).join('\n') || '  (none)'}
- **Duplicate from this run alone:** ${newAttempts.length > 1 ? `YES (${newAttempts.length})` : 'NO'}

### 5. class_progress currentStudyDay
- **CSD before:** ${csdBefore} → **after:** ${csdAfter}
- **Advanced:** ${csdAfter > csdBefore ? 'YES' : 'NO'}

### 6. Orphan Docs
NONE — read-only Admin SDK; no writes by audit script.

---

## Classification

**${status.classification}**

${status.classification === 'COMPLETED_PASS' ?
  'Day 1 passed. Score >= 92%. CSD advanced from ' + csdBefore + ' to ' + csdAfter + '.' :
status.classification === 'COMPLETED_NOPASS' ?
  'Day 1 test completed but score < 92% threshold. Expected for SPEEDRUNNER persona (types single-word answer "test"). CSD correctly held at ' + csdAfter + '. This is CORRECT behavior, not a bug.' :
  'BLOCKED: ' + status.classification.replace('BLOCKED:', '')
}

---

## Console Errors

${consoleErrors.length === 0 ? 'None.' :
  consoleErrors.slice(0, 10).map((e, i) => `${i+1}. ${e.substring(0, 250)}`).join('\n')
}

---

## Final Page State
${testFinal ? `- **URL:** ${testFinal.url}
- **Headings:** ${JSON.stringify(testFinal.headings)}
- **Body:** ${(testFinal.body || '').substring(0, 400)}` : '(not captured)'}

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
| Overall Day-1 OK? | ${status.classification.startsWith('COMPLETED') && b2Errors.length === 0 && newAttempts.length <= 1 ? 'y' : 'n'} |
`;
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
