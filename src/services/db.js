import {
  Timestamp,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db, auth } from '../firebase'
import { SERVER_CHALLENGE_WRITE, LIST_SCOPED_RECON, SERVER_RESET_PROGRESS, CYCLING_ENABLED, SERVER_OVERRIDE, TEACHER_IDS_READ, REVIEW_PAIRING_V2, FORCED_PATHWAY } from '../config/featureFlags'
import { reviewPairsWithAnchor, RECENT_ATTEMPTS_WINDOW } from '../utils/reviewPairing'
// CS PR-3 · WI-1 (FORCED_PATHWAY): grandfathered completion-engagement predicate + binary-throttle
// owner. Consumed ONLY under the flag — the getReviewForDay reconciliation engagement gate + the
// challenge-accept hold-guard below. Flag-off they are never read (byte-equivalent to today).
import { isCompletionEngaged, deriveThrottleMode } from '../utils/forcedPathway'
import { WORD_STATUS, DEFAULT_STUDY_STATE } from '../types/studyTypes'

// deepfix P2 / C-35 (#7): resolve a class's assigned list ids. FIX: `assignedLists || Object.keys(assignments)`
// never falls back when assignedLists is an empty array (`[]` is truthy) → "0 assigned lists" split-brain.
// Use a length check. (Do NOT use at the two intentional accumulator seeds, db.js ~811/~835.)
function getAssignedListIds(classData) {
  return (classData?.assignedLists?.length
    ? classData.assignedLists
    : Object.keys(classData?.assignments || {}))
}

const defaultProfile = {
  displayName: '',
  school: '',
  gradYear: null,
  gradMonth: null,
  calculatedGrade: null,
  avatarUrl: '',
}

const defaultStats = {
  totalWordsLearned: 0,
}

const defaultChallenges = {
  history: [],
}

const defaultSettings = {
  weeklyGoal: 100,
  useUnifiedQueue: false,
  primaryFocusListId: null,
  primaryFocusClassId: null,
}

const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5)

// =============================================================================
// Retry Infrastructure for Critical Operations
// =============================================================================

/**
 * Check if an error is transient (worth retrying)
 */
function isTransientError(error) {
  const transientCodes = [
    'unavailable',
    'deadline-exceeded',
    'resource-exhausted',
    'cancelled',
    'unknown',
    'internal',
    'aborted'
  ]
  return transientCodes.includes(error?.code) ||
         error?.message?.includes('network') ||
         error?.message?.includes('timeout')
}

/**
 * Add jitter to prevent thundering herd (+/- 25%)
 */
function addJitter(baseDelayMs) {
  const jitter = baseDelayMs * 0.25
  return baseDelayMs + (Math.random() * jitter * 2 - jitter)
}

/**
 * Log system events for monitoring anomalies
 * @param {string} eventType - Event type identifier
 * @param {Object} data - Event data
 * @param {string} severity - 'warning' or 'error'
 */
export async function logSystemEvent(eventType, data, severity = 'warning') {
  try {
    await addDoc(collection(db, 'system_logs'), {
      type: eventType,
      severity,
      ...data,
      timestamp: serverTimestamp()
    })
  } catch (err) {
    // Don't let logging failure break the app
    console.error('Failed to write system log:', err)
  }
}

/**
 * Generic retry wrapper for critical operations
 * @param {Function} fn - Async function to execute
 * @param {Object} options - { maxRetries, totalTimeoutMs }
 * @param {Object} loggingContext - Context for logging (userId, classId, listId, etc.)
 * @returns {Promise<any>} Result of fn()
 */
export async function withRetry(fn, options = {}, loggingContext = {}) {
  const { maxRetries = 3, totalTimeoutMs = 15000 } = options
  const startTime = Date.now()
  const errorCodes = []
  let lastError

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check total timeout
    if (Date.now() - startTime > totalTimeoutMs) {
      break
    }

    try {
      const result = await fn()

      // Log if retries were needed (anomaly)
      if (attempt > 0) {
        logSystemEvent('attempt_retry_succeeded', {
          ...loggingContext,
          retriesNeeded: attempt,
          totalDurationMs: Date.now() - startTime,
          errorCodes
        })
      }
      return result
    } catch (error) {
      lastError = error
      errorCodes.push(error?.code || 'unknown')

      // Don't retry non-transient errors (auth, permission)
      if (!isTransientError(error)) {
        throw error
      }

      // Exponential backoff with jitter: ~1s, ~2s, ~4s
      if (attempt < maxRetries - 1) {
        const baseDelay = Math.pow(2, attempt) * 1000
        const delayWithJitter = addJitter(baseDelay)
        const remainingTime = totalTimeoutMs - (Date.now() - startTime)
        const actualDelay = Math.min(delayWithJitter, remainingTime)

        if (actualDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, actualDelay))
        }
      }
    }
  }

  // All retries failed - log and throw
  logSystemEvent('attempt_write_failed', {
    ...loggingContext,
    retries: maxRetries,
    totalDurationMs: Date.now() - startTime,
    errorCodes,
    lastError: lastError?.code || lastError?.message,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
  }, 'error')

  throw new Error(`Operation failed after ${maxRetries} retries: ${lastError?.message}`)
}

const normalizePOS = (value) => (value || '').toString().trim().toLowerCase()

/**
 * Calculate available challenge tokens based on active rejections
 * @param {Array} challengeHistory - Array of challenge history entries
 * @returns {number} Available tokens (0-5)
 */
// Start of the current token-week (Monday 04:00 KST) in UTC millis — byte-identical twin of the server
// `startOfKstWeekMs` in functions/index.js (KST = fixed +540min, no DST). Challenge tokens reset weekly at
// Monday 04:00 KST (David 2026-07-19). Keep these two implementations identical or client/server token counts drift.
const KST_OFFSET_MS = 540 * 60 * 1000
const WEEKLY_RESET_HOUR_KST = 4 // Monday 04:00 KST
export function startOfKstWeekMs(nowMs) {
  const resetShift = WEEKLY_RESET_HOUR_KST * 60 * 60 * 1000
  const d = new Date(nowMs + KST_OFFSET_MS - resetShift)
  const day = d.getUTCDay() // 0=Sun..6=Sat in KST wall-clock
  const diff = day === 0 ? -6 : 1 - day // days back to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime() - KST_OFFSET_MS + resetShift // → most recent Monday 04:00 KST at/before nowMs
}

// A rejection consumes a token only for the CURRENT KST week; at Monday 00:00 KST the week advances and last
// week's rejections stop counting → every student refills to 5 automatically. Keyed on `challengedAt` (set at
// submit), not the now-vestigial `replenishAt`. Byte-parity with server `availableChallengeTokens`.
export const getAvailableChallengeTokens = (challengeHistory = []) => {
  const weekStart = startOfKstWeekMs(Date.now())
  const activeRejections = challengeHistory.filter(
    (h) => h.status === 'rejected' && (h.challengedAt?.toMillis?.() ?? 0) >= weekStart,
  ).length
  return Math.max(0, 5 - activeRejections)
}

/**
 * Creates or merges a Firestore user document that matches the spec defaults.
 * The caller can supply overrides for any nested field via the payload argument.
 */
export const createUserDocument = async (user, payload = {}) => {
  if (!user?.uid) {
    throw new Error('A valid Firebase user is required.')
  }

  const userDocRef = doc(db, 'users', user.uid)
  const {
    profile: profileOverride,
    stats: statsOverride,
    settings: settingsOverride,
    ...docOverrides
  } = payload

  const mergedProfile = {
    ...defaultProfile,
    displayName: user.displayName ?? defaultProfile.displayName,
    avatarUrl: user.photoURL ?? defaultProfile.avatarUrl,
    ...profileOverride,
  }

  const mergedStats = {
    ...defaultStats,
    ...statsOverride,
  }

  const mergedSettings = {
    ...defaultSettings,
    ...settingsOverride,
  }

  const userDocument = {
    role: docOverrides.role ?? 'student',
    email: user.email ?? '',
    profile: mergedProfile,
    stats: mergedStats,
    settings: mergedSettings,
    challenges: docOverrides.challenges ?? defaultChallenges,
    enrolledClasses: {},
    createdAt: serverTimestamp(),
    ...docOverrides,
  }

  await setDoc(userDocRef, userDocument, { merge: true })
  return userDocRef
}

/**
 * Update a user's display name in BOTH the user profile (source of truth) and
 * every class member doc (denormalized copy that the teacher roster + gradebook
 * read). Must update both or those views show a stale name.
 * Used by student self-edit (Profile page); the teacher path uses the
 * renameStudent Cloud Function instead (Admin SDK, rules-scoped).
 * @param {string} userId
 * @param {string} newName
 * @returns {Promise<string>} the trimmed name actually saved
 */
export const updateDisplayName = async (userId, newName) => {
  const name = (newName || '').trim()
  if (!userId) throw new Error('userId is required.')
  if (name.length < 1) throw new Error('Name cannot be empty.')
  if (name.length > 60) throw new Error('Name must be 60 characters or fewer.')

  // 1) Source of truth
  await setDoc(doc(db, 'users', userId), { profile: { displayName: name } }, { merge: true })

  // 2) Denormalized copies in each enrolled class's members subcollection
  const userSnap = await getDoc(doc(db, 'users', userId))
  const enrolled = userSnap.exists() ? Object.keys(userSnap.data().enrolledClasses || {}) : []
  await Promise.all(
    enrolled.map((classId) =>
      setDoc(
        doc(db, 'classes', classId, 'members', userId),
        { displayName: name },
        { merge: true },
      ).catch((err) => console.warn(`member displayName sync failed for class ${classId}:`, err)),
    ),
  )

  return name
}

export const updateUserSettings = async (userId, settings = {}) => {
  if (!userId) {
    throw new Error('userId is required.')
  }

  const userRef = doc(db, 'users', userId)
  const updates = {}

  if (settings.weeklyGoal !== undefined) {
    const weeklyGoal = Number(settings.weeklyGoal)
    updates['settings.weeklyGoal'] = Number.isNaN(weeklyGoal) ? defaultSettings.weeklyGoal : Math.max(1, weeklyGoal)
  }

  if (settings.useUnifiedQueue !== undefined) {
    updates['settings.useUnifiedQueue'] = Boolean(settings.useUnifiedQueue)
  }

  if (settings.primaryFocusListId !== undefined) {
    updates['settings.primaryFocusListId'] = settings.primaryFocusListId
    updates['settings.primaryFocusClassId'] = settings.primaryFocusClassId || null
  }

  if (Object.keys(updates).length === 0) {
    return
  }

  await updateDoc(userRef, updates)
}

const generateJoinCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 6; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const createClass = async ({ name, ownerTeacherId }) => {
  if (!name?.trim()) {
    throw new Error('Class name is required.')
  }
  if (!ownerTeacherId) {
    throw new Error('A valid teacher ID is required.')
  }

  const classData = {
    name: name.trim(),
    ownerTeacherId,
    joinCode: generateJoinCode(),
    createdAt: serverTimestamp(),
    studentCount: 0,
    studentIds: [],
    settings: {
      allowStudentListImport: false,
    },
    assignedLists: [],
    mandatoryLists: [],
  }

  const docRef = await addDoc(collection(db, 'classes'), classData)
  return { id: docRef.id, ...classData }
}

export const fetchTeacherClasses = async (ownerTeacherId) => {
  if (!ownerTeacherId) {
    return []
  }

  const classesQuery = query(
    collection(db, 'classes'),
    where('ownerTeacherId', '==', ownerTeacherId),
  )
  const snapshot = await getDocs(classesQuery)
  
  // Fetch student counts for all classes in parallel
  const classesWithCounts = await Promise.all(
    snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data()
      const classId = docSnap.id
      
      // If studentCount exists and is a number, use it
      if (typeof data.studentCount === 'number') {
        return {
          id: classId,
          ...data,
          studentCount: data.studentCount
        }
      }
      
      // Otherwise, count from members subcollection (for legacy classes)
      try {
        const membersRef = collection(db, 'classes', classId, 'members')
        const membersSnap = await getDocs(membersRef)
        const count = membersSnap.size
        
        return {
          id: classId,
          ...data,
          studentCount: count
        }
      } catch (err) {
        console.warn(`Failed to count members for class ${classId}:`, err)
        return {
          id: classId,
          ...data,
          studentCount: 0
        }
      }
    })
  )
  
  return classesWithCounts
}

export const deleteClass = async (classId) => {
  if (!classId) {
    throw new Error('classId is required.')
  }
  await deleteDoc(doc(db, 'classes', classId))
}

export const removeStudentFromClass = async (classId, studentId) => {
  if (!classId || !studentId) {
    throw new Error('classId and studentId are required.')
  }

  const classRef = doc(db, 'classes', classId)
  const classDoc = await getDoc(classRef)

  if (!classDoc.exists()) {
    throw new Error('Class not found')
  }

  await updateDoc(classRef, {
    studentIds: arrayRemove(studentId),
    studentCount: increment(-1),
  })

  // Also remove from members subcollection
  try {
    const memberRef = doc(db, 'classes', classId, 'members', studentId)
    await deleteDoc(memberRef)
  } catch (err) {
    console.warn('Could not remove from members subcollection:', err)
    // Continue anyway - main removal succeeded
  }

  // Also remove from user's enrolledClasses
  try {
    const userRef = doc(db, 'users', studentId)
    await updateDoc(userRef, {
      [`enrolledClasses.${classId}`]: deleteField()
    })
  } catch (err) {
    console.warn('Could not remove from user enrolledClasses:', err)
    // Continue anyway - main removal succeeded
  }
}

export const createList = async ({ title, description = '', ownerId, visibility = 'private' }) => {
  if (!title?.trim()) {
    throw new Error('List title is required.')
  }
  if (!ownerId) {
    throw new Error('A valid ownerId (teacher) is required.')
  }

  const payload = {
    title: title.trim(),
    description: description.trim(),
    ownerId,
    visibility,
    wordCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const docRef = await addDoc(collection(db, 'lists'), payload)
  return { id: docRef.id, ...payload }
}

export const fetchTeacherLists = async (ownerId) => {
  if (!ownerId) {
    return []
  }

  const listsQuery = query(collection(db, 'lists'), where('ownerId', '==', ownerId))
  const snapshot = await getDocs(listsQuery)
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }))
}

export const fetchStudentClasses = async (studentId) => {
  if (!studentId) {
    return []
  }

  const userRef = doc(db, 'users', studentId)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) {
    return []
  }

  const userData = userSnap.data() || {}
  const enrolledEntries = Object.entries(userData.enrolledClasses || {})

  if (!enrolledEntries.length) {
    return []
  }

  const cleanupPayload = {}
  const classDetails = await Promise.all(
    enrolledEntries.map(async ([classId, info]) => {
      const classRef = doc(db, 'classes', classId)
      const classSnap = await getDoc(classRef)
      if (!classSnap.exists()) {
        cleanupPayload[`enrolledClasses.${classId}`] = deleteField()
        return null
      }

      const classData = classSnap.data() || {}
      const assignments = classData.assignments || {}
      Object.keys(assignments).forEach((key) => {
        if (!assignments[key].testMode) {
          assignments[key].testMode = 'mcq'
        }
      })
      const assignedListIds = getAssignedListIds(classData)  // C-35

      const assignedListDetails = await Promise.all(
        assignedListIds.map(async (listId) => {
          const listSnap = await getDoc(doc(db, 'lists', listId))
          if (!listSnap.exists()) return null
          const listData = { id: listSnap.id, ...listSnap.data() }
          const assignment = assignments[listId] || {}
          return {
            ...listData,
            pace: assignment.pace,
            testOptionsCount: assignment.testOptionsCount,
            testMode: assignment.testMode || 'mcq',
          }
        }),
      )

      return {
        id: classSnap.id,
        ...(info || {}),
        ...classData,
        assignedListDetails: assignedListDetails.filter(Boolean),
      }
    }),
  )

  if (Object.keys(cleanupPayload).length) {
    await updateDoc(userRef, cleanupPayload)
  }

  return classDetails.filter(Boolean)
}

export const fetchDashboardStats = async (userId) => {
  if (!userId) {
    return { latestTest: null }
  }

  const attemptsRef = collection(db, 'attempts')

  // Only fetch latestTest - other metrics derived from class_progress
  const attemptsSnap = await getDocs(
    query(
      attemptsRef,
      where('studentId', '==', userId),
      orderBy('submittedAt', 'desc'),
      limit(1),
    ),
  )

  const latestTest = attemptsSnap.docs.length > 0
    ? { id: attemptsSnap.docs[0].id, ...attemptsSnap.docs[0].data() }
    : null

  return { latestTest }
}

