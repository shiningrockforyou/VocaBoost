import {
  Timestamp,
  addDoc,
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
import { db } from '../firebase'

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
  streakDays: 0,
}

const defaultSettings = {
  weeklyGoal: 100,
  useUnifiedQueue: false,
}

const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5)
const normalizePOS = (value) => (value || '').toString().trim().toLowerCase()

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
    enrolledClasses: {},
    createdAt: serverTimestamp(),
    ...docOverrides,
  }

  await setDoc(userDocRef, userDocument, { merge: true })
  return userDocRef
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
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }))
}

export const deleteClass = async (classId) => {
  if (!classId) {
    throw new Error('classId is required.')
  }
  await deleteDoc(doc(db, 'classes', classId))
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
      const assignedListIds = classData.assignedLists || Object.keys(assignments)

      const assignedListDetails = await Promise.all(
        assignedListIds.map(async (listId) => {
          const listSnap = await getDoc(doc(db, 'lists', listId))
          if (!listSnap.exists()) return null
          const listData = { id: listSnap.id, ...listSnap.data() }
          const stats = await fetchStudentStats(studentId, listId)
          return { ...listData, stats }
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
    return {
      weeklyProgress: 0,
      latestTest: null,
      masteryCount: 0,
      retention: 1,
    }
  }

  const userRef = doc(db, 'users', userId)
  const studyStatesRef = collection(db, 'users', userId, 'study_states')
  const attemptsRef = collection(db, 'attempts')

  const oneWeekMillis = 7 * 24 * 60 * 60 * 1000
  const cutoff = Timestamp.fromMillis(Date.now() - oneWeekMillis)

  const [userSnap, studyStatesSnap, attemptsSnap] = await Promise.all([
    getDoc(userRef),
    getDocs(studyStatesRef),
    // Remove orderBy to avoid index requirement - we'll sort client-side
    getDocs(
      query(
        attemptsRef,
        where('studentId', '==', userId),
      ),
    ),
  ])

  let weeklyProgress = 0
  let masteryCount = 0

  studyStatesSnap.docs.forEach((docSnap) => {
    const data = docSnap.data()
    const lastReviewed = data.lastReviewed
    const box = data.box ?? 1
    if (lastReviewed?.toMillis && lastReviewed.toMillis() >= cutoff.toMillis()) {
      weeklyProgress += 1
    }
    if (box >= 4) {
      masteryCount += 1
    }
  })

  // Sort attempts client-side by submittedAt (descending) and get the latest
  const attemptsArray = attemptsSnap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }))
  
  attemptsArray.sort((a, b) => {
    // Handle Firestore Timestamp objects
    const getTimestamp = (attempt) => {
      if (attempt.submittedAt?.toMillis) {
        return attempt.submittedAt.toMillis()
      }
      if (attempt.submittedAt?.toDate) {
        return attempt.submittedAt.toDate().getTime()
      }
      if (attempt.submittedAt?.seconds) {
        return attempt.submittedAt.seconds * 1000
      }
      return 0
    }
    
    const timeA = getTimestamp(a)
    const timeB = getTimestamp(b)
    return timeB - timeA // Descending order (most recent first)
  })
  
  const latestTest = attemptsArray.length > 0 ? attemptsArray[0] : null

  const userData = userSnap.exists() ? userSnap.data() : {}
  const retention = userData.stats?.retention ?? 1

  return {
    weeklyProgress,
    latestTest,
    masteryCount,
    retention,
  }
}

export const addWordToList = async (listId, wordData) => {
  if (!listId) {
    throw new Error('A listId is required.')
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
      classData.assignments[id] = assignment
    })
  }

  return { id: classSnap.id, ...classData }
}

