/**
 * TestConfig - Centralized test configuration builder
 *
 * This is the SINGLE SOURCE OF TRUTH for test parameters.
 * All test configuration flows through this module.
 */

import { selectTestWords } from './studyAlgorithm'
import { STUDY_ALGORITHM_CONSTANTS } from './studyAlgorithm'

/**
 * Builds a complete test configuration from assignment settings.
 *
 * @param {Object} options
 * @param {Object} options.assignment - Assignment settings from Firestore
 * @param {Array} options.wordPool - Words available for testing
 * @param {string} options.testType - 'new' or 'review'
 * @param {Object} options.sessionContext - Context for display (dayNumber, etc.)
 * @returns {Object} Complete test configuration
 */
export function buildTestConfig(options) {
  const {
    assignment = {},
    wordPool = [],
    testType = 'new',
    sessionContext = {},
  } = options

  // Extract all settings with defaults
  const testSizeNew = assignment.testSizeNew ?? STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW
  const testSizeReview = assignment.testSizeReview ?? STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW
  const testOptionsCount = assignment.testOptionsCount ?? 4
  const passThreshold = assignment.passThreshold ?? 95
  const testMode = assignment.testMode || 'mcq'
  const reviewTestType = assignment.reviewTestType || 'mcq'
  const reviewTestSizeMin = assignment.reviewTestSizeMin ?? 30
  const reviewTestSizeMax = assignment.reviewTestSizeMax ?? 60

  // Determine effective test size based on test type
  const effectiveTestSize = testType === 'new' ? testSizeNew : testSizeReview

  // Apply test size limit to word pool
  const wordsToTest = wordPool.length > 0
    ? selectTestWords(wordPool, effectiveTestSize)
    : []

  return {
    // Test content (already limited by testSize)
    wordsToTest,
    originalWordPool: wordPool,
    testType,

    // Assignment settings (all in one place)
    testSizeNew,
    testSizeReview,
    testOptionsCount,
    passThreshold,
    passThresholdDecimal: passThreshold / 100,
    testMode,
    reviewTestType,
    reviewTestSizeMin,
    reviewTestSizeMax,

    // Session context (all fields preserved for attempt tracking)
    ...sessionContext,
  }
}
