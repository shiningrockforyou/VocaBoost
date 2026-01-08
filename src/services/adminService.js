import {
  collection,
  collectionGroup,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  query,
  where
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Fetch all class_progress documents across all users
 * Uses collection group query for efficiency
 * @returns {Promise<Array>} Array of progress records with userId attached
 */
export async function fetchAllClassProgress() {
  const progressRef = collectionGroup(db, 'class_progress');
  const snapshot = await getDocs(progressRef);

  const progressRecords = [];
  snapshot.forEach((docSnap) => {
    // Extract userId from the document path: users/{userId}/class_progress/{docId}
    const pathParts = docSnap.ref.path.split('/');
    const userId = pathParts[1];

    progressRecords.push({
      id: docSnap.id,
      odId: docSnap.id,
      userId,
      ...docSnap.data()
    });
  });

  return progressRecords;
}

/**
 * Fetch all users (for display names and emails)
 * @returns {Promise<Object>} Map of userId -> user data
 */
export async function fetchAllUsers() {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);

  const usersMap = {};
  snapshot.forEach((docSnap) => {
    usersMap[docSnap.id] = {
      id: docSnap.id,
      ...docSnap.data()
    };
  });

  return usersMap;
}

/**
 * Fetch all classes (for class names)
 * @returns {Promise<Object>} Map of classId -> class data
 */
export async function fetchAllClasses() {
  const classesRef = collection(db, 'classes');
  const snapshot = await getDocs(classesRef);

  const classesMap = {};
  snapshot.forEach((docSnap) => {
    classesMap[docSnap.id] = {
      id: docSnap.id,
      ...docSnap.data()
    };
  });

  return classesMap;
}

/**
 * Fetch all lists (for list names)
 * @returns {Promise<Object>} Map of listId -> list data
 */
export async function fetchAllLists() {
  const listsRef = collection(db, 'lists');
  const snapshot = await getDocs(listsRef);

  const listsMap = {};
  snapshot.forEach((docSnap) => {
    listsMap[docSnap.id] = {
      id: docSnap.id,
      ...docSnap.data()
    };
  });

  return listsMap;
}

/**
 * Fetch all admin data in parallel
 * @returns {Promise<Object>} Combined data { progressRecords, usersMap, classesMap, listsMap }
 */
export async function fetchAllAdminData() {
  const [progressRecords, usersMap, classesMap, listsMap] = await Promise.all([
    fetchAllClassProgress(),
    fetchAllUsers(),
    fetchAllClasses(),
    fetchAllLists()
  ]);

  return { progressRecords, usersMap, classesMap, listsMap };
}

/**
 * Update a class_progress document
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateClassProgressAdmin(userId, classId, listId, updates) {
  const docId = `${classId}_${listId}`;
  const progressRef = doc(db, `users/${userId}/class_progress`, docId);

  // Convert date strings to Timestamps if needed
  const processedUpdates = { ...updates };

  if (updates.lastStudyDate !== undefined) {
    processedUpdates.lastStudyDate = updates.lastStudyDate
      ? Timestamp.fromDate(new Date(updates.lastStudyDate))
      : null;
  }

  if (updates.lastSessionAt !== undefined) {
    processedUpdates.lastSessionAt = updates.lastSessionAt
      ? Timestamp.fromDate(new Date(updates.lastSessionAt))
      : null;
  }

  // Update stats if avgNewWordScore or avgReviewScore is provided
  if (updates.avgNewWordScore !== undefined || updates.avgReviewScore !== undefined) {
    processedUpdates.stats = {
      avgNewWordScore: updates.avgNewWordScore ?? null,
      avgReviewScore: updates.avgReviewScore ?? null
    };
    delete processedUpdates.avgNewWordScore;
    delete processedUpdates.avgReviewScore;
  }

  processedUpdates.updatedAt = Timestamp.now();

  await updateDoc(progressRef, processedUpdates);
}

/**
 * Format progress data for table display
 * @param {Array} progressRecords - Raw progress records
 * @param {Object} usersMap - Users lookup map
 * @param {Object} classesMap - Classes lookup map
 * @param {Object} listsMap - Lists lookup map
 * @returns {Array} Formatted records for display
 */
export function formatProgressForDisplay(progressRecords, usersMap, classesMap, listsMap) {
  return progressRecords.map(record => {
    const user = usersMap[record.userId] || {};
    const classData = classesMap[record.classId] || {};
    const listData = listsMap[record.listId] || {};

    // Convert Timestamps to Date objects for display
    const lastStudyDate = record.lastStudyDate?.toDate?.() || record.lastStudyDate || null;
    const lastSessionAt = record.lastSessionAt?.toDate?.() || record.lastSessionAt || null;

    return {
      // Identifiers (for editing)
      odId: record.id,
      odId: record.id,
      userId: record.userId,
      classId: record.classId,
      listId: record.listId,

      // Display fields
      studentName: user.profile?.displayName || user.email || 'Unknown',
      studentEmail: user.email || 'Unknown',
      className: classData.name || record.classId || 'Unknown',
      listName: listData.name || record.listId || 'Unknown',

      // Progress fields (editable)
      currentStudyDay: record.currentStudyDay || 0,
      totalWordsIntroduced: record.totalWordsIntroduced || 0,
      streakDays: record.streakDays || 0,
      interventionLevel: record.interventionLevel || 0,
      avgNewWordScore: record.stats?.avgNewWordScore ?? null,
      avgReviewScore: record.stats?.avgReviewScore ?? null,
      lastStudyDate,
      lastSessionAt
    };
  });
}
