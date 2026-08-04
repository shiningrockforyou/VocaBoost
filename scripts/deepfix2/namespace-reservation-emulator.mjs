#!/usr/bin/env node
/**
 * ============================================================================
 * NAMESPACE-RESERVATION — EMULATOR fixtures: the LIVE callables G2 + G3
 * (NTF 19 + 22 · 20_RV2_NAMESPACE_RESERVATION.md · ledger A2/A3 bypass sets)
 * ============================================================================
 * The units under test are the TWO LIVE legacy callables all 947 students use
 * today, invoked DIRECTLY (fft.wrap — the "via the deployed callable, not the
 * client" bypass row is inherent to this harness):
 *   G2  exports.submitVocabAttempt  → assertNotEngineReservedDocId(context.attemptDocId)
 *       then assertCanWriteAttempt → writeAttemptTxn (Admin SDK — BYPASSES rules,
 *       the vector a rules-only fix leaves open).
 *   G3  exports.gradeTypedTest      → assertNotEngineReservedDocId on BOTH
 *       writeContext.attemptDocId AND gradeContext.attemptDocId, BEFORE the
 *       idempotency read and BEFORE claimOrRecoverGradingJob touches grading_jobs.
 *
 * THE ONE THING THIS PROVES: reserving `^rv2_` at these two mouths denies the
 * permanent-denial squat while denying NOTHING legitimate — the legacy client
 * mints `{uid}_{testId}_{nonce}` ids (testRecovery.js:174), which flow through
 * byte-identically (write lands · cached-return unchanged · in-progress lease
 * unchanged). A false-DENY that breaks a real student is the failure mode
 * feared most, so every deny row is paired with a legit-id ALLOW row.
 *
 * CASES (A2 = G2 submitVocabAttempt · A3 = G3 gradeTypedTest):
 *   G2-DENY-CREATE   create/first submit at rv2_ → invalid-argument; the
 *                    Admin-SDK write NEVER runs (attempts/{rv2_id} absent).
 *   G2-ALLOW-MCQ     legit id, mcq review → writes; doc at the legit id, the
 *                    rv2_ namespace still empty.
 *   G2-ALLOW-TYPED   legit id, typed review → writes (GRADE_TOKEN_ENFORCED=false
 *                    ⇒ correctnessSource null, byte-identical to today).
 *   G2-ALLOW-NEW     legit id, sessionType 'new' with a valid newWordEndIndex
 *                    anchor → writes (the new-word anchor path unchanged).
 *   G2-REPLAY        legit id, submit twice → idempotent: ONE doc, alreadyWritten.
 *   G2-THIRD-PARTY   attacker uid + the VICTIM's rv2_ id → denied by NAME
 *                    before assertCanWriteAttempt (the guard is uid-independent).
 *   G3-DENY-WRITECTX rv2_ via writeContext.attemptDocId → invalid-argument, and
 *                    NO grading_job is claimed (grading_jobs/{rv2_id} absent).
 *   G3-DENY-GRADECTX rv2_ via gradeContext.attemptDocId → same, other field.
 *   G3-ALLOW-CACHED  legit id, gradeContext, a GRADED job pre-seeded → returns
 *                    the cached payload (the return_cached path unchanged; no AI).
 *   G3-ALLOW-INPROG  legit id, a live-lease claimed job → 'aborted'
 *                    grading-in-progress (the lease path unchanged; no AI).
 *   G3-THIRD-PARTY   attacker uid + the VICTIM's rv2_ id → denied by NAME.
 *   XB-CROSS         C7: the SAME victim id string is denied at G2 AND G3 here;
 *                    the rules boundary (G1) denies the identical string in the
 *                    rules matrix (CASE RV1/RV2, VICTIM_ENGINE_ID) — one id,
 *                    all three mouths.
 *
 * RUNBOOK:
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/namespace-reservation-emulator.mjs"
 * Evidence: docs/plans/deepfix2/evidence/namespace-reservation-emulator.json
 * (NS_EMU_RECEIPT env redirects the receipt so the mutant driver never clobbers it.)
 */

import {
  requireEmulatorEnv, connectEmulator, createCaseRunner, sha16, writeReceipt, finalizeRun,
} from "./lib/fold-harness.mjs";

requireEmulatorEnv();

// ---- the engine side, pinned to functions/node_modules (lap law) ----------
const { db, fft, wrap, wipeEmulator, indexModule: INDEX } = connectEmulator();

const submitVocabAttempt = wrap(INDEX.submitVocabAttempt);
const gradeTypedTest = wrap(INDEX.gradeTypedTest);

