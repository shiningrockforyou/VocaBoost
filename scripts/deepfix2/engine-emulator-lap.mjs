#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — engine-emulator-lap.mjs: the DARK-BUILD ENGINE REHEARSAL
 * ============================================================================
 * Drives the functions/reviewV2 engine modules end-to-end against the
 * Firestore EMULATOR (never production — FATAL without
 * FIRESTORE_EMULATOR_HOST). The callable HTTP layer (auth/fences) is thin
 * and gets its live exercise in the stage-3 25WT rehearsal; THIS lap proves
 * the engine transactions: config posture matrix · the cursor-chained
 * composer (§2/§2b) · the presentation claim registry (§3) · the label
 * writer (§1/R2-32/R2-48) · the completion CAS + graduation + streak (§3b) ·
 * reset cleanup (§9 leg 3) · monitoring quarantine (16_ r64) · THE R2-48
 * FLIP TXN (the choreography rehearsal, 14_ §4).
 *
 * RUNBOOK (same as b-emulator-lap.mjs):
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/engine-emulator-lap.mjs"
 *
 * MODULE-INSTANCE LAW: every require (engine modules AND firebase-admin) is
 * pinned to functions/node_modules via createRequire — cross-instance
 * FieldValue sentinels fail instanceof validation, so ONE instance serves
 * both the lap's db handle and the modules' sentinels.
 *
 * Exit 0 = every check green; 1 = reds (listed); 2 = precondition FATAL.
 * Receipt JSON → $ENGINE_LAP_RECEIPT (default /tmp/engine-lap-receipt.json).
 */

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FATAL: FIRESTORE_EMULATOR_HOST not set — this lap runs ONLY against the emulator");
  process.exit(2);
}

const fnRequire = createRequire("/app/functions/index.js");
const {initializeApp, cert} = fnRequire("firebase-admin/app");
const {getFirestore, Timestamp, FieldValue} = fnRequire("firebase-admin/firestore");
const CFG = fnRequire("/app/functions/reviewV2/config.js");
const COMP = fnRequire("/app/functions/reviewV2/composer.js");
const PRES = fnRequire("/app/functions/reviewV2/presentations.js");
const STAMP = fnRequire("/app/functions/reviewV2/stamping.js");
const DONE = fnRequire("/app/functions/reviewV2/completion.js");
const VIS = fnRequire("/app/functions/reviewV2/visits.js");
const RESET = fnRequire("/app/functions/reviewV2/reset.js");
const MON = fnRequire("/app/functions/reviewV2/monitoring.js");

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({credential: cert(key)});
const db = getFirestore();

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
    assignments: {[listId]: {name: "seed", ...asg}},
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
const iw = (from, to) => Array.from({length: to - from + 1}, (_, k) => ({wordId: `w${from + k}`, wordIndex: from + k}));

// ---------------------------------------------------------------------------
CASE("A — config posture matrix");
{
  const uidA = "uA";
  let c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("cold start ⇒ hold", c.readStatus, "hold");
  await seedConfig();
  await seedClass("cA", {students: [uidA]});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1", uid: uidA});
  check("dark posture", [c.readStatus, c.stampingEligible, c.gateEffectiveEnabled, c.enrolled], ["ok", false, false, true]);
  await seedConfig({rehearsalClassIds: ["cA"]});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("rehearsal ⇒ eligible + ON while dark", [c.stampingEligible, c.gateEffectiveEnabled, c.rehearsalClass], [true, true, true]);
  await seedConfig({firstEnabledAt: Timestamp.fromMillis(NOW), enabled: true});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("marker ⇒ eligible", [c.stampingEligible, c.gateEffectiveEnabled], [true, true]);
  await seedConfig({enabled: false, firstEnabledAt: Timestamp.fromMillis(NOW)});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("kill window: eligible, gate OFF", [c.stampingEligible, c.gateEffectiveEnabled], [true, false]);
  await db.doc(CONFIG_PATH).set({enabled: "yes"});
  c = await CFG.resolveReviewConfig(db, {classId: "cA", listId: "L1"});
  check("malformed ⇒ hold", c.readStatus, "hold");
}

