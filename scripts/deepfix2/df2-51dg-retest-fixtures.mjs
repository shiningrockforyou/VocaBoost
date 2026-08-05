#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-d + 51-g — PURE fixtures for the re-test launch, the spend-cap
 * refusal (decision (h)) and the hard-reload gap (decision (i) / NTF-27).
 * No Firebase, no network, no Vite, no emulator, no browser.
 * ============================================================================
 * WHAT IS EXERCISED FOR REAL (imported, never re-implemented):
 *   · `src/services/restudyRetest.js`   — this fold's own module
 *   · `src/services/reviewV2Client.js`  — this fold's classifier + copy leg
 *   · `src/services/reviewV2Submit.js`  — the LIVE adapter, to prove the cap
 *     cannot poll or recompose THERE either (belt and braces)
 *   · `src/services/restudyVisit.js` (51-b) + `src/utils/pastDayAuthority.js`
 *     (51-a) — consumed through the real code paths, NOT re-tested (51-b's own
 *     evidence is cited in CASE C2.9)
 * `MCQTest.jsx`/`TypedTest.jsx`/`RestudyBrowser.jsx` are JSX and cannot be
 * imported by plain Node in this checkout (the structural fact
 * `RestudyBrowser.viewModel.js`'s header documents), so they are proven by
 * TEXT ANCHORS over their live bytes + a git-diff structural check (the
 * technique 51-c/51-f established).
 *
 * Run: node scripts/deepfix2/df2-51dg-retest-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51dg-retest-pure.json
 * (DF2_51DG_PURE_RECEIPT redirects the receipt for the mutant driver.)
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  RV2, PRACTICE_LIMIT_MESSAGE, isPracticeLimitReached, practiceLimitReason,
  isGradingInProgress, isGradeUnusable, isNotServing, isStaleClient,
} from "../../src/services/reviewV2Client.js";
import { submitAttemptV2, recomposeUsed } from "../../src/services/reviewV2Submit.js";
import {
  RERUN_SOURCE, RESTUDY_BLOB_KEY, LIVE_BLOB_KEY,
  isRerunSource, rerunHalfFromSource, wantedRv2Sources, rv2SessionTypeFromSource,
  nextRerunHalf, effectiveResetEpoch, rerunComposeScope, rerunRecomposeScope,
  composeRerunHalf, submitRerunAttempt, rerunTestConfigOverride,
  shouldPreemptTypedRetest, recordPracticeCap, readPracticeCap, currentCapWindowKey,
  rv2PersistableHandle, rebuildableHandle, rv2HandleFromBlob, rv2HandleFromBlobAny,
  rv2HandleFromTestConfig, blobWithRv2Presentation, restudyBlobPayload,
} from "../../src/services/restudyRetest.js";
import { peekVisitId, visitScopeKey } from "../../src/services/restudyVisit.js";
import { REVIEW_V2_CLIENT } from "../../src/config/featureFlags.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
// The mutant driver reads this suite's RECEIPT to decide whether a mutant was
// caught, so the receipt must survive a mutant that makes a later case THROW
// (a broken clause can turn a fixture's own indexing into a TypeError). Any
// uncaught error is recorded as a red and the receipt is still written.
process.on("uncaughtException", (err) => {
  failed++; reds.push(`${caseName} :: UNCAUGHT ${err && err.message}`);
  console.error(`  RED UNCAUGHT: ${err && err.message}`);
  writeReceipt(); process.exit(1);
});
process.on("unhandledRejection", (err) => {
  failed++; reds.push(`${caseName} :: UNHANDLED ${err && err.message}`);
  console.error(`  RED UNHANDLED: ${err && err.message}`);
  writeReceipt(); process.exit(1);
});
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const readSrc = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
const readHead = (rel) => execFileSync("git", ["show", `HEAD:${rel}`], { cwd: "/app", encoding: "utf8" });

function writeReceipt() {
  const evidencePath = process.env.DF2_51DG_PURE_RECEIPT
    ? new URL(`file://${process.env.DF2_51DG_PURE_RECEIPT}`)
    : new URL("../../docs/plans/deepfix2/evidence/df2-51dg-retest-pure.json", import.meta.url);
  mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
  const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
  writeFileSync(evidencePath, JSON.stringify({
    kind: "df2-51dg-retest-pure",
    pass: failed === 0,
    total, failed, reds,
    sourceShas: {
      "src/services/restudyRetest.js": sha16("../../src/services/restudyRetest.js"),
      "src/services/reviewV2Client.js": sha16("../../src/services/reviewV2Client.js"),
      "src/pages/MCQTest.jsx": sha16("../../src/pages/MCQTest.jsx"),
      "src/pages/TypedTest.jsx": sha16("../../src/pages/TypedTest.jsx"),
      "src/pages/RestudyBrowser.jsx": sha16("../../src/pages/RestudyBrowser.jsx"),
      "src/services/restudyVisit.js": sha16("../../src/services/restudyVisit.js"),
      "src/utils/pastDayAuthority.js": sha16("../../src/utils/pastDayAuthority.js"),
      "scripts/deepfix2/df2-51dg-retest-fixtures.mjs": sha16("./df2-51dg-retest-fixtures.mjs"),
    },
    at: new Date().toISOString(),
  }, null, 2));
}

// A sessionStorage stand-in (the real one does not exist under node).
function fakeStore() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

const ID = { uid: "u1", classId: "c1", listId: "l1" };
const DAY = 4;
const EPOCH = 0;
const capRefusal = { status: "practice_limit_reached", scope: "student", message: "server copy" };

// ===========================================================================
// C1 — THE CAP (decision (h)): the classifier, the copy, and the BYPASS SET
// ===========================================================================
CASE("C1.1 — the status is frozen and its classifier is exact");
{
  check("RV2.PRACTICE_LIMIT_REACHED", RV2.PRACTICE_LIMIT_REACHED, "practice_limit_reached");
  checkTrue("isPracticeLimitReached(cap)", isPracticeLimitReached(capRefusal));
  check("isPracticeLimitReached(null)", isPracticeLimitReached(null), false);
  check("isPracticeLimitReached(grading_in_progress)", isPracticeLimitReached({ status: "grading_in_progress" }), false);
  check("isPracticeLimitReached(grade_unusable)", isPracticeLimitReached({ status: "grade_unusable" }), false);
  check("practiceLimitReason(cap)", practiceLimitReason(capRefusal), { message: PRACTICE_LIMIT_MESSAGE, scope: "student" });
  check("practiceLimitReason(cap, no scope) defaults to student",
    practiceLimitReason({ status: "practice_limit_reached" }).scope, "student");
  check("practiceLimitReason(global)", practiceLimitReason({ status: "practice_limit_reached", scope: "global" }).scope, "global");
  check("practiceLimitReason(other) is null", practiceLimitReason({ status: "grade_unusable" }), null);
}

