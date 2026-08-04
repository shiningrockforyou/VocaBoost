#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-B SUBMIT — PURE client fixtures (no Firebase, no network)
 * ============================================================================
 * Exercises the REAL `src/services/reviewV2Submit.js` (the module MCQTest /
 * TypedTest call behind REVIEW_V2_CLIENT) with injected submit/compose
 * functions and storage, proving the client-side laws of the fold ledger:
 *
 *   V1/PAYLOAD  the request is EXACTLY {presentationId, answers} — no
 *               attemptDocId, no totalQuestions, nothing rides along. The
 *               client-minted nonce was the 06-29 outage root cause.
 *   A2/CENSUS   every V4 status maps to its contracted outcome: terminal
 *               attempt_written (replayed included) · poll grading_in_progress
 *               (SAME submit, bounded, never recompose) · recompose-ONCE
 *               grade_unusable · six block-with-reason · config_hold /
 *               review_v2_dark ⇒ LEGACY as data · the thrown trio ⇒ LEGACY
 *               via classifyThrownRefusal · unknown/malformed ⇒ blocked with
 *               a non-empty reason, never a blank screen.
 *   C3          the recompose-once guard, BOTH legs: it fires exactly once;
 *               the SECOND grade_unusable does NOT recompose again. Plus the
 *               full A2 bypass set: immediate second unusable · reload
 *               between refusal and recompose (guard persisted, not state) ·
 *               two tabs (per-tab bound) · a recompose that itself refuses ·
 *               a user retry after the automatic one · success closes the
 *               incident. This case is what kills mutant M-C4-UNBOUNDED.
 *   C6          the page/testConfig boundary builders: rv2McqAnswers /
 *               rv2TypedAnswers (answered-only rows, presentation order,
 *               de-duped, definition-string responses) and
 *               rv2RowsToTypedResults (the read-back mapping — verdicts are
 *               never fabricated).
 *   C2/STATIC   FLAG-OFF PARITY, checked line by line against the page
 *               source bytes: the legacy MCQ submitVocabAttempt call + its
 *               context block, the legacy typed TWO-call sequence
 *               (gradeTypedTest → submitVocabAttempt with BOTH gradeToken
 *               fields), every rv2 gate reduced to today's condition when
 *               REVIEW_V2_CLIENT=false, REVIEW_V2_CLIENT=false itself, and
 *               GRADE_TOKEN_MINT/ENFORCED=false untouched.
 *
 * Run: node scripts/deepfix2/cutover-b-submit-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/cutover-b-submit-pure.json
 * (CUTOVER_B_PURE_RECEIPT env redirects the receipt — the mutant driver uses
 * it so a mutant run can never clobber the canonical receipt.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  submitAttemptV2,
  recomposeGuardScope,
  recomposeUsed,
  markRecomposeUsed,
  clearRecomposeGuard,
  rv2McqAnswers,
  rv2TypedAnswers,
  rv2RowsToTypedResults,
  SUBMIT_POLL_RETRIES,
} from "../../src/services/reviewV2Submit.js";
import { ReviewV2Error, RV2 } from "../../src/services/reviewV2Client.js";
import { refusalReasonText } from "../../src/services/reviewV2Compose.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

/** Per-test fake sessionStorage (one per simulated TAB). */
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    _dump: () => Object.fromEntries(m),
  };
}

const IDS = { uid: "u1", classId: "c1", listId: "l1", logicalDay: 2, kind: "review" };
const PRES = "c1_l1_d2_e0_p1";
const ANSWERS = [{ wordId: "w1", studentResponse: "def-1" }, { wordId: "w4", studentResponse: "def-4" }];

const WRITTEN = {
  status: "attempt_written", replayed: false, attemptId: `rv2_u1_${PRES}`,
  score: 50, passed: false, totalQuestions: 4, correctCount: 2,
  stamped: 4, stampSkipped: null, rerunGraduated: [], visitHalf: null,
};

/** A canonical successful compose payload for the recompose leg. */
function composedSessionResult(presentationId = "c1_l1_d2_e0_p2") {
  return {
    status: "composed",
    queue: {
      queueId: "c1_l1_d2_e0",
      orderedQueueWordIds: ["w0", "w1", "w2", "w3", "w4", "w5"],
      snapshot: { threshold: 92, queueSize: 6, testSize: 4, reviewTestType: "mcq" },
      logicalDay: 2, resetEpoch: 0,
    },
    presentation: {
      presentationId,
      presentedWordIds: ["w4", "w1", "w5", "w2"],
      testType: "mcq", compositionVersion: "lrt-v1",
    },
  };
}
function composedNewResult() {
  return {
    status: "composed",
    presentation: {
      presentationId: "c1_l1_d2_e0_n2",
      presentedWordIds: ["w9", "w10"],
      testType: "mcq", compositionVersion: "new-day",
      rangeStartIndex: 9, rangeEndIndex: 10,
    },
  };
}

