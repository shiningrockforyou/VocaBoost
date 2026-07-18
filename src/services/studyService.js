/**
 * Study Service
 * 
 * Core functions for the random sampling vocabulary system.
 * Integrates algorithm utilities with Firestore.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
  increment,
  getCountFromServer
} from 'firebase/firestore';
import { db } from '../firebase';
import { getNewWordAttemptForDay, fetchStudentClasses } from './db';
import {
  calculateInterventionLevel,
  calculateDailyAllocation,
  calculateSegment,
  computeUnmasteredSegmentIds,
  calculateReviewCount,
  calculateReviewTestSize,
  selectReviewQueue,
  selectTestWords,
  shuffleArray,
  excludeRetiredMastered,
  STUDY_ALGORITHM_CONSTANTS
} from '../utils/studyAlgorithm';
import {
  WORD_STATUS,
  DEFAULT_STUDY_STATE,
  createStudyState,
  createSessionSummary
} from '../types/studyTypes';
import {
  getOrCreateClassProgress,
  updateClassProgress,
  recordReviewOutcome
} from './progressService';
import { saveSessionState, clearSessionState, SESSION_PHASE } from './sessionService';
import { logSystemEvent } from './db';
import { LIST_SCOPED_RECON, SERVER_PROGRESS_WRITE, CYCLING_ENABLED, REVIEW_PAIRING_V2, FORCED_PATHWAY } from '../config/featureFlags';
import { reviewPairsWithAnchor } from '../utils/reviewPairing';
// CS PR-3 · WI-1 (FORCED_PATHWAY): the binary throttle + grandfathered completion-engagement
// (deriveThrottleMode / deriveBinaryInterventionLevel / isCompletionEngaged). Dead code until the
// flag flips; every consuming site below is gated so flag-off is byte-equivalent to today.
import {
  deriveThrottleMode,
  deriveBinaryInterventionLevel,
  isCompletionEngaged
} from '../utils/forcedPathway';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ============================================================================
// P9 · CYC — per-student list cycling primitives (x/plan v5). ALL cycling
// behavior is DOUBLE-gated: the global build flag CYCLING_ENABLED AND the
// per-student-per-list EFFECTIVE cycling capability (§3b: any of the student's
// enrolled classes assigning this list with cyclingEnabled:true unlocks it).
// With CYCLING_ENABLED === false the `&&` short-circuits BEFORE any read, so
// every caller below is byte-equivalent to today (the cycling branches are dead
// code — no extra Firestore read is issued).
// ============================================================================

/**
 * PURE §3b unlock (x/plan §3b, Codex P9-2): given the student's enrolled classes
 * (each with an `assignments` map + `name`), is cycling unlocked for `listId`, and
 * via which class? Cycling is unlocked iff ANY enrolled class assigns `listId` with
 * `cyclingEnabled === true` (the current/launching class is just one of them). The
 * FIRST such class is surfaced for the in-product "cycling enabled via {className}"
 * affordance (Lens C C5). Pure over already-fetched data → reusable by the Dashboard
 * (in-memory `studentClasses`) and by `resolveEffectiveCycling` (session path).
 *
 * @param {Array<{id?:string,name?:string,assignments?:Object}>} studentClasses
 * @param {string} listId
 * @returns {{ enabled: boolean, sourceClassId: string|null, sourceClassName: string|null }}
 */
export function deriveEffectiveCycling(studentClasses, listId) {
  if (Array.isArray(studentClasses)) {
    for (const k of studentClasses) {
      if (k?.assignments?.[listId]?.cyclingEnabled === true) {
        return { enabled: true, sourceClassId: k.id ?? null, sourceClassName: k.name ?? null };
      }
    }
  }
  return { enabled: false, sourceClassId: null, sourceClassName: null };
}

/**
 * Resolve the EFFECTIVE (student+list, cross-class) cycling capability for the
 * session path (§3b). Short-circuits on the global flag so flag-off issues NO read
 * (byte-equivalent). Uses the EXISTING student-classes enumeration helper
 * (`fetchStudentClasses`, db.js) rather than a raw re-query. Defensive: any read
 * error (e.g. a teacher-initiated PDF/debug where the student-classes read is
 * denied) fails CLOSED to "not cycling" — never breaks init.
 *
 * @param {string} userId
 * @param {string} listId
 * @returns {Promise<{ enabled: boolean, sourceClassId: string|null, sourceClassName: string|null }>}
 */
export async function resolveEffectiveCycling(userId, listId) {
  if (!CYCLING_ENABLED) return { enabled: false, sourceClassId: null, sourceClassName: null };
  try {
    const classes = await fetchStudentClasses(userId);
    return deriveEffectiveCycling(classes, listId);
  } catch (err) {
    console.warn('[CYC] resolveEffectiveCycling failed; treating as not cycling', err);
    return { enabled: false, sourceClassId: null, sourceClassName: null };
  }
}

/**
 * CANONICAL cycle length (x/plan §2, Codex P9-3): `positions.length` — the count of
 * ordered word docs, the ONE modulus for lap math / review bounds / display / wrap.
 * Derived from the SAME `orderBy('position')` population as `resolveVirtualRange`
 * (docs bearing a position field), via a cheap aggregate count (NOT a full doc load,
 * and NOT the mutable `lists.wordCount`). Returns 0 on any error → callers fall back
 * to the legacy (non-cycling) path.
 *
 * @param {string} listId
 * @returns {Promise<number>} positions.length (canonical modulus)
 */
export async function getCycleLength(listId) {
  try {
    const wordsRef = collection(db, 'lists', listId, 'words');
    const snap = await getCountFromServer(query(wordsRef, orderBy('position', 'asc')));
    return snap.data().count || 0;
  } catch (err) {
    console.warn('[CYC] getCycleLength failed', err);
    return 0;
  }
}

/**
 * PURE daily new-word allocation under the cycling gate (x/plan §3f) — extracted so
 * the M-STATIC harness can assert cap-removal + byte-equivalence directly. Under
 * cycling: REMOVE the wordsRemaining cap → the full paced allocation (still ≥0), so a
 * FINISHED list (wordsRemaining ≤ 0) still yields newWordCount > 0. Non-cycling: TODAY'S
 * EXACT expression `Math.min(allocationNewWords, wordsRemaining)` (may be negative on
 * over-introduction; the completion path clamps it) → byte-equivalent when off.
 *
 * @param {number} allocationNewWords - round(pace*(1-intervention))
 * @param {number} wordsRemaining - totalListWords - twi
 * @param {boolean} cyclingActive
 * @returns {number}
 */
export function computeCyclingAllocation(allocationNewWords, wordsRemaining, cyclingActive) {
  return cyclingActive
    ? Math.max(0, allocationNewWords)
    : Math.min(allocationNewWords, wordsRemaining);
}

/**
 * Lap-aware INTRODUCTION-progress view for a monotonic virtual twi (x/plan §2/§3e).
 * cycleLength := positions.length is THE canonical modulus (never wordCount — pin
 * one definition, Lens A F5). Boundary render: at twi = k·cycleLength show 100% of
 * lap k, not 0% of lap k+1 (Lens C nit). Per-lap MASTERY % is a DROPPED non-goal
 * (§3d) — this is introduction progress only. Returns null when cycleLength<=0 so
 * callers fall back to the legacy display.
 *
 * @param {number} twi - monotonic virtual totalWordsIntroduced
 * @param {number} cycleLength - positions.length (canonical modulus)
 * @returns {{ lap:number, numer:number, denom:number, pct:number } | null}
 */
export function computeLapView(twi, cycleLength) {
  const cl = Number(cycleLength) || 0;
  if (cl <= 0) return null;
  const t = Math.max(0, Number(twi) || 0);
  const rawLap = Math.floor(t / cl);          // laps fully completed (0-indexed)
  const posInLap = t - rawLap * cl;           // == t mod cl, non-negative
  const atBoundary = posInLap === 0 && t > 0; // exactly at k·cycleLength
  const lap = atBoundary ? rawLap : rawLap + 1;   // 1-indexed display lap
  const numer = atBoundary ? cl : posInLap;       // show 100% of lap k at the boundary
  const pct = Math.min(100, Math.round((numer / cl) * 100));
  return { lap, numer, denom: cl, pct };
}

/**
 * ONE virtual→physical resolver (x/plan §3c). Returns `count` physical word docs
 * starting at VIRTUAL index `virtualStart`, wrapping the position-array LOOKUP
 * `positions[i mod cycleLength]` (NEVER the counter twi → counter stays monotonic
 * → reconciliation intact, §3a). Preserves virtual order, so the straddle day
 * (tail of one lap + head of the next) comes back tail-then-head, off-by-one-free.
 * cycleLength := positions.length (the loaded array length) — canonical modulus.
 *
 * Shape matches getNewWords: raw word docs { id, ...data }, NO studyState.
 *
 * @param {string} listId
 * @param {number} virtualStart - virtual position (may be >= cycleLength)
 * @param {number} count
 * @returns {Promise<Array>} ordered physical word docs in virtual order
 */
export async function resolveVirtualRange(listId, virtualStart, count) {
  if (!Number.isFinite(count) || count <= 0) return [];
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsSnap = await getDocs(query(wordsRef, orderBy('position', 'asc')));
  const positions = wordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const cycleLength = positions.length; // CANONICAL modulus (§2 — never wordCount)
  if (cycleLength === 0) return [];
  const out = [];
  const start = Math.max(0, Math.floor(virtualStart) || 0);
  for (let i = 0; i < count; i++) {
    const v = start + i;
    // ((v % cl) + cl) % cl is a no-op for non-negative v, but keeps the lookup
    // safe if a virtualStart ever arrives negative.
    out.push(positions[((v % cycleLength) + cycleLength) % cycleLength]);
  }
  return out;
}

/**
 * Determine starting phase based on attempt history for the current day.
 *
 * Used for session recovery when a user returns mid-session or after completion.
 *
 * @param {Array} attempts - Recent attempts for this class/list
 * @param {number} dayNumber - The study day number we're initializing
 * @returns {{ phase: string, newWordScore?: number, reviewScore?: number }}
 */
