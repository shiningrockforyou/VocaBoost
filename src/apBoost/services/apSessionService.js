import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS, SESSION_STATUS } from '../utils/apTypes'

/**
 * Generate a unique session token
 */
function generateSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Create new session or resume existing
 * @param {string} testId - Test ID
 * @param {string} userId - User ID
 * @param {string|null} assignmentId - Assignment ID if assigned
 * @returns {Promise<Object>} Session object
 */
export async function createOrResumeSession(testId, userId, assignmentId = null) {
  try {
    // Check for existing active session
    const existingSession = await getActiveSession(testId, userId)
    if (existingSession) {
      return existingSession
    }

    // Get attempt count
    const attemptsQuery = query(
      collection(db, COLLECTIONS.TEST_RESULTS),
      where('testId', '==', testId),
      where('userId', '==', userId)
    )
    const attemptsSnap = await getDocs(attemptsQuery)
    const attemptNumber = attemptsSnap.size + 1

    // Create new session
    const sessionId = `${userId}_${testId}_${Date.now()}`
    const sessionData = {
      userId,
      testId,
      assignmentId,
      sessionToken: generateSessionToken(),
      status: SESSION_STATUS.IN_PROGRESS,
      attemptNumber,
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
      sectionTimeRemaining: {},
      answers: {},
      flaggedQuestions: [],
      annotations: {},
      strikethroughs: {},
      lastHeartbeat: serverTimestamp(),
      lastAction: serverTimestamp(),
      startedAt: serverTimestamp(),
      completedAt: null,
    }

    await setDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), sessionData)

    return { id: sessionId, ...sessionData }
  } catch (error) {
    console.error('Error creating/resuming session:', error)
    throw error
  }
}

/**
 * Get active session for user/test combination
 * @param {string} testId - Test ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Active session or null
 */
export async function getActiveSession(testId, userId) {
  try {
    const sessionsQuery = query(
      collection(db, COLLECTIONS.SESSION_STATE),
      where('testId', '==', testId),
      where('userId', '==', userId),
      where('status', '==', SESSION_STATUS.IN_PROGRESS)
    )
    const sessionsSnap = await getDocs(sessionsQuery)

    if (sessionsSnap.empty) {
      return null
    }

    const doc = sessionsSnap.docs[0]
    return { id: doc.id, ...doc.data() }
  } catch (error) {
    console.error('Error getting active session:', error)
    return null
  }
}

/**
 * Update session state
 * @param {string} sessionId - Session ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateSession(sessionId, updates) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      ...updates,
      lastAction: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating session:', error)
    throw error
  }
}

/**
 * Save answer to session
 * @param {string} sessionId - Session ID
 * @param {string} questionId - Question ID
 * @param {string} answer - Selected answer
 * @returns {Promise<void>}
 */
export async function saveAnswer(sessionId, questionId, answer) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      [`answers.${questionId}`]: answer,
      lastAction: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error saving answer:', error)
    throw error
  }
}

/**
 * Toggle flag for a question
 * @param {string} sessionId - Session ID
 * @param {string} questionId - Question ID
 * @param {boolean} flagged - Whether to flag or unflag
 * @returns {Promise<void>}
 */
export async function toggleQuestionFlag(sessionId, questionId, flagged) {
  try {
    const sessionDoc = await getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId))
    if (!sessionDoc.exists()) {
      throw new Error('Session not found')
    }

    const session = sessionDoc.data()
    let flaggedQuestions = session.flaggedQuestions || []

    if (flagged) {
      if (!flaggedQuestions.includes(questionId)) {
        flaggedQuestions = [...flaggedQuestions, questionId]
      }
    } else {
      flaggedQuestions = flaggedQuestions.filter(id => id !== questionId)
    }

    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      flaggedQuestions,
      lastAction: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error toggling flag:', error)
    throw error
  }
}

/**
 * Update navigation position
 * @param {string} sessionId - Session ID
 * @param {number} sectionIndex - Current section index
 * @param {number} questionIndex - Current question index
 * @returns {Promise<void>}
 */
export async function updatePosition(sessionId, sectionIndex, questionIndex) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      currentSectionIndex: sectionIndex,
      currentQuestionIndex: questionIndex,
      lastAction: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating position:', error)
    throw error
  }
}

/**
 * Update timer state
 * @param {string} sessionId - Session ID
 * @param {string} sectionId - Section ID
 * @param {number} timeRemaining - Seconds remaining
 * @returns {Promise<void>}
 */
export async function updateTimer(sessionId, sectionId, timeRemaining) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      [`sectionTimeRemaining.${sectionId}`]: timeRemaining,
      lastAction: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating timer:', error)
    throw error
  }
}

/**
 * Mark session as completed
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function completeSession(sessionId) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      status: SESSION_STATUS.COMPLETED,
      completedAt: serverTimestamp(),
      lastAction: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error completing session:', error)
    throw error
  }
}

/**
 * Load existing session by ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session object or null
 */
export async function getSession(sessionId) {
  try {
    const sessionDoc = await getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId))
    if (!sessionDoc.exists()) {
      return null
    }
    return { id: sessionDoc.id, ...sessionDoc.data() }
  } catch (error) {
    console.error('Error getting session:', error)
    throw error
  }
}

/**
 * Update heartbeat timestamp (for connection monitoring)
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function updateHeartbeat(sessionId) {
  try {
    await updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
      lastHeartbeat: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating heartbeat:', error)
    // Don't throw - heartbeat failures shouldn't break the app
  }
}
