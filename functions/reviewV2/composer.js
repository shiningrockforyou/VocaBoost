/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — THE DAY-QUEUE COMPOSER (H6 §2 + §2b + §10)
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69). Sources:
 * 15_H6 §2 (the immutable day-queue record + creation txn), §2b (THE ROTATION
 * CURSOR — exact transitions [r59-B3], same-day cross-class reuse [r59-B2],
 * differing-size reuse truth [r60/r62]), §10 (pool inputs = SERVER truth only),
 * §9 (reset fence re-verified in-txn), 10_ §2.1 (the cursor-chained sweep,
 * certified by rotation-cyclicity-fixture.mjs 2,688/0), R2-41(e) (underflow
 * top-up: earliest-graduated resting words).
 *
 * DARK BY CONSTRUCTION: nothing calls this module until the index.js wiring
 * lands (dormant callables behind `enabled:false`); composing is impossible
 * without a caller.
 *
 * THE LAWS ENCODED HERE
 *  - Sweep: day N's queue = the next `queueSize` ACTIVE words in wordIndex
 *    order STRICTLY AFTER the persisted cursor (wrapping; absent ⇒ smallest
 *    index). ACTIVE = not resting; resting = `reviewRestingUntil` > now and
 *    the field is ignored past its instant (§1 — return forever). Pool
 *    membership/state reads ONLY server truth: `reviewRestingUntil` (+ the
 *    caller-supplied CANONICAL word order) — NEVER client-writable
 *    `status`/`masteredAt` [§10].
 *  - Underflow [R2-41(e)]: pool < size ⇒ whole active pool + top-up from
 *    resting words, EARLIEST-GRADUATED FIRST (ascending `reviewRestingUntil` —
 *    rest length is constant, so earliest expiry = earliest graduation;
 *    tie-break wordIndex), up to size. Top-ups NEVER move the cursor.
 *  - Cursor transitions [§2b EXACT, r59-B3]: A = the day's ACTIVE-sweep
 *    members in TRAVERSAL order (top-ups excluded). (normal) cursor := index
 *    of the LAST element of A in traversal order — on a wrapped window the
 *    last traversed, NOT the numeric max; (underflow, A non-empty) same rule;
 *    (no active at all) cursor UNCHANGED; (first-ever/post-reset/absent doc)
 *    sweep starts at the smallest index and the doc is created; (OFF→ON) the
 *    doc persists — the sweep resumes; (same logical day) NO advance.
 *  - Same-day cross-class REUSE [r59-B2/r60/r62]: cursor.lastLogicalDay ===
 *    the composing day ⇒ the new class's queue doc reuses the first
 *    composer's `orderedQueueWordIds` VERBATIM (day-truth, first-composer-
 *    wins), does NOT advance the cursor; the receiving `snapshot.queueSize`
 *    records |the REUSED queue| (content truth) and the receiver's own
 *    configured value lands in `snapshot.configQueueSize` (audit-only);
 *    threshold/testSize/modality stay the receiver's own (posture is
 *    class-scoped). Only `logicalDay > lastLogicalDay` advances.
 *  - Replay: deterministic docId + create() ⇒ first writer wins; an existing
 *    doc is returned as-is (§8 compose replay).
 *  - Reset fence [§9]: the txn READS both tombstone docs; a live
 *    `resetInProgress` lock ⇒ `reset_in_progress`; a tombstone epoch that no
 *    longer matches the request's ⇒ `reset_epoch_mismatch`.
 *  - ONE RESOLVER [DF2-10(1)]: config resolves INSIDE this txn (the config
 *    doc joins the read set — the activation-barrier pattern, 14_ §4, so the
 *    R2-48 flip serializes against in-flight composes). The caller MUST adopt
 *    the RETURNED config snapshot for the rest of the request.
 *
 * TYPED RESULT STATUSES — success: `created` | `exists` (replay). Refusals
 * (mint nothing): `config_hold` (r48 cold-start law) · `reset_in_progress`
 * (§9 frozen) · `reset_epoch_mismatch` (§9 "mismatch ⇒ reject" — name minted
 * HERE, checkpoint-review flagged) · `day_guard_rejected` (§8 frozen — a
 * compose for a day BEHIND the cursor's last composed day) · `empty_pool`
 * (zero introduced words — a day-1/no-review shape the caller should never
 * send; name minted HERE). Impossible-by-construction states (dangling
 * `lastQueueRef`, reuse anchor-tuple mismatch) THROW — the txn aborts, the
 * callable surfaces `internal`, nothing is minted.
 */

"use strict";

const crypto = require("crypto");
const {FieldValue} = require("firebase-admin/firestore");
const {resolveReviewConfig} = require("./config");

/** The composer algorithm version stamped into every queue identity (H6 §2
 *  septuple). Bump ONLY with a logged supersession of the sweep law. */
const ALGORITHM_VERSION = 1;

/** Chunk size for transactional study-state getAll (bounded request sizing). */
const STUDY_STATE_READ_CHUNK = 300;

/** Defensive ceiling on the introduced range (largest real lists ≈ 1,300). */
const MAX_INTRODUCED_WORDS = 5000;

/** Deterministic day-queue docId (H6 §2). */
function queueDocId(classId, listId, logicalDay, resetEpoch) {
  return `${classId}_${listId}_d${logicalDay}_e${resetEpoch}`;
}

/** Rotation-cursor docId (H6 §2b) — list-scoped, SHARED across classes [r58]. */
function cursorDocId(listId, resetEpoch) {
  return `${listId}_e${resetEpoch}`;
}

/** `poolHash` law (H6 §2): SHA-256 hex over the canonical JSON serialization
 *  of the ordered id array [r55 — delimiter-safe]. */
function computePoolHash(orderedQueueWordIds) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(orderedQueueWordIds))
    .digest("hex");
}

