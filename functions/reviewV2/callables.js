/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — CALLABLES: the dormant review_v2 server
 * surface (wiring layer over the engine modules)
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69). This is
 * the ONE layer index.js re-exports (single-require wiring). Every callable
 * here is DARK BY CONSTRUCTION: the serving gate is THE STAMPING PREDICATE
 * [R2-48] — `system_config/review_v2` deploys `{enabled:false,
 * firstEnabledAt:null, rehearsalClassIds:[]}`, so every call refuses
 * `failed-precondition` until the flip (or, pre-flip, for `rehearsalClassIds`
 * members only — the 25WT rehearsal path, the ONLY pre-flip ON-behavior).
 * A test the engine cannot stamp must never be served (R2-41: every graded
 * test stamps), so serving-eligibility ≡ stamping-eligibility; post-flip
 * kill-switch windows stay SERVED under the R2-32 per-field law (the marker
 * keeps `stampingEligible` true).
 *
 * Shared fences on every student callable: auth required · enrollment +
 * assignment existence (from the resolver's class read — zero extra I/O) ·
 * the contract-(5) client-version fence (`clientContractVersion` in the
 * request; the exact r55 predicate) · config HOLD ⇒ refuse, mint nothing ·
 * the §9 reset fence inside every engine txn (module-level) · server-derived
 * `resetEpoch` (tombstone read — the client NEVER names its epoch).
 *
 * DERIVATIONS MINTED HERE (checkpoint-review flagged):
 *  - The day's review universe = canonical `lists/{listId}/words` (position
 *    asc [r55]) sliced to positions < the day-anchor's `newWordStartIndex`
 *    (words introduced BEFORE the day; a day with no new-word anchor —
 *    review-only/list-end — reviews the WHOLE list) [derived from the anchor
 *    pairing law; flagged].
 *  - `anchorNwei` = the day-anchor's `newWordEndIndex` (−1 when anchor-less)
 *    and `generation` = "s{start}e{end}" of the same anchor ("none" when
 *    anchor-less) — the cross-class match tuple: two classes sharing a
 *    logical day derive identical values IFF they see the same
 *    (uid,list,day)-scoped anchor attempt [flagged].
 *  - Rerun pools: the introduced range THROUGH the visited day (its anchor's
 *    `newWordEndIndex`), resting included [R2-41(h); the full-vs-day-scoped
 *    reading of rows 70-71 — flagged].
 *  - MCQ server verdict: trimmed exact match of `studentResponse` against
 *    the canonical word doc's `definition` (the client's own answer-key
 *    source — index.js resolveAnswerDefinitions:812) — client verdicts are
 *    NEVER trusted (provenance rule). TYPED review modality refuses
 *    `typed_modality_deferred` at dark stage — it lands with the DF2-12
 *    grading-jobs integration in the train [flagged].
 *  - Attempt docId = `rv2_{presentationId}` — deterministic 1:1 (every
 *    retake composes a NEW presentation), so the idempotent retry returns
 *    the existing attempt with ZERO writes (§8).
 *
 * The evaluator callable is ADMIN-ONLY (custom claim `admin === true`).
 */

"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");

const {resolveReviewConfig, checkClientVersion} = require("./config");
const {composeDayQueue, queueDocId, effectiveResetEpoch, resetLockActive} = require("./composer");
const {composePresentation} = require("./presentations");
const {stampLabelsInTxn} = require("./stamping");
const {completeDay, graduateRerunInTxn} = require("./completion");
const {mintRestudyVisit, recordRerunHalfInTxn} = require("./visits");
const {evaluateThresholds, recordOpsMetric} = require("./monitoring");

function getDb() {
  return admin.firestore();
}

// ---------------------------------------------------------------------------
// Shared fences
// ---------------------------------------------------------------------------

function requireAuth(request) {
  const uid = request.auth?.uid;
  if (typeof uid !== "string" || uid.length === 0) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  return uid;
}

function requireStrings(data, names) {
  for (const k of names) {
    if (typeof data?.[k] !== "string" || data[k].length === 0) {
      throw new HttpsError("invalid-argument", `${k} required`);
    }
  }
}