export function determineStartingPhase(attempts, dayNumber) {
  console.log('[PHASE] ═══════════════════════════════════════');
  console.log('[PHASE] determineStartingPhase called');
  console.log('[PHASE] Day Number:', dayNumber);
  console.log('[PHASE] Total attempts provided:', attempts?.length || 0);

  // Attempts store score as a percent (0-100); the session/UI domain uses a
  // fraction (0-1). Normalize here so a resumed mid-session score isn't
  // persisted/rendered as e.g. 9700% (newWordsTestScore unit bug).
  const toFraction = (s) => (s == null ? s : (s > 1 ? s / 100 : s));

  const dayAttempts = attempts.filter(a => a.studyDay === dayNumber);
  // Pick the BEST new-word attempt for the day, not just the first match. A student
  // who failed then retook-and-passed has multiple 'new' attempts; .find() can return
  // the earlier FAILED one, so we'd conclude they still owe the test and resume them to
  // the new-word phase instead of review — even though they passed. Prefer a passed
  // attempt; otherwise the highest score.
  const newAttempts = dayAttempts.filter(a => a.sessionType === 'new');
  const newTest = newAttempts.slice().sort((a, b) =>
    (Number(b.passed === true) - Number(a.passed === true)) ||
    ((b.score ?? 0) - (a.score ?? 0))
  )[0] || null;
  // REVIEW_PAIRING_V2 (CS PR-1 · WI-2, I4): the bare `sessionType === 'review'` find is the
  // predicate-ASYMMETRY half of the I4 loop — this reader declared a day COMPLETE off ANY
  // same-day review while reconciliation (getReviewForDay) demanded an exact anchor-range
  // match, pinning csd at anchorDay-1 forever. Under the flag BOTH readers use the one
  // census-LOCKED predicate, pairing the review against the day's best-new pick (the anchor
  // this day would reconcile against) — so an unpaired review resolves REVIEW_STUDY (retake)
  // instead of COMPLETE, and the stuck cohort drains organically. No best-new pick → nothing
  // to pair against → keep the legacy find (its value is display/logging-only in that case:
  // every routing branch below also requires newTest?.passed). Flag-off: verbatim legacy.
  // CS PR-3 · WI-1 (FORCED_PATHWAY): the completeness reader must stay SYMMETRIC with the
  // reconciliation reader (getReviewForDay) — additionally require the paired review be ENGAGED
  // (grandfathered isCompletionEngaged) so a POST-deploy SKIP that pairs on the exact tier does NOT
  // declare the day COMPLETE. An unpaired/non-engaged review resolves REVIEW_STUDY (retake), matching
  // completeSessionFromTest's skip routing; the grandfather keeps pre-epoch skips completing (decision
  // #3). Do NOT mutate reviewPairsWithAnchor (PR-1 census-locked). Flag-off: the arrow returns
  // reviewPairsWithAnchor(a, newTest) verbatim (byte-equivalent); the no-newTest legacy find untouched.
  const reviewTest = (REVIEW_PAIRING_V2 && newTest)
    ? dayAttempts.find(a => FORCED_PATHWAY
        ? (reviewPairsWithAnchor(a, newTest) && isCompletionEngaged(a))
        : reviewPairsWithAnchor(a, newTest))
    : dayAttempts.find(a => a.sessionType === 'review');

  console.log('[PHASE] Attempts for day', dayNumber + ':', {
    totalForDay: dayAttempts.length,
    hasNewTest: !!newTest,
    newTestPassed: newTest?.passed,
    newTestScore: newTest?.score,
    hasReviewTest: !!reviewTest,
    reviewTestScore: reviewTest?.score
  });

  // Day 2+: mid-session (new passed, no review) -> resume at review
  if (dayNumber > 1 && newTest?.passed && !reviewTest) {
    console.log('[PHASE] ✓ DECISION: REVIEW_STUDY (mid-session resume)');
    console.log('[PHASE] Reason: Day 2+, new test passed, no review test yet');
    console.log('[PHASE] ═══════════════════════════════════════');
    return {
      phase: SESSION_PHASE.REVIEW_STUDY,
      newWordScore: toFraction(newTest.score)
    };
  }

  // "Impossible" states after reconciliation -> treat as complete
  if (dayNumber === 1 && newTest?.passed) {
    console.warn('[PHASE] ⚠️ DECISION: COMPLETE (impossible state detected)');
    console.warn('[PHASE] Reason: Day 1 should never have passed new test');
    console.log('[PHASE] ═══════════════════════════════════════');
    // Log impossible state for monitoring
    logSystemEvent('impossible_phase_detected', {
      dayNumber,
      reason: 'day1_with_passed_new_test',
      newTestId: newTest.id,
      // CS PR-1 observability (additive, unconditional): attribute the event to the student
      // so triage doesn't need an attempt-doc join. Attempts carry studentId.
      userId: newTest.studentId ?? null
    });
    return {
      phase: SESSION_PHASE.COMPLETE,
      newWordScore: toFraction(newTest.score)
    };
  }

  if (dayNumber > 1 && newTest?.passed && reviewTest) {
    console.log('[PHASE] ✓ DECISION: COMPLETE (both tests done)');
    console.log('[PHASE] Reason: Day 2+, both new and review tests completed');
    console.log('[PHASE] ═══════════════════════════════════════');
    // This is actually a normal completed state, not impossible
    return {
      phase: SESSION_PHASE.COMPLETE,
      newWordScore: toFraction(newTest.score),
      reviewScore: toFraction(reviewTest.score)
    };
  }

  // Normal: fresh start
  console.log('[PHASE] ✓ DECISION: NEW_WORDS_STUDY (fresh start)');
  console.log('[PHASE] Reason: No completed tests found for this day');
  console.log('[PHASE] ═══════════════════════════════════════');
  return { phase: SESSION_PHASE.NEW_WORDS_STUDY };
}

/**
 * B1: Initialize a daily study session
 * 
 * Orchestrates session setup:
 * - Load student progress
 * - Calculate intervention level
 * - Determine daily allocation
 * - Calculate segment for review
 * - Get new words and segment words
 * 
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {Object} assignmentSettings - Assignment settings (weeklyPace, studyDaysPerWeek, etc.)
 * @returns {Promise<Object>} Session initialization data
 */
