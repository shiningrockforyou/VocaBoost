import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  Timestamp,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  DEFAULT_CLASS_PROGRESS,
  createClassProgress,
  createSessionSummary,
  MAX_RECENT_SESSIONS,
  implausibleStudyDayThreshold
} from '../types/studyTypes';
import { getRecentAttemptsForClassList, getMostRecentPassedNewTest, getReviewForDay, logSystemEvent } from './db';
import { LIST_SCOPED_RECON, SERVER_PROGRESS_WRITE, REVIEW_PAIRING_V2, FORCED_PATHWAY } from '../config/featureFlags';
// CS PR-1 · WI-2: reconciliation candidate window 8→12 under REVIEW_PAIRING_V2 (multi-review
// days must not push the day's passed-new anchor out of the window). Flag-off: literal 8.
import { RECENT_ATTEMPTS_WINDOW } from '../utils/reviewPairing';
// CS PR-3 · WI-1 (FORCED_PATHWAY): the binary-throttle mode owner (deriveThrottleMode). Consumed
// only under the flag by updateClassProgress + recordReviewOutcome; flag-off it is never read.
import { deriveThrottleMode } from '../utils/forcedPathway';

// Observability-only (v5): a clean no-anchor record with CSD above this is worth a
// `csd_implausible` check (a legit student with no passed new test has CSD ≈ 0). Not a clamp.
const CSD_IMPLAUSIBLE_MIN = 3;

/**
 * Get the document ID for a class progress record
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {string} Document ID in format "{classId}_{listId}"
 */
export function getProgressDocId(classId, listId) {
  return `${classId}_${listId}`;
}

/**
 * Clean up orphaned review tests - reviews for days beyond the anchor day.
 * These occur when race conditions cause review tests to be submitted without
 * a corresponding new test. Orphaned reviews are logged to system_logs before deletion.
 *
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @param {number} anchorDay - The anchor day (highest day with a new test)
 * @param {Array} attempts - Array of attempt documents
 */
async function cleanupOrphanedReviews(userId, classId, listId, anchorDay, attempts, { logOnly = false } = {}) {
  // Find orphaned reviews: review tests for days beyond the anchor
  const orphanedReviews = attempts.filter(
    a => a.sessionType === 'review' && a.studyDay > anchorDay
  );

  if (orphanedReviews.length === 0) {
    return;
  }

  console.log(`[RECONCILIATION] Found ${orphanedReviews.length} orphaned review(s)${logOnly ? ' (LOG-ONLY, no deletion)' : ' to clean up'}`);

  for (const orphan of orphanedReviews) {
    try {
      // 1. Save to system_logs as string before deletion
      const logEntry = {
        type: logOnly ? 'orphaned_attempt_flagged' : 'orphaned_attempt_deleted',
        userId,
        classId,
        listId,
        attemptId: orphan.id,
        attemptData: JSON.stringify(orphan), // Full attempt as string
        anchorDay,
        reason: `Review for Day ${orphan.studyDay} ${logOnly ? 'flagged' : 'deleted'} - no matching new test exists`,
        deletedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'system_logs'), logEntry);

      // 2. Delete the orphaned attempt — SKIPPED under LIST_SCOPED_RECON [C5-2]:
      // a position-max anchor can carry a LOWER studyDay than legitimate reviews
      // (cross-pace, same-class pace change, pre-reset history), so "studyDay > anchorDay"
      // is no longer proof of orphanhood. Log-only until attempts carry a reliable
      // generation/reset-epoch tag (grading rework). Orphans are harmless to position
      // (the anchor, not the review count, drives CSD/TWI).
      if (!logOnly) {
        await deleteDoc(doc(db, 'attempts', orphan.id));
        console.log(`[RECONCILIATION] Deleted orphaned review: Day ${orphan.studyDay}, attemptId: ${orphan.id}`);
      }
    } catch (err) {
      console.error(`[RECONCILIATION] Failed to ${logOnly ? 'flag' : 'clean up'} orphaned review ${orphan.id}:`, err);
      // Continue with other orphans even if one fails
    }
  }
}

/**
 * Get or create class progress for a student.
 * Includes reconciliation against actual attempts to fix any CSD/TWI mismatches.
 *
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {Promise<{ progress: Object, attempts: Array }>} Progress document and recent attempts
 */
