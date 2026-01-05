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
      : null
  };
}

/**
 * Calculate streak based on last study date and current date
 * @param {Date|null} lastStudyDate - Previous study date
 * @param {number} currentStreak - Current streak count
 * @param {number} studyDaysPerWeek - Study days per week (<=5 means skip weekends)
 * @returns {number} Updated streak count
 */
function calculateUpdatedStreak(lastStudyDate, currentStreak, studyDaysPerWeek = 5) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const skipWeekends = studyDaysPerWeek <= 5;

  // Helper to check if a date is a weekend
  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Get the expected previous study day (accounting for weekends)
  const getExpectedPreviousDay = (fromDate) => {
    const prev = new Date(fromDate);
    prev.setDate(prev.getDate() - 1);
    prev.setHours(0, 0, 0, 0);
    if (skipWeekends) {
      while (isWeekend(prev)) {
        prev.setDate(prev.getDate() - 1);
      }
    }
    return prev;
  };

  // No previous session - start fresh streak
  if (!lastStudyDate) {
    return 1;
  }

  // Normalize lastStudyDate
  const lastDate = lastStudyDate instanceof Date
    ? lastStudyDate
    : (lastStudyDate?.toDate?.() || new Date(lastStudyDate));
  lastDate.setHours(0, 0, 0, 0);

  // Same day - streak unchanged
  if (lastDate.getTime() === today.getTime()) {
    return currentStreak || 1;
  }

  // Check if last session was the expected previous study day
  const expectedPrevDay = getExpectedPreviousDay(today);
  if (lastDate.getTime() === expectedPrevDay.getTime()) {
    return (currentStreak || 0) + 1;
  }

  // Streak broken - reset to 1
  return 1;
}

/**
 * Update class progress after a session
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @param {Object} sessionSummary - Session summary object
 * @param {number} newIntervention - New intervention level (0.0 to 1.0)
 * @param {number} studyDaysPerWeek - Study days per week for streak calculation
 * @returns {Promise<Object>} Updated class progress document
 */
export async function updateClassProgress(userId, classId, listId, sessionSummary, newIntervention, studyDaysPerWeek = 5) {
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

  // Calculate updated streak
  const lastStudyDate = current.lastStudyDate?.toDate?.() || current.lastStudyDate || null;
  const streakDays = calculateUpdatedStreak(lastStudyDate, current.streakDays || 0, studyDaysPerWeek);

  const updates = {
    currentStudyDay: (current.currentStudyDay || 0) + 1,
    totalWordsIntroduced: (current.totalWordsIntroduced || 0) + (sessionSummary.wordsIntroduced || 0),
    interventionLevel: newIntervention,
    recentSessions,
    stats,
    streakDays,
    lastStudyDate: Timestamp.now(),
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

/**
 * Fetch progress for multiple students across all lists assigned to a class
 * @param {string[]} studentIds - Array of student user IDs
 * @param {string} classId - Class ID
 * @param {string[]} listIds - Array of assigned list IDs
 * @returns {Promise<Object>} Map of { [studentId]: { [listId]: progressData } }
 */
export async function fetchStudentsProgressForClass(studentIds, classId, listIds) {
  const progressMap = {};

  // Initialize structure
  studentIds.forEach(studentId => {
    progressMap[studentId] = {};
  });

  // Batch fetch: For each student, fetch progress for all lists
  const promises = [];
  for (const studentId of studentIds) {
    for (const listId of listIds) {
      promises.push(
        getClassProgress(studentId, classId, listId)
          .then(progress => ({ studentId, listId, progress }))
          .catch(() => ({ studentId, listId, progress: null }))
      );
    }
  }

  const results = await Promise.all(promises);

  results.forEach(({ studentId, listId, progress }) => {
    progressMap[studentId][listId] = progress;
  });

  return progressMap;
}