const immediateSleep = () => {
  const calls = [];
  return { calls, fn: async (ms) => { calls.push(ms); } };
};

// ===========================================================================
CASE("V1/PAYLOAD — the request is EXACTLY {presentationId, answers}; nothing rides along");
{
  const seen = [];
  const res = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage: fakeStorage(), submitFn: async (payload) => { seen.push(payload); return { ...WRITTEN }; } },
  );
  check("outcome", res.outcome, "written");
  check("exactly one submit call", seen.length, 1);
  check("payload keys are EXACTLY [presentationId, answers]",
    Object.keys(seen[0]).sort(), ["answers", "presentationId"]);
  check("presentationId verbatim", seen[0].presentationId, PRES);
  check("answers verbatim", seen[0].answers, ANSWERS);
  checkTrue("no attemptDocId smuggled", !("attemptDocId" in seen[0]));
  checkTrue("no totalQuestions smuggled", !("totalQuestions" in seen[0]));
  for (const row of seen[0].answers) {
    check("answer row keys are EXACTLY [wordId, studentResponse]",
      Object.keys(row).sort(), ["studentResponse", "wordId"]);
  }
}

CASE("WRITTEN — server verdict normalized; replay is a SUCCESS; success clears the once-guard");
{
  const storage = fakeStorage();
  const res = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage, submitFn: async () => ({ ...WRITTEN }) },
  );
  check("written envelope", {
    outcome: res.outcome, replayed: res.replayed, attemptId: res.attemptId,
    score: res.score, passed: res.passed, totalQuestions: res.totalQuestions, correctCount: res.correctCount,
  }, {
    outcome: "written", replayed: false, attemptId: `rv2_u1_${PRES}`,
    score: 50, passed: false, totalQuestions: 4, correctCount: 2,
  });
  // A replay (idempotent re-submit) is a terminal success, not an error.
  const replay = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage, submitFn: async () => ({ ...WRITTEN, replayed: true }) },
  );
  check("replayed:true surfaces as written", [replay.outcome, replay.replayed], ["written", true]);
  // Success closes an open grade-unusable incident: pre-set guard is cleared.
  const scope = recomposeGuardScope(IDS);
  markRecomposeUsed(scope, { storage });
  check("guard pre-set", recomposeUsed(scope, { storage }), true);
  await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage, submitFn: async () => ({ ...WRITTEN }) },
  );
  check("attempt_written cleared the guard", recomposeUsed(scope, { storage }), false);
  // passed:true passes through.
  const pass = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage, submitFn: async () => ({ ...WRITTEN, score: 100, passed: true, correctCount: 4 }) },
  );
  check("passing verdict", [pass.passed, pass.score], [true, 100]);
}

CASE("A2/CENSUS — data channel: six blocked-with-reason · not-serving pair ⇒ legacy · stale ⇒ blocked · unknown/malformed ⇒ blocked generic");
{
  const blockedStatuses = [
    "presentation_invalid", "queue_invalid", "visit_invalid",
    "day_guard_rejected", "reset_in_progress", "reset_epoch_mismatch",
  ];
  for (const status of blockedStatuses) {
    const composeCalls = [];
    const res = await submitAttemptV2(
      { ...IDS, presentationId: PRES, answers: ANSWERS },
      { storage: fakeStorage(), submitFn: async () => ({ status }),
        composeSessionFn: async () => { composeCalls.push(1); return composedSessionResult(); } },
    );
    check(`${status} ⇒ blocked`, [res.outcome, res.status], ["blocked", status]);
    checkTrue(`${status} carries a rendered reason`, typeof res.reason === "string" && res.reason.length > 0);
    check(`${status} never recomposes`, composeCalls.length, 0);
  }
  for (const status of ["config_hold", "review_v2_dark"]) {
    const res = await submitAttemptV2(
      { ...IDS, presentationId: PRES, answers: ANSWERS },
      { storage: fakeStorage(), submitFn: async () => ({ status }) },
    );
    check(`${status} ⇒ legacy`, [res.outcome, res.via, res.status], ["legacy", "status", status]);
  }
  const stale = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage: fakeStorage(), submitFn: async () => ({ status: "client_version_stale" }) },
  );
  check("stale client ⇒ blocked (force-refresh contract)", [stale.outcome, stale.status], ["blocked", "client_version_stale"]);
  check("stale reason is the frozen force-refresh copy", stale.reason, refusalReasonText("client_version_stale"));
  // UNKNOWN + malformed fail closed with a NON-EMPTY reason — never blank,
  // never a silent legacy fallback.
  for (const bad of [{ status: "some_future_status_v9" }, null, undefined, {}, { data: 1 }]) {
    const res = await submitAttemptV2(
      { ...IDS, presentationId: PRES, answers: ANSWERS },
      { storage: fakeStorage(), submitFn: async () => bad },
    );
    check(`malformed/unknown ${JSON.stringify(bad)} ⇒ blocked`, res.outcome, "blocked");
    checkTrue("carries a reason", typeof res.reason === "string" && res.reason.length > 0);
  }
}

