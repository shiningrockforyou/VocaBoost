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
 *  - The job key is the engine's OWN identity: `rv2_{uid}_{presentationId}`
 *    (composer.js `engineDocId`) — one student's one presentation = one grade.
 *  - [D3 TRUTH REPAIR — rv2-docid-collision fold. This key read
 *    `rv2_{presentationId}` and was described here as "1:1 with a composed
 *    presentation". TRUE PER USER, FALSE GLOBALLY — and `grading_jobs` is a
 *    GLOBAL collection.] `presentationId` carries no uid (presentations.js:445
 *    over composer.js:82-84) and `seq` counts PER USER, so every student in
 *    one class+list+day+epoch produced the same key; because the claim is
 *    fenced on the job's `uid` FIELD (index.js:936-938), the SECOND student to
 *    submit a typed test got `permission-denied` on their own test. The uid is
 *    now part of the derived key. It is a NAMESPACE, not a fence: the key is
 *    still client-derivable and the acceptance test below still trusts nothing
 *    about who claimed it.
 *  - [D1 TRUTH REPAIR — this header previously claimed the key was
 *    "replay-safe by construction, and collision-free against the legacy key
 *    space (client attempt nonces)". THAT WAS FALSE.] The LIVE grader takes
 *    its job key from CLIENT-SUPPLIED `writeContext/gradeContext.attemptDocId`
 *    (functions/index.js:1048-1051) with no namespace restriction, and the
 *    client knows its own presentationId (src/services/reviewV2Client.js:173).
 *    `rv2_` is therefore a NAMING CONVENTION, not a namespace boundary: any
 *    student may claim and populate `rv2_{any uid}_{any presentationId}`
 *    through the live callable — their own key or another student's — with
 *    answers and verdicts of their choosing (lap CASE RC third-party/teacher
 *    rows name the VICTIM's full uid-scoped key and still reach it). The engine
 *    consequently trusts NOTHING derived from the key — a cached payload is
 *    usable only when it PROVES engine provenance, this presentation, and
 *    this answer sheet (`usableCachedResults` below, 18_ §5.6). Hardening the
 *    live key namespace AT ITS SOURCE is carded separately (ledger E1): it
 *    touches the path 947 students use today.
 *    [NAMESPACE RESERVED — 2026-08-04, NTF 19+22 fold. The description above
 *    is KEPT because it explains why this module trusts nothing derived from
 *    the key.] That hardening has now landed at the source: the live
 *    callables refuse any client-supplied `rv2_`-prefixed attemptDocId with
 *    `invalid-argument` (functions/index.js `assertNotEngineReservedDocId` —
 *    G2 submitVocabAttempt, G3 gradeTypedTest, checked BEFORE any read/claim/
 *    write on the key), and firestore.rules denies client create/update/
 *    delete at `rv2_`-named attempt ids (G1, all write verbs). The acceptance
 *    test below REMAINS LOAD-BEARING as the consumer-side half of the fence —
 *    it holds where the mouth guards do not apply (Admin SDK writes,
 *    documents predating the guards, a future rules regression).
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
 *    [D1 TRUTH REPAIR — ai-metering-build. This bullet described GRADER CALLS
 *    at a time when no counter existed, so "metering once" was a statement
 *    about spend, not about a meter.] A meter exists now: the per-student and
 *    global counters (`ai_metering/*`) increment inside the grading-job CLAIM
 *    transaction (functions/index.js `claimOrRecoverGradingJob`, the contract's
 *    counting point), and ONLY on the branches that actually invoke the
 *    grader. So the cached-return path increments NO counter either, and
 *    neither does an in-progress claim or the caller's replay short-circuit.
 *  - THE SPEND CAP IS RE-TEST-ONLY [ai-metering-build]: this module threads an
 *    explicit `isRetest` argument from the caller that knows the presentation's
 *    server-written `requestFingerprint.kind`. Absence reads as LIVE, so a
 *    live/required typed test can never be refused by the meter; only the
 *    optional rerun leg can come back `practice_limit_reached`.
 *  - EVERY REFUSAL IS DATA [C5/L-3], and the refusal SPLITS on whether the
 *    condition resolves itself [rv2-refusal-status fold — D1 TRUTH REPAIR:
 *    this bullet used to call `grading_in_progress` "the one retryable typed
 *    status", which conflated two OPPOSITE conditions]:
 *      · `grading_in_progress` — TRANSIENT. A live lease held by a concurrent
 *        worker, or a persist that established no authority. The client polls:
 *        retry the SAME submit, never recompose. Fail-CLOSED — a worker that
 *        never established authority must not mint an attempt.
 *      · `grade_unusable` — PERMANENT. A `graded` job whose cached payload
 *        failed the acceptance test below (foreign/poisoned/stale). A `graded`
 *        job never self-clears, so polling can NEVER succeed. The client
 *        recomposes ONCE (a new presentationId ⇒ a new job key); it must NOT
 *        poll.
 *    Both are frozen in src/services/reviewV2Client.js RV2.
 */

"use strict";

const crypto = require("crypto");
// [rv2-docid-collision A1] the SHARED derivation for the engine's global doc
// ids — the attempt id and this module's job key must never drift apart.
// composer.js requires only crypto/firestore/config.js, so there is no cycle.
const {engineDocId} = require("./composer");
// [ai-metering-build A3] the meter's config reader + the refusal shape. Pure
// module; no cycle (it requires the KST day helper lazily and nothing else).
const aiMetering = require("../aiMetering");

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

/**
 * ANSWER-SHEET IDENTITY [18_ §5.6] — what a cached grade is a grade OF.
 *
 * A grade is only reusable for the sheet it was computed from, so the sheet
 * needs an identity. It is the set of (presented wordId → normalized submitted
 * response) PAIRS, hashed. Consequences, each fixtured:
 *  - ORDER IS NOT IDENTITY: the pairs are sorted by wordId, so a different
 *    presentation order of the same answers still reuses the cache.
 *  - BLANKS ARE PART OF THE SHEET: a presented word with no submitted answer
 *    is the pair (wordId, ""), so blank→filled drift fails closed even though
 *    blanks never reach the AI.
 *  - WHITESPACE IS NOT IDENTITY, CASE IS. The grader treats a response as
 *    blank on `.trim()` (below) and the AI cannot meaningfully verdict on
 *    surrounding/repeated whitespace, so a legitimate replay must not fail
 *    closed on a trailing space. Case CAN change a verdict and no legitimate
 *    replay re-types an answer, so case drift is drift.
 */
function normalizeResponse(raw) {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}
function answerSheetKey({presentedWordIds, submitted}) {
  const pairs = presentedWordIds
      .map((wordId) => [String(wordId), normalizeResponse(submitted.get(wordId) ?? "")])
      .sort((a, b) => (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)));
  return crypto.createHash("sha256").update(JSON.stringify(pairs)).digest("hex");
}

/**
 * THE CACHED-GRADE ACCEPTANCE TEST [A1+A2 · 18_ §5.6] — the ONE seam where a
 * grade the engine did not compute can enter graduation-bearing rows.
 *
 * Until this fold the test was `Array.isArray(payload.results)` alone, and the
 * job key is CLAIMABLE BY THE CLIENT through the live grader (see the D1 note
 * in the header). So a student could pre-seed `rv2_{uid}_{presentationId}` with
 * self-chosen answers, and the engine would build its attempt rows from that
 * foreign grade. THREE clauses close it; a payload failing ANY of them is not
 * a grade of this submission and the caller fails CLOSED:
 *   (a) ENGINE PROVENANCE — only this module writes `source: "reviewV2"`, and
 *       the live grader's payload shape (index.js:1136-1141) cannot carry it:
 *       every field there is server-constructed.
 *   (b) THIS PRESENTATION — a grade cached under another presentation's key,
 *       or replayed across presentations, is not this test's grade.
 *   (c) THIS ANSWER SHEET — the grade must be a grade OF the sheet being
 *       submitted now (see answerSheetKey above).
 * A payload written by an OLDER engine build (before this fold) carries none
 * of the three and is therefore REFUSED, not trusted: the engine is dark
 * (REVIEW_V2_CLIENT=false) so no such cache exists for a live student, and the
 * caller's refusal is DATA — the student recomposes rather than inheriting an
 * unverifiable grade.
 */
function usableCachedResults(payload, {presentationId, sheetKey}) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.source !== "reviewV2") return null;
  if (typeof presentationId !== "string" || presentationId.length === 0) return null;
  if (payload.presentationId !== presentationId) return null;
  if (typeof sheetKey !== "string" || sheetKey.length === 0) return null;
  if (payload.answerSheetKey !== sheetKey) return null;
  return Array.isArray(payload.results) ? payload.results : null;
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
 *   submitted: Map<string,string>, wordMetaById: Map<string,object>,
 *   isRetest?: boolean}} args `isRetest` is THE spend-cap discriminator
 *   [ai-metering-build]: the caller passes the presentation's server-written
 *   `requestFingerprint.kind === "rerun"`. Read with strict `=== true`, so an
 *   absent/undefined/malformed value is LIVE and can never be refused.
 * @returns {Promise<{refusal: object}|{rows: Array<object>, jobKey: string,
 *   cached: boolean, graderCalls: number}>} `refusal` is a typed DATA status
 *   with ZERO writes performed by this module beyond the job lease itself.
 */