export async function initializeDailySession(userId, classId, listId, assignmentSettings) {
  // Get or create progress (includes CSD/TWI reconciliation against attempts)
  const { progress, attempts } = await getOrCreateClassProgress(userId, classId, listId);

  // Return expired-MASTERED words (21-day rest elapsed) to the pool BEFORE we read the
  // unmastered pool below, so a just-due word re-enters today's segment. Runs here (not
  // only in the DailySessionFlow caller) so every caller of initializeDailySession —
  // including the PDF/debug helpers and the standalone test pages — gets a fresh pool.
  await returnMasteredWords(userId, listId);

  // Calculate intervention from recent sessions.
  // CS PR-3 · WI-1 (FORCED_PATHWAY): the BINARY throttle. Derive the review-mode bit from the
  // recent review average WITH HYSTERESIS (deriveThrottleMode reads the PERSISTED
  // class_progress.reviewMode bit as priorMode — this is the whack-a-mole kill I5: a durable CS
  // `reviewMode:false` survives a band-average, and only a genuine <0.30 re-enters), then take a
  // derived {0,1} interventionLevel so calculateDailyAllocation gives 0 new words in review mode.
  // Flag-off: the exact graduated calculateInterventionLevel value (byte-equivalent).
  const reviewMode = FORCED_PATHWAY
    ? deriveThrottleMode(progress.recentSessions || [], progress.reviewMode === true)
    : false;
  const interventionLevel = FORCED_PATHWAY
    ? deriveBinaryInterventionLevel(reviewMode)
    : calculateInterventionLevel(progress.recentSessions || []);

  // Study days per week — enforce >= 2 so the week-1 sizing divisor (dpw-1) is never 0.
  const studyDaysPerWeek = Math.max(
    STUDY_ALGORITHM_CONSTANTS.MIN_STUDY_DAYS_PER_WEEK,
    assignmentSettings.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK
  );

  // Get daily pace from settings
  const dailyPace = Math.ceil(
    (assignmentSettings.weeklyPace || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE) /
    studyDaysPerWeek
  );

  // Calculate allocation
  const allocation = calculateDailyAllocation(dailyPace, interventionLevel);

  // Current study day (will be incremented on completion)
  const currentStudyDay = (progress.currentStudyDay || 0) + 1;
  const totalWordsIntroduced = progress.totalWordsIntroduced || 0;

  // P9 · CYC — resolve the EFFECTIVE (student+list, cross-class §3b) cycling capability
  // and the CANONICAL cycle length (Codex P9-1/P9-2/P9-3). This is the single choke point
  // every session caller (DailySessionFlow, MCQTest, TypedTest, PDF/debug helpers) flows
  // through, so resolving here — NOT from the caller's curated `assignmentSettings` object
  // (which drops `cyclingEnabled`) — is what actually activates cycling. When CYCLING_ENABLED
  // is false, `resolveEffectiveCycling` short-circuits with NO read and `cycling` is false, so
  // the rest of this function is byte-equivalent to today (no extra Firestore read). cycleLength
  // is `positions.length` via `getCycleLength` (the SAME ordered-positions source as
  // `resolveVirtualRange`) — never the mutable `lists.wordCount` (§2 one-modulus correctness rule).
  const cyclingCap = await resolveEffectiveCycling(userId, listId);
  const cycling = cyclingCap.enabled;
  let cycleLength = 0;
  if (cycling) {
    cycleLength = await getCycleLength(listId);
  }
  const cyclingActive = cycling && cycleLength > 0;

  // DEBUG: Log dayNumber calculation
  console.log('DEBUG initializeDailySession:', {
    progressCurrentStudyDay: progress.currentStudyDay,
    calculatedDayNumber: currentStudyDay,
    totalWordsIntroduced
  });

  // Build the review segment from the UNMASTERED pool (status-based model):
  //   segment = (unmastered words / studyDaysPerWeek), the day-of-week-th slice,
  //   capped at REVIEW_STUDY_CAP. segment.wordIds is the pinned effective set used by
  //   study, test, AND graduation, so "everything that graduates was studied" holds.
  const unmasteredPool = await getUnmasteredPool(userId, listId, totalWordsIntroduced,
    { cycling: cyclingActive, cycleLength });
  const reviewBacklogTotal = unmasteredPool.length;
  const sliceIds = computeUnmasteredSegmentIds(
    unmasteredPool.map(w => w.id),
    currentStudyDay,
    studyDaysPerWeek
  );
  const reviewCap = STUDY_ALGORITHM_CONSTANTS.REVIEW_STUDY_CAP;
  const cappedIds = sliceIds ? (reviewCap > 0 ? sliceIds.slice(0, reviewCap) : sliceIds) : null;
  let segment = null;
  if (cappedIds && cappedIds.length) {
    // startIndex/endIndex are display/record-only POSITION hints (wordIds is the
    // authoritative, possibly non-contiguous set). Use min/max position of the slice.
    const idSet = new Set(cappedIds);
    const positions = unmasteredPool.filter(w => idSet.has(w.id)).map(w => w.position);
    segment = {
      wordIds: cappedIds,
      startIndex: Math.min(...positions),
      endIndex: Math.max(...positions)
    };
  }

  // Calculate review count
  const reviewCount = calculateReviewCount(
    progress.recentSessions || [],
    allocation.reviewCap
  );

  // Get list info to know total words available
  const listRef = doc(db, 'lists', listId);
  const listSnap = await getDoc(listRef);
  const listData = listSnap.exists() ? listSnap.data() : {};
  const totalListWords = listData.wordCount || 0;

  // Determine how many new words we can introduce.
  // P9 · CYC (§3f allocation): under cycling the list never dead-ends — REMOVE the
  // wordsRemaining cap and introduce the full paced allocation (still ≥0). The monotonic
  // virtual twi climbs past cycleLength; the physical word is fetched by wrapping the
  // LOOKUP (resolveVirtualRange), so the counter stays monotonic and reconciliation is
  // untouched. Non-cycling keeps TODAY'S EXACT expression `Math.min(allocation.newWords,
  // wordsRemaining)` (may be negative on over-introduction — the completion path clamps it
  // at :1452) so the flag-off path is byte-equivalent (the ≥0 clamp the x/plan mentions for
  // the non-cycling branch is deferred to preserve byte-equivalence — U-alloc-clamp).
  const wordsRemaining = totalListWords - totalWordsIntroduced;
  const newWordCount = computeCyclingAllocation(allocation.newWords, wordsRemaining, cyclingActive);

  // Determine starting phase based on attempt history
  const phaseInfo = determineStartingPhase(attempts, currentStudyDay);

  // NEED_TO_FIX #9 (Fix A): on a REVIEW_STUDY resume, the day's new words were already
  // introduced (possibly in ANOTHER class), so a FRESH session must NOT re-introduce or
  // re-count them. Zero the count, but PRESERVE the day's passed-new anchor range on
  // newWordStartIndex/EndIndex so (1) the completion gate finds the pass at the correct base
  // and (2) the review attempt written from this session carries the anchor range, enabling
  // list-scoped position-consistent review pairing (see getReviewForDay). Flag-gated to keep
  // the flag-off path byte-identical (Run-L equivalence).
  let nwCount = newWordCount;
  let nwStart = totalWordsIntroduced;
  let nwEnd = totalWordsIntroduced + newWordCount - 1;
  if (LIST_SCOPED_RECON && phaseInfo.phase === SESSION_PHASE.REVIEW_STUDY) {
    const dayNewAttempts = attempts.filter(a => a.studyDay === currentStudyDay && a.sessionType === 'new');
    // Pick the attempt that DEFINED the reconciled twi — its newWordEndIndex === twi-1
    // (totalWordsIntroduced-1). `attempts` is list-scoped (cross-class), and studyDay is a
    // per-class session counter, so a DIFFERENT-pace class's same-studyDay pass could out-score
    // this progression's and stamp the WRONG word range onto the review attempt. Anchoring on
    // the twi-defining attempt makes the review carry the exact anchor range Fix B pairs on.
    // Fall back to determineStartingPhase's passed-first/score-desc pick for legacy data.
    const dayNewPass =
      dayNewAttempts.find(a => a.passed === true && a.newWordEndIndex === totalWordsIntroduced - 1) ||
      dayNewAttempts.slice().sort((a, b) =>
        (Number(b.passed === true) - Number(a.passed === true)) ||
        ((b.score ?? 0) - (a.score ?? 0)))[0];
    if (dayNewPass) {
      nwCount = 0; // new already introduced this day — never re-introduce or re-count (TWI)
      // Preferred: stored anchor range. Legacy attempts predating the fields: fall back to
      // twi-derived non-negative values (count stays 0 regardless; a wrong base merely makes the
      // completion gate fall back to the launching-class query, which still confirms the pass).
      nwEnd = Number.isInteger(dayNewPass.newWordEndIndex)
        ? dayNewPass.newWordEndIndex
        : (totalWordsIntroduced - 1);
      nwStart = Number.isInteger(dayNewPass.newWordStartIndex)
        ? dayNewPass.newWordStartIndex
        : totalWordsIntroduced;
    }
  }

  return {
    // Session metadata
    classId,
    listId,
    dayNumber: currentStudyDay,

    // Allocation
    interventionLevel,
    // CS PR-3 · WI-1 (FORCED_PATHWAY): the review-mode bit for this session — observability + the
    // completion/snapshot review-mode context. Absent when flag-off (byte-equivalent config object;
    // the persisted dailySessionState carries it only under the flag).
    ...(FORCED_PATHWAY ? { reviewMode } : {}),
    dailyPace,
    allocation,

    // New words (NEED_TO_FIX #9: nwCount/nwStart/nwEnd account for a REVIEW_STUDY resume)
    newWordCount: nwCount,
    newWordStartIndex: nwStart,
    newWordEndIndex: nwEnd,

    // Review (null if day 1)
    segment,
    reviewCount: segment ? reviewCount : 0,
    // Unmastered-segment model counts (D3):
    //   reviewSegmentSize  = today's capped effective segment = words actually studied/graduated
    //   reviewBacklogTotal = full unmastered pool ("words remaining" backlog, uncapped)
    reviewSegmentSize: segment ? segment.wordIds.length : 0,
    reviewBacklogTotal,

    // Test sizes (review scales with intervention)
    testSizeNew: assignmentSettings.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
    testSizeReview: calculateReviewTestSize(interventionLevel),
    retakeThreshold: assignmentSettings.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD,

    // Progress reference
    progress,
    totalWordsIntroduced,
    totalListWords,

    // P9 · CYC — cycling state threaded to consumers (§4.5). `cyclingActive` gates the
    // callers' getNewWords wrap + the lap-aware display; `cycleLength` is the CANONICAL
    // modulus (positions.length); `lapView` is the introduction-progress display object
    // (§3e); `cyclingSourceClassName` powers the "cycling enabled via {className}"
    // affordance (§3b). All absent/inert (false/0/null) when CYCLING_ENABLED is off →
    // byte-equivalent object today.
    cyclingActive,
    cycleLength,
    lapView: cyclingActive ? computeLapView(totalWordsIntroduced, cycleLength) : null,
    cyclingSourceClassId: cyclingCap.sourceClassId,
    cyclingSourceClassName: cyclingCap.sourceClassName,

    // Status
    isFirstDay: currentStudyDay === 1,
    // Under cycling the list NEVER completes — a finished list rolls into the next lap
    // (§3f), so isListComplete must be false or the finished terminal / review-only
    // derivation would misfire every lap. Non-cycling keeps today's `wordsRemaining <= 0`.
    isListComplete: cyclingActive ? false : (wordsRemaining <= 0),

    // Phase detection for session recovery
    startPhase: phaseInfo.phase,
    recoveredNewWordScore: phaseInfo.newWordScore,
    recoveredReviewScore: phaseInfo.reviewScore
  };
}

/**
 * Helper: Get study states for a list of word IDs
 * @param {string} userId - User ID
 * @param {Array<string>} wordIds - Array of word IDs
 * @returns {Promise<Object>} Map of wordId -> study state
 */
async function getStudyStatesForWords(userId, wordIds) {
  if (!wordIds || wordIds.length === 0) return {};

  const states = {};

  // Fetch documents individually (Firestore doesn't support __name__ in queries easily)
  // Batch fetches to avoid too many concurrent requests
  const batchSize = 30;
  for (let i = 0; i < wordIds.length; i += batchSize) {
    const batch = wordIds.slice(i, i + batchSize);
    const promises = batch.map(wordId => {
      const stateRef = doc(db, `users/${userId}/study_states`, wordId);
      return getDoc(stateRef);
    });

    const snapshots = await Promise.all(promises);
    snapshots.forEach((snap, index) => {
      if (snap.exists()) {
        states[batch[index]] = { id: snap.id, ...snap.data() };
      }
    });
  }

  return states;
}

/**
 * B2: Get words from a list by index range
 * 
 * Fetches words and their study states within an index range.
 * 
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @param {number} startIndex - Start index (inclusive)
 * @param {number} endIndex - End index (inclusive)
 * @returns {Promise<Array>} Array of word objects with study states
 */
export async function getSegmentWords(userId, listId, startIndex, endIndex) {
  // Get words from list subcollection, ordered by position
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsQuery = query(wordsRef, orderBy('position', 'asc'));
  const wordsSnap = await getDocs(wordsQuery);

  // Get words in range using position field
  const allWords = wordsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  const segmentWords = allWords.filter(
    w => w.position >= startIndex && w.position <= endIndex
  );

  // Get study states for these words
  const wordIds = segmentWords.map(w => w.id);
  const studyStates = await getStudyStatesForWords(userId, wordIds);

  // Merge words with study states
  return segmentWords.map(word => ({
    ...word,
    studyState: studyStates[word.id] || {
      ...DEFAULT_STUDY_STATE,
      status: WORD_STATUS.NEVER_TESTED,
      wordIndex: word.position,
      listId
    }
  }));
}

/**
 * Get the UNMASTERED pool for a list (status-based review model).
 *
 * Returns the introduced words (position 0..totalWordsIntroduced-1), MASTERED-retired
 * words excluded (returnAt-aware), ordered by position. NEVER_TESTED words (no study
 * state yet) ARE included — they are unmastered. This is the pool sliced into daily
 * review segments by computeUnmasteredSegmentIds.
 *
 * @param {string} userId
 * @param {string} listId
 * @param {number} totalWordsIntroduced
 * @param {{ cycling?: boolean, cycleLength?: number }} [options] - P9 lap-bounding (§3c/§3d)
 * @returns {Promise<Array<{ id: string, position: number }>>} position-ordered unmastered words
 */
export async function getUnmasteredPool(userId, listId, totalWordsIntroduced, options = {}) {
  const { cycling = false, cycleLength = 0 } = options;
  // P9 · CYC (§3c/§3d): under cycling the review pool is LAP-BOUNDED to the current lap's
  // re-introduced words — physical positions [0, twi mod cycleLength). This is the SINGLE
  // review mechanism (§3d): bounding to the current lap means the pool holds only this-lap
  // re-introduced (reset-to-NEW) words, so selectReviewQueue's MASTERED filter is moot and
  // the masteredAt/returnAt batch-clear is DROPPED. At an exact lap boundary (mod === 0)
  // nothing has been re-introduced yet this lap → empty pool (like Day 1 of a fresh list).
  // Flag-off: cycling=false → boundExclusive === totalWordsIntroduced → byte-equivalent
  // (identical early-return + identical query bound).
  const boundExclusive = (cycling && cycleLength > 0)
    ? (totalWordsIntroduced % cycleLength)
    : totalWordsIntroduced;
  if (!boundExclusive || boundExclusive <= 0) return [];

  // Bounded, position-ordered query of the introduced range (avoids loading the whole list).
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsSnap = await getDocs(
    query(wordsRef, where('position', '<', boundExclusive), orderBy('position', 'asc'))
  );

  const introduced = wordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (introduced.length === 0) return [];

  // Attach study states, then drop still-retired MASTERED words (excludeRetiredMastered
  // is returnAt-aware; expired-MASTERED were already flipped to NEEDS_CHECK by
  // returnMasteredWords at init, so anything still MASTERED here is within its rest).
  const studyStates = await getStudyStatesForWords(userId, introduced.map(w => w.id));
  const withState = introduced.map(w => ({ ...w, studyState: studyStates[w.id] || null }));
  const unmastered = excludeRetiredMastered(withState);

  return unmastered.map(w => ({ id: w.id, position: w.position }));
}

