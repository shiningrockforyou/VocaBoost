/**
 * Run S — S-1 FLAGSHIP (NEED_TO_FIX #9 acceptance). Flag-ON, live server, sandbox accounts only.
 *
 * Scenario (all through the visible UI): a fresh student joins two classes A + B on the SAME list.
 *   1. In A: complete Day 1 (new-word test pass; Day 1 has no review).
 *   2. In A: study Day 2, PASS the Day-2 new-word test → land on Review-Study → LEAVE via Quit
 *      (assert review-study present + completion card absent before leaving).
 *   3. Switch to B (same list) → enter → COMPLETE the Day-2 review in B and submit.
 *      MUST NOT hit the spurious new-word retake gate (outcome !== 'retake-gate').
 *   4. Re-enter A → assert no retake / no re-review prompt.
 * Then read-only Admin verify:
 *   - class_progress {A}_{L} and {B}_{L} both csd=2, twi=2·pace (no TWI double-advance, converged).
 *   - B's Day-2 review attempt carries A's anchor range (newWordStartIndex/EndIndex == pace..2·pace-1).
 *   - No forced retake observed.
 *
 *   LSR_BUILD_ID=… LSR_AUDIT_PW=… NODE_PATH=/app/node_modules node audit/playwright/lsr_runS1.mjs <runId>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import admin from 'firebase-admin';

const runId = process.argv[2] || `S1_${Date.now()}`;
const AUD = '/app/audit/playwright';
const BUILD_ID = process.env.LSR_BUILD_ID || 'unspecified';
const PACE = 20;                       // Day1 = words 0..19, Day2 = words 20..39 (anchor range for the review)
const THR = 92, TEST_SIZE = 30;

const { BASE, makeFindings, launch, newAuditPage, login, joinClass, switchClass,
        leaveSessionViaQuit, driveNewWordsToTest, driveReviewToTest,
        driveTest, goDashboard, dismissModal, armDialog } = await import('./lsr_ui.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');

const LISTS = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8')).lists;
const LIST = { id: LISTS[0].newId, title: LISTS[0].title };   // TOP clone (the list lsr_teacher_01 can assign)
const TEACHER = 'lsr_teacher_01@vocaboost.test';
const STUDENT = process.env.S1_STUDENT || 'lsr_s39@vocaboost.test'; // PRISTINE sandbox account (fresh per run — prior runs dirty an account)

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const F = makeFindings(`RUNS1_${runId}`);
mkdirSync(`${AUD}/findings`, { recursive: true });

const out = { runId, buildId: BUILD_ID, list: LIST, pace: PACE, student: STUDENT, at: new Date().toISOString(),
  steps: {}, oracle: {}, verdict: 'PENDING' };
const classAName = `25WT RUNS1 A ${runId}`;
const classBName = `25WT RUNS1 B ${runId}`;

console.log(`\n▶ Run S1 flagship (${runId}) — #9 cross-class review acceptance, list=${LIST.title}\n`);
const browser = await launch();
let liveOk = true;

try {
  // ── FIXTURE: teacher creates A + B on the same list; student joins both ──
  const { page: tp } = await newAuditPage(browser, F, 's1-teacher');
  if (!(await login(tp, TEACHER, F))) { F.add('fail', 'teacher login failed'); liveOk = false; }
  let codeA, codeB;
  if (liveOk) {
    await createClass(tp, classAName, F); await assignList(tp, classAName, LIST.title, { pace: PACE, thr: THR, mode: 'typed', testSize: TEST_SIZE }, F);
    codeA = await readJoinCode(tp, classAName, F);
    await createClass(tp, classBName, F); await assignList(tp, classBName, LIST.title, { pace: PACE, thr: THR, mode: 'typed', testSize: TEST_SIZE }, F);
    codeB = await readJoinCode(tp, classBName, F);
    if (!codeA || !codeB) { F.add('fail', 'no join code'); liveOk = false; }
  }
  await tp.context().close().catch(() => {});

  const { page } = await newAuditPage(browser, F, 's1-student');
  if (liveOk && !(await login(page, STUDENT, F))) { F.add('fail', 'student login failed'); liveOk = false; }
  if (liveOk) {
    await joinClass(page, codeA, classAName, F, 's1-A');
    await joinClass(page, codeB, classBName, F, 's1-B');
  }

  // Reload clean to the public entry (clears any stuck in-session/rebuild screen), switch to the
  // target class, and VERIFY the dashboard actually landed on it (the visible "Class: <name>" shows
  // the target) — retrying, because with 2 enrolled classes the default focus can be the other one.
  async function landedOn(className) {
    const escRe = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return page.getByText(escRe(className)).first().isVisible().catch(() => false);
  }
  async function dashReady(className) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      // ACCEPT the beforeunload dialog so navigating away from a stuck in-session/rebuild screen
      // actually proceeds to the dashboard (an auto-dismissed beforeunload cancels the nav → no
      // Class control → switch fails). One-shot, so re-arm each attempt.
      armDialog(page, 'accept');
      await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2500);
      await dismissModal(page).catch(() => {});
      // wait for the Class control to render before switching
      await page.getByRole('button', { name: /Class:/ }).first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
      await switchClass(page, className, F);
      await page.waitForTimeout(1800);
      ok = await landedOn(className);
      if (!ok) F.add('flow-gap', `[${className}] switch attempt ${attempt + 1}: not landed on target class`);
    }
    if (!ok) F.add('fail', `[${className}] could NOT land on target class after 3 attempts`);
    await page.getByRole('button', { name: /start new words|start session|review|continue/i }).first()
      .waitFor({ state: 'visible', timeout: 20000 }).catch(() => F.add('flow-gap', `[${className}] no study affordance after settle`));
    await page.waitForTimeout(500);
    return ok;
  }
  // After a PASSED new-word test, click Continue to advance the session to the review-study screen.
  async function continueAfterPass() {
    const cont = page.getByRole('button', { name: /^continue$|continue to review|start review/i }).first();
    if (await cont.isVisible().catch(() => false)) { await cont.click().catch(() => {}); await page.waitForTimeout(2500); }
  }

  // ── STEP 1: Day 1 in A (new pass; Day 1 has no review → completes) ──
  if (liveOk) {
    await dashReady(classAName);
    const d1new = await driveNewWordsToTest(page, F, 's1-A-d1-new');
    const d1 = d1new.reached ? await driveTest(page, F, 's1-A-d1-new') : { outcome: 'not-reached' };
    out.steps.day1 = { reached: d1new.reached, outcome: d1.outcome };
    console.log(`  Day1 A: reached=${d1new.reached} outcome=${d1.outcome}`);
  }

  // ── STEP 2: Day 2 in A — pass new, advance to review-study, LEAVE before review ──
  if (liveOk) {
    await dashReady(classAName);
    const d2new = await driveNewWordsToTest(page, F, 's1-A-d2-new');
    const d2 = d2new.reached ? await driveTest(page, F, 's1-A-d2-new') : { outcome: 'not-reached' };
    out.steps.day2new = { reached: d2new.reached, outcome: d2.outcome };
    await continueAfterPass(); // results → review-study
    const reviewStudyVisible = await page.getByText(/review|복습|리뷰/i).first().isVisible().catch(() => false);
    const completeVisible = await page.getByText(/day .*complete|완료했|day complete/i).first().isVisible().catch(() => false);
    Object.assign(out.steps.day2new, { reviewStudyVisible, completeVisible });
    console.log(`  Day2 A: reached=${d2new.reached} outcome=${d2.outcome} reviewStudy=${reviewStudyVisible} complete=${completeVisible}`);
    await leaveSessionViaQuit(page, F, 's1-A-d2-leave');
  }

  // ── STEP 3: switch to B, complete the Day-2 review; MUST NOT hit the retake gate ──
  if (liveOk) {
    await dashReady(classBName);
    const rev = await driveReviewToTest(page, F, 's1-B-review');
    const revOut = rev.reached ? await driveTest(page, F, 's1-B-review') : { outcome: 'not-reached' };
    out.steps.reviewInB = { reached: rev.reached, outcome: revOut.outcome };
    console.log(`  Review B: reached=${rev.reached} outcome=${revOut.outcome}`);
    if (revOut.outcome === 'retake-gate') F.add('BUG9-retake', 'B review completion forced a new-word retake gate');
  }

  // ── STEP 4: re-enter A, assert no retake/re-review prompt (A/B convergence) ──
  if (liveOk) {
    await dashReady(classAName);
    const retakeInA = await page.getByText(/이 날을 완료하려면|Day not complete|pass the new-word test/i).first().isVisible().catch(() => false);
    out.steps.reenterA = { retakePrompt: retakeInA };
    console.log(`  Re-enter A: retakePrompt=${retakeInA}`);
    if (retakeInA) F.add('BUG9-Astale', 'A re-entry shows a retake/re-review prompt (A/B divergence)');
  }
} catch (e) {
  F.add('exception', String(e).slice(0, 300)); liveOk = false;
}
await browser.close();

// ── VERIFY (read-only Admin) ──
async function classIdByName(name) { const q = await db.collection('classes').where('name', '==', name).get(); return q.empty ? null : q.docs[0].id; }
const uidByEmail = async (email) => { try { return (await admin.auth().getUserByEmail(email)).uid; } catch { return null; } };
const uid = await uidByEmail(STUDENT);
const aId = await classIdByName(classAName), bId = await classIdByName(classBName);
if (uid && aId && bId) {
  const cp = async (cid) => { const d = await db.collection('users').doc(uid).collection('class_progress').doc(`${cid}_${LIST.id}`).get(); return d.exists ? { csd: d.data().currentStudyDay || 0, twi: d.data().totalWordsIntroduced || 0 } : null; };
  const A = await cp(aId), B = await cp(bId);
  // B's Day-2 review attempt range
  const revSnap = await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', LIST.id)
    .where('sessionType', '==', 'review').where('studyDay', '==', 2).get();
  const bRev = revSnap.docs.map((d) => ({ classId: d.data().classId, nwsi: d.data().newWordStartIndex, nwei: d.data().newWordEndIndex }))
    .find((r) => r.classId === bId) || revSnap.docs.map((d) => d.data())[0] || null;
  out.oracle = {
    A_progress: A, B_progress: B,
    expected: { csd: 2, twi: 2 * PACE, reviewRange: `${PACE}..${2 * PACE - 1}` },
    bReviewAttempt: bRev,
    A_csd_ok: A?.csd === 2, A_twi_ok: A?.twi === 2 * PACE,
    B_csd_ok: B?.csd === 2, B_twi_ok: B?.twi === 2 * PACE,
    bRange_ok: bRev && bRev.nwsi === PACE && bRev.nwei === 2 * PACE - 1,
    no_double_advance: B?.twi === 2 * PACE,
  };
} else {
  F.add('verify-fail', `missing uid/classIds uid=${uid} A=${aId} B=${bId}`);
}

const findings = F.raw || [];
const bugFindings = findings.filter((x) => /BUG9|verify-fail|exception|fail/i.test(x.kind || ''));
const o = out.oracle;
const oracleClean = o && o.A_csd_ok && o.A_twi_ok && o.B_csd_ok && o.B_twi_ok && o.bRange_ok;
const noRetake = out.steps.reviewInB?.outcome !== 'retake-gate' && !out.steps.reenterA?.retakePrompt;
out.verdict = (liveOk && oracleClean && noRetake && bugFindings.length === 0) ? 'PASS'
  : (!liveOk ? 'INVALID (flow incomplete)' : 'FAIL');
out.findings = findings;

writeFileSync(`${AUD}/findings/runS1_${runId}.json`, JSON.stringify(out, null, 2));
console.log(`\n=== S-1 ORACLE ===`);
console.log(JSON.stringify(out.oracle, null, 2));
console.log(`\n${out.verdict === 'PASS' ? '✅' : out.verdict.startsWith('INVALID') ? '⚠️' : '❌'} S-1 ${out.verdict} → findings/runS1_${runId}.json`);
process.exit(out.verdict === 'PASS' ? 0 : 1);