export const addWordToList = async (listId, wordData) => {
  if (!listId) {
    throw new Error('A listId is required.')
  }
  if (!wordData?.word || !wordData?.definition) {
    throw new Error('Word and definition are required.')
  }

  // Get current word count to determine position
  const listDoc = await getDoc(doc(db, 'lists', listId))
  const currentCount = listDoc.exists() ? (listDoc.data()?.wordCount ?? 0) : 0

  const definitions = wordData.definitions || {}
  if (wordData.definition && !definitions.en) {
    definitions.en = wordData.definition.trim()
  }

  const wordPayload = {
    word: wordData.word.trim(),
    definition: wordData.definition.trim(),
    definitions,
    partOfSpeech: wordData.partOfSpeech?.trim() || '',
    samples: wordData.sampleSentence ? [wordData.sampleSentence.trim()] : [],
    position: currentCount,  // 0-indexed position in list
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await addDoc(collection(db, 'lists', listId, 'words'), wordPayload)
  await updateDoc(doc(db, 'lists', listId), {
    wordCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  return wordPayload
}

export const updateWord = async (listId, wordId, wordData) => {
  if (!listId || !wordId) {
    throw new Error('List ID and Word ID are required.')
  }
  if (!wordData?.word || !wordData?.definition) {
    throw new Error('Word and definition are required.')
  }

  const definitions = wordData.definitions || {}
  if (wordData.definition && !definitions.en) {
    definitions.en = wordData.definition.trim()
  }

  const wordPayload = {
    word: wordData.word.trim(),
    definition: wordData.definition.trim(),
    definitions,
    partOfSpeech: wordData.partOfSpeech?.trim() || '',
    samples: wordData.sampleSentence ? [wordData.sampleSentence.trim()] : [],
    updatedAt: serverTimestamp(),
  }

  await updateDoc(doc(db, 'lists', listId, 'words', wordId), wordPayload)
  await updateDoc(doc(db, 'lists', listId), {
    updatedAt: serverTimestamp(),
  })

  return wordPayload
}

export const deleteWord = async (listId, wordId) => {
  if (!listId || !wordId) {
    throw new Error('List ID and Word ID are required.')
  }

  await deleteDoc(doc(db, 'lists', listId, 'words', wordId))
  await updateDoc(doc(db, 'lists', listId), {
    wordCount: increment(-1),
    updatedAt: serverTimestamp(),
  })
}

export const deleteList = async (listId) => {
  if (!listId) {
    throw new Error('listId is required.')
  }

  const wordsRef = collection(db, 'lists', listId, 'words')
  const BATCH_LIMIT = 400

  while (true) {
    const snapshot = await getDocs(query(wordsRef, limit(BATCH_LIMIT)))
    if (snapshot.empty) {
      break
    }

    const batch = writeBatch(db)
    snapshot.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref)
    })
    await batch.commit()

    if (snapshot.size < BATCH_LIMIT) {
      break
    }
  }

  await deleteDoc(doc(db, 'lists', listId))
}

export const batchAddWords = async (listId, wordsArray) => {
  if (!listId) {
    throw new Error('A listId is required.')
  }
  if (!Array.isArray(wordsArray) || wordsArray.length === 0) {
    throw new Error('wordsArray must be a non-empty array.')
  }

  const BATCH_LIMIT = 500
  const listRef = doc(db, 'lists', listId)

  // Get current word count to determine starting position
  const listDoc = await getDoc(listRef)
  let nextPosition = listDoc.exists() ? (listDoc.data()?.wordCount ?? 0) : 0

  let totalAdded = 0

  for (let i = 0; i < wordsArray.length; i += BATCH_LIMIT) {
    const chunk = wordsArray.slice(i, i + BATCH_LIMIT)
    const batch = writeBatch(db)

    chunk.forEach((wordData) => {
      if (!wordData.word || !wordData.definition) {
        return
      }

      const wordRef = doc(collection(db, 'lists', listId, 'words'))

      const definitions = {}
      if (wordData.definitions) {
        Object.assign(definitions, wordData.definitions)
      }
      if (wordData.definition) {
        definitions.en = wordData.definition.trim()
      }

      const wordPayload = {
        word: wordData.word.trim(),
        definition: wordData.definition.trim(),
        definitions,
        partOfSpeech: wordData.partOfSpeech?.trim() || '',
        samples: wordData.sampleSentence
          ? [wordData.sampleSentence.trim()]
          : wordData.sample
            ? [wordData.sample.trim()]
            : [],
        position: nextPosition++,  // Sequential 0-indexed position
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      batch.set(wordRef, wordPayload)
      totalAdded += 1
    })

    await batch.commit()
  }

  if (totalAdded > 0) {
    await updateDoc(listRef, {
      wordCount: increment(totalAdded),
      updatedAt: serverTimestamp(),
    })
  }

  return { added: totalAdded, total: wordsArray.length }
}

export const fetchClass = async (classId) => {
  if (!classId) {
    return null
  }

  const classSnap = await getDoc(doc(db, 'classes', classId))
  if (!classSnap.exists()) {
    return null
  }

  const classData = classSnap.data()
  
  // Backward compatibility: Convert old assignedLists array to new assignments map
  if (classData.assignedLists && !classData.assignments) {
    const assignments = {}
    classData.assignedLists.forEach((listId) => {
      assignments[listId] = {
        pace: 20,
        assignedAt: classData.createdAt || serverTimestamp(),
      }
    })
    classData.assignments = assignments
  }

  if (classData.assignments) {
    Object.keys(classData.assignments).forEach((id) => {
      const assignment = classData.assignments[id] || {}
      if (!assignment.testOptionsCount) {
        assignment.testOptionsCount = 4
      }
      if (!assignment.testMode) {
        assignment.testMode = 'mcq'
      }
      classData.assignments[id] = assignment
    })
  }

  return { id: classSnap.id, ...classData }
}

export const assignListToClass = async (
  classId,
  listId,
  pace = 20,
  testOptionsCount = 4,
  testMode = 'mcq',
  passThreshold = 95,
  testSizeNew = 50,
  reviewTestType = 'mcq',
  reviewTestSizeMin = 30,
  reviewTestSizeMax = 60,
) => {
  if (!classId || !listId) {
    throw new Error('classId and listId are required.')
  }

  const classRef = doc(db, 'classes', classId)
  const classSnap = await getDoc(classRef)
  const classData = classSnap.exists() ? classSnap.data() : {}

  // Get existing assignments or create new map
  const assignments = classData.assignments || {}

  // Update the assignment for this list
  assignments[listId] = {
    ...(assignments[listId] || {}),
    pace: Number(pace),
    testOptionsCount: Number(testOptionsCount) || 4,
    testMode: testMode || 'mcq',
    passThreshold: Number(passThreshold) || 95,
    testSizeNew: Number(testSizeNew) || 50,
    reviewTestType: reviewTestType || 'mcq',
    reviewTestSizeMin: Number(reviewTestSizeMin) || 30,
    reviewTestSizeMax: Number(reviewTestSizeMax) || 60,
    assignedAt: assignments[listId]?.assignedAt ?? serverTimestamp(),
  }

  // Also maintain backward compatibility with assignedLists array
  const assignedLists = classData.assignedLists || []
  const updatedAssignedLists = assignedLists.includes(listId)
    ? assignedLists
    : [...assignedLists, listId]

  await updateDoc(classRef, {
    assignments,
    assignedLists: updatedAssignedLists,
    updatedAt: serverTimestamp(),
  })
}

export const unassignListFromClass = async (classId, listId) => {
  if (!classId || !listId) {
    throw new Error('classId and listId are required.')
  }

  const classRef = doc(db, 'classes', classId)
  const classSnap = await getDoc(classRef)
  if (!classSnap.exists()) {
    throw new Error('Class not found.')
  }

  const classData = classSnap.data() || {}
  const currentAssignedLists = classData.assignedLists || []
  const updatedAssignedLists = currentAssignedLists.filter((id) => id !== listId)

  await updateDoc(classRef, {
    [`assignments.${listId}`]: deleteField(),
    assignedLists: updatedAssignedLists,
    updatedAt: serverTimestamp(),
  })
}

export const updateAssignmentSettings = async (classId, listId, settings = {}) => {
  if (!classId || !listId) {
    throw new Error('classId and listId are required.')
  }

  const classRef = doc(db, 'classes', classId)
  const classSnap = await getDoc(classRef)
  if (!classSnap.exists()) {
    throw new Error('Class not found.')
  }

  const classData = classSnap.data()
  const assignments = classData.assignments || {}

  if (!assignments[listId]) {
    throw new Error('List is not assigned to this class.')
  }

  const updates = {}
  if (settings.pace !== undefined) {
    const paceValue = Number(settings.pace)
    if (Number.isNaN(paceValue) || paceValue < 1 || paceValue > 500) {
      throw new Error('Pace must be between 1 and 500.')
    }
    updates.pace = paceValue
  }

  if (settings.testOptionsCount !== undefined) {
    const optionValue = Number(settings.testOptionsCount)
    if (Number.isNaN(optionValue) || optionValue < 1 || optionValue > 10) {
      throw new Error('Test options must be between 1 and 10.')
    }
    updates.testOptionsCount = optionValue
  }

  if (settings.testMode !== undefined) {
    const allowedModes = ['mcq', 'typed', 'both']
    if (!allowedModes.includes(settings.testMode)) {
      throw new Error('Invalid test mode. Must be mcq, typed, or both.')
    }
    updates.testMode = settings.testMode
  }

  // Review test settings
  if (settings.reviewTestType !== undefined) {
    const allowedModes = ['mcq', 'typed']
    if (!allowedModes.includes(settings.reviewTestType)) {
      throw new Error('Invalid review test type. Must be mcq or typed.')
    }
    updates.reviewTestType = settings.reviewTestType
  }

  if (settings.reviewTestSizeMin !== undefined) {
    const minValue = Number(settings.reviewTestSizeMin)
    if (Number.isNaN(minValue) || minValue < 1 || minValue > 500) {
      throw new Error('Review test size min must be between 1 and 500.')
    }
    updates.reviewTestSizeMin = minValue
  }

  if (settings.reviewTestSizeMax !== undefined) {
    const maxValue = Number(settings.reviewTestSizeMax)
    if (Number.isNaN(maxValue) || maxValue < 1 || maxValue > 500) {
      throw new Error('Review test size max must be between 1 and 500.')
    }
    updates.reviewTestSizeMax = maxValue
  }

  if (settings.studyDaysPerWeek !== undefined) {
    const daysValue = Number(settings.studyDaysPerWeek)
    if (Number.isNaN(daysValue) || daysValue < 1 || daysValue > 7) {
      throw new Error('Study days per week must be between 1 and 7.')
    }
    updates.studyDaysPerWeek = daysValue
  }

  if (settings.passThreshold !== undefined) {
    const thresholdValue = Number(settings.passThreshold)
    if (Number.isNaN(thresholdValue) || thresholdValue < 1 || thresholdValue > 100) {
      throw new Error('Pass threshold must be between 1 and 100.')
    }
    updates.passThreshold = thresholdValue
  }

  if (settings.testSizeNew !== undefined) {
    const sizeValue = Number(settings.testSizeNew)
    if (Number.isNaN(sizeValue) || sizeValue < 1 || sizeValue > 500) {
      throw new Error('New word test size must be between 1 and 500.')
    }
    updates.testSizeNew = sizeValue
  }

  // P8 · CONT-A (CONTINUATION_LINKS): `nextListId` — the per-class list-sequence link
  // (nullable). Teacher-authored policy config at the SAME trust level and write site as
  // pace/testSizeNew (owner-teacher-only via the same `classes` rules surface). Absent/null
  // = today's behavior exactly. Validated against the class's OWN assignments: the link
  // must point at another list assigned to THIS class, never at itself.
  if (settings.nextListId !== undefined) {
    if (settings.nextListId === null || settings.nextListId === '') {
      updates.nextListId = null
    } else {
      if (typeof settings.nextListId !== 'string') {
        throw new Error('Next list must be a list id or null.')
      }
      if (settings.nextListId === listId) {
        throw new Error('A list cannot be its own next list.')
      }
      if (!assignments[settings.nextListId]) {
        throw new Error('Next list must be another list assigned to this class.')
      }
      updates.nextListId = settings.nextListId
    }
  }

  // P9 · CYC (CYCLING_ENABLED): `cyclingEnabled` — the per-assignment second key of the
  // two-key cycling gate (x/plan §3b/§4.5). Owner-teacher-only, SAME trust level + write
  // site + `classes` rules surface as pace/testSizeNew (a student cannot flip it,
  // firestore.rules:55). Only PERSISTED when the global CYCLING_ENABLED build flag is on —
  // with the flag off the key is never written (undefined ⇒ untouched), so flag-off saves
  // are byte-identical to today's. Absent/false ⇒ today's behavior exactly (no cycling).
  if (CYCLING_ENABLED && settings.cyclingEnabled !== undefined) {
    updates.cyclingEnabled = settings.cyclingEnabled === true
  }

  assignments[listId] = {
    ...assignments[listId],
    ...updates,
  }

  await updateDoc(classRef, {
    assignments,
    updatedAt: serverTimestamp(),
  })
}

export const joinClass = async (studentId, joinCode) => {
  if (!studentId || !joinCode) {
    throw new Error('Student ID and join code are required.')
  }

  const classesRef = collection(db, 'classes')
  const classQuery = query(classesRef, where('joinCode', '==', joinCode.trim().toUpperCase()), limit(1))
  const classSnapshot = await getDocs(classQuery)

  if (classSnapshot.empty) {
    throw new Error('Class not found for that join code.')
  }

  const classDoc = classSnapshot.docs[0]
  const classData = { id: classDoc.id, ...classDoc.data() }
  const userSnap = await getDoc(doc(db, 'users', studentId))

  if (!userSnap.exists()) {
    throw new Error('User profile not found. Please complete signup first.')
  }

  const userData = userSnap.data()
  const displayName = userData.profile?.displayName ?? userData.email ?? ''
  const email = userData.email ?? ''

  // Check if student is already a member
  const memberRef = doc(db, 'classes', classDoc.id, 'members', studentId)
  const memberSnap = await getDoc(memberRef)
  const isNewMember = !memberSnap.exists()

  await setDoc(
    memberRef,
    {
      joinedAt: serverTimestamp(),
      displayName,
      email,
    },
    { merge: true },
  )

  // Increment studentCount and add to studentIds if this is a new member
  if (isNewMember) {
    await updateDoc(doc(db, 'classes', classDoc.id), {
      studentCount: increment(1),
      studentIds: arrayUnion(studentId),
    })
  }

  await setDoc(
    doc(db, 'users', studentId),
    {
      enrolledClasses: {
        [classDoc.id]: {
          name: classData.name,
          joinedAt: serverTimestamp(),
        },
      },
    },
    { merge: true },
  )

  return classData
}

export const fetchAllWords = async (listId) => {
  if (!listId) {
    console.log('[fetchAllWords] No listId provided, returning empty array')
    return []
  }

  const cacheKey = `vocab_cache_${listId}`
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
        console.log('[fetchAllWords] Returning cached words for listId:', listId)
        return parsed.words || []
      }
    }
  } catch (err) {
    console.warn('[fetchAllWords] Failed to read session cache:', err)
  }

  console.log('[fetchAllWords] Fetching all words for listId:', listId)

  const wordsRef = collection(db, 'lists', listId, 'words')
  const wordsQuery = query(wordsRef, orderBy('position', 'asc'))
  const snapshot = await getDocs(wordsQuery)
  const allWords = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }))

  console.log('[fetchAllWords] Total words:', allWords.length)

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), words: allWords }))
  } catch (err) {
    console.warn('[fetchAllWords] Failed to write session cache:', err)
  }

  return allWords
}

export const fetchStudentStats = async (userId, listId) => {
  if (!userId || !listId) {
    return { mastery: 0, due: 0, totalWords: 0, wordsLearned: 0, masteredWords: 0 }
  }

  const listWords = await fetchAllWords(listId)
  const totalWords = listWords.length
  if (totalWords === 0) {
    return { mastery: 0, due: 0, totalWords: 0, wordsLearned: 0, masteredWords: 0 }
  }

  const wordIds = listWords.map((w) => w.id)
  const studyStatesRef = collection(db, 'users', userId, 'study_states')
  const studyStatesSnap = await getDocs(studyStatesRef)
  const now = Timestamp.now()

  let wordsLearned = 0
  let masteredWords = 0
  let masteryCount = 0
  let dueCount = 0

  studyStatesSnap.docs.forEach((docSnap) => {
    const wordId = docSnap.id
    if (!wordIds.includes(wordId)) return

    const data = docSnap.data()
    // Use new status field if available, otherwise fall back to box
    const normalized = normalizeStudyState(data)
    const status = normalized.status
    
    // Words learned: PASSED or FAILED (tested at least once)
    if (status === WORD_STATUS.PASSED || status === WORD_STATUS.FAILED) {
      wordsLearned += 1
      masteryCount += 1
    }

    // Mastered words: PASSED status
    if (status === WORD_STATUS.PASSED) {
      masteredWords += 1
    }

    // Due count: For backwards compatibility, check nextReview (old system)
    // New system doesn't use nextReview, so this will be 0 for new format
    const nextReview = data.nextReview
    if (nextReview && nextReview.toMillis && nextReview.toMillis() < now.toMillis()) {
      dueCount += 1
    }
  })

  const mastery = totalWords > 0 ? Math.round((masteryCount / totalWords) * 100) : 0

  return {
    mastery,
    due: dueCount,
    totalWords,
    wordsLearned,
    masteredWords,
    masteryCount: masteredWords,
  }
}