// ---------------------------------------------------------------------------
CASE("B — the cursor-chained composer");
{
  const uid = "uB";
  await seedConfig({rehearsalClassIds: ["cB1", "cB2"], queueSize: 4});
  await seedClass("cB1", {students: [uid]});
  await seedClass("cB2", {students: [uid]});
  await seedWords("L1", 10);
  const base = {uid, listId: "L1", resetEpoch: 0, anchorNwei: 9, generation: "s8e9"};

  let r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 2, introducedWords: iw(0, 7)});
  check("first compose", [r.status, r.queue.orderedQueueWordIds, r.cursorAdvanced], ["created", ["w0", "w1", "w2", "w3"], true]);
  let cur = (await db.doc(`users/${uid}/review_cursors/L1_e0`).get()).data();
  check("cursor after d2", [cur.cursorWordIndex, cur.lastLogicalDay], [3, 2]);
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 2, introducedWords: iw(0, 7)});
  check("replay ⇒ exists", r.status, "exists");
  // Same-day cross-class reuse: cB2 has a SMALLER configured size (2) — the
  // r62 law: content verbatim, snapshot.queueSize = |reused|, own size audit.
  await db.doc("classes/cB2").set({assignments: {L1: {reviewQueueSize: 2}}}, {merge: true});
  r = await COMP.composeDayQueue(db, {...base, classId: "cB2", logicalDay: 2, introducedWords: iw(0, 7)});
  check("same-day reuse verbatim", [r.status, r.reused, r.queue.orderedQueueWordIds], ["created", true, ["w0", "w1", "w2", "w3"]]);
  check("reuse snapshot truth", [r.queue.snapshot.queueSize, r.queue.snapshot.configQueueSize], [4, 2]);
  cur = (await db.doc(`users/${uid}/review_cursors/L1_e0`).get()).data();
  check("reuse: cursor untouched", [cur.cursorWordIndex, cur.lastLogicalDay], [3, 2]);
  // Forward advance wraps.
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 3, introducedWords: iw(0, 7)});
  check("d3 sweep", r.queue.orderedQueueWordIds, ["w4", "w5", "w6", "w7"]);
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 4, introducedWords: iw(0, 7)});
  check("d4 wrap", r.queue.orderedQueueWordIds, ["w0", "w1", "w2", "w3"]);
  // Backward compose refused.
  r = await COMP.composeDayQueue(db, {...base, classId: "cB2", logicalDay: 3, introducedWords: iw(0, 7)});
  check("day guard", r.status, "day_guard_rejected");
  // Underflow top-up: rest w0..w5 (w1 earliest) ⇒ active w6,w7 + earliest-graduated fill.
  const batch = db.batch();
  for (let i = 0; i <= 5; i++) {
    batch.set(db.doc(`users/${uid}/study_states/w${i}`),
        {reviewRestingUntil: Timestamp.fromMillis(NOW + (i === 1 ? 1 : 5 + i) * DAY)}, {merge: true});
  }
  await batch.commit();
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 5, introducedWords: iw(0, 7)});
  check("underflow top-up", [r.queue.orderedQueueWordIds, r.activeCount, r.topUpCount],
      [["w6", "w7", "w1", "w0"], 2, 2]); // rests: w1=1d < w0=5d < w2..w5 — earliest-graduated first
  cur = (await db.doc(`users/${uid}/review_cursors/L1_e0`).get()).data();
  check("underflow cursor = last ACTIVE", cur.cursorWordIndex, 7);
  // Reset fence.
  await db.doc(`users/${uid}/progress_meta/L1`).set({resetEpoch: 0, resetInProgress: {opId: "x", at: Timestamp.now()}});
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 6, introducedWords: iw(0, 7)});
  check("reset lock rejects", r.status, "reset_in_progress");
  await db.doc(`users/${uid}/progress_meta/L1`).set({resetEpoch: 1});
  r = await COMP.composeDayQueue(db, {...base, classId: "cB1", logicalDay: 6, introducedWords: iw(0, 7)});
  check("epoch drift rejects", [r.status, r.currentEpoch], ["reset_epoch_mismatch", 1]);
  await db.doc(`users/${uid}/progress_meta/L1`).delete();
}

