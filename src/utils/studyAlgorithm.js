/**
 * Study Algorithm Utilities
 * 
 * Pure functions for the random sampling vocabulary system.
 * No Firestore dependencies - just math and logic.
 */

export const STUDY_ALGORITHM_CONSTANTS = {
  // Intervention thresholds
  INTERVENTION_HIGH_SCORE: 0.75,    // Score above this = 0% intervention (full new words)
  INTERVENTION_LOW_SCORE: 0.30,     // Score below this = 100% intervention (pause new words)

  // Review count calculation
  REVIEW_COUNT_BASE: 100,           // Base multiplier for review queue size formula
  REVIEW_COUNT_MIN: 15,             // Minimum words in review queue (floor)

  // Default test sizes
  DEFAULT_TEST_SIZE_NEW: 50,        // Default number of new words per test
  DEFAULT_TEST_SIZE_REVIEW: 30,     // Default number of review words per test (base, scales with intervention)
  REVIEW_TEST_SIZE_MIN: 30,         // Minimum review test size (at 0% intervention)
  REVIEW_TEST_SIZE_MAX: 60,         // Maximum review test size (at 100% intervention)

  // Retake threshold
  DEFAULT_RETAKE_THRESHOLD: 0.95,   // Must score 95% on new word test to "pass"

  // Blind spot threshold
  STALE_DAYS_THRESHOLD: 21,         // Words not seen in 21+ days are "blind spots"

  // LEGACY: Early days threshold (no longer used - replaced by week-based segment rotation)
  // EARLY_DAYS_THRESHOLD: 4,       // Days 1-4 use cumulative review; day 5+ uses segment rotation

  // Pace defaults
  DEFAULT_WEEKLY_PACE: 400,         // Default words per week (≈57/day at 7 days, ≈80/day at 5 days)
  DEFAULT_STUDY_DAYS_PER_WEEK: 5,   // Default number of study days per week
  DEFAULT_DAILY_PACE: 20,           // Default words per day for new assignments
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
 * Calculate which word indices to review today using intervention-adjusted projection.
 *
 * Week 1: Day 1 = no review; Days 2-n each get a distinct segment (divide by n-1)
 * Week 2+: All days get a segment (divide by n)
 *
 * Projects forward to estimate words by start of last day of week, then divides
 * into equal segments. Each day gets its assigned segment based on position in week.
 *
 * @param {number} currentStudyDay - Current study day (1-indexed)
 * @param {number} studyDaysPerWeek - Study days per week (e.g., 5)
 * @param {number} totalWordsIntroduced - Total words introduced so far
 * @param {number} dailyPace - Base daily pace before intervention (e.g., 80)
 * @param {number} interventionLevel - Current intervention level (0.0 to 1.0)
 * @returns {{ startIndex: number, endIndex: number } | null}
 */
export function calculateSegment(currentStudyDay, studyDaysPerWeek, totalWordsIntroduced, dailyPace, interventionLevel) {
  const weekNumber = Math.ceil(currentStudyDay / studyDaysPerWeek);
  const dayOfWeek = ((currentStudyDay - 1) % studyDaysPerWeek) + 1;

  // Week 1, Day 1: no review
  if (weekNumber === 1 && dayOfWeek === 1) {
    return null;
  }

  // Project to start of last day using intervention-adjusted pace
  const adjustedPace = dailyPace * (1 - interventionLevel);
  const daysRemaining = studyDaysPerWeek - dayOfWeek;
  const projectedTotal = totalWordsIntroduced + (daysRemaining * adjustedPace);

  if (projectedTotal === 0) {
    return null;
  }

  // Week 1: divide by n-1 (since Day 1 has no review), Week 2+: divide by n
  const divisor = (weekNumber === 1) ? (studyDaysPerWeek - 1) : studyDaysPerWeek;
  const segmentSize = Math.ceil(projectedTotal / divisor);

  // Week 1: Day 2 = segment 0, Day 3 = segment 1, etc.
  // Week 2+: Day 1 = segment 0, Day 2 = segment 1, etc.
  const segmentPosition = (weekNumber === 1) ? (dayOfWeek - 2) : (dayOfWeek - 1);

  const startIndex = segmentPosition * segmentSize;
  const endIndex = Math.min((segmentPosition + 1) * segmentSize, totalWordsIntroduced) - 1;

  // Handle edge case where segment starts beyond available words
  if (startIndex >= totalWordsIntroduced) {
    return null;
  }

  return { startIndex, endIndex };
}

/* LEGACY: Old calculateSegment function (commented out for reference)
 * Used cumulative review for days 2-4, then segment rotation for days 5+.
 * Replaced with week-based segment rotation with intervention-adjusted projection.
 *
 * export function calculateSegment_LEGACY(currentStudyDay, studyDaysPerWeek, totalWordsIntroduced) {
 *   // Day 1 or totalWords = 0 → return null (no review)
 *   if (currentStudyDay === 1 || totalWordsIntroduced === 0) {
 *     return null;
 *   }
 *
 *   // Days 2-4 → cumulative: { startIndex: 0, endIndex: wordsBeforeToday - 1 }
 *   if (currentStudyDay <= STUDY_ALGORITHM_CONSTANTS.EARLY_DAYS_THRESHOLD) {
 *     const wordsBeforeToday = currentStudyDay - 1;
 *     if (wordsBeforeToday <= 0) {
 *       return null;
 *     }
 *     return {
 *       startIndex: 0,
 *       endIndex: wordsBeforeToday - 1
 *     };
 *   }
 *
 *   // Days 5+ → segment rotation
 *   const dayOfWeek = ((currentStudyDay - 1) % studyDaysPerWeek) + 1;
 *   const segmentSize = Math.ceil(totalWordsIntroduced / studyDaysPerWeek);
 *   const startIndex = (dayOfWeek - 1) * segmentSize;
 *   const endIndex = Math.min(dayOfWeek * segmentSize, totalWordsIntroduced) - 1;
 *
 *   return { startIndex, endIndex };
 * }
 */

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
 * Calculate review test size based on intervention level.
 * Higher intervention = larger review test (more practice needed).
 *
 * @param {number} interventionLevel - Intervention level (0.0 to 1.0)
 * @param {number} [minSize] - Optional minimum size (defaults to REVIEW_TEST_SIZE_MIN)
 * @param {number} [maxSize] - Optional maximum size (defaults to REVIEW_TEST_SIZE_MAX)
 * @returns {number} Review test size
 */
export function calculateReviewTestSize(interventionLevel, minSize, maxSize) {
  const min = minSize ?? STUDY_ALGORITHM_CONSTANTS.REVIEW_TEST_SIZE_MIN;
  const max = maxSize ?? STUDY_ALGORITHM_CONSTANTS.REVIEW_TEST_SIZE_MAX;

  // Linear interpolation: min + (max - min) * intervention
  // At 0% intervention: 30 words (doing well, smaller test)
  // At 100% intervention: 60 words (struggling, larger test)
  const size = min + (max - min) * interventionLevel;

  return Math.round(size);
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

  // Priority 3: NEVER_TESTED words (need to be tested first)
  remaining = reviewCount - queue.length;
  const queueIds = new Set(queue.map(w => w.id));
  const neverTested = segmentWords.filter(w =>
    w.status === 'NEVER_TESTED' && !queueIds.has(w.id)
  );
  const shuffledNeverTested = shuffleArray(neverTested);
  const neverTestedToAdd = shuffledNeverTested.slice(0, remaining);
  queue.push(...neverTestedToAdd);
  remaining -= neverTestedToAdd.length;

  // Priority 4: PASSED words (already proven, fill remaining slots)
  if (remaining > 0) {
    const passed = segmentWords.filter(w =>
      w.status === 'PASSED' && !queueIds.has(w.id)
    );
    const shuffledPassed = shuffleArray(passed);
    queue.push(...shuffledPassed.slice(0, remaining));
  }

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

