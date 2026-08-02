/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — CALLABLES: the dormant review_v2 server
 * surface (wiring layer over the engine modules)
 * ============================================================================
 * r70 FOLD (the double-NO lived HERE): day/universe authority moved INTO the
 * engine transactions (progress.js — the callable never names its epoch OR
 * its universe and its `logicalDay` is bound to the server frontier in-txn);
 * completion evidence is fully bound (completion.js C1); serving authority
 * re-enforced inside every minting txn (config.js C3); the live NEW-word
 * route exists (C4 — every graded test stamps); protocol statuses surface
 * UNIFORMLY as `{status}` data (C5/L-3 — HttpsError is reserved for
 * auth/args/not-found/permission); malformed canonical word data is a typed
 * refusal + ops signal (C5/M-7); the contract-named monitoring signals are
 * emitted (C7: composition_fallback · priority_saturation_day ·
 * rerun_graduation · cursor_repaired).
 *
 * DARK BY CONSTRUCTION: the serving gate is THE STAMPING PREDICATE [R2-48] —
 * `system_config/review_v2` deploys `{enabled:false, firstEnabledAt:null,
 * rehearsalClassIds:[]}`, so every call refuses `review_v2_dark` until the
 * flip (pre-flip, `rehearsalClassIds` members only — the 25WT rehearsal).
 * Serving ≡ stamping (R2-41); post-flip kill windows stay served under the
 * R2-32 per-field law.
 *
 * DERIVATIONS (r70-adjudicated): universe/tuple/frontier from progress truth
 * (csd/twi — CC-2) · rerun review over the FULL current introduced range
 * (R2-41(h) as ruled by both lanes) · live new-day range = [twi, twi+pace)
 * with `deriveDailyPace` (the day's anchor; stamped on the attempt for
 * anchor continuity) · MCQ server verdict vs canonical `definition` (client
 * verdicts never trusted); typed review modality refuses
 * `typed_modality_deferred` (DATA) until DF2-12 · attempt docId =
 * `rv2_{presentationId}` (1:1, idempotent replay returns the NORMALIZED
 * envelope with zero writes [C5]).
 */

"use strict";

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");

const {resolveReviewConfig, checkClientVersion, assertServableInTxn} = require("./config");
const {composeDayQueue, queueDocId, effectiveResetEpoch, resetLockActive} = require("./composer");
const {composePresentation} = require("./presentations");
const {stampLabelsInTxn} = require("./stamping");
const {completeDay, graduateRerunInTxn} = require("./completion");
const {mintRestudyVisit, recordRerunHalfInTxn} = require("./visits");
const {evaluateThresholds, recordOpsMetric} = require("./monitoring");
const {readProgressTruth} = require("./progress");

function getDb() {
  return admin.firestore();
}

// ---------------------------------------------------------------------------
// Shared fences (HttpsError ONLY for auth/args/not-found/permission — every
// protocol refusal returns as {status} data [r70 C5])
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

/** Preflight gate: authorization (throws) + protocol posture (returns a
 *  refusal object or null). Binding posture checks re-run in every txn. */
async function resolveAndGate(db, {uid, classId, listId, clientContractVersion}) {
  const config = await resolveReviewConfig(db, {classId, listId, uid});
  if (config.readStatus === "hold") {
    return {refusal: {status: "config_hold", holdReason: config.holdReason}};
  }
  if (!config.classExists) throw new HttpsError("not-found", "class not found");
  if (!config.enrolled) throw new HttpsError("permission-denied", "not enrolled");
  if (!config.assignmentExists) throw new HttpsError("failed-precondition", "list not assigned");
  const stale = checkClientVersion(config, clientContractVersion);
  if (stale) return {refusal: stale};
  if (config.stampingEligible !== true) {
    return {refusal: {status: "review_v2_dark"}};
  }
  return {config};
}

/** Server-derived resetEpoch (§9 tombstone reduction) — courtesy preflight;
 *  every engine txn re-checks bindingly. */
async function deriveEpoch(db, uid, listId) {
  const [pm, lp] = await db.getAll(
      db.doc(`users/${uid}/progress_meta/${listId}`),
      db.doc(`users/${uid}/list_progress/${listId}`));
  const pmData = pm.exists ? pm.data() : null;
  const lpData = lp.exists ? lp.data() : null;
  if (resetLockActive(pmData, lpData)) {
    return {refusal: {status: "reset_in_progress"}};
  }
  return {resetEpoch: effectiveResetEpoch(pmData, lpData)};
}