CASE("A2/THROWN — the trio (both code forms) ⇒ LEGACY; other throws ⇒ blocked retryable with reason");
{
  const legacyCodes = [
    "not-found", "permission-denied", "failed-precondition",
    "functions/not-found", "functions/permission-denied", "functions/failed-precondition",
  ];
  for (const code of legacyCodes) {
    const res = await submitAttemptV2(
      { ...IDS, presentationId: PRES, answers: ANSWERS },
      { storage: fakeStorage(), submitFn: async () => { throw new ReviewV2Error(code, `thrown ${code}`); } },
    );
    check(`thrown ${code} ⇒ legacy`, [res.outcome, res.via, res.code], ["legacy", "error", code]);
  }
  for (const code of ["internal", "unauthenticated", "invalid-argument", "unavailable", "deadline-exceeded", "functions/internal"]) {
    const res = await submitAttemptV2(
      { ...IDS, presentationId: PRES, answers: ANSWERS },
      { storage: fakeStorage(), submitFn: async () => { throw new ReviewV2Error(code, `thrown ${code}`); } },
    );
    check(`thrown ${code} ⇒ blocked`, res.outcome, "blocked");
    checkTrue(`thrown ${code} reason`, typeof res.reason === "string" && res.reason.length > 0);
    check(`thrown ${code} retryable (answers preserved; replay-safe)`, res.retryable, true);
  }
  const bare = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage: fakeStorage(), submitFn: async () => { throw new Error("boom"); } },
  );
  check("bare Error ⇒ blocked with reason", [bare.outcome, typeof bare.reason], ["blocked", "string"]);
}

CASE("A2/POLL — grading_in_progress retries the SAME submit, bounded; NEVER recomposes");
{
  // Resolves after two polls.
  let calls = 0;
  const sleeps = immediateSleep();
  const composeCalls = [];
  const res = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    {
      storage: fakeStorage(),
      submitFn: async (payload) => {
        calls++;
        check(`poll call ${calls} keeps the SAME payload (never a new composeKey)`,
          [payload.presentationId, payload.answers.length], [PRES, ANSWERS.length]);
        return calls <= 2 ? { status: "grading_in_progress" } : { ...WRITTEN };
      },
      sleepFn: sleeps.fn, pollIntervalMs: 1234,
      composeSessionFn: async () => { composeCalls.push(1); return composedSessionResult(); },
    },
  );
  check("resolves to written after the transient clears", res.outcome, "written");
  check("3 submit calls (1 + 2 polls)", calls, 3);
  check("2 sleeps at the injected interval", sleeps.calls, [1234, 1234]);
  check("polling NEVER recomposed", composeCalls.length, 0);
  // Exhaustion: bounded, blocked retryable — the student can submit again.
  let calls2 = 0;
  const res2 = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage: fakeStorage(), submitFn: async () => { calls2++; return { status: "grading_in_progress" }; },
      sleepFn: async () => {}, pollRetries: 3 },
  );
  check("exhaustion ⇒ blocked grading_in_progress", [res2.outcome, res2.status], ["blocked", "grading_in_progress"]);
  check("exhaustion is retryable with a reason", [res2.retryable, res2.reason.length > 0], [true, true]);
  check("exactly pollRetries+1 submit calls (bounded)", calls2, 4);
  check("default retry budget is the exported constant", SUBMIT_POLL_RETRIES, 8);
}