export const fetchStudentAggregateStats = async (studentId) => {
  if (!studentId) {
    return { totalWordsLearned: 0 }
  }

  const studyStatesRef = collection(db, 'users', studentId, 'study_states')
  const studyStatesSnap = await getDocs(studyStatesRef)

  let totalWordsLearned = 0
  studyStatesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data()
    // Count words that have been tested (PASSED or FAILED)
    if (data.status && data.status !== 'NEVER_TESTED') {
      totalWordsLearned += 1
    }
  })

  return { totalWordsLearned }
}

export const calculateCredibility = (answers, userWordStates) => {
  // Calculate credibility based on ALL answers in this test
  // Taking the test is an implicit claim of knowledge
  if (answers.length === 0) {
    return 1.0
  }

  const correctCount = answers.filter((answer) => answer.isCorrect).length
  return correctCount / answers.length
}

/**
 * [deepfix P10 · OVR part (c) / David U1 = Option A] CLIENT twin of the server
 * foundation.computeTeacherIdsForAttempt — the additive `teacherIds` denormalization set the
 * teacher gradebook `array-contains` query matches (the C-19 read-surface widening). KEEP IN
 * SYNC with functions/foundation.js computeTeacherIdsForAttempt and the backfill migration
 * scripts/cs/deepfix-migrate-attempts-teacherids.mjs:
 *   teacherIds = { stampTeacherId (if set) }
 *              ∪ { classes/{c}.ownerTeacherId : student CURRENTLY enrolled in c AND c assigns listId }
 * List-scoped (owner of an enrolled class that ASSIGNS the list). Best-effort: read errors
 * fall back to the stamp-only set (never throws — the field is additive/denormalized). Callers
 * gate on TEACHER_IDS_READ, so this runs ONLY when the flag is on (byte-equivalent when off).
 */
const computeTeacherIdsClient = async ({ studentId, listId, stampTeacherId }) => {
  const ids = new Set()
  if (stampTeacherId) ids.add(stampTeacherId)
  try {
    if (studentId) {
      const studentSnap = await getDoc(doc(db, 'users', studentId))
      const enrolled = studentSnap.exists() ? Object.keys(studentSnap.data().enrolledClasses || {}) : []
      for (const classId of enrolled) {
        const classSnap = await getDoc(doc(db, 'classes', classId))
        if (!classSnap.exists()) continue
        const c = classSnap.data() || {}
        const assignsList = listId != null && (
          (c.assignments && c.assignments[listId]) ||
          (Array.isArray(c.assignedLists) && c.assignedLists.includes(listId))
        )
        if (assignsList && c.ownerTeacherId) ids.add(c.ownerTeacherId)
      }
    }
  } catch (err) {
    console.error('computeTeacherIdsClient failed (stamp-only set used):', err)
  }
  return [...ids].sort()
}

/**
 * Submit an MCQ test attempt and create a gradebook entry.
 * This creates an attempt document in the 'attempts' collection for teacher visibility.
 *
 * @param {string} userId - User ID
 * @param {string} testId - Test ID
 * @param {Array} answers - Array of { wordId, word, correctAnswer, studentResponse, isCorrect }
 * @param {number} totalQuestions - Total number of questions in the test
 * @param {string|null} classId - Optional class ID (required for gradebook visibility)
 * @param {string|null} listId - Optional list ID for reconciliation queries
 * @param {string} testType - Test type ('mcq' or 'typed'), defaults to 'mcq'
 * @param {string|null} sessionType - Session type ('new' or 'review'), defaults to null
 * @param {number|null} studyDay - Study day number (1-indexed), defaults to null
 * @returns {Promise<Object>} Attempt document data
 */
export const submitTestAttempt = async (userId, testId, answers, totalQuestions = 0, classId = null, listId = null, testType = 'mcq', sessionType = null, studyDay = null, passed = null, sessionContext = null, attemptDocId = null) => {
  if (!userId || !testId) {
    throw new Error('userId and testId are required.')
  }

  // Handle partial submissions - only process words present in answers array
  const answeredWords = answers || []
  const skippedCount = totalQuestions > 0 ? totalQuestions - answeredWords.length : 0

  if (answeredWords.length === 0) {
    throw new Error('No answers provided. Cannot submit empty test.')
  }

  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const userData = userSnap.exists() ? userSnap.data() : {}
  const currentStats = userData.stats ?? {}

  const studyStatesRef = collection(db, 'users', userId, 'study_states')
  const studyStatesSnap = await getDocs(studyStatesRef)
  const userWordStates = {}
  studyStatesSnap.docs.forEach((docSnap) => {
    userWordStates[docSnap.id] = docSnap.data()
  })

  const credibility = calculateCredibility(answeredWords, userWordStates)

  // Score based on total questions (unanswered = incorrect)
  const score = answeredWords.filter((answer) => answer.isCorrect).length / totalQuestions

  // Retention = test score (random sample estimates overall retention)
  const retention = score

  // Get teacherId from the class document if classId is provided
  let teacherId = null
  if (classId) {
    try {
      const classDoc = await getDoc(doc(db, 'classes', classId))
      if (classDoc.exists()) {
        teacherId = classDoc.data().ownerTeacherId || null
      }
    } catch (err) {
      console.error('Error fetching class for teacherId:', err)
    }
  }

  const attemptData = {
    studentId: userId,
    testId,
    testType,
    sessionType: sessionType || null,
    studyDay: studyDay || null,
    score: Math.round(score * 100),
    graded: true,
    answers: answeredWords,
    skipped: skippedCount,
    totalQuestions,
    credibility,
    retention,
    passed: passed,
    submittedAt: serverTimestamp(),
    // Flattened session context
    isFirstDay: sessionContext?.isFirstDay ?? null,
    listTitle: sessionContext?.listTitle ?? null,
    segmentStartIndex: sessionContext?.segment?.startIndex ?? null,
    segmentEndIndex: sessionContext?.segment?.endIndex ?? null,
    interventionLevel: sessionContext?.interventionLevel ?? null,
    wordsIntroduced: sessionContext?.wordsIntroduced ?? null,
    wordsReviewed: sessionContext?.wordsReviewed ?? null,
    newWordStartIndex: sessionContext?.newWordStartIndex ?? null,
    newWordEndIndex: sessionContext?.newWordEndIndex ?? null,
  }

  // Add classId, listId, and teacherId if provided (for new attempts)
  if (classId) {
    attemptData.classId = classId
  }
  if (listId) {
    attemptData.listId = listId
  }
  if (teacherId) {
    attemptData.teacherId = teacherId
  }

  // [deepfix P10 · OVR part (c)] Additive teacherIds denormalization (the C-19 read-surface
  // widening). Dormant unless TEACHER_IDS_READ — the field is NOT set when the flag is off, so
  // the attempt doc is byte-identical to today.
  if (TEACHER_IDS_READ) {
    attemptData.teacherIds = await computeTeacherIdsClient({ studentId: userId, listId, stampTeacherId: teacherId })
  }

  // Use deterministic doc id when caller supplies one — makes withRetry safe.
  // setDoc on the same id is an idempotent overwrite of identical data.
  const attemptsCol = collection(db, 'attempts')
  const attemptRef = attemptDocId
    ? doc(attemptsCol, attemptDocId)
    : doc(attemptsCol)
  await setDoc(attemptRef, attemptData)

  await updateDoc(userRef, {
    stats: {
      ...currentStats,
      credibility,
      retention,
    },
  })

  return { id: attemptRef.id, ...attemptData }
}

/**
 * Submit a typed test attempt and create a gradebook entry.
 * This creates an attempt document in the 'attempts' collection for teacher visibility.
 *
 * @param {string} userId - User ID
 * @param {string} testId - Test ID (format: "typed_{listId}_{timestamp}")
 * @param {Array} words - Original word objects with definitions
 * @param {Object} responses - Object mapping wordId to student response string
 * @param {Array} gradingResults - AI grading results: [{ wordId, isCorrect, reasoning }]
 * @param {string|null} classId - Optional class ID (required for gradebook visibility)
 * @param {string|null} listId - Optional list ID for reconciliation queries
 * @param {string|null} sessionType - Session type ('new' or 'review'), defaults to null
 * @param {number|null} studyDay - Study day number (1-indexed), defaults to null
 * @returns {Promise<Object>} Attempt document data
 */
export const submitTypedTestAttempt = async (
  userId,
  testId,
  words,
  responses,
  gradingResults,
  classId = null,
  listId = null,
  sessionType = null,
  studyDay = null,
  passed = null,
  sessionContext = null,
  attemptDocId = null,
) => {
  console.log('submitTypedTestAttempt called with:', { userId, testId, classId })

  try {
    if (!userId || !testId) {
      throw new Error('userId and testId are required.')
    }

    if (!words || !Array.isArray(words) || words.length === 0) {
      throw new Error('words array is required and cannot be empty.')
    }

    if (!gradingResults || !Array.isArray(gradingResults)) {
      throw new Error('gradingResults array is required.')
    }

    // Build answers array combining words, responses, and grading results
    const answers = words.map((word) => {
      const gradingResult = gradingResults.find((r) => r.wordId === word.id)
      return {
        wordId: word.id,
        word: word.word,
        correctAnswer: word.definition,
        studentResponse: responses[word.id] || '',
        isCorrect: gradingResult?.isCorrect ?? false,
        aiReasoning: gradingResult?.reasoning || '',
        challengeStatus: null,
        challengeNote: null,
        challengeReviewedBy: null,
        challengeReviewedAt: null,
      }
    })

    // Calculate score based on answered questions
    const answeredWords = answers.filter((a) => a.studentResponse.trim() !== '')
    if (answeredWords.length === 0) {
      throw new Error('No answers provided. Cannot submit empty test.')
    }

    const correctCount = answeredWords.filter((a) => a.isCorrect).length
    const score = correctCount / words.length

    // Get user stats
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    const userData = userSnap.exists() ? userSnap.data() : {}
    const currentStats = userData.stats ?? {}

    // Get study states for credibility/retention calculation
    const studyStatesRef = collection(db, 'users', userId, 'study_states')
    const studyStatesSnap = await getDocs(studyStatesRef)
    const userWordStates = {}
    studyStatesSnap.docs.forEach((docSnap) => {
      userWordStates[docSnap.id] = docSnap.data()
    })

    // Calculate credibility
    const credibility = calculateCredibility(answeredWords, userWordStates)

    // Retention = test score (random sample estimates overall retention)
    const retention = score

    // Get teacherId from the class document if classId is provided
    let teacherId = null
    if (classId) {
      try {
        const classDoc = await getDoc(doc(db, 'classes', classId))
        if (classDoc.exists()) {
          teacherId = classDoc.data().ownerTeacherId || null
        }
      } catch (err) {
        console.error('Error fetching class for teacherId:', err)
      }
    }

    // Create attempt document
    const attemptData = {
      studentId: userId,
      testId,
      classId: classId || null,
      listId: listId || null,
      teacherId: teacherId,
      testType: 'typed',
      sessionType: sessionType || null,
      studyDay: studyDay || null,
      score: Math.round(score * 100),
      graded: true,
      answers: answers,
      skipped: words.length - answeredWords.length,
      totalQuestions: words.length,
      credibility,
      retention,
      passed: passed,
      submittedAt: serverTimestamp(),
      // Flattened session context
      isFirstDay: sessionContext?.isFirstDay ?? null,
      listTitle: sessionContext?.listTitle ?? null,
      segmentStartIndex: sessionContext?.segment?.startIndex ?? null,
      segmentEndIndex: sessionContext?.segment?.endIndex ?? null,
      interventionLevel: sessionContext?.interventionLevel ?? null,
      wordsIntroduced: sessionContext?.wordsIntroduced ?? null,
      wordsReviewed: sessionContext?.wordsReviewed ?? null,
      newWordStartIndex: sessionContext?.newWordStartIndex ?? null,
      newWordEndIndex: sessionContext?.newWordEndIndex ?? null,
    }

    // [deepfix P10 · OVR part (c)] Additive teacherIds denormalization (dormant unless
    // TEACHER_IDS_READ). Field omitted when the flag is off ⇒ byte-identical attempt doc.
    if (TEACHER_IDS_READ) {
      attemptData.teacherIds = await computeTeacherIdsClient({ studentId: userId, listId, stampTeacherId: teacherId })
    }

    console.log('Saving attempt document:', attemptData)

    // Use deterministic doc id when caller supplies one — see submitTestAttempt.
    const attemptsCol = collection(db, 'attempts')
    const attemptRef = attemptDocId
      ? doc(attemptsCol, attemptDocId)
      : doc(attemptsCol)
    await setDoc(attemptRef, attemptData)

    // Update user stats
    await updateDoc(userRef, {
      stats: {
        ...currentStats,
        credibility,
        retention,
      },
    })

    console.log('Attempt saved with ID:', attemptRef.id)

    return { id: attemptRef.id, ...attemptData }
  } catch (error) {
    console.error('Error saving typed test attempt:', error)
    throw error
  }
}

export const fetchClassAttempts = async (classId) => {
  if (!classId) {
    return []
  }

  // Get class to find assigned lists
  const classSnap = await getDoc(doc(db, 'classes', classId))
  if (!classSnap.exists()) {
    return []
  }

  const classData = classSnap.data()
  // Support both old assignedLists array and new assignments map
  const assignments = classData.assignments || {}
  const assignedListIds = getAssignedListIds(classData)  // C-35

  if (assignedListIds.length === 0) {
    return []
  }

  // Query attempts for this class only
  const attemptsRef = collection(db, 'attempts')
  const attemptsQuery = query(
    attemptsRef,
    where('classId', '==', classId),
    orderBy('submittedAt', 'desc')
  )
  const attemptsSnap = await getDocs(attemptsQuery)

  const attempts = []
  for (const attemptDoc of attemptsSnap.docs) {
    const attemptData = attemptDoc.data()
    const testId = attemptData.testId || ''

    // Extract listId from testId - handle multiple formats:
    // Old: test_{listId}_{timestamp} or typed_{listId}_{timestamp}
    // New: vocaboost_test_{classId}_{listId}_{testType}
    let parsedListId = null
    const oldFormatMatch = testId.match(/^(test|typed)_([^_]+)_/)
    const newFormatMatch = testId.match(/^vocaboost_test_[^_]+_([^_]+)_/)

    if (oldFormatMatch) {
      parsedListId = oldFormatMatch[2]
    } else if (newFormatMatch) {
      parsedListId = newFormatMatch[1]
    }

    // C-34: prefer the attempt doc's own listId (automarker/manual rows carry it but
    // have no parseable testId); the testId parse is the legacy fallback. Drop only
    // when BOTH are absent.
    const listId = attemptData.listId ?? parsedListId

    if (!listId) continue
    if (!assignedListIds.includes(listId)) continue

    // Get student name
    let studentName = 'Unknown Student'
    let listName = 'Unknown List'
    
    try {
      const studentSnap = await getDoc(doc(db, 'users', attemptData.studentId))
      if (studentSnap.exists()) {
        const studentData = studentSnap.data()
        studentName = studentData.profile?.displayName || studentData.email || 'Unknown Student'
      }

      const listSnap = await getDoc(doc(db, 'lists', listId))
      if (listSnap.exists()) {
        listName = listSnap.data().title || 'Unknown List'
      }
    } catch (err) {
      console.error('Error fetching student/list data:', err)
    }

    attempts.push({
      id: attemptDoc.id,
      ...attemptData,
      studentName,
      listName,
      listId,
    })
  }

  return attempts
}

