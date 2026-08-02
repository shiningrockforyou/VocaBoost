/**
 * ============================================================================
 * DEEPFIX2 · DF2-10 workpackage — COMPLETION: the exactly-once day CAS +
 * GRADUATION + STREAK (H6 §3b + §10 + R2-21/29/38/39/41)
 * ============================================================================
 * Built FROM the frozen contracts (stage-1 frozen 2026-08-02, r69). Sources:
 * 15_H6 §3b (the class-agnostic completion record + CAS + evidenceKind matrix
 * [r55/r56] + bindings [r57] + provenance [r62p]), §1/§10 (reviewRestingUntil
 * LIVE-ONLY — born HERE, in the graduation txn; graduatedWordIds = the audit
 * twin), §9 (reset fence), 11_ R2-29/r49-B1 (the graduation formula,
 * unit-normalized), R2-41(c/e) (rerun graduation tested-correct-only;
 * queueSize_effective = the pinned queue AFTER top-up [r53]), R2-38 (source-
 * posture evidence validity), R2-39 (zero-new-words day), R2-21/r51-H1 (the
 * frozen streak semantics), DF2-10(8/9) (graduation + streak build home).
 *
 * DARK BY CONSTRUCTION: no caller until the index.js wiring (step 7).
 *
 * THE LAWS ENCODED HERE
 *  - THE CAS: docId `{listId}_d{logicalDay}_e{resetEpoch}` is CLASS-AGNOSTIC
 *    (R2-36/38 — one advance + one graduation per shared logical day). The
 *    winner `create()`s; a concurrent loser fails and receives
 *    `already_completed` + the EXISTING record (the client re-runs NOTHING
 *    [A2/r53]).
 *  - EVIDENCE MATRIX [r55/r56, encoded EXACTLY]: (consumed∧newTest) standard ·
 *    (¬newTest∧consumed) list_end_review_only · (¬consumed∧newTest∧gateOFF)
 *    gate_off_autopass · (¬consumed∧newTest∧gateON∧day==1) first_day_new_only ·
 *    (bothNull∧gateOFF∧day>1) gate_off_list_end · anything else REFUSED
 *    (`no_evidence` — the both-tests law). Every gate_off_* kind requires
 *    `sourceConfig.gateEffectiveEnabled === false` (binding, r57).
 *  - PROVENANCE [r62p]: sourceConfig = the SOURCE class's CONFIGURED values —
 *    source = the consumed attempt's class, else the completing class. Queue
 *    CONTENT truth stays on the queueRef's snapshot; they may differ on a
 *    same-day reuse by design.
 *  - GRADUATION [R2-29, r49-B1, r53]: on the day's PASSING consumed review
 *    attempt only. scoreFraction = clamp(scorePercent,0,100)/100;
 *    queueSize_effective = |the pinned queue| (post-top-up);
 *    graduationCount = min(floor(qe × sf), |correct| + |eligibleFill|);
 *    fill-eligible = fc===0 ∨ lp≥lf (b1-expected-labels:170, tie ⇒ eligible)
 *    over UNPRESENTED queue words; graduated set = tested-correct then fill,
 *    both in QUEUE ORDER (the canonical deterministic pick — flagged for
 *    checkpoint review); both terms published. Malformed score ⇒ invalid, no
 *    graduation, evidence refused.
 *  - PRIVILEGE REQUIRES ON [derived — R2-32's proven-freeze + A1's zero-
 *    graduation override pattern; checkpoint-review flagged]: graduation
 *    mints rest (protected state), so an OFF-source consumed attempt
 *    advances the day but graduates ZERO. Kinds with no consumed attempt
 *    graduate zero by construction.
 *  - RESTING [§1 LIVE-ONLY]: `reviewRestingUntil` = completedAt + 21d,
 *    written HERE in the same txn, gated on `config.stampingEligible`
 *    (R2-48 — a dark-window completion advances but mints no rest);
 *    `completedAt` = Timestamp.fromMillis(now) so record and rest are EXACT
 *    twins (rru − 21d ≡ completedAt, auditable).
 *  - STREAK [R2-21/r51-H1 FROZEN]: docId = the KST calendar date (UTC+9,
 *    DST-free) ⇒ ≤1 credit/date idempotent BY CONSTRUCTION; written in THIS
 *    txn only when the CAS wins; same-date multi-advance leaves the first
 *    credit; weekday-gap/weekend laws are READ-time computations (not here);
 *    epoch-scoped (reset deletes credits). Progression-based ⇒ posture-
 *    independent (every valid advance credits).
 *  - BOUNDARY LEGS (flip-week honesty, header-flagged): a consumed LEGACY
 *    attempt (no presentationId) derives its presented set from its own
 *    answer rows; an absent day-queue (never composed pre-flip) sets
 *    qe = |presented| with NO fill.
 *  - LEGACY EVIDENCE IS READ, NEVER REWRITTEN: consumed/new attempts are
 *    verified in-txn ({studentId, listId, passed:true, review-typed,
 *    non-retest}) and recorded by id (r48: "audit records the consumed
 *    attempt + source config").
 *
 * TYPED RESULT STATUSES — success: `completed` (the CAS won) |
 * `already_completed` (frozen, §8 — carries the existing record). Refusals:
 * `no_evidence` (frozen, DF2-10(4) — matrix refusal or failed evidence
 * verification; carries `reason`) · `config_hold` · `reset_in_progress` ·
 * `reset_epoch_mismatch` (established composer names).
 */