export async function getOrCreateClassProgress(userId, classId, listId) {
  // [deepfix P4 · FND-2, SERVER_PROGRESS_WRITE] Route hydration through the READ-ONLY
  // `resolveListProgress` callable: the SERVER performs today's entry-time reconciliation
  // (create-on-miss + the F4-1 recon write on the launching legacy doc, byte-parity
  // semantics) and logs resolve_list_progress / quarantine candidates. The callable is
  // SELF-SERVICE (uid = caller), so only route when this call is for the signed-in user —
  // any other caller falls through to the legacy client path unchanged.
  if (SERVER_PROGRESS_WRITE && auth.currentUser?.uid === userId) {
    // Route hydration through the read-only resolver. Retry ONCE (a transient callable
    // cold-start / network blip), then FAIL CLOSED. [Codex P6 R1 over-deny fix] Under the P6
    // rules cutoff the legacy client setDoc/updateDoc below is DENIED (permission-denied on
    // class_progress), so falling through on a resolver outage would strand a LIVE student
    // with a raw Firestore error at session entry. A typed `progress_resolver_unavailable`
    // error lets the entry-time catches show the controlled reload/retry UX instead of a raw
    // permission failure — and, critically, we perform NO client write on this path.
    let routed = await getOrCreateClassProgressViaResolver(userId, classId, listId);
    if (!routed) {
      routed = await getOrCreateClassProgressViaResolver(userId, classId, listId);
    }
    if (routed) return routed;
    // Both attempts failed → do NOT fall through to a client write (P6 would deny it).
    try {
      await logSystemEvent('progress_resolver_unavailable', {
        userId, classId, listId, source: 'getOrCreateClassProgress',
      }, 'error');
    } catch { /* observability only — never mask the typed error below */ }
    const resolverErr = new Error('Progress could not be loaded — please reload to continue.');
    resolverErr.code = 'progress_resolver_unavailable';
    throw resolverErr;
  }
  console.log('[RECONCILIATION] ═══════════════════════════════════════');
  console.log('[RECONCILIATION] getOrCreateClassProgress START');
  console.log('[RECONCILIATION] Params:', { userId, classId, listId });

  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);

  const snapshot = await getDoc(progressRef);
  let progress;

  if (snapshot.exists()) {
    progress = { id: snapshot.id, ...snapshot.data() };
    console.log('[RECONCILIATION] Found existing progress document');
  } else {
    // Create new progress document
    console.log('[RECONCILIATION] No progress document found, creating new one');
    const newProgress = createClassProgress(classId, listId);
    await setDoc(progressRef, {
      ...newProgress,
      programStartDate: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    progress = { id: docId, ...newProgress };
  }

  // Check for mismatch and reconcile
  const storedCSD = progress.currentStudyDay || 0;
  const storedTWI = progress.totalWordsIntroduced || 0;
  console.log('[RECONCILIATION] Stored values from Firestore:', { storedCSD, storedTWI });

  // === TWO-QUERY RECONCILIATION ===
  // Query 1: Find anchor from PASSED new tests only (fixes bug where failed tests advanced TWI)
  console.log('[RECONCILIATION] Query 1: Finding most recent PASSED new test...');
  const anchorResult = await getMostRecentPassedNewTest(userId, classId, listId);
  // Preserve the existing anchorTest semantics (the attempt, or null) so all reconciliation
  // logic below is byte-for-byte unchanged; the discriminated status is used for logging only.
  const anchorTest = anchorResult.status === 'found' ? anchorResult.attempt : null;

  let anchorDay = 0;
  let twi = 0;
  let csd = 0;
  let reviewLookupFailed = false; // [Codex-P1-1] query-error must not move CSD at all

  if (anchorTest && anchorTest.newWordEndIndex != null) {
    anchorDay = anchorTest.studyDay;
    twi = anchorTest.newWordEndIndex + 1;

    // Query 2: Check if review exists for anchor day
    console.log('[RECONCILIATION] Query 2: Checking for review on day', anchorDay);

    if (anchorDay === 1) {
      // Day 1: CSD = 1 (already passed since we only query passed tests)
      csd = 1;
      console.log('[RECONCILIATION] Day 1 anchor: CSD = 1');
    } else {
      // Day 2+: Check if review exists. Under LIST_SCOPED_RECON the review is paired to the
      // anchor's PROGRESSION by POSITION range + temporal lineage (§5.1, NEED_TO_FIX #9 Fix B) —
      // NOT by class or studyDay alone — so a cross-pace/cross-class same-studyDay review at a
      // different word position cannot falsely complete the day [V4/F9-1]. Pass the anchor's
      // position range so getReviewForDay can recognize a review earned in ANY of the student's
      // classes that covers this exact anchor range.
      const reviewResult = await getReviewForDay(userId, classId, listId, anchorDay, {
        anchorClassId: anchorTest.classId,
        anchorSubmittedAt: anchorTest.submittedAt,
        anchorNewWordStartIndex: anchorTest.newWordStartIndex,
        anchorNewWordEndIndex: anchorTest.newWordEndIndex
      });
      const reviewForAnchorDay = reviewResult.status === 'found' ? reviewResult.attempt : null;
      if (reviewResult.status === 'query-error') {
        // [C3-6 / Codex-P1-1] An errored lookup is NOT "no review" — and it must not move
        // CSD in EITHER direction. (Math.max(storedCSD, anchorDay-1) would ADVANCE a
        // stored CSD of 2 to 4 on a failed query with anchorDay 5 — unverified data.)
        // Under LIST_SCOPED_RECON the safeCSD computation below pins CSD to storedCSD
        // when this flag is set; TWI reconciliation is independent and proceeds normally.
        reviewLookupFailed = true;
        console.warn('[RECONCILIATION] getReviewForDay query-error — CSD will be preserved at stored value:', reviewResult.error?.code);
      }
      csd = reviewForAnchorDay ? anchorDay : anchorDay - 1;
      console.log('[RECONCILIATION] Day 2+ anchor: CSD =', csd, '(reviewExists:', !!reviewForAnchorDay, ')');
    }

    console.log('[RECONCILIATION] Anchor-based calculation:', {
      anchorDay,
      anchorTestId: anchorTest.id,
      newWordEndIndex: anchorTest.newWordEndIndex,
      twi,
      csd
    });
  } else {
    console.log('[RECONCILIATION] No passed new tests found, using defaults: CSD=0, TWI=0');
  }

  // Fetch recent attempts for orphan cleanup and validation
  console.log('[RECONCILIATION] Fetching recent attempts for orphan cleanup...');
  const attempts = await getRecentAttemptsForClassList(userId, classId, listId, REVIEW_PAIRING_V2 ? RECENT_ATTEMPTS_WINDOW : 8);

  // Clean up orphaned reviews (reviews for days beyond anchor).
  // LIST_SCOPED_RECON → LOG-ONLY [C5-2]: with a list-wide, position-selected anchor,
  // "studyDay > anchorDay" no longer proves orphanhood across mixed histories.
  if (anchorDay > 0) {
    await cleanupOrphanedReviews(userId, classId, listId, anchorDay, attempts, { logOnly: LIST_SCOPED_RECON });
  }

  // Validate that we have trustworthy anchor data
  const hasValidData = anchorTest != null &&
    Number.isInteger(anchorTest.studyDay) && anchorTest.studyDay > 0 &&
    Number.isInteger(anchorTest.newWordEndIndex) && anchorTest.newWordEndIndex >= 0;

  console.log('[RECONCILIATION] Data validation:', {
    hasValidData,
    validationReason: hasValidData
      ? 'Anchor test has valid studyDay and newWordEndIndex'
      : 'No valid anchor - will use Math.max for safety'
  });

  // Trust anchor as source of truth when data is valid
  // Otherwise use Math.max to protect against query failures.
  //
  // LIST_SCOPED_RECON [C3-5]: CSD is NON-DEMOTING (day = session count, §2.2 of the plan).
  // Cross-pace, the position-max anchor can carry a LOWER studyDay than a slower-pace
  // class's legitimate day counter (pace-80 Day 8 / word 639 out-positions pace-20 Day 15 /
  // word 299) — demoting would erase real session history. A too-high CSD is harmless
  // (next session is just numbered csd+1); genuine CSD corruption stays visible via the
  // csd_implausible observability below and is handled by manual triage.
  // TWI stays anchor-authoritative (bidirectional): position is exactly what the anchor proves.
  // [Codex-P1-1] reviewLookupFailed → CSD stays EXACTLY storedCSD (an errored review
  // lookup is unverified data — it must neither demote NOR advance). TWI is independent
  // (anchor-derived, not review-derived) and reconciles normally.
  const safeCSD = LIST_SCOPED_RECON
    ? (reviewLookupFailed ? storedCSD : Math.max(storedCSD, csd))
    : (hasValidData ? csd : Math.max(storedCSD, csd));
  const safeTWI = hasValidData ? twi : Math.max(storedTWI, twi);

  console.log('[RECONCILIATION] Comparison:', {
    stored: { csd: storedCSD, twi: storedTWI },
    calculated: { csd, twi },
    safe: { csd: safeCSD, twi: safeTWI },
    reconciliationMode: LIST_SCOPED_RECON
      ? 'list-scoped (twi bidirectional, csd non-demoting)'
      : (hasValidData ? 'bidirectional' : 'one-way (Math.max protection)'),
    needsUpdate: safeCSD !== storedCSD || safeTWI !== storedTWI
  });

  if (safeCSD !== storedCSD || safeTWI !== storedTWI) {
    console.warn('[RECONCILIATION] 🔄 RECONCILING - Mismatch detected!');
    console.warn('[RECONCILIATION] Updating Firestore document...');

    // Log the reconciliation event
    logSystemEvent('csd_twi_reconciled', {
      userId,
      classId,
      listId,
      stored: { csd: storedCSD, twi: storedTWI },
      calculated: { csd, twi },
      applied: { csd: safeCSD, twi: safeTWI },
      attemptCount: attempts.length
    });

    // Update progress document
    const updates = {
      currentStudyDay: safeCSD,
      totalWordsIntroduced: safeTWI,
      updatedAt: Timestamp.now()
    };

    await updateDoc(progressRef, updates);
    progress = { ...progress, ...updates };

    console.log('[RECONCILIATION] ✅ Update complete');
  } else {
    console.log('[RECONCILIATION] ✓ No reconciliation needed - values match');
  }

  // ── Observability only (v5): surface anomalous CSD WITHOUT auto-correcting. ──
  // A forward-corrupt CSD self-heals above on the bidirectional path (valid anchor); these
  // logs catch the cases that do NOT self-heal — no anchor, malformed anchor, or a query
  // failure — so the issue is visible for manual intervention. Nothing here changes CSD/TWI.
  // Wrapped so logging can never break reconciliation.
  try {
    let anchorStatus;
    if (anchorResult.status === 'query-error') anchorStatus = 'query-error';
    else if (anchorResult.status === 'none') anchorStatus = 'none';
    else anchorStatus = hasValidData ? 'found' : 'invalid-anchor';

    if (anchorStatus === 'query-error') {
      // Transient/index/security failure — must NOT be read as "no progress". Log, don't act.
      await logSystemEvent('csd_anchor_query_error', {
        userId, classId, listId, storedCSD, storedTWI, error: anchorResult.error
      }, 'warning');
    } else if (anchorStatus === 'invalid-anchor') {
      // A passed anchor exists but is malformed (e.g. legacy missing newWordEndIndex).
      // The student HAS progressed, so this is not proof of corruption — log for visibility.
      await logSystemEvent('csd_anchor_invalid', {
        userId, classId, listId, storedCSD, storedTWI,
        anchorStudyDay: anchorTest?.studyDay ?? null,
        anchorNewWordEndIndex: anchorTest?.newWordEndIndex ?? null,
        reason: 'passed anchor missing/invalid newWordEndIndex'
      }, 'warning');
    } else if (anchorStatus === 'none' && storedCSD > CSD_IMPLAUSIBLE_MIN) {
      // Clean no-anchor with an elevated CSD: a legit student here has CSD ≈ 0. Compute a
      // conservative threshold (settings-gated). If settings are unavailable -> skip; never guess.
      let threshold = null;
      try {
        const classSnap = await getDoc(doc(db, 'classes', classId));
        const assignment = classSnap.exists() ? classSnap.data()?.assignments?.[listId] : null;
        if (assignment) {
          const programStartDate = progress.programStartDate?.toDate?.() || progress.programStartDate || null;
          threshold = implausibleStudyDayThreshold({
            programStartDate,
            studyDaysPerWeek: assignment.studyDaysPerWeek || 5,
            totalWordsIntroduced: storedTWI,
            dailyPace: assignment.pace
          });
        }
      } catch (settingsErr) {
        threshold = null; // settings unavailable -> skip the thresholded log
      }
      if (threshold != null && storedCSD > threshold) {
        await logSystemEvent('csd_implausible', {
          userId, classId, listId, storedCSD, storedTWI, threshold
        }, 'error');
      } else if (threshold == null) {
        await logSystemEvent('csd_implausible_no_threshold', {
          userId, classId, listId, storedCSD, storedTWI
        }, 'warning');
      }
    }
  } catch (obsErr) {
    console.warn('[RECONCILIATION] observability logging failed (non-fatal):', obsErr?.message);
  }

  console.log('[RECONCILIATION] getOrCreateClassProgress END');
  console.log('[RECONCILIATION] ═══════════════════════════════════════');

  return { progress, attempts };
}

/**
 * [deepfix P4 · FND-2] SERVER_PROGRESS_WRITE hydration route for getOrCreateClassProgress.
 *
 * Calls `resolveListProgress({listId, classId})` and CONSUMES its `mode` to build the
 * `{ progress, attempts }` contract. The callable's EXACT return shapes (foundation.js,
 * verified — do not assume):
 *   • READ-ONLY mode (pre-P5, LIST_PROGRESS_CANONICAL=false):
 *     `{mode:'legacy'|'none', csd, twi, launch:{classId,csd,twi,data}|null, merged, ...}`.
 *     With classId supplied, the server's F4-1 leg CREATE-ON-MISSES + reconciles the LAUNCHING
 *     `class_progress` doc (progressService.js:114-127 + :233-271 semantics), keeping the
 *     completion day-guard baseline current; it writes NO canonical list_progress doc
 *     (`canonicalWritten:false`). So the launching legacy doc always exists after a legacy-mode
 *     resolve → we read it LOCALLY (real client Timestamps; serialized wire timestamps are
 *     plain objects unsafe for `.toDate()`).
 *   • CANONICAL mode (post-P5, LIST_PROGRESS_CANONICAL=true, list_progress doc exists):
 *     `{mode:'canonical', csd, twi, data}`. The launching `class_progress` doc may NOT exist
 *     (migration collapsed legacy docs / a fresh class-list path never created one) — [Codex
 *     P6-2] insisting on it here would turn a HEALTHY resolver into a false failure. We read the
 *     canonical `list_progress/{listId}` doc LOCALLY and SYNTHESIZE the downstream progress shape
 *     (legacy-shaped id + classId/listId + the canonical fields).
 *   • QUARANTINED (write-capable P5+ backstop): `{mode:'quarantined', reasons}` — study is
 *     deliberately BLOCKED; return null so the caller fails closed (safe; quarantine UX is P5/P6
 *     work, not P4 — see notes).
 * `attempts` are fetched via `getRecentAttemptsForClassList(userId, classId, listId, 8)` (12
 * under REVIEW_PAIRING_V2 — CS PR-1) exactly as the legacy path does. NOTE: post-P5 the canonical record is list-scoped (one per
 * student+list across classes); a list-scoped attempts fetch may be more correct then —
 * documented in P4_impl_notes.md item 12 as a P5 follow-up, not changed here (P4 parity).
 *
 * Returns null on a genuine resolver ERROR/unavailable (or a quarantine block). [Codex P6-R1]
 * The caller retries once, then FAILS CLOSED with a typed `progress_resolver_unavailable`
 * error — it must NOT fall through to a legacy client write, which the P6 rules cutoff denies.
 * A resolver SUCCESS whose launching legacy doc is merely absent (canonical mode) is NOT a
 * failure. (Flag-OFF bundles never reach here; this helper only runs when SERVER_PROGRESS_WRITE
 * is on.)
 */
async function getOrCreateClassProgressViaResolver(userId, classId, listId) {
  try {
    const resolveFn = httpsCallable(getFunctions(), 'resolveListProgress', { timeout: 30000 });
    const result = await resolveFn({ listId, classId });
    const mode = result?.data?.mode;
    const docId = getProgressDocId(classId, listId);

    // ── CANONICAL mode (post-P5): canonical list_progress is authoritative; the launching
    //    class_progress doc may legitimately be absent. Resolver SUCCEEDED — never fail here.
    if (mode === 'canonical') {
      const canonicalSnap = await getDoc(doc(db, `users/${userId}/list_progress`, listId));
      const canonicalData = canonicalSnap.exists()
        ? canonicalSnap.data()          // preferred: local read → real Timestamps
        : (result?.data?.data ?? null); // fallback: the callable's (serialized) canonical payload
      if (canonicalData) {
        const progress = { id: docId, classId, listId, ...canonicalData };
        const attempts = await getRecentAttemptsForClassList(userId, classId, listId, REVIEW_PAIRING_V2 ? RECENT_ATTEMPTS_WINDOW : 8);
        return { progress, attempts };
      }
      // 'canonical' but no data locally OR on the wire — treat as unusable → caller fails closed.
      console.warn('[RECONCILIATION] resolver canonical mode returned no usable data');
      return null;
    }

    // ── QUARANTINED (write-capable P5+ backstop): study is blocked by design → fail closed (safe).
    if (mode === 'quarantined') {
      console.warn('[RECONCILIATION] resolver reports quarantine — blocking (fail closed)');
      return null;
    }

    // ── READ-ONLY / legacy mode (pre-P5): the F4-1 leg created+reconciled the launching doc.
    const snapshot = await getDoc(doc(db, `users/${userId}/class_progress`, docId));
    if (snapshot.exists()) {
      const progress = { id: snapshot.id, ...snapshot.data() };
      const attempts = await getRecentAttemptsForClassList(userId, classId, listId, REVIEW_PAIRING_V2 ? RECENT_ATTEMPTS_WINDOW : 8);
      return { progress, attempts };
    }
    // Legacy-mode create-on-miss guarantees the launching doc, so a miss is unexpected — but the
    // resolve SUCCEEDED, so synthesize from the returned launch view rather than falsely failing.
    const launchData = result?.data?.launch?.data ?? null;
    if (launchData) {
      const progress = { id: docId, classId, listId, ...launchData };
      const attempts = await getRecentAttemptsForClassList(userId, classId, listId, REVIEW_PAIRING_V2 ? RECENT_ATTEMPTS_WINDOW : 8);
      return { progress, attempts };
    }
    // Resolve succeeded but produced no usable position (e.g. mode 'none' with no doc) → null.
    console.warn('[RECONCILIATION] resolver route: no usable progress after resolve (mode:', mode, ')');
    return null;
  } catch (err) {
    // Genuine resolver ERROR / unavailable (or a local read failure) → null → caller fails closed.
    console.warn('[RECONCILIATION] resolveListProgress route failed:', err?.message);
    return null;
  }
}

/**
 * Calculate aggregate stats from recent sessions
 * @param {Array} sessions - Array of session summary objects
 * @returns {Object} Progress stats object
 */
function calculateProgressStats(sessions) {
  const newWordScores = sessions
    .filter(s => s.newWordScore !== null && s.newWordScore !== undefined)
    .map(s => s.newWordScore);
  
  const reviewScores = sessions
    .filter(s => s.reviewScore !== null && s.reviewScore !== undefined)
    .map(s => s.reviewScore);
  
  return {
    avgNewWordScore: newWordScores.length > 0
      ? newWordScores.reduce((a, b) => a + b, 0) / newWordScores.length
      : null,
    avgReviewScore: reviewScores.length > 0
      ? reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length
      : null
  };
}

/**
 * Calculate streak based on last study date and current date
 * @param {Date|null} lastStudyDate - Previous study date
 * @param {number} currentStreak - Current streak count
 * @param {number} studyDaysPerWeek - Study days per week (<=5 means skip weekends)
 * @returns {number} Updated streak count
 */
function calculateUpdatedStreak(lastStudyDate, currentStreak, studyDaysPerWeek = 5) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const skipWeekends = studyDaysPerWeek <= 5;

  // Helper to check if a date is a weekend
  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Get the expected previous study day (accounting for weekends)
  const getExpectedPreviousDay = (fromDate) => {
    const prev = new Date(fromDate);
    prev.setDate(prev.getDate() - 1);
    prev.setHours(0, 0, 0, 0);
    if (skipWeekends) {
      while (isWeekend(prev)) {
        prev.setDate(prev.getDate() - 1);
      }
    }
    return prev;
  };

  // No previous session - start fresh streak
  if (!lastStudyDate) {
    return 1;
  }

  // Normalize lastStudyDate
  const lastDate = lastStudyDate instanceof Date
    ? lastStudyDate
    : (lastStudyDate?.toDate?.() || new Date(lastStudyDate));
  lastDate.setHours(0, 0, 0, 0);

  // Same day - streak unchanged
  if (lastDate.getTime() === today.getTime()) {
    return currentStreak || 1;
  }

  // Check if last session was the expected previous study day
  const expectedPrevDay = getExpectedPreviousDay(today);
  if (lastDate.getTime() === expectedPrevDay.getTime()) {
    return (currentStreak || 0) + 1;
  }

  // Streak broken - reset to 1
  return 1;
}

