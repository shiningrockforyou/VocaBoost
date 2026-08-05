#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — engine-emulator-lap.mjs v3: the DARK-BUILD ENGINE REHEARSAL,
 * extended over THE CALLABLE/AUTHORITY BOUNDARY (r70 fold, C8)
 * ============================================================================
 * v1 proved the engine transactions and was judged insufficient by BOTH r70
 * lanes for exactly one reason: the blockers lived in the wiring layer the
 * lap declared out of scope. v2 wraps the SIX PUBLIC CALLABLES with
 * firebase-functions-test and drives every authority fixture named in Codex
 * C8 + Opus condition 10: wrong-day/reused/rerun-as-new/cross-epoch
 * evidence · OFF→ON and ON→OFF source-posture (attempt-time governs) ·
 * frontier/future-day/review-first/day-1/list-end composes · full-range
 * rerun · visit mismatches · dark/version/config authority in the txn ·
 * COMPLETE-ROWS drift negatives · wrapped/no-active cursor · LRT order +
 * forced fallback · same-KST streak · compose_keys cleanup with real claims
 * · G−1/G+1/unstamped/malformed-window quarantine · the §9 reset callable ·
 * THE FLIP consuming a REAL b-delta-cycle --receipt (no synthesized success
 * JSON) + every receipt-schema refusal.
 *
 * RUNBOOK (same as b-emulator-lap.mjs):
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/engine-emulator-lap.mjs"
 *
 * MODULE-INSTANCE LAW: every require is pinned to functions/node_modules via
 * createRequire (cross-instance FieldValue sentinels fail instanceof).
 * Exit 0 = green; 1 = reds; 2 = precondition FATAL. Source-hash-bound
 * receipt → docs/plans/deepfix2/evidence/engine-lap-result.json (committed).
 */

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FATAL: FIRESTORE_EMULATOR_HOST not set — this lap runs ONLY against the emulator");
  process.exit(2);
}

// The §9 reset rebuild is gated (RESET_V2_ENABLED, emulator-overridable) —
// arm it for the lap BEFORE any module loads [r72].
process.env.RESET_V2_FOR_TEST = "1";

const fnRequire = createRequire("/app/functions/index.js");
const {initializeApp, cert, getApps} = fnRequire("firebase-admin/app");
const {getFirestore, Timestamp, FieldValue} = fnRequire("firebase-admin/firestore");
const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
const PROJECT = key.project_id;
// [DF2-12] index.js LOADS FIRST and owns `admin.initializeApp()`: the engine's
// typed leg reaches the LIVE grading-job helpers + `gradeTypedTest` through it
// (18_ §3), and a second initializeApp on the default app throws. Under
// `emulators:exec` GCLOUD_PROJECT/FIREBASE_CONFIG are set and
// FIRESTORE_EMULATOR_HOST means no credential is ever exercised; the cert init
// remains as the fallback when index.js somehow claimed no app.
const INDEX = fnRequire("/app/functions/index.js");
if (getApps().length === 0) initializeApp({credential: cert(key)});
const db = getFirestore();

const fft = fnRequire("firebase-functions-test")({projectId: PROJECT});
const CFG = fnRequire("/app/functions/reviewV2/config.js");
const COMP = fnRequire("/app/functions/reviewV2/composer.js");
const PRES = fnRequire("/app/functions/reviewV2/presentations.js");
const STAMP = fnRequire("/app/functions/reviewV2/stamping.js");
const DONE = fnRequire("/app/functions/reviewV2/completion.js");
const VIS = fnRequire("/app/functions/reviewV2/visits.js");
const RESET = fnRequire("/app/functions/reviewV2/reset.js");
const MON = fnRequire("/app/functions/reviewV2/monitoring.js");
const CALL = fnRequire("/app/functions/reviewV2/callables.js");
const TG = fnRequire("/app/functions/reviewV2/typedGrading.js");
const foundation = fnRequire("/app/functions/foundation.js");

const wrap = (c) => fft.wrap(c);
const call = async (c, uid, data, token = {}) =>
  wrap(c)({data, auth: uid === undefined ? undefined : {uid, token}});
const callErr = async (c, uid, data, token = {}) => {
  try { await call(c, uid, data, token); return null; } catch (e) { return String(e.code ?? e.message ?? e); }
};

let total = 0; let failed = 0; const reds = []; let caseName = "";
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };

/**
 * THE ENGINE'S DERIVED GLOBAL DOC ID [rv2-docid-collision A1] — `attempts/{id}`
 * and `grading_jobs/{key}`, both TOP-LEVEL collections, keyed from a
 * `presentationId` that carries no uid (presentations.js:445 over
 * composer.js:82-84, `seq` per user).
 *
 * WRITTEN OUT HERE, NOT IMPORTED FROM composer.js, ON PURPOSE: importing the
 * production derivation would make every fixture below agree with whatever the
 * engine does, and the mutant `M-A1-UID-SCOPE-REVERT` would survive. This is an
 * INDEPENDENT statement of the scheme, so reverting the uid scoping in
 * composer.js makes these lookups miss and the lap go red.
 */
const rv2Id = (uid, presentationId) => `rv2_${uid}_${presentationId}`;

const CONFIG_PATH = "system_config/review_v2";
const NOW = Date.now();
const DAY = 86400000;
const TS = (ms) => Timestamp.fromMillis(ms);

async function wipeEmulator() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {method: "DELETE"});
  if (!res.ok) throw new Error(`emulator wipe failed: ${res.status}`);
}
async function seedConfig(overrides = {}) {
  await db.doc(CONFIG_PATH).set({
    enabled: false, threshold: 92, queueSize: 60, testSize: 30,
    configVersion: 1, minClientVersion: null,
    rehearsalClassIds: [], firstEnabledAt: null,
    ...overrides,
  });
}
async function seedClass(classId, {listId = "L1", students = [], asg = {}} = {}) {
  await db.collection("classes").doc(classId).set({
    studentIds: students,
    assignments: {[listId]: {name: "seed", weeklyPace: 50, studyDaysPerWeek: 5, ...asg}},
  });
}
async function seedWords(listId, count) {
  const batch = db.batch();
  for (let i = 0; i < count; i++) {
    batch.set(db.collection("lists").doc(listId).collection("words").doc(`w${i}`),
        {word: `word${i}`, definition: `def${i}`, position: i});
  }
  await batch.commit();
}
/** Seed the durable progress doc for (uid, class, list) — csd/twi truth. */
async function seedProgress(uid, classId, listId, {csd, twi}) {
  await foundation.durableProgressRef(uid, classId, listId).set({
    classId, listId, currentStudyDay: csd, totalWordsIntroduced: twi,
    updatedAt: Timestamp.now(),
  }, {merge: true});
}
/** Seed a claimed live NEW-day presentation (engine new-evidence binding). */
async function seedNewPresentation(presId, {uid, classId, listId, day, claimedBy, wordIds, epoch = 0}) {
  await db.doc(`users/${uid}/review_presentations/${presId}`).set({
    uid, classId, listId, logicalDay: day, resetEpoch: epoch,
    presentedWordIds: wordIds, poolHash: "seed", compositionVersion: "new-day",
    requestFingerprint: {sessionType: "new", testType: "mcq", kind: "live", visitId: null},
    testType: "mcq", visitId: null, queueRef: null,
    rangeStartIndex: 0, rangeEndIndex: wordIds.length - 1,
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: claimedBy},
    createdAt: Timestamp.now(),
  });
}

/** Seed an engine-shaped attempt (review or new) with full bindings. */
async function seedAttempt(id, {uid, classId, listId, day, sessionType, rows, score,
  epoch = 0, presentationId = null, gateOn = true, range = null, type = null}) {
  await db.collection("attempts").doc(id).set({
    studentId: uid, classId, listId, studyDay: day, sessionType,
    testType: "mcq", score, passed: true,
    totalQuestions: rows.length,
    answers: rows.map(([w, c]) => ({wordId: w, isCorrect: c})),
    resetEpoch: epoch,
    ...(presentationId ? {presentationId} : {}),
    ...(type ? {type} : {}),
    ...(range ? {newWordStartIndex: range[0], newWordEndIndex: range[1]} : {}),
    gatePosture: {effectiveEnabled: gateOn, threshold: 92, configVersion: 1, source: "lap-seed"},
    submittedAt: Timestamp.now(),
  });
}

// ===========================================================================
CASE("RC0 — THE DERIVED-ID CANARY: one presentationId, two students, two documents [rv2-docid-collision A1]");
{
  // WHY THIS RUNS FIRST, and why it duplicates four assertions from CASE RC.
  // Every case from CB onward DEREFERENCES a document at the derived id
  // (`(await …doc(rv2Id(uid, pid)).get()).data().x`). If the uid scoping is
  // ever reverted, those reads miss and the lap dies of a TypeError in CB —
  // a red run, but one that never reaches the fixtures that OWN the defect,
  // and one that reports no assertion at all. This canary is placed ahead of
  // the first such dereference and is written to be CRASH-FREE (it asserts on
  // the ids the SERVER returns, never on a document it assumes exists), so a
  // scoping regression is reported as a NAMED assertion by the fixture that
  // means it. The full bypass set stays in CASE RC. Mutant:
  // `M-A1-UID-SCOPE-REVERT` in typed-seam-mutants.mjs.
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cZ"], queueSize: 6, testSize: 4});
  await seedClass("cZ", {students: ["uZ1", "uZ2"], listId: "LZ"});
  await seedWords("LZ", 20);
  await seedProgress("uZ1", "cZ", "LZ", {csd: 2, twi: 10});
  await seedProgress("uZ2", "cZ", "LZ", {csd: 2, twi: 10});
  const cz = {classId: "cZ", listId: "LZ", clientContractVersion: 1};
  const z1 = await call(CALL.reviewV2ComposeSession, "uZ1", {...cz, logicalDay: 3, composeKey: "lap-key-rc0-1"});
  const z2 = await call(CALL.reviewV2ComposeSession, "uZ2", {...cz, logicalDay: 3, composeKey: "lap-key-rc0-2"});
  const zPid = z1.presentation.presentationId;
  check("RC0 the colliding INPUT is still real: one presentationId for both students",
      [z1.status, z2.status, z2.presentation.presentationId], ["composed", "composed", zPid]);
  const zs1 = await call(CALL.reviewV2SubmitAttempt, "uZ1", {presentationId: zPid, clientContractVersion: 1,
    answers: z1.presentation.presentedWordIds.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}))});
  const zs2 = await call(CALL.reviewV2SubmitAttempt, "uZ2", {presentationId: zPid, clientContractVersion: 1,
    answers: z2.presentation.presentedWordIds.map((w) => ({wordId: w, studentResponse: ""}))});
  check("RC0 BOTH students land — neither is refused, neither replays the other",
      [zs1.status, zs1.replayed, zs1.score, zs2.status, zs2.replayed, zs2.score],
      ["attempt_written", false, 100, "attempt_written", false, 0]);
  check("RC0 the SERVER-RETURNED ids are uid-scoped and distinct",
      [zs1.attemptId, zs2.attemptId, zs1.attemptId !== zs2.attemptId],
      [rv2Id("uZ1", zPid), rv2Id("uZ2", zPid), true]);
  check("RC0 nothing is written at the id the OLD unscoped scheme derived",
      [(await db.collection("attempts").doc(`rv2_${zPid}`).get()).exists,
        (await db.collection("attempts").get()).size], [false, 2]);
}

// ===========================================================================
CASE("A — config authority matrix (strict schema [C3])");
{
  await wipeEmulator();
  let c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("cold start ⇒ hold", c.readStatus, "hold");
  await seedConfig();
  await seedClass("cA", {students: ["uA"]});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1", uid: "uA"});
  check("dark posture", [c.readStatus, c.stampingEligible, c.gateEffectiveEnabled, c.enrolled], ["ok", false, false, true]);
  await seedConfig({rehearsalClassIds: ["cA"]});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("rehearsal ⇒ eligible + ON while dark", [c.stampingEligible, c.gateEffectiveEnabled], [true, true]);
  await seedConfig({firstEnabledAt: TS(NOW), enabled: false});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("kill window: eligible, gate OFF", [c.stampingEligible, c.gateEffectiveEnabled], [true, false]);
  // STRICT AUTHORITY SCHEMA [C3 — the Codex fail-open repro, now HOLD]:
  await seedConfig({firstEnabledAt: "not-a-timestamp"});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("malformed marker ⇒ HOLD (not eligible)", [c.readStatus, c.stampingEligible], ["hold", false]);
  await seedConfig({minClientVersion: "bad"});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("malformed fence ⇒ HOLD (not disarmed)", c.readStatus, "hold");
  await seedConfig({rehearsalClassIds: "cA"});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("malformed rehearsal ⇒ HOLD", c.readStatus, "hold");
  await seedConfig({threshold: "92"});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("malformed global size ⇒ HOLD", c.readStatus, "hold");
  await seedConfig({configVersion: 0});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("configVersion<1 ⇒ HOLD", c.readStatus, "hold");
  // [r72 C3] PRESENT-but-malformed ASSIGNMENT overrides HOLD too.
  await seedConfig();
  await seedClass("cA", {students: ["uA"], asg: {reviewPassThreshold: "bad"}});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("malformed assignment override ⇒ HOLD", c.readStatus, "hold");
  await seedClass("cA", {students: ["uA"], asg: {reviewGateEnabled: "yes"}});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("non-boolean gate override ⇒ HOLD", c.readStatus, "hold");
  // [r74 C3b] CONTAINER shapes: scalars/arrays AND Firestore special values
  // refuse; a plain map serves.
  for (const [label, val] of [["true", true], ["number", 7], ["string", "assigned"],
    ["array", []], ["Timestamp", Timestamp.now()]]) {
    await db.collection("classes").doc("cA").set({studentIds: ["uA"], assignments: {L1: val}});
    c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1", uid: "uA"});
    check(`container ${label} ⇒ HOLD`, c.readStatus, "hold");
  }
  // [r75 Codex-3] the PARENT container: array/Timestamp refuse before any
  // lookup (an array indexed by listId "0" masqueraded as the map).
  await db.collection("classes").doc("cA").set({studentIds: ["uA"], assignments: [{reviewPassThreshold: 92}]});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "0", uid: "uA"});
  check("parent array ⇒ HOLD", c.readStatus, "hold");
  await db.collection("classes").doc("cA").set({studentIds: ["uA"], assignments: Timestamp.now()});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1", uid: "uA"});
  check("parent Timestamp ⇒ HOLD", c.readStatus, "hold");
  // Entry GeoPoint (the r74 loop had Timestamp but not GeoPoint):
  const {GeoPoint} = fnRequire("firebase-admin/firestore");
  await db.collection("classes").doc("cA").set({studentIds: ["uA"], assignments: {L1: new GeoPoint(0, 0)}});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1", uid: "uA"});
  check("entry GeoPoint ⇒ HOLD", c.readStatus, "hold");
  await seedClass("cA", {students: ["uA"]});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1", uid: "uA"});
  check("plain map serves", [c.readStatus, c.assignmentExists], ["ok", true]);
}

// ===========================================================================
CASE("B — composer: frontier + universe from progress truth [C2]");
{
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cB1", "cB2", "cB3"], queueSize: 4});
  await seedClass("cB1", {students: ["uB"]});
  await seedClass("cB2", {students: ["uB"]});
  await seedClass("cB3", {students: ["uB"]});
  await seedWords("L1", 60);
  const canon = Array.from({length: 60}, (_, i) => ({wordId: `w${i}`, wordIndex: i}));
  const base = {uid: "uB", listId: "L1", resetEpoch: 0, canonicalWords: canon};
  await seedProgress("uB", "cB1", "L1", {csd: 4, twi: 8});

  // REVIEW-FIRST STABILITY [BL-2 fixture]: no day-5 new attempt exists —
  // the universe is EXACTLY positions < twi, never the whole list.
  let r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 5});
  check("review-first universe = < twi", [r.status, r.queue.orderedQueueWordIds], ["created", ["w0", "w1", "w2", "w3"]]);
  check("tuple from truth", [r.queue.anchorNwei, r.queue.generation], [7, "t8"]);
  check("snapshot content-truth + config audit", [r.queue.snapshot.queueSize, r.queue.snapshot.configQueueSize], [4, 4]);
  // Post-new-test stability: the day-5 new pass appears — the SAME compose
  // replays identically (twi moves only at completion).
  await seedAttempt("b-new5", {uid: "uB", classId: "cB1", listId: "L1", day: 5, sessionType: "new",
    rows: [["w8", true]], score: 100, range: [8, 9]});
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 5});
  check("stable after new-pass (replay)", [r.status, r.queue.orderedQueueWordIds.length], ["exists", 4]);
  // FRONTIER AUTHORITY [H-1 fixture]: non-frontier days refuse; the cursor
  // is byte-unchanged after refusals.
  const cur0 = (await db.doc("users/uB/review_cursors/L1_e0").get()).data();
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 6});
  check("future day refused", [r.status, r.expectedDay], ["day_guard_rejected", 5]);
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 999});
  check("day-999 refused", r.status, "day_guard_rejected");
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 4});
  check("past day refused", r.status, "day_guard_rejected");
  const cur1 = (await db.doc("users/uB/review_cursors/L1_e0").get()).data();
  check("cursor unchanged by refusals", [cur1.cursorWordIndex, cur1.lastLogicalDay], [cur0.cursorWordIndex, cur0.lastLogicalDay]);
  // DAY 1 [first_day_new_only]: twi 0 ⇒ empty_pool.
  await seedProgress("uB", "cB3", "L1", {csd: 0, twi: 0});
  r = await COMP.composeDayQueue(db, {...base, classId: "cB3", logicalDay: 1});
  check("day-1 no review", r.status, "empty_pool");
  // SAME-DAY CROSS-CLASS REUSE: class 2 at the same truth ⇒ verbatim, no
  // cursor move; then TUPLE MISMATCH (different twi) ⇒ typed, not internal.
  await seedProgress("uB", "cB2", "L1", {csd: 4, twi: 8});
  await db.doc("classes/cB2").set({assignments: {L1: {reviewQueueSize: 2}}}, {merge: true});
  r = await COMP.composeDayQueue(db, {...base, classId: "cB2", logicalDay: 5});
  check("reuse verbatim + audit sizes", [r.status, r.reused, r.queue.snapshot.queueSize, r.queue.snapshot.configQueueSize], ["created", true, 4, 2]);
  const cur2 = (await db.doc("users/uB/review_cursors/L1_e0").get()).data();
  check("reuse: cursor untouched", cur2.cursorWordIndex, cur1.cursorWordIndex);
  await seedProgress("uB", "cB3", "L1", {csd: 4, twi: 6}); // drifted universe
  r = await COMP.composeDayQueue(db, {...base, classId: "cB3", logicalDay: 5});
  check("reuse tuple mismatch ⇒ typed", [r.status, r.requestTuple.generation], ["reuse_anchor_mismatch", "t6"]);
  // LIST-END: whole list only when twi === |list|.
  await seedProgress("uB", "cB1", "L1", {csd: 9, twi: 60});
  // advance day 5 was never completed — move frontier by completing? Direct
  // seed: the composer trusts the durable doc, so day 10 composes over all.
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 10});
  check("list-end whole-list", [r.status, r.queue.orderedQueueWordIds.length, r.queue.generation], ["created", 4, "t60"]);
  // WRAPPED WINDOW [M-1]: queueSize 3, 8 active (w0..w7 after resting the
  // rest), cursor at 6 ⇒ traversal [7,0,1] ⇒ cursor := 1 (≠ numeric max 7).
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cW"], queueSize: 3});
  await seedClass("cW", {students: ["uW"], listId: "LW"});
  await seedWords("LW", 8);
  await seedProgress("uW", "cW", "LW", {csd: 4, twi: 8});
  await db.doc("users/uW/review_cursors/LW_e0").set({uid: "uW", listId: "LW", resetEpoch: 0,
    cursorWordIndex: 6, lastLogicalDay: 4, lastQueueRef: "x", updatedAt: Timestamp.now()});
  const canonW = Array.from({length: 8}, (_, i) => ({wordId: `w${i}`, wordIndex: i}));
  r = await COMP.composeDayQueue(db, {uid: "uW", classId: "cW", listId: "LW", logicalDay: 5,
    resetEpoch: 0, canonicalWords: canonW});
  check("wrapped-window sweep", r.queue.orderedQueueWordIds, ["w7", "w0", "w1"]);
  check("wrapped-window cursor = LAST TRAVERSED", (await db.doc("users/uW/review_cursors/LW_e0").get()).data().cursorWordIndex, 1);
  // NO-ACTIVE ⇒ cursor unchanged; pure top-up queue.
  const batch = db.batch();
  for (let i = 0; i < 8; i++) {
    batch.set(db.doc(`users/uW/study_states/w${i}`), {reviewRestingUntil: TS(NOW + (10 + i) * DAY)}, {merge: true});
  }
  await batch.commit();
  await seedProgress("uW", "cW", "LW", {csd: 5, twi: 8});
  r = await COMP.composeDayQueue(db, {uid: "uW", classId: "cW", listId: "LW", logicalDay: 6,
    resetEpoch: 0, canonicalWords: canonW});
  check("no-active pure top-up", [r.activeCount, r.topUpCount, r.queue.orderedQueueWordIds], [0, 3, ["w0", "w1", "w2"]]);
  check("no-active cursor unchanged", (await db.doc("users/uW/review_cursors/LW_e0").get()).data().cursorWordIndex, 1);
  // CURSOR REPAIR: overshoot artifact ⇒ swept as absent + flagged.
  await db.doc("users/uW/review_cursors/LW_e0").set({uid: "uW", listId: "LW", resetEpoch: 0,
    cursorWordIndex: 3, lastLogicalDay: 99, lastQueueRef: "x", updatedAt: Timestamp.now()});
  await seedProgress("uW", "cW", "LW", {csd: 6, twi: 8});
  const batch2 = db.batch();
  for (let i = 0; i < 8; i++) batch2.delete(db.doc(`users/uW/study_states/w${i}`));
  await batch2.commit();
  r = await COMP.composeDayQueue(db, {uid: "uW", classId: "cW", listId: "LW", logicalDay: 7,
    resetEpoch: 0, canonicalWords: canonW});
  check("overshot cursor repaired", [r.status, r.cursorRepaired, r.queue.orderedQueueWordIds], ["created", true, ["w0", "w1", "w2"]]);
  // TXN-TIME DARK REFUSAL [C3]: config dark ⇒ the ENGINE txn itself refuses.
  await seedConfig({rehearsalClassIds: []});
  await seedProgress("uW", "cW", "LW", {csd: 7, twi: 8});
  r = await COMP.composeDayQueue(db, {uid: "uW", classId: "cW", listId: "LW", logicalDay: 8,
    resetEpoch: 0, canonicalWords: canonW});
  check("in-txn dark refusal", r.status, "review_v2_dark");
  // Reset fence (kept from v1).
  await seedConfig({rehearsalClassIds: ["cW"]});
  await db.doc("users/uW/progress_meta/LW").set({resetEpoch: 0, resetInProgress: {opId: "x", at: Timestamp.now()}});
  r = await COMP.composeDayQueue(db, {uid: "uW", classId: "cW", listId: "LW", logicalDay: 8,
    resetEpoch: 0, canonicalWords: canonW});
  check("reset lock rejects", r.status, "reset_in_progress");
  await db.doc("users/uW/progress_meta/LW").set({resetEpoch: 1});
  r = await COMP.composeDayQueue(db, {uid: "uW", classId: "cW", listId: "LW", logicalDay: 8,
    resetEpoch: 0, canonicalWords: canonW});
  check("epoch drift rejects", [r.status, r.currentEpoch], ["reset_epoch_mismatch", 1]);
  // [r75 — Codex r74 #1] THE TAKEOVER SEQUENCE: a stale crashed lock keeps
  // the engine FAIL-CLOSED; the next reset op takes over (re-fence →
  // cleanup → owner-clear); only THEN does the engine serve.
  // [r76 ROW 3a — Codex r75 #3] PLANT dirty epoch-0 artifacts in the crash
  // state so the takeover's CLEANUP is discriminating: a regression that
  // re-fences and clears the lock but skips cleanup must go RED here.
  await db.doc("users/uW/compose_keys/staleclaimhash").set({
    composeKeyCanonical: "stale-key-0001", presentationId: "gone",
    fingerprint: {classId: "cW", listId: "LW", logicalDay: 1, resetEpoch: 0,
      sessionType: "review", testType: "mcq", kind: "live", visitId: null},
    createdAt: Timestamp.now(), resetEpoch: 0});
  await db.doc("users/uW/day_completions/LW_d1_e0").set({
    uid: "uW", listId: "LW", logicalDay: 1, resetEpoch: 0, completedAt: Timestamp.now()});
  await db.doc("users/uW/progress_meta/LW").set({resetEpoch: 0,
    resetInProgress: {opId: "crashed", at: TS(Date.now() - 11 * 60000)}});
  r = await COMP.composeDayQueue(db, {uid: "uW", classId: "cW", listId: "LW", logicalDay: 8,
    resetEpoch: 0, canonicalWords: canonW});
  check("stale crashed lock: engine still REFUSES", r.status, "reset_in_progress");
  const tko = await call(foundation.resetProgress, "uW", {listId: "LW"});
  checkTrue("stale-owner takeover completes", tko.success === true && tko.resetV2 === true);
  const pmAfter = (await db.doc("users/uW/progress_meta/LW").get()).data();
  checkTrue("takeover RE-FENCED to a higher epoch", pmAfter.resetEpoch > 0);
  // [r76 ROW 3b] the cleanup actually ran on the takeover path:
  checkTrue("takeover CLEANED the stale graph (counts)",
      (tko.rv2Deleted?.compose_keys ?? 0) >= 1 && (tko.rv2Deleted?.day_completions ?? 0) >= 1);
  check("planted stale artifacts are GONE",
      [(await db.doc("users/uW/compose_keys/staleclaimhash").get()).exists,
        (await db.doc("users/uW/day_completions/LW_d1_e0").get()).exists], [false, false]);
  check("takeover owner-cleared", pmAfter.resetInProgress ?? null, null);
  await seedProgress("uW", "cW", "LW", {csd: 7, twi: 8});
  r = await COMP.composeDayQueue(db, {uid: "uW", classId: "cW", listId: "LW", logicalDay: 8,
    resetEpoch: pmAfter.resetEpoch, canonicalWords: canonW});
  checkTrue("post-takeover: engine SERVES at the new epoch", r.status === "created" || r.status === "exists");
  await db.doc("users/uW/progress_meta/LW").delete();
}

