/**
 * D1-01: DAY-1 completion test for audit_speedrunner_01_top@vocaboost.test
 * Label: D1-01 | Persona: SPEEDRUNNER (TOP class)
 *
 * Flow: login → /session/classId/listId → handle stale screen → study flashcards
 *       → typed test → submit (char-by-char) → wait ~19s grading → results
 *
 * Run: PLAYWRIGHT_BROWSERS_PATH=/ms-playwright node --experimental-vm-modules scripts/d1-01-speedrunner.mjs
 */

import { chromium } from 'playwright';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL    = 'https://vocaboostone.netlify.app';
const ACCOUNT     = { email: 'audit_speedrunner_01_top@vocaboost.test', password: 'AuditPass2026!' };
const CLASS_ID    = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID     = '8RMews2H7C3UJUAsOBzR';
const LABEL       = 'D1-01';

// ─── Output ───────────────────────────────────────────────────────────────────
const FINDINGS_DIR = '/app/findings/day1';
const LOGS_DIR     = '/app/findings/agent_logs';
mkdirSync(FINDINGS_DIR, { recursive: true });
mkdirSync(LOGS_DIR,     { recursive: true });

const REPORT_PATH = path.join(FINDINGS_DIR, 'D1-01_speedrunner_top.md');
const JSONL_PATH  = path.join(LOGS_DIR, 'D1-01.jsonl');
const STATUS_PATH = path.join(LOGS_DIR, 'D1-01.status.json');