async function resolveTypedGrade(db, {uid, classId, listId, presentationId,
  presentedWordIds, submitted, wordMetaById, isRetest}) {
  // [rv2-docid-collision A1] `grading_jobs` is GLOBAL and the claim is fenced
  // on the job's `uid` FIELD (index.js:936-938) — under the unscoped key every
  // student after the first in a class+list+day+epoch hit `permission-denied`
  // on their own test. SAME derivation as callables.js's `attemptId`.
  const jobKey = engineDocId(uid, presentationId);
  // THE SHEET BEING SUBMITTED NOW [A2] — computed BEFORE the claim so both
  // cached-payload seams below test against the same identity.
  const sheetKey = answerSheetKey({presentedWordIds, submitted});
  const jobs = gradingJobs();
  // [ai-metering-build A3] THE DISCRIMINATOR, strict. Only a caller that
  // explicitly declares a rerun can ever be refused by the spend cap.
  const retest = isRetest === true;
  // The limits are read OUTSIDE the claim transaction on purpose: a config doc
  // inside that txn's read set would serialize every grading claim against a
  // config edit. And the LIVE path is never refused, so it needs no limits at
  // all and does not pay for this read.
  const meterConfig = retest ? await aiMetering.readMeteringConfig(db) : null;
  const claim = await jobs.claimOrRecoverGradingJob(uid, jobKey,
      {isRetest: retest, config: meterConfig});

  // THE SPEND CAP DECLINED THIS RE-TEST [ai-metering-build A5]: DATA, zero
  // writes — no lease was taken and no counter moved. Non-transient: polling
  // cannot clear it (the window is a KST day) and recomposing cannot either (a
  // new presentation is a new job key, still capped), so the client must render
  // it and stop. Unreachable on a live/required test by construction (`retest`
  // is false there, and the claim's own guard is strict `=== true` too).
  if (claim.action === "capped") return {refusal: aiMetering.practiceLimitRefusal(claim.scope)};

  // A live lease held by a concurrent submit ⇒ retryable DATA, ZERO writes
  // [§5.5]. The client polls the SAME submit; it never recomposes.
  if (claim.action === "in_progress") return {refusal: {status: "grading_in_progress"}};

  let results = null;
  let cached = false;
  let graderCalls = 0;

  if (claim.action === "return_cached") {
    // THE LOST-RESPONSE PATH [D2 TRUTH REPAIR — this comment used to ASSERT
    // that "a prior worker already graded this exact presentation"; nothing
    // checked it. It is now ENFORCED, not assumed]: reuse the cache only when
    // `usableCachedResults` proves engine provenance + this presentation +
    // this answer sheet. No re-grade, no second charge [§5.4]; a payload that
    // fails any clause is a foreign or stale grade and mints NOTHING — and
    // because the job is already `graded` and never self-clears, the refusal
    // is the PERMANENT status: recompose once, do NOT poll. Returning the
    // transient status here told a conforming client to poll forever
    // [rv2-refusal-status].
    // Fixtures: lap CASE TX poison-before-submit / cross-presentation /
    // sheet-drift · the legitimate leg is lap CASE T-3 + TX legit-replay.
    results = usableCachedResults(claim.payload, {presentationId, sheetKey});
    if (results === null) return {refusal: {status: "grade_unusable"}};
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
        {results: fresh, source: "reviewV2", presentationId, answerSheetKey: sheetKey});
    if (outcome === "already_graded") {
      // Another worker cached first — THEIRS is canonical (never ours). THE
      // SIBLING SEAM [A1]: this branch consumes a payload we did not write,
      // exactly like `return_cached` above, and is REACHABLE by the same
      // poisoning (our lease expires → the live grader takes the key over →
      // status becomes `graded` → our persist returns `already_graded`). It
      // takes the SAME acceptance test; guarding only the direct path is the
      // defect class this fold exists to close. And the SAME refusal status:
      // the job is `graded` and never self-clears, so this too is PERMANENT —
      // recompose once, do NOT poll [rv2-refusal-status].
      const snap = await db.collection("grading_jobs").doc(jobKey).get();
      // TWO SUB-CONDITIONS, and they are NOT the same class [independent audit F1].
      // This fold's first cut collapsed both into `grade_unusable` via
      // `snap.exists ? … : null`, which turned a CORRECT classification into a
      // wrong one: a job that has VANISHED is TRANSIENT, not permanent — a retry
      // re-claims the absent key, re-grades, and lands. Only a job that EXISTS and
      // whose payload fails the acceptance test is permanently unusable.
      // Unreachable today (nothing deletes a `graded` job: rules deny every client
      // write, reset only flips `claimed`, and no TTL is configured) — so this is
      // LATENT, and it goes live the day a TTL or cleanup touches `grading_jobs`.
      // Left mis-classified it would tell that student to recompose, discarding
      // answers they had already submitted, when polling would have landed them.
      if (!snap.exists) return {refusal: {status: "grading_in_progress"}};
      const theirs = usableCachedResults(snap.data().payload, {presentationId, sheetKey});
      if (theirs === null) return {refusal: {status: "grade_unusable"}};
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
  usableCachedResults,
  answerSheetKey,
  normalizeResponse,
  UNGRADEABLE_REASON,
  GRADE_BATCH_MAX,
  _typedSeam, // emulator-only [18_ §6 — the AI grader cannot run here]
};