// ---------------------------------------------------------------------------
CASE("C — the presentation claim registry");
{
  const uid = "uB"; // reuse the composed queues
  const base = {uid, classId: "cB1", listId: "L1", logicalDay: 2, resetEpoch: 0};
  const idx = {}; for (let i = 0; i < 8; i++) idx[`w${i}`] = i;
  let p = await PRES.composePresentation(db, {...base, composeKey: "lap-key-0001", mode: "live-review", wordIndexByWordId: idx});
  check("live claim", [p.status, p.seq, p.presentationId.endsWith("_p1")], ["created", 1, true]);
  const q = (await db.doc(`users/${uid}/review_queues/cB1_L1_d2_e0`).get()).data();
  check("presentationCount incremented", q.presentationCount, 1);
  check("modality from snapshot", p.presentation.testType, "mcq");
  check("presented ⊆ queue, size = min(testSize,|q|)", [p.presentation.presentedWordIds.length,
    p.presentation.presentedWordIds.every((w) => q.orderedQueueWordIds.includes(w))], [4, true]);
  const p2 = await PRES.composePresentation(db, {...base, composeKey: "lap-key-0001", mode: "live-review", wordIndexByWordId: idx});
  check("composeKey replay", [p2.status, p2.presentationId], ["replayed", p.presentationId]);
  const p3 = await PRES.composePresentation(db, {...base, logicalDay: 3, composeKey: "lap-key-0001", mode: "live-review", wordIndexByWordId: idx});
  check("reused key ⇒ typed refusal", p3.status, "compose_key_reused");
  check("invalid token", (await PRES.composePresentation(db, {...base, composeKey: "no!", mode: "live-review", wordIndexByWordId: idx})).status, "invalid_compose_key");
  // Rerun counter allocator: 1 then 2, no count queries.
  const rr = {...base, logicalDay: 2, mode: "rerun-review", poolWordIds: ["w0", "w1", "w2", "w3", "w4"], testSize: 3, testType: "mcq", visitId: "v1"};
  const r1 = await PRES.composePresentation(db, {...rr, composeKey: "lap-key-r001"});
  const r2 = await PRES.composePresentation(db, {...rr, composeKey: "lap-key-r002"});
  check("rerun seqs 1,2", [r1.seq, r2.seq, r1.presentationId.endsWith("_r1"), r2.presentationId.endsWith("_r2")], [1, 2, true, true]);
  const counter = (await db.doc(`users/${uid}/review_counters/cB1_L1_d2_e0_r`).get()).data();
  check("allocator next", counter.next, 3);
  check("rerun shape", [r1.presentation.queueRef, r1.presentation.compositionVersion, r1.presentation.visitId], [null, "rerun-random", "v1"]);
}

// ---------------------------------------------------------------------------
CASE("D — the label writer in a real txn");
{
  const uid = "uD";
  const cfgEligible = await CFG.resolveReviewConfig(db, {classId: "cB1", listId: "L1"}); // rehearsal ⇒ eligible
  const rows = [
    {wordId: "w0", isCorrect: true},
    {wordId: "w1", isCorrect: false},
    {wordId: "w2", isCorrect: false, blank: true},
  ];
  await db.runTransaction(async (txn) => {
    const r = STAMP.stampLabelsInTxn(txn, db, {uid, config: cfgEligible, rows,
      presentedWordIds: ["w0", "w1", "w2"], isReviewType: true, isPassing: true});
    check("stamped 3", r.stamped, 3);
  });
  const w0 = (await db.doc(`users/${uid}/study_states/w0`).get()).data();
  const w1 = (await db.doc(`users/${uid}/study_states/w1`).get()).data();
  check("correct word fields", [Boolean(w0.reviewLastCorrectAt), Boolean(w0.reviewLastProvenAt), Boolean(w0.reviewLastTestedAt), w0.reviewFailCount ?? null, w0.reviewLastFailedAt ?? null],
      [true, true, true, null, null]);
  check("failed word fields", [w1.reviewFailCount, Boolean(w1.reviewLastFailedAt), Boolean(w1.reviewLastTestedAt), w1.reviewLastCorrectAt ?? null], [1, true, true, null]);
  await db.runTransaction(async (txn) => {
    STAMP.stampLabelsInTxn(txn, db, {uid, config: cfgEligible, rows: [{wordId: "w1", isCorrect: false}],
      presentedWordIds: ["w1"], isReviewType: true, isPassing: false});
  });
  check("fc increments", (await db.doc(`users/${uid}/study_states/w1`).get()).data().reviewFailCount, 2);
  // Dark writer: zero writes.
  const darkCfg = {...cfgEligible, stampingEligible: false};
  await db.runTransaction(async (txn) => {
    const r = STAMP.stampLabelsInTxn(txn, db, {uid: "uDark", config: darkCfg, rows,
      presentedWordIds: ["w0", "w1", "w2"], isReviewType: true, isPassing: true});
    check("dark ⇒ not_eligible", r.skipped, "not_eligible");
  });
  check("dark ⇒ no doc", (await db.doc("users/uDark/study_states/w0").get()).exists, false);
}