/**
 * Update class progress after a session
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @param {Object} sessionSummary - Session summary object
 * @param {number} newIntervention - New intervention level (0.0 to 1.0)
 * @param {number} studyDaysPerWeek - Study days per week for streak calculation
 * @param {{active?: boolean, cycleLength?: number}} cycling - [P9·CYC·U5] cycling state for lap-boundary
 *   intervention reset. Omitted/`{active:false}` ⇒ fully inert (byte-equivalent to today).
 * @returns {Promise<Object>} Updated class progress document
 */
export async function updateClassProgress(userId, classId, listId, sessionSummary, newIntervention, studyDaysPerWeek = 5, cycling = {}) {
  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);

  const snapshot = await getDoc(progressRef);
  const current = snapshot.exists() ? snapshot.data() : DEFAULT_CLASS_PROGRESS;

  // Guard: Check if this is the expected next day (prevents duplicate completions)
  const expectedDay = (current.currentStudyDay || 0) + 1;
  if (sessionSummary.day && sessionSummary.day !== expectedDay) {
    console.warn(`Duplicate day completion blocked: expected day ${expectedDay}, got day ${sessionSummary.day}`);
    // dayGuardRejected [V9/§5.4]: marker so the completion caller can abort + force a
    // session rebuild instead of leaving the student stuck against an in-flight session
    // whose day no longer matches the (possibly reconciliation-advanced) counter.
    // Flag-gated [Codex-P1-3] so the flag-off return stays byte-equivalent to legacy.
    return LIST_SCOPED_RECON
      ? { id: docId, ...current, dayGuardRejected: true }
      : { id: docId, ...current }; // Return existing progress unchanged
  }

  // [P9 · CYC · U5 RESET] Cycling lap-boundary intervention reset: when the student crosses into a new lap
  // (virtual twi passes k·cycleLength), re-start the finished list at full pace — DROP lap N-1's session
  // history so next session's calculateInterventionLevel(recentSessions) sees a clean slate, and zero the
  // stored intervention. Hard-gated on cycling.active ⇒ fully inert when cycling is off (byte-equivalent).
  // CLIENT path only; the server completeSession path needs the mirror before SERVER_PROGRESS_WRITE flips
  // (see audit/deepfix/task6/CYCLING_COHORT_VALIDATION_PLAN.md).
  const cycleLen = Number(cycling.cycleLength) || 0;
  const twiBefore = current.totalWordsIntroduced || 0;
  const twiAfter = twiBefore + (sessionSummary.wordsIntroduced || 0);
  const crossedLapBoundary = cycling.active === true && cycleLen > 0
    && Math.floor(twiBefore / cycleLen) < Math.floor(twiAfter / cycleLen);

  // Keep only last MAX_RECENT_SESSIONS (a crossed lap boundary resets the carry)
  const recentSessions = [...(crossedLapBoundary ? [] : (current.recentSessions || [])), sessionSummary]
    .slice(-MAX_RECENT_SESSIONS);

  // Calculate new stats from recent sessions
  const stats = calculateProgressStats(recentSessions);

  // Calculate updated streak
  const lastStudyDate = current.lastStudyDate?.toDate?.() || current.lastStudyDate || null;
  const streakDays = calculateUpdatedStreak(lastStudyDate, current.streakDays || 0, studyDaysPerWeek);

  const updates = {
    currentStudyDay: (current.currentStudyDay || 0) + 1,
    totalWordsIntroduced: (current.totalWordsIntroduced || 0) + (sessionSummary.wordsIntroduced || 0),
    interventionLevel: crossedLapBoundary ? 0 : newIntervention,
    recentSessions,
    stats,
    streakDays,
    lastStudyDate: Timestamp.now(),
    lastSessionAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  // CS PR-3 · WI-1 (FORCED_PATHWAY): the completion writer is the ONE owner of the persisted
  // reviewMode bit. Recompute it from the POST-append recentSessions with hysteresis over the prior
  // bit (a crossed lap boundary dropped the carry → deriveThrottleMode over the fresh slate returns
  // false, restarting at full pace, in step with interventionLevel:0 above). Added AFTER the welded
  // `updates` literal so the day-advance object is unchanged. Flag-off: no reviewMode key written
  // (byte-equivalent doc — INV-16-welded-today untouched).
  if (FORCED_PATHWAY) {
    updates.reviewMode = deriveThrottleMode(recentSessions, current.reviewMode === true);
  }

  if (snapshot.exists()) {
    await updateDoc(progressRef, updates);
  } else {
    await setDoc(progressRef, {
      ...createClassProgress(classId, listId),
      ...updates,
      programStartDate: Timestamp.now(),
      createdAt: Timestamp.now()
    });
  }

  return { id: docId, ...current, ...updates };
}