/** Fire-and-forget ops emission — monitoring can never fail a request. */
function emitOps(db, event) {
  recordOpsMetric(db, event).catch(() => {});
}

/** Awaited (still swallow-on-error) — refusal paths use this so the signal
 *  is durably landed before the client can retry into the same defect. */
async function emitOpsAwait(db, event) {
  await recordOpsMetric(db, event).catch(() => {});
}

/** Canonical list order [r55] with the M-7 law: any word doc whose
 *  `position` is missing/non-integer, or a duplicate position, makes the
 *  list unusable for composition — typed refusal + ops signal, never a
 *  silent drop or an `internal`. */
async function loadCanonicalWordsStrict(db, listId) {
  const snap = await db.collection("lists").doc(listId).collection("words").get();
  const words = [];
  for (const d of snap.docs) {
    const pos = d.data().position;
    if (!Number.isInteger(pos) || pos < 0) {
      return {refusal: {status: "list_words_malformed", wordId: d.id}};
    }
    words.push({wordId: d.id, wordIndex: pos});
  }
  words.sort((a, b) => a.wordIndex - b.wordIndex);
  for (let i = 1; i < words.length; i++) {
    if (words[i].wordIndex === words[i - 1].wordIndex) {
      return {refusal: {status: "list_words_malformed", wordId: words[i].wordId, duplicatePosition: words[i].wordIndex}};
    }
  }
  return {words};
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
  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  const canonical = await loadCanonicalWordsStrict(db, d.listId);
  if (canonical.refusal) {
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: canonical.refusal});
    return canonical.refusal;
  }
  if (canonical.words.length === 0) {
    throw new HttpsError("failed-precondition", "list has no words");
  }

  const q = await composeDayQueue(db, {
    uid, classId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch: epoch.resetEpoch,
    canonicalWords: canonical.words,
    clientContractVersion: d.clientContractVersion,
  });
  if (q.status !== "created" && q.status !== "exists") return q;
  if (q.status === "created" && q.cursorRepaired) {
    emitOps(db, {type: "cursor_repaired", uid, classId: d.classId, listId: d.listId,
      payload: {logicalDay: d.logicalDay}});
  }

  const wordIndexByWordId = {};
  for (const w of canonical.words) wordIndexByWordId[w.wordId] = w.wordIndex;
  const p = await composePresentation(db, {
    uid, classId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch: epoch.resetEpoch,
    composeKey: d.composeKey, mode: "live-review",
    wordIndexByWordId,
    clientContractVersion: d.clientContractVersion,
  });
  if (p.status !== "created" && p.status !== "replayed") return p;

  if (p.status === "created") {
    if (p.fallbackUsed) {
      // §6c duty (post-txn — selection is not correctness-critical, R2-42).
      emitOps(db, {type: "composition_fallback", uid, classId: d.classId, listId: d.listId,
        payload: {presentationId: p.presentationId, fallbackSeed: p.fallbackSeed}});
    }
    // PRIORITY SATURATION [R2-46/C7]: the whole test is failed words.
    if (Number.isInteger(p.priorityCount) && Number.isInteger(p.effectiveTestSize) &&
        p.priorityCount >= p.effectiveTestSize) {
      emitOps(db, {type: "priority_saturation_day", uid, classId: d.classId, listId: d.listId,
        payload: {logicalDay: d.logicalDay, priorityCount: p.priorityCount,
          effectiveTestSize: p.effectiveTestSize}});
    }
  }

  return {
    status: "composed",
    queue: {
      queueId: q.queueId,
      orderedQueueWordIds: q.queue.orderedQueueWordIds,
      snapshot: q.queue.snapshot,
      logicalDay: d.logicalDay,
      resetEpoch: epoch.resetEpoch,
    },
    presentation: {
      presentationId: p.presentationId,
      presentedWordIds: p.presentation.presentedWordIds,
      testType: p.presentation.testType,
      compositionVersion: p.presentation.compositionVersion,
    },
    gatePosture: {
      effectiveEnabled: q.config.gateEffectiveEnabled,
      threshold: q.config.threshold,
      configVersion: q.config.configVersion,
      source: "compose",
    },
  };
});

// ---------------------------------------------------------------------------
// 2. Compose the live NEW-word test (r70 C4 — every graded test stamps, so
//    the live-new leg needs a server presentation + denominator too)
// ---------------------------------------------------------------------------

