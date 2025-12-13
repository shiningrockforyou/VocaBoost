/**
 * Session Service
 *
 * Manages the persistence of study session state.
 * Allows students to leave and resume sessions without losing progress.
 *
 * Key behaviors:
 * - Study progress (dismissed words) persists across page loads
 * - Test progress does NOT persist (exiting a test resets it)
 * - Each list has independent session state
 * - Moving to next day clears the session state
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Session phases - matches the flow structure
 */
export const SESSION_PHASE = {
  NEW_WORDS_STUDY: 'new-words-study',
  NEW_WORDS_TEST: 'new-words-test',
  REVIEW_STUDY: 'review-study',
  REVIEW_TEST: 'review-test',
  COMPLETE: 'complete'
};

/**
 * Default session state for a new session
 */
export const DEFAULT_SESSION_STATE = {
  phase: SESSION_PHASE.NEW_WORDS_STUDY,
  currentStudyDay: 1,
  newWordsTestPassed: false,
  newWordsTestScore: null,
  reviewTestScore: null,
  reviewTestAttempts: 0,
  newWordsDismissedIds: [],
  reviewDismissedIds: [],
  lastUpdated: null
};

/**
 * Get the document ID for a session state record
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {string} Document ID in format "{classId}_{listId}"
 */
export function getSessionDocId(classId, listId) {
  return `${classId}_${listId}`;
}

/**
 * Get the current session state for a user's list
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @returns {Promise<Object|null>} Session state or null if none exists
 */
export async function getSessionState(userId, classId, listId) {
  if (!userId || !classId || !listId) return null;

  const docId = getSessionDocId(classId, listId);
  const sessionRef = doc(db, `users/${userId}/session_states`, docId);

  try {
    const snapshot = await getDoc(sessionRef);

    if (!snapshot.exists()) {
      return null;
    }

    return { id: snapshot.id, ...snapshot.data() };
  } catch (err) {
    console.error('Failed to get session state:', err);
    return null;
  }
}

/**
 * Save the current session state
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {Object} state - Session state to save
 * @returns {Promise<void>}
 */
export async function saveSessionState(userId, classId, listId, state) {
  if (!userId || !classId || !listId) {
    throw new Error('Missing required parameters for saveSessionState');
  }

  const docId = getSessionDocId(classId, listId);
  const sessionRef = doc(db, `users/${userId}/session_states`, docId);

  const sessionData = {
    ...state,
    classId,
    listId,
    lastUpdated: Timestamp.now()
  };

  await setDoc(sessionRef, sessionData, { merge: true });
}

/**
 * Clear session state (used when moving to next day)
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @returns {Promise<void>}
 */
export async function clearSessionState(userId, classId, listId) {
  if (!userId || !classId || !listId) return;

  const docId = getSessionDocId(classId, listId);
  const sessionRef = doc(db, `users/${userId}/session_states`, docId);

  try {
    await deleteDoc(sessionRef);
  } catch (err) {
    console.error('Failed to clear session state:', err);
  }
}

/**
 * Update a specific field in the session state
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateSessionState(userId, classId, listId, updates) {
  if (!userId || !classId || !listId) {
    throw new Error('Missing required parameters for updateSessionState');
  }

  const docId = getSessionDocId(classId, listId);
  const sessionRef = doc(db, `users/${userId}/session_states`, docId);

  await setDoc(sessionRef, {
    ...updates,
    lastUpdated: Timestamp.now()
  }, { merge: true });
}

/**
 * Mark a word as dismissed ("I know this") in the current session
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {string} wordId - Word ID to dismiss
 * @param {string} phase - Current phase ('new' or 'review')
 * @returns {Promise<void>}
 */
export async function dismissWord(userId, classId, listId, wordId, phase = 'new') {
  const currentState = await getSessionState(userId, classId, listId);

  if (phase === 'review') {
    const reviewDismissedIds = currentState?.reviewDismissedIds || [];
    if (!reviewDismissedIds.includes(wordId)) {
      await updateSessionState(userId, classId, listId, {
        reviewDismissedIds: [...reviewDismissedIds, wordId]
      });
    }
  } else {
    const newWordsDismissedIds = currentState?.newWordsDismissedIds || [];
    if (!newWordsDismissedIds.includes(wordId)) {
      await updateSessionState(userId, classId, listId, {
        newWordsDismissedIds: [...newWordsDismissedIds, wordId]
      });
    }
  }
}

