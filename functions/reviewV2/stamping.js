/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — STAMPING: the six-label attempt-txn writer +
 * the §6b grading-preimage/adjudication duties (H6 §1 + §6b + R2-32/41/43/48)
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69). Sources:
 * 15_H6 §1 (the six fields + COMPLETE-ROWS law [r64]), §6b (the adjudication
 * law + THE GRADING-PREIMAGE SCHEMA [r66/r67] + the R2-43 resting guard), §7
 * (THE STAMPING PREDICATE [R2-48]), 11_ R2-41 (unified stamping — EVERY
 * graded test; the clock advances on review-TYPE tests incl. reruns; proof
 * pass-gated), R2-32 (kill-switch per-field law, scoped post-activation by
 * R2-48), R2-17 (blank = fail).
 *
 * DARK BY CONSTRUCTION: no caller until the index.js wiring (step 7); the
 * eligibility predicate additionally hard-gates every write (below).
 *
 * THE LAWS ENCODED HERE
 *  - WRITER ELIGIBILITY [R2-48]: labels write iff `config.stampingEligible`
 *    (firstEnabledAt set ∨ rehearsal class). Ineligible ⇒ ZERO label writes —
 *    the dark window has zero live writers outside `rehearsalClassIds`; B3
 *    owns the real cohort's fields exclusively until the flip.
 *  - PER-FIELD POSTURE [R2-32, post-activation scope]: gate-OFF
 *    (`gateEffectiveEnabled === false`) keeps fail + correct + the rotation
 *    clock writing; `reviewLastProvenAt` FREEZES (OFF auto-passes never
 *    prove). Reruns follow the SAME OFF law [R2-41].
 *  - STAMPS PER PRESENTED WORD [R2-41, blank=fail R2-17]: wrong-or-BLANK ⇒
 *    `reviewFailCount` +1 and `reviewLastFailedAt`; correct ⇒
 *    `reviewLastCorrectAt`; correct on a PASSING attempt ⇒
 *    `reviewLastProvenAt`; review-TYPE tests (live + rerun) additionally
 *    advance `reviewLastTestedAt` on EVERY presented word. New-word tests
 *    never touch the clock. `reviewRestingUntil` is NEVER written here — it
 *    is born in the graduation txn only (§1 LIVE-ONLY law).
 *  - COMPLETE-ROWS [r64]: exactly ONE row per presented word — a blank is an
 *    explicit `{wordId, isCorrect:false, blank:true}` row. The stamper
 *    ASSERTS rows ≡ the presented set (drift or absence throws — the attempt
 *    txn aborts rather than stamp from a partial answer sheet).
 *  - CALLER CONTRACT (the attempt txn, wiring step 7): stampLabelsInTxn runs
 *    INSIDE the accepted-attempt transaction whose read set already includes
 *    the §9 tombstones (labels carry no epoch field — the txn fence is the
 *    guard) and whose config snapshot came from resolveReviewConfig on THIS
 *    txn (the activation barrier). Label mint times default to the txn
 *    commit instant (serverTimestamp) so the attempt doc and its stamps
 *    carry ONE instant — the replay-equality basis for B4.
 *  - THE GRADING PREIMAGE [§6b (1), r66/r67]: adjudication writers (challenge
 *    accept AND teacher edit) copy the pre-flip `isCorrect` into
 *    `gradedIsCorrect` BEFORE mutating — append-only grading truth; the
 *    preimage is written ONLY where absent (first adjudication wins; a
 *    second accept cannot launder the preimage).
 *  - R2-43 RESTING GUARD: the accept txn re-reads `reviewRestingUntil`
 *    inside itself — resting ⇒ grade/score/answers fix ONLY (no status
 *    write; the R2-10 label leg skipped); not resting ⇒ the full path.
 *  - R2-10 (accepted-challenge label stamps) is BUILT but DORMANT: activation
 *    requires the four r53 conditions (11_ §2 A2 — condition (iv) is not
 *    closed by this module). Callers pass `r2_10Active` explicitly; it
 *    defaults false. When active: lc (and lp on a passing effective score)
 *    mint at `challengeReviewedAt` [§6b (4)] — never the attempt time.
 */

"use strict";

const {FieldValue} = require("firebase-admin/firestore");

/** The six server-only label fields (§1) — the rules artifact + reset
 *  integration key on this exact list. */