/** Resting predicate (§1): resting iff the instant is strictly ahead of now;
 *  an expired/absent `reviewRestingUntil` means ACTIVE (return forever). */
function isResting(restingUntilMs, nowMs) {
  return restingUntilMs != null && restingUntilMs > nowMs;
}

/**
 * THE SWEEP (pure — fixture-facing). Encodes §2b's exact transitions + the
 * R2-41(e) underflow top-up over one introduced range.
 *
 * @param {{words: Array<{wordId: string, wordIndex: number,
 *   restingUntilMs: number|null}>, nowMs: number, queueSize: number,
 *   cursorWordIndex: number|null}} input — `words` MUST be the introduced
 *   range in ascending CANONICAL wordIndex order (`lists/{id}/words` by
 *   `position` [r55] — never a client-written copy).
 * @returns {{orderedQueueWordIds: string[], newCursorWordIndex: number|null,
 *   cursorAdvanced: boolean, activeCount: number, topUpCount: number}}
 *   `newCursorWordIndex` is the POST-compose cursor value under the exact
 *   transitions (unchanged input value when A is empty).
 */
function sweepQueue({words, nowMs, queueSize, cursorWordIndex}) {
  const active = words.filter((w) => !isResting(w.restingUntilMs, nowMs));
  const resting = words.filter((w) => isResting(w.restingUntilMs, nowMs));

  // Traversal start: first active word STRICTLY AFTER the cursor, wrapping;
  // null cursor (first-ever/post-reset) ⇒ the smallest index. A cursor past
  // every active index wraps to the start by the same findIndex miss.
  let start = 0;
  if (cursorWordIndex != null) {
    const i = active.findIndex((w) => w.wordIndex > cursorWordIndex);
    start = i === -1 ? 0 : i;
  }
  const A = [];
  for (let k = 0; k < active.length && A.length < queueSize; k++) {
    A.push(active[(start + k) % active.length]);
  }

  // R2-41(e): earliest-graduated first = ascending restingUntil (constant
  // rest length), tie-break wordIndex; capped at the remaining size.
  const topUps = resting
    .slice()
    .sort((a, b) => (a.restingUntilMs - b.restingUntilMs) || (a.wordIndex - b.wordIndex))
    .slice(0, Math.max(0, queueSize - A.length));

  return {
    orderedQueueWordIds: [...A.map((w) => w.wordId), ...topUps.map((w) => w.wordId)],
    newCursorWordIndex: A.length > 0 ? A[A.length - 1].wordIndex : (cursorWordIndex ?? null),
    cursorAdvanced: A.length > 0,
    activeCount: A.length,
    topUpCount: topUps.length,
  };
}

