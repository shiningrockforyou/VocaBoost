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
 * (mint nothing): `config_hold` (r48 cold-start law) · `review_v2_dark` /
 * `client_version_stale` (txn-time serving authority [r70 C3]) ·
 * `reset_in_progress` (§9 frozen) · `reset_epoch_mismatch` (§9 "mismatch ⇒
 * reject") · `day_guard_rejected` (§8 frozen — any non-frontier day; carries
 * `expectedDay` [r70 C2]) · `empty_pool` (twi=0 — day 1 has no review) ·
 * `reuse_anchor_mismatch` (real universe drift on the reuse path — typed,
 * fail-closed, cursor untouched [r70 C2]). Truly impossible states (dangling
 * `lastQueueRef`) still THROW — the txn aborts, nothing is minted.
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

/** §9 lock predicate [r74 N-2 — a crashed reset must not lock the student
 *  out of the engine PERMANENTLY]: only a LIVE lock (younger than the §9
 *  takeover window) rejects writes; a stale lock is takeover-eligible state
 *  that the NEXT reset op repairs — the engine serves through it, exactly as
 *  §9 r56 prescribes ("the stuck-lock state rejects only WRITE ops ... until
 *  takeover" — and past the window it is no longer a live lock at all). */
const RESET_LOCK_TAKEOVER_MS = 10 * 60 * 1000; // the §9 r56 liveness window
function resetLockActive(pmData, lpData, nowMs = Date.now()) {
  const live = (l) => Boolean(l) &&
    (l?.at?.toMillis ? (nowMs - l.at.toMillis()) : 0) < RESET_LOCK_TAKEOVER_MS;
  return live(pmData?.resetInProgress) || live(lpData?.resetInProgress);
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
  if (!Array.isArray(p.canonicalWords) || p.canonicalWords.length > MAX_INTRODUCED_WORDS) {
    throw new TypeError("composeDayQueue: canonicalWords must be an array ≤ " + MAX_INTRODUCED_WORDS);
  }
  let prev = -Infinity;
  const seen = new Set();
  for (const w of p.canonicalWords) {
    if (!s(w?.wordId) || !Number.isInteger(w?.wordIndex) || w.wordIndex < 0) {
      throw new TypeError("composeDayQueue: each canonical word needs {wordId, wordIndex≥0}");
    }
    if (w.wordIndex <= prev) {
      throw new TypeError("composeDayQueue: canonicalWords must be strictly ascending by wordIndex (canonical order)");
    }
    prev = w.wordIndex;
    if (seen.has(w.wordId)) throw new TypeError("composeDayQueue: duplicate wordId in canonicalWords");
    seen.add(w.wordId);
  }
}

/**
 * Compose (or replay) THE day-queue for one (class, list, logicalDay, epoch)
 * — the H6 §2 creation transaction. Owns its own runTransaction.
 *
 * r70 FOLD (C2/C3): day authority is TRANSACTIONAL — the txn reads the
 * durable progress doc (progress.js) and refuses any non-frontier day
 * (`day_guard_rejected` + expectedDay); the review universe is sliced from
 * `canonicalWords` by the txn-read `twi` (stable before/after the day's new
 * test — review-first law); the match tuple (`anchorNwei` = twi−1,
 * `generation` = "t{twi}") is derived HERE, never caller-supplied; serving
 * authority (`assertServableInTxn`) is re-enforced in-txn; a reuse tuple
 * mismatch is the typed refusal `reuse_anchor_mismatch` (fail-closed, cursor
 * untouched, never `internal`); an overshot cursor (`lastLogicalDay` beyond
 * the frontier — a poisoned artifact) is REPAIRED: swept as absent,
 * overwritten by this compose, `cursorRepaired:true` reported for the ops
 * signal. SUPERSESSION [r70 C2, logged in 15_ §2]: `snapshot.queueSize` =
 * |orderedQueueWordIds| (content truth) on EVERY compose, and
 * `snapshot.configQueueSize` (the configured value) is ALWAYS present.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{
 *   uid: string, classId: string, listId: string,
 *   logicalDay: number, resetEpoch: number,
 *   canonicalWords: Array<{wordId: string, wordIndex: number}>,
 *   clientContractVersion?: *,
 *   nowMs?: number,
 * }} params — `canonicalWords` = the FULL canonical list order
 *   (`lists/{listId}/words` by `position` asc [r55]); the txn slices it.
 * @returns {Promise<object>} typed statuses per the header; on
 *   `created`/`exists`: `{queueId, queuePath, queue, config}` (+ on
 *   `created`: `{reused, cursorAdvanced, activeCount, topUpCount,
 *   cursorRepaired}`).
 */
