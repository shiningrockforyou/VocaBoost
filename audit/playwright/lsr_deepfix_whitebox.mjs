/**
 * lsr_deepfix_whitebox.mjs — M-WB (white-box) matrix for the deepfix Playwright audit.
 * Design oracle: audit/deepfix/task4/AUDIT_DESIGN.md §1.B (W-RA3g / W-RA4 / W-RA4b gate rows),
 * §1.D CS-11 (reviewonly_derivation_mismatch tripwire), §1.E CUT-5 (nonce storage stub) + CUT-6
 * (forced denied-write), §2 (fail-closed manifest), §7 (M-WB extends lsr_reviewonly_whitebox.mjs).
 * Build plan: audit/deepfix/task5/HARNESS_BUILD_PLAN.md (row M-WB). Run-book: task5/CODEX_RUNBOOK.md.
 *
 * ⚠️ DOCUMENTED page.evaluate EXCEPTION (the ONLY sanctioned injected-JS use). lsr_ui.mjs FORBIDS
 * page.evaluate / storage access / injected JS (its policy, :4-7). This module is the DELIBERATE
 * exception — exactly as lsr_reviewonly_whitebox.mjs is: it CRAFTS the un-drivable gate-negative
 * preconditions (sessionStorage.dailySessionState.sessionConfig patch/clear; a throwing Storage stub;
 * an injected direct client-SDK write via the app's OWN db handle). The injected JS is CONFINED to
 * the crafted-precondition step; every ORACLE stays observational — Admin-SDK `.get()` reads
 * (FB.read*) + visible UI text. Results report in a SEPARATE white-box manifest (findings/
 * deepfix_wb_<runId>.{json,md}) — NOT counted as full-UI acceptance. It still imports lsr_ui.mjs, so
 * the import-time fail-closed LOCAL-ONLY BASE guard applies; every seed/reset write is sandbox-triple
 * gated (lsr_*@vocaboost.test + 25WT-prefixed class + its cloned list); NEVER 26SM.
 *
 * ⚠ UN-RUNNABLE IN THIS WSL (9p mount — no Vite/Playwright). Codex RUNS it FLAG-ON on David's Windows
 * env (Task 6). Validated here by `node --check`, import-resolution, reuse-correctness, and an
 * oracle-walk of each row against the design + the live source (event names/emission sites bound below).
 *
 * Each scenario: CRAFT precondition → assert INVALID if the craft did not materialize → MEASURED step
 * → OBSERVATIONAL oracle (Admin read / visible text). INVALID ≠ PASS; any FAIL/INVALID/fatal app-health
 * signal → NOT-CLEAN → exit 1.
 *
 * Scenarios (5): W-RA3g · W-RA4 · W-RA4b · CS-11 · CUT-5 · CUT-6. (W-RA3g/4/4b adopted+adapted from
 * lsr_reviewonly_whitebox.mjs.)
 *
 *   LSR_TEACHER=lsr_teacher_02@vocaboost.test \
 *   SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test,... \
 *   LSR_TIER=CORE  DFWB_SCENARIOS="W-RA3g W-RA4 W-RA4b CS-11 CUT-5 CUT-6" \
 *   PLAYWRIGHT_BROWSERS_PATH=... NODE_PATH=/app/node_modules node audit/playwright/lsr_deepfix_whitebox.mjs [runId]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const HERE = dirname(fileURLToPath(import.meta.url));
const AUD = HERE;                       // this file lives in audit/playwright/ — repo-relative, portable (WSL + Windows)
const REPO = resolve(HERE, '..', '..'); // repo root (audit/playwright -> ../..)
const runId = process.argv[2] || `DFWB_${Date.now()}`;
const BUILD_ID = process.env.LSR_BUILD_ID || 'local-dev';
const TEACHER = process.env.LSR_TEACHER;
const STUDENTS = (process.env.SL_STUDENTS || process.env.SL_STUDENT || '').split(',').map((s) => s.trim()).filter(Boolean);
const TIER = process.env.LSR_TIER || null;
const DEFAULT_SCEN = 'W-RA3g W-RA4 W-RA4b CS-11 CUT-5 CUT-6';
const SCEN = (process.env.DFWB_SCENARIOS || DEFAULT_SCEN).trim().split(/\s+/);

// lsr_ui.mjs import TRIGGERS the fail-closed base guard (throws unless BASE is http://localhost).
const UI = await import('./lsr_ui.mjs');
const { BASE, PASS, makeFindings, launch, newAuditPage, login, joinClass, selectList, goDashboard,
        driveNewWordsToTest, enterReviewSession, readTestRows, partialAnswers, carefulAnswersFrom,
        fillSubmitAndObserve, returnFromResultsAndClearCompletion, shot, sleep } = UI;
const FB = await import('./lsr_deepfix_fb.mjs');
const { createClass, assignList, readJoinCode } = await import('./lsr_teacher.mjs');

// ── IDENTITY GUARD (fail-closed, BEFORE any login/seed) — design §0.2/§4 ────────────────────────────────────
const STUDENT_RE = FB.SANDBOX.SANDBOX_STUDENT_RE;
if (!TEACHER || !STUDENT_RE.test(TEACHER) || !STUDENTS.length || STUDENTS.some((s) => !STUDENT_RE.test(s))) {
  console.error('[IDENTITY GUARD] INVALID — LSR_TEACHER/SL_STUDENTS must all be lsr_*@vocaboost.test. Sandbox only; NEVER 26SM.');
  process.exit(2);
}
const listsFile = JSON.parse(readFileSync(`${AUD}/lsr_lists.json`, 'utf8'));
const tl = listsFile.teachers?.[TEACHER]?.lists;
if (!tl?.length) { console.error(`no cloned lists for ${TEACHER} in lsr_lists.json`); process.exit(2); }
const chosen = TIER ? tl.find((l) => l.tier === TIER) : tl[0];
if (!chosen?.newId) { console.error(`no clone for tier ${TIER || '(first)'} for ${TEACHER}`); process.exit(2); }
const LIST = { id: chosen.newId, title: chosen.title, tier: chosen.tier, size: await FB.readListWordCount(chosen.newId).catch(() => 0) };

const F = makeFindings(`DFWB_${runId}`);
mkdirSync(`${AUD}/findings`, { recursive: true });
const gitHead = (() => { try { return execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch { return 'unknown'; } })();
const gitDirty = (() => { try { return execSync('git status --porcelain', { cwd: REPO }).toString().trim().length > 0; } catch { return true; } })();

// PH-6 fatal app-health kinds (design §2.3), mirrored from lsr_deepfix_ui.mjs. console-error / request-failed
// are filtered through an allowlist so (a) benign Firestore long-poll aborts and (b) the INTENTIONAL denied-write /
// degraded-storage noise these white-box crafts provoke do not false-fail the matrix.
const FATAL_KINDS = ['exception', 'BUG', 'page-error', 'unexpected-dialog', 'login-failed', 'oracle-mismatch', 'verify-fail'];
const isFirestoreChannelAbort = (d) => /firestore\.googleapis\.com/i.test(d) && /(Listen|Write)\/channel/i.test(d) && /ERR_ABORTED/i.test(d);
const CONSOLE_ALLOW = [
  /ResizeObserver/i, /favicon/i, /analytics|gtag|gtm/i, /web-vitals/i,
  // CUT-6 injected direct-write + a denied legacy completion INTENTIONALLY surface permission-denied.
  /permission[-_ ]denied|Missing or insufficient permissions|PERMISSION_DENIED/i, /legacy_write_denied/i,
  // CUT-5 storage stub INTENTIONALLY makes setItem throw; the app warns "nonce not persisted".
  /QuotaExceeded|nonce not persisted|storage.*(degraded|unavailable)|setItem/i,
];

const results = [];
const setV = (rec, v, detail) => { rec.verdict = v; if (detail) rec.detail = detail; rec.confirmed = v === 'PASS'; };

// ── the DELIBERATE page.evaluate EXCEPTION (confined to crafted-precondition steps) ─────────────────────────
const TEST_ROUTE = /\/(typedtest|mcqtest)\//i;

// Adopted from lsr_reviewonly_whitebox.mjs (:55-74): read / deep-merge-patch / clear dailySessionState.sessionConfig
// on the test route only, with readback (a stale/overwritten blob → INVALID, never a false PASS).
async function readBlob(page) {
  return page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('dailySessionState') || 'null'); } catch { return null; } });
}
async function patchSessionConfig(page, patch) {
  if (!TEST_ROUTE.test(page.url())) return { ok: false, reason: `not on test route (url=${page.url()})` };
  return page.evaluate((p) => {
    const raw = sessionStorage.getItem('dailySessionState'); if (!raw) return { ok: false, reason: 'no dailySessionState present' };
    const blob = JSON.parse(raw); blob.sessionConfig = { ...(blob.sessionConfig || {}), ...p };
    if (p.__allocationNewWords !== undefined) { blob.sessionConfig.allocation = { ...(blob.sessionConfig.allocation || {}), newWords: p.__allocationNewWords }; delete blob.sessionConfig.__allocationNewWords; }
    sessionStorage.setItem('dailySessionState', JSON.stringify(blob));
    const back = JSON.parse(sessionStorage.getItem('dailySessionState')).sessionConfig;
    return { ok: true, back };
  }, patch);
}
async function clearBlob(page) {
  if (!TEST_ROUTE.test(page.url())) return { ok: false, reason: `not on test route (url=${page.url()})` };
  return page.evaluate(() => { sessionStorage.removeItem('dailySessionState'); return { ok: !sessionStorage.getItem('dailySessionState') }; });
}

// CUT-5 storage stub: patch Storage.prototype.setItem (shared by BOTH localStorage AND sessionStorage) to THROW
// once armed. That is EXACTLY the nonce_storage_degraded trigger (testRecovery.js:186-196 — persist fails on both
// layers → logNonceStorageDegraded). getItem is left intact by default so auth/session reads are unaffected; the
// degraded path only needs setItem to fail on both layers. The module memo (testRecovery.js:18/146,176) keeps ONE
// nonce → graded docId == saved docId. Probe confirms setItem now throws on BOTH storages (else INVALID).
async function armStorageKill(page) {
  return page.evaluate(() => {
    try {
      if (!window.__lsrStoragePatched) {
        const proto = Storage.prototype;
        const origSet = proto.setItem;
        proto.setItem = function (...a) {
          if (window.__lsrKillStorage) { const e = new Error('lsr white-box storage stub: setItem blocked'); e.name = 'QuotaExceededError'; throw e; }
          return origSet.apply(this, a);
        };
        window.__lsrStoragePatched = true;
      }
      window.__lsrKillStorage = true;
      let lThrew = false, sThrew = false;
      try { localStorage.setItem('__lsr_probe', '1'); } catch { lThrew = true; }
      try { sessionStorage.setItem('__lsr_probe', '1'); } catch { sThrew = true; }
      return { ok: lThrew && sThrew, lThrew, sThrew };
    } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
  });
}

// CUT-6 injected direct-write: use the app's OWN Firestore `db` (Vite dev serves ESM, so the SPA's singleton
// module is import()-able by URL) + the SDK, signed in AS the logged-in sandbox student, to attempt a DIRECT
// legacy client write to the student's own class_progress doc. Post-P6 the rules DENY it (RUL-4). Writes only a
// cosmetic `__cut6_probe` field (merge) so an ALLOWED write (pre-P6 env) cannot corrupt csd/twi. Returns whether
// the write EXECUTED and whether it was DENIED — the environmental gate for the C6-2 handler oracle.
async function injectDeniedProgressWrite(page, triple) {
  return page.evaluate(async ({ uid, classId, listId }) => {
    try {
      const fb = await import('/src/firebase.js');
      const fs = await import('firebase/firestore');
      const ref = fs.doc(fb.db, `users/${uid}/class_progress`, `${classId}_${listId}`);
      try {
        await fs.setDoc(ref, { __cut6_probe: Date.now() }, { merge: true });
        return { executed: true, denied: false };
      } catch (e) {
        const code = String((e && (e.code || e.name)) || '');
        const msg = String((e && e.message) || '');
        const denied = /permission[-_ ]denied|insufficient permissions|PERMISSION_DENIED/i.test(`${code} ${msg}`);
        return { executed: true, denied, code, message: msg.slice(0, 200) };
      }
    } catch (e) {
      return { executed: false, reason: String((e && e.message) || e).slice(0, 200) };
    }
  }, triple);
}

// Drive to a day-1 NEW-word test route (reaches /typedtest with dailySessionState written), WITHOUT submitting.
async function reachNewTest(page, label) {
  const t = await driveNewWordsToTest(page, F, label);
  return { reached: t.reached && TEST_ROUTE.test(page.url()) };
}

// Reload-prompt copy (all C6-2 emission sites: TypedTest.jsx:872/1133, DailySessionFlow.jsx:886/1573).
const RELOAD_PROMPT_RE = /앱이 업데이트되었습니다|진행 정보를 불러오지 못했습니다|The app was updated|Couldn'?t load your progress|reload the page|새로고침/i;
// Retake-gate / rebuild copy (the gate stayed CLOSED — W-RA4/W-RA4b).
const GATE_BLOCK_RE = /이 날을 완료하려면|Day not complete|retake required|not complete|did not pass|세션 정보가 갱신|session was refreshed|갱신/i;

// ── SCENARIOS ─────────────────────────────────────────────────────────────────────────────────────────────
const WB = {
  // W-RA3g — a genuine reviewOnlyDay:true (throttle) SKIPS the gate and completes; the PAIRED negative (a
  // non-review-only unpassed day still BLOCKS) is asserted organically. Positive arm adopted from
  // lsr_reviewonly_whitebox.mjs 'W-RA3-gate' (:129-143). (studyService.js:1675-1677 gate + :1772 skip.)
  'W-RA3g': async (c) => {
    // POSITIVE arm — throttle day is review-only (server + client derive reviewOnlyDay:true) → completes.
    await FB.seedInterventionWindow({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId, csd: 4, twi: c.pace * 2 });
    await goDashboard(c.page).catch(() => {});
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const ent = await enterReviewSession(c.page, F, 'W-RA3g-pos');
    if (!ent.reached) return setV(c.rec, 'INVALID', 'positive arm: could not reach the review test on a throttle day');
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rows, null), F, 'W-RA3g-pos');
    await returnFromResultsAndClearCompletion(c.page, F, 'W-RA3g-pos').catch(() => {});
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    if (outcome !== 'results') return setV(c.rec, 'FAIL', `positive arm: reviewOnlyDay did NOT skip the gate (outcome=${outcome})`);
    if (post.csd !== pre.csd + 1) return setV(c.rec, 'FAIL', `positive arm: csd ${pre.csd}->${post.csd} (want +1 — gate should have been skipped)`);
    if (post.twi !== pre.twi) return setV(c.rec, 'FAIL', `positive arm: twi ${pre.twi}->${post.twi} (want FLAT on a review-only day)`);

    // NEGATIVE arm — a fresh NON-review-only day with an unpassed new-word test still BLOCKS (gate intact).
    // Definitive invariant: the day must NOT complete → csd stays FLAT (robust; the blocked TEXT corroborates).
    await FB.resetStudentState({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId });
    await goDashboard(c.page).catch(() => {});
    const rN = await reachNewTest(c.page, 'W-RA3g-neg');
    if (!rN.reached) return setV(c.rec, 'INVALID', 'negative arm: could not reach a fresh new-word test route');
    const preN = await FB.readProgress(c.uid, c.classId, c.listId);
    const rowsN = await readTestRows(c.page);
    const { outcome: outN } = await fillSubmitAndObserve(c.page, partialAnswers(rowsN, 0, null), F, 'W-RA3g-neg'); // all-blank → fail
    await sleep(1500);
    const postN = await FB.readProgress(c.uid, c.classId, c.listId);
    if (outN === 'timeout' || outN === 'save-error' || outN === 'grading-failed') return setV(c.rec, 'INVALID', `negative arm: submit did not produce a gradeable outcome (${outN}) — could not exercise the gate`);
    const blockedText = outN === 'retake-gate' || await c.page.getByText(GATE_BLOCK_RE).first().isVisible().catch(() => false);
    if (postN.csd !== preN.csd) return setV(c.rec, 'FAIL', `negative arm: non-review-only unpassed day COMPLETED (csd ${preN.csd}->${postN.csd}) — gate failed to block (outcome=${outN})`);
    setV(c.rec, 'PASS', `reviewOnlyDay skipped the gate + completed (csd ${pre.csd}->${post.csd}, twi flat); non-review-only unpassed day still BLOCKED (csd flat @${postN.csd}, blockedText=${blockedText})`);
  },

  // W-RA4 — absent config: cleared dailySessionState → reviewOnlyDay false (Number.isFinite(undefined)) → the gate
  // applies iff no passed attempt. Deterministic (no "or self-heal"). Adopted from reviewonly_whitebox (:115-124).
  'W-RA4': async (c) => {
    const r = await reachNewTest(c.page, 'W-RA4'); if (!r.reached) return setV(c.rec, 'INVALID', 'no test route to clear config on');
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const cl = await clearBlob(c.page); if (!cl.ok) return setV(c.rec, 'INVALID', `clear failed: ${cl.reason}`);
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, partialAnswers(rows, 0, null), F, 'W-RA4');
    await sleep(1500);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    if (outcome === 'timeout') return setV(c.rec, 'INVALID', 'submit produced no visible outcome within the deadline — could not exercise the gate');
    const blockedText = outcome === 'retake-gate' || await c.page.getByText(GATE_BLOCK_RE).first().isVisible().catch(() => false);
    // Definitive invariant: absent config must NOT complete the day (fails CLOSED) → csd FLAT.
    if (post.csd !== pre.csd) return setV(c.rec, 'FAIL', `absent config COMPLETED the day (csd ${pre.csd}->${post.csd}) — must fail CLOSED (outcome=${outcome})`);
    setV(c.rec, 'PASS', `absent config → gate applied / rebuilt, csd flat @${post.csd} (fails CLOSED, outcome=${outcome}, blockedText=${blockedText})`);
  },

  // W-RA4b — stale finite-0 must NOT open the gate. Craft: newWordCount 0 BUT allocation.newWords>0 +
  // isListComplete false (NO confirmed review-only reason) → reviewOnlyReasonConfirmed FALSE → reviewOnlyDay FALSE
  // → the gate applies (retake) even though newWordCount is a stale 0. Adopted from reviewonly_whitebox (:95-111).
  'W-RA4b': async (c) => {
    const r = await reachNewTest(c.page, 'W-RA4b'); if (!r.reached) return setV(c.rec, 'INVALID', 'could not reach a test route to inject on');
    const pre = await FB.readProgress(c.uid, c.classId, c.listId);
    const before = await readBlob(c.page); if (!before?.sessionConfig) return setV(c.rec, 'INVALID', 'no dailySessionState.sessionConfig to patch');
    const patch = { newWordCount: 0, startPhase: 'new_words_study', isListComplete: false, __allocationNewWords: before.sessionConfig?.allocation?.newWords ?? c.pace };
    const ap = await patchSessionConfig(c.page, patch);
    if (!ap.ok) return setV(c.rec, 'INVALID', `patch failed: ${ap.reason}`);
    if (ap.back.newWordCount !== 0) return setV(c.rec, 'INVALID', `readback newWordCount=${ap.back.newWordCount} (patch didn't stick)`);
    if (!(Number.isFinite(ap.back.allocation?.newWords) && ap.back.allocation.newWords > 0)) return setV(c.rec, 'INVALID', `craft needs allocation.newWords>0 (got ${ap.back.allocation?.newWords}) to keep reviewOnlyReasonConfirmed FALSE`);
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, partialAnswers(rows, 0, null), F, 'W-RA4b'); // blanks → no pass
    await sleep(1500);
    const post = await FB.readProgress(c.uid, c.classId, c.listId);
    const afterBlob = await readBlob(c.page);
    if (afterBlob?.sessionConfig?.newWordCount !== 0) F.add('note', `[W-RA4b] blob newWordCount changed after submit → ${afterBlob?.sessionConfig?.newWordCount} (possible overwrite)`);
    if (outcome === 'timeout') return setV(c.rec, 'INVALID', 'submit produced no visible outcome within the deadline — could not exercise the gate');
    const blockedText = outcome === 'retake-gate' || await c.page.getByText(GATE_BLOCK_RE).first().isVisible().catch(() => false);
    // Definitive invariant: a stale finite-0 must NOT open the gate → the unpassed day must NOT complete → csd FLAT.
    if (post.csd !== pre.csd) return setV(c.rec, 'FAIL', `stale newWordCount:0 OPENED the gate — the unpassed day COMPLETED (csd ${pre.csd}->${post.csd}) — ROI-1 regression (outcome=${outcome})`);
    setV(c.rec, 'PASS', `stale finite-0 did NOT open the gate; unpassed day did NOT complete (csd flat @${post.csd}, outcome=${outcome}, blockedText=${blockedText})`);
  },

  // CS-11 — reviewonly_derivation_mismatch tripwire (P4 v3-MED; server leg functions/foundation.js:1225-1233,
  // logs WITH userId). MISMATCH arm: a GENUINE new-word day (server derives reviewOnlyDay:FALSE) with the client
  // preview CRAFTED to reviewOnlyDay:TRUE (newWordCount:0 + allocation.newWords:0 → reviewOnlyReasonConfirmed TRUE
  // → client short-circuits the gate + sends clientReviewOnlyDay:true, studyService.js:1817) → server disagrees →
  // event. AGREEING arm: a fresh un-crafted day → client==server → NO event. Client sends clientReviewOnlyDay only
  // under SERVER_PROGRESS_WRITE (flag-on fns env) — a dark callable => no event on EITHER arm => INVALID (env).
  'CS-11': async (c) => {
    // ── MISMATCH arm ──
    const sinceA = Date.now();
    const rA = await reachNewTest(c.page, 'CS-11-mismatch'); if (!rA.reached) return setV(c.rec, 'INVALID', 'mismatch arm: no new-word test route');
    const before = await readBlob(c.page); if (!before?.sessionConfig) return setV(c.rec, 'INVALID', 'mismatch arm: no dailySessionState.sessionConfig to craft the preview');
    const ap = await patchSessionConfig(c.page, { newWordCount: 0, __allocationNewWords: 0, isListComplete: false });
    if (!ap.ok) return setV(c.rec, 'INVALID', `mismatch arm: preview patch failed: ${ap.reason}`);
    if (ap.back.newWordCount !== 0 || ap.back.allocation?.newWords !== 0) return setV(c.rec, 'INVALID', `mismatch arm: craft did not stick (newWordCount=${ap.back.newWordCount}, alloc.newWords=${ap.back.allocation?.newWords})`);
    const rowsA = await readTestRows(c.page);
    const { outcome: outA } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rowsA, null), F, 'CS-11-mismatch'); // pass → completion proceeds (gate skipped)
    await sleep(3000);
    await shot(c.page, `DFWB_CS11_mismatch_${runId}`);
    const logsA = await FB.readSystemLogsSince(c.uid, sinceA, ['reviewonly_derivation_mismatch']);
    await returnFromResultsAndClearCompletion(c.page, F, 'CS-11-mismatch').catch(() => {});

    // ── AGREEING control arm (fresh day, no craft) ──
    await FB.resetStudentState({ email: c.email, uid: c.uid, classId: c.classId, listId: c.listId });
    const sinceB = Date.now();
    await goDashboard(c.page).catch(() => {});
    const rB = await reachNewTest(c.page, 'CS-11-agree'); if (!rB.reached) return setV(c.rec, 'INVALID', 'agreeing arm: no new-word test route after reset');
    const rowsB = await readTestRows(c.page);
    const { outcome: outB } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rowsB, null), F, 'CS-11-agree');
    await sleep(3000);
    const logsB = await FB.readSystemLogsSince(c.uid, sinceB, ['reviewonly_derivation_mismatch']);

    if (!logsA.reviewonly_derivation_mismatch) return setV(c.rec, 'INVALID', `crafted mismatch produced NO reviewonly_derivation_mismatch (outA=${outA}) — SERVER_PROGRESS_WRITE/completeSession tripwire not active in this env (oracle deferred), never a false PASS`);
    if (logsB.reviewonly_derivation_mismatch) return setV(c.rec, 'FAIL', `agreeing day EMITTED reviewonly_derivation_mismatch×${logsB.reviewonly_derivation_mismatch} (false tripwire; outB=${outB})`);
    setV(c.rec, 'PASS', `crafted mismatch → reviewonly_derivation_mismatch×${logsA.reviewonly_derivation_mismatch}; agreeing day → none`);
  },

  // CUT-5 — nonce F1+F3 client legs (P4). Storage-stubbed typed grade→save keeps ONE attempt docId (the module
  // memo guarantees graded docId == saved docId even when BOTH storages throw) and emits nonce_storage_degraded
  // (testRecovery.js:29 → logSystemEvent, WITH the logging user's uid). Oracle: EXACTLY one new attempt doc + the
  // degraded event + a results screen. TWO docs = the F1/F3 double-derivation regression (FAIL).
  'CUT-5': async (c) => {
    const since = Date.now();
    const r = await reachNewTest(c.page, 'CUT-5'); if (!r.reached) return setV(c.rec, 'INVALID', 'could not reach a new-word test route to grade→save on');
    const rows = await readTestRows(c.page);
    const preAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const kill = await armStorageKill(c.page);
    if (!kill.ok) return setV(c.rec, 'INVALID', `storage stub did not materialize (setItem still writable on both layers): l=${kill.lThrew} s=${kill.sThrew} ${kill.reason || ''}`);
    const { outcome } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rows, null), F, 'CUT-5');
    await sleep(2500);
    await shot(c.page, `DFWB_CUT5_${runId}`);
    const postAtt = await FB.readAttempts(c.uid, c.classId, c.listId);
    const newCreated = postAtt.newAttempts - preAtt.newAttempts;
    const logs = await FB.readSystemLogsSince(c.uid, since, ['nonce_storage_degraded']);
    if (newCreated > 1) return setV(c.rec, 'FAIL', `${newCreated} NEW attempt docs created under degraded storage — graded docId != saved docId (F1/F3 double-derivation regression)`);
    if (outcome !== 'results') return setV(c.rec, 'INVALID', `grade→save did not reach a results screen under the storage stub (outcome=${outcome}) — env/calibration`);
    if (newCreated < 1) return setV(c.rec, 'INVALID', `no NEW attempt doc created (outcome=${outcome}) — save leg not observed`);
    if (!logs.nonce_storage_degraded) return setV(c.rec, 'INVALID', `exactly ONE attempt doc (good) but nonce_storage_degraded NOT logged — event-name/userId/env calibration (oracle deferred), never a false PASS`);
    setV(c.rec, 'PASS', `ONE attempt doc under degraded storage (graded==saved) + nonce_storage_degraded×${logs.nonce_storage_degraded}`);
  },

  // CUT-6 — denied-legacy-write handler (P4; [C6-2], DORMANT until the P6 rules cutoff). PRECONDITION (injected
  // direct-write via the app's own db): a direct client class_progress write must be DENIED by the deployed rules
  // (else pre-P6 env → the handler can't be exercised → INVALID). MEASURED: a real typed grade→completion. ORACLE:
  // a reload prompt + legacy_write_denied event + NO results screen = PASS; a results screen WITH a legacy_write_denied
  // event = the swallow bug (FAIL); a clean results screen with no denial = the server-write path (INVALID env).
  'CUT-6': async (c) => {
    const since = Date.now();
    const r = await reachNewTest(c.page, 'CUT-6'); if (!r.reached) return setV(c.rec, 'INVALID', 'could not reach a new-word test route to complete on');
    const inj = await injectDeniedProgressWrite(c.page, { uid: c.uid, classId: c.classId, listId: c.listId });
    if (!inj.executed) return setV(c.rec, 'INVALID', `injected direct-write handle failed (Vite /src/firebase.js import path calibration): ${inj.reason}`);
    if (!inj.denied) return setV(c.rec, 'INVALID', `direct legacy class_progress write was ALLOWED (code=${inj.code || 'none'}) — P6 rules not yet at the cutoff; the C6-2 denied-write handler cannot be exercised in this env`);
    const rows = await readTestRows(c.page);
    const { outcome } = await fillSubmitAndObserve(c.page, carefulAnswersFrom(rows, null), F, 'CUT-6');
    await sleep(2500);
    await shot(c.page, `DFWB_CUT6_${runId}`);
    const reloadPrompt = await c.page.getByText(RELOAD_PROMPT_RE).first().isVisible().catch(() => false);
    const sawResults = outcome === 'results';
    const logs = await FB.readSystemLogsSince(c.uid, since, ['legacy_write_denied']);
    const denied = !!logs.legacy_write_denied;
    if (reloadPrompt && denied && !sawResults) return setV(c.rec, 'PASS', `denied legacy completion → reload prompt + legacy_write_denied×${logs.legacy_write_denied}, NO results screen`);
    if (sawResults && denied) return setV(c.rec, 'FAIL', `a denied write (legacy_write_denied×${logs.legacy_write_denied}) was SWALLOWED into a results screen ([C6-2] regression)`);
    if (sawResults && !denied) return setV(c.rec, 'INVALID', `completion reached results with NO legacy client denial — SERVER_PROGRESS_WRITE server path active; the C6-2 client-denial handler stayed dormant, cannot certify here`);
    return setV(c.rec, 'INVALID', `denied-completion handler not conclusively observed (reloadPrompt=${reloadPrompt}, legacy_write_denied=${logs.legacy_write_denied || 0}, outcome=${outcome}) — env/calibration; never a false PASS`);
  },
};

// ── provisioning (mirrors lsr_reviewonly_whitebox.mjs :76-84) ───────────────────────────────────────────────
async function provision(browser, className) {
  const { page: tp } = await newAuditPage(browser, F, 'teacher');
  let code = null;
  if (await login(tp, TEACHER, F)) {
    await createClass(tp, className, F);
    await assignList(tp, className, LIST.title, { pace: 3, thr: 92, mode: 'typed', reviewMode: 'typed', testSize: 30, listId: LIST.id }, F);
    code = await readJoinCode(tp, className, F);
  }
  await tp.context().close().catch(() => {});
  const cq = await FB.db().collection('classes').where('name', '==', className).get();
  if (cq.size !== 1) return { ok: false, reason: `INVALID (${cq.size} classes named "${className}")` };
  return { ok: true, classId: cq.docs[0].id, code };
}

// ── run ───────────────────────────────────────────────────────────────────────────────────────────────────
let si = 0;
console.log(`\n▶ deepfix M-WB ${runId} — BASE=${BASE} build=${BUILD_ID} tier=${LIST.tier} list=${LIST.title}(${LIST.size}) (SEPARATE white-box matrix; page.evaluate exception)\n`);
const browser = await launch();
try {
  for (const id of SCEN) {
    const rec = { id, verdict: 'PENDING', confirmed: false, detail: '' }; results.push(rec);
    const fn = WB[id]; if (!fn) { setV(rec, 'INVALID', 'unknown scenario'); console.log(`  ⚠️ ${id} INVALID — unknown scenario`); continue; }
    const email = STUDENTS[si % STUDENTS.length]; si++;
    // Resolve the sandbox uid; auto-provision a FRESH account if missing (clean day-1 → no list-scoped
    // pollution, the r14 fail-class). admin is already initialized (readListWordCount above called FB.db()).
    // uidByEmail now throws on infra errors (only null == genuinely-missing) — wrap so one bad account
    // marks its scenario INVALID, not the whole run. Sandbox lsr_* only (identity-guarded above).
    let uid;
    try {
      uid = await FB.uidByEmail(email);
      if (!uid) { uid = (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid; F.add('provision', `[${id}] created fresh sandbox account ${email}`); }
    } catch (e) { setV(rec, 'INVALID', `uid resolve/create failed for ${email}: ${String(e).slice(0, 160)}`); console.log(`  ⚠️ ${id} INVALID — uid resolve/create failed`); continue; }
    rec.email = email; rec.uid = uid; rec.listId = LIST.id;
    try {
      const className = `25WT DFWB ${id} ${runId}`;
      const prov = await provision(browser, className); if (!prov.ok) { setV(rec, 'INVALID', prov.reason); console.log(`  ⚠️ ${id} INVALID — ${prov.reason}`); continue; }
      rec.classId = prov.classId;
      await FB.resetStudentState({ email, uid, classId: prov.classId, listId: LIST.id });
      const { page } = await newAuditPage(browser, F, `wb-${id}`);
      if (!(await login(page, email, F))) { setV(rec, 'INVALID', 'student login failed'); await page.context().close().catch(() => {}); console.log(`  ⚠️ ${id} INVALID — login failed`); continue; }
      await joinClass(page, prov.code, className, F, id);
      await selectList(page, LIST.title, F, id).catch(() => {});
      await goDashboard(page).catch(() => {});
      await fn({ page, email, uid, classId: prov.classId, listId: LIST.id, className, pace: 3, thr: 92, rec, id });
      await page.context().close().catch(() => {});
    } catch (e) {
      if (rec.verdict === 'PENDING') setV(rec, 'FAIL', `exception: ${String(e).slice(0, 200)}`);
      F.add('exception', `[${id}] ${String(e).slice(0, 200)}`);
    }
    console.log(`  ${rec.verdict === 'PASS' ? '✅' : rec.verdict === 'INVALID' ? '⚠️' : '❌'} ${id} ${rec.verdict} — ${rec.detail || ''}`);
  }
} finally { await browser.close().catch(() => {}); }

// fatal app-health signals invalidate the whole run (console-error/request-failed filtered through the allowlist).
const fatals = [
  ...F.raw.filter((x) => FATAL_KINDS.includes(x.kind)),
  ...F.raw.filter((x) => x.kind === 'console-error' && !isFirestoreChannelAbort(x.detail) && !CONSOLE_ALLOW.some((re) => re.test(x.detail))),
  ...F.raw.filter((x) => x.kind === 'request-failed' && !isFirestoreChannelAbort(x.detail)),
];
const allClean = results.length === SCEN.length && results.every((r) => r.verdict === 'PASS') && fatals.length === 0;
const manifest = {
  runId, buildId: BUILD_ID, matrix: 'M-WB', kind: 'white-box', gitHead, gitDirty, base: BASE, ranAt: new Date().toISOString(),
  scenarioSet: SCEN, tier: LIST.tier, listId: LIST.id, listSize: LIST.size, teacher: TEACHER, studentPool: STUDENTS.length,
  results: results.map((r) => ({ id: r.id, verdict: r.verdict, confirmed: r.confirmed, detail: r.detail, studentUid: r.uid, classId: r.classId, listId: r.listId })),
  fatals: fatals.map((f) => `${f.kind}: ${f.detail}`),
  cleanCount: results.filter((r) => r.verdict === 'PASS').length,
  verdict: allClean ? 'PASS' : 'NOT-CLEAN',
};
writeFileSync(`${AUD}/findings/deepfix_wb_${runId}.json`, JSON.stringify(manifest, null, 2));

let md = `# deepfix M-WB (white-box) — ${runId}\n\n`;
md += `**When:** ${manifest.ranAt}  \n**BASE:** ${BASE}  \n**Build:** ${BUILD_ID}  \n`;
md += `**git:** ${gitHead}${gitDirty ? ' (DIRTY)' : ''}  \n**List:** ${LIST.title} (${LIST.tier}, ${LIST.size} words)  \n`;
md += `**Result:** ${manifest.cleanCount}/${SCEN.length} PASS · ${fatals.length} fatal anomalies · **${manifest.verdict}**\n\n`;
md += `> White-box matrix — page.evaluate exception CONFINED to crafted preconditions; oracles observational.\n`;
md += `> INVALID = a precondition/craft/env could not be materialized (setup, NOT a pass). Only PASS certifies.\n\n`;
md += `| Scenario | Verdict | studentUid | classId | Detail |\n|---|---|---|---|---|\n`;
for (const r of results) md += `| ${r.id} | ${r.verdict} | ${(r.uid || '').slice(0, 10)} | ${(r.classId || '').slice(0, 10)} | ${(r.detail || '').replace(/\|/g, '/').slice(0, 150)} |\n`;
if (fatals.length) { md += `\n**Fatal anomalies:**\n`; for (const f of fatals.slice(0, 20)) md += `- ${f.kind}: ${String(f.detail).slice(0, 160)}\n`; }
writeFileSync(`${AUD}/findings/deepfix_wb_${runId}.md`, md);

console.log(`\n=== deepfix M-WB MANIFEST (${runId}) ===`);
for (const r of manifest.results) console.log(`  ${r.verdict === 'PASS' ? '✅' : r.verdict === 'INVALID' ? '⚠️' : '❌'} ${r.id.padEnd(8)} ${r.verdict} — ${r.detail || ''}`);
if (fatals.length) console.log(`  ⛔ ${fatals.length} fatal app-health signal(s)`);
console.log(`\n${allClean ? '✅ deepfix M-WB PASS' : '❌ NOT CLEAN'} — ${manifest.cleanCount}/${SCEN.length} → findings/deepfix_wb_${runId}.json`);
process.exit(allClean ? 0 : 1);