export const assignListToClass = async (classId, listId, pace = 20, testOptionsCount = 4) => {
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
    if (Number.isNaN(paceValue) || paceValue < 1) {
      throw new Error('Pace must be a positive number.')
    }
    updates.pace = paceValue
  }

  if (settings.testOptionsCount !== undefined) {
    const optionValue = Number(settings.testOptionsCount)
    if (Number.isNaN(optionValue) || optionValue < 4 || optionValue > 10) {
      throw new Error('Test options must be between 4 and 10.')
    }
    updates.testOptionsCount = optionValue
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
  const userData = userSnap.exists() ? userSnap.data() : {}
  const displayName = userData.profile?.displayName ?? userData.email ?? ''
  const email = userData.email ?? ''

  await setDoc(
    doc(db, 'classes', classDoc.id, 'members', studentId),
    {
      joinedAt: serverTimestamp(),
      displayName,
      email,
    },
    { merge: true },
  )

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
  const wordsQuery = query(wordsRef, orderBy('createdAt', 'asc'))
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

export const fetchSmartStudyQueue = async (listId, userId, classId = null, limitAmount = 100) => {
  if (!listId || !userId) {
    console.log('[fetchSmartStudyQueue] Missing listId or userId, returning empty array')
    return []
  }

  console.log('[fetchSmartStudyQueue] Fetching study queue for listId:', listId, 'userId:', userId, 'classId:', classId)

  const wordsRef = collection(db, 'lists', listId, 'words')
  const snapshot = await getDocs(wordsRef)
  const allWords = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }))

  console.log('[fetchSmartStudyQueue] Raw words from Firestore:', allWords.length, 'words')
  console.log('[fetchSmartStudyQueue] Sample word data:', allWords[0] || 'No words found')

  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const userData = userSnap.exists() ? userSnap.data() : {}
  const stats = userData.stats ?? {}
  const retention = stats.retention ?? 1.0

  const queueLimit = Math.max(1, limitAmount)

  if (retention < 0.6) {
    const studyStatesRef = collection(db, 'users', userId, 'study_states')
    const studyStatesSnap = await getDocs(studyStatesRef)
    const wordStates = {}
    studyStatesSnap.docs.forEach((docSnap) => {
      wordStates[docSnap.id] = docSnap.data()
    })

    return allWords
      .filter((word) => {
      const wordState = wordStates[word.id]
      const box = wordState?.box ?? 1
      return box === 1
      })
      .slice(0, queueLimit)
  }

  // Calculate daily limit based on class assignment pace
  let basePace = 20 // default
  if (classId) {
    const classSnap = await getDoc(doc(db, 'classes', classId))
    if (classSnap.exists()) {
      const classData = classSnap.data()
      const assignments = classData.assignments || {}
      if (assignments[listId]?.pace) {
        basePace = assignments[listId].pace
      }
    }
  }

  const credibility = stats.credibility ?? 1.0
  const dailyNewLimit = Math.round(basePace * credibility)

  const studyStatesRef = collection(db, 'users', userId, 'study_states')
  const studyStatesSnap = await getDocs(studyStatesRef)
  const wordStates = {}
  studyStatesSnap.docs.forEach((docSnap) => {
    wordStates[docSnap.id] = docSnap.data()
  })

  const newWords = allWords.filter((word) => !wordStates[word.id])
  const limitedNewWords = newWords.slice(0, dailyNewLimit)
  const now = Timestamp.now()

  const dueWords = allWords.filter((word) => {
    const state = wordStates[word.id]
    if (!state) {
      return false
    }
    const nextReview = state.nextReview
    return nextReview && nextReview.toMillis && nextReview.toMillis() <= now.toMillis()
  })

  const reviewWords = allWords.filter((word) => {
    const state = wordStates[word.id]
    if (!state) {
      return false
    }
    const nextReview = state.nextReview
    return !nextReview || !nextReview.toMillis || nextReview.toMillis() > now.toMillis()
  })

  const combinedQueue = [...dueWords, ...limitedNewWords, ...reviewWords]
  const slicedQueue = combinedQueue.slice(0, queueLimit)
  console.log('[fetchSmartStudyQueue] Filtered result for userId:', userId, 'words:', slicedQueue.length)
  return slicedQueue
}

const nextBoxValue = (currentBox, result) => {
  if (result === 'again') return Math.max(1, currentBox - 1)
  if (result === 'hard') return currentBox
  return currentBox + 1 // easy
}

const computeNextReview = (box) => {
  const now = Timestamp.now()
  const minutes = Math.min(box * 15, 24 * 60)
  return Timestamp.fromMillis(now.toMillis() + minutes * 60 * 1000)
}