"use strict";

const crypto = require("crypto");
const {Timestamp} = require("firebase-admin/firestore");
const {resolveReviewConfig} = require("./config");
const {queueDocId, effectiveResetEpoch, resetLockActive} = require("./composer");

/** The 21-day rest (10_ §2.5 — graduated ⇒ 21-day rest ⇒ returns forever). */
const REST_DAYS = 21;
const DAY_MS = 86400000;
const STUDY_STATE_READ_CHUNK = 300;

/** KST calendar date (UTC+9, no DST) — the frozen streak basis [R2-21]. */
function kstDateString(ms) {
  return new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
}

/** `graduatedWordIdsHash` — THE frozen formula [r57]. */
function computeGraduatedHash(graduatedWordIds) {
  return crypto.createHash("sha256")
    .update(JSON.stringify(graduatedWordIds))
    .digest("hex");
}

/** THE fill-eligibility predicate (§10 labels; b1-expected-labels.mjs:170 —
 *  byte-matched; tie lp===lf ⇒ ELIGIBLE [FF2-11]). ms|null inputs. */
function fillEligible({fc, lpMs, lfMs}) {
  return fc === 0 || (lpMs !== null && lpMs >= lfMs);
}

/**
 * The evidenceKind matrix [r55/r56] — EXACTLY the enumerated shapes.
 * @returns {string|null} the kind, or null = REFUSED (the both-tests law).
 */
function evidenceKindFor({hasConsumed, hasNewTest, gateOn, logicalDay}) {
  if (hasConsumed && hasNewTest) return "standard";
  if (hasConsumed && !hasNewTest) return "list_end_review_only";
  if (!hasConsumed && hasNewTest && !gateOn) return "gate_off_autopass";
  if (!hasConsumed && hasNewTest && gateOn && logicalDay === 1) return "first_day_new_only";
  if (!hasConsumed && !hasNewTest && !gateOn && logicalDay > 1) return "gate_off_list_end";
  return null;
}

/**
 * GRADUATION (pure — fixture-facing). Live = the full R2-29 formula; rerun =
 * tested-correct only, no fill [R2-41(c)]. The caller gates on PASSING.
 *
 * @param {{mode: "live"|"rerun", rows: Array<{wordId: string,
 *   isCorrect: boolean}>, scorePercent?: number,
 *   orderedQueueWordIds?: string[], presentedWordIds?: string[],
 *   labelsByWordId?: Object<string, {fc: number, lpMs: number|null,
 *   lfMs: number|null}>}} input — live mode requires the last four; labels
 *   cover the UNPRESENTED queue words (server truth, §10).
 * @returns {{graduationCount: number, graduatedWordIds: string[],
 *   correctCount: number, eligibleFillCount: number, invalidScore: boolean}}
 */