const { CASE, check, checkTrue, fail, stats } = createCaseRunner({ verbose: true });

/** Invoke a callable and classify the outcome for assertions. */
async function callResult(callable, data, uid) {
  try {
    const out = await callable({ data, auth: uid === undefined ? undefined : { uid, token: {} } });
    return { ok: true, out };
  } catch (err) {
    return { ok: false, code: err?.code ?? "internal", message: err?.message ?? "" };
  }
}
/** Did the call throw invalid-argument specifically about the reserved rv2_ prefix? */
const deniedByGuard = (r) =>
  r.ok === false && r.code === "invalid-argument" && /reserved rv2_ document-id prefix/.test(r.message);

const exists = async (path) => (await db.doc(path).get()).exists;

// ---- identities + seeds ---------------------------------------------------
const VICTIM = "student1";       // the uid encoded in the reserved id
const ATTACKER = "student2";     // an enrolled classmate
const CLASS = "c1";
const LIST = "l1";
// The SHARED cross-boundary victim id (identical shape to rules-matrix
// VICTIM_ENGINE_ID) — C7 proves THIS string is refused at G1/G2/G3.
const VICTIM_ID = "rv2_student1_c1_l1_d3_e0_p1";
const legitId = (uid, testId = "vbtest") => `${uid}_${testId}_1722770000123_ab12cd34e`; // {uid}_{testId}_{nonce}

async function seed() {
  await wipeEmulator();
  await db.doc(`classes/${CLASS}`).set({
    ownerTeacherId: "teacher1",
    studentIds: [VICTIM, ATTACKER],
    assignments: { [LIST]: { name: "seed", passThreshold: 80 } },
  });
  const words = db.batch();
  for (let i = 0; i < 3; i++) {
    words.set(db.doc(`lists/${LIST}/words/w${i}`), { word: `word${i}`, definition: `def${i}`, position: i });
  }
  await words.commit();
}

const mcqAnswers = () => [
  { wordId: "w0", correct: true }, { wordId: "w1", correct: true }, { wordId: "w2", correct: false },
];
const ctxFor = (attemptDocId, { studentId = VICTIM, testType = "mcq", sessionType = "review", extra = {} } = {}) => ({
  studentId, classId: CLASS, listId: LIST, testId: "vbtest",
  attemptDocId, testType, sessionType, totalQuestions: 3, ...extra,
});

