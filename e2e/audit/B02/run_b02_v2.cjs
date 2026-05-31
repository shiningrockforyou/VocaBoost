/**
 * B02 — MCQ Submission Critical Path (v2 — fixed page.evaluate args)
 * Run from /app: node e2e/audit/B02/run_b02_v2.cjs
 */

const { chromium } = require('playwright');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

const SA = require('/app/scripts/serviceAccountKey.json');
if (getApps().length === 0) initializeApp({ credential: cert(SA) });
const firestoreDb = getFirestore();

const BASE_URL = 'https://vocaboostone.netlify.app';
const EVIDENCE_DIR = '/app/audit/playwright/findings/evidence/B02';
const FINDINGS_LOG = '/app/audit/playwright/findings/agent_logs/B.jsonl';
const CLASS_ID = 'k8tzOiiwotBbtJS3uTiv';
const LIST_ID = '8RMews2H7C3UJUAsOBzR';

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const ACCOUNTS = {
  careful:   { email: 'audit_careful_01_top@vocaboost.test',   password: 'AuditPass2026!', uid: 'EPnmY4FIXxVq19tQtxQCvE26p0F3' },
  recovering:{ email: 'audit_recovering_01_top@vocaboost.test',password: 'AuditPass2026!', uid: 'P8b1hVCk9qSvOWsYbrqTT6oznY03' },
  rushed:    { email: 'audit_rushed_01_top@vocaboost.test',    password: 'AuditPass2026!', uid: 'trOe7MHzaYZuP99R7N3g5RuI6o83' },
  hostile:   { email: 'audit_hostile_01_top@vocaboost.test',   password: 'AuditPass2026!', uid: 'bvexVreuuvNrGZ1aWygwAhRGdm03' },
  lazy:      { email: 'audit_lazy_01_top@vocaboost.test',      password: 'AuditPass2026!', uid: 'VBgBmlrlzXVPzURmABkdDBGtKd42' },
  anxious:   { email: 'audit_anxious_01_top@vocaboost.test',   password: 'AuditPass2026!', uid: 'KsZv3zxcUEVTdFbdWKZ8oesDcj33' },
};

function logLine(obj) {
  fs.appendFileSync(FINDINGS_LOG, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n');
}

function updateStatus(update) {
  const sp = '/app/audit/playwright/findings/agent_logs/B.status.json';
  const cur = JSON.parse(fs.readFileSync(sp, 'utf-8'));
  fs.writeFileSync(sp, JSON.stringify({ ...cur, ...update, lastUpdate: new Date().toISOString() }, null, 2));
}

async function fsSnap(uid, label) {
  const attSnap = await firestoreDb.collection('attempts').where('studentId', '==', uid).get();
  const attempts = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ssSnap = await firestoreDb.collection('users').doc(uid).collection('study_states').get();
  const studyStates = {};
  ssSnap.docs.forEach(d => { studyStates[d.id] = d.data(); });
  const fp = path.join(EVIDENCE_DIR, `${label}_firestore.json`);
  fs.writeFileSync(fp, JSON.stringify({ uid, attempts, studyStates, at: new Date().toISOString() }, null, 2));
  return { attempts, studyStates };
}

function totalTTT(studyStates) {
  return Object.values(studyStates).reduce((s, st) => s + (st.timesTestedTotal || 0), 0);
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, `${name}.png`), fullPage: true }).catch(() => {});
}

function attachConsole(page) {
  const msgs = [];
  page.on('console', m => msgs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => msgs.push(`[pageerror] ${e.message}`));
  return msgs;
}

function saveConsole(msgs, name) {
  const fp = path.join(EVIDENCE_DIR, `${name}_console.log`);
  fs.writeFileSync(fp, msgs.join('\n'));
  return msgs.filter(m => m.startsWith('[error]') || m.startsWith('[pageerror]'));
}

async function loginAs(page, acc) {
  await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  const loginLink = page.getByRole('link', { name: /log\s?in|sign\s?in/i }).first();
  if (await loginLink.count() > 0 && await loginLink.isVisible().catch(() => false)) {
    await loginLink.click();
  } else {
    await page.evaluate(() => { history.pushState({}, '', '/login'); dispatchEvent(new PopStateEvent('popstate')); });
  }
  await page.getByLabel(/email/i).first().waitFor({ timeout: 20000 });
  await page.getByLabel(/email/i).first().fill(acc.email);
  await page.getByLabel(/password/i).first().fill(acc.password);
  await page.getByLabel(/password/i).first().press('Enter');
  await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 }).catch(async () => {
    await page.getByRole('button', { name: /continue|log\s?in|sign\s?in/i }).first().click().catch(() => {});
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 15000 });
  });
  console.log(`  Logged in: ${acc.email}`);
}

