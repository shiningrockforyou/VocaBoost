/**
 * Test Recovery Utility
 *
 * Handles saving and recovering test state for network disconnect scenarios.
 * Uses localStorage with time-limited recovery (10 minute window).
 */

const STORAGE_PREFIX = 'vocaboost_test_'
const RECOVERY_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Generate a unique test ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {string} testType - 'new' or 'review'
 * @returns {string} Unique test identifier
 */
export function getTestId(classId, listId, testType) {
  return `${STORAGE_PREFIX}${classId}_${listId}_${testType}`
}

/**
 * Save test state to localStorage
 * @param {string} testId - Unique test identifier
 * @param {Object} answers - Current answers { wordId: answer }
 * @param {Array<string>} wordIds - Array of word IDs in the test
 * @param {number} currentIndex - Current question index
 */
export function saveTestState(testId, answers, wordIds, currentIndex = 0) {
  try {
    const state = {
      answers,
      wordIds,
      currentIndex,
      timestamp: Date.now(),
      expiresAt: Date.now() + RECOVERY_WINDOW_MS
    }
    localStorage.setItem(testId, JSON.stringify(state))
  } catch (error) {
    console.warn('Failed to save test state:', error)
  }
}

/**
 * Get saved test state if valid (within recovery window)
 * @param {string} testId - Unique test identifier
 * @returns {Object|null} Saved state or null if expired/not found
 */
export function getTestState(testId) {
  try {
    const stored = localStorage.getItem(testId)
    if (!stored) return null

    const state = JSON.parse(stored)

    // Check if expired
    if (Date.now() > state.expiresAt) {
      clearTestState(testId)
      return null
    }

    return state
  } catch (error) {
    console.warn('Failed to get test state:', error)
    return null
  }
}

/**
 * Clear test state from localStorage
 * @param {string} testId - Unique test identifier
 */
export function clearTestState(testId) {
  try {
    localStorage.removeItem(testId)
  } catch (error) {
    console.warn('Failed to clear test state:', error)
  }
}

/**
 * Check if a test has recoverable state
 * @param {string} testId - Unique test identifier
 * @returns {boolean} True if recoverable state exists
 */
export function isTestRecoverable(testId) {
  return getTestState(testId) !== null
}

/**
 * Get time remaining for recovery in minutes
 * @param {string} testId - Unique test identifier
 * @returns {number|null} Minutes remaining or null if not recoverable
 */
export function getRecoveryTimeRemaining(testId) {
  const state = getTestState(testId)
  if (!state) return null

  const remaining = state.expiresAt - Date.now()
  return Math.max(0, Math.ceil(remaining / 60000))
}

/**
 * Validate that saved word IDs match current test
 * @param {string} testId - Unique test identifier
 * @param {Array<string>} currentWordIds - Current test word IDs
 * @returns {boolean} True if word IDs match
 */
export function validateTestState(testId, currentWordIds) {
  const state = getTestState(testId)
  if (!state) return false

  // Check if same words (order doesn't matter)
  const savedSet = new Set(state.wordIds)
  const currentSet = new Set(currentWordIds)

  if (savedSet.size !== currentSet.size) return false

  for (const id of savedSet) {
    if (!currentSet.has(id)) return false
  }

  return true
}
