/**
 * ============================================================================
 * DEEPFIX2 · DF2-12 — THE ENGINE'S TYPED LEG: claim → grade → persist
 * (18_TYPED_LEG_DESIGN §4, implemented; §5 is the law this file must uphold)
 * ============================================================================
 * The engine grades MCQ itself, in-process, against the canonical
 * `definition` (callables.js). Typed answers are free text, so correctness
 * comes from the AI grader that `exports.gradeTypedTest` already owns — a
 * separate callable that cannot be reached from inside the attempt
 * transaction. This module is the seam between the two.
 *
 * THE DECISION [18_ §3]: reuse `grading_jobs`, do NOT re-implement grading.
 *  - The job key is the engine's OWN identity: `rv2_{presentationId}` — 1:1
 *    with a composed presentation, so one presentation = one grade,
 *    replay-safe by construction, and collision-free against the legacy
 *    key space (client attempt nonces).
 *  - `claimOrRecoverGradingJob` / `persistGradingJobResult` are the LIVE
 *    production helpers (functions/index.js), reached through
 *    `exports._gradingJobs` — one lease protocol, not two.
 *  - The GRADER is `gradeTypedTest` itself, invoked grade-ONLY (no
 *    writeContext, no gradeContext ⇒ its own job leg is inert, so the engine's
 *    claim is never double-claimed and the prompt/metering/provenance are
 *    never duplicated [18_ §3 rejected alternatives]).
 *
 * THE LAWS ENCODED HERE (18_ §5)
 *  - ROW SHAPE IDENTICAL TO MCQ [§5.2]: exactly one row per PRESENTED word.
 *    An ungradeable answer (no canonical word doc, or no verdict from the
 *    grader) is a PRESENT row marked INCORRECT — never a dropped row, which
 *    would strand the student's day at completion's COMPLETE-ROWS fence
 *    (completion.js:374).
 *  - BLANK IS FAIL [R2-17], decided by the SERVER: a blank response is
 *    `{blank: true, isCorrect: false}` regardless of what the grader says,
 *    and is never sent to the AI.
 *  - NO PREIMAGE AT WRITE TIME [§5.3]: rows carry NO `gradedIsCorrect`. The
 *    preimage is born at the FIRST adjudication (stamping.js
 *    gradingPreimageWrites) and is never overwritten; a re-grade must not be
 *    able to launder it, so the engine never rewrites a stored attempt.
 *  - METERING ONCE [§5.4]: the cached-return path calls NO grader. The
 *    caller additionally skips this module entirely when the attempt already
 *    exists (replay ⇒ zero claim, zero grade, zero writes).
 *  - EVERY REFUSAL IS DATA [C5/L-3]: `grading_in_progress` is the one
 *    retryable typed status (frozen in src/services/reviewV2Client.js RV2).
 *    Any non-authoritative persist outcome takes it too — fail-CLOSED, since
 *    a worker that never established authority must not mint an attempt.
 */

"use strict";

/** gradeTypedTest refuses > 100 answers per request — chunk to match. */
const GRADE_BATCH_MAX = 100;

/** The reason string stored on a row we could not obtain a verdict for. */
const UNGRADEABLE_REASON =
  "Could not verify this word — please challenge if you believe this is correct.";

/**
 * EMULATOR-ONLY seam (the same gating pattern as callables.js `_testHooks`):
 * the AI grader cannot run in the emulator, so the lap injects `grade`, and
 * `afterPersist` lets it kill the worker between the grade cache and the
 * attempt write (THE lost-response fixture). Inert in production BY
 * CONSTRUCTION — the overrides are only consulted when
 * `FIRESTORE_EMULATOR_HOST` is set.
 */
const _typedSeam = {grade: null, afterPersist: null};
function _seamActive() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}
function _override(name) {
  return _seamActive() && typeof _typedSeam[name] === "function" ? _typedSeam[name] : null;
}

/** The live grading-job helpers (functions/index.js). Required LAZILY: the
 *  entry point requires this module's caller, so a top-level require would be
 *  a partially-initialized cycle. */
function gradingJobs() {
  const surface = require("../index");
  if (!surface || !surface._gradingJobs) {
    throw new Error("typedGrading: index.js does not expose _gradingJobs");
  }
  return surface._gradingJobs;
}

/**
 * THE GRADER [18_ §3]: `gradeTypedTest`, invoked GRADE-ONLY.
 * No `writeContext`/`gradeContext` ⇒ (a) it writes no attempt, (b) its own
 * grading-job leg is disabled (`jobAttemptDocId` null) so it cannot collide
 * with the engine's claim on the same key, and (c) it never mints a
 * gradeToken (no bindCtx), so it takes no GRADE_TOKEN_SECRET dependency.
 * `listId`/`classId` still drive the server-authoritative answer key and the
 * anti-oracle entitlement gate (callerMayResolveList).
 */
async function defaultGrade({uid, classId, listId, answers}) {
  const surface = require("../index");
  const res = await surface.gradeTypedTest.run({
    data: {answers, listId, classId},
    auth: {uid},
  });
  return Array.isArray(res?.results) ? res.results : [];
}

