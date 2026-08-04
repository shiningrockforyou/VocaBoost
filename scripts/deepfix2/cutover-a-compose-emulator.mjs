#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-A COMPOSE — EMULATOR fixtures: the REAL client compose module
 * driven against the REAL engine callables (A1 bypass set + C3/C6/C7/C8/C9)
 * ============================================================================
 * The unit under test is `src/services/reviewV2Compose.js` — the module the
 * session pages call behind REVIEW_V2_CLIENT. Its `composeSessionFn` /
 * `composeNewTestFn` are injected with wrappers around the fft-wrapped
 * PUBLIC callables (`reviewV2ComposeSession` / `reviewV2ComposeNewTest`),
 * reproducing reviewV2Client.call()'s throw contract (HttpsError →
 * ReviewV2Error). So every case exercises the real client classification/key
 * logic against the real engine transactions.
 *
 * CASES (ledger refs):
 *   BS-CREATE   A1 create — first compose of a day; queue ⊆ universe;
 *               presented ⊆ queue; envelope VERBATIM vs the server payload.
 *   BS-REPLAY   A1 set-merge/overwrite — second compose, SAME persisted key
 *               ⇒ REPLAYS the same presentation (C9 reload leg).
 *   BS-RETAKE   A1 update — freshKey ⇒ a NEW presentation that DIFFERS;
 *               queue replays day-pinned (C9 retake leg).
 *   BS-RESET    A1 delete + delete-then-recreate — epoch moves mid-session ⇒
 *               compose_key_reused BLOCKS + discards the dead key; the next
 *               deliberate entry composes fresh under the new epoch. A live
 *               reset LOCK ⇒ reset_in_progress BLOCKS with a reason.
 *   BS-TABS     A1 batch/transaction — two tabs compose concurrently: SAME
 *               day queue, DISTINCT presentations, both valid.
 *   BS-OTHER    A1 a different path — composeNewTest vs composeSession:
 *               distinct presentation families, canonical-order new range.
 *   BS-THIRD    A1 third party — another student reusing the SAME composeKey
 *               string mints their OWN presentation (no cross-user replay).
 *   BS-TEACHER  A1 teacher — a non-enrolled teacher driving the session hits
 *               the THROWN permission-denied channel ⇒ silent LEGACY fallback.
 *   RF-DATA     C3 live — day_guard_rejected / list_end / empty_pool /
 *               reset_in_progress BLOCK with reasons; review_v2_dark and
 *               config_hold fall back to LEGACY.
 *   RF-THROWN   C8 live — class_not_found / not_enrolled / list_not_assigned
 *               arrive as THROWN HttpsErrors and fall back to LEGACY.
 *   ROT         C6 — the served queue obeys the ROTATION LAW: day N's queue =
 *               the next queueSize active words strictly after the persisted
 *               cursor (wrapping), verified against an INDEPENDENT reference
 *               sweep (not imported from composer.js), with full lap coverage
 *               and no starvation. Per V1 there is NO client-set oracle — the
 *               rotation law is the certification.
 *   TIME        C7 both legs — compose at REVIEW ENTRY (after the day's new-
 *               word failure is stamped AND twi advanced by the entry-time
 *               anchor reconciliation) ⇒ the failed word IS served, inside
 *               the priority selection; compose at SESSION START ⇒ the queue
 *               pins WITHOUT it, replay/fresh-key at review entry cannot
 *               repair it, and the pinned queue is still a VALID rotation
 *               (nothing detects the loss).
 *
 * HONEST NOTE on TIME (recorded in the fold report): with the engine's
 * review-first law the universe is positions < twi and twi moves only at day
 * completion (progress.js:20-23), so a word introduced TODAY enters today's
 * review pool only once twi has advanced past it mid-day — which the LIVE
 * legacy entry-time reconciliation performs when a passed new anchor exists
 * (LIST_SCOPED_RECON, "twi = newWordEndIndex + 1"). The fixture models that
 * advance explicitly as the durable-progress write between the new test and
 * review entry. Without any twi advance, the word is served TOMORROW (with
 * priority) under either ordering.
 *
 * RUNBOOK (same as engine-emulator-lap.mjs):
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/cutover-a-compose-emulator.mjs"
 * Evidence: docs/plans/deepfix2/evidence/cutover-a-compose-emulator.json
 */