// ===========================================================================
CASE("C3 — grade_unusable recomposes EXACTLY ONCE; the SECOND unusable does NOT recompose (kills M-C4-UNBOUNDED)");
{
  const storage = fakeStorage();
  const composeKeysSeen = [];
  // Pre-seed a composeKey so the fresh-mint (freshKey:true ⇒ discard + new)
  // is observable as a DIFFERENT key reaching the compose call.
  const ckScope = "rv2ck.u1.c1.l1.d2.review";
  storage.setItem(ckScope, "stale-key-0001");
  const deps = {
    storage,
    submitFn: async () => ({ status: "grade_unusable" }),
    composeSessionFn: async ({ composeKey }) => { composeKeysSeen.push(composeKey); return composedSessionResult(); },
  };
  // LEG 1: the FIRST unusable recomposes exactly once.
  const first = await submitAttemptV2({ ...IDS, presentationId: PRES, answers: ANSWERS }, deps);
  check("first unusable ⇒ recomposed", first.outcome, "recomposed");
  checkTrue("carries a rendered reason", typeof first.reason === "string" && first.reason.length > 0);
  check("carries the fresh compose envelope", first.compose.presentationId, "c1_l1_d2_e0_p2");
  check("exactly ONE compose call", composeKeysSeen.length, 1);
  checkTrue("the recompose used a FRESH composeKey (freshKey semantics)",
    composeKeysSeen[0] !== "stale-key-0001" && /^[A-Za-z0-9._-]{8,128}$/.test(composeKeysSeen[0]));
  check("guard is now set (persisted, not component state)",
    recomposeUsed(recomposeGuardScope(IDS), { storage }), true);
  // LEG 2: the SECOND unusable (user retakes/resubmits into another poisoned
  // grade) does NOT recompose again — terminal reason, zero compose calls.
  const second = await submitAttemptV2({ ...IDS, presentationId: "c1_l1_d2_e0_p2", answers: ANSWERS }, deps);
  check("second unusable ⇒ blocked terminal", [second.outcome, second.status], ["blocked", RV2.GRADE_UNUSABLE]);
  checkTrue("terminal reason rendered", typeof second.reason === "string" && second.reason.length > 0);
  check("NO second compose call", composeKeysSeen.length, 1);
}

CASE("A2 bypass — reload between refusal and recompose: the PERSISTED guard survives; no second automatic recompose");
{
  const storage = fakeStorage();
  // Simulate: first tab-lifetime got unusable and MARKED the guard, then
  // crashed before/after its recompose. The reloaded page resubmits.
  markRecomposeUsed(recomposeGuardScope(IDS), { storage });
  const composeCalls = [];
  const res = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage, submitFn: async () => ({ status: "grade_unusable" }),
      composeSessionFn: async () => { composeCalls.push(1); return composedSessionResult(); } },
  );
  check("post-reload unusable ⇒ blocked terminal (guard held across the reload)",
    [res.outcome, res.status], ["blocked", RV2.GRADE_UNUSABLE]);
  check("zero compose calls", composeCalls.length, 0);
}

CASE("A2 bypass — two tabs: per-tab storage bounds EACH tab to one recompose; neither can loop");
{
  const tabA = fakeStorage(); const tabB = fakeStorage();
  let composesA = 0; let composesB = 0;
  const depsA = { storage: tabA, submitFn: async () => ({ status: "grade_unusable" }),
    composeSessionFn: async () => { composesA++; return composedSessionResult(`pA${composesA}`); } };
  const depsB = { storage: tabB, submitFn: async () => ({ status: "grade_unusable" }),
    composeSessionFn: async () => { composesB++; return composedSessionResult(`pB${composesB}`); } };
  const [a1, b1] = await Promise.all([
    submitAttemptV2({ ...IDS, presentationId: PRES, answers: ANSWERS }, depsA),
    submitAttemptV2({ ...IDS, presentationId: PRES, answers: ANSWERS }, depsB),
  ]);
  check("each tab recomposed once", [a1.outcome, b1.outcome, composesA, composesB],
    ["recomposed", "recomposed", 1, 1]);
  const [a2, b2] = await Promise.all([
    submitAttemptV2({ ...IDS, presentationId: "pA1", answers: ANSWERS }, depsA),
    submitAttemptV2({ ...IDS, presentationId: "pB1", answers: ANSWERS }, depsB),
  ]);
  check("each tab's SECOND unusable is terminal — bounded per tab, never a loop",
    [a2.outcome, b2.outcome, composesA, composesB], ["blocked", "blocked", 1, 1]);
}