// ===========================================================================
CASE("C — presentations: claims, visits, LRT order, forced fallback");
{
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cC"], queueSize: 6, testSize: 4});
  await seedClass("cC", {students: ["uC"], listId: "LC"});
  await seedWords("LC", 12);
  await seedProgress("uC", "cC", "LC", {csd: 3, twi: 8});
  const canon = Array.from({length: 12}, (_, i) => ({wordId: `w${i}`, wordIndex: i}));
  const q = await COMP.composeDayQueue(db, {uid: "uC", classId: "cC", listId: "LC",
    logicalDay: 4, resetEpoch: 0, canonicalWords: canon});
  checkTrue("day queue up", q.status === "created");
  const idx = {}; for (const w of canon) idx[w.wordId] = w.wordIndex;
  const base = {uid: "uC", classId: "cC", listId: "LC", logicalDay: 4, resetEpoch: 0, wordIndexByWordId: idx};
  let p = await PRES.composePresentation(db, {...base, composeKey: "lap-key-0001", mode: "live-review"});
  check("live claim seq 1", [p.status, p.seq], ["created", 1]);
  check("presentationCount", (await db.doc("users/uC/review_queues/cC_LC_d4_e0").get()).data().presentationCount, 1);
  const p2 = await PRES.composePresentation(db, {...base, composeKey: "lap-key-0001", mode: "live-review"});
  check("composeKey replay", [p2.status, p2.presentationId], ["replayed", p.presentationId]);
  const p3 = await PRES.composePresentation(db, {...base, logicalDay: 3, composeKey: "lap-key-0001", mode: "live-review"});
  check("reused key ⇒ typed", p3.status, "compose_key_reused");
  check("invalid token", (await PRES.composePresentation(db, {...base, composeKey: "no!", mode: "live-review"})).status, "invalid_compose_key");
  // LRT SELECTION [M-1]: labels force a known prefix + remainder. Priority =
  // w1 (failed, unproven-since); absent-clock words first in the remainder.
  const L = db.batch();
  L.set(db.doc("users/uC/study_states/w1"), {reviewFailCount: 1, reviewLastFailedAt: TS(NOW - DAY)}, {merge: true});
  L.set(db.doc("users/uC/study_states/w0"), {reviewLastTestedAt: TS(NOW - DAY)}, {merge: true});
  await L.commit();
  const qDoc = (await db.doc("users/uC/review_queues/cC_LC_d4_e0").get()).data();
  const members = qDoc.orderedQueueWordIds.map((id) => ({wordId: id, wordIndex: idx[id],
    fc: id === "w1" ? 1 : 0, lfMs: id === "w1" ? NOW - DAY : null, lcMs: null,
    rltMs: id === "w0" ? NOW - DAY : null}));
  const comp = PRES.composeLiveReviewTest({members, testSize: 4, rng: PRES.mulberry32(1)});
  check("LRT: priority prefix present", comp.presentedWordIds.includes("w1"), true);
  check("LRT: clocked word excluded (absent-first beat it)", comp.presentedWordIds.includes("w0"), false);
  check("LRT version", comp.compositionVersion, "lrt-v1");
  // FORCED FALLBACK [L-7]: the branch is falsifiable; prefix preserved,
  // seed recorded.
  const fb = PRES.composeLiveReviewTest({members, testSize: 4, rng: PRES.mulberry32(2), _forceFallbackForTest: true});
  check("fallback engaged", [fb.compositionVersion, Number.isInteger(fb.fallbackSeed)], ["fallback-random", true]);
  check("fallback preserves prefix", fb.presentedWordIds.includes("w1"), true);
  // VISIT-BOUND rerun claims [C4]: no visit ⇒ typed; minted visit ⇒ pool =
  // FULL introduced range (positions < twi) [C2].
  let rr = await PRES.composePresentation(db, {uid: "uC", classId: "cC", listId: "LC",
    logicalDay: 2, resetEpoch: 0, composeKey: "lap-key-r001", mode: "rerun-review",
    canonicalWords: canon, testSize: 4, testType: "mcq", visitId: "ghost"});
  check("rerun without visit ⇒ typed", rr.status, "visit_invalid");
  const mv = await VIS.mintRestudyVisit(db, {uid: "uC", classId: "cC", listId: "LC", day: 2, resetEpoch: 0});
  check("visit minted (day ≤ csd)", mv.status, "visit_minted");
  const badDay = await VIS.mintRestudyVisit(db, {uid: "uC", classId: "cC", listId: "LC", day: 9, resetEpoch: 0});
  check("visit day > csd refused", [badDay.status, badDay.expectedMax], ["day_guard_rejected", 3]);
  rr = await PRES.composePresentation(db, {uid: "uC", classId: "cC", listId: "LC",
    logicalDay: 2, resetEpoch: 0, composeKey: "lap-key-r002", mode: "rerun-review",
    canonicalWords: canon, testSize: 4, testType: "mcq", visitId: mv.visitId});
  const introducedIds = canon.filter((w) => w.wordIndex < 8).map((w) => w.wordId);
  check("rerun pool = FULL introduced range", [rr.status, rr.presentation.compositionVersion,
    rr.presentation.poolHash === COMP.computePoolHash(introducedIds),
    rr.presentation.presentedWordIds.every((w) => idx[w] < 8)],
  ["created", "rerun-random", true, true]);
  const wrongDayVisit = await PRES.composePresentation(db, {uid: "uC", classId: "cC", listId: "LC",
    logicalDay: 3, resetEpoch: 0, composeKey: "lap-key-r003", mode: "rerun-review",
    canonicalWords: canon, testSize: 4, testType: "mcq", visitId: mv.visitId});
  check("visit tuple mismatch ⇒ typed", wrongDayVisit.status, "visit_invalid");
  // Counter allocator (kept): seqs 1,2 on the _r family of day 2.
  const rr2 = await PRES.composePresentation(db, {uid: "uC", classId: "cC", listId: "LC",
    logicalDay: 2, resetEpoch: 0, composeKey: "lap-key-r004", mode: "rerun-review",
    canonicalWords: canon, testSize: 4, testType: "mcq", visitId: mv.visitId});
  check("allocator seqs", [rr.seq, rr2.seq], [1, 2]);
  check("allocator next", (await db.doc("users/uC/review_counters/cC_LC_d2_e0_r").get()).data().next, 3);
}

// ===========================================================================
CASE("D — the label writer + dark zero-write (kept)");
{
  const cfgEligible = await CFG.resolveReviewConfig(db, {classId: "cC", listId: "LC"});
  const rows = [
    {wordId: "x0", isCorrect: true},
    {wordId: "x1", isCorrect: false},
    {wordId: "x2", isCorrect: false, blank: true},
  ];
  await db.runTransaction(async (txn) => {
    const r = STAMP.stampLabelsInTxn(txn, db, {uid: "uD", config: cfgEligible, rows,
      presentedWordIds: ["x0", "x1", "x2"], isReviewType: true, isPassing: true});
    check("stamped 3", r.stamped, 3);
  });
  const w0 = (await db.doc("users/uD/study_states/x0").get()).data();
  const w1 = (await db.doc("users/uD/study_states/x1").get()).data();
  check("correct fields", [Boolean(w0.reviewLastCorrectAt), Boolean(w0.reviewLastProvenAt), Boolean(w0.reviewLastTestedAt), w0.reviewFailCount ?? null], [true, true, true, null]);
  check("failed fields", [w1.reviewFailCount, Boolean(w1.reviewLastFailedAt), w1.reviewLastCorrectAt ?? null], [1, true, null]);
  const darkCfg = {...cfgEligible, stampingEligible: false};
  await db.runTransaction(async (txn) => {
    const r = STAMP.stampLabelsInTxn(txn, db, {uid: "uDark", config: darkCfg, rows,
      presentedWordIds: ["x0", "x1", "x2"], isReviewType: true, isPassing: true});
    check("dark ⇒ not_eligible", r.skipped, "not_eligible");
  });
  check("dark ⇒ no doc", (await db.doc("users/uDark/study_states/x0").get()).exists, false);
}

// ===========================================================================
CASE("F — the §9 reset callable (fence-first, owned lock, nine families)");
{
  // uC (CASE C) holds real compose_keys/presentations/counters/visits.
  const before = {};
  for (const fam of RESET.EPOCH_TAGGED_FAMILIES) {
    before[fam.collection] = (await db.collection(`users/uC/${fam.collection}`).get()).size;
  }
  checkTrue("uC has compose_keys", before.compose_keys >= 3);
  checkTrue("uC has presentations", before.review_presentations >= 2);
  const res = await call(foundation.resetProgress, "uC", {listId: "LC"});
  check("reset succeeds (v2 armed)", [res.success, res.resetV2], [true, true]);
  checkTrue("targetEpoch ≥ 1", res.targetEpoch >= 1);
  const pm = (await db.doc("users/uC/progress_meta/LC").get()).data();
  check("pm tombstone stamped", pm.resetEpoch, res.targetEpoch);
  check("owner-cleared", pm.resetInProgress ?? null, null);
  // BL-A [r71 Opus BLOCKER]: pre-P5 the fence NEVER creates list_progress —
  // the live readers prefer that doc on EXISTENCE and would freeze the
  // student at day 0 forever.
  check("BL-A: list_progress NOT created pre-P5", (await db.doc("users/uC/list_progress/LC").get()).exists, false);
  check("compose_keys swept [M-1]", res.rv2Deleted.compose_keys, before.compose_keys);
  check("presentations swept", res.rv2Deleted.review_presentations, before.review_presentations);
  check("cursors swept", (await db.collection("users/uC/review_cursors").get()).size, 0);
  // Live-lock rejection: plant a fresh lock ⇒ second reset refuses.
  await db.doc("users/uC/progress_meta/LC").set({resetInProgress: {opId: "other", at: Timestamp.now()}}, {merge: true});
  const rejected = await callErr(foundation.resetProgress, "uC", {listId: "LC"});
  check("live lock ⇒ reset_already_running", rejected, "aborted");
  // Stale lock (>10min) ⇒ takeover re-fences.
  await db.doc("users/uC/progress_meta/LC").set({resetInProgress: {opId: "stale", at: TS(NOW - 11 * 60000)}}, {merge: true});
  const takeover = await call(foundation.resetProgress, "uC", {listId: "LC"});
  check("stale lock takeover", [takeover.success, takeover.targetEpoch > res.targetEpoch], [true, true]);
  // [r72 C4] DUAL-LOCK RACE: stale pm lock + LIVE lp lock ⇒ the live lock
  // wins ⇒ reject (a stale first operand can never shadow a live second).
  await db.doc("users/uC/progress_meta/LC").set({resetInProgress: {opId: "stale2", at: TS(NOW - 11 * 60000)}}, {merge: true});
  await db.doc("users/uC/list_progress/LC").set({resetInProgress: {opId: "live2", at: Timestamp.now()}}, {merge: true});
  check("stale-pm + live-lp ⇒ reject", await callErr(foundation.resetProgress, "uC", {listId: "LC"}), "aborted");
  await db.doc("users/uC/list_progress/LC").delete();
  // [r72 CC-5] THE adjudication transform (the flag-gated callable's exact
  // live law, fixtured pure): preimage copied once, never overwritten.
  const a0 = {wordId: "w1", isCorrect: false, challengeStatus: "pending"};
  const adj1 = foundation.applyChallengeAdjudication(a0, true, "t1", Timestamp.now());
  check("preimage copied on accept", [adj1.gradedIsCorrect, adj1.isCorrect, adj1.challengeStatus], [false, true, "accepted"]);
  const adj2 = foundation.applyChallengeAdjudication(adj1, true, "t2", Timestamp.now());
  check("second adjudication never overwrites the preimage", adj2.gradedIsCorrect, false);
  const rej = foundation.applyChallengeAdjudication({wordId: "w2", isCorrect: true, challengeStatus: "pending"}, false, "t1", Timestamp.now());
  check("reject preserves grade + preimage", [rej.isCorrect, rej.gradedIsCorrect, rej.challengeStatus], [true, true, "rejected"]);
}