import {
  requireEmulatorEnv, connectEmulator, createSeedHelpers, fakeStorage,
  createCaseRunner, sha16, writeReceipt, finalizeRun,
} from "./lib/fold-harness.mjs";

requireEmulatorEnv();

// ---- the REAL client module (the unit under test) --------------------------
import {
  composeReviewSessionV2,
  composeNewTestV2,
  composeKeyScope,
} from "../../src/services/reviewV2Compose.js";
import { ReviewV2Error, CLIENT_CONTRACT_VERSION } from "../../src/services/reviewV2Client.js";

// ---- the engine side, pinned to functions/node_modules (lap law) ----------
const { fnRequire, db, Timestamp, fft, wrap, wipeEmulator } = connectEmulator();
const CALL = fnRequire("/app/functions/reviewV2/callables.js");
const foundation = fnRequire("/app/functions/foundation.js");

const { CASE, check, checkTrue, stats } = createCaseRunner();

/** Injected compose fns: the fft-wrapped PUBLIC callables, with
 *  reviewV2Client.call()'s exact contract — payload through, HttpsError →
 *  ReviewV2Error(code). One per acting uid. */
const composeSessionAs = (uid) => async (data) => {
  try {
    return await wrap(CALL.reviewV2ComposeSession)({
      data: { ...data, clientContractVersion: CLIENT_CONTRACT_VERSION },
      auth: uid === undefined ? undefined : { uid, token: {} },
    }) ?? null;
  } catch (err) {
    throw new ReviewV2Error(err?.code ?? "internal", err?.message, err?.details);
  }
};
const composeNewAs = (uid) => async (data) => {
  try {
    return await wrap(CALL.reviewV2ComposeNewTest)({
      data: { ...data, clientContractVersion: CLIENT_CONTRACT_VERSION },
      auth: uid === undefined ? undefined : { uid, token: {} },
    }) ?? null;
  } catch (err) {
    throw new ReviewV2Error(err?.code ?? "internal", err?.message, err?.details);
  }
};

// ---- seeds (lap idioms) ----------------------------------------------------
const { CONFIG_PATH, seedConfig, seedClass, seedWords, seedProgress } =
  createSeedHelpers({ db, Timestamp, foundation });

/** INDEPENDENT reference sweep (deliberately NOT imported from composer.js —
 *  importing the production law would make the fixture agree with whatever it
 *  does). Mirrors 15_ §2b: next `queueSize` ACTIVE words in index order
 *  STRICTLY AFTER the cursor, wrapping; null cursor ⇒ smallest index; top-ups
 *  from resting earliest-graduated. Here all words are active (no resting). */
function referenceSweep(universeIds, queueSize, cursorIndexOf) {
  const idx = (id) => Number(id.slice(1));
  const active = [...universeIds].sort((a, b) => idx(a) - idx(b));
  let start = 0;
  if (cursorIndexOf != null) {
    const i = active.findIndex((w) => idx(w) > cursorIndexOf);
    start = i === -1 ? 0 : i;
  }
  const out = [];
  for (let k = 0; k < active.length && out.length < queueSize; k++) {
    out.push(active[(start + k) % active.length]);
  }
  return out;
}

const range = (n) => Array.from({ length: n }, (_, i) => `w${i}`);

await wipeEmulator();