CASE("A2 bypass — a recompose that itself refuses / goes legacy: surfaced, guard stays, still no loop");
{
  // Refusing recompose.
  const storage = fakeStorage();
  let composes = 0;
  const res = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage, submitFn: async () => ({ status: "grade_unusable" }),
      composeSessionFn: async () => { composes++; return { status: "day_guard_rejected" }; } },
  );
  check("recompose refusal surfaces ITS status + reason", [res.outcome, res.status], ["blocked", "day_guard_rejected"]);
  checkTrue("reason rendered", res.reason.length > 0);
  check("one compose call", composes, 1);
  const again = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage, submitFn: async () => ({ status: "grade_unusable" }),
      composeSessionFn: async () => { composes++; return composedSessionResult(); } },
  );
  check("guard held: the retry is terminal, no second compose", [again.outcome, composes], ["blocked", 1]);
  // Recompose lands on a dark engine ⇒ the submission falls back to legacy.
  const storage2 = fakeStorage();
  const dark = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage: storage2, submitFn: async () => ({ status: "grade_unusable" }),
      composeSessionFn: async () => ({ status: "review_v2_dark" }) },
  );
  check("recompose-into-dark ⇒ legacy fallback", dark.outcome, "legacy");
  check("guard stays set (the incident is still open)",
    recomposeUsed(recomposeGuardScope(IDS), { storage: storage2 }), true);
  // A recompose that THROWS: blocked with reason, guard stays.
  const storage3 = fakeStorage();
  const thrown = await submitAttemptV2(
    { ...IDS, presentationId: PRES, answers: ANSWERS },
    { storage: storage3, submitFn: async () => ({ status: "grade_unusable" }),
      composeSessionFn: async () => { throw new ReviewV2Error("internal", "compose died"); } },
  );
  // (composeReviewSessionV2 catches thrown compose errors into a blocked
  // outcome itself, so this arrives as blocked either way — assert the shape.)
  check("recompose-throw ⇒ blocked with reason", [thrown.outcome, typeof thrown.reason], ["blocked", "string"]);
  check("guard stays set after the throw",
    recomposeUsed(recomposeGuardScope(IDS), { storage: storage3 }), true);
}

CASE("A2 bypass — user-initiated retry after the automatic recompose; success closes the incident");
{
  const storage = fakeStorage();
  let composes = 0;
  const mkDeps = (submitFn) => ({
    storage, submitFn,
    composeSessionFn: async () => { composes++; return composedSessionResult(`p-fresh-${composes}`); },
  });
  // Automatic: unusable ⇒ recomposed (1 compose).
  const auto = await submitAttemptV2({ ...IDS, presentationId: PRES, answers: ANSWERS },
    mkDeps(async () => ({ status: "grade_unusable" })));
  check("automatic recompose", [auto.outcome, composes], ["recomposed", 1]);
  // User retries the NEW presentation and it lands ⇒ written, guard cleared.
  const ok = await submitAttemptV2({ ...IDS, presentationId: "p-fresh-1", answers: ANSWERS },
    mkDeps(async () => ({ ...WRITTEN, attemptId: "rv2_u1_p-fresh-1" })));
  check("retake lands", ok.outcome, "written");
  check("success cleared the guard", recomposeUsed(recomposeGuardScope(IDS), { storage }), false);
  // A LATER, SEPARATE incident gets its own single recompose (once PER
  // INCIDENT — an automatic tight loop is impossible because the reset
  // requires an intervening SUCCESS, which ends the incident).
  const later = await submitAttemptV2({ ...IDS, presentationId: "p-fresh-1", answers: ANSWERS },
    mkDeps(async () => ({ status: "grade_unusable" })));
  check("a new incident after success recomposes once again", [later.outcome, composes], ["recomposed", 2]);
  const laterSecond = await submitAttemptV2({ ...IDS, presentationId: "p-fresh-2", answers: ANSWERS },
    mkDeps(async () => ({ status: "grade_unusable" })));
  check("and is bounded exactly like the first", [laterSecond.outcome, composes], ["blocked", 2]);
}

CASE("C3/new — kind:'new' recomposes through composeNewTestV2, never composeSession");
{
  const storage = fakeStorage();
  let newCalls = 0; let reviewCalls = 0;
  const res = await submitAttemptV2(
    { ...IDS, kind: "new", presentationId: "c1_l1_d2_e0_n1", answers: ANSWERS },
    { storage,
      submitFn: async () => ({ status: "grade_unusable" }),
      composeNewTestFn: async () => { newCalls++; return composedNewResult(); },
      composeSessionFn: async () => { reviewCalls++; return composedSessionResult(); } },
  );
  check("recomposed via the NEW surface", [res.outcome, newCalls, reviewCalls], ["recomposed", 1, 0]);
  check("new envelope carried (range included)",
    [res.compose.presentationId, res.compose.rangeStartIndex, res.compose.rangeEndIndex],
    ["c1_l1_d2_e0_n2", 9, 10]);
  // Guard scopes are kind-scoped: the review scope is untouched.
  check("review-kind guard untouched",
    recomposeUsed(recomposeGuardScope({ ...IDS, kind: "review" }), { storage }), false);
  check("new-kind guard set",
    recomposeUsed(recomposeGuardScope({ ...IDS, kind: "new" }), { storage }), true);
}