/**
 * CS PR-3 · WI-1 (FORCED_PATHWAY hold-csd, OC-1 `review_recorded`) — record a review OUTCOME
 * WITHOUT advancing the day. This is the decoupling of "record review" from "advance day" that the
 * welded updateClassProgress appender could not express (PHASE-3 conflict #1): it appends the review
 * summary, recomputes stats/streak, and persists the reviewMode bit, but NEVER writes
 * currentStudyDay / totalWordsIntroduced. So a throttle/skip review-only day records its score
 * (feeding the escape average) WITHOUT the #16 runaway csd advance — killing I1/I2.
 *
 * Sole CLIENT caller: completeSessionFromTest under FORCED_PATHWAY hold-csd (studyService.js), only
 * when !SERVER_PROGRESS_WRITE (the server owns the doc post-P4 and holds via completeSession
 * `review_recorded`). Dead code until FORCED_PATHWAY flips.
 *
 * There is NO day-guard here (a hold never touches csd, so there is no expected-day to guard); the
 * ONLY thing to protect is a double-append on retry — idempotent on `reviewAttemptId` (the last
 * recentSessions entry's marker). Return shape mirrors recordSessionCompletion: {sessionId, progress}.
 *
 * @param {string} userId
 * @param {Object} sessionData - same shape recordSessionCompletion consumes
 * @param {string|null} reviewAttemptId - the review attempt doc id (idempotency)
 * @returns {Promise<{sessionId: null, progress: Object}>}
 */