/** §9 tombstone reduction: the effective epoch = max of both docs' epochs
 *  (absent doc/field ⇒ 0), matching the reset fence's own derivation. */
function effectiveResetEpoch(pmData, lpData) {
  const e = (d) => (Number.isInteger(d?.resetEpoch) && d.resetEpoch > 0 ? d.resetEpoch : 0);
  return Math.max(e(pmData), e(lpData));
}

/** §9 lock predicate: ANY present `resetInProgress` rejects writes — takeover
 *  of a stale lock belongs to the next reset op, never to a composer. */
function resetLockActive(pmData, lpData) {
  return Boolean(pmData?.resetInProgress) || Boolean(lpData?.resetInProgress);
}

function assertParams(p) {
  const s = (v) => typeof v === "string" && v.length > 0;
  if (!s(p.uid) || !s(p.classId) || !s(p.listId)) {
    throw new TypeError("composeDayQueue: uid/classId/listId must be non-empty strings");
  }
  if (!Number.isInteger(p.logicalDay) || p.logicalDay < 1) {
    throw new TypeError("composeDayQueue: logicalDay must be an integer ≥ 1");
  }
  if (!Number.isInteger(p.resetEpoch) || p.resetEpoch < 0) {
    throw new TypeError("composeDayQueue: resetEpoch must be an integer ≥ 0");
  }
  if (!Number.isInteger(p.anchorNwei)) {
    throw new TypeError("composeDayQueue: anchorNwei must be an integer");
  }
  if (p.generation === undefined) {
    throw new TypeError("composeDayQueue: generation is required (opaque, caller-derived)");
  }
  if (!Array.isArray(p.introducedWords) || p.introducedWords.length > MAX_INTRODUCED_WORDS) {
    throw new TypeError("composeDayQueue: introducedWords must be an array ≤ " + MAX_INTRODUCED_WORDS);
  }
  let prev = -Infinity;
  const seen = new Set();
  for (const w of p.introducedWords) {
    if (!s(w?.wordId) || !Number.isInteger(w?.wordIndex) || w.wordIndex < 0) {
      throw new TypeError("composeDayQueue: each introduced word needs {wordId, wordIndex≥0}");
    }
    if (w.wordIndex <= prev) {
      throw new TypeError("composeDayQueue: introducedWords must be strictly ascending by wordIndex (canonical order)");
    }
    prev = w.wordIndex;
    if (seen.has(w.wordId)) throw new TypeError("composeDayQueue: duplicate wordId in introducedWords");
    seen.add(w.wordId);
  }
}

/**
 * Compose (or replay) THE day-queue for one (class, list, logicalDay, epoch)
 * — the H6 §2 creation transaction. Owns its own runTransaction.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{
 *   uid: string, classId: string, listId: string,
 *   logicalDay: number, resetEpoch: number,
 *   anchorNwei: number, generation: *,
 *   introducedWords: Array<{wordId: string, wordIndex: number}>,
 *   nowMs?: number,
 * }} params — `introducedWords` = the day's review universe in CANONICAL
 *   `lists/{listId}/words` position order (ascending `position`, r55), sliced
 *   by the caller's anchor derivation; `anchorNwei`/`generation` = the
 *   cross-class match tuple (r48), stamped verbatim + equality-checked on the
 *   reuse path. `nowMs` (test-injectable) drives ONLY resting classification.
 * @returns {Promise<object>} `{status, ...}` per the header's typed statuses.
 *   On `created`/`exists`: `{queueId, queuePath, queue, config}` — `config`
 *   is THE txn-time snapshot the caller must adopt (ONE RESOLVER law); on
 *   `created` additionally `{reused, cursorAdvanced, activeCount, topUpCount}`
 *   and `queue.createdAt` is omitted (server timestamp resolves at commit).
 */