CASE("VALIDATE — a malformed handle/request never reaches the engine or the storage");
{
  const badArgs = [
    { ...IDS, presentationId: PRES, answers: "nope" },
    { ...IDS, presentationId: "", answers: ANSWERS },
    { ...IDS, logicalDay: 0, presentationId: PRES, answers: ANSWERS },
    { ...IDS, logicalDay: 1.5, presentationId: PRES, answers: ANSWERS },
    { ...IDS, kind: "sideways", presentationId: PRES, answers: ANSWERS },
    { ...IDS, uid: "", presentationId: PRES, answers: ANSWERS },
    { ...IDS, classId: undefined, presentationId: PRES, answers: ANSWERS },
  ];
  for (const args of badArgs) {
    const storage = fakeStorage();
    let submits = 0;
    const res = await submitAttemptV2(args, { storage, submitFn: async () => { submits++; return { ...WRITTEN }; } });
    const tag = JSON.stringify({ p: args.presentationId, d: args.logicalDay, k: args.kind, u: args.uid, c: args.classId, a: typeof args.answers });
    check(`${tag} ⇒ blocked malformed_request`, [res.outcome, res.status], ["blocked", "malformed_request"]);
    check(`${tag} engine never called`, submits, 0);
    check(`${tag} storage untouched (no junk scopes)`, Object.keys(storage._dump()).length, 0);
  }
}

// ===========================================================================
CASE("C6 — rv2McqAnswers: answered-only rows, presentation order, definition-string responses, de-duped");
{
  const W = (id) => ({ id, word: `word-${id}`, definition: `def-${id}` });
  const testWords = ["w4", "w1", "w5", "w2"].map(W);
  const answers = {
    w4: { wordId: "w4", definition: "def-x", isCorrect: false }, // selected option — its STRING is the response
    w1: { wordId: "w1", definition: "def-1", isCorrect: true },
    // w5 unanswered — NO row (blank is the server's law)
    w2: { wordId: "w2", definition: "   ", isCorrect: false },   // whitespace ⇒ blank ⇒ no row
  };
  check("rows", rv2McqAnswers(testWords, answers), [
    { wordId: "w4", studentResponse: "def-x" },
    { wordId: "w1", studentResponse: "def-1" },
  ]);
  check("duplicate presented ids collapse to one row (a dup would refuse server-side)",
    rv2McqAnswers([W("w1"), W("w1")], { w1: { definition: "d" } }), [{ wordId: "w1", studentResponse: "d" }]);
  check("empty inputs tolerated", rv2McqAnswers([], {}), []);
  check("non-array tolerated", rv2McqAnswers(null, null), []);
  check("malformed word entries skipped", rv2McqAnswers([{ id: "" }, { no: 1 }, W("w9")], { w9: { definition: "d9" } }),
    [{ wordId: "w9", studentResponse: "d9" }]);
}

CASE("C6 — rv2TypedAnswers: same laws over the free-text response map");
{
  const W = (id) => ({ id, word: `word-${id}`, definition: `def-${id}` });
  const words = ["w1", "w2", "w3"].map(W);
  const responses = { w1: "my answer", w2: "", w3: "   " }; // blank/whitespace ⇒ no row
  check("rows", rv2TypedAnswers(words, responses), [{ wordId: "w1", studentResponse: "my answer" }]);
  check("numbers coerced to strings", rv2TypedAnswers([W("w7")], { w7: 42 }), [{ wordId: "w7", studentResponse: "42" }]);
  check("empty tolerated", rv2TypedAnswers([], null), []);
}

