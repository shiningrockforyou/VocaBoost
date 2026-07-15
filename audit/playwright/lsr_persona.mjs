/**
 * Run S-Long Persona Expansion — SEGMENT-based persona runner (design GO: persona_expansion.md v3.1, Codex r3).
 * A REWRITE of lsr_runSL_phase1.mjs's outer loop around SEGMENTS (§4/PX-7), NOT a param swap. Drives ONE
 * persona (an ordered list of {class,list,pace} segments) through the LIVE UI, confirming each day with the
 * split oracle (green paceEff>0 vs EXPECTED-BLOCKED paceEff==0), and executing switch events (T1/T2/T3/
 * same-pace-move) at segment boundaries. UI is PRIMARY teeth; Firebase is READ-ONLY corroboration (never
 * written to advance a run). Per-persona SL_MAX_MS + per-day checkpoint manifest + resume.
 *
 *   PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright LSR_BUILD_ID=<build> LSR_PERSONA=L2 \
 *   LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENT=lsr_s41@vocaboost.test \
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_persona.mjs [runId]
 *
 * Env: LSR_PERSONA (req, L1..L16) · LSR_TEACHER (req) · SL_STUDENT (req, PRISTINE unless resuming) ·
 *      LSR_BUILD_ID (req) · SL_MAX_MS (per-persona wall clock) · SL_SMOKE_DAYS (cap each segment's runTo for
 *      a smoke) · LSR_RESUME=<checkpoint.json> (relax pristine-baseline; resume from observed FB).
 *
 * IMPLEMENTATION STATUS (honest — the Codex loop hardens the flagged specials before the full fleet):
 *   FULLY: steady, phantom (cap+1 EXPECTED-BLOCKED), freeze (interv=1.0 EXPECTED-BLOCKED), retake (Δ=+2),
 *          T1/T2/T3/same-pace-move transitions, split-oracle confirmation, checkpoint/resume, grader gate.
 *   FLAGGED-FOR-LOOP (throw NOT_YET_HARDENED so a fleet run can't silently mis-audit them):
 *          L12 dynamic-throttle cap sequence (PX-3), L10 cross-class #9 partial-day review, L11 2nd-list
 *          focus footgun, L15 seeded bad-anchor writer. Their DRIVING scaffolding is here; the oracle/seed
 *          specifics are marked TODO(loop).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import admin from 'firebase-admin';

const AUD = '/app/audit/playwright';
const runId = process.argv[2] || `PX_${process.env.LSR_PERSONA || 'X'}_${Date.now()}`;
const BUILD_ID = process.env.LSR_BUILD_ID;
const PERSONA_ID = process.env.LSR_PERSONA;
const TEACHER = process.env.LSR_TEACHER;
const STUDENT = process.env.SL_STUDENT;
const SL_MAX_MS = parseInt(process.env.SL_MAX_MS || String(90 * 60 * 1000), 10);
const SMOKE_DAYS = process.env.SL_SMOKE_DAYS ? parseInt(process.env.SL_SMOKE_DAYS, 10) : null;
const RESUME = process.env.LSR_RESUME || null;

if (!BUILD_ID) { console.error('LSR_BUILD_ID REQUIRED — aborting INVALID'); process.exit(2); }
if (!PERSONA_ID || !TEACHER || !STUDENT) { console.error('LSR_PERSONA, LSR_TEACHER, SL_STUDENT all REQUIRED'); process.exit(2); }

const { BASE, makeFindings, launch, newAuditPage, login, joinClass, switchClass, selectList, goDashboard,
        driveNewWordsToTest, enterReviewSession, enterSessionOnly, leaveSessionViaQuit, readTestRows,
        carefulAnswersFrom, partialAnswers, fillSubmitAndObserve, readVisibleProgress, dismissModal,
        armDialog, lastDialog, shot, clearCompletionIfPresent, returnFromResultsAndClearCompletion,
        readFocusClass, readFocusList, dismissResumeModal } = await import('./lsr_ui.mjs');

// Findings that make a PASS untrustworthy (PH-6). App-health signals (console/page/dialog) + oracle/auth
// failures are FATAL. flow-gap/selector-gap are DRIVER-reachability signals that already gate per-day
// confirmation (a real one fails the day); they are surfaced in the verdict, not silently dropped.
const FATAL_KINDS = ['exception', 'ui-fb-mismatch', 'progress-preservation', 'modal-dead', 'login-failed',
  'BUG', 'console-error', 'page-error', 'unexpected-dialog', 'verify-fail'];
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');
const { ALL_PERSONAS, TIER_SIZE } = await import('./lsr_personas.mjs');

const persona = ALL_PERSONAS.find((p) => p.id === PERSONA_ID);
if (!persona) { console.error(`unknown persona ${PERSONA_ID}`); process.exit(2); }

// Resolve this teacher's cloned tier list IDs + the per-tier wordmaps.
const listsFile = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8'));
const teacherLists = listsFile.teachers?.[TEACHER]?.lists;
if (!teacherLists) { console.error(`no cloned lists for ${TEACHER} in lsr_lists.json`); process.exit(2); }
const listFor = (tier) => { const l = teacherLists.find((x) => x.tier === tier); if (!l?.newId) { console.error(`teacher ${TEACHER} missing ${tier} clone`); process.exit(2); } return { id: l.newId, title: l.title }; };
const wm = JSON.parse(readFileSync(`${AUD}/lsr_tier_wordmaps.json`, 'utf8')).tiers;
const mapFor = (tier) => wm[tier]?.map || {};

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const F = makeFindings(`PX_${PERSONA_ID}_${runId}`);
mkdirSync(`${AUD}/findings`, { recursive: true });

const startedAt = Date.now();
const out = { runId, buildId: BUILD_ID, persona: PERSONA_ID, level: persona.level, event: persona.event,
  teacher: TEACHER, student: STUDENT, at: new Date().toISOString(), segments: [], days: [], checkpoints: [],
  verdict: 'PENDING', haltReason: null };

const uidByEmail = async (email) => { try { return (await admin.auth().getUserByEmail(email)).uid; } catch { return null; } };

// READ-ONLY FB state for a SPECIFIC {classId, listId} (fully parameterized — §4.1). Attempts filtered to the
// class so a new segment's baselines start at 0 even when csd/twi carry (§4.2). Bounded retry (transient blip
// ⇒ retry, not a false HALT).
async function fbState(uid, classId, listId, { tries = 3 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const cp = await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`).get();
      const att = await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', listId).get();
      const mine = att.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => a.classId === classId);
      return {
        csd: cp.exists ? (cp.data().currentStudyDay || 0) : 0,
        twi: cp.exists ? (cp.data().totalWordsIntroduced || 0) : 0,
        newAttempts: mine.filter((a) => a.sessionType === 'new').length,
        reviewAttempts: mine.filter((a) => a.sessionType === 'review').length,
        // PASSED-only counts — the state-aware resume signal must be "new PASSED" (reached the review step),
        // not "an attempt exists": a retake day's deliberate FAIL attempt also increments newAttempts, so
        // counting total attempts would falsely skip the retake PASS (Codex r8 claim-2).
        newPassed: mine.filter((a) => a.sessionType === 'new' && a.passed === true).length,
        reviewPassed: mine.filter((a) => a.sessionType === 'review' && a.passed === true).length,
        // dupKeys = the SPECIFIC (studyDay/sessionType) keys that appear >1× (e.g. "3/new" on a retake day).
        // Per-key so a legitimate retake duplicate on day 3 doesn't poison later normal days (PH8-1); the runner
        // tracks which keys are ALLOWED. dupKey boolean kept for the blocked-path frozen check.
        dupKeys: (() => { const seen = {}, dups = []; for (const a of mine) { const k = `${a.studyDay}/${a.sessionType}`; if (seen[k] && !dups.includes(k)) dups.push(k); seen[k] = 1; } return dups; })(),
        dupKey: (() => { const seen = {}; let dup = false; for (const a of mine) { const k = `${a.studyDay}/${a.sessionType}`; if (seen[k]) dup = true; seen[k] = 1; } return dup; })(),
      };
    } catch (e) { if (i === tries - 1) return null; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
  }
  return null;
}
async function fbConfirm(uid, classId, listId, exp, { timeoutMs = 25000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let fb = null;
  while (Date.now() < deadline) {
    fb = await fbState(uid, classId, listId);
    // Poll on COUNTERS only; the per-key duplicate check (PH8-1) lives in the confirm block with allowedDupKeys
    // (a global dup boolean here would make every post-retake day time out on the still-visible retake dup).
    if (fb && fb.csd === exp.csd && fb.twi === exp.twi && fb.newAttempts === exp.newAttempts
        && fb.reviewAttempts === exp.reviewAttempts) return fb;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return fb;
}
// FB proof the app FROZE (EXPECTED-BLOCKED): csd/twi unchanged AND a requiresNewWordRetake / orphan signal.
async function fbFrozenSignal(uid, classId, listId, prev, { timeoutMs = 20000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let fb = null;
  while (Date.now() < deadline) {
    fb = await fbState(uid, classId, listId);
    if (fb && fb.csd === prev.csd && fb.twi === prev.twi) return fb; // counters held → blocked as expected
    await new Promise((r) => setTimeout(r, 2000));
  }
  return fb;
}
async function orphanFlaggedSince(uid, sinceMs) {
  try {
    const snap = await db.collection('system_logs').where('type', '==', 'orphaned_attempt_flagged').get();
    return snap.docs.map((d) => d.data()).filter((x) => x.userId === uid && (!sinceMs || (x.timestamp?._seconds || 0) * 1000 >= sinceMs)).length;
  } catch { return null; }
}
async function logCountSince(type, uid, sinceMs) {
  try {
    const snap = await db.collection('system_logs').where('type', '==', type).get();
    return snap.docs.map((d) => d.data()).filter((x) => x.userId === uid && (!sinceMs || (x.timestamp?._seconds || 0) * 1000 >= sinceMs)).length;
  } catch { return null; }
}

// ── ORACLE (split; §5) ──────────────────────────────────────────────────────────────────────────────────
// Returns the expected per-day deltas. `blocked` ⇒ EXPECTED-BLOCKED (Δcsd=0, Δtwi=0). paceEff drives Δtwi.
function paceEffective(seg, localDay, prev) {
  if (seg.behavior === 'freeze' && localDay >= (seg.freezeFromDay || 999)) return 0;          // interv=1.0
  if (seg.behavior === 'throttle') {
    // TODO(loop): dynamic interv from last-3 non-null reviewScores ((0.75−avg)/0.45, clamp [0,1]; 0 until 3
    // reviews exist → days 1-4 full pace). PX-3. Placeholder keeps days 1-4 at full pace; the loop replaces
    // this with the FB-read review-score window so the cap sequence is exact.
    if (localDay <= 4) return seg.pace;
    const interv = Math.min(1, Math.max(0, (0.75 - (seg.throttleReviewAvg ?? 0.6)) / 0.45));
    return Math.round(seg.pace * (1 - interv));
  }
  return seg.pace; // steady / retake / threshold / phantom → full pace (interv 0)
}
function oracleForDay(seg, listSize, localDay, prev) {
  const twi = prev.twi;
  const atCap = twi >= listSize;
  const peff = paceEffective(seg, localDay, prev);
  // BLOCKED: post-cap phantom (newWordCount=0 because wordsRemaining=0) OR full-freeze (paceEff=0). Both
  // route to review-study → the Day-2+ gate blocks (no same-day new pass). EXCEPTION handled by runner if the
  // review segment is empty (all-MASTERED) — not expected for these personas.
  if (atCap || peff === 0) return { blocked: true, expCsd: prev.csd, expTwi: twi, dNew: 0, dRev: 0 };
  const dTwi = Math.min(peff, listSize - twi);
  const reviewExpected = (seg.startCsd + localDay) >= 2; // §4.3: on CARRIED csd, not the loop counter
  // retake days: the failed attempt also persists (never anchors) → new-attempt Δ=+2 (§5 L9).
  const dNew = (seg.behavior === 'retake' && (seg.retakeOnDays || []).includes(localDay)) ? 2 : 1;
  return { blocked: false, expCsd: prev.csd + 1, expTwi: twi + dTwi, dNew, dRev: reviewExpected ? 1 : 0 };
}

// ── DASHBOARD READY (clear stale completion first; §ROOT-CAUSE of the day-wall) ──
let precededByAccept = false;
// PH3-3 (Fix B): ENFORCE the active context — the correct CLASS *and* the correct LIST — before returning.
// After a transition the student is in multiple classes, and the FocusControl's list focus can diverge from
// the segment's class ("Base Camp" while in the Ascent class). Verify BOTH visible labels each attempt; if the
// list is wrong, selectList to fix it (multi-list) — and if it still can't be established, fail-closed
// (dash-not-ready) rather than drive the WRONG list. listTitle optional (single-segment personas can omit).
async function dashReady(page, className, listTitle) {
  const escRe = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  precededByAccept = false;
  await clearCompletionIfPresent(page).catch(() => {});
  for (let attempt = 0; attempt < 4; attempt++) {
    armDialog(page, 'accept');
    const before = lastDialog(page);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2500);
    if (lastDialog(page) && lastDialog(page) !== before) precededByAccept = true;
    await dismissModal(page).catch(() => {});
    await page.getByText(/Class:/).first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await switchClass(page, className, F);
    await page.waitForTimeout(1500);
    // CLASS-ONLY enforcement (Codex r5: "Fix B" list-enforcement CUT — A/B-test proved it non-load-bearing:
    // L8 passed 6/6 ×2 with it disabled, driving the correct list regardless of a transient focus-label flicker.
    // switchClass + the T3-entry selectList suffice; the FB oracle is scoped to {classId,listId} so a wrong list
    // can't false-pass). listTitle retained in the signature (harmless) for call-site stability + dbg context.
    const classOk = await page.getByText(escRe(className)).first().isVisible().catch(() => false);
    if (classOk) {
      await page.getByRole('button', { name: /start new words|start session|review|continue/i }).first()
        .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      return true;
    }
    if (attempt === 3 && F) F.add('flow-gap', `[dashReady] could not establish class "${className}" after 4 tries`);
  }
  return false;
}

// PH3-2 (Fix C, claim-2): poll FB until the day's csd/twi ADVANCED to the expected post-day values (the day
// FINALIZED). Short timeout — a non-advance means the completion never committed (Continue never rendered /
// CompletePhase never ran) → a RETRYABLE driving failure, not a silent pass that only fails FB confirmation.
async function pollAdvanced(uidL, classId, listId, expCsd, expTwi, { timeoutMs = 12000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let fb = null;
  while (Date.now() < deadline) {
    fb = await fbState(uidL, classId, listId);
    if (fb && fb.csd === expCsd && fb.twi === expTwi) return fb;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return fb;
}

// Drive ONE test page (typed): read rows → answer from the TIER map (full or partial) → submit → observe.
// ROOT-CAUSE GUARD (Issue D): NEVER submit a mostly-blank answer set. The word <span>s render a beat after
// the inputs; if readTestRows races them it returns blank WORDS → carefulAnswersFrom → blank answers → a 0%
// "Did not pass" submission whose downstream symptoms (no Continue, finalization-miss, +2-attempt retries)
// masqueraded as other bugs. Confirmed via attempt data (submitted="" on the 0% attempt). So: re-read until
// the answers we're about to submit are populated; if they never populate, return RETRYABLE 'under-populated'
// and do NOT submit garbage. Partial drives (nCorrect set) intentionally blank the TAIL — only require the
// first nCorrect populated.
async function driveTierTest(page, seg, label, { nCorrect = null } = {}) {
  await dismissResumeModal(page).catch(() => {}); // clear a "Resume Previous Test?" overlay that would intercept Submit
  const typed = await page.locator('input[placeholder*="definition" i]').first().isVisible().catch(() => false);
  if (!typed) { F.add('flow-gap', `[${label}] expected typed test page (persona lists are typed)`); return { outcome: 'no-typed', retryable: true }; }
  const tierMap = mapFor(seg.tier);
  let answers = [];
  // Number of words we INTEND to answer non-blank. nCorrect===0 is an INTENTIONAL full-blank (L9's deliberate
  // fail) → no populated requirement. Only guard when wantN>0 (full or partial-with-some-correct).
  const wantN = nCorrect == null ? null : nCorrect; // null = full (answer all)
  let populated = 0, need = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = await readTestRows(page);
    answers = nCorrect == null ? carefulAnswersFrom(rows, tierMap) : partialAnswers(rows, nCorrect, tierMap);
    const expectN = wantN == null ? answers.length : wantN;
    if (expectN === 0) { populated = 0; need = 0; break; } // intentional full-blank → submit as-is
    populated = answers.slice(0, expectN).filter((a) => a && a.trim()).length;
    need = Math.max(1, Math.ceil(expectN * 0.9));
    if (populated >= need) break;
    await page.waitForTimeout(1500); // spans still rendering — wait + re-read
  }
  if (need > 0 && populated < need) {
    F.add('flow-gap', `[${label}] answers under-populated (${populated}/${need}) after re-reads — NOT submitting a blank test`);
    await dbgFail(page, seg, /d(\d+)/.exec(label)?.[1] || '?', 'under-populated').catch(() => {});
    return { outcome: 'under-populated', retryable: true };
  }
  return fillSubmitAndObserve(page, answers, F, label);
}

// Capture an AFFIRMATIVE block signature on the page (the app-side proof it hit the retake/block path).
async function uiBlockVisible(page) {
  return page.getByText(/이 날을 완료하려면|Day not complete|retake required|재응시|다시.*응시/i).first().isVisible().catch(() => false);
}

// Read the dashboard's active Class/List VALUES via the proven focus-value reader (readFocus grabs the sibling
// span AFTER the "Class:"/"List:" label — my first version grabbed the label element itself and got only the
// "Class:"/"List:" prefix, which broke dashReady's verify → dash-not-ready on every day. Regression caught by
// the L2/L14 empirical smokes). Returns '' when a value can't be read (dashReady treats empty as "unverified").
async function readActiveContext(page) {
  const cls = (await readFocusClass(page, { timeout: 4000 }).catch(() => null)) || '';
  const list = (await readFocusList(page, { timeout: 4000 }).catch(() => null)) || '';
  return { cls, list, url: page.url() };
}
// DIAGNOSTIC: screenshot + active-context log at a failure point (harness-only; helps root-cause without guessing).
async function dbgFail(page, seg, localDay, where) {
  const ctx = await readActiveContext(page).catch(() => ({}));
  const name = `FAIL_${seg.tier}_d${localDay}_${where}_${runId}`.replace(/[^A-Za-z0-9_]/g, '_');
  await shot(page, name).catch(() => {});
  F.add('info', `[dbg ${seg.tier} d${localDay} ${where}] active Class="${ctx.cls}" List="${ctx.list}" url=${ctx.url} → ${name}.png`);
}

// ── DRIVE ONE DAY (dispatch by behavior). Fail-closed. `prev` = confirmed FB at day start. ──
async function advanceOneDay(page, className, listTitle, seg, listSize, localDay, prev, classId, listId) {
  if (!(await dashReady(page, className, listTitle))) return { ok: false, reason: 'dash-not-ready', recoverable: true };
  const oracle = oracleForDay(seg, listSize, localDay, prev);

  // ── EXPECTED-BLOCKED day (phantom cap+1 / full-freeze): newWordCount=0 → the app routes to review-study →
  // the Day-2+ completion gate blocks (no same-day new pass). PH-1: we MUST drive the review submit and REQUIRE
  // an affirmative block signature (retake-gate outcome and/or a visible retake-required message). Frozen
  // counters alone are NOT sufficient — a day that never executed the block path would falsely pass. ──
  if (oracle.blocked) {
    await goDashboard(page).catch(() => {});
    await page.waitForTimeout(1200);
    const rv = await enterReviewSession(page, F, `${seg.tier}-d${localDay}-review-BLOCKED`);
    if (!rv.reached) return { ok: false, reason: 'blocked-review-not-reached', recoverable: true }; // can't prove the block → retry
    // PH3-1: FULL answers on the blocked-day review (not blank). The review SCORE is irrelevant on a blocked
    // day (it blocks at the completion gate because newWordCount==0), and an all-blank fill leaves Submit
    // DISABLED → the harness never reaches the gate. The low reviews that TRIGGER freeze are on the pre-freeze
    // GREEN days only (unchanged).
    let rvRes;
    try {
      rvRes = await driveTierTest(page, seg, `${seg.tier}-d${localDay}-review-BLOCKED`, { nCorrect: null });
    } catch (e) {
      // Codex r5 INVESTIGATION: capture the exact state on a blocked-day submit failure to classify it
      // (product stuck-state vs harness). Records submit disabled/present, route, and a screenshot.
      const sub = await page.getByRole('button', { name: /^submit( test| answers)?$/i }).first();
      const subState = await sub.evaluate((el) => ({ disabled: el.disabled, visible: !!el.offsetParent })).catch(() => null);
      const inputs = await page.locator('input[placeholder*="definition" i]').count().catch(() => -1);
      await dbgFail(page, seg, localDay, `blocked-submit-exception-disabled=${subState?.disabled}-inputs=${inputs}`).catch(() => {});
      F.add('info', `[BLOCKED-INVESTIGATE ${seg.tier} d${localDay}] submit exception=${String(e).slice(0, 90)} | submitDisabled=${subState?.disabled} submitVisible=${subState?.visible} inputCount=${inputs} url=${page.url()}`);
      return { ok: false, reason: 'blocked-submit-exception', recoverable: false, needsInvestigation: true };
    }
    if (rvRes.outcome === 'rebuild') { await shot(page, `rebuild_${seg.tier}_d${localDay}_blocked_${runId}`); return { ok: false, reason: 'rebuild-on-blocked', recoverable: true }; }
    if (rvRes.outcome === 'under-populated') return { ok: false, reason: 'blocked-review-under-populated', recoverable: true };
    const uiBlock = await uiBlockVisible(page);
    await shot(page, `blocked_${seg.tier}_d${localDay}_${runId}`).catch(() => {});
    // Affirmative signature = the app SHOWED the block. retake-gate is the "Day not complete" screen; uiBlock is
    // the visible retake-required text. Either proves the completion gate rejected the review-only day.
    const affirmed = rvRes.outcome === 'retake-gate' || uiBlock;
    return { ok: affirmed, reason: affirmed ? undefined : `blocked-no-signature:${rvRes.outcome}`, blockedReached: true, blockedOutcome: rvRes.outcome, uiBlock };
  }

  // ── GREEN day: NEW words → (day-2+) review → clear. STATE-AWARE RESUME (ported from lsr_runSL_phase1):
  // a day can partially persist — new PASSES, then a transient trips the review — and the retry must RESUME at
  // review, NOT re-drive new (the dashboard is then at the review step → "Start new words" is gone →
  // new-test-not-reached → halt; L1/L4 fleet failures). Read FB up front to see what THIS day already wrote.
  const pre = await fbState(uid, classId, listId).catch(() => null);
  if (pre && pre.csd === oracle.expCsd && pre.twi === oracle.expTwi) return { ok: true, oracle, resumed: 'day-complete' };
  // Resume on PASSED counts (not total attempts) — a retake FAIL attempt must NOT mark new "done" (claim-2).
  const newDone = !!pre && pre.newPassed > (prev.newPassed || 0);       // a PASSED new test for THIS day exists
  const reviewDone = !!pre && pre.reviewPassed > (prev.reviewPassed || 0);

  if (!newDone) {
    const nw = await driveNewWordsToTest(page, F, `${seg.tier}-d${localDay}-new`);
    if (!nw.reached) { await dbgFail(page, seg, localDay, 'new-not-reached'); return { ok: false, reason: 'new-test-not-reached', recoverable: true }; }
    // retake days (L9): first attempt deliberately FAILS (1 correct) → MUST hit the retake gate → re-enter → pass.
    const doRetake = seg.behavior === 'retake' && (seg.retakeOnDays || []).includes(localDay);
    if (doRetake) {
      // Deliberate FAIL with exactly 1 correct (NOT 0/all-blank): an all-blank test leaves Submit DISABLED
      // (→ 30s click timeout, L9 fleet halt). 1/testSize (~3%) is well below threshold → still forces the
      // retake gate, but Submit is enabled + the "still unanswered" confirm is handled by fillSubmitAndObserve.
      const failRes = await driveTierTest(page, seg, `${seg.tier}-d${localDay}-new-FAIL`, { nCorrect: 1 });
      // A FAILED new test shows the "Did not pass" RESULTS screen (score %), not the "Day not complete"
      // retake-gate (that's the review-completion block). Accept EITHER; then VERIFY the fail actually
      // persisted (new not passed → twi held) before re-taking, so a fluke-pass can't slip through.
      if (failRes.outcome !== 'retake-gate' && failRes.outcome !== 'results') return { ok: false, reason: `retake-setup-bad-outcome:${failRes.outcome}`, recoverable: !!failRes.retryable };
      const afterFail = await fbState(uid, classId, listId).catch(() => null);
      if (afterFail && afterFail.twi > (pre?.twi ?? 0)) return { ok: false, reason: 'retake-fail-unexpectedly-passed' };
      await goDashboard(page).catch(() => {});
      const nw2 = await driveNewWordsToTest(page, F, `${seg.tier}-d${localDay}-new-RETAKE`);
      if (!nw2.reached) return { ok: false, reason: 'retake-new-not-reached', recoverable: true };
    }
    // threshold-edge (L10): fill just enough to land ≥ passThreshold (thr% of testSize), no more.
    const nCorrect = (seg.behavior === 'threshold' && (seg.thresholdMarginDays || []).includes(localDay))
      ? Math.ceil((seg.thr / 100) * seg.testSize) : null;
    const nwRes = await driveTierTest(page, seg, `${seg.tier}-d${localDay}-new`, { nCorrect });
    if (nwRes.outcome === 'rebuild') { await shot(page, `rebuild_${seg.tier}_d${localDay}_new_${runId}`); return { ok: false, reason: 'rebuild-after-new', recoverable: true }; }
    // save-error = grading OK but the durable SAVE transiently failed ("Couldn't Save/Retry Save") → RETRYABLE
    // (the state-aware resume skips whatever already persisted on the retry). A persistent save failure still
    // halts (all retries exhausted). Known save-reliability transient (CS-matrix #3).
    if (nwRes.outcome !== 'results') { await dbgFail(page, seg, localDay, `new-${nwRes.outcome}`); return { ok: false, reason: `new-not-passed:${nwRes.outcome}`, recoverable: !!nwRes.retryable || nwRes.outcome === 'save-error' }; }
  }

  if (oracle.dRev > 0 && !reviewDone) {
    await goDashboard(page).catch(() => {});
    await page.waitForTimeout(1200);
    const rv = await enterReviewSession(page, F, `${seg.tier}-d${localDay}-review`);
    if (!rv.reached) { await dbgFail(page, seg, localDay, 'review-not-reached'); return { ok: false, reason: 'review-not-reached', recoverable: true }; } // §4.9 retryable
    // Review score DRIVES the intervention ramp (last-3 non-null reviewScores). freeze (L14) needs avg ≤0.30
    // over its pre-freeze review days to push interv→1.0 by freezeFromDay; throttle (L12) needs ≈avg to land
    // the target interv. steady/retake/threshold → full review (interv 0). Without this, L14 never actually
    // freezes and its day-5 EXPECTED-BLOCKED oracle would false-fail.
    const rvNCorrect = seg.behavior === 'freeze' ? Math.round(0.25 * seg.testSize)
      : seg.behavior === 'throttle' ? Math.round((seg.throttleReviewAvg ?? 0.6) * seg.testSize)
      : null;
    const rvRes = await driveTierTest(page, seg, `${seg.tier}-d${localDay}-review`, { nCorrect: rvNCorrect });
    if (rvRes.outcome === 'rebuild') { await shot(page, `rebuild_${seg.tier}_d${localDay}_review_${runId}`); return { ok: false, reason: 'rebuild-after-review', recoverable: true }; }
    if (rvRes.outcome === 'retake-gate') return { ok: false, reason: 'unexpected-retake-gate' };
    // save-error → RETRYABLE transient (see new-path note); resume skips the already-persisted new on retry.
    if (rvRes.outcome !== 'results') return { ok: false, reason: `review-not-completed:${rvRes.outcome}`, recoverable: !!rvRes.retryable || rvRes.outcome === 'save-error' }; }
  const ret = await returnFromResultsAndClearCompletion(page, F, `${seg.tier}-d${localDay}-exit`).catch(() => ({}));
  // PH3-2/claim-2: VERIFY the day FINALIZED (csd/twi advanced to the expected post-day values) before declaring
  // driven-ok. A finalization miss (Continue never rendered → completion never committed → next day would wall
  // on stale session_state) is a RETRYABLE driving failure caught HERE, not a silent pass that only trips FB
  // confirmation at halt time.
  const fin = await pollAdvanced(uid, classId, listId, oracle.expCsd, oracle.expTwi);
  if (!(fin && fin.csd === oracle.expCsd && fin.twi === oracle.expTwi)) {
    await dbgFail(page, seg, localDay, `finalization-miss(csd=${fin?.csd}/exp${oracle.expCsd} cont=${ret?.continueClicked})`);
    return { ok: false, reason: 'finalization-miss', recoverable: true };
  }
  return { ok: true, oracle };
}

// ── SEGMENT SETUP + ENTRY ──
async function setupClassForSegment(browser, seg, className) {
  const list = listFor(seg.tier);
  const { page: tp } = await newAuditPage(browser, F, `teacher-${seg.tier}`);
  let code = null;
  if (await login(tp, TEACHER, F)) {
    await createClass(tp, className, F);
    // Force BOTH new-word AND review test mode to typed (reviewMode defaults to MCQ independently in the UI;
    // driveTierTest is typed-only — the tier wordmap answers both). testSizeNew=30 (assignment-verified below).
    await assignList(tp, className, list.title, { pace: seg.pace, thr: seg.thr, mode: seg.mode, reviewMode: seg.mode, testSize: seg.testSize, listId: list.id }, F);
    code = await readJoinCode(tp, className, F);
  }
  await tp.context().close().catch(() => {});
  // bind classId + assert the assignment exactly (fail-closed setup).
  const cq = await db.collection('classes').where('name', '==', className).get();
  if (cq.size !== 1) return { ok: false, reason: `INVALID (${cq.size} classes named "${className}")` };
  const classId = cq.docs[0].id;
  const a = (cq.docs[0].data().assignments || {})[list.id] ?? null;
  const bad = !a ? 'list not assigned' : a.pace !== seg.pace ? `pace ${a.pace}!=${seg.pace}`
    : a.testMode !== seg.mode ? `testMode ${a.testMode}!=${seg.mode}`
    : a.passThreshold !== seg.thr ? `passThreshold ${a.passThreshold}!=${seg.thr}`
    : a.testSizeNew !== seg.testSize ? `testSizeNew ${a.testSizeNew}!=${seg.testSize}` : null;
  if (bad) return { ok: false, reason: `INVALID (assignment: ${bad})` };
  return { ok: true, classId, code, list };
}

console.log(`\n▶ Persona ${PERSONA_ID} (${persona.event}) — teacher=${TEACHER} student=${STUDENT} build=${BUILD_ID}\n`);
const browser = await launch();
let halted = false;
const setHalt = (r) => { if (!halted) { halted = true; out.haltReason = r; } };
let uid = null;

function writeCheckpoint(segIdx, localDay, prev, extra = {}) {
  const cp = { persona: PERSONA_ID, segIdx, localDay, prev, at: new Date().toISOString(), ...extra };
  out.checkpoints.push(cp);
  writeFileSync(`${AUD}/findings/persona_${PERSONA_ID}_${runId}.checkpoint.json`, JSON.stringify(cp, null, 2));
}

try {
  uid = await uidByEmail(STUDENT);
  if (!uid) setHalt('student-uid-missing');

  // SEEDED personas apply an Admin-SDK pre-write BEFORE the first session (then assert the app's response).
  if (persona.seed && !halted) {
    if (persona.seed.kind === 'bad-anchor') {
      // TODO(loop): controlled invalid-anchor writer (a manual-pass attempt MISSING newWordEndIndex). Must NOT
      // reuse scripts/cs/manual-pass.mjs (that writes a VALID anchor). Deferred to the Codex loop — throw so a
      // fleet run cannot silently mis-audit L15.
      throw new Error('NOT_YET_HARDENED: L15 bad-anchor seed writer (loop pass)');
    }
    // same-pace-move (L16) needs no pre-seed; the class move happens at the segment boundary.
  }

  const student = (await newAuditPage(browser, F, 'student')).page;
  if (!halted && !(await login(student, STUDENT, F))) setHalt('student-login');

  let prev = { csd: 0, twi: 0, newAttempts: 0, reviewAttempts: 0, newPassed: 0, reviewPassed: 0 };
  // PH8-1: keys of duplicates ALREADY accounted for (a confirmed retake day's "N/new"). Any duplicate NOT in
  // this set on a non-retake day is a real (bad) duplicate. Persists across all days/segments of the persona.
  const allowedDupKeys = new Set();
  const resumeState = RESUME && existsSync(RESUME) ? JSON.parse(readFileSync(RESUME, 'utf8')) : null;

  for (let s = 0; s < persona.segments.length && !halted; s++) {
    const seg = persona.segments[s];
    const listSize = TIER_SIZE[seg.tier];
    const className = `25WT PX ${PERSONA_ID} S${s} ${runId}`;
    const segOut = { idx: s, tier: seg.tier, pace: seg.pace, transitionInto: seg.transitionInto, className, note: seg.note, days: [] };

    // Setup this segment's class + list.
    const setup = await setupClassForSegment(browser, seg, className);
    if (!setup.ok) { out.verdict = setup.reason; setHalt(setup.reason); break; }
    const { classId, code, list } = setup;
    segOut.classId = classId; segOut.listId = list.id;

    // ENTRY: fresh/T1/T3 → join the new class (fresh Day-1). T2/same-pace-move → join the new class assigning
    // the SAME list; reconciliation carries csd/twi. T3 (different list) additionally focuses the new list.
    await joinClass(student, code, className, F, `${PERSONA_ID}-s${s}`);
    if (seg.transitionInto === 'T3') await selectList(student, list.title, F, `${PERSONA_ID}-s${s}-focus`).catch(() => {});
    await goDashboard(student).catch(() => {});

    const expectCarry = seg.transitionInto === 'T2' || seg.transitionInto === 'same-pace-move';
    // PH-2: list-scoped reconciliation is triggered by ENTERING the session (initializeDailySession →
    // getOrCreateClassProgress WRITES the reconciled carried csd/twi), NOT by joining the class. So for carry
    // transitions, enter the session far enough to force reconciliation, then leave cleanly, THEN read the
    // baseline — else fbState reads the not-yet-created class_progress as 0/0 and the oracle binds to garbage.
    if (expectCarry) {
      await dashReady(student, className, list.title);
      const ent = await enterSessionOnly(student, F, `${PERSONA_ID}-s${s}-recon`);
      if (ent.entered) await leaveSessionViaQuit(student, F, `${PERSONA_ID}-s${s}-recon`);
      await goDashboard(student).catch(() => {});
    }
    const base = await fbState(uid, classId, list.id);
    segOut.baseline = base;

    // PH-3: fail-closed baseline CONTRACTS per transition (comments → assertions). A stale doc / missed
    // reconciliation / wrong focus must INVALIDATE the run, not silently become the oracle.
    const prevSeg = s > 0 ? out.segments[s - 1] : null;
    if (!resumeState) {
      if (seg.transitionInto === 'T2') {
        // Validated LIST_SCOPED_RECON carry path: require EXACT carried csd/twi from the prior same-list segment.
        const wantCsd = seg.startCsd, wantTwi = prevSeg?.lastTwi;
        if (!base || base.csd !== wantCsd || base.twi !== wantTwi || base.newAttempts !== 0 || base.reviewAttempts !== 0) {
          out.verdict = `INVALID (T2 carry baseline seg${s}: got csd=${base?.csd}/twi=${base?.twi}/new=${base?.newAttempts}/rev=${base?.reviewAttempts}, want csd=${wantCsd}/twi=${wantTwi}/0/0 — reconciliation not carried)`;
          setHalt('t2-carry-baseline'); break;
        }
      } else if (seg.transitionInto === 'same-pace-move') {
        // L16 is the #6 PRE-FIX BASELINE — its purpose is to OBSERVE whether a same-pace class move carries or
        // resets under the CURRENT deployed flags (LIST_SCOPED_RECON may already carry it; the foundation program
        // is the definitive fix). So RECORD the observed delta; do NOT fail-closed on carry-or-reset. (Reasoned
        // divergence from Codex PH-3 — flagged in the round-2 handoff.)
        segOut.samePaceMoveObserved = { beforeMove: { csd: prev.csd, twi: prev.twi }, afterReconcile: base ? { csd: base.csd, twi: base.twi } : null,
          carried: !!base && base.csd === prev.csd && base.twi === prev.twi };
        F.add('info', `[L16 #6 baseline] same-pace move: before csd=${prev.csd}/twi=${prev.twi} → after-reconcile csd=${base?.csd}/twi=${base?.twi} (carried=${segOut.samePaceMoveObserved.carried})`);
      } else {
        // fresh / T1 / T3 → a NEW class or a DIFFERENT list → require pristine 0/0/0/0.
        if (!base || base.csd !== 0 || base.twi !== 0 || base.newAttempts !== 0 || base.reviewAttempts !== 0) {
          out.verdict = `INVALID (${seg.transitionInto} baseline seg${s}: ${JSON.stringify(base)} — expected 0/0/0/0)`;
          setHalt(`${seg.transitionInto}-baseline`); break;
        }
      }
    }

    // Progress-preservation assert (#5, PH-4): after T1/T3, the PRIOR list's doc still shows its pre-switch
    // csd AND twi (read-only). Both counters, with classId/listId in the finding.
    if ((seg.transitionInto === 'T1' || seg.transitionInto === 'T3') && prevSeg) {
      const priorDoc = await fbState(uid, prevSeg.classId, prevSeg.listId);
      segOut.priorListPreserved = !!priorDoc && priorDoc.twi === prevSeg.lastTwi && priorDoc.csd === prevSeg.lastCsd;
      segOut.priorDoc = priorDoc ? { csd: priorDoc.csd, twi: priorDoc.twi } : null;
      if (!segOut.priorListPreserved) F.add('progress-preservation', `[${PERSONA_ID} s${s}] prior list ${prevSeg.tier} (class ${prevSeg.classId}/list ${prevSeg.listId}) doc csd=${priorDoc?.csd}/twi=${priorDoc?.twi} != pre-switch csd=${prevSeg.lastCsd}/twi=${prevSeg.lastTwi} (#5)`);
    }

    // Re-baseline per-segment counters. On carry, csd/twi come from the reconciled `base`; attempts start at 0.
    prev = { csd: base?.csd ?? 0, twi: base?.twi ?? 0, newAttempts: 0, reviewAttempts: 0, newPassed: 0, reviewPassed: 0 };

    // Resolve how many local days this segment runs. `cap` = days to reach twi==listSize FROM THE CARRIED twi
    // (a T2/same-pace segment enters mid-list, so it needs ceil((listSize−startTwi)/pace) days — NOT the
    // from-zero capDays, which would over-run and manufacture spurious post-cap BLOCKED days — sanity-trace
    // bug, L7). For a fresh segment startTwi=0, so this equals capDays(tier,pace).
    const daysToCapFromHere = Math.max(1, Math.ceil((listSize - prev.twi) / seg.pace));
    let maxDays = seg.runTo === 'cap' ? daysToCapFromHere
      : seg.runTo === 'cap+1' ? daysToCapFromHere + 1
      : seg.runTo === 'dynamic' ? 40           // throttle: bounded window; loop replaces with the dynamic sequence
      : typeof seg.runTo === 'number' ? seg.runTo : daysToCapFromHere;
    if (SMOKE_DAYS) maxDays = Math.min(maxDays, SMOKE_DAYS);

    // Guard: personas flagged for the loop must not run a fleet audit half-built.
    if ((seg.behavior === 'throttle' && seg.runTo === 'dynamic') || seg.crossClassReviewOnDay || seg.addSecondListOnDay) {
      if (!SMOKE_DAYS) throw new Error(`NOT_YET_HARDENED: ${PERSONA_ID} ${seg.behavior}/${seg.note} — Codex loop pass required before a non-smoke fleet run`);
    }

    for (let d = 1; d <= maxDays && !halted; d++) {
      if (Date.now() - startedAt > SL_MAX_MS) { setHalt(`wall-clock ${SL_MAX_MS}ms exceeded (seg ${s} day ${d})`); break; }
      const oracle = oracleForDay(seg, listSize, d, prev);
      let r = null, tries = 0;
      while (tries < 3 && !halted) {
        tries++;
        r = await advanceOneDay(student, className, list.title, seg, listSize, d, prev, classId, list.id);
        if (r.ok) break;
        if (r.recoverable) { console.log(`  ${seg.tier} d${d}: recoverable (${r.reason}), retry ${tries}`); await student.waitForTimeout(1500); continue; }
        break;
      }
      await dashReady(student, className, list.title);
      const ui = await readVisibleProgress(student).catch(() => null);

      let confirmed, fb, rec;
      if (oracle.blocked) {
        // EXPECTED-BLOCKED (PH-1): PASS requires BOTH (a) counters FROZEN (csd/twi held — an orphan review
        // attempt may still be written, so we don't require attempts frozen) AND (b) an AFFIRMATIVE block
        // signature proving the app executed the block path: the retake-gate outcome, a visible retake-required
        // message, or an orphaned_attempt_flagged log delta. Frozen counters ALONE are NOT sufficient.
        fb = await fbFrozenSignal(uid, classId, list.id, prev);
        const frozen = !!fb && fb.csd === prev.csd && fb.twi === prev.twi;
        const orphans = await orphanFlaggedSince(uid, startedAt);
        const blockSig = r?.blockedOutcome === 'retake-gate' || r?.uiBlock === true || (orphans && orphans > 0);
        confirmed = !!r?.ok && frozen && !!blockSig;
        rec = { seg: s, tier: seg.tier, day: d, blocked: true, driven: !!r?.ok, tries, reason: r?.reason || null,
          blockedOutcome: r?.blockedOutcome || null, uiBlock: !!r?.uiBlock, orphanFlagged: orphans, blockSignature: !!blockSig,
          fb, frozen, ui: ui ? { words: ui.words, day: ui.day } : null, confirmed };
        if (!blockSig) F.add('verify-fail', `[${PERSONA_ID} s${s} d${d}] BLOCKED day lacked an affirmative block signature (outcome=${r?.blockedOutcome}, uiBlock=${r?.uiBlock}, orphans=${orphans}) — cannot certify the block executed`);
        if (frozen && !blockSig) F.add('verify-fail', `[${PERSONA_ID} s${s} d${d}] counters frozen but NO block signature — possible false-green (day may not have executed the completion gate)`);
        console.log(`  ${seg.tier} d${d} [BLOCKED]: driven=${!!r?.ok} frozen=${frozen} sig=${!!blockSig}(outcome=${r?.blockedOutcome} ui=${!!r?.uiBlock} orphans=${orphans}) confirmed=${confirmed}`);
      } else {
        const expNew = prev.newAttempts + oracle.dNew, expRev = prev.reviewAttempts + oracle.dRev;
        const exp = { csd: oracle.expCsd, twi: oracle.expTwi, newAttempts: expNew, reviewAttempts: expRev };
        const expectDup = oracle.dNew > 1; // retake day → EXACTLY one NEW expected duplicate this day
        // The app records studyDay == the day being completed == oracle.expCsd; a retake day's duplicate is the
        // 2nd 'new' attempt on that studyDay → key `${expCsd}/new` (verified in L9 data: "3/new","6/new").
        const expectedRetakeDupKey = `${oracle.expCsd}/new`;
        fb = await fbConfirm(uid, classId, list.id, exp);
        const uiWordsOk = ui && ui.words === oracle.expTwi;
        const uiDayOk = ui && ui.day === oracle.expCsd + 1;
        // PH9-2: enforce the EXACT expected duplicate — a retake day must produce EXACTLY `${expCsd}/new` (not
        // zero, not some other key); a non-retake day must produce NO new duplicate. Only keys already ABSORBED
        // from a prior confirmed retake are exempt, so a legit past retake dup doesn't poison later days (PH8-1)
        // while a real wrong-key duplicate can't be masked (PH9-2).
        const newDups = (fb?.dupKeys || []).filter((k) => !allowedDupKeys.has(k));
        const dupOk = expectDup
          ? (newDups.length === 1 && newDups[0] === expectedRetakeDupKey)
          : (newDups.length === 0);
        const fbOk = fb && fb.csd === exp.csd && fb.twi === exp.twi && fb.newAttempts === exp.newAttempts && fb.reviewAttempts === exp.reviewAttempts && dupOk;
        confirmed = r?.ok && fbOk && ui != null && uiWordsOk && uiDayOk;
        rec = { seg: s, tier: seg.tier, day: d, blocked: false, driven: !!r?.ok, tries, lastReason: r?.reason || null,
          ui: ui ? { words: ui.words, day: ui.day } : null, uiWordsOk, uiDayOk, fb, expected: exp, fbOk, confirmed };
        console.log(`  ${seg.tier} d${d}: driven=${!!r?.ok}(${tries}x) UI[w=${ui?.words}/e${oracle.expTwi} d=${ui?.day}/e${oracle.expCsd + 1}] FB[csd=${fb?.csd} twi=${fb?.twi} new=${fb?.newAttempts} rev=${fb?.reviewAttempts}] confirmed=${confirmed}`);
      }
      out.days.push(rec); segOut.days.push(rec);
      writeCheckpoint(s, d, prev, { confirmed, blocked: oracle.blocked });
      if (!confirmed) { setHalt(out.haltReason || `${PERSONA_ID} seg${s} day${d} not confirmed (reason=${r?.reason || 'oracle-mismatch'})`); break; }
      // PH9-2: absorb ONLY the just-validated expected retake key (a confirmed retake day), so it doesn't fail
      // later days — NOT every dupKey present (that could absorb an unexpected dup and mask it going forward).
      if (!oracle.blocked && oracle.dNew > 1) allowedDupKeys.add(`${oracle.expCsd}/new`);

      // advance prev
      if (!oracle.blocked) {
        prev = { csd: oracle.expCsd, twi: oracle.expTwi, newAttempts: prev.newAttempts + oracle.dNew, reviewAttempts: prev.reviewAttempts + oracle.dRev, newPassed: (prev.newPassed || 0) + 1, reviewPassed: (prev.reviewPassed || 0) + oracle.dRev };
      }
      segOut.lastTwi = prev.twi; segOut.lastCsd = prev.csd;
    }
    out.segments.push(segOut);
  }
  await student.context().close().catch(() => {});
} catch (e) {
  const msg = String(e).slice(0, 250);
  if (msg.includes('NOT_YET_HARDENED')) { out.verdict = `SKIPPED (${msg})`; setHalt(msg); }
  else { F.add('exception', msg); setHalt(`exception: ${msg}`); }
} finally {
  await browser.close().catch(() => {});
}

const confirmedDays = out.days.filter((d) => d.confirmed).length;
out.confirmedDays = confirmedDays; out.totalDays = out.days.length;
// PH-6: fail-closed on the WIDENED fatal set (app-health + oracle/auth). flow-gap/selector-gap are driver
// signals that already gate per-day confirmation — surfaced (not silently dropped) as PASS-WITH-WARNINGS.
// A RECOVERED grading-retry console-error is benign: the grading Cloud Function transiently returns
// `internal`, the client retries (attempt N/3) and succeeds — proven benign by the day CONFIRMING (a genuine
// all-3-retries-failed grading surfaces as a NON-confirmed day, caught elsewhere, not just a console log).
// (Known grading-transient behavior; not a new product bug.) Excluded from fatal; counted for transparency.
// FULLY-CONFIRMED = every day's oracle passed and the run didn't halt → any recorded transient (grading-retry
// console-error, or a save-error BUG) was RECOVERED (a persistent one would leave its day unconfirmed → halt).
const allConfirmed = !halted && out.days.length > 0 && confirmedDays === out.days.length;
const isRecoveredTransient = (x) =>
  (x.kind === 'console-error' && /Grading attempt \d+\/\d+ failed/i.test(x.detail || ''))
  || (allConfirmed && x.kind === 'BUG' && /Couldn'?t Save|Retry Save|save.*fail/i.test(x.detail || ''));
const fatals = (F.raw || []).filter((x) => FATAL_KINDS.includes(x.kind) && !isRecoveredTransient(x));
out.recoveredTransients = (F.raw || []).filter(isRecoveredTransient).length;
// Codex r5 cleanup, generalized: a driver gap (flow-gap/selector-gap) on a FULLY-CONFIRMED run is by
// definition RECOVERED — a gap that caused a real failure would leave its day UNCONFIRMED → the run halts
// (INCOMPLETE), not pass every day. So when all days confirmed and the run didn't halt, every oracle passed
// (csd/twi/attempts/UI all matched) and the gaps were transient (recovered via retry). Record them for triage
// (recoveredDriverWarnings) but don't cert-block. On a halted/incomplete run, driver gaps still surface.
const allDriverGaps = (F.raw || []).filter((x) => ['flow-gap', 'selector-gap'].includes(x.kind));
const driverWarnings = allConfirmed ? [] : allDriverGaps;
out.fatalFindings = fatals.map((f) => `${f.kind}: ${f.detail}`);
out.driverWarnings = driverWarnings.length;
out.recoveredDriverWarnings = allConfirmed ? allDriverGaps.length : 0;
out.findings = F.raw; // full anomaly log in the JSON (not just the sidecar markdown) for debugging

if (out.verdict.startsWith('INVALID') || out.verdict.startsWith('SKIPPED')) { /* keep */ }
else if (halted) out.verdict = `INCOMPLETE (${confirmedDays}/${out.totalDays} confirmed; ${out.haltReason})`;
else if (fatals.length) out.verdict = `FAIL (${[...new Set(fatals.map((f) => f.kind))].join(',')})`;
else if (driverWarnings.length) out.verdict = `PASS-WITH-WARNINGS (${confirmedDays}/${out.totalDays} days; ${driverWarnings.length} flow/selector gap(s) — triage before certifying)`;
else out.verdict = `PASS (${confirmedDays}/${out.totalDays} days confirmed across ${out.segments.length} segments)`;

writeFileSync(`${AUD}/findings/persona_${PERSONA_ID}_${runId}.json`, JSON.stringify(out, null, 2));
console.log(`\n=== PERSONA ${PERSONA_ID} (${BUILD_ID}) ===`);
console.log(`confirmed: ${confirmedDays}/${out.totalDays} | segments: ${out.segments.length} | fatal: ${fatals.length} | driverWarn: ${driverWarnings.length} | halt: ${out.haltReason || 'none'}`);
console.log(`${out.verdict.startsWith('PASS (') ? '✅' : out.verdict.startsWith('PASS-WITH') ? '🟡' : out.verdict.startsWith('SKIPPED') ? '⏭️' : '⚠️'} ${out.verdict} → findings/persona_${PERSONA_ID}_${runId}.json`);
// exit: clean PASS=0, PASS-WITH-WARNINGS=2 (visibly not-clean for the fleet orchestrator), everything else=1.
process.exit(out.verdict.startsWith('PASS (') ? 0 : out.verdict.startsWith('PASS-WITH') ? 2 : 1);