export const saveStudyResult = async (userId, wordId, result) => {
  if (!userId || !wordId) {
    throw new Error('userId and wordId are required.')
  }
  if (!['again', 'hard', 'easy'].includes(result)) {
    throw new Error('Invalid study result.')
  }

  const docRef = doc(db, 'users', userId, 'study_states', wordId)
  const docSnap = await getDoc(docRef)
  const currentData = docSnap.exists() ? docSnap.data() : {}
  const currentBox = currentData.box ?? 1
  const currentStreak = currentData.streak ?? 0

  let nextBox = currentBox
  let nextStreak = currentStreak

  if (result === 'easy') {
    nextStreak = currentStreak + 1
    if (nextStreak >= 3 && currentBox === 3) {
      nextBox = 4
      nextStreak = 0
    } else if (currentBox < 3) {
      nextBox = currentBox + 1
    } else {
      nextBox = 3
    }
  } else {
    nextStreak = 0
    if (result === 'again') {
      nextBox = 1
    } else {
      nextBox = Math.max(1, currentBox - 1)
    }
  }

  await setDoc(
    docRef,
    {
      lastReviewed: serverTimestamp(),
      result,
      box: nextBox,
      streak: nextStreak,
      nextReview: computeNextReview(nextBox),
    },
    { merge: true },
  )
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
    const box = data.box ?? 1
    if (box > 1) {
      wordsLearned += 1
      masteryCount += 1
    }

    if (box >= 4) {
      masteredWords += 1
    }

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
    const box = data.box ?? 1
    if (box > 1) {
      totalWordsLearned += 1
    }
  })

  return { totalWordsLearned }
}