CASE("C1.2 — the client copy is BYTE-EQUAL to the server's PRACTICE_LIMIT_MESSAGE");
{
  // Read the SERVER's constant out of its own bytes rather than restating it.
  const meter = readSrc("functions/aiMetering.js");
  const m = meter.match(/const PRACTICE_LIMIT_MESSAGE\s*=\s*([\s\S]*?);\n/);
  checkTrue("server constant found", Boolean(m));
  const serverCopy = (m ? m[1] : "")
    .split("+")
    .map((chunk) => chunk.trim().replace(/^"|"$/g, ""))
    .join("");
  check("server copy is non-empty", serverCopy.length > 0, true);
  check("client PRACTICE_LIMIT_MESSAGE === server PRACTICE_LIMIT_MESSAGE", PRACTICE_LIMIT_MESSAGE, serverCopy);
  // And it is the sentence decision (h) ratified, read from the design doc.
  const design = readSrc("docs/plans/deepfix2/22_DF2-51_PASTDAY_NAV_DESIGN.md");
  checkTrue("the ratified sentence appears verbatim in 22_ §7(h)",
    design.includes("You've reached today's practice-grading limit — try again tomorrow, or use a multiple-choice re-test"));
  check("the client constant is that same sentence",
    PRACTICE_LIMIT_MESSAGE,
    "You've reached today's practice-grading limit — try again tomorrow, or use a multiple-choice re-test.");
  check("server status constant is the frozen one", /const PRACTICE_LIMIT_STATUS = "practice_limit_reached";/.test(meter), true);
}

CASE("C1.3 — BYPASS SET (a): the cap matches NO existing classifier ⇒ no poll, no recompose, no legacy");
{
  check("isGradingInProgress(cap) — would POLL", isGradingInProgress(capRefusal), false);
  check("isGradeUnusable(cap) — would RECOMPOSE", isGradeUnusable(capRefusal), false);
  check("isNotServing(cap) — would fall back to LEGACY", isNotServing(capRefusal), false);
  check("isStaleClient(cap) — would force a refresh", isStaleClient(capRefusal), false);
}

CASE("C1.4 — BYPASS SET (b): the LIVE adapter (submitAttemptV2, unchanged) blocks a cap with ZERO retries/recomposes");
{
  const store = fakeStore();
  let submits = 0; let composes = 0; let sleeps = 0;
  const out = await submitAttemptV2(
    { uid: ID.uid, classId: ID.classId, listId: ID.listId, logicalDay: 3, kind: "review", presentationId: "p1", answers: [] },
    {
      storage: store,
      submitFn: async () => { submits++; return capRefusal; },
      composeSessionFn: async () => { composes++; return { status: "composed" }; },
      composeNewTestFn: async () => { composes++; return { status: "composed" }; },
      // A counter, not a throw: a mutant that made the cap pollable must go RED
      // in the receipt, not kill the process before it is written.
      sleepFn: async () => { sleeps++; },
      pollIntervalMs: 0,
    },
  );
  check("outcome", out.outcome, "blocked");
  check("status", out.status, "practice_limit_reached");
  check("submit called exactly once (no poll)", submits, 1);
  check("the live adapter never slept", sleeps, 0);
  check("compose never called (no recompose)", composes, 0);
  check("the live adapter renders its GENERIC copy (why the pages map the status themselves)",
    String(out.reason).includes("practice-grading limit"), false);
}

CASE("C1.5 — BYPASS SET (c): the RERUN submit renders the cap and stops");
{
  const store = fakeStore();
  let submits = 0; let composes = 0; let mints = 0; let sleeps = 0;
  const deps = {
    storage: store,
    submitFn: async () => { submits++; return capRefusal; },
    composeRerunFn: async () => { composes++; return { status: "composed" }; },
    mintVisitFn: async () => { mints++; return { status: "visit_minted", visitId: "v9" }; },
    sleepFn: async () => { sleeps++; },
    pollIntervalMs: 0,
  };
  const out = await submitRerunAttempt({
    ...ID, visitedDay: DAY, half: "new", resetEpoch: EPOCH,
    visitId: "v1", presentationId: "p1", answers: [{ wordId: "w1", studentResponse: "x" }],
  }, deps);
  check("outcome", out.outcome, "capped");
  check("status", out.status, "practice_limit_reached");
  check("scope", out.scope, "student");
  check("reason is the RATIFIED sentence", out.reason, PRACTICE_LIMIT_MESSAGE);
  check("submit called exactly once (no poll)", submits, 1);
  check("the rerun submit never slept", sleeps, 0);
  check("compose never called (no recompose)", composes, 0);
  check("no visit minted by a cap", mints, 0);
  check("the recompose-once budget is NOT consumed by a cap",
    recomposeUsed(rerunRecomposeScope({ ...ID, visitedDay: DAY, half: "new" }), { storage: store }), false);
  // The presentation-only snapshot 51-a's canRetestTyped reads.
  const snap = readPracticeCap(ID, { storage: store });
  check("a cap snapshot was recorded", { refused: snap?.refused, scope: snap?.scope }, { refused: true, scope: "student" });
  check("the snapshot carries THIS KST window", snap?.windowKey, currentCapWindowKey());
}

CASE("C1.6 — BYPASS SET (d): re-submitting the same capped presentation stays capped (no accumulation, still no recompose)");
{
  const store = fakeStore();
  let submits = 0; let composes = 0;
  const deps = {
    storage: store,
    submitFn: async () => { submits++; return capRefusal; },
    composeRerunFn: async () => { composes++; return { status: "composed" }; },
    mintVisitFn: async () => ({ status: "visit_minted", visitId: "v9" }),
    sleepFn: async () => {},
    pollIntervalMs: 0,
  };
  const args = {
    ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH,
    visitId: "v1", presentationId: "p1", answers: [],
  };
  const a = await submitRerunAttempt(args, deps);
  const b = await submitRerunAttempt(args, deps);
  check("both capped", [a.outcome, b.outcome], ["capped", "capped"]);
  check("one submit per user retry, never a loop", submits, 2);
  check("still zero recomposes", composes, 0);
}

CASE("C1.7 — BYPASS SET (e): the THROWN channel is never mistaken for a cap");
{
  const store = fakeStore();
  const out = await submitRerunAttempt({
    ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH,
    visitId: "v1", presentationId: "p1", answers: [],
  }, {
    storage: store,
    submitFn: async () => { const e = new Error("boom"); e.code = "internal"; throw e; },
    mintVisitFn: async () => ({ status: "visit_minted", visitId: "v9" }),
  });
  check("outcome", out.outcome, "blocked");
  check("status", out.status, "error");
  check("no cap snapshot was recorded from a thrown error", readPracticeCap(ID, { storage: store }), null);
}