/**
 * Resolve specific word ids (the pinned segment.wordIds) into full word objects with
 * study states, PRESERVING the input order. Mirrors getSegmentWords' return shape.
 *
 * Order matters: the daily segment is position-ordered, and Firestore does not preserve
 * input order. We fetch the list once and re-map by the input wordIds array. Study-state
 * fetches are already chunked inside getStudyStatesForWords.
 *
 * @param {string} userId
 * @param {string} listId
 * @param {string[]} wordIds
 * @returns {Promise<Array>} word objects with studyState, in wordIds order
 */
export async function getSegmentWordsByIds(userId, listId, wordIds) {
  if (!Array.isArray(wordIds) || wordIds.length === 0) return [];

  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsSnap = await getDocs(query(wordsRef, orderBy('position', 'asc')));
  const byId = new Map();
  wordsSnap.docs.forEach(d => byId.set(d.id, { id: d.id, ...d.data() }));

  const studyStates = await getStudyStatesForWords(userId, wordIds);

  return wordIds
    .map(id => {
      const word = byId.get(id);
      if (!word) return null;
      return {
        ...word,
        studyState: studyStates[id] || {
          ...DEFAULT_STUDY_STATE,
          status: WORD_STATUS.NEVER_TESTED,
          wordIndex: word.position,
          listId
        }
      };
    })
    .filter(Boolean);
}

/**
 * Single legal materializer for a review segment. Prefers the pinned wordIds (new
 * unmastered-segment model); falls back to the position range for OLD in-flight
 * sessions whose persisted segment predates this change (no wordIds). This is the
 * migration seam: old sessions keep the exact old behavior; new sessions use wordIds.
 *
 * @param {string} userId
 * @param {string} listId
 * @param {{ wordIds?: string[], startIndex?: number, endIndex?: number } | null} segment
 * @returns {Promise<Array>} word objects with studyState
 */
export async function resolveSegmentWords(userId, listId, segment) {
  if (!segment) return [];
  if (Array.isArray(segment.wordIds) && segment.wordIds.length > 0) {
    return getSegmentWordsByIds(userId, listId, segment.wordIds);
  }
  return getSegmentWords(userId, listId, segment.startIndex, segment.endIndex);
}

/**
 * B3: Process test results
 * 
 * Updates word statuses based on test results.
 * ONLY tests update status - this is the single source of truth.
 * 
 * @param {string} userId - User ID
 * @param {Array} results - Array of { wordId, correct: boolean }
 * @param {string} listId - List ID (for new words)
 * @returns {Promise<Object>} Summary of results
 */
export async function processTestResults(userId, results, listId) {
  if (!results || results.length === 0) {
    return { score: 0, correct: 0, total: 0, failed: [] };
  }

  const batch = writeBatch(db);
  const now = Timestamp.now();

  for (const result of results) {
    const stateRef = doc(db, `users/${userId}/study_states`, result.wordId);

    batch.set(stateRef, {
      status: result.correct ? WORD_STATUS.PASSED : WORD_STATUS.FAILED,
      timesTestedTotal: increment(1),
      timesCorrectTotal: increment(result.correct ? 1 : 0),
      lastTestedAt: now,
      lastTestResult: result.correct,
      // Reset queue tracking on test
      lastQueuedAt: null,
      queueAppearances: 0,
      // Preserve list reference
      listId
    }, { merge: true });
  }

  await batch.commit();

  const correct = results.filter(r => r.correct).length;
  const failed = results.filter(r => !r.correct).map(r => r.wordId);

  return {
    score: correct / results.length,
    correct,
    total: results.length,
    failed
  };
}

/**
 * B4: Update queue tracking
 * 
 * Called after words appear in review queue (during study, not test).
 * Does NOT change status - only tracks queue appearances.
 * 
 * @param {string} userId - User ID
 * @param {Array<string>} wordIds - Array of word IDs that appeared in queue
 * @returns {Promise<void>}
 */
export async function updateQueueTracking(userId, wordIds) {
  if (!wordIds || wordIds.length === 0) return;

  const batch = writeBatch(db);
  const now = Timestamp.now();

  for (const wordId of wordIds) {
    const stateRef = doc(db, `users/${userId}/study_states`, wordId);

    batch.set(stateRef, {
      lastQueuedAt: now,
      queueAppearances: increment(1)
    }, { merge: true });
  }

  await batch.commit();
}

/**
 * B5: Record session completion
 * 
 * Saves the session record and updates student progress.
 * 
 * @param {string} userId - User ID
 * @param {Object} sessionData - Session data to record
 * @returns {Promise<Object>} Updated progress
 */
export async function recordSessionCompletion(userId, sessionData) {
  // [deepfix P4 · FND-2, SERVER_PROGRESS_WRITE] Route the durable completion write through
  // the `completeSession` callable (functions/foundation.js): transactional day-guard,
  // server-derived reviewOnlyDay/wordsIntroduced/intervention — the server OWNS csd/twi.
  // Still targets the LEGACY class_progress doc until P5 (LIST_PROGRESS_CANONICAL, server-
  // side). Flag OFF (default) → the legacy client path below, byte-equivalent to today.
  if (SERVER_PROGRESS_WRITE) {
    return recordSessionCompletionViaServer(userId, sessionData);
  }
  const {
    classId,
    listId,
    dayNumber,
    newWordScore,
    reviewScore,
    segment,
    wordsIntroduced,
    wordsReviewed,
    wordsTested,
    interventionLevel,
    cyclingActive,
    cycleLength,
    studyDaysPerWeek = 5
  } = sessionData;

  // Create session summary
  const sessionSummary = createSessionSummary({
    day: dayNumber || 1,
    newWordScore,
    reviewScore,
    segmentStartIndex: segment?.startIndex || 0,
    segmentEndIndex: segment?.endIndex || 0,
    wordsIntroduced: wordsIntroduced || 0,
    wordsReviewed: wordsReviewed || 0,
    wordsTested: wordsTested || 0
  });

  // Calculate new intervention for next session
  // (We pass the current one, updateClassProgress will recalculate with new session)
  const newIntervention = interventionLevel;

  // Update progress
  const updatedProgress = await updateClassProgress(
    userId,
    classId,
    listId,
    sessionSummary,
    newIntervention,
    studyDaysPerWeek,
    // [P9 · CYC · U5] cycling state for the lap-boundary intervention reset (inert when off)
    { active: cyclingActive === true, cycleLength: cycleLength || 0 }
  );

  // [V9/§5.4/Codex-P1-3] Duplicate-day guard rejection: the counter moved out from under
  // this session (e.g. list-scoped reconciliation advanced it at another entry point).
  // The completion did NOT apply — ABORT here: clear the stale session, write NO
  // completed-session record, and return the rejection sentinel so the caller skips
  // graduation and the UI routes to a rebuilt session (never presented as success).
  if (LIST_SCOPED_RECON && updatedProgress?.dayGuardRejected) {
    console.warn('[SESSION] day-guard rejection — aborting completion, clearing session state for rebuild', {
      userId, classId, listId, sessionDay: sessionSummary.day
    });
    // [Codex-P1r3-3] The rebuild claim depends on the stale COMPLETE doc actually being
    // gone — clearSessionState now reports success. Retry once on failure; if it still
    // fails, escalate to an error-level system_log (CS signal: this student's stale
    // session doc needs manual deletion) and say so in the sentinel.
    let sessionCleared = await clearSessionState(userId, classId, listId);
    if (!sessionCleared) {
      sessionCleared = await clearSessionState(userId, classId, listId);
    }
    try {
      await logSystemEvent(
        sessionCleared ? 'day_guard_rejected_session_cleared' : 'day_guard_session_clear_FAILED',
        {
          userId, classId, listId, sessionDay: sessionSummary.day,
          progressDay: updatedProgress.currentStudyDay ?? null,
          sessionCleared
        },
        sessionCleared ? 'warning' : 'error'
      );
    } catch (logErr) {
      console.error('[SESSION] failed to log day-guard rejection:', logErr);
    }
    return {
      sessionId: null,
      progress: updatedProgress,
      dayGuardRejected: true,
      sessionCleared
    };
  }

  // Optionally save full session record to sessions collection
  // (for detailed history if needed)
  const sessionRef = doc(collection(db, `users/${userId}/sessions`));
  const batch = writeBatch(db);

  // Filter out undefined values to avoid Firestore errors
  const cleanSessionData = Object.fromEntries(
    Object.entries(sessionData).filter(([_, v]) => v !== undefined)
  );

  batch.set(sessionRef, {
    ...cleanSessionData,
    completedAt: Timestamp.now()
  });

  await batch.commit();

  return {
    sessionId: sessionRef.id,
    progress: updatedProgress
  };
}

/**
 * [deepfix P4 · FND-2] SERVER_PROGRESS_WRITE route for recordSessionCompletion.
 *
 * Calls the P3 `completeSession` callable, which performs the transactional day-guard +
 * the csd/twi/summary/stats/streak write server-side (functions/foundation.js — sessionContext
 * contract: {dayNumber, newWordScore?, reviewScore?, segmentStartIndex?, segmentEndIndex?,
 * wordsReviewed?, wordsTested?, clientReviewOnlyDay?, clientWordsIntroduced?}; the server owns
 * csd/twi/wordsIntroduced/interventionLevel — client fields feed only display/stats and the
 * `reviewonly_derivation_mismatch` tripwire). Maps the callable's return onto the exact
 * sentinel shapes today's callers consume (completeSessionFromTest / DailySessionFlow):
 *   • 'day_guard_rejected' → {sessionId:null, progress, dayGuardRejected:true, sessionCleared}
 *     (the SERVER already cleared session_states + logged day_guard_rejected_session_cleared —
 *     the client must NOT re-clear or re-log);
 *   • 'already_completed'  → success-shaped {sessionId:null, progress} (idempotent retry —
 *     no second sessions-history record);
 *   • 'no_evidence' (F-4)  → BLOCKING {sessionId:null, progress:null, completionNotApplied:true,
 *     reason:'no_evidence'} — the server refused to advance (no passed new anchor AND no
 *     server-verified review-only reason); NO sessions-history record is written;
 *   • ANY other/unknown status (fail-closed) → the same blocking sentinel
 *     {completionNotApplied:true, reason:<status>}; only 'completed' or a legacy no-status
 *     payload takes the success path;
 *   • 'completed' (or legacy no-status) → keep today's users/{uid}/sessions history record
 *     (client-owned, not a progress write) and return {sessionId, progress}.
 * NOTE: the returned `progress` carries the server's applied fields (currentStudyDay,
 * totalWordsIntroduced, interventionLevel, stats, streakDays) — not the full legacy doc body.
 * Current consumers read only these + dayGuardRejected + completionNotApplied (verified:
 * studyService.js completeSessionFromTest, DailySessionFlow.jsx completeSession).
 */