export async function recordReviewOutcome(userId, sessionData, reviewAttemptId = null) {
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
    studyDaysPerWeek = 5
  } = sessionData;

  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);
  const snapshot = await getDoc(progressRef);
  const current = snapshot.exists() ? snapshot.data() : DEFAULT_CLASS_PROGRESS;

  // Idempotency: a retry of the SAME review must not double-append (no day-guard protects us here).
  // FIX 3: scan the WHOLE recentSessions window (not just the last entry) for a matching
  // reviewAttemptId — a retry AFTER a newer review already landed, or a stale re-submit, would slip
  // past a last-entry-only check and double-append, skewing the binary-throttle review average. The
  // caller threads a STABLE non-null id (result.id ?? attemptDocId) so the key is never absent.
  const priorRecents = current.recentSessions || [];
  if (reviewAttemptId && priorRecents.some(s => s?.reviewAttemptId === reviewAttemptId)) {
    console.log('[HOLD-CSD] recordReviewOutcome idempotent no-op (reviewAttemptId already recorded)');
    return { sessionId: null, progress: { id: docId, ...current } };
  }

  const sessionSummary = {
    ...createSessionSummary({
      day: dayNumber || 1,
      newWordScore,
      reviewScore,
      segmentStartIndex: segment?.startIndex || 0,
      segmentEndIndex: segment?.endIndex || 0,
      wordsIntroduced: wordsIntroduced || 0,
      wordsReviewed: wordsReviewed || 0,
      wordsTested: wordsTested || 0
    }),
    // Additive hold-shape markers (do NOT change the createSessionSummary field set): a
    // recorded-not-advanced marker + the idempotency key.
    reviewRecorded: true,
    ...(reviewAttemptId ? { reviewAttemptId } : {})
  };

  const recentSessions = [...priorRecents, sessionSummary].slice(-MAX_RECENT_SESSIONS);
  const stats = calculateProgressStats(recentSessions);
  const lastStudyDate = current.lastStudyDate?.toDate?.() || current.lastStudyDate || null;
  const streakDays = calculateUpdatedStreak(lastStudyDate, current.streakDays || 0, studyDaysPerWeek);
  // Owner of the persisted reviewMode bit (same recompute as updateClassProgress; hysteresis over
  // the prior bit). A held review that raises the average above the exit bar flips reviewMode → false
  // → next init allocates new words (escape); a skip keeps it → stays throttled.
  const reviewMode = deriveThrottleMode(recentSessions, current.reviewMode === true);

  const updates = {
    // NO currentStudyDay, NO totalWordsIntroduced — HELD (the whole point of hold-csd).
    reviewMode,
    recentSessions,
    stats,
    streakDays,
    lastStudyDate: Timestamp.now(),
    lastSessionAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  if (snapshot.exists()) {
    await updateDoc(progressRef, updates);
  } else {
    await setDoc(progressRef, {
      ...createClassProgress(classId, listId),
      ...updates,
      programStartDate: Timestamp.now(),
      createdAt: Timestamp.now()
    });
  }

  return { sessionId: null, progress: { id: docId, ...current, ...updates } };
}

