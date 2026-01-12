import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  DEFAULT_CLASS_PROGRESS,
  createClassProgress,
  MAX_RECENT_SESSIONS
} from '../types/studyTypes';
import { getRecentAttemptsForClassList, logSystemEvent } from './db';

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
 * Calculate CSD (currentStudyDay) and TWI (totalWordsIntroduced) from attempts.
 * Used for reconciliation to verify progress matches actual attempt history.
 *
 * Algorithm:
 * - Find highest studyDay among attempts
 * - Day 1: CSD = 1 if new test passed, else 0
 * - Day 2+: CSD = studyDay if review test exists, else studyDay - 1
 * - TWI = newWordEndIndex + 1 from new test where studyDay === CSD
 *
 * @param {Array} attempts - Array of attempt documents
 * @returns {{ csd: number, twi: number }}
 */
function calculateCSDAndTWIFromAttempts(attempts) {
  console.log('[RECONCILIATION] calculateCSDAndTWIFromAttempts called with:', {
    attemptCount: attempts?.length || 0,
    studyDays: attempts?.map(a => a.studyDay) || []
  });

  if (!attempts || attempts.length === 0) {
    console.log('[RECONCILIATION] No attempts found, returning { csd: 0, twi: 0 }');
    return { csd: 0, twi: 0 };
  }

  // Find highest studyDay
  const highestStudyDay = Math.max(...attempts.map(a => a.studyDay || 0));
  console.log('[RECONCILIATION] Highest studyDay found:', highestStudyDay);

  if (highestStudyDay === 0) {
    console.log('[RECONCILIATION] Highest studyDay is 0, returning { csd: 0, twi: 0 }');
    return { csd: 0, twi: 0 };
  }

  // Get attempts for the highest studyDay
  const highestDayAttempts = attempts.filter(a => a.studyDay === highestStudyDay);
  const newTestForHighestDay = highestDayAttempts.find(a => a.sessionType === 'new');
  const reviewTestForHighestDay = highestDayAttempts.find(a => a.sessionType === 'review');

  console.log('[RECONCILIATION] Highest day attempts:', {
    studyDay: highestStudyDay,
    hasNewTest: !!newTestForHighestDay,
    newTestPassed: newTestForHighestDay?.passed,
    hasReviewTest: !!reviewTestForHighestDay
  });

  let csd;

  if (highestStudyDay === 1) {
    // Day 1: CSD = 1 if new test passed, else 0
    csd = (newTestForHighestDay?.passed === true) ? 1 : 0;
    console.log('[RECONCILIATION] Day 1 logic: CSD =', csd);
  } else {
    // Day 2+: CSD = studyDay if review test exists, else studyDay - 1
    csd = reviewTestForHighestDay ? highestStudyDay : highestStudyDay - 1;
    console.log('[RECONCILIATION] Day 2+ logic: CSD =', csd, '(reviewTest exists:', !!reviewTestForHighestDay, ')');
  }

  // Determine TWI
  let twi = 0;
  if (csd > 0) {
    // Find new test attempt where studyDay === CSD
    const newTestForCSD = attempts.find(a => a.studyDay === csd && a.sessionType === 'new');
    // TWI = newWordEndIndex + 1 (endIndex is 0-based, TWI is count)
    twi = newTestForCSD?.newWordEndIndex != null ? newTestForCSD.newWordEndIndex + 1 : 0;
    console.log('[RECONCILIATION] TWI calculation:', {
      csd,
      foundNewTest: !!newTestForCSD,
      newWordEndIndex: newTestForCSD?.newWordEndIndex,
      calculatedTWI: twi
    });
  }

  console.log('[RECONCILIATION] Final calculated values:', { csd, twi });
  return { csd, twi };
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

  // Always verify against attempts for reconciliation
  console.log('[RECONCILIATION] Fetching recent attempts...');
  const attempts = await getRecentAttemptsForClassList(userId, classId, listId, 8);

  console.log('[RECONCILIATION] Calculating CSD/TWI from attempts...');
  const { csd, twi } = calculateCSDAndTWIFromAttempts(attempts);

  // Validate that attempts contain trustworthy data
  // Check for valid integer types and reasonable values
  const hasValidData = attempts.some(a =>
    Number.isInteger(a.studyDay) && a.studyDay > 0 &&
    Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex >= 0
  );

  console.log('[RECONCILIATION] Data validation:', {
    hasValidData,
    validationReason: hasValidData
      ? 'At least one attempt has valid studyDay and newWordEndIndex'
      : 'No attempts with valid data - will use Math.max for safety'
  });

  // Trust attempts as source of truth when data is valid
  // Otherwise use Math.max to protect against query failures or corrupt data
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
  if (sessionSummary.dayNumber && sessionSummary.dayNumber !== expectedDay) {
    console.warn(`Duplicate day completion blocked: expected day ${expectedDay}, got day ${sessionSummary.dayNumber}`);
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