export const fetchAllTeacherAttempts = async (teacherId) => {
  if (!teacherId) {
    return []
  }

  // Step 1: Get teacher's classes
  const teacherClasses = await fetchTeacherClasses(teacherId)
  if (teacherClasses.length === 0) {
    return []
  }

  // Build classId -> className map for fast lookup
  const classIdToNameMap = new Map()
  teacherClasses.forEach((klass) => {
    classIdToNameMap.set(klass.id, klass.name)
  })

  // Step 2: Get all student IDs from all classes
  const studentIdSet = new Set()
  const classMap = new Map() // Map studentId -> array of class names
  const classListMap = new Map() // Map classId -> assigned list IDs

  // Build maps for efficient lookup
  for (const klass of teacherClasses) {
    const classId = klass.id
    const className = klass.name
    const assignedListIds = getAssignedListIds(klass)  // C-35
    classListMap.set(classId, assignedListIds)

    // Query members subcollection for this class
    try {
      const membersRef = collection(db, 'classes', classId, 'members')
      const membersSnap = await getDocs(membersRef)
      
      membersSnap.docs.forEach((memberDoc) => {
        const studentId = memberDoc.id
        studentIdSet.add(studentId)
        
        // Track which classes this student is in
        if (!classMap.has(studentId)) {
          classMap.set(studentId, [])
        }
        classMap.get(studentId).push({ id: classId, name: className, listIds: assignedListIds })
      })
    } catch (err) {
      console.error(`Error fetching members for class ${classId}:`, err)
    }
  }

  if (studentIdSet.size === 0) {
    return []
  }

  // Step 3: Fetch attempts - batch student IDs into chunks of 10 (Firestore limit)
  const studentIds = Array.from(studentIdSet)
  const batchSize = 10
  const attemptBatches = []

  for (let i = 0; i < studentIds.length; i += batchSize) {
    const batch = studentIds.slice(i, i + batchSize)
    const attemptsRef = collection(db, 'attempts')
    const attemptsQuery = query(attemptsRef, where('studentId', 'in', batch))
    attemptBatches.push(getDocs(attemptsQuery))
  }

  const attemptSnapshots = await Promise.all(attemptBatches)
  const allAttemptDocs = attemptSnapshots.flatMap((snapshot) => snapshot.docs)

  // Step 4: Enrich data
  // Build caches for student and list data
  const studentCache = new Map()
  const listCache = new Map()

  // Pre-fetch student data
  const studentFetchPromises = Array.from(studentIdSet).map(async (studentId) => {
    try {
      const studentSnap = await getDoc(doc(db, 'users', studentId))
      if (studentSnap.exists()) {
        const studentData = studentSnap.data()
        studentCache.set(studentId, {
          name: studentData.profile?.displayName || studentData.email || 'Unknown Student',
          email: studentData.email || '',
        })
      }
    } catch (err) {
      console.error(`Error fetching student ${studentId}:`, err)
    }
  })

  await Promise.all(studentFetchPromises)

  // Process attempts and enrich
  const enrichedAttempts = []

  for (const attemptDoc of allAttemptDocs) {
    const attemptData = attemptDoc.data()
    const testId = attemptData.testId || ''

    // Extract listId from testId - handle multiple formats:
    // Old: test_{listId}_{timestamp} or typed_{listId}_{timestamp}
    // New: vocaboost_test_{classId}_{listId}_{testType}
    let parsedListId = null
    const oldFormatMatch = testId.match(/^(test|typed)_([^_]+)_/)
    const newFormatMatch = testId.match(/^vocaboost_test_[^_]+_([^_]+)_/)

    if (oldFormatMatch) {
      parsedListId = oldFormatMatch[2]
    } else if (newFormatMatch) {
      parsedListId = newFormatMatch[1]
    }

    // C-34: prefer the attempt doc's own listId (automarker/manual rows carry it but
    // have no parseable testId); the testId parse is the legacy fallback. Drop only
    // when BOTH are absent.
    const listId = attemptData.listId ?? parsedListId

    if (!listId) continue

    const studentId = attemptData.studentId

    // Get student info
    const studentInfo = studentCache.get(studentId) || { name: 'Unknown Student', email: '' }
    const studentName = studentInfo.name

    // Get list name (with caching)
    let listName = 'Unknown List'
    if (!listCache.has(listId)) {
      try {
        const listSnap = await getDoc(doc(db, 'lists', listId))
        if (listSnap.exists()) {
          listName = listSnap.data().title || 'Unknown List'
          listCache.set(listId, listName)
        }
      } catch (err) {
        console.error(`Error fetching list ${listId}:`, err)
      }
    } else {
      listName = listCache.get(listId)
    }

    // Determine class name(s)
    // Step A (Fast Path): Check if attempt has classId
    let className = 'Unknown Class'
    if (attemptData.classId && classIdToNameMap.has(attemptData.classId)) {
      // New attempt with classId - direct lookup
      className = classIdToNameMap.get(attemptData.classId)
    } else {
      // Step B (Legacy Fallback): Use heuristic for old attempts without classId
      // Find which classes this student is in that have this list assigned
      const studentClasses = classMap.get(studentId) || []
      const matchingClasses = studentClasses.filter((klass) => klass.listIds.includes(listId))
      
      if (matchingClasses.length === 1) {
        className = matchingClasses[0].name
      } else if (matchingClasses.length > 1) {
        // Multiple classes have this list - join names
        className = matchingClasses.map((c) => c.name).join(', ')
      } else if (studentClasses.length > 0) {
        // Student is in classes but list not assigned - use first class
        className = studentClasses[0].name
      }
    }

    // Format date
    let date = new Date()
    if (attemptData.submittedAt) {
      if (attemptData.submittedAt.toDate) {
        date = attemptData.submittedAt.toDate()
      } else if (attemptData.submittedAt.toMillis) {
        date = new Date(attemptData.submittedAt.toMillis())
      } else if (attemptData.submittedAt instanceof Date) {
        date = attemptData.submittedAt
      }
    }

    // Calculate correct answers from answers array
    const answers = attemptData.answers || []
    const correctAnswers = answers.filter((a) => a.isCorrect).length
    const totalQuestions = attemptData.totalQuestions || answers.length || 0
    const score = attemptData.score || (totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0)

    // Format answers for the modal view
    // Build a word cache for this attempt to avoid redundant fetches
    const wordCache = new Map()
    
    const formattedAnswers = await Promise.all(
      answers.map(async (answer) => {
        // Extract word from answer if available, or use wordId
        const word = answer.word || `Word ${answer.wordId || 'Unknown'}`
        const wordId = answer.wordId || ''
        const studentAnswer = answer.studentResponse || answer.studentAnswer || 'No answer'
        const isCorrect = answer.isCorrect || false

        // Get correct answer - check if it's already stored (new attempts)
        let correctAnswer = answer.correctAnswer || answer.definition
        
        // If not found, fetch from database (old attempts)
        if (!correctAnswer && wordId && listId) {
          // Check cache first
          if (wordCache.has(wordId)) {
            correctAnswer = wordCache.get(wordId)
          } else {
            try {
              const wordDoc = await getDoc(doc(db, 'lists', listId, 'words', wordId))
              if (wordDoc.exists()) {
                correctAnswer = wordDoc.data().definition || 'No definition'
                wordCache.set(wordId, correctAnswer)
              } else {
                correctAnswer = 'No definition'
              }
            } catch (err) {
              console.error(`Error fetching word ${wordId} from list ${listId}:`, err)
              correctAnswer = 'No definition'
            }
          }
        }
        
        // Fallback if still no definition
        if (!correctAnswer) {
          correctAnswer = 'No definition'
        }

        return {
          wordId,
          word,
          correctAnswer,
          studentAnswer,
          isCorrect,
        }
      })
    )

    const resolvedFormattedAnswers = await formattedAnswers

    enrichedAttempts.push({
      id: attemptDoc.id,
      class: className,
      list: listName,
      date: date,
      name: studentName,
      score: score,
      totalQuestions: totalQuestions,
      correctAnswers: correctAnswers,
      answers: resolvedFormattedAnswers,
      // Keep original data for reference
      studentId: studentId,
      listId: listId,
      testId: testId,
      submittedAt: attemptData.submittedAt,
      credibility: attemptData.credibility,
      retention: attemptData.retention,
    })
  }

  // Step 5: Sort by date descending (client-side to avoid index requirements)
  enrichedAttempts.sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date.getTime() : 0
    const dateB = b.date instanceof Date ? b.date.getTime() : 0
    return dateB - dateA
  })

  return enrichedAttempts
}

/**
 * Query teacher attempts with server-side filtering and pagination
 * @param {string} teacherId - Teacher's user ID
 * @param {Array} filters - Array of filter tags: [{ category: 'Class'|'List'|'Name'|'Date', value: string|{start, end} }]
 * @param {DocumentSnapshot|null} lastDoc - Last document from previous page (for pagination)
 * @param {number} pageSize - Number of results per page (default: 50)
 * @returns {Promise<{attempts: Array, lastVisible: DocumentSnapshot|null, hasMore: boolean}>}
 */
// Cache for teacher data to avoid re-fetching on every filter change
const teacherDataCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
// [deepfix P10 · OVR part (c)] Cap on the union-roster (ex-roster / inherited-attempt) scan
// used only when TEACHER_IDS_READ is on (see getTeacherData). Bounds the extra read on very
// large teachers; the scan is cached with the rest of getTeacherData (CACHE_TTL).
const EX_ROSTER_SCAN_LIMIT = 2000

/**
 * Get cached or fresh teacher data (classes, students, lists)
 */