async function recordSessionCompletionViaServer(userId, sessionData) {
  const {
    classId,
    listId,
    dayNumber,
    newWordScore,
    reviewScore,
    segment,
    wordsIntroduced,
    wordsReviewed,
    wordsTested,
    clientReviewOnlyDay
  } = sessionData;

  const sessionContext = {
    dayNumber: dayNumber || 1,
    newWordScore: newWordScore ?? null,
    reviewScore: reviewScore ?? null,
    segmentStartIndex: segment?.startIndex || 0,
    segmentEndIndex: segment?.endIndex || 0,
    wordsReviewed: wordsReviewed || 0,
    wordsTested: wordsTested || 0,
  };
  // Optional tripwire fields — only sent when present (the callable serializer must not
  // see `undefined`; the server logs the mismatch only when clientReviewOnlyDay is boolean).
  if (typeof clientReviewOnlyDay === 'boolean') {
    sessionContext.clientReviewOnlyDay = clientReviewOnlyDay;
    sessionContext.clientWordsIntroduced = Number.isFinite(wordsIntroduced) ? wordsIntroduced : null;
  }

  const completeSessionFn = httpsCallable(getFunctions(), 'completeSession', { timeout: 30000 });
  const resp = await completeSessionFn({ classId, listId, sessionContext });
  const data = resp?.data || {};

  if (data.status === 'day_guard_rejected') {
    // Server cleared the stale session doc + wrote the system_logs event (WITH uid) inside
    // the callable — mirror ONLY the legacy sentinel shape here.
    console.warn('[SESSION] day-guard rejection (server) — completion did not apply', {
      userId, classId, listId, sessionDay: dayNumber, progressDay: data.progressDay ?? null
    });
    return {
      sessionId: null,
      progress: {
        id: `${classId}_${listId}`,
        currentStudyDay: data.progressDay ?? null,
        dayGuardRejected: true
      },
      dayGuardRejected: true,
      sessionCleared: data.sessionCleared === true
    };
  }

  if (data.status === 'already_completed') {
    // Idempotent retry of a committed completion — success-shaped, no duplicate history record.
    return {
      sessionId: null,
      progress: data.progress || null
    };
  }

  if (data.status === 'review_recorded') {
    // CS PR-3 · WI-1 (FORCED_PATHWAY_ENABLED, hold-csd): the SERVER recorded the review WITHOUT
    // advancing the day (throttle hold or skip). Success-shaped (NOT an error, NOT completionNotApplied)
    // so the test page shows results + graduation runs; the day simply did not advance. No duplicate
    // history record (the server wrote none). Only reached under SERVER_PROGRESS_WRITE (post-P4).
    console.log('[SESSION] review recorded, csd held (server FORCED_PATHWAY hold-csd)', {
      userId, classId, listId, sessionDay: dayNumber, reviewMode: data.reviewMode ?? null
    });
    return {
      sessionId: null,
      progress: data.progress || null
    };
  }

  if (data.status === 'no_evidence') {
    // [deepfix F-4 client counterpart] The server REFUSED to advance the day: no passed
    // day-N new-word anchor AND no server-verified review-only reason. The transaction wrote
    // NOTHING (no csd/twi advance). Mirror that here: write NO users/{uid}/sessions history
    // record and return a BLOCKING sentinel so completeSessionFromTest skips graduation and
    // the test pages do NOT present success (the F-4 invariant: no evidence → do not complete).
    console.warn('[SESSION] completion refused — no evidence (server); completion did not apply', {
      userId, classId, listId, sessionDay: dayNumber, progressDay: data.progressDay ?? null
    });
    return {
      sessionId: null,
      progress: null,
      completionNotApplied: true,
      reason: 'no_evidence'
    };
  }

  // FAIL-CLOSED (F-4): only an explicit 'completed' status — or a legacy payload that omits
  // `status` entirely (the pre-status callable contract) — proceeds to the success + history
  // write. Any OTHER/unknown status blocks as not-applied; never assume success under
  // SERVER_PROGRESS_WRITE.
  if (data.status != null && data.status !== 'completed') {
    console.warn('[SESSION] unexpected completeSession status — completion not applied (fail-closed)', {
      userId, classId, listId, sessionDay: dayNumber, status: data.status
    });
    return {
      sessionId: null,
      progress: null,
      completionNotApplied: true,
      reason: data.status
    };
  }

  // status === 'completed' (or legacy no-status): keep the legacy users/{uid}/sessions history
  // record (client-owned audit trail; NOT a progress write — the server owns class_progress
  // under this flag).
  const sessionRef = doc(collection(db, `users/${userId}/sessions`));
  const cleanSessionData = Object.fromEntries(
    Object.entries(sessionData).filter(([, v]) => v !== undefined)
  );
  const batch = writeBatch(db);
  batch.set(sessionRef, {
    ...cleanSessionData,
    // Server-derived truth for the record (the client's wordsIntroduced is its preview):
    serverWordsIntroduced: data.wordsIntroduced ?? null,
    serverReviewOnlyDay: data.reviewOnlyDay ?? null,
    completedAt: Timestamp.now()
  });
  await batch.commit();

  return {
    sessionId: sessionRef.id,
    progress: data.progress || null
  };
}

/**
 * Initialize study states for new words
 * 
 * Called when new words are introduced to set up their initial state.
 * 
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @param {Array} words - Array of word objects with { id, position }
 * @param {number} introducedOnDay - Study day number
 * @returns {Promise<void>}
 */
export async function initializeNewWordStates(userId, listId, words, introducedOnDay) {
  if (!words || words.length === 0) return;

  const batch = writeBatch(db);

  for (const word of words) {
    const stateRef = doc(db, `users/${userId}/study_states`, word.id);

    const newState = createStudyState(word.id, listId, word.position, introducedOnDay);
    batch.set(stateRef, newState, { merge: true });
  }

  await batch.commit();
}

/**
 * Get FAILED words from previous new word tests
 *
 * Fetches words that were introduced in previous days but still have FAILED status.
 * These are from passing tests (95%+) where up to 5% of words failed.
 *
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @param {number} endIndexExclusive - End index (exclusive) - words before this index (VIRTUAL under cycling)
 * @param {{ cycling?: boolean, cycleLength?: number }} [options] - P9 lap-bounding (§3c)
 * @returns {Promise<Array>} Array of FAILED word objects
 */
export async function getFailedFromPreviousNewWords(userId, listId, endIndexExclusive, options = {}) {
  const { cycling = false, cycleLength = 0 } = options;
  // P9 · CYC (§3c): the failed-carryover pool is the CURRENT lap's previously-introduced
  // words only — physical positions [0, twi mod cycleLength). Flag-off → bound ===
  // endIndexExclusive → byte-equivalent (identical early-return + identical filter bound).
  const boundExclusive = (cycling && cycleLength > 0)
    ? (endIndexExclusive % cycleLength)
    : endIndexExclusive;
  if (boundExclusive <= 0) return [];

  // Get all words ordered by position
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsQuery = query(wordsRef, orderBy('position', 'asc'));
  const wordsSnap = await getDocs(wordsQuery);

  // Filter to words with position < boundExclusive
  const previousWords = wordsSnap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
    .filter(w => w.position < boundExclusive);

  if (previousWords.length === 0) return [];

  // Get study states for these words
  const wordIds = previousWords.map(w => w.id);
  const studyStates = await getStudyStatesForWords(userId, wordIds);

  // Filter to only FAILED words
  const failedWords = previousWords.filter(word => {
    const state = studyStates[word.id];
    return state?.status === WORD_STATUS.FAILED;
  });

  return failedWords;
}

/**
 * Get new words for today
 *
 * Fetches the next batch of new words from a list.
 *
 * @param {string} listId - List ID
 * @param {number} startIndex - Start index (inclusive) — VIRTUAL index under cycling
 * @param {number} count - Number of words to get
 * @param {boolean} [cycling=false] - P9: route through resolveVirtualRange (wrap the lookup)
 * @returns {Promise<Array>} Array of word objects
 */
export async function getNewWords(listId, startIndex, count, cycling = false) {
  // P9 · CYC (§3c): under cycling the new-word range is VIRTUAL and may straddle the lap
  // boundary (tail of one lap + head of the next), so it goes through the ONE resolver,
  // which wraps positions[i mod cycleLength]. Flag-off (cycling=false, the default for
  // every legacy caller) → the exact legacy position filter below → byte-equivalent.
  if (cycling) {
    return resolveVirtualRange(listId, startIndex, count);
  }
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsQuery = query(wordsRef, orderBy('position', 'asc'));
  const wordsSnap = await getDocs(wordsQuery);

  const allWords = wordsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data()
  }));

  // Filter by position field instead of array slicing
  return allWords.filter(w => w.position >= startIndex && w.position < startIndex + count);
}

/**
 * Build review queue for a session
 * 
 * Combines segment words with today's failed new words.
 * 
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @param {Object} segment - { startIndex, endIndex }
 * @param {number} reviewCount - Target queue size
 * @param {Array<string>} todaysNewFailed - Word IDs that failed today's new word test
 * @returns {Promise<Array>} Review queue
 */
export async function buildReviewQueue(userId, listId, segment, reviewCount, todaysNewFailed = []) {
  if (!segment) return [];

  // Get segment words with study states (resolver: pinned wordIds for new sessions,
  // position range for old in-flight sessions).
  const segmentWords = await resolveSegmentWords(userId, listId, segment);

  // Exclude words still retired as MASTERED. selectReviewQueue has no MASTERED
  // branch, so without this filter mastered words leak into review (and get
  // re-tested/downgraded) once the eligible pool is smaller than reviewCount.
  // Expired MASTERED words are flipped to NEEDS_CHECK by returnMasteredWords at
  // session init, so any word still MASTERED here is within its 21-day rest.
  // excludeRetiredMastered is returnAt-aware (standardized across the engine).
  const eligibleSegmentWords = excludeRetiredMastered(segmentWords);

  // Map to format expected by selectReviewQueue
  const wordsWithState = eligibleSegmentWords.map(w => ({
    ...w,
    id: w.id,
    status: w.studyState?.status || WORD_STATUS.NEVER_TESTED,
    lastQueuedAt: w.studyState?.lastQueuedAt || null,
    queueAppearances: w.studyState?.queueAppearances || 0
  }));

  // Get today's failed words (need full word objects)
  // These are NEW words (not in segment), so fetch them directly by ID
  let todaysFailedWords = [];
  if (todaysNewFailed.length > 0) {
    const failedWordDocs = await Promise.all(
      todaysNewFailed.map(wordId =>
        getDoc(doc(db, 'lists', listId, 'words', wordId))
      )
    );
    todaysFailedWords = failedWordDocs
      .filter(docSnap => docSnap.exists())
      .map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        status: WORD_STATUS.FAILED // These are failed words by definition
      }));
  }

  // Select review queue using algorithm
  return selectReviewQueue(wordsWithState, reviewCount, todaysFailedWords);
}