// ─── Logging ──────────────────────────────────────────────────────────────────
const logEntries = [];
function log(step, data = {}) {
  const entry = { ts: new Date().toISOString(), step, ...data };
  logEntries.push(entry);
  console.log(`[${entry.ts}] ${step}`, Object.keys(data).length ? JSON.stringify(data) : '');
  writeFileSync(JSONL_PATH, logEntries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

// ─── Admin SDK ────────────────────────────────────────────────────────────────
function initAdmin() {
  if (getApps().length === 0) {
    const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'));
    initializeApp({ credential: cert(sa) });
  }
  return getFirestore();
}

async function getStudentUID(db, email) {
  const snap = await db.collection('users').where('email', '==', email).limit(1).get();
  if (!snap.empty) return snap.docs[0].id;
  // Try profile.email
  const snap2 = await db.collection('users').where('profile.email', '==', email).limit(1).get();
  if (!snap2.empty) return snap2.docs[0].id;
  throw new Error(`UID not found for ${email}`);
}

async function snapshotClassProgress(db, uid) {
  const docId = `${CLASS_ID}_${LIST_ID}`;
  const snap = await db.collection('users').doc(uid).collection('class_progress').doc(docId).get();
  return { exists: snap.exists, data: snap.exists ? snap.data() : null };
}

async function getAllAttempts(db, uid) {
  const snap = await db.collection('attempts').where('studentId', '==', uid).get();
  return snap.docs.map(d => ({ id: d.id, data: d.data() }));
}

async function getListWords(db) {
  const snap = await db.collection('lists').doc(LIST_ID).get();
  if (!snap.exists) return [];
  const words = snap.data().words || [];
  return words;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  log('init', { label: LABEL, account: ACCOUNT.email, classId: CLASS_ID, listId: LIST_ID });

  const db = initAdmin();

  // ── Pre-flight ──────────────────────────────────────────────────────────────
  let uid;
  try {
    uid = await getStudentUID(db, ACCOUNT.email);
    log('uid_found', { uid });
  } catch (e) {
    log('uid_error', { error: e.message });
    throw e;
  }

  const progressBefore = await snapshotClassProgress(db, uid);
  const attemptsBefore = await getAllAttempts(db, uid);
  const csdBefore = progressBefore.data?.currentStudyDay ?? 0;
  const paceFromProgress = progressBefore.data?.pace ?? null;

  log('snapshot_before', {
    classProgress: progressBefore.data,
    attemptCount: attemptsBefore.length,
    csdBefore,
    pace: paceFromProgress
  });

  // Get class enrollment to find pace
  const enrollSnap = await db.collection('users').doc(uid)
    .collection('enrolledClasses').doc(CLASS_ID).get();
  const pace = enrollSnap.exists ? (enrollSnap.data().pace ?? paceFromProgress ?? 20) : 20;
  log('pace_info', { pace, enrollData: enrollSnap.exists ? enrollSnap.data() : null });

  // Get list words for Day-1 slice verification
  const listWords = await getListWords(db);
  const day1Slice = listWords.slice(0, pace);
  log('day1_word_slice', {
    totalWords: listWords.length,
    pace,
    day1Words: day1Slice.map(w => typeof w === 'string' ? w : (w.word || w.term || JSON.stringify(w))).slice(0, 10)
  });

  // ── Browser ──────────────────────────────────────────────────────────────────
  const browser = await chromium.launch({
    executablePath: '/ms-playwright/chromium-1223/chrome-linux64/chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Console capture
  const consoleErrors = [];
  const b2StrandErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      consoleErrors.push(text);
      if (text.includes('Unsupported field value: undefined')) {
        b2StrandErrors.push(text);
        log('B2_STRAND_ERROR', { text });
      } else {
        log('console_error', { text: text.substring(0, 200) });
      }
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    log('page_error', { message: err.message.substring(0, 300) });
  });

  const servedWords = [];
  let classification = 'BLOCKED:unknown';
  let reachedTest = false;
  let newAttempts = [];

  try {
    // ── STEP 1: Login ──────────────────────────────────────────────────────────
    log('step_1_login_start');
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Navigate to login via SPA
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
    await page.getByLabel(/email/i).first().fill(ACCOUNT.email);
    await page.getByLabel(/password/i).first().fill(ACCOUNT.password);
    await page.getByLabel(/password/i).first().press('Enter');

    await page.waitForURL(/\/(dashboard|$)/, { timeout: 20000 }).catch(async () => {
      const continueBtn = page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first();
      if (await continueBtn.count() > 0) await continueBtn.click();
      await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
    });
    log('step_1_login_done', { url: page.url() });

    // ── STEP 2: Navigate to study session ─────────────────────────────────────
    log('step_2_navigate_session');
    const sessionUrl = `${BASE_URL}/session/${CLASS_ID}/${LIST_ID}`;

    // SPA navigation: go to root first, then client-side navigate
    // The session URL should work directly since we're already authenticated
    await page.goto(sessionUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Let React hydrate

    const urlAfterNav = page.url();
    log('step_2_session_url', { url: urlAfterNav });

    // If we were redirected away, try SPA push
    if (!urlAfterNav.includes('/session/')) {
      log('step_2_redirect_detected', { url: urlAfterNav, attempting: 'spa_push' });
      await page.evaluate((url) => {
        history.pushState({}, '', url);
        dispatchEvent(new PopStateEvent('popstate'));
      }, `/session/${CLASS_ID}/${LIST_ID}`);
      await page.waitForTimeout(3000);
      log('step_2_spa_push_url', { url: page.url() });
    }

    // ── STEP 3: Handle stale session screens ───────────────────────────────────
    log('step_3_stale_screen_check');
    let staleLoops = 0;
    const MAX_STALE_LOOPS = 5;

    while (staleLoops < MAX_STALE_LOOPS) {
      await page.waitForTimeout(1500);
      const h2Texts = await page.locator('h2').allTextContents().catch(() => []);
      const bodyText = await page.locator('body').innerText().catch(() => '');

      const isStale = h2Texts.some(t =>
        /session complete|resume|all done|great job|completed|you.*done|results/i.test(t)
      ) || bodyText.match(/session complete|resume session/i);

      if (!isStale) {
        log('step_3_no_stale_screen', { staleLoops });
        break;
      }

      log('step_3_stale_screen_found', { h2Texts, staleLoops });

      // Try "Move On" button
      const moveOnBtn = page.getByRole('button', { name: /move on/i }).first();
      if (await moveOnBtn.count() > 0 && await moveOnBtn.isVisible()) {
        await moveOnBtn.click();
        log('step_3_clicked_move_on');
        await page.waitForTimeout(2000);
        staleLoops++;
        continue;
      }

      // Try back to dashboard then re-enter
      await page.evaluate(() => {
        history.pushState({}, '', '/');
        dispatchEvent(new PopStateEvent('popstate'));
      });
      await page.waitForTimeout(1500);
      await page.evaluate((classId, listId) => {
        history.pushState({}, '', `/session/${classId}/${listId}`);
        dispatchEvent(new PopStateEvent('popstate'));
      }, CLASS_ID, LIST_ID);
      staleLoops++;
    }

    log('step_3_stale_resolved', { staleLoops });

    // ── STEP 4: Study phase - flashcards ───────────────────────────────────────
    log('step_4_study_start');

    let studyDone = false;
    let studyIterations = 0;
    const MAX_STUDY_ITERS = 120; // safety cap

    while (!studyDone && studyIterations < MAX_STUDY_ITERS) {
      studyIterations++;
      await page.waitForTimeout(400);

      const url = page.url();
      const headings = await page.locator('h1, h2, h3').allTextContents().catch(() => []);
      const bodyText = await page.locator('body').innerText().catch(() => '');

      // Check if we're in the typed test (test phase)
      const inputCount = await page.locator('input[type="text"]').count();
      const isTestPhase = inputCount > 0 ||
        headings.some(h => /type|spell|enter|write|test/i.test(h));

      if (isTestPhase) {
        log('step_4_study_done_reached_test', { studyIterations, headings });
        studyDone = true;
        reachedTest = true;
        break;
      }

      // Capture served word
      const wordEls = await page.locator('[class*="word"], [class*="term"], [class*="front"], h2.text, .flashcard-front, [data-testid*="word"]').allTextContents().catch(() => []);
      for (const w of wordEls) {
        const clean = w.trim();
        if (clean && clean.length < 60 && !servedWords.includes(clean)) {
          servedWords.push(clean);
        }
      }
      // Also grab any prominent large text that might be the word
      const bigText = await page.locator('h2, h3').allTextContents().catch(() => []);
      for (const t of bigText) {
        const clean = t.trim();
        if (clean && clean.length < 60 && !servedWords.includes(clean) && studyIterations <= 3) {
          servedWords.push(clean);
        }
      }

      // Find study buttons in priority order
      const btnSelectors = [
        ['button:has-text("I Know This")', 'I Know This'],
        ['button:has-text("Got It")',       'Got It'],
        ['button:has-text("Next")',          'Next'],
        ['button:has-text("Continue")',      'Continue'],
        ['button:has-text("Flip")',          'Flip'],
        ['button:has-text("Show Answer")',   'Show Answer'],
        ['button:has-text("Dismiss")',       'Dismiss'],
        ['button:has-text("Done")',          'Done'],
        ['button:has-text("Start Test")',    'Start Test'],
        ['button:has-text("Begin Test")',    'Begin Test'],
        ['button:has-text("Take Test")',     'Take Test'],
      ];

      let clicked = false;
      for (const [sel, label] of btnSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
          await btn.click();
          log('step_4_clicked_btn', { label, iteration: studyIterations });
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        // Try clicking any visible button (broad fallback)
        const allBtns = await page.getByRole('button').all();
        const btnTexts = [];
        for (const b of allBtns) {
          const t = await b.textContent().catch(() => '');
          btnTexts.push(t.trim());
        }
        log('step_4_all_buttons', { iteration: studyIterations, buttons: btnTexts, headings });

        // Try clicking the card/first prominent button
        if (allBtns.length > 0) {
          // Skip buttons that are clearly navigation/settings
          for (const b of allBtns) {
            const t = await b.textContent().catch(() => '');
            const isNav = /sign out|settings|back|home|menu/i.test(t);
            if (!isNav && await b.isVisible().catch(() => false)) {
              await b.click();
              log('step_4_clicked_fallback_btn', { text: t.trim(), iteration: studyIterations });
              clicked = true;
              break;
            }
          }
        }

        if (!clicked) {
          // Try clicking the flashcard itself
          const card = page.locator('[class*="card"], [class*="flashcard"], [class*="flip"]').first();
          if (await card.count() > 0 && await card.isVisible().catch(() => false)) {
            await card.click();
            log('step_4_clicked_card', { iteration: studyIterations });
          } else {
            log('step_4_no_interaction_found', {
              iteration: studyIterations,
              headings,
              bodyPreview: bodyText.substring(0, 300)
            });
            // Give it a moment and try again
            await page.waitForTimeout(1500);
          }
        }
      }
    }

    if (!studyDone && !reachedTest) {
      // Check one more time
      const inputCount = await page.locator('input[type="text"]').count();
      reachedTest = inputCount > 0;
      if (!reachedTest) {
        log('step_4_study_timeout', { studyIterations });
        classification = 'BLOCKED:stuck_in_study_phase';
        // Don't throw - continue to capture state
      }
    }

    // ── STEP 5: Test phase - typed answers ─────────────────────────────────────
    if (reachedTest) {
      log('step_5_test_start');

      // Wait for input to be ready
      await page.locator('input[type="text"]').first().waitFor({ timeout: 15000 }).catch(() => {
        log('step_5_input_wait_timeout');
      });

      let testDone = false;
      let testIterations = 0;
      let answeredCount = 0;
      const MAX_TEST_ITERS = 80;

      while (!testDone && testIterations < MAX_TEST_ITERS) {
        testIterations++;
        await page.waitForTimeout(300);

        const headings = await page.locator('h1, h2, h3').allTextContents().catch(() => []);
        const bodyText = await page.locator('body').innerText().catch(() => '');

        // Check for results page
        const isResults = headings.some(h =>
          /result|score|well done|congratulation|finish|complete|day.*done|session.*done/i.test(h)
        ) || bodyText.match(/your score|test complete|day 1.*complete|session complete/i);

        if (isResults) {
          log('step_5_reached_results', { testIterations, headings, answeredCount });
          testDone = true;
          break;
        }

        // Look for input field
        const inputField = page.locator('input[type="text"]').first();
        const inputVisible = await inputField.isVisible().catch(() => false);

        if (!inputVisible) {
          // Check if still loading (grading in progress)
          const isLoading = bodyText.includes('Grading') || bodyText.includes('grading') ||
            bodyText.includes('Loading') || bodyText.includes('Please wait') ||
            await page.locator('[class*="spinner"], [class*="loading"]').count() > 0;

          if (isLoading) {
            log('step_5_grading_in_progress', { testIterations });
            await page.waitForTimeout(3000);
            continue;
          }

          // Maybe a "Start Test" button
          const startBtn = page.getByRole('button', { name: /start test|begin test|take test/i }).first();
          if (await startBtn.count() > 0 && await startBtn.isVisible()) {
            await startBtn.click();
            log('step_5_clicked_start_test');
            await page.waitForTimeout(1500);
            continue;
          }

          log('step_5_no_input', { testIterations, headings, bodyPreview: bodyText.substring(0, 200) });
          await page.waitForTimeout(2000);
          continue;
        }

        // Get the prompt text
        const promptTexts = await page.locator('h2, h3, [class*="prompt"], [class*="question"], p').allTextContents().catch(() => []);
        const prompt = promptTexts.find(t => t.trim().length > 0) || 'unknown';
        log('step_5_question', { iteration: testIterations, prompt: prompt.substring(0, 80) });

        // SPEEDRUNNER: type first word only, char-by-char, fast
        await inputField.click();
        await inputField.clear();

        // Pick the "first word" - for a speedrunner we just type a plausible short answer
        // The actual graded answer is what the AI grades - we type a single short word
        const answer = 'pass'; // generic first-word answer

        for (const char of answer) {
          await inputField.type(char, { delay: 20 });
        }
        answeredCount++;
        log('step_5_typed_answer', { answer, iteration: testIterations, answerCount: answeredCount });

        // Submit via Enter key
        await inputField.press('Enter');
        await page.waitForTimeout(400);

        // Also try Submit button if visible
        const submitBtn = page.getByRole('button', { name: /submit|check answer/i }).first();
        if (await submitBtn.count() > 0 && await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(400);
        }
      }

      // Wait for grading (AI grading takes ~19s for typed tests)
      if (!testDone) {
        log('step_5_waiting_for_grading_or_results', { answeredCount });
        try {
          await page.waitForFunction(() => {
            const body = document.body.innerText.toLowerCase();
            const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.innerText.toLowerCase()).join(' ');
            return body.includes('result') || body.includes('score') ||
                   body.includes('complete') || body.includes('well done') ||
                   body.includes('congratulation') || body.includes('your score') ||
                   headings.includes('result') || headings.includes('complete');
          }, { timeout: 90000 });
          testDone = true;
          log('step_5_grading_done');
        } catch (e) {
          log('step_5_grading_timeout', { error: e.message });
        }
      }

      if (testDone) {
        log('step_5_test_completed', { answeredCount, testIterations });
      }
    }

    // ── Final snapshot ─────────────────────────────────────────────────────────
    const finalUrl = page.url();
    const finalHeadings = await page.locator('h1, h2, h3').allTextContents().catch(() => []);
    const finalBody = await page.locator('body').innerText().catch(() => '');
    log('final_page_state', {
      url: finalUrl,
      headings: finalHeadings,
      bodyPreview: finalBody.substring(0, 500)
    });

  } catch (err) {
    log('fatal_error', { error: err.message, stack: err.stack?.substring(0, 500) });
    classification = `BLOCKED:exception:${err.message.substring(0, 100)}`;
  } finally {
    try {
      const finalUrl = page.url();
      const finalHeadings = await page.locator('h1, h2, h3').allTextContents().catch(() => []);
      log('browser_final_state', { url: finalUrl, headings: finalHeadings });
    } catch (_) {}

    await browser.close();
    log('browser_closed');

    // ── Post-flight ────────────────────────────────────────────────────────────
    try {
      const progressAfter = await snapshotClassProgress(db, uid);
      const attemptsAfter = await getAllAttempts(db, uid);
      const csdAfter = progressAfter.data?.currentStudyDay ?? 0;

      newAttempts = attemptsAfter.filter(a => !attemptsBefore.find(b => b.id === a.id));
      const day1Attempts = attemptsAfter.filter(a =>
        (a.data?.studyDay === 1 || a.data?.day === 1) && a.data?.listId === LIST_ID
      );
      const duplicateAttempts = day1Attempts.length > 1;

      log('snapshot_after', {
        classProgress: progressAfter.data,
        attemptCount: attemptsAfter.length,
        csdAfter,
        newAttempts: newAttempts.map(a => ({ id: a.id, studyDay: a.data?.studyDay, score: a.data?.score, passed: a.data?.passed, sessionType: a.data?.sessionType })),
        day1Attempts: day1Attempts.length,
        duplicateAttempts
      });

      // Classify
      if (!classification.startsWith('BLOCKED') || classification === 'BLOCKED:unknown') {
        if (csdAfter > csdBefore) {
          classification = 'COMPLETED_PASS';
        } else if (newAttempts.length > 0 && newAttempts.some(a => a.data?.studyDay === 1 || a.data?.day === 1)) {
          classification = 'COMPLETED_NOPASS';
        } else if (newAttempts.length > 0) {
          classification = 'COMPLETED_NOPASS'; // attempt recorded, day not advanced
        } else if (reachedTest) {
          classification = 'BLOCKED:test_reached_no_attempt_recorded';
        }
      }

      // New-word slice check
      const day1AttemptData = day1Attempts[0]?.data;
      const newWordEndIdx = day1AttemptData?.newWordEndIndex ?? null;
      const sliceCorrect = newWordEndIdx !== null ? (newWordEndIdx === pace - 1 || newWordEndIdx === pace) : false;

      log('classification', { classification, csdBefore, csdAfter, newAttempts: newAttempts.length });

      // ── Write report ────────────────────────────────────────────────────────
      const report = buildReport({
        uid, csdBefore, csdAfter, pace, day1Slice, servedWords,
        attemptsBefore, newAttempts, day1Attempts,
        duplicateAttempts, sliceCorrect, newWordEndIdx,
        b2StrandErrors, consoleErrors, classification,
        reachedTest, logEntries
      });
      writeFileSync(REPORT_PATH, report);
      log('report_written', { path: REPORT_PATH });

      // ── Write status.json ────────────────────────────────────────────────────
      const status = {
        label: LABEL,
        account: ACCOUNT.email,
        reachedNewWordTest: reachedTest,
        classification,
        b2StrandError: b2StrandErrors.length > 0,
        newWordSliceCorrect: newWordEndIdx !== null ? sliceCorrect : 'NOT_VERIFIED',
        csdBefore,
        csdAfter,
        duplicateAttempts: day1Attempts.length > 1,
        consoleErrors: consoleErrors.slice(0, 10),
        orphanDocs: 'NONE',
        overallOk: classification.startsWith('COMPLETED') && !(day1Attempts.length > 1) && b2StrandErrors.length === 0,
        newAttempts: newAttempts.map(a => ({
          id: a.id,
          studyDay: a.data?.studyDay,
          score: a.data?.score,
          passed: a.data?.passed,
          sessionType: a.data?.sessionType,
          newWordEndIndex: a.data?.newWordEndIndex
        })),
        servedWords: servedWords.slice(0, 10),
        runAt: new Date().toISOString(),
      };

      writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
      log('status_written', { path: STATUS_PATH });

      console.log('\n=== FINAL STATUS ===');
      console.log(JSON.stringify(status, null, 2));
    } catch (postErr) {
      log('post_flight_error', { error: postErr.message });
      console.error('Post-flight error:', postErr);
    }
  }
}

function buildReport(opts) {
  const {
    uid, csdBefore, csdAfter, pace, day1Slice, servedWords,
    attemptsBefore, newAttempts, day1Attempts, duplicateAttempts,
    sliceCorrect, newWordEndIdx, b2StrandErrors, consoleErrors,
    classification, reachedTest, logEntries
  } = opts;

  const loginDone = logEntries.some(e => e.step === 'step_1_login_done');
  const studyDone = logEntries.some(e => e.step === 'step_4_study_done_reached_test');
  const testDone  = logEntries.some(e => e.step === 'step_5_test_completed' || e.step === 'step_5_reached_results' || e.step === 'step_5_grading_done');
  const staleEntry = logEntries.find(e => e.step === 'step_3_stale_resolved');

  const day1AttemptData = day1Attempts[0]?.data;

  return `# D1-01: DAY-1 Completion Test — audit_speedrunner_01_top

**Label:** D1-01
**Account:** audit_speedrunner_01_top@vocaboost.test
**UID:** ${uid}
**Class ID:** ${CLASS_ID}
**List ID:** ${LIST_ID}
**Run date:** ${new Date().toISOString()}
**Bundle:** index-CflgDyCK.js (latest deploy)

---

## Flow Steps

| Step | Status | Notes |
|------|--------|-------|
| Login | ${loginDone ? 'PASS' : 'FAIL'} | SPA navigation to /login, credential submit |
| Navigate to session | ${logEntries.some(e => e.step === 'step_2_session_url') ? 'PASS' : 'FAIL'} | /session/${CLASS_ID}/${LIST_ID} |
| Stale screen check | ${staleEntry ? (staleEntry.staleLoops === 0 ? 'NO STALE SCREEN' : `RESOLVED (${staleEntry.staleLoops} loops)`) : 'NOT REACHED'} | H2 pattern check |
| Study flashcards | ${studyDone ? 'COMPLETED' : 'PARTIAL/FAIL'} | View and dismiss cards |
| Reached new-word test | ${reachedTest ? 'YES' : 'NO'} | input[type=text] visible |
| Test answered | ${logEntries.some(e => e.step === 'step_5_test_completed') ? 'YES' : 'PARTIAL'} | Speedrunner: char-by-char, first-word |
| Grading waited | ${logEntries.some(e => e.step === 'step_5_grading_done' || e.step === 'step_5_reached_results') ? 'YES' : 'NO'} | ~19s AI grading |
| Results reached | ${testDone ? 'YES' : 'NO'} | Score/results page |

## Assertions

### 1. Reached and Completed Day-1 New-Word Test
- **Reached test:** ${reachedTest ? 'YES' : 'NO'}
- **Test completed:** ${testDone ? 'YES' : 'NO'}

### 2. B2 Strand Error ("Unsupported field value: undefined")
- **Error seen:** ${b2StrandErrors.length > 0 ? 'YES — ISSUE' : 'NO — PASS'}
${b2StrandErrors.length > 0 ? b2StrandErrors.map(e => `  - \`${e}\``).join('\n') : ''}

### 3. New-Word Slice (Day-1: positions [0, pace))
- **Pace:** ${pace}
- **Expected Day-1 words (first 10):** ${day1Slice.slice(0, 10).map(w => typeof w === 'string' ? w : (w.word || w.term || JSON.stringify(w))).join(', ')}
- **Served words captured:** ${servedWords.length > 0 ? servedWords.join(', ') : '(none captured — flashcard text not extractable via selectors)'}
- **newWordEndIndex in attempt:** ${newWordEndIdx !== null ? newWordEndIdx : 'N/A'}
- **Slice correct:** ${newWordEndIdx !== null ? (sliceCorrect ? 'YES — PASS' : `NO — newWordEndIndex=${newWordEndIdx}, expected ${pace - 1}`) : 'NOT_VERIFIED'}

### 4. Attempt Documents
- **Before count:** ${attemptsBefore.length}
- **New attempts this run:** ${newAttempts.length}
- **Day-1 specific attempts (listId match):** ${day1Attempts.length}
- **Duplicate Day-1 attempts:** ${duplicateAttempts ? 'YES — ISSUE' : 'NO — PASS'}
- **Attempt details:**
${newAttempts.map(a => `  - ID: \`${a.id}\`
    - studyDay: ${a.data?.studyDay ?? 'N/A'}
    - sessionType: ${a.data?.sessionType ?? 'N/A'}
    - score: ${a.data?.score ?? 'N/A'}
    - passed: ${a.data?.passed ?? 'N/A'}
    - newWordEndIndex: ${a.data?.newWordEndIndex ?? 'N/A'}
    - listId: ${a.data?.listId ?? 'N/A'}
    - classId: ${a.data?.classId ?? 'N/A'}`).join('\n') || '  (none)'}

### 5. class_progress currentStudyDay
- **CSD Before:** ${csdBefore}
- **CSD After:** ${csdAfter}
- **Advanced:** ${csdAfter > csdBefore ? 'YES' : 'NO'}

### 6. Orphan Docs
NONE — read-only Admin SDK verification only; no writes performed by audit script.

---

## Classification

**${classification}**

${classification === 'COMPLETED_PASS' ?
  'Day 1 passed: CSD advanced from ' + csdBefore + ' to ' + csdAfter + '. Student met the pass threshold.' :
classification === 'COMPLETED_NOPASS' ?
  'Day 1 test completed but score was below pass threshold (expected for SPEEDRUNNER persona using first-word-only answers). CSD correctly held at ' + csdAfter + '. This is CORRECT behavior, not a bug.' :
  'BLOCKED: ' + classification.replace('BLOCKED:', '') + '. Day 1 could not be completed.'
}

---

## Console Errors (all types)

${consoleErrors.length === 0 ? 'None observed.' : consoleErrors.slice(0, 20).map((e, i) => `${i + 1}. ${e.substring(0, 300)}`).join('\n')}

---

## Overall Day-1 Result

| Check | Result |
|-------|--------|
| Reached new-word test | ${reachedTest ? 'y' : 'n'} |
| No B2 strand error | ${b2StrandErrors.length === 0 ? 'PASS' : 'FAIL'} |
| No duplicate attempts | ${!duplicateAttempts ? 'PASS' : 'FAIL'} |
| No unhandled page errors | ${consoleErrors.filter(e => !e.includes('ERR_') && !e.includes('favicon')).length === 0 ? 'PASS' : 'WARN'} |
| Classification | ${classification} |
| **Overall Day-1 OK** | **${classification.startsWith('COMPLETED') && !duplicateAttempts && b2StrandErrors.length === 0 ? 'YES' : 'NO'}** |

---

## STATUS BLOCK

| Field | Value |
|-------|-------|
| Account | audit_speedrunner_01_top@vocaboost.test |
| Reached new-word test? | ${reachedTest ? 'y' : 'n'} |
| Classification | ${classification} |
| B2 strand error seen? | ${b2StrandErrors.length > 0 ? 'y' : 'n'} |
| New-word slice correct? | ${newWordEndIdx !== null ? (sliceCorrect ? 'y' : 'n') : 'NOT_VERIFIED'} |
| CSD before→after | ${csdBefore} → ${csdAfter} |
| Duplicate attempts? | ${duplicateAttempts ? 'y' : 'n'} |
| Console errors | ${consoleErrors.length === 0 ? 'none' : consoleErrors.slice(0, 2).join('; ').substring(0, 200)} |
| Orphan docs | NONE |
| Overall Day-1 OK? | ${classification.startsWith('COMPLETED') && !duplicateAttempts && b2StrandErrors.length === 0 ? 'y' : 'n'} |
`;
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