// ===========================================================================
CASE("E — completion authority: bindings, posture, THE ADVANCE [C1]");
{
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cE"], queueSize: 60, testSize: 30});
  await seedClass("cE", {students: ["uE"]}, );
  await db.doc("classes/cE").update({"assignments.LE": {name: "seed", weeklyPace: 50, studyDaysPerWeek: 5}});
  await seedWords("LE", 60);
  const E0 = Date.parse("2026-08-02T00:00:00Z"); // 09:00 KST — mid-day, boundary-safe
  await seedProgress("uE", "cE", "LE", {csd: 4, twi: 40});
  // The day-5 queue via THE COMPOSER (tuple from truth = t40/39).
  const canon = Array.from({length: 60}, (_, i) => ({wordId: `w${i}`, wordIndex: i}));
  const q = await COMP.composeDayQueue(db, {uid: "uE", classId: "cE", listId: "LE",
    logicalDay: 5, resetEpoch: 0, canonicalWords: canon});
  checkTrue("day-5 queue composed", q.status === "created");
  const Q = q.queue.orderedQueueWordIds;
  const presented = Q.slice(0, 30);
  await db.doc("users/uE/review_presentations/cE_LE_d5_e0_p1").set({
    uid: "uE", classId: "cE", listId: "LE", logicalDay: 5, resetEpoch: 0,
    presentedWordIds: presented, poolHash: q.queue.poolHash, compositionVersion: "lrt-v1",
    testType: "mcq", visitId: null, queueRef: q.queuePath,
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: "attE1"}, createdAt: Timestamp.now(),
  });
  const rows28 = presented.map((w, i) => [w, i < 28]);
  await seedAttempt("attE1", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "review",
    rows: rows28, score: 93, presentationId: "cE_LE_d5_e0_p1"});
  await seedAttempt("attE2", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "new",
    rows: [["w40", true]], score: 100, range: [40, 49], presentationId: "npE2"});
  await seedNewPresentation("npE2", {uid: "uE", classId: "cE", listId: "LE", day: 5,
    claimedBy: "attE2", wordIds: Array.from({length: 10}, (_, i) => `w${40 + i}`)});
  const params = {uid: "uE", winningClassId: "cE", listId: "LE", logicalDay: 5, resetEpoch: 0,
    consumedAttemptId: "attE1", consumedAttemptClassId: "cE", newTestAttemptId: "attE2",
    canonicalWordCount: 60, nowMs: E0};

  // Binding negatives FIRST (nothing minted) — via the WRAPPED public
  // callable [r72 C8]: the boundary the mint actually crosses.
  const cd = (over) => call(CALL.reviewV2CompleteDay, "uE", {classId: "cE", listId: "LE",
    logicalDay: 5, consumedAttemptId: "attE1", consumedAttemptClassId: "cE",
    newTestAttemptId: "attE2", clientContractVersion: 1, ...over});
  let r = await cd({logicalDay: 6});
  check("non-frontier refused (wrapped)", [r.status, r.expectedDay], ["day_guard_rejected", 5]);
  await seedAttempt("attWrongDay", {uid: "uE", classId: "cE", listId: "LE", day: 4, sessionType: "review",
    rows: rows28, score: 93, presentationId: "cE_LE_d5_e0_p1"});
  r = await cd({consumedAttemptId: "attWrongDay"});
  check("wrong-day evidence refused", [r.status, r.reason], ["no_evidence", "consumed attempt day mismatch"]);
  await seedAttempt("attRerun", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "new",
    rows: [["w40", true]], score: 100, range: [40, 49], type: "retest", presentationId: "npE2"});
  r = await cd({newTestAttemptId: "attRerun"});
  check("rerun-as-new refused", [r.status, r.reason], ["no_evidence", "new-test attempt not a live new test"]);
  await seedAttempt("attEpoch1", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "review",
    rows: rows28, score: 93, epoch: 1, presentationId: "cE_LE_d5_e0_p1"});
  r = await cd({consumedAttemptId: "attEpoch1"});
  check("cross-epoch refused", [r.status, r.reason], ["no_evidence", "consumed attempt epoch mismatch"]);
  await seedAttempt("attImpossible", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "review",
    rows: rows28, score: 120, presentationId: "cE_LE_d5_e0_p1"});
  r = await cd({consumedAttemptId: "attImpossible"});
  check("score-120 refused (r48 fence)", [r.status, r.reason], ["no_evidence", "impossible_record"]);
  await seedAttempt("attDisagree", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "review",
    rows: presented.map((w, i) => [w, i < 10]), score: 93, presentationId: "cE_LE_d5_e0_p1"});
  r = await cd({consumedAttemptId: "attDisagree"});
  check("score-rows disagreement refused", r.status, "no_evidence");
  // Presentation claimed by ANOTHER attempt ⇒ refused.
  await seedAttempt("attForeign", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "review",
    rows: rows28, score: 93, presentationId: "cE_LE_d5_e0_p1"});
  r = await cd({consumedAttemptId: "attForeign"});
  check("foreign claim refused", [r.status, r.reason], ["no_evidence", "presentation claimed by another attempt"]);
  // [r76 ROW 1c — Codex r75 #1] the CONSUMED engine leg's posture fence FAILS
  // CLOSED (it used to demote silently to completion_legacy). Mutated on
  // attE1 itself: any other attempt id would refuse earlier on the claim.
  const GP_OK = {effectiveEnabled: true, threshold: 92, configVersion: 1, source: "lap-seed"};
  await db.collection("attempts").doc("attE1").update({gatePosture: FieldValue.delete()});
  r = await cd({});
  check("engine consumed missing posture refused",
      [r.status, String(r.reason).includes("consumed posture")], ["no_evidence", true]);
  await db.collection("attempts").doc("attE1").update({gatePosture: {...GP_OK, configVersion: 0}});
  r = await cd({});
  check("engine consumed configVersion 0 refused",
      [r.status, String(r.reason).includes("consumed posture")], ["no_evidence", true]);
  await db.collection("attempts").doc("attE1").update({gatePosture: {effectiveEnabled: true, threshold: 92, configVersion: 1}});
  r = await cd({});
  check("engine consumed missing source refused",
      [r.status, String(r.reason).includes("consumed posture")], ["no_evidence", true]);
  await db.collection("attempts").doc("attE1").update({gatePosture: GP_OK}); // restore
  // [r77 ROW A6 — the OTHER LEG]: ENGINE evidence keeps the strict
  // COMPLETE-ROWS law; a short engine row set is an impossible record.
  await db.collection("attempts").doc("attE1").update({answers: rows28.slice(0, 20).map(([w, c]) => ({wordId: w, isCorrect: c}))});
  r = await cd({});
  checkTrue("engine consumed with SHORT rows refused",
      r.status === "no_evidence" && String(r.reason).includes("engine rows incomplete"));
  await db.collection("attempts").doc("attE1").update({answers: rows28.map(([w, c]) => ({wordId: w, isCorrect: c}))}); // restore

  // [r73 C1.3] impossible NEW-test evidence refused.
  await seedAttempt("attNewBad", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "new",
    rows: [["w40", true]], score: 77, range: [40, 49], presentationId: "npBad"});
  await seedNewPresentation("npBad", {uid: "uE", classId: "cE", listId: "LE", day: 5,
    claimedBy: "attNewBad", wordIds: ["w40"]});
  r = await cd({newTestAttemptId: "attNewBad"});
  checkTrue("impossible new-test refused", r.status === "no_evidence" && String(r.reason).includes("new-test"));
  // [r74 C1b] an ENGINE new-test with MISSING or MALFORMED posture refuses.
  await seedAttempt("attNewNoGp", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "new",
    rows: [["w40", true]], score: 100, range: [40, 49], presentationId: "npNoGp"});
  await seedNewPresentation("npNoGp", {uid: "uE", classId: "cE", listId: "LE", day: 5,
    claimedBy: "attNewNoGp", wordIds: ["w40"]});
  await db.collection("attempts").doc("attNewNoGp").update({gatePosture: FieldValue.delete()});
  r = await cd({newTestAttemptId: "attNewNoGp"});
  check("engine new-test missing posture refused", [r.status, String(r.reason).includes("posture")], ["no_evidence", true]);
  await db.collection("attempts").doc("attNewNoGp").update({gatePosture: {effectiveEnabled: true, threshold: "92", configVersion: 1}});
  r = await cd({newTestAttemptId: "attNewNoGp"});
  check("engine new-test malformed threshold refused", [r.status, String(r.reason).includes("posture")], ["no_evidence", true]);
  // [r75] the COMPLETE frozen posture shape: configVersion ≥ 1 + source.
  await db.collection("attempts").doc("attNewNoGp").update({gatePosture: {effectiveEnabled: true, threshold: 92, configVersion: 0, source: "x"}});
  r = await cd({newTestAttemptId: "attNewNoGp"});
  check("configVersion 0 refused", [r.status, String(r.reason).includes("posture")], ["no_evidence", true]);
  await db.collection("attempts").doc("attNewNoGp").update({gatePosture: {effectiveEnabled: true, threshold: 92, configVersion: 1}});
  r = await cd({newTestAttemptId: "attNewNoGp"});
  check("missing source refused", [r.status, String(r.reason).includes("posture")], ["no_evidence", true]);
  // ([r75 N-12/N-14] the legacy-leg acceptance fixtures moved to day 10 at
  // the end of this case — the OTHER-LEG rule with valid evidence would
  // otherwise complete day 5 out from under the happy-path assertions.)
  // [r74 N-5] the discriminator on the CONSUMED half: an epoch-carrying
  // review attempt WITHOUT a presentation is not valid engine evidence.
  await seedAttempt("attEngineNoP", {uid: "uE", classId: "cE", listId: "LE", day: 5, sessionType: "review",
    rows: presented.map((w, i) => [w, i < 28]), score: 93});
  r = await cd({consumedAttemptId: "attEngineNoP"});
  check("engine review without presentation refused", [r.status, r.reason], ["no_evidence", "engine review attempt lacks presentation"]);
  // [r74 O10] the queue-fence legs at submit: non-canonical path + pool-hash
  // mismatch, each typed.
  await db.doc("users/uE/review_presentations/badPathPres").set({
    uid: "uE", classId: "cE", listId: "LE", logicalDay: 5, resetEpoch: 0,
    presentedWordIds: presented, poolHash: q.queue.poolHash, compositionVersion: "lrt-v1",
    requestFingerprint: {sessionType: "review", testType: "mcq", kind: "live", visitId: null},
    testType: "mcq", visitId: null, queueRef: "users/uE/review_queues/WRONG_PATH",
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: null}, createdAt: Timestamp.now(),
  });
  r = await call(CALL.reviewV2SubmitAttempt, "uE", {presentationId: "badPathPres", answers: [], clientContractVersion: 1});
  check("non-canonical queueRef refused", [r.status, r.reason], ["queue_invalid", "non-canonical queueRef"]);
  await db.doc("users/uE/review_presentations/badPathPres").update({
    queueRef: q.queuePath, poolHash: "not-the-queue-hash"});
  r = await call(CALL.reviewV2SubmitAttempt, "uE", {presentationId: "badPathPres", answers: [], clientContractVersion: 1});
  check("pool-hash mismatch refused", [r.status, r.reason], ["queue_invalid", "pool-hash mismatch"]);

  // THE HAPPY STANDARD DAY: graduation 55, rru twins, streak, THE ADVANCE.
  r = await DONE.completeDay(db, params);
  // qe = |pinned queue| = the 40-word universe (twi bound) ⇒ floor(40×0.93)=37
  check("standard completes", [r.status, r.evidenceKind, r.graduationCount, r.correctCount], ["completed", "standard", 37, 28]);
  check("count ≡ set [M-5]", r.graduationCount, r.graduatedWordIds.length);
  check("THE ADVANCE (csd/twi in-txn)", [r.advancedToDay, r.newTwi], [5, 50]);
  const prog = (await foundation.durableProgressRef("uE", "cE", "LE").get()).data();
  check("durable ref advanced", [prog.currentStudyDay, prog.totalWordsIntroduced], [5, 50]);
  check("rru twin", (await db.doc(`users/uE/study_states/${r.graduatedWordIds[0]}`).get()).data().reviewRestingUntil.toMillis(), E0 + 21 * DAY);
  check("posture source", r.completion.postureSource, "attempt");
  // Replay: already_completed + NO double-advance.
  r = await DONE.completeDay(db, params);
  check("loser already_completed", r.status, "already_completed");
  check("no double-advance", (await foundation.durableProgressRef("uE", "cE", "LE").get()).data().currentStudyDay, 5);

  // OFF→ON LAUNDERING CLOSED [C1]: attempt stamped OFF ⇒ graduation ZERO
  // even though the gate is ON now; day still advances (R2-38 evidence).
  const q6 = await COMP.composeDayQueue(db, {uid: "uE", classId: "cE", listId: "LE",
    logicalDay: 6, resetEpoch: 0, canonicalWords: canon});
  checkTrue("day-6 queue composed", q6.status === "created");
  const pres6 = q6.queue.orderedQueueWordIds.slice(0, 30);
  await db.doc("users/uE/review_presentations/cE_LE_d6_e0_p1").set({
    uid: "uE", classId: "cE", listId: "LE", logicalDay: 6, resetEpoch: 0,
    presentedWordIds: pres6, poolHash: q6.queue.poolHash, compositionVersion: "lrt-v1",
    testType: "mcq", visitId: null, queueRef: q6.queuePath,
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: "attOff"}, createdAt: Timestamp.now(),
  });
  await seedAttempt("attOff", {uid: "uE", classId: "cE", listId: "LE", day: 6, sessionType: "review",
    rows: pres6.map((w, i) => [w, i < 28]), score: 93, presentationId: "cE_LE_d6_e0_p1", gateOn: false});
  await seedAttempt("attNew6", {uid: "uE", classId: "cE", listId: "LE", day: 6, sessionType: "new",
    rows: [["w50", true]], score: 100, range: [50, 59], presentationId: "npNew6"});
  await seedNewPresentation("npNew6", {uid: "uE", classId: "cE", listId: "LE", day: 6,
    claimedBy: "attNew6", wordIds: Array.from({length: 10}, (_, i) => `w${50 + i}`)});
  r = await DONE.completeDay(db, {...params, logicalDay: 6, consumedAttemptId: "attOff", newTestAttemptId: "attNew6", nowMs: E0 + 60000}); // same KST date as day 5
  check("OFF-source: advances, graduates ZERO", [r.status, r.graduationCount, r.completion.sourceConfig.gateEffectiveEnabled], ["completed", 0, false]);
  // Same-KST-date streak idempotency [M-1]: day 6 completed 60s after day 5.
  check("same-KST streak not double-credited", r.streakCredited, false);

  // Zero-new-words day [R2-39]: review-only ⇒ csd advances, twi HELD.
  const q7 = await COMP.composeDayQueue(db, {uid: "uE", classId: "cE", listId: "LE",
    logicalDay: 7, resetEpoch: 0, canonicalWords: canon});
  checkTrue("day-7 queue composed", q7.status === "created");
  const pres7 = q7.queue.orderedQueueWordIds.slice(0, 30);
  await db.doc("users/uE/review_presentations/cE_LE_d7_e0_p1").set({
    uid: "uE", classId: "cE", listId: "LE", logicalDay: 7, resetEpoch: 0,
    presentedWordIds: pres7, poolHash: q7.queue.poolHash, compositionVersion: "lrt-v1",
    testType: "mcq", visitId: null, queueRef: q7.queuePath,
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: "attRev7"}, createdAt: Timestamp.now(),
  });
  await seedAttempt("attRev7", {uid: "uE", classId: "cE", listId: "LE", day: 7, sessionType: "review",
    rows: pres7.map((w, i) => [w, i < 29]), score: 97, presentationId: "cE_LE_d7_e0_p1"});
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE", listId: "LE", logicalDay: 7,
    resetEpoch: 0, consumedAttemptId: "attRev7", consumedAttemptClassId: "cE",
    newTestAttemptId: null, nowMs: E0 + 2 * DAY});
  check("zero-new day: kind + twi held", [r.status, r.evidenceKind, r.newTwi], ["completed", "list_end_review_only", 60]);
  check("zero-new day: csd advanced", (await foundation.durableProgressRef("uE", "cE", "LE").get()).data().currentStudyDay, 7);
  // [r72 C2] a COMPLETED day's existing queue no longer bypasses the guard.
  r = await COMP.composeDayQueue(db, {uid: "uE", classId: "cE", listId: "LE", logicalDay: 5,
    resetEpoch: 0, canonicalWords: canon});
  check("completed-day recompose refused", [r.status, r.expectedDay], ["day_guard_rejected", 8]);
  // [r72 ON→OFF] attempt stamped ON + completion-time gate OFF ⇒ attempt-time
  // governs ⇒ graduation > 0 (the inverse of the OFF→ON case above).
  const q8 = await COMP.composeDayQueue(db, {uid: "uE", classId: "cE", listId: "LE",
    logicalDay: 8, resetEpoch: 0, canonicalWords: canon});
  checkTrue("day-8 queue composed", q8.status === "created");
  const pres8 = q8.queue.orderedQueueWordIds.slice(0, 30);
  await db.doc("users/uE/review_presentations/cE_LE_d8_e0_p1").set({
    uid: "uE", classId: "cE", listId: "LE", logicalDay: 8, resetEpoch: 0,
    presentedWordIds: pres8, poolHash: q8.queue.poolHash, compositionVersion: "lrt-v1",
    testType: "mcq", visitId: null, queueRef: q8.queuePath,
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: "attOn8"}, createdAt: Timestamp.now(),
  });
  await seedAttempt("attOn8", {uid: "uE", classId: "cE", listId: "LE", day: 8, sessionType: "review",
    rows: pres8.map((w, i) => [w, i < 28]), score: 93, presentationId: "cE_LE_d8_e0_p1", gateOn: true});
  await db.doc("classes/cE").update({"assignments.LE.reviewGateEnabled": false});
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE", listId: "LE", logicalDay: 8,
    resetEpoch: 0, consumedAttemptId: "attOn8", consumedAttemptClassId: "cE",
    newTestAttemptId: null, canonicalWordCount: 60, nowMs: E0 + 3 * DAY});
  checkTrue("ON→OFF: attempt-time governs, graduation > 0", r.status === "completed" && r.graduationCount > 0);
  await db.doc("classes/cE").update({"assignments.LE.reviewGateEnabled": true});
  // [r73 C1.2] a teacher-edited (force-passed) consumed attempt advances but
  // graduates ZERO (A1) — seeded below threshold, exempt from the fence.
  const q9 = await COMP.composeDayQueue(db, {uid: "uE", classId: "cE", listId: "LE",
    logicalDay: 9, resetEpoch: 0, canonicalWords: canon});
  checkTrue("day-9 queue composed", q9.status === "created");
  const pres9 = q9.queue.orderedQueueWordIds.slice(0, 30);
  await db.doc("users/uE/review_presentations/cE_LE_d9_e0_p1").set({
    uid: "uE", classId: "cE", listId: "LE", logicalDay: 9, resetEpoch: 0,
    presentedWordIds: pres9, poolHash: q9.queue.poolHash, compositionVersion: "lrt-v1",
    requestFingerprint: {sessionType: "review", testType: "mcq", kind: "live", visitId: null},
    testType: "mcq", visitId: null, queueRef: q9.queuePath,
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: "attForced"}, createdAt: Timestamp.now(),
  });
  await db.collection("attempts").doc("attForced").set({
    studentId: "uE", classId: "cE", listId: "LE", studyDay: 9, sessionType: "review",
    testType: "mcq", score: 60, passed: true, teacherEdited: true,
    totalQuestions: 30, answers: pres9.map((w, i) => ({wordId: w, isCorrect: i < 18})),
    resetEpoch: 0, presentationId: "cE_LE_d9_e0_p1",
    gatePosture: {effectiveEnabled: true, threshold: 92, configVersion: 1, source: "lap-seed"},
    submittedAt: Timestamp.now(),
  });
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE", listId: "LE", logicalDay: 9,
    resetEpoch: 0, consumedAttemptId: "attForced", consumedAttemptClassId: "cE",
    newTestAttemptId: null, canonicalWordCount: 60, nowMs: E0 + 4 * DAY});
  check("teacher override: ONE advance + ZERO graduation", [r.status, r.graduationCount], ["completed", 0]);
  // [r73 H-A] the advance interlock: a legacy-advanced csd makes the engine
  // completion refuse (and the legacy day-guard's own basis — csd — moved
  // under the engine's advances above; one line of advance, fixtured).
  await seedProgress("uE", "cE", "LE", {csd: 11, twi: 60});
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE", listId: "LE", logicalDay: 10,
    resetEpoch: 0, consumedAttemptId: null, consumedAttemptClassId: null,
    newTestAttemptId: null, canonicalWordCount: 60, nowMs: E0 + 5 * DAY});
  check("H-A interlock: legacy-advanced day refused", [r.status, r.expectedDay], ["day_guard_rejected", 12]);
  await seedProgress("uE", "cE", "LE", {csd: 9, twi: 60});
  // [r75 N-12/N-14 — THE LEGACY DAY, end to end]: an epoch-less posture-free
  // new-test + an epoch-less presentation-less consumed review complete a
  // day TOGETHER — 17_ §6's exemption true in code (identity/day/pass only;
  // consumed demotes to completion_legacy; NO posture refusal anywhere).
  await db.collection("attempts").doc("attLegacyNew").set({
    studentId: "uE", classId: "cE", listId: "LE", studyDay: 10, sessionType: "new",
    testType: "mcq", score: 95, passed: true, totalQuestions: 10,
    answers: Array.from({length: 8}, (_, i) => ({wordId: `w${50 + i}`, isCorrect: true})),
    newWordStartIndex: 50, newWordEndIndex: 59, submittedAt: Timestamp.now(),
  }); // DELIBERATELY DEGENERATE [r76 ROW 2c]: answered-rows(8) < totalQuestions(10),
  // no epoch, no posture. This is the RULE-PROVING case for 17_ §6's legacy
  // NEW-test leg (identity/day/pass + range only) — it exists to prove the
  // leniency is intended, not accidental.
  await db.collection("attempts").doc("attLegacyRev").set({
    studentId: "uE", classId: "cE", listId: "LE", studyDay: 10, sessionType: "review",
    testType: "mcq", score: 93, passed: true, totalQuestions: 30,
    answers: pres9.map((w, i) => ({wordId: w, isCorrect: i < 28})),
    submittedAt: Timestamp.now(),
  });
  // [r77 ROW A5 — Codex r76 #1, THE DISCRIMINATING CASE]: the consumed
  // review is the REAL legacy shape — 28 stored rows against a FULL
  // denominator of 30 with score 93 (exactly what MCQTest+index.js write
  // when a student skips two questions). Under the r76 fence this was
  // REJECTED, stranding the student; it must COMPLETE.
  await db.collection("attempts").doc("attLegacyRev").set({
    studentId: "uE", classId: "cE", listId: "LE", studyDay: 10, sessionType: "review",
    testType: "mcq", score: 93, passed: true, totalQuestions: 30, skipped: 2,
    answers: pres9.slice(0, 28).map((w) => ({wordId: w, isCorrect: true})),
    submittedAt: Timestamp.now(),
  });
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE", listId: "LE", logicalDay: 10,
    resetEpoch: 0, consumedAttemptId: "attLegacyRev", consumedAttemptClassId: "cE",
    newTestAttemptId: "attLegacyNew", canonicalWordCount: 60, nowMs: E0 + 6 * DAY});
  check("LEGACY DAY completes w/ SKIPPED ROWS (28/30, score 93)",
      [r.status, r.completion.postureSource, r.completion.legacyEvidence], ["completed", "completion_legacy", true]);
  // Day 11 legacy evidence (its own attempt — the day binding runs first).
  const legacy11 = {
    studentId: "uE", classId: "cE", listId: "LE", studyDay: 11, sessionType: "review",
    testType: "mcq", score: 93, passed: true, totalQuestions: 30, skipped: 2,
    answers: pres9.slice(0, 28).map((w) => ({wordId: w, isCorrect: true})),
    submittedAt: Timestamp.now(),
  };
  // [r77 ROW A4] an inconsistent `skipped` field refuses.
  await db.collection("attempts").doc("attLegacy11").set({...legacy11, skipped: 9});
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE", listId: "LE", logicalDay: 11,
    resetEpoch: 0, consumedAttemptId: "attLegacy11", consumedAttemptClassId: "cE",
    newTestAttemptId: null, canonicalWordCount: 60, nowMs: E0 + 7 * DAY});
  checkTrue("legacy skipped-field inconsistency refused",
      r.status === "no_evidence" && String(r.reason).includes("skipped field"));
  // [r77 ROW B2] an epoch-LESS attempt carrying a COMPLETE but CONFLICTING
  // posture still demotes — the discriminator selects authority exclusively.
  await db.collection("attempts").doc("attLegacy11").set({...legacy11,
    gatePosture: {effectiveEnabled: false, threshold: 50, configVersion: 7, source: "forged"}});
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE", listId: "LE", logicalDay: 11,
    resetEpoch: 0, consumedAttemptId: "attLegacy11", consumedAttemptClassId: "cE",
    newTestAttemptId: null, canonicalWordCount: 60, nowMs: E0 + 7 * DAY});
  check("epoch-less + complete posture ⇒ STILL completion_legacy",
      [r.status, r.completion.postureSource, r.completion.sourceConfig.gateEffectiveEnabled],
      ["completed", "completion_legacy", true]);
  await seedProgress("uE", "cE", "LE", {csd: 9, twi: 60}); // restore for the queue_invalid case
  // [r73 C5] a live-review presentation stripped of its queue ⇒ queue_invalid
  // at submit (through the WRAPPED callable).
  await db.doc("users/uE/review_presentations/cE_LE_d9_e0_p1").update({queueRef: null,
    "serverClaim.attemptDocId": null});
  r = await call(CALL.reviewV2SubmitAttempt, "uE", {presentationId: "cE_LE_d9_e0_p1",
    answers: [], clientContractVersion: 1});
  check("queue_invalid: live review without queue", [r.status, r.reason], ["queue_invalid", "live review requires a queue"]);
  // [r72 H-B] dual-class view catch-up: class 2's view syncs on already_completed.
  await seedClass("cE2", {students: ["uE"], listId: "LE"});
  await db.doc("classes/cE2").update({"assignments.LE": {name: "seed", weeklyPace: 50, studyDaysPerWeek: 5}});
  await seedConfig({rehearsalClassIds: ["cE", "cE2"]}); // the second class rehearses too
  await seedProgress("uE", "cE2", "LE", {csd: 7, twi: 60});
  // DISCRIMINATING fixture [r74 C8c/N-8]: the loser view seeds a DIVERGENT
  // (lower) twi against a day whose wordsIntroduced > 0 — the additive
  // derive would yield 45+10=55; the absolute copy must yield completedTwi.
  const done5 = (await db.doc("users/uE/day_completions/LE_d5_e0").get()).data();
  checkTrue("day-5 record carries completedTwi + wordsIntroduced>0",
      Number.isInteger(done5.completedTwi) && done5.wordsIntroduced > 0);
  await seedProgress("uE", "cE2", "LE", {csd: 4, twi: 45}); // divergent view
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE2", listId: "LE", logicalDay: 5,
    resetEpoch: 0, consumedAttemptId: null, consumedAttemptClassId: null,
    newTestAttemptId: null, canonicalWordCount: 60, nowMs: E0 + 3 * DAY});
  check("catch-up copies ABSOLUTE completedTwi (not additive)",
      [r.status, r.viewAdvanced,
        (await foundation.durableProgressRef("uE", "cE2", "LE").get()).data().totalWordsIntroduced],
      ["already_completed", true, done5.completedTwi]);
  await seedProgress("uE", "cE2", "LE", {csd: 7, twi: 60});
  r = await DONE.completeDay(db, {uid: "uE", winningClassId: "cE2", listId: "LE", logicalDay: 8,
    resetEpoch: 0, consumedAttemptId: null, consumedAttemptClassId: null,
    newTestAttemptId: null, canonicalWordCount: 60, nowMs: E0 + 3 * DAY});
  check("view catch-up on already_completed", [r.status, r.viewAdvanced], ["already_completed", true]);
  check("class-2 view advanced (no double graduation)",
      (await foundation.durableProgressRef("uE", "cE2", "LE").get()).data().currentStudyDay, 8);
}

// ===========================================================================
CASE("G — monitoring: stamps, quarantine matrix, window bounds [C7]");
{
  await db.doc("shadow_registry/0").set({generation: 7, ids: ["uShadow"]});
  MON._resetRegistryCacheForTests();
  const m1 = await MON.recordOpsMetric(db, {type: "wall_rate", uid: "uShadow", payload: {v: 1}});
  const m2 = await MON.recordOpsMetric(db, {type: "wall_rate", uid: "uReal", payload: {v: 2}});
  check("stamps", [m1.shadow, m1.registryGeneration, m2.shadow], [true, 7, false]);
  // The FULL injection matrix [C7]: G−1, G+1, unstamped.
  await db.collection("ops_metrics").add({type: "wall_rate", shadow: false, registryGeneration: 6, createdAt: Timestamp.now()});
  await db.collection("ops_metrics").add({type: "wall_rate", shadow: false, registryGeneration: 8, createdAt: Timestamp.now()});
  await db.collection("ops_metrics").add({type: "wall_rate", shadow: true, createdAt: Timestamp.now()});
  await db.doc("shadow_registry/window").set({generation: 7, startedAt: TS(Date.now() - 60000), runId: "lapG"});
  // [r73 C7] rows written DURING the window stamp its runId (fresh cache
  // view); the pre-window m1/m2 rows carry windowRunId null and are now
  // RUN-QUARANTINED — only in-window, in-run rows classify.
  MON._resetRegistryCacheForTests();
  await MON.recordOpsMetric(db, {type: "wall_rate", uid: "uShadow", payload: {v: 3}});
  await MON.recordOpsMetric(db, {type: "wall_rate", uid: "uReal", payload: {v: 4}});
  // Run-isolation negative: right generation, ANOTHER run's stamp.
  await db.collection("ops_metrics").add({type: "wall_rate", shadow: false, registryGeneration: 7,
    windowRunId: "other-run", createdAt: Timestamp.now()});
  let ev = await MON.evaluateThresholds(db, {scope: "production", dryRun: true, thresholds: {wall_rate: {max: 0}}});
  check("prod eval: gen + RUN quarantine", [ev.status, ev.consumedRowCount, ev.quarantinedRowCount, ev.breaches.length], ["ok", 1, 6, 1]);
  ev = await MON.evaluateThresholds(db, {scope: "shadowAudit", dryRun: true, thresholds: {}});
  check("audit: in-window in-run shadow only", [ev.consumedRowCount, ev.quarantinedRowCount], [1, 6]);
  // WINDOW-BOUNDED [C7]: a pre-window same-generation row never feeds it.
  await db.collection("ops_metrics").add({type: "wall_rate", shadow: false, registryGeneration: 7, createdAt: TS(Date.now() - 3600000)});
  ev = await MON.evaluateThresholds(db, {scope: "production", dryRun: true, thresholds: {}});
  check("pre-window row excluded by cutoff", ev.consumedRowCount, 1); // the in-run fresh real row
  // MALFORMED WINDOW fails CLOSED [C7/M-3].
  await db.doc("shadow_registry/window").set({generation: "seven", startedAt: Timestamp.now(), runId: "bad"});
  ev = await MON.evaluateThresholds(db, {scope: "shadowAudit", dryRun: true});
  check("audit malformed window ⇒ typed refusal", ev.status, "window_malformed");
  ev = await MON.evaluateThresholds(db, {scope: "production", dryRun: true, thresholds: {}});
  check("prod malformed window ⇒ ALL quarantined", [ev.consumedRowCount === 0, ev.quarantinedRowCount > 0], [true, true]);
  // [r72 C7] row-level NON-INTEGER generation quarantines under a valid window.
  await db.doc("shadow_registry/window").set({generation: 7, startedAt: TS(Date.now() - 60000), runId: "lapG2"});
  await db.collection("ops_metrics").add({type: "wall_rate", shadow: false, registryGeneration: "seven", createdAt: Timestamp.now()});
  ev = await MON.evaluateThresholds(db, {scope: "production", dryRun: true, thresholds: {}});
  checkTrue("non-integer ROW generation quarantined", ev.quarantinedRowCount >= 7);
  // [r72 C7] malformed startedAt fails closed too.
  await db.doc("shadow_registry/window").set({generation: 7, startedAt: "yesterday", runId: "bad2"});
  check("malformed startedAt ⇒ window_malformed", (await MON.evaluateThresholds(db, {scope: "shadowAudit", dryRun: true})).status, "window_malformed");
  // [r72 C7] the NON-DRY per-window quarantine publish.
  await db.doc("shadow_registry/window").set({generation: 7, startedAt: TS(Date.now() - 60000), runId: "lapG3"});
  await MON.evaluateThresholds(db, {scope: "production", dryRun: false, thresholds: {}});
  const qPub = await db.collection("ops_metrics").where("type", "==", "quarantined_row_count").get();
  checkTrue("quarantined_row_count published", qPub.size >= 1);
  await db.doc("shadow_registry/window").delete();
  check("audit non-dry refused", (await MON.evaluateThresholds(db, {scope: "shadowAudit", dryRun: false})).status, "invalid_scope");
  ev = await MON.evaluateThresholds(db, {scope: "shadowAudit", dryRun: true});
  check("no window ⇒ typed", ev.status, "no_audit_window");
}