/** The serving gate + authorization facts + the version fence — one resolver
 *  read, applied identically by every student callable. */
async function resolveAndGate(db, {uid, classId, listId, clientContractVersion}) {
  const config = await resolveReviewConfig(db, {classId, listId, uid});
  if (config.readStatus === "hold") {
    // Outage ≠ OFF [r48]: refuse loudly, mint nothing, client retries.
    throw new HttpsError("unavailable", "review_v2_hold");
  }
  if (!config.classExists) throw new HttpsError("not-found", "class not found");
  if (!config.enrolled) throw new HttpsError("permission-denied", "not enrolled");
  if (!config.assignmentExists) throw new HttpsError("failed-precondition", "list not assigned");
  const stale = checkClientVersion(config, clientContractVersion);
  if (stale) {
    throw new HttpsError("failed-precondition", "client_version_stale",
        {minClientVersion: stale.minClientVersion});
  }
  if (config.stampingEligible !== true) {
    // THE DORMANCY GATE [R2-48]: dark + non-rehearsal ⇒ the engine does not
    // serve (a test that cannot stamp must not exist — R2-41).
    throw new HttpsError("failed-precondition", "review_v2_dark");
  }
  return config;
}

/** Server-derived resetEpoch (§9 tombstone reduction) + lock courtesy check
 *  (the binding check re-runs inside every engine txn). */
async function deriveEpoch(db, uid, listId) {
  const [pm, lp] = await db.getAll(
      db.doc(`users/${uid}/progress_meta/${listId}`),
      db.doc(`users/${uid}/list_progress/${listId}`));
  const pmData = pm.exists ? pm.data() : null;
  const lpData = lp.exists ? lp.data() : null;
  if (resetLockActive(pmData, lpData)) {
    throw new HttpsError("aborted", "reset_in_progress");
  }
  return effectiveResetEpoch(pmData, lpData);
}

/** Map an engine module's typed refusal onto the callable response (frozen
 *  statuses pass through as data — they are protocol, not errors). */
function refusalToResponse(result) {
  return result; // {status: ...} shapes are the frozen protocol
}

// ---------------------------------------------------------------------------
// Anchor + canonical-word derivations (minted here — header-flagged)
// ---------------------------------------------------------------------------

/** Canonical list order [r55]: lists/{listId}/words by `position` asc.
 *  Returns [{wordId, wordIndex}] (wordIndex = the position VALUE). */
async function loadCanonicalWords(db, listId) {
  const snap = await db.collection("lists").doc(listId).collection("words")
      .orderBy("position", "asc").get();
  return snap.docs.map((d) => ({
    wordId: d.id,
    wordIndex: Number.isInteger(d.data().position) ? d.data().position : 0,
  }));
}

/** The day's anchor tuple + review universe (see header derivations). */
async function deriveDayContext(db, {uid, listId, logicalDay, canonicalWords}) {
  // foundation.deriveDayAnchorRange is (uid,list,day)-scoped — shared across
  // classes, exactly the cross-class stability the match tuple needs.
  const foundation = require("../foundation");
  const anchor = await foundation.deriveDayAnchorRange(uid, listId, logicalDay);
  const anchorNwei = Number.isInteger(anchor?.newWordEndIndex) ? anchor.newWordEndIndex : -1;
  const generation = anchor && Number.isInteger(anchor.newWordEndIndex)
    ? `s${anchor.newWordStartIndex ?? "x"}e${anchor.newWordEndIndex}`
    : "none";
  const startIdx = Number.isInteger(anchor?.newWordStartIndex) ? anchor.newWordStartIndex : null;
  // Review universe: introduced BEFORE the day; anchor-less ⇒ whole list.
  const introducedWords = startIdx === null
    ? canonicalWords
    : canonicalWords.filter((w) => w.wordIndex < startIdx);
  // Rerun pool: introduced THROUGH the visited day (anchor-less ⇒ whole list).
  const throughWords = anchorNwei >= 0
    ? canonicalWords.filter((w) => w.wordIndex <= anchorNwei)
    : canonicalWords;
  return {anchorNwei, generation, introducedWords, throughWords, anchor};
}