// ---------------------------------------------------------------------------
CASE("E — completion CAS + graduation + streak + visit pair");
{
  const uid = "uE";
  await seedConfig({rehearsalClassIds: ["cE"], queueSize: 60, testSize: 30});
  await seedClass("cE", {students: [uid], listId: "LE"});
  await seedWords("LE", 60);
  // The day's pinned queue (seeded directly — composer already lap-proven).
  const Q = Array.from({length: 60}, (_, i) => `w${i}`);
  await db.doc(`users/${uid}/review_queues/cE_LE_d5_e0`).set({
    uid, classId: "cE", listId: "LE", logicalDay: 5, resetEpoch: 0,
    algorithmVersion: 1, configVersion: 1, anchorNwei: 49, generation: "s40e49",
    orderedQueueWordIds: Q, poolHash: "x", snapshot: {threshold: 92, queueSize: 60, testSize: 30, reviewTestType: "mcq", reviewGateEnabled: true},
    presentationCount: 0, createdAt: Timestamp.now(),
  });
  const presented = Q.slice(0, 30);
  await db.doc(`users/${uid}/review_presentations/cE_LE_d5_e0_p1`).set({
    uid, classId: "cE", listId: "LE", logicalDay: 5, resetEpoch: 0,
    presentedWordIds: presented, poolHash: "x", compositionVersion: "lrt-v1",
    testType: "mcq", visitId: null, queueRef: `users/${uid}/review_queues/cE_LE_d5_e0`,
    serverClaim: {claimedAt: Timestamp.now(), attemptDocId: null}, createdAt: Timestamp.now(),
  });
  const answers = presented.map((w, i) => ({wordId: w, isCorrect: i < 28, ...(i >= 28 ? {blank: true} : {})}));
  await db.collection("attempts").doc("attE1").set({
    studentId: uid, classId: "cE", listId: "LE", studyDay: 5, sessionType: "review",
    testType: "mcq", score: 93, passed: true, totalQuestions: 30, answers,
    presentationId: "cE_LE_d5_e0_p1", resetEpoch: 0, submittedAt: Timestamp.now(),
  });
  await db.collection("attempts").doc("attE2").set({
    studentId: uid, classId: "cE", listId: "LE", studyDay: 5, sessionType: "new",
    score: 95, passed: true, submittedAt: Timestamp.now(),
  });
  const params = {uid, winningClassId: "cE", listId: "LE", logicalDay: 5, resetEpoch: 0,
    anchorNwei: 49, generation: "s40e49", consumedAttemptId: "attE1",
    consumedAttemptClassId: "cE", newTestAttemptId: "attE2", nowMs: NOW};
  let r = await DONE.completeDay(db, params);
  // graduation: min(floor(60×0.93)=55, 28 correct + 30 eligible unpresented) = 55
  check("standard completes", [r.status, r.evidenceKind, r.graduationCount, r.correctCount, r.eligibleFillCount, r.streakCredited],
      ["completed", "standard", 55, 28, 30, true]);
  const doneDoc = (await db.doc(`users/${uid}/day_completions/LE_d5_e0`).get()).data();
  check("hash law", doneDoc.graduatedWordIdsHash,
      createHash("sha256").update(JSON.stringify(doneDoc.graduatedWordIds)).digest("hex"));
  check("rru minted (twin law)", (await db.doc(`users/${uid}/study_states/${doneDoc.graduatedWordIds[0]}`).get()).data().reviewRestingUntil.toMillis(),
      NOW + 21 * DAY);
  const rruCount = (await db.collection(`users/${uid}/study_states`).where("reviewRestingUntil", "==", Timestamp.fromMillis(NOW + 21 * DAY)).get()).size;
  check("rru count = graduationCount", rruCount, 55);
  r = await DONE.completeDay(db, params);
  check("loser ⇒ already_completed", [r.status, r.completion.evidenceKind], ["already_completed", "standard"]);
  // Both-null gate-ON day>1 refused.
  r = await DONE.completeDay(db, {...params, logicalDay: 6, consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: null});
  check("both-null ON refused", r.status, "no_evidence");
  // OFF-source autopass: assignment gate OFF ⇒ kind gate_off_autopass, zero graduation.
  await db.doc("classes/cE").set({assignments: {LE: {reviewGateEnabled: false}}}, {merge: true});
  r = await DONE.completeDay(db, {...params, logicalDay: 6, consumedAttemptId: null, consumedAttemptClassId: null, nowMs: NOW + DAY});
  check("OFF autopass", [r.status, r.evidenceKind, r.graduationCount, r.sourceConfig.gateEffectiveEnabled],
      ["completed", "gate_off_autopass", 0, false]);
  // Field-path update REPLACES the assignment map (set-merge would deep-merge
  // and keep reviewGateEnabled:false — the gate must be back ON here).
  await db.doc("classes/cE").update({"assignments.LE": {name: "seed"}});
  // Rerun graduation + the visit pair CAS.
  const mv = await VIS.mintRestudyVisit(db, {uid, classId: "cE", listId: "LE", day: 3, resetEpoch: 0});
  const cfgE = await CFG.resolveReviewConfig(db, {classId: "cE", listId: "LE"});
  await db.runTransaction(async (txn) => {
    const vSnap = await txn.get(db.doc(`users/${uid}/restudy_visits/${mv.visitId}`));
    const g = DONE.graduateRerunInTxn(txn, db, {uid, config: cfgE,
      rows: [{wordId: "w58", isCorrect: true}, {wordId: "w59", isCorrect: false}], nowMs: NOW});
    check("rerun graduates tested-correct", g.graduated, ["w58"]);
    const h1 = VIS.recordRerunHalfInTxn(txn, db, {uid, visitSnap: vSnap, half: "review", attemptId: "ra1"});
    check("first half", [h1.recorded, h1.completedVisit], [true, false]);
  });
  await db.runTransaction(async (txn) => {
    const vSnap = await txn.get(db.doc(`users/${uid}/restudy_visits/${mv.visitId}`));
    const h2 = VIS.recordRerunHalfInTxn(txn, db, {uid, visitSnap: vSnap, half: "new", attemptId: "na1"});
    check("second half completes", [h2.recorded, h2.completedVisit], [true, true]);
  });
  const pip = (await db.doc(`users/${uid}/restudy_completions/cE_LE_d3`).get()).data();
  check("pip counter", pip.count, 1);
}