async function getTeacherData(teacherId) {
  const cached = teacherDataCache.get(teacherId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // Fetch fresh data
  const teacherClasses = await fetchTeacherClasses(teacherId)
  if (teacherClasses.length === 0) {
    return null
  }

  // Build classId -> className map
  const classIdToNameMap = new Map()
  const classNameToIdMap = new Map()
  teacherClasses.forEach((klass) => {
    classIdToNameMap.set(klass.id, klass.name)
    classNameToIdMap.set(klass.name.toLowerCase(), klass.id)
  })

  // Get all student IDs and build student lookup maps
  const studentIdSet = new Set()
  const studentIdToNameMap = new Map()
  const studentNameToIdMap = new Map()
  const classMap = new Map() // Map studentId -> array of class info

  for (const klass of teacherClasses) {
    const classId = klass.id
    const className = klass.name
    const assignedListIds = getAssignedListIds(klass)  // C-35

    try {
      const membersRef = collection(db, 'classes', classId, 'members')
      const membersSnap = await getDocs(membersRef)
      
      membersSnap.docs.forEach((memberDoc) => {
        const studentId = memberDoc.id
        const memberData = memberDoc.data()
        const studentName = memberData.displayName || memberData.email || 'Unknown Student'
        
        studentIdSet.add(studentId)
        studentIdToNameMap.set(studentId, studentName)
        studentNameToIdMap.set(studentName.toLowerCase(), studentId)
        
        if (!classMap.has(studentId)) {
          classMap.set(studentId, [])
        }
        classMap.get(studentId).push({ id: classId, name: className, listIds: assignedListIds })
      })
    } catch (err) {
      console.error(`Error fetching members for class ${classId}:`, err)
    }
  }

  // [deepfix P10 · OVR part (c)] Union-roster augmentation for the C-19 ex-roster name filter.
  // Under TEACHER_IDS_READ the gradebook surfaces INHERITED attempts of students promoted OFF
  // this teacher's current roster, whose names are absent from the current-member maps built
  // above — so a Name filter on such a student resolves to [] and hits the hard-empty guard in
  // queryTeacherAttempts (zero rows returned). Resolve those names too: scan the teacher's
  // `teacherIds array-contains` attempts for studentIds NOT in the current roster and hydrate
  // their display names into the same maps. Bounded (EX_ROSTER_SCAN_LIMIT) + cached with the
  // rest of getTeacherData. Flag OFF ⇒ this block is skipped entirely ⇒ getTeacherData is
  // byte-identical to today (no extra reads). See P10c_impl_notes U6 (chicken/egg + cost).
  if (TEACHER_IDS_READ) {
    try {
      const inheritedSnap = await getDocs(query(
        collection(db, 'attempts'),
        where('teacherIds', 'array-contains', teacherId),
        orderBy('submittedAt', 'desc'),
        limit(EX_ROSTER_SCAN_LIMIT),
      ))
      const exRosterIds = new Set()
      inheritedSnap.docs.forEach((d) => {
        const sid = d.data().studentId
        if (sid && !studentIdSet.has(sid)) exRosterIds.add(sid)
      })
      for (const sid of exRosterIds) {
        try {
          const uDoc = await getDoc(doc(db, 'users', sid))
          const u = uDoc.exists() ? uDoc.data() : {}
          const name = u.displayName || u.profile?.displayName || u.email || 'Unknown Student'
          studentIdSet.add(sid)
          studentIdToNameMap.set(sid, name)
          studentNameToIdMap.set(name.toLowerCase(), sid)
        } catch (e) {
          console.error(`ex-roster name hydrate failed for ${sid}:`, e)
        }
      }
    } catch (err) {
      console.error('ex-roster union-roster scan failed (name filter falls back to current members):', err)
    }
  }

  // Get teacher's lists for list filter
  const teacherLists = await fetchTeacherLists(teacherId)
  const listIdToNameMap = new Map()
  const listNameToIdMap = new Map()
  teacherLists.forEach((list) => {
    listIdToNameMap.set(list.id, list.title)
    listNameToIdMap.set(list.title.toLowerCase(), list.id)
  })

  const data = {
    teacherClasses,
    teacherLists,
    classIdToNameMap,
    classNameToIdMap,
    studentIdToNameMap,
    studentNameToIdMap,
    classMap,
    listIdToNameMap,
    listNameToIdMap,
  }

  teacherDataCache.set(teacherId, { data, timestamp: Date.now() })
  return data
}

export const queryTeacherAttempts = async (teacherId, filters = [], lastDoc = null, pageSize = 50) => {
  if (!teacherId) {
    return { attempts: [], lastVisible: null, hasMore: false }
  }

  // Get cached teacher data for name lookups
  const teacherData = await getTeacherData(teacherId)
  if (!teacherData) {
    return { attempts: [], lastVisible: null, hasMore: false }
  }

  const {
    teacherClasses,
    teacherLists,
    classIdToNameMap,
    studentIdToNameMap,
    studentNameToIdMap,
    listIdToNameMap,
  } = teacherData

  // Parse filters
  const filterClassIds = []
  const filterStudentIds = []
  const filterListIds = []
  const filterTestTypes = []
  let dateStart = null
  let dateEnd = null

  filters.forEach((tag) => {
    if (tag.category === 'Class') {
      const matchingClassIds = teacherClasses
        .filter((c) => c.name.toLowerCase().includes(tag.value.toLowerCase()))
        .map((c) => c.id)
      filterClassIds.push(...matchingClassIds)
    } else if (tag.category === 'Name') {
      const matchingStudentIds = Array.from(studentNameToIdMap.entries())
        .filter(([name]) => name.includes(tag.value.toLowerCase()))
        .map(([, id]) => id)
      filterStudentIds.push(...matchingStudentIds)
    } else if (tag.category === 'List') {
      const matchingListIds = teacherLists
        .filter((l) => l.title.toLowerCase().includes(tag.value.toLowerCase()))
        .map((l) => l.id)
      filterListIds.push(...matchingListIds)
    } else if (tag.category === 'Test Type') {
      filterTestTypes.push(tag.value) // 'mcq' or 'typed'
    } else if (tag.category === 'Date' && tag.value && typeof tag.value === 'object') {
      dateStart = Timestamp.fromDate(new Date(tag.value.start))
      const endDate = new Date(tag.value.end)
      endDate.setHours(23, 59, 59, 999)
      dateEnd = Timestamp.fromDate(endDate)
    }
  })

// If filters were provided but none matched, return empty results
const hasClassFilter = filters.some((f) => f.category === 'Class')
const hasNameFilter = filters.some((f) => f.category === 'Name')
const hasListFilter = filters.some((f) => f.category === 'List')

if ((hasClassFilter && filterClassIds.length === 0) ||
    (hasNameFilter && filterStudentIds.length === 0) ||
    (hasListFilter && filterListIds.length === 0)) {
  return { attempts: [], lastVisible: null, hasMore: false }
}

  // Build query - start with the teacher predicate (single query, no batching!).
  // [deepfix P10 · OVR part (c)] C-19 read-surface WIDENING (David U1 = Option A): with
  // TEACHER_IDS_READ on, the base predicate widens from `teacherId ==` (equality — can NEVER
  // show B's teacher an A-stamped inherited attempt) to `teacherIds array-contains` (sees
  // inherited attempts of a promoted student). This does NOT change the <=30 DNF disjunction
  // budget shared with the C-33 studentId push below: array-contains matches a single value,
  // contributing a factor of 1 to the DNF product (the class/student `in` disjuncts still
  // multiply exactly as today — see P10c_impl_notes). Flag OFF ⇒ today's `teacherId ==` query
  // verbatim (byte-equivalent; needs no new index).
  let attemptsQuery = query(
    collection(db, 'attempts'),
    TEACHER_IDS_READ
      ? where('teacherIds', 'array-contains', teacherId)
      : where('teacherId', '==', teacherId),
    orderBy('submittedAt', 'desc')
  )

  // Apply class filter at query level
  if (filterClassIds.length === 1) {
    attemptsQuery = query(attemptsQuery, where('classId', '==', filterClassIds[0]))
  } else if (filterClassIds.length > 1 && filterClassIds.length <= 10) {
    attemptsQuery = query(attemptsQuery, where('classId', 'in', filterClassIds))
  }

  // C-33: push the resolved Name filter (studentIds) server-side so a filtered
  // student's attempts are found however deep they rank teacher-wide. Single id
  // -> '==', 2..30 ids -> 'in' (guarded so class 'in' disjuncts x student ids
  // stays within Firestore's <=30 disjunction budget). Larger matches keep
  // today's degraded mode — the post-filter below remains as the backstop.
  const classDisjuncts = Math.max(filterClassIds.length, 1)
  if (filterStudentIds.length === 1) {
    attemptsQuery = query(attemptsQuery, where('studentId', '==', filterStudentIds[0]))
  } else if (
    filterStudentIds.length > 1 &&
    filterStudentIds.length <= 30 &&
    classDisjuncts * filterStudentIds.length <= 30
  ) {
    attemptsQuery = query(attemptsQuery, where('studentId', 'in', filterStudentIds))
  }

  // Apply date filter at query level
  if (dateStart && dateEnd) {
    attemptsQuery = query(attemptsQuery, where('submittedAt', '>=', dateStart), where('submittedAt', '<=', dateEnd))
  }

  // Apply pagination
  attemptsQuery = query(attemptsQuery, limit(pageSize))
  if (lastDoc) {
    attemptsQuery = query(attemptsQuery, startAfter(lastDoc))
  }

  // Execute single query
  const attemptsSnap = await getDocs(attemptsQuery)
  const attemptDocs = attemptsSnap.docs
  const lastVisible = attemptDocs.length > 0 ? attemptDocs[attemptDocs.length - 1] : null
  const hasMore = attemptDocs.length === pageSize

  console.log('Query returned:', attemptDocs.length, 'attempts')

  // Enrich attempts
  const enrichedAttempts = []
  const listCache = new Map()

  for (const attemptDoc of attemptDocs) {
    const attemptData = attemptDoc.data()
    const testId = attemptData.testId || ''

    // Extract listId from testId - handle multiple formats:
    // Old: test_{listId}_{timestamp} or typed_{listId}_{timestamp}
    // New: vocaboost_test_{classId}_{listId}_{testType}
    let parsedListId = null
    const oldFormatMatch = testId.match(/^(test|typed)_([^_]+)_/)
    const newFormatMatch = testId.match(/^vocaboost_test_[^_]+_([^_]+)_/)

    if (oldFormatMatch) {
      parsedListId = oldFormatMatch[2]
    } else if (newFormatMatch) {
      parsedListId = newFormatMatch[1]
    }

    // C-34: prefer the attempt doc's own listId (automarker/manual rows carry it but
    // have no parseable testId); the testId parse is the legacy fallback. Drop only
    // when BOTH are absent.
    const listId = attemptData.listId ?? parsedListId

    if (!listId) continue

    const studentId = attemptData.studentId

    // Apply Name filter (post-processing)
    if (filterStudentIds.length > 0 && !filterStudentIds.includes(studentId)) {
      continue
    }

    // Apply List filter (post-processing)
    if (filterListIds.length > 0 && !filterListIds.includes(listId)) {
      continue
    }

    // Apply Test Type filter (post-processing)
    const attemptTestType = attemptData.testType || 'mcq'
    if (filterTestTypes.length > 0 && !filterTestTypes.includes(attemptTestType)) {
      continue
    }

    // Get student name
    const studentName = studentIdToNameMap.get(studentId) || 'Unknown Student'

    // Get list name
    let listName = listCache.get(listId)
    if (!listName) {
      listName = listIdToNameMap.get(listId) || 'Unknown List'
      listCache.set(listId, listName)
    }

    // Get class name
    const className = classIdToNameMap.get(attemptData.classId) || 'No data'

    // Format date
    let date = new Date()
    if (attemptData.submittedAt?.toDate) {
      date = attemptData.submittedAt.toDate()
    } else if (attemptData.submittedAt?.toMillis) {
      date = new Date(attemptData.submittedAt.toMillis())
    }

    // Calculate scores
    const answers = attemptData.answers || []
    const correctAnswers = answers.filter((a) => a.isCorrect).length
    const totalQuestions = attemptData.totalQuestions || answers.length || 0
    const score = attemptData.score || (totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0)

    enrichedAttempts.push({
      id: attemptDoc.id,
      class: className,
      list: listName,
      date: date,
      name: studentName,
      score: score,
      totalQuestions: totalQuestions,
      correctAnswers: correctAnswers,
      passed: attemptData.passed ?? null, // authoritative pass verdict (for threshold-based score color)
      answers: [], // Lazy load on demand
      studentId: studentId,
      listId: listId,
      testId: testId,
      testType: attemptData.testType || 'mcq',
      sessionType: attemptData.sessionType || null,
      studyDay: attemptData.studyDay || null,
      submittedAt: attemptData.submittedAt,
    })
  }

  return {
    attempts: enrichedAttempts,
    lastVisible: lastVisible,
    hasMore: hasMore,
  }
}

/**
 * Query attempts for a specific student with filtering and pagination
 * @param {string} studentId - Student user ID
 * @param {Array} filters - Array of filter tags (Class, List, Date)
 * @param {DocumentSnapshot|null} lastDoc - Last document for pagination
 * @param {number} pageSize - Number of results per page
 * @returns {Promise<Object>} Object with attempts array, lastVisible doc, and hasMore flag
 */
export const queryStudentAttempts = async (studentId, filters = [], lastDoc = null, pageSize = 50) => {
  if (!studentId) {
    return { attempts: [], lastVisible: null, hasMore: false }
  }

  // Parse filters (only Class, List, Date - no Name filter needed)
  let filterClassIds = []
  let filterListIds = []
  let dateStart = null
  let dateEnd = null

  // Get student's classes for name lookups
  const studentDoc = await getDoc(doc(db, 'users', studentId))
  if (!studentDoc.exists()) {
    return { attempts: [], lastVisible: null, hasMore: false }
  }

  const studentData = studentDoc.data()
  const enrolledClasses = studentData?.enrolledClasses || {}
  const enrolledClassIds = Object.keys(enrolledClasses)

  // Build class name map
  const classIdToNameMap = new Map()
  for (const classId of enrolledClassIds) {
    try {
      const classDoc = await getDoc(doc(db, 'classes', classId))
      if (classDoc.exists()) {
        classIdToNameMap.set(classId, classDoc.data().name)
      }
    } catch (err) {
      console.error(`Error fetching class ${classId}:`, err)
    }
  }

  // Parse filters
  filters.forEach((tag) => {
    if (tag.category === 'Class') {
      const matchingClassIds = Array.from(classIdToNameMap.entries())
        .filter(([, name]) => name.toLowerCase().includes(tag.value.toLowerCase()))
        .map(([id]) => id)
      filterClassIds.push(...matchingClassIds)
    } else if (tag.category === 'List') {
      // Will filter post-query
      filterListIds.push(tag.value.toLowerCase())
    } else if (tag.category === 'Date' && tag.value && typeof tag.value === 'object') {
      dateStart = Timestamp.fromDate(new Date(tag.value.start))
      const endDate = new Date(tag.value.end)
      endDate.setHours(23, 59, 59, 999)
      dateEnd = Timestamp.fromDate(endDate)
    }
  })

  // Build query
  let attemptsQuery = query(
    collection(db, 'attempts'),
    where('studentId', '==', studentId),
    orderBy('submittedAt', 'desc'),
  )

  // Apply class filter
  if (filterClassIds.length === 1) {
    attemptsQuery = query(attemptsQuery, where('classId', '==', filterClassIds[0]))
  } else if (filterClassIds.length > 1 && filterClassIds.length <= 10) {
    attemptsQuery = query(attemptsQuery, where('classId', 'in', filterClassIds))
  }

  // Apply date filter
  if (dateStart && dateEnd) {
    attemptsQuery = query(attemptsQuery, where('submittedAt', '>=', dateStart), where('submittedAt', '<=', dateEnd))
  }

  // Apply pagination
  attemptsQuery = query(attemptsQuery, limit(pageSize))
  if (lastDoc) {
    attemptsQuery = query(attemptsQuery, startAfter(lastDoc))
  }

  // Execute query
  const attemptsSnap = await getDocs(attemptsQuery)
  const attemptDocs = attemptsSnap.docs
  const lastVisible = attemptDocs.length > 0 ? attemptDocs[attemptDocs.length - 1] : null
  const hasMore = attemptDocs.length === pageSize

  // Build list name cache
  const listCache = new Map()

  // Enrich attempts
  const enrichedAttempts = []

  for (const attemptDoc of attemptDocs) {
    const attemptData = attemptDoc.data()
    const testId = attemptData.testId || ''

    // Extract listId from testId - handle multiple formats:
    // Old: test_{listId}_{timestamp} or typed_{listId}_{timestamp}
    // New: vocaboost_test_{classId}_{listId}_{testType}
    let parsedListId = null
    const oldFormatMatch = testId.match(/^(test|typed)_([^_]+)_/)
    const newFormatMatch = testId.match(/^vocaboost_test_[^_]+_([^_]+)_/)

    if (oldFormatMatch) {
      parsedListId = oldFormatMatch[2]
    } else if (newFormatMatch) {
      parsedListId = newFormatMatch[1]
    }

    // C-34: prefer the attempt doc's own listId (automarker/manual rows carry it but
    // have no parseable testId); the testId parse is the legacy fallback. Drop only
    // when BOTH are absent.
    const listId = attemptData.listId ?? parsedListId

    if (!listId) continue

    // Get list name
    let listName = listCache.get(listId)
    if (!listName) {
      try {
        const listDoc = await getDoc(doc(db, 'lists', listId))
        listName = listDoc.exists() ? listDoc.data().title : 'Unknown List'
        listCache.set(listId, listName)
      } catch (err) {
        console.error(`Error fetching list ${listId}:`, err)
        listName = 'Unknown List'
        listCache.set(listId, listName)
      }
    }

    // Apply list filter (post-processing)
    if (filterListIds.length > 0 && !filterListIds.some((f) => listName.toLowerCase().includes(f))) {
      continue
    }

    // Get class name
    const className = classIdToNameMap.get(attemptData.classId) || 'No Class'

    // Format date
    let date = new Date()
    if (attemptData.submittedAt?.toDate) {
      date = attemptData.submittedAt.toDate()
    } else if (attemptData.submittedAt?.toMillis) {
      date = new Date(attemptData.submittedAt.toMillis())
    }

    // Calculate scores
    const answers = attemptData.answers || []
    const correctAnswers = answers.filter((a) => a.isCorrect).length
    const totalQuestions = attemptData.totalQuestions || answers.length || 0
    const score = attemptData.score || (totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0)

    enrichedAttempts.push({
      id: attemptDoc.id,
      class: className,
      list: listName,
      date: date,
      score: score,
      totalQuestions: totalQuestions,
      correctAnswers: correctAnswers,
      passed: attemptData.passed ?? null, // authoritative pass verdict (for threshold-based score color)
      answers: [],
      listId: listId,
      testId: testId,
      testType: attemptData.testType || 'mcq',
      sessionType: attemptData.sessionType || null,
      studyDay: attemptData.studyDay || null,
      submittedAt: attemptData.submittedAt,
    })
  }

  return {
    attempts: enrichedAttempts,
    lastVisible: lastVisible,
    hasMore: hasMore,
  }
}

/**
 * Fetch full attempt details including answers (for View Details modal)
 * @param {string} attemptId - The attempt document ID
 * @returns {Promise<Object|null>} - Full attempt with formatted answers
 */
export const fetchAttemptDetails = async (attemptId) => {
  if (!attemptId) return null

  try {
    const attemptDoc = await getDoc(doc(db, 'attempts', attemptId))
    if (!attemptDoc.exists()) return null

    const attemptData = attemptDoc.data()
    const testId = attemptData.testId || ''

    // Extract listId from testId - handle multiple formats:
    // Old: test_{listId}_{timestamp} or typed_{listId}_{timestamp}
    // New: vocaboost_test_{classId}_{listId}_{testType}
    let listId = null
    const oldFormatMatch = testId.match(/^(test|typed)_([^_]+)_/)
    const newFormatMatch = testId.match(/^vocaboost_test_[^_]+_([^_]+)_/)

    if (oldFormatMatch) {
      listId = oldFormatMatch[2]
    } else if (newFormatMatch) {
      listId = newFormatMatch[1]
    }

    const studentId = attemptData.studentId

    // Get student name
    let studentName = 'Unknown Student'
    if (studentId) {
      try {
        const userSnap = await getDoc(doc(db, 'users', studentId))
        if (userSnap.exists()) {
          const userData = userSnap.data()
          studentName = userData.profile?.displayName || userData.email || 'Unknown Student'
        }
      } catch (err) {
        console.error(`Error fetching user ${studentId}:`, err)
      }
    }

    // Get list name
    let listName = 'Unknown List'
    if (listId) {
      try {
        const listSnap = await getDoc(doc(db, 'lists', listId))
        if (listSnap.exists()) {
          listName = listSnap.data().title || 'Unknown List'
        }
      } catch (err) {
        console.error(`Error fetching list ${listId}:`, err)
      }
    }

    // Get class name
    let className = 'Unknown Class'
    if (attemptData.classId) {
      // Fast path: direct lookup using classId
      try {
        const classSnap = await getDoc(doc(db, 'classes', attemptData.classId))
        if (classSnap.exists()) {
          className = classSnap.data().name || 'Unknown Class'
        }
      } catch (err) {
        console.error(`Error fetching class ${attemptData.classId}:`, err)
      }
    } else if (studentId && listId) {
      // Legacy fallback: find which class has this list assigned
      try {
        const userSnap = await getDoc(doc(db, 'users', studentId))
        if (userSnap.exists()) {
          const userData = userSnap.data()
          const enrolledClasses = userData.enrolledClasses || {}
          const classIds = Object.keys(enrolledClasses)
          
          // Check each class to see if it has this list assigned
          for (const classId of classIds) {
            try {
              const classSnap = await getDoc(doc(db, 'classes', classId))
              if (classSnap.exists()) {
                const classData = classSnap.data()
                const assignedLists = getAssignedListIds(classData)  // C-35
                if (assignedLists.includes(listId)) {
                  className = classData.name || 'Unknown Class'
                  break
                }
              }
            } catch (err) {
              // Continue to next class
            }
          }
        }
      } catch (err) {
        console.error(`Error finding class for student ${studentId} and list ${listId}:`, err)
      }
    }

    // Convert submittedAt to Date
    let date = new Date()
    if (attemptData.submittedAt) {
      if (attemptData.submittedAt.toDate) {
        date = attemptData.submittedAt.toDate()
      } else if (attemptData.submittedAt.toMillis) {
        date = new Date(attemptData.submittedAt.toMillis())
      } else if (attemptData.submittedAt.seconds) {
        date = new Date(attemptData.submittedAt.seconds * 1000)
      }
    }

    const answers = attemptData.answers || []
    const correctAnswers = answers.filter((a) => a.isCorrect).length

    // Format answers with correct definitions
    const formattedAnswers = await Promise.all(
      answers.map(async (answer) => {
        const word = answer.word || `Word ${answer.wordId || 'Unknown'}`
        const wordId = answer.wordId || ''
        const studentAnswer = answer.studentResponse || answer.studentAnswer || 'No answer'
        const isCorrect = answer.isCorrect || false

        let correctAnswer = answer.correctAnswer || answer.definition

        if (!correctAnswer && wordId && listId) {
          try {
            const wordDoc = await getDoc(doc(db, 'lists', listId, 'words', wordId))
            if (wordDoc.exists()) {
              correctAnswer = wordDoc.data().definition || 'No definition'
            } else {
              correctAnswer = 'No definition'
            }
          } catch (err) {
            console.error(`Error fetching word ${wordId} from list ${listId}:`, err)
            correctAnswer = 'No definition'
          }
        }

        return {
          wordId,
          word,
          correctAnswer: correctAnswer || 'No definition',
          studentAnswer,
          isCorrect,
          // Include challenge-related fields
          aiReasoning: answer.aiReasoning || '',
          challengeStatus: answer.challengeStatus || null,
          challengeNote: answer.challengeNote || null,
          challengeReviewedBy: answer.challengeReviewedBy || null,
          challengeReviewedAt: answer.challengeReviewedAt || null,
        }
      })
    )

    return {
      id: attemptDoc.id,
      name: studentName,
      class: className,
      list: listName,
      date: date,
      score: attemptData.score || 0,
      totalQuestions: attemptData.totalQuestions || answers.length,
      correctAnswers: correctAnswers,
      passed: attemptData.passed ?? null, // authoritative pass verdict (for threshold-based score color)
      testType: attemptData.testType || 'mcq',
      answers: formattedAnswers,
    }
  } catch (err) {
    console.error('Error fetching attempt details:', err)
    return null
  }
}

export const fetchUserAttempts = async (uid) => {
  if (!uid) {
    return []
  }

  const attemptsRef = collection(db, 'attempts')
  // Use index on attempts(studentId, submittedAt desc) for sorted results
  const attemptsQuery = query(
    attemptsRef,
    where('studentId', '==', uid),
    orderBy('submittedAt', 'desc'),
  )

  try {
    const snapshot = await getDocs(attemptsQuery)
    const attempts = []
    
    // Get user's enrolled classes for class name lookup
    const userSnap = await getDoc(doc(db, 'users', uid))
    const userData = userSnap.exists() ? userSnap.data() : {}
    const enrolledClasses = userData.enrolledClasses || {}
    
    // Create class lookup map (including assignedLists to avoid duplicate fetches)
    const classLookup = {}
    for (const [classId, classInfo] of Object.entries(enrolledClasses)) {
      try {
        const classSnap = await getDoc(doc(db, 'classes', classId))
        if (classSnap.exists()) {
          const classData = classSnap.data()
          classLookup[classId] = {
            name: classData.name || classInfo.name || 'Unknown Class',
            id: classId,
            assignedLists: getAssignedListIds(classData),  // C-35
          }
        }
      } catch (err) {
        console.error(`Error fetching class ${classId}:`, err)
      }
    }

    // Cache resolved list titles by listId. Previously this did a getDoc(lists/{listId})
    // for EVERY attempt inside the loop below — for a student with K attempts on one list
    // that was K sequential reads (e.g. 70), serializing the whole fetch and feeding the
    // dashboard hero-phase load race. Resolve each unique listId's title once (caching the
    // resolved STRING, including the 'Vocabulary Test' fallback for missing lists, so a
    // non-existent list doesn't re-fetch every iteration).
    const listTitleCache = new Map()
    const resolveListTitle = async (listId) => {
      if (listTitleCache.has(listId)) return listTitleCache.get(listId)
      let title = 'Vocabulary Test'
      try {
        const listSnap = await getDoc(doc(db, 'lists', listId))
        if (listSnap.exists()) {
          title = listSnap.data().title || 'Vocabulary Test'
        }
      } catch (err) {
        console.error(`Error fetching list ${listId}:`, err)
      }
      listTitleCache.set(listId, title)
      return title
    }

    for (const docSnap of snapshot.docs) {
      const attemptData = docSnap.data()
      const testId = attemptData.testId || ''

      // Extract listId/classId from testId - handle multiple formats:
      // Old: test_{listId}_{timestamp} or typed_{listId}_{timestamp}
      // New: vocaboost_test_{classId}_{listId}_{testType}
      let parsedListId = null
      let parsedClassId = null
      const oldFormatMatch = testId.match(/^(test|typed)_([^_]+)_/)
      const newFormatMatch = testId.match(/^vocaboost_test_([^_]+)_([^_]+)_/)

      if (oldFormatMatch) {
        parsedListId = oldFormatMatch[2]
      } else if (newFormatMatch) {
        parsedClassId = newFormatMatch[1]
        parsedListId = newFormatMatch[2]
      }

      // Prefer the attempt doc's own listId (newer write paths store it directly); fall back
      // to the testId-parsed listId for legacy docs. (Mirrors the classId precedence below —
      // a missing/malformed testId must not null out a valid stored listId.)
      const listId = attemptData.listId ?? parsedListId

      let listTitle = 'Vocabulary Test'
      let derivedClassId = null

      // Resolve list title (cached per listId — see resolveListTitle above)
      if (listId) {
        listTitle = await resolveListTitle(listId)

        // Find which class this list belongs to (legacy fallback; first match wins for a shared list)
        for (const [cid, classInfo] of Object.entries(classLookup)) {
          if (classInfo.assignedLists.includes(listId)) {
            derivedClassId = cid
            break
          }
        }
      }

      // Class attribution precedence (most -> least authoritative):
      //   1. the attempt doc's own classId (stamped at submit time from the route),
      //   2. the classId parsed from a new-format testId,
      //   3. the list->class lookup (legacy fallback; first match for a shared list).
      // Guard the backfill 'no_class' sentinel so it does not shadow a resolvable class
      // (otherwise such attempts wrongly drop out of the dashboard's per-class filter).
      const docClassId = (attemptData.classId && attemptData.classId !== 'no_class')
        ? attemptData.classId
        : null
      const classId = docClassId ?? parsedClassId ?? derivedClassId
      const className = (classId && classLookup[classId]?.name) || 'Unknown Class'
      
      // Convert submittedAt timestamp to Date
      const submittedDate = attemptData.submittedAt?.toDate 
        ? attemptData.submittedAt.toDate() 
        : (attemptData.submittedAt?.toMillis 
          ? new Date(attemptData.submittedAt.toMillis()) 
          : new Date())
      
      attempts.push({
        id: docSnap.id,
        ...attemptData,
        listId,
        listTitle,
        className,
        classId,
        date: submittedDate,
      })
    }
    
    // Results already sorted by Firestore (submittedAt desc)
    return attempts
  } catch (err) {
    console.error('Error fetching user attempts:', err)
    return []
  }
}

/**
 * Submit a challenge for a graded answer
 * @param {string} userId - Student user ID
 * @param {string} attemptId - Attempt document ID
 * @param {string} wordId - Word ID being challenged
 * @param {string} note - Optional note explaining the challenge
 * @returns {Promise<Object>} Success object
 */
export const submitChallenge = async (userId, attemptId, wordId, note = '') => {
  if (!userId || !attemptId || !wordId) {
    throw new Error('userId, attemptId, and wordId are required.')
  }

  // Server-side path (PLAN_attempt_write_lockdown.md W1): the `submitChallenge` callable
  // validates ownership + tokens and writes challenges.history + answers atomically, so the
  // client never writes `attempts.answers` directly (closes the answers[] forgery, #1c). The
  // callable uses request.auth.uid, not the passed userId. Legacy client path below stays as a
  // flag-off fallback until the fn is deployed + validated, then W3 rules remove the client write.
  if (SERVER_CHALLENGE_WRITE) {
    const fn = httpsCallable(getFunctions(), 'submitChallenge')
    const res = await fn({ attemptId, wordId, note })
    return res.data
  }

  // --- legacy client path (fallback; removed once SERVER_CHALLENGE_WRITE is validated) ---
  // Get user document
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) {
    throw new Error('User not found.')
  }

  const userData = userSnap.data()
  const challengeHistory = userData.challenges?.history || []

  // Calculate available tokens
  const availableTokens = getAvailableChallengeTokens(challengeHistory)
  if (availableTokens === 0) {
    throw new Error('No challenge tokens available. You have active rejections.')
  }

  // Get attempt document
  const attemptRef = doc(db, 'attempts', attemptId)
  const attemptSnap = await getDoc(attemptRef)
  if (!attemptSnap.exists()) {
    throw new Error('Attempt not found.')
  }

  const attemptData = attemptSnap.data()

  // Verify this is the student's attempt
  if (attemptData.studentId !== userId) {
    throw new Error('Unauthorized: This is not your attempt.')
  }

  // Find the answer with matching wordId
  const answers = attemptData.answers || []
  const answerIndex = answers.findIndex((a) => a.wordId === wordId)
  if (answerIndex === -1) {
    throw new Error('Answer not found in attempt.')
  }

  // Check if already challenged
  if (answers[answerIndex].challengeStatus === 'pending') {
    throw new Error('This answer is already being challenged.')
  }

  // Add new entry to challenges.history
  const replenishAt = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  const newChallengeEntry = {
    attemptId,
    wordId,
    challengedAt: Timestamp.now(),
    replenishAt,
    status: 'pending',
  }

  const updatedHistory = [...challengeHistory, newChallengeEntry]

  // Update user document
  await updateDoc(userRef, {
    'challenges.history': updatedHistory,
  })

  // Update the specific answer in attempts document
  const updatedAnswers = [...answers]
  updatedAnswers[answerIndex] = {
    ...updatedAnswers[answerIndex],
    challengeStatus: 'pending',
    challengeNote: note || null,
  }

  await updateDoc(attemptRef, {
    answers: updatedAnswers,
  })

  return { success: true }
}