// ===========================================================================
CASE("CB — THE CALLABLE BOUNDARY (firebase-functions-test) [C8]");
{
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cX"], queueSize: 6, testSize: 4});
  await seedClass("cX", {students: ["uX"], listId: "LX"});
  await seedClass("cDark", {students: ["uX"], listId: "LX"});
  await seedWords("LX", 20);
  await seedProgress("uX", "cX", "LX", {csd: 2, twi: 10});
  const common = {classId: "cX", listId: "LX", clientContractVersion: 1};
  const loadWordsX = async () => (await db.collection("lists").doc("LX").collection("words").get())
      .docs.map((d) => ({wordId: d.id, wordIndex: d.data().position}))
      .sort((a, b) => a.wordIndex - b.wordIndex);

  checkTrue("unauthenticated throws", String(await callErr(CALL.reviewV2ComposeSession, undefined, {})).includes("unauthenticated"));
  checkTrue("not enrolled ⇒ permission", String(await callErr(CALL.reviewV2ComposeSession, "uGhost", {...common, logicalDay: 3, composeKey: "lap-key-cb01"})).includes("permission"));
  let r = await call(CALL.reviewV2ComposeSession, "uX", {classId: "cDark", listId: "LX", logicalDay: 3, composeKey: "lap-key-cb02"});
  check("dark class ⇒ DATA refusal", r.status, "review_v2_dark");
  // Version fence as DATA [C5/L-3].
  await seedConfig({rehearsalClassIds: ["cX"], queueSize: 6, testSize: 4, minClientVersion: 5});
  r = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 3, composeKey: "lap-key-cb03", clientContractVersion: 4});
  check("stale client ⇒ DATA", [r.status, r.minClientVersion], ["client_version_stale", 5]);
  r = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 3, composeKey: "lap-key-cb04"});
  check("missing version ⇒ DATA stale", r.status, "client_version_stale");
  await seedConfig({rehearsalClassIds: ["cX"], queueSize: 6, testSize: 4});

  // ComposeSession happy: review-first day 3 (no day-3 new attempt exists).
  r = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 3, composeKey: "lap-key-cb05"});
  check("composed", [r.status, r.queue.orderedQueueWordIds.length, r.presentation.presentedWordIds.length], ["composed", 6, 4]);
  checkTrue("universe < twi", r.queue.orderedQueueWordIds.every((w) => parseInt(w.slice(1), 10) < 10));
  const presId = r.presentation.presentationId;
  // Non-frontier compose refused THROUGH the callable.
  r = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 9, composeKey: "lap-key-cb06"});
  check("future day via callable refused", [r.status, r.expectedDay], ["day_guard_rejected", 3]);

  // SubmitAttempt: MCQ server verdict + COMPLETE-ROWS blanks + drift.
  async function submit(pid, ans, extra = {}) {
    return call(CALL.reviewV2SubmitAttempt, "uX", {presentationId: pid, answers: ans, clientContractVersion: 1, ...extra});
  }
  const pres = (await db.doc(`users/uX/review_presentations/${presId}`).get()).data();
  const goodAnswers = pres.presentedWordIds.map((w, i) => ({
    wordId: w,
    studentResponse: i === 0 ? "" : (i === 1 ? "wrong answer" : `def${w.slice(1)}`),
  }));
  r = await submit(presId, goodAnswers);
  check("submit written", [r.status, r.replayed, r.totalQuestions], ["attempt_written", false, 4]);
  check("server verdict: blank+wrong counted", r.correctCount, 2);
  check("score server-derived", r.score, 50);
  const attDoc = (await db.collection("attempts").doc(rv2Id("uX", presId)).get()).data();
  check("COMPLETE-ROWS: blank explicit", [attDoc.answers.length, attDoc.answers[0].blank === true || attDoc.answers.some((x) => x.blank === true)], [4, true]);
  check("gatePosture stamped", attDoc.gatePosture.effectiveEnabled, true);
  // Idempotent replay: NORMALIZED envelope, zero writes.
  const r2 = await submit(presId, goodAnswers);
  check("replay normalized", [r2.status, r2.replayed, r2.score, r2.correctCount], ["attempt_written", true, 50, 2]);
  // Drift rule: unpresented word ⇒ invalid-argument.
  check("drift refused", await callErr(CALL.reviewV2SubmitAttempt, "uX",
      {presentationId: presId, answers: [{wordId: "w19", studentResponse: "x"}], clientContractVersion: 1}),
  "invalid-argument");

  // ComposeNewTest: ordinal range = the next dailyPace words after the first twi.
  r = await call(CALL.reviewV2ComposeNewTest, "uX", {...common, logicalDay: 3, composeKey: "lap-key-cb07"});
  check("new-day range", [r.status, r.presentation.rangeStartIndex, r.presentation.rangeEndIndex, r.presentation.presentedWordIds.length], ["composed", 10, 19, 10]);
  const newPresId = r.presentation.presentationId;
  const newAnswers = r.presentation.presentedWordIds.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
  r = await submit(newPresId, newAnswers);
  check("new submit: anchor stamped", [r.status, r.score], ["attempt_written", 100]);
  const newAtt = (await db.collection("attempts").doc(rv2Id("uX", newPresId)).get()).data();
  check("new attempt anchor fields", [newAtt.newWordStartIndex, newAtt.newWordEndIndex, newAtt.sessionType], [10, 19, "new"]);
  // [r72 C8] live-new label stamps, asserted BEFORE any rerun can touch the
  // word: lc+lp written, the rotation clock NOT (new tests never advance it).
  const w10Now = (await db.doc("users/uX/study_states/w10").get()).data();
  check("live-new stamps lc+lp, no clock", [Boolean(w10Now.reviewLastCorrectAt),
    Boolean(w10Now.reviewLastProvenAt), w10Now.reviewLastTestedAt ?? null], [true, true, null]);

  // CompleteDay THROUGH the callable: consumed = the review attempt (day 3
  // passed? score 50 < 92 ⇒ NOT passing — seed a passing retake first).
  const retake = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 3, composeKey: "lap-key-cb08"});
  check("retake composes new presentation", retake.status, "composed");
  const retakeAnswers = retake.presentation.presentedWordIds.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
  r = await submit(retake.presentation.presentationId, retakeAnswers);
  check("retake passes", [r.status, r.passed], ["attempt_written", true]);
  r = await call(CALL.reviewV2CompleteDay, "uX", {...common, logicalDay: 3,
    consumedAttemptId: rv2Id("uX", retake.presentation.presentationId), consumedAttemptClassId: "cX",
    newTestAttemptId: rv2Id("uX", newPresId)});
  check("completes through callable", [r.status, r.evidenceKind, r.advancedToDay, r.newTwi], ["completed", "standard", 3, 20]);
  const again = await call(CALL.reviewV2CompleteDay, "uX", {...common, logicalDay: 3,
    consumedAttemptId: rv2Id("uX", retake.presentation.presentationId), consumedAttemptClassId: "cX",
    newTestAttemptId: rv2Id("uX", newPresId)});
  check("replay ⇒ already_completed", again.status, "already_completed");

  // MintVisit + rerun through the callables (visit-bound end to end).
  r = await call(CALL.reviewV2MintVisit, "uX", {...common, day: 2});
  check("visit minted", r.status, "visit_minted");
  const vid = r.visitId;
  r = await call(CALL.reviewV2MintVisit, "uX", {...common, day: 9});
  check("future visit refused", r.status, "day_guard_rejected");
  r = await call(CALL.reviewV2ComposeRerun, "uX", {...common, visitedDay: 2, half: "review", composeKey: "lap-key-cb09", visitId: vid});
  check("rerun review composed", [r.status, r.presentation.compositionVersion], ["composed", "rerun-random"]);
  const rerunAnswers = r.presentation.presentedWordIds.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
  const rSub = await submit(r.presentation.presentationId, rerunAnswers);
  check("rerun half recorded", [rSub.status, rSub.visitHalf.recorded, rSub.visitHalf.completedVisit], ["attempt_written", true, false]);
  checkTrue("rerun graduated tested-correct", rSub.rerunGraduated.length === rerunAnswers.length);
  // TYPED modality [DF2-12 — was `typed_modality_deferred` until 18_ §4]: an
  // ALL-BLANK typed submit is graded WITHOUT ever reaching the AI (blank is
  // fail by law, R2-17) — the seam throws if a single grader call is made.
  await db.doc("classes/cX").update({"assignments.LX.reviewTestType": "typed"});
  r = await call(CALL.reviewV2ComposeRerun, "uX", {...common, visitedDay: 2, half: "review", composeKey: "lap-key-cb10", visitId: vid});
  check("typed rerun composes", r.status, "composed");
  const blankTypedPid = r.presentation.presentationId;
  TG._typedSeam.grade = async () => { throw new Error("all-blank typed submit must never call the AI grader"); };
  r = await submit(blankTypedPid, []);
  TG._typedSeam.grade = null;
  check("typed all-blank submit writes a COMPLETE all-fail sheet",
      [r.status, r.replayed, r.totalQuestions, r.correctCount, r.score], ["attempt_written", false, 4, 0, 0]);
  const blankTypedAtt = (await db.collection("attempts").doc(rv2Id("uX", blankTypedPid)).get()).data();
  check("typed blanks: rows PRESENT + explicit + server-ai provenance",
      [blankTypedAtt.answers.length, blankTypedAtt.answers.every((x) => x.blank === true && x.isCorrect === false),
        blankTypedAtt.correctnessSource, blankTypedAtt.testType], [4, true, "server-ai", "typed"]);
  await db.doc("classes/cX").update({"assignments.LX.reviewTestType": "mcq"});

  // [r72 C3] AUTHORIZATION RACES at the TXN level: removal between preflight
  // and commit refuses FROM the engine txn (typed, mints nothing).
  await db.doc("classes/cX").update({studentIds: []});
  let race = await COMP.composeDayQueue(db, {uid: "uX", classId: "cX", listId: "LX",
    logicalDay: 4, resetEpoch: 0, canonicalWords: (await loadWordsX())});
  check("un-enroll race ⇒ typed from the txn", race.status, "not_enrolled");
  await db.doc("classes/cX").update({studentIds: ["uX"]});
  const savedAsg = (await db.doc("classes/cX").get()).data().assignments;
  await db.doc("classes/cX").update({assignments: {}});
  race = await COMP.composeDayQueue(db, {uid: "uX", classId: "cX", listId: "LX",
    logicalDay: 4, resetEpoch: 0, canonicalWords: (await loadWordsX())});
  check("un-assign race ⇒ typed from the txn", race.status, "list_not_assigned");
  await db.doc("classes/cX").update({assignments: savedAsg});
  // [r72 C8] duplicate answer row through the WRAPPED callable.
  checkTrue("duplicate row refused", String(await callErr(CALL.reviewV2SubmitAttempt, "uX",
      {presentationId: presId, answers: [
        {wordId: pres.presentedWordIds[0], studentResponse: "a"},
        {wordId: pres.presentedWordIds[0], studentResponse: "b"}], clientContractVersion: 1})).includes("invalid-argument"));
  // [r72 C5] replay returns the STORED engine facts (not hard-coded nulls).
  const replay2 = await submit(presId, goodAnswers);
  check("replay engineResult stored", [replay2.replayed, replay2.stamped, Array.isArray(replay2.rerunGraduated)], [true, 4, true]);
  // [r72 C7/L-9-repaired] ops emissions through the callables:
  // rerun_graduation (the rerun submit above), priority_saturation_day
  // (all-priority compose), cursor_repaired (poisoned cursor).
  const rg = await db.collection("ops_metrics").where("type", "==", "rerun_graduation").get();
  checkTrue("rerun_graduation emitted", rg.size >= 1);
  const satBatch = db.batch();
  for (let i = 0; i < 20; i++) {
    satBatch.set(db.doc(`users/uX/study_states/w${i}`),
        {reviewFailCount: 1, reviewLastFailedAt: Timestamp.now()}, {merge: true});
  }
  await satBatch.commit();
  await db.doc("users/uX/review_cursors/LX_e0").set({uid: "uX", listId: "LX", resetEpoch: 0,
    cursorWordIndex: 2, lastLogicalDay: 99, lastQueueRef: "x", updatedAt: Timestamp.now()}, {merge: true});
  r = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 4, composeKey: "lap-key-cb12"});
  check("saturated compose ok", r.status, "composed");
  // [r74 L-8] bounded poll instead of a fixed sleep.
  let sat = null;
  for (let i = 0; i < 20; i++) {
    sat = await db.collection("ops_metrics").where("type", "==", "priority_saturation_day").get();
    if (sat.size >= 1) break;
    await new Promise((res) => setTimeout(res, 150));
  }
  checkTrue("priority_saturation_day emitted", sat.size >= 1);
  const cr = await db.collection("ops_metrics").where("type", "==", "cursor_repaired").get();
  checkTrue("cursor_repaired emitted", cr.size >= 1);

  // [r74 C8a] THE AUTHORITY RACE THROUGH THE PUBLIC BOUNDARY: preflight
  // passes, the emulator-only hook un-enrolls uX MID-CALL, the final txn
  // refuses typed — the exact preflight→txn race, on the wrapped callable.
  CALL._testHooks.afterPreflight = async () => {
    await db.doc("classes/cX").update({studentIds: []});
  };
  r = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 4, composeKey: "lap-key-cb13"});
  check("mid-call un-enroll ⇒ txn-typed refusal (public boundary)", r.status, "not_enrolled");
  await db.doc("classes/cX").update({studentIds: ["uX"]});
  // [r75 Codex-4] the un-ASSIGNMENT race through the WRAPPED callable.
  const savedAsg2 = (await db.doc("classes/cX").get()).data().assignments;
  CALL._testHooks.afterPreflight = async () => {
    await db.doc("classes/cX").update({assignments: {}});
  };
  r = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 4, composeKey: "lap-key-cb15"});
  check("mid-call un-assign ⇒ txn-typed refusal (public boundary)", r.status, "list_not_assigned");
  await db.doc("classes/cX").update({assignments: savedAsg2});
  // [r74 C8b] the stale unclaimed live-new replay + the submit frontier bind:
  // compose a live-new for the frontier, advance the frontier BEHIND it,
  // then (a) replay the same composeKey ⇒ day_guard; (b) submit ⇒ day_guard.
  await seedWords("LX", 30); // headroom — twi is 20 by now; the day-4 range needs next words
  r = await call(CALL.reviewV2ComposeNewTest, "uX", {...common, logicalDay: 4, composeKey: "lap-key-cb14"});
  check("live-new composed at frontier 4", r.status, "composed");
  const stalePresId = r.presentation.presentationId;
  await seedProgress("uX", "cX", "LX", {csd: 4, twi: 20}); // the frontier advances to 5
  r = await call(CALL.reviewV2ComposeNewTest, "uX", {...common, logicalDay: 4, composeKey: "lap-key-cb14"});
  check("stale unclaimed replay ⇒ day_guard", [r.status, r.expectedDay], ["day_guard_rejected", 5]);
  r = await submit(stalePresId, []);
  check("stale live-new submit ⇒ day_guard", [r.status, r.expectedDay], ["day_guard_rejected", 5]);
  await seedProgress("uX", "cX", "LX", {csd: 3, twi: 20}); // restore
  // [r74 L-5] a fingerprint-less (corrupt) presentation refuses typed.
  await db.doc("users/uX/review_presentations/corruptPres").set({
    uid: "uX", classId: "cX", listId: "LX", logicalDay: 4, resetEpoch: 0,
    presentedWordIds: ["w0"], poolHash: "x", compositionVersion: "lrt-v1",
    testType: "mcq", visitId: null, queueRef: null,
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: null}, createdAt: Timestamp.now(),
  });
  r = await submit("corruptPres", []);
  check("fingerprint-less presentation refused", r.status, "presentation_invalid");

  // Malformed canonical word ⇒ typed + ops signal [C5/M-7].
  await db.doc("lists/LX/words/wBad").set({word: "bad", definition: "bad"});
  r = await call(CALL.reviewV2ComposeSession, "uX", {...common, logicalDay: 4, composeKey: "lap-key-cb11"});
  check("malformed word ⇒ typed", [r.status, r.wordId], ["list_words_malformed", "wBad"]);
  const opsRows = await db.collection("ops_metrics").where("type", "==", "list_words_malformed").get();
  checkTrue("ops signal emitted", opsRows.size >= 1);
  await db.doc("lists/LX/words/wBad").delete();

  // Evaluator: admin-gated.
  check("non-admin refused", await callErr(CALL.reviewV2EvaluateThresholds, "uX", {scope: "production"}), "permission-denied");
  r = await call(CALL.reviewV2EvaluateThresholds, "uX", {scope: "production"}, {admin: true});
  check("admin eval ok", r.status, "ok");
}

// ===========================================================================
CASE("N1 — canonical position gaps: servable + surfaced");
{
  await db.doc("lists/LG/words/g0").set({word: "a", definition: "a", position: 0});
  await db.doc("lists/LG/words/g1").set({word: "b", definition: "b", position: 1});
  await db.doc("lists/LG/words/g3").set({word: "c", definition: "c", position: 3});
  const res = await CALL.loadCanonicalWordsStrict(db, "LG");
  check("gap list stays servable", [Boolean(res.words), res.words?.length], [true, 3]);
  check("gap SURFACED", [res.positionGap?.expected, res.positionGap?.got], [2, 3]);
  const dup = await db.doc("lists/LG/words/g4").set({word: "d", definition: "d", position: 3});
  const res2 = await CALL.loadCanonicalWordsStrict(db, "LG");
  checkTrue("duplicate still refuses", Boolean(res2.refusal));
}

