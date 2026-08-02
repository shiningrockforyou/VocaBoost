/**
 * ============================================================================
 * DEEPFIX2 · r70 fold (C2) — PROGRESS TRUTH: the frontier + introduced bound
 * + the stable cross-class match tuple
 * ============================================================================
 * Born from the r70 double-NO (Codex C2 + Opus BL-2/H-1/CC-2/CC-3): the r70
 * build derived the day's review universe from `deriveDayAnchorRange`, which
 * requires a PASSED new attempt — so ordinary review-first days saw the whole
 * list, and the match tuple flipped mid-day. THIS module is the one source of
 * day authority; every engine txn reads it INSIDE itself.
 *
 * THE TRUTH SOURCE: the durable progress doc (foundation.durableProgressRef —
 * flag-aware: the legacy class-scoped ref today, the canonical
 * `list_progress/{listId}` when LIST_PROGRESS_CANONICAL flips at P5):
 *  - `currentStudyDay` (csd) = the last COMPLETED day ⇒ THE FRONTIER
 *    (composable/completable day) = csd + 1. Live compose/complete accept
 *    ONLY the frontier; restudy targets only days ≤ csd.
 *  - `totalWordsIntroduced` (twi) = words introduced through the completed
 *    days ⇒ THE REVIEW UNIVERSE for the frontier day = canonical positions
 *    < twi. STABLE all day (twi advances only at day completion), so
 *    review-first composes identically before/after the day's new test; day
 *    1 (twi 0) has NO review by construction; a genuine list-end day sees
 *    the whole list only because twi === |list|.
 *  - THE MATCH TUPLE [r48, re-sourced per C2/#7-AMEND]: `anchorNwei` =
 *    twi − 1 (the last introduced position; −1 IFF twi === 0 — the empty-
 *    universe/day-1 encoding, never an error state) and `generation` =
 *    `"t{twi}"`. Both are (uid,progress-doc)-scoped and constant within a
 *    day, so same-day cross-class composes agree by construction and a
 *    genuine mismatch is REAL universe drift (typed refusal, never throw).
 *
 * RERUN POOL [C2, R2-41(h) as adjudicated by BOTH r70 lanes]: the FULL
 * CURRENTLY INTRODUCED range = positions < twi, resting included — never
 * day-scoped through the visited day.
 *
 * DUAL-ENROLLMENT NOTE (honest boundary, R2-36's accepted ambiguity): with
 * LIST_PROGRESS_CANONICAL=false the durable ref is class-scoped, so csd/twi
 * are the CALLER'S class view while `day_completions` stays list-scoped (the
 * frozen shared-day CAS). The cross-class csd-view reconciliation is
 * adoption-layer work (P5/DF2-46), not re-derived here.
 */

"use strict";

const foundation = require("../foundation");

/**
 * Read the day authority INSIDE a transaction (the engine txns' one source).
 *
 * @param {FirebaseFirestore.Transaction} txn
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid: string, classId: string, listId: string}} ids
 * @returns {Promise<{csd: number, twi: number, frontierDay: number,
 *   anchorNwei: number, generation: string, progressRef:
 *   FirebaseFirestore.DocumentReference, progressSnap:
 *   FirebaseFirestore.DocumentSnapshot}>}
 */
async function readProgressTruthInTxn(txn, db, {uid, classId, listId}) {
  const progressRef = foundation.durableProgressRef(uid, classId, listId);
  const progressSnap = await txn.get(progressRef);
  const d = progressSnap.exists ? progressSnap.data() : {};
  const csd = Number.isInteger(d.currentStudyDay) && d.currentStudyDay > 0 ? d.currentStudyDay : 0;
  const twi = Number.isInteger(d.totalWordsIntroduced) && d.totalWordsIntroduced > 0 ? d.totalWordsIntroduced : 0;
  return {
    csd, twi,
    frontierDay: csd + 1,
    anchorNwei: twi - 1,
    generation: `t${twi}`,
    progressRef, progressSnap,
  };
}

// NOTE [r72]: the tuple's `anchorNwei = twi − 1` is an ENCODING of twi (the
// match tuple needs stability + class-agnosticism, not positional truth —
// `generation` carries the same value); real positions come from the
// canonical words where a range is actually built (ComposeNewTest).

/** Non-transactional variant for callable PRE-flight derivation (display /
 *  cheap early refusals). Binding checks always re-run in the txn. */
async function readProgressTruth(db, {uid, classId, listId}) {
  const progressRef = foundation.durableProgressRef(uid, classId, listId);
  const snap = await progressRef.get();
  const d = snap.exists ? snap.data() : {};
  const csd = Number.isInteger(d.currentStudyDay) && d.currentStudyDay > 0 ? d.currentStudyDay : 0;
  const twi = Number.isInteger(d.totalWordsIntroduced) && d.totalWordsIntroduced > 0 ? d.totalWordsIntroduced : 0;
  return {csd, twi, frontierDay: csd + 1, anchorNwei: twi - 1, generation: `t${twi}`, progressRef};
}

/** Slice the canonical list to the introduced universe — the FIRST twi words
 *  in canonical order. [r71 M-A ORDINAL SLICE: twi is a COUNT, so the bound
 *  is ordinal, not positional — a list whose positions have gaps (historical
 *  deletions) still yields exactly twi introduced words; `wordIndex` stays
 *  the canonical position for tie-breaks.] */
function introducedUniverse(canonicalWords, twi) {
  return canonicalWords.slice(0, Math.max(0, Math.min(twi, canonicalWords.length)));
}

module.exports = {
  readProgressTruthInTxn,
  readProgressTruth,
  introducedUniverse,
};