CASE("C6 — rv2RowsToTypedResults: the read-back mapping fabricates NOTHING");
{
  const rows = [
    { wordId: "w1", studentResponse: "a", correctDefinition: "d1", isCorrect: true, aiReasoning: "good" },
    { wordId: "w2", studentResponse: "", correctDefinition: "d2", isCorrect: false, aiReasoning: "No answer provided", blank: true },
    { wordId: "w3", studentResponse: "b", correctDefinition: null, isCorrect: false, aiReasoning: "Could not verify", ungradeable: true },
  ];
  check("mapping", rv2RowsToTypedResults(rows), [
    { wordId: "w1", isCorrect: true, reasoning: "good" },
    { wordId: "w2", isCorrect: false, reasoning: "No answer provided" },
    { wordId: "w3", isCorrect: false, reasoning: "Could not verify" },
  ]);
  check("isCorrect is STRICT boolean-true only (never truthy coercion)",
    rv2RowsToTypedResults([{ wordId: "w1", isCorrect: "yes", aiReasoning: "" }]),
    [{ wordId: "w1", isCorrect: false, reasoning: "" }]);
  check("malformed rows dropped", rv2RowsToTypedResults([null, { noWordId: 1 }, { wordId: "" }]), []);
  check("a vanished read-back degrades to [] (summary-only rendering)", rv2RowsToTypedResults(null), []);
  check("non-array degrades to []", rv2RowsToTypedResults({ answers: [] }), []);
}

// ===========================================================================
// C2 — FLAG-OFF PARITY, checked LINE BY LINE against the page source bytes
// (cutover-a's audit law: the static argument is checked, not accepted).
// ===========================================================================
const readSrc = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const mcqSrc = readSrc("../../src/pages/MCQTest.jsx");
const typedSrc = readSrc("../../src/pages/TypedTest.jsx");
const flagsSrc = readSrc("../../src/config/featureFlags.js");
const fnIndexSrc = readSrc("../../functions/index.js");