export const generateTest = async (userId, listId, classId = null, limit = 50) => {
  if (!userId || !listId) {
    throw new Error('userId and listId are required.')
  }

  // Fetch all words from the list (no filtering for "only studied words")
  const allWords = await fetchAllWords(listId)

  if (allWords.length === 0) {
    return []
  }

  let optionsCount = 4
  if (classId) {
    const classSnap = await getDoc(doc(db, 'classes', classId))
    if (classSnap.exists()) {
      const classData = classSnap.data() || {}
      const assignment = classData.assignments?.[listId]
      if (assignment?.testOptionsCount) {
        optionsCount = assignment.testOptionsCount
      }
    }
  }

  const studyStatesRef = collection(db, 'users', userId, 'study_states')
  const studyStatesSnap = await getDocs(studyStatesRef)
  const wordStates = {}
  studyStatesSnap.docs.forEach((docSnap) => {
    wordStates[docSnap.id] = docSnap.data()
  })

  const now = Timestamp.now()

  // Priority 1: Due Review Words (Box 1)
  const dueReviewWords = allWords.filter((word) => {
    const state = wordStates[word.id]
    if (!state || state.box !== 1) return false
    const nextReview = state.nextReview
    return nextReview && nextReview.toMillis && nextReview.toMillis() < now.toMillis()
  })

  // Priority 2: "Glass Ceiling" Words (Box 3)
  const glassCeilingWords = allWords.filter((word) => {
    const state = wordStates[word.id]
    return state && state.box === 3
  })

  // Priority 3: New/Unseen Words
  const newWords = allWords.filter((word) => !wordStates[word.id])

  // Combine and prioritize
  const selected = []
  selected.push(...dueReviewWords.slice(0, limit))
  const remaining = limit - selected.length
  if (remaining > 0) {
    selected.push(...glassCeilingWords.slice(0, remaining))
  }
  const finalRemaining = limit - selected.length
  if (finalRemaining > 0) {
    selected.push(...newWords.slice(0, finalRemaining))
  }

  // Shuffle and limit
  const shuffled = shuffleArray(selected).slice(0, limit)

  // Generate options for each word
  const testWordsWithOptions = shuffled.map((word) => {
    const otherWords = allWords.filter((w) => w.id !== word.id)
    const desiredDistractors = Math.min(Math.max(1, optionsCount - 1), Math.max(otherWords.length, 0))

    const targetPOS = normalizePOS(word.partOfSpeech || word.pos || word.part_of_speech)
    const samePOSPool = targetPOS
      ? otherWords.filter(
          (candidate) => normalizePOS(candidate.partOfSpeech || candidate.pos || candidate.part_of_speech) === targetPOS,
        )
      : []

    const distractors = []
    const takeFromPool = (pool) => {
      for (const candidate of pool) {
        if (distractors.length >= desiredDistractors) break
        distractors.push(candidate)
      }
    }

    takeFromPool(shuffleArray(samePOSPool))

    if (distractors.length < desiredDistractors) {
      const remainingPool = shuffleArray(
        otherWords.filter((candidate) => !distractors.some((existing) => existing.id === candidate.id)),
      )
      takeFromPool(remainingPool)
    }

    const options = shuffleArray([
      { wordId: word.id, definition: word.definition, isCorrect: true },
      ...distractors.slice(0, desiredDistractors).map((w) => ({
        wordId: w.id,
        definition: w.definition,
        isCorrect: false,
      })),
    ])

    return {
      ...word,
      options,
    }
  })

  return testWordsWithOptions
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

export const submitTestAttempt = async (userId, testId, answers, totalQuestions = 0, classId = null) => {
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

  const box4PlusWords = answeredWords.filter((answer) => {
    const wordState = userWordStates[answer.wordId]
    return wordState && wordState.box >= 4
  })
  const retention =
    box4PlusWords.length > 0
      ? box4PlusWords.filter((answer) => answer.isCorrect).length / box4PlusWords.length
      : 1.0

  const batchUpdates = []
  // Score based on answered questions only
  const score = answeredWords.filter((answer) => answer.isCorrect).length / answeredWords.length

  // Only process words that were answered (ignore unanswered/skipped words)
  for (const answer of answeredWords) {
    const wordState = userWordStates[answer.wordId]
    const currentBox = wordState?.box ?? 1

    if (answer.isCorrect) {
      // IF Correct:
      //   IF box was Unseen or < 3: Promote directly to Box 4 (Instant Mastery)
      //   IF box >= 3: Promote to Box 5
      let nextBox = 4
      if (currentBox >= 3) {
        nextBox = 5
      }

      batchUpdates.push(
        setDoc(
          doc(db, 'users', userId, 'study_states', answer.wordId),
          {
            box: nextBox,
            streak: 0,
            lastReviewed: serverTimestamp(),
            nextReview: computeNextReview(nextBox),
          },
          { merge: true },
        ),
      )
    } else {
      // IF Wrong: Demote to Box 1
      batchUpdates.push(
        setDoc(
          doc(db, 'users', userId, 'study_states', answer.wordId),
          {
            box: 1,
            streak: 0,
            lastReviewed: serverTimestamp(),
            nextReview: computeNextReview(1),
          },
          { merge: true },
        ),
      )
    }
  }

  await Promise.all(batchUpdates)

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
    score: Math.round(score * 100),
    graded: true,
    answers: answeredWords,
    skipped: skippedCount,
    totalQuestions,
    credibility,
    retention,
    submittedAt: serverTimestamp(),
  }

  // Add classId and teacherId if provided (for new attempts)
  if (classId) {
    attemptData.classId = classId
  }
  if (teacherId) {
    attemptData.teacherId = teacherId
  }

  const attemptRef = await addDoc(collection(db, 'attempts'), attemptData)

  await updateDoc(userRef, {
    stats: {
      ...currentStats,
      credibility,
      retention,
    },
  })

  return { id: attemptRef.id, ...attemptData }
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
  const assignedListIds = classData.assignedLists || []

  if (assignedListIds.length === 0) {
    return []
  }

  // Query all attempts and filter by listId extracted from testId
  const attemptsRef = collection(db, 'attempts')
  const attemptsQuery = query(attemptsRef, orderBy('submittedAt', 'desc'))
  const attemptsSnap = await getDocs(attemptsQuery)

  const attempts = []
  for (const attemptDoc of attemptsSnap.docs) {
    const attemptData = attemptDoc.data()
    const testId = attemptData.testId || ''

    // Extract listId from testId format: test_${listId}_${timestamp}
    const testIdMatch = testId.match(/^test_([^_]+)_/)
    if (!testIdMatch) continue

    const listId = testIdMatch[1]
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
    const assignedListIds = klass.assignedLists || Object.keys(klass.assignments || {})
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

    // Extract listId from testId format: test_{listId}_{timestamp}
    const testIdMatch = testId.match(/^test_([^_]+)_/)
    if (!testIdMatch) continue

    const listId = testIdMatch[1]
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
    const assignedListIds = klass.assignedLists || Object.keys(klass.assignments || {})

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

  // Build query - start with teacherId (single query, no batching!)
  let attemptsQuery = query(
    collection(db, 'attempts'),
    where('teacherId', '==', teacherId),
    orderBy('submittedAt', 'desc')
  )

  // Apply class filter at query level
  if (filterClassIds.length === 1) {
    attemptsQuery = query(attemptsQuery, where('classId', '==', filterClassIds[0]))
  } else if (filterClassIds.length > 1 && filterClassIds.length <= 10) {
    attemptsQuery = query(attemptsQuery, where('classId', 'in', filterClassIds))
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
    const testIdMatch = testId.match(/^test_([^_]+)_/)

    if (!testIdMatch) continue

    const listId = testIdMatch[1]
    const studentId = attemptData.studentId

    // Apply Name filter (post-processing)
    if (filterStudentIds.length > 0 && !filterStudentIds.includes(studentId)) {
      continue
    }

    // Apply List filter (post-processing)
    if (filterListIds.length > 0 && !filterListIds.includes(listId)) {
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
      answers: [], // Lazy load on demand
      studentId: studentId,
      listId: listId,
      testId: testId,
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
    const testIdMatch = testId.match(/^test_([^_]+)_/)
    const listId = testIdMatch ? testIdMatch[1] : null
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
                const assignedLists = classData.assignedLists || Object.keys(classData.assignments || {})
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
  // Remove orderBy to avoid index requirement - we'll sort client-side
  const attemptsQuery = query(
    attemptsRef,
    where('studentId', '==', uid),
  )

  try {
    const snapshot = await getDocs(attemptsQuery)
    const attempts = []
    
    // Get user's enrolled classes for class name lookup
    const userSnap = await getDoc(doc(db, 'users', uid))
    const userData = userSnap.exists() ? userSnap.data() : {}
    const enrolledClasses = userData.enrolledClasses || {}
    
    // Create class lookup map
    const classLookup = {}
    for (const [classId, classInfo] of Object.entries(enrolledClasses)) {
      try {
        const classSnap = await getDoc(doc(db, 'classes', classId))
        if (classSnap.exists()) {
          classLookup[classId] = {
            name: classSnap.data().name || classInfo.name || 'Unknown Class',
            id: classId,
          }
        }
      } catch (err) {
        console.error(`Error fetching class ${classId}:`, err)
      }
    }
    
    for (const docSnap of snapshot.docs) {
      const attemptData = docSnap.data()
      const testId = attemptData.testId || ''
      
      // Extract listId from testId format: test_{listId}_{timestamp}
      const testIdMatch = testId.match(/^test_([^_]+)_/)
      const listId = testIdMatch ? testIdMatch[1] : null
      
      let listTitle = 'Vocabulary Test'
      let className = 'Unknown Class'
      let classId = null
      
      // Fetch list title
      if (listId) {
        try {
          const listSnap = await getDoc(doc(db, 'lists', listId))
          if (listSnap.exists()) {
            listTitle = listSnap.data().title || 'Vocabulary Test'
          }
        } catch (err) {
          console.error(`Error fetching list ${listId}:`, err)
        }
        
        // Find which class this list belongs to
        for (const [cid, classInfo] of Object.entries(classLookup)) {
          try {
            const classSnap = await getDoc(doc(db, 'classes', cid))
            if (classSnap.exists()) {
              const classData = classSnap.data()
              const assignedListIds = classData.assignedLists || []
              if (assignedListIds.includes(listId)) {
                className = classInfo.name
                classId = cid
                break
              }
            }
          } catch (err) {
            console.error(`Error checking class ${cid}:`, err)
          }
        }
      }
      
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
    
    // Sort client-side by submittedAt (descending - most recent first)
    attempts.sort((a, b) => {
      // Handle Firestore Timestamp objects
      const getTimestamp = (attempt) => {
        if (attempt.submittedAt?.toMillis) {
          return attempt.submittedAt.toMillis()
        }
        if (attempt.submittedAt?.toDate) {
          return attempt.submittedAt.toDate().getTime()
        }
        if (attempt.submittedAt?.seconds) {
          return attempt.submittedAt.seconds * 1000
        }
        if (attempt.date instanceof Date) {
          return attempt.date.getTime()
        }
        return 0
      }
      
      const timeA = getTimestamp(a)
      const timeB = getTimestamp(b)
      return timeB - timeA // Descending order
    })
    
    return attempts
  } catch (err) {
    console.error('Error fetching user attempts:', err)
    return []
  }
}