// ===========================================================================
CASE("T — THE TYPED LEG: claim → grade → persist → write [DF2-12 · 18_ §§4-6]");
{
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cT"], queueSize: 6, testSize: 4});
  await seedClass("cT", {students: ["uT"], listId: "LT", asg: {reviewTestType: "typed"}});
  await seedWords("LT", 20);
  await seedProgress("uT", "cT", "LT", {csd: 2, twi: 10});
  const common = {classId: "cT", listId: "LT", clientContractVersion: 1};

  // THE INJECTED GRADER [18_ §6]: the AI grader CANNOT run in the emulator, so
  // the emulator-gated seam in typedGrading.js replaces gradeTypedTest's
  // Anthropic call with a deterministic verdict function. Everything AROUND it
  // is the REAL production code: the live claimOrRecoverGradingJob lease, the
  // payload cache, persistGradingJobResult's fencing, the row law, and the
  // engine's own attempt transaction. What this therefore does NOT prove: the
  // prompt, the AI's verdicts, the token spend, or gradeTypedTest's internal
  // resolution/validation of the answers we hand it.
  let graderCalls = 0;
  let graderSeen = [];
  const verdictGrader = (opts = {}) => async ({answers}) => {
    graderCalls++;
    graderSeen = answers.map((a) => a.wordId);
    return answers
        .filter((a) => !(opts.omit || []).includes(a.wordId))
        .map((a) => ({
          wordId: a.wordId,
          isCorrect: a.studentResponse === a.correctDefinition,
          reasoning: a.studentResponse === a.correctDefinition ? "" : "that is not the meaning",
        }));
  };
  TG._typedSeam.grade = verdictGrader();
  const submitT = (pid, ans) => call(CALL.reviewV2SubmitAttempt, "uT",
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const composeT = (ck) => call(CALL.reviewV2ComposeSession, "uT", {...common, logicalDay: 3, composeKey: ck});
  const answersFor = (ids) => ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
  const attemptDoc = (pid) => db.collection("attempts").doc(rv2Id("uT", pid)).get();
  const jobDoc = (pid) => db.collection("grading_jobs").doc(rv2Id("uT", pid)).get();

  // ---- 1. THE HAPPY LEG + §5.1 (the stamp set survives the round trip) ----
  let r = await composeT("lap-key-t001");
  check("typed session composes", [r.status, r.presentation.testType, r.presentation.presentedWordIds.length],
      ["composed", "typed", 4]);
  const pid1 = r.presentation.presentationId;
  const ids1 = r.presentation.presentedWordIds;
  r = await submitT(pid1, answersFor(ids1));
  check("typed submit written (server-derived score)",
      [r.status, r.replayed, r.totalQuestions, r.correctCount, r.score, r.passed],
      ["attempt_written", false, 4, 4, 100, true]);
  check("the AI was called EXACTLY once", graderCalls, 1);
  const att1 = (await attemptDoc(pid1)).data();
  check("§5.1 stamp set intact: resetEpoch · gatePosture · presentationId · queueId",
      [att1.resetEpoch, typeof att1.queueId === "string" && att1.queueId.length > 0, att1.presentationId,
        att1.gatePosture.effectiveEnabled, Number.isInteger(att1.gatePosture.configVersion),
        Number.isInteger(att1.gatePosture.threshold), att1.gatePosture.source],
      [0, true, pid1, true, true, true, "reviewV2SubmitAttempt"]);
  check("engine discriminator survives (completion.js:340 keys on resetEpoch PRESENCE)",
      att1.resetEpoch !== undefined && att1.resetEpoch !== null, true);
  check("typed provenance + modality stamped", [att1.correctnessSource, att1.testType], ["server-ai", "typed"]);
  check("§5.2 rows.length === totalQuestions", [att1.answers.length, att1.totalQuestions], [4, 4]);
  check("§5.3 NO gradedIsCorrect at grade time (the preimage is adjudication's)",
      att1.answers.some((x) => "gradedIsCorrect" in x), false);
  const j1 = await jobDoc(pid1);
  check("the grade is cached on the job", [j1.exists, j1.data().status, Array.isArray(j1.data().payload?.results)],
      [true, "graded", true]);

  // ---- 2. REPLAY: normalized envelope, ZERO new writes, ZERO metering -----
  const attBefore = await attemptDoc(pid1);
  const jobBefore = await jobDoc(pid1);
  const attemptsBefore = (await db.collection("attempts").get()).size;
  const callsBeforeReplay = graderCalls;
  const rep = await submitT(pid1, answersFor(ids1));
  check("replay ⇒ the NORMALIZED envelope",
      [rep.status, rep.replayed, rep.score, rep.correctCount, rep.totalQuestions],
      ["attempt_written", true, 100, 4, 4]);
  check("replay: ZERO extra metering (no grader call)", graderCalls, callsBeforeReplay);
  check("replay: ZERO new writes (attempt + job frozen, no new attempt docs)",
      [(await attemptDoc(pid1)).updateTime.isEqual(attBefore.updateTime),
        (await jobDoc(pid1)).updateTime.isEqual(jobBefore.updateTime),
        (await db.collection("attempts").get()).size],
      [true, true, attemptsBefore]);
  // THE DISCRIMINATING REPLAY [kills the "just re-claim the job" shortcut]:
  // the job cache is GONE (cleanup/TTL/reset). A replay that still consults the
  // grading job would now CREATE a claim (a write) and RE-GRADE (a charge).
  await db.collection("grading_jobs").doc(rv2Id("uT", pid1)).delete();
  const callsBeforeCacheless = graderCalls;
  const rep2 = await submitT(pid1, answersFor(ids1));
  check("replay with the job cache GONE: still the normalized envelope",
      [rep2.status, rep2.replayed, rep2.score], ["attempt_written", true, 100]);
  check("replay with the job cache GONE: no re-grade", graderCalls, callsBeforeCacheless);
  check("replay with the job cache GONE: no job re-claimed, attempt untouched",
      [(await jobDoc(pid1)).exists, (await attemptDoc(pid1)).updateTime.isEqual(attBefore.updateTime),
        (await db.collection("attempts").get()).size],
      [false, true, attemptsBefore]);

  // ---- 3. THE LOST RESPONSE: grade cached, worker dies, retry ⇒ cached ----
  r = await composeT("lap-key-t002");
  const pid2 = r.presentation.presentationId;
  const ids2 = r.presentation.presentedWordIds;
  TG._typedSeam.afterPersist = async () => { throw new Error("worker died after caching the grade"); };
  const died = await callErr(CALL.reviewV2SubmitAttempt, "uT",
      {presentationId: pid2, answers: answersFor(ids2), clientContractVersion: 1});
  TG._typedSeam.afterPersist = null;
  checkTrue("lost response: the worker died mid-flight", String(died).includes("worker died"));
  check("lost response: NO attempt minted", (await attemptDoc(pid2)).exists, false);
  check("lost response: the grade IS durably cached", [(await jobDoc(pid2)).exists, (await jobDoc(pid2)).data().status],
      [true, "graded"]);
  const callsAfterDeath = graderCalls;
  r = await submitT(pid2, answersFor(ids2));
  check("retry serves the CACHED grade", [r.status, r.replayed, r.score], ["attempt_written", false, 100]);
  check("retry did NOT re-grade (metering charged once)", graderCalls, callsAfterDeath);

  // ---- 4. CONCURRENT DOUBLE-SUBMIT: one grades, one gets DATA, one attempt -
  r = await composeT("lap-key-t003");
  const pid3 = r.presentation.presentationId;
  const ids3 = r.presentation.presentedWordIds;
  let release; const held = new Promise((res) => { release = res; });
  let entered; const enteredP = new Promise((res) => { entered = res; });
  const callsBeforeRace = graderCalls;
  TG._typedSeam.grade = async ({answers}) => {
    graderCalls++;
    entered();
    await held; // hold the lease while the second submit races in
    return answers.map((a) => ({wordId: a.wordId, isCorrect: true, reasoning: ""}));
  };
  const inflight = submitT(pid3, answersFor(ids3));
  await enteredP;
  const second = await submitT(pid3, answersFor(ids3));
  check("§5.5 concurrent submit ⇒ grading_in_progress as DATA", second, {status: "grading_in_progress"});
  check("§5.5 the concurrent submit wrote NOTHING", (await attemptDoc(pid3)).exists, false);
  release();
  const first = await inflight;
  check("the lease holder wins the write", [first.status, first.replayed], ["attempt_written", false]);
  check("exactly ONE attempt for the presentation",
      (await db.collection("attempts").where("presentationId", "==", pid3).get()).size, 1);
  check("two submits, ONE grade", graderCalls, callsBeforeRace + 1);
  TG._typedSeam.grade = verdictGrader();

  // ---- 5. UNGRADEABLE ⇒ PRESENT + INCORRECT, row count WHOLE [§5.2] -------
  r = await composeT("lap-key-t004");
  const pid4 = r.presentation.presentationId;
  const [wBlank, wGood, wNoDoc, wNoVerdict] = r.presentation.presentedWordIds;
  const savedWord = (await db.doc(`lists/LT/words/${wNoDoc}`).get()).data();
  await db.doc(`lists/LT/words/${wNoDoc}`).delete(); // canonical word vanishes AFTER composition
  TG._typedSeam.grade = verdictGrader({omit: [wNoVerdict]}); // the AI skips a row
  const callsBeforeUngradeable = graderCalls;
  r = await submitT(pid4, [
    {wordId: wBlank, studentResponse: "   "},
    {wordId: wGood, studentResponse: `def${wGood.slice(1)}`},
    {wordId: wNoDoc, studentResponse: "a genuine attempt at the meaning"},
    {wordId: wNoVerdict, studentResponse: `def${wNoVerdict.slice(1)}`},
  ]);
  check("ungradeable answers keep the row count WHOLE",
      [r.status, r.totalQuestions, r.correctCount, r.score], ["attempt_written", 4, 1, 25]);
  const att4 = (await attemptDoc(pid4)).data();
  const by4 = Object.fromEntries(att4.answers.map((x) => [x.wordId, x]));
  check("rows.length === totalQuestions (no dropped row)", [att4.answers.length, att4.totalQuestions], [4, 4]);
  check("blank ⇒ PRESENT, explicit, incorrect [R2-17]", [by4[wBlank].blank, by4[wBlank].isCorrect], [true, false]);
  check("no canonical word ⇒ PRESENT + incorrect + flagged",
      [by4[wNoDoc].ungradeable, by4[wNoDoc].isCorrect], [true, false]);
  check("no AI verdict ⇒ PRESENT + incorrect + flagged",
      [by4[wNoVerdict].ungradeable, by4[wNoVerdict].isCorrect], [true, false]);
  check("only GRADEABLE rows were sent to the AI (blanks/unresolvable never charged)",
      [...graderSeen].sort(), [wGood, wNoVerdict].sort());
  check("one grader call for the mixed sheet", graderCalls, callsBeforeUngradeable + 1);
  await db.doc(`lists/LT/words/${wNoDoc}`).set(savedWord);
  TG._typedSeam.grade = verdictGrader();

  // ---- 6. THE PREIMAGE LAW [§5.3]: first adjudication wins, forever -------
  const flipIdx = att4.answers.findIndex((x) => x.wordId === wNoDoc);
  check("the first adjudication mints the preimage from the CURRENT grade",
      STAMP.gradingPreimageWrites(att4.answers, [flipIdx]), [{index: flipIdx, gradedIsCorrect: false}]);
  const adjudicated = att4.answers.map((x, i) => (i === flipIdx
    ? {...x, gradedIsCorrect: false, isCorrect: true, challengeStatus: "accepted"} : x));
  await db.collection("attempts").doc(rv2Id("uT", pid4)).update({answers: adjudicated});
  const replay4 = await submitT(pid4, [
    {wordId: wBlank, studentResponse: "   "},
    {wordId: wGood, studentResponse: `def${wGood.slice(1)}`},
    {wordId: wNoDoc, studentResponse: "a genuine attempt at the meaning"},
    {wordId: wNoVerdict, studentResponse: `def${wNoVerdict.slice(1)}`},
  ]);
  check("a re-submit after adjudication REPLAYS (never re-grades)",
      [replay4.status, replay4.replayed], ["attempt_written", true]);
  const att4b = (await attemptDoc(pid4)).data();
  check("the adjudicated row + its preimage SURVIVE the typed replay (no laundering)",
      [att4b.answers[flipIdx].isCorrect, att4b.answers[flipIdx].gradedIsCorrect], [true, false]);
  check("a second adjudication writes NO new preimage (append-only)",
      STAMP.gradingPreimageWrites(att4b.answers, [flipIdx]), []);

  // ---- 7. A GRADE THAT NEVER LANDS: refused, cached-out, NOT stranded -----
  r = await composeT("lap-key-t005");
  const pid5 = r.presentation.presentationId;
  const ids5 = r.presentation.presentedWordIds;
  // Another worker takes the lease over WHILE we grade and then itself dies
  // (the takeover lease is left EXPIRED) ⇒ our persist is `superseded` ⇒ we
  // never established authority ⇒ fail-CLOSED: no attempt, typed DATA refusal.
  TG._typedSeam.grade = async ({answers}) => {
    graderCalls++;
    await db.collection("grading_jobs").doc(rv2Id("uT", pid5))
        .set({leaseId: "another-worker", leaseExpiresAt: Date.now() - 1000}, {merge: true});
    return answers.map((a) => ({wordId: a.wordId, isCorrect: true, reasoning: ""}));
  };
  r = await submitT(pid5, answersFor(ids5));
  check("a superseded grade is FAIL-CLOSED as DATA", r, {status: "grading_in_progress"});
  check("a superseded grade mints NO attempt", (await attemptDoc(pid5)).exists, false);
  const noEv = await call(CALL.reviewV2CompleteDay, "uT", {...common, logicalDay: 3,
    consumedAttemptId: rv2Id("uT", pid5), consumedAttemptClassId: "cT", newTestAttemptId: null});
  check("completion refuses the never-landed grade as no_evidence",
      [noEv.status, noEv.reason], ["no_evidence", "consumed attempt missing"]);
  TG._typedSeam.grade = verdictGrader();
  r = await submitT(pid5, answersFor(ids5));
  check("the student is NOT stranded: the expired lease is reclaimed and the test lands",
      [r.status, r.replayed, r.score], ["attempt_written", false, 100]);

  // ---- 8. THE TYPED DAY COMPLETES on engine evidence ----------------------
  const nt = await call(CALL.reviewV2ComposeNewTest, "uT", {...common, logicalDay: 3, composeKey: "lap-key-t006"});
  check("typed NEW test composes", [nt.status, nt.presentation.testType, nt.presentation.presentedWordIds.length],
      ["composed", "typed", 10]);
  const npid = nt.presentation.presentationId;
  r = await submitT(npid, answersFor(nt.presentation.presentedWordIds));
  check("typed NEW submit written", [r.status, r.score, r.passed], ["attempt_written", 100, true]);
  const newAtt = (await attemptDoc(npid)).data();
  check("typed new attempt keeps the anchor range + engine stamps",
      [newAtt.newWordStartIndex, newAtt.newWordEndIndex, newAtt.resetEpoch, newAtt.correctnessSource],
      [10, 19, 0, "server-ai"]);
  const done = await call(CALL.reviewV2CompleteDay, "uT", {...common, logicalDay: 3,
    consumedAttemptId: rv2Id("uT", pid1), consumedAttemptClassId: "cT", newTestAttemptId: rv2Id("uT", npid)});
  check("THE TYPED DAY COMPLETES (engine evidence, attempt-time posture)",
      [done.status, done.evidenceKind, done.completion.postureSource, done.advancedToDay, done.newTwi],
      ["completed", "standard", "attempt", 3, 20]);

  // ---- 9. METERING SURFACE ------------------------------------------------
  // There is NO live ai_metering writer in functions/ (15_ H6 schedules it for
  // the claim txn; grep: zero writers today), so "charged once" is asserted as
  // (a) the grader-call counts above and (b) the engine writing no metering doc.
  check("the typed leg writes NO ai_metering doc", (await db.collection("ai_metering").get()).size, 0);
  TG._typedSeam.grade = null;
  TG._typedSeam.afterPersist = null;
}

// ===========================================================================
CASE("GR — THE rv2_ MOUTH GUARD, PINNED INSIDE THE DEPLOY-CERT LAP [NTF 19+22 · index.js:1170-1171]");
{
  // WHY THIS CASE EXISTS. CASE TX/TS/RC below were built BEFORE
  // `assertNotEngineReservedDocId` existed, and reached the engine's OWN
  // rv2_-prefixed grading-job key through the LIVE gradeTypedTest callable —
  // a REAL pre-guard production path (index.js:1048-1051, then). The guard
  // (functions/index.js:390-395, applied at BOTH mouths of gradeTypedTest at
  // index.js:1170-1171) now refuses that call UNCONDITIONALLY, for every
  // caller (owner, third party, teacher) alike, BEFORE any grading-job
  // claim/read/write — which is exactly what turned those three fixtures'
  // stale calls into an UNCAUGHT crash of this lap (they expected the call
  // to SUCCEED). This case is the harness-repair brief's ONE new adversarial
  // assertion: it catches the refusal instead of crashing on it, pinning the
  // guard here in the deploy-certification lap itself — in addition to, not
  // instead of, the dedicated namespace-reservation-emulator.mjs fixture
  // (G3-DENY-GRADECTX/WRITECTX), which already covers this guard
  // exhaustively but is a separate gate item that can be skipped or drift
  // out of the certification lap unnoticed.
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cGR"], queueSize: 6, testSize: 4});
  await seedClass("cGR", {students: ["uGR"], listId: "LGR", asg: {reviewTestType: "typed"}});
  await seedWords("LGR", 20);
  await seedProgress("uGR", "cGR", "LGR", {csd: 2, twi: 10});
  const rGR = await call(CALL.reviewV2ComposeSession, "uGR",
      {classId: "cGR", listId: "LGR", clientContractVersion: 1, logicalDay: 3, composeKey: "lap-key-gr01"});
  check("GR setup: typed session composes", [rGR.status, rGR.presentation.testType], ["composed", "typed"]);
  const pidGR = rGR.presentation.presentationId;
  const idsGR = rGR.presentation.presentedWordIds;
  const reservedKeyGR = rv2Id("uGR", pidGR); // the engine's OWN derivation — the exact reserved shape
  const answersGR = idsGR.map((w) => ({wordId: w, word: `word${w.slice(1)}`,
    correctDefinition: `def${w.slice(1)}`, studentResponse: `def${w.slice(1)}`}));

  let threwG = null;
  try {
    await call(INDEX.gradeTypedTest, "uGR",
        {answers: answersGR, gradeContext: {attemptDocId: reservedKeyGR, classId: "cGR", listId: "LGR"}});
  } catch (e) { threwG = e; }
  checkTrue("GR a CLIENT-shaped call naming its OWN rv2_ key via gradeContext is REFUSED, not accepted",
      threwG !== null);
  check("GR refused with the EXACT guard error (invalid-argument + the reserved-prefix message)",
      [threwG?.code ?? null,
        /gradeContext\.attemptDocId may not use the server-reserved rv2_ document-id prefix/
            .test(String(threwG?.message ?? ""))],
      ["invalid-argument", true]);
  check("GR NO grading_job was claimed at the reserved key (refused before any read/claim/write)",
      (await db.collection("grading_jobs").doc(reservedKeyGR).get()).exists, false);
  check("GR NO attempt exists at the reserved key either",
      (await db.collection("attempts").doc(reservedKeyGR).get()).exists, false);

  // The sibling field [index.js:1170-1171 guards BOTH]: writeContext.attemptDocId
  // must refuse identically — the guard was added for exactly this reason (a
  // prior round guarded only the branch a reviewer named; the defect was the
  // un-guarded sibling).
  let threwW = null;
  try {
    await call(INDEX.gradeTypedTest, "uGR", {
      answers: answersGR,
      writeContext: {attemptDocId: reservedKeyGR, classId: "cGR", listId: "LGR",
        testId: "t1", testType: "typed", totalQuestions: idsGR.length},
    });
  } catch (e) { threwW = e; }
  check("GR the sibling field (writeContext.attemptDocId) is refused identically",
      [threwW?.code ?? null,
        /writeContext\.attemptDocId may not use the server-reserved rv2_ document-id prefix/
            .test(String(threwW?.message ?? ""))],
      ["invalid-argument", true]);
  check("GR the sibling refusal ALSO writes nothing",
      (await db.collection("attempts").doc(reservedKeyGR).get()).exists, false);
}

// ===========================================================================
CASE("TX — THE POISONED GRADE CACHE: provenance + answer-sheet binding [A1/A2]");
{
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cP"], queueSize: 6, testSize: 4});
  await seedClass("cP", {students: ["uP", "uOther"], listId: "LP", asg: {reviewTestType: "typed"}});
  await seedWords("LP", 30);
  await seedProgress("uP", "cP", "LP", {csd: 2, twi: 10});
  await seedProgress("uOther", "cP", "LP", {csd: 2, twi: 10});
  await db.doc("users/uTeach").set({role: "teacher", displayName: "T"});
  const common = {classId: "cP", listId: "LP", clientContractVersion: 1};

  // THE ENGINE'S grader (the emulator-only seam, as CASE T).
  let engineGraderCalls = 0;
  TG._typedSeam.grade = async ({answers}) => {
    engineGraderCalls++;
    return answers.map((a) => ({
      wordId: a.wordId,
      isCorrect: a.studentResponse === a.correctDefinition,
      reasoning: a.studentResponse === a.correctDefinition ? "" : "that is not the meaning",
    }));
  };

  // [SUPERSEDED MECHANISM — NTF 19+22, CASE GR above pins the replacement]
  // C1/C2/C4/C6 below used to attack via THE REAL ROUTE: `INDEX.gradeTypedTest`
  // wrapped exactly like every other callable here, with ONLY the Anthropic
  // HTTP call canned, reaching the engine's OWN rv2_ key through the LIVE
  // production path 947 students hit THEN (the client-supplied
  // `gradeContext.attemptDocId` becoming the job key, index.js:1048-1051
  // pre-guard). `assertNotEngineReservedDocId` (index.js:1170-1171) now
  // refuses that call UNCONDITIONALLY before claimOrRecoverGradingJob is ever
  // reached — so the live-route attacker helper (`liveGrade`/`liveGradeErr`)
  // and the Anthropic HTTP stub it alone exercised are both gone from this
  // case. What C1/C4/C6 certify about `usableCachedResults`/the job's `uid`
  // fence — a poisoned/foreign-uid payload at my key is refused, however it
  // got there — is unchanged and still matters for the residual reachability
  // (Admin SDK / a pre-existing doc, per typedGrading.js's own A1/A2 header),
  // so those cases now seed the SAME resulting `grading_jobs` state directly
  // instead of driving it through the (now-refused) callable. C2's SPECIFIC
  // property had no such residual path and is retired with a comment in
  // place, below.
  const composeP = (ck) => call(CALL.reviewV2ComposeSession, "uP", {...common, logicalDay: 3, composeKey: ck});
  const submitP = (pid, ans, uid = "uP") => call(CALL.reviewV2SubmitAttempt, uid,
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const submitErrP = (pid, ans, uid = "uP") => callErr(CALL.reviewV2SubmitAttempt, uid,
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const good = (ids) => ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
  const junk = (ids) => ids.map((w) => ({wordId: w, studentResponse: "not the meaning at all"}));
  const jobOf = (pid) => db.collection("grading_jobs").doc(rv2Id("uP", pid)).get();
  const attOf = (pid) => db.collection("attempts").doc(rv2Id("uP", pid)).get();
  const attemptCount = async () => (await db.collection("attempts").get()).size;
  /** Seed a `grading_jobs` doc byte-shaped like what the (now-refused) live
   *  route used to leave behind: status graded, the named uid, a bare
   *  `results` array carrying NONE of the three engine-provenance facts. */
  const seedForeignJob = (jobKey, uid, ids) => db.collection("grading_jobs").doc(jobKey).set({
    uid, status: "graded", version: 1,
    payload: {results: ids.map((w) => ({wordId: w, isCorrect: true, reasoning: ""}))},
  });
  const metaFor = async (ids) => {
    const snaps = await db.getAll(...ids.map((w) => db.doc(`lists/LP/words/${w}`)));
    return new Map(snaps.filter((s) => s.exists).map((s) => [s.id, s.data()]));
  };
  /** The ONLY legitimate way a cache outlives its submit: the engine grades and
   *  caches, then the worker dies before the attempt write [CASE T-3]. */
  const cacheThenDie = async (pid, ans) => {
    TG._typedSeam.afterPersist = async () => { throw new Error("worker died after caching the grade"); };
    const e = await submitErrP(pid, ans);
    TG._typedSeam.afterPersist = null;
    return e;
  };

  // ---- C1 · POISONED BEFORE THE SUBMIT — THE BLOCKER, END TO END ----------
  let r = await composeP("lap-key-tx01");
  check("typed session composes", [r.status, r.presentation.testType], ["composed", "typed"]);
  const pid1 = r.presentation.presentationId;
  const ids1 = r.presentation.presentedWordIds;
  await seedForeignJob(rv2Id("uP", pid1), "uP", ids1);
  const j1 = await jobOf(pid1);
  check("…and CACHED it on the engine's key (owned by the caller, status graded)",
      [j1.exists, j1.data().status, j1.data().uid], [true, "graded", "uP"]);
  // V3, RE-VERIFIED AT RUNTIME: the payload the LIVE route writes satisfies the
  // PRE-FIX acceptance test verbatim — `Array.isArray(payload.results)` was the
  // engine's ENTIRE check (typedGrading.js:102-104 before this fold).
  const p1 = j1.data().payload;
  check("PRE-FIX PROOF (1/3): the poisoned payload passes the OLD acceptance test",
      Array.isArray(p1.results), true);
  check("PRE-FIX PROOF (2/3): it carries NONE of the three facts now demanded",
      [p1.source ?? null, p1.presentationId ?? null, p1.answerSheetKey ?? null], [null, null, null]);
  // …and the engine's OWN row builder (unchanged by this fold) turns it into a
  // perfect graduation-bearing sheet for answers the student never wrote.
  const preFixRows = TG.buildTypedRows({
    presentedWordIds: ids1,
    submitted: new Map(ids1.map((w) => [w, "not the meaning at all"])),
    wordMetaById: await metaFor(ids1),
    results: p1.results,
  });
  check("PRE-FIX PROOF (3/3): the real row builder + the foreign grade = a 100% sheet",
      [preFixRows.length, preFixRows.every((x) => x.isCorrect === true)], [ids1.length, true]);
  // THE FIX: the same poisoned cache, the same submit ⇒ refusal, ZERO writes.
  const attemptsBeforeC1 = await attemptCount();
  const callsBeforeC1 = engineGraderCalls;
  r = await submitP(pid1, junk(ids1));
  check("C1 poisoned-before-submit ⇒ refused as TERMINAL data (grade_unusable: recompose, never poll)",
      r, {status: "grade_unusable"});
  check("C1 ⇒ ZERO attempt writes", [(await attOf(pid1)).exists, await attemptCount()],
      [false, attemptsBeforeC1]);
  check("C1 ⇒ ZERO engine grader spend", engineGraderCalls, callsBeforeC1);
  // NOT STRANDED: the key is uid-fenced, so the poison is self-inflicted, and a
  // recompose is a new presentationId ⇒ a new job key.
  r = await composeP("lap-key-tx02");
  const recovered = await submitP(r.presentation.presentationId, good(r.presentation.presentedWordIds));
  check("C1 other leg: the student recovers by recomposing (new key)",
      [recovered.status, recovered.score], ["attempt_written", 100]);

  // ---- C2 · POISON AFTER THE ENGINE CACHED — RETIRED, NTF 19+22 -----------
  // [SUPERSEDED, no current-contract equivalent] This sub-case certified that
  // a LIVE grade-only gradeTypedTest call targeting an ALREADY-GRADED job at
  // the engine's rv2_ key hits claimOrRecoverGradingJob's `return_cached`
  // branch (index.js:1062-1064) rather than re-grading or overwriting it.
  // That reachability is now categorically gone: gradeContext.attemptDocId
  // = rv2_... is refused at the mouth (index.js:1170-1171, CASE GR above)
  // BEFORE claimOrRecoverGradingJob is ever reached, for any caller — and the
  // ONLY other production caller of that function is the engine's own
  // server-derived resolveTypedGrade, whose SAME-key `return_cached` reuse is
  // already certified through the legitimate path by CASE TX C7 (lost-
  // response retry) and CASE T §2-3, so re-deriving it here would just
  // duplicate them under a different label, not certify anything new. Nothing
  // uniquely certified by this sub-case is lost.

  // ---- C4 · poison → refuse → DELETE the job → re-poison → still refuses --
  // (poisoning mechanism superseded — see the note above C1)
  r = await composeP("lap-key-tx04");
  const pid4 = r.presentation.presentationId;
  const ids4 = r.presentation.presentedWordIds;
  await seedForeignJob(rv2Id("uP", pid4), "uP", ids4);
  r = await submitP(pid4, junk(ids4));
  check("C4 step 1: poisoned ⇒ refused as grade_unusable", r, {status: "grade_unusable"});
  await db.collection("grading_jobs").doc(rv2Id("uP", pid4)).delete();
  await seedForeignJob(rv2Id("uP", pid4), "uP", ids4);
  r = await submitP(pid4, junk(ids4));
  check("C4 step 2: delete-then-RE-poison ⇒ still refused as grade_unusable", r, {status: "grade_unusable"});
  check("C4 the sequence minted nothing", (await attOf(pid4)).exists, false);
  await db.collection("grading_jobs").doc(rv2Id("uP", pid4)).delete();
  r = await submitP(pid4, good(ids4));
  check("C4 other leg: with the poison gone the engine grades and lands",
      [r.status, r.score], ["attempt_written", 100]);

  // ---- C5 · CROSS-PRESENTATION REPLAY ------------------------------------
  r = await composeP("lap-key-tx05");
  const pid5a = r.presentation.presentationId;
  const ids5a = r.presentation.presentedWordIds;
  await submitP(pid5a, good(ids5a));
  const payload5a = (await jobOf(pid5a)).data().payload;
  r = await composeP("lap-key-tx06");
  const pid5b = r.presentation.presentationId;
  const ids5b = r.presentation.presentedWordIds;
  // (i) the whole engine-authored payload for P1, offered under P2's key.
  await db.collection("grading_jobs").doc(rv2Id("uP", pid5b)).set({
    uid: "uP", status: "graded", payload: payload5a, version: 1,
  });
  r = await submitP(pid5b, good(ids5b));
  check("C5(i) another presentation's engine grade ⇒ refused as grade_unusable", r, {status: "grade_unusable"});
  // (ii) the ISOLATING variant: engine provenance AND the correct sheet key for
  //      THIS submit, only `presentationId` foreign — so ONLY clause (b) fires.
  const sheet5b = TG.answerSheetKey({
    presentedWordIds: ids5b,
    submitted: new Map(good(ids5b).map((a) => [a.wordId, a.studentResponse])),
  });
  await db.collection("grading_jobs").doc(rv2Id("uP", pid5b)).set({
    uid: "uP", status: "graded", version: 1,
    payload: {results: ids5b.map((w) => ({wordId: w, isCorrect: true})),
      source: "reviewV2", presentationId: pid5a, answerSheetKey: sheet5b},
  });
  r = await submitP(pid5b, good(ids5b));
  check("C5(ii) right sheet + right provenance, WRONG presentation ⇒ refused as grade_unusable",
      r, {status: "grade_unusable"});
  check("C5 minted nothing", (await attOf(pid5b)).exists, false);
  // (iii) the same payload with presentationId CORRECTED is accepted — the
  //       clause is the ONLY thing that refused above (a negative control).
  await db.collection("grading_jobs").doc(rv2Id("uP", pid5b)).set({
    uid: "uP", status: "graded", version: 1,
    payload: {results: ids5b.map((w) => ({wordId: w, isCorrect: true})),
      source: "reviewV2", presentationId: pid5b, answerSheetKey: sheet5b},
  });
  const callsBeforeC5 = engineGraderCalls;
  r = await submitP(pid5b, good(ids5b));
  check("C5(iii) NEGATIVE CONTROL: correct presentationId ⇒ reused, zero grader calls",
      [r.status, r.score, engineGraderCalls], ["attempt_written", 100, callsBeforeC5]);

  // ---- C6 · A THIRD PARTY / A TEACHER CLAIMING THE KEY --------------------
  // The presentationId is DERIVABLE (`{classId}_{listId}_d{day}_e{epoch}_p{n}`,
  // presentations.js:445), and `grading_jobs` is a GLOBAL collection — so the
  // key is NAMEABLE by anyone. NOTE THE SEEDED KEY BELOW: it is the VICTIM's
  // FULL uid-scoped key `rv2_{uP}_{pid}` [rv2-docid-collision A1]. The uid in
  // the key is a NAMESPACE, not a fence — a classmate knows uP's uid, so
  // scoping the id fixes the collision and grants no secrecy. The uid fence
  // that must hold is the job's `uid` FIELD (index.js:936-938); it is
  // asserted here, never assumed. [SUPERSEDED MECHANISM — NTF 19+22, see the
  // note above C1] a third party/teacher can no longer CLAIM this key through
  // the live route at all (refused at the mouth, CASE GR above) — the job
  // document is seeded directly to exercise the DOWNSTREAM fence, which is
  // unchanged and still the thing that must hold.
  r = await composeP("lap-key-tx07");
  const pid6 = r.presentation.presentationId;
  const ids6 = r.presentation.presentedWordIds;
  await seedForeignJob(rv2Id("uP", pid6), "uOther", ids6);
  const j6 = (await jobOf(pid6)).data();
  check("C6 the seeded job at the victim's key names the THIRD PARTY's uid", j6.uid, "uOther");
  const errThird = await submitErrP(pid6, good(ids6));
  checkTrue("C6 the victim's submit refuses a foreign-uid job (fail-CLOSED, never consumed)",
      String(errThird).includes("permission-denied"));
  check("C6 …and mints nothing", (await attOf(pid6)).exists, false);
  // NEED_TO_FIX 19's denial, made RECOVERABLE [rv2-refusal-status]: the victim
  // is never told to poll (the refusal is a thrown HttpsError, not
  // grading_in_progress), and recomposing — a new presentationId ⇒ a new job
  // key the foreign job never touched — lands the test.
  r = await composeP("lap-key-tx07b");
  const recovered6 = await submitP(r.presentation.presentationId, good(r.presentation.presentedWordIds));
  check("C6 recovery: the victim recomposes past the third-party claim and LANDS",
      [recovered6.status, recovered6.score], ["attempt_written", 100]);
  // The same fence, exercised by a TEACHER account (identity, not role).
  r = await composeP("lap-key-tx08");
  const pid6t = r.presentation.presentationId;
  const ids6t = r.presentation.presentedWordIds;
  await seedForeignJob(rv2Id("uP", pid6t), "uTeach", ids6t);
  check("C6 the seeded job names the TEACHER's uid",
      (await jobOf(pid6t)).data().uid, "uTeach");
  const errTeacher = await submitErrP(pid6t, good(ids6t));
  checkTrue("C6 a teacher-poisoned key is refused too",
      String(errTeacher).includes("permission-denied"));
  check("C6 …and mints nothing", (await attOf(pid6t)).exists, false);
  r = await composeP("lap-key-tx08b");
  const recovered6t = await submitP(r.presentation.presentationId, good(r.presentation.presentedWordIds));
  check("C6 recovery: …and past the teacher claim too",
      [recovered6t.status, recovered6t.score], ["attempt_written", 100]);
  // [SUPERSEDED, no current-contract equivalent] "the mirror" used to prove a
  // foreign uid (uOther) READING/claiming uP's ALREADY-GRADED job via the
  // live route ALSO hits the same permission-denied fence. That direction is
  // now unreachable through ANY client-facing callable: reaching
  // claimOrRecoverGradingJob for an rv2_ key requires naming it via
  // gradeContext/writeContext (refused at the mouth, CASE GR above), and the
  // engine's own resolveTypedGrade always derives the key from the CALLER's
  // OWN uid, so it can never address another uid's key by accident either.
  // The uid fence itself is still exercised, both directions, above and in
  // CASE RC's third-party block — only this SPECIFIC reachability path
  // (a foreign caller reading via the live grade-only route) is gone.

  // ---- C7 · THE OTHER LEG: the LEGITIMATE lost-response replay ------------
  r = await composeP("lap-key-tx09");
  const pid7 = r.presentation.presentationId;
  const ids7 = r.presentation.presentedWordIds;
  const died7 = await cacheThenDie(pid7, good(ids7));
  checkTrue("C7 setup: the worker died after caching", String(died7).includes("worker died"));
  check("C7 setup: no attempt, but the grade IS cached with provenance",
      [(await attOf(pid7)).exists, (await jobOf(pid7)).data().payload.source,
        (await jobOf(pid7)).data().payload.presentationId], [false, "reviewV2", pid7]);
  const callsBeforeC7 = engineGraderCalls;
  r = await submitP(pid7, good(ids7));
  check("C7 THE OTHER LEG: the retry REUSES the cached grade", [r.status, r.score], ["attempt_written", 100]);
  check("C7 …with ZERO grader calls (the whole point of the cache)", engineGraderCalls, callsBeforeC7);
  // …and the same, through WHITESPACE drift (the normalisation leg): a client
  // that trims on retry must not fail closed.
  r = await composeP("lap-key-tx10");
  const pid7b = r.presentation.presentationId;
  const ids7b = r.presentation.presentedWordIds;
  await cacheThenDie(pid7b, ids7b.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`})));
  const callsBeforeWs = engineGraderCalls;
  r = await submitP(pid7b, ids7b.map((w) => ({wordId: w, studentResponse: `  def${w.slice(1)}  `})));
  check("C7 whitespace drift still REUSES (trim/collapse is not identity)",
      [r.status, r.score, engineGraderCalls], ["attempt_written", 100, callsBeforeWs]);

  // ---- C11 · ANSWER-SHEET DRIFT, one fixture per way a sheet can move -----
  //  Each starts from a REAL engine-written cache (worker died), then submits a
  //  drifted sheet. Only the sheet clause can refuse these: provenance and
  //  presentation are correct by construction.
  const driftCase = async (label, ck, mutate, want, baseFn = null) => {
    const c = await composeP(ck);
    const pid = c.presentation.presentationId;
    const ids = c.presentation.presentedWordIds;
    const all = ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
    const base = baseFn ? baseFn(all, ids) : all;
    await cacheThenDie(pid, base);
    const before = engineGraderCalls;
    const res = await submitP(pid, mutate(all, ids));
    if (want === "refuse") {
      check(`C11 ${label} ⇒ fails CLOSED as grade_unusable`, res, {status: "grade_unusable"});
      check(`C11 ${label} ⇒ mints nothing`, (await attOf(pid)).exists, false);
    } else {
      check(`C11 ${label} ⇒ REUSES the cache`, [res.status, res.score], ["attempt_written", 100]);
      check(`C11 ${label} ⇒ zero grader calls`, engineGraderCalls, before);
    }
    return {pid, ids, base};
  };
  // update — same word set, ONE response's text changed (the core substitution)
  await driftCase("text changed on one word", "lap-key-tx11",
      (b) => b.map((a, i) => (i === 0 ? {...a, studentResponse: "something else entirely"} : a)), "refuse");
  // create — a word PRESENT in the graded sheet but ABSENT from this submit
  await driftCase("a graded word omitted from this submit", "lap-key-tx12",
      (all) => all.slice(1), "refuse");
  // delete — a word submitted NOW that the cached grade never saw: the cache
  // was taken on a sheet WITHOUT it, this submit adds it.
  await driftCase("a word added that the cached grade never saw", "lap-key-tx13",
      (all) => all, "refuse", (all) => all.slice(1));
  // set-merge / set-overwrite — same words + same text, DIFFERENT ORDER
  await driftCase("same words + text in a different ORDER", "lap-key-tx14",
      (b) => [...b].reverse(), "reuse");
  // case drift — part of the identity definition (a verdict CAN turn on it)
  await driftCase("CASE drift on one response", "lap-key-tx15",
      (b) => b.map((a, i) => (i === 0 ? {...a, studentResponse: a.studentResponse.toUpperCase()} : a)), "refuse");
  // delete-then-recreate SEQUENCE — blank → filled → blank on ONE wordId
  {
    const c = await composeP("lap-key-tx16");
    const pid = c.presentation.presentationId;
    const ids = c.presentation.presentedWordIds;
    const withBlank = ids.map((w, i) => ({wordId: w, studentResponse: i === 0 ? "" : `def${w.slice(1)}`}));
    await cacheThenDie(pid, withBlank);
    const filled = ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
    let res = await submitP(pid, filled);
    check("C11 SEQUENCE blank→FILLED ⇒ fails closed as grade_unusable (blanks are part of the sheet)",
        res, {status: "grade_unusable"});
    const beforeSeq = engineGraderCalls;
    res = await submitP(pid, withBlank);
    check("C11 SEQUENCE filled→BLANK again ⇒ the ORIGINAL sheet reuses its grade",
        [res.status, res.totalQuestions, res.correctCount, engineGraderCalls],
        ["attempt_written", ids.length, ids.length - 1, beforeSeq]);
  }
  // batch / transaction — two CONCURRENT submits with different sheets, one key
  {
    const c = await composeP("lap-key-tx17");
    const pid = c.presentation.presentationId;
    const ids = c.presentation.presentedWordIds;
    const sheetA = ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
    const sheetB = ids.map((w, i) => ({wordId: w, studentResponse: i === 0 ? "a different answer" : `def${w.slice(1)}`}));
    let release; const held = new Promise((res) => { release = res; });
    let entered; const enteredP = new Promise((res) => { entered = res; });
    TG._typedSeam.grade = async ({answers}) => {
      engineGraderCalls++; entered(); await held;
      return answers.map((a) => ({wordId: a.wordId, isCorrect: true, reasoning: ""}));
    };
    TG._typedSeam.afterPersist = async () => { throw new Error("worker died after caching the grade"); };
    const inflight = submitErrP(pid, sheetA);
    await enteredP;
    const concurrent = await submitP(pid, sheetB);
    check("C11 concurrent submit with a DIFFERENT sheet ⇒ the lease refusal (DATA)",
        concurrent, {status: "grading_in_progress"});
    release();
    checkTrue("C11 the lease holder cached sheet A then died", String(await inflight).includes("worker died"));
    TG._typedSeam.afterPersist = null;
    TG._typedSeam.grade = async ({answers}) => {
      engineGraderCalls++;
      return answers.map((a) => ({
        wordId: a.wordId,
        isCorrect: a.studentResponse === a.correctDefinition,
        reasoning: "",
      }));
    };
    const res = await submitP(pid, sheetB);
    check("C11 the LOSER's sheet cannot claim the winner's cached grade (grade_unusable — its grade can never appear)",
        res, {status: "grade_unusable"});
    const beforeWinner = engineGraderCalls;
    const win = await submitP(pid, sheetA);
    check("C11 the WINNER's sheet reuses it, zero grader calls",
        [win.status, win.score, engineGraderCalls], ["attempt_written", 100, beforeWinner]);
    // Once the attempt EXISTS the idempotency law governs: a later different
    // sheet gets the STORED envelope, never a re-grade and never a new write.
    const attemptsNow = await attemptCount();
    const replayDrift = await submitP(pid, sheetB);
    check("C11 after the attempt exists, a drifted sheet REPLAYS the stored one (§8)",
        [replayDrift.status, replayDrift.replayed, replayDrift.score, await attemptCount()],
        ["attempt_written", true, 100, attemptsNow]);
  }
  // a different path — a payload stripped of `source` (the FieldValue.delete
  // shape) and a payload from an OLDER engine build both fail closed.
  {
    const c = await composeP("lap-key-tx18");
    const pid = c.presentation.presentationId;
    const ids = c.presentation.presentedWordIds;
    const base = ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
    await cacheThenDie(pid, base);
    const jr = db.collection("grading_jobs").doc(rv2Id("uP", pid));
    const full = (await jr.get()).data().payload;
    await jr.update({payload: {results: full.results, presentationId: full.presentationId,
      answerSheetKey: full.answerSheetKey}});
    let res = await submitP(pid, base);
    check("C11 `source` stripped off an engine cache ⇒ fails closed as grade_unusable", res, {status: "grade_unusable"});
    await jr.update({payload: {results: full.results}});
    res = await submitP(pid, base);
    check("C11 an OLDER engine build's payload (no provenance at all) ⇒ fails closed as grade_unusable",
        res, {status: "grade_unusable"});
    await jr.update({payload: full});
    const before = engineGraderCalls;
    res = await submitP(pid, base);
    check("C11 restoring the full engine payload reuses it (the clauses are the ONLY refusers)",
        [res.status, res.score, engineGraderCalls], ["attempt_written", 100, before]);
  }

  TG._typedSeam.grade = null;
  TG._typedSeam.afterPersist = null;
  // [was: "the LIVE grader was exercised for real (AI boundary canned only)"
  // — that Anthropic-HTTP stub was removed with the live-route poisoning
  // mechanism it alone exercised, see the note above C1.] The engine's OWN
  // typed grader (the emulator seam this whole case actually exercises
  // end-to-end, C1/C4/C6's Admin-SDK-seeded poisons excepted by design) still
  // ran for real throughout.
  check("TX: the engine's OWN typed grader was exercised for real (TG._typedSeam.grade, not stubbed away)",
      engineGraderCalls > 0, true);
}

// ===========================================================================
CASE("TS — THE SIBLING SEAM: `already_graded` re-reads a payload we did NOT write [A1 · typedGrading.js:295-308]");
{
  // WHY THIS CASE EXISTS, SEPARATELY FROM TX. A cached grading-job payload
  // enters the engine at TWO seams, not one:
  //   (1) `return_cached` (typedGrading.js:263) — TX drives this one to death.
  //   (2) `already_graded` (typedGrading.js:295-308) — our OWN persist loses:
  //       a competitor cached first, so the engine re-reads THEIR payload and
  //       builds graduation-bearing rows out of it.
  // Both call `usableCachedResults`. Reverting ONLY (2) to the pre-fix test
  // `Array.isArray(payload.results)` left the whole lap green (376/376) — the
  // guard was correct code with no evidence under it. This case is that
  // evidence; the matching mutant is M-A1-SIBLING-CALL-SITE.
  //
  // REACHABILITY [SUPERSEDED MECHANISM — NTF 19+22, CASE GR pins the
  // replacement]: through production code only UNTIL this fold, the
  // grading-job lease is 180s (index.js:109); if it lapsed while we graded,
  // the LIVE `gradeTypedTest` could take the SAME key over under the SAME
  // uid (index.js:943-953), reach `status: graded`, and our persist then
  // returned `already_graded` (index.js:986) — the exact branch under test.
  // `assertNotEngineReservedDocId` (index.js:1170-1171) now refuses that live
  // takeover UNCONDITIONALLY before claimOrRecoverGradingJob is ever reached
  // — so the win below is seeded directly (Admin SDK), reproducing the SAME
  // resulting `grading_jobs` state a winning live call used to leave behind.
  // Nothing here stubs `usableCachedResults` — that acceptance test is still
  // live production code, exercised exactly as before.
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cS"], queueSize: 6, testSize: 4});
  await seedClass("cS", {students: ["uS"], listId: "LS", asg: {reviewTestType: "typed"}});
  await seedWords("LS", 30);
  await seedProgress("uS", "cS", "LS", {csd: 2, twi: 10});
  const common = {classId: "cS", listId: "LS", clientContractVersion: 1};

  // THE ENGINE'S grader (the emulator-only seam, as CASE T/TX) with a ONE-SHOT
  // interleave slot. Whatever `interleave` holds runs INSIDE the grade call —
  // i.e. AFTER our claim owns the lease and BEFORE `persistGradingJobResult` —
  // which is the only window in which a competitor can turn our persist into
  // `already_graded`. It is cleared before it runs, so the competitor's own
  // grade never re-enters it.
  let engineGraderCalls = 0;
  let interleave = null;
  const engineGrader = async ({answers}) => {
    engineGraderCalls++;
    const inject = interleave;
    interleave = null;
    if (inject) await inject();
    return answers.map((a) => ({
      wordId: a.wordId,
      isCorrect: a.studentResponse === a.correctDefinition,
      reasoning: a.studentResponse === a.correctDefinition ? "" : "that is not the meaning",
    }));
  };
  TG._typedSeam.grade = engineGrader;

  // [SUPERSEDED MECHANISM — NTF 19+22, CASE GR above pins the replacement]
  // this case used to canonicalize the S1 win by driving it through the REAL
  // gradeTypedTest callable, with only its Anthropic HTTP call stubbed (the
  // claim/lease/payload machinery it drove was production code). That live
  // takeover is now refused at the mouth for any rv2_-prefixed key before
  // claimOrRecoverGradingJob runs, so the stub (and the `liveGradeS` helper
  // it alone served) is gone; S1 seeds the winning job document directly.

  const composeS = (ck) => call(CALL.reviewV2ComposeSession, "uS", {...common, logicalDay: 3, composeKey: ck});
  const submitS = (pid, ans) => call(CALL.reviewV2SubmitAttempt, "uS",
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const submitErrS = (pid, ans) => callErr(CALL.reviewV2SubmitAttempt, "uS",
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const goodS = (ids) => ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
  const junkS = (ids) => ids.map((w) => ({wordId: w, studentResponse: "not the meaning at all"}));
  const jobS = (pid) => db.collection("grading_jobs").doc(rv2Id("uS", pid));
  const attS = (pid) => db.collection("attempts").doc(rv2Id("uS", pid)).get();
  const attemptCountS = async () => (await db.collection("attempts").get()).size;
  const sheetKeyOf = (ids, sheet) => TG.answerSheetKey({presentedWordIds: ids,
    submitted: new Map(sheet.map((a) => [a.wordId, a.studentResponse]))});
  /** The 180s lease lapsing while we grade — the wall-clock wait, written as
   *  the state it produces (index.js:109 + the takeover at 943-953). */
  const expireOurLease = (pid) => jobS(pid).update({leaseExpiresAt: Date.now() - 1});
  /** A COMPETING ENGINE WORKER that caches its grade and dies before the
   *  attempt write [the CASE T-3 shape] — the legitimate way another payload
   *  wins the key. */
  const winnerCachesThenDies = async (pid, sheet) => {
    TG._typedSeam.afterPersist = async () => { throw new Error("worker died after caching the grade"); };
    const e = await submitErrS(pid, sheet);
    TG._typedSeam.afterPersist = null;
    return e;
  };

  // ---- S1 · A FOREIGN PAYLOAD WINS THE KEY — THE UNGUARDED SEAM ----------
  let r = await composeS("lap-key-ts01");
  check("TS typed session composes", [r.status, r.presentation.testType], ["composed", "typed"]);
  const pid1 = r.presentation.presentationId;
  const ids1 = r.presentation.presentedWordIds;
  let takeover = null;
  interleave = async () => {
    await expireOurLease(pid1);
    // [SUPERSEDED MECHANISM — NTF 19+22, see the case-header note above]
    // seeded directly: byte-identical to what a winning live takeover used
    // to leave on the job (status graded, the SAME uid — a second worker
    // reclaiming after our lease expired never needed a DIFFERENT uid, since
    // claimOrRecoverGradingJob's owner check is `job.uid !== uid`, not
    // "already claimed" — a bare `results` array with none of the three
    // engine-provenance facts).
    await jobS(pid1).set({
      uid: "uS", status: "graded", version: 1,
      payload: {results: ids1.map((w) => ({wordId: w, isCorrect: true, reasoning: ""}))},
    }, {merge: true});
    takeover = (await jobS(pid1).get()).data();
  };
  const attemptsBefore1 = await attemptCountS();
  const callsBefore1 = engineGraderCalls;
  r = await submitS(pid1, junkS(ids1));
  checkTrue("S1 setup: the interleave ran INSIDE our grade (the competitor got the window)",
      takeover !== null);
  check("S1 setup: the competing write left a payload that PASSES the pre-fix test and carries NO engine facts",
      [takeover?.status ?? null, Array.isArray(takeover?.payload?.results),
        takeover?.payload?.results?.length ?? null,
        (takeover?.payload?.results ?? []).every((x) => x.isCorrect === true),
        takeover?.payload?.source ?? null, takeover?.payload?.presentationId ?? null,
        takeover?.payload?.answerSheetKey ?? null],
      ["graded", true, ids1.length, true, null, null, null]);
  check("S1 the engine DID grade — so it reached PERSIST; this is NOT the return_cached seam",
      engineGraderCalls, callsBefore1 + 1);
  check("S1 our persist was NOT authoritative (⇒ `already_graded`): the foreign payload is still the cached one",
      [(await jobS(pid1).get()).data().payload.source ?? null,
        (await jobS(pid1).get()).data().payload.presentationId ?? null], [null, null]);
  check("S1 THE SIBLING SEAM REFUSES the foreign payload as TERMINAL data (grade_unusable)",
      r, {status: "grade_unusable"});
  check("S1 ⇒ ZERO attempt writes", [(await attS(pid1)).exists, await attemptCountS()],
      [false, attemptsBefore1]);
  // C1 RECOVERY at THIS seam (the status is only a fix if the client can act
  // on it): recompose — a new presentationId is a new job key the poison has
  // not touched — and the submit LANDS.
  r = await composeS("lap-key-ts01b");
  const recovered1 = await submitS(r.presentation.presentationId, goodS(r.presentation.presentedWordIds));
  check("S1 recovery: recompose (new key) then submit SUCCEEDS",
      [recovered1.status, recovered1.score], ["attempt_written", 100]);

  // ---- S2 · THE OTHER LEG: a LEGITIMATE winner IS reused ------------------
  // Same seam, same race, but the competitor is another ENGINE worker grading
  // THIS presentation and THIS sheet. Guarding must not mean refusing: the law
  // is "theirs is canonical, never ours", so their verdicts — deliberately
  // opposite to ours — are what the attempt must carry.
  r = await composeS("lap-key-ts02");
  const pid2 = r.presentation.presentationId;
  const ids2 = r.presentation.presentedWordIds;
  const sheet2 = goodS(ids2);
  let callsWhenWinnerCached = null;
  let winnerDied2 = null;
  interleave = async () => {
    await expireOurLease(pid2);
    const ours = TG._typedSeam.grade;
    TG._typedSeam.grade = async ({answers}) => {
      engineGraderCalls++;
      return answers.map((a) => ({wordId: a.wordId, isCorrect: false, reasoning: "the WINNER graded this"}));
    };
    winnerDied2 = await winnerCachesThenDies(pid2, sheet2);
    TG._typedSeam.grade = ours;
    callsWhenWinnerCached = engineGraderCalls;
  };
  const res2 = await submitS(pid2, sheet2);
  checkTrue("S2 setup: a second ENGINE worker cached first, then died before the attempt write",
      String(winnerDied2).includes("worker died"));
  const job2 = (await jobS(pid2).get()).data();
  check("S2 setup: the winner's cache is LEGITIMATE (engine provenance · this presentation · this sheet)",
      [job2.status, job2.payload.source, job2.payload.presentationId,
        job2.payload.answerSheetKey === sheetKeyOf(ids2, sheet2)],
      ["graded", "reviewV2", pid2, true]);
  check("S2 THE OTHER LEG: a legitimate `already_graded` payload is REUSED, not refused",
      [res2.status, res2.replayed, res2.totalQuestions],
      ["attempt_written", false, ids2.length]);
  check("S2 …and THEIRS is canonical, never ours (their verdicts on a sheet our grader calls perfect)",
      [res2.score, res2.correctCount], [0, 0]);
  const att2 = (await attS(pid2)).data();
  check("S2 the stored rows carry the WINNER's verdicts",
      [att2.answers.length, att2.answers.every((x) => x.isCorrect === false),
        att2.answers.every((x) => x.aiReasoning === "the WINNER graded this")],
      [ids2.length, true, true]);
  check("S2 …and the reuse charged NOTHING extra — no re-grade after `already_graded`",
      engineGraderCalls, callsWhenWinnerCached);

  // ---- S3 · THE ISOLATING VARIANT: an ENGINE winner, a DIFFERENT sheet ----
  // Provenance and presentation are correct BY CONSTRUCTION here (a real engine
  // worker wrote it), so only the answer-sheet clause can refuse — at THIS
  // seam, not the return_cached one. The realistic shape: a second device
  // submits the same presentation with different answers and wins the key.
  r = await composeS("lap-key-ts03");
  const pid3 = r.presentation.presentationId;
  const ids3 = r.presentation.presentedWordIds;
  const sheet3a = goodS(ids3);
  const sheet3b = sheet3a.map((a, i) => (i === 0 ? {...a, studentResponse: "something else entirely"} : a));
  let winnerDied3 = null;
  interleave = async () => {
    await expireOurLease(pid3);
    winnerDied3 = await winnerCachesThenDies(pid3, sheet3b);
  };
  const attemptsBefore3 = await attemptCountS();
  const res3 = await submitS(pid3, sheet3a);
  checkTrue("S3 setup: the winner cached a grade of a DIFFERENT sheet", String(winnerDied3).includes("worker died"));
  const job3 = (await jobS(pid3).get()).data();
  check("S3 setup: that cache has our provenance and our presentation — only the sheet differs",
      [job3.payload.source, job3.payload.presentationId,
        job3.payload.answerSheetKey === sheetKeyOf(ids3, sheet3b),
        job3.payload.answerSheetKey === sheetKeyOf(ids3, sheet3a)],
      ["reviewV2", pid3, true, false]);
  check("S3 `already_graded` + a grade of ANOTHER sheet ⇒ fails CLOSED as grade_unusable",
      res3, {status: "grade_unusable"});
  check("S3 ⇒ mints nothing", [(await attS(pid3)).exists, await attemptCountS()],
      [false, attemptsBefore3]);
  // NOT STRANDED: the sheet the winner actually graded still reuses its grade.
  const callsBefore3b = engineGraderCalls;
  const res3b = await submitS(pid3, sheet3b);
  check("S3 other leg: the sheet the winner GRADED reuses it, zero grader calls",
      [res3b.status, res3b.correctCount, res3b.totalQuestions, engineGraderCalls],
      ["attempt_written", ids3.length - 1, ids3.length, callsBefore3b]);

  TG._typedSeam.grade = null;
  TG._typedSeam.afterPersist = null;
  // [was: "the LIVE grader was exercised for real (AI boundary canned only)"
  // — the Anthropic-HTTP stub was removed with the live-takeover mechanism it
  // alone exercised, see the case-header note above.]
  check("TS: the engine's OWN typed grader was exercised for real (TG._typedSeam.grade, not stubbed away)",
      engineGraderCalls > 0, true);
}

// ===========================================================================
CASE("GU — THE REFUSAL SPLIT, THIRD TRANSIENT SITE: gradeSkippedForReplay stays grading_in_progress [rv2-refusal-status C2]");
{
  // The split's regression control for the one transient site that lives in
  // callables.js (:649), not typedGrading.js: the replay pre-read saw a stored
  // attempt (so the typed grade was SKIPPED), and the attempt is GONE by the
  // time the txn re-reads it. That is TRANSIENT — the retry re-grades from
  // scratch or re-lands from the still-cached job — so it must KEEP
  // `grading_in_progress` (poll), never `grade_unusable` (recompose). The
  // other two transient sites are pinned at CASE T §4/§7 (:269 lease, :334
  // superseded); the permanent sites at CASE TX/TS.
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cG"], queueSize: 6, testSize: 4});
  await seedClass("cG", {students: ["uG"], listId: "LG", asg: {reviewTestType: "typed"}});
  await seedWords("LG", 30);
  await seedProgress("uG", "cG", "LG", {csd: 2, twi: 10});
  const common = {classId: "cG", listId: "LG", clientContractVersion: 1};
  let engineGraderCalls = 0;
  TG._typedSeam.grade = async ({answers}) => {
    engineGraderCalls++;
    return answers.map((a) => ({
      wordId: a.wordId,
      isCorrect: a.studentResponse === a.correctDefinition,
      reasoning: "",
    }));
  };
  const composeG = (ck) => call(CALL.reviewV2ComposeSession, "uG", {...common, logicalDay: 3, composeKey: ck});
  const submitG = (pid, ans) => call(CALL.reviewV2SubmitAttempt, "uG",
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const goodG = (ids) => ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));

  let r = await composeG("lap-key-gu01");
  check("GU setup: typed session composes", [r.status, r.presentation.testType], ["composed", "typed"]);
  const pid1 = r.presentation.presentationId;
  const ids1 = r.presentation.presentedWordIds;
  r = await submitG(pid1, goodG(ids1));
  check("GU setup: the typed attempt lands", [r.status, r.score], ["attempt_written", 100]);
  // THE RACE: the attempt vanishes AFTER the replay pre-read (which skipped
  // the grade) and BEFORE the txn — driven through the same emulator-only
  // one-shot hook as the compose-path races [r74 C8a].
  const callsBeforeVanish = engineGraderCalls;
  CALL._testHooks.afterPreflight = async () => {
    await db.collection("attempts").doc(rv2Id("uG", pid1)).delete();
  };
  r = await submitG(pid1, goodG(ids1));
  check("GU vanished-after-pre-read stays TRANSIENT: grading_in_progress, NOT grade_unusable",
      r, {status: "grading_in_progress"});
  check("GU the refusal spent nothing (grade was skipped, not re-run)",
      engineGraderCalls, callsBeforeVanish);
  // …and WHY it is transient: the SAME submit, retried, RESOLVES — it re-lands
  // from the still-cached job with zero grader calls. A `grade_unusable` here
  // would have sent the student to recompose a test they can still land.
  r = await submitG(pid1, goodG(ids1));
  check("GU the poll RESOLVES: the retry re-lands from the cached job, zero grader calls",
      [r.status, r.score, engineGraderCalls], ["attempt_written", 100, callsBeforeVanish]);
  TG._typedSeam.grade = null;
}

// ===========================================================================
CASE("TR — rv2_ replay provenance: never inferred from the document NAME [A4]");
{
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cR"], queueSize: 6, testSize: 4});
  await seedClass("cR", {students: ["uR"], listId: "LR"});
  await seedWords("LR", 20);
  await seedProgress("uR", "cR", "LR", {csd: 2, twi: 10});
  const common = {classId: "cR", listId: "LR", clientContractVersion: 1};
  const submitR = (pid, ans) => call(CALL.reviewV2SubmitAttempt, "uR",
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const REFUSAL = {status: "presentation_invalid",
    reason: "attempt identity occupied by a non-engine document"};

  let r = await call(CALL.reviewV2ComposeSession, "uR", {...common, logicalDay: 3, composeKey: "lap-key-tr01"});
  check("TR setup composes", r.status, "composed");
  const pidS = r.presentation.presentationId;
  const idsS = r.presentation.presentedWordIds;
  const ansS = idsS.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
  const squatRef = db.collection("attempts").doc(rv2Id("uR", pidS));
  const engineShape = {
    studentId: "uR", classId: "cR", listId: "LR", studyDay: 3, sessionType: "review",
    testType: "mcq", score: 100, passed: true, totalQuestions: 1,
    answers: [{wordId: idsS[0], isCorrect: true}],
    presentationId: pidS, queueId: "q", resetEpoch: 0,
    gatePosture: {effectiveEnabled: true, threshold: 92, configVersion: 1, source: "forged"},
    engineResult: {stamped: 0, stampSkipped: null, rerunGraduated: [], visitHalf: null},
  };
  // Every squat is tried on the SAME presentation and the SAME docId — what
  // changes is only the CONTENT, which is the whole point of A4.
  const squat = async (label, doc) => {
    await squatRef.set(doc);
    const before = (await db.collection("attempts").get()).size;
    const res = await submitR(pidS, ansS);
    check(`TR ${label} ⇒ fails CLOSED`, res, REFUSAL);
    check(`TR ${label} ⇒ zero writes (the squatting doc is untouched)`,
        [(await db.collection("attempts").get()).size, (await squatRef.get()).data().score],
        [before, doc.score]);
    check(`TR ${label} ⇒ the presentation is NOT claimed`,
        (await db.doc(`users/uR/review_presentations/${pidS}`).get()).data().serverClaim.attemptDocId, null);
  };
  // (1) the pre-lockdown window: a PLAIN client-created attempt at the id the
  //     client can derive itself (rules allow this create — matrix 9-a1/A21).
  await squat("a plain client-shaped doc at the predictable id",
      {studentId: "uR", score: 100, passed: true, answers: [], totalQuestions: 0});
  // (2) a legacy-shaped attempt (no engine stamps at all)
  await squat("a LEGACY-shaped attempt", {
    studentId: "uR", classId: "cR", listId: "LR", studyDay: 3, sessionType: "review",
    score: 100, passed: true, totalQuestions: 1, answers: [{wordId: idsS[0], isCorrect: true}],
  });
  // (3) stamped, but for a DIFFERENT presentation
  await squat("stamped for a DIFFERENT presentationId", {...engineShape, presentationId: `${pidS}_other`});
  // (4) stamped, but owned by ANOTHER uid
  await squat("stamped for ANOTHER uid", {...engineShape, studentId: "uOther"});
  // (5)-(7) each individual stamp is load-bearing, not just the set
  const without = (key) => Object.fromEntries(Object.entries(engineShape).filter(([k]) => k !== key));
  await squat("resetEpoch absent (the engine/legacy discriminator)", without("resetEpoch"));
  await squat("resetEpoch present but non-integer", {...engineShape, resetEpoch: "0"});
  await squat("gatePosture absent", without("gatePosture"));
  await squat("gatePosture incomplete", {...engineShape, gatePosture: {effectiveEnabled: true}});
  await squat("engineResult absent", without("engineResult"));
  // (8) THE OTHER LEG: the same id, now holding a REAL engine attempt.
  await squatRef.delete();
  r = await submitR(pidS, ansS);
  check("TR the legitimate submit lands once the squatter is gone",
      [r.status, r.replayed, r.score], ["attempt_written", false, 100]);
  const beforeReplay = await db.collection("attempts").doc(rv2Id("uR", pidS)).get();
  const attemptsBefore = (await db.collection("attempts").get()).size;
  r = await submitR(pidS, ansS);
  check("TR THE OTHER LEG: a genuine engine attempt still REPLAYS",
      [r.status, r.replayed, r.score, r.stamped !== null], ["attempt_written", true, 100, true]);
  check("TR …with ZERO writes",
      [(await db.collection("attempts").doc(rv2Id("uR", pidS)).get()).updateTime.isEqual(beforeReplay.updateTime),
        (await db.collection("attempts").get()).size], [true, attemptsBefore]);
  // (9) TYPED: a squatted typed presentation must also cost ZERO grader calls —
  //     the pre-read skips grading on `exists`, so the refusal must come first.
  await db.doc("classes/cR").update({"assignments.LR.reviewTestType": "typed"});
  r = await call(CALL.reviewV2ComposeSession, "uR", {...common, logicalDay: 3, composeKey: "lap-key-tr02"});
  const pidT = r.presentation.presentationId;
  const idsT = r.presentation.presentedWordIds;
  let trGraderCalls = 0;
  TG._typedSeam.grade = async ({answers}) => {
    trGraderCalls++;
    return answers.map((a) => ({wordId: a.wordId, isCorrect: true, reasoning: ""}));
  };
  await db.collection("attempts").doc(rv2Id("uR", pidT)).set({studentId: "uR", score: 100, passed: true,
    answers: [], totalQuestions: 0});
  r = await submitR(pidT, idsT.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`})));
  check("TR a squatted TYPED presentation fails closed", r, REFUSAL);
  check("TR …and never reaches the grader", trGraderCalls, 0);
  check("TR …and never claims a grading job",
      (await db.collection("grading_jobs").doc(rv2Id("uR", pidT)).get()).exists, false);
  TG._typedSeam.grade = null;
  await db.doc("classes/cR").update({"assignments.LR.reviewTestType": "mcq"});
  // (10) THE CROSS-STUDENT COLLISION — surfaced BY this fixture set, then FIXED
  //      [rv2-docid-collision A1]. THESE ASSERTIONS WERE INVERTED, NOT DELETED:
  //      they are the regression witness for the original defect, so they must
  //      go red if it ever returns.
  //
  //      THE DEFECT (the historical record, corrected once already by the
  //      typed-fix audit): `presentationId` is `{classId}_{listId}_d{day}_
  //      e{epoch}_p{seq}` (presentations.js:445) over a queue id that carries NO
  //      uid (composer.js:82-84) and `seq` counts PER USER, while `attempts` and
  //      `grading_jobs` are GLOBAL collections — so the FIRST review
  //      presentation of EVERY student in a class derived the SAME document id.
  //      Observed, NOT "both students blocked": the FIRST student's attempt
  //      landed and only the SECOND was refused (before A4, worse — the second
  //      student was handed the FIRST's score/passed/engineResult as their own
  //      "replay"). On the typed leg the second student got `permission-denied`
  //      from the grading-job uid fence on their own test (CASE RC).
  //
  //      THE FIX scopes the DERIVED id, NOT presentationId: `rv2_{uid}_{pid}`
  //      (composer.js `engineDocId`, called by BOTH callables.js `attemptId` and
  //      typedGrading.js `jobKey`). presentationId is deliberately unchanged —
  //      it is uid-scoped by path — SO THE COLLIDING INPUT IS STILL ASSERTED
  //      FIRST: if the two students ever stopped sharing a presentationId this
  //      fixture would silently stop testing the defect at all.
  await db.doc("classes/cShared").set({studentIds: ["uA1", "uA2"],
    assignments: {LR: {name: "seed", weeklyPace: 50, studyDaysPerWeek: 5}}});
  await seedConfig({rehearsalClassIds: ["cR", "cShared"], queueSize: 6, testSize: 4});
  await seedProgress("uA1", "cShared", "LR", {csd: 2, twi: 10});
  await seedProgress("uA2", "cShared", "LR", {csd: 2, twi: 10});
  const sharedCommon = {classId: "cShared", listId: "LR", clientContractVersion: 1};
  const cA1 = await call(CALL.reviewV2ComposeSession, "uA1", {...sharedCommon, logicalDay: 3, composeKey: "lap-key-tr-a1"});
  const cA2 = await call(CALL.reviewV2ComposeSession, "uA2", {...sharedCommon, logicalDay: 3, composeKey: "lap-key-tr-a2"});
  check("TR COLLISION (the input, UNCHANGED): two students in one class still derive the SAME presentationId",
      cA1.presentation.presentationId, cA2.presentation.presentationId);
  const collidingPid = cA1.presentation.presentationId;
  const sA1 = await call(CALL.reviewV2SubmitAttempt, "uA1", {presentationId: collidingPid,
    clientContractVersion: 1,
    answers: cA1.presentation.presentedWordIds.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}))});
  check("TR COLLISION: the first student's attempt lands", [sA1.status, sA1.score], ["attempt_written", 100]);
  const sA2 = await call(CALL.reviewV2SubmitAttempt, "uA2", {presentationId: cA2.presentation.presentationId,
    clientContractVersion: 1,
    answers: cA2.presentation.presentedWordIds.map((w) => ({wordId: w, studentResponse: ""}))});
  // WAS: "the SECOND student fails CLOSED instead of inheriting the first's
  // grade" ⇒ REFUSAL. The second student is a student, not an attacker.
  check("TR COLLISION (INVERTED): the SECOND student now LANDS THEIR OWN attempt, with their own grade",
      [sA2.status, sA2.replayed, sA2.score, sA2.passed], ["attempt_written", false, 0, false]);
  // WAS: "exactly one attempt exists at the colliding id, still the FIRST
  // student's". Now: two documents, neither at the id the old scheme derived.
  check("TR COLLISION (INVERTED): TWO documents, one per student, each carrying its own owner and grade",
      [sA1.attemptId !== sA2.attemptId,
        (await db.collection("attempts").doc(sA1.attemptId).get()).data().studentId,
        (await db.collection("attempts").doc(sA1.attemptId).get()).data().score,
        (await db.collection("attempts").doc(sA2.attemptId).get()).data().studentId,
        (await db.collection("attempts").doc(sA2.attemptId).get()).data().score],
      [true, "uA1", 100, "uA2", 0]);
  check("TR COLLISION: each id is the uid-scoped derivation, and the OLD colliding id holds NOTHING",
      [sA1.attemptId, sA2.attemptId,
        (await db.collection("attempts").doc(`rv2_${collidingPid}`).get()).exists],
      [rv2Id("uA1", collidingPid), rv2Id("uA2", collidingPid), false]);
  check("TR COLLISION: each presentation claims its OWN attempt (the completion.js:412 binding)",
      [(await db.doc(`users/uA1/review_presentations/${collidingPid}`).get()).data().serverClaim.attemptDocId,
        (await db.doc(`users/uA2/review_presentations/${collidingPid}`).get()).data().serverClaim.attemptDocId],
      [rv2Id("uA1", collidingPid), rv2Id("uA2", collidingPid)]);
  // (11) the predicate itself, on the shapes above (fixture-facing surface).
  check("TR the predicate accepts ONLY the fully-stamped engine shape",
      [CALL.isEngineAttemptFor(engineShape, {uid: "uR", presentationId: pidS}),
        CALL.isEngineAttemptFor(engineShape, {uid: "uR", presentationId: ""}),
        CALL.isEngineAttemptFor(null, {uid: "uR", presentationId: pidS}),
        CALL.isEngineAttemptFor({...engineShape, resetEpoch: 1.5}, {uid: "uR", presentationId: pidS})],
      [true, false, false, false]);
}