/** A cached job payload is usable only when it carries a results ARRAY. */
function resultsOf(payload) {
  return payload && Array.isArray(payload.results) ? payload.results : null;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * PURE row builder (fixture-facing) — THE COMPLETE-ROWS law for typed.
 *
 * @param {{presentedWordIds: string[], submitted: Map<string,string>,
 *   wordMetaById: Map<string,object>, results: Array<object>}} input
 * @returns {Array<object>} exactly `presentedWordIds.length` rows, in
 *   presentation order. `isCorrect` is true ONLY for a non-blank, resolvable
 *   answer the grader affirmed.
 */
function buildTypedRows({presentedWordIds, submitted, wordMetaById, results}) {
  const byWordId = new Map();
  for (const r of Array.isArray(results) ? results : []) {
    if (r && typeof r.wordId === "string" && !byWordId.has(r.wordId)) byWordId.set(r.wordId, r);
  }
  return presentedWordIds.map((wordId) => {
    const raw = submitted.get(wordId) ?? "";
    const blank = String(raw).trim() === "";
    const meta = wordMetaById.get(wordId) ?? null;
    const key = meta && meta.definition != null ? meta.definition : null;
    const verdict = byWordId.get(wordId) ?? null;
    // Ungradeable = a non-blank answer we could not adjudicate (word doc gone
    // at submit time, or the grader returned no verdict for it). PRESENT +
    // INCORRECT [§5.2] — the row count is the student's day.
    const ungradeable = !blank && (key === null || verdict === null ||
      typeof verdict.isCorrect !== "boolean");
    const isCorrect = !blank && !ungradeable && verdict.isCorrect === true;
    const reasoning = blank
      ? "No answer provided"
      : (ungradeable ? UNGRADEABLE_REASON : String(verdict.reasoning ?? ""));
    return {
      wordId,
      studentResponse: raw,
      correctDefinition: key,
      isCorrect,
      aiReasoning: reasoning,
      ...(blank ? {blank: true} : {}),
      ...(ungradeable ? {ungradeable: true} : {}),
      // NO `gradedIsCorrect` [§5.3]: the preimage is written only by the
      // first adjudication, where it is absent.
    };
  });
}

/**
 * THE TYPED LEG [18_ §4 steps 2-3]: claim → grade → persist → rows.
 * Owns NO attempt write; the caller's transaction does that with the full
 * engine stamp set.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid: string, classId: string, listId: string,
 *   presentationId: string, presentedWordIds: string[],
 *   submitted: Map<string,string>, wordMetaById: Map<string,object>}} args
 * @returns {Promise<{refusal: object}|{rows: Array<object>, jobKey: string,
 *   cached: boolean, graderCalls: number}>} `refusal` is a typed DATA status
 *   with ZERO writes performed by this module beyond the job lease itself.
 */
async function resolveTypedGrade(db, {uid, classId, listId, presentationId,
  presentedWordIds, submitted, wordMetaById}) {
  const jobKey = `rv2_${presentationId}`;
  const jobs = gradingJobs();
  const claim = await jobs.claimOrRecoverGradingJob(uid, jobKey);

  // A live lease held by a concurrent submit ⇒ retryable DATA, ZERO writes
  // [§5.5]. The client polls the SAME submit; it never recomposes.
  if (claim.action === "in_progress") return {refusal: {status: "grading_in_progress"}};

  let results = null;
  let cached = false;
  let graderCalls = 0;

  if (claim.action === "return_cached") {
    // THE LOST-RESPONSE PATH: a prior worker already graded this exact
    // presentation. Reuse it — no re-grade, no second charge [§5.4].
    results = resultsOf(claim.payload);
    if (results === null) return {refusal: {status: "grading_in_progress"}};
    cached = true;
  } else {
    // We own the lease. Only NON-BLANK, resolvable answers reach the AI:
    // blanks are fail by law and unresolvable rows are ungradeable by law,
    // so paying to grade them would be pure waste.
    const gradeInputs = [];
    for (const wordId of presentedWordIds) {
      const raw = submitted.get(wordId) ?? "";
      if (String(raw).trim() === "") continue;
      const meta = wordMetaById.get(wordId) ?? null;
      if (!meta || meta.definition == null) continue;
      gradeInputs.push({
        wordId,
        word: meta.word ?? "",
        correctDefinition: meta.definition,
        koreanDefinition: (meta.definitions && meta.definitions.ko) ?? null,
        studentResponse: String(raw),
      });
    }
    const grade = _override("grade") ?? defaultGrade;
    const fresh = [];
    for (const batch of chunk(gradeInputs, GRADE_BATCH_MAX)) {
      graderCalls++;
      const out = await grade({uid, classId, listId, answers: batch});
      if (Array.isArray(out)) fresh.push(...out);
    }
    // Cache the grade on the job BEFORE the attempt write, fenced on our
    // lease — that is what makes a lost response replayable.
    const outcome = await jobs.persistGradingJobResult(uid, jobKey, claim.leaseId,
        {results: fresh, source: "reviewV2", presentationId});
    if (outcome === "already_graded") {
      // Another worker cached first — THEIRS is canonical (never ours).
      const snap = await db.collection("grading_jobs").doc(jobKey).get();
      const theirs = resultsOf(snap.exists ? snap.data().payload : null);
      if (theirs === null) return {refusal: {status: "grading_in_progress"}};
      results = theirs;
      cached = true;
    } else if (outcome !== "persisted") {
      // superseded | lease_expired | absent | error ⇒ authority was never
      // established. FAIL-CLOSED: mint nothing, let the caller retry into the
      // winner's cached grade (the index.js fencing law, as DATA).
      return {refusal: {status: "grading_in_progress"}};
    } else {
      results = fresh;
    }
    const afterPersist = _override("afterPersist");
    if (afterPersist) await afterPersist({jobKey, uid, results});
  }

  return {
    rows: buildTypedRows({presentedWordIds, submitted, wordMetaById, results}),
    jobKey, cached, graderCalls,
  };
}

module.exports = {
  resolveTypedGrade,
  // Pure/fixture-facing surface:
  buildTypedRows,
  UNGRADEABLE_REASON,
  GRADE_BATCH_MAX,
  _typedSeam, // emulator-only [18_ §6 — the AI grader cannot run here]
};
