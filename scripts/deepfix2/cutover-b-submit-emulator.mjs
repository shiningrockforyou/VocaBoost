#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-B SUBMIT — EMULATOR fixtures: the REAL client submit adapter driven
 * against the REAL engine callables (A1 bypass set, one case per row)
 * ============================================================================
 * The unit under test is `src/services/reviewV2Submit.js` — the module
 * MCQTest/TypedTest call behind REVIEW_V2_CLIENT. Its `submitFn` /
 * `composeSessionFn` / `composeNewTestFn` are injected with wrappers around
 * the fft-wrapped PUBLIC callables, reproducing reviewV2Client.call()'s
 * throw contract (HttpsError → ReviewV2Error). So every case exercises the
 * real client classification/guard logic against the real submit transaction.
 *
 * CASES (ledger A1 bypass rows → cases):
 *   SB-CREATE     create — ordinary first submit; the SERVER's verdict and
 *                 DENOMINATOR (V3: 5 answers over a 10-word presentation
 *                 scores 30%, never 60%); the stored attempt carries the
 *                 engine identity (server-derived docId, presentationId,
 *                 resetEpoch, gatePosture.source).
 *   SB-RESUBMIT   update — a re-submit of the SAME presentation is a REPLAY:
 *                 attempt_written + replayed:true, ZERO new writes
 *                 (submittedAt byte-identical, still ONE doc). Kills mutant
 *                 M-C5-DROP-IDEMPOTENCY.
 *   SB-NEWVSREV   a different path — the NEW-word submit vs the REVIEW
 *                 submit: sessionType + anchor range fields diverge correctly.
 *   SB-RESET      delete — submitting after a reset (epoch moved) REFUSES
 *                 (reset_epoch_mismatch), a live lock REFUSES
 *                 (reset_in_progress), zero writes both ways.
 *   SB-RECREATE   delete-then-recreate — submit → reset (attempt deleted,
 *                 epoch moved) → old presentation refuses → recompose under
 *                 the new epoch → submit lands.
 *   SB-TABS       batch/transaction — two tabs submit the SAME presentation
 *                 concurrently: exactly ONE attempt document, one creator,
 *                 one replay.
 *   SB-THIRD      third party — another student's presentationId: thrown
 *                 not-found (path-scoped presentations), adapter routes
 *                 LEGACY, zero writes.
 *   SB-TEACHER    teacher — a teacher-driven submit hits the same thrown
 *                 channel ⇒ LEGACY, zero writes.
 *   SB-OCCUPIED   set-merge/overwrite — the attempt id occupied by a
 *                 NON-engine document refuses (presentation_invalid), the
 *                 stored doc is byte-untouched.
 *   SB-VANISH     FieldValue.delete() equivalent — the attempt vanishes
 *                 between the replay pre-read and the txn (r74 C8a hook):
 *                 the engine refuses grading_in_progress with zero writes;
 *                 the adapter's bounded poll then self-heals from the CACHED
 *                 grade — the AI grader is charged exactly ONCE end to end.
 *   SB-UNUSABLE   the REAL C3 legs — a poisoned grading job yields
 *                 grade_unusable; the adapter recomposes EXACTLY ONCE (a
 *                 real fresh presentation); poisoning the fresh job too makes
 *                 the SECOND unusable TERMINAL: no second recompose, no
 *                 grader spend.
 *
 * RUNBOOK (same as cutover-a-compose-emulator.mjs):
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/cutover-b-submit-emulator.mjs"
 * Evidence: docs/plans/deepfix2/evidence/cutover-b-submit-emulator.json
 * (CUTOVER_B_EMU_RECEIPT env redirects the receipt for the mutant driver.)
 */

import {
  requireEmulatorEnv, connectEmulator, createSeedHelpers, fakeStorage,
  createCaseRunner, sha16, writeReceipt, finalizeRun,
} from "./lib/fold-harness.mjs";

requireEmulatorEnv();

// ---- the REAL client modules (the units under test) ------------------------
import {
  submitAttemptV2,
  recomposeGuardScope,
  recomposeUsed,
} from "../../src/services/reviewV2Submit.js";
import { composeReviewSessionV2, composeNewTestV2 } from "../../src/services/reviewV2Compose.js";
import { ReviewV2Error, CLIENT_CONTRACT_VERSION } from "../../src/services/reviewV2Client.js";