CASE("C2/MCQ — the legacy submit call + context block are byte-identical; every rv2 gate reduces to today flag-off");
{
  const anchors = [
    // The legacy callable + its exact argument (the ONE live MCQ submit).
    "const submitVocabAttempt = httpsCallable(getFunctions(), 'submitVocabAttempt', { timeout: 30000 })",
    "() => submitVocabAttempt({ testType: 'mcq', context, attemptAnswers: answerArray }),",
    // The legacy context block, line by line — including the 06-29 landmine
    // fields, which must remain EXACTLY here and ONLY here.
    `const context = {
              studentId: user.uid, classId: classIdParam, listId, testId,
              studyDay: studyDay || null, sessionType: currentTestType, testType: 'mcq',
              attemptDocId, totalQuestions: testWords.length,
              isFirstDay: sessionContext?.isFirstDay ?? null,
              listTitle: sessionContext?.listTitle ?? null,
              segmentStartIndex: sessionContext?.segment?.startIndex ?? null,
              segmentEndIndex: sessionContext?.segment?.endIndex ?? null,
              interventionLevel: sessionContext?.interventionLevel ?? null,
              wordsIntroduced: sessionContext?.wordsIntroduced ?? null,
              wordsReviewed: sessionContext?.wordsReviewed ?? null,
              newWordStartIndex: sessionContext?.newWordStartIndex ?? null,
              newWordEndIndex: sessionContext?.newWordEndIndex ?? null,
            }`,
    // The legacy nonce derivation stays intact for the flag-off path.
    "const attemptNonce = getOrCreateAttemptNonce(testId)",
    "const attemptDocId = `${user.uid}_${testId}_${attemptNonce}`",
    // Every new branch is gated at the call site and reduces to today's
    // condition when REVIEW_V2_CLIENT=false (rv2Handle is then null by construction).
    "const rv2Handle = REVIEW_V2_CLIENT ? getRv2SubmitHandle() : null",
    "if (!rv2Handle && !studyDay && user?.uid && classIdParam && listId) {",
    "if (!rv2Handle && sessionContext?.dayNumber != null && user?.uid && classIdParam && listId) {",
    "} else if (SERVER_ATTEMPT_WRITE) {",
    // The legacy client-write leg is still reachable flag-off.
    "result = await withRetry(\n              () => submitTestAttempt(",
  ];
  anchors.forEach((a, i) => checkTrue(`MCQ anchor ${i + 1} present verbatim`, mcqSrc.includes(a)));
  check("exactly ONE submitVocabAttempt invocation site (the legacy one)",
    (mcqSrc.match(/submitVocabAttempt\(\{/g) || []).length, 1);
  checkTrue("the engine call smuggles NO attemptDocId/totalQuestions",
    !/submitAttemptV2\(\{[^}]*(attemptDocId|totalQuestions)/s.test(mcqSrc));
}

CASE("C2/TYPED — the TWO-call sequence (gradeTypedTest → submitVocabAttempt with BOTH token fields) is byte-identical flag-off");
{
  const anchors = [
    // Call 1: the grader, exact argument.
    "const result = await gradeTypedTest({ answers: answersToGrade, listId, classId: classIdParam, gradeContext })",
    // The grade call is gated at the call site; flag-off it is today's call.
    "let gradingResult = rv2Handle ? null : await gradeWithRetry(answersToGrade, gradeContext)",
    // Call 2: the write, with the token fields EXACTLY as today.
    "const gradeToken = gradingResult.data?.gradeToken ?? null",
    "const gradeTokenCreatedAt = gradingResult.data?.gradeTokenCreatedAt ?? null",
    "() => submitVocabAttempt({ testType: 'typed', context, attemptAnswers, gradeToken, gradeTokenCreatedAt }),",
    // The typed legacy context block, line by line.
    `const context = {
              studentId: user.uid, classId: classIdParam, listId, testId,
              studyDay: studyDay || null, sessionType: currentTestType, testType: 'typed',
              attemptDocId, totalQuestions: words.length,`,
    // The gradeContext (token binding) derivation stays intact.
    "const gradeAttemptDocId = `${user.uid}_${testId}_${getOrCreateAttemptNonce(testId)}`",
    // Gates: null flag-off by construction; practice mode keeps the legacy path.
    "const rv2Handle = (REVIEW_V2_CLIENT && !isPracticeMode) ? getRv2SubmitHandle() : null",
    "if (!rv2Handle && !studyDay && user?.uid && classIdParam && listId) {",
    "if (!rv2Handle && sessionContext?.dayNumber != null && user?.uid && classIdParam && listId) {",
    "} else if (SERVER_ATTEMPT_WRITE) {",
    "const serverEchoedAttemptDocId = rv2Handle ? null : (gradingResult.data?.attemptDocId ?? null)",
    // Flag-off display identity: displayedRows IS gradingResult.data.results.
    "let displayedRows = rv2Handle ? [] : gradingResult.data.results",
    // The legacy client-write leg is still reachable flag-off.
    "() => submitTypedTestAttempt(",
  ];
  anchors.forEach((a, i) => checkTrue(`TYPED anchor ${i + 1} present verbatim`, typedSrc.includes(a)));
  check("exactly ONE submitVocabAttempt invocation site (the legacy one)",
    (typedSrc.match(/submitVocabAttempt\(\{/g) || []).length, 1);
  check("exactly ONE gradeTypedTest invocation site (the legacy grader)",
    (typedSrc.match(/gradeTypedTest\(\{/g) || []).length, 1);
  checkTrue("the engine call smuggles NO attemptDocId/totalQuestions/gradeToken",
    !/submitAttemptV2\(\{[^}]*(attemptDocId|totalQuestions|gradeToken)/s.test(typedSrc));
}

CASE("C2/FLAGS — REVIEW_V2_CLIENT ships FALSE; GRADE_TOKEN_MINT/ENFORCED untouched at FALSE");
{
  checkTrue("REVIEW_V2_CLIENT = false", flagsSrc.includes("export const REVIEW_V2_CLIENT = false;"));
  checkTrue("GRADE_TOKEN_ENFORCED = false (value untouched)",
    fnIndexSrc.includes("const GRADE_TOKEN_ENFORCED = false;"));
  checkTrue("GRADE_TOKEN_MINT = false (value untouched)",
    fnIndexSrc.includes("const GRADE_TOKEN_MINT = false;"));
  check("exactly one assignment of each token flag",
    [(fnIndexSrc.match(/const GRADE_TOKEN_ENFORCED = /g) || []).length,
      (fnIndexSrc.match(/const GRADE_TOKEN_MINT = /g) || []).length], [1, 1]);
}

// ===========================================================================
const evidencePath = process.env.CUTOVER_B_PURE_RECEIPT
  ? new URL(`file://${process.env.CUTOVER_B_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/cutover-b-submit-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "cutover-b-submit-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/services/reviewV2Submit.js": sha16("../../src/services/reviewV2Submit.js"),
    "src/services/reviewV2Client.js": sha16("../../src/services/reviewV2Client.js"),
    "src/services/reviewV2Compose.js": sha16("../../src/services/reviewV2Compose.js"),
    "src/pages/MCQTest.jsx": sha16("../../src/pages/MCQTest.jsx"),
    "src/pages/TypedTest.jsx": sha16("../../src/pages/TypedTest.jsx"),
    "src/config/featureFlags.js": sha16("../../src/config/featureFlags.js"),
    "functions/index.js": sha16("../../functions/index.js"),
    "scripts/deepfix2/cutover-b-submit-fixtures.mjs": sha16("./cutover-b-submit-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ncutover-b-submit PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