// ---------------------------------------------------------------------------
// 1. Compose the live review session (queue + presentation claim)
// ---------------------------------------------------------------------------

const reviewV2ComposeSession = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId", "composeKey"]);
  if (!Number.isInteger(d.logicalDay) || d.logicalDay < 1) {
    throw new HttpsError("invalid-argument", "logicalDay must be an integer ≥ 1");
  }
  const config = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  const resetEpoch = await deriveEpoch(db, uid, d.listId);
  const canonicalWords = await loadCanonicalWords(db, d.listId);
  if (canonicalWords.length === 0) {
    throw new HttpsError("failed-precondition", "list has no words");
  }
  const ctx = await deriveDayContext(db, {uid, listId: d.listId, logicalDay: d.logicalDay, canonicalWords});
  if (ctx.introducedWords.length === 0) {
    // Day 1 has no review (first_day_new_only) — nothing to compose.
    return {status: "empty_pool"};
  }

  const q = await composeDayQueue(db, {
    uid, classId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch,
    anchorNwei: ctx.anchorNwei, generation: ctx.generation,
    introducedWords: ctx.introducedWords,
  });
  if (q.status !== "created" && q.status !== "exists") return refusalToResponse(q);

  const wordIndexByWordId = {};
  for (const w of ctx.introducedWords) wordIndexByWordId[w.wordId] = w.wordIndex;
  const p = await composePresentation(db, {
    uid, classId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch,
    composeKey: d.composeKey, mode: "live-review",
    wordIndexByWordId,
  });
  if (p.status !== "created" && p.status !== "replayed") return refusalToResponse(p);

  if (p.status === "created" && p.fallbackUsed) {
    // §6c duty: composition_fallback to the server-only sink (post-txn —
    // selection is not correctness-critical, R2-42 fail-open-safe).
    await recordOpsMetric(db, {
      type: "composition_fallback",
      uid, classId: d.classId, listId: d.listId,
      payload: {presentationId: p.presentationId, fallbackSeed: p.fallbackSeed},
    }).catch(() => {}); // monitoring must never fail the compose
  }

  return {
    status: "composed",
    queue: {
      queueId: q.queueId,
      orderedQueueWordIds: q.queue.orderedQueueWordIds,
      snapshot: q.queue.snapshot,
      logicalDay: d.logicalDay,
      resetEpoch,
    },
    presentation: {
      presentationId: p.presentationId,
      presentedWordIds: p.presentation.presentedWordIds,
      testType: p.presentation.testType,
      compositionVersion: p.presentation.compositionVersion,
    },
    gatePosture: {
      effectiveEnabled: config.gateEffectiveEnabled,
      threshold: config.threshold,
      configVersion: config.configVersion,
      source: "compose",
    },
  };
});

// ---------------------------------------------------------------------------
// 2. Compose a rerun presentation (restudy halves — review or new)
// ---------------------------------------------------------------------------