// ---- the engine side, pinned to functions/node_modules (lap law) ----------
const { fnRequire, db, Timestamp, fft, wrap, wipeEmulator } = connectEmulator();
const CALL = fnRequire("/app/functions/reviewV2/callables.js");
const TG = fnRequire("/app/functions/reviewV2/typedGrading.js");
const { engineDocId } = fnRequire("/app/functions/reviewV2/composer.js");
const foundation = fnRequire("/app/functions/foundation.js");

const { CASE, check, checkTrue, stats } = createCaseRunner();

/** Injected fns: the fft-wrapped PUBLIC callables with reviewV2Client.call()'s
 *  exact contract — payload through, HttpsError → ReviewV2Error. */
const callAs = (callable, uid) => async (data) => {
  try {
    return await wrap(callable)({
      data: { ...data, clientContractVersion: CLIENT_CONTRACT_VERSION },
      auth: uid === undefined ? undefined : { uid, token: {} },
    }) ?? null;
  } catch (err) {
    throw new ReviewV2Error(err?.code ?? "internal", err?.message, err?.details);
  }
};
const submitAs = (uid) => callAs(CALL.reviewV2SubmitAttempt, uid);
const composeSessionAs = (uid) => callAs(CALL.reviewV2ComposeSession, uid);
const composeNewAs = (uid) => callAs(CALL.reviewV2ComposeNewTest, uid);

/** Adapter deps for one student "tab". */
const tabDeps = (uid, extra = {}) => ({
  storage: fakeStorage(),
  submitFn: submitAs(uid),
  composeSessionFn: composeSessionAs(uid),
  composeNewTestFn: composeNewAs(uid),
  sleepFn: async () => {},
  pollIntervalMs: 1,
  ...extra,
});

// ---- seeds (lap idioms, cloned from cutover-a-compose-emulator.mjs) --------
const { CONFIG_PATH, seedConfig, seedClass, seedWords, seedProgress } =
  createSeedHelpers({ db, Timestamp, foundation });

/** Answer sheet from a presentation: first `nCorrect` canonical, next
 *  `nWrong` wrong, rest BLANK (no row — blank is the server's law). */
const sheetFor = (presentedWordIds, nCorrect, nWrong) =>
  presentedWordIds.slice(0, nCorrect + nWrong).map((id, i) => ({
    wordId: id,
    studentResponse: i < nCorrect ? `def${id.slice(1)}` : "totally wrong",
  }));

const attemptsCount = async () => (await db.collection("attempts").get()).size;

// The emulator-only typed seam: the AI grader cannot run here. Counted so the
// metering-once law is ASSERTED, not assumed.
let seamGradeCalls = 0;
TG._typedSeam.grade = async ({ answers }) => {
  seamGradeCalls++;
  return answers.map((a) => ({
    wordId: a.wordId,
    isCorrect: a.studentResponse === a.correctDefinition,
    reasoning: "seam-graded",
  }));
};

await wipeEmulator();

