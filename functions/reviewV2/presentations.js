/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — PRESENTATIONS: the per-attempt claim txn +
 * THE COMPOSITION LAW (H6 §3 + R2-42/R2-46/R2-41(h))
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69). Sources:
 * 15_H6 §3 (presentation record + composeKey CLAIM REGISTRY [r53-B2/r54/r57/
 * r59-B6] + the frozen counter allocator [r57/r59-B4] + rerun identity), §9
 * (reset fence), 11_ R2-42 (deterministic LRT remainder + invariant check +
 * seeded fallback), R2-46 (effectiveTestSize invariant, priority prefix,
 * saturation-by-design), R2-41(h) (rerun review = pure-random over the FULL
 * introduced range), b1-expected-labels.mjs:169-170 (THE derived-predicate
 * formulas — byte-matched to the published baseline).
 *
 * DARK BY CONSTRUCTION: no caller until the index.js wiring (step 7).
 *
 * THE LAWS ENCODED HERE
 *  - CLAIM REGISTRY: docId = SHA-256(composeKey) hex under
 *    `users/{uid}/compose_keys/` (raw client tokens are path-unsafe [r59-B6];
 *    token validation 8-128 chars [A-Za-z0-9._-]). The registry `create()` IS
 *    the lock — a concurrent duplicate fails the txn and re-reads. Existing
 *    claim ⇒ compare the STORED fingerprint {classId, listId, logicalDay,
 *    resetEpoch, sessionType, testType, kind, visitId|null} to the request:
 *    MATCH ⇒ return the existing presentation (lost-response replay, §8);
 *    MISMATCH ⇒ `compose_key_reused` (a key never silently serves a
 *    different test). A new retake sends a NEW composeKey.
 *  - REPLAY PRECEDENCE: the replay path mints NOTHING, so it short-circuits
 *    BEFORE the §9 write fence (§8's replay law; §9 rejects write ops only).
 *    Fresh claims reject under a reset lock (`reset_in_progress`) or a
 *    tombstone-epoch drift (`reset_epoch_mismatch`).
 *  - SEQ ALLOCATION: live review = the queue doc's `presentationCount`+1 —
 *    the ONE queue mutation, incremented in THIS txn (§2). New-day/rerun =
 *    the FROZEN `users/{uid}/review_counters/{familyId}` allocator: first
 *    use CREATES `{next:2}` and allocates 1; else transactional
 *    read+increment. NO count queries anywhere [r59-B4].
 *  - COMPOSITION ('lrt-v1', live review): effectiveTestSize = min(testSize,
 *    |pinned queue|); test = top-min(priorityCount, effectiveTestSize)
 *    NEEDS-PRIORITY words by LRT (reviewLastTestedAt asc, ABSENT-FIRST, tie
 *    wordIndex), then the remainder by the SAME key; post-compose INVARIANT
 *    CHECK (exactly effectiveTestSize unique queue members INCLUDING the
 *    priority prefix) ⇒ on failure the SEEDED-RANDOM FALLBACK randomizes the
 *    REMAINDER ONLY, preserves the prefix, records `fallbackSeed`
 *    ('fallback-random'). Presentation ORDER is shuffled in every path
 *    (selection is deterministic; display order is not). THE PREDICATES
 *    (never stored, §1): needsPriority = fc>0 ∧ (lc null ∨ lf>lc).
 *  - MODALITY (live review): testType = the QUEUE SNAPSHOT's
 *    reviewTestType — the day's pinned posture, never the request's claim.
 *  - RERUN identity [r53-B2]: family `_r` docIds bind logicalDay = the
 *    VISITED day, queueRef null, poolHash = the INTRODUCED-RANGE hash,
 *    'rerun-random' pure-random draw (no priority slots), visitId set (§6
 *    pairing). Rerun NEW-word tests reuse the day-scoped `_n` family with
 *    'new-day' composition + visitId set, kind 'rerun'.
 *  - Labels/pool inputs read ONLY server truth (§10); word order/tie-breaks
 *    come from the caller-supplied CANONICAL wordIndex map
 *    (`lists/{id}/words` by `position` [r55]).
 *
 * OPS-METRICS DUTY (wiring, step 7): a `created` result with
 * `fallbackUsed:true` MUST be recorded as a `composition_fallback` event via
 * the monitoring module's ops_metrics writer (§6c — server-only sink; never
 * system_logs). The write is post-txn — selection is not correctness-critical
 * (R2-42: fail-open-safe by construction).
 *
 * TYPED RESULT STATUSES — success: `created` | `replayed`. Refusals (mint
 * nothing): `compose_key_reused` (§3 frozen) · `invalid_compose_key` (token
 * law — name minted HERE) · `reset_in_progress` (§9) · `reset_epoch_mismatch`
 * (composer-minted name, same law). Impossible states (absent queue on a
 * live-review claim, dangling registry, corrupt counter) THROW — the txn
 * aborts, nothing is minted.
 */

