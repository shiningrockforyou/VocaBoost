/**
 * Run S-Long — #10 REGRESSION OVERLAY (plan docs/plans/loop/fix10/plan.md §8). v2.
 *
 * v2 folds the harness code review (Codex FIX10_OVERLAY_CODE r1 + 3-agent fable audit,
 * `docs/plans/loop/fix10/rounds/r03_overlay_synthesis.md`). See the CHANGELOG block below.
 *
 * Proves/guards the NEED_TO_FIX #10 fix: the flag-ON pre-completion reconciliation self-race that
 * stale-blocks a session-final completion into the spurious "session refreshed" rebuild.
 *
 * Why DISCRIMINATING asserts (not csd/twi): the BROKEN build ALSO ends a day at csd+1/twi+pace
 * (reconciliation writes the same finals) — only recentSessions / the sessions-doc / session_states
 * phase / the reconcile+guard logs differ. So the oracle reads THOSE, in a TIGHT window.
 *
 * MATRIX (4 cells) = {Day-1 new-final, Day-2+ review-final} × {typed→TypedTest.jsx, mcq→MCQTest.jsx}.
 * Each cell measures ONE session-final completion and asserts:
 *   d1 UI: no rebuild/"session refreshed"; results screen reached AND the final test PASSED.
 *   d2 recentSessions gained EXACTLY one entry with day === N.
 *   d3 exactly ONE new users/{uid}/sessions doc (dayNumber === N).
 *   d4 session_states phase === 'complete'.
 *   d5 ZERO new day_guard_rejected_session_cleared logs (user/class/list) in the window.
 *   d6 ZERO new csd_twi_reconciled events (user/class/list) in the TIGHT window — a RACE DETECTOR
 *      (survives a future Fix B), not the sole oracle. (d7 progressSnapshot is a DIAGNOSTIC, not gating.)
 *
 * MODES (FIX10_EXPECT):
 *   green (default, POST-fix): every cell must be green (all of d1-d6). PASS iff all cells green + 0 fatal.
 *   red   (PRE-fix, run against the UNFIXED + flag-ON build): every cell must show the #10 SIGNATURE
 *         (rebuild UI AND +1 guard-reject AND a preceding csd_twi_reconciled, NOT preceded by a harness
 *         beforeunload-reload). A single run = REPRO-CANDIDATE; REPRO-CONFIRMED needs a 2nd matching run
 *         on the SAME build (state file) — §8 "N≥2 consecutive runs".
 *
 * Evidence contract (owner rulings): UI is PRIMARY teeth; Firebase is READ-ONLY corroboration — NEVER
 * written to advance a run. Sandbox only (25WT / lsr_* / fresh classes).
 *
 * ── CHANGELOG v1→v2 (review folds) ─────────────────────────────────────────────────────────────────
 *  A1/B5/F10O-2/my-catch: reads are POLL-UNTIL-STABLE, not read-once. `before` drains the async
 *     session-entry recon/guard log (progressService.js:253 logSystemEvent is NOT awaited) before opening
 *     the window; `after` re-reads recentSessions/sessions/phase/logs until stable (the sessions doc is a
 *     SEPARATE batch committed after updateClassProgress — studyService.js:659-672). settle non-advance +
 *     a failed final are NOT-MEASURED, not fix-FAILs.
 *  C1: assert the RENDERED page identity (typed-input XOR mcq-arrow) matches cell.mode → INVALID on mismatch
 *     (else an mcq class mis-rendering typed would exercise TypedTest and print green for MCQTest).
 *  C3/B4: verify the final test actually PASSED (fail-text absent) — a sub-threshold final also shows a
 *     `%` results screen; treat a non-pass as final-not-passed (NOT-MEASURED), not a fix regression.
 *  B3: precededByAccept (the harness beforeunload-reload — the prime rebuild confounder) is RECORDED per
 *     cell + a rebuild packet (dayGuardWarn + lastDialog) captured; a RED signature cell preceded by an
 *     accepted reload does NOT count.
 *  F10O-1/A2/B6: driveNewPass RESUMES on a rebuild (the broken build persists the day via reconcile) so
 *     Day-2 setup can reach the review-final on BOTH builds → red Day-2 cells become reachable.
 *  F10O-3/B1: fatal-findings gate is applied BEFORE both green AND red verdicts.
 *  C2/B2/A5: RED "N≥2" is consecutive RUNS (state file), not cells-in-one-run.
 *  F10O-4/B7: pristine baseline also requires ZERO study_states for LIST.id; a dirty/invalid cell →
 *     INVALID verdict (the invalid flag is now consumed).
 *  A3: a d6-only failure with an in-window attempt_day_fallback log is the sessionContext-lost fallback,
 *     NOT #10 → does not count as a fix regression.
 *  A4: the redSignature also accepts the clear-FAILED variant (rebuild-clear-failed + day_guard_session_clear_FAILED).
 *  C7: red mode asserts the reconcile TIMESTAMP precedes the guard rejection (logCountTs returns latestMs).
 *  C4/B8/B9/C9/C10: negControl set unconditionally; unified exit codes; fatals surfaced even on INCOMPLETE;
 *     settle comment carries the §8 nav-interrupt rationale; dead code removed.
 *  KNOWN follow-up (not fixed here — shared helper): lsr_ui.mjs's `'results'` matcher /%|score|correct/i is
 *     loose (can match test-page text); the poll-until-stable + settle + PASS-verify above neutralize its
 *     false-RED locally. Tightening the shared matcher is deferred (it affects Phase-1 + other harnesses).
 *
 * ── CHANGELOG v2→v3 (Run 1 live driver iteration — FIX10_OVERLAY_BUILD_LOG.md; NO oracle change) ──────
 *  R1-3: SETTLE_MS 25s→90s (the csd-advance wait) — typed grading runs through the slow AI-grading fn, so
 *     25s left TD1 `unsettled`; MCQ grades instantly. stableRead gets its OWN shorter STABLE_TIMEOUT (25s).
 *  R1-4: bounded reach-retry (`reachTest`) around setup + measure — nav to the test page (skip-to-test /
 *     session menu) is flaky across days; on a miss, reload to a fresh dashboard and re-drive (BEFORE the
 *     measurement window opens → oracle-safe).
 *  R1-1: `flow-gap`/`selector-gap` REMOVED from FATAL — in this overlay they can only make a cell
 *     NOT-MEASURED (→ INCOMPLETE, never PASS) or a sub-threshold final (→ NOT-MEASURED via finalFailVisible);
 *     neither yields a false-GREEN. Load-bearing guards unchanged: the 6 discriminators + bindAndVerifyClass
 *     + finalFailVisible + measured<CELLS gate. FAIL-CLOSED PRESERVED (self-verified). Still recorded, just
 *     not verdict-gating. (Applied WITHOUT re-audit — owner-approved as a driver tweak; invariant re-checked.)
 *
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
 *   LSR_BUILD_ID=<deployed build id, REQUIRED> [FIX10_EXPECT=green|red] [FIX10_NEGCTL=1] \
 *   [FIX10_S_TD1=… FIX10_S_TD2=… FIX10_S_MD1=… FIX10_S_MD2=…] [FIX10_MAX_MS=3600000] \
 *   [FIX10_SETTLE_MS=90000] [FIX10_STABLE_MS=25000] \
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_fix10_overlay.mjs [runId]
 *
 *   green: run against the DEPLOYED FIXED build. red: run against an UNFIXED + flag-ON (LIST_SCOPED_RECON=true
 *   at build time) build, TWICE consecutively on the same LSR_BUILD_ID for REPRO-CONFIRMED.
 *   MCQ cells depend on wordmap.json coverage of the served words (a gap → the MCQ final may miss threshold →
 *   the cell is NOT-MEASURED, never a false fix-FAIL). Sandbox only (25WT / lsr_* / fresh classes).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import admin from 'firebase-admin';

const runId = process.argv[2] || `FIX10_${Date.now()}`;
const AUD = '/app/audit/playwright';
const BUILD_ID = process.env.LSR_BUILD_ID;                       // REQUIRED — pin the deployed build
const EXPECT = (process.env.FIX10_EXPECT || 'green').toLowerCase(); // 'green' (post-fix) | 'red' (pre-fix)
const RUN_NEGCTL = process.env.FIX10_NEGCTL === '1';
const PACE = 20, THR = 92, TEST_SIZE = 30;
const MAX_MS = parseInt(process.env.FIX10_MAX_MS || String(60 * 60 * 1000), 10);
const SETTLE_MS = parseInt(process.env.FIX10_SETTLE_MS || '90000', 10);  // v3: csd-advance wait — typed grading
                                                                          // runs through the slow AI-grading fn
                                                                          // (MCQ grades instantly); 25s was too short.
const STABLE_TIMEOUT = parseInt(process.env.FIX10_STABLE_MS || '25000', 10); // v3: the poll-until-stable reads have
                                                                          // their OWN (shorter) budget — they return
                                                                          // early on stable; not the settle wait.
const STABLE_POLLS = 2, STABLE_INTERVAL = 2500;                  // poll-until-stable: N identical reads
const REACH_RETRIES = 2;                                         // v3: bounded reach-retry (nav to test is flaky)
const RED_STATE = `${AUD}/findings/fix10_red_state.json`;       // consecutive-run tracker (red mode)
const HARNESS_REV = 'v5';                                       // bump on harness edits so a stale candidate
const CELL_SET = 'TD1,TD2,MD1,MD2';                             // can't confirm across changes (Codex r2 note)

if (!BUILD_ID) { console.error('LSR_BUILD_ID is REQUIRED (deployed build id) — aborting INVALID'); process.exit(2); }
if (!['green', 'red'].includes(EXPECT)) { console.error(`FIX10_EXPECT must be green|red (got ${EXPECT})`); process.exit(2); }

// v3: `flow-gap`/`selector-gap` are DRIVER-REACHABILITY signals (nav to test page, an assign/choice
// selector) — they REMOVED from FATAL because in THIS overlay they can only make a cell NOT-MEASURED
// (→ INCOMPLETE, never PASS) or, during MCQ answering, a sub-threshold final (→ NOT-MEASURED via
// finalFailVisible). Neither produces a false-GREEN: the load-bearing guards are the 6 discriminators +
// bindAndVerifyClass (assignment) + finalFailVisible (pass) + the measured<CELLS PASS-gate. They stay
// RECORDED (visible in findings) — just not verdict-gating. All CORRUPTION signals below remain fatal.
const FATAL_KINDS = new Set([
  'BUG', 'ui-fb-mismatch', 'unexpected-dialog', 'page-error', 'console-error', 'exception', 'fail',
  'verify-fail', 'modal-dead', 'login-failed', 'request-failed',
]);
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

const { BASE, makeFindings, launch, newAuditPage, login, joinClass, switchClass, goDashboard,
        driveNewWordsToTest, driveReviewToTest, driveTest,
        dismissModal, armDialog, lastDialog, shot, sleep, clearCompletionIfPresent,
        returnFromResultsAndClearCompletion } = await import('./lsr_ui.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');

const LISTS = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8')).lists;
const LIST = { id: LISTS[0].newId, title: LISTS[0].title };  // TOP (the assignable list)
const TEACHER = 'lsr_teacher_01@vocaboost.test';

// Each cell = its OWN pristine student. Two share the typed class, two the mcq class; every read is
// per-(user,class,list) so there is no cross-talk. Pristine is ASSERTED in-run (csd/twi/attempts AND
// study_states for LIST.id) → INVALID if not.
const CELLS = [
  { name: 'TD1', mode: 'typed', dayNum: 1, isReview: false, classKey: 'typed', student: process.env.FIX10_S_TD1 || 'lsr_s43@vocaboost.test', path: 'TypedTest' },
  { name: 'TD2', mode: 'typed', dayNum: 2, isReview: true,  classKey: 'typed', student: process.env.FIX10_S_TD2 || 'lsr_s44@vocaboost.test', path: 'TypedTest' },
  { name: 'MD1', mode: 'mcq',   dayNum: 1, isReview: false, classKey: 'mcq',   student: process.env.FIX10_S_MD1 || 'lsr_s45@vocaboost.test', path: 'MCQTest' },
  { name: 'MD2', mode: 'mcq',   dayNum: 2, isReview: true,  classKey: 'mcq',   student: process.env.FIX10_S_MD2 || 'lsr_s46@vocaboost.test', path: 'MCQTest' },
];

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const F = makeFindings(`FIX10_${runId}`);
mkdirSync(`${AUD}/findings`, { recursive: true });

const out = { runId, buildId: BUILD_ID, expect: EXPECT, list: LIST, pace: PACE, at: new Date().toISOString(),
  classes: {}, cells: [], negControl: null, verdict: 'PENDING', invalid: null };
const startedAt = Date.now();

const uidByEmail = async (email) => { try { return (await admin.auth().getUserByEmail(email)).uid; } catch { return null; } };

// ── READ-ONLY Firebase discriminators (all per-(uid, classId, LIST.id)) ──
async function fbProgress(uid, classId) {
  const cp = await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${LIST.id}`).get();
  const d = cp.exists ? cp.data() : {};
  const rs = Array.isArray(d.recentSessions) ? d.recentSessions : [];
  const snap = d.progressSnapshot || null;
  return { exists: cp.exists, csd: d.currentStudyDay || 0, twi: d.totalWordsIntroduced || 0,
    recentLen: rs.length, lastDay: rs.length ? (rs[rs.length - 1].day ?? null) : null, days: rs.map((s) => s.day ?? null),
    snapshot: snap ? { day: snap.snapshotDayNumber ?? null, csd: snap.currentStudyDay ?? null } : null };
}
async function attemptsState(uid, classId) {
  const att = await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', LIST.id).get();
  const mine = att.docs.map((x) => x.data()).filter((a) => a.classId === classId);
  return { newAttempts: mine.filter((a) => a.sessionType === 'new').length, reviewAttempts: mine.filter((a) => a.sessionType === 'review').length };
}
// F10O-4: study_states are LIST/word-scoped (not class-scoped); a reused account can carry old word state
// for LIST.id while showing zero class progress. A pristine cell must have NONE.
async function studyStatesForList(uid) {
  try { const s = await db.collection('users').doc(uid).collection('study_states').where('listId', '==', LIST.id).get(); return s.size; }
  catch { return null; }
}
async function sessionsInfo(uid, classId) {
  const snap = await db.collection('users').doc(uid).collection('sessions').get();
  const mine = snap.docs.map((x) => x.data()).filter((s) => s.classId === classId && s.listId === LIST.id);
  return { count: mine.length, days: mine.map((s) => s.dayNumber ?? s.day ?? null) };
}
async function sessionPhase(uid, classId) {
  const ss = await db.collection('users').doc(uid).collection('session_states').doc(`${classId}_${LIST.id}`).get();
  return ss.exists ? (ss.data().phase ?? null) : null;
}
// Count + latest-timestamp of system_logs of a type for this (uid, classId, listId). Type-scoped query +
// client filter (index-free). latestMs lets red mode assert reconcile PRECEDES the guard reject (C7).
// Returns null on error → callers treat null as "unavailable" (fail-closed, never "zero new").
async function logCountTs(type, uid, classId) {
  try {
    const snap = await db.collection('system_logs').where('type', '==', type).get();
    const mine = snap.docs.map((x) => x.data()).filter((x) => x.userId === uid && x.classId === classId && x.listId === LIST.id);
    const latestMs = mine.reduce((m, x) => Math.max(m, (x.timestamp?._seconds || x.createdAt?._seconds || 0) * 1000), 0);
    return { count: mine.length, latestMs };
  } catch { return null; }
}

async function classifyRebuild(page) {
  if (await page.getByText(/세션을 초기화하지 못했습니다|could not be reset/i).first().isVisible().catch(() => false)) return 'rebuild-clear-failed';
  if (await page.getByText(/세션 정보가 갱신|session was refreshed/i).first().isVisible().catch(() => false)) return 'rebuild';
  return 'clean';
}
function dayGuardWarnFrom(page) {
  return (page.__consoleLog || []).filter((l) => /Duplicate day completion blocked|expected day \d+, got day/i.test(l.text)).slice(-1)[0]?.text || null;
}

let precededByAccept = false;
async function freshDashboard(page, className) {
  const escRe = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  precededByAccept = false;
  // Clear a stale COMPLETE session_state FIRST (only "Back to Dashboard" clears it; a reload does not) →
  // else the next day inherits phase=complete and shows a "Day N Complete" wall (DailySessionFlow.jsx:751/1787).
  await clearCompletionIfPresent(page).catch(() => {});
  for (let attempt = 0; attempt < 3; attempt++) {
    armDialog(page, 'accept');
    const before = lastDialog(page);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(2500);
    if (lastDialog(page) && lastDialog(page) !== before) precededByAccept = true;
    await dismissModal(page).catch(() => {});
    await page.getByText(/Class:/).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await switchClass(page, className, F);
    await sleep(1500);
    if (await page.getByText(escRe(className)).first().isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /start new words|start session|review|continue/i }).first()
        .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

// C1: after reaching the final test, assert the RENDERED page matches the class mode. typed → definition
// inputs; mcq → the Next/Previous-question nav. Returns 'typed'|'mcq'|null(ambiguous/none).
async function observedMode(page) {
  const typed = await page.locator('input[placeholder*="definition" i]').first().isVisible().catch(() => false);
  const mcq = await page.getByRole('button', { name: /Next question|Previous question/ }).first().isVisible().catch(() => false);
  if (typed && !mcq) return 'typed';
  if (mcq && !typed) return 'mcq';
  return null;
}
// C3/B4: is a FAIL/retake verdict visible? (a sub-threshold final still shows a `%` results screen)
async function finalFailVisible(page) {
  return page.getByText(/retake required|불합격|not complete|이 날을 완료하려면|Day not complete/i).first().isVisible().catch(() => false);
}

// Generic poll-until-stable: call reader() until STABLE_POLLS consecutive identical keys, or deadline.
// v3: default budget is STABLE_TIMEOUT (its own, shorter than the settle csd-wait — stable reads return early).
async function stableRead(reader, keyer, { timeoutMs = STABLE_TIMEOUT } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last = null, lastKey = null, streak = 0;
  while (Date.now() < deadline) {
    const v = await reader();
    const k = keyer(v);
    if (k !== null && k === lastKey) { streak++; if (streak >= STABLE_POLLS - 1) return v; }
    else { streak = 0; }
    last = v; lastKey = k;
    await sleep(STABLE_INTERVAL);
  }
  return last;
}

// SETTLE-before-navigate (plan §8): poll until the completion lands (csd advanced) OR timeout, so `after`
// closes the window BEFORE any reload. NOTE (keep — §8/§9.2 nav-interrupt rationale, do NOT delete as an
// obsolete #10 workaround): the settle also guards a DIFFERENT live hazard — navigating/unmounting between
// the attempt write and updateClassProgress interrupts the completion chain → the day later "completes" via
// silent reconciliation with no recentSessions/sessions record. csd advances in BOTH fixed and broken
// builds (the broken build's reconcile advances it) → settle is a "completion attempted" signal, NOT the
// oracle; the discriminators judge.
async function settle(uid, classId, beforeCsd) {
  const deadline = Date.now() + SETTLE_MS;
  while (Date.now() < deadline) {
    const p = await fbProgress(uid, classId);
    if (p.csd >= beforeCsd + 1) return { advanced: true, csd: p.csd };
    await sleep(2000);
  }
  const p = await fbProgress(uid, classId);
  return { advanced: p.csd >= beforeCsd + 1, csd: p.csd };
}

// v3: bounded reach-retry. Navigating to the test page (skip-to-test menu / session menu) is flaky across
// days; on a miss, reload to a fresh dashboard and re-drive. This is BEFORE the measurement window opens
// (the `before` snapshot is taken after reach), so a reload here is oracle-safe.
async function reachTest(page, className, isReview, label) {
  for (let attempt = 0; attempt < REACH_RETRIES; attempt++) {
    const r = isReview ? await driveReviewToTest(page, F, label) : await driveNewWordsToTest(page, F, label);
    if (r.reached) return r;
    if (attempt < REACH_RETRIES - 1) { await freshDashboard(page, className); await sleep(1200); }
  }
  return { reached: false };
}

// Drive + MEASURE one session-final completion. Window opens AFTER the session-entry reach and closes at
// settle — NOT spanning any dashboard reload (Codex R2 boundary).
async function measureCompletion(page, cell, uid, classId, className) {
  const label = `${cell.name}-d${cell.dayNum}-${cell.isReview ? 'review' : 'new'}`;
  const reach = await reachTest(page, className, cell.isReview, label);
  if (!reach.reached) return { cell: cell.name, ok: false, reason: 'final-test-not-reached' };
  // C1: the rendered page MUST match the class mode, else the matrix's "4 paths exercised" claim is false.
  const om = await observedMode(page);
  if (om !== cell.mode) return { cell: cell.name, ok: false, reason: `page-mode-mismatch:want=${cell.mode}/got=${om}`, invalid: true };

  // OPEN the tight window HERE — right before the final submit. First DRAIN the async session-entry log
  // (F10O-2: progressService.js:253 logSystemEvent is fire-and-forget → an entry-recon log can land AFTER a
  // naive `before`); stabilize the counts, THEN snapshot `before`.
  await stableRead(() => logCountTs('csd_twi_reconciled', uid, classId), (v) => (v ? v.count : null));
  const before = {
    recon: await logCountTs('csd_twi_reconciled', uid, classId),
    guard: await logCountTs('day_guard_rejected_session_cleared', uid, classId),
    guardFailed: await logCountTs('day_guard_session_clear_FAILED', uid, classId),
    fallback: await logCountTs('attempt_day_fallback', uid, classId),
    prog: await fbProgress(uid, classId),
    sessions: await sessionsInfo(uid, classId),
  };
  const submit = await driveTest(page, F, label);   // submit + wait for outcome; NO navigation after
  const uiRebuild = await classifyRebuild(page);
  const dgWarn = dayGuardWarnFrom(page);
  const packet = uiRebuild !== 'clean'
    ? { screen: uiRebuild, dayGuardWarn: dgWarn, lastDialog: lastDialog(page), precededByAccept,
        screenshot: (await shot(page, `fix10_${cell.name}_rebuild_${runId}`).catch(() => false)) ? `${AUD}/findings/fix10_${cell.name}_rebuild_${runId}.png` : null }
    : null;

  // C3/B4: a sub-threshold final also renders a `%` results screen — if the FINAL wasn't passed, this cell
  // never reached a genuine completion. NOT-MEASURED (harness/wordmap), NOT a fix regression.
  const failVisible = await finalFailVisible(page);
  if (uiRebuild === 'clean' && (submit.outcome !== 'results' || failVisible)) {
    return { cell: cell.name, ok: false, reason: `final-not-passed:${submit.outcome}${failVisible ? '/fail-visible' : ''}` };
  }

  const settled = await settle(uid, classId, before.prog.csd);
  // B5: if the completion never landed and there was no rebuild, the snapshot is unsettled — NOT-MEASURED.
  if (!settled.advanced && uiRebuild === 'clean') {
    return { cell: cell.name, ok: false, reason: 'unsettled', before, settled };
  }

  const N = cell.dayNum;
  // A1/my-catch/B10: poll `after` until the discriminator reads stabilize (the sessions doc is a SEPARATE
  // batch committed after updateClassProgress; the recon/guard logs are async) — never a single stale read.
  const after = await stableRead(
    async () => ({
      recon: await logCountTs('csd_twi_reconciled', uid, classId),
      guard: await logCountTs('day_guard_rejected_session_cleared', uid, classId),
      guardFailed: await logCountTs('day_guard_session_clear_FAILED', uid, classId),
      fallback: await logCountTs('attempt_day_fallback', uid, classId),
      prog: await fbProgress(uid, classId),
      sessions: await sessionsInfo(uid, classId),
      phase: await sessionPhase(uid, classId),
    }),
    // Stabilize on ALL discriminator reads incl. the secondary guardFailed/fallback (Codex r2 note 1).
    (v) => (v.prog && v.sessions && v.recon && v.guard && v.guardFailed && v.fallback
      ? `${v.prog.recentLen}/${v.sessions.count}/${v.phase}/${v.recon.count}/${v.guard.count}/${v.guardFailed.count}/${v.fallback.count}` : null),
  );

  // null-safe: a null log read (query error) must NOT masquerade as "zero new" → fail the discriminator.
  const reconOk = before.recon != null && after.recon != null;
  const guardOk = before.guard != null && after.guard != null;
  const gfOk = before.guardFailed != null && after.guardFailed != null;
  const fbOk = before.fallback != null && after.fallback != null;
  // A3: an in-window attempt_day_fallback means the sessionContext-lost pre-attempt getOrCreateClassProgress
  // fired (a legitimate, self-identifying reconcile) — NOT #10. Exonerates a d6 miss.
  const fallbackInWindow = fbOk && after.fallback.count > before.fallback.count;
  const d = {
    d1_uiClean: submit.outcome === 'results' && uiRebuild === 'clean' && !failVisible,
    d2_recentPlus1: after.prog.recentLen === before.prog.recentLen + 1 && after.prog.lastDay === N,
    d3_sessionsPlus1: after.sessions.count === before.sessions.count + 1 && after.sessions.days.includes(N),
    d4_stateComplete: after.phase === 'complete',
    d5_noGuard: guardOk && after.guard.count === before.guard.count && gfOk && after.guardFailed.count === before.guardFailed.count,
    d6_noRecon: reconOk && (after.recon.count === before.recon.count || fallbackInWindow),
  };
  // d7 DIAGNOSTIC (not gating): post-fix the retake-rewind snapshot stores PRE-completion values
  // (snapshotDayNumber===N, currentStudyDay===N-1); the broken build stored the post-reconcile N. §5/§7.
  const d7_snapshot = after.prog.snapshot ? { day: after.prog.snapshot.day, csd: after.prog.snapshot.csd, expectCsd: N - 1 } : null;
  const green = Object.values(d).every(Boolean);

  // #10 SIGNATURE (pre-fix): rebuild UI + a NEW guard reject + a preceding reconcile (timestamp precedes
  // the guard). A4: also accept the clear-FAILED variant. B3: NOT counted if a harness beforeunload-reload
  // preceded it (that is the harness's own confounder, not #10).
  const guardDelta = guardOk && after.guard.count === before.guard.count + 1;
  const guardFailedDelta = gfOk && after.guardFailed.count === before.guardFailed.count + 1;
  const reconDelta = reconOk && after.recon.count > before.recon.count;
  const reconPrecedesGuard = reconOk && (guardOk && after.guard.latestMs > 0) ? after.recon.latestMs <= after.guard.latestMs : true;
  const rebuiltUI = submit.outcome === 'rebuild' || uiRebuild === 'rebuild' || uiRebuild === 'rebuild-clear-failed';
  const redSignature = rebuiltUI && (guardDelta || guardFailedDelta) && reconDelta && reconPrecedesGuard && !precededByAccept;

  return { cell: cell.name, path: cell.path, mode: cell.mode, dayNum: N, isReview: cell.isReview,
    ok: true, submitOutcome: submit.outcome, uiRebuild, observedMode: om, precededByAccept,
    before, after, discriminators: d, d7_snapshot, green, redSignature, redConfounded: (rebuiltUI && precededByAccept),
    packet, settled };
}

// v4: poll until the student's NEW-attempt count reaches a target (or timeout). This is the right
// confirmation for "the new test passed and persisted" on ANY day — the csd counter only advances on the
// SESSION-FINAL test (day-1 new; day-2+ review), so a day-2 new pass leaves csd unchanged.
async function pollNewAttempts(uid, classId, targetNew, { timeoutMs = SETTLE_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const a = await attemptsState(uid, classId);
    if (a.newAttempts >= targetNew) return a;
    await sleep(2000);
  }
  return null;
}

// Drive the NEW portion of a day and require a PASS (UNMEASURED setup for a Day-2 cell). v4: confirm via
// NEW-ATTEMPT persistence, not csd — on day 1 the new test IS the session-final (csd advances) but on day 2+
// the new test is NOT final (csd stays; only the later review completes the day). Confirming csd for a day-2
// new pass was the RUN-3 bug (`setup-d2new:setup-unsettled`). RESUMES on a rebuild (F10O-1/B6): the broken
// build still persists via reconcile. Setup is unmeasured → cannot touch the oracle.
async function driveNewPass(page, className, dayNum, label, uid, classId) {
  const newIsFinal = dayNum === 1;   // day-1 new completes the day; day-2+ new does not
  if (!(await freshDashboard(page, className))) return { ok: false, reason: 'dash-not-ready' };
  const before = await attemptsState(uid, classId);
  const beforeCsd = (await fbProgress(uid, classId)).csd;
  const nw = await reachTest(page, className, false, label);   // v3: bounded reach-retry (setup nav flaky)
  if (!nw.reached) return { ok: false, reason: 'new-test-not-reached' };
  const res = await driveTest(page, F, label);
  const rb = await classifyRebuild(page);
  if (rb !== 'clean') {
    // Rebuild during setup: recover if the new attempt persisted (and, for a final day, csd advanced too —
    // the broken build persists the day via reconcile).
    const persisted = await pollNewAttempts(uid, classId, before.newAttempts + 1);
    const advanced = newIsFinal ? (await fbProgress(uid, classId)).csd >= beforeCsd + 1 : true;
    const setupRebuild = { screen: rb, dayGuardWarn: dayGuardWarnFrom(page), precededByAccept };
    if (persisted && advanced) return { ok: true, resumedAfterRebuild: true, setupRebuild };
    return { ok: false, reason: `setup-rebuild-unrecovered:${rb}`, setupRebuild };
  }
  if (res.outcome !== 'results' || await finalFailVisible(page)) return { ok: false, reason: `new-not-passed:${res.outcome}` };
  // Confirm the new attempt persisted (correct for BOTH day 1 and day 2+).
  const persisted = await pollNewAttempts(uid, classId, before.newAttempts + 1);
  if (!persisted) return { ok: false, reason: 'setup-new-not-persisted' };
  // For a day-1 (final) setup, additionally confirm the day completed (csd advanced).
  if (newIsFinal) {
    const s = await settle(uid, classId, beforeCsd);
    if (!s.advanced) return { ok: false, reason: 'setup-unsettled' };
    // Day-1 setup completed the day → return from results + click "Back to Dashboard" to CLEAR session_states
    // so the NEXT setup day starts fresh, not on a stale phase=complete (Codex D2F-3). Day-2 new is NOT final
    // (the measured review follows) → no clear, so we stay at review-study.
    await returnFromResultsAndClearCompletion(page, F, `${label}-exit`).catch(() => {});
  }
  return { ok: true };
}

// ── FIXTURE: teacher creates one typed + one mcq class, assigns the list, EXACT-verifies each. ──
async function makeClass(tp, className, mode) {
  await createClass(tp, className, F);
  // v5: set BOTH testMode (new) AND reviewTestType (review) to `mode` — the app's review type is a separate
  // setting (default mcq), so a typed class needs reviewMode=typed to exercise TypedTest.jsx's review-final.
  await assignList(tp, className, LIST.title, { pace: PACE, thr: THR, mode, reviewMode: mode, testSize: TEST_SIZE }, F);
  return readJoinCode(tp, className, F);
}
async function bindAndVerifyClass(className, mode) {
  const cq = await db.collection('classes').where('name', '==', className).get();
  if (cq.size !== 1) return { invalid: `${cq.size} classes named "${className}"` };
  const classId = cq.docs[0].id;
  const a = (cq.docs[0].data().assignments || {})[LIST.id] ?? null;
  const bad = !a ? 'list not assigned'
    : a.pace !== PACE ? `pace ${a.pace}!=${PACE}`
    : a.testMode !== mode ? `testMode ${a.testMode}!=${mode}`
    : a.reviewTestType !== mode ? `reviewTestType ${a.reviewTestType}!=${mode}` // v5: review format matters (day-2 cell)
    : a.passThreshold !== THR ? `passThreshold ${a.passThreshold}!=${THR}`
    : a.testSizeNew !== TEST_SIZE ? `testSizeNew ${a.testSizeNew}!=${TEST_SIZE}`
    : null;
  if (bad) return { invalid: `assignment(${className}): ${bad}` };
  return { classId };
}

console.log(`\n▶ #10 overlay v5 (${runId}, build ${BUILD_ID}, EXPECT=${EXPECT}) — 4-cell matrix, list=${LIST.title}\n`);
const browser = await launch();

try {
  const typedClass = `25WT FIX10 TYPED ${runId}`;
  const mcqClass = `25WT FIX10 MCQ ${runId}`;
  const { page: tp } = await newAuditPage(browser, F, 'fix10-teacher');
  if (!(await login(tp, TEACHER, F))) { out.invalid = 'teacher-login'; }
  let codes = {};
  if (!out.invalid) {
    codes.typed = await makeClass(tp, typedClass, 'typed');
    codes.mcq = await makeClass(tp, mcqClass, 'mcq');
    if (!codes.typed || !codes.mcq) out.invalid = 'no-join-code';
  }
  await tp.context().close().catch(() => {});

  const classIds = {};
  if (!out.invalid) {
    for (const [key, name, mode] of [['typed', typedClass, 'typed'], ['mcq', mcqClass, 'mcq']]) {
      const r = await bindAndVerifyClass(name, mode);
      if (r.invalid) { out.invalid = r.invalid; break; }
      classIds[key] = r.classId;
      out.classes[key] = { name, classId: r.classId, mode };
    }
  }

  if (!out.invalid) {
    for (const cell of CELLS) {
      if (Date.now() - startedAt > MAX_MS) { out.invalid = `wall-clock budget exceeded before ${cell.name}`; break; }
      const className = cell.classKey === 'typed' ? typedClass : mcqClass;
      const classId = classIds[cell.classKey];
      const rec = { cell: cell.name, path: cell.path, mode: cell.mode, dayNum: cell.dayNum, student: cell.student };
      const { page } = await newAuditPage(browser, F, `fix10-${cell.name}`);
      try {
        if (!(await login(page, cell.student, F))) { rec.result = { ok: false, reason: 'student-login' }; out.cells.push(rec); await page.context().close().catch(() => {}); continue; }
        await joinClass(page, cell.classKey === 'typed' ? codes.typed : codes.mcq, className, F, cell.name);
        const uid = await uidByEmail(cell.student);
        rec.uid = uid;
        // PRISTINE baseline (else INVALID): class progress + attempts zero AND no study_states for LIST.id (F10O-4).
        const ss = uid ? await studyStatesForList(uid) : null;
        const base = uid ? { ...(await fbProgress(uid, classId)), ...(await attemptsState(uid, classId)), studyStates: ss } : null;
        rec.baseline = base;
        if (!base || base.csd !== 0 || base.twi !== 0 || base.newAttempts !== 0 || base.reviewAttempts !== 0 || ss == null || ss !== 0) {
          rec.result = { ok: false, reason: `non-pristine-baseline:${JSON.stringify(base)}`, invalid: true };
          out.cells.push(rec); await page.context().close().catch(() => {}); continue;
        }
        if (cell.isReview) {
          const s1 = await driveNewPass(page, className, 1, `${cell.name}-setup-d1`, uid, classId);
          if (!s1.ok) { rec.result = { ok: false, reason: `setup-d1:${s1.reason}` }; out.cells.push(rec); await page.context().close().catch(() => {}); continue; }
          const s2 = await driveNewPass(page, className, 2, `${cell.name}-setup-d2new`, uid, classId);
          if (!s2.ok) { rec.result = { ok: false, reason: `setup-d2new:${s2.reason}` }; out.cells.push(rec); await page.context().close().catch(() => {}); continue; }
          rec.setupRebuilds = [s1.setupRebuild, s2.setupRebuild].filter(Boolean);
          await goDashboard(page).catch(() => {});
          await sleep(1500);
        } else {
          if (!(await freshDashboard(page, className))) { rec.result = { ok: false, reason: 'dash-not-ready' }; out.cells.push(rec); await page.context().close().catch(() => {}); continue; }
        }
        rec.result = await measureCompletion(page, cell, uid, classId, className);
      } catch (e) {
        F.add('exception', `[${cell.name}] ${String(e).slice(0, 200)}`);
        rec.result = { ok: false, reason: `exception:${String(e).slice(0, 120)}` };
      }
      out.cells.push(rec);
      const r = rec.result;
      console.log(`  ${cell.name} (${cell.path}/${cell.mode} day${cell.dayNum}${cell.isReview ? '/review' : '/new'}): ` +
        (r?.ok ? `outcome=${r.submitOutcome} ui=${r.uiRebuild} green=${r.green} red=${r.redSignature}${r.redConfounded ? '(confounded)' : ''} | ${JSON.stringify(r.discriminators)}` : `NOT-MEASURED (${r?.reason})`));
      await page.context().close().catch(() => {});
    }
  }

  // Negative control — set UNCONDITIONALLY so a reader can't mistake "skipped" for "n/a" (C4). Genuine
  // different-day stale completion must STILL be blocked → RECOVERABLE rebuild. Not yet implemented
  // (two-context UI stale replay; a Firebase-seeded variant needs owner sign-off per the read-only rule).
  out.negControl = RUN_NEGCTL
    ? { status: 'gated-on-but-not-implemented', note: 'two-context stale replay pending — plan §8; a Firebase-seed variant needs owner sign-off' }
    : { status: 'skipped(not-implemented)', gated: false, note: 'plan §8 guard-integrity negative control — TODO' };
  if (RUN_NEGCTL) console.log('  negControl: gated ON but not yet implemented (best-effort; see plan §8)');
} catch (e) {
  F.add('exception', String(e).slice(0, 250));
} finally {
  await browser.close().catch(() => {});
}

// ── Verdict ──
const fatals = (F.raw || []).filter(isFatal);
out.fatalFindings = fatals.map((f) => `${f.kind}: ${f.detail}`);
const anyInvalid = out.invalid || out.cells.some((c) => c.result?.invalid);
const measured = out.cells.filter((c) => c.result?.ok);
const greenCells = measured.filter((c) => c.result.green).length;
// redCells counts ONLY a MEASURED review/new-final #10 signature — the oracle is the measured completion.
// A Day-2 cell's setup-phase rebuild is preserved in `rec.setupRebuilds` for diagnosis but is NOT counted
// here (the resumed Day-2 review-final must produce its own signature). [Codex r2 note — comment matches code]
const redCells = measured.filter((c) => c.result.redSignature).length;
out.summary = { totalCells: CELLS.length, measured: measured.length, green: greenCells, red: redCells,
  fatal: fatals.length, invalid: !!anyInvalid };

// Fatal-findings gate applied BEFORE both branches (F10O-3/B1).
if (out.invalid) out.verdict = `INVALID (${out.invalid})`;
else if (anyInvalid) out.verdict = `INVALID (cell: ${out.cells.filter((c) => c.result?.invalid).map((c) => `${c.cell}:${c.result.reason}`).join(', ')})`;
else if (fatals.length) out.verdict = `FAIL (fatal findings: ${fatals.map((f) => f.kind).join(',')})`;
else if (measured.length < CELLS.length) out.verdict = `INCOMPLETE (${measured.length}/${CELLS.length} measured; ${out.cells.filter((c) => !c.result?.ok).map((c) => `${c.cell}:${c.result?.reason}`).join(', ')})`;
else if (EXPECT === 'green') {
  out.verdict = greenCells === CELLS.length
    ? `PASS (fix confirmed: ${greenCells}/${CELLS.length} cells green)`
    : `FAIL (${greenCells}/${CELLS.length} green; failing: ${measured.filter((c) => !c.result.green).map((c) => `${c.cell}=${JSON.stringify(c.result.discriminators)}`).join(' ')})`;
} else { // red: single run = CANDIDATE; CONFIRMED needs a prior matching run on the same build (C2/B2/A5).
  const allRed = redCells === CELLS.length;
  // Prior candidate must match BUILD_ID **and** the harness rev + cell set, so a 2nd run after a harness
  // edit cannot accidentally confirm a stale candidate (Codex r2 note 3).
  let priorCandidate = false;
  try { if (existsSync(RED_STATE)) { const st = JSON.parse(readFileSync(RED_STATE, 'utf8')); priorCandidate = st.buildId === BUILD_ID && st.harnessRev === HARNESS_REV && st.cellSet === CELL_SET && st.candidate === true; } } catch { /* ignore */ }
  const stateBase = { buildId: BUILD_ID, harnessRev: HARNESS_REV, cellSet: CELL_SET, runId, at: new Date().toISOString() };
  if (allRed) {
    out.verdict = priorCandidate
      ? `REPRO-CONFIRMED (#10 signature in ${redCells}/${CELLS.length} cells, 2nd consecutive run on ${BUILD_ID})`
      : `REPRO-CANDIDATE (#10 signature in ${redCells}/${CELLS.length} cells; RE-RUN once more on the same build for REPRO-CONFIRMED)`;
    try { writeFileSync(RED_STATE, JSON.stringify({ ...stateBase, candidate: true }, null, 2)); } catch { /* ignore */ }
  } else {
    out.verdict = `NO-REPRO (${redCells}/${CELLS.length} cells; verify the build is UNFIXED and flag-ON — the race is deterministic same-call-stack, §2)`;
    try { writeFileSync(RED_STATE, JSON.stringify({ ...stateBase, candidate: false }, null, 2)); } catch { /* ignore */ }
  }
}

writeFileSync(`${AUD}/findings/fix10_overlay_${runId}.json`, JSON.stringify(out, null, 2));
console.log(`\n=== #10 OVERLAY v5 (${BUILD_ID}, EXPECT=${EXPECT}) ===`);
console.log(`cells: ${measured.length}/${CELLS.length} measured | green: ${greenCells} | red: ${redCells} | fatal: ${fatals.length} | invalid: ${!!anyInvalid}`);
const okVerdict = out.verdict.startsWith('PASS') || out.verdict.startsWith('REPRO-CONFIRMED');
console.log(`\n${okVerdict ? '✅' : out.verdict.startsWith('INVALID') ? '🚫' : out.verdict.startsWith('REPRO-CANDIDATE') ? '🔁' : '⚠️'} ${out.verdict} → findings/fix10_overlay_${runId}.json`);
process.exit(okVerdict ? 0 : 1);