// ===========================================================================
CASE("BS-CREATE — first compose of a day: composed, queue ⊆ universe, presented ⊆ queue, envelope VERBATIM");
{
  await seedConfig({ rehearsalClassIds: ["C1"] }); // dark globally, serving the rehearsal class (the 25WT posture)
  await seedClass("C1", { listId: "L1", students: ["s1", "s2"] });
  await seedWords("L1", 20);
  await seedProgress("s1", "C1", "L1", { csd: 1, twi: 10 }); // day-2 frontier, universe w0..w9
  const storage = fakeStorage();
  let raw = null;
  const spyFn = async (data) => { raw = await composeSessionAs("s1")(data); return raw; };
  const res = await composeReviewSessionV2(
    { uid: "s1", classId: "C1", listId: "L1", logicalDay: 2 },
    { storage, composeSessionFn: spyFn });
  check("outcome", res.outcome, "composed");
  const universe = new Set(range(10));
  checkTrue("queue non-empty", res.queueWordIds.length > 0);
  checkTrue("queue ⊆ universe (positions < twi — review-first law)",
    res.queueWordIds.every((w) => universe.has(w)));
  checkTrue("presented ⊆ queue", res.presentedWordIds.every((w) => res.queueWordIds.includes(w)));
  // VERBATIM vs the server payload — members AND order (V3; the C4 class of
  // mutation on the wiring is caught here against the LIVE payload).
  check("presented verbatim vs server", res.presentedWordIds, raw.presentation.presentedWordIds);
  check("queue verbatim vs server", res.queueWordIds, raw.queue.orderedQueueWordIds);
  check("presentationId carried", res.presentationId, raw.presentation.presentationId);
  check("testType", res.testType, "mcq");
  check("resetEpoch", res.resetEpoch, 0);

  // -- BS-REPLAY (C9 reload leg): same persisted storage ⇒ SAME presentation.
  CASE("BS-REPLAY — reload with the persisted key replays the SAME presentation");
  const res2 = await composeReviewSessionV2(
    { uid: "s1", classId: "C1", listId: "L1", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s1") });
  check("outcome", res2.outcome, "composed");
  check("SAME presentationId (replay, not a new test)", res2.presentationId, res.presentationId);
  check("SAME presented ids in the SAME order", res2.presentedWordIds, res.presentedWordIds);
  check("SAME day queue", res2.queueWordIds, res.queueWordIds);

  // -- BS-RETAKE (C9 retake leg): freshKey ⇒ NEW presentation, day-pinned queue.
  CASE("BS-RETAKE — deliberate retake (freshKey) mints a NEW presentation; the day queue replays pinned");
  const res3 = await composeReviewSessionV2(
    { uid: "s1", classId: "C1", listId: "L1", logicalDay: 2, freshKey: true },
    { storage, composeSessionFn: composeSessionAs("s1") });
  check("outcome", res3.outcome, "composed");
  checkTrue("DIFFERENT presentationId (must differ; must not replay)", res3.presentationId !== res.presentationId);
  check("day queue REPLAYED verbatim (day-pinned)", res3.queueWordIds, res.queueWordIds);
  checkTrue("retake presented ⊆ the same pinned queue", res3.presentedWordIds.every((w) => res.queueWordIds.includes(w)));

  // -- BS-TABS: two tabs (separate per-tab sessionStorage ⇒ separate keys)
  //    compose concurrently for the SAME student and day.
  CASE("BS-TABS — two tabs compose concurrently: same day queue, distinct presentations");
  await seedProgress("s2", "C1", "L1", { csd: 1, twi: 10 });
  const [tA, tB] = await Promise.all([
    composeReviewSessionV2({ uid: "s2", classId: "C1", listId: "L1", logicalDay: 2 },
      { storage: fakeStorage(), composeSessionFn: composeSessionAs("s2") }),
    composeReviewSessionV2({ uid: "s2", classId: "C1", listId: "L1", logicalDay: 2 },
      { storage: fakeStorage(), composeSessionFn: composeSessionAs("s2") }),
  ]);
  check("tab A composed", tA.outcome, "composed");
  check("tab B composed", tB.outcome, "composed");
  check("both tabs share ONE day queue", tA.queueWordIds, tB.queueWordIds);
  checkTrue("tabs hold DISTINCT presentations", tA.presentationId !== tB.presentationId);

  // -- BS-THIRD: another student reusing the SAME composeKey string.
  CASE("BS-THIRD — another student reusing the SAME composeKey string gets their OWN presentation");
  const s1Scope = composeKeyScope({ uid: "s1", classId: "C1", listId: "L1", logicalDay: 2, kind: "review" });
  const s1Key = storage.getItem(s1Scope);
  checkTrue("s1's key exists to steal", typeof s1Key === "string" && s1Key.length >= 8);
  const thiefStorage = fakeStorage();
  thiefStorage.setItem(composeKeyScope({ uid: "s2", classId: "C1", listId: "L1", logicalDay: 2, kind: "review" }), s1Key);
  const stolen = await composeReviewSessionV2(
    { uid: "s2", classId: "C1", listId: "L1", logicalDay: 2 },
    { storage: thiefStorage, composeSessionFn: composeSessionAs("s2") });
  check("composes (registries are uid-scoped)", stolen.outcome, "composed");
  checkTrue("but NOT s1's presentation (no cross-user replay/leak)",
    stolen.presentationId !== res3.presentationId && stolen.presentationId !== res.presentationId);

  // -- BS-TEACHER: non-enrolled teacher driving the session ⇒ thrown channel ⇒ legacy.
  CASE("BS-TEACHER — a non-enrolled teacher hits thrown permission-denied ⇒ silent LEGACY fallback");
  const teach = await composeReviewSessionV2(
    { uid: "teacher9", classId: "C1", listId: "L1", logicalDay: 2 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("teacher9") });
  check("outcome legacy (teacher keeps today's client view)", teach.outcome, "legacy");
  check("via the thrown channel", teach.via, "error");
  check("code", teach.code, "permission-denied");
}

// ===========================================================================
CASE("BS-OTHER — the new-word path: composeNewTest family, canonical order, distinct from review");
{
  await seedConfig({ rehearsalClassIds: ["C2"] });
  await seedClass("C2", { listId: "L2", students: ["s3"], asg: { pace: 3 } }); // dailyPace 3
  await seedWords("L2", 20);
  await seedProgress("s3", "C2", "L2", { csd: 1, twi: 10 });
  const storage = fakeStorage();
  const newRes = await composeNewTestV2(
    { uid: "s3", classId: "C2", listId: "L2", logicalDay: 2 },
    { storage, composeNewTestFn: composeNewAs("s3") });
  check("outcome", newRes.outcome, "composed");
  check("the day's range [twi, twi+pace) in canonical order", newRes.presentedWordIds, ["w10", "w11", "w12"]);
  check("range indices", [newRes.rangeStartIndex, newRes.rangeEndIndex], [10, 12]);
  checkTrue("new-day family id (_n)", /_n\d+$/.test(newRes.presentationId));
  const revRes = await composeReviewSessionV2(
    { uid: "s3", classId: "C2", listId: "L2", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s3") });
  check("review path still composes independently", revRes.outcome, "composed");
  checkTrue("review family id (_p)", /_p\d+$/.test(revRes.presentationId));
  checkTrue("families differ", newRes.presentationId !== revRes.presentationId);
  checkTrue("new range does NOT leak into the review universe",
    revRes.queueWordIds.every((w) => Number(w.slice(1)) < 10));
  // Replay law holds on the new path too.
  const newRes2 = await composeNewTestV2(
    { uid: "s3", classId: "C2", listId: "L2", logicalDay: 2 },
    { storage, composeNewTestFn: composeNewAs("s3") });
  check("new-test reload replays the SAME presentation", newRes2.presentationId, newRes.presentationId);
  const newRes3 = await composeNewTestV2(
    { uid: "s3", classId: "C2", listId: "L2", logicalDay: 2, freshKey: true },
    { storage, composeNewTestFn: composeNewAs("s3") });
  checkTrue("new-test retake mints a NEW presentation", newRes3.presentationId !== newRes.presentationId);
}

// ===========================================================================
CASE("BS-RESET — reset lock blocks with a reason; epoch move kills the key; delete-then-recreate composes fresh");
{
  await seedConfig({ rehearsalClassIds: ["C3"] });
  await seedClass("C3", { listId: "L3", students: ["s4"] });
  await seedWords("L3", 12);
  await seedProgress("s4", "C3", "L3", { csd: 1, twi: 8 });
  const storage = fakeStorage();
  const deps = { storage, composeSessionFn: composeSessionAs("s4") };
  const first = await composeReviewSessionV2({ uid: "s4", classId: "C3", listId: "L3", logicalDay: 2 }, deps);
  check("pre-reset compose", first.outcome, "composed");
  check("epoch 0", first.resetEpoch, 0);

  // A live reset LOCK: a fresh claim is refused reset_in_progress ⇒ BLOCKED with a reason.
  await db.doc("users/s4/progress_meta/L3").set({ resetInProgress: true }, { merge: true });
  const lockedStorage = fakeStorage(); // fresh key ⇒ fresh claim (replay would short-circuit)
  const locked = await composeReviewSessionV2({ uid: "s4", classId: "C3", listId: "L3", logicalDay: 2 },
    { storage: lockedStorage, composeSessionFn: composeSessionAs("s4") });
  check("reset lock ⇒ blocked", locked.outcome, "blocked");
  check("status", locked.status, "reset_in_progress");
  checkTrue("reason rendered", typeof locked.reason === "string" && locked.reason.length > 0);

  // The reset completes: lock cleared, epoch moved. The PERSISTED key now has
  // a dead fingerprint (epoch 0) ⇒ compose_key_reused BLOCKS + discards it.
  await db.doc("users/s4/progress_meta/L3").set({ resetInProgress: false, resetEpoch: 1 }, { merge: true });
  await seedProgress("s4", "C3", "L3", { csd: 1, twi: 8 }); // post-reset progress (kept simple: same day)
  const stale = await composeReviewSessionV2({ uid: "s4", classId: "C3", listId: "L3", logicalDay: 2 }, deps);
  check("old presentation must not be reused: blocked", stale.outcome, "blocked");
  check("status compose_key_reused", stale.status, "compose_key_reused");
  const scope = composeKeyScope({ uid: "s4", classId: "C3", listId: "L3", logicalDay: 2, kind: "review" });
  check("dead key discarded", storage.getItem(scope), null);
  // Delete-then-recreate: the next deliberate entry mints fresh and serves the NEW epoch.
  const fresh = await composeReviewSessionV2({ uid: "s4", classId: "C3", listId: "L3", logicalDay: 2 }, deps);
  check("re-entry composes under the new epoch", fresh.outcome, "composed");
  check("epoch 1", fresh.resetEpoch, 1);
  checkTrue("a NEW presentation (old one never resurfaces)", fresh.presentationId !== first.presentationId);
  checkTrue("new-epoch queue id family", fresh.presentationId.includes("_e1_"));
}

// ===========================================================================
CASE("RF-DATA — live data-channel refusals: guard refusals BLOCK with reasons; dark/hold fall back to LEGACY");
{
  await seedConfig({ rehearsalClassIds: ["C4"] });
  await seedClass("C4", { listId: "L4", students: ["s5"] });
  await seedWords("L4", 10);
  await seedProgress("s5", "C4", "L4", { csd: 1, twi: 5 });
  const ids = { uid: "s5", classId: "C4", listId: "L4" };
  // day_guard_rejected (review): a non-frontier day.
  const wrongDay = await composeReviewSessionV2({ ...ids, logicalDay: 5 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("s5") });
  check("wrong day ⇒ blocked", [wrongDay.outcome, wrongDay.status], ["blocked", "day_guard_rejected"]);
  checkTrue("reason rendered", wrongDay.reason.length > 0);
  // day_guard_rejected (new path).
  const wrongDayNew = await composeNewTestV2({ ...ids, logicalDay: 7 },
    { storage: fakeStorage(), composeNewTestFn: composeNewAs("s5") });
  check("new-test wrong day ⇒ blocked", [wrongDayNew.outcome, wrongDayNew.status], ["blocked", "day_guard_rejected"]);
  // empty_pool: day 1 (twi 0) has no review by construction.
  await seedProgress("s5", "C4", "L4", { csd: 0, twi: 0 });
  const day1 = await composeReviewSessionV2({ ...ids, logicalDay: 1 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("s5") });
  check("day-1 empty pool ⇒ blocked with reason", [day1.outcome, day1.status], ["blocked", "empty_pool"]);
  // list_end: twi at the end of the list.
  await seedProgress("s5", "C4", "L4", { csd: 3, twi: 10 });
  const listEnd = await composeNewTestV2({ ...ids, logicalDay: 4 },
    { storage: fakeStorage(), composeNewTestFn: composeNewAs("s5") });
  check("list end ⇒ blocked with reason", [listEnd.outcome, listEnd.status], ["blocked", "list_end"]);
  // review_v2_dark: class not in rehearsal while globally dark ⇒ LEGACY (silent).
  await seedProgress("s5", "C4", "L4", { csd: 1, twi: 5 });
  await seedConfig({ rehearsalClassIds: [] });
  const dark = await composeReviewSessionV2({ ...ids, logicalDay: 2 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("s5") });
  check("dark ⇒ legacy", [dark.outcome, dark.status], ["legacy", "review_v2_dark"]);
  // config_hold: config doc missing ⇒ LEGACY (silent) — the cold-start law.
  await db.doc(CONFIG_PATH).delete();
  const hold = await composeReviewSessionV2({ ...ids, logicalDay: 2 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("s5") });
  check("hold ⇒ legacy", [hold.outcome, hold.status], ["legacy", "config_hold"]);
  await seedConfig({ rehearsalClassIds: ["C4"] }); // restore for later cases
  // client_version_stale ⇒ BLOCKED (force-refresh contract), not legacy.
  await seedConfig({ rehearsalClassIds: ["C4"], minClientVersion: CLIENT_CONTRACT_VERSION + 1 });
  const staleC = await composeReviewSessionV2({ ...ids, logicalDay: 2 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("s5") });
  check("stale client ⇒ blocked", [staleC.outcome, staleC.status], ["blocked", "client_version_stale"]);
  await seedConfig({ rehearsalClassIds: ["C4"] });
}

// ===========================================================================
CASE("RF-THROWN — the live thrown channel: class_not_found / not_enrolled / list_not_assigned ⇒ LEGACY");
{
  // class_not_found → HttpsError not-found.
  const noClass = await composeReviewSessionV2(
    { uid: "s5", classId: "NOPE", listId: "L4", logicalDay: 2 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("s5") });
  check("class_not_found arrives THROWN ⇒ legacy", [noClass.outcome, noClass.via, noClass.code],
    ["legacy", "error", "not-found"]);
  // not_enrolled → permission-denied.
  const ghost = await composeReviewSessionV2(
    { uid: "ghost", classId: "C4", listId: "L4", logicalDay: 2 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("ghost") });
  check("not_enrolled arrives THROWN ⇒ legacy", [ghost.outcome, ghost.code], ["legacy", "permission-denied"]);
  // list_not_assigned → failed-precondition.
  const noAsg = await composeReviewSessionV2(
    { uid: "s5", classId: "C4", listId: "UNASSIGNED", logicalDay: 2 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("s5") });
  check("list_not_assigned arrives THROWN ⇒ legacy", [noAsg.outcome, noAsg.code], ["legacy", "failed-precondition"]);
  // Same trio on the new path.
  const noAsgNew = await composeNewTestV2(
    { uid: "s5", classId: "C4", listId: "UNASSIGNED", logicalDay: 2 },
    { storage: fakeStorage(), composeNewTestFn: composeNewAs("s5") });
  check("new path list_not_assigned ⇒ legacy", [noAsgNew.outcome, noAsgNew.code], ["legacy", "failed-precondition"]);
}

// ===========================================================================
CASE("ROT (C6) — the served queue obeys the rotation law across a full lap (independent reference)");
{
  await seedConfig({ rehearsalClassIds: ["C5"] });
  await seedClass("C5", { listId: "L5", students: ["s6"], asg: { reviewQueueSize: 4, reviewTestSize: 3 } });
  await seedWords("L5", 15);
  const UNIVERSE = range(10); // twi 10 fixed across the lap (no new completions modeled)
  let cursor = null;
  const served = new Set();
  const queues = [];
  for (let day = 2; day <= 4; day++) {
    await seedProgress("s6", "C5", "L5", { csd: day - 1, twi: 10 });
    const r = await composeReviewSessionV2(
      { uid: "s6", classId: "C5", listId: "L5", logicalDay: day },
      { storage: fakeStorage(), composeSessionFn: composeSessionAs("s6") });
    check(`day ${day} composed`, r.outcome, "composed");
    const expected = referenceSweep(UNIVERSE, 4, cursor);
    check(`day ${day} queue = the reference cursor sweep`, r.queueWordIds, expected);
    checkTrue(`day ${day} presented ⊆ queue, size = min(testSize,|queue|) = 3`,
      r.presentedWordIds.length === 3 && r.presentedWordIds.every((w) => r.queueWordIds.includes(w)));
    cursor = Number(expected[expected.length - 1].slice(1)); // the last ACTIVE served index
    queues.push(r.queueWordIds);
    r.queueWordIds.forEach((w) => served.add(w));
  }
  // Lap coverage: ceil(10/4) = 3 days sweep the whole introduced range —
  // no starvation, and day 4 wraps past the end back to the smallest index.
  check("lap covers the ENTIRE introduced range (no starvation)",
    [...served].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))), UNIVERSE);
  check("day 4 wrapped (contains both tail and head)",
    [queues[2].includes("w8"), queues[2].includes("w9"), queues[2].includes("w0"), queues[2].includes("w1")],
    [true, true, true, true]);
}

// ===========================================================================
CASE("TIME (C7) — GOOD leg: compose at REVIEW ENTRY serves the day's failed new word, via priority");
{
  await seedConfig({ rehearsalClassIds: ["C6"] });
  // pace 1 ⇒ the day's new test is exactly [w_twi]; testSize 3 < queue so the
  // failed word reaches the test ONLY through the needsPriority selection.
  await seedClass("C6", { listId: "L6", students: ["good", "bad"], asg: { pace: 1, reviewTestSize: 3 } });
  await seedWords("L6", 15);
  await seedProgress("good", "C6", "L6", { csd: 1, twi: 9 }); // day 2; today's new word = w9

  // (1) The new-word test composes and is submitted with w9 WRONG — the engine
  //     stamps reviewFailCount/reviewLastFailedAt on w9 (every graded test stamps).
  const newT = await composeNewTestV2(
    { uid: "good", classId: "C6", listId: "L6", logicalDay: 2 },
    { storage: fakeStorage(), composeNewTestFn: composeNewAs("good") });
  check("new test = [w9]", newT.presentedWordIds, ["w9"]);
  const submit = await wrap(CALL.reviewV2SubmitAttempt)({
    data: { presentationId: newT.presentationId, answers: [{ wordId: "w9", studentResponse: "wrong answer" }],
      clientContractVersion: CLIENT_CONTRACT_VERSION },
    auth: { uid: "good", token: {} },
  });
  check("failed new attempt written + stamped", [submit.status, submit.passed, submit.stamped],
    ["attempt_written", false, 1]);

  // (2) THE ADVANCE the fixture models explicitly (see header): the entry-time
  //     anchor reconciliation moves twi past the day's passed range
  //     ("twi = newWordEndIndex + 1"). Without it the review-first universe
  //     (positions < twi) can never contain w9 today under EITHER ordering.
  await seedProgress("good", "C6", "L6", { csd: 1, twi: 10 });

  // (3) REVIEW ENTRY — the FIRST composeSession of the day (the lazy ordering).
  const rev = await composeReviewSessionV2(
    { uid: "good", classId: "C6", listId: "L6", logicalDay: 2 },
    { storage: fakeStorage(), composeSessionFn: composeSessionAs("good") });
  check("review composed", rev.outcome, "composed");
  checkTrue("the failed word IS in the day queue", rev.queueWordIds.includes("w9"));
  checkTrue("the failed word IS SERVED in the test — selected by needsPriority into a size-3 test",
    rev.presentedWordIds.includes("w9"));
  check("test size stayed 3 (priority selection, not size inflation)", rev.presentedWordIds.length, 3);
}

CASE("TIME (C7) — BAD leg: compose at SESSION START pins the queue; the failed word is LOST and nothing detects it");
{
  await seedProgress("bad", "C6", "L6", { csd: 1, twi: 9 });
  const storage = fakeStorage();

  // (1) THE BAD ORDERING: composeSession at SESSION START — before the new
  //     test exists. The day queue pins over universe w0..w8.
  const early = await composeReviewSessionV2(
    { uid: "bad", classId: "C6", listId: "L6", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("bad") });
  check("session-start compose composed", early.outcome, "composed");
  checkTrue("pinned queue excludes w9 (not yet introduced)", !early.queueWordIds.includes("w9"));

  // (2) The day proceeds exactly like the good leg: new test, w9 failed+stamped, twi advanced.
  const newT = await composeNewTestV2(
    { uid: "bad", classId: "C6", listId: "L6", logicalDay: 2 },
    { storage, composeNewTestFn: composeNewAs("bad") });
  check("new test = [w9]", newT.presentedWordIds, ["w9"]);
  const submit = await wrap(CALL.reviewV2SubmitAttempt)({
    data: { presentationId: newT.presentationId, answers: [{ wordId: "w9", studentResponse: "wrong answer" }],
      clientContractVersion: CLIENT_CONTRACT_VERSION },
    auth: { uid: "bad", token: {} },
  });
  check("failed new attempt written + stamped", [submit.status, submit.passed], ["attempt_written", false]);
  await seedProgress("bad", "C6", "L6", { csd: 1, twi: 10 });

  // (3) REVIEW ENTRY under the bad ordering. The persisted key REPLAYS the
  //     session-start presentation — w9 absent.
  const replay = await composeReviewSessionV2(
    { uid: "bad", classId: "C6", listId: "L6", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("bad") });
  check("replay of the early claim", replay.presentationId, early.presentationId);
  checkTrue("LOST: the failed word is NOT served (replay leg)", !replay.presentedWordIds.includes("w9"));
  //     Even a FRESH claim cannot repair it: the queue doc is day-pinned.
  const fresh = await composeReviewSessionV2(
    { uid: "bad", classId: "C6", listId: "L6", logicalDay: 2, freshKey: true },
    { storage, composeSessionFn: composeSessionAs("bad") });
  checkTrue("fresh claim gets a new presentation", fresh.presentationId !== early.presentationId);
  check("but the SAME pinned queue", fresh.queueWordIds, early.queueWordIds);
  checkTrue("LOST: the failed word is NOT served (fresh-claim leg)", !fresh.presentedWordIds.includes("w9"));
  checkTrue("LOST: not in the day queue at all", !fresh.queueWordIds.includes("w9"));

  // (4) AND NOTHING DETECTS IT: the pinned queue is a perfectly VALID rotation
  //     over the AT-PIN-TIME universe (w0..w8, cursor null ⇒ smallest-first) —
  //     no rotation/coverage assertion would ever flag the loss.
  const expectedAtPinTime = referenceSweep(range(9), 60, null); // queueSize 60 ⇒ whole pool
  check("the bad queue is still a valid rotation (the silent-regression proof)",
    early.queueWordIds, expectedAtPinTime);
}

// ===========================================================================
const { total, failed, reds } = stats();
writeReceipt(
  new URL("../../docs/plans/deepfix2/evidence/cutover-a-compose-emulator.json", import.meta.url),
  {
    kind: "cutover-a-compose-emulator",
    pass: failed === 0,
    total, failed, reds,
    sourceShas: {
      "src/services/reviewV2Compose.js": sha16("/app/src/services/reviewV2Compose.js"),
      "src/services/reviewV2Client.js": sha16("/app/src/services/reviewV2Client.js"),
      "functions/reviewV2/callables.js": sha16("/app/functions/reviewV2/callables.js"),
      "functions/reviewV2/composer.js": sha16("/app/functions/reviewV2/composer.js"),
      "functions/reviewV2/presentations.js": sha16("/app/functions/reviewV2/presentations.js"),
      "scripts/deepfix2/cutover-a-compose-emulator.mjs": sha16("/app/scripts/deepfix2/cutover-a-compose-emulator.mjs"),
    },
    at: new Date().toISOString(),
  });
console.log(`\ncutover-a-compose EMULATOR: ${total} checks, ${failed} failures — evidence written`);
await finalizeRun(fft, failed);