// ===========================================================================
CASE("RC — THE DERIVED GLOBAL ID IS UID-SCOPED: the full bypass set [rv2-docid-collision A1 · C2/C3/C5]");
{
  // WHAT THIS CASE IS FOR. CASE TR (10) proves the headline: two students in
  // one class both land. This case is the BYPASS SET — one fixture per way two
  // students could still collide or cross-read AFTER the fix (create · update ·
  // delete · set-merge · set-overwrite · FieldValue.delete · delete-then-
  // recreate SEQUENCE · batch · transaction · a different path · third party ·
  // teacher) — plus THE OTHER LEG (a single-student class must behave EXACTLY
  // as before) and the typed leg end to end for two students, which is the path
  // that previously threw `permission-denied` on the grading-job claim.
  //
  // THE FENCE UNDER TEST IS NOT THE UID IN THE KEY. The uid is a NAMESPACE:
  // every student knows their classmates' uids, and the Admin SDK used below
  // bypasses rules entirely. What must hold is that each submit adjudicates
  // EXACTLY ONE document — the one its own uid names — and never inherits,
  // clobbers or is blocked by another student's.
  await wipeEmulator();
  await seedConfig({rehearsalClassIds: ["cC", "cSolo"], queueSize: 6, testSize: 4});
  await seedClass("cC", {students: ["uA", "uB"], listId: "LC"});
  await seedClass("cSolo", {students: ["uSolo"], listId: "LC"});
  await seedWords("LC", 30);
  await seedProgress("uA", "cC", "LC", {csd: 2, twi: 10});
  await seedProgress("uB", "cC", "LC", {csd: 2, twi: 10});
  await seedProgress("uSolo", "cSolo", "LC", {csd: 2, twi: 10});
  await db.doc("users/uTeachC").set({role: "teacher", displayName: "T"});
  const common = {classId: "cC", listId: "LC", clientContractVersion: 1};
  const composeC = (uid, ck) => call(CALL.reviewV2ComposeSession, uid, {...common, logicalDay: 3, composeKey: ck});
  const submitC = (uid, pid, ans) => call(CALL.reviewV2SubmitAttempt, uid,
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const good = (ids) => ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}));
  const wrong = (ids) => ids.map((w) => ({wordId: w, studentResponse: "not the meaning at all"}));
  const attRef = (uid, pid) => db.collection("attempts").doc(rv2Id(uid, pid));
  const attCount = async () => (await db.collection("attempts").get()).size;
  const REFUSAL_RC = {status: "presentation_invalid",
    reason: "attempt identity occupied by a non-engine document"};
  /** A fully engine-shaped attempt for `owner` on `pid` — the ONLY shape A4
   *  accepts, so a squat built from it isolates the IDENTITY question. */
  const engineShapeFor = (owner, pid, score) => ({
    studentId: owner, classId: "cC", listId: "LC", studyDay: 3, sessionType: "review",
    testType: "mcq", score, passed: score >= 92, totalQuestions: 1,
    answers: [{wordId: "w0", isCorrect: score >= 92}],
    presentationId: pid, queueId: "q", resetEpoch: 0,
    gatePosture: {effectiveEnabled: true, threshold: 92, configVersion: 1, source: "planted"},
    engineResult: {stamped: 0, stampSkipped: null, rerunGraduated: [], visitHalf: null},
  });
  // The two students compose IN LOCKSTEP so `seq` stays equal and the
  // presentationId keeps colliding — that shared string is the precondition of
  // every row below, so it is asserted, never assumed.
  const pairA = await composeC("uA", "lap-key-rc-a1");
  const pairB = await composeC("uB", "lap-key-rc-b1");
  const pid = pairA.presentation.presentationId;
  const idsA = pairA.presentation.presentedWordIds;
  const idsB = pairB.presentation.presentedWordIds;
  check("RC precondition: both students hold the SAME presentationId (the collision is still real)",
      [pairA.status, pairB.status, pairB.presentation.presentationId], ["composed", "composed", pid]);

  // ---- create · a different path (THE DEFECT) -----------------------------
  const nBeforeCreate = await attCount();
  const sA = await submitC("uA", pid, good(idsA));
  const sB = await submitC("uB", pid, wrong(idsB));
  check("RC create: BOTH students land, each at their OWN uid-scoped id",
      [sA.status, sA.attemptId, sB.status, sB.attemptId],
      ["attempt_written", rv2Id("uA", pid), "attempt_written", rv2Id("uB", pid)]);
  check("RC create: TWO documents, each owned by its own student with its own grade",
      [await attCount() - nBeforeCreate,
        (await attRef("uA", pid).get()).data().studentId, (await attRef("uA", pid).get()).data().score,
        (await attRef("uB", pid).get()).data().studentId, (await attRef("uB", pid).get()).data().score],
      [2, "uA", 100, "uB", 0]);
  check("RC A DIFFERENT PATH — ONE presentationId, TWO uids, TWO documents (and nothing at the old id)",
      [sA.attemptId !== sB.attemptId,
        (await attRef("uA", pid).get()).data().presentationId,
        (await attRef("uB", pid).get()).data().presentationId,
        (await db.collection("attempts").doc(`rv2_${pid}`).get()).exists],
      [true, pid, pid, false]);

  // ---- update ------------------------------------------------------------
  const aBeforeUpdate = await attRef("uA", pid).get();
  const nBeforeUpdate = await attCount();
  const repB = await submitC("uB", pid, wrong(idsB));
  check("RC update: B's re-submit REPLAYS B's own stored envelope",
      [repB.status, repB.replayed, repB.score], ["attempt_written", true, 0]);
  check("RC update: A's document is untouched and the collection did not grow",
      [(await attRef("uA", pid).get()).updateTime.isEqual(aBeforeUpdate.updateTime), await attCount()],
      [true, nBeforeUpdate]);

  // ---- delete ------------------------------------------------------------
  await attRef("uB", pid).delete();
  check("RC delete: removing B's attempt leaves A's intact",
      [(await attRef("uA", pid).get()).exists, (await attRef("uB", pid).get()).exists], [true, false]);
  const reB = await submitC("uB", pid, good(idsB));
  check("RC delete: B re-lands at B's OWN id and is graded from B's OWN sheet — A's 100 is never inherited",
      [reB.status, reB.replayed, reB.attemptId, reB.score],
      ["attempt_written", false, rv2Id("uB", pid), 100]);
  check("RC delete: A's document is still A's",
      [(await attRef("uA", pid).get()).data().studentId, (await attRef("uA", pid).get()).data().score],
      ["uA", 100]);

  // ---- set-merge / set-overwrite · the OLD colliding id is INERT ----------
  // The id the pre-fix scheme derived is now addressed by nobody. Both shapes
  // of write to it must be invisible to both students.
  await db.collection("attempts").doc(`rv2_${pid}`)
      .set({studentId: "uA", score: 100, passed: true}, {merge: true});
  let mA = await submitC("uA", pid, good(idsA));
  let mB = await submitC("uB", pid, good(idsB));
  check("RC set-merge at the OLD colliding id ⇒ INERT: both students still replay their own",
      [mA.replayed, mA.score, mA.attemptId, mB.replayed, mB.score, mB.attemptId],
      [true, 100, rv2Id("uA", pid), true, 100, rv2Id("uB", pid)]);
  await db.collection("attempts").doc(`rv2_${pid}`).set(engineShapeFor("uA", pid, 13));
  mA = await submitC("uA", pid, good(idsA));
  mB = await submitC("uB", pid, good(idsB));
  check("RC set-overwrite at the OLD id with a FULLY engine-shaped doc ⇒ still INERT (score 13 is never served)",
      [mA.replayed, mA.score, mB.replayed, mB.score], [true, 100, true, 100]);
  check("RC …and the planted doc is not even read (untouched)",
      (await db.collection("attempts").doc(`rv2_${pid}`).get()).data().score, 13);
  await db.collection("attempts").doc(`rv2_${pid}`).delete();

  // ---- FieldValue.delete() -----------------------------------------------
  // Strip the ownership stamp off A's OWN attempt. A fails closed on its own
  // document (A4); B, addressing a different document, is untouched.
  await attRef("uA", pid).update({studentId: FieldValue.delete()});
  const fA = await submitC("uA", pid, good(idsA));
  check("RC FieldValue.delete: stripping `studentId` makes A's OWN replay fail CLOSED", fA, REFUSAL_RC);
  const fB = await submitC("uB", pid, good(idsB));
  check("RC FieldValue.delete: …and B is entirely unaffected — a different document",
      [fB.status, fB.replayed, fB.score], ["attempt_written", true, 100]);
  await attRef("uA", pid).update({studentId: "uA"});
  check("RC FieldValue.delete other leg: restoring the stamp restores A's replay",
      (await submitC("uA", pid, good(idsA))).replayed, true);

  // ---- delete-then-recreate SEQUENCE -------------------------------------
  await attRef("uA", pid).delete();
  await attRef("uA", pid).set(engineShapeFor("uB", pid, 100));
  const seqA = await submitC("uA", pid, good(idsA));
  check("RC SEQUENCE delete→recreate: a doc recreated at A's id but NAMING B fails CLOSED for A", seqA, REFUSAL_RC);
  check("RC SEQUENCE: …and B's own attempt is untouched by the sequence",
      [(await attRef("uB", pid).get()).data().studentId, (await attRef("uB", pid).get()).data().score],
      ["uB", 100]);
  await attRef("uA", pid).delete();
  const seqA2 = await submitC("uA", pid, good(idsA));
  check("RC SEQUENCE other leg: with the squat gone A lands again at A's own id",
      [seqA2.status, seqA2.replayed, seqA2.attemptId, seqA2.score],
      ["attempt_written", false, rv2Id("uA", pid), 100]);

  // ---- batch --------------------------------------------------------------
  // ONE atomic commit CROSS-PLANTS both students: A's id gets a document owned
  // by B and B's id one owned by A. A batch is the only shape that can touch
  // both derived documents at once; it still cannot make either student read
  // the other's, because the id each submit addresses is its own.
  const bt = db.batch();
  bt.set(attRef("uA", pid), engineShapeFor("uB", pid, 7));
  bt.set(attRef("uB", pid), engineShapeFor("uA", pid, 9));
  bt.set(db.collection("attempts").doc(`rv2_${pid}`), engineShapeFor("uA", pid, 11));
  await bt.commit();
  const btA = await submitC("uA", pid, good(idsA));
  const btB = await submitC("uB", pid, good(idsB));
  check("RC batch: cross-planted documents are REFUSED, never crossed over (neither 7 nor 9 is served)",
      [btA, btB], [REFUSAL_RC, REFUSAL_RC]);
  await attRef("uA", pid).delete();
  await attRef("uB", pid).delete();
  await db.collection("attempts").doc(`rv2_${pid}`).delete();
  const btA2 = await submitC("uA", pid, good(idsA));
  const btB2 = await submitC("uB", pid, wrong(idsB));
  check("RC batch other leg: cleared, both students land their own grades again",
      [btA2.score, btA2.attemptId, btB2.score, btB2.attemptId],
      [100, rv2Id("uA", pid), 0, rv2Id("uB", pid)]);

  // ---- transaction --------------------------------------------------------
  // The engine's attempt write IS a transaction. Two students submitting the
  // SAME presentationId CONCURRENTLY is the shape that previously guaranteed
  // one loser; both must now commit. Fresh presentations (seq 2), still shared.
  const txA = await composeC("uA", "lap-key-rc-a2");
  const txB = await composeC("uB", "lap-key-rc-b2");
  const pid2 = txA.presentation.presentationId;
  check("RC transaction setup: the second presentation collides too",
      [pid2 === pid, txB.presentation.presentationId], [false, pid2]);
  const [tA, tB] = await Promise.all([
    submitC("uA", pid2, good(txA.presentation.presentedWordIds)),
    submitC("uB", pid2, wrong(txB.presentation.presentedWordIds)),
  ]);
  check("RC transaction: CONCURRENT submits of the same presentationId BOTH commit, with their own grades",
      [tA.status, tA.replayed, tA.score, tB.status, tB.replayed, tB.score],
      ["attempt_written", false, 100, "attempt_written", false, 0]);
  check("RC transaction: two distinct documents, correctly owned",
      [tA.attemptId !== tB.attemptId,
        (await attRef("uA", pid2).get()).data().studentId,
        (await attRef("uB", pid2).get()).data().studentId], [true, "uA", "uB"]);

  // ---- THE OTHER LEG [C3]: a SINGLE-student class is unchanged ------------
  // Same replay semantics, same idempotency, same completion evidence — the
  // regression control for "the fix changed nothing where there was no defect".
  const soloCommon = {classId: "cSolo", listId: "LC", clientContractVersion: 1};
  const cS = await call(CALL.reviewV2ComposeSession, "uSolo", {...soloCommon, logicalDay: 3, composeKey: "lap-key-rc-solo"});
  const pidSolo = cS.presentation.presentationId;
  const idsSolo = cS.presentation.presentedWordIds;
  const s1 = await call(CALL.reviewV2SubmitAttempt, "uSolo",
      {presentationId: pidSolo, answers: good(idsSolo), clientContractVersion: 1});
  check("RC SOLO: the single-student submit lands exactly as before",
      [s1.status, s1.replayed, s1.score, s1.passed, s1.attemptId],
      ["attempt_written", false, 100, true, rv2Id("uSolo", pidSolo)]);
  const soloBefore = await attRef("uSolo", pidSolo).get();
  const nBeforeSolo = await attCount();
  const s2 = await call(CALL.reviewV2SubmitAttempt, "uSolo",
      {presentationId: pidSolo, answers: good(idsSolo), clientContractVersion: 1});
  check("RC SOLO: idempotent replay ⇒ the SAME normalized envelope",
      [s2.status, s2.replayed, s2.score, s2.correctCount, s2.totalQuestions, s2.stamped === s1.stamped],
      ["attempt_written", true, 100, idsSolo.length, idsSolo.length, true]);
  check("RC SOLO: replay performs ZERO writes",
      [(await attRef("uSolo", pidSolo).get()).updateTime.isEqual(soloBefore.updateTime), await attCount()],
      [true, nBeforeSolo]);
  const soloNew = await call(CALL.reviewV2ComposeNewTest, "uSolo", {...soloCommon, logicalDay: 3, composeKey: "lap-key-rc-solo-n"});
  const soloNewPid = soloNew.presentation.presentationId;
  await call(CALL.reviewV2SubmitAttempt, "uSolo", {presentationId: soloNewPid,
    clientContractVersion: 1, answers: good(soloNew.presentation.presentedWordIds)});
  const soloDone = await call(CALL.reviewV2CompleteDay, "uSolo", {...soloCommon, logicalDay: 3,
    consumedAttemptId: rv2Id("uSolo", pidSolo), consumedAttemptClassId: "cSolo",
    newTestAttemptId: rv2Id("uSolo", soloNewPid)});
  check("RC SOLO: completeDay still binds its evidence through the DERIVED id",
      [soloDone.status, soloDone.evidenceKind, soloDone.advancedToDay], ["completed", "standard", 3]);

  // ---- C5 · THE TYPED LEG END TO END, TWO STUDENTS, ONE CLASS -------------
  // THE PATH THAT USED TO THROW. `claimOrRecoverGradingJob` refuses a job whose
  // `uid` field is someone else's (index.js:936-938) — so under the unscoped
  // key the SECOND student's typed submit died with `permission-denied` on
  // their own test, before the grader was ever reached.
  //
  // A SEPARATE CLASS, and the reason matters: for a live review the modality is
  // the DAY QUEUE SNAPSHOT's (`presentations.js:407` over the queue pinned at
  // first compose), so flipping `reviewTestType` on a class whose day-3 queue
  // already exists would silently keep composing MCQ — a green typed fixture
  // that never went typed. `cTy` is typed from the first compose.
  await seedClass("cTy", {students: ["uTA", "uTB"], listId: "LC", asg: {reviewTestType: "typed"}});
  await seedConfig({rehearsalClassIds: ["cC", "cSolo", "cTy"], queueSize: 6, testSize: 4});
  await seedProgress("uTA", "cTy", "LC", {csd: 2, twi: 10});
  await seedProgress("uTB", "cTy", "LC", {csd: 2, twi: 10});
  const tyCommon = {classId: "cTy", listId: "LC", clientContractVersion: 1};
  const composeTy = (uid, ck) => call(CALL.reviewV2ComposeSession, uid, {...tyCommon, logicalDay: 3, composeKey: ck});
  const submitTy = (uid, pid, ans) => call(CALL.reviewV2SubmitAttempt, uid,
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  const submitTyErr = (uid, pid, ans) => callErr(CALL.reviewV2SubmitAttempt, uid,
      {presentationId: pid, answers: ans, clientContractVersion: 1});
  let rcGraderCalls = 0;
  TG._typedSeam.grade = async ({answers}) => {
    rcGraderCalls++;
    return answers.map((a) => ({
      wordId: a.wordId,
      isCorrect: a.studentResponse === a.correctDefinition,
      reasoning: a.studentResponse === a.correctDefinition ? "" : "that is not the meaning",
    }));
  };
  const tyA = await composeTy("uTA", "lap-key-rc-ty-a");
  const tyB = await composeTy("uTB", "lap-key-rc-ty-b");
  const pidTy = tyA.presentation.presentationId;
  const idsTA = tyA.presentation.presentedWordIds;
  const idsTB = tyB.presentation.presentedWordIds;
  check("RC TYPED setup: genuinely TYPED, and the presentationId still collides",
      [tyA.presentation.testType, tyB.presentation.testType, tyB.presentation.presentationId],
      ["typed", "typed", pidTy]);
  const jobRef = (uid) => db.collection("grading_jobs").doc(rv2Id(uid, pidTy));
  const callsBeforeTyped = rcGraderCalls;
  // A submits FIRST — this is what creates the grading job whose ownership,
  // under the OLD unscoped key, student B was then refused.
  const tyErrA = await submitTyErr("uTA", pidTy, good(idsTA));
  check("RC TYPED: student A's typed submit does not throw", tyErrA, null);
  const tySubA = await submitTy("uTA", pidTy, good(idsTA));
  check("RC TYPED: …and A's attempt is A's own, replaying its stored envelope",
      [tySubA.status, tySubA.replayed, tySubA.score, tySubA.attemptId],
      ["attempt_written", true, 100, rv2Id("uTA", pidTy)]);
  // THE REGRESSION WITNESS: THIS is the call that used to throw
  // `permission-denied` — the second student in a class, on their own test.
  const tyErrB = await submitTyErr("uTB", pidTy, wrong(idsTB));
  check("RC TYPED (WAS `permission-denied` ON THE JOB CLAIM): student B's typed submit does not throw",
      tyErrB, null);
  const tySubB = await submitTy("uTB", pidTy, wrong(idsTB));
  check("RC TYPED: …and B's attempt is B's own, with B's own (failing) grade",
      [tySubB.status, tySubB.replayed, tySubB.score, tySubB.attemptId],
      ["attempt_written", true, 0, rv2Id("uTB", pidTy)]);
  check("RC TYPED: each student owns a SEPARATE grading job under their OWN key",
      [(await jobRef("uTA").get()).exists, (await jobRef("uTA").get()).data().uid,
        (await jobRef("uTB").get()).exists, (await jobRef("uTB").get()).data().uid,
        (await db.collection("grading_jobs").doc(`rv2_${pidTy}`).get()).exists],
      [true, "uTA", true, "uTB", false]);
  check("RC TYPED: each job cached the grade of ITS OWN presentation, and each sheet was graded once",
      [(await jobRef("uTA").get()).data().payload.source, (await jobRef("uTA").get()).data().payload.presentationId,
        (await jobRef("uTB").get()).data().payload.source, (await jobRef("uTB").get()).data().payload.presentationId,
        rcGraderCalls - callsBeforeTyped],
      ["reviewV2", pidTy, "reviewV2", pidTy, 2]);
  check("RC TYPED: the attempts carry their own owner, grade and server-ai provenance",
      [(await attRef("uTA", pidTy).get()).data().studentId, (await attRef("uTA", pidTy).get()).data().score,
        (await attRef("uTA", pidTy).get()).data().correctnessSource,
        (await attRef("uTB", pidTy).get()).data().studentId, (await attRef("uTB", pidTy).get()).data().score],
      ["uTA", 100, "server-ai", "uTB", 0]);

  // ---- third party / teacher naming the VICTIM's FULL uid-scoped key ------
  // The uid in the key buys NO secrecy: a classmate (and a teacher) can NAME
  // `rv2_{uA}_{pid}`. [SUPERSEDED MECHANISM — NTF 19+22, CASE GR above pins
  // the replacement] "claim it through the LIVE grader" was true pre-guard
  // (index.js:1048-1051 then) but is refused UNCONDITIONALLY now
  // (index.js:1170-1171) before claimOrRecoverGradingJob is ever reached, for
  // any caller — so the Anthropic stub and the `liveGradeC` helper that alone
  // drove it are gone. The fence that must hold is unchanged: the job's `uid`
  // FIELD, and the victim must fail CLOSED rather than consume a foreign
  // grade — the same law as CASE TX C6, restated against the NEW key shape so
  // a scoping change cannot quietly retire it. Seeded directly (Admin SDK /
  // a pre-existing doc is the residual reachability the mouth guard doesn't
  // cover, per typedGrading.js's own A1/A2 header).
  const thirdA = await composeTy("uTA", "lap-key-rc-3p-a");
  const thirdB = await composeTy("uTB", "lap-key-rc-3p-b");
  const pid3p = thirdA.presentation.presentationId;
  check("RC THIRD PARTY setup: both students compose, still sharing one presentationId",
      [thirdA.status, thirdB.status, thirdB.presentation.presentationId],
      ["composed", "composed", pid3p]);
  await db.collection("grading_jobs").doc(rv2Id("uTA", pid3p)).set({
    uid: "uTB", status: "graded", version: 1,
    payload: {results: thirdA.presentation.presentedWordIds.map((w) => ({wordId: w, isCorrect: true, reasoning: ""}))},
  });
  check("RC THIRD PARTY: the job at A's full uid-scoped key names B's uid (the fence under test)",
      (await db.collection("grading_jobs").doc(rv2Id("uTA", pid3p)).get()).data().uid, "uTB");
  const victimErr = await submitTyErr("uTA", pid3p, good(thirdA.presentation.presentedWordIds));
  checkTrue("RC THIRD PARTY: A's submit fails CLOSED on the foreign-uid job (never consumed)",
      String(victimErr).includes("permission-denied"));
  check("RC THIRD PARTY: …and mints nothing", (await attRef("uTA", pid3p).get()).exists, false);
  check("RC THIRD PARTY: B's OWN key is untouched — B still lands normally",
      [(await submitTy("uTB", pid3p, good(thirdB.presentation.presentedWordIds))).status,
        (await db.collection("grading_jobs").doc(rv2Id("uTB", pid3p)).get()).data().uid],
      ["attempt_written", "uTB"]);
  // …and the same, by a TEACHER account (identity, not role).
  const teachA = await composeTy("uTA", "lap-key-rc-tp-a");
  await composeTy("uTB", "lap-key-rc-tp-b"); // keep the two students in lockstep
  const pidTp = teachA.presentation.presentationId;
  await db.collection("grading_jobs").doc(rv2Id("uTA", pidTp)).set({
    uid: "uTeachC", status: "graded", version: 1,
    payload: {results: teachA.presentation.presentedWordIds.map((w) => ({wordId: w, isCorrect: true, reasoning: ""}))},
  });
  check("RC TEACHER: the seeded job names the TEACHER's uid",
      (await db.collection("grading_jobs").doc(rv2Id("uTA", pidTp)).get()).data().uid, "uTeachC");
  const teachErr = await submitTyErr("uTA", pidTp, good(teachA.presentation.presentedWordIds));
  checkTrue("RC TEACHER: the student's submit refuses the teacher-poisoned key too",
      String(teachErr).includes("permission-denied"));
  check("RC TEACHER: …and mints nothing", (await attRef("uTA", pidTp).get()).exists, false);
  // A third party writing an ATTEMPT at the victim's full uid-scoped id gains
  // nothing either: provenance still comes from the CONTENT (A4), not the name.
  await attRef("uTA", pidTp).set({...engineShapeFor("uTB", pidTp, 100), classId: "cTy"});
  check("RC THIRD PARTY (attempts): a doc planted at A's id but naming B is refused for A",
      await submitTy("uTA", pidTp, good(teachA.presentation.presentedWordIds)), REFUSAL_RC);

  TG._typedSeam.grade = null;
}