"use strict";

const crypto = require("crypto");
const {FieldValue} = require("firebase-admin/firestore");
const {
  computePoolHash,
  effectiveResetEpoch,
  resetLockActive,
  queueDocId,
} = require("./composer");

const COMPOSE_KEY_RE = /^[A-Za-z0-9._-]{8,128}$/;
const STUDY_STATE_READ_CHUNK = 300;

/** `presentationHash` law (§3): SHA-256 hex over the canonical JSON
 *  serialization of the presented ids [r56 — join(',') retired]. */
function computePresentationHash(presentedWordIds) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(presentedWordIds))
    .digest("hex");
}

/** THE derived priority predicate (§1, never stored) — byte-matched to the
 *  baseline derivation (b1-expected-labels.mjs:169). Timestamps in ms|null. */
function needsPriority({fc, lf, lc}) {
  return fc > 0 && (lc === null || lf > lc);
}

/** LRT ordering key (R2-42 — one clock, one tie-break, both strata):
 *  reviewLastTestedAt asc with ABSENT-FIRST (unseeded = most in need), tie →
 *  canonical wordIndex. */
function lrtCompare(a, b) {
  const an = a.rltMs == null;
  const bn = b.rltMs == null;
  if (an !== bn) return an ? -1 : 1;
  if (!an && a.rltMs !== b.rltMs) return a.rltMs - b.rltMs;
  return a.wordIndex - b.wordIndex;
}

/** Deterministic PRNG for the recorded-seed fallback (and injectable tests). */
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The R2-46 invariant, checked INDEPENDENTLY of construction: exactly
 *  effectiveTestSize unique queue members, priority prefix included. */
function compositionInvariantHolds(selectedIds, prefixIds, queueIdSet, effectiveTestSize) {
  if (selectedIds.length !== effectiveTestSize) return false;
  const uniq = new Set(selectedIds);
  if (uniq.size !== selectedIds.length) return false;
  for (const id of selectedIds) if (!queueIdSet.has(id)) return false;
  for (const id of prefixIds) if (!uniq.has(id)) return false;
  return true;
}

/**
 * THE LIVE-REVIEW COMPOSITION (pure — fixture-facing). R2-42/R2-46 exactly.
 *
 * @param {{members: Array<{wordId: string, wordIndex: number, fc: number,
 *   lfMs: number|null, lcMs: number|null, rltMs: number|null}>,
 *   testSize: number, rng?: () => number}} input — `members` = the pinned
 *   queue in queue order with server-truth labels (ms|null).
 * @returns {{presentedWordIds: string[], compositionVersion: "lrt-v1"|
 *   "fallback-random", fallbackSeed: number|null, effectiveTestSize: number,
 *   priorityCount: number}}
 */
function composeLiveReviewTest({members, testSize, rng = Math.random}) {
  const effectiveTestSize = Math.min(testSize, members.length);
  const queueIdSet = new Set(members.map((m) => m.wordId));

  const priority = members
    .filter((m) => needsPriority({fc: m.fc, lf: m.lfMs, lc: m.lcMs}))
    .sort(lrtCompare);
  const prefix = priority.slice(0, effectiveTestSize);
  const prefixIds = prefix.map((m) => m.wordId);
  const prefixSet = new Set(prefixIds);
  const rest = members.filter((m) => !prefixSet.has(m.wordId));

  let selectedIds = [
    ...prefixIds,
    ...rest.slice().sort(lrtCompare)
      .slice(0, effectiveTestSize - prefix.length)
      .map((m) => m.wordId),
  ];
  let compositionVersion = "lrt-v1";
  let fallbackSeed = null;

  if (!compositionInvariantHolds(selectedIds, prefixIds, queueIdSet, effectiveTestSize)) {
    // SEEDED-RANDOM FALLBACK (R2-42/46): prefix preserved, remainder
    // re-drawn at random from the same presentable set, seed recorded.
    fallbackSeed = Math.floor(rng() * 4294967296);
    const frng = mulberry32(fallbackSeed);
    selectedIds = [
      ...prefixIds,
      ...shuffled(rest, frng)
        .slice(0, effectiveTestSize - prefix.length)
        .map((m) => m.wordId),
    ];
    compositionVersion = "fallback-random";
    if (!compositionInvariantHolds(selectedIds, prefixIds, queueIdSet, effectiveTestSize)) {
      // Structurally impossible (|members| ≥ effectiveTestSize, all distinct)
      // — if reached, composition inputs are corrupt: abort, mint nothing.
      throw new Error("composition invariant failed after fallback");
    }
  }

  return {
    presentedWordIds: shuffled(selectedIds, rng), // order shuffled, both paths
    compositionVersion,
    fallbackSeed,
    effectiveTestSize,
    priorityCount: priority.length,
  };
}

