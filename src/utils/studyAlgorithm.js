/**
 * Study Algorithm Utilities
 * 
 * Pure functions for the random sampling vocabulary system.
 * No Firestore dependencies - just math and logic.
 */

export const STUDY_ALGORITHM_CONSTANTS = {
  // Intervention thresholds
  INTERVENTION_HIGH_SCORE: 0.75,    // Score above this = 0% intervention
  INTERVENTION_LOW_SCORE: 0.30,     // Score below this = 100% intervention

  // Review count
  REVIEW_COUNT_BASE: 100,
  REVIEW_COUNT_MIN: 15,

  // Default test sizes
  DEFAULT_TEST_SIZE_NEW: 50,
  DEFAULT_TEST_SIZE_REVIEW: 30,

  // Retake threshold
  DEFAULT_RETAKE_THRESHOLD: 0.95,

  // Blind spot threshold
  STALE_DAYS_THRESHOLD: 21,

  // Early days (cumulative instead of rotation)
  EARLY_DAYS_THRESHOLD: 4
};

/**
 * Fisher-Yates shuffle. Returns a new shuffled array (does not mutate).
 * @param {Array} array - Array to shuffle
 * @returns {Array} New shuffled array
 */
export function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Calculate intervention level (0.0 to 1.0) based on recent review scores.
 * @param {Array} recentSessions - Array of session objects with reviewScore (number 0-1 or null)
 * @returns {number} Intervention level from 0.0 to 1.0
 */
export function calculateInterventionLevel(recentSessions) {
  if (!Array.isArray(recentSessions) || recentSessions.length === 0) {
    return 0.0;
  }

  // Get last 3 sessions with non-null reviewScore
  const validScores = recentSessions
    .filter(session => session?.reviewScore !== null && session?.reviewScore !== undefined)
    .map(session => session.reviewScore)
    .slice(-3);

  // If fewer than 3 scores, return 0.0 (no intervention)
  if (validScores.length < 3) {
    return 0.0;
  }

  // Calculate average
  const avgScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;

  // avgScore ≥ 0.75 → return 0.0
  if (avgScore >= STUDY_ALGORITHM_CONSTANTS.INTERVENTION_HIGH_SCORE) {
    return 0.0;
  }

  // avgScore ≤ 0.30 → return 1.0
  if (avgScore <= STUDY_ALGORITHM_CONSTANTS.INTERVENTION_LOW_SCORE) {
    return 1.0;
  }

  // Between → linear interpolation: (0.75 - avgScore) / 0.45
  const scoreRange = STUDY_ALGORITHM_CONSTANTS.INTERVENTION_HIGH_SCORE - STUDY_ALGORITHM_CONSTANTS.INTERVENTION_LOW_SCORE;
  return (STUDY_ALGORITHM_CONSTANTS.INTERVENTION_HIGH_SCORE - avgScore) / scoreRange;
}

/**
 * Calculate new word and review allocations.
 * @param {number} dailyPace - Daily pace (e.g., 80)
 * @param {number} interventionLevel - Intervention level (0.0 to 1.0)
 * @returns {{ newWords: number, reviewCap: number, maxDaily: number }}
 */
export function calculateDailyAllocation(dailyPace, interventionLevel) {
  const newWords = Math.round(dailyPace * (1 - interventionLevel));
  const reviewCap = Math.round(dailyPace * (1 + 2 * interventionLevel));
  const maxDaily = Math.max(newWords, reviewCap);

  return { newWords, reviewCap, maxDaily };
}

/**
 * Calculate which word indices to review today.
 * @param {number} currentStudyDay - Current study day (1-indexed)
 * @param {number} studyDaysPerWeek - Study days per week (e.g., 5)
 * @param {number} totalWordsIntroduced - Total words introduced so far
 * @returns {{ startIndex: number, endIndex: number } | null}
 */
export function calculateSegment(currentStudyDay, studyDaysPerWeek, totalWordsIntroduced) {
  // Day 1 or totalWords = 0 → return null (no review)
  if (currentStudyDay === 1 || totalWordsIntroduced === 0) {
    return null;
  }

  // Days 2-4 → cumulative: { startIndex: 0, endIndex: wordsBeforeToday - 1 }
  if (currentStudyDay <= STUDY_ALGORITHM_CONSTANTS.EARLY_DAYS_THRESHOLD) {
    // Assume 1 word introduced per day for simplicity
    // In practice, this would be calculated from actual word introduction history
    const wordsBeforeToday = currentStudyDay - 1;
    if (wordsBeforeToday <= 0) {
      return null;
    }
    return {
      startIndex: 0,
      endIndex: wordsBeforeToday - 1
    };
  }

  // Days 5+ → segment rotation
  const dayOfWeek = ((currentStudyDay - 1) % studyDaysPerWeek) + 1;
  const segmentSize = Math.ceil(totalWordsIntroduced / studyDaysPerWeek);
  const startIndex = (dayOfWeek - 1) * segmentSize;
  const endIndex = Math.min(dayOfWeek * segmentSize, totalWordsIntroduced) - 1;

  return { startIndex, endIndex };
}

/**
 * Calculate how many words to include in review queue.
 * @param {Array} recentSessions - Array of session objects with reviewScore
 * @param {number} reviewCap - Maximum allowed review count
 * @returns {number} Number of words for review queue
 */