/**
 * Select words for a test (random)
 * 
 * @param {Array} wordPool - Pool of words to select from
 * @param {number} testSize - Number of words to select
 * @returns {Array} Selected words
 */
export { selectTestWords };

/**
 * G1: Get blind spot pool
 *
 * Returns words that need verification:
 * - NEVER_TESTED status, OR
 * - Last tested > 21 days ago (stale)
 *
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @param {string} classId - Class ID (optional, for caching count)
 * @returns {Promise<Array>} Pool of words needing verification
 */
export async function getBlindSpotPool(userId, listId, classId = null) {
  // Get all words in list
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsSnap = await getDocs(query(wordsRef, orderBy('position', 'asc')));

  const allWords = wordsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));

  if (allWords.length === 0) return [];

  // Get study states
  const wordIds = allWords.map(w => w.id);
  const studyStates = await getStudyStatesForWords(userId, wordIds);

  const now = Date.now();
  const staleThreshold = STUDY_ALGORITHM_CONSTANTS.STALE_DAYS_THRESHOLD * 24 * 60 * 60 * 1000;

  // Filter to blind spots
  const blindSpots = allWords
    .map(word => ({
      ...word,
      studyState: studyStates[word.id] || null
    }))
    .filter(word => {
      const state = word.studyState;

      // No study state = never introduced (skip)
      if (!state) return false;

      // NEVER_TESTED = blind spot
      if (state.status === WORD_STATUS.NEVER_TESTED) return true;

      // Stale = last tested > 21 days ago
      if (state.lastTestedAt) {
        const lastTested = state.lastTestedAt.toMillis?.() || state.lastTestedAt;
        const daysSince = now - lastTested;
        if (daysSince > staleThreshold) return true;
      }

      return false;
    })
    .sort((a, b) => {
      // NEVER_TESTED first
      const aStatus = a.studyState?.status;
      const bStatus = b.studyState?.status;

      if (aStatus === WORD_STATUS.NEVER_TESTED && bStatus !== WORD_STATUS.NEVER_TESTED) return -1;
      if (aStatus !== WORD_STATUS.NEVER_TESTED && bStatus === WORD_STATUS.NEVER_TESTED) return 1;

      // Then by staleness (oldest first)
      const aTime = a.studyState?.lastTestedAt?.toMillis?.() || 0;
      const bTime = b.studyState?.lastTestedAt?.toMillis?.() || 0;
      return aTime - bTime;
    });

  // Cache the count in class_progress if classId provided
  if (classId) {
    try {
      const docId = `${classId}_${listId}`;
      const progressRef = doc(db, `users/${userId}/class_progress`, docId);
      await updateDoc(progressRef, {
        blindSpotCount: blindSpots.length,
        blindSpotCountUpdatedAt: Timestamp.now()
      });
    } catch (err) {
      // Ignore errors - caching is best-effort
      console.warn('Failed to cache blind spot count:', err);
    }
  }

  return blindSpots;
}

/**
 * Get blind spot count for display
 * Optimized version that checks cached count in class_progress first
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @param {string} classId - Class ID (optional, for caching)
 * @returns {Promise<number>} Count of blind spots
 */
export async function getBlindSpotCount(userId, listId, classId = null) {
  // If classId provided, check for cached count in class_progress
  if (classId) {
    try {
      const docId = `${classId}_${listId}`;
      const progressRef = doc(db, `users/${userId}/class_progress`, docId);
      const progressSnap = await getDoc(progressRef);

      if (progressSnap.exists()) {
        const data = progressSnap.data();
        const cachedCount = data.blindSpotCount;
        const cachedAt = data.blindSpotCountUpdatedAt?.toMillis?.() || 0;
        const oneHourAgo = Date.now() - (60 * 60 * 1000);

        // Use cached value if less than 1 hour old
        if (cachedCount !== undefined && cachedAt > oneHourAgo) {
          return cachedCount;
        }
      }
    } catch (err) {
      console.warn('Failed to read cached blind spot count:', err);
    }
  }

  // Fall back to full calculation
  const pool = await getBlindSpotPool(userId, listId, classId);
  return pool.length;
}

/**
 * Get today's study batch for PDF generation.
 * Combines new words + review queue.
 * Returns words with wordIndex preserved.
 * 
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {Object} assignment - Assignment settings
 * @returns {Promise<Array>} Words for today's batch (with wordIndex)
 */
export async function getTodaysBatchForPDF(userId, classId, listId, assignment) {
  // Initialize session to get allocation (testSizeReview calculated internally based on intervention)
  const config = await initializeDailySession(userId, classId, listId, {
    weeklyPace: assignment.pace * (assignment.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK) || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
    studyDaysPerWeek: assignment.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
    testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
    newWordRetakeThreshold: assignment.newWordRetakeThreshold ||
      (Number(assignment.passThreshold) > 0 ? Number(assignment.passThreshold) / 100 : STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD)
  });

  // Get new words (already have wordIndex from getNewWords). P9: pass cyclingActive so a
  // cycling day's straddle range wraps via the resolver (flag-off → legacy filter).
  const newWords = config.newWordCount > 0
    ? await getNewWords(listId, config.newWordStartIndex, config.newWordCount, config.cyclingActive)
    : [];

  // Get failed carryover (words from previous days with FAILED status), lap-bounded under cycling.
  const failedCarryover = await getFailedFromPreviousNewWords(
    userId,
    listId,
    config.newWordStartIndex,
    { cycling: config.cyclingActive, cycleLength: config.cycleLength }
  );

  // Get ALL segment words (full segment, not just prioritized queue)
  let reviewWords = [];
  if (config.segment) {
    reviewWords = await resolveSegmentWords(userId, listId, config.segment);
  }

  // Return structured data for PDF with demarcation
  // Sort by position (word.position is the permanent field)
  return {
    newWords: newWords.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    failedCarryover: failedCarryover.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    reviewWords: reviewWords.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  };
}

/**
 * Get complete batch for PDF (all words in segment, not just priority)
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {Object} assignment - Assignment settings
 * @returns {Promise<Array>} All words in today's segment (with wordIndex)
 */
export async function getCompleteBatchForPDF(userId, classId, listId, assignment) {
  // Initialize session to get segment info
  const config = await initializeDailySession(userId, classId, listId, {
    weeklyPace: assignment.pace * (assignment.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK) || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
    studyDaysPerWeek: assignment.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
    testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
    newWordRetakeThreshold: assignment.newWordRetakeThreshold ||
      (Number(assignment.passThreshold) > 0 ? Number(assignment.passThreshold) / 100 : STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD)
  });

  // Get new words. P9: cyclingActive routes a straddle range through the resolver.
  const newWords = config.newWordCount > 0
    ? await getNewWords(listId, config.newWordStartIndex, config.newWordCount, config.cyclingActive)
    : [];

  // Get ALL words in segment (complete mode)
  let segmentWords = [];
  if (config.segment) {
    segmentWords = await resolveSegmentWords(userId, listId, config.segment);
  }

  // Combine: new words + all segment words (no duplicates)
  const newWordIds = new Set(newWords.map(w => w.id));
  const uniqueSegmentWords = segmentWords.filter(w => !newWordIds.has(w.id));
  const combined = [...newWords, ...uniqueSegmentWords];
  combined.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return combined;
}

/**
 * Graduate a percentage of segment words after review test (segment-wide model).
 * Graduation count = testScore × segment_size, capped at eligible words.
 * Eligible = ALL segment words minus words that failed THIS test.
 *
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @param {{ startIndex: number, endIndex: number }} segment - Review segment
 * @param {number} testScore - Decimal 0-1 (e.g., 0.80 for 80%)
 * @param {string[]} failedWordIds - Word IDs that failed the review test (excluded from graduation)
 * @returns {Promise<{ graduated: number, remaining: number }>}
 */
export async function graduateSegmentWords(userId, listId, segment, testScore, failedWordIds = []) {
  if (!segment) {
    return { graduated: 0, remaining: 0 };
  }

  // 1. Fetch all segment words with current status (resolver: pinned wordIds for new
  //    sessions, position range for old in-flight sessions).
  const segmentWords = await resolveSegmentWords(userId, listId, segment);

  // 2. Segment-wide graduation: eligible = words that didn't fail THIS test, minus any
  //    still-retired MASTERED. For NEW (wordIds) sessions wordIds is already
  //    MASTERED-excluded so the exclude is a no-op; for OLD (position-range) sessions it
  //    prevents re-mastering an already-mastered word and resetting its 21-day clock.
  const failedIds = new Set(failedWordIds);
  const eligibleWords = excludeRetiredMastered(segmentWords).filter(w => !failedIds.has(w.id));

  if (eligibleWords.length === 0) {
    return { graduated: 0, remaining: 0 };
  }

  // 3. Calculate graduation count: X% of SEGMENT SIZE where X = testScore.
  //    NEW shape: segmentSize = the pinned capped wordIds length (the set actually
  //    studied). OLD shape: fall back to the position span. Cap at eligible count.
  const segmentSize = segment.wordIds?.length ?? (segment.endIndex - segment.startIndex + 1);
  const graduateCount = Math.min(
    Math.floor(segmentSize * testScore),
    eligibleWords.length
  );

  if (graduateCount === 0) {
    return { graduated: 0, remaining: eligibleWords.length };
  }

  // 4. Randomly select which words to graduate (Fisher-Yates shuffle + slice)
  const shuffled = shuffleArray(eligibleWords);
  const toGraduate = shuffled.slice(0, graduateCount);

  // 5. Batch update to MASTERED status
  const batch = writeBatch(db);
  const now = Timestamp.now();
  const returnAt = new Timestamp(now.seconds + (21 * 24 * 60 * 60), 0); // 21 days

  for (const word of toGraduate) {
    const stateRef = doc(db, `users/${userId}/study_states`, word.id);
    batch.set(stateRef, {
      status: WORD_STATUS.MASTERED,
      masteredAt: now,
      returnAt: returnAt,
      wordIndex: word.position,
      listId: listId
    }, { merge: true });
  }

  await batch.commit();

  return {
    graduated: toGraduate.length,
    remaining: eligibleWords.length - toGraduate.length
  };
}