/**
 * Get class progress (read-only)
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {Promise<Object|null>} Class progress document or null if not found
 */
export async function getClassProgress(userId, classId, listId) {
  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);

  const snapshot = await getDoc(progressRef);

  if (!snapshot.exists()) {
    return null;
  }

  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Fetch progress for multiple students across all lists assigned to a class
 * @param {string[]} studentIds - Array of student user IDs
 * @param {string} classId - Class ID
 * @param {string[]} listIds - Array of assigned list IDs
 * @returns {Promise<Object>} Map of { [studentId]: { [listId]: progressData } }
 */
export async function fetchStudentsProgressForClass(studentIds, classId, listIds) {
  const progressMap = {};

  // Initialize structure
  studentIds.forEach(studentId => {
    progressMap[studentId] = {};
  });

  // [deepfix P4 · FND-2, F6-2] Teacher read path resolves from the FOUNDATION record when
  // SERVER_PROGRESS_WRITE is on: canonical `users/{studentId}/list_progress/{listId}` FIRST
  // (the resolveListProgress read order — the callable itself is self-service, so the
  // teacher surface reads the doc directly; the generic /users/{userId}/{subcollection}
  // teacher-read rule covers it), falling back to the legacy class_progress doc when no
  // canonical doc exists. Pre-P5 the canonical collection is empty by contract, so flag-on
  // output is identical to today; at P5 the canonical doc wins — the teacher "Students"
  // view can no longer freeze on a stale class_progress doc (and survives its P7 deletion).
  // Flag OFF (default) → the legacy read below, byte-equivalent to today.
  const readStudentListProgress = async (studentId, listId) => {
    if (SERVER_PROGRESS_WRITE) {
      try {
        const canonicalSnap = await getDoc(doc(db, `users/${studentId}/list_progress`, listId));
        if (canonicalSnap.exists()) {
          return { id: canonicalSnap.id, ...canonicalSnap.data(), source: 'list_progress' };
        }
      } catch (err) {
        // Canonical read denied/unavailable → legacy fallback (never fail the whole view).
        console.warn('canonical list_progress read failed — using legacy class_progress:', err?.message);
      }
    }
    return getClassProgress(studentId, classId, listId);
  };

  // Batch fetch: For each student, fetch progress for all lists
  const promises = [];
  for (const studentId of studentIds) {
    for (const listId of listIds) {
      promises.push(
        readStudentListProgress(studentId, listId)
          .then(progress => ({ studentId, listId, progress }))
          .catch(() => ({ studentId, listId, progress: null }))
      );
    }
  }

  const results = await Promise.all(promises);

  results.forEach(({ studentId, listId, progress }) => {
    progressMap[studentId][listId] = progress;
  });

  return progressMap;
}

