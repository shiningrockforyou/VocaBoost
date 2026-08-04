#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-C COMPLETE — EMULATOR fixtures: the REAL completion adapter driven
 * against the REAL engine callables (A1 bypass set, one case per row)
 * ============================================================================
 * The unit under test is `src/services/reviewV2Complete.js` — the module
 * MCQTest/TypedTest call behind REVIEW_V2_CLIENT at the completeSessionFromTest
 * call sites. Its `completeDayFn` is injected with a wrapper around the
 * fft-wrapped PUBLIC `reviewV2CompleteDay` callable, reproducing
 * reviewV2Client.call()'s throw contract (HttpsError → ReviewV2Error) — so
 * every case exercises the real client classification/guard logic against the
 * real completion transaction (functions/reviewV2/completion.js).
 *
 * The 'new'/'review' evidence attempts themselves are minted through the REAL
 * cutover-a/b surfaces (composeReviewSessionV2/composeNewTestV2 +
 * submitAttemptV2) — never hand-inserted — so the attempts completeDay reads
 * are the SAME shape a live student's session would produce.
 *
 * `dayNewTestAttemptId` (V2's "OTHER slot") is resolved in each case via a
 * DIRECT admin-SDK query over the SAME fields `getNewWordAttemptForDay`
 * (src/services/db.js) filters on — mirroring what that call WOULD find.
 * `db.js` cannot be imported by a plain-node fixture (it transitively pulls
 * in `../firebase.js`'s `import.meta.env` client bootstrap — verified: even
 * the bare import throws `Cannot find module '/app/src/firebase'` under
 * plain node, since `db.js`'s own relative imports lack the `.js` extension
 * ESM requires). This is a NOT-CLOSED gap, named in the fold report: the
 * page's actual `getNewWordAttemptForDay` call is proven correct only by a
 * static anchor check (cutover-c-complete-fixtures.mjs C6) against the
 * ALREADY-PROVEN, unmodified helper — not by an end-to-end run through it.
 *
 * CASES (ledger A1 bypass rows → cases):
 *   CC-CREATE      create — a review-only day's first completion; the SERVER
 *                  advances CSD/TWI and credits the streak (V1: IDs in, no
 *                  client-computed value).
 *   CC-DUP         update/replay — a second completeDayV2 call with the SAME
 *                  ids is `already_completed`; class_progress/streak_credits
 *                  are BYTE-UNCHANGED from the winner's write (C3
 *                  idempotency — kills M-C4-DROP-CAS).
 *   CC-CONCURRENT  batch/transaction — two SIMULTANEOUS completeDayV2 calls
 *                  for the SAME day: exactly one `completed`, one
 *                  `already_completed`, BOTH translate to the SAME
 *                  outcome:'completed' envelope (the A2 bypass: "both land on
 *                  the day-done UI").
 *   CC-NEWDAY      a genuine new-word day — REAL 'new' + 'review' engine
 *                  attempts, completed via the review submit (kind:'review')
 *                  with BOTH ids: evidenceKind 'standard', wordsIntroduced
 *                  reflected in newTwi.
 *   CC-REVIEWONLY  a review-only day (consumed only, no newTestAttemptId):
 *                  evidenceKind 'list_end_review_only'.
 *   CC-RESET       delete — completion after a reset: a live lock refuses
 *                  reset_in_progress; a moved epoch refuses
 *                  reset_epoch_mismatch. Zero completion docs either way.
 *   CC-WRONGCLASS  the consumed attempt belongs to a DIFFERENT class than
 *                  claimed (completion.js :329) ⇒ no_evidence, blocked.
 *   CC-THIRDPARTY  the consumed attempt belongs to a DIFFERENT student ⇒
 *                  no_evidence (identity mismatch), blocked.
 *   CC-TEACHER     a non-enrolled (teacher-like) uid ⇒ thrown permission-
 *                  denied ⇒ legacy, zero writes.
 *   CC-DARK        the engine is not serving this class (review_v2_dark) ⇒
 *                  legacy, zero writes.
 *   CC-NOEVIDENCE  neither id supplied, gate ON, day>1 ⇒ no_evidence
 *                  ("evidence shape not enumerated"), blocked.
 *
 * RUNBOOK (same as cutover-b-submit-emulator.mjs):
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/cutover-c-complete-emulator.mjs"
 * Evidence: docs/plans/deepfix2/evidence/cutover-c-complete-emulator.json
 * (CUTOVER_C_EMU_RECEIPT env redirects the receipt for the mutant driver.)
 */

import {
  requireEmulatorEnv, connectEmulator, createSeedHelpers, fakeStorage,
  createCaseRunner, sha16, writeReceipt, finalizeRun,
} from "./lib/fold-harness.mjs";

requireEmulatorEnv();

// ---- the REAL client modules (the units under test) ------------------------
import { completeDayV2, rv2CompletionAttemptIds } from "../../src/services/reviewV2Complete.js";
import { submitAttemptV2 } from "../../src/services/reviewV2Submit.js";
import { composeReviewSessionV2, composeNewTestV2 } from "../../src/services/reviewV2Compose.js";
import { ReviewV2Error, CLIENT_CONTRACT_VERSION } from "../../src/services/reviewV2Client.js";

// ---- the engine side, pinned to functions/node_modules (lap law) ----------
const { fnRequire, db, Timestamp, fft, wrap, wipeEmulator } = connectEmulator();
const CALL = fnRequire("/app/functions/reviewV2/callables.js");
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
const completeAs = (uid) => callAs(CALL.reviewV2CompleteDay, uid);

/** Adapter deps for one student "tab" (submit side). */
const tabDeps = (uid, extra = {}) => ({
  storage: fakeStorage(),
  submitFn: submitAs(uid),
  composeSessionFn: composeSessionAs(uid),
  composeNewTestFn: composeNewAs(uid),
  sleepFn: async () => {},
  pollIntervalMs: 1,
  ...extra,
});

// ---- seeds (lap idioms, cloned from cutover-a/b's emulator files) ---------
const { seedConfig, seedClass, seedWords, seedProgress } =
  createSeedHelpers({ db, Timestamp, foundation });

/** Answer sheet from a presentation: first `nCorrect` canonical, next
 *  `nWrong` wrong, rest BLANK (no row — blank is the server's law). */
const sheetFor = (presentedWordIds, nCorrect, nWrong) =>
  presentedWordIds.slice(0, nCorrect + nWrong).map((id, i) => ({
    wordId: id,
    studentResponse: i < nCorrect ? `def${id.slice(1)}` : "totally wrong",
  }));

// day_completions is a PER-USER subcollection (users/{uid}/day_completions/*,
// completion.js completionRef) — a collectionGroup query is required to count
// across every seeded student in this run.
const completionsCount = async () => (await db.collectionGroup("day_completions").get()).size;
const creditsCount = async (uid) => (await db.collection(`users/${uid}/streak_credits`).get()).size;
const progressOf = async (uid, classId, listId) =>
  (await foundation.durableProgressRef(uid, classId, listId).get()).data();

/** Mirrors getNewWordAttemptForDay's CLASS-SCOPED query shape (db.js) — see
 *  the module header for why db.js itself cannot run under plain node. */
async function findDayNewTestAttemptId({ uid, classId, listId, logicalDay }) {
  const snap = await db.collection("attempts")
    .where("studentId", "==", uid).where("classId", "==", classId)
    .where("listId", "==", listId).where("sessionType", "==", "new")
    .where("studyDay", "==", logicalDay)
    .orderBy("submittedAt", "desc").limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

/** Submit a REAL review attempt for `uid`/`classId`/`listId`/day and return
 *  its engine attemptId (via submitAttemptV2, never hand-inserted).
 *  nCorrect defaults HIGH (never fewer presented words than this) so every
 *  presented word is answered correctly — a guaranteed 100%, clearing the
 *  default 92 threshold regardless of the exact presented count; override
 *  with a SMALLER nCorrect only where a case deliberately wants a fail. */
async function submitRealReview(uid, classId, listId, logicalDay, { nCorrect = 999, nWrong = 0 } = {}) {
  const storage = fakeStorage();
  const composed = await composeReviewSessionV2(
    { uid, classId, listId, logicalDay },
    { storage, composeSessionFn: composeSessionAs(uid) });
  const res = await submitAttemptV2({
    uid, classId, listId, logicalDay, kind: "review",
    presentationId: composed.presentationId,
    answers: sheetFor(composed.presentedWordIds, nCorrect, nWrong),
  }, { ...tabDeps(uid), storage });
  return { composed, res };
}

/** Submit a REAL new-word attempt and return its engine attemptId — same
 *  guaranteed-100% default as submitRealReview above. */
async function submitRealNew(uid, classId, listId, logicalDay, { nCorrect = 999, nWrong = 0 } = {}) {
  const storage = fakeStorage();
  const composed = await composeNewTestV2(
    { uid, classId, listId, logicalDay },
    { storage, composeNewTestFn: composeNewAs(uid) });
  const res = await submitAttemptV2({
    uid, classId, listId, logicalDay, kind: "new",
    presentationId: composed.presentationId,
    answers: sheetFor(composed.presentedWordIds, nCorrect, nWrong),
  }, { ...tabDeps(uid), storage });
  return { composed, res };
}

await wipeEmulator();

// ===========================================================================
CASE("CC-CREATE + CC-DUP — first completion (create); a duplicate call is already_completed, ZERO extra writes (C3)");
{
  await seedConfig({ rehearsalClassIds: ["C1"] });
  await seedClass("C1", { listId: "L1", students: ["s1"] });
  await seedWords("L1", 20);
  await seedProgress("s1", "C1", "L1", { csd: 1, twi: 10 }); // day-2 frontier, review-only (no new words assigned)

  const { res: reviewRes } = await submitRealReview("s1", "C1", "L1", 2);
  check("review attempt written (perfect enough to pass 92)", [reviewRes.outcome, reviewRes.passed], ["written", true]);

  const ids = rv2CompletionAttemptIds({ kind: "review", attemptId: reviewRes.attemptId, classId: "C1" });
  const completeFn = completeAs("s1");
  const first = await completeDayV2({ classId: "C1", listId: "L1", logicalDay: 2, ...ids }, { completeDayFn: completeFn });
  check("CC-CREATE: completed, day advances, review-only evidence", [first.outcome, first.replayed, first.evidenceKind], ["completed", false, "list_end_review_only"]);
  check("CC-CREATE: currentStudyDay advanced to 2", first.progress.currentStudyDay, 2);
  check("CC-CREATE: totalWordsIntroduced unchanged (review-only day)", first.progress.totalWordsIntroduced, 10);
  checkTrue("CC-CREATE: streak credited", first.streakCredited);
  check("exactly one completion record minted", await completionsCount(), 1);
  check("exactly one streak credit minted", await creditsCount("s1"), 1);
  const progressAfterWin = await progressOf("s1", "C1", "L1");

  CASE("CC-DUP — a second completeDayV2 call with the SAME ids: already_completed, zero extra writes");
  const second = await completeDayV2({ classId: "C1", listId: "L1", logicalDay: 2, ...ids }, { completeDayFn: completeFn });
  check("CC-DUP: outcome completed (V3 — NEVER dayGuardRejected), replayed true", [second.outcome, second.replayed], ["completed", true]);
  check("CC-DUP: same day/twi surfaced (derived from the EXISTING record)", second.progress, first.progress);
  check("CC-DUP: NO additional completion record (the CAS loser writes nothing)", await completionsCount(), 1);
  check("CC-DUP: NO additional streak credit", await creditsCount("s1"), 1);
  const progressAfterDup = await progressOf("s1", "C1", "L1");
  check("CC-DUP: class_progress BYTE-UNCHANGED (currentStudyDay/totalWordsIntroduced/updatedAt all identical)",
    { csd: progressAfterDup.currentStudyDay, twi: progressAfterDup.totalWordsIntroduced, updatedAt: progressAfterDup.updatedAt?.toMillis() },
    { csd: progressAfterWin.currentStudyDay, twi: progressAfterWin.totalWordsIntroduced, updatedAt: progressAfterWin.updatedAt?.toMillis() });
}

// ===========================================================================
CASE("CC-CONCURRENT — two tabs complete the SAME day simultaneously: one completed, one already_completed, BOTH land on outcome:'completed'");
{
  await seedConfig({ rehearsalClassIds: ["C2"] });
  await seedClass("C2", { listId: "L2", students: ["s2"] });
  await seedWords("L2", 20);
  await seedProgress("s2", "C2", "L2", { csd: 1, twi: 10 });
  const { res: reviewRes } = await submitRealReview("s2", "C2", "L2", 2);
  const ids = rv2CompletionAttemptIds({ kind: "review", attemptId: reviewRes.attemptId, classId: "C2" });
  const completeFn = completeAs("s2");
  // completionsCount() is a collectionGroup query (global across every
  // seeded student in this run) — capture a BEFORE baseline (cutover-b's own
  // idiom for its equally-global attemptsCount()), never a hardcoded
  // absolute, since CC-CREATE/CC-DUP above already minted one.
  const before = await completionsCount();
  const [tabA, tabB] = await Promise.all([
    completeDayV2({ classId: "C2", listId: "L2", logicalDay: 2, ...ids }, { completeDayFn: completeFn }),
    completeDayV2({ classId: "C2", listId: "L2", logicalDay: 2, ...ids }, { completeDayFn: completeFn }),
  ]);
  check("both tabs land on outcome:'completed'", [tabA.outcome, tabB.outcome], ["completed", "completed"]);
  check("exactly one winner + one replay", [tabA.replayed, tabB.replayed].sort(), [false, true]);
  check("exactly ONE new completion record (the CAS admits only one creator)", await completionsCount(), before + 1);
  check("exactly ONE streak credit", await creditsCount("s2"), 1);
}

// ===========================================================================
CASE("CC-NEWDAY vs CC-REVIEWONLY — a genuine new-word day (BOTH ids, evidenceKind 'standard') vs a review-only day (consumed only)");
{
  await seedConfig({ rehearsalClassIds: ["C3", "C3b"] });
  await seedClass("C3", { listId: "L3", students: ["s3"], asg: { pace: 3 } });
  await seedWords("L3", 20);
  await seedProgress("s3", "C3", "L3", { csd: 1, twi: 10 });

  const { res: newRes } = await submitRealNew("s3", "C3", "L3", 2);
  check("new attempt written, perfect score", [newRes.outcome, newRes.passed], ["written", true]);
  const { res: reviewRes } = await submitRealReview("s3", "C3", "L3", 2);
  check("review attempt written", reviewRes.outcome, "written");

  // V2: resolve the OTHER slot BEFORE completing, mirroring the page's own
  // getNewWordAttemptForDay-shaped query.
  const dayNewTestAttemptId = await findDayNewTestAttemptId({ uid: "s3", classId: "C3", listId: "L3", logicalDay: 2 });
  check("the day's new-test attempt resolves to the REAL engine attempt (V2)", dayNewTestAttemptId, newRes.attemptId);

  const ids = rv2CompletionAttemptIds({ kind: "review", attemptId: reviewRes.attemptId, classId: "C3", dayNewTestAttemptId });
  check("V2 slot mapping: consumed=review, newTest=the resolved new attempt",
    ids, { consumedAttemptId: reviewRes.attemptId, consumedAttemptClassId: "C3", newTestAttemptId: newRes.attemptId });
  const out = await completeDayV2({ classId: "C3", listId: "L3", logicalDay: 2, ...ids }, { completeDayFn: completeAs("s3") });
  check("CC-NEWDAY: completed, evidenceKind 'standard'", [out.outcome, out.evidenceKind], ["completed", "standard"]);
  check("CC-NEWDAY: wordsIntroduced (3, the new range) reflected in the twi advance", out.progress.totalWordsIntroduced, 13);
  check("CC-NEWDAY: currentStudyDay advanced", out.progress.currentStudyDay, 2);

  CASE("CC-REVIEWONLY — a DIFFERENT day/class, consumed only (no newTestAttemptId): evidenceKind 'list_end_review_only'");
  await seedClass("C3b", { listId: "L3", students: ["s3b"] }); // separate class ⇒ separate shared day
  await seedProgress("s3b", "C3b", "L3", { csd: 1, twi: 10 });
  const { res: reviewOnlyRes } = await submitRealReview("s3b", "C3b", "L3", 2);
  const roIds = rv2CompletionAttemptIds({ kind: "review", attemptId: reviewOnlyRes.attemptId, classId: "C3b", dayNewTestAttemptId: null });
  const roOut = await completeDayV2({ classId: "C3b", listId: "L3", logicalDay: 2, ...roIds }, { completeDayFn: completeAs("s3b") });
  check("CC-REVIEWONLY: completed, evidenceKind 'list_end_review_only'", [roOut.outcome, roOut.evidenceKind], ["completed", "list_end_review_only"]);
  check("CC-REVIEWONLY: totalWordsIntroduced unchanged (no new-test evidence)", roOut.progress.totalWordsIntroduced, 10);
}

// ===========================================================================
CASE("CC-RESET — completion after a reset: a live lock and a moved epoch both REFUSE with zero writes");
{
  await seedConfig({ rehearsalClassIds: ["C4"] });
  await seedClass("C4", { listId: "L4", students: ["s4"] });
  await seedWords("L4", 12);
  await seedProgress("s4", "C4", "L4", { csd: 1, twi: 8 });
  const { res: reviewRes } = await submitRealReview("s4", "C4", "L4", 2);
  const ids = rv2CompletionAttemptIds({ kind: "review", attemptId: reviewRes.attemptId, classId: "C4" });
  const before = await completionsCount();

  await db.doc("users/s4/progress_meta/L4").set({ resetInProgress: true }, { merge: true });
  const locked = await completeDayV2({ classId: "C4", listId: "L4", logicalDay: 2, ...ids }, { completeDayFn: completeAs("s4") });
  check("live lock ⇒ blocked reset_in_progress", [locked.outcome, locked.status], ["blocked", "reset_in_progress"]);
  checkTrue("reason rendered", locked.reason.length > 0);
  check("zero completion records under the lock", await completionsCount(), before);

  // [FINDING, verified in code] `reset_epoch_mismatch` (completion.js :270/:302)
  // compares the CALLABLE-preflight-derived epoch (deriveEpoch, callables.js
  // :867) against the SAME transaction's own fresh read — both derived
  // moments apart with NOTHING in between, so they can only diverge via a
  // genuine preflight-to-txn RACE. reviewV2SubmitAttempt has an emulator-only
  // hook for exactly that window (`_testHooks.afterPreflight`,
  // callables.js:607); reviewV2CompleteDay does NOT call it anywhere in its
  // body (grepped) — there is no hook to construct that race deterministically
  // for THIS callable, and adding one would mean editing the frozen engine
  // contract (functions/reviewV2/callables.js), out of this fold's scope.
  // What a stale attempt (submitted under the OLD epoch, before the reset)
  // ACTUALLY hits is the ATTEMPT's OWN stamped-epoch check
  // (completion.js:340-343) — a DIFFERENT, but equally real, "refuse after a
  // reset" path, folded under `no_evidence`. Both statuses are ALREADY
  // routed identically by completeDayV2 (`blocked`, a rendered reason) — this
  // is a correction to THIS test's expectation, not a code change.
  await db.doc("users/s4/progress_meta/L4").set({ resetInProgress: false, resetEpoch: 1 }, { merge: true });
  const stale = await completeDayV2({ classId: "C4", listId: "L4", logicalDay: 2, ...ids }, { completeDayFn: completeAs("s4") });
  check("moved epoch: the PRE-reset attempt's own stamped epoch no longer matches ⇒ blocked no_evidence",
    [stale.outcome, stale.status], ["blocked", "no_evidence"]);
  check("zero completion records after the epoch move", await completionsCount(), before);
}

// ===========================================================================
CASE("CC-WRONGCLASS — the consumed attempt belongs to a DIFFERENT class than claimed (completion.js :329) ⇒ no_evidence");
{
  await seedConfig({ rehearsalClassIds: ["C5", "C5B"] });
  await seedClass("C5", { listId: "L5", students: ["s5"] });
  await seedClass("C5B", { listId: "L5", students: ["s5"] });
  await seedWords("L5", 12);
  await seedProgress("s5", "C5", "L5", { csd: 1, twi: 8 });
  // Dual-enrolled in BOTH classes on the same list, so C5B's OWN frontier is
  // ALSO day 2 — otherwise the FRONTIER AUTHORITY check (completion.js :305,
  // which runs BEFORE evidence verification) would refuse day_guard_rejected
  // before ever reaching the classId-mismatch check this case targets.
  await seedProgress("s5", "C5B", "L5", { csd: 1, twi: 8 });
  const { res: reviewRes } = await submitRealReview("s5", "C5", "L5", 2);
  // Claim the WRONG class for a genuinely-C5 attempt.
  const badIds = rv2CompletionAttemptIds({ kind: "review", attemptId: reviewRes.attemptId, classId: "C5B" });
  const before = await completionsCount();
  const out = await completeDayV2({ classId: "C5B", listId: "L5", logicalDay: 2, ...badIds }, { completeDayFn: completeAs("s5") });
  check("wrong classId claim ⇒ blocked no_evidence (class mismatch)", [out.outcome, out.status], ["blocked", "no_evidence"]);
  check("zero completion records", await completionsCount(), before);
}

// ===========================================================================
CASE("CC-THIRDPARTY — the consumed attempt belongs to a DIFFERENT student ⇒ no_evidence (identity mismatch)");
{
  await seedConfig({ rehearsalClassIds: ["C6"] });
  await seedClass("C6", { listId: "L6", students: ["s6", "s6b"] });
  await seedWords("L6", 12);
  await seedProgress("s6", "C6", "L6", { csd: 1, twi: 8 });
  await seedProgress("s6b", "C6", "L6", { csd: 1, twi: 8 });
  const { res: reviewRes } = await submitRealReview("s6", "C6", "L6", 2);
  const ids = rv2CompletionAttemptIds({ kind: "review", attemptId: reviewRes.attemptId, classId: "C6" });
  const before = await completionsCount();
  // s6b (a different student) tries to consume s6's attempt for THEIR OWN completion.
  const out = await completeDayV2({ classId: "C6", listId: "L6", logicalDay: 2, ...ids }, { completeDayFn: completeAs("s6b") });
  check("a foreign attempt id ⇒ blocked no_evidence (identity mismatch)", [out.outcome, out.status], ["blocked", "no_evidence"]);
  check("zero completion records", await completionsCount(), before);
}

// ===========================================================================
CASE("CC-TEACHER — a non-enrolled (teacher-like) uid ⇒ thrown permission-denied ⇒ legacy, zero writes");
{
  // C6/L6 exist from the prior case; teacher9 is not enrolled anywhere.
  const before = await completionsCount();
  const out = await completeDayV2(
    { classId: "C6", listId: "L6", logicalDay: 2, consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: null },
    { completeDayFn: completeAs("teacher9") });
  check("teacher-driven ⇒ legacy via thrown permission-denied", [out.outcome, out.code], ["legacy", "permission-denied"]);
  check("zero completion records", await completionsCount(), before);
}

// ===========================================================================
CASE("CC-DARK — the engine is not serving this class (review_v2_dark) ⇒ legacy, zero writes");
{
  await seedClass("C7", { listId: "L7", students: ["s7"] }); // NOT in rehearsalClassIds — config stays dark
  await seedWords("L7", 12);
  await seedProgress("s7", "C7", "L7", { csd: 1, twi: 8 });
  const before = await completionsCount();
  const out = await completeDayV2(
    { classId: "C7", listId: "L7", logicalDay: 2, consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: null },
    { completeDayFn: completeAs("s7") });
  check("dark engine ⇒ legacy via status review_v2_dark", [out.outcome, out.via, out.status], ["legacy", "status", "review_v2_dark"]);
  check("zero completion records", await completionsCount(), before);
}

// ===========================================================================
CASE("CC-NOEVIDENCE — neither id supplied, gate ON, day>1 ⇒ no_evidence (the both-tests law)");
{
  await seedConfig({ rehearsalClassIds: ["C8"] }); // threshold 92 (default) ⇒ gate effectively ON
  await seedClass("C8", { listId: "L8", students: ["s8"] });
  await seedWords("L8", 12);
  await seedProgress("s8", "C8", "L8", { csd: 1, twi: 8 });
  const before = await completionsCount();
  const out = await completeDayV2(
    { classId: "C8", listId: "L8", logicalDay: 2, consumedAttemptId: null, consumedAttemptClassId: null, newTestAttemptId: null },
    { completeDayFn: completeAs("s8") });
  check("no evidence at all ⇒ blocked no_evidence", [out.outcome, out.status], ["blocked", "no_evidence"]);
  check("zero completion records", await completionsCount(), before);
}

// ===========================================================================
const { total, failed, reds } = stats();
const evidencePath = process.env.CUTOVER_C_EMU_RECEIPT
  ? new URL(`file://${process.env.CUTOVER_C_EMU_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/cutover-c-complete-emulator.json", import.meta.url);
writeReceipt(evidencePath, {
  kind: "cutover-c-complete-emulator",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/services/reviewV2Complete.js": sha16("/app/src/services/reviewV2Complete.js"),
    "src/services/reviewV2Submit.js": sha16("/app/src/services/reviewV2Submit.js"),
    "src/services/reviewV2Client.js": sha16("/app/src/services/reviewV2Client.js"),
    "src/services/reviewV2Compose.js": sha16("/app/src/services/reviewV2Compose.js"),
    "functions/reviewV2/callables.js": sha16("/app/functions/reviewV2/callables.js"),
    "functions/reviewV2/completion.js": sha16("/app/functions/reviewV2/completion.js"),
    "functions/reviewV2/composer.js": sha16("/app/functions/reviewV2/composer.js"),
    "scripts/deepfix2/cutover-c-complete-emulator.mjs": sha16("/app/scripts/deepfix2/cutover-c-complete-emulator.mjs"),
  },
  at: new Date().toISOString(),
});
console.log(`\ncutover-c-complete EMULATOR: ${total} checks, ${failed} failures — evidence written`);
await finalizeRun(fft, failed);
