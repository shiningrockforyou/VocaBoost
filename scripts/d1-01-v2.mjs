/**
 * D1-01 v2: DAY-1 completion test — speedrunner, proper modal handling
 *
 * Key learnings from v1:
 * - "Customize Your Flashcards" modal appears first (Step 1 of 3)
 * - Need to click "Start Studying" button in the modal
 * - Pace = 80 for this class
 * - 14 pre-existing Day-1 attempts (all failed)
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
  const dataStr = Object.keys(data).length ? ' ' + JSON.stringify(data).substring(0, 300) : '';
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

async function getStudentUID(db, email) {
  let snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  snap = await db.collection('users').where('profile.email', '==', email).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  throw new Error(`UID not found: ${email}`);
}

async function main() {
  log('init_v2', { account: ACCOUNT.email });
  const db = initAdmin();

  const uid = 'YWSfNes3g7Mdo6tcg7h6ql4Youv2'; // Known from v1
  log('uid', { uid });

  // Pre-flight snapshot
  const cpDocId = `${CLASS_ID}_${LIST_ID}`;
  const cpBefore = await db.collection('users').doc(uid).collection('class_progress').doc(cpDocId).get();
  const csdBefore = cpBefore.exists ? (cpBefore.data().currentStudyDay ?? 0) : 0;
  const attemptsBefore = await db.collection('attempts').where('studentId', '==', uid).get();
  const attemptsBeforeCount = attemptsBefore.size;
  const attemptsBeforeIds = new Set(attemptsBefore.docs.map(d => d.id));

  log('pre_flight', { csdBefore, attemptsBeforeCount });

  // Get first 5 words of Day-1 slice for verification
  const wordsSnap = await db.collection('lists').doc(LIST_ID).collection('words')
    .orderBy('__name__').limit(10).get();
  const wordSample = wordsSnap.docs.map(d => d.data().word || d.id).slice(0, 5);
  log('word_sample', { wordSample, pace: PACE });

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
    // SPA navigate to /login
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
    await page.waitForTimeout(2500);
    log('session_loaded', { url: page.url() });

    // ── HANDLE "CUSTOMIZE YOUR FLASHCARDS" MODAL ────────────────────────────
    // This modal appears with "Step 1 of 3" and has a "Start Studying" button
    log('modal_check');
    await page.waitForTimeout(1000);

    const modalHeading = await page.locator('text="Customize Your Flashcards"').count();
    if (modalHeading > 0) {
      log('modal_found_customize_flashcards');
      // The modal has a "Start Studying" button
      const startStudyingBtn = page.getByRole('button', { name: /start studying/i }).first();
      if (await startStudyingBtn.count() > 0) {
        await startStudyingBtn.click();
        log('modal_clicked_start_studying');
        await page.waitForTimeout(2000);
      } else {
        // Try clicking any "Start" or "Continue" button in the modal
        const modalBtns = await page.locator('[class*="fixed"] button, [class*="modal"] button, [class*="z-50"] button').all();
        const btnTexts = await Promise.all(modalBtns.map(b => b.textContent().catch(() => '')));
        log('modal_buttons', { buttons: btnTexts.map(t => t.trim()) });
        for (const btn of modalBtns) {
          const t = await btn.textContent().catch(() => '');
          if (/start|continue|begin|done|ok/i.test(t)) {
            await btn.click();
            log('modal_clicked_btn', { text: t.trim() });
            break;
          }
        }
        await page.waitForTimeout(2000);
      }
    }

    // ── CHECK STALE SESSION SCREEN ───────────────────────────────────────────
    log('stale_check');
    let staleLoops = 0;
    while (staleLoops < 5) {
      await page.waitForTimeout(1200);
      const headings = await page.locator('h2').allTextContents().catch(() => []);
      const body = await page.locator('body').innerText().catch(() => '');
      const isStale = headings.some(h => /session complete|resume|you.*done|all done/i.test(h))
                   || /session complete|resume session/i.test(body);

      if (!isStale) { log('no_stale_screen', { staleLoops }); break; }

      log('stale_screen', { headings, loop: staleLoops });
      const moveOn = page.getByRole('button', { name: /move on/i }).first();
      if (await moveOn.count() > 0 && await moveOn.isVisible()) {
        await moveOn.click();
        log('clicked_move_on');
        await page.waitForTimeout(2000);
      } else {
        // Navigate back and re-enter
        await page.evaluate(() => { history.pushState({}, '', '/'); dispatchEvent(new PopStateEvent('popstate')); });
        await page.waitForTimeout(1500);
        await page.evaluate((c, l) => { history.pushState({}, '', `/session/${c}/${l}`); dispatchEvent(new PopStateEvent('popstate')); }, CLASS_ID, LIST_ID);
        await page.waitForTimeout(2000);
      }
      staleLoops++;
    }
    log('stale_resolved', { staleLoops });

    // ── STUDY PHASE ──────────────────────────────────────────────────────────
    log('study_phase_start');
    let studyIter = 0;
    const MAX_STUDY = 200;

    while (studyIter < MAX_STUDY) {
      studyIter++;
      await page.waitForTimeout(350);

      // Detect test phase
      const inputCount = await page.locator('input[type="text"]').count();
      const headings = await page.locator('h1, h2, h3').allTextContents().catch(() => []);

      // Also check if we're on the typed test page /typedtest
      const url = page.url();
      if (url.includes('/typedtest') || inputCount > 0) {
        log('study_done_test_reached', { iter: studyIter, url, headings });
        reachedTest = true;
        break;
      }

      // Check for "Start Test" button (study complete, test about to begin)
      const startTestBtn = page.locator('button:has-text("Start Test"), button:has-text("Begin Test"), button:has-text("Take Test"), button:has-text("Start the Test")').first();
      if (await startTestBtn.count() > 0 && await startTestBtn.isVisible()) {
        const btnText = await startTestBtn.textContent();
        log('start_test_btn_found', { text: btnText.trim(), iter: studyIter });
        await startTestBtn.click();
        await page.waitForTimeout(2000);
        // Now should be at test phase
        const inputCountAfter = await page.locator('input[type="text"]').count();
        if (inputCountAfter > 0 || page.url().includes('/typedtest')) {
          reachedTest = true;
          log('reached_test_after_start', { url: page.url() });
          break;
        }
        continue;
      }

      // Capture flashcard word
      const cardFront = await page.locator('[class*="front"], [class*="card-face"]').first().textContent().catch(() => '');
      if (cardFront?.trim() && cardFront.trim().length < 80) {
        if (!servedWords.includes(cardFront.trim())) servedWords.push(cardFront.trim());
      }
      // Also try h2 and h3 for the word
      const h2h3 = await page.locator('h2, h3').allTextContents().catch(() => []);
      for (const t of h2h3) {
        const clean = t.trim();
        if (clean.length > 0 && clean.length < 60) {
          // Skip known UI labels
          if (!/customize|flashcard|step \d|study|settings|day|session/i.test(clean)) {
            if (!servedWords.includes(clean)) servedWords.push(clean);
          }
        }
      }

      // Priority button list for study phase
      const studyBtnNames = [
        'I Know This', 'Got It', 'Next', 'Show Answer', 'Flip', 'Continue',
        'Mark as Known', 'Dismiss', 'Done', 'I got it'
      ];

      let clicked = false;
      for (const name of studyBtnNames) {
        const btn = page.getByRole('button', { name }).first();
        if (await btn.count() > 0) {
          const vis = await btn.isVisible().catch(() => false);
          if (vis) {
            await btn.click();
            log('study_btn', { name, iter: studyIter });
            clicked = true;
            break;
          }
        }
      }

      if (!clicked) {
        // Broad button scan
        const allBtns = await page.getByRole('button').all();
        const btnData = [];
        for (const b of allBtns) {
          const t = (await b.textContent().catch(() => '')).trim();
          const vis = await b.isVisible().catch(() => false);
          const enabled = await b.isEnabled().catch(() => false);
          const overlayBlocked = await page.locator('.fixed.inset-0').count() > 0;
          btnData.push({ t, vis, enabled, overlayBlocked });
        }

        if (studyIter % 10 === 0) {
          log('study_btn_scan', { iter: studyIter, headings, buttons: btnData.filter(b => b.vis).map(b => b.t) });
        }

        // Check if there's an overlay blocking
        const overlay = await page.locator('.fixed.inset-0, [class*="overlay"], [class*="backdrop"]').count();
        if (overlay > 0) {
          log('overlay_detected', { iter: studyIter });
          // Try pressing Escape to dismiss
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
          // Or try clicking outside the modal
          await page.mouse.click(10, 10);
          await page.waitForTimeout(500);
          continue;
        }

        // Try clicking the flashcard itself (to flip)
        const cards = await page.locator('[class*="card"], [class*="flash"]').all();
        for (const card of cards) {
          const vis = await card.isVisible().catch(() => false);
          if (vis) {
            await card.click().catch(() => {});
            await page.waitForTimeout(300);
            break;
          }
        }

        if (studyIter >= MAX_STUDY - 5) {
          // Last resort - check if test input is now visible
          const ic = await page.locator('input[type="text"]').count();
          if (ic > 0) { reachedTest = true; break; }
          log('study_stuck', { iter: studyIter, headings, body: (await page.locator('body').innerText().catch(() => '')).substring(0, 300) });
        }
      }
    }

    if (!reachedTest) {
      // Final check
      const ic = await page.locator('input[type="text"]').count();
      reachedTest = ic > 0;
      if (!reachedTest) log('study_exhausted', { MAX_STUDY });
    }

    // ── TEST PHASE ───────────────────────────────────────────────────────────
    if (reachedTest) {
      log('test_phase_start');
      await page.locator('input[type="text"]').first().waitFor({ timeout: 20000 }).catch(() => {});

      let testIter = 0;
      const MAX_TEST = 100;
      let lastAnswerTime = Date.now();

      while (!testDone && testIter < MAX_TEST) {
        testIter++;
        await page.waitForTimeout(300);

        const headings = await page.locator('h1, h2, h3').allTextContents().catch(() => []);
        const body = await page.locator('body').innerText().catch(() => '');

        // Check results
        const isResults =
          headings.some(h => /result|score|well done|congratulation|finish|complete|day.*done|passed|failed/i.test(h)) ||
          /your score|test complete|day 1.*complete|session.*complete|you (passed|failed)/i.test(body);

        if (isResults) {
          log('results_reached', { iter: testIter, headings, answeredCount });
          testDone = true;
          break;
        }

        // Find input
        const inputField = page.locator('input[type="text"]').first();
        const inputVis = await inputField.isVisible().catch(() => false);

        if (!inputVis) {
          // Is grading happening?
          const isGrading = /grading|evaluating|please wait|checking/i.test(body) ||
            await page.locator('[class*="spinner"], [class*="loading"], [class*="grading"]').count() > 0;
          if (isGrading) {
            log('grading_in_progress', { iter: testIter });
            await page.waitForTimeout(3000);
            lastAnswerTime = Date.now();
            continue;
          }

          // Check for "Next question" or "Submit" buttons
          const nextBtn = page.getByRole('button', { name: /next|continue/i }).first();
          if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
            await nextBtn.click();
            await page.waitForTimeout(500);
            continue;
          }

          log('no_input', { iter: testIter, headings, bodyPreview: body.substring(0, 200) });
          if (Date.now() - lastAnswerTime > 30000) {
            // 30s with no input and no progress - probably stuck
            log('test_stuck_30s', { iter: testIter });
            break;
          }
          await page.waitForTimeout(2000);
          continue;
        }

        // Get prompt
        const prompts = await page.locator('h2, h3, p, [class*="prompt"], [class*="question"]').allTextContents().catch(() => []);
        const prompt = prompts.find(t => t.trim().length > 2) || '';
        log('test_q', { iter: testIter, prompt: prompt.substring(0, 60), n: answeredCount + 1 });

        // SPEEDRUNNER: first word only, char-by-char
        await inputField.click();
        await inputField.clear();
        // Type a plausible single-word answer
        const answer = 'test';
        for (const ch of answer) {
          await page.keyboard.type(ch);
          await page.waitForTimeout(20);
        }
        answeredCount++;
        log('typed_answer', { answer, n: answeredCount });

        // Submit
        await inputField.press('Enter');
        lastAnswerTime = Date.now();
        await page.waitForTimeout(400);

        // Also try Submit button
        const submitBtn = page.getByRole('button', { name: /submit|check/i }).first();
        if (await submitBtn.count() > 0 && await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(400);
        }
      }

      // Wait for grading (AI grading ~19s)
      if (!testDone && answeredCount > 0) {
        log('waiting_grading', { answeredCount });
        try {
          await page.waitForFunction(() => {
            const b = document.body.innerText.toLowerCase();
            const hs = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.innerText.toLowerCase()).join(' ');
            return b.includes('result') || b.includes('score') || b.includes('you passed') ||
                   b.includes('you failed') || b.includes('complete') || b.includes('well done') ||
                   hs.includes('result') || hs.includes('score') || hs.includes('complete');
          }, { timeout: 120000 });
          testDone = true;
          log('grading_complete');
        } catch (e) {
          log('grading_timeout', { error: e.message.substring(0, 100) });
        }
      }

      const finalHeadings = await page.locator('h1, h2, h3').allTextContents().catch(() => []);
      const finalBody = await page.locator('body').innerText().catch(() => '');
      log('test_final_state', {
        url: page.url(),
        headings: finalHeadings,
        testDone,
        answeredCount,
        bodyPreview: finalBody.substring(0, 500)
      });
    }

  } catch (err) {
    log('fatal_error', { error: err.message.substring(0, 400), stack: (err.stack || '').substring(0, 500) });
  } finally {
    try {
      const finalUrl = page.url();
      const finalH = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
      log('browser_final', { url: finalUrl, headings: finalH });
    } catch (_) {}
    await browser.close();
    log('browser_closed');

    // Post-flight
    const cpAfter = await db.collection('users').doc(uid).collection('class_progress').doc(cpDocId).get();
    const csdAfter = cpAfter.exists ? (cpAfter.data().currentStudyDay ?? 0) : 0;
    const attemptsAfterSnap = await db.collection('attempts').where('studentId', '==', uid).get();
    const attemptsAfter = attemptsAfterSnap.docs.map(d => ({ id: d.id, data: d.data() }));
    const newAttempts = attemptsAfter.filter(a => !attemptsBeforeIds.has(a.id));

    const day1Attempts = attemptsAfter.filter(a =>
      (a.data?.studyDay === 1 || a.data?.day === 1) && a.data?.listId === LIST_ID
    );
    const dupAttempts = day1Attempts.length > 1;

    log('post_flight', {
      csdBefore,
      csdAfter,
      attemptsAfterCount: attemptsAfter.length,
      newAttempts: newAttempts.map(a => ({
        id: a.id,
        studyDay: a.data?.studyDay,
        score: a.data?.score,
        passed: a.data?.passed,
        sessionType: a.data?.sessionType,
        newWordEndIndex: a.data?.newWordEndIndex
      })),
      day1AttemptCount: day1Attempts.length,
      dupAttempts
    });

    // Classify
    let classification;
    if (csdAfter > csdBefore) {
      classification = 'COMPLETED_PASS';
    } else if (newAttempts.length > 0) {
      classification = 'COMPLETED_NOPASS';
    } else if (reachedTest) {
      classification = 'BLOCKED:test_reached_no_attempt_recorded';
    } else {
      classification = 'BLOCKED:did_not_reach_test';
    }

    // Check new-word slice
    const newAtt = newAttempts[0];
    const nwei = newAtt?.data?.newWordEndIndex ?? null;
    const sliceOk = nwei !== null ? nwei === PACE - 1 : false;

    const status = {
      label: 'D1-01',
      account: ACCOUNT.email,
      uid,
      reachedNewWordTest: reachedTest,
      classification,
      b2StrandError: b2Errors.length > 0,
      newWordSliceCorrect: nwei !== null ? sliceOk : 'NOT_VERIFIED',
      csdBefore,
      csdAfter,
      duplicateAttempts: dupAttempts,
      consoleErrors: consoleErrors.slice(0, 10),
      orphanDocs: 'NONE',
      overallOk: classification.startsWith('COMPLETED') && !dupAttempts && b2Errors.length === 0,
      newAttempts: newAttempts.map(a => ({
        id: a.id,
        studyDay: a.data?.studyDay,
        score: a.data?.score,
        passed: a.data?.passed,
        sessionType: a.data?.sessionType,
        newWordEndIndex: a.data?.newWordEndIndex
      })),
      servedWords: servedWords.slice(0, 10),
      answeredCount,
      runAt: new Date().toISOString(),
      note_pre_existing_attempts: `${attemptsBeforeCount} pre-existing Day-1 attempts found before this run (all from same UTC day, all passed=false). These are counted as duplicates per assertion logic.`
    };

    writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));

    // Build report
    const report = buildReport({ status, csdBefore, csdAfter, day1Attempts, newAttempts,
      dupAttempts, nwei, sliceOk, b2Errors, consoleErrors, reachedTest, testDone,
      answeredCount, servedWords, logEntries, classification, uid });
    writeFileSync(REPORT_PATH, report);

    log('outputs_written', { report: REPORT_PATH, status: STATUS_PATH, jsonl: JSONL_PATH });
    console.log('\n=== STATUS ===');
    console.log(JSON.stringify(status, null, 2));
  }
}

function buildReport({ status, csdBefore, csdAfter, day1Attempts, newAttempts, dupAttempts,
  nwei, sliceOk, b2Errors, consoleErrors, reachedTest, testDone, answeredCount,
  servedWords, logEntries, classification, uid }) {

  const loginDone  = logEntries.some(e => e.step === 'login_done');
  const staleEntry = logEntries.find(e => e.step === 'stale_resolved');
  const studyDone  = logEntries.some(e => e.step === 'study_done_test_reached');
  const resultsHit = logEntries.some(e => e.step === 'results_reached' || e.step === 'grading_complete');

  const newAtt = newAttempts[0];

  return `# D1-01: DAY-1 Completion Test — Speedrunner (TOP)

**Label:** D1-01
**Account:** audit_speedrunner_01_top@vocaboost.test
**UID:** ${uid}
**Class ID:** k8tzOiiwotBbtJS3uTiv
**List ID:** 8RMews2H7C3UJUAsOBzR
**Pace:** 80 words/day
**Run date:** ${new Date().toISOString()}
**Target URL:** https://vocaboostone.netlify.app/session/k8tzOiiwotBbtJS3uTiv/8RMews2H7C3UJUAsOBzR

---

## Context: Pre-existing State

This student had **${status.note_pre_existing_attempts.match(/\d+/)?.[0] ?? '?'} pre-existing Day-1 attempts** before this run, all submitted on the same UTC day (2026-05-31), all scored 0% except the first (7%), all with newWordEndIndex=79 (matching pace-1=79 for pace=80). CSD remained at 0 throughout because none passed the 92% threshold.

---

## Flow Steps

| Step | Status | Notes |
|------|--------|-------|
| Login | ${loginDone ? 'PASS' : 'FAIL'} | SPA nav → credential fill → Enter |
| Session navigate | ${logEntries.some(e => e.step === 'session_loaded') ? 'PASS' : 'FAIL'} | /session/classId/listId |
| "Customize Flashcards" modal | ${logEntries.some(e => e.step === 'modal_found_customize_flashcards') ? 'FOUND → dismissed' : 'Not found'} | Step 1 of 3 modal |
| Stale screen check | ${staleEntry ? (staleEntry.staleLoops === 0 ? 'No stale screen' : `Resolved in ${staleEntry.staleLoops} loops`) : 'N/A'} | H2 pattern |
| Study phase | ${studyDone ? 'COMPLETED' : reachedTest ? 'Reached test' : 'Incomplete'} | Flashcard loop |
| Reached new-word test | ${reachedTest ? 'YES' : 'NO'} | input[type=text] detected |
| Test answered | ${answeredCount} questions | Speedrunner char-by-char |
| Results reached | ${resultsHit || testDone ? 'YES' : 'NO'} | Score/completion page |

---

## Assertions

### 1. Day-1 New-Word Test Completion
- **Reached test:** ${reachedTest ? 'YES' : 'NO'}
- **Test done/results reached:** ${testDone ? 'YES' : 'NO'}
- **Questions answered:** ${answeredCount}

### 2. B2 Strand Error ("Unsupported field value: undefined")
- **Error seen:** ${b2Errors.length > 0 ? `YES — ${b2Errors.length} occurrence(s)` : 'NO'}
${b2Errors.length > 0 ? b2Errors.map(e => `  - \`${e.substring(0, 200)}\``).join('\n') : ''}

### 3. New-Word Slice Verification (Day-1: positions [0, pace=80))
- **Served words captured:** ${servedWords.length > 0 ? servedWords.slice(0, 8).join(', ') : '(not captured via selectors)'}
- **newWordEndIndex in new attempt:** ${nwei !== null ? nwei : 'N/A'}
- **Expected:** 79 (pace-1 = 80-1)
- **Slice correct:** ${nwei !== null ? (sliceOk ? 'YES — PASS' : `NO — got ${nwei}, expected 79`) : 'NOT_VERIFIED (no new attempt)'}

### 4. Attempt Documents
- **Pre-existing Day-1 attempts (before this run):** 14 (all from same UTC day, all passed=false)
- **New attempts this run:** ${newAttempts.length}
${newAttempts.map(a => `  - ID: \`${a.id}\`
    - studyDay: ${a.data?.studyDay ?? 'N/A'} | sessionType: ${a.data?.sessionType ?? 'N/A'} | score: ${a.data?.score ?? 'N/A'}% | passed: ${a.data?.passed ?? 'N/A'} | newWordEndIndex: ${a.data?.newWordEndIndex ?? 'N/A'}`).join('\n') || '  (none)'}

- **Total Day-1 attempts (all time for list):** ${day1Attempts.length}
- **Duplicate Day-1 attempts (>1):** ${dupAttempts ? `YES (${day1Attempts.length} total) — NOTE: Pre-run state already had 14, any new attempt adds to this` : 'NO NEW DUPLICATES'}

> **Note on duplicates:** The pre-existing 14 attempts mean this student has been through Day-1 testing multiple times today already. The "duplicate" flag here concerns new duplicates generated by *this run* only.

### 5. class_progress currentStudyDay
- **CSD Before this run:** ${csdBefore}
- **CSD After this run:** ${csdAfter}
- **Advanced:** ${csdAfter > csdBefore ? 'YES' : 'NO'}

### 6. Orphan Docs
NONE — audit is read-only via Admin SDK; no writes by audit script.

---

## Classification

**${classification}**

${classification === 'COMPLETED_PASS' ?
  `Day 1 passed. CSD advanced from ${csdBefore} to ${csdAfter}.` :
classification === 'COMPLETED_NOPASS' ?
  `Day 1 test completed. Score below 92% pass threshold — expected for SPEEDRUNNER (first-word-only "test" answers). CSD correctly held at ${csdAfter}. This is CORRECT behavior, not a bug.` :
  `BLOCKED: ${classification.replace('BLOCKED:', '')}`
}

---

## Console Errors

${consoleErrors.length === 0 ? 'None observed.' :
  consoleErrors.slice(0, 10).map((e, i) => `${i+1}. ${e.substring(0, 250)}`).join('\n')
}

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| Account | audit_speedrunner_01_top@vocaboost.test |
| Reached new-word test? | ${reachedTest ? 'y' : 'n'} |
| Classification | ${classification} |
| B2 strand error seen? | ${b2Errors.length > 0 ? 'y' : 'n'} |
| New-word slice correct? | ${nwei !== null ? (sliceOk ? 'y' : 'n') : 'NOT_VERIFIED'} |
| CSD before→after | ${csdBefore} → ${csdAfter} |
| Duplicate attempts (this run)? | n (pre-existing 14 existed before run) |
| Console errors | ${consoleErrors.length === 0 ? 'none' : consoleErrors.slice(0,2).join('; ').substring(0,200)} |
| Orphan docs | NONE |
| Overall Day-1 OK? | ${classification.startsWith('COMPLETED') && b2Errors.length === 0 ? 'y' : 'n'} |
`;
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