// ===========================================================================
CASE("TG — completeDay wordId↔presentation binding [A3 · Codex r78 item 3]");
{
  await wipeEmulator();
  const GS = ["uG0", "uG1", "uG2", "uG3", "uG4", "uG5", "uG6"];
  // ONE CLASS PER STUDENT — kept from when it was load-bearing, and the reason
  // is recorded because it no longer is: the engine's presentationId is
  // `{classId}_{listId}_d{day}_e{epoch}_p{seq}` with NO uid component
  // (presentations.js:445 · composer.js:82-84) and it STILL has none, so two
  // students in one class still share a presentationId. What changed
  // [rv2-docid-collision A1] is that the GLOBAL ids derived from it are now
  // uid-scoped (composer.js `engineDocId`), so a shared class would no longer
  // collide here. The isolation stays anyway: this case is about the wordId
  // binding, and the collision has its own fixtures (CASE RC + CASE TR (10)).
  await seedConfig({rehearsalClassIds: GS.map((u) => `cG_${u}`), queueSize: 6, testSize: 4});
  for (const u of GS) await seedClass(`cG_${u}`, {students: [u], listId: "LGG"});
  await seedWords("LGG", 30);
  const commonFor = (uid) => ({classId: `cG_${uid}`, listId: "LGG", clientContractVersion: 1});
  /** One student with a composed, PASSING day-3 review attempt. */
  const setup = async (uid) => {
    await seedProgress(uid, `cG_${uid}`, "LGG", {csd: 2, twi: 10});
    const c = await call(CALL.reviewV2ComposeSession, uid,
        {...commonFor(uid), logicalDay: 3, composeKey: `lap-key-tg-${uid}`});
    if (c.status !== "composed") throw new Error(`TG setup compose ${uid}: ${JSON.stringify(c)}`);
    const pid = c.presentation.presentationId;
    const ids = c.presentation.presentedWordIds;
    const queue = c.queue.orderedQueueWordIds;
    const s = await call(CALL.reviewV2SubmitAttempt, uid, {presentationId: pid, clientContractVersion: 1,
      answers: ids.map((w) => ({wordId: w, studentResponse: `def${w.slice(1)}`}))});
    if (s.status !== "attempt_written" || s.passed !== true) {
      throw new Error(`TG setup submit ${uid}: ${JSON.stringify(s)}`);
    }
    return {pid, ids, queue, attemptId: rv2Id(uid, pid),
      unpresented: queue.filter((w) => !ids.includes(w))};
  };
  const done = (uid, attemptId) => call(CALL.reviewV2CompleteDay, uid, {...commonFor(uid), logicalDay: 3,
    consumedAttemptId: attemptId, consumedAttemptClassId: `cG_${uid}`, newTestAttemptId: null});
  /** Make a queue word INELIGIBLE for fill, so "did it graduate?" answers only
   *  the tested-correct question the binding governs. */
  const makeFillIneligible = (uid, wordId) => db.doc(`users/${uid}/study_states/${wordId}`)
      .set({reviewFailCount: 1, reviewLastFailedAt: Timestamp.now(), reviewLastProvenAt: null}, {merge: true});

  // ---- CONTROL: an untouched engine attempt graduates exactly as before ----
  const c0 = await setup("uG0");
  let r = await done("uG0", c0.attemptId);
  check("TG control: the engine day completes", [r.status, r.evidenceKind], ["completed", "list_end_review_only"]);
  check("TG control: an all-correct sheet graduates the WHOLE pinned queue",
      [...r.graduatedWordIds].sort().join(","), [...c0.queue].sort().join(","));
  checkTrue("TG control: the presented words graduated", c0.ids.every((w) => r.graduatedWordIds.includes(w)));

  // ---- C8(a) SUBSTITUTED wordId: a row renamed to an UNPRESENTED queue word -
  const c1 = await setup("uG1");
  const ghost1 = c1.unpresented[0];
  await makeFillIneligible("uG1", ghost1);
  const rows1 = c1.ids.map((w) => ({wordId: w, isCorrect: true}));
  rows1[0] = {wordId: ghost1, isCorrect: true};
  await db.collection("attempts").doc(c1.attemptId).update({answers: rows1});
  r = await done("uG1", c1.attemptId);
  check("TG substituted wordId: the day still completes", r.status, "completed");
  check("TG substituted wordId does NOT graduate (never presented)",
      r.graduatedWordIds.includes(ghost1), false);
  check("TG …and the row it replaced does not graduate either",
      r.graduatedWordIds.includes(c1.ids[0]), false);

  // ---- C8(b) EXTRA wordId appended (denominator kept consistent) ----------
  const c2 = await setup("uG2");
  const ghost2 = c2.unpresented[0];
  await makeFillIneligible("uG2", ghost2);
  const rows2 = [...c2.ids.map((w) => ({wordId: w, isCorrect: true})), {wordId: ghost2, isCorrect: true}];
  await db.collection("attempts").doc(c2.attemptId)
      .update({answers: rows2, totalQuestions: rows2.length, score: 100});
  r = await done("uG2", c2.attemptId);
  check("TG extra wordId: the day still completes", r.status, "completed");
  check("TG extra unpresented wordId does NOT graduate", r.graduatedWordIds.includes(ghost2), false);
  check("TG …and no id is graduated twice",
      r.graduatedWordIds.length, new Set(r.graduatedWordIds).size);

  // ---- C8(c) DUPLICATE wordId --------------------------------------------
  const c3 = await setup("uG3");
  const rows3 = [...c3.ids.map((w) => ({wordId: w, isCorrect: true})),
    {wordId: c3.ids[0], isCorrect: true}];
  await db.collection("attempts").doc(c3.attemptId)
      .update({answers: rows3, totalQuestions: rows3.length, score: 100});
  r = await done("uG3", c3.attemptId);
  check("TG duplicate wordId: completes, and the graduated set stays a SET",
      [r.status, r.graduatedWordIds.length === new Set(r.graduatedWordIds).size], ["completed", true]);

  // ---- C8(d) REORDERED rows: order is not identity ------------------------
  const c4 = await setup("uG4");
  await db.collection("attempts").doc(c4.attemptId)
      .update({answers: [...c4.ids].reverse().map((w) => ({wordId: w, isCorrect: true}))});
  r = await done("uG4", c4.attemptId);
  check("TG reordered rows graduate the SAME set (order is not identity)",
      [r.status, [...r.graduatedWordIds].sort().join(",")],
      ["completed", [...c4.queue].sort().join(",")]);

  // ---- C8(e) RERUN evidence never reaches the seam ------------------------
  const c5 = await setup("uG5");
  await db.collection("attempts").doc(c5.attemptId).update({type: "retest"});
  r = await done("uG5", c5.attemptId);
  check("TG a RERUN attempt is refused as evidence before graduation runs",
      [r.status, r.reason], ["no_evidence", "consumed attempt not a live review"]);

  // ---- C8(f) THE LIVE-REGRESSION CONTROL: legacy is UNAFFECTED ------------
  await seedProgress("uG6", "cG_uG6", "LGG", {csd: 2, twi: 10});
  const legacyRows = ["w0", "w1", "w2", "w3"];
  await db.collection("attempts").doc("legacy_review_uG6").set({
    studentId: "uG6", classId: "cG_uG6", listId: "LGG", studyDay: 3, sessionType: "review",
    testType: "mcq", score: 100, passed: true, totalQuestions: legacyRows.length,
    answers: legacyRows.map((w) => ({wordId: w, isCorrect: true})),
    submittedAt: Timestamp.now(),
  });
  r = await done("uG6", "legacy_review_uG6");
  check("TG LEGACY (epoch-less, presentation-less) evidence still completes",
      [r.status, r.completion.postureSource, r.completion.legacyEvidence],
      ["completed", "completion_legacy", true]);
  check("TG LEGACY graduates from its OWN rows — the fence is inert for it",
      [...r.graduatedWordIds].sort().join(","), [...legacyRows].sort().join(","));
}