function computeGraduation(input) {
  const {mode, rows} = input;
  const correctIds = rows.filter((r) => r.isCorrect === true).map((r) => r.wordId);
  if (mode === "rerun") {
    // A rerun graduates exactly what it proves — tested-correct, no fill.
    return {
      graduationCount: correctIds.length,
      graduatedWordIds: correctIds,
      correctCount: correctIds.length,
      eligibleFillCount: 0,
      invalidScore: false,
    };
  }
  const {scorePercent, orderedQueueWordIds, presentedWordIds, labelsByWordId} = input;
  if (typeof scorePercent !== "number" || !Number.isFinite(scorePercent)) {
    // Malformed/missing score ⇒ attempt invalid, no graduation (frozen vector).
    return {graduationCount: 0, graduatedWordIds: [], correctCount: 0,
      eligibleFillCount: 0, invalidScore: true};
  }
  const scoreFraction = Math.min(100, Math.max(0, scorePercent)) / 100; // r49-B1
  const qe = orderedQueueWordIds.length; // post-top-up pinned length [r53]
  const presented = new Set(presentedWordIds);
  const correctSet = new Set(correctIds);
  // Fill candidates: fill-eligible UNPRESENTED queue words, QUEUE order.
  const fillIds = orderedQueueWordIds.filter((id) => {
    if (presented.has(id)) return false;
    const l = labelsByWordId[id];
    return fillEligible(l ?? {fc: 0, lpMs: null, lfMs: null});
  });
  const graduationCount = Math.min(
      Math.floor(qe * scoreFraction),
      correctIds.length + fillIds.length);
  // Graduated set: tested-correct in QUEUE order, then fill in QUEUE order.
  const correctInQueueOrder = orderedQueueWordIds.filter((id) => correctSet.has(id));
  const graduatedWordIds = [...correctInQueueOrder, ...fillIds].slice(0, graduationCount);
  return {
    graduationCount,
    graduatedWordIds,
    correctCount: correctIds.length,
    eligibleFillCount: fillIds.length,
    invalidScore: false,
  };
}

/**
 * Complete ONE shared logical day — the §3b exactly-once transaction.
 * Owns its own runTransaction.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid: string, winningClassId: string, listId: string,
 *   logicalDay: number, resetEpoch: number, anchorNwei: number,
 *   generation: *, consumedAttemptId: string|null,
 *   consumedAttemptClassId: string|null, newTestAttemptId: string|null,
 *   nowMs?: number}} params — BINDING [r57]: consumedAttemptClassId is null
 *   IFF consumedAttemptId is null (asserted).
 * @returns {Promise<object>} typed per the header. `completed` carries
 *   {evidenceKind, graduationCount, graduatedWordIds, correctCount,
 *   eligibleFillCount, streakCredited, completionId, sourceConfig}.
 */