const reviewV2ComposeRerun = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId", "composeKey", "visitId", "half"]);
  if (!Number.isInteger(d.visitedDay) || d.visitedDay < 1) {
    throw new HttpsError("invalid-argument", "visitedDay must be an integer ≥ 1");
  }
  if (d.half !== "review" && d.half !== "new") {
    throw new HttpsError("invalid-argument", "half must be 'review'|'new'");
  }
  const config = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  const resetEpoch = await deriveEpoch(db, uid, d.listId);
  const canonicalWords = await loadCanonicalWords(db, d.listId);
  const ctx = await deriveDayContext(db, {uid, listId: d.listId, logicalDay: d.visitedDay, canonicalWords});

  let p;
  if (d.half === "review") {
    if (ctx.throughWords.length === 0) return {status: "empty_pool"};
    p = await composePresentation(db, {
      uid, classId: d.classId, listId: d.listId,
      logicalDay: d.visitedDay, resetEpoch,
      composeKey: d.composeKey, mode: "rerun-review",
      poolWordIds: ctx.throughWords.map((w) => w.wordId),
      testSize: config.testSize,
      testType: config.reviewTestType,
      visitId: d.visitId,
    });
  } else {
    // Rerun NEW half: the visited day's own anchor range, in canonical order.
    const a = ctx.anchor;
    if (!a || !Number.isInteger(a.newWordEndIndex) || !Number.isInteger(a.newWordStartIndex)) {
      return {status: "no_evidence", reason: "visited day has no new-word anchor"};
    }
    const dayWords = canonicalWords
        .filter((w) => w.wordIndex >= a.newWordStartIndex && w.wordIndex <= a.newWordEndIndex)
        .map((w) => w.wordId);
    if (dayWords.length === 0) return {status: "empty_pool"};
    p = await composePresentation(db, {
      uid, classId: d.classId, listId: d.listId,
      logicalDay: d.visitedDay, resetEpoch,
      composeKey: d.composeKey, mode: "new-day", kind: "rerun",
      presentedWordIds: dayWords, poolWordIds: dayWords,
      testType: config.reviewTestType,
      visitId: d.visitId,
    });
  }
  if (p.status !== "created" && p.status !== "replayed") return refusalToResponse(p);
  return {
    status: "composed",
    presentation: {
      presentationId: p.presentationId,
      presentedWordIds: p.presentation.presentedWordIds,
      testType: p.presentation.testType,
      compositionVersion: p.presentation.compositionVersion,
      visitId: d.visitId,
    },
    gatePosture: {
      effectiveEnabled: config.gateEffectiveEnabled,
      threshold: config.threshold,
      configVersion: config.configVersion,
      source: "rerun-compose",
    },
  };
});

// ---------------------------------------------------------------------------
// 3. Submit a review-engine attempt (live review / rerun halves) — THE
//    attempt txn: drift rule + MCQ server verdict + COMPLETE-ROWS + stamps
// ---------------------------------------------------------------------------