/** R2-41(h): rerun review = pure-random draw over the FULL introduced range
 *  (resting included), no priority slots, fresh shuffle per rerun. */
function drawRerunReview({poolWordIds, testSize, rng = Math.random}) {
  return shuffled(poolWordIds, rng).slice(0, Math.min(testSize, poolWordIds.length));
}

function assertIdArray(name, a, {min = 1} = {}) {
  if (!Array.isArray(a) || a.length < min) {
    throw new TypeError(`composePresentation: ${name} must be an array (≥${min})`);
  }
  const seen = new Set();
  for (const v of a) {
    if (typeof v !== "string" || v.length === 0) {
      throw new TypeError(`composePresentation: ${name} entries must be non-empty strings`);
    }
    if (seen.has(v)) throw new TypeError(`composePresentation: duplicate id in ${name}`);
    seen.add(v);
  }
  return seen;
}

/**
 * Claim (or replay) ONE per-attempt presentation — the H6 §3 transaction.
 * Owns its own runTransaction.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} params
 *   Common: `{uid, classId, listId, logicalDay, resetEpoch, composeKey,
 *   mode, rng?}` — `mode` ∈ 'live-review' | 'new-day' | 'rerun-review'.
 *   - 'live-review': + `{wordIndexByWordId: Object<string,number>}` covering
 *     every queue member (CANONICAL positions [r55]). Composes the R2-42/46
 *     test from the day's pinned queue; testType = the queue snapshot's.
 *   - 'new-day': + `{presentedWordIds, poolWordIds, testType, kind:
 *     'live'|'rerun', visitId (required iff kind='rerun')}` — the caller's
 *     anchor-range draw (presented ⊆ pool asserted); logicalDay = the
 *     visited day on reruns.
 *   - 'rerun-review': + `{poolWordIds (FULL introduced range), testSize,
 *     testType, visitId}` — the server draws pure-random; logicalDay = the
 *     VISITED day.
 * @returns {Promise<object>} typed per the header. On `created`:
 *   `{presentationId, path, presentation, seq, fallbackUsed, fallbackSeed,
 *   effectiveTestSize}` (presentation echo omits server timestamps); on
 *   `replayed`: `{presentationId, path, presentation}` (stored data).
 */