async function completeDay(db, params) {
  const {uid, winningClassId, listId, logicalDay, resetEpoch,
    anchorNwei, generation, consumedAttemptId, consumedAttemptClassId,
    newTestAttemptId} = params;
  const s = (v) => typeof v === "string" && v.length > 0;
  if (!s(uid) || !s(winningClassId) || !s(listId)) {
    throw new TypeError("completeDay: uid/winningClassId/listId required");
  }
  if (!Number.isInteger(logicalDay) || logicalDay < 1 ||
      !Number.isInteger(resetEpoch) || resetEpoch < 0 ||
      !Number.isInteger(anchorNwei) || generation === undefined) {
    throw new TypeError("completeDay: logicalDay/resetEpoch/anchorNwei/generation malformed");
  }
  if ((consumedAttemptId === null) !== (consumedAttemptClassId === null)) {
    throw new TypeError("completeDay: consumedAttemptClassId null IFF consumedAttemptId null [r57]");
  }
  if (consumedAttemptId !== null && (!s(consumedAttemptId) || !s(consumedAttemptClassId))) {
    throw new TypeError("completeDay: consumed ids must be non-empty strings or null");
  }
  if (newTestAttemptId !== null && !s(newTestAttemptId)) {
    throw new TypeError("completeDay: newTestAttemptId must be a non-empty string or null");
  }
  const nowMs = Number.isFinite(params.nowMs) ? params.nowMs : Date.now();

  const completionId = `${listId}_d${logicalDay}_e${resetEpoch}`;
  const completionRef = db.doc(`users/${uid}/day_completions/${completionId}`);
  const pmRef = db.doc(`users/${uid}/progress_meta/${listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${listId}`);
  const sourceClassId = consumedAttemptClassId ?? winningClassId;

  return db.runTransaction(async (txn) => {
    // ---- READS -----------------------------------------------------------
    const config = await resolveReviewConfig(db, {classId: sourceClassId, listId, txn});
    const [pmSnap, lpSnap, doneSnap] = await txn.getAll(pmRef, lpRef, completionRef);

    if (config.readStatus === "hold") {
      return {status: "config_hold", holdReason: config.holdReason};
    }
    // The CAS loser path precedes the write fence (read-only, §8).
    if (doneSnap.exists) {
      return {status: "already_completed", completionId, completion: doneSnap.data()};
    }
    const pmData = pmSnap.exists ? pmSnap.data() : null;
    const lpData = lpSnap.exists ? lpSnap.data() : null;
    if (resetLockActive(pmData, lpData)) return {status: "reset_in_progress"};
    const currentEpoch = effectiveResetEpoch(pmData, lpData);
    if (currentEpoch !== resetEpoch) return {status: "reset_epoch_mismatch", currentEpoch};

    // ---- EVIDENCE KIND (the frozen matrix, SOURCE posture) ---------------
    const gateOn = config.gateEffectiveEnabled === true;
    const evidenceKind = evidenceKindFor({
      hasConsumed: consumedAttemptId !== null,
      hasNewTest: newTestAttemptId !== null,
      gateOn,
      logicalDay,
    });
    if (evidenceKind === null) {
      return {status: "no_evidence", reason: "evidence shape not enumerated (both-tests law)"};
    }

    // ---- EVIDENCE VERIFICATION (in-txn server truth) ---------------------
    let consumed = null;
    if (consumedAttemptId !== null) {
      const aSnap = await txn.get(db.collection("attempts").doc(consumedAttemptId));
      if (!aSnap.exists) return {status: "no_evidence", reason: "consumed attempt missing"};
      consumed = aSnap.data();
      if (consumed.studentId !== uid || consumed.listId !== listId) {
        return {status: "no_evidence", reason: "consumed attempt identity mismatch"};
      }
      if (consumed.sessionType !== "review" || consumed.type === "retest") {
        return {status: "no_evidence", reason: "consumed attempt not a live review"};
      }
      if (consumed.passed !== true) {
        return {status: "no_evidence", reason: "consumed attempt not passing"};
      }
      if (consumed.classId !== consumedAttemptClassId) {
        return {status: "no_evidence", reason: "consumed attempt class mismatch"};
      }
    }
    if (newTestAttemptId !== null) {
      const nSnap = await txn.get(db.collection("attempts").doc(newTestAttemptId));
      if (!nSnap.exists) return {status: "no_evidence", reason: "new-test attempt missing"};
      const nt = nSnap.data();
      if (nt.studentId !== uid || nt.listId !== listId || nt.passed !== true) {
        return {status: "no_evidence", reason: "new-test attempt invalid"};
      }
    }

    // ---- GRADUATION (live formula; SOURCE must be gate-ON) ---------------
    let grad = {graduationCount: 0, graduatedWordIds: [],
      correctCount: 0, eligibleFillCount: 0, invalidScore: false};
    if (consumed !== null && gateOn) {
      const rows = Array.isArray(consumed.answers)
        ? consumed.answers
            .filter((r) => r && typeof r.wordId === "string")
            .map((r) => ({wordId: r.wordId, isCorrect: r.isCorrect === true}))
        : [];
      // The pinned queue of the SOURCE class (boundary: absent pre-flip).
      const qSnap = await txn.get(db.doc(
          `users/${uid}/review_queues/${queueDocId(consumedAttemptClassId, listId, logicalDay, resetEpoch)}`));
      const queueIds = qSnap.exists ? qSnap.data().orderedQueueWordIds : null;
      // Presented set: the presentation record, else the legacy attempt's
      // own rows (boundary leg — header).
      let presentedWordIds = rows.map((r) => r.wordId);
      if (typeof consumed.presentationId === "string" && consumed.presentationId.length > 0) {
        const pSnap = await txn.get(db.doc(
            `users/${uid}/review_presentations/${consumed.presentationId}`));
        if (pSnap.exists && Array.isArray(pSnap.data().presentedWordIds)) {
          presentedWordIds = pSnap.data().presentedWordIds;
        }
      }
      const orderedQueueWordIds = queueIds ?? presentedWordIds;
      // Labels for UNPRESENTED queue words only (the fill inputs, §10).
      const presentedSet = new Set(presentedWordIds);
      const unpresented = orderedQueueWordIds.filter((id) => !presentedSet.has(id));
      const labelsByWordId = {};
      for (let i = 0; i < unpresented.length; i += STUDY_STATE_READ_CHUNK) {
        const chunk = unpresented.slice(i, i + STUDY_STATE_READ_CHUNK);
        const snaps = await txn.getAll(
            ...chunk.map((w) => db.doc(`users/${uid}/study_states/${w}`)));
        snaps.forEach((sn, j) => {
          const d = sn.exists ? sn.data() : {};
          const ms = (t) => (t && typeof t.toMillis === "function") ? t.toMillis() : null;
          labelsByWordId[chunk[j]] = {
            fc: Number.isInteger(d.reviewFailCount) && d.reviewFailCount > 0 ? d.reviewFailCount : 0,
            lpMs: ms(d.reviewLastProvenAt),
            lfMs: ms(d.reviewLastFailedAt),
          };
        });
      }
      grad = computeGraduation({
        mode: "live", rows,
        scorePercent: consumed.score,
        orderedQueueWordIds, presentedWordIds, labelsByWordId,
      });
      if (grad.invalidScore) {
        return {status: "no_evidence", reason: "consumed attempt score malformed"};
      }
    }

    // ---- STREAK read (same-txn, before writes) ---------------------------
    const kstDate = kstDateString(nowMs);
    const creditRef = db.doc(`users/${uid}/streak_credits/${kstDate}`);
    const creditSnap = await txn.get(creditRef);

    // ---- WRITES ----------------------------------------------------------
    const completedAt = Timestamp.fromMillis(nowMs);
    const sourceConfig = {
      threshold: config.threshold,
      queueSize: config.queueSize,
      testSize: config.testSize,
      configVersion: config.configVersion,
      reviewGateEnabled: config.assignmentGateEnabled,
      gateEffectiveEnabled: config.gateEffectiveEnabled,
    };
    const completion = {
      uid, listId, logicalDay, resetEpoch, anchorNwei, generation,
      winningClassId,
      evidenceKind,
      consumedAttemptId, consumedAttemptClassId,
      sourceConfig,
      newTestAttemptId,
      graduationCount: grad.graduationCount,
      graduatedWordIds: grad.graduatedWordIds,
      graduatedWordIdsHash: computeGraduatedHash(grad.graduatedWordIds),
      completedAt,
    };
    txn.create(completionRef, completion);

    // Rest mints ONLY for eligible writers (R2-48) — the audit twin
    // (graduatedWordIds) records the graduation either way.
    if (config.stampingEligible === true && grad.graduatedWordIds.length > 0) {
      const restingUntil = Timestamp.fromMillis(nowMs + REST_DAYS * DAY_MS);
      for (const id of grad.graduatedWordIds) {
        txn.set(db.doc(`users/${uid}/study_states/${id}`),
            {reviewRestingUntil: restingUntil}, {merge: true});
      }
    }

    let streakCredited = false;
    if (!creditSnap.exists) {
      txn.create(creditRef, {
        classId: winningClassId, listId, dayNumber: logicalDay,
        resetEpoch, createdAt: completedAt,
      });
      streakCredited = true;
    }

    return {
      status: "completed",
      completionId,
      evidenceKind,
      graduationCount: grad.graduationCount,
      graduatedWordIds: grad.graduatedWordIds,
      correctCount: grad.correctCount,
      eligibleFillCount: grad.eligibleFillCount,
      streakCredited,
      sourceConfig,
      config,
    };
  });
}