const reviewV2SubmitAttempt = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["presentationId"]);
  if (!Array.isArray(d.answers)) {
    throw new HttpsError("invalid-argument", "answers array required");
  }
  for (const a of d.answers) {
    if (typeof a?.wordId !== "string" || a.wordId.length === 0 ||
        typeof (a.studentResponse ?? "") !== "string") {
      throw new HttpsError("invalid-argument", "each answer needs {wordId, studentResponse}");
    }
  }

  // Pre-reads OUTSIDE the txn: presentation (identity), then gate on its
  // class. The txn re-reads everything binding.
  const presRef = db.doc(`users/${uid}/review_presentations/${d.presentationId}`);
  const preSnap = await presRef.get();
  if (!preSnap.exists) throw new HttpsError("not-found", "presentation not found");
  const pres = preSnap.data();
  if (pres.uid !== uid) throw new HttpsError("permission-denied", "not yours");
  const config = await resolveAndGate(db, {
    uid, classId: pres.classId, listId: pres.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (pres.testType === "typed") {
    // DF2-12's grading-jobs integration lands in the train — refuse loudly
    // rather than mint an unstamped typed attempt (header-flagged).
    throw new HttpsError("unimplemented", "typed_modality_deferred");
  }

  // MCQ answer key: canonical definitions (never the client's).
  const presentedSet = new Set(pres.presentedWordIds);
  const submitted = new Map();
  for (const a of d.answers) {
    if (!presentedSet.has(a.wordId)) {
      throw new HttpsError("invalid-argument", "answer for unpresented word (drift rule)");
    }
    if (submitted.has(a.wordId)) {
      throw new HttpsError("invalid-argument", "duplicate answer row");
    }
    submitted.set(a.wordId, String(a.studentResponse ?? ""));
  }
  const wordRefs = pres.presentedWordIds.map((id) =>
    db.collection("lists").doc(pres.listId).collection("words").doc(id));
  const wordSnaps = await db.getAll(...wordRefs);
  const keyByWordId = new Map();
  wordSnaps.forEach((s) => {
    if (s.exists) keyByWordId.set(s.id, s.data().definition ?? null);
  });

  // COMPLETE-ROWS [r64]: one row per PRESENTED word; absent/empty ⇒ blank.
  const rows = pres.presentedWordIds.map((wordId) => {
    const resp = (submitted.get(wordId) ?? "").trim();
    const key = keyByWordId.get(wordId);
    const blank = resp === "";
    const isCorrect = !blank && key != null && resp === String(key).trim();
    return {
      wordId,
      studentResponse: submitted.get(wordId) ?? "",
      correctDefinition: key,
      isCorrect,
      ...(blank ? {blank: true} : {}),
    };
  });
  const totalQuestions = rows.length;
  const correctCount = rows.filter((r) => r.isCorrect).length;
  const score = Math.round((correctCount / totalQuestions) * 100);

  const isRerun = pres.requestFingerprint?.kind === "rerun";
  const isReviewType = pres.requestFingerprint?.sessionType === "review";
  const attemptId = `rv2_${d.presentationId}`;
  const attemptRef = db.collection("attempts").doc(attemptId);
  const pmRef = db.doc(`users/${uid}/progress_meta/${pres.listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${pres.listId}`);

  const result = await db.runTransaction(async (txn) => {
    // ---- READS (the activation barrier: config joins THIS txn) ----------
    const txnConfig = await resolveReviewConfig(db, {classId: pres.classId, listId: pres.listId, txn});
    const [pm, lp, aSnap, pSnap] = await txn.getAll(pmRef, lpRef, attemptRef, presRef);
    if (txnConfig.readStatus === "hold") return {status: "config_hold"};
    if (aSnap.exists) {
      // Idempotent retry ⇒ the existing attempt, ZERO writes (§8).
      return {status: "attempt_exists", attemptId, attempt: aSnap.data()};
    }
    const pmData = pm.exists ? pm.data() : null;
    const lpData = lp.exists ? lp.data() : null;
    if (resetLockActive(pmData, lpData)) return {status: "reset_in_progress"};
    const currentEpoch = effectiveResetEpoch(pmData, lpData);
    if (currentEpoch !== pres.resetEpoch) {
      return {status: "reset_epoch_mismatch", currentEpoch};
    }
    if (!pSnap.exists) throw new Error("presentation vanished");
    const p = pSnap.data();

    // Threshold: the day's pinned snapshot for live review; the current
    // config for reruns (reruns are not day-pinned).
    let threshold = txnConfig.threshold;
    let queueId = null;
    if (p.queueRef) {
      const qSnap = await txn.get(db.doc(p.queueRef));
      if (qSnap.exists && Number.isInteger(qSnap.data().snapshot?.threshold)) {
        threshold = qSnap.data().snapshot.threshold;
        queueId = queueDocId(p.classId, p.listId, p.logicalDay, p.resetEpoch);
      }
    }
    const passed = score >= threshold;

    // Rerun visit doc (read before writes when needed).
    let visitSnap = null;
    if (isRerun && typeof p.visitId === "string" && p.visitId.length > 0) {
      visitSnap = await txn.get(db.doc(`users/${uid}/restudy_visits/${p.visitId}`));
    }

    // ---- WRITES ----------------------------------------------------------
    const attempt = {
      studentId: uid,
      classId: p.classId,
      listId: p.listId,
      testId: `vocaboost_test_${p.classId}_${p.listId}_review`,
      studyDay: p.logicalDay,
      sessionType: p.requestFingerprint?.sessionType === "new" ? "new" : "review",
      testType: p.testType,
      ...(isRerun ? {type: "retest", visitId: p.visitId ?? null} : {}),
      score,
      passed,
      totalQuestions,
      answers: rows,
      presentationId: d.presentationId,
      queueId,
      resetEpoch: p.resetEpoch,
      gatePosture: {
        effectiveEnabled: txnConfig.gateEffectiveEnabled,
        threshold,
        configVersion: txnConfig.configVersion,
        source: "reviewV2SubmitAttempt",
      },
      submittedAt: FieldValue.serverTimestamp(),
    };
    txn.create(attemptRef, attempt);
    txn.update(presRef, {"serverClaim.attemptDocId": attemptId});

    const stamps = stampLabelsInTxn(txn, db, {
      uid, config: txnConfig, rows,
      presentedWordIds: p.presentedWordIds,
      isReviewType, isPassing: passed,
    });

    let rerunGraduated = [];
    let visitHalf = null;
    if (isRerun && passed) {
      if (isReviewType) {
        const g = graduateRerunInTxn(txn, db, {
          uid, config: txnConfig,
          rows: rows.map((r) => ({wordId: r.wordId, isCorrect: r.isCorrect})),
          nowMs: Date.now(),
        });
        rerunGraduated = g.graduated;
      }
      if (visitSnap) {
        visitHalf = recordRerunHalfInTxn(txn, db, {
          uid, visitSnap,
          half: isReviewType ? "review" : "new",
          attemptId,
        });
      }
    }

    return {
      status: "attempt_written",
      attemptId, score, passed, totalQuestions, correctCount,
      stamped: stamps.stamped, stampSkipped: stamps.skipped,
      rerunGraduated, visitHalf,
      gatePosture: attempt.gatePosture,
    };
  });
  return refusalToResponse(result);
});

