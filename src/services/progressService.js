import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  DEFAULT_CLASS_PROGRESS, 
  createClassProgress,
  MAX_RECENT_SESSIONS 
} from '../types/studyTypes';

/**
 * Get the document ID for a class progress record
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {string} Document ID in format "{classId}_{listId}"
 */
export function getProgressDocId(classId, listId) {
  return `${classId}_${listId}`;
}

/**
 * Get or create class progress for a student
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {Promise<Object>} Class progress document
 */
export async function getOrCreateClassProgress(userId, classId, listId) {
  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);
  
  const snapshot = await getDoc(progressRef);
  
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  
  // Create new progress document
  const newProgress = createClassProgress(classId, listId);
  await setDoc(progressRef, {
    ...newProgress,
    programStartDate: Timestamp.now(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  return { id: docId, ...newProgress };
}

/**
 * Calculate aggregate stats from recent sessions
 * @param {Array} sessions - Array of session summary objects
 * @returns {Object} Progress stats object
 */
function calculateProgressStats(sessions) {
  const newWordScores = sessions
    .filter(s => s.newWordScore !== null && s.newWordScore !== undefined)
    .map(s => s.newWordScore);
  
  const reviewScores = sessions
    .filter(s => s.reviewScore !== null && s.reviewScore !== undefined)
    .map(s => s.reviewScore);
  
  return {
    avgNewWordScore: newWordScores.length > 0 
      ? newWordScores.reduce((a, b) => a + b, 0) / newWordScores.length 
      : null,
    avgReviewScore: reviewScores.length > 0 
      ? reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length 
      : null,
    estimatedMastery: null,  // Calculated elsewhere with status counts
    recoveryRate: null,       // Requires tracking status transitions
    discoveryFailureRate: null
  };
}

/**
 * Update class progress after a session
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @param {Object} sessionSummary - Session summary object
 * @param {number} newIntervention - New intervention level (0.0 to 1.0)
 * @returns {Promise<Object>} Updated class progress document
 */
export async function updateClassProgress(userId, classId, listId, sessionSummary, newIntervention) {
  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);

  const snapshot = await getDoc(progressRef);
  const current = snapshot.exists() ? snapshot.data() : DEFAULT_CLASS_PROGRESS;

  // Guard: Check if this is the expected next day (prevents duplicate completions)
  const expectedDay = (current.currentStudyDay || 0) + 1;
  if (sessionSummary.dayNumber && sessionSummary.dayNumber !== expectedDay) {
    console.warn(`Duplicate day completion blocked: expected day ${expectedDay}, got day ${sessionSummary.dayNumber}`);
    return { id: docId, ...current }; // Return existing progress unchanged
  }

  // Keep only last MAX_RECENT_SESSIONS
  const recentSessions = [...(current.recentSessions || []), sessionSummary]
    .slice(-MAX_RECENT_SESSIONS);
  
  // Calculate new stats from recent sessions
  const stats = calculateProgressStats(recentSessions);
  
  const updates = {
    currentStudyDay: (current.currentStudyDay || 0) + 1,
    totalWordsIntroduced: (current.totalWordsIntroduced || 0) + (sessionSummary.wordsIntroduced || 0),
    interventionLevel: newIntervention,
    recentSessions,
    stats,
    lastSessionAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  if (snapshot.exists()) {
    await updateDoc(progressRef, updates);
  } else {
    await setDoc(progressRef, {
      ...createClassProgress(classId, listId),
      ...updates,
      programStartDate: Timestamp.now(),
      createdAt: Timestamp.now()
    });
  }
  
  return { id: docId, ...current, ...updates };
}

/**
 * Get class progress (read-only)
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {Promise<Object|null>} Class progress document or null if not found
 */
export async function getClassProgress(userId, classId, listId) {
  const docId = getProgressDocId(classId, listId);
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);
  
  const snapshot = await getDoc(progressRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return { id: snapshot.id, ...snapshot.data() };
}