const reviewV2ComposeNewTest = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId", "composeKey"]);
  if (!Number.isInteger(d.logicalDay) || d.logicalDay < 1) {
    throw new HttpsError("invalid-argument", "logicalDay must be an integer ≥ 1");
  }
  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  const canonical = await loadCanonicalWordsStrict(db, d.listId);
  if (canonical.refusal) {
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: canonical.refusal});
    return canonical.refusal;
  }

  // The day's range = [twi, twi + dailyPace) over canonical order — the
  // anchor the completion advance will re-derive from the attempt. The
  // frontier bind re-runs inside the claim txn via the queue-less new-day
  // path? No queue exists for new tests — the frontier bind is HERE plus
  // the completion's; a stale-day claim dies at completion. Preflight bind:
  const truth = await readProgressTruth(db, {uid, classId: d.classId, listId: d.listId});
  if (d.logicalDay !== truth.frontierDay) {
    return {status: "day_guard_rejected", expectedDay: truth.frontierDay};
  }
  const foundation = require("../foundation");
  const {dailyPace} = foundation.deriveDailyPace(gate.config.assignmentRaw ?? {});
  const startIdx = truth.twi;
  const dayWords = canonical.words
      .filter((w) => w.wordIndex >= startIdx)
      .slice(0, Math.max(1, dailyPace));
  if (dayWords.length === 0) {
    return {status: "list_end", twi: truth.twi};
  }
  const rangeStartIndex = dayWords[0].wordIndex;
  const rangeEndIndex = dayWords[dayWords.length - 1].wordIndex;

  const p = await composePresentation(db, {
    uid, classId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch: epoch.resetEpoch,
    composeKey: d.composeKey, mode: "new-day", kind: "live",
    presentedWordIds: dayWords.map((w) => w.wordId),
    poolWordIds: dayWords.map((w) => w.wordId),
    rangeStartIndex, rangeEndIndex,
    testType: gate.config.reviewTestType === "typed" ? "typed" : "mcq",
    clientContractVersion: d.clientContractVersion,
  });
  if (p.status !== "created" && p.status !== "replayed") return p;
  return {
    status: "composed",
    presentation: {
      presentationId: p.presentationId,
      presentedWordIds: p.presentation.presentedWordIds,
      testType: p.presentation.testType,
      compositionVersion: p.presentation.compositionVersion,
      rangeStartIndex, rangeEndIndex,
    },
    gatePosture: {
      effectiveEnabled: gate.config.gateEffectiveEnabled,
      threshold: gate.config.threshold,
      configVersion: gate.config.configVersion,
      source: "new-compose",
    },
  };
});

// ---------------------------------------------------------------------------
// 3. Compose a rerun presentation (restudy halves — review or new)
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
  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  const canonical = await loadCanonicalWordsStrict(db, d.listId);
  if (canonical.refusal) {
    await emitOpsAwait(db, {type: "list_words_malformed", uid, classId: d.classId, listId: d.listId,
      payload: canonical.refusal});
    return canonical.refusal;
  }

  let p;
  if (d.half === "review") {
    // Pool = the FULL currently-introduced range, sliced INSIDE the claim
    // txn from its own progress read [r70 C2]; visit binding in-txn [C4].
    p = await composePresentation(db, {
      uid, classId: d.classId, listId: d.listId,
      logicalDay: d.visitedDay, resetEpoch: epoch.resetEpoch,
      composeKey: d.composeKey, mode: "rerun-review",
      canonicalWords: canonical.words,
      testSize: gate.config.testSize,
      testType: gate.config.reviewTestType,
      visitId: d.visitId,
      clientContractVersion: d.clientContractVersion,
    });
  } else {
    // Rerun NEW half: the visited day's own HISTORICAL anchor range (the
    // day completed, so its passed new anchor exists by construction).
    const foundation = require("../foundation");
    const a = await foundation.deriveDayAnchorRange(uid, d.listId, d.visitedDay);
    if (!a || !Number.isInteger(a.newWordEndIndex) || !Number.isInteger(a.newWordStartIndex)) {
      return {status: "no_evidence", reason: "visited day has no new-word anchor"};
    }
    const dayWords = canonical.words
        .filter((w) => w.wordIndex >= a.newWordStartIndex && w.wordIndex <= a.newWordEndIndex)
        .map((w) => w.wordId);
    if (dayWords.length === 0) return {status: "empty_pool"};
    p = await composePresentation(db, {
      uid, classId: d.classId, listId: d.listId,
      logicalDay: d.visitedDay, resetEpoch: epoch.resetEpoch,
      composeKey: d.composeKey, mode: "new-day", kind: "rerun",
      presentedWordIds: dayWords, poolWordIds: dayWords,
      testType: gate.config.reviewTestType,
      visitId: d.visitId,
      clientContractVersion: d.clientContractVersion,
    });
  }
  if (p.status !== "created" && p.status !== "replayed") return p;
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
      effectiveEnabled: gate.config.gateEffectiveEnabled,
      threshold: gate.config.threshold,
      configVersion: gate.config.configVersion,
      source: "rerun-compose",
    },
  };
});