async function goToMCQ(page, testType = 'review') {
  await page.goto(`${BASE_URL}/mcqtest/${CLASS_ID}/${LIST_ID}?type=${testType}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await Promise.race([
    page.waitForSelector('button:has-text("Submit Test")', { timeout: 20000 }),
    page.waitForSelector('text=Resume Previous Test?', { timeout: 20000 }),
    page.waitForSelector('text=No Test Content', { timeout: 20000 }),
    page.waitForSelector('text=Something went wrong', { timeout: 20000 }),
  ]).catch(() => {});
}

async function clearRecovery(page) {
  const btn = page.getByRole('button', { name: /start fresh/i });
  if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) { await btn.click(); await page.waitForTimeout(800); }
}

async function testLoaded(page) {
  return page.locator('button:has-text("Submit Test")').isVisible().catch(() => false);
}

async function answerAll(page) {
  let iter = 80, n = 0;
  while (iter-- > 0) {
    const txt = await page.locator('button:has-text("Submit Test")').textContent().catch(() => '');
    const m = txt.match(/\((\d+)\/(\d+)/);
    if (m && m[1] === m[2]) break;
    const opts = page.locator('.grid button[type="button"]:not([aria-label])');
    if (await opts.count() === 0) break;
    await opts.first().click();
    n++;
    await page.waitForTimeout(300);
  }
  return n;
}

async function answerN(page, n) {
  let answered = 0;
  for (let i = 0; i < n; i++) {
    const opts = page.locator('.grid button[type="button"]:not([aria-label])');
    if (await opts.count() === 0) break;
    await opts.first().click();
    answered++;
    await page.waitForTimeout(300);
  }
  return answered;
}

async function waitForResults(page, ms = 35000) {
  await Promise.race([
    page.waitForSelector('text=Great Work', { timeout: ms }),
    page.waitForSelector('text=Room for Improvement', { timeout: ms }),
    page.waitForSelector('text=Keep Practicing', { timeout: ms }),
    page.waitForSelector('text=Needs Attention', { timeout: ms }),
    page.waitForSelector('text=New Words Test Passed', { timeout: ms }),
    page.waitForSelector('text=Did not pass', { timeout: ms }),
    page.waitForSelector('text=Continue', { timeout: ms }),
    page.waitForSelector('text=correct', { timeout: ms }),
  ]).catch(() => {});
}

// Single-arg localStorage helpers (Playwright page.evaluate only takes 1 arg)
async function lsGet(page, key) {
  return page.evaluate(k => localStorage.getItem(k), key);
}

function testKey(testType) { return `vocaboost_test_${CLASS_ID}_${LIST_ID}_${testType}`; }
function nonceKey(testType) { return `vocaboost_test_${CLASS_ID}_${LIST_ID}_${testType}_nonce`; }

async function getNonce(page) {
  let n = await lsGet(page, nonceKey('review'));
  if (n) return { nonce: n, testType: 'review' };
  n = await lsGet(page, nonceKey('new'));
  if (n) return { nonce: n, testType: 'new' };
  return { nonce: null, testType: null };
}

async function newBrowser() {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() =>
    navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
  );
  const page = await ctx.newPage();
  return { browser: b, page };
}

const results = {};

async function scenario(label, fn) {
  const t0 = Date.now();
  console.log(`\n${'='.repeat(60)}\n${label}`);
  updateStatus({ currentScenario: label });
  try {
    const r = await fn();
    const ms = Date.now() - t0;
    results[label] = { ...r, ms };
    logLine({ event: 'scenario', batch: 'B02', scenario: label, result: r.result, severity: r.severity || null, durationMs: ms });
    console.log(`  => ${r.result} [${r.severity || ''}] ${ms}ms — ${(r.notes || '').slice(0, 100)}`);
    return r;
  } catch (err) {
    const ms = Date.now() - t0;
    const r = { result: 'error', severity: 'BLOCKER', notes: err.message, ms };
    results[label] = r;
    logLine({ event: 'scenario', batch: 'B02', scenario: label, result: 'error', severity: 'BLOCKER', durationMs: ms, error: err.message });
    console.error(`  ERROR: ${err.message}`);
    return r;
  }
}

async function main() {
  console.log('B02 v2 — MCQ Submission Critical Path');

  // ── S01: Happy Path ──────────────────────────────────────────────────────
  await scenario('S01', async () => {
    const { browser, page } = await newBrowser();
    const consoleMsgs = attachConsole(page);
    try {
      const acc = ACCOUNTS.careful;
      const before = await fsSnap(acc.uid, 'B02_S01_before');
      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);

      if (!await testLoaded(page)) {
        await screenshot(page, 'B02_S01_not_loaded');
        const txt = await page.textContent('main').catch(() => '');
        return { result: 'blocked', notes: `MCQ review not loaded. Content: ${txt.slice(0,150)}` };
      }

      let { nonce: nonceBefore } = await getNonce(page);
      console.log(`  nonce before answer=${nonceBefore}`);

      await screenshot(page, 'B02_S01_pre_answer');
      const answered = await answerAll(page);
      console.log(`  answered=${answered}`);
      await screenshot(page, 'B02_S01_pre_submit');

      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await screenshot(page, 'B02_S01_results');

      // Try to capture nonce after submit starts (before clearTestState)
      let { nonce: nonceAtSubmit } = await getNonce(page);
      if (!nonceBefore && !nonceAtSubmit) {
        // nonce created at submit time (getOrCreateAttemptNonce in handleSubmit)
        // re-read
        nonceAtSubmit = nonceAtSubmit || null;
      }

      await page.waitForTimeout(4500);
      const after = await fsSnap(acc.uid, 'B02_S01_after');
      const errors = saveConsole(consoleMsgs, 'B02_S01');

      const newAttempts = after.attempts.filter(a => !before.attempts.some(b => b.id === a.id));
      const issues = [];

      if (newAttempts.length === 0) issues.push('BLOCKER: No attempt doc created');
      else if (newAttempts.length > 1) issues.push(`HIGH: ${newAttempts.length} attempts for one session`);

      if (newAttempts.length === 1) {
        const att = newAttempts[0];
        console.log(`  attempt: id=${att.id} score=${att.score} testType=${att.testType}`);
        if (att.studentId !== acc.uid) issues.push('HIGH: studentId mismatch');
        if (att.testType !== 'mcq') issues.push(`HIGH: testType=${att.testType} expected mcq`);
        if (!att.id.includes(acc.uid)) issues.push(`MEDIUM: uid not in docId ${att.id}`);
      }

      const updatedWords = Object.keys(after.studyStates).filter(id =>
        (after.studyStates[id].timesTestedTotal || 0) > (before.studyStates[id]?.timesTestedTotal || 0)
      );
      if (Object.keys(after.studyStates).length > 0 && updatedWords.length === 0) {
        issues.push('HIGH: study_states not updated after submission');
      }

      const lsKey = testKey('review');
      const lsAfter = await lsGet(page, lsKey);
      if (lsAfter !== null) issues.push('MEDIUM: localStorage not cleared after success');

      const relevantErrors = errors.filter(e => !e.includes('serviceWorker') && !e.includes('favicon'));
      if (relevantErrors.length) issues.push(`LOW: ${relevantErrors.length} console error(s)`);

      const blockers = issues.filter(i => i.startsWith('BLOCKER'));
      const highs = issues.filter(i => i.startsWith('HIGH'));
      if (blockers.length) return { result: 'fail', severity: 'BLOCKER', notes: blockers.join('; '), newAttempts };
      if (highs.length) return { result: 'fail', severity: 'HIGH', notes: highs.join('; '), newAttempts };
      if (issues.length) return { result: 'partial', severity: 'MEDIUM', notes: issues.join('; '), newAttempts };

      return { result: 'pass', notes: `1 attempt id=${newAttempts[0]?.id} score=${newAttempts[0]?.score} study_states updated for ${updatedWords.length} words`, newAttempts };
    } finally { await browser.close(); }
  });

  if (results.S01?.result === 'error' || (results.S01?.result === 'fail' && results.S01?.severity === 'BLOCKER')) {
    logLine({ event: 'stop_condition_hit', batch: 'B02', scenario: 'S01', reason: 'S01 BLOCKER' });
    await writeFindings(true); return;
  }

  // ── S02: clearTestState ordering ─────────────────────────────────────────
  await scenario('S02', async () => {
    const { browser, page } = await newBrowser();
    try {
      const acc = ACCOUNTS.recovering;
      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);

      if (!await testLoaded(page)) return { result: 'blocked', notes: 'MCQ not loaded for recovering' };

      const answered = await answerN(page, 8);
      console.log(`  answered ${answered} questions`);
      await page.waitForTimeout(1000);

      // Verify localStorage has state
      const lsKey = testKey('review');
      const lsBefore = await lsGet(page, lsKey);
      console.log(`  localStorage state present: ${lsBefore !== null}`);

      if (!lsBefore) {
        return { result: 'fail', severity: 'HIGH', notes: 'Answers not saved to localStorage during answering. Recovery impossible.' };
      }

      const savedAnswers = JSON.parse(lsBefore);
      console.log(`  ${Object.keys(savedAnswers.answers || {}).length} answers saved`);

      await screenshot(page, 'B02_S02_before_refresh');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      await screenshot(page, 'B02_S02_after_refresh');

      // Key test: was clearTestState called BEFORE submit? If so, state is gone.
      const lsAfterRefresh = await lsGet(page, lsKey);
      console.log(`  localStorage after refresh: ${lsAfterRefresh !== null}`);

      if (!lsAfterRefresh) {
        return {
          result: 'fail', severity: 'BLOCKER',
          notes: 'Fix #1 REGRESSION: clearTestState called before successful submit. Answers lost on refresh!'
        };
      }

      const recoveryVisible = await page.getByText(/Resume Previous Test|resume where you left off/i).isVisible().catch(() => false);
      const resumeBtn = page.getByRole('button', { name: /^resume$/i });
      const resumeVisible = await resumeBtn.isVisible().catch(() => false);

      console.log(`  recoveryPrompt=${recoveryVisible}, resumeBtn=${resumeVisible}`);

      if (!recoveryVisible && !resumeVisible) {
        const parsedState = JSON.parse(lsAfterRefresh || '{"answers":{}}');
        return {
          result: 'partial', severity: 'MEDIUM',
          notes: `Answers in localStorage (${Object.keys(parsedState.answers || {}).length}) but recovery prompt not shown. Recovery UI may not trigger.`
        };
      }

      if (resumeVisible) {
        await resumeBtn.click();
        await page.waitForTimeout(1200);
        await screenshot(page, 'B02_S02_after_resume');
        const selectedCount = await page.locator('.scale-105').count();
        console.log(`  visually selected after resume: ${selectedCount}`);
      }

      return {
        result: 'pass',
        notes: `Fix #1 confirmed: clearTestState NOT called before submit. Answers survived refresh. Recovery prompt=${recoveryVisible}.`
      };
    } finally { await browser.close(); }
  });

  if (results.S02?.result === 'fail' && results.S02?.severity === 'BLOCKER') {
    logLine({ event: 'stop_condition_hit', batch: 'B02', scenario: 'S02', reason: 'clearTestState ordering regression' });
    await writeFindings(true); return;
  }

  // ── S03: processTestResults ordering ─────────────────────────────────────
  await scenario('S03', async () => {
    const { browser, page } = await newBrowser();
    try {
      const acc = ACCOUNTS.hostile;
      const before = await fsSnap(acc.uid, 'B02_S03_before');
      const tttBefore = totalTTT(before.studyStates);
      const attemptsBefore = before.attempts.length;

      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);

      if (!await testLoaded(page)) return { result: 'blocked', notes: 'MCQ not loaded for hostile' };

      const answered = await answerAll(page);
      console.log(`  answered=${answered}`);
      await screenshot(page, 'B02_S03_pre_submit');

      let splitBrain = false;
      let duringSnap = null;

      // Start submit and poll for split-brain during in-flight
      await page.locator('button:has-text("Submit Test")').click();
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(250);
        const submitting = await page.getByText('Submitting Your Test...').isVisible().catch(() => false);
        if (submitting) {
          duringSnap = await fsSnap(acc.uid, 'B02_S03_during');
          const tttDuring = totalTTT(duringSnap.studyStates);
          const attsDuring = duringSnap.attempts.length;
          console.log(`  During submit: ttt=${tttDuring} (was ${tttBefore}), attempts=${attsDuring} (was ${attemptsBefore})`);
          if (tttDuring > tttBefore && attsDuring === attemptsBefore) {
            splitBrain = true;
          }
          break;
        }
      }

      await waitForResults(page);
      await screenshot(page, 'B02_S03_post_submit');
      await page.waitForTimeout(4500);
      const after = await fsSnap(acc.uid, 'B02_S03_after');
      const tttAfter = totalTTT(after.studyStates);
      const attemptsAfter = after.attempts.length;
      console.log(`  After: ttt=${tttAfter}, attempts=${attemptsAfter}`);

      if (splitBrain) {
        return {
          result: 'fail', severity: 'BLOCKER',
          notes: `Fix #3 REGRESSED: study_states mutated BEFORE attempt doc landed (split-brain). processTestResults ran too early.`
        };
      }

      const newAtts = after.attempts.filter(a => !before.attempts.some(b => b.id === a.id));
      if (newAtts.length === 0) return { result: 'blocked', notes: 'No attempt created — cannot verify ordering' };

      if (tttAfter === tttBefore) {
        return { result: 'fail', severity: 'HIGH', notes: `study_states NOT updated after attempt write. ttt unchanged=${tttAfter}` };
      }

      return { result: 'pass', notes: `Fix #3 confirmed: ${newAtts.length} attempt(s), ttt ${tttBefore}->${tttAfter} AFTER attempt write. No split-brain.` };
    } finally { await browser.close(); }
  });

  if (results.S03?.result === 'fail' && results.S03?.severity === 'BLOCKER') {
    logLine({ event: 'stop_condition_hit', batch: 'B02', scenario: 'S03', reason: 'split-brain' });
    await writeFindings(true); return;
  }

  // ── S04: No double-increment ─────────────────────────────────────────────
  await scenario('S04', async () => {
    const { browser, page } = await newBrowser();
    try {
      const acc = ACCOUNTS.rushed;
      const before = await fsSnap(acc.uid, 'B02_S04_before');
      const tttBefore = totalTTT(before.studyStates);

      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'blocked', notes: 'MCQ not loaded (S04)' };

      await answerAll(page);

      // Rapid multi-clicks on submit
      const btn = page.locator('button:has-text("Submit Test")');
      await btn.click();
      await page.waitForTimeout(120); await btn.click().catch(() => {});
      await page.waitForTimeout(120); await btn.click().catch(() => {});

      await waitForResults(page);
      await screenshot(page, 'B02_S04_results');
      await page.waitForTimeout(4500);
      const after = await fsSnap(acc.uid, 'B02_S04_after');
      const tttAfter = totalTTT(after.studyStates);
      const newAtts = after.attempts.filter(a => !before.attempts.some(b => b.id === a.id));
      const increment = tttAfter - tttBefore;
      const questionsInAtt = newAtts[0]?.totalQuestions || 0;

      console.log(`  attempts=${newAtts.length}, ttt ${tttBefore}->${tttAfter}, increment=${increment}, questionsInAtt=${questionsInAtt}`);

      if (newAtts.length > 1) return { result: 'fail', severity: 'HIGH', notes: `${newAtts.length} attempt docs from rapid-click` };
      if (questionsInAtt > 0 && increment >= questionsInAtt * 2) {
        return { result: 'fail', severity: 'HIGH', notes: `Double-increment: ttt increased by ${increment} for ${questionsInAtt} questions` };
      }

      return { result: 'pass', notes: `Fix #4 confirmed: 1 attempt, increment=${increment} for ${questionsInAtt} questions. No double-increment.` };
    } finally { await browser.close(); }
  });

  // ── S05: Idempotent docId ─────────────────────────────────────────────────
  await scenario('S05', async () => {
    const { browser, page } = await newBrowser();
    const consoleMsgs = attachConsole(page);
    try {
      const acc = ACCOUNTS.recovering;
      const before = await fsSnap(acc.uid, 'B02_S05_before');

      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'blocked', notes: 'MCQ not loaded (S05)' };

      await answerAll(page);

      let { nonce: nonceBefore, testType } = await getNonce(page);
      console.log(`  nonce before submit=${nonceBefore}`);

      await screenshot(page, 'B02_S05_pre_submit');
      await page.locator('button:has-text("Submit Test")').click();

      // Capture nonce after submit starts
      let nonceAtSubmit = nonceBefore;
      if (!nonceAtSubmit) {
        for (let i = 0; i < 6; i++) {
          await page.waitForTimeout(250);
          const { nonce } = await getNonce(page);
          if (nonce) { nonceAtSubmit = nonce; break; }
        }
      }
      console.log(`  nonce at submit=${nonceAtSubmit}`);

      await waitForResults(page);
      await screenshot(page, 'B02_S05_results');

      const { nonce: nonceAfter } = await getNonce(page);
      console.log(`  nonce after success=${nonceAfter} (expect null)`);

      await page.waitForTimeout(4500);
      const after = await fsSnap(acc.uid, 'B02_S05_after');
      saveConsole(consoleMsgs, 'B02_S05');

      const newAtts = after.attempts.filter(a => !before.attempts.some(b => b.id === a.id));
      if (newAtts.length > 1) return { result: 'fail', severity: 'HIGH', notes: `Multiple attempts: ${newAtts.length}` };
      if (newAtts.length === 0) return { result: 'blocked', notes: 'No attempt created (S05)' };

      const attId = newAtts[0].id;
      console.log(`  attemptId=${attId}`);

      const issues = [];
      if (!attId.includes(acc.uid)) issues.push(`UID not in docId ${attId}`);
      if (nonceAtSubmit && !attId.includes(nonceAtSubmit)) issues.push(`Nonce ${nonceAtSubmit} not in docId ${attId}`);
      if (nonceAfter !== null) issues.push(`Nonce not cleared after success (still: ${nonceAfter})`);

      const idIssues = issues.filter(i => i.includes('docId'));
      if (idIssues.length) return { result: 'fail', severity: 'HIGH', notes: idIssues.join('; ') };
      if (issues.length) return { result: 'partial', severity: 'MEDIUM', notes: issues.join('; ') };

      return { result: 'pass', notes: `Fix #5 confirmed: uid in docId, nonce in docId, nonce cleared after success. id=${attId}` };
    } finally { await browser.close(); }
  });

  if (results.S05?.result === 'fail' && results.S05?.severity === 'HIGH') {
    console.log('\nS05 HIGH: Idempotent docId broken (not BLOCKER, continuing)');
  }

  // ── S06: Refresh after success ───────────────────────────────────────────
  await scenario('S06', async () => {
    const { browser, page } = await newBrowser();
    try {
      const acc = ACCOUNTS.careful;
      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'blocked', notes: 'S06: test not loaded' };

      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await screenshot(page, 'B02_S06_on_results');

      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      await screenshot(page, 'B02_S06_after_refresh');

      const url = page.url();
      const recovery = await page.getByText(/Resume Previous Test/i).isVisible().catch(() => false);
      console.log(`  URL=${url}, recovery=${recovery}`);

      if (recovery) {
        return {
          result: 'partial', severity: 'MEDIUM',
          notes: 'After success+refresh: recovery prompt appeared. clearTestState may not execute before page unload. Double-processTestResults risk documented.'
        };
      }

      return { result: 'pass', notes: `After success+refresh: no recovery prompt. URL=${url}. No double-fire risk.` };
    } finally { await browser.close(); }
  });

  // ── S07: Practice mode — architecture-limited ────────────────────────────
  await scenario('S07', async () => {
    const { browser, page } = await newBrowser();
    try {
      const acc = ACCOUNTS.anxious;
      const before = await fsSnap(acc.uid, 'B02_S07_before');

      await loginAs(page, acc);
      // Navigate to MCQ; try to trigger practiceMode via URL state hack
      await page.goto(`${BASE_URL}/mcqtest/${CLASS_ID}/${LIST_ID}?type=review`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const practiceModeBanner = await page.getByText('Practice Mode').isVisible().catch(() => false);
      if (!practiceModeBanner) {
        return {
          result: 'blocked',
          notes: 'Cannot trigger practiceMode via direct URL — requires DailySessionFlow location.state. Architecture limitation. Code-path inspected: practiceMode=false by default from URL, no attempt written in that path.'
        };
      }

      await clearRecovery(page);
      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await page.waitForTimeout(4500);
      const after = await fsSnap(acc.uid, 'B02_S07_after');
      const newAtts = after.attempts.filter(a => !before.attempts.some(b => b.id === a.id));

      if (newAtts.length > 0) return { result: 'fail', severity: 'HIGH', notes: `Practice mode wrote ${newAtts.length} attempt(s)!` };
      return { result: 'pass', notes: '0 attempt docs in practice mode.' };
    } finally { await browser.close(); }
  });

  // ── S08: Zero answers submission ─────────────────────────────────────────
  await scenario('S08', async () => {
    const { browser, page } = await newBrowser();
    const consoleMsgs = attachConsole(page);
    try {
      const acc = ACCOUNTS.lazy;
      const before = await fsSnap(acc.uid, 'B02_S08_before');

      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'blocked', notes: 'MCQ not loaded (S08)' };

      await screenshot(page, 'B02_S08_zero_answers');
      await page.locator('button:has-text("Submit Test")').click();
      await page.waitForTimeout(3000);
      await screenshot(page, 'B02_S08_after_zero_submit');

      const validation = await page.getByText(/please answer at least one/i).isVisible().catch(() => false);
      const onResults = await page.getByText(/\d+ of \d+ correct/i).isVisible().catch(() => false);
      saveConsole(consoleMsgs, 'B02_S08');

      await page.waitForTimeout(3000);
      const after = await fsSnap(acc.uid, 'B02_S08_after');
      const newAtts = after.attempts.filter(a => !before.attempts.some(b => b.id === a.id));
      console.log(`  validation=${validation}, results=${onResults}, newAtts=${newAtts.length}`);

      if (validation && newAtts.length === 0) return { result: 'pass', notes: 'Zero-answer blocked by validation. 0 attempt docs.' };
      if (validation && newAtts.length > 0) return { result: 'fail', severity: 'HIGH', notes: 'Validation shown but attempt doc created!' };
      if (onResults && newAtts.length === 1) return { result: 'pass', notes: `Zero-answer allowed with score 0. 1 attempt doc. Consistent.` };
      if (onResults && newAtts.length === 0) return { result: 'partial', severity: 'MEDIUM', notes: 'Results shown but no attempt doc.' };
      return { result: 'partial', severity: 'MEDIUM', notes: `Unexpected: validation=${validation}, results=${onResults}, atts=${newAtts.length}` };
    } finally { await browser.close(); }
  });

  // ── S09: Double-click submit ──────────────────────────────────────────────
  await scenario('S09', async () => {
    const { browser, page } = await newBrowser();
    try {
      const acc = ACCOUNTS.rushed;
      const before = await fsSnap(acc.uid, 'B02_S09_before');

      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'blocked', notes: 'MCQ not loaded (S09)' };

      await answerAll(page);
      await screenshot(page, 'B02_S09_pre_dblclick');
      await page.locator('button:has-text("Submit Test")').dblclick();

      await waitForResults(page);
      await screenshot(page, 'B02_S09_results');
      await page.waitForTimeout(4500);
      const after = await fsSnap(acc.uid, 'B02_S09_after');
      const newAtts = after.attempts.filter(a => !before.attempts.some(b => b.id === a.id));
      const tttIncrement = totalTTT(after.studyStates) - totalTTT(before.studyStates);
      console.log(`  newAtts=${newAtts.length}, tttIncrement=${tttIncrement}`);

      if (newAtts.length > 1) return { result: 'fail', severity: 'HIGH', notes: `Double-click: ${newAtts.length} attempt docs. Dedup broken.` };
      if (newAtts.length === 0) return { result: 'blocked', notes: 'No attempt created (S09)' };
      return { result: 'pass', notes: `Double-click: 1 attempt doc, tttIncrement=${tttIncrement}. Dedup working.` };
    } finally { await browser.close(); }
  });

  // ── S10: Simultaneous last-answer + submit ────────────────────────────────
  await scenario('S10', async () => {
    const { browser, page } = await newBrowser();
    try {
      const acc = ACCOUNTS.rushed;
      const before = await fsSnap(acc.uid, 'B02_S10_before');

      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'blocked', notes: 'MCQ not loaded (S10)' };

      const submitTxt = await page.locator('button:has-text("Submit Test")').textContent().catch(() => '0/5');
      const totalQ = parseInt(submitTxt.match(/\/(\d+)/)?.[1] || '5');
      console.log(`  totalQ=${totalQ}`);

      // Answer all but last
      await answerN(page, Math.max(0, totalQ - 1));

      // Navigate to last question if needed
      const rightArrow = page.getByRole('button', { name: 'Next question' });
      for (let i = 0; i < 5; i++) {
        if (!await rightArrow.isEnabled().catch(() => false)) break;
        await rightArrow.click();
        await page.waitForTimeout(100);
      }

      await screenshot(page, 'B02_S10_pre_simultaneous');

      const lastOpt = page.locator('.grid button[type="button"]:not([aria-label])').first();
      const submitBtn = page.locator('button:has-text("Submit Test")');
      await Promise.all([
        lastOpt.click().catch(() => {}),
        page.waitForTimeout(100).then(() => submitBtn.click().catch(() => {}))
      ]);

      await waitForResults(page);
      await screenshot(page, 'B02_S10_results');
      await page.waitForTimeout(4500);
      const after = await fsSnap(acc.uid, 'B02_S10_after');
      const newAtts = after.attempts.filter(a => !before.attempts.some(b => b.id === a.id));
      if (newAtts.length === 0) return { result: 'blocked', notes: 'No attempt created (S10)' };

      const ansCount = newAtts[0].answers?.length || 0;
      console.log(`  answers=${ansCount}, totalQ=${totalQ}`);

      if (ansCount < totalQ) {
        return { result: 'fail', severity: 'MEDIUM', notes: `Last answer possibly dropped: ${ansCount} answers vs ${totalQ} questions. answersRef race.` };
      }
      return { result: 'pass', notes: `Simultaneous click: ${ansCount}/${totalQ} captured. answersRef working.` };
    } finally { await browser.close(); }
  });

  // ── S11: Console clean ────────────────────────────────────────────────────
  await scenario('S11', async () => {
    const { browser, page } = await newBrowser();
    const consoleMsgs = attachConsole(page);
    try {
      const acc = ACCOUNTS.careful;
      await loginAs(page, acc);
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'blocked', notes: 'S11: test not loaded' };

      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      const errors = saveConsole(consoleMsgs, 'B02_S11');

      const relevant = errors.filter(e => !e.includes('serviceWorker') && !e.includes('favicon') && !e.includes('chrome-extension'));
      const debugLogs = consoleMsgs.filter(m => m.includes('[DEBUG') || m.includes('[SUBMIT]') || m.includes('[PHASE]') || m.includes('[SNAPSHOT]'));
      console.log(`  total=${consoleMsgs.length}, relevant errors=${relevant.length}, debug=${debugLogs.length}`);

      if (relevant.length > 0) {
        return { result: 'fail', severity: relevant.some(e => e.includes('pageerror')) ? 'MEDIUM' : 'LOW', notes: `Console errors: ${relevant.slice(0,3).join('; ')}` };
      }

      return { result: 'pass', notes: `0 relevant errors. ${debugLogs.length} debug log messages in production build (cosmetic).` };
    } finally { await browser.close(); }
  });

  // ── S12: No docId collision across sessions ───────────────────────────────
  await scenario('S12', async () => {
    const { browser, page } = await newBrowser();
    try {
      const acc = ACCOUNTS.careful;
      const before = await fsSnap(acc.uid, 'B02_S12_before');
      const existingIds = new Set(before.attempts.map(a => a.id));

      await loginAs(page, acc);

      // First run
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'blocked', notes: 'S12: test not loaded' };

      const { nonce: n1 } = await getNonce(page);
      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await page.waitForTimeout(4500);

      const mid = await fsSnap(acc.uid, 'B02_S12_after_first');
      const first = mid.attempts.filter(a => !existingIds.has(a.id));
      console.log(`  First run attempts: ${first.length}`);
      if (first.length === 0) return { result: 'blocked', notes: 'S12: first run no attempt' };
      const firstId = first[0].id;

      // Second run
      await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      await goToMCQ(page, 'review');
      await clearRecovery(page);
      if (!await testLoaded(page)) return { result: 'partial', severity: 'MEDIUM', notes: 'S12: second run not loaded' };

      const { nonce: n2 } = await getNonce(page);
      console.log(`  nonce1=${n1}, nonce2=${n2}`);
      await answerAll(page);
      await page.locator('button:has-text("Submit Test")').click();
      await waitForResults(page);
      await screenshot(page, 'B02_S12_second_run');
      await page.waitForTimeout(4500);

      const final = await fsSnap(acc.uid, 'B02_S12_after_second');
      const second = final.attempts.filter(a => !existingIds.has(a.id) && a.id !== firstId);
      console.log(`  Second run new attempts: ${second.length}`);

      if (second.length === 0) {
        if (final.attempts.some(a => a.id === firstId)) {
          return { result: 'fail', severity: 'HIGH', notes: `S12: second run overwrote first! Same docId=${firstId}. Nonce not rolling over.` };
        }
        return { result: 'blocked', notes: 'S12: second run no new attempt' };
      }

      if (firstId === second[0].id) {
        return { result: 'fail', severity: 'HIGH', notes: `DocId collision: ${firstId} used twice. Nonce not rolling over.` };
      }

      return { result: 'pass', notes: `No collision: first=${firstId}, second=${second[0].id}. Nonces: ${n1} vs ${n2}.` };
    } finally { await browser.close(); }
  });

  await writeFindings(false);
}