/**
 * Rerun graduation [R2-41(c)] — applied INSIDE the passing rerun-review
 * attempt txn (reruns never write day_completions; non-advancing). Rest
 * mints under the SAME eligibility + ON-posture laws as live graduation.
 *
 * @returns {{graduated: string[], skipped: string|null}}
 */
function graduateRerunInTxn(txn, db, {uid, config, rows, nowMs}) {
  if (!config || config.readStatus !== "ok") {
    throw new Error("graduateRerunInTxn: config snapshot missing or on hold");
  }
  if (config.stampingEligible !== true) return {graduated: [], skipped: "not_eligible"};
  if (config.gateEffectiveEnabled !== true) return {graduated: [], skipped: "gate_off"};
  const grad = computeGraduation({mode: "rerun", rows});
  const restingUntil = Timestamp.fromMillis(nowMs + REST_DAYS * DAY_MS);
  for (const id of grad.graduatedWordIds) {
    txn.set(db.doc(`users/${uid}/study_states/${id}`),
        {reviewRestingUntil: restingUntil}, {merge: true});
  }
  return {graduated: grad.graduatedWordIds, skipped: null};
}

module.exports = {
  completeDay,
  graduateRerunInTxn,
  // Pure/fixture-facing surface:
  computeGraduation,
  evidenceKindFor,
  fillEligible,
  kstDateString,
  computeGraduatedHash,
  REST_DAYS,
};