async function composeDayQueue(db, params) {
  assertParams(params);
  const {uid, classId, listId, logicalDay, resetEpoch, anchorNwei, generation} = params;
  const nowMs = Number.isFinite(params.nowMs) ? params.nowMs : Date.now();

  if (params.introducedWords.length === 0) {
    return {status: "empty_pool"};
  }

  const queueId = queueDocId(classId, listId, logicalDay, resetEpoch);
  const queueRef = db.doc(`users/${uid}/review_queues/${queueId}`);
  const cursorRef = db.doc(`users/${uid}/review_cursors/${cursorDocId(listId, resetEpoch)}`);
  const pmRef = db.doc(`users/${uid}/progress_meta/${listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${listId}`);

  return db.runTransaction(async (txn) => {
    // ---- READS (all before any write; conditional reads allowed) ----------
    const config = await resolveReviewConfig(db, {classId, listId, txn});
    const [pmSnap, lpSnap, queueSnap, cursorSnap] =
      await txn.getAll(pmRef, lpRef, queueRef, cursorRef);

    if (config.readStatus === "hold") {
      return {status: "config_hold", holdReason: config.holdReason};
    }
    const pmData = pmSnap.exists ? pmSnap.data() : null;
    const lpData = lpSnap.exists ? lpSnap.data() : null;
    if (resetLockActive(pmData, lpData)) {
      return {status: "reset_in_progress"};
    }
    const currentEpoch = effectiveResetEpoch(pmData, lpData);
    if (currentEpoch !== resetEpoch) {
      return {status: "reset_epoch_mismatch", currentEpoch};
    }

    // Replay convergence (§8): the deterministic id already exists ⇒ return
    // it untouched — first writer won; no cursor movement on replay.
    if (queueSnap.exists) {
      return {
        status: "exists",
        queueId,
        queuePath: queueRef.path,
        queue: queueSnap.data(),
        config,
      };
    }

    const cursor = cursorSnap.exists ? cursorSnap.data() : null;
    const lastDay = Number.isInteger(cursor?.lastLogicalDay) ? cursor.lastLogicalDay : null;
    if (lastDay != null && logicalDay < lastDay) {
      // Composing BEHIND the last composed day: the shared day counter never
      // moves backward (reruns compose presentations, never queues).
      return {status: "day_guard_rejected", lastLogicalDay: lastDay};
    }

    let orderedQueueWordIds;
    let snapshot;
    let reused = false;
    let sweep = null;

    if (lastDay != null && logicalDay === lastDay) {
      // ---- SAME-DAY CROSS-CLASS REUSE [r59-B2] --------------------------
      // Reachable only from a class WITHOUT its own queue doc (the exists
      // check above returned otherwise) ⇒ a different class composed this
      // shared day first. Its content is day-truth.
      if (typeof cursor.lastQueueRef !== "string" || cursor.lastQueueRef.length === 0) {
        throw new Error(`compose reuse: cursor ${cursorRef.path} lacks lastQueueRef`);
      }
      const reusedSnap = await txn.get(db.doc(cursor.lastQueueRef));
      if (!reusedSnap.exists) {
        throw new Error(`compose reuse: dangling lastQueueRef ${cursor.lastQueueRef}`);
      }
      const src = reusedSnap.data();
      if (src.anchorNwei !== anchorNwei || src.generation !== generation) {
        // The cross-class match tuple (r48) is the definition of a SHARED
        // day — a mismatch means these composes are not the same day.
        throw new Error(
            `compose reuse: anchor tuple mismatch on ${cursor.lastQueueRef} ` +
            `(${src.anchorNwei}/${String(src.generation)} vs ${anchorNwei}/${String(generation)})`);
      }
      orderedQueueWordIds = [...src.orderedQueueWordIds];
      snapshot = {
        threshold: config.threshold,
        queueSize: orderedQueueWordIds.length, // CONTENT truth [r62]
        testSize: config.testSize,
        reviewTestType: config.reviewTestType,
        reviewGateEnabled: config.assignmentGateEnabled,
        configQueueSize: config.queueSize, // the receiver's own value, audit-only
      };
      reused = true;
      // NO cursor write — one logical day consumes exactly ONE sweep segment.
    } else {
      // ---- THE SWEEP (first compose of this logical day) ----------------
      // Pool STATE joins the txn read set (H6 §2): chunked transactional
      // getAll over the introduced range's study_states; only
      // `reviewRestingUntil` is consulted (§10 — server truth only).
      const restingByWordId = new Map();
      for (let i = 0; i < params.introducedWords.length; i += STUDY_STATE_READ_CHUNK) {
        const chunk = params.introducedWords.slice(i, i + STUDY_STATE_READ_CHUNK);
        const snaps = await txn.getAll(
            ...chunk.map((w) => db.doc(`users/${uid}/study_states/${w.wordId}`)));
        snaps.forEach((s, j) => {
          const t = s.exists ? s.data().reviewRestingUntil : null;
          restingByWordId.set(chunk[j].wordId,
              (t && typeof t.toMillis === "function") ? t.toMillis() : null);
        });
      }
      sweep = sweepQueue({
        words: params.introducedWords.map((w) => ({
          wordId: w.wordId,
          wordIndex: w.wordIndex,
          restingUntilMs: restingByWordId.get(w.wordId) ?? null,
        })),
        nowMs,
        queueSize: config.queueSize,
        cursorWordIndex: Number.isInteger(cursor?.cursorWordIndex) ? cursor.cursorWordIndex : null,
      });
      orderedQueueWordIds = sweep.orderedQueueWordIds;
      snapshot = {
        threshold: config.threshold,
        queueSize: config.queueSize,
        testSize: config.testSize,
        reviewTestType: config.reviewTestType,
        reviewGateEnabled: config.assignmentGateEnabled,
      };
      // ---- WRITE: the cursor doc (SAME txn as the create, §2) -----------
      // lastLogicalDay/lastQueueRef record every first-compose; the INDEX
      // moves only per the exact transitions (unchanged when A was empty).
      txn.set(cursorRef, {
        uid, listId, resetEpoch,
        cursorWordIndex: sweep.newCursorWordIndex,
        lastLogicalDay: logicalDay,
        lastQueueRef: queueRef.path,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    // ---- WRITE: the immutable queue doc (create = first-writer-wins) ----
    const queueDoc = {
      uid, classId, listId, logicalDay, resetEpoch,
      algorithmVersion: ALGORITHM_VERSION,
      configVersion: config.configVersion,
      anchorNwei, generation,
      orderedQueueWordIds,
      poolHash: computePoolHash(orderedQueueWordIds),
      snapshot,
      presentationCount: 0, // the ONE mutable field (presentation txns only)
      createdAt: FieldValue.serverTimestamp(),
    };
    txn.create(queueRef, queueDoc);

    const {createdAt, ...queueEcho} = queueDoc;
    return {
      status: "created",
      queueId,
      queuePath: queueRef.path,
      queue: queueEcho,
      config,
      reused,
      cursorAdvanced: reused ? false : sweep.cursorAdvanced,
      activeCount: reused ? null : sweep.activeCount,
      topUpCount: reused ? null : sweep.topUpCount,
    };
  });
}

module.exports = {
  composeDayQueue,
  // Pure/fixture-facing surface:
  sweepQueue,
  isResting,
  computePoolHash,
  effectiveResetEpoch,
  resetLockActive,
  queueDocId,
  cursorDocId,
  ALGORITHM_VERSION,
};