// ---------------------------------------------------------------------------
// 4. Submit a review-engine attempt — THE attempt txn: drift rule + MCQ
//    server verdict + COMPLETE-ROWS + stamps (+ rerun graduation/visit half)
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

  // Pre-reads OUTSIDE the txn: presentation identity → gate on its class.
  // Every binding check re-runs inside the txn.
  const presRef = db.doc(`users/${uid}/review_presentations/${d.presentationId}`);
  const preSnap = await presRef.get();
  if (!preSnap.exists) throw new HttpsError("not-found", "presentation not found");
  const pres = preSnap.data();
  if (pres.uid !== uid) throw new HttpsError("permission-denied", "not yours");
  const gate = await resolveAndGate(db, {
    uid, classId: pres.classId, listId: pres.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  if (pres.testType === "typed") {
    // DF2-12's grading-jobs integration lands in-train — refuse as DATA
    // [C5/L-3], zero writes, rather than mint an unstamped typed attempt.
    return {status: "typed_modality_deferred"};
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
  const isNewSession = pres.requestFingerprint?.sessionType === "new";
  const isReviewType = pres.requestFingerprint?.sessionType === "review";
  const attemptId = `rv2_${d.presentationId}`;
  const attemptRef = db.collection("attempts").doc(attemptId);
  const pmRef = db.doc(`users/${uid}/progress_meta/${pres.listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${pres.listId}`);

  const result = await db.runTransaction(async (txn) => {
    // ---- READS (the activation barrier: config joins THIS txn) ----------
    const txnConfig = await resolveReviewConfig(db, {classId: pres.classId, listId: pres.listId, txn});
    const [pm, lp, aSnap, pSnap] = await txn.getAll(pmRef, lpRef, attemptRef, presRef);
    // Serving authority AT TXN TIME [r70 C3] — an eligibility/fence edit
    // between preflight and commit mints NOTHING.
    const refusal = assertServableInTxn(txnConfig, d.clientContractVersion);
    if (refusal) return refusal;
    if (aSnap.exists) {
      // Idempotent retry ⇒ the NORMALIZED envelope, ZERO writes [§8 + C5].
      const stored = aSnap.data();
      const storedRows = Array.isArray(stored.answers) ? stored.answers : [];
      return {
        status: "attempt_written",
        replayed: true,
        attemptId,
        score: stored.score,
        passed: stored.passed,
        totalQuestions: stored.totalQuestions,
        correctCount: storedRows.filter((r) => r?.isCorrect === true).length,
        stamped: null,
        stampSkipped: null,
        rerunGraduated: [],
        visitHalf: null,
        gatePosture: stored.gatePosture ?? null,
      };
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

    // Threshold: the day's pinned queue snapshot for live review (FAIL-
    // CLOSED [r70 C5]: a queueRef with a missing/malformed queue refuses —
    // never silently falls to current config); current config for reruns
    // and new tests (not day-pinned).
    let threshold = txnConfig.threshold;
    let queueId = null;
    if (p.queueRef) {
      const qSnap = await txn.get(db.doc(p.queueRef));
      if (!qSnap.exists || !Number.isInteger(qSnap.data().snapshot?.threshold)) {
        return {status: "queue_invalid", queueRef: p.queueRef};
      }
      threshold = qSnap.data().snapshot.threshold;
      queueId = queueDocId(p.classId, p.listId, p.logicalDay, p.resetEpoch);
    }
    const passed = score >= threshold;

    // Rerun visit binding [r70 C4]: the half binds to ITS visit — read +
    // tuple-verified in-txn; missing/mismatched ⇒ typed, mints nothing.
    let visitSnap = null;
    if (isRerun) {
      if (typeof p.visitId !== "string" || p.visitId.length === 0) {
        return {status: "visit_invalid", reason: "rerun presentation lacks visitId"};
      }
      visitSnap = await txn.get(db.doc(`users/${uid}/restudy_visits/${p.visitId}`));
      if (!visitSnap.exists) return {status: "visit_invalid", reason: "visit missing"};
      const v = visitSnap.data();
      if (v.uid !== uid || v.classId !== p.classId || v.listId !== p.listId ||
          v.day !== p.logicalDay || v.resetEpoch !== p.resetEpoch) {
        return {status: "visit_invalid", reason: "visit tuple mismatch"};
      }
    }

    // ---- WRITES ----------------------------------------------------------
    const attempt = {
      studentId: uid,
      classId: p.classId,
      listId: p.listId,
      testId: `vocaboost_test_${p.classId}_${p.listId}_${isNewSession ? "new" : "review"}`,
      studyDay: p.logicalDay,
      sessionType: isNewSession ? "new" : "review",
      testType: p.testType,
      ...(isRerun ? {type: "retest", visitId: p.visitId ?? null} : {}),
      // Live new-day attempts carry the day's anchor range (continuity for
      // deriveDayAnchorRange/completion twi advance); rerun halves stay
      // range-less (legacy readers blind to them) [r70 C4/L-8].
      ...(isNewSession && !isRerun &&
          Number.isInteger(p.rangeStartIndex) && Number.isInteger(p.rangeEndIndex)
        ? {newWordStartIndex: p.rangeStartIndex, newWordEndIndex: p.rangeEndIndex}
        : {}),
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
      visitHalf = recordRerunHalfInTxn(txn, db, {
        uid, visitSnap,
        half: isReviewType ? "review" : "new",
        attemptId,
      });
    }

    return {
      status: "attempt_written",
      replayed: false,
      attemptId, score, passed, totalQuestions, correctCount,
      stamped: stamps.stamped, stampSkipped: stamps.skipped,
      rerunGraduated, visitHalf,
      gatePosture: attempt.gatePosture,
    };
  });

  if (result.status === "attempt_written" && !result.replayed &&
      Array.isArray(result.rerunGraduated) && result.rerunGraduated.length > 0) {
    // RERUN-GRADUATION volume [R2-41(g)/C7] — from the successful txn.
    emitOps(db, {type: "rerun_graduation", uid, classId: pres.classId, listId: pres.listId,
      payload: {attemptId: result.attemptId, count: result.rerunGraduated.length}});
  }
  return result;
});

// ---------------------------------------------------------------------------
// 5. Complete the shared logical day (the §3b CAS + graduation + streak +
//    THE CANONICAL ADVANCE — one transaction, completion.js C1)
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

  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;

  return completeDay(db, {
    uid, winningClassId: d.classId, listId: d.listId,
    logicalDay: d.logicalDay, resetEpoch: epoch.resetEpoch,
    consumedAttemptId, consumedAttemptClassId, newTestAttemptId,
    clientContractVersion: d.clientContractVersion,
  });
});