// ===========================================================================
CASE("H — THE FLIP: value-verified REAL cycling receipt, atomic window [C6]");
{
  await wipeEmulator();
  await seedConfig();
  const scratch = "/tmp/engine-lap-flip";
  rmSync(scratch, {recursive: true, force: true});
  mkdirSync(scratch, {recursive: true});
  const run = (args, env = {}) => spawnSync("node", ["scripts/deepfix2/flip-review-v2.mjs", ...args],
      {cwd: "/app", env: {...process.env, ...env}, encoding: "utf8"});
  const w = (name, obj) => { const pth = join(scratch, name); writeFileSync(pth, JSON.stringify(obj)); return pth; };

  // A REAL CYCLING chain [r72 C6 — the ordered B4→B1→B3→B4 receipt]: mini
  // cohort → B1 → B3 → a POST-WATERMARK attempt (the live delta) → driver
  // (B4 exit 6 → B1 → B3 → B4 PASS ⇒ stages B4,B1,B3,B4; cycles 2).
  const lapRoot = "/tmp/engine-lap-trackb";
  rmSync(lapRoot, {recursive: true, force: true});
  mkdirSync(lapRoot, {recursive: true});
  const allowPath = join(lapRoot, "allowlist.json");
  writeFileSync(allowPath, JSON.stringify(["cls-flip-1"]));
  await db.collection("classes").doc("cls-flip-1").set({name: "FLIP LAP", studentIds: ["fA", "fB"]});
  const att = (id, uid, dayOff, type, rows, score, tMs) => db.collection("attempts").doc(id).set({
    studentId: uid, classId: "cls-flip-1", listId: "LF", sessionType: type,
    submittedAt: TS(tMs ?? (Date.parse("2026-06-01T00:00:00Z") + dayOff * DAY)),
    graded: true, score, totalQuestions: rows.length, dayNumber: 1,
    answers: rows.map(([wd, c]) => ({wordId: wd, isCorrect: c})),
  });
  await att("fa1", "fA", 1, "new", [["v1", true], ["v2", true]], 100);
  await att("fa2", "fA", 2, "review", [["v1", true], ["v2", false]], 50);
  await att("fb1", "fB", 1, "new", [["v3", true]], 100);
  const trackB = (script, extra) => spawnSync(process.execPath, [join("/app/scripts/deepfix2", script), ...extra],
      {cwd: "/app", env: {...process.env, DEEPFIX_AUDIT_ROOT: lapRoot}, encoding: "utf8", maxBuffer: 64 * 1024 * 1024});
  const b1r = trackB("b1-expected-labels.mjs", ["--full", `--classAllowlist=${allowPath}`]);
  check("mini B1 green", b1r.status, 0);
  const manifest = join(lapRoot, "b1-manifest-full.json");
  const b3r = trackB("b3-backfill-writer.mjs", [`--classAllowlist=${allowPath}`, `--manifest=${manifest}`, "--runId=flip-seed", "--execute"]);
  check("mini B3 green", b3r.status, 0);
  await att("fa3", "fA", 0, "review", [["v2", true]], 100, Date.now()); // the live delta
  const receiptPath = join(scratch, "real-receipt.json");
  const drv = trackB("b-delta-cycle.mjs", [`--allow=${allowPath}`, `--manifest=${manifest}`, "--prefix=flipmicro", `--receipt=${receiptPath}`]);
  check("micro-lap driver PASS", drv.status, 0);
  checkTrue("REAL receipt exists", existsSync(receiptPath));
  const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
  check("receipt = the ORDERED CYCLING chain", [receipt.kind, receipt.failures, receipt.stages, receipt.cycles],
      ["trackB-micro-lap", 0, ["B4", "B1", "B3", "B4"], 2]);
  check("receipt hashes all seven sources", Object.keys(receipt.sourceShas).length, 7);

  // REFUSAL BATTERY [r72 — value-level, derived from the REAL receipt]:
  let r = run(["--execute", "--yes-i-am-david", "--lapReceipt", w("bare-pass.json", {pass: true})]);
  check("bare pass:true refused", r.status, 2);
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt", w("bare-failed0.json", {failed: 0})]);
  check("bare failed:0 refused", r.status, 2);
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt",
    w("stale.json", {...receipt, contentTimestamp: new Date(Date.now() - 3600000).toISOString()})]);
  check("stale content refused", r.status, 2);
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt",
    w("wrong-project.json", {...receipt, projectId: "someone-else"})]);
  check("wrong project refused", r.status, 2);
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt",
    w("single-b4.json", {...receipt, stages: ["B4"], cycles: 1})]);
  check("single-B4 chain refused", r.status, 2);
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt",
    w("failures.json", {...receipt, failures: 1})]);
  check("failures>0 refused", r.status, 2);
  const mutated = JSON.parse(JSON.stringify(receipt));
  const firstKey = Object.keys(mutated.sourceShas)[0];
  mutated.sourceShas[firstKey] = mutated.sourceShas[firstKey].slice(0, 15) +
    (mutated.sourceShas[firstKey].endsWith("0") ? "1" : "0");
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt", w("hash-mutated.json", mutated)]);
  check("HASH-MUTATED receipt refused [C6 value check]", r.status, 2);

  // Window blocks; then THE ACTIVATION with the REAL receipt.
  await db.doc("shadow_registry/window").set({generation: 1, runId: "x"});
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt", receiptPath]);
  check("window blocks the flip", r.status, 2);
  await db.doc("shadow_registry/window").delete();
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt", receiptPath]);
  check("ACTIVATION with the real cycling receipt", r.status, 0);
  let cfg = (await db.doc(CONFIG_PATH).get()).data();
  check("two fields TOGETHER", [cfg.enabled, cfg.firstEnabledAt != null], [true, true]);
  const markerMs = cfg.firstEnabledAt.toMillis();
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt", receiptPath]);
  check("re-activation refused", r.status, 2);
  r = run(["--kill", "--execute"]);
  check("kill needs no flag (emergency)", r.status, 0);
  cfg = (await db.doc(CONFIG_PATH).get()).data();
  check("kill: enabled only", [cfg.enabled, cfg.firstEnabledAt.toMillis()], [false, markerMs]);
  r = run(["--reenable", "--execute"]);
  check("reenable WITHOUT flag refused [L-4]", r.status, 2);
  r = run(["--reenable", "--execute", "--yes-i-am-david"]);
  check("reenable with flag", r.status, 0);
  cfg = (await db.doc(CONFIG_PATH).get()).data();
  check("reenable: marker untouched", [cfg.enabled, cfg.firstEnabledAt.toMillis()], [true, markerMs]);
  await seedConfig({rehearsalClassIds: ["c25WT"]});
  r = run([]);
  check("rehearsal list blocks (dry)", r.status, 2);
}

// ===========================================================================
const HERE = dirname(fileURLToPath(import.meta.url));
const sourceShas = {};
for (const f of ["../../functions/reviewV2/config.js", "../../functions/reviewV2/composer.js",
  "../../functions/reviewV2/presentations.js", "../../functions/reviewV2/stamping.js",
  "../../functions/reviewV2/completion.js", "../../functions/reviewV2/monitoring.js",
  "../../functions/reviewV2/typedGrading.js",
  "../../functions/reviewV2/reset.js", "../../functions/reviewV2/visits.js",
  "../../functions/reviewV2/callables.js", "../../functions/reviewV2/progress.js",
  "../../functions/foundation.js", "../../functions/index.js", "../../src/services/db.js",
  "engine-emulator-lap.mjs", "flip-review-v2.mjs", "b-delta-cycle.mjs"]) {
  const p = join(HERE, f);
  sourceShas[f.replace(/^\.\.\/\.\.\//, "")] =
    createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
}
const receiptPath = process.env.ENGINE_LAP_RECEIPT || "/app/docs/plans/deepfix2/evidence/engine-lap-result.json";
const summary = {
  kind: "engine-emulator-lap", version: 3,
  pass: failed === 0, total, failed, reds,
  sourceShas,
  at: new Date().toISOString(),
};
writeFileSync(receiptPath, JSON.stringify(summary, null, 2));
console.log(`\n==== ENGINE LAP v3: ${total - failed}/${total} green${failed ? ` — ${failed} RED` : ""} (receipt: ${receiptPath})`);
if (failed) reds.forEach((x) => console.error("RED: " + x));
await fft.cleanup();
process.exit(failed ? 1 : 0);