async function composeDayQueue(db, params) {
  assertParams(params);
  const {uid, classId, listId, logicalDay, resetEpoch} = params;
  const nowMs = Number.isFinite(params.nowMs) ? params.nowMs : Date.now();
  const {readProgressTruthInTxn, introducedUniverse} = require("./progress");
  const {assertServableInTxn} = require("./config");

  const queueId = queueDocId(classId, listId, logicalDay, resetEpoch);
  const queueRef = db.doc(`users/${uid}/review_queues/${queueId}`);
  const cursorRef = db.doc(`users/${uid}/review_cursors/${cursorDocId(listId, resetEpoch)}`);
  const pmRef = db.doc(`users/${uid}/progress_meta/${listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${listId}`);

  return db.runTransaction(async (txn) => {
    // ---- READS (all before any write; conditional reads allowed) ----------
    const config = await resolveReviewConfig(db, {classId, listId, uid, txn});
    const truth = await readProgressTruthInTxn(txn, db, {uid, classId, listId});
    const [pmSnap, lpSnap, queueSnap, cursorSnap] =
      await txn.getAll(pmRef, lpRef, queueRef, cursorRef);

    // Serving authority re-enforced against THIS txn's snapshot [C3].
    const refusal = assertServableInTxn(config, params.clientContractVersion);
    if (refusal) return refusal;
    const pmData = pmSnap.exists ? pmSnap.data() : null;
    const lpData = lpSnap.exists ? lpSnap.data() : null;
    if (resetLockActive(pmData, lpData)) {
      return {status: "reset_in_progress"};
    }
    const currentEpoch = effectiveResetEpoch(pmData, lpData);
    if (currentEpoch !== resetEpoch) {
      return {status: "reset_epoch_mismatch", currentEpoch};
    }

    // ---- FRONTIER AUTHORITY [C2, ordered BEFORE the replay return per
    // r71-Codex: an EXISTING past-day queue must not bypass the guard — a
    // completed day's queue is not re-servable] ---------------------------
    if (logicalDay !== truth.frontierDay) {
      return {status: "day_guard_rejected", expectedDay: truth.frontierDay};
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
    // The review universe: introduced BEFORE the day (positions < twi).
    // Day 1 (twi 0) has no review by construction [first_day_new_only].
    const universe = introducedUniverse(params.canonicalWords, truth.twi);
    if (universe.length === 0) {
      return {status: "empty_pool", twi: truth.twi};
    }
    const {anchorNwei, generation} = truth;

    const cursor = cursorSnap.exists ? cursorSnap.data() : null;
    const lastDay = Number.isInteger(cursor?.lastLogicalDay) ? cursor.lastLogicalDay : null;
    // Cursor repair leg [C2]: an overshot cursor can only be a poisoned
    // artifact (frontier authority forbids forward composes). Sweep as if
    // absent; this compose overwrites it; the caller emits the ops signal.
    const cursorRepaired = lastDay != null && lastDay > truth.frontierDay;

    let orderedQueueWordIds;
    let reused = false;
    let sweep = null;

    if (!cursorRepaired && lastDay != null && logicalDay === lastDay) {
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
        // The match tuple defines the SHARED day; with the stable t{twi}
        // sourcing a mismatch is REAL universe drift ⇒ typed, fail-closed,
        // cursor untouched [C2 — never `internal`].
        return {
          status: "reuse_anchor_mismatch",
          reusedTuple: {anchorNwei: src.anchorNwei, generation: src.generation},
          requestTuple: {anchorNwei, generation},
        };
      }
      orderedQueueWordIds = [...src.orderedQueueWordIds];
      reused = true;
      // NO cursor write — one logical day consumes exactly ONE sweep segment.
    } else {
      // ---- THE SWEEP (first compose of this logical day) ----------------
      // Pool STATE joins the txn read set (H6 §2): chunked transactional
      // getAll over the universe's study_states; only `reviewRestingUntil`
      // is consulted (§10 — server truth only).
      const restingByWordId = new Map();
      for (let i = 0; i < universe.length; i += STUDY_STATE_READ_CHUNK) {
        const chunk = universe.slice(i, i + STUDY_STATE_READ_CHUNK);
        const snaps = await txn.getAll(
            ...chunk.map((w) => db.doc(`users/${uid}/study_states/${w.wordId}`)));
        snaps.forEach((s, j) => {
          const t = s.exists ? s.data().reviewRestingUntil : null;
          restingByWordId.set(chunk[j].wordId,
              (t && typeof t.toMillis === "function") ? t.toMillis() : null);
        });
      }
      sweep = sweepQueue({
        words: universe.map((w) => ({
          wordId: w.wordId,
          wordIndex: w.wordIndex,
          restingUntilMs: restingByWordId.get(w.wordId) ?? null,
        })),
        nowMs,
        queueSize: config.queueSize,
        cursorWordIndex: (!cursorRepaired && Number.isInteger(cursor?.cursorWordIndex))
          ? cursor.cursorWordIndex : null,
      });
      orderedQueueWordIds = sweep.orderedQueueWordIds;
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

    // SUPERSESSION [r70 C2]: queueSize = content truth on EVERY compose;
    // configQueueSize = the configured value, always present (audit).
    const snapshot = {
      threshold: config.threshold,
      queueSize: orderedQueueWordIds.length,
      testSize: config.testSize,
      reviewTestType: config.reviewTestType,
      reviewGateEnabled: config.assignmentGateEnabled,
      configQueueSize: config.queueSize,
    };

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

    const {createdAt: _createdAt, ...queueEcho} = queueDoc;
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
      cursorRepaired,
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