// ---------------------------------------------------------------------------
// 6. Mint a restudy visit (R2-40 — a §9-fenced txn, day ≤ csd)
// ---------------------------------------------------------------------------

const reviewV2MintVisit = onCall({enforceAppCheck: false}, async (request) => {
  const db = getDb();
  const uid = requireAuth(request);
  const d = request.data ?? {};
  requireStrings(d, ["classId", "listId"]);
  if (!Number.isInteger(d.day) || d.day < 1) {
    throw new HttpsError("invalid-argument", "day must be an integer ≥ 1");
  }
  const gate = await resolveAndGate(db, {
    uid, classId: d.classId, listId: d.listId,
    clientContractVersion: d.clientContractVersion,
  });
  if (gate.refusal) return gate.refusal;
  const epoch = await deriveEpoch(db, uid, d.listId);
  if (epoch.refusal) return epoch.refusal;
  return mintRestudyVisit(db, {
    uid, classId: d.classId, listId: d.listId, day: d.day,
    resetEpoch: epoch.resetEpoch,
    clientContractVersion: d.clientContractVersion,
  });
});

// ---------------------------------------------------------------------------
// 7. The evaluator (ADMIN-ONLY — ops surface, R2-18 signals)
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
  reviewV2ComposeNewTest,
  reviewV2ComposeRerun,
  reviewV2SubmitAttempt,
  reviewV2CompleteDay,
  reviewV2MintVisit,
  reviewV2EvaluateThresholds,
};