const LABEL_FIELDS = Object.freeze([
  "reviewFailCount",
  "reviewLastFailedAt",
  "reviewLastCorrectAt",
  "reviewLastProvenAt",
  "reviewLastTestedAt",
  "reviewRestingUntil",
]);

/**
 * PURE stamp derivation for one graded attempt (fixture-facing).
 *
 * @param {{rows: Array<{wordId: string, isCorrect: boolean, blank?: boolean}>,
 *   presentedWordIds: string[], isReviewType: boolean, isPassing: boolean,
 *   gateEffectiveEnabled: boolean}} input — `rows` MUST satisfy COMPLETE-ROWS
 *   against `presentedWordIds` (asserted).
 * @returns {Array<{wordId: string, fail: boolean, correct: boolean,
 *   prove: boolean, clock: boolean}>} one plan row per presented word.
 */
function computeLabelStamps({rows, presentedWordIds, isReviewType, isPassing, gateEffectiveEnabled}) {
  if (!Array.isArray(rows) || !Array.isArray(presentedWordIds)) {
    throw new TypeError("computeLabelStamps: rows/presentedWordIds must be arrays");
  }
  const presented = new Set(presentedWordIds);
  if (presented.size !== presentedWordIds.length) {
    throw new TypeError("computeLabelStamps: duplicate presented wordIds");
  }
  if (rows.length !== presented.size) {
    throw new Error(`COMPLETE-ROWS violated: ${rows.length} rows for ${presented.size} presented words`);
  }
  const seen = new Set();
  const plan = [];
  for (const r of rows) {
    if (typeof r?.wordId !== "string" || r.wordId.length === 0 || typeof r.isCorrect !== "boolean") {
      throw new TypeError("computeLabelStamps: each row needs {wordId, isCorrect:boolean}");
    }
    if (!presented.has(r.wordId)) {
      throw new Error(`COMPLETE-ROWS violated: row for unpresented word ${r.wordId}`);
    }
    if (seen.has(r.wordId)) throw new Error(`COMPLETE-ROWS violated: duplicate row ${r.wordId}`);
    seen.add(r.wordId);
    if (r.blank === true && r.isCorrect !== false) {
      throw new Error(`blank row must be isCorrect:false (${r.wordId}) — blank IS fail [R2-17]`);
    }
    plan.push({
      wordId: r.wordId,
      fail: r.isCorrect === false,
      correct: r.isCorrect === true,
      // Proof pass-gated [R2-41b] AND frozen while gate-OFF [R2-32].
      prove: r.isCorrect === true && isPassing === true && gateEffectiveEnabled === true,
      // The rotation clock: review-TYPE tests only, every presented word,
      // reruns included [R2-41d]; unaffected by gate posture (bookkeeping,
      // not privilege — only proof freezes under OFF).
      clock: isReviewType === true,
    });
  }
  return plan;
}

/**
 * Apply one attempt's label stamps INSIDE the accepted-attempt transaction.
 * See the CALLER CONTRACT in the header — this function trusts the enclosing
 * txn's fence/config reads and hard-gates on the R2-48 predicate itself.
 *
 * @param {FirebaseFirestore.Transaction} txn
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid: string, config: object,
 *   rows: Array<{wordId: string, isCorrect: boolean, blank?: boolean}>,
 *   presentedWordIds: string[], isReviewType: boolean, isPassing: boolean,
 *   at?: FirebaseFirestore.Timestamp}} args — `config` = THE txn-resolved
 *   snapshot (resolveReviewConfig); `at` overrides the mint instant (tests);
 *   default = the txn commit time via serverTimestamp.
 * @returns {{stamped: number, skipped: "not_eligible"|null}}
 *   `not_eligible` = the R2-48 predicate said this writer must not exist yet
 *   (dark window / non-rehearsal class) — ZERO writes performed.
 */
