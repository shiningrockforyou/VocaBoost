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
const {effectiveResetEpoch, resetLockActive} = require("./composer");

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
  const formulaCount = Math.min(
      Math.floor(qe * scoreFraction),
      correctIds.length + fillIds.length);
  // Graduated set: tested-correct in QUEUE order, then fill in QUEUE order.
  const correctInQueueOrder = orderedQueueWordIds.filter((id) => correctSet.has(id));
  const graduatedWordIds = [...correctInQueueOrder, ...fillIds].slice(0, formulaCount);
  // SELF-CONSISTENCY [r70 M-5/C1]: the published count IS the emitted set's
  // size — the hash can never describe a different set than the count. A
  // correct row outside the queue (drift-guarded upstream) shrinks the set,
  // never inflates the count.
  return {
    graduationCount: graduatedWordIds.length,
    formulaCount,
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
 * r70 FOLD (C1 — the double-NO's first blocker): evidence is BOUND
 * (day/epoch/type + presentation claim + queue tuple vs the txn-derived
 * truth tuple), the r48 impossible-record fence runs before any privilege,
 * the GOVERNING posture is the consumed attempt's stored gatePosture
 * (attempt-time governs through completion — completion-time re-resolution
 * was the OFF→ON laundering hole; legacy stamps take the named published
 * boundary rule), and THE CANONICAL ADVANCE (csd/twi on the durable
 * progress ref, completeSession's exact law) happens IN THIS TXN — one
 * advance + one graduation per logical day, atomically; the CAS loser runs
 * none of it. `anchorNwei`/`generation` are txn-derived (progress.js),
 * never caller-supplied.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid: string, winningClassId: string, listId: string,
 *   logicalDay: number, resetEpoch: number, consumedAttemptId: string|null,
 *   consumedAttemptClassId: string|null, newTestAttemptId: string|null,
 *   clientContractVersion?: *, nowMs?: number}} params — BINDING [r57]:
 *   consumedAttemptClassId is null IFF consumedAttemptId is null (asserted).
 * @returns {Promise<object>} typed per the header. `completed` carries
 *   {completion, evidenceKind, graduationCount, graduatedWordIds,
 *   correctCount, eligibleFillCount, streakCredited, advancedToDay, newTwi,
 *   sourceConfig}.
 */
async function completeDay(db, params) {
  const {uid, winningClassId, listId, logicalDay, resetEpoch,
    consumedAttemptId, consumedAttemptClassId, newTestAttemptId} = params;
  const s = (v) => typeof v === "string" && v.length > 0;
  if (!s(uid) || !s(winningClassId) || !s(listId)) {
    throw new TypeError("completeDay: uid/winningClassId/listId required");
  }
  if (!Number.isInteger(logicalDay) || logicalDay < 1 ||
      !Number.isInteger(resetEpoch) || resetEpoch < 0) {
    throw new TypeError("completeDay: logicalDay/resetEpoch malformed");
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
  const {readProgressTruthInTxn} = require("./progress");
  const {assertServableInTxn} = require("./config");
  const foundation = require("../foundation");

  const completionId = `${listId}_d${logicalDay}_e${resetEpoch}`;
  const completionRef = db.doc(`users/${uid}/day_completions/${completionId}`);
  const pmRef = db.doc(`users/${uid}/progress_meta/${listId}`);
  const lpRef = db.doc(`users/${uid}/list_progress/${listId}`);
  const sourceClassId = consumedAttemptClassId ?? winningClassId;

  return db.runTransaction(async (txn) => {
    // ---- READS -----------------------------------------------------------
    // Serving authority = the WINNING (calling) class; matrix/source posture
    // = the SOURCE class (r62p provenance). One resolve when they coincide.
    const servingConfig = await resolveReviewConfig(db, {classId: winningClassId, listId, uid, txn});
    const sourceConfig0 = sourceClassId === winningClassId
      ? servingConfig
      : await resolveReviewConfig(db, {classId: sourceClassId, listId, txn}); // source posture only — authorization binds on the SERVING class
    const truth = await readProgressTruthInTxn(txn, db, {uid, classId: winningClassId, listId});
    const [pmSnap, lpSnap, doneSnap] = await txn.getAll(pmRef, lpRef, completionRef);

    const refusal = assertServableInTxn(servingConfig, params.clientContractVersion);
    if (refusal) return refusal;
    if (sourceConfig0.readStatus === "hold") {
      return {status: "config_hold", holdReason: sourceConfig0.holdReason};
    }
    const pmData = pmSnap.exists ? pmSnap.data() : null;
    const lpData = lpSnap.exists ? lpSnap.data() : null;
    // The CAS loser path: read-only when the caller's view is current (§8).
    // H-B VIEW CATCH-UP [r72 — PROPOSED law, David ratification pending,
    // 15_ §3b note]: pre-P5 the durable progress doc is CLASS-scoped, so a
    // dual-enrolled student's SECOND class would strand forever on
    // `already_completed` with no advance. When the shared day is already
    // completed and THIS class's view sits exactly one day behind, the loser
    // txn syncs the view (csd/twi only — NO graduation, NO rest, NO streak:
    // the shared day advanced ONCE; this is view reconciliation, r48's
    // "a valid cross-class pass satisfies the shared logical day").
    if (doneSnap.exists) {
      const done = doneSnap.data();
      if (truth.csd === logicalDay - 1) {
        if (resetLockActive(pmData, lpData)) return {status: "reset_in_progress"};
        const currentEpoch0 = effectiveResetEpoch(pmData, lpData);
        if (currentEpoch0 !== resetEpoch) return {status: "reset_epoch_mismatch", currentEpoch: currentEpoch0};
        // [R2-51 RATIFIED, David 2026-08-03] the catch-up COPIES the winner's
        // absolute post-advance twi (completedTwi) — never re-derives; a
        // legacy record without it falls back to the relative derivation.
        const wi = Number.isInteger(done.wordsIntroduced) ? done.wordsIntroduced : 0;
        const cap = Number.isInteger(params.canonicalWordCount) && params.canonicalWordCount > 0
          ? params.canonicalWordCount : Infinity;
        const viewAdvance = {
          currentStudyDay: logicalDay,
          totalWordsIntroduced: Number.isInteger(done.completedTwi)
            ? done.completedTwi
            : Math.min(truth.twi + wi, cap),
          lastStudyDate: Timestamp.fromMillis(nowMs), // [r74 L-1] winner parity
          lastSessionAt: Timestamp.fromMillis(nowMs),
          updatedAt: Timestamp.fromMillis(nowMs),
        };
        if (truth.progressSnap.exists) {
          txn.update(truth.progressRef, viewAdvance);
        } else {
          txn.set(truth.progressRef, {
            ...foundation.defaultProgressShape(winningClassId, listId),
            ...viewAdvance,
            programStartDate: foundation.mondayOfWeekTimestamp(),
            createdAt: Timestamp.fromMillis(nowMs),
          });
        }
        return {status: "already_completed", completionId, completion: done, viewAdvanced: true};
      }
      return {status: "already_completed", completionId, completion: done};
    }
    if (resetLockActive(pmData, lpData)) return {status: "reset_in_progress"};
    const currentEpoch = effectiveResetEpoch(pmData, lpData);
    if (currentEpoch !== resetEpoch) return {status: "reset_epoch_mismatch", currentEpoch};

    // ---- FRONTIER AUTHORITY [r70 C1]: the day IS the server's frontier ---
    if (logicalDay !== truth.frontierDay) {
      return {status: "day_guard_rejected", expectedDay: truth.frontierDay};
    }
    const {anchorNwei, generation} = truth;

    // ---- EVIDENCE VERIFICATION (in-txn server truth) [r70 C1] ------------
    let consumed = null;
    let consumedIsEngine = false; // [r76 ROW 1a] THE discriminator, outer-scoped
    let consumedPresentation = null;
    let consumedQueue = null;
    let legacyEvidence = false; // published boundary flag (flip-week legs)
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
      // DAY BINDING [BL-1/C1 — r48: the shared day matches on
      // {uid,listId,logicalDay,resetEpoch,anchor/generation}].
      if (consumed.studyDay !== logicalDay) {
        return {status: "no_evidence", reason: "consumed attempt day mismatch"};
      }
      // EPOCH BINDING + THE DISCRIMINATOR [r77 A1 — computed HERE so the row
      // fence below can branch on it]: `resetEpoch` presence is the ONE
      // engine/legacy discriminator (engine writers always stamp it).
      consumedIsEngine = consumed.resetEpoch !== undefined && consumed.resetEpoch !== null;
      if (consumedIsEngine) {
        if (consumed.resetEpoch !== resetEpoch) {
          return {status: "no_evidence", reason: "consumed attempt epoch mismatch"};
        }
      } else {
        legacyEvidence = true;
      }
      // THE r48 IMPOSSIBLE-RECORD VALIDITY FENCE — TWO-LEGGED [r77 ROW A,
      // Codex r76 #1: the r76 premise that legacy writers derive
      // `totalQuestions` FROM the rows they store is FALSE. VERIFIED live:
      // src/pages/MCQTest.jsx:685/699 sends totalQuestions = testWords.length
      // (the FULL test) while the answer array holds ANSWERED entries only,
      // and functions/index.js:429-434 stores answers=partial,
      // totalQuestions=full, skipped=the difference. A legitimate legacy
      // review WITH SKIPS (e.g. 28 rows / tq 30 / score 93) must therefore be
      // ACCEPTED — rejecting it would strand any student who skipped a
      // question during the flip window.]
      //
      // COMMON (both legs): integer score 0-100 · integer denominator ≥ 1 ·
      // answers an array · 0 < rows ≤ denominator · the score recomputes
      // against the FULL denominator (which is exactly how both writers
      // computed it).
      const tq = consumed.totalQuestions;
      const rowsArr = Array.isArray(consumed.answers) ? consumed.answers : null;
      if (!Number.isInteger(consumed.score) ||
          consumed.score < 0 || consumed.score > 100 ||
          !Number.isInteger(tq) || tq < 1 ||
          rowsArr === null || rowsArr.length < 1 || rowsArr.length > tq) {
        return {status: "no_evidence", reason: "impossible_record"};
      }
      // ENGINE ONLY: the COMPLETE-ROWS law (15_ §1) — the engine writer
      // records ONE row per presented word, blanks explicit, so a short row
      // set is an impossible ENGINE record.
      if (consumedIsEngine && rowsArr.length !== tq) {
        return {status: "no_evidence", reason: "impossible_record (engine rows incomplete)"};
      }
      const storedCorrect = rowsArr.filter((r) => r?.isCorrect === true).length;
      if (Math.round((storedCorrect / tq) * 100) !== consumed.score) {
        return {status: "no_evidence", reason: "impossible_record (score-rows disagreement)"};
      }
      // LEGACY ONLY: when the writer recorded `skipped`, it must agree with
      // the row shortfall (both live writers store exactly that difference).
      // [r77 precision note, closed opportunistically]: a PRESENT `skipped`
      // must be an integer AND equal the row shortfall — present-but-malformed
      // refuses, matching this program's posture everywhere else. Absent
      // (undefined/null) stays legitimate legacy metadata.
      if (!consumedIsEngine && consumed.skipped !== undefined && consumed.skipped !== null &&
          (!Number.isInteger(consumed.skipped) || consumed.skipped !== tq - rowsArr.length)) {
        return {status: "no_evidence", reason: "impossible_record (skipped field inconsistent)"};
      }
      // THE ENGINE/LEGACY DISCRIMINATOR [r74 N-5 — ONE field, BOTH halves]:
      // `resetEpoch` presence. Engine writers always stamp it; legacy
      // attempts never did. An epoch-carrying (engine) consumed attempt
      // REQUIRES its claimed presentation + canonical queue binding [r72
      // C1]; only an epoch-less attempt takes the published legacy leg.
      if (consumedIsEngine &&
          (typeof consumed.presentationId !== "string" || consumed.presentationId.length === 0)) {
        return {status: "no_evidence", reason: "engine review attempt lacks presentation"};
      }
      if (typeof consumed.presentationId === "string" && consumed.presentationId.length > 0) {
        const pSnap = await txn.get(db.doc(
            `users/${uid}/review_presentations/${consumed.presentationId}`));
        if (!pSnap.exists) return {status: "no_evidence", reason: "presentation missing"};
        consumedPresentation = pSnap.data();
        if (consumedPresentation.uid !== uid ||
            consumedPresentation.listId !== listId ||
            consumedPresentation.classId !== consumedAttemptClassId ||
            consumedPresentation.logicalDay !== logicalDay ||
            consumedPresentation.resetEpoch !== resetEpoch) {
          return {status: "no_evidence", reason: "presentation binding mismatch"};
        }
        const claimed = consumedPresentation.serverClaim?.attemptDocId ?? null;
        if (claimed !== consumedAttemptId) {
          return {status: "no_evidence", reason: "presentation claimed by another attempt"};
        }
        if (typeof consumedPresentation.queueRef !== "string" || consumedPresentation.queueRef.length === 0) {
          return {status: "no_evidence", reason: "presentation lacks queue binding"};
        }
        const expectedQueuePath =
          `users/${uid}/review_queues/${consumedAttemptClassId}_${listId}_d${logicalDay}_e${resetEpoch}`;
        if (consumedPresentation.queueRef !== expectedQueuePath) {
          return {status: "no_evidence", reason: "queue path non-canonical"};
        }
        const qSnap = await txn.get(db.doc(consumedPresentation.queueRef));
        if (!qSnap.exists) return {status: "no_evidence", reason: "queue missing for presentation"};
        consumedQueue = qSnap.data();
        if (consumedQueue.uid !== uid || consumedQueue.classId !== consumedAttemptClassId ||
            consumedQueue.listId !== listId || consumedQueue.logicalDay !== logicalDay ||
            consumedQueue.resetEpoch !== resetEpoch) {
          return {status: "no_evidence", reason: "queue identity mismatch"};
        }
        if (consumedQueue.poolHash !== consumedPresentation.poolHash) {
          return {status: "no_evidence", reason: "queue/presentation pool-hash mismatch"};
        }
        // THE r48 CROSS-CLASS TUPLE MATCH: the evidence queue's tuple must
        // equal THIS day's derived truth tuple.
        if (consumedQueue.anchorNwei !== anchorNwei || consumedQueue.generation !== generation) {
          return {status: "no_evidence", reason: "anchor tuple mismatch"};
        }
      } else {
        legacyEvidence = true;
      }
    }
    let newTest = null;
    let newTestPresentation = null;
    if (newTestAttemptId !== null) {
      const nSnap = await txn.get(db.collection("attempts").doc(newTestAttemptId));
      if (!nSnap.exists) return {status: "no_evidence", reason: "new-test attempt missing"};
      newTest = nSnap.data();
      if (newTest.studentId !== uid || newTest.listId !== listId || newTest.passed !== true) {
        return {status: "no_evidence", reason: "new-test attempt invalid"};
      }
      // TYPE + DAY + EPOCH BINDING [BL-1/C1 — a rerun or wrong-day record
      // never satisfies the new-half].
      if (newTest.sessionType !== "new" || newTest.type === "retest") {
        return {status: "no_evidence", reason: "new-test attempt not a live new test"};
      }
      if (newTest.studyDay !== logicalDay) {
        return {status: "no_evidence", reason: "new-test attempt day mismatch"};
      }
      if (newTest.resetEpoch !== undefined && newTest.resetEpoch !== null) {
        if (newTest.resetEpoch !== resetEpoch) {
          return {status: "no_evidence", reason: "new-test attempt epoch mismatch"};
        }
        // [r72 C1] ENGINE new evidence binds to ITS server presentation —
        // the twi advance derives from the SERVER-composed presented count,
        // never a client-shaped range.
        if (typeof newTest.presentationId !== "string" || newTest.presentationId.length === 0) {
          return {status: "no_evidence", reason: "engine new-test lacks presentation"};
        }
        const npSnap = await txn.get(db.doc(
            `users/${uid}/review_presentations/${newTest.presentationId}`));
        if (!npSnap.exists) return {status: "no_evidence", reason: "new-test presentation missing"};
        newTestPresentation = npSnap.data();
        if (newTestPresentation.uid !== uid || newTestPresentation.listId !== listId ||
            newTestPresentation.logicalDay !== logicalDay ||
            newTestPresentation.resetEpoch !== resetEpoch ||
            newTestPresentation.requestFingerprint?.sessionType !== "new" ||
            newTestPresentation.requestFingerprint?.kind !== "live") {
          return {status: "no_evidence", reason: "new-test presentation binding mismatch"};
        }
        if ((newTestPresentation.serverClaim?.attemptDocId ?? null) !== newTestAttemptId) {
          return {status: "no_evidence", reason: "new-test presentation claimed by another attempt"};
        }
        // [r75 — N-12/Codex-2 HOISTED: the fences below govern the ENGINE
        // (epoch-carrying) leg ONLY. Legacy epoch-less new attempts keep
        // identity/day/pass checks alone, per 17_ §6 — the legacy MCQ writer
        // stored answered-rows-only against a totalQuestions that could
        // include skips, so rows/score arithmetic is engine-only BY
        // DECISION (published).]
        const ntq = newTest.totalQuestions;
        const ntRows = Array.isArray(newTest.answers) ? newTest.answers : null;
        if (!Number.isInteger(newTest.score) || newTest.score < 0 || newTest.score > 100 ||
            !Number.isInteger(ntq) || ntq < 1 || ntRows === null || ntRows.length !== ntq) {
          return {status: "no_evidence", reason: "impossible_record (new test)"};
        }
        const ntCorrect = ntRows.filter((r) => r?.isCorrect === true).length;
        if (Math.round((ntCorrect / ntq) * 100) !== newTest.score) {
          return {status: "no_evidence", reason: "impossible_record (new-test score-rows disagreement)"};
        }
        // [r74 C1a, r75-completed] the ENGINE leg REQUIRES the COMPLETE
        // frozen posture shape (15_ §4): boolean effectiveEnabled + integer
        // configVersion ≥ 1 + integer threshold 1-100 + non-empty source.
        const ntGp = newTest.gatePosture;
        const ntPostureValid = ntGp && typeof ntGp.effectiveEnabled === "boolean" &&
          Number.isInteger(ntGp.configVersion) && ntGp.configVersion >= 1 &&
          Number.isInteger(ntGp.threshold) && ntGp.threshold >= 1 && ntGp.threshold <= 100 &&
          typeof ntGp.source === "string" && ntGp.source.length > 0;
        if (!ntPostureValid) {
          return {status: "no_evidence", reason: "impossible_record (new-test posture missing/malformed)"};
        }
        if (newTest.teacherEdited !== true && newTest.score < ntGp.threshold) {
          return {status: "no_evidence", reason: "impossible_record (new test passed below threshold)"};
        }
      } else {
        // [r76 ROW 2b] THE LEGACY NEW-TEST LEG (epoch-less), published in
        // 17_ §6: identity/day/pass + range ONLY — no row/score arithmetic,
        // no posture requirement. It mints NO privilege (graduation derives
        // solely from the consumed REVIEW half; the twi delta is clamped to
        // the canonical list size), so arithmetic here would add refusal
        // risk with zero authority benefit.
        legacyEvidence = true;
      }
    }

    // ---- GOVERNING POSTURE [r70 C1 — attempt-time governs privilege] -----
    // Consumed evidence: the attempt's stored gatePosture (frozen law:
    // "attempt-time posture + configVersion stamped and governing through
    // completion"). Legacy stamps absent ⇒ the named published boundary
    // rule: completion-time source-class posture. Autopass kinds (no
    // consumed attempt) are evaluated NOW by construction.
    let postureSource;
    let governingGateOn;
    let governingThreshold;
    let governingConfigVersion;
    if (consumed !== null) {
      const gp = consumed.gatePosture;
      // THE COMPLETE FROZEN POSTURE SHAPE (15_ §4): boolean effectiveEnabled +
      // integer configVersion ≥ 1 + integer threshold 1-100 + non-empty source.
      const gpComplete = Boolean(gp) && typeof gp.effectiveEnabled === "boolean" &&
        Number.isInteger(gp.configVersion) && gp.configVersion >= 1 &&
        Number.isInteger(gp.threshold) && gp.threshold >= 1 && gp.threshold <= 100 &&
        typeof gp.source === "string" && gp.source.length > 0;
      // [r76 ROW 1b — Codex r75 #1: this fence FAILS CLOSED for engine
      // evidence, using the SAME `resetEpoch` discriminator as the
      // presentation requirement. An epoch-carrying attempt whose posture is
      // missing/malformed is an IMPOSSIBLE engine record — refuse it; never
      // launder it into privilege under a different (completion-time)
      // posture. Only epoch-LESS (legacy) evidence may take the published
      // completion_legacy demotion (17_ §6).]
      if (consumedIsEngine && !gpComplete) {
        return {status: "no_evidence", reason: "impossible_record (consumed posture missing/malformed)"};
      }
      // [r77 ROW B — Codex r76 #2] `resetEpoch` presence EXCLUSIVELY selects
      // posture authority: an epoch-LESS attempt ALWAYS follows the published
      // legacy rule (completion-time source posture), even when it happens to
      // carry a structurally complete posture. Otherwise a mixed record would
      // override the one discriminator (17_ §6).
      if (consumedIsEngine) {
        postureSource = "attempt";
        governingGateOn = gp.effectiveEnabled === true;
        governingThreshold = gp.threshold;
        governingConfigVersion = gp.configVersion;
      } else {
        postureSource = "completion_legacy";
        legacyEvidence = true;
        governingGateOn = sourceConfig0.gateEffectiveEnabled === true;
        governingThreshold = sourceConfig0.threshold;
        governingConfigVersion = sourceConfig0.configVersion;
      }
      // [r72 C1] passed ↔ score ↔ threshold consistency: a passed=true
      // record whose stored score misses its governing threshold is
      // impossible — UNLESS a teacher override minted the pass (A1's
      // `teacherEdited` label; the stored score is preserved by design).
      if (consumed.teacherEdited !== true && consumed.score < governingThreshold) {
        return {status: "no_evidence", reason: "impossible_record (passed below threshold)"};
      }
    } else {
      postureSource = "completion_autopass";
      governingGateOn = sourceConfig0.gateEffectiveEnabled === true;
      governingThreshold = sourceConfig0.threshold;
      governingConfigVersion = sourceConfig0.configVersion;
    }

    // ---- EVIDENCE KIND (the frozen matrix, GOVERNING posture) ------------
    const evidenceKind = evidenceKindFor({
      hasConsumed: consumedAttemptId !== null,
      hasNewTest: newTestAttemptId !== null,
      gateOn: governingGateOn,
      logicalDay,
    });
    if (evidenceKind === null) {
      return {status: "no_evidence", reason: "evidence shape not enumerated (both-tests law)"};
    }

    // ---- GRADUATION (live formula; the GOVERNING posture must be ON) -----
    let grad = {graduationCount: 0, formulaCount: 0, graduatedWordIds: [],
      correctCount: 0, eligibleFillCount: 0, invalidScore: false};
    // [r72 C1.2 — A1: an override mints ONE advance + ZERO graduation]
    if (consumed !== null && governingGateOn && consumed.teacherEdited !== true) {
      const rows = consumed.answers
          .filter((r) => r && typeof r.wordId === "string")
          .map((r) => ({wordId: r.wordId, isCorrect: r.isCorrect === true}));
      const queueIds = consumedQueue ? consumedQueue.orderedQueueWordIds : null;
      const presentedWordIds = consumedPresentation?.presentedWordIds ?? rows.map((r) => r.wordId);
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

    // ---- ADVANCE INPUTS [r70 C1, r72-tightened] --------------------------
    // ENGINE evidence: wordsIntroduced = the SERVER-composed presentation's
    // presented count (the presentation was bound above — a client-shaped
    // range can never inflate twi). LEGACY evidence: the attempt's range
    // count (completeSession's formula); range-less holds twi (published).
    // Either way newTwi is clamped to the canonical list size.
    let wordsIntroduced = 0;
    let twiHeld = false;
    if (newTest !== null) {
      if (newTestPresentation !== null) {
        wordsIntroduced = Array.isArray(newTestPresentation.presentedWordIds)
          ? newTestPresentation.presentedWordIds.length : 0;
      } else if (Number.isInteger(newTest.newWordStartIndex) && Number.isInteger(newTest.newWordEndIndex) &&
          newTest.newWordEndIndex >= newTest.newWordStartIndex) {
        wordsIntroduced = newTest.newWordEndIndex - newTest.newWordStartIndex + 1;
      } else {
        twiHeld = true;
        legacyEvidence = true;
      }
    }
    const canonicalCap = Number.isInteger(params.canonicalWordCount) && params.canonicalWordCount > 0
      ? params.canonicalWordCount : Infinity;

    // ---- STREAK read (same-txn, before writes) ---------------------------
    const kstDate = kstDateString(nowMs);
    const creditRef = db.doc(`users/${uid}/streak_credits/${kstDate}`);
    const creditSnap = await txn.get(creditRef);

    // ---- WRITES ----------------------------------------------------------
    const completedAt = Timestamp.fromMillis(nowMs);
    const sourceConfig = {
      threshold: governingThreshold,
      queueSize: consumedQueue?.snapshot?.queueSize ?? sourceConfig0.queueSize,
      testSize: consumedQueue?.snapshot?.testSize ?? sourceConfig0.testSize,
      configVersion: governingConfigVersion,
      reviewGateEnabled: sourceConfig0.assignmentGateEnabled,
      gateEffectiveEnabled: governingGateOn,
    };
    const completion = {
      uid, listId, logicalDay, resetEpoch, anchorNwei, generation,
      winningClassId,
      evidenceKind,
      consumedAttemptId, consumedAttemptClassId,
      sourceConfig,
      postureSource, // [r70 C1] attempt | completion_legacy | completion_autopass
      legacyEvidence, // [r70 C1] the published flip-week boundary flag
      newTestAttemptId,
      wordsIntroduced,
      twiHeld,
      completedTwi: Math.min(truth.twi + wordsIntroduced, canonicalCap),
      graduationCount: grad.graduationCount,
      graduatedWordIds: grad.graduatedWordIds,
      graduatedWordIdsHash: computeGraduatedHash(grad.graduatedWordIds),
      completedAt,
    };
    txn.create(completionRef, completion);

    // ---- THE CANONICAL ADVANCE [r70 C1 — same txn as the CAS] ------------
    // Mirrors completeSession's advance law on the SAME durable ref
    // (currentStudyDay +1, totalWordsIntroduced + wordsIntroduced; shape
    // parity on create). The frontier check above proved csd === day − 1.
    const advance = {
      currentStudyDay: logicalDay,
      totalWordsIntroduced: Math.min(truth.twi + wordsIntroduced, canonicalCap),
      lastStudyDate: completedAt,
      lastSessionAt: completedAt,
      updatedAt: completedAt,
    };
    if (truth.progressSnap.exists) {
      txn.update(truth.progressRef, advance);
    } else {
      txn.set(truth.progressRef, {
        ...foundation.defaultProgressShape(winningClassId, listId),
        ...advance,
        programStartDate: foundation.mondayOfWeekTimestamp(),
        createdAt: completedAt,
      });
    }

    // Rest mints ONLY for eligible writers (R2-48) — the audit twin
    // (graduatedWordIds) records the graduation either way.
    if (servingConfig.stampingEligible === true && grad.graduatedWordIds.length > 0) {
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
      completion,
      evidenceKind,
      graduationCount: grad.graduationCount,
      graduatedWordIds: grad.graduatedWordIds,
      correctCount: grad.correctCount,
      eligibleFillCount: grad.eligibleFillCount,
      streakCredited,
      advancedToDay: logicalDay,
      newTwi: advance.totalWordsIntroduced,
      sourceConfig,
      config: servingConfig,
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