/**
 * Review a challenge (teacher action)
 * @param {string} teacherId - Teacher user ID
 * @param {string} attemptId - Attempt document ID
 * @param {string} wordId - Word ID being challenged
 * @param {boolean} accepted - Whether to accept the challenge
 * @returns {Promise<Object>} Success object
 */
export const reviewChallenge = async (teacherId, attemptId, wordId, accepted) => {
  if (!teacherId || !attemptId || !wordId) {
    throw new Error('teacherId, attemptId, and wordId are required.')
  }

  // [deepfix P10 · OVR (b)] Under SERVER_OVERRIDE, route the WHOLE review to the server
  // `reviewChallenge` callable (functions/foundation.js), FINISHING the migration P4 began
  // (P4 routed only the day-advance under SERVER_CHALLENGE_WRITE, :2868). The callable
  // applies the I-10 §6 authz UNION (teacher-of-record OR current-enrollment owner) and
  // moves the answer-flip / score / challenges.history / study_states legs server-side. It
  // uses request.auth.uid, not the passed teacherId. Flag OFF (default) ⇒ the existing
  // client body below runs VERBATIM (byte-equivalent), including its own
  // SERVER_CHALLENGE_WRITE day-advance sub-branch.
  if (SERVER_OVERRIDE) {
    const fn = httpsCallable(getFunctions(), 'reviewChallenge', { timeout: 30000 })
    const res = await fn({ attemptId, wordId, accepted })
    return res.data
  }

  // Get attempt document
  const attemptRef = doc(db, 'attempts', attemptId)
  const attemptSnap = await getDoc(attemptRef)
  if (!attemptSnap.exists()) {
    throw new Error('Attempt not found.')
  }

  const attemptData = attemptSnap.data()

  // Verify teacherId matches
  if (attemptData.teacherId !== teacherId) {
    throw new Error('Unauthorized: You are not the teacher for this attempt.')
  }

  // Find the answer with matching wordId
  const answers = attemptData.answers || []
  const answerIndex = answers.findIndex((a) => a.wordId === wordId)
  if (answerIndex === -1) {
    throw new Error('Answer not found in attempt.')
  }

  const answer = answers[answerIndex]

  // Verify challenge is pending
  if (answer.challengeStatus !== 'pending') {
    throw new Error('This challenge has already been reviewed.')
  }

  // Update answer
  const updatedAnswers = [...answers]
  updatedAnswers[answerIndex] = {
    ...answer,
    challengeStatus: accepted ? 'accepted' : 'rejected',
    challengeReviewedBy: teacherId,
    challengeReviewedAt: Timestamp.now(),
  }

  // If accepted, update isCorrect and recalculate score
  if (accepted) {
    updatedAnswers[answerIndex].isCorrect = true
  }

  // Recalculate score using the SAME denominator the original score used.
  // submitTestAttempt computes score = correctCount / answeredWords.length and
  // persists that count as `totalQuestions`. Using updatedAnswers.length here
  // can use a smaller denominator (skipped/partial attempts), silently inflating
  // the score and flipping passed false->true even on rejection. Use the
  // persisted totalQuestions as the canonical denominator.
  const correctCount = updatedAnswers.filter((a) => a.isCorrect).length
  const denom = attemptData.totalQuestions || updatedAnswers.length
  const newScore = denom > 0 ? Math.round((correctCount / denom) * 100) : 0

  // Fetch pass threshold to recalculate passed status
  let passThreshold = 95 // Default
  if (attemptData.classId && attemptData.listId) {
    try {
      const classDoc = await getDoc(doc(db, 'classes', attemptData.classId))
      const assignment = classDoc.exists()
        ? classDoc.data().assignments?.[attemptData.listId]
        : null
      passThreshold = assignment?.passThreshold || 95
    } catch (err) {
      console.error('Error fetching pass threshold:', err)
    }
  }

  // Recalculate passed based on new score
  const sessionType = attemptData.sessionType
  const newPassed = sessionType === 'review' ? true : newScore >= passThreshold

  // Update attempt document
  await updateDoc(attemptRef, {
    answers: updatedAnswers,
    score: newScore,
    passed: newPassed,
  })

  // Get studentId and update their challenges.history
  const studentId = attemptData.studentId
  const studentRef = doc(db, 'users', studentId)
  const studentSnap = await getDoc(studentRef)

  if (studentSnap.exists()) {
    const studentData = studentSnap.data()
    const challengeHistory = studentData.challenges?.history || []
    const updatedHistory = challengeHistory.map((entry) => {
      if (entry.attemptId === attemptId && entry.wordId === wordId) {
        return {
          ...entry,
          status: accepted ? 'accepted' : 'rejected',
        }
      }
      return entry
    })

    await updateDoc(studentRef, {
      'challenges.history': updatedHistory,
    })

    // If accepted, update study_state for this word to PASSED
    if (accepted) {
      const studyStateRef = doc(db, 'users', studentId, 'study_states', wordId)

      await setDoc(
        studyStateRef,
        {
          status: 'PASSED',
          lastTestedAt: serverTimestamp(),
        },
        { merge: true },
      )

      // Check if challenge acceptance should trigger day progression or session phase change
      const testId = attemptData.testId || ''
      const testIdParts = testId.split('_')
      const phase = testIdParts[testIdParts.length - 1] // 'new' or 'review'

      if ((phase === 'new' || phase === 'review') && attemptData.classId) {
        // Extract listId from testId (format: test_recovery_classId_listId_phase)
        const listId = testIdParts.length >= 4 ? testIdParts[testIdParts.length - 2] : null

        if (listId) {
          try {
            // [deepfix P4 · FND-2, F5-HIGH-2] The challenge-accept day-advance is the 3rd twi
            // writer. Under SERVER_CHALLENGE_WRITE, route it to the P3 `advanceForChallenge`
            // callable (functions/foundation.js:1594) INSTEAD of the direct class_progress
            // write below: the server re-derives the pass threshold + fail→pass transition +
            // current-day boundary guard + phase gate, and CLAMPS the twi add to wordsRemaining
            // (closing the unclamped :2900 over-add, I-6 §3-row-8). The client already wrote the
            // recomputed score to the attempt doc above (:2794), so the server reads it as
            // attempt.score and `previousScore` = the pre-acceptance score (attemptData is the
            // pre-update snapshot from :2730). Flag OFF (default) → the direct write below,
            // byte-equivalent to today. Post-P5 the direct write would target a dead collection
            // (canonical is authoritative); post-P7 it would no-op — this route writes the
            // record the foundation owns (legacy pre-P5, canonical post-P5) instead.
            if (SERVER_CHALLENGE_WRITE) {
              const advanceForChallengeFn = httpsCallable(getFunctions(), 'advanceForChallenge', { timeout: 30000 })
              await advanceForChallengeFn({ attemptId, previousScore: attemptData.score || 0 })
            } else {
            // Get pass threshold from assignment (stored in assignments map, not assignedLists array)
            const classDoc = await getDoc(doc(db, 'classes', attemptData.classId))
            const assignment = classDoc.exists()
              ? classDoc.data().assignments?.[listId]
              : null
            const passThreshold = assignment?.passThreshold || 95

            const oldScore = attemptData.score || 0

            // If old score was below threshold and new score is at/above threshold
            if (oldScore < passThreshold && newScore >= passThreshold) {
              // Fetch class_progress to get current day
              const progressDocId = `${attemptData.classId}_${listId}`
              const progressRef = doc(db, `users/${studentId}/class_progress`, progressDocId)
              const progressSnap = await getDoc(progressRef)

              if (progressSnap.exists()) {
                const progress = progressSnap.data()
                const currentDay = progress.currentStudyDay || 0
                const isFirstDay = currentDay === 0

                // Stale-day guard: only progress the day when the CHALLENGED attempt is
                // the student's current day boundary (its studyDay is exactly the next
                // day to complete: studyDay === currentDay + 1). Without this, an
                // accepted challenge for an OLD test still bumped the student's CURRENT
                // day (over-advance). When the attempt is NOT the current boundary, the
                // score/study_state are still corrected above; only the day stays put.
                const attemptStudyDay = attemptData.studyDay
                const isCurrentBoundary =
                  Number.isInteger(attemptStudyDay) && attemptStudyDay === currentDay + 1

                if (isCurrentBoundary && phase === 'new' && !isFirstDay) {
                  // Day 2+ New Word Test pass: Advance to Review Study phase (don't increment day)
                  // The student still needs to complete the Review Test
                  const sessionDocId = `${attemptData.classId}_${listId}`
                  const sessionRef = doc(db, `users/${studentId}/session_states`, sessionDocId)
                  await setDoc(sessionRef, {
                    phase: 'review-study',
                    newWordsTestPassed: true,
                    newWordsTestScore: newScore / 100,
                    lastUpdated: serverTimestamp()
                  }, { merge: true })
                } else if (isCurrentBoundary) {
                  // Day 1 New Word Test pass OR Review Test pass: Complete session
                  // Increment day and totalWordsIntroduced
                  const interventionLevel = progress.interventionLevel || 0

                  // Calculate newWordCount with intervention (same as calculateDailyAllocation)
                  // Assignment stores 'pace' as daily pace directly
                  const dailyPace = assignment?.pace || 20
                  const newWordCount = Math.round(dailyPace * (1 - interventionLevel))

                  // CS PR-3 · WI-1 (FORCED_PATHWAY): hold-guard the challenge-accept advance. A review
                  // fail→pass at the boundary must NOT advance a THROTTLE-HELD day (reviewMode===true) —
                  // that re-mints the #16 runaway the hold-csd exists to kill. When held, SKIP the
                  // csd/twi advance entirely (the corrected score already lives on the attempt doc; the
                  // day stays put). When it DOES advance, this writer becomes a csd owner, so it must
                  // ALSO recompute + persist the reviewMode bit (deriveThrottleMode over the current
                  // recentSessions — the one-owner invariant, mirror of updateClassProgress/
                  // recordReviewOutcome; else reviewMode goes stale vs the advance). Flag-off: fpHeld is
                  // false → the unconditional advance runs with NO reviewMode key (byte-equivalent).
                  const fpHeld = FORCED_PATHWAY && progress.reviewMode === true
                  if (!fpHeld) {
                    await updateDoc(progressRef, {
                      currentStudyDay: currentDay + 1,
                      totalWordsIntroduced: (progress.totalWordsIntroduced || 0) + newWordCount,
                      ...(FORCED_PATHWAY ? { reviewMode: deriveThrottleMode(progress.recentSessions || [], progress.reviewMode === true) } : {}),
                      lastSessionAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                    })
                  }
                }
              }
            }
            } // end SERVER_CHALLENGE_WRITE else — direct class_progress day-advance (flag-off fallback)
          } catch (err) {
            console.error('Error checking day progression after challenge:', err)
            // Don't fail the challenge review if day progression check fails
          }
        }
      }
    }
  }

  return { success: true }
}