/**
 * Check for MASTERED words that should return to pool after 21 days.
 * Call at session initialization.
 *
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @returns {Promise<number>} Number of words returned to pool
 */
export async function returnMasteredWords(userId, listId) {
  const now = Timestamp.now();

  const expiredQuery = query(
    collection(db, 'users', userId, 'study_states'),
    where('listId', '==', listId),
    where('status', '==', WORD_STATUS.MASTERED),
    where('returnAt', '<=', now)
  );

  const expiredSnap = await getDocs(expiredQuery);

  if (expiredSnap.empty) return 0;

  const batch = writeBatch(db);

  for (const docSnap of expiredSnap.docs) {
    batch.set(docSnap.ref, {
      status: WORD_STATUS.NEEDS_CHECK,
      masteredAt: null,
      returnAt: null
    }, { merge: true });
  }

  await batch.commit();
  return expiredSnap.size;
}

/**
 * Get MASTERED words within a position range.
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @param {number} startIndex - Start position (inclusive)
 * @param {number} endIndex - End position (inclusive)
 * @returns {Promise<Array>} Array of word objects with studyState
 */
async function getMasteredWordsInRange(userId, listId, startIndex, endIndex) {
  // Query study_states for MASTERED status (simplified to avoid composite index requirement)
  const statesRef = collection(db, `users/${userId}/study_states`);
  const q = query(statesRef,
    where('listId', '==', listId),
    where('status', '==', WORD_STATUS.MASTERED)
  );
  const snap = await getDocs(q);

  // Filter by wordIndex range in memory
  const filteredDocs = snap.docs.filter(doc => {
    const data = doc.data();
    return data.wordIndex >= startIndex && data.wordIndex <= endIndex;
  });

  // Get word details for each
  const masteredWords = [];
  for (const stateDoc of filteredDocs) {
    const state = stateDoc.data();
    const wordDocRef = doc(db, `lists/${listId}/words`, stateDoc.id);
    const wordDoc = await getDoc(wordDocRef);
    if (wordDoc.exists()) {
      masteredWords.push({
        id: stateDoc.id,
        ...wordDoc.data(),
        studyState: state
      });
    }
  }

  // Sort by position
  masteredWords.sort((a, b) => (a.position ?? a.studyState?.wordIndex ?? 0) - (b.position ?? b.studyState?.wordIndex ?? 0));

  return masteredWords;
}

/**
 * Get debug data for the SegmentDebugPanel.
 * Returns session config, review queue, full segment words, and mastered words.
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {Object} assignment - Assignment settings
 * @returns {Promise<{ sessionConfig, reviewQueue, segmentWords, masteredWords }>}
 */
export async function getDebugSessionData(userId, classId, listId, assignment) {
  // Get full session config (without initializing new word states)
  // Transform assignment to match getTodaysBatchForPDF pattern (pace -> weeklyPace)
  const sessionConfig = await initializeDailySession(userId, classId, listId, {
    weeklyPace: assignment.pace * (assignment.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK) || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
    studyDaysPerWeek: assignment.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
    testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
    newWordRetakeThreshold: assignment.newWordRetakeThreshold ||
      (Number(assignment.passThreshold) > 0 ? Number(assignment.passThreshold) / 100 : STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD)
  });

  let reviewQueue = [];
  let segmentWords = [];
  let masteredWords = [];

  if (sessionConfig.segment) {
    // Get the prioritized review queue
    reviewQueue = await buildReviewQueue(
      userId,
      listId,
      sessionConfig.segment,
      sessionConfig.reviewCount,
      [] // No today's failed for debug view
    );

    // Get ALL segment words (not just the queue)
    segmentWords = await resolveSegmentWords(userId, listId, sessionConfig.segment);

    // Get MASTERED words in segment range (debug display only — position-range hint is
    // acceptable here; this view never resolves words for study/test/graduation).
    masteredWords = await getMasteredWordsInRange(
      userId,
      listId,
      sessionConfig.segment.startIndex,
      sessionConfig.segment.endIndex
    );
  }

  return {
    sessionConfig,
    reviewQueue,
    segmentWords,
    masteredWords
  };
}

/**
 * Complete a session from within a test component.
 *
 * Called at test submission time (before navigation) to ensure session completion
 * happens atomically with the test attempt, preventing state loss on navigation failures.
 *
 * Reads segment, interventionLevel, wordsIntroduced, wordsReviewed from sessionStorage
 * (same data source as the original completeSession in DailySessionFlow).
 *
 * For Day 1: Only new word test results needed.
 * For Day 2+: Queries the new word attempt from Firestore to get newWordScore.
 *
 * @param {Object} params - Completion parameters
 * @param {string} params.userId - User ID
 * @param {string} params.classId - Class ID
 * @param {string} params.listId - List ID
 * @param {number} params.dayNumber - Study day number
 * @param {boolean} params.isFirstDay - Whether this is Day 1 (no review test)
 * @param {string} params.testType - 'new' or 'review'
 * @param {Object} params.testResults - { score, correct, total, failed }
 * @returns {Promise<Object>} Result with sessionId and progress
 */
