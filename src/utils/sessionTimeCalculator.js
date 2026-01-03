/**
 * Session Time Calculator
 *
 * Calculates estimated daily study time based on assignment settings.
 */

/**
 * Default time estimates (in seconds)
 */
export const TIME_DEFAULTS = {
  // Study phase times
  NEW_WORD_STUDY_SEC: 45,        // Time to study each new word (read, understand, memorize)
  REVIEW_WORD_STUDY_SEC: 25,     // Time to review each word (faster than new)

  // Test times per question
  MCQ_QUESTION_SEC: 20,          // Time per MCQ question
  TYPED_QUESTION_SEC: 40,        // Time per typed question (slower - typing + thinking)

  // Buffer/transition time
  TRANSITION_SEC: 60,            // Time between phases (loading, instructions, etc.)
};

/**
 * Calculate estimated daily session time
 *
 * @param {Object} params - Calculation parameters
 * @param {number} params.dailyPace - New words per day (e.g., 20, 40, 80)
 * @param {number} params.testSizeNew - New word test size (questions)
 * @param {string} params.testMode - 'mcq', 'typed', or 'both'
 * @param {number} params.reviewTestSizeMin - Min review test questions
 * @param {number} params.reviewTestSizeMax - Max review test questions
 * @param {string} params.reviewTestType - 'mcq' or 'typed'
 * @param {number} [params.interventionLevel=0] - 0.0 to 1.0 (affects review test size)
 * @param {number} [params.reviewQueueSize] - Override review study count (defaults to reviewTestSizeMax)
 * @param {Object} [params.timeOverrides] - Override default time estimates
 * @returns {Object} Time breakdown in minutes and seconds
 */
export function calculateSessionTime(params) {
  const {
    dailyPace,
    testSizeNew,
    testMode,
    reviewTestSizeMin,
    reviewTestSizeMax,
    reviewTestType,
    interventionLevel = 0,
    reviewQueueSize,
    timeOverrides = {},
  } = params;

  // Merge time defaults with overrides
  const times = { ...TIME_DEFAULTS, ...timeOverrides };

  // --- Phase 1: New Words Study ---
  const newWordsStudySec = dailyPace * times.NEW_WORD_STUDY_SEC;

  // --- Phase 2: New Word Test ---
  // Actual test size is min(testSizeNew, dailyPace)
  const actualNewTestSize = Math.min(testSizeNew, dailyPace);
  let newWordTestSec = 0;

  if (testMode === 'mcq') {
    newWordTestSec = actualNewTestSize * times.MCQ_QUESTION_SEC;
  } else if (testMode === 'typed') {
    newWordTestSec = actualNewTestSize * times.TYPED_QUESTION_SEC;
  } else if (testMode === 'both') {
    // Assume half MCQ, half typed
    const halfSize = Math.ceil(actualNewTestSize / 2);
    newWordTestSec = (halfSize * times.MCQ_QUESTION_SEC) + (halfSize * times.TYPED_QUESTION_SEC);
  }

  // --- Phase 3: Review Study ---
  // Review queue size (words to study before review test)
  const reviewStudyCount = reviewQueueSize ?? reviewTestSizeMax;
  const reviewStudySec = reviewStudyCount * times.REVIEW_WORD_STUDY_SEC;

  // --- Phase 4: Review Test ---
  // Test size scales with intervention: min + (max - min) * intervention
  const reviewTestSize = Math.round(
    reviewTestSizeMin + (reviewTestSizeMax - reviewTestSizeMin) * interventionLevel
  );

  let reviewTestSec = 0;
  if (reviewTestType === 'mcq') {
    reviewTestSec = reviewTestSize * times.MCQ_QUESTION_SEC;
  } else if (reviewTestType === 'typed') {
    reviewTestSec = reviewTestSize * times.TYPED_QUESTION_SEC;
  }

  // --- Transitions ---
  const transitionsSec = times.TRANSITION_SEC * 4; // 4 phase transitions

  // --- Totals ---
  const totalSec = newWordsStudySec + newWordTestSec + reviewStudySec + reviewTestSec + transitionsSec;
  const totalMin = totalSec / 60;

  return {
    breakdown: {
      newWordsStudy: {
        items: dailyPace,
        seconds: newWordsStudySec,
        minutes: Math.round(newWordsStudySec / 60),
      },
      newWordTest: {
        items: actualNewTestSize,
        mode: testMode,
        seconds: newWordTestSec,
        minutes: Math.round(newWordTestSec / 60),
      },
      reviewStudy: {
        items: reviewStudyCount,
        seconds: reviewStudySec,
        minutes: Math.round(reviewStudySec / 60),
      },
      reviewTest: {
        items: reviewTestSize,
        mode: reviewTestType,
        seconds: reviewTestSec,
        minutes: Math.round(reviewTestSec / 60),
      },
      transitions: {
        seconds: transitionsSec,
        minutes: Math.round(transitionsSec / 60),
      },
    },
    total: {
      seconds: totalSec,
      minutes: Math.round(totalMin),
      formatted: formatDuration(totalSec),
    },
    // Range estimate (±20% for individual variation)
    range: {
      min: formatDuration(totalSec * 0.8),
      max: formatDuration(totalSec * 1.2),
    },
  };
}

/**
 * Format seconds into human-readable duration
 * @param {number} seconds
 * @returns {string} e.g., "1h 15m" or "45m"
 */
function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

/**
 * Quick estimate for common pace settings
 * @param {number} dailyPace - Words per day
 * @returns {Object} Time estimate with defaults
 */
export function quickEstimate(dailyPace) {
  return calculateSessionTime({
    dailyPace,
    testSizeNew: 50,
    testMode: 'mcq',
    reviewTestSizeMin: 30,
    reviewTestSizeMax: 60,
    reviewTestType: 'mcq',
    interventionLevel: 0,
  });
}

/**
 * Generate comparison table for multiple paces
 * @param {number[]} paces - Array of daily paces to compare
 * @returns {Object[]} Array of results for each pace
 */
export function comparePaces(paces = [20, 40, 60, 80]) {
  return paces.map(pace => ({
    pace,
    ...quickEstimate(pace),
  }));
}

// Example usage:
// const result = calculateSessionTime({
//   dailyPace: 80,
//   testSizeNew: 50,
//   testMode: 'mcq',
//   reviewTestSizeMin: 30,
//   reviewTestSizeMax: 60,
//   reviewTestType: 'mcq',
//   interventionLevel: 0,
// });
// console.log(result.total.formatted); // "1h 32m"
// console.log(result.range); // { min: "1h 14m", max: "1h 50m" }
