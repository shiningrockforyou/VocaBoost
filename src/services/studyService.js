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
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { getNewWordAttemptForDay } from './db';
import {
  calculateInterventionLevel,
  calculateDailyAllocation,
  calculateSegment,
  calculateReviewCount,
  calculateReviewTestSize,
  selectReviewQueue,
  selectTestWords,
  shuffleArray,
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
  updateClassProgress
} from './progressService';

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
  // Get or create progress
  const progress = await getOrCreateClassProgress(userId, classId, listId);

  // Calculate intervention from recent sessions
  const interventionLevel = calculateInterventionLevel(progress.recentSessions || []);

  // Get daily pace from settings
  const dailyPace = Math.ceil(
    (assignmentSettings.weeklyPace || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE) /
    (assignmentSettings.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK)
  );

  // Calculate allocation
  const allocation = calculateDailyAllocation(dailyPace, interventionLevel);

  // Current study day (will be incremented on completion)
  const currentStudyDay = (progress.currentStudyDay || 0) + 1;
  const totalWordsIntroduced = progress.totalWordsIntroduced || 0;

  // DEBUG: Log dayNumber calculation
  console.log('DEBUG initializeDailySession:', {
    progressCurrentStudyDay: progress.currentStudyDay,
    calculatedDayNumber: currentStudyDay,
    totalWordsIntroduced
  });

  // Calculate segment for review (uses intervention-adjusted projection)
  const segment = calculateSegment(
    currentStudyDay,
    assignmentSettings.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
    totalWordsIntroduced,
    dailyPace,
    interventionLevel
  );

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

  // Determine how many new words we can introduce
  const wordsRemaining = totalListWords - totalWordsIntroduced;
  const newWordCount = Math.min(allocation.newWords, wordsRemaining);

  return {
    // Session metadata
    classId,
    listId,
    dayNumber: currentStudyDay,

    // Allocation
    interventionLevel,
    dailyPace,
    allocation,

    // New words
    newWordCount,
    newWordStartIndex: totalWordsIntroduced,
    newWordEndIndex: totalWordsIntroduced + newWordCount - 1,

    // Review (null if day 1)
    segment,
    reviewCount: segment ? reviewCount : 0,

    // Test sizes (review scales with intervention)
    testSizeNew: assignmentSettings.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
    testSizeReview: calculateReviewTestSize(interventionLevel),
    retakeThreshold: assignmentSettings.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD,

    // Progress reference
    progress,
    totalWordsIntroduced,
    totalListWords,

    // Status
    isFirstDay: currentStudyDay === 1,
    isListComplete: wordsRemaining <= 0
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
    studyDaysPerWeek
  );

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
 * @param {number} endIndexExclusive - End index (exclusive) - words before this index
 * @returns {Promise<Array>} Array of FAILED word objects
 */
export async function getFailedFromPreviousNewWords(userId, listId, endIndexExclusive) {
  if (endIndexExclusive <= 0) return [];

  // Get all words ordered by position
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsQuery = query(wordsRef, orderBy('position', 'asc'));
  const wordsSnap = await getDocs(wordsQuery);

  // Filter to words with position < endIndexExclusive
  const previousWords = wordsSnap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }))
    .filter(w => w.position < endIndexExclusive);

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
 * @param {number} startIndex - Start index (inclusive)
 * @param {number} count - Number of words to get
 * @returns {Promise<Array>} Array of word objects
 */
export async function getNewWords(listId, startIndex, count) {
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

  // Get segment words with study states
  const segmentWords = await getSegmentWords(
    userId, 
    listId, 
    segment.startIndex, 
    segment.endIndex
  );

  // Map to format expected by selectReviewQueue
  const wordsWithState = segmentWords.map(w => ({
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
    newWordRetakeThreshold: assignment.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
  });

  // Get new words (already have wordIndex from getNewWords)
  const newWords = config.newWordCount > 0
    ? await getNewWords(listId, config.newWordStartIndex, config.newWordCount)
    : [];

  // Get failed carryover (words from previous days with FAILED status)
  const failedCarryover = await getFailedFromPreviousNewWords(
    userId,
    listId,
    config.newWordStartIndex
  );

  // Get ALL segment words (full segment, not just prioritized queue)
  let reviewWords = [];
  if (config.segment) {
    reviewWords = await getSegmentWords(
      userId,
      listId,
      config.segment.startIndex,
      config.segment.endIndex
    );
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
    newWordRetakeThreshold: assignment.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
  });

  // Get new words
  const newWords = config.newWordCount > 0
    ? await getNewWords(listId, config.newWordStartIndex, config.newWordCount)
    : [];

  // Get ALL words in segment (complete mode)
  let segmentWords = [];
  if (config.segment) {
    segmentWords = await getSegmentWords(
      userId,
      listId,
      config.segment.startIndex,
      config.segment.endIndex
    );
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

  // 1. Fetch all segment words with current status
  const segmentWords = await getSegmentWords(userId, listId, segment.startIndex, segment.endIndex);

  // 2. Segment-wide graduation: eligible = ALL words that didn't fail THIS test
  // (Previously FAILED/NEVER_TESTED words may now be mastered after studying)
  const failedIds = new Set(failedWordIds);
  const eligibleWords = segmentWords.filter(w => !failedIds.has(w.id));

  if (eligibleWords.length === 0) {
    return { graduated: 0, remaining: 0 };
  }

  // 3. Calculate graduation count: X% of SEGMENT SIZE where X = testScore
  // Cap at eligible count (can't graduate more than available)
  const segmentSize = segment.endIndex - segment.startIndex + 1;
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
    newWordRetakeThreshold: assignment.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
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
    segmentWords = await getSegmentWords(
      userId,
      listId,
      sessionConfig.segment.startIndex,
      sessionConfig.segment.endIndex
    );

    // Get MASTERED words in segment range
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
  testResults
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
  const wordsIntroduced = sessionState?.newWords?.length || 0;
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
    segment: segment ? `${segment.startIndex}-${segment.endIndex}` : null
  });

  let newWordScore = null;
  let reviewScore = null;
  let reviewFailed = [];

  if (isFirstDay) {
    // Day 1: Only new word test, no review
    newWordScore = testResults.score;
  } else {
    // Day 2+: This is a review test - need to get new word score from earlier attempt
    reviewScore = testResults.score;
    reviewFailed = testResults.failed || [];

    // Query the new word attempt for this day
    const newWordAttempt = await getNewWordAttemptForDay(userId, classId, dayNumber);
    if (newWordAttempt) {
      // Convert score from 0-100 to 0-1 if needed
      newWordScore = newWordAttempt.score <= 1
        ? newWordAttempt.score
        : newWordAttempt.score / 100;
    } else {
      console.warn(`completeSessionFromTest: Could not find new word attempt for day ${dayNumber}`);
    }
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
    wordsTested: testResults.total || 0
  };

  // Record session completion (updates CSD, recentSessions, etc.)
  const result = await recordSessionCompletion(userId, summary);

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