// ===========================================================================
CASE("SB-CREATE — first submit: server verdict, SERVER denominator (V3), engine identity on the stored attempt");
{
  await seedConfig({ rehearsalClassIds: ["C1"] });
  await seedClass("C1", { listId: "L1", students: ["s1"] });
  await seedWords("L1", 20);
  await seedProgress("s1", "C1", "L1", { csd: 1, twi: 10 }); // day-2 frontier, universe w0..w9
  const storage = fakeStorage();
  const composed = await composeReviewSessionV2(
    { uid: "s1", classId: "C1", listId: "L1", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s1") });
  check("composed", composed.outcome, "composed");
  check("presented size (denominator source)", composed.presentedWordIds.length, 10);

  // Answer 3 correct + 2 wrong, leave 5 BLANK: the score MUST be 3/10=30,
  // never 3/5=60 — the exact 50-answers-vs-60-words law (V3).
  const answers = sheetFor(composed.presentedWordIds, 3, 2);
  const deps = { ...tabDeps("s1"), storage };
  const res = await submitAttemptV2({
    uid: "s1", classId: "C1", listId: "L1", logicalDay: 2, kind: "review",
    presentationId: composed.presentationId, answers,
  }, deps);
  check("written, first commit", [res.outcome, res.replayed], ["written", false]);
  check("SERVER denominator = the presentation, not the answered count",
    [res.totalQuestions, res.correctCount, res.score], [10, 3, 30]);
  check("verdict vs threshold 92", res.passed, false);
  check("server-derived attemptId (engineDocId — no client nonce anywhere)",
    res.attemptId, engineDocId("s1", composed.presentationId));

  const doc = (await db.collection("attempts").doc(res.attemptId).get()).data();
  check("stored identity", {
    studentId: doc.studentId, classId: doc.classId, listId: doc.listId,
    sessionType: doc.sessionType, testType: doc.testType, studyDay: doc.studyDay,
    presentationId: doc.presentationId, resetEpoch: doc.resetEpoch,
    source: doc.gatePosture?.source,
  }, {
    studentId: "s1", classId: "C1", listId: "L1",
    sessionType: "review", testType: "mcq", studyDay: 2,
    presentationId: composed.presentationId, resetEpoch: 0,
    source: "reviewV2SubmitAttempt",
  });
  check("COMPLETE-ROWS: one row per PRESENTED word (blanks materialized server-side)",
    doc.answers.length, 10);
  check("blank rows marked and failed",
    doc.answers.filter((r) => r.blank === true).length, 5);
  check("stored score/passed match the response", [doc.score, doc.passed, doc.totalQuestions], [30, false, 10]);

  // -- SB-RESUBMIT (update leg): the SAME presentation replays, ZERO writes.
  CASE("SB-RESUBMIT — re-submit of the SAME presentation is a replay with ZERO new writes (kills M-C5)");
  const before = await attemptsCount();
  const submittedAtBefore = doc.submittedAt.toMillis();
  const res2 = await submitAttemptV2({
    uid: "s1", classId: "C1", listId: "L1", logicalDay: 2, kind: "review",
    presentationId: composed.presentationId,
    // Even a DIFFERENT answer sheet must not produce a second attempt — the
    // first commit is the attempt of record.
    answers: sheetFor(composed.presentedWordIds, 10, 0),
  }, deps);
  check("replayed", [res2.outcome, res2.replayed], ["written", true]);
  check("REPLAYED VERDICT is the STORED one, not a regrade of the new sheet",
    [res2.score, res2.correctCount, res2.totalQuestions], [30, 3, 10]);
  check("still exactly ONE attempt doc", await attemptsCount(), before);
  const after = (await db.collection("attempts").doc(res.attemptId).get()).data();
  check("submittedAt byte-identical (zero writes)", after.submittedAt.toMillis(), submittedAtBefore);
  check("stored answers untouched by the second sheet",
    after.answers.filter((r) => r.blank === true).length, 5);
}

// ===========================================================================
CASE("SB-NEWVSREV — the NEW-word path vs the REVIEW path diverge correctly");
{
  await seedConfig({ rehearsalClassIds: ["C2"] });
  await seedClass("C2", { listId: "L2", students: ["s2"], asg: { pace: 3 } });
  await seedWords("L2", 20);
  await seedProgress("s2", "C2", "L2", { csd: 1, twi: 10 });
  const storage = fakeStorage();
  const deps = { ...tabDeps("s2"), storage };
  const newC = await composeNewTestV2(
    { uid: "s2", classId: "C2", listId: "L2", logicalDay: 2 },
    { storage, composeNewTestFn: composeNewAs("s2") });
  check("new test composed [w10..w12]", newC.presentedWordIds, ["w10", "w11", "w12"]);
  const newRes = await submitAttemptV2({
    uid: "s2", classId: "C2", listId: "L2", logicalDay: 2, kind: "new",
    presentationId: newC.presentationId, answers: sheetFor(newC.presentedWordIds, 3, 0),
  }, deps);
  check("new attempt written, perfect score", [newRes.outcome, newRes.score, newRes.passed], ["written", 100, true]);
  const newDoc = (await db.collection("attempts").doc(newRes.attemptId).get()).data();
  check("sessionType new + the day's ANCHOR RANGE persisted (twi continuity)",
    [newDoc.sessionType, newDoc.newWordStartIndex, newDoc.newWordEndIndex], ["new", 10, 12]);
  checkTrue("new testId family", newDoc.testId.endsWith("_new"));

  const revC = await composeReviewSessionV2(
    { uid: "s2", classId: "C2", listId: "L2", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s2") });
  const revRes = await submitAttemptV2({
    uid: "s2", classId: "C2", listId: "L2", logicalDay: 2, kind: "review",
    presentationId: revC.presentationId, answers: sheetFor(revC.presentedWordIds, 1, 1),
  }, deps);
  check("review attempt written", revRes.outcome, "written");
  const revDoc = (await db.collection("attempts").doc(revRes.attemptId).get()).data();
  check("sessionType review, NO anchor range fields",
    [revDoc.sessionType, "newWordStartIndex" in revDoc, "newWordEndIndex" in revDoc], ["review", false, false]);
  checkTrue("review testId family", revDoc.testId.endsWith("_review"));
  checkTrue("distinct attempts", newRes.attemptId !== revRes.attemptId);
}

// ===========================================================================
CASE("SB-RESET — a moved epoch and a live lock both REFUSE with zero writes");
{
  await seedConfig({ rehearsalClassIds: ["C3"] });
  await seedClass("C3", { listId: "L3", students: ["s3"] });
  await seedWords("L3", 12);
  await seedProgress("s3", "C3", "L3", { csd: 1, twi: 8 });
  const storage = fakeStorage();
  const deps = { ...tabDeps("s3"), storage };
  const composed = await composeReviewSessionV2(
    { uid: "s3", classId: "C3", listId: "L3", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s3") });
  check("pre-reset compose (epoch 0)", [composed.outcome, composed.resetEpoch], ["composed", 0]);
  const args = {
    uid: "s3", classId: "C3", listId: "L3", logicalDay: 2, kind: "review",
    presentationId: composed.presentationId, answers: sheetFor(composed.presentedWordIds, 2, 0),
  };

  // A live reset LOCK refuses first.
  await db.doc("users/s3/progress_meta/L3").set({ resetInProgress: true }, { merge: true });
  const before = await attemptsCount();
  const locked = await submitAttemptV2(args, deps);
  check("live lock ⇒ blocked reset_in_progress", [locked.outcome, locked.status], ["blocked", "reset_in_progress"]);
  checkTrue("reason rendered", locked.reason.length > 0);
  check("zero writes under the lock", await attemptsCount(), before);

  // The reset completes: epoch moves. The OLD presentation must refuse.
  await db.doc("users/s3/progress_meta/L3").set({ resetInProgress: false, resetEpoch: 1 }, { merge: true });
  const stale = await submitAttemptV2(args, deps);
  check("moved epoch ⇒ blocked reset_epoch_mismatch", [stale.outcome, stale.status], ["blocked", "reset_epoch_mismatch"]);
  check("zero writes after the epoch move", await attemptsCount(), before);

  // -- SB-RECREATE: recompose under the NEW epoch, then the submit lands.
  CASE("SB-RECREATE — submit → reset → recompose fresh under the new epoch → submit lands");
  // (The stored compose key is dead — fingerprint moved. The deliberate
  // re-entry path discards it; model that with a fresh-key recompose.)
  const fresh = await composeReviewSessionV2(
    { uid: "s3", classId: "C3", listId: "L3", logicalDay: 2, freshKey: true },
    { storage, composeSessionFn: composeSessionAs("s3") });
  check("fresh compose under epoch 1", [fresh.outcome, fresh.resetEpoch], ["composed", 1]);
  checkTrue("a NEW presentation", fresh.presentationId !== composed.presentationId);
  const landed = await submitAttemptV2({
    ...args, presentationId: fresh.presentationId,
    answers: sheetFor(fresh.presentedWordIds, 1, 0),
  }, deps);
  check("new-epoch submit lands", [landed.outcome, landed.replayed], ["written", false]);
  const landedDoc = (await db.collection("attempts").doc(landed.attemptId).get()).data();
  check("attempt carries the NEW epoch", landedDoc.resetEpoch, 1);
}

// ===========================================================================
CASE("SB-TABS — two tabs submit the SAME presentation concurrently: ONE doc, one creator, one replay");
{
  await seedConfig({ rehearsalClassIds: ["C4"] });
  await seedClass("C4", { listId: "L4", students: ["s4"] });
  await seedWords("L4", 12);
  await seedProgress("s4", "C4", "L4", { csd: 1, twi: 8 });
  const storage = fakeStorage();
  const composed = await composeReviewSessionV2(
    { uid: "s4", classId: "C4", listId: "L4", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s4") });
  const args = {
    uid: "s4", classId: "C4", listId: "L4", logicalDay: 2, kind: "review",
    presentationId: composed.presentationId, answers: sheetFor(composed.presentedWordIds, 2, 1),
  };
  const before = await attemptsCount();
  const [tabA, tabB] = await Promise.all([
    submitAttemptV2(args, tabDeps("s4")),
    submitAttemptV2(args, tabDeps("s4")),
  ]);
  check("both tabs land on attempt_written", [tabA.outcome, tabB.outcome], ["written", "written"]);
  check("exactly one creator + one replay", [tabA.replayed, tabB.replayed].sort(), [false, true]);
  check("same attemptId", tabA.attemptId, tabB.attemptId);
  check("exactly ONE new attempt doc", await attemptsCount(), before + 1);
  check("identical verdicts from both tabs",
    [tabA.score, tabA.totalQuestions], [tabB.score, tabB.totalQuestions]);
}

// ===========================================================================
CASE("SB-THIRD + SB-TEACHER — foreign presentationId and teacher-driven submits: thrown channel ⇒ LEGACY, zero writes");
{
  // s4's presentation exists (previous case). s5 (enrolled classmate) tries it.
  await db.collection("classes").doc("C4").set({ studentIds: ["s4", "s5"] }, { merge: true });
  await seedProgress("s5", "C4", "L4", { csd: 1, twi: 8 });
  const s4Pres = (await db.collection("users").doc("s4").collection("review_presentations").get()).docs[0].id;
  const before = await attemptsCount();
  const third = await submitAttemptV2({
    uid: "s5", classId: "C4", listId: "L4", logicalDay: 2, kind: "review",
    presentationId: s4Pres, answers: [{ wordId: "w0", studentResponse: "def0" }],
  }, tabDeps("s5"));
  // Presentations are PATH-SCOPED per uid: another student's id is NOT FOUND
  // under s5's path — the thrown not-found routes to the legacy fallback
  // (classifyThrownRefusal), and NOTHING is written.
  check("third party ⇒ legacy via thrown not-found", [third.outcome, third.via, third.code],
    ["legacy", "error", "not-found"]);
  check("zero writes", await attemptsCount(), before);

  const teacher = await submitAttemptV2({
    uid: "teacher9", classId: "C4", listId: "L4", logicalDay: 2, kind: "review",
    presentationId: s4Pres, answers: [{ wordId: "w0", studentResponse: "def0" }],
  }, tabDeps("teacher9"));
  check("teacher-driven ⇒ legacy via thrown not-found", [teacher.outcome, teacher.code], ["legacy", "not-found"]);
  check("zero writes", await attemptsCount(), before);
}

// ===========================================================================
CASE("SB-OCCUPIED — the attempt id occupied by a NON-engine doc refuses; the stored doc is untouched");
{
  await seedConfig({ rehearsalClassIds: ["C5"] });
  await seedClass("C5", { listId: "L5", students: ["s6"] });
  await seedWords("L5", 12);
  await seedProgress("s6", "C5", "L5", { csd: 1, twi: 8 });
  const storage = fakeStorage();
  const composed = await composeReviewSessionV2(
    { uid: "s6", classId: "C5", listId: "L5", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s6") });
  // Pre-seed a LEGACY-shaped doc at the engine's derived id (the A4/TR class:
  // provenance is never inferred from the document name).
  const occupiedId = engineDocId("s6", composed.presentationId);
  const legacyShaped = { studentId: "s6", score: 100, passed: true, totalQuestions: 1, answers: [] };
  await db.collection("attempts").doc(occupiedId).set(legacyShaped);
  const res = await submitAttemptV2({
    uid: "s6", classId: "C5", listId: "L5", logicalDay: 2, kind: "review",
    presentationId: composed.presentationId, answers: sheetFor(composed.presentedWordIds, 1, 0),
  }, { ...tabDeps("s6"), storage });
  check("occupied id ⇒ blocked presentation_invalid (fail-closed, never a laundered replay)",
    [res.outcome, res.status], ["blocked", "presentation_invalid"]);
  const stored = (await db.collection("attempts").doc(occupiedId).get()).data();
  check("the occupying doc is byte-untouched",
    { score: stored.score, passed: stored.passed, keys: Object.keys(stored).sort() },
    { score: 100, passed: true, keys: Object.keys(legacyShaped).sort() });
}

// ===========================================================================
CASE("SB-VANISH — typed: the attempt vanishes between the replay pre-read and the txn; the bounded poll self-heals; the grader is charged ONCE");
{
  await seedConfig({ rehearsalClassIds: ["C6"] });
  await seedClass("C6", { listId: "L6", students: ["s7"], asg: { reviewTestType: "typed", reviewTestSize: 3 } });
  await seedWords("L6", 12);
  await seedProgress("s7", "C6", "L6", { csd: 1, twi: 8 });
  const storage = fakeStorage();
  const composed = await composeReviewSessionV2(
    { uid: "s7", classId: "C6", listId: "L6", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s7") });
  check("typed presentation", composed.testType, "typed");
  const args = {
    uid: "s7", classId: "C6", listId: "L6", logicalDay: 2, kind: "review",
    presentationId: composed.presentationId, answers: sheetFor(composed.presentedWordIds, 3, 0),
  };
  const deps = { ...tabDeps("s7"), storage };
  seamGradeCalls = 0;
  const first = await submitAttemptV2(args, deps);
  check("typed submit lands (seam-graded)", [first.outcome, first.score, first.passed], ["written", 100, true]);
  check("the grader ran exactly once", seamGradeCalls, 1);
  const doc1 = (await db.collection("attempts").doc(first.attemptId).get()).data();
  check("typed provenance marker", doc1.correctnessSource, "server-ai");
  check("typed rows carry the grader's reasoning", doc1.answers.every((r) => r.aiReasoning === "seam-graded"), true);

  // Arm the one-shot r74 C8a hook: DELETE the attempt AFTER the submit
  // pre-reads (which see it and skip grading) and BEFORE the txn.
  CALL._testHooks.afterPreflight = async () => {
    await db.collection("attempts").doc(first.attemptId).delete();
  };
  const healed = await submitAttemptV2(args, deps);
  // Call 1 inside the adapter: pre-read sees the attempt → skips grading →
  // hook deletes it → txn refuses grading_in_progress (mint NOTHING from an
  // empty sheet). The adapter's bounded poll retries the SAME submit: the
  // pre-read now sees no attempt → resolveTypedGrade → the job is already
  // `graded` (cached) → rows rebuilt WITHOUT a grader call → written.
  check("the vanish self-heals into a re-written attempt", [healed.outcome, healed.replayed], ["written", false]);
  check("score preserved through the cache", healed.score, 100);
  check("the grader was NOT charged again (metering once)", seamGradeCalls, 1);
  checkTrue("attempt re-exists", (await db.collection("attempts").doc(first.attemptId).get()).exists);
  check("hook consumed (one-shot)", CALL._testHooks.afterPreflight, null);
}

// ===========================================================================
CASE("SB-UNUSABLE — the REAL C3: poisoned job ⇒ recompose EXACTLY ONCE; a second poison is TERMINAL, zero grader spend");
{
  await seedConfig({ rehearsalClassIds: ["C7"] });
  await seedClass("C7", { listId: "L7", students: ["s8"], asg: { reviewTestType: "typed", reviewTestSize: 3 } });
  await seedWords("L7", 12);
  await seedProgress("s8", "C7", "L7", { csd: 1, twi: 8 });
  const storage = fakeStorage();
  const deps = { ...tabDeps("s8"), storage };
  const composed = await composeReviewSessionV2(
    { uid: "s8", classId: "C7", listId: "L7", logicalDay: 2 },
    { storage, composeSessionFn: composeSessionAs("s8") });

  const poison = (presentationId) => db.collection("grading_jobs")
    .doc(engineDocId("s8", presentationId))
    .set({
      uid: "s8", status: "graded",
      payload: {
        results: [{ wordId: "w0", isCorrect: true }],
        source: "reviewV2", presentationId: "SOMEBODY_ELSES_PRESENTATION",
        answerSheetKey: "not-this-sheet",
      },
    });
  await poison(composed.presentationId);

  const presCount = async () =>
    (await db.collection("users").doc("s8").collection("review_presentations").get()).size;
  const presBefore = await presCount();
  const attemptsBefore = await attemptsCount();
  seamGradeCalls = 0;

  const first = await submitAttemptV2({
    uid: "s8", classId: "C7", listId: "L7", logicalDay: 2, kind: "review",
    presentationId: composed.presentationId, answers: sheetFor(composed.presentedWordIds, 3, 0),
  }, deps);
  check("poisoned job ⇒ recomposed (the adapter consumed its ONE recompose)", first.outcome, "recomposed");
  checkTrue("reason rendered", typeof first.reason === "string" && first.reason.length > 0);
  checkTrue("a REAL fresh presentation was composed",
    typeof first.compose?.presentationId === "string" && first.compose.presentationId !== composed.presentationId);
  check("EXACTLY one new presentation minted", await presCount(), presBefore + 1);
  check("zero attempts written", await attemptsCount(), attemptsBefore);
  check("zero grader spend on the poisoned path", seamGradeCalls, 0);
  check("the once-guard is persisted",
    recomposeUsed(recomposeGuardScope({ uid: "s8", classId: "C7", listId: "L7", logicalDay: 2, kind: "review" }), { storage }),
    true);

  // The student retakes the FRESH test — and that job is poisoned too.
  await poison(first.compose.presentationId);
  const second = await submitAttemptV2({
    uid: "s8", classId: "C7", listId: "L7", logicalDay: 2, kind: "review",
    presentationId: first.compose.presentationId,
    answers: sheetFor(first.compose.presentedWordIds, 3, 0),
  }, deps);
  check("SECOND unusable is TERMINAL — no second recompose", [second.outcome, second.status],
    ["blocked", "grade_unusable"]);
  checkTrue("terminal reason rendered", second.reason.length > 0);
  check("presentation count unchanged (no recompose loop)", await presCount(), presBefore + 1);
  check("still zero attempts, still zero grader spend", [await attemptsCount() - attemptsBefore, seamGradeCalls], [0, 0]);
}

// ===========================================================================
const { total, failed, reds } = stats();
const evidencePath = process.env.CUTOVER_B_EMU_RECEIPT
  ? new URL(`file://${process.env.CUTOVER_B_EMU_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/cutover-b-submit-emulator.json", import.meta.url);
writeReceipt(evidencePath, {
  kind: "cutover-b-submit-emulator",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/services/reviewV2Submit.js": sha16("/app/src/services/reviewV2Submit.js"),
    "src/services/reviewV2Client.js": sha16("/app/src/services/reviewV2Client.js"),
    "src/services/reviewV2Compose.js": sha16("/app/src/services/reviewV2Compose.js"),
    "functions/reviewV2/callables.js": sha16("/app/functions/reviewV2/callables.js"),
    "functions/reviewV2/typedGrading.js": sha16("/app/functions/reviewV2/typedGrading.js"),
    "functions/reviewV2/composer.js": sha16("/app/functions/reviewV2/composer.js"),
    "scripts/deepfix2/cutover-b-submit-emulator.mjs": sha16("/app/scripts/deepfix2/cutover-b-submit-emulator.mjs"),
  },
  at: new Date().toISOString(),
});
console.log(`\ncutover-b-submit EMULATOR: ${total} checks, ${failed} failures — evidence written`);
await finalizeRun(fft, failed);
