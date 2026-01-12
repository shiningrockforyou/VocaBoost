/**
 * Session Step Tracker Utility
 *
 * Centralized step calculation for daily session flow
 * Handles both DailySessionFlow phases and test component formats
 */

/**
 * Calculates the current step number in a daily session
 *
 * @param {Object} options - Configuration options
 * @param {string} [options.phase] - Current phase (PHASES constant like 'new_words', 'new_word_test', 'review_study', 'review_test', 'complete')
 * @param {boolean} options.isFirstDay - Whether this is the student's first day
 * @param {string} [options.testType] - Test type ('new' or 'review'), alternative to phase
 * @returns {Object} { stepNumber, totalSteps, stepText }
 *
 * @example
 * // Using phase from DailySessionFlow
 * getSessionStep({ phase: 'new_words', isFirstDay: false })
 * // => { stepNumber: 1, totalSteps: 5, stepText: 'Step 1 of 5' }
 *
 * @example
 * // Using testType from test components
 * getSessionStep({ testType: 'new', isFirstDay: true })
 * // => { stepNumber: 2, totalSteps: 3, stepText: 'Step 2 of 3' }
 */
export function getSessionStep({ phase, isFirstDay, testType }) {
  // Normalize phase to handle both formats
  let normalizedPhase = phase

  // If testType is provided, convert to phase format
  if (testType) {
    normalizedPhase = testType === 'new' ? 'new_word_test' : 'review_test'
  }

  // Calculate step number based on normalized phase
  let stepNumber
  switch (normalizedPhase) {
    case 'new_words':
      stepNumber = 1
      break
    case 'new_word_test':
      stepNumber = 2
      break
    case 'review_study':
      stepNumber = isFirstDay ? 2 : 3
      break
    case 'review_test':
      stepNumber = 4
      break
    case 'complete':
      stepNumber = isFirstDay ? 3 : 5
      break
    default:
      // Fallback for unknown phase
      stepNumber = 1
  }

  const totalSteps = isFirstDay ? 3 : 5

  return {
    stepNumber,
    totalSteps,
    stepText: `Step ${stepNumber} of ${totalSteps}`
  }
}
