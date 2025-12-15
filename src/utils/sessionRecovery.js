/**
 * Session Recovery Utility
 *
 * Handles saving and recovering study session state.
 * Uses unique keys per user/day/phase to ensure state validity.
 */

const SESSION_STORAGE_KEY = 'vocaboost_session_'

/**
 * Generate unique session ID for a specific study phase
 * @param {string} userId - Firebase user UID
 * @param {string} classId
 * @param {string} listId
 * @param {number} dayNumber - Current day number in the study schedule
 * @param {string} phaseType - 'new' or 'review'
 * @returns {string} Unique session identifier
 */
export function getSessionId(userId, classId, listId, dayNumber, phaseType) {
  return `${SESSION_STORAGE_KEY}${userId}_${classId}_${listId}_day${dayNumber}_${phaseType}`
}

/**
 * Clear all session states for a user's class/list (cleanup on completion)
 * @param {string} userId - Firebase user UID
 * @param {string} classId
 * @param {string} listId
 */
export function clearAllSessionStates(userId, classId, listId) {
  try {
    const prefix = `${SESSION_STORAGE_KEY}${userId}_${classId}_${listId}_`
    Object.keys(localStorage)
      .filter(key => key.startsWith(prefix))
      .forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.warn('Failed to clear all session states:', error)
  }
}

/**
 * Save session state to localStorage
 * @param {string} sessionId
 * @param {Object} state - { lastPhase, studyQueue, dismissedWords, currentIndex, isFlipped, wordPool }
 */
export function saveSessionState(sessionId, state) {
  try {
    const data = {
      ...state,
      timestamp: Date.now()
    }
    localStorage.setItem(sessionId, JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to save session state:', error)
  }
}

/**
 * Get saved session state
 * @param {string} sessionId
 * @returns {Object|null} Saved state or null
 */
export function getSessionState(sessionId) {
  try {
    const stored = localStorage.getItem(sessionId)
    if (!stored) return null
    return JSON.parse(stored)
  } catch (error) {
    console.warn('Failed to get session state:', error)
    return null
  }
}

/**
 * Clear session state
 * @param {string} sessionId
 */
export function clearSessionState(sessionId) {
  try {
    localStorage.removeItem(sessionId)
  } catch (error) {
    console.warn('Failed to clear session state:', error)
  }
}

/**
 * Check if last phase was a test phase
 * @param {string} lastPhase
 * @returns {boolean}
 */
export function wasInTestPhase(lastPhase) {
  return lastPhase === 'NEW_TEST' || lastPhase === 'REVIEW_TEST'
}
