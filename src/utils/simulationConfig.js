/**
 * Simulation Configuration
 *
 * Student profiles, speed settings, and expectations for automated testing
 */

// Student performance profiles based on simulation_test_checklist.md
export const STUDENT_PROFILES = {
  ALEX: {
    id: 'alex',
    name: 'Alex',
    description: 'High-Performing Student',
    accuracy: 0.92,           // 90-95% on tests
    dismissRate: 0.02,        // Rarely uses dismiss feature
    retakeChance: 0.05,       // Rarely needs retakes
    expectedIntervention: 0,  // Always scores above 75%
    color: '#22c55e'          // Green
  },
  BAILEY: {
    id: 'bailey',
    name: 'Bailey',
    description: 'Average Student',
    accuracy: 0.75,           // 70-80% on tests
    dismissRate: 0.10,        // Occasionally uses dismiss
    retakeChance: 0.30,       // Sometimes needs retakes
    expectedIntervention: 0.15, // Scores hover around threshold
    color: '#eab308'          // Yellow
  },
  CASEY: {
    id: 'casey',
    name: 'Casey',
    description: 'Struggling Student',
    accuracy: 0.55,           // 50-65% on tests
    dismissRate: 0.25,        // Uses dismiss feature often
    retakeChance: 0.70,       // Needs multiple retakes
    expectedIntervention: 0.67, // Scores consistently below 75%
    color: '#ef4444'          // Red
  }
}

// Speed settings for simulation
export const SIMULATION_SPEEDS = {
  INSTANT: {
    id: 'instant',
    name: 'Instant',
    multiplier: 0,            // Skip all delays
    cardDelay: 0,
    testDelay: 0,
    description: 'No animations, fastest possible'
  },
  FAST: {
    id: 'fast',
    name: 'Fast',
    multiplier: 10,
    cardDelay: 100,           // 100ms per card
    testDelay: 50,            // 50ms per question
    description: '10x speed, brief pauses'
  },
  NORMAL: {
    id: 'normal',
    name: 'Normal',
    multiplier: 1,
    cardDelay: 1000,          // 1s per card
    testDelay: 500,           // 500ms per question
    description: 'Real-time, watch full flow'
  }
}

// Expected values from simulation_test_checklist.md for validation
export const EXPECTATIONS = {
  // Intervention thresholds
  INTERVENTION_HIGH_THRESHOLD: 0.75,  // 75%+ = no intervention
  INTERVENTION_LOW_THRESHOLD: 0.30,   // 30%- = max intervention

  // Pass threshold
  PASS_THRESHOLD: 0.95,  // 95% to pass

  // Review test sizes
  REVIEW_TEST_SIZE_MIN: 30,
  REVIEW_TEST_SIZE_MAX: 60,

  // Day calculations
  STUDY_DAYS_PER_WEEK: 5,
  STALE_DAYS_THRESHOLD: 21,  // MASTERED words return after 21 days

  // Default pace
  DEFAULT_DAILY_PACE: 80
}

// Word status types (matching studyTypes.js)
export const WORD_STATUSES = {
  NEW: 'NEW',
  NEVER_TESTED: 'NEVER_TESTED',
  FAILED: 'FAILED',
  PASSED: 'PASSED',
  MASTERED: 'MASTERED',
  NEEDS_CHECK: 'NEEDS_CHECK'
}

// Simulation phases
export const SIM_PHASES = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  ERROR: 'error'
}

/**
 * Calculate expected intervention level based on scores
 * @param {number[]} lastThreeScores - Last 3 review test scores (0-1)
 * @returns {number} Expected intervention level (0-1)
 */
export function calculateExpectedIntervention(lastThreeScores) {
  if (!lastThreeScores || lastThreeScores.length === 0) return 0

  const average = lastThreeScores.reduce((a, b) => a + b, 0) / lastThreeScores.length

  if (average >= EXPECTATIONS.INTERVENTION_HIGH_THRESHOLD) return 0
  if (average <= EXPECTATIONS.INTERVENTION_LOW_THRESHOLD) return 1

  return (EXPECTATIONS.INTERVENTION_HIGH_THRESHOLD - average) /
         (EXPECTATIONS.INTERVENTION_HIGH_THRESHOLD - EXPECTATIONS.INTERVENTION_LOW_THRESHOLD)
}

/**
 * Calculate expected pace based on intervention
 * @param {number} basePace - Base daily pace (e.g., 80)
 * @param {number} interventionLevel - Intervention level (0-1)
 * @returns {number} Adjusted pace
 */
export function calculateExpectedPace(basePace, interventionLevel) {
  return Math.round(basePace * (1 - interventionLevel))
}

/**
 * Calculate expected review test size based on intervention
 * @param {number} interventionLevel - Intervention level (0-1)
 * @returns {number} Review test size
 */
export function calculateExpectedReviewTestSize(interventionLevel) {
  const { REVIEW_TEST_SIZE_MIN, REVIEW_TEST_SIZE_MAX } = EXPECTATIONS
  return Math.round(REVIEW_TEST_SIZE_MIN + (REVIEW_TEST_SIZE_MAX - REVIEW_TEST_SIZE_MIN) * interventionLevel)
}

/**
 * Generate random test score based on profile accuracy
 * @param {object} profile - Student profile
 * @param {number} questionCount - Number of questions
 * @returns {object} { score, correct, total }
 */
export function generateTestScore(profile, questionCount) {
  // Add some variance to the accuracy (+/- 10%)
  const variance = (Math.random() - 0.5) * 0.2
  const adjustedAccuracy = Math.max(0, Math.min(1, profile.accuracy + variance))

  const correct = Math.round(questionCount * adjustedAccuracy)
  const score = correct / questionCount

  return { score, correct, total: questionCount }
}

/**
 * Decide if a word should be dismissed based on profile
 * @param {object} profile - Student profile
 * @returns {boolean} Whether to dismiss
 */
export function shouldDismissWord(profile) {
  return Math.random() < profile.dismissRate
}

export default {
  STUDENT_PROFILES,
  SIMULATION_SPEEDS,
  EXPECTATIONS,
  WORD_STATUSES,
  SIM_PHASES,
  calculateExpectedIntervention,
  calculateExpectedPace,
  calculateExpectedReviewTestSize,
  generateTestScore,
  shouldDismissWord
}
