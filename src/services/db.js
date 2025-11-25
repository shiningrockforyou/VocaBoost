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

  const [userSnap, studyStatesSnap, latestTestSnap] = await Promise.all([
    getDoc(userRef),
    getDocs(studyStatesRef),
    getDocs(
      query(
        attemptsRef,
        where('studentId', '==', userId),
        orderBy('submittedAt', 'desc'),
        limit(1),
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

  const latestTestDoc = latestTestSnap.docs[0]
  const latestTest = latestTestDoc ? { id: latestTestDoc.id, ...latestTestDoc.data() } : null

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

export const submitTestAttempt = async (userId, testId, answers, totalQuestions = 0) => {
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