/**
 * [deepfix P10 · OVR (a)] Teacher override — the in-product manual-pass. Calls the server
 * `overrideAttempt` callable (functions/foundation.js), which authorizes via the I-10 §6
 * union, writes a VALID reconciliation anchor (newWordStartIndex / newWordEndIndex /
 * wordsIntroduced / testId — the CLAUDE.md anchor rule, mirroring scripts/cs/manual-pass.mjs),
 * advances the day via the shared foundation transaction, and audit-logs the override. This
 * is the path for an ungradeable / teacherId:null / inherited attempt (a superset of
 * reviewChallenge — no dependence on a challengeable answer).
 *
 * DORMANT DRAFT (P10 (a)): this is the callable WIRING + a dormant caller — it refuses when
 * SERVER_OVERRIDE is off, so no live path reaches it (byte-equivalent: a new export that is
 * never invoked). The Gradebook override BUTTON (the surface that supplies studentId /
 * classId / listId / studyDay / score for an orphaned attempt) is DEFERRED to the P10 (c)
 * read-surface release: an orphaned/inherited attempt is not yet VISIBLE in the gradebook
 * until (c)'s widening leg lands, so there is no row to attach the action to yet. See
 * P10_impl_notes for the (c)/(d) deferral.
 *
 * @param {{studentId:string, classId:string, listId:string, studyDay:number, score:number, attemptId?:string}} params
 * @returns {Promise<Object>} { success, docId, passed, newWordStartIndex, newWordEndIndex, advance }
 */
export const overrideAttempt = async ({ studentId, classId, listId, studyDay, score, attemptId = null }) => {
  if (!SERVER_OVERRIDE) {
    throw new Error('Teacher override is not enabled (SERVER_OVERRIDE=false).')
  }
  const fn = httpsCallable(getFunctions(), 'overrideAttempt', { timeout: 30000 })
  const res = await fn({ studentId, classId, listId, studyDay, score, attemptId })
  return res.data
}

/**
 * Normalize a study state document to ensure all fields exist.
 *
 * @param {Object} doc - Raw Firestore document data
 * @returns {Object} Normalized study state
 */
export function normalizeStudyState(doc) {
  if (!doc) {
    return { ...DEFAULT_STUDY_STATE }
  }

  return {
    ...DEFAULT_STUDY_STATE,
    ...doc
  }
}

/**
 * Reset a student's progress for a specific class/list back to initial state.
 *
 * Deletes:
 * - class_progress document
 * - session_states document
 * - All study_states for the list
 * - All attempts for the class/list combination
 *
 * This is a complete reset - the student will start from day 0.
 *
 * @param {string} userId - The student's user ID
 * @param {string} classId - The class ID
 * @param {string} listId - The list ID
 * @returns {Promise<{ success: boolean, deletedCount: number }>}
 * @throws {Error} If user is not authenticated or parameters are missing
 */
export async function resetStudentProgress(userId, classId, listId) {
  // Safety check: verify userId matches current authenticated user
  const currentUser = auth.currentUser
  if (!currentUser || currentUser.uid !== userId) {
    throw new Error('Unauthorized: can only reset your own progress')
  }

  if (!userId || !classId || !listId) {
    throw new Error('Missing required parameters: userId, classId, and listId are required')
  }

  // [deepfix P4 · FND-2, SERVER_RESET_PROGRESS / F6-3, v2 HIGH-3] Route reset through the
  // `resetProgress` callable (functions/foundation.js): self-service (uid = caller — same
  // guarantee as the check above), LIST-WIDE across ALL classes (the persist §5.3 fix for
  // this function's class-scoped legacy delete), attempts-first ordering, legacy-testId
  // sweep, and a durable reset-epoch tombstone. With this flag ON, no LIVE client path
  // deletes attempt docs — the prerequisite for P6 removing the attempts owner-delete rules
  // branch ([C5-5]). Flag OFF (default) → the legacy client batch-delete below,
  // byte-equivalent to today (and still rules-legal until P6).
  if (SERVER_RESET_PROGRESS) {
    const resetProgressFn = httpsCallable(getFunctions(), 'resetProgress', { timeout: 60000 })
    const resp = await resetProgressFn({ listId })
    const d = resp?.data?.deleted || {}
    return {
      success: resp?.data?.success === true,
      deletedCount: (d.attempts || 0) + (d.sessionStates || 0) + (d.studyStates || 0) + (d.classProgress || 0)
    }
  }

  let deletedCount = 0

  // 1. Delete class_progress document
  const progressDocId = `${classId}_${listId}`
  const progressRef = doc(db, `users/${userId}/class_progress`, progressDocId)
  try {
    await deleteDoc(progressRef)
    deletedCount++
  } catch (err) {
    // Document may not exist, that's ok
    console.log('class_progress document not found or already deleted')
  }

  // 2. Delete session_states document
  const sessionDocId = `${classId}_${listId}`
  const sessionRef = doc(db, `users/${userId}/session_states`, sessionDocId)
  try {
    await deleteDoc(sessionRef)
    deletedCount++
  } catch (err) {
    // Document may not exist, that's ok
    console.log('session_states document not found or already deleted')
  }

  // 3. Query and batch delete all study_states for this listId
  const studyStatesRef = collection(db, `users/${userId}/study_states`)
  const q = query(studyStatesRef, where('listId', '==', listId))

  try {
    const snapshot = await getDocs(q)

    if (snapshot.size > 0) {
      // Use batched writes (max 500 per batch)
      const batchSize = 500
      let batch = writeBatch(db)
      let batchCount = 0

      for (const docSnap of snapshot.docs) {
        batch.delete(docSnap.ref)
        batchCount++
        deletedCount++

        // Commit batch when it reaches the limit
        if (batchCount >= batchSize) {
          await batch.commit()
          batch = writeBatch(db)
          batchCount = 0
        }
      }

      // Commit any remaining deletions
      if (batchCount > 0) {
        await batch.commit()
      }
    }
  } catch (err) {
    console.error('Error deleting study_states:', err)
    throw new Error('Failed to delete word study states')
  }

  // 4. Query and batch delete all attempts for this class/list
  // Note: attempts don't have listId as a field, it's embedded in testId
  const attemptsRef = collection(db, 'attempts')
  const attemptsQuery = query(
    attemptsRef,
    where('studentId', '==', userId),
    where('classId', '==', classId)
  )

  try {
    const attemptsSnapshot = await getDocs(attemptsQuery)

    if (attemptsSnapshot.size > 0) {
      // Filter attempts by parsing testId to match listId
      // testId format: vocaboost_test_{classId}_{listId}_{sessionType}
      const attemptsToDelete = attemptsSnapshot.docs.filter(doc => {
        const testId = doc.data().testId
        if (!testId) return false

        const parts = testId.split('_')
        // parts: ['vocaboost', 'test', classId, listId, sessionType]
        if (parts.length >= 5) {
          const attemptListId = parts[3]
          return attemptListId === listId
        }
        return false
      })

      console.log(`[RESET] Found ${attemptsToDelete.length} attempts to delete for list ${listId}`)

      if (attemptsToDelete.length > 0) {
        // Use batched writes (max 500 per batch)
        const batchSize = 500
        let batch = writeBatch(db)
        let batchCount = 0

        for (const docSnap of attemptsToDelete) {
          batch.delete(docSnap.ref)
          batchCount++
          deletedCount++

          // Commit batch when it reaches the limit
          if (batchCount >= batchSize) {
            await batch.commit()
            batch = writeBatch(db)
            batchCount = 0
          }
        }

        // Commit any remaining deletions
        if (batchCount > 0) {
          await batch.commit()
        }
      }
    }
  } catch (err) {
    console.error('Error deleting attempts:', err)
    throw new Error('Failed to delete attempt records')
  }

  return { success: true, deletedCount }
}

/**
 * Get the new word test attempt for a specific study day.
 * Used by completeSessionFromTest() to fetch the new word score when completing from a review test.
 *
 * @param {string} userId - Student user ID
 * @param {string} classId - Class ID
 * @param {number} studyDay - The study day number to find the attempt for
 * @returns {Promise<Object|null>} The attempt data or null if not found
 */
export const getNewWordAttemptForDay = async (userId, classId, listId, studyDay, opts = {}) => {
  if (!userId || !classId || !listId || studyDay === undefined) {
    console.warn('getNewWordAttemptForDay: Missing required parameters')
    return null
  }

  try {
    const attemptsRef = collection(db, 'attempts')
    // MUST filter by listId: a same-class multi-list student can have two 'new'
    // attempts with the same studyDay (one per list). Without listId, the
    // orderBy-submittedAt/limit-1 returns whichever list was submitted last, so a
    // review on list A could be gated/stamped against list B's new-word pass.
    //
    // opts.listScope [F1]: ONLY the Day-2+ completion gate (completeSessionFromTest)
    // opts in — under LIST_SCOPED_RECON a same-day pass earned in another class counts
    // (shared truth), but cross-class trust requires BOTH proofs [V4 / Codex-P1-2 / P1r3-1]:
    //   (a) exact position: newWordStartIndex === opts.expectedBase, AND
    //   (b) a server-computed PASS: passed === true (a failed attempt's raw score must
    //       never reach the launching class's local-threshold fallback cross-class).
    // Both are enforced IN THE QUERY (indexed equalities — no bounded client scan that
    // could miss a match beyond the window [P1r3-2]). If no such pass exists, fall back
    // to the LAUNCHING-CLASS legacy query — identical semantics to flag-off (legacy
    // score-fallback and missing-position trust stay launching-class-only). No usable
    // expectedBase → launching-class only (fail closed). TypedTest/MCQTest day-stamping
    // call sites deliberately stay class-scoped.
    const listScope = LIST_SCOPED_RECON && opts.listScope === true
    if (listScope && Number.isInteger(opts.expectedBase)) {
      const qPassedAtPosition = query(
        attemptsRef,
        where('studentId', '==', userId),
        where('listId', '==', listId),
        where('sessionType', '==', 'new'),
        where('studyDay', '==', studyDay),
        where('newWordStartIndex', '==', opts.expectedBase),
        where('passed', '==', true),
        orderBy('submittedAt', 'desc'),
        limit(1)
      )
      const passedSnap = await getDocs(qPassedAtPosition)
      if (!passedSnap.empty) {
        return { id: passedSnap.docs[0].id, ...passedSnap.docs[0].data() }
      }
      // No position-proven pass anywhere → launching-class legacy query below.
      console.log(`getNewWordAttemptForDay(list-scoped): no position-proven pass for day ${studyDay} — falling back to launching class`)
    }
    const q = query(
      attemptsRef,
      where('studentId', '==', userId),
      where('classId', '==', classId),
      where('listId', '==', listId),
      where('sessionType', '==', 'new'),
      where('studyDay', '==', studyDay),
      orderBy('submittedAt', 'desc'),
      limit(1)
    )

    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      console.warn(`getNewWordAttemptForDay: No new word attempt found for day ${studyDay}`)
      return null
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
  } catch (err) {
    console.error('getNewWordAttemptForDay error:', err)
    return null
  }
}

/**
 * Get recent attempts for a specific class/list combination.
 * Used for CSD/TWI reconciliation to verify progress against actual attempts.
 *
 * @param {string} userId - Student user ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {number} maxResults - Maximum number of attempts to return (default 8; 12 under
 *   REVIEW_PAIRING_V2 — CS PR-1 · WI-2: multi-review days must not push the day's passed
 *   `new` anchor out of the window. Flag-off keeps the literal 8.)
 * @returns {Promise<Array>} Array of attempt documents, newest first
 */
export async function getRecentAttemptsForClassList(userId, classId, listId, maxResults = (REVIEW_PAIRING_V2 ? RECENT_ATTEMPTS_WINDOW : 8)) {
  console.log('[RECONCILIATION] getRecentAttemptsForClassList called:', { userId, classId, listId, maxResults })

  if (!userId || !classId || !listId) {
    console.warn('[RECONCILIATION] Missing required parameters')
    return []
  }

  try {
    const attemptsRef = collection(db, 'attempts')
    // LIST_SCOPED_RECON (§5.1): reconciliation evidence is student+list — include attempts
    // from every class (cross-class phase detection / orphan flagging see the whole history).
    const q = LIST_SCOPED_RECON
      ? query(
          attemptsRef,
          where('studentId', '==', userId),
          where('listId', '==', listId),
          orderBy('submittedAt', 'desc'),
          limit(maxResults)
        )
      : query(
          attemptsRef,
          where('studentId', '==', userId),
          where('classId', '==', classId),
          where('listId', '==', listId),
          orderBy('submittedAt', 'desc'),
          limit(maxResults)
        )

    console.log('[RECONCILIATION] Executing Firestore query...')
    const snapshot = await getDocs(q)
    const attempts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    console.log('[RECONCILIATION] Query returned:', {
      attemptCount: attempts.length,
      studyDays: attempts.map(a => a.studyDay),
      sessionTypes: attempts.map(a => a.sessionType)
    })

    return attempts
  } catch (err) {
    console.error('[RECONCILIATION] ❌ Query failed!')
    console.error('[RECONCILIATION] Error code:', err.code)
    console.error('[RECONCILIATION] Error message:', err.message)

    // Check if this is a missing index error
    if (err.code === 'failed-precondition' || err.message?.includes('index')) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('🔴 FIRESTORE INDEX MISSING - RECONCILIATION DISABLED')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('The CSD reconciliation query requires a composite index.')
      console.error('Required index: studentId + classId + listId + submittedAt')
      console.error('')
      console.error('Full error:', err)
      console.error('')
      console.error('Check the error above for a Firebase Console link to create the index.')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } else {
      console.error('[RECONCILIATION] Unexpected error type. Reconciliation will be skipped.')
      console.error('[RECONCILIATION] Full error:', err)
    }

    // Return empty array to prevent crashes (Math.max will keep existing values)
    return []
  }
}

/**
 * Get the most recent new word test for a specific class/list combination.
 * Used as a fallback in reconciliation when the initial 8 attempts don't contain a new test.
 *
 * @param {string} userId - Student user ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @returns {Promise<Object|null>} The most recent new test attempt or null if not found
 */
export async function getMostRecentNewTest(userId, classId, listId) {
  console.log('[RECONCILIATION] getMostRecentNewTest fallback query:', { userId, classId, listId })

  if (!userId || !classId || !listId) {
    console.warn('[RECONCILIATION] getMostRecentNewTest: Missing required parameters')
    return null
  }

  try {
    const attemptsRef = collection(db, 'attempts')
    const q = query(
      attemptsRef,
      where('studentId', '==', userId),
      where('classId', '==', classId),
      where('listId', '==', listId),
      where('sessionType', '==', 'new'),
      orderBy('submittedAt', 'desc'),
      limit(1)
    )

    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      console.log('[RECONCILIATION] getMostRecentNewTest: No new tests found')
      return null
    }

    const doc = snapshot.docs[0]
    const data = { id: doc.id, ...doc.data() }
    console.log('[RECONCILIATION] getMostRecentNewTest found:', {
      attemptId: doc.id,
      studyDay: data.studyDay,
      newWordEndIndex: data.newWordEndIndex
    })
    return data
  } catch (err) {
    console.error('[RECONCILIATION] getMostRecentNewTest query failed:', err)
    return null
  }
}