// ---------------------------------------------------------------------------
// 4. Complete the shared logical day (the §3b CAS + graduation + streak)
// ---------------------------------------------------------------------------

const reviewV2CompleteDay = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId"]);
  if (!Number.isInteger(d.logicalDay) || d.logicalDay < 1) {
    throw new HttpsError("invalid-argument", "logicalDay must be an integer ≥ 1");
  }
  const consumedAttemptId = typeof d.consumedAttemptId === "string" && d.consumedAttemptId.length > 0
    ? d.consumedAttemptId : null;
  const consumedAttemptClassId = typeof d.consumedAttemptClassId === "string" && d.consumedAttemptClassId.length > 0
    ? d.consumedAttemptClassId : null;
  const newTestAttemptId = typeof d.newTestAttemptId === "string" && d.newTestAttemptId.length > 0
    ? d.newTestAttemptId : null;

  await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  const resetEpoch = await deriveEpoch(db, uid, d.listId);
  const canonicalWords = await loadCanonicalWords(db, d.listId);
  const ctx = await deriveDayContext(db, {uid, listId: d.listId, logicalDay: d.logicalDay, canonicalWords});

  const result = await completeDay(db, {
    uid, winningClassId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch,
    anchorNwei: ctx.anchorNwei, generation: ctx.generation,
    consumedAttemptId, consumedAttemptClassId, newTestAttemptId,
  });
  return refusalToResponse(result);
});

// ---------------------------------------------------------------------------
// 5. Mint a restudy visit (R2-40 — visitId claimed at restudy-day entry)
// ---------------------------------------------------------------------------

const reviewV2MintVisit = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId"]);
  if (!Number.isInteger(d.day) || d.day < 1) {
    throw new HttpsError("invalid-argument", "day must be an integer ≥ 1");
  }
  await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  const resetEpoch = await deriveEpoch(db, uid, d.listId);
  const v = await mintRestudyVisit(db, {
    uid, classId: d.classId, listId: d.listId, day: d.day, resetEpoch,
  });
  return {status: "visit_minted", visitId: v.visitId};
});

// ---------------------------------------------------------------------------
// 6. The evaluator (ADMIN-ONLY — ops surface, R2-18 signals)
// ---------------------------------------------------------------------------

const reviewV2EvaluateThresholds = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  requireAuth(request);
  if (request.auth?.token?.admin !== true) {
    throw new HttpsError("permission-denied", "admin only");
  }
  const d = request.data ?? {};
  return evaluateThresholds(db, {
    scope: d.scope,
    dryRun: d.dryRun !== false, // default DRY — explicit false to publish
    thresholds: typeof d.thresholds === "object" && d.thresholds !== null ? d.thresholds : {},
    windowMs: Number.isFinite(d.windowMs) ? d.windowMs : undefined,
  });
});

module.exports = {
  reviewV2ComposeSession,
  reviewV2ComposeRerun,
  reviewV2SubmitAttempt,
  reviewV2CompleteDay,
  reviewV2MintVisit,
  reviewV2EvaluateThresholds,
};