export function calculateReviewCount(recentSessions, reviewCap) {
  if (!Array.isArray(recentSessions) || recentSessions.length === 0) {
    return Math.min(50, reviewCap);
  }

  // Get last 3 sessions with non-null reviewScore
  const validScores = recentSessions
    .filter(session => session?.reviewScore !== null && session?.reviewScore !== undefined)
    .map(session => session.reviewScore)
    .slice(-3);

  // If none, return default
  if (validScores.length === 0) {
    return Math.min(50, reviewCap);
  }

  // Calculate average
  const avgScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;

  // scoreBased = 100 * (1.5 - avgScore)
  const scoreBased = Math.round(STUDY_ALGORITHM_CONSTANTS.REVIEW_COUNT_BASE * (1.5 - avgScore));

  // Return bounded: max(15, min(scoreBased, reviewCap))
  return Math.max(STUDY_ALGORITHM_CONSTANTS.REVIEW_COUNT_MIN, Math.min(scoreBased, reviewCap));
}

/**
 * Select words for review queue with priority ordering.
 * @param {Array} segmentWords - Array of word objects with { id, status, lastQueuedAt, queueAppearances }
 * @param {number} reviewCount - Target queue size
 * @param {Array} todaysNewFailed - Array of word objects (FAILED from today's new word test)
 * @returns {Array} Array of word objects (length ≤ reviewCount)
 */
export function selectReviewQueue(segmentWords, reviewCount, todaysNewFailed = []) {
  const queue = [];
  const todaysNewFailedIds = new Set(todaysNewFailed.map(w => w.id));

  // Priority 1: Today's new FAILED
  queue.push(...todaysNewFailed);

  if (queue.length >= reviewCount) {
    return queue.slice(0, reviewCount);
  }

  // Priority 2: Segment FAILED (oldest queued first)
  const segmentFailed = segmentWords
    .filter(w => w.status === 'FAILED' && !todaysNewFailedIds.has(w.id))
    .sort((a, b) => {
      // Handle Firestore Timestamp objects or plain numbers
      const aTime = a.lastQueuedAt?.toMillis?.() ?? a.lastQueuedAt ?? 0;
      const bTime = b.lastQueuedAt?.toMillis?.() ?? b.lastQueuedAt ?? 0;
      
      if (aTime !== bTime) {
        return aTime - bTime; // Oldest first
      }
      
      // If same time, sort by queueAppearances (fewer appearances first)
      return (a.queueAppearances || 0) - (b.queueAppearances || 0);
    });

  let remaining = reviewCount - queue.length;
  queue.push(...segmentFailed.slice(0, remaining));

  if (queue.length >= reviewCount) {
    return queue;
  }

  // Priority 3: Random fill from PASSED + NEVER_TESTED
  remaining = reviewCount - queue.length;
  const queueIds = new Set(queue.map(w => w.id));
  const nonFailed = segmentWords.filter(w => 
    (w.status === 'PASSED' || w.status === 'NEVER_TESTED') && 
    !queueIds.has(w.id)
  );
  const shuffled = shuffleArray(nonFailed);
  queue.push(...shuffled.slice(0, remaining));

  return queue;
}

/**
 * Randomly select words for a test.
 * @param {Array} wordPool - Array of word objects
 * @param {number} testSize - Target test size
 * @returns {Array} Array of word objects
 */
export function selectTestWords(wordPool, testSize) {
  if (!Array.isArray(wordPool) || wordPool.length === 0) {
    return [];
  }

  if (wordPool.length <= testSize) {
    return shuffleArray(wordPool);
  }

  const shuffled = shuffleArray(wordPool);
  return shuffled.slice(0, testSize);
}

/**
 * Estimate overall mastery percentage.
 * @param {{ PASSED: number, FAILED: number, NEVER_TESTED: number }} statusCounts - Counts by status
 * @param {number | null} avgReviewScore - Average review score (0-1) or null
 * @returns {number} Mastery estimate from 0.0 to 1.0
 */
export function calculateMasteryEstimate(statusCounts, avgReviewScore) {
  const { PASSED = 0, FAILED = 0, NEVER_TESTED = 0 } = statusCounts || {};
  const total = PASSED + FAILED + NEVER_TESTED;

  if (total === 0) {
    return 0.0;
  }

  // PASSED words count as 100% known
  const passedScore = PASSED;

  // FAILED words count as 0% known
  const failedScore = 0;

  // NEVER_TESTED estimated using avgReviewScore (or 0.5 if null)
  const neverTestedEstimate = avgReviewScore !== null && avgReviewScore !== undefined 
    ? avgReviewScore 
    : 0.5;
  const neverTestedScore = NEVER_TESTED * neverTestedEstimate;

  // mastery = (PASSED + NEVER_TESTED * estimate) / total
  const mastery = (passedScore + neverTestedScore) / total;

  return Math.max(0.0, Math.min(1.0, mastery));
}

/**
 * Helper to get rolling average of a score field.
 * @param {Array} sessions - Array of session objects
 * @param {string} scoreField - Field name ('newWordScore' or 'reviewScore')
 * @param {number} count - Number of sessions to average (default 3)
 * @returns {number | null} Average score or null if no valid scores
 */
export function getSessionScoreAverage(sessions, scoreField, count = 3) {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return null;
  }

  // Get last N sessions with non-null scoreField
  const validScores = sessions
    .filter(session => {
      const score = session?.[scoreField];
      return score !== null && score !== undefined && typeof score === 'number';
    })
    .map(session => session[scoreField])
    .slice(-count);

  if (validScores.length === 0) {
    return null;
  }

  const sum = validScores.reduce((acc, score) => acc + score, 0);
  return sum / validScores.length;
}

