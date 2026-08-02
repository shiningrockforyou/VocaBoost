/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — RESET INTEGRATION: the reviewV2 stale-epoch
 * cleanup legs (H6 §9)
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69). Source:
 * 15_H6 §9 — RESET = OWNED LOCKED FENCE-FIRST. The fence/lock/owner-clear
 * machinery is the EXISTING resetProgress's redesign (wiring step; it lives
 * where the tombstones live). THIS module owns leg (3) for the NEW reviewV2
 * collections: **stale-epoch-only deletes** across every epoch-tagged doc
 * family the redesign minted — queues, presentations, completions, visits,
 * credits, restudy counters, review_counters, AND `review_cursors` +
 * `compose_keys` [r59-B5 — a stale claim would otherwise refuse a legitimate
 * post-reset replay forever] — plus the R2-40e bookmark map-key delete.
 *
 * BOUNDARIES (wiring duties, not here): the fence txn itself · pending
 * grading_jobs cancellation via the named (uid,status) index (an EXISTING
 * top-level pipeline leg) · the reconciliation sweep · owner-clear/takeover.
 *
 * Writers honoring the lock is ALREADY BUILT: every reviewV2 txn module
 * reads both tombstones and rejects `reset_in_progress`/epoch drift.
 *
 * SEMANTICS: deletes are STALE-ONLY (`resetEpoch < targetEpoch`) — current-
 * epoch docs are never touched, so a crashed cleanup re-run is idempotent
 * and a concurrent current-epoch write is never collateral. Queries filter
 * by listId equality and drop stale epochs in code (no composite-index
 * burden; per-student subcollections are small). Deletes run OUTSIDE the
 * fence txn (§9 orders fence → reject-while-locked → stale deletes; the
 * lock, not txn atomicity, is the guard) in batched writes of ≤400.
 *
 * PATH NOTE (checkpoint-review flagged): `restudy_completions` docIds carry
 * no uid, so the per-student counter lives at
 * `users/{uid}/restudy_completions/{classId}_{listId}_d{day}` — the only
 * collision-free reading of §6's schema; visits.js mints it there.
 */

"use strict";

const {FieldValue} = require("firebase-admin/firestore");

const DELETE_BATCH = 400;

/** The reviewV2 doc families under users/{uid}, with their listId field
 *  location. Every family is epoch-tagged (§9's delete set). */
const EPOCH_TAGGED_FAMILIES = Object.freeze([
  {collection: "review_queues", listField: "listId"},
  {collection: "review_presentations", listField: "listId"},
  {collection: "review_cursors", listField: "listId"},
  {collection: "compose_keys", listField: "fingerprint.listId"},
  {collection: "review_counters", listField: "listId"},
  {collection: "day_completions", listField: "listId"},
  {collection: "streak_credits", listField: "listId"},
  {collection: "restudy_visits", listField: "listId"},
  {collection: "restudy_completions", listField: "listId"},
]);

/**
 * Leg (3): delete every stale-epoch reviewV2 doc for one (uid, list).
 * Caller contract (§9): runs AFTER the fence txn holds the lock (writers are
 * rejecting), with `targetEpoch` = the fenced epoch.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid: string, listId: string, targetEpoch: number}} args
 * @returns {Promise<{deleted: number, byCollection: Object<string, number>}>}
 */
async function deleteStaleEpochReviewV2Docs(db, {uid, listId, targetEpoch}) {
  if (typeof uid !== "string" || uid.length === 0 ||
      typeof listId !== "string" || listId.length === 0 ||
      !Number.isInteger(targetEpoch) || targetEpoch < 1) {
    throw new TypeError("deleteStaleEpochReviewV2Docs: uid/listId/targetEpoch≥1 required");
  }
  const byCollection = {};
  let batch = db.batch();
  let inBatch = 0;
  let deleted = 0;
  const commits = [];
  const flush = () => {
    if (inBatch > 0) {
      commits.push(batch.commit());
      batch = db.batch();
      inBatch = 0;
    }
  };
  for (const fam of EPOCH_TAGGED_FAMILIES) {
    const snap = await db.collection(`users/${uid}/${fam.collection}`)
        .where(fam.listField, "==", listId)
        .get();
    let count = 0;
    for (const doc of snap.docs) {
      const e = doc.data().resetEpoch;
      // Stale-only: epoch-untagged rows (never minted by the redesign's
      // writers, which always stamp) are left for manual audit, not deleted.
      if (!Number.isInteger(e) || e >= targetEpoch) continue;
      batch.delete(doc.ref);
      inBatch++;
      count++;
      deleted++;
      if (inBatch >= DELETE_BATCH) flush();
    }
    byCollection[fam.collection] = count;
  }
  flush();
  await Promise.all(commits);
  return {deleted, byCollection};
}

/** R2-40e bookmark cleanup: reset deletes the `restudyBookmarks.{classId}_{listId}`
 *  map key on users/{uid} for every enrolled class of the list. */
async function clearRestudyBookmarks(db, {uid, listId, classIds}) {
  if (!Array.isArray(classIds) || classIds.length === 0) return {cleared: 0};
  const update = {};
  for (const classId of classIds) {
    update[`restudyBookmarks.${classId}_${listId}`] = FieldValue.delete();
  }
  await db.doc(`users/${uid}`).set(update, {merge: true});
  return {cleared: classIds.length};
}

module.exports = {
  deleteStaleEpochReviewV2Docs,
  clearRestudyBookmarks,
  EPOCH_TAGGED_FAMILIES,
};
