import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '../../firebase'
import { COLLECTIONS, SESSION_STATUS } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * Create new session or resume existing via Cloud Function (server-side)
 * @param {string} testId - Test ID
 * @param {string} userId - User ID (used for logging only; server uses auth.uid)
 * @param {string|null} assignmentId - Assignment ID if assigned
 * @returns {Promise<Object>} Session object
 */
export async function createOrResumeSession(testId, userId, assignmentId = null) {
  try {
    const functions = getFunctions()
    const createSession = httpsCallable(functions, 'createSession')
    const response = await createSession({ testId, assignmentId })
    return response.data
  } catch (error) {
    logError('apSessionService.createOrResumeSession', { testId, userId }, error)
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
      where('status', 'in', [SESSION_STATUS.IN_PROGRESS, SESSION_STATUS.PAUSED])
    )
    const sessionsSnap = await getDocs(sessionsQuery)

    if (sessionsSnap.empty) {
      return null
    }

    const doc = sessionsSnap.docs[0]
    return { id: doc.id, ...doc.data() }
  } catch (error) {
    logError('apSessionService.getActiveSession', { testId, userId }, error)
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
    logError('apSessionService.updateSession', { sessionId }, error)
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
    logError('apSessionService.saveAnswer', { sessionId, questionId }, error)
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
    logError('apSessionService.toggleQuestionFlag', { sessionId, questionId }, error)
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
    logError('apSessionService.updatePosition', { sessionId }, error)
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
    logError('apSessionService.updateTimer', { sessionId, sectionId }, error)
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
    logError('apSessionService.completeSession', { sessionId }, error)
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
    logError('apSessionService.getSession', { sessionId }, error)
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
    logError('apSessionService.updateHeartbeat', { sessionId }, error)
    // Don't throw - heartbeat failures shouldn't break the app
  }
}
