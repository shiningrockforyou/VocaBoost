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
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  calculateInterventionLevel,
  calculateDailyAllocation,
  calculateSegment,
  calculateReviewCount,
  selectReviewQueue,
  selectTestWords,
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

  // Calculate segment for review
  const segment = calculateSegment(
    currentStudyDay,
    assignmentSettings.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
    totalWordsIntroduced
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

    // Test sizes
    testSizeNew: assignmentSettings.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
    testSizeReview: assignmentSettings.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW,
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
  // Get words from list subcollection, ordered by creation/index
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsQuery = query(wordsRef, orderBy('createdAt', 'asc'));
  const wordsSnap = await getDocs(wordsQuery);

  // Get words in range
  const allWords = wordsSnap.docs.map((doc, index) => ({
    id: doc.id,
    wordIndex: index,
    ...doc.data()
  }));

  const segmentWords = allWords.filter(
    w => w.wordIndex >= startIndex && w.wordIndex <= endIndex
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
      wordIndex: word.wordIndex,
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
    interventionLevel
  } = sessionData;

  // Create session summary
  const sessionSummary = createSessionSummary({
    day: dayNumber,
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
    newIntervention
  );

  // Optionally save full session record to sessions collection
  // (for detailed history if needed)
  const sessionRef = doc(collection(db, `users/${userId}/sessions`));
  const batch = writeBatch(db);

  batch.set(sessionRef, {
    ...sessionData,
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
 * @param {Array} words - Array of word objects with { id, wordIndex }
 * @param {number} introducedOnDay - Study day number
 * @returns {Promise<void>}
 */
export async function initializeNewWordStates(userId, listId, words, introducedOnDay) {
  if (!words || words.length === 0) return;

  const batch = writeBatch(db);

  for (const word of words) {
    const stateRef = doc(db, `users/${userId}/study_states`, word.id);

    const newState = createStudyState(word.id, listId, word.wordIndex, introducedOnDay);
    batch.set(stateRef, newState, { merge: true });
  }

  await batch.commit();
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
  const wordsQuery = query(wordsRef, orderBy('createdAt', 'asc'));
  const wordsSnap = await getDocs(wordsQuery);

  const allWords = wordsSnap.docs.map((doc, index) => ({
    id: doc.id,
    wordIndex: index,
    ...doc.data()
  }));

  return allWords.slice(startIndex, startIndex + count);
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
  const todaysFailedWords = todaysNewFailed.length > 0
    ? segmentWords.filter(w => todaysNewFailed.includes(w.id))
    : [];

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
 * @returns {Promise<Array>} Pool of words needing verification
 */
export async function getBlindSpotPool(userId, listId) {
  // Get all words in list
  const wordsRef = collection(db, 'lists', listId, 'words');
  const wordsSnap = await getDocs(query(wordsRef, orderBy('createdAt', 'asc')));

  const allWords = wordsSnap.docs.map((docSnap, index) => ({
    id: docSnap.id,
    wordIndex: index,
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

  return blindSpots;
}

/**
 * Get blind spot count for display
 * @param {string} userId - User ID
 * @param {string} listId - List ID
 * @returns {Promise<number>} Count of blind spots
 */
export async function getBlindSpotCount(userId, listId) {
  const pool = await getBlindSpotPool(userId, listId);
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
  // Initialize session to get allocation
  const config = await initializeDailySession(userId, classId, listId, {
    weeklyPace: assignment.pace * 7 || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
    studyDaysPerWeek: STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
    testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
    testSizeReview: assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW,
    newWordRetakeThreshold: assignment.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
  });
  
  // Get new words (already have wordIndex from getNewWords)
  const newWords = config.newWordCount > 0
    ? await getNewWords(listId, config.newWordStartIndex, config.newWordCount)
    : [];
  
  // Get review queue (already have wordIndex from buildReviewQueue)
  let reviewWords = [];
  if (config.segment) {
    reviewWords = await buildReviewQueue(
      userId,
      listId,
      config.segment,
      config.reviewCount,
      [] // No failed words yet
    );
  }
  
  // Combine: new words first, then review
  // Sort by wordIndex so PDF shows words in list order
  const combined = [...newWords, ...reviewWords];
  combined.sort((a, b) => (a.wordIndex ?? 0) - (b.wordIndex ?? 0));
  
  return combined;
}