// ===========================================================================
// C2 — THE RERUN (leg 1): visit, compose, submit, non-advancement
// ===========================================================================
function composeOk(presentationId = "pres1", testType = "mcq", ids = ["w1", "w2"]) {
  return {
    status: "composed",
    presentation: { presentationId, presentedWordIds: ids, testType, visitId: "ignored" },
  };
}

CASE("C2.1 — the FIRST rerun compose mints the visit (51-b), carries it, and the SECOND reuses it");
{
  const store = fakeStore();
  let mints = 0; const seen = [];
  const deps = {
    storage: store,
    mintVisitFn: async () => { mints++; return { status: "visit_minted", visitId: `v${mints}` }; },
    composeRerunFn: async (args) => { seen.push(args); return composeOk(); },
  };
  const a = await composeRerunHalf({ ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH }, deps);
  check("outcome", a.outcome, "composed");
  check("the compose call carries the minted visitId", seen[0]?.visitId, "v1");
  check("the compose call carries the half", seen[0]?.half, "review");
  check("the compose call carries the visited day", seen[0]?.visitedDay, DAY);
  checkTrue("the compose call carries a composeKey", typeof seen[0]?.composeKey === "string" && seen[0].composeKey.length >= 8);
  check("the envelope carries the visitId onward", a.visitId, "v1");
  check("mint called once", mints, 1);
  check("the visit is cached under 51-b's OWN scope key",
    peekVisitId({ uid: ID.uid, classId: ID.classId, listId: ID.listId, day: DAY, resetEpoch: EPOCH }, { storage: store }), "v1");
  checkTrue("the scope key is 51-b's, not a second one",
    store._map.has(visitScopeKey({ uid: ID.uid, classId: ID.classId, listId: ID.listId, day: DAY, resetEpoch: EPOCH })));

  const b = await composeRerunHalf({ ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH }, deps);
  check("second compose reuses the SAME visit (pairing survives)", b.visitId, "v1");
  check("mint STILL called once", mints, 1);
  check("and replays the SAME composeKey (V5 persistence)", seen[1]?.composeKey, seen[0]?.composeKey);
}

CASE("C2.2 — visit_invalid ⇒ re-mint ONCE and retry with a FRESH composeKey (V7); a second ⇒ surrender");
{
  const store = fakeStore();
  let mints = 0; const seen = [];
  const deps = {
    storage: store,
    mintVisitFn: async () => { mints++; return { status: "visit_minted", visitId: `v${mints}` }; },
    composeRerunFn: async (args) => {
      seen.push(args);
      return args.visitId === "v1" ? { status: "visit_invalid", reason: "visit missing" } : composeOk();
    },
  };
  const out = await composeRerunHalf({ ...ID, visitedDay: DAY, half: "new", resetEpoch: EPOCH }, deps);
  check("outcome after the one-shot repair", out.outcome, "composed");
  check("it retried with the RE-MINTED visit", seen[1]?.visitId, "v2");
  check("mint called exactly twice (initial + ONE repair)", mints, 2);
  checkTrue("the retry used a DIFFERENT composeKey (the old one is fingerprinted to the dead visit)",
    seen[1]?.composeKey !== seen[0]?.composeKey);

  // A SECOND visit-invalidating refusal in the same scope: the budget is spent.
  const seen2 = [];
  const deps2 = {
    storage: store,
    mintVisitFn: async () => { mints++; return { status: "visit_minted", visitId: `v${mints}` }; },
    composeRerunFn: async (args) => { seen2.push(args); return { status: "visit_invalid" }; },
  };
  const out2 = await composeRerunHalf({ ...ID, visitedDay: DAY, half: "new", resetEpoch: EPOCH }, deps2);
  check("second incident surrenders", out2.outcome, "blocked");
  check("with a rendered reason", typeof out2.reason === "string" && out2.reason.length > 0, true);
  check("and mints nothing more", mints, 2);
}

CASE("C2.3 — F3: a day with no new-word half renders a reason, never a crash and never 'unavailable'");
{
  for (const status of ["no_evidence", "empty_pool"]) {
    const store = fakeStore();
    const out = await composeRerunHalf({ ...ID, visitedDay: DAY, half: "new", resetEpoch: EPOCH }, {
      storage: store,
      mintVisitFn: async () => ({ status: "visit_minted", visitId: "v1" }),
      composeRerunFn: async () => ({ status }),
    });
    check(`${status} ⇒ blocked`, out.outcome, "blocked");
    check(`${status} ⇒ the half-availability reason`, String(out.reason).includes("no new-word test to retake"), true);
  }
}

CASE("C2.4 — not-serving ⇒ 'unavailable', NEVER 'legacy' (there is no legacy restudy path)");
{
  for (const status of ["config_hold", "review_v2_dark"]) {
    const out = await composeRerunHalf({ ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH }, {
      storage: fakeStore(),
      mintVisitFn: async () => ({ status: "visit_minted", visitId: "v1" }),
      composeRerunFn: async () => ({ status }),
    });
    check(`${status} ⇒ unavailable`, out.outcome, "unavailable");
  }
  const thrown = await composeRerunHalf({ ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH }, {
    storage: fakeStore(),
    mintVisitFn: async () => ({ status: "visit_minted", visitId: "v1" }),
    composeRerunFn: async () => { const e = new Error("nope"); e.code = "permission-denied"; throw e; },
  });
  check("the thrown trio ⇒ unavailable (not legacy)", thrown.outcome, "unavailable");
  checkTrue("and it renders a reason", typeof thrown.reason === "string" && thrown.reason.length > 0);
}

CASE("C2.5 — the submit payload is EXACTLY {presentationId, answers}, and a missing visitId is refused");
{
  const store = fakeStore();
  let payload = null;
  const out = await submitRerunAttempt({
    ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH,
    visitId: "v1", presentationId: "p1", answers: [{ wordId: "w1", studentResponse: "a" }],
  }, {
    storage: store,
    submitFn: async (p) => { payload = p; return { status: "attempt_written", attemptId: "a1", score: 90, passed: true, totalQuestions: 2, correctCount: 1 }; },
  });
  check("written", out.outcome, "written");
  check("payload keys", Object.keys(payload).sort(), ["answers", "presentationId"]);
  check("no visitId is smuggled into the payload (it rides on the SERVER presentation)", payload.visitId, undefined);

  const noVisit = await submitRerunAttempt({
    ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH,
    visitId: "", presentationId: "p1", answers: [],
  }, { storage: fakeStore(), submitFn: async () => { throw new Error("must not reach the network"); } });
  check("a rerun submit without a visitId is refused BEFORE the network", noVisit.status, "malformed_request");
}