function stampLabelsInTxn(txn, db, {uid, config, rows, presentedWordIds, isReviewType, isPassing, at}) {
  if (typeof uid !== "string" || uid.length === 0) {
    throw new TypeError("stampLabelsInTxn: uid required");
  }
  if (!config || config.readStatus !== "ok") {
    // HOLD is an outage, never a posture — minting labels under hold is the
    // r48 violation this throw exists to make impossible.
    throw new Error("stampLabelsInTxn: config snapshot missing or on hold");
  }
  if (config.stampingEligible !== true) {
    return {stamped: 0, skipped: "not_eligible"};
  }
  const plan = computeLabelStamps({
    rows, presentedWordIds, isReviewType, isPassing,
    gateEffectiveEnabled: config.gateEffectiveEnabled,
  });
  const mint = () => at ?? FieldValue.serverTimestamp();
  let stamped = 0;
  for (const p of plan) {
    const update = {};
    if (p.fail) {
      update.reviewFailCount = FieldValue.increment(1);
      update.reviewLastFailedAt = mint();
    }
    if (p.correct) update.reviewLastCorrectAt = mint();
    if (p.prove) update.reviewLastProvenAt = mint();
    if (p.clock) update.reviewLastTestedAt = mint();
    if (Object.keys(update).length === 0) continue;
    txn.set(db.doc(`users/${uid}/study_states/${p.wordId}`), update, {merge: true});
    stamped++;
  }
  return {stamped, skipped: null};
}

/**
 * THE GRADING-PREIMAGE copy [§6b (1)] — pure. Given the attempt's answers
 * array at adjudication time, return the rows the writer must persist for
 * the flipped indices: `gradedIsCorrect` is copied from the CURRENT
 * `isCorrect` ONLY where the preimage is absent (append-only; an already-
 * present preimage is never overwritten — replay truth survives repeated
 * adjudication). Both the challenge-accept writer and the teacher-edit
 * writer carry this duty [DF2-14/r68].
 *
 * @param {Array<object>} answers — the stored attempt rows.
 * @param {number[]} flipIndices — row indices about to have isCorrect mutated.
 * @returns {Array<{index: number, gradedIsCorrect: boolean}>} preimage writes
 *   to apply BEFORE the flip (empty when every target already has one).
 */
function gradingPreimageWrites(answers, flipIndices) {
  if (!Array.isArray(answers)) throw new TypeError("gradingPreimageWrites: answers must be an array");
  const out = [];
  for (const i of flipIndices) {
    const row = answers[i];
    if (!row || typeof row !== "object") {
      throw new Error(`gradingPreimageWrites: no row at index ${i}`);
    }
    if (typeof row.gradedIsCorrect === "boolean") continue; // append-only
    if (typeof row.isCorrect !== "boolean") {
      throw new Error(`gradingPreimageWrites: row ${i} has no boolean isCorrect to preserve`);
    }
    out.push({index: i, gradedIsCorrect: row.isCorrect});
  }
  return out;
}

/**
 * R2-43 resting guard + the (dormant) R2-10 accept-time label plan — pure.
 * The accept txn re-reads `reviewRestingUntil` inside itself and consults
 * this to decide its legs.
 *
 * @param {{restingUntilMs: number|null, nowMs: number,
 *   r2_10Active?: boolean, effectivePassing?: boolean,
 *   gateEffectiveEnabled?: boolean}} args — `effectivePassing` = the
 *   recomputed effective-correct score clearing the threshold [§6b (6)].
 * @returns {{gradeFixOnly: boolean, stampLc: boolean, stampLp: boolean}}
 *   `gradeFixOnly` true ⇒ grade/score/answers fix ONLY: no status write, no
 *   label stamp (`reviewRestingUntil` stands). Label stamps mint at
 *   `challengeReviewedAt` [§6b (4)] — the caller supplies that instant.
 */
function challengeAcceptPlan({restingUntilMs, nowMs, r2_10Active = false, effectivePassing = false, gateEffectiveEnabled = false, stampingEligible = false}) {
  const resting = restingUntilMs != null && restingUntilMs > nowMs;
  if (resting) return {gradeFixOnly: true, stampLc: false, stampLp: false};
  // R2-48 reaches the adjudication label path BY CONSTRUCTION [r70 M-6]:
  // an ineligible writer stamps nothing even once R2-10 activates. The
  // grade/score fix itself is adjudication display truth, never label
  // privilege — it is not eligibility-gated.
  if (r2_10Active !== true || stampingEligible !== true) {
    return {gradeFixOnly: false, stampLc: false, stampLp: false};
  }
  return {
    gradeFixOnly: false,
    stampLc: true, // acceptance mints correctness [§6b — effective truth]
    stampLp: effectivePassing === true && gateEffectiveEnabled === true,
  };
}

module.exports = {
  stampLabelsInTxn,
  // Pure/fixture-facing surface:
  computeLabelStamps,
  gradingPreimageWrites,
  challengeAcceptPlan,
  LABEL_FIELDS,
};