/**
 * Reset dismissed words in the current session
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {string} phase - Which phase to reset ('new', 'review', or 'all')
 * @returns {Promise<void>}
 */
export async function resetDismissedWords(userId, classId, listId, phase = 'all') {
  if (phase === 'new') {
    await updateSessionState(userId, classId, listId, {
      newWordsDismissedIds: []
    });
  } else if (phase === 'review') {
    await updateSessionState(userId, classId, listId, {
      reviewDismissedIds: []
    });
  } else {
    await updateSessionState(userId, classId, listId, {
      newWordsDismissedIds: [],
      reviewDismissedIds: []
    });
  }
}

/**
 * Record new words test completion
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {number} score - Test score (0-1)
 * @param {number} threshold - Pass threshold (0-1)
 * @returns {Promise<boolean>} Whether the test was passed
 */
export async function recordNewWordsTestResult(userId, classId, listId, score, threshold) {
  const passed = score >= threshold;

  await updateSessionState(userId, classId, listId, {
    newWordsTestScore: score,
    newWordsTestPassed: passed,
    phase: passed ? SESSION_PHASE.REVIEW_STUDY : SESSION_PHASE.NEW_WORDS_STUDY
  });

  return passed;
}

/**
 * Record review test completion
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {number} score - Test score (0-1)
 * @returns {Promise<void>}
 */
export async function recordReviewTestResult(userId, classId, listId, score) {
  const currentState = await getSessionState(userId, classId, listId);
  const attempts = (currentState?.reviewTestAttempts || 0) + 1;

  await updateSessionState(userId, classId, listId, {
    reviewTestScore: score,
    reviewTestAttempts: attempts,
    phase: SESSION_PHASE.COMPLETE
  });
}

/**
 * Increment review test attempts (for retakes)
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @returns {Promise<number>} New attempt count
 */
export async function incrementReviewTestAttempts(userId, classId, listId) {
  const currentState = await getSessionState(userId, classId, listId);
  const newAttempts = (currentState?.reviewTestAttempts || 0) + 1;

  await updateSessionState(userId, classId, listId, {
    reviewTestAttempts: newAttempts,
    phase: SESSION_PHASE.REVIEW_TEST
  });

  return newAttempts;
}

/**
 * Transition to the next phase in the session flow
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {string} nextPhase - The phase to transition to
 * @returns {Promise<void>}
 */
export async function transitionToPhase(userId, classId, listId, nextPhase) {
  await updateSessionState(userId, classId, listId, {
    phase: nextPhase
  });
}

/**
 * Check if session should show re-entry modal
 * (User completed review test but hasn't moved on)
 *
 * @param {Object} sessionState - Current session state
 * @returns {boolean}
 */
export function shouldShowReEntryModal(sessionState) {
  if (!sessionState) return false;

  return (
    sessionState.phase === SESSION_PHASE.COMPLETE &&
    sessionState.reviewTestScore !== null
  );
}

/**
 * Get the test type for review test based on attempt count
 * Written for first 3 attempts (if enabled), then MCQ
 *
 * @param {number} attemptCount - Current attempt count
 * @param {string} teacherTestMode - Teacher's test mode setting ('mcq' | 'typed' | 'both')
 * @returns {'mcq' | 'typed'}
 */
export function getReviewTestType(attemptCount, teacherTestMode) {
  // If teacher hasn't enabled written tests, always MCQ
  if (teacherTestMode !== 'typed' && teacherTestMode !== 'both') {
    return 'mcq';
  }

  // First 3 attempts use written, then MCQ to save API costs
  if (attemptCount < 3) {
    return 'typed';
  }

  return 'mcq';
}

/**
 * Initialize a new session state for a study day
 *
 * @param {string} userId - User ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {number} studyDay - The study day number
 * @param {boolean} isFirstDay - Whether this is day 1 (no review phase)
 * @returns {Promise<Object>} The initialized session state
 */
export async function initializeSessionState(userId, classId, listId, studyDay, isFirstDay = false) {
  const initialState = {
    ...DEFAULT_SESSION_STATE,
    currentStudyDay: studyDay,
    phase: SESSION_PHASE.NEW_WORDS_STUDY
  };

  await saveSessionState(userId, classId, listId, initialState);

  return initialState;
}
