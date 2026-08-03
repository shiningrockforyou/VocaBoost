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
  const attDoc = (await db.collection("attempts").doc(`rv2_${presId}`).get()).data();
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
  const newAtt = (await db.collection("attempts").doc(`rv2_${newPresId}`).get()).data();
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
    consumedAttemptId: `rv2_${retake.presentation.presentationId}`, consumedAttemptClassId: "cX",
    newTestAttemptId: `rv2_${newPresId}`});
  check("completes through callable", [r.status, r.evidenceKind, r.advancedToDay, r.newTwi], ["completed", "standard", 3, 20]);
  const again = await call(CALL.reviewV2CompleteDay, "uX", {...common, logicalDay: 3,
    consumedAttemptId: `rv2_${retake.presentation.presentationId}`, consumedAttemptClassId: "cX",
    newTestAttemptId: `rv2_${newPresId}`});
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
  const blankTypedAtt = (await db.collection("attempts").doc(`rv2_${blankTypedPid}`).get()).data();
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
  const attemptDoc = (pid) => db.collection("attempts").doc(`rv2_${pid}`).get();
  const jobDoc = (pid) => db.collection("grading_jobs").doc(`rv2_${pid}`).get();

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
  await db.collection("grading_jobs").doc(`rv2_${pid1}`).delete();
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
  await db.collection("attempts").doc(`rv2_${pid4}`).update({answers: adjudicated});
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
    await db.collection("grading_jobs").doc(`rv2_${pid5}`)
        .set({leaseId: "another-worker", leaseExpiresAt: Date.now() - 1000}, {merge: true});
    return answers.map((a) => ({wordId: a.wordId, isCorrect: true, reasoning: ""}));
  };
  r = await submitT(pid5, answersFor(ids5));
  check("a superseded grade is FAIL-CLOSED as DATA", r, {status: "grading_in_progress"});
  check("a superseded grade mints NO attempt", (await attemptDoc(pid5)).exists, false);
  const noEv = await call(CALL.reviewV2CompleteDay, "uT", {...common, logicalDay: 3,
    consumedAttemptId: `rv2_${pid5}`, consumedAttemptClassId: "cT", newTestAttemptId: null});
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
    consumedAttemptId: `rv2_${pid1}`, consumedAttemptClassId: "cT", newTestAttemptId: `rv2_${npid}`});
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