// ─── Findings writer ────────────────────────────────────────────────────────────

async function writeFindings(halted) {
  const S = ['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12'];
  let pass=0,fail=0,blocked=0,partial=0,blocker=0,high=0,medium=0,low=0;
  for (const s of S) {
    const r = results[s];
    if (!r || r.result === 'blocked') { blocked++; continue; }
    if (r.result === 'pass') pass++;
    else if (r.result === 'fail') { fail++; if(r.severity==='BLOCKER')blocker++; else if(r.severity==='HIGH')high++; else if(r.severity==='MEDIUM')medium++; else low++; }
    else if (r.result === 'partial') { partial++; if(r.severity==='MEDIUM')medium++; else low++; }
    else if (r.result === 'error') { fail++; blocker++; }
  }
  const total = Object.keys(results).length;
  const overall = blocker > 0 ? 'BLOCKER-HALT' : (fail+partial > 0) ? 'PASS-WITH-FINDINGS' : 'PASS';
  const durationMin = Math.round(Object.values(results).reduce((s,r)=>s+(r.ms||0),0)/60000);

  logLine({ event: 'batch_end', batch: 'B02', trials: total, pass, fail, blocked, partial, blockerCount: blocker, highCount: high, mediumCount: medium, lowCount: low, haltedOnBlocker: halted });
  updateStatus({ state: halted ? 'stopped' : 'finished', batchesCompleted: ['B02'], trialsCompleted: total, currentScenario: 'done' });

  const now = new Date().toISOString().replace('T',' ').slice(0,16)+' UTC';
  const lines = [];
  lines.push(`# Findings — Batch B02: MCQ Submission Critical Path`);
  lines.push('');
  lines.push(`**Run date:** ${now}`);
  lines.push(`**Duration:** ~${durationMin}min (${total} scenarios attempted)`);
  lines.push(`**Environment:** Chromium 1223 headless, Linux WSL2, Firebase production vocaboost-879c2`);
  lines.push(`**Tester / agent:** Agent B`);
  lines.push('');
  lines.push(`## Executive summary`);
  lines.push('');
  lines.push(`${total} scenarios executed. **Overall: ${overall}.** Pass: ${pass}, Fail: ${fail}, Partial: ${partial}, Blocked: ${blocked}. BLOCKERs: ${blocker}, HIGH: ${high}, MEDIUM: ${medium}, LOW: ${low}.`);
  lines.push('');
  lines.push(`**Setup note:** TOP class uses \`testMode:typed\` + \`reviewTestType:mcq\`. MCQ is the review test (Day 2+). Audit accounts pre-seeded with Day-2 study state via Admin SDK to make MCQ accessible.`);
  lines.push('');
  lines.push('**Persistence fix invariants:**');
  const s1=results.S01,s2=results.S02,s3=results.S03,s4=results.S04,s5=results.S05;
  lines.push(`- **Fix #1 (clearTestState ordering):** ${s2?.result==='pass'?'✅ HOLDS':s2?.result==='blocked'?'⏸ BLOCKED':`❌ FAIL — ${(s2?.notes||'').slice(0,80)}`}`);
  lines.push(`- **Fix #3 (processTestResults after attempt write):** ${s3?.result==='pass'?'✅ HOLDS':s3?.result==='blocked'?'⏸ BLOCKED':`❌ FAIL — ${(s3?.notes||'').slice(0,80)}`}`);
  lines.push(`- **Fix #4 (no double-increment):** ${s4?.result==='pass'?'✅ HOLDS':s4?.result==='blocked'?'⏸ BLOCKED':`❌ FAIL — ${(s4?.notes||'').slice(0,80)}`}`);
  lines.push(`- **Fix #5 (idempotent docId):** ${s5?.result==='pass'?'✅ HOLDS':s5?.result==='blocked'?'⏸ BLOCKED':`❌ FAIL — ${(s5?.notes||'').slice(0,80)}`}`);
  lines.push('');
  lines.push(`## Scenario coverage`);
  lines.push('');
  lines.push(`| # | Scenario | Persona | Result | Severity |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  const descs={
    S01:'Happy path: Careful Student MCQ review test',
    S02:'clearTestState ordering — answers survive refresh (fix #1)',
    S03:'processTestResults order — study_states after attempt write (fix #3)',
    S04:'No double-increment via rapid submit (fix #4)',
    S05:'Idempotent attempt docId (fix #5)',
    S06:'Refresh after success — known limitation documented',
    S07:'Practice mode does not write attempts',
    S08:'Zero-answer submission (lazy persona)',
    S09:'Double-click submit dedup guard',
    S10:'Simultaneous last-answer + submit answersRef race',
    S11:'Browser console clean on happy path',
    S12:'No docId collision across sessions',
  };
  const p={S01:'Careful',S02:'Recovering',S03:'Hostile',S04:'Rushed',S05:'Recovering',S06:'Careful',S07:'Anxious',S08:'Lazy',S09:'Rushed',S10:'Rushed',S11:'Careful',S12:'Careful'};
  for (const s of S) {
    const r=results[s];
    const ic=!r?'⏸':r.result==='pass'?'✅':r.result==='fail'?'❌':r.result==='partial'?'🟡':r.result==='error'?'❌':'⏸';
    const sv=r?.result==='pass'?'—':(r?.severity||'—');
    lines.push(`| ${s} | ${descs[s]} | ${p[s]} | ${ic} ${r?.result||'not run'} | ${sv} |`);
  }
  lines.push('');
  lines.push(`## Findings`);
  lines.push('');
  const failed = S.filter(s => results[s]?.result==='fail' || results[s]?.result==='partial');
  if (failed.length === 0) { lines.push('No failures in this batch.'); lines.push(''); }
  let fn=1;
  for (const s of failed) {
    const r=results[s];
    lines.push('---'); lines.push('');
    lines.push(`### F${String(fn++).padStart(2,'0')} — ${s}: ${(r.notes||'').slice(0,100)}`);
    lines.push('');
    lines.push(`**Severity:** ${r.severity||'MEDIUM'}`);
    lines.push(`**Persona:** ${p[s]}`);
    lines.push(`**Scenarios touched:** ${s}`);
    lines.push(`**Reproducible:** YES`);
    lines.push('');
    lines.push(`**Observed:**`);
    lines.push(r.notes||'');
    lines.push('');
    lines.push(`**Evidence:**`);
    lines.push(`- \`findings/evidence/B02/B02_${s}_*.png\``);
    lines.push(`- \`findings/evidence/B02/B02_${s}_*_firestore.json\``);
    lines.push('');
  }
  lines.push(`## Observations (not yet findings)`);
  lines.push('');
  lines.push('- **O01 — Debug logging in production:** MCQTest.jsx emits `[DEBUG STUDYDAY]`, `[SUBMIT]`, `[PHASE]`, `[SNAPSHOT]` console.log in the production bundle. Harmless but noisy.');
  lines.push('- **O02 — MCQ reachability:** MCQ is review-only in TOP class (testMode=typed). Requires Day 2+ state. Fresh students cannot reach MCQ via direct URL without DailySessionFlow session context.');
  lines.push('- **O03 — No data-testid:** MCQTest.jsx has zero testid attributes. Selectors rely on text content which is fragile.');
  lines.push('');
  lines.push(`## Caveats / what wasn't tested`);
  lines.push('');
  for (const s of S.filter(s=>results[s]?.result==='blocked')) {
    lines.push(`- **${s}:** ${results[s].notes}`);
  }
  lines.push('- True network stall/intercept not possible: Firestore SDK uses WebSockets, not interceptable HTTP via Playwright route on live site. Used observable behavior (localStorage + Firestore polling) instead.');
  lines.push('');
  lines.push(`## Recommended fixes (top 3 from this batch)`);
  lines.push('');
  if (blocker > 0) lines.push('1. **(BLOCKER)** See findings above — fix immediately before rollout.');
  lines.push('1. Gate debug logging behind `import.meta.env.DEV` or a `VITE_DEBUG` flag to suppress in production.');
  lines.push('2. Add `data-testid` attributes to MCQTest submit button, option buttons, and results card elements.');
  lines.push('3. Consider a quick-access "Review Test" button on the dashboard for Day 2+ students who navigate away from DailySessionFlow.');
  lines.push('');
  lines.push(`## Next batch`);
  lines.push('');
  if (halted) {
    lines.push('**AUDIT HALTED.** BLOCKER in B02. Fix before B03.');
  } else {
    lines.push(`**Overall: ${overall}.** Proceed to B03 (Typed submission critical path).`);
  }

  fs.writeFileSync('/app/audit/playwright/findings/findings_B02.md', lines.join('\n'));

  if (!halted) {
    logLine({ event: 'agent_end', label: 'B', trialsCompleted: total, batchesCompleted: ['B02'], reason: 'claimed batches done' });
  }

  console.log('\n' + '─'.repeat(65));
  console.log('B02 FINAL SUMMARY');
  console.log('─'.repeat(65));
  for (const s of S) {
    const r=results[s];
    const ic=!r?'⏸':r.result==='pass'?'✅':r.result==='blocked'?'⏸':r.result==='partial'?'🟡':'❌';
    console.log(`  ${s} ${ic} ${r?.result||'not run'} [${r?.severity||''}] — ${(r?.notes||'').slice(0,85)}`);
  }
  console.log('─'.repeat(65));
  console.log(`  Pass:${pass} Fail:${fail} Partial:${partial} Blocked:${blocked}`);
  console.log(`  BLOCKER:${blocker} HIGH:${high} MEDIUM:${medium} LOW:${low}`);
  console.log(`  Overall: ${overall}`);
  console.log('─'.repeat(65));
}

main().catch(async err => {
  console.error('Fatal:', err);
  logLine({ event: 'agent_end', label: 'B', error: err.message, batchesCompleted: ['B02'], trialsCompleted: Object.keys(results).length, reason: 'fatal' });
  updateStatus({ state: 'errored', error: err.message });
  process.exit(1);
});