CASE("C2.6 — 51-b trigger 1: the response's visitHalf decides the discard, verbatim");
{
  const scope = { uid: ID.uid, classId: ID.classId, listId: ID.listId, day: DAY, resetEpoch: EPOCH };
  // (a) one half recorded — the visit the OTHER half still needs must survive.
  const s1 = fakeStore();
  await composeRerunHalf({ ...ID, visitedDay: DAY, half: "new", resetEpoch: EPOCH }, {
    storage: s1, mintVisitFn: async () => ({ status: "visit_minted", visitId: "vA" }), composeRerunFn: async () => composeOk(),
  });
  const half1 = await submitRerunAttempt({
    ...ID, visitedDay: DAY, half: "new", resetEpoch: EPOCH, visitId: "vA", presentationId: "p1", answers: [],
  }, { storage: s1, submitFn: async () => ({ status: "attempt_written", attemptId: "a1", visitHalf: { recorded: true, completedVisit: false } }) });
  check("recorded-only ⇒ NOT discarded", half1.visitDiscarded, false);
  check("the visit is still cached for the other half", peekVisitId(scope, { storage: s1 }), "vA");

  // (b) the pairing completes — discard, so the next visit is a fresh one.
  const half2 = await submitRerunAttempt({
    ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH, visitId: "vA", presentationId: "p2", answers: [],
  }, { storage: s1, submitFn: async () => ({ status: "attempt_written", attemptId: "a2", visitHalf: { recorded: true, completedVisit: true } }) });
  check("completedVisit ⇒ discarded", half2.visitDiscarded, true);
  check("the cached visit is gone", peekVisitId(scope, { storage: s1 }), null);
}

CASE("C2.7 — grade_unusable recomposes EXACTLY ONCE, through the RERUN leg (never a LIVE compose)");
{
  const store = fakeStore();
  let rerunComposes = 0; let liveComposes = 0;
  const deps = {
    storage: store,
    submitFn: async () => ({ status: "grade_unusable" }),
    composeRerunFn: async () => { rerunComposes++; return composeOk("pres2"); },
    // If the implementation ever routed a rerun through the LIVE surfaces
    // (reviewV2Submit.js:345-347), these would fire.
    composeSessionFn: async () => { liveComposes++; return composeOk(); },
    composeNewTestFn: async () => { liveComposes++; return composeOk(); },
    mintVisitFn: async () => ({ status: "visit_minted", visitId: "vZ" }),
  };
  const args = { ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH, visitId: "vZ", presentationId: "p1", answers: [] };
  const first = await submitRerunAttempt(args, deps);
  check("first ⇒ recomposed", first.outcome, "recomposed");
  check("the fresh presentation is the RERUN one", first.compose?.presentationId, "pres2");
  check("rerun compose used once", rerunComposes, 1);
  check("LIVE compose never used", liveComposes, 0);
  check("the once-guard is consumed", recomposeUsed(rerunRecomposeScope({ ...ID, visitedDay: DAY, half: "review" }), { storage: store }), true);

  const second = await submitRerunAttempt(args, deps);
  check("second ⇒ terminal block, not a loop", second.outcome, "blocked");
  check("status", second.status, "grade_unusable");
  check("rerun compose STILL used once", rerunComposes, 1);
}

CASE("C2.8 — grading_in_progress polls the SAME submit, bounded, and never composes");
{
  const store = fakeStore();
  let submits = 0; let composes = 0; let sleeps = 0;
  const out = await submitRerunAttempt({
    ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH, visitId: "v1", presentationId: "p1", answers: [],
  }, {
    storage: store,
    submitFn: async () => { submits++; return submits < 3 ? { status: "grading_in_progress" } : { status: "attempt_written", attemptId: "a1" }; },
    composeRerunFn: async () => { composes++; return composeOk(); },
    sleepFn: async () => { sleeps++; },
    pollIntervalMs: 0,
  });
  check("eventually written", out.outcome, "written");
  check("it retried the SAME submit", submits, 3);
  check("it slept between retries", sleeps, 2);
  check("it never composed", composes, 0);

  let s2 = 0;
  const exhausted = await submitRerunAttempt({
    ...ID, visitedDay: DAY, half: "review", resetEpoch: EPOCH, visitId: "v1", presentationId: "p1", answers: [],
  }, {
    storage: fakeStore(),
    submitFn: async () => { s2++; return { status: "grading_in_progress" }; },
    sleepFn: async () => {},
    pollRetries: 2, pollIntervalMs: 0,
  });
  check("the poll is BOUNDED", exhausted.outcome, "blocked");
  check("bounded to pollRetries + 1 attempts", s2, 3);
  check("and is marked retryable", exhausted.retryable, true);
}

CASE("C2.9 — 51-b's visit contract is CITED, not re-proved (its own evidence)");
{
  const p = "/app/docs/plans/deepfix2/evidence/df2-51b-visit-pure.json";
  checkTrue("51-b evidence exists", existsSync(p));
  const ev = JSON.parse(readFileSync(p, "utf8"));
  check("51-b passed", ev.pass, true);
  check("51-b failures", ev.failed, 0);
  console.log(`  (cited: df2-51b-visit-pure.json — ${ev.total} checks, ${ev.failed} failures)`);
}

// ===========================================================================
// C3 — THE BROWSER GLUE
// ===========================================================================
CASE("C3.1 — MCQ stays available when typed is capped (the modality is checked FIRST)");
{
  const win = "2026-08-05";
  const capped = { refused: true, scope: "student", windowKey: win };
  check("mcq + capped ⇒ NOT pre-empted", shouldPreemptTypedRetest({ reviewTestType: "mcq", metering: capped, currentWindowKey: win }), false);
  check("undefined modality (defaults elsewhere to mcq) ⇒ NOT pre-empted", shouldPreemptTypedRetest({ metering: capped, currentWindowKey: win }), false);
  check("typed + capped ⇒ pre-empted", shouldPreemptTypedRetest({ reviewTestType: "typed", metering: capped, currentWindowKey: win }), true);
  check("typed + capped in an EARLIER window ⇒ NOT pre-empted (rollover)",
    shouldPreemptTypedRetest({ reviewTestType: "typed", metering: { ...capped, windowKey: "2026-08-04" }, currentWindowKey: win }), false);
  check("typed + no snapshot ⇒ NOT pre-empted (fails toward offering)",
    shouldPreemptTypedRetest({ reviewTestType: "typed", metering: null, currentWindowKey: win }), false);
  // The snapshot shape 51-a defined FOR this fold, round-tripped through storage.
  const store = fakeStore();
  recordPracticeCap(ID, capRefusal, { storage: store, nowMs: Date.UTC(2026, 7, 5, 3, 0, 0) });
  check("round-trip", readPracticeCap(ID, { storage: store }), { refused: true, scope: "student", windowKey: "2026-08-05" });
  check("a corrupt snapshot reads as 'no cap known'", (() => {
    const s = fakeStore(); s.setItem(`rv2cap.${ID.uid}.${ID.classId}.${ID.listId}`, "{{{");
    return readPracticeCap(ID, { storage: s });
  })(), null);
}