// ═══════════════════════════════════════════════════════════════════════════
// G2 — submitVocabAttempt
// ═══════════════════════════════════════════════════════════════════════════
async function runG2() {
  CASE("G2-DENY-CREATE — rv2_ create/first submit refused before the Admin-SDK write");
  await seed();
  {
    const r = await callResult(submitVocabAttempt,
      { testType: "mcq", context: ctxFor(VICTIM_ID), attemptAnswers: mcqAnswers() }, VICTIM);
    checkTrue("owner submit at rv2_ id is denied by the guard", deniedByGuard(r));
    check("the Admin-SDK write did NOT run (attempts/{rv2_id} absent)", await exists(`attempts/${VICTIM_ID}`), false);
  }

  CASE("G2-ALLOW-MCQ — a legit {uid}_{testId}_{nonce} mcq submit still writes");
  {
    const id = legitId(VICTIM);
    const r = await callResult(submitVocabAttempt,
      { testType: "mcq", context: ctxFor(id), attemptAnswers: mcqAnswers() }, VICTIM);
    checkTrue("legit mcq submit succeeds (guard did not fire)", r.ok);
    check("returned attemptId is the legit id", r.out?.attemptId, id);
    check("the attempt doc exists at the legit id", await exists(`attempts/${id}`), true);
    const d = (await db.doc(`attempts/${id}`).get()).data();
    check("stored studentId is the owner", d?.studentId, VICTIM);
    check("review always passes (byte-identical scoring)", d?.passed, true);
  }

  CASE("G2-ALLOW-TYPED — a legit typed submit writes (GRADE_TOKEN_ENFORCED=false ⇒ no marker)");
  {
    const id = legitId(VICTIM, "typedtest");
    const answers = [{ wordId: "w0", isCorrect: true, word: "word0", correctAnswer: "def0", studentResponse: "def0", aiReasoning: "" }];
    const r = await callResult(submitVocabAttempt,
      { testType: "typed", context: { ...ctxFor(id, { testType: "typed" }), totalQuestions: 1 }, attemptAnswers: answers }, VICTIM);
    checkTrue("legit typed submit succeeds", r.ok);
    const d = (await db.doc(`attempts/${id}`).get()).data();
    check("correctnessSource is null (enforcement off — byte-identical to today)", d?.correctnessSource ?? null, null);
  }

  CASE("G2-ALLOW-NEW — a legit 'new' submit with a valid anchor writes (new-word path unchanged)");
  {
    const id = legitId(VICTIM, "newtest");
    const r = await callResult(submitVocabAttempt,
      { testType: "mcq", context: ctxFor(id, { sessionType: "new", extra: { newWordStartIndex: 0, newWordEndIndex: 2, wordsIntroduced: 3, studyDay: 1 } }), attemptAnswers: mcqAnswers() }, VICTIM);
    checkTrue("legit new-word submit succeeds", r.ok);
    const d = (await db.doc(`attempts/${id}`).get()).data();
    check("newWordEndIndex anchor persisted", d?.newWordEndIndex, 2);
  }

  CASE("G2-REPLAY — a legit id submitted twice is idempotent (ONE doc)");
  {
    const id = legitId(VICTIM, "replaytest");
    const a = await callResult(submitVocabAttempt, { testType: "mcq", context: ctxFor(id), attemptAnswers: mcqAnswers() }, VICTIM);
    const b = await callResult(submitVocabAttempt, { testType: "mcq", context: ctxFor(id), attemptAnswers: mcqAnswers() }, VICTIM);
    checkTrue("first submit ok", a.ok);
    checkTrue("second submit ok (idempotent replay)", b.ok);
    check("replay reports alreadyWritten", b.out?.alreadyWritten, true);
  }

  CASE("G2-THIRD-PARTY — attacker uid + the VICTIM's rv2_ id → denied by NAME (uid-independent guard)");
  {
    const r = await callResult(submitVocabAttempt,
      { testType: "mcq", context: ctxFor(VICTIM_ID, { studentId: ATTACKER }), attemptAnswers: mcqAnswers() }, ATTACKER);
    checkTrue("attacker submit at the victim's rv2_ id is denied by the guard", deniedByGuard(r));
    check("no squat document was created", await exists(`attempts/${VICTIM_ID}`), false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// G3 — gradeTypedTest
// ═══════════════════════════════════════════════════════════════════════════
async function runG3() {
  const answers = [{ wordId: "w0", word: "word0", correctDefinition: "def0", studentResponse: "def0" }];

  CASE("G3-DENY-WRITECTX — rv2_ via writeContext.attemptDocId refused before the grading-job claim");
  await seed();
  {
    const r = await callResult(gradeTypedTest,
      { answers, writeContext: { attemptDocId: VICTIM_ID, classId: CLASS, listId: LIST, testType: "typed", totalQuestions: 1 } }, VICTIM);
    checkTrue("denied by the guard", deniedByGuard(r));
    check("NO grading_job was claimed at the rv2_ key", await exists(`grading_jobs/${VICTIM_ID}`), false);
    check("NO attempt was written at the rv2_ key", await exists(`attempts/${VICTIM_ID}`), false);
  }

  CASE("G3-DENY-GRADECTX — rv2_ via gradeContext.attemptDocId refused (the sibling field)");
  {
    const r = await callResult(gradeTypedTest,
      { answers, gradeContext: { attemptDocId: VICTIM_ID, classId: CLASS, listId: LIST, testType: "typed", totalQuestions: 1 } }, VICTIM);
    checkTrue("denied by the guard", deniedByGuard(r));
    check("NO grading_job was claimed at the rv2_ key", await exists(`grading_jobs/${VICTIM_ID}`), false);
  }

  CASE("G3-ALLOW-CACHED — a legit id with a GRADED job pre-seeded returns the cache (return_cached unchanged, no AI)");
  {
    const id = legitId(VICTIM, "gradecache");
    const payload = { results: [{ wordId: "w0", isCorrect: true, reasoning: "cached" }] };
    await db.doc(`grading_jobs/${id}`).set({ uid: VICTIM, status: "graded", payload });
    const r = await callResult(gradeTypedTest,
      { answers, gradeContext: { attemptDocId: id, classId: CLASS, listId: LIST, testType: "typed", totalQuestions: 1 } }, VICTIM);
    checkTrue("legit id flows through the guard to claimOrRecoverGradingJob", r.ok);
    check("the cached payload is returned unchanged", r.out?.results?.[0]?.reasoning, "cached");
  }

  CASE("G3-ALLOW-INPROG — a legit id with a live-lease claimed job → 'aborted' in-progress (lease path unchanged)");
  {
    const id = legitId(VICTIM, "gradelease");
    await db.doc(`grading_jobs/${id}`).set({
      uid: VICTIM, status: "claimed", leaseId: "other-worker",
      leaseExpiresAt: Date.now() + 120000, // live lease
    });
    const r = await callResult(gradeTypedTest,
      { answers, gradeContext: { attemptDocId: id, classId: CLASS, listId: LIST, testType: "typed", totalQuestions: 1 } }, VICTIM);
    check("legit id reaches the claim and is told to retry (aborted)", r.code, "aborted");
  }

  CASE("G3-THIRD-PARTY — attacker uid + the VICTIM's rv2_ id → denied by NAME");
  {
    const r = await callResult(gradeTypedTest,
      { answers, gradeContext: { attemptDocId: VICTIM_ID, classId: CLASS, listId: LIST, testType: "typed", totalQuestions: 1 } }, ATTACKER);
    checkTrue("attacker grade-claim at the victim's rv2_ id is denied by the guard", deniedByGuard(r));
    check("no grading_job squat was created", await exists(`grading_jobs/${VICTIM_ID}`), false);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// C7 — cross-boundary: ONE victim id, all three mouths
// ═══════════════════════════════════════════════════════════════════════════
async function runCrossBoundary() {
  CASE("XB-CROSS (C7) — the SAME victim id string is denied at every client mouth");
  await seed();
  const g2 = await callResult(submitVocabAttempt,
    { testType: "mcq", context: ctxFor(VICTIM_ID), attemptAnswers: mcqAnswers() }, VICTIM);
  const g3w = await callResult(gradeTypedTest,
    { answers: [{ wordId: "w0", word: "word0", correctDefinition: "def0", studentResponse: "x" }],
      writeContext: { attemptDocId: VICTIM_ID, classId: CLASS, listId: LIST, testType: "typed", totalQuestions: 1 } }, VICTIM);
  const g3g = await callResult(gradeTypedTest,
    { answers: [{ wordId: "w0", word: "word0", correctDefinition: "def0", studentResponse: "x" }],
      gradeContext: { attemptDocId: VICTIM_ID, classId: CLASS, listId: LIST, testType: "typed", totalQuestions: 1 } }, VICTIM);
  checkTrue("G2 submitVocabAttempt denies the victim id", deniedByGuard(g2));
  checkTrue("G3 gradeTypedTest (writeContext) denies the victim id", deniedByGuard(g3w));
  checkTrue("G3 gradeTypedTest (gradeContext) denies the victim id", deniedByGuard(g3g));
  check("no attempt squat exists at the victim id after all mouths", await exists(`attempts/${VICTIM_ID}`), false);
  check("no grading_job squat exists at the victim id after all mouths", await exists(`grading_jobs/${VICTIM_ID}`), false);
  console.log(`  NOTE: the G1 (rules) mouth denies the identical string '${VICTIM_ID}' shape in rules-matrix CASE RV1/RV2.`);
}

// ---- driver ---------------------------------------------------------------
const sourceShas = {
  "index.js": sha16("/app/functions/index.js"),
  "reviewV2/typedGrading.js": sha16("/app/functions/reviewV2/typedGrading.js"),
};

try {
  await runG2();
  await runG3();
  await runCrossBoundary();
} catch (e) {
  console.error("FATAL during run:", e?.stack || e);
  fail(`FATAL: ${e?.message || e}`);
}

const { total, failed, reds } = stats();
const receipt = {
  kind: "namespace-reservation-emulator",
  pass: failed === 0,
  total, failed,
  reds,
  sourceShas,
  guards: {
    G2: "submitVocabAttempt → assertNotEngineReservedDocId(context.attemptDocId)",
    G3: "gradeTypedTest → assertNotEngineReservedDocId(writeContext.attemptDocId, gradeContext.attemptDocId)",
  },
  victimId: VICTIM_ID,
  at: new Date().toISOString(),
};
const OUT = process.env.NS_EMU_RECEIPT
  || new URL("../../docs/plans/deepfix2/evidence/namespace-reservation-emulator.json", import.meta.url);
writeReceipt(OUT, receipt, { trailingNewline: true });

console.log(`\nNAMESPACE-RESERVATION EMULATOR: ${total - failed}/${total} green` + (failed ? "" : " — every mouth refuses rv2_, every legit id flows through"));
if (reds.length) { console.log("REDS:"); for (const r of reds) console.log("  ✗ " + r); }
await finalizeRun(fft, failed);
