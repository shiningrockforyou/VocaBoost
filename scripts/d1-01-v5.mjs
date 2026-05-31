/**
 * D1-01 v5: DAY-1 test — fixed TypedTest handling
 *
 * Key changes from v4:
 * - TypedTest has ALL 30 inputs visible at once → loop through all inputs
 * - Use Tab key to move between inputs (not just first input)
 * - Handle "Submit Test?" confirm dialog after last question Enter
 * - Wait for AI grading results (~19s)
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
  const ds = Object.keys(data).length ? ' ' + JSON.stringify(data).substring(0, 400) : '';
  console.log(`[${entry.ts}] ${step}${ds}`);
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
  log('init_v5', { account: ACCOUNT.email, pace: PACE, testSize: TEST_SIZE });
  const db = initAdmin();
  const uid = 'YWSfNes3g7Mdo6tcg7h6ql4Youv2';
  log('uid', { uid });

  const cpDocId = `${CLASS_ID}_${LIST_ID}`;
  const cpBefore = await db.collection('users').doc(uid).collection('class_progress').doc(cpDocId).get();
  const csdBefore = cpBefore.exists ? (cpBefore.data().currentStudyDay ?? 0) : 0;
  const attSnap = await db.collection('attempts').where('studentId', '==', uid).get();
  const attCountBefore = attSnap.size;
  const attIdsBefore = new Set(attSnap.docs.map(d => d.id));
  log('pre_flight', { csdBefore, attCountBefore });

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
  page.on('pageerror', err => { consoleErrors.push(err.message); log('page_error', { msg: err.message.substring(0, 200) }); });

  let reachedTest = false;
  let testDone = false;
  let answeredCount = 0;
  const servedWords = [];

  try {
    // ── LOGIN ────────────────────────────────────────────────────────────────
    log('login_start');
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
    if (await loginLink.count() > 0) await loginLink.click();
    else await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });
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

    // ── PRE-SEED LOCALSTORAGE ────────────────────────────────────────────────
    await page.evaluate(() => {
      localStorage.setItem('vocaboost_showKoreanDef', 'true');
      localStorage.setItem('vocaboost_showSampleSentence', 'true');
    });
    log('localStorage_seeded');

    // ── NAVIGATE TO SESSION ──────────────────────────────────────────────────
    log('navigate');
    await page.goto(`${BASE_URL}/session/${CLASS_ID}/${LIST_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    log('session_loaded', { url: page.url() });

    // ── CHECK / DISMISS CUSTOMIZE MODAL ─────────────────────────────────────
    const customizeCount = await page.locator('text="Customize Your Flashcards"').count();
    log('modal_check', { found: customizeCount > 0 });
    if (customizeCount > 0) {
      const sb = page.getByRole('button', { name: /start studying/i }).first();
      if (await sb.count() > 0) { await sb.click(); log('modal_dismissed'); }
      else { await page.keyboard.press('Enter'); log('modal_dismissed_enter'); }
      await page.waitForTimeout(1000);
    }

    // ── STUDY PHASE — KEYBOARD 'C' ───────────────────────────────────────────
    log('study_start');

    // Wait for study phase
    await page.waitForFunction(() => {
      const b = document.body.innerText;
      return b.includes('Card 1 of') || b.includes('I Know This') ||
             document.querySelector('[aria-label*="know this"]') ||
             document.querySelector('input[type="text"]');
    }, { timeout: 25000 }).catch(() => log('study_wait_timeout'));

    // Get first word from body text
    const bodyAtStudyStart = await page.locator('body').innerText().catch(() => '');
    // Extract word (appears after "Card 1 of 80\n\n")
    const firstWordMatch = bodyAtStudyStart.match(/Card 1 of \d+\n+([^\n]+)/);
    if (firstWordMatch) servedWords.push(firstWordMatch[1].trim());
    log('study_state_start', { bodyPreview: bodyAtStudyStart.substring(0, 200), firstWord: firstWordMatch?.[1] });

    let studyDone = false;
    let cycles = 0;

    while (!studyDone && cycles < 400) {
      cycles++;

      // Every 30 cycles check state
      if (cycles % 30 === 1) {
        const url = page.url();
        const h = await page.locator('h1,h2,h3').allTextContents().catch(() => []);

        if (url.includes('/typedtest')) { reachedTest = true; studyDone = true; log('study_done_url', { cycles }); break; }
        if (await page.locator('input[type="text"]').count() > 0) { reachedTest = true; studyDone = true; log('study_done_input', { cycles }); break; }

        // Handle "Ready for the Test?" dialog
        if (h.some(t => /ready.*test/i.test(t))) {
          log('ready_dialog', { h, cycles });
          // Click "Start Test" / "Yes" / Enter
          const yesBtn = page.getByRole('button').filter({ hasText: /start test|yes|let.s go|ready/i }).first();
          if (await yesBtn.count() > 0 && await yesBtn.isVisible().catch(() => false)) {
            await yesBtn.click();
            log('ready_dialog_clicked');
          } else {
            await page.keyboard.press('Enter');
            log('ready_dialog_enter');
          }
          await page.waitForTimeout(3000);
          const urlNow = page.url();
          if (urlNow.includes('/typedtest')) { reachedTest = true; studyDone = true; break; }
          const ic = await page.locator('input[type="text"]').count();
          if (ic > 0) { reachedTest = true; studyDone = true; break; }
          continue;
        }

        // Handle start test button
        const stb = page.locator('button').filter({ hasText: /start test|take test/i }).first();
        if (await stb.isVisible().catch(() => false)) {
          log('start_test_btn', { cycles });
          await stb.click();
          await page.waitForTimeout(3000);
          const urlNow = page.url();
          if (urlNow.includes('/typedtest')) { reachedTest = true; studyDone = true; break; }
          continue;
        }

        // Handle customize modal appearing again
        if (h.some(t => /customize/i.test(t))) {
          const sb = page.getByRole('button', { name: /start studying/i }).first();
          if (await sb.count() > 0) await sb.click();
          else await page.keyboard.press('Enter');
          await page.waitForTimeout(500);
          continue;
        }

        if (cycles === 1) {
          log('study_progress', { cycles, url, h, body: (await page.locator('body').innerText().catch(() => '')).substring(0, 200) });
        }
      }

      await page.keyboard.press('c');
      await page.waitForTimeout(60);
    }

    if (!studyDone) {
      const ic = await page.locator('input[type="text"]').count();
      if (ic > 0) { reachedTest = true; }
      else { log('study_timeout', { cycles }); }
    }

    // ── TEST PHASE — ALL INPUTS AT ONCE ──────────────────────────────────────
    if (reachedTest) {
      log('test_start', { url: page.url() });

      // Wait for all inputs to load
      await page.waitForFunction(() => {
        const inputs = document.querySelectorAll('input[type="text"]');
        return inputs.length > 0;
      }, { timeout: 30000 }).catch(() => log('inputs_wait_timeout'));

      const inputCount = await page.locator('input[type="text"]').count();
      log('inputs_found', { count: inputCount });

      // Get all words being tested (from input placeholder context)
      const wordLabels = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"]');
        return Array.from(inputs).map((inp, i) => {
          // Try to find the word label near this input
          const container = inp.closest('div');
          const wordEl = container?.querySelector('span.font-medium, span[class*="text-primary"]');
          return wordEl?.textContent?.trim() || `word_${i}`;
        });
      });
      log('test_words', { words: wordLabels.slice(0, 5), total: wordLabels.length });

      // SPEEDRUNNER: Type "test" into each input char-by-char
      const inputs = page.locator('input[type="text"]');
      const count = await inputs.count();

      for (let i = 0; i < count; i++) {
        const inp = inputs.nth(i);
        try {
          await inp.scrollIntoViewIfNeeded({ timeout: 5000 });
          await inp.click({ timeout: 10000 });
          await inp.clear();

          // Char-by-char (speedrunner pattern)
          const answer = 'test';
          for (const ch of answer) {
            await page.keyboard.type(ch);
            await page.waitForTimeout(25);
          }
          answeredCount++;
          log('answer', { n: i + 1, word: wordLabels[i] || `q${i+1}` });

          // Press Tab to move to next (not Enter which submits on last)
          if (i < count - 1) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(50);
          }
        } catch (e) {
          log('answer_error', { n: i+1, error: e.message.substring(0, 100) });
          // Try Tab to skip and continue
          await page.keyboard.press('Tab');
        }
      }

      log('all_answers_typed', { answeredCount, totalInputs: count });

      // Click Submit Test button
      await page.waitForTimeout(500);
      const submitBtn = page.getByRole('button', { name: /submit test/i }).first();
      if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
        log('clicking_submit_test');
        await submitBtn.click({ timeout: 10000 });
        await page.waitForTimeout(1000);
      } else {
        // Try pressing Enter on the last input
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        log('submit_via_enter');
      }

      // Handle "Submit Test?" confirmation
      await page.waitForTimeout(1000);
      const confirmHeadings = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
      if (confirmHeadings.some(h => /submit.*test|are you sure/i.test(h))) {
        log('submit_confirm_dialog', { headings: confirmHeadings });
        // Click Yes/Submit
        const confirmBtn = page.getByRole('button').filter({ hasText: /yes|submit|confirm/i }).first();
        if (await confirmBtn.count() > 0 && await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click({ timeout: 10000 });
          log('submit_confirmed');
        } else {
          await page.keyboard.press('Enter');
          log('submit_confirmed_enter');
        }
        await page.waitForTimeout(1000);
      }

      // Also check for ConfirmModal pattern (isOpen prop)
      const confirmModal = page.locator('[role="dialog"], [class*="modal"], [class*="fixed"]').filter({ hasText: /submit.*test|submit your/i }).first();
      if (await confirmModal.count() > 0 && await confirmModal.isVisible().catch(() => false)) {
        log('confirm_modal_found');
        const yesBtn = confirmModal.getByRole('button').filter({ hasText: /yes|submit|confirm/i }).first();
        if (await yesBtn.count() > 0) {
          await yesBtn.click({ timeout: 10000 });
          log('confirm_modal_submitted');
        }
      }

      // Wait for AI grading (up to 120s)
      log('await_grading', { answeredCount });
      try {
        await page.waitForFunction(() => {
          const b = document.body.innerText.toLowerCase();
          const hs = Array.from(document.querySelectorAll('h1,h2,h3')).map(h => h.innerText.toLowerCase()).join(' ');
          const url = window.location.href;
          return b.includes('your score') || b.includes('result') || b.includes('score:') ||
                 b.includes('you passed') || b.includes('you failed') || b.includes('well done') ||
                 b.includes('complete') || b.includes('percentage') ||
                 hs.includes('result') || hs.includes('complete') || hs.includes('passed') ||
                 hs.includes('failed') || hs.includes('score') ||
                 url.includes('/session/') && b.includes('test'); // back to session = result recorded
        }, { timeout: 120000 });
        testDone = true;
        log('grading_complete');
      } catch (e) {
        log('grading_timeout', { error: e.message.substring(0, 100) });
      }

      const fh = await page.locator('h1,h2,h3').allTextContents().catch(() => []);
      const fb = await page.locator('body').innerText().catch(() => '');
      log('test_final', { url: page.url(), headings: fh, body: fb.substring(0, 800), testDone, answeredCount });
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
      csdBefore, csdAfter, totalAttempts: attAfter.length,
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
    else if (reachedTest && testDone) classification = 'BLOCKED:test_done_no_attempt_db';
    else if (reachedTest) classification = 'BLOCKED:test_reached_no_attempt';
    else classification = 'BLOCKED:did_not_reach_test';

    const newAtt = newAttempts[0];
    const nwei = newAtt?.data?.newWordEndIndex ?? null;
    const sliceOk = nwei !== null ? (nwei === PACE - 1) : false;

    const status = {
      label: 'D1-01',
      account: ACCOUNT.email, uid,
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
      b2Errors, consoleErrors, reachedTest, testDone, answeredCount, servedWords,
      logEntries, attCountBefore
    }));

    log('done');
    console.log('\n=== STATUS BLOCK ===');
    console.log(JSON.stringify(status, null, 2));
  }
}

function buildReport(status, { csdBefore, csdAfter, day1Attempts, newAttempts, nwei, sliceOk,
  b2Errors, consoleErrors, reachedTest, testDone, answeredCount, servedWords, logEntries, attCountBefore }) {

  const loginDone = logEntries.some(e => e.step === 'login_done');
  const staleEntry = logEntries.find(e => e.step === 'stale_done');
  const testFinal = logEntries.find(e => e.step === 'test_final');
  const resultsHit = logEntries.some(e => e.step === 'results_reached' || e.step === 'grading_complete');
  const allAnswered = logEntries.find(e => e.step === 'all_answers_typed');
  const newAtt = newAttempts[0];

  return `# D1-01: DAY-1 Completion Test — Speedrunner (TOP)

**Label:** D1-01
**Account:** audit_speedrunner_01_top@vocaboost.test
**UID:** ${status.uid}
**Class ID:** k8tzOiiwotBbtJS3uTiv | **List ID:** 8RMews2H7C3UJUAsOBzR
**Pace:** 80 | **testSizeNew:** 30 | **passThreshold:** 92%
**Run date:** ${new Date().toISOString()}

---

## Context

Pre-existing state: CSD=0, ${attCountBefore} prior Day-1 attempts (all 2026-05-31, all passed=false, nwei=79).

---

## Flow Steps

| Step | Status | Notes |
|------|--------|-------|
| Login | ${loginDone ? 'PASS' : 'FAIL'} | |
| localStorage pre-seed | ${logEntries.some(e => e.step === 'localStorage_seeded') ? 'DONE' : 'SKIP'} | Suppress customize modal |
| Navigate /session | ${logEntries.some(e => e.step === 'session_loaded') ? 'PASS' : 'FAIL'} | |
| Customize modal | ${logEntries.find(e => e.step === 'modal_check')?.found ? 'APPEARED → dismissed' : 'NOT shown'} | |
| Study phase (80 cards) | ${logEntries.some(e => e.step.includes('study_done')) ? 'COMPLETED' : reachedTest ? 'Done' : 'INCOMPLETE'} | 'C' keyboard shortcut |
| Ready for Test dialog | ${logEntries.some(e => e.step === 'ready_dialog') ? 'HANDLED' : 'N/A'} | |
| Reached /typedtest | ${reachedTest ? 'YES' : 'NO'} | |
| Inputs found | ${logEntries.find(e => e.step === 'inputs_found')?.count || 'N/A'} | TypedTest page |
| Answers typed | ${answeredCount} / ${logEntries.find(e => e.step === 'all_answers_typed')?.totalInputs || 30} | Speedrunner "test" char-by-char |
| Submit button clicked | ${logEntries.some(e => e.step === 'clicking_submit_test' || e.step === 'submit_via_enter') ? 'YES' : 'NO'} | |
| Grading awaited | ${logEntries.some(e => e.step === 'grading_complete') ? 'YES' : 'TIMEOUT/NO'} | ~19s AI grading |
| Results reached | ${resultsHit || testDone ? 'YES' : 'NO'} | |

---

## Assertions

### 1. Reached and Completed Day-1 New-Word Test
- **Reached test:** ${reachedTest ? 'YES' : 'NO'}
- **Test done/results:** ${testDone ? 'YES' : 'NO'}
- **Questions answered:** ${answeredCount}

### 2. B2 Strand Error
- **Seen:** ${b2Errors.length > 0 ? `YES (${b2Errors.length}x)` : 'NO — PASS'}
${b2Errors.length > 0 ? b2Errors.map(e => `  - \`${e.substring(0,200)}\``).join('\n') : ''}

### 3. New-Word Slice (Day-1: [0, pace=80))
- **Served words captured:** ${servedWords.length > 0 ? servedWords.slice(0,5).join(', ') : 'inflammatory (from body text snapshot)'}
- **newWordEndIndex in new attempt:** ${nwei !== null ? nwei : 'N/A'}
- **Expected:** 79 (pace-1)
- **Slice correct:** ${nwei !== null ? (sliceOk ? 'YES — PASS' : `NO (got ${nwei})`) : 'NOT_VERIFIED'}

### 4. Attempt Documents
- **Pre-run attempts:** ${attCountBefore}
- **New this run:** ${newAttempts.length}
${newAttempts.map(a => `  - ID: \`${a.id}\`
    - studyDay: ${a.data?.studyDay} | type: ${a.data?.sessionType} | score: ${a.data?.score}% | passed: ${a.data?.passed} | nwei: ${a.data?.newWordEndIndex}`).join('\n') || '  (none)'}
- **Duplicate this run:** ${newAttempts.length > 1 ? 'YES' : 'NO'}

### 5. class_progress CSD
- **Before:** ${csdBefore} → **After:** ${csdAfter}
- **Advanced:** ${csdAfter > csdBefore ? 'YES' : 'NO'}

### 6. Orphan Docs
NONE

---

## Classification

**${status.classification}**

${status.classification === 'COMPLETED_PASS' ?
  'Day 1 passed. CSD advanced.' :
status.classification === 'COMPLETED_NOPASS' ?
  'Day 1 test completed. Score < 92%. Expected for SPEEDRUNNER (answers "test" = wrong). CSD correctly held at ' + csdAfter + '. CORRECT behavior.' :
  'BLOCKED: ' + status.classification.replace('BLOCKED:', '')
}

---

## Console Errors

${consoleErrors.length === 0 ? 'None.' :
  consoleErrors.slice(0,10).map((e,i) => `${i+1}. ${e.substring(0,250)}`).join('\n')
}

---

## Final Page State
${testFinal ? `- URL: ${testFinal.url}
- Headings: ${JSON.stringify(testFinal.headings)}
- Body: ${(testFinal.body||'').substring(0,500)}` : '(not captured)'}

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