CASE("C3.2 — the rerun testConfig CANNOT carry a session (so the completion gate is unreachable)");
{
  const cfg = rerunTestConfigOverride({
    baseConfig: {
      testOptionsCount: 4, passThresholdDecimal: 0.95, testSizeReview: 30,
      // A caller that wrongly passed session context must not be able to arm
      // the pages' completion gate through this function.
      dayNumber: 7, isFirstDay: true, segment: { startIndex: 0, endIndex: 9 },
      wordRangeStart: 1, wordRangeEnd: 10,
    },
    rerun: {
      half: "review", presentationId: "p1", testType: "mcq", visitedDay: 4, visitId: "v1", resetEpoch: 0,
      words: [{ id: "w1" }, { id: "w2" }],
      poolWords: [{ id: "w1" }, { id: "w2" }, { id: "w3" }, { id: "w4" }],
    },
  });
  check("no dayNumber", Object.prototype.hasOwnProperty.call(cfg, "dayNumber"), false);
  check("no isFirstDay", Object.prototype.hasOwnProperty.call(cfg, "isFirstDay"), false);
  check("no segment", Object.prototype.hasOwnProperty.call(cfg, "segment"), false);
  check("range labels nulled (F2)", [cfg.wordRangeStart, cfg.wordRangeEnd], [null, null]);
  check("wordsToTest is the presentation VERBATIM (V3)", cfg.wordsToTest.map((w) => w.id), ["w1", "w2"]);
  check("originalWordPool is the FULL pool (F3)", cfg.originalWordPool.map((w) => w.id), ["w1", "w2", "w3", "w4"]);
  check("assignment settings survive", [cfg.testOptionsCount, cfg.passThresholdDecimal], [4, 0.95]);
  check("testType is the half", cfg.testType, "review");
  check("rv2.source is the RERUN tag", cfg.rv2?.source, RERUN_SOURCE.review);
  check("rv2 carries the visit", [cfg.rv2?.visitId, cfg.rv2?.visitedDay], ["v1", 4]);
  check("rv2.logicalDay is the VISITED day", cfg.rv2?.logicalDay, 4);
  const newCfg = rerunTestConfigOverride({ baseConfig: {}, rerun: { half: "new", presentationId: "p", testType: "typed", visitedDay: 2, visitId: "v", words: [], poolWords: [] } });
  check("the new half gets the new tag", newCfg.rv2?.source, RERUN_SOURCE.new);
}

CASE("C3.3 — the source tags, the half selection, and the epoch mirror");
{
  check("isRerunSource(live review)", isRerunSource("composeSession"), false);
  check("isRerunSource(live new)", isRerunSource("composeNewTest"), false);
  check("isRerunSource(rerun review)", isRerunSource(RERUN_SOURCE.review), true);
  check("rerunHalfFromSource", [rerunHalfFromSource(RERUN_SOURCE.new), rerunHalfFromSource(RERUN_SOURCE.review), rerunHalfFromSource("composeSession")], ["new", "review", null]);
  check("wantedRv2Sources(new)", wantedRv2Sources("new"), ["composeNewTest", RERUN_SOURCE.new]);
  check("wantedRv2Sources(review)", wantedRv2Sources("review"), ["composeSession", RERUN_SOURCE.review]);
  check("a 'new' page never accepts a review presentation", wantedRv2Sources("new").includes("composeSession"), false);
  check("rv2SessionTypeFromSource", [rv2SessionTypeFromSource("composeNewTest"), rv2SessionTypeFromSource(RERUN_SOURCE.review), rv2SessionTypeFromSource("junk")], ["new", "review", null]);
  // One button, two halves: 'off' means the day HAS a new half not yet in this visit.
  check("new pip off ⇒ compose the new half", nextRerunHalf({ newPipState: "off" }), "new");
  check("new pip on ⇒ compose the review half", nextRerunHalf({ newPipState: "on" }), "review");
  check("new pip na (F3) ⇒ review forever", nextRerunHalf({ newPipState: "na" }), "review");
  // effectiveResetEpoch mirrors functions/reviewV2/composer.js:198-201.
  check("max of the two", effectiveResetEpoch({ resetEpoch: 2 }, { resetEpoch: 5 }), 5);
  check("absent ⇒ 0", effectiveResetEpoch(null, null), 0);
  check("malformed ⇒ 0", effectiveResetEpoch({ resetEpoch: "3" }, { resetEpoch: -1 }), 0);
  const composerSrc = readSrc("functions/reviewV2/composer.js");
  checkTrue("the server helper still reads as max(pm,lp)",
    composerSrc.includes("return Math.max(e(pmData), e(lpData));"));
  // Scopes never collide with the live ones.
  const live = "rv2ck.u1.c1.l1.d4.review";
  check("the rerun compose scope is distinct", rerunComposeScope({ ...ID, visitedDay: 4, half: "review" }) === live, false);
  check("the rerun compose scope shape", rerunComposeScope({ ...ID, visitedDay: 4, half: "review" }), "rv2ck.u1.c1.l1.d4.rerun-review");
  check("the rerun recompose-guard scope shape", rerunRecomposeScope({ ...ID, visitedDay: 4, half: "new" }), "rv2ru.u1.c1.l1.d4.rerun-new");
}