// ---------------------------------------------------------------------------
CASE("F — reset stale-epoch cleanup");
{
  const uid = "uE"; // epoch-0 docs exist from CASE E
  const before = (await db.collection(`users/${uid}/day_completions`).where("listId", "==", "LE").get()).size;
  checkTrue("epoch-0 docs exist", before >= 1);
  const r = await RESET.deleteStaleEpochReviewV2Docs(db, {uid, listId: "LE", targetEpoch: 1});
  checkTrue("stale deleted", r.deleted >= before);
  check("current untouched rule (no epoch-1 existed)", (await db.collection(`users/${uid}/day_completions`).where("listId", "==", "LE").get()).size, 0);
  // A current-epoch doc survives a later cleanup.
  await db.doc(`users/${uid}/day_completions/LE_d1_e1`).set({uid, listId: "LE", logicalDay: 1, resetEpoch: 1});
  const r2 = await RESET.deleteStaleEpochReviewV2Docs(db, {uid, listId: "LE", targetEpoch: 1});
  check("epoch-1 kept", [(await db.doc(`users/${uid}/day_completions/LE_d1_e1`).get()).exists, r2.byCollection.day_completions], [true, 0]);
}

// ---------------------------------------------------------------------------
CASE("G — monitoring: stamps, window quarantine, breaches");
{
  await db.doc("shadow_registry/0").set({generation: 7, ids: ["uShadow"]});
  MON._resetRegistryCacheForTests();
  const m1 = await MON.recordOpsMetric(db, {type: "wall_rate", uid: "uShadow", payload: {v: 1}});
  const m2 = await MON.recordOpsMetric(db, {type: "wall_rate", uid: "uReal", payload: {v: 2}});
  check("stamps", [m1.shadow, m1.registryGeneration, m2.shadow], [true, 7, false]);
  // Plant a stale-stamped row (G−1) and an unstamped row.
  await db.collection("ops_metrics").add({type: "wall_rate", shadow: false, registryGeneration: 6, createdAt: Timestamp.now()});
  await db.collection("ops_metrics").add({type: "wall_rate", shadow: true, createdAt: Timestamp.now()});
  await db.doc("shadow_registry/window").set({generation: 7, startedAt: Timestamp.now(), runId: "lapG"});
  let ev = await MON.evaluateThresholds(db, {scope: "production", dryRun: true, thresholds: {wall_rate: {max: 0}}});
  check("prod window eval", [ev.status, ev.consumedRowCount, ev.quarantinedRowCount, ev.breaches.length], ["ok", 1, 2, 1]);
  ev = await MON.evaluateThresholds(db, {scope: "shadowAudit", dryRun: true, thresholds: {}});
  check("audit consumes window-gen shadow only", [ev.consumedRowCount, ev.quarantinedRowCount], [1, 2]);
  check("audit non-dry refused", (await MON.evaluateThresholds(db, {scope: "shadowAudit", dryRun: false})).status, "invalid_scope");
  await db.doc("shadow_registry/window").delete();
  ev = await MON.evaluateThresholds(db, {scope: "shadowAudit", dryRun: true});
  check("no window ⇒ typed refusal", ev.status, "no_audit_window");
  ev = await MON.evaluateThresholds(db, {scope: "production", dryRun: true, thresholds: {}});
  check("no window ⇒ no quarantine", ev.quarantinedRowCount, 0);
}