/**
 * Get the most recent PASSED new test for reconciliation anchor.
 * Only considers tests where passed === true.
 *
 * Returns a DISCRIMINATED result so callers can tell apart "no passed test exists"
 * from a transient/index query failure (which must NOT be treated as proof of a
 * near-zero study day). The found-but-malformed case is judged by the caller.
 *
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID
 * @param {string} listId - List document ID
 * @returns {Promise<{status:'found',attempt:Object}|{status:'none'}|{status:'query-error',error:Object}>}
 */
export async function getMostRecentPassedNewTest(userId, classId, listId) {
  console.log('[RECONCILIATION] getMostRecentPassedNewTest:', { userId, classId, listId })

  if (!userId || !classId || !listId) {
    console.warn('[RECONCILIATION] getMostRecentPassedNewTest: Missing required parameters')
    return { status: 'query-error', error: { message: 'missing required parameters', code: 'invalid-argument', stack: null } }
  }

  try {
    const attemptsRef = collection(db, 'attempts')

    if (LIST_SCOPED_RECON) {
      // §5.1 (PLAN_list_progress_persist v3.7): the anchor is STUDENT+LIST scoped — the
      // greatest valid word POSITION across every class the student has taken the list in
      // (cross-pace, studyDay is not comparable; newWordEndIndex is). submittedAt DESC
      // breaks equal-position ties deterministically [C5-3].
      // [Codex-P1-4 / P1r3-2 / P1r4-2] The `newWordEndIndex >= 0` range filter excludes
      // non-NUMBER types (strings/booleans/nulls) by Firestore's type-scoped range
      // matching — but integers and DOUBLES interleave as one number type, so a
      // malformed 999.5 can still top the ordering. PAGINATE (position-desc) until the
      // first valid integer anchor is found or history is exhausted: a malformed float
      // can never cause a valid integer anchor below it to be abandoned, and there is
      // no fixed client window a valid candidate could fall outside of. Real data is
      // integer-only (server + manual-pass both write integers; Phase-0 audit found no
      // floats) — this loop is the correctness guarantee, expected to hit page 1 doc 1.
      //
      // F-6 (reset-epoch filter — FINAL_REVIEW_FINDINGS): once reset is routed to the
      // server, resetProgress stamps `resetAt` in users/{uid}/progress_meta/{listId} and
      // EXCLUDES attempts submitted before it, so a stale in-flight attempt that lands
      // AFTER a reset cannot re-promote the anchor ("reset un-resets"). Gated behind
      // SERVER_RESET_PROGRESS — the tombstone's ONLY writer: flag OFF (today) ⇒ ZERO extra
      // reads and NO filtering ⇒ byte-identical to today. Even flag-ON, no `resetAt` (never
      // reset) ⇒ notPreReset always true ⇒ the anchor selection is unchanged.
      let resetMs = null
      if (SERVER_RESET_PROGRESS) {
        try {
          const metaSnap = await getDoc(doc(db, `users/${userId}/progress_meta/${listId}`))
          const ra = metaSnap.exists() ? metaSnap.data().resetAt : null
          resetMs = (ra && typeof ra.toMillis === 'function') ? ra.toMillis() : null
        } catch {
          resetMs = null // tombstone read failure ⇒ no filtering (today's behavior)
        }
      }
      const notPreReset = (data) => resetMs == null ||
        (data.submittedAt && typeof data.submittedAt.toMillis === 'function' &&
          data.submittedAt.toMillis() >= resetMs)
      const PAGE = 10
      let cursor = null
      for (;;) {
        const qPos = query(
          attemptsRef,
          where('studentId', '==', userId),
          where('listId', '==', listId),
          where('sessionType', '==', 'new'),
          where('passed', '==', true),
          where('newWordEndIndex', '>=', 0),
          orderBy('newWordEndIndex', 'desc'),
          orderBy('submittedAt', 'desc'),
          ...(cursor ? [startAfter(cursor)] : []),
          limit(PAGE)
        )
        const posSnap = await getDocs(qPos)
        if (posSnap.empty) break
        const validDoc = posSnap.docs.find(d => {
          const data = d.data()
          const v = data.newWordEndIndex
          return Number.isInteger(v) && v >= 0 && notPreReset(data)
        })
        if (validDoc) {
          const data = { id: validDoc.id, ...validDoc.data() }
          console.log('[RECONCILIATION] getMostRecentPassedNewTest (list-scoped, by position):', {
            attemptId: validDoc.id, classId: data.classId, studyDay: data.studyDay,
            newWordEndIndex: data.newWordEndIndex
          })
          return { status: 'found', attempt: data }
        }
        console.warn('[RECONCILIATION] page of position anchors all non-integer — paginating', {
          pageSize: posSnap.docs.length
        })
        if (posSnap.docs.length < PAGE) break
        cursor = posSnap.docs[posSnap.docs.length - 1]
      }
      // Sparse-index fallback [V7]: legacy attempts MISSING newWordEndIndex are absent
      // from the position-ordered index. Retry ordered by studyDay (still list-wide);
      // a returned attempt without a valid newWordEndIndex is judged by the caller
      // (hasValidData → csd_anchor_invalid log), same as today.
      const qDay = query(
        attemptsRef,
        where('studentId', '==', userId),
        where('listId', '==', listId),
        where('sessionType', '==', 'new'),
        where('passed', '==', true),
        orderBy('studyDay', 'desc'),
        limit(1)
      )
      const daySnap = await getDocs(qDay)
      if (daySnap.empty) {
        console.log('[RECONCILIATION] getMostRecentPassedNewTest (list-scoped): No passed new tests found')
        return { status: 'none' }
      }
      const d = daySnap.docs[0]
      const data = { id: d.id, ...d.data() }
      // F-6: a pre-reset straggler in the (limit-1) studyDay fallback ⇒ no valid
      // post-reset anchor (conservative — preserves the reset). Byte-identical when
      // resetMs is null (notPreReset always true → returns the doc as before).
      if (!notPreReset(d.data())) {
        console.log('[RECONCILIATION] getMostRecentPassedNewTest (list-scoped): studyDay-fallback anchor is pre-reset — excluded')
        return { status: 'none' }
      }
      console.log('[RECONCILIATION] getMostRecentPassedNewTest (list-scoped, studyDay fallback):', {
        attemptId: d.id, classId: data.classId, studyDay: data.studyDay,
        newWordEndIndex: data.newWordEndIndex
      })
      return { status: 'found', attempt: data }
    }

    const q = query(
      attemptsRef,
      where('studentId', '==', userId),
      where('classId', '==', classId),
      where('listId', '==', listId),
      where('sessionType', '==', 'new'),
      where('passed', '==', true),
      orderBy('studyDay', 'desc'),
      limit(1)
    )

    const snapshot = await getDocs(q)

    if (snapshot.empty) {
      console.log('[RECONCILIATION] getMostRecentPassedNewTest: No passed new tests found')
      return { status: 'none' }
    }

    const doc = snapshot.docs[0]
    const data = { id: doc.id, ...doc.data() }
    console.log('[RECONCILIATION] getMostRecentPassedNewTest found:', {
      attemptId: doc.id,
      studyDay: data.studyDay,
      newWordEndIndex: data.newWordEndIndex,
      passed: data.passed
    })
    return { status: 'found', attempt: data }
  } catch (err) {
    console.error('[RECONCILIATION] getMostRecentPassedNewTest query failed:', err)
    // Stringify for Firestore-safe logging downstream (no raw Error objects).
    return {
      status: 'query-error',
      error: {
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        stack: err?.stack ? String(err.stack).slice(0, 600) : null
      }
    }
  }
}

/**
 * Check if a review test exists for a specific study day.
 *
 * Returns a DISCRIMINATED result [C3-6] so the caller can tell "no review exists"
 * apart from a transient/index query failure — an errored query must NOT silently
 * decrement CSD (under LIST_SCOPED_RECON the non-demoting CSD max also protects).
 *
 * Pairing rule (§5.1, LIST_SCOPED_RECON only) — NEED_TO_FIX #9 (Fix B): the review must belong
 * to the SAME progression as the anchor. Under the student-owned model the review can be earned
 * in ANY of the student's classes on the list, so we DROP the class filter — but `studyDay` is a
 * session COUNTER, not a position identity (a different-pace class's "Day D" is a different
 * progression), so a same-`studyDay` review only counts if it covers the anchor's word-position
 * range. Discriminator = student/list + `submittedAt >= anchor` (temporal pre-narrow) + EXACT
 * `newWordStartIndex/newWordEndIndex` match to the anchor range. Candidates are streamed and
 * client-filtered (no positional Firestore filter → no new index); the first range-matching
 * review is `found`, exhaustion is `none` (never a newest-unverified review).
 *
 * REVIEW_PAIRING_V2 (CS PR-1 · WI-2, dormant): the exact-range discriminator above proved too
 * strict — ~34.5% of real reviews carry a drifted/inverted/null range and never pair (the I4
 * stuck loop). Under the flag the temporal query pre-narrow is dropped and the candidate is
 * judged by the census-LOCKED `reviewPairsWithAnchor` predicate (src/utils/reviewPairing.js),
 * which preserves the #9 cross-pace protection (cross-class reviews fail every leg).
 * Flag-off: the pre-narrowed query + exact-range match, verbatim.
 *
 * @param {string} userId - User document ID
 * @param {string} classId - Class document ID (launching class — legacy/flag-off scope)
 * @param {string} listId - List document ID
 * @param {number} studyDay - Study day number to check
 * @param {{anchorClassId?: string, anchorSubmittedAt?: Object, anchorNewWordStartIndex?: number, anchorNewWordEndIndex?: number}} [pairing] - anchor lineage (flag-on)
 * @returns {Promise<{status:'found',attempt:Object}|{status:'none'}|{status:'query-error',error:Object}>}
 */
export async function getReviewForDay(userId, classId, listId, studyDay, pairing = null) {
  console.log('[RECONCILIATION] getReviewForDay:', { userId, classId, listId, studyDay, paired: !!pairing })

  if (!userId || !classId || !listId || !studyDay) {
    console.warn('[RECONCILIATION] getReviewForDay: Missing required parameters')
    return { status: 'query-error', error: { message: 'missing required parameters', code: 'invalid-argument', stack: null } }
  }

  try {
    const attemptsRef = collection(db, 'attempts')

    if (LIST_SCOPED_RECON) {
      // [Codex-P1-1 + F9-1/F9-3] Anchor lineage now REQUIRES the position range. Missing any
      // lineage field must NOT fall back to an unverified query — return query-error so the
      // caller preserves the stored CSD (the safe, non-demoting outcome).
      if (!(pairing?.anchorClassId && pairing?.anchorSubmittedAt
            && Number.isInteger(pairing?.anchorNewWordStartIndex)
            && Number.isInteger(pairing?.anchorNewWordEndIndex))) {
        console.warn('[RECONCILIATION] getReviewForDay: anchor lineage incomplete under LIST_SCOPED_RECON — cannot pair safely')
        return { status: 'query-error', error: { message: 'missing anchor lineage (class/submittedAt/newWordStartIndex/newWordEndIndex)', code: 'invalid-pairing', stack: null } }
      }
      // Candidate stream: existing composite (studentId, listId, sessionType, studyDay,
      // submittedAt DESC) — NO classId (list-scoped). Paginate + client-filter for the exact
      // anchor range. orderBy DESC matches the existing DESC composite index (the ASC variant
      // without classId does NOT exist → orderBy asc would FAIL-PRECONDITION). Order is
      // irrelevant here — we need EXISTENCE of a range-matching review, not the earliest/newest.
      const PAGE = 25
      const MAX_PAGES = 40 // safety bound; the candidate set (one student/list/day post-anchor) is small
      let cursor = null
      for (let page = 0; page < MAX_PAGES; page++) {
        // REVIEW_PAIRING_V2 (CS PR-1 · WI-2): DROP the `submittedAt >= anchor` query
        // pre-narrow — the V2 predicate judges temporality itself, INCLUDING the pre-anchor
        // legs (relief-minted [twi,twi-1] stubs / null-range reviews are temporally BEFORE
        // a retake-refreshed anchor, and the pre-narrow is exactly what excluded the 9
        // census pre-anchor victims). Same composite index either way (equality filters +
        // orderBy submittedAt DESC — the range clause never required an extra index).
        // Flag-off: the exact original query, verbatim.
        let q = REVIEW_PAIRING_V2
          ? query(
              attemptsRef,
              where('studentId', '==', userId),
              where('listId', '==', listId),
              where('sessionType', '==', 'review'),
              where('studyDay', '==', studyDay),
              orderBy('submittedAt', 'desc'),
              limit(PAGE)
            )
          : query(
              attemptsRef,
              where('studentId', '==', userId),
              where('listId', '==', listId),
              where('sessionType', '==', 'review'),
              where('studyDay', '==', studyDay),
              where('submittedAt', '>=', pairing.anchorSubmittedAt),
              orderBy('submittedAt', 'desc'),
              limit(PAGE)
            )
        if (cursor) q = query(q, startAfter(cursor))
        const snap = await getDocs(q)
        // Genuine exhaustion (empty page, or a partial last page with no match) → 'none'.
        if (snap.empty) {
          console.log('[RECONCILIATION] getReviewForDay: no position-matching review for day', studyDay)
          return { status: 'none' }
        }
        for (const d of snap.docs) {
          const data = { id: d.id, ...d.data() }
          // REVIEW_PAIRING_V2 (CS PR-1 · WI-2): the census-LOCKED tiered predicate
          // (src/utils/reviewPairing.js) replaces the exact-range match — same studyDay is
          // already guaranteed by the query filter; the predicate re-checks it via the
          // anchor object. Flag-off: the exact-range if, verbatim (INV-9 needle preserved).
          const paired = REVIEW_PAIRING_V2
            ? reviewPairsWithAnchor(data, {
                studyDay,
                classId: pairing.anchorClassId,
                submittedAt: pairing.anchorSubmittedAt,
                newWordStartIndex: pairing.anchorNewWordStartIndex,
                newWordEndIndex: pairing.anchorNewWordEndIndex
              })
            : (data.newWordStartIndex === pairing.anchorNewWordStartIndex
              && data.newWordEndIndex === pairing.anchorNewWordEndIndex)
          // CS PR-3 · WI-1 (FORCED_PATHWAY): reject a paired-but-NON-engaged POST-epoch review even on
          // the exact-range tier. A post-deploy same-session SKIP carries the exact anchor range → it
          // tier-1 matches reviewPairsWithAnchor → reconciliation would write csd forward, UNDOING the
          // F3 hold-csd. The grandfathered isCompletionEngaged keeps PRE-epoch skips pairing (decision
          // #3) but drops post-deploy skips. This is a READER-SITE gate — reviewPairsWithAnchor (PR-1
          // census-locked) is UNTOUCHED. A rejected candidate is skipped (loop continues), so a genuine
          // engaged review for the same day still pairs. Flag-off: pairedComplete === paired verbatim
          // (byte-equivalent — the exact-range needle + the if are unchanged when FORCED_PATHWAY is off).
          const pairedComplete = FORCED_PATHWAY ? (paired && isCompletionEngaged(data)) : paired
          if (pairedComplete) {
            console.log('[RECONCILIATION] getReviewForDay: position-matched review for day', studyDay)
            return { status: 'found', attempt: data }
          }
        }
        if (snap.docs.length < PAGE) {
          console.log('[RECONCILIATION] getReviewForDay: no position-matching review for day', studyDay)
          return { status: 'none' }
        }
        cursor = snap.docs[snap.docs.length - 1]
      }
      // Cap reached WITHOUT exhausting candidates: we have NOT proven no match exists. Fail
      // closed (query-error → caller preserves stored CSD), never silent 'none' (which would
      // under-advance CSD). Realistically unreachable (>1000 same-day reviews for one student).
      console.warn('[RECONCILIATION] getReviewForDay: candidate scan hit MAX_PAGES without exhaustion — failing closed')
      return { status: 'query-error', error: { message: 'candidate scan limit reached', code: 'candidate-scan-limit', stack: null } }
    }

    // Flag-off (legacy, Run-L-certified): launching-class-scoped existence, unchanged.
    const q = query(
      attemptsRef,
      where('studentId', '==', userId),
      where('classId', '==', classId),
      where('listId', '==', listId),
      where('sessionType', '==', 'review'),
      where('studyDay', '==', studyDay),
      limit(1)
    )
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      console.log('[RECONCILIATION] getReviewForDay: No review found for day', studyDay)
      return { status: 'none' }
    }
    const doc = snapshot.docs[0]
    console.log('[RECONCILIATION] getReviewForDay found review for day', studyDay)
    return { status: 'found', attempt: { id: doc.id, ...doc.data() } }
  } catch (err) {
    console.error('[RECONCILIATION] getReviewForDay query failed:', err)
    return {
      status: 'query-error',
      error: {
        message: err?.message ?? String(err),
        code: err?.code ?? null,
        stack: err?.stack ? String(err.stack).slice(0, 600) : null
      }
    }
  }
}