export async function completeSessionFromTest({
  userId,
  classId,
  listId,
  dayNumber,
  isFirstDay,
  testType,
  testResults,
  // CS PR-3 · WI-1 (FORCED_PATHWAY): review engagement inputs (read ONLY under the flag). Callers
  // pass these gated, so flag-off the whole hold-csd routing is inert (byte-equivalent). reviewAnswered
  // = non-empty answered count of the just-submitted review (the F3 >=80% gate); reviewAttemptId = the
  // review attempt doc id (recordReviewOutcome idempotency — no day-guard on the hold path).
  reviewAnswered,
  reviewAttemptId
}) {
  // Read session data from sessionStorage (same source as original completeSession)
  let sessionState = null;
  try {
    const savedState = sessionStorage.getItem('dailySessionState');
    if (savedState) {
      sessionState = JSON.parse(savedState);
    }
  } catch (err) {
    console.warn('completeSessionFromTest: Could not read sessionStorage', err);
  }

  // Extract values from sessionStorage (with fallbacks)
  const segment = sessionState?.sessionConfig?.segment || null;
  const interventionLevel = sessionState?.sessionConfig?.interventionLevel || 0;
  // Use sessionConfig.newWordCount as source of truth (calculated at session init).
  // NEED_TO_FIX #9 (Fix A): treat an EXPLICIT 0 as authoritative — a REVIEW_STUDY resume sets
  // newWordCount=0, and `||` (0 is falsy) would fall through to newWords.length, which the
  // reload-to-test recovery path populates with the review pool → a mid-review reload would
  // re-add it to TWI. FLAG-GATED so the flag-off path keeps the exact legacy `||` expression
  // (Run-L byte-equivalence); only under LIST_SCOPED_RECON does an explicit 0 stay durable.
  const cfgNewWordCount = sessionState?.sessionConfig?.newWordCount;
  // NEED_TO_FIX #11 — review-only day completion (PLAN_review_only_day_completion.md). A day that ASSIGNED
  // zero new words (intervention throttle interv=1.0 → newWords=0, OR list-end wordsRemaining<=0) is a
  // legitimately REVIEW-ONLY day: it has no new-word test, so the Day-2+ gate below must NOT block it — else
  // the review that would lower intervention is never recorded (recordSessionCompletion runs only on
  // completion) → PERMANENT stuck state. Flag-gated: the review-only CSD advance survives only via the
  // non-demoting CSD guarantee under LIST_SCOPED_RECON. Use <= 0 (not === 0): newWordCount =
  // min(allocation.newWords, wordsRemaining) can be NEGATIVE on over-introduction; ≤0 still means "no new
  // words assignable," never "assigned-and-failed," and it matches isListComplete (wordsRemaining <= 0).
  // A finite ≤0 cfgNewWordCount is a LEGIT review-only day ONLY when a session-config reason CONFIRMS that
  // zero new words were assignable — otherwise a STALE (or forged) finite 0 on an ordinary assigned-new day
  // would false-open the gate (Codex ROI-1 / acceptance test 4b). The three legit causes are all authoritative
  // fields written by initializeDailySession and persisted verbatim in dailySessionState (both persist sites
  // store the full sessionConfig — verified DailySessionFlow.jsx:1161 main path + :703 recovery path):
  //   • intervention throttle          → allocation.newWords <= 0   (studyService.js:182,235,286)
  //   • list end / over-introduced list → isListComplete === true   (:314)
  //   • Fix #9 review-resume (new already passed in another class, nwCount forced to 0) → startPhase REVIEW_STUDY (:264,317)
  const sessionCfg = sessionState?.sessionConfig || {};
  const allocationNewWords = sessionCfg?.allocation?.newWords;
  const reviewOnlyReasonConfirmed =
    (Number.isFinite(allocationNewWords) && allocationNewWords <= 0) ||
    sessionCfg.isListComplete === true ||
    sessionCfg.startPhase === SESSION_PHASE.REVIEW_STUDY;
  const reviewOnlyDay = LIST_SCOPED_RECON
    && Number.isFinite(cfgNewWordCount) && cfgNewWordCount <= 0
    && reviewOnlyReasonConfirmed;

  // ── CS PR-3 · WI-1 (FORCED_PATHWAY): hold-csd + F3-engagement routing (Day-2+ review only) ──
  // Flag-off: every fp* is false → the legacy advance path runs verbatim (byte-equivalent).
  const fpReview = FORCED_PATHWAY && testType === 'review' && !isFirstDay;
  // THROTTLE review-only day = review mode drove 0 new words (allocation.newWords <= 0) and it is
  // NEITHER the list-end (isListComplete) NOR the #9-resume (startPhase REVIEW_STUDY) review-only
  // case — those still advance (David: "engaged normal/list-end/#9-resume → advance", #11 preserved).
  const fpThrottleReviewOnly = fpReview
    && Number.isFinite(allocationNewWords) && allocationNewWords <= 0
    && sessionCfg.isListComplete !== true
    && sessionCfg.startPhase !== SESSION_PHASE.REVIEW_STUDY;
  // F3 engagement of the JUST-SUBMITTED review (>= 80% answered). Grandfather is inert for a fresh
  // review (submittedAt = now >= epoch); isCompletionEngaged reuses the ONE census predicate over a
  // synthetic attempt (no answers[] → answered = totalQuestions − skipped = reviewAnswered).
  const fpTotal = Number.isFinite(testResults?.total) ? testResults.total : 0;
  const fpAnswered = Number.isFinite(reviewAnswered) ? reviewAnswered : fpTotal;
  const fpEngaged = !fpReview || isCompletionEngaged({
    sessionType: 'review',
    totalQuestions: fpTotal,
    skipped: Math.max(0, fpTotal - fpAnswered),
    submittedAt: Timestamp.now()
  });
  // HOLD csd when a SKIP (F3 gate — record 0, no advance, kills the #16 runaway) OR a THROTTLE
  // review-only day (David-locked hold — stay on the day until the review average escapes review
  // mode). Suppressed under SERVER_PROGRESS_WRITE: the server then owns class_progress and holds via
  // completeSession `review_recorded` (FORCED_PATHWAY_ENABLED), so the client must not double-write.
  const fpHoldCsd = fpReview && !SERVER_PROGRESS_WRITE && (!fpEngaged || fpThrottleReviewOnly);
  // Durable words-introduced count: CLAMP to >= 0. cfgNewWordCount feeds updateClassProgress's
  // `totalWordsIntroduced += wordsIntroduced`, so an unclamped negative would DECREMENT TWI. A review-only day
  // introduces 0 → TWI stays flat.
  const wordsIntroduced = reviewOnlyDay ? 0
    : (LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)
        ? cfgNewWordCount
        : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0));
  const wordsReviewed = sessionState?.reviewQueue?.length || 0;

  console.log('completeSessionFromTest called:', {
    userId,
    classId,
    listId,
    dayNumber,
    isFirstDay,
    testType,
    score: testResults?.score,
    wordsIntroduced,
    segment: segment
      ? (segment.wordIds?.length != null
          ? `${segment.wordIds.length} wordIds`
          : `${segment.startIndex}-${segment.endIndex}`)
      : null
  });

  let newWordScore = null;
  let reviewScore = null;
  let reviewFailed = [];
  let newWordAttemptPassed = null; // authoritative passed flag from the attempt doc

  // Get threshold from sessionStorage config, fallback to constant
  const threshold = sessionState?.sessionConfig?.retakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD;

  if (isFirstDay) {
    // Day 1: Only new word test, no review
    newWordScore = testResults.score;

    // Update session_states with pass status immediately (prevents race condition)
    await saveSessionState(userId, classId, listId, {
      newWordsTestScore: newWordScore,
      newWordsTestPassed: newWordScore >= threshold,
      phase: SESSION_PHASE.COMPLETE
    });
  } else {
    // Day 2+: This is a review test - need to get new word score from earlier attempt
    reviewScore = testResults.score;
    reviewFailed = testResults.failed || [];

    // Query the new word attempt for this day. Under LIST_SCOPED_RECON the gate accepts
    // a same-day pass earned in ANY of the student's classes (shared truth, §2.1 of
    // PLAN_list_progress_persist) — position-consistency is enforced INSIDE
    // getNewWordAttemptForDay [V4 / Codex-P1-2]: exact newWordStartIndex match required
    // for cross-class trust (fail-closed to the launching class otherwise), and
    // candidates are scanned so a newest-but-inconsistent attempt can't block an
    // earlier consistent one.
    const newWordAttempt = await getNewWordAttemptForDay(userId, classId, listId, dayNumber, {
      listScope: LIST_SCOPED_RECON,
      expectedBase: sessionState?.sessionConfig?.newWordStartIndex
    });
    if (newWordAttempt) {
      // Convert score from 0-100 to 0-1 if needed
      newWordScore = newWordAttempt.score <= 1
        ? newWordAttempt.score
        : newWordAttempt.score / 100;
      // The attempt's `passed` flag is authoritative: it was computed at submission
      // against the CLASS's real passThreshold (and covers teacher manual overrides
      // where passed=true with a lower score). The local `threshold` may be a wrong
      // default (0.95) because assignments don't store newWordRetakeThreshold.
      newWordAttemptPassed = newWordAttempt.passed === true;
    } else if (reviewOnlyDay) {
      // Legitimately REVIEW-ONLY day (0 new words assigned): there is NO new-word test to find, and its
      // absence is EXPECTED — not a fault. Keep newWordScore LITERAL null (not 0) so it is excluded from
      // avgNewWordScore (progressService filters null scores) and renders as "—" rather than a spurious
      // "New: 0%". The gate below is skipped for this day, so this null never drives a not-passed decision.
      newWordScore = null;
    } else {
      console.warn(`completeSessionFromTest: Could not find new word attempt for day ${dayNumber}`);
      // No prior new-word attempt found on a day that WAS assigned new words: keep newWordScore a valid
      // number (0) rather than undefined, so the gate below evaluates as not-passed and blocks. (0 >=
      // threshold === false.)
      newWordScore = 0;
    }

    // Gate (Day 2+) — CHECKED BEFORE writing COMPLETE. Never complete/advance the day
    // unless the day's new-word test was passed. The review test is the "final" test and
    // always passes, so without this a student who failed the new-word test but reached
    // review would advance CSD anyway. CRITICAL ORDERING: this must run before the
    // saveSessionState(... phase: COMPLETE ...) below — otherwise the durable session_state
    // cache gets stamped COMPLETE even though we return requiresNewWordRetake, leaving
    // contradictory state for UI/support/admin tooling (audit Blocker, 2026-06-17).
    // reviewOnlyDay short-circuits the gate: a day that assigned zero new words has no new-word test to pass,
    // so blocking it would strand the review (never recorded → intervention never drops → permanent stuck
    // state, NEED_TO_FIX #11). newWordScore is null on that path; `null < threshold` would coerce to true, so
    // the explicit !reviewOnlyDay guard — not the score comparison — is what lets the review-only day through.
    if (!reviewOnlyDay && newWordAttemptPassed !== true && newWordScore < threshold) {
      console.warn('completeSessionFromTest: Day 2+ completion blocked — new-word test not passed', {
        dayNumber, newWordScore, threshold, newWordAttemptPassed
      });
      return {
        sessionId: null,
        progress: null,
        graduated: 0,
        requiresNewWordRetake: true
      };
    }

    // Update session_states with final status (prevents race condition). Only reached once the Day-2+ gate
    // above has passed (or the day is review-only). The new-word fields are LITERAL null ONLY when no real
    // new-word attempt existed for the day — i.e. `newWordScore === null`, set solely by the
    // `else if (reviewOnlyDay)` no-attempt branch above. It is NOT keyed on reviewOnlyDay itself: a Fix #9
    // REVIEW_STUDY resume IS a reviewOnlyDay yet has a genuine PASSING new-word attempt (found above), and its
    // real score must persist so session_state matches the summary/recentSessions (Lens A #1). Literal null
    // (never `null >= threshold`, which coerces to a contradictory `false`). reviewOnlyDay:true is a
    // write-only marker for future support/admin tooling (no consumer yet; deliberately not on the summary).
    const newAttemptMissing = newWordScore === null;
    await saveSessionState(userId, classId, listId, {
      newWordsTestScore: newWordScore,
      newWordsTestPassed: newAttemptMissing ? null : (newWordScore >= threshold),
      reviewTestScore: reviewScore,
      ...(reviewOnlyDay ? { reviewOnlyDay: true } : {}),
      // CS PR-3 · WI-1 (FORCED_PATHWAY, F3): a non-engaged SKIP must NOT mark the day done — it
      // routes to REVIEW_STUDY so re-entry offers a retake (the day only advances on an engaged
      // review). An engaged review (advance OR David-locked throttle-hold) keeps COMPLETE. Flag-off:
      // fpReview false → SESSION_PHASE.COMPLETE verbatim (byte-equivalent).
      phase: (fpReview && !fpEngaged) ? SESSION_PHASE.REVIEW_STUDY : SESSION_PHASE.COMPLETE
    });
  }

  // Build session summary
  const summary = {
    classId,
    listId,
    dayNumber,
    interventionLevel,
    newWordScore,
    reviewScore,
    segment,
    wordsIntroduced,
    wordsReviewed,
    wordsTested: testResults.total || 0,
    // [P9 · CYC · U5] cycling state → updateClassProgress resets intervention at a lap boundary. Inert when
    // off (cyclingActive=false ⇒ no reset); consumed by recordSessionCompletion, not persisted to the record.
    cyclingActive: sessionCfg.cyclingActive === true,
    cycleLength: sessionCfg.cycleLength || 0,
    // [deepfix P4, flag-gated] the client's reviewOnlyDay PREVIEW rides along for the server's
    // `reviewonly_derivation_mismatch` tripwire (the server derives authoritatively; this field
    // is compare-only). Flag OFF → field absent → summary byte-identical to today.
    ...(SERVER_PROGRESS_WRITE ? { clientReviewOnlyDay: reviewOnlyDay } : {})
  };

  // Record session completion (advances CSD, recentSessions, etc.) — OR, under FORCED_PATHWAY
  // hold-csd, record the review outcome WITHOUT advancing the day (recordReviewOutcome: append the
  // review summary + reviewMode bit + stats/streak; NEVER writes currentStudyDay/twi). Flag-off /
  // non-hold: recordSessionCompletion exactly as today (byte-equivalent).
  const result = fpHoldCsd
    ? await recordReviewOutcome(userId, summary, reviewAttemptId)
    : await recordSessionCompletion(userId, summary);

  // [Codex-P1-3 / P1r4-1] Day-guard rejection: the completion did NOT apply. Skip
  // graduation and return the rebuild sentinel — the test pages must NOT present this
  // as success, and sessionCleared is PROPAGATED so the UI can distinguish "session
  // reset, continue normally" from "stale session doc survived — recovery needed".
  if (result?.dayGuardRejected) {
    return {
      sessionId: null,
      progress: null,
      graduated: 0,
      requiresSessionRebuild: true,
      sessionCleared: result.sessionCleared === true
    };
  }

  // [deepfix F-4 client counterpart] The server refused this completion for lack of
  // evidence (no passed new anchor + not review-only) — or returned an unknown status
  // (fail-closed). The completion did NOT apply: skip graduation and return the blocking
  // sentinel so the test pages present the retry/pass-new-test UX, never success. The
  // attempt itself is already saved.
  if (result?.completionNotApplied) {
    return {
      sessionId: null,
      progress: null,
      graduated: 0,
      completionNotApplied: true,
      reason: result.reason || 'not_applied'
    };
  }

  // Graduate words if this was a review test with a score
  let graduationResult = null;
  if (segment && reviewScore != null) {
    graduationResult = await graduateSegmentWords(
      userId,
      listId,
      segment,
      reviewScore,
      reviewFailed
    );
    console.log(`Graduated ${graduationResult.graduated} words to MASTERED`);
  }

  return {
    sessionId: result.sessionId,
    progress: result.progress,
    graduated: graduationResult?.graduated || 0
  };
}

