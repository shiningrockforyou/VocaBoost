/**
 * Run S-Long — PHASE 1: the day-primitive + rebuild diagnosis (design GO, runslong/plan.md v4).
 * v2 — folds the harness code review (Codex r1 + 3-agent, `runslong/rounds/r01_slp1code_adjudication.md`).
 *
 * Goal: prove a bulletproof `advanceOneDay` that reliably drives ONE study day through the LIVE UI,
 * with fail-closed per-day confirmation. EXIT GATE: one PRISTINE student completes 16 consecutive
 * confirmed-persisted days in one class. Plus: DIAGNOSE why the "rebuild" screen fires (owner ruling #2).
 *
 * Evidence contract (owner ruling #1): UI is PRIMARY teeth (DAY badge + Words Introduced MUST match),
 * Firebase is READ-ONLY corroboration (csd/twi delta + exact attempt deltas). NEVER write to advance.
 * Read-only Firebase reads allowed freely per-day (owner amendment) — never substituting a UI action.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *   LSR_BUILD_ID=<deployed build id, REQUIRED> NODE_PATH=/app/node_modules \
 *   node audit/playwright/lsr_runSL_phase1.mjs [runId]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import admin from 'firebase-admin';

const runId = process.argv[2] || `SLP1_${Date.now()}`;
const AUD = '/app/audit/playwright';
const BUILD_ID = process.env.LSR_BUILD_ID;               // REQUIRED (SLP1-7)
const DAYS = parseInt(process.env.SL_DAYS || '16', 10);  // exit gate = 16; <16 is a non-certifying ITERATION (B-1)
const CERT_DAYS = 16;
const SL_MAX_MS = parseInt(process.env.SL_MAX_MS || String(90 * 60 * 1000), 10); // total wall-clock bound (C-7)
const PACE = 20, THR = 92, TEST_SIZE = 30, MODE = 'typed';
// Fatal anomaly kinds — presence fails PASS (SLP1-3 / SLP1r2-2). Matches the kinds lsr_ui.mjs actually
// emits (grep-verified): product/harness failures + severe browser signals. `request-failed` IS fatal
// unless allowlisted (Firestore listen/write channel aborts are expected long-poll noise → allowlisted).
const FATAL_KINDS = new Set([
  'BUG', 'ui-fb-mismatch', 'unexpected-dialog', 'page-error', 'console-error', 'exception', 'fail',
  'verify-fail', 'flow-gap', 'selector-gap', 'modal-dead', 'login-failed', 'request-failed',
]);
// request-failed allowlist: benign ONLY when ALL THREE hold — Firestore host + Listen/Write channel +
// ERR_ABORTED (the realtime long-poll teardown noise). Order-independent so a non-Firestore abort or a
// non-ERR_ABORTED channel failure is NOT waved through (SLP1r3-2, fail-CLOSED).
function isAllowedRequestFailure(detail = '') {
  return /firestore\.googleapis\.com/i.test(detail)
    && /(Listen|Write)\/channel/i.test(detail)
    && /ERR_ABORTED/i.test(detail);
}
function isFatal(x) {
  if (!FATAL_KINDS.has(x.kind)) return false;
  if (x.kind === 'request-failed' && isAllowedRequestFailure(x.detail || '')) return false;
  return true;
}

const startedAt = Date.now();
if (!BUILD_ID) { console.error('LSR_BUILD_ID is REQUIRED (deployed build id) — aborting INVALID'); process.exit(2); }

const { BASE, makeFindings, launch, newAuditPage, login, joinClass, switchClass, goDashboard,
        driveNewWordsToTest, driveReviewToTest, driveTest, readVisibleProgress,
        dismissModal, armDialog, lastDialog, shot } = await import('./lsr_ui.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');

const LISTS = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8')).lists;
const LIST = { id: LISTS[0].newId, title: LISTS[0].title };  // TOP (the assignable list); 3381 words ≫ 320
const TEACHER = 'lsr_teacher_01@vocaboost.test';
const STUDENT = process.env.SL_STUDENT || 'lsr_s41@vocaboost.test'; // PRISTINE per run (asserted in-run)

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const F = makeFindings(`RUNSL_P1_${runId}`);
mkdirSync(`${AUD}/findings`, { recursive: true });

const out = { runId, buildId: BUILD_ID, phase: 1, list: LIST, pace: PACE, student: STUDENT,
  targetDays: DAYS, certDays: CERT_DAYS, at: new Date().toISOString(), className: `25WT RUNSL P1 ${runId}`,
  baseline: null, days: [], rebuilds: [], verdict: 'PENDING', haltReason: null };

const uidByEmail = async (email) => { try { return (await admin.auth().getUserByEmail(email)).uid; } catch { return null; } };

// READ-ONLY Firebase state for the active class + list. Bounded retry so a transient blip is
// "confirmation unavailable, retry" — NOT a spurious HALT (C-5).
async function fbState(uid, classId, { tries = 3 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const cp = await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${LIST.id}`).get();
      const att = await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', LIST.id).get();
      const mine = att.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.classId === classId);
      return {
        csd: cp.exists ? (cp.data().currentStudyDay || 0) : 0,
        twi: cp.exists ? (cp.data().totalWordsIntroduced || 0) : 0,
        newAttempts: mine.filter((a) => a.sessionType === 'new').length,
        reviewAttempts: mine.filter((a) => a.sessionType === 'review').length,
        // duplicate detection: any (studyDay, sessionType) pair appearing >1×
        dupKey: (() => { const seen = {}; let dup = false; for (const a of mine) { const k = `${a.studyDay}/${a.sessionType}`; if (seen[k]) dup = true; seen[k] = 1; } return dup; })(),
      };
    } catch (e) { if (i === tries - 1) return null; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  return null;
}
// POLL Firebase until it reaches the expected csd/twi/attempts (or timeout). The client
// updateClassProgress write can commit AFTER a single read → a stale read would false-HALT a day
// that actually persisted (Lens A #3). Returns the last-read fb (matched or not).
async function fbConfirm(uid, classId, exp, { timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let fb = null;
  while (Date.now() < deadline) {
    fb = await fbState(uid, classId);
    if (fb && fb.csd === exp.csd && fb.twi === exp.twi
        && fb.newAttempts === exp.newAttempts && fb.reviewAttempts === exp.reviewAttempts && !fb.dupKey) return fb;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return fb;
}
async function reconLogsFor(uid, classId, { sinceMs }) {
  try {
    const snap = await db.collection('system_logs').where('type', '==', 'csd_twi_reconciled').get();
    return snap.docs.map((d) => d.data()).filter((x) => x.userId === uid && x.classId === classId
      && (!sinceMs || (x.timestamp?._seconds || 0) * 1000 >= sinceMs)).length;
  } catch { return null; }
}

console.log(`\n▶ Run S-Long Phase 1 (${runId}, build ${BUILD_ID}) — day-primitive, target ${DAYS}/${CERT_DAYS}, list=${LIST.title}\n`);
const browser = await launch();
let classId = null, uid = null, halted = false;
const setHalt = (r) => { if (!halted) { halted = true; out.haltReason = r; } };
let precededByAccept = false; // set when dashReady's armed beforeunload actually fired this day (harness-race signal)

async function dashReady(page, className) {
  const escRe = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  precededByAccept = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    armDialog(page, 'accept');
    const before = lastDialog(page);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2500);
    if (lastDialog(page) && lastDialog(page) !== before) precededByAccept = true;
    await dismissModal(page).catch(() => {});
    // Class control may be a button (multi-class) OR label text (single-class) — short wait, switchClass handles both.
    await page.getByText(/Class:/).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await switchClass(page, className, F);
    await page.waitForTimeout(1500);
    if (await page.getByText(escRe(className)).first().isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /start new words|start session|review|continue/i }).first()
        .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function classifyRebuild(page) {
  if (await page.getByText(/세션을 초기화하지 못했습니다|could not be reset/i).first().isVisible().catch(() => false)) return 'rebuild-clear-failed';
  if (await page.getByText(/세션 정보가 갱신|session was refreshed/i).first().isVisible().catch(() => false)) return 'rebuild';
  return 'clean';
}

// Structured rebuild diagnostic packet (owner ruling #2). All read-only / UI-only.
async function diagnoseRebuild(page, day, at, screen, prev) {
  const dayGuardWarn = (page.__consoleLog || []).filter((l) => /Duplicate day completion blocked|expected day \d+, got day/i.test(l.text)).slice(-1)[0]?.text || null;
  const shotName = `rebuild_d${day}_${at}_${runId}`;
  const shotOk = await shot(page, shotName).catch(() => false);
  const fb = (uid && classId) ? await fbState(uid, classId) : null;
  // Post-rebuild state (SLP1r2-3): did the attempt persist despite the screen? → tells retry how to resume.
  const newPersisted = fb && prev && fb.newAttempts === prev.newAttempts + 1;
  const reviewPersisted = fb && prev && fb.reviewAttempts === prev.reviewAttempts + (day >= 2 ? 1 : 0);
  const packet = {
    day, at, screen, runId, buildId: BUILD_ID, ts: new Date().toISOString(),
    url: page.url(),
    dayGuardWarn,                               // the app's OWN expected-vs-got day (the smoking gun)
    precededByBeforeunloadAccept: precededByAccept, // harness-race discriminator
    lastDialog: lastDialog(page),
    fbAtRebuild: fb,                            // did the attempt persist? did the counter already advance?
    postState: { newPersisted, reviewPersisted },  // how the retry should resume
    reconLogs: (uid && classId) ? await reconLogsFor(uid, classId, { sinceMs: startedAt }) : null,
    screenshot: shotOk ? `${AUD}/findings/${shotName}.png` : null,  // the actual path, not a boolean (SLP1r2-4)
    screenshotOk: shotOk,
    // interpretation: preceded-by-reload + newPersisted ⇒ harness stale-day resubmit;
    // clean submit + counter-advanced-by-reconciliation + no reload ⇒ candidate APP DEFECT.
  };
  out.rebuilds.push(packet);
  return packet;
}

// Drive ONE day. Fail-closed: returns { ok, reason, ... }; caller confirms UI+FB persistence.
// STATE-AWARE (SLP1r2-3): on a retry after a recoverable rebuild, resume from the OBSERVED state
// (FB) rather than blindly re-driving new words — a re-drive can duplicate the new attempt, miss the
// Start button, or re-trip the day-guard. `prev` = the confirmed FB state at the START of this day.
async function advanceOneDay(page, className, dayNum, prev) {
  if (!(await dashReady(page, className))) return { ok: false, reason: 'dash-not-ready' };
  // Where are we, per Firebase? (Did a prior partial attempt persist despite the rebuild screen?)
  const s = (uid && classId) ? await fbState(uid, classId) : null;
  const newDone = s && s.newAttempts === prev.newAttempts + 1;                 // Day-D new already persisted
  const reviewDone = s && s.reviewAttempts === prev.reviewAttempts + (dayNum >= 2 ? 1 : 0);
  if (newDone && reviewDone) return { ok: true, resumed: 'already-complete' }; // rebuild raced but the day persisted

  // NEW words — unless already persisted (then skip straight to review).
  let nwRes = { outcome: 'results' };
  if (!newDone) {
    const nw = await driveNewWordsToTest(page, F, `d${dayNum}-new`);
    if (!nw.reached) return { ok: false, reason: 'new-test-not-reached' };
    nwRes = await driveTest(page, F, `d${dayNum}-new`);
    let rb = await classifyRebuild(page);
    if (rb === 'rebuild-clear-failed') { await diagnoseRebuild(page, dayNum, 'new-submit', rb, prev); return { ok: false, reason: 'rebuild-clear-failed' }; }
    if (nwRes.outcome === 'rebuild' || rb === 'rebuild') { await diagnoseRebuild(page, dayNum, 'new-submit', 'rebuild', prev); return { ok: false, reason: 'rebuild-after-new', recoverable: true }; }
    // A day only counts if the NEW test actually PASSED — a fail/threshold/save-error is a typed failure.
    if (nwRes.outcome !== 'results') return { ok: false, reason: `new-not-passed:${nwRes.outcome}` };
  }

  if (dayNum >= 2 && !reviewDone) {
    // Match the PROVEN driver (lsr_ui.mjs studyOneDay): return to the dashboard, then driveReviewToTest
    // owns the review-study transition. (Lens A #2: stacked in-session + driver clicks over-navigate.)
    await goDashboard(page).catch(() => {});
    await page.waitForTimeout(1500);
    const rv = await driveReviewToTest(page, F, `d${dayNum}-review`);
    if (!rv.reached) { F.add('flow-gap', `[d${dayNum}] review not reached`); return { ok: false, reason: 'review-not-reached' }; }
    const rvRes = await driveTest(page, F, `d${dayNum}-review`);
    const rb = await classifyRebuild(page);
    if (rb === 'rebuild-clear-failed') { await diagnoseRebuild(page, dayNum, 'review-submit', rb, prev); return { ok: false, reason: 'rebuild-clear-failed' }; }
    if (rvRes.outcome === 'rebuild' || rb === 'rebuild') { await diagnoseRebuild(page, dayNum, 'review-submit', 'rebuild', prev); return { ok: false, reason: 'rebuild-after-review', recoverable: true }; }
    if (rvRes.outcome === 'retake-gate') return { ok: false, reason: 'unexpected-retake-gate' };
    if (rvRes.outcome !== 'results') return { ok: false, reason: `review-not-completed:${rvRes.outcome}` };
  }
  return { ok: true };
}

function fatalFindings() { return (F.raw || []).filter(isFatal); }

try {
  // FIXTURE: teacher creates ONE class + assigns the list; verify the assignment EXACTLY (SLP1-5).
  const { page: tp } = await newAuditPage(browser, F, 'p1-teacher');
  if (!(await login(tp, TEACHER, F))) setHalt('teacher-login');
  let code;
  if (!halted) {
    await createClass(tp, out.className, F);
    await assignList(tp, out.className, LIST.title, { pace: PACE, thr: THR, mode: MODE, testSize: TEST_SIZE }, F);
    code = await readJoinCode(tp, out.className, F);
    if (!code) setHalt('no-join-code');
  }
  await tp.context().close().catch(() => {});

  // UNIQUE classId binding (SLP1-6): exactly one class of this (fresh-runId) name.
  if (!halted) {
    const cq = await db.collection('classes').where('name', '==', out.className).get();
    if (cq.size !== 1) { out.verdict = `INVALID (${cq.size} classes named "${out.className}")`; }
    else {
      classId = cq.docs[0].id;
      const a = (cq.docs[0].data().assignments || {})[LIST.id] ?? null; // null (not {}) if the list isn't assigned
      out.assignment = a ? { pace: a.pace, testMode: a.testMode, passThreshold: a.passThreshold, testSizeNew: a.testSizeNew } : null;
      // Enforce EVERY load-bearing setting — wrong mode/threshold/size would silently invalidate the oracle (SLP1r2-1).
      const bad = !a ? 'list not assigned'
        : a.pace !== PACE ? `pace ${a.pace}!=${PACE}`
        : a.testMode !== MODE ? `testMode ${a.testMode}!=${MODE}`
        : (a.passThreshold !== THR) ? `passThreshold ${a.passThreshold}!=${THR}`
        : (a.testSizeNew !== TEST_SIZE) ? `testSizeNew ${a.testSizeNew}!=${TEST_SIZE}`
        : null;
      if (bad) out.verdict = `INVALID (assignment: ${bad})`;
    }
  }

  if (!halted && !out.verdict.startsWith('INVALID')) {
    const { page } = await newAuditPage(browser, F, 'p1-student');
    if (!(await login(page, STUDENT, F))) setHalt('student-login');
    if (!halted) await joinClass(page, code, out.className, F, 'p1');
    uid = await uidByEmail(STUDENT);

    // PRISTINE BASELINE assert (B-4/C-8): the absolute oracle needs csd=0/twi=0/0 attempts at start.
    const base = uid ? await fbState(uid, classId) : null;
    out.baseline = base;
    if (!base || base.csd !== 0 || base.twi !== 0 || base.newAttempts !== 0 || base.reviewAttempts !== 0) {
      out.verdict = `INVALID (non-pristine baseline: ${JSON.stringify(base)})`;
    } else {
      // ── 16-DAY LOOP: bounded rebuild recovery + fail-closed UI+FB+attempt confirmation ──
      let prevTwi = 0, prevCsd = 0, prevNew = 0, prevRev = 0;
      for (let day = 1; day <= DAYS && !halted; day++) {
        if (Date.now() - startedAt > SL_MAX_MS) { setHalt(`wall-clock budget ${SL_MAX_MS}ms exceeded at day ${day}`); break; }
        let dayOk = false, tries = 0, lastReason = null;
        while (tries < 3 && !dayOk && !halted) {
          tries++;
          const r = await advanceOneDay(page, out.className, day, { csd: prevCsd, twi: prevTwi, newAttempts: prevNew, reviewAttempts: prevRev });
          lastReason = r.reason || null;
          if (r.ok) { dayOk = true; break; }
          if (r.reason === 'rebuild-clear-failed') { setHalt(`HARD-STOP rebuild-clear-failed (day ${day}) — app dead-end "tell your teacher"`); break; }
          if (r.recoverable) { console.log(`  day ${day}: recoverable rebuild, retry ${tries}`); await page.waitForTimeout(1500); continue; }
          break;
        }
        // Confirmation: return to a confirmed dashboard, read UI (PRIMARY), then POLL FB (corroboration).
        await dashReady(page, out.className);
        const ui = await readVisibleProgress(page).catch(() => null);
        const expTwi = prevTwi + PACE, expCsd = prevCsd + 1;
        const expNew = prevNew + 1, expRev = prevRev + (day >= 2 ? 1 : 0);
        const exp = { csd: expCsd, twi: expTwi, newAttempts: expNew, reviewAttempts: expRev };
        const fb = (uid && classId) ? await fbConfirm(uid, classId, exp) : null; // polls until expected or timeout
        // UI teeth (owner ruling #1): DAY badge == csd+1 AND Words == twi. Fatal, not soft.
        const uiWordsOk = ui && ui.words === expTwi;
        const uiDayOk = ui && ui.day === expCsd + 1;
        const uiRead = ui != null;
        // FB corroboration incl. EXACT attempt deltas + no duplicates (SLP1-2).
        const fbOk = fb && fb.csd === expCsd && fb.twi === expTwi
          && fb.newAttempts === expNew && fb.reviewAttempts === expRev && !fb.dupKey;
        const confirmed = dayOk && fbOk && uiRead && uiWordsOk && uiDayOk;
        const rec = { day, driven: dayOk, tries, lastReason,
          ui: ui ? { words: ui.words, day: ui.day } : null, uiRead, uiWordsOk, uiDayOk,
          fb, expected: { csd: expCsd, twi: expTwi, newAttempts: expNew, reviewAttempts: expRev },
          fbOk, confirmed };
        out.days.push(rec);
        console.log(`  day ${day}: driven=${dayOk}(${tries}x) UI[words=${ui?.words}/exp${expTwi} day=${ui?.day}/exp${expCsd + 1}] FB[csd=${fb?.csd} twi=${fb?.twi} new=${fb?.newAttempts} rev=${fb?.reviewAttempts} dup=${fb?.dupKey}] confirmed=${confirmed}`);
        if (!confirmed) {
          if (!uiRead) F.add('flow-gap', `day ${day}: UI progress unreadable`);
          else if (!uiWordsOk || !uiDayOk) F.add('ui-fb-mismatch', `day ${day}: UI words=${ui.words}/exp${expTwi} day=${ui.day}/exp${expCsd + 1}`);
          setHalt(out.haltReason || `day ${day} not confirmed (driven=${dayOk} fbOk=${fbOk} uiWords=${uiWordsOk} uiDay=${uiDayOk} reason=${lastReason})`);
          break;
        }
        prevTwi = expTwi; prevCsd = expCsd; prevNew = expNew; prevRev = expRev;
      }
    }
    await page.context().close().catch(() => {});
  }
} catch (e) {
  F.add('exception', String(e).slice(0, 250)); setHalt(`exception: ${String(e).slice(0, 200)}`);
} finally {
  await browser.close().catch(() => {});
}

const confirmedDays = out.days.filter((d) => d.confirmed).length;
out.confirmedDays = confirmedDays;
out.rebuildCount = out.rebuilds.length;
const fatals = fatalFindings();
out.fatalFindings = fatals.map((f) => `${f.kind}: ${f.detail}`);

if (out.verdict.startsWith('INVALID')) { /* keep */ }
else if (halted && out.haltReason?.startsWith('HARD-STOP')) out.verdict = `HALT (${out.haltReason})`;
else if (halted || confirmedDays < DAYS) out.verdict = `INCOMPLETE (${confirmedDays}/${DAYS} confirmed; ${out.haltReason || 'unknown'})`;
else if (fatals.length) out.verdict = `FAIL (fatal findings: ${fatals.map((f) => f.kind).join(',')})`;
else if (DAYS < CERT_DAYS) out.verdict = `ITERATION ${confirmedDays}/${DAYS} (non-certifying; need ${CERT_DAYS})`;
else out.verdict = `PASS ${confirmedDays}/${CERT_DAYS} (primitive proven)`;

writeFileSync(`${AUD}/findings/runSL_phase1_${runId}.json`, JSON.stringify(out, null, 2));
console.log(`\n=== PHASE 1 (${BUILD_ID}) ===`);
console.log(`confirmed: ${confirmedDays}/${DAYS} | rebuilds: ${out.rebuildCount} | fatal findings: ${fatals.length} | halt: ${out.haltReason || 'none'}`);
if (out.rebuilds.length) console.log(`rebuild diagnosis:\n${out.rebuilds.map((r) => `  d${r.day} ${r.at} ${r.screen} | warn="${r.dayGuardWarn || '-'}" | reload=${r.precededByBeforeunloadAccept} | fbTwi=${r.fbAtRebuild?.twi}`).join('\n')}`);
console.log(`\n${out.verdict.startsWith('PASS') ? '✅' : out.verdict.startsWith('HALT') ? '🛑' : out.verdict.startsWith('ITERATION') ? '🔁' : '⚠️'} ${out.verdict} → findings/runSL_phase1_${runId}.json`);
process.exit(out.verdict.startsWith('PASS') ? 0 : 1);
