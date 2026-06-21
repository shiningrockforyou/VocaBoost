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
import { db } from '../firebase';
import {
  DEFAULT_CLASS_PROGRESS,
  createClassProgress,
  MAX_RECENT_SESSIONS,
  implausibleStudyDayThreshold
} from '../types/studyTypes';
import { getRecentAttemptsForClassList, getMostRecentPassedNewTest, getReviewForDay, logSystemEvent } from './db';

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
async function cleanupOrphanedReviews(userId, classId, listId, anchorDay, attempts) {
  // Find orphaned reviews: review tests for days beyond the anchor
  const orphanedReviews = attempts.filter(
    a => a.sessionType === 'review' && a.studyDay > anchorDay
  );

  if (orphanedReviews.length === 0) {
    return;
  }

  console.log(`[RECONCILIATION] Found ${orphanedReviews.length} orphaned review(s) to clean up`);

  for (const orphan of orphanedReviews) {
    try {
      // 1. Save to system_logs as string before deletion
      const logEntry = {
        type: 'orphaned_attempt_deleted',
        userId,
        classId,
        listId,
        attemptId: orphan.id,
        attemptData: JSON.stringify(orphan), // Full attempt as string
        anchorDay,
        reason: `Review for Day ${orphan.studyDay} deleted - no matching new test exists`,
        deletedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'system_logs'), logEntry);

      // 2. Delete the orphaned attempt
      await deleteDoc(doc(db, 'attempts', orphan.id));

      console.log(`[RECONCILIATION] Deleted orphaned review: Day ${orphan.studyDay}, attemptId: ${orphan.id}`);
    } catch (err) {
      console.error(`[RECONCILIATION] Failed to clean up orphaned review ${orphan.id}:`, err);
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
      // Day 2+: Check if review exists
      const reviewForAnchorDay = await getReviewForDay(userId, classId, listId, anchorDay);
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
  const attempts = await getRecentAttemptsForClassList(userId, classId, listId, 8);

  // Clean up orphaned reviews (reviews for days beyond anchor)
  if (anchorDay > 0) {
    await cleanupOrphanedReviews(userId, classId, listId, anchorDay, attempts);
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
  // Otherwise use Math.max to protect against query failures
  const safeCSD = hasValidData ? csd : Math.max(storedCSD, csd);
  const safeTWI = hasValidData ? twi : Math.max(storedTWI, twi);

  console.log('[RECONCILIATION] Comparison:', {
    stored: { csd: storedCSD, twi: storedTWI },
    calculated: { csd, twi },
    safe: { csd: safeCSD, twi: safeTWI },
    reconciliationMode: hasValidData ? 'bidirectional' : 'one-way (Math.max protection)',
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
 * @returns {Promise<Object>} Updated class progress document
 */
export async function updateClassProgress(userId, classId, listId, sessionSummary, newIntervention, studyDaysPerWeek = 5) {
  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);

  const snapshot = await getDoc(progressRef);
  const current = snapshot.exists() ? snapshot.data() : DEFAULT_CLASS_PROGRESS;

  // Guard: Check if this is the expected next day (prevents duplicate completions)
  const expectedDay = (current.currentStudyDay || 0) + 1;
  if (sessionSummary.day && sessionSummary.day !== expectedDay) {
    console.warn(`Duplicate day completion blocked: expected day ${expectedDay}, got day ${sessionSummary.day}`);
    return { id: docId, ...current }; // Return existing progress unchanged
  }

  // Keep only last MAX_RECENT_SESSIONS
  const recentSessions = [...(current.recentSessions || []), sessionSummary]
    .slice(-MAX_RECENT_SESSIONS);

  // Calculate new stats from recent sessions
  const stats = calculateProgressStats(recentSessions);

  // Calculate updated streak
  const lastStudyDate = current.lastStudyDate?.toDate?.() || current.lastStudyDate || null;
  const streakDays = calculateUpdatedStreak(lastStudyDate, current.streakDays || 0, studyDaysPerWeek);

  const updates = {
    currentStudyDay: (current.currentStudyDay || 0) + 1,
    totalWordsIntroduced: (current.totalWordsIntroduced || 0) + (sessionSummary.wordsIntroduced || 0),
    interventionLevel: newIntervention,
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

  return { id: docId, ...current, ...updates };
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

  // Batch fetch: For each student, fetch progress for all lists
  const promises = [];
  for (const studentId of studentIds) {
    for (const listId of listIds) {
      promises.push(
        getClassProgress(studentId, classId, listId)
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