// ---------------------------------------------------------------------------
CASE("H — THE R2-48 FLIP TXN (choreography rehearsal)");
{
  await seedConfig(); // enabled:false, marker null, rehearsal []
  const receipt = "/tmp/lap-flip-receipt.json";
  writeFileSync(receipt, JSON.stringify({pass: true, lap: "engine-emulator-lap"}));
  const run = (args) => spawnSync("node", ["scripts/deepfix2/flip-review-v2.mjs", ...args],
      {cwd: "/app", env: {...process.env, NODE_PATH: "/app/functions/node_modules"}, encoding: "utf8"});
  let r = run([]);
  check("dry-run activation ok", r.status, 0);
  r = run(["--execute"]);
  check("execute without david-flag refused", r.status, 2);
  r = run(["--execute", "--yes-i-am-david"]);
  check("execute without receipt refused", r.status, 2);
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt", receipt]);
  check("ACTIVATION", r.status, 0);
  let cfg = (await db.doc(CONFIG_PATH).get()).data();
  check("two fields TOGETHER", [cfg.enabled, cfg.firstEnabledAt != null], [true, true]);
  const markerMs = cfg.firstEnabledAt.toMillis();
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt", receipt]);
  check("re-activation refused (marker moved never)", r.status, 2);
  r = run(["--kill", "--execute", "--yes-i-am-david"]);
  check("kill", r.status, 0);
  cfg = (await db.doc(CONFIG_PATH).get()).data();
  check("kill: enabled only", [cfg.enabled, cfg.firstEnabledAt.toMillis()], [false, markerMs]);
  r = run(["--reenable", "--execute", "--yes-i-am-david"]);
  check("reenable", r.status, 0);
  cfg = (await db.doc(CONFIG_PATH).get()).data();
  check("reenable: marker untouched", [cfg.enabled, cfg.firstEnabledAt.toMillis()], [true, markerMs]);
  // Window blocks activation.
  await seedConfig();
  await db.doc("shadow_registry/window").set({generation: 1, runId: "x"});
  r = run(["--execute", "--yes-i-am-david", "--lapReceipt", receipt]);
  check("window blocks the flip", r.status, 2);
  await db.doc("shadow_registry/window").delete();
  // Non-empty rehearsal list blocks.
  await seedConfig({rehearsalClassIds: ["c25WT"]});
  r = run([]);
  check("rehearsal list blocks", r.status, 2);
}

// ---------------------------------------------------------------------------
const receiptPath = process.env.ENGINE_LAP_RECEIPT || "/tmp/engine-lap-receipt.json";
const summary = {pass: failed === 0, total, failed, reds, at: new Date().toISOString()};
writeFileSync(receiptPath, JSON.stringify(summary, null, 2));
console.log(`\n==== ENGINE LAP: ${total - failed}/${total} green${failed ? ` — ${failed} RED` : ""} (receipt: ${receiptPath})`);
if (failed) reds.forEach((x) => console.error("RED: " + x));
process.exit(failed ? 1 : 0);