// ===========================================================================
// C4 — THE PAGES: NTF-27, the flag-off proof, and the text anchors
// ===========================================================================
CASE("C4.1 — NTF-27: the persisted handle rebuilds THIS test after a reload; the OLD handle cannot");
{
  const words = [{ id: "w1" }, { id: "w2" }, { id: "w3" }];
  const pool = [...words, { id: "w4" }, { id: "w5" }];
  const rv2 = { presentationId: "presFRESH", testType: "mcq", logicalDay: 3, resetEpoch: 0, source: "composeSession" };

  // THE PRE-FIX REPRODUCTION: the handle cutover-d persisted (no ids).
  check("the OLD handle is not rebuildable ⇒ the page fell to legacy smart-selection ⇒ drift",
    rebuildableHandle(rv2), null);

  // THE FIX.
  const stored = rv2PersistableHandle({ rv2, words, poolWords: pool, testOptionsCount: 4, passThresholdDecimal: 0.95 });
  check("the handle still carries every cutover field", [stored.presentationId, stored.testType, stored.logicalDay, stored.source], ["presFRESH", "mcq", 3, "composeSession"]);
  const rebuilt = rebuildableHandle(stored);
  check("presented ids survive, in the SERVED order", rebuilt?.presentedWordIds, ["w1", "w2", "w3"]);
  check("the FULL pool survives (F3 — a reload must not shrink MCQ options)", rebuilt?.poolWordIds, ["w1", "w2", "w3", "w4", "w5"]);
  check("the scalars survive (no class-doc re-read on reload)", [rebuilt?.testOptionsCount, rebuilt?.passThresholdDecimal], [4, 0.95]);

  // The whole reload: only sessionStorage survives (location.state does not).
  const store = fakeStore();
  store.setItem(LIVE_BLOB_KEY, JSON.stringify(blobWithRv2Presentation({ classId: ID.classId, listId: ID.listId, newWords: [] }, stored)));
  const afterReload = JSON.parse(store.getItem(LIVE_BLOB_KEY));
  const handleAfter = rv2HandleFromBlobAny({ blob: afterReload, classId: ID.classId, listId: ID.listId });
  check("the reloaded page finds its handle", handleAfter?.presentationId, "presFRESH");
  check("and knows which half it was running (the URL need not say)", rv2SessionTypeFromSource(handleAfter?.source), "review");
  const r2 = rebuildableHandle(handleAfter);
  check("the rebuilt answer sheet targets the SAME presentation's words ⇒ NO drift-reject",
    r2?.presentedWordIds, stored.presentedWordIds);
  // Identity is still enforced.
  check("a foreign class's blob is refused", rv2HandleFromBlobAny({ blob: afterReload, classId: "OTHER", listId: ID.listId }), null);
  check("an unknown source is refused", rv2HandleFromBlobAny({ blob: { ...afterReload, rv2Presentation: { ...stored, source: "junk" } }, classId: ID.classId, listId: ID.listId }), null);
  // A partially-written handle degrades to the legacy path rather than half-rebuilding.
  check("empty presented ids ⇒ not rebuildable", rebuildableHandle({ ...stored, presentedWordIds: [] }), null);
  check("non-string ids ⇒ not rebuildable", rebuildableHandle({ ...stored, presentedWordIds: ["w1", 7] }), null);
  check("a missing pool degrades to the presented set, never empty",
    rebuildableHandle({ ...stored, poolWordIds: null })?.poolWordIds, ["w1", "w2", "w3"]);
}

CASE("C4.2 — the blob acceptance test: phase equality is preserved, the rerun tag is added, the keys are separate");
{
  const blob = { classId: ID.classId, listId: ID.listId, rv2Presentation: { presentationId: "p1", source: "composeSession" } };
  check("review page accepts the live review handle", rv2HandleFromBlob({ blob, ...ID, currentTestType: "review" })?.presentationId, "p1");
  check("NEW page refuses the review handle (the mis-route guard)", rv2HandleFromBlob({ blob, ...ID, currentTestType: "new" }), null);
  check("class mismatch refused", rv2HandleFromBlob({ blob, classId: "X", listId: ID.listId, currentTestType: "review" }), null);
  check("list mismatch refused", rv2HandleFromBlob({ blob, classId: ID.classId, listId: "X", currentTestType: "review" }), null);
  const rerunBlob = { classId: ID.classId, listId: ID.listId, rv2Presentation: { presentationId: "p2", source: RERUN_SOURCE.new } };
  check("new page accepts the rerun-new handle", rv2HandleFromBlob({ blob: rerunBlob, ...ID, currentTestType: "new" })?.presentationId, "p2");
  check("review page refuses the rerun-NEW handle", rv2HandleFromBlob({ blob: rerunBlob, ...ID, currentTestType: "review" }), null);
  check("location.state handle, same law", rv2HandleFromTestConfig({ testConfig: { rv2: { presentationId: "p3", source: RERUN_SOURCE.review } }, currentTestType: "review" })?.presentationId, "p3");
  check("no rv2 ⇒ null (the legacy submit path runs)", rv2HandleFromTestConfig({ testConfig: {}, currentTestType: "review" }), null);
  check("the two blob keys are different", LIVE_BLOB_KEY === RESTUDY_BLOB_KEY, false);
  check("the live key is the one the cutover folds already used", LIVE_BLOB_KEY, "dailySessionState");
  const payload = restudyBlobPayload({ classId: "c1", listId: "l1", visitedDay: 4, half: "new", rv2: { presentationId: "p" } });
  check("the restudy blob carries NO session fields", Object.keys(payload).sort(), ["classId", "half", "listId", "rv2Presentation", "visitedDay"]);
}