async function composePresentation(db, params) {
  const {uid, classId, listId, logicalDay, resetEpoch, composeKey, mode} = params;
  const rng = typeof params.rng === "function" ? params.rng : Math.random;
  const s = (v) => typeof v === "string" && v.length > 0;
  if (!s(uid) || !s(classId) || !s(listId)) {
    throw new TypeError("composePresentation: uid/classId/listId must be non-empty strings");
  }
  if (!Number.isInteger(logicalDay) || logicalDay < 1 ||
      !Number.isInteger(resetEpoch) || resetEpoch < 0) {
    throw new TypeError("composePresentation: logicalDay ≥1 / resetEpoch ≥0 integers required");
  }
  if (typeof composeKey !== "string" || !COMPOSE_KEY_RE.test(composeKey)) {
    return {status: "invalid_compose_key"};
  }
  if (!["live-review", "new-day", "rerun-review"].includes(mode)) {
    throw new TypeError(`composePresentation: unknown mode ${mode}`);
  }

  // Mode-derived request shape (the fingerprint trio + visitId).
  let sessionType; let kind; let visitId = null;
  if (mode === "live-review") {
    sessionType = "review"; kind = "live";
    if (typeof params.wordIndexByWordId !== "object" || params.wordIndexByWordId === null) {
      throw new TypeError("composePresentation: live-review requires wordIndexByWordId");
    }
  } else if (mode === "new-day") {
    sessionType = "new";
    kind = params.kind;
    if (kind !== "live" && kind !== "rerun") {
      throw new TypeError("composePresentation: new-day kind must be 'live'|'rerun'");
    }
    visitId = kind === "rerun" ? params.visitId : null;
    if (kind === "rerun" && !s(visitId)) {
      throw new TypeError("composePresentation: rerun new-day requires visitId");
    }
    const pool = assertIdArray("poolWordIds", params.poolWordIds);
    assertIdArray("presentedWordIds", params.presentedWordIds);
    for (const id of params.presentedWordIds) {
      if (!pool.has(id)) throw new TypeError("composePresentation: presented ⊄ pool");
    }
    if (params.testType !== "mcq" && params.testType !== "typed") {
      throw new TypeError("composePresentation: testType must be 'mcq'|'typed'");
    }
  } else {
    sessionType = "review"; kind = "rerun";
    visitId = params.visitId;
    if (!s(visitId)) throw new TypeError("composePresentation: rerun-review requires visitId");
    assertIdArray("poolWordIds", params.poolWordIds);
    if (!Number.isInteger(params.testSize) || params.testSize < 1) {
      throw new TypeError("composePresentation: rerun-review requires testSize ≥ 1");
    }
    if (params.testType !== "mcq" && params.testType !== "typed") {
      throw new TypeError("composePresentation: testType must be 'mcq'|'typed'");
    }
  }

  const registryId = crypto.createHash("sha256").update(composeKey).digest("hex");
  const registryRef = db.doc(`users/${uid}/compose_keys/${registryId}`);
  const pmRef = db.doc(`users/${uid}/progress_meta/${listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${listId}`);

  return db.runTransaction(async (txn) => {
    const [pmSnap, lpSnap, regSnap] = await txn.getAll(pmRef, lpRef, registryRef);

    // ---- REPLAY (mints nothing — precedes the write fence, §8) -----------
    if (regSnap.exists) {
      const reg = regSnap.data();
      if (reg.composeKeyCanonical !== composeKey) {
        throw new Error(`compose_keys/${registryId}: canonical token mismatch`);
      }
      const f = reg.fingerprint || {};
      const match = f.classId === classId && f.listId === listId &&
        f.logicalDay === logicalDay && f.resetEpoch === resetEpoch &&
        f.sessionType === sessionType && f.kind === kind &&
        (f.visitId ?? null) === visitId &&
        (mode === "live-review" || f.testType === params.testType);
      if (!match) return {status: "compose_key_reused"};
      const pSnap = await txn.get(db.doc(`users/${uid}/review_presentations/${reg.presentationId}`));
      if (!pSnap.exists) {
        throw new Error(`compose_keys/${registryId}: dangling presentationId ${reg.presentationId}`);
      }
      return {
        status: "replayed",
        presentationId: reg.presentationId,
        path: pSnap.ref.path,
        presentation: pSnap.data(),
      };
    }

    // ---- WRITE FENCE (§9) ------------------------------------------------
    const pmData = pmSnap.exists ? pmSnap.data() : null;
    const lpData = lpSnap.exists ? lpSnap.data() : null;
    if (resetLockActive(pmData, lpData)) return {status: "reset_in_progress"};
    const currentEpoch = effectiveResetEpoch(pmData, lpData);
    if (currentEpoch !== resetEpoch) return {status: "reset_epoch_mismatch", currentEpoch};

    // ---- COMPOSE + ALLOCATE (mode branches; reads before writes) ---------
    let presentationId; let seq;
    let presentedWordIds; let poolHash; let compositionVersion;
    let fallbackSeed = null; let effectiveTestSize = null; let testType;
    let queueRefPath = null;
    let counterWrite = null; let queueCountWrite = null;

    if (mode === "live-review") {
      const qId = queueDocId(classId, listId, logicalDay, resetEpoch);
      const queueRef = db.doc(`users/${uid}/review_queues/${qId}`);
      const qSnap = await txn.get(queueRef);
      if (!qSnap.exists) {
        // Wiring law: the queue composes FIRST in the same request — an
        // absent queue here is a caller sequencing bug, never a student state.
        throw new Error(`live-review claim without queue ${queueRef.path}`);
      }
      const q = qSnap.data();
      testType = q.snapshot?.reviewTestType === "typed" ? "typed" : "mcq";
      const ids = q.orderedQueueWordIds;
      const idx = params.wordIndexByWordId;
      for (const id of ids) {
        if (!Number.isInteger(idx[id])) {
          throw new TypeError(`composePresentation: wordIndexByWordId missing ${id}`);
        }
      }
      // Labels join the read set (§10 server truth; §3 composition inputs).
      const labels = new Map();
      for (let i = 0; i < ids.length; i += STUDY_STATE_READ_CHUNK) {
        const chunk = ids.slice(i, i + STUDY_STATE_READ_CHUNK);
        const snaps = await txn.getAll(
            ...chunk.map((w) => db.doc(`users/${uid}/study_states/${w}`)));
        snaps.forEach((sn, j) => {
          const d = sn.exists ? sn.data() : {};
          const ms = (t) => (t && typeof t.toMillis === "function") ? t.toMillis() : null;
          labels.set(chunk[j], {
            fc: Number.isInteger(d.reviewFailCount) && d.reviewFailCount > 0 ? d.reviewFailCount : 0,
            lfMs: ms(d.reviewLastFailedAt),
            lcMs: ms(d.reviewLastCorrectAt),
            rltMs: ms(d.reviewLastTestedAt),
          });
        });
      }
      const composed = composeLiveReviewTest({
        members: ids.map((id) => ({wordId: id, wordIndex: idx[id], ...labels.get(id)})),
        testSize: Number.isInteger(q.snapshot?.testSize) ? q.snapshot.testSize : ids.length,
        rng,
      });
      presentedWordIds = composed.presentedWordIds;
      compositionVersion = composed.compositionVersion;
      fallbackSeed = composed.fallbackSeed;
      effectiveTestSize = composed.effectiveTestSize;
      poolHash = q.poolHash;
      queueRefPath = queueRef.path;
      seq = (Number.isInteger(q.presentationCount) ? q.presentationCount : 0) + 1;
      presentationId = `${qId}_p${seq}`;
      queueCountWrite = () => txn.update(queueRef, {presentationCount: seq});
    } else {
      // Counter-doc allocation (§3 FROZEN [r57]): family `_n` (new-day) /
      // `_r` (rerun review); create {next:2}+allocate 1 on first use, else
      // transactional read+increment. The allocated seq = the pre-increment.
      const fam = mode === "new-day" ? "n" : "r";
      const familyId = `${classId}_${listId}_d${logicalDay}_e${resetEpoch}_${fam}`;
      const counterRef = db.doc(`users/${uid}/review_counters/${familyId}`);
      const cSnap = await txn.get(counterRef);
      if (cSnap.exists) {
        const next = cSnap.data().next;
        if (!Number.isInteger(next) || next < 1) {
          throw new Error(`review_counters/${familyId}: corrupt next=${String(next)}`);
        }
        seq = next;
        counterWrite = () => txn.update(counterRef, {next: next + 1});
      } else {
        seq = 1;
        counterWrite = () => txn.set(counterRef,
            {uid, classId, listId, logicalDay, resetEpoch, next: 2});
      }
      presentationId = `${familyId}${seq}`;
      testType = params.testType;
      if (mode === "new-day") {
        presentedWordIds = params.presentedWordIds.slice();
        compositionVersion = "new-day";
      } else {
        presentedWordIds = drawRerunReview({
          poolWordIds: params.poolWordIds, testSize: params.testSize, rng,
        });
        compositionVersion = "rerun-random";
      }
      poolHash = computePoolHash(params.poolWordIds);
    }

    // ---- WRITES ----------------------------------------------------------
    const fingerprint = {
      classId, listId, logicalDay, resetEpoch,
      sessionType, testType, kind, visitId,
    };
    txn.create(registryRef, {
      composeKeyCanonical: composeKey,
      presentationId,
      fingerprint,
      createdAt: FieldValue.serverTimestamp(),
      resetEpoch,
    });
    const presRef = db.doc(`users/${uid}/review_presentations/${presentationId}`);
    const presentation = {
      uid, classId, listId, logicalDay, resetEpoch,
      composeKey,
      requestFingerprint: {sessionType, testType, kind, visitId},
      fallbackSeed,
      queueRef: queueRefPath,
      poolHash,
      presentedWordIds,
      presentationHash: computePresentationHash(presentedWordIds),
      compositionVersion,
      testType,
      visitId,
      serverClaim: {claimedAt: FieldValue.serverTimestamp(), attemptDocId: null},
      createdAt: FieldValue.serverTimestamp(),
    };
    txn.create(presRef, presentation);
    if (queueCountWrite) queueCountWrite();
    if (counterWrite) counterWrite();

    const {serverClaim, createdAt, ...echo} = presentation;
    return {
      status: "created",
      presentationId,
      path: presRef.path,
      presentation: {...echo, serverClaim: {attemptDocId: null}},
      seq,
      fallbackUsed: compositionVersion === "fallback-random",
      fallbackSeed,
      effectiveTestSize,
    };
  });
}

module.exports = {
  composePresentation,
  // Pure/fixture-facing surface:
  composeLiveReviewTest,
  drawRerunReview,
  needsPriority,
  lrtCompare,
  computePresentationHash,
  compositionInvariantHolds,
  mulberry32,
  COMPOSE_KEY_RE,
};
