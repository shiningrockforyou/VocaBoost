/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — RESTUDY VISITS: the per-visit claim docs +
 * the both-halves pip CAS (H6 §6, R2-40c-ii)
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69). Source:
 * 15_H6 §6 — PER-VISIT CLAIM DOCS [r55, replacing the replaceable
 * pendingHalf]: `visitId` is server-minted per restudy-day entry and stamped
 * on that visit's rerun presentations + attempts; a passing rerun attempt
 * writes ITS half onto ITS OWN visit doc (set-once, idempotent — a second
 * same-type pass in the visit is ignored); when BOTH halves are set the SAME
 * txn flips `completed:true` and increments the day's re-completion counter
 * EXACTLY ONCE (the flip is the CAS). Cross-visit pairing is impossible by
 * construction. Visits are epoch-tagged + timestamped [r56] — reset-reachable
 * and TTL-cleanable; incomplete visits are inert garbage at worst, never
 * load-bearing. Display-only — NO progression reader consumes any of this.
 *
 * PATH NOTE (checkpoint-review flagged, mirrors reset.js): the day counter
 * lives at `users/{uid}/restudy_completions/{classId}_{listId}_d{day}` —
 * §6's docId carries no uid, so the per-student subcollection is the only
 * collision-free reading. Overflow display (>5 ⇒ five pips + "×N") is the
 * client's [R2-45].
 *
 * DARK BY CONSTRUCTION: no caller until the index.js wiring (step 7).
 */

"use strict";

const {FieldValue} = require("firebase-admin/firestore");

/**
 * Mint ONE restudy visit (server-minted visitId) at restudy-day entry.
 * r70 FOLD (M-4/C3/C2): a TRANSACTION like every other §9 writer — the
 * tombstones + config + progress truth join its read set; it rejects
 * `reset_in_progress`/epoch drift, re-enforces serving authority, and binds
 * the day to a REAL PAST day (1 ≤ day ≤ csd — restudy never targets the
 * frontier or beyond).
 *
 * @returns {Promise<{status: string, visitId?: string, path?: string}>}
 */
async function mintRestudyVisit(db, {uid, classId, listId, day, resetEpoch, clientContractVersion}) {
  const s = (v) => typeof v === "string" && v.length > 0;
  if (!s(uid) || !s(classId) || !s(listId) ||
      !Number.isInteger(day) || day < 1 ||
      !Number.isInteger(resetEpoch) || resetEpoch < 0) {
    throw new TypeError("mintRestudyVisit: uid/classId/listId/day≥1/resetEpoch≥0 required");
  }
  const {resolveReviewConfig, assertServableInTxn} = require("./config");
  const {readProgressTruthInTxn} = require("./progress");
  const {effectiveResetEpoch, resetLockActive} = require("./composer");
  const pmRef = db.doc(`users/${uid}/progress_meta/${listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${listId}`);
  return db.runTransaction(async (txn) => {
    const config = await resolveReviewConfig(db, {classId, listId, uid, txn});
    const truth = await readProgressTruthInTxn(txn, db, {uid, classId, listId});
    const [pm, lp] = await txn.getAll(pmRef, lpRef);
    const refusal = assertServableInTxn(config, clientContractVersion);
    if (refusal) return refusal;
    const pmData = pm.exists ? pm.data() : null;
    const lpData = lp.exists ? lp.data() : null;
    if (resetLockActive(pmData, lpData)) return {status: "reset_in_progress"};
    const currentEpoch = effectiveResetEpoch(pmData, lpData);
    if (currentEpoch !== resetEpoch) return {status: "reset_epoch_mismatch", currentEpoch};
    if (day > truth.csd) {
      return {status: "day_guard_rejected", expectedMax: truth.csd};
    }
    const ref = db.collection(`users/${uid}/restudy_visits`).doc();
    txn.set(ref, {
      uid, classId, listId, day, resetEpoch,
      createdAt: FieldValue.serverTimestamp(),
      newHalfAttemptId: null,
      reviewHalfAttemptId: null,
      completed: false,
    });
    return {status: "visit_minted", visitId: ref.id, path: ref.path};
  });
}

/**
 * Record ONE passing rerun half on its visit — INSIDE the rerun attempt txn.
 * The caller reads the visit doc in the txn (all reads before writes) and
 * passes the snapshot; this computes and applies the set-once + CAS writes.
 *
 * @param {FirebaseFirestore.Transaction} txn
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid: string, visitSnap: FirebaseFirestore.DocumentSnapshot,
 *   half: "new"|"review", attemptId: string}} args
 * @returns {{recorded: boolean, completedVisit: boolean}} `recorded` false =
 *   the set-once law ignored a duplicate same-type pass; `completedVisit`
 *   true = THIS write completed the pair (the counter incremented).
 */
function recordRerunHalfInTxn(txn, db, {uid, visitSnap, half, attemptId}) {
  if (half !== "new" && half !== "review") {
    throw new TypeError("recordRerunHalfInTxn: half must be 'new'|'review'");
  }
  if (typeof attemptId !== "string" || attemptId.length === 0) {
    throw new TypeError("recordRerunHalfInTxn: attemptId required");
  }
  if (!visitSnap?.exists) {
    throw new Error("recordRerunHalfInTxn: visit doc missing — attempts bind to a minted visit");
  }
  const v = visitSnap.data();
  if (v.uid !== uid) {
    throw new Error("recordRerunHalfInTxn: visit uid mismatch");
  }
  const field = half === "new" ? "newHalfAttemptId" : "reviewHalfAttemptId";
  const otherField = half === "new" ? "reviewHalfAttemptId" : "newHalfAttemptId";
  if (v[field] != null) {
    return {recorded: false, completedVisit: false}; // set-once: ignored
  }
  const update = {[field]: attemptId};
  let completedVisit = false;
  if (v[otherField] != null && v.completed !== true) {
    // BOTH halves now set — the SAME txn flips + increments, exactly once.
    update.completed = true;
    completedVisit = true;
  }
  txn.update(visitSnap.ref, update);
  if (completedVisit) {
    const counterRef = db.doc(
        `users/${uid}/restudy_completions/${v.classId}_${v.listId}_d${v.day}`);
    txn.set(counterRef, {
      uid, classId: v.classId, listId: v.listId, day: v.day,
      resetEpoch: v.resetEpoch,
      count: FieldValue.increment(1),
      lastAt: FieldValue.serverTimestamp(),
    }, {merge: true});
  }
  return {recorded: true, completedVisit};
}

module.exports = {
  mintRestudyVisit,
  recordRerunHalfInTxn,
};