CASE("C4.3 — TEXT ANCHORS: every new page branch is REVIEW_V2_CLIENT-gated and the rerun never reaches a legacy write");
{
  const mcq = readSrc("src/pages/MCQTest.jsx");
  const typed = readSrc("src/pages/TypedTest.jsx");
  const browser = readSrc("src/pages/RestudyBrowser.jsx");
  for (const [name, src] of [["MCQTest.jsx", mcq], ["TypedTest.jsx", typed]]) {
    checkTrue(`${name}: the restudy discriminator is flag-gated`,
      src.includes("const isRestudyRun = REVIEW_V2_CLIENT && searchParams.get('restudy') === '1'"));
    checkTrue(`${name}: the blob key defaults to the live one flag-off`,
      src.includes("const rv2BlobKey = isRestudyRun ? RESTUDY_BLOB_KEY : LIVE_BLOB_KEY"));
    checkTrue(`${name}: the rerun handle derives from rv2Handle (null flag-off)`,
      src.includes("const rv2Rerun = isRerunSource(rv2Handle?.source) ? rv2Handle : null"));
    checkTrue(`${name}: the rerun submit branch precedes the live one`,
      src.indexOf("if (rv2Rerun) {") > 0 && src.indexOf("if (rv2Rerun) {") < src.indexOf("} else if (rv2Handle) {"));
    checkTrue(`${name}: the legacy study_state write is skipped for a rerun`,
      src.includes("if (!rv2Rerun && !resultsProcessedRef.current) {"));
    checkTrue(`${name}: the reload rebuild is flag-gated and only runs without location.state`,
      src.includes("if (REVIEW_V2_CLIENT && (await rebuildRv2FromBlob())) {"));
    checkTrue(`${name}: PATH A persists the rebuildable handle behind the flag`,
      src.includes("if (REVIEW_V2_CLIENT && testConfig.rv2) {\n          updateRv2PresentationInBlob(rv2PersistableHandle({"));
    // The rerun must never set rv2Fallback (which is what routes to the legacy write).
    const rerunStart = src.indexOf("if (rv2Rerun) {");
    const rerunEnd = src.indexOf("} else if (rv2Handle) {");
    const rerunBlock = src.slice(rerunStart, rerunEnd);
    check(`${name}: the rerun branch never sets rv2Fallback`, /rv2Fallback\s*=\s*true/.test(rerunBlock), false);
    check(`${name}: the rerun branch calls the rerun submit`, rerunBlock.includes("await submitRerunAttempt({"), true);
    check(`${name}: the rerun branch never calls submitAttemptV2`, rerunBlock.includes("submitAttemptV2("), false);
    check(`${name}: the rerun branch offers no in-page retake`, rerunBlock.includes("setCanRetake(false)"), true);
    // NTF-27: the LAST write at every site carries the word ids — the live
    // recompose site included (the exact scenario NTF-27 names). That site
    // keeps cutover-d's certified handle-only write byte-identical and stamps
    // the ids immediately after it (an ADD, not an edit — see the page's own
    // comment), so it is the ONE site with two writes.
    const writes = (src.match(/updateRv2PresentationInBlob\(/g) || []).length;
    const idWrites = (src.match(/updateRv2PresentationInBlob\(rv2PersistableHandle\(\{/g) || []).length;
    const handleOnlyWrites = (src.match(/updateRv2PresentationInBlob\(\{/g) || []).length;
    check(`${name}: six blob writes (PATH A · live recompose ×2 · rerun recompose · retake-new · retake-review)`, writes, 6);
    check(`${name}: five of them carry the word ids`, idWrites, 5);
    check(`${name}: exactly one handle-only write remains — cutover-d's certified line`, handleOnlyWrites, 1);
    check(`${name}: and it is IMMEDIATELY followed (before any render-state) by the id-carrying re-stamp`,
      src.indexOf("updateRv2PresentationInBlob(rv2PersistableHandle({", src.indexOf("updateRv2PresentationInBlob({")) > src.indexOf("updateRv2PresentationInBlob({"), true);
  }
  // The browser wires the stubs — and nothing else composes/mints on render.
  check("RestudyBrowser: the 51-c stubs are gone", /handleRestudyStub|handleRetestStub/.test(browser), false);
  checkTrue("RestudyBrowser: Re-study is wired", browser.includes("onRestudy={() => handleRestudy(row.day)}"));
  checkTrue("RestudyBrowser: Re-test is wired", browser.includes("onRetest={() => handleRetest(row)}"));
  checkTrue("RestudyBrowser: the compose happens in the click handler, not in a render/effect",
    browser.indexOf("await composeRerunHalf({") > browser.indexOf("const handleRetest = useCallback"));
  check("RestudyBrowser: exactly one composeRerunHalf CALL site", (browser.match(/composeRerunHalf\(/g) || []).length, 1);
  checkTrue("RestudyBrowser: the route comes from the ENGINE's modality",
    browser.includes("const route = composed.testType === 'typed' ? '/typedtest' : '/mcqtest'"));
  checkTrue("RestudyBrowser: the re-test URL carries the restudy discriminator + the half",
    browser.includes("?type=${half}&restudy=1"));
  checkTrue("RestudyBrowser: the cap pre-empt renders the ratified sentence",
    browser.includes("setActionError(PRACTICE_LIMIT_MESSAGE)"));
  check("RestudyBrowser: re-study performs NO write", /setDoc\(|addDoc\(|writeBatch\(|runTransaction\(/.test(browser), false);
  // updateDoc exists ONLY for the 51-c bookmark toggle this fold did not touch.
  check("RestudyBrowser: updateDoc count unchanged from HEAD",
    (browser.match(/updateDoc\(/g) || []).length,
    (readHead("src/pages/RestudyBrowser.jsx").match(/updateDoc\(/g) || []).length);
}

CASE("C4.4 — FLAG-OFF: the flag is false, and every DELETED line in this fold's diff is on the declared list");
{
  check("REVIEW_V2_CLIENT is still false", REVIEW_V2_CLIENT, false);
  // The whole flag-off claim rests on: every new branch is gated, and every
  // line this fold REPLACED is replaced by something that reads identically
  // when the flag is false. The gates are C4.3; this is the replacement list.
  const DECLARED_DELETIONS = new Set([
    // getRv2SubmitHandle — same clauses, now the pure fixtured predicate.
    "    const wantSource = currentTestType === 'new' ? 'composeNewTest' : 'composeSession'",
    "      const blob = JSON.parse(sessionStorage.getItem('dailySessionState') || 'null')",
    "      const h = blob?.rv2Presentation",
    "      if (h?.presentationId && h.source === wantSource &&",
    "          blob.classId === classIdParam && blob.listId === listId) return h",
    "    const h = testConfig?.rv2",
    "    return (h?.presentationId && h.source === wantSource) ? h : null",
    // updateRv2PresentationInBlob — same write, keyed by the same literal flag-off.
    "      if (blob) {",
    "        blob.rv2Presentation = rv2",
    "        sessionStorage.setItem('dailySessionState', JSON.stringify(blob))",
    "      }",
    // the submit chain: `if` becomes `else if` after the (null flag-off) rerun branch.
    "          if (rv2Handle) {",
    // the study_state write gains a (null flag-off) rerun guard.
    "        if (!resultsProcessedRef.current) {",
    // NTF-27: the RETAKE sites' handle-only writes are replaced by
    // id-carrying ones (both inside REVIEW_V2_CLIENT-gated branches). The LIVE
    // RECOMPOSE site is deliberately NOT in this list — its certified
    // cutover-d line is left byte-identical and the id stamp is ADDED after it.
    "              updateRv2PresentationInBlob({",
    "                presentationId: res.presentationId, testType: res.testType,",
    "                logicalDay: res.logicalDay, resetEpoch: null, source: 'composeNewTest',",
    "              })",
    "          updateRv2PresentationInBlob(nextConfig.rv2)",
    // RestudyBrowser: the 51-c stubs, replaced by the wiring.
    "  // 51-d wires these to the real rerun-compose + navigation flow. Stubs only",
    "  // — browsing must never mint a visit or fake navigation (brief, Build §2).",
    "  const handleRestudyStub = useCallback(() => {",
    "    // intentionally empty — 51-d implements this",
    "  }, [])",
    "  const handleRetestStub = useCallback(() => {",
    "                  onRestudy={handleRestudyStub}",
    "                  onRetest={handleRetestStub}",
    "                onRestudy={handleRestudyStub}",
    "                onRetest={handleRetestStub}",
    "                  restudyDisabled={row.restudyDisabled}",
    "                  retestDisabled={row.retestDisabled}",
    "import { useCallback, useEffect, useMemo, useState } from 'react'",
    "import { Link, useParams } from 'react-router-dom'",
    "import { ChevronLeft, Info, Star } from 'lucide-react'",
    "import { DAY_STATES, bookmarkedDayForList, derivePastDays, deriveTodayRow } from '../utils/pastDayAuthority'",
    "  const { classId, listId } = useParams()",
    // reviewV2Client.js: the RV2 table + the classifier block grew (pure adds
    // land as context, but the two anchor lines are re-emitted by the differ).
    "  GRADE_UNUSABLE: 'grade_unusable',",
    "  // authority refusals",
    "/** True when the result means \"this bundle is too old — force a refresh\"",
    " *  [contract (5): the forced-refresh branch is CHOSEN; no adapter ships]. */",
    "export function isStaleClient(result) {",
  ]);
  const FILES = ["src/pages/MCQTest.jsx", "src/pages/TypedTest.jsx", "src/pages/RestudyBrowser.jsx", "src/services/reviewV2Client.js"];
  const diff = execFileSync("git", ["diff", "-U0", "--", ...FILES], { cwd: "/app", encoding: "utf8" });
  const deleted = diff.split("\n")
    .filter((l) => l.startsWith("-") && !l.startsWith("---"))
    .map((l) => l.slice(1));
  const undeclared = deleted.filter((l) => !DECLARED_DELETIONS.has(l));
  check("no UNDECLARED line was removed from the four flag-sensitive files", undeclared, []);
  console.log(`  (${deleted.length} deleted line(s), all declared)`);
  // Every legacy expression the flag-off path actually executes is still there.
  const mcq = readSrc("src/pages/MCQTest.jsx");
  const typed = readSrc("src/pages/TypedTest.jsx");
  for (const [name, src] of [["MCQTest.jsx", mcq], ["TypedTest.jsx", typed]]) {
    checkTrue(`${name}: the legacy SERVER_ATTEMPT_WRITE branch is intact`, src.includes("} else if (SERVER_ATTEMPT_WRITE) {"));
    checkTrue(`${name}: the legacy completion call is intact`, src.includes("await completeSessionFromTest({"));
    checkTrue(`${name}: the legacy study_state write is intact`, src.includes("await processTestResults(user.uid,"));
    checkTrue(`${name}: the flag-off blob key literal is unchanged`, src.includes("const LIVE_BLOB_KEY") === false && src.includes("LIVE_BLOB_KEY"));
  }
  // The one flag-off-visible literal: LIVE_BLOB_KEY must BE 'dailySessionState'.
  check("LIVE_BLOB_KEY is byte-equal to the literal the pages used before", LIVE_BLOB_KEY, "dailySessionState");
}

CASE("C4.5 — sibling files this fold must NOT touch are sha256-identical to HEAD");
{
  const UNTOUCHED = [
    "src/services/reviewV2Compose.js",
    "src/services/reviewV2Submit.js",
    "src/services/reviewV2Complete.js",
    "src/services/restudyVisit.js",
    "src/utils/pastDayAuthority.js",
    "src/utils/streakAuthority.js",
    "src/utils/testConfig.js",
    "src/pages/RestudyBrowser.viewModel.js",
    "src/pages/DailySessionFlow.jsx",
    "src/pages/Dashboard.jsx",
    "src/services/studyService.js",
    "src/App.jsx",
    "src/config/featureFlags.js",
    "src/components/Flashcard.jsx",
    "functions/reviewV2/callables.js",
    "functions/reviewV2/completion.js",
    "functions/reviewV2/visits.js",
    "functions/reviewV2/presentations.js",
    "functions/reviewV2/typedGrading.js",
    "functions/aiMetering.js",
    "firestore.rules",
  ];
  // EOL NOTE (found by this fixture, 2026-08-05): two of these files carry CRLF
  // in the working tree while their blobs are LF — a pre-existing artifact of
  // this shared Windows checkout (git normalizes on commit, so `git status`
  // correctly reports them UNMODIFIED). A raw byte compare therefore lies. Both
  // authorities are asserted: git's own verdict (`git diff --name-only`, which
  // applies the repo's normalization) AND a sha over EOL-normalized content.
  const norm = (s) => s.replace(/\r\n/g, "\n");
  const dirty = execFileSync("git", ["diff", "--name-only", "--", ...UNTOUCHED], { cwd: "/app", encoding: "utf8" })
    .split("\n").filter(Boolean);
  check("git reports NO modification to any untouched file", dirty, []);
  for (const rel of UNTOUCHED) {
    check(`${rel} sha256-identical to HEAD (EOL-normalized)`, sha(norm(readSrc(rel))), sha(norm(readHead(rel))));
  }
}

CASE("C4.6 — grep proofs (numbers derived here, never hand-typed)");
{
  const counts = {};
  for (const rel of ["src/pages/MCQTest.jsx", "src/pages/TypedTest.jsx", "src/pages/RestudyBrowser.jsx", "src/services/reviewV2Client.js"]) {
    const now = readSrc(rel); const head = readHead(rel);
    const c = (s, re) => (s.match(re) || []).length;
    counts[rel] = {
      reviewV2ClientGates: c(now, /REVIEW_V2_CLIENT/g) - c(head, /REVIEW_V2_CLIENT/g),
      writeVerbsNow: c(now, /\b(setDoc|addDoc|writeBatch|runTransaction)\(/g),
      writeVerbsHead: c(head, /\b(setDoc|addDoc|writeBatch|runTransaction)\(/g),
      lines: now.split("\n").length - head.split("\n").length,
    };
    check(`${rel}: no NEW Firestore write verb`, counts[rel].writeVerbsNow, counts[rel].writeVerbsHead);
  }
  // MCQ/Typed each gain exactly 4 new REVIEW_V2_CLIENT references (isRestudyRun,
  // PATH A persist, the reload-rebuild call site, + the import comment mention).
  check("MCQTest REVIEW_V2_CLIENT delta", counts["src/pages/MCQTest.jsx"].reviewV2ClientGates, 4);
  check("TypedTest REVIEW_V2_CLIENT delta", counts["src/pages/TypedTest.jsx"].reviewV2ClientGates, 4);
  check("RestudyBrowser adds no flag reference (the ROUTE is its gate — 51-c's law)",
    counts["src/pages/RestudyBrowser.jsx"].reviewV2ClientGates, 0);
  check("reviewV2Client adds no flag reference (it carries no flag)",
    counts["src/services/reviewV2Client.js"].reviewV2ClientGates, 0);
  console.log(`  (line deltas: ${JSON.stringify(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v.lines])))})`);
}

CASE("C4.7 — the four touched source files PARSE (WSL cannot run vite; this is the build-side proof)");
{
  // `@babel/parser` rides in with @vitejs/plugin-react. A syntax error in a
  // 2000-line live-path page would otherwise only surface at the flip.
  const { parse } = await import("@babel/parser");
  for (const rel of [
    "src/pages/MCQTest.jsx", "src/pages/TypedTest.jsx", "src/pages/RestudyBrowser.jsx",
    "src/services/restudyRetest.js", "src/services/reviewV2Client.js",
  ]) {
    let ok = true; let msg = "";
    try { parse(readSrc(rel), { sourceType: "module", plugins: ["jsx"] }); }
    catch (e) { ok = false; msg = e.message; }
    check(`${rel} parses${ok ? "" : ` (${msg})`}`, ok, true);
  }
}

// ===========================================================================
writeReceipt();
console.log(`\ndf2-51dg-retest PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
