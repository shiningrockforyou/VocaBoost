import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS } from '../utils/apTypes'
import { logError } from '../utils/logError'
import { getStimuliByIds } from './apStimuliService'

/**
 * Fetch tests available to current user
 * Includes both assigned tests and public self-practice tests
 * @param {string} userId - Current user ID
 * @param {string} role - User role ('student' or 'teacher')
 * @returns {Promise<Array>} Array of test objects with assignment info
 */
export async function getAvailableTests(userId, role) {
  const results = []

  try {
    // 1. Get public tests (available to everyone)
    const publicTestsQuery = query(
      collection(db, COLLECTIONS.TESTS),
      where('isPublished', '==', true)
    )
    const publicTestsSnap = await getDocs(publicTestsQuery)

    publicTestsSnap.forEach((doc) => {
      results.push({
        id: doc.id,
        ...doc.data(),
        assignment: null,
        attemptCount: 0,
      })
    })

    // 2. Get assigned tests for this user
    const assignmentsQuery = query(
      collection(db, COLLECTIONS.ASSIGNMENTS),
      where('studentIds', 'array-contains', userId)
    )
    const assignmentsSnap = await getDocs(assignmentsQuery)

    for (const assignmentDoc of assignmentsSnap.docs) {
      const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() }

      // Get the test for this assignment
      const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, assignment.testId))
      if (testDoc.exists()) {
        const testData = { id: testDoc.id, ...testDoc.data() }

        // Check if this test is already in results (from public tests)
        const existingIndex = results.findIndex(r => r.id === testData.id)
        if (existingIndex >= 0) {
          // Update with assignment info
          results[existingIndex].assignment = assignment
        } else {
          // Add new test with assignment
          results.push({
            test: testData,
            assignment,
            attemptCount: 0,
          })
        }
      }
    }

    // 3. Get attempt counts for each test
    for (const item of results) {
      const testId = item.test?.id || item.id
      const attemptsQuery = query(
        collection(db, COLLECTIONS.TEST_RESULTS),
        where('testId', '==', testId),
        where('userId', '==', userId)
      )
      const attemptsSnap = await getDocs(attemptsQuery)
      item.attemptCount = attemptsSnap.size
    }

    return results
  } catch (error) {
    logError('apTestService.getAvailableTests', { userId }, error)
    throw error
  }
}

/**
 * Fetch full test with all questions for a test session (teacher view — includes answer keys)
 * @param {string} testId - Test document ID
 * @returns {Promise<Object>} Test object with questions including correctAnswers
 */
export async function getTestWithQuestions(testId) {
  try {
    // Get test document
    const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
    if (!testDoc.exists()) {
      throw new Error('Test not found')
    }
    const test = { id: testDoc.id, ...testDoc.data() }

    // Get all questions for this test
    const questionsQuery = query(
      collection(db, COLLECTIONS.QUESTIONS),
      where('testId', '==', testId)
    )
    const questionsSnap = await getDocs(questionsQuery)

    const questionsMap = {}
    questionsSnap.forEach((doc) => {
      questionsMap[doc.id] = { id: doc.id, ...doc.data() }
    })

    // Fetch answer keys from ap_answer_keys (teacher-only collection)
    // Merge correctAnswers back into question objects for teacher views
    const questionIds = Object.keys(questionsMap)
    if (questionIds.length > 0) {
      const answerKeyPromises = questionIds.map(qId =>
        getDoc(doc(db, COLLECTIONS.ANSWER_KEYS, qId))
      )
      const answerKeySnaps = await Promise.all(answerKeyPromises)

      answerKeySnaps.forEach((snap) => {
        if (snap.exists() && questionsMap[snap.id]) {
          const keyData = snap.data()
          questionsMap[snap.id].correctAnswers = keyData.correctAnswers || []
          if (keyData.explanation) {
            questionsMap[snap.id].explanation = keyData.explanation
          }
        }
      })
    }

    // Resolve stimulus references for questions that have stimulusId but no inline stimulus
    const stimulusIds = Object.values(questionsMap)
      .filter((q) => q.stimulusId && !q.stimulus)
      .map((q) => q.stimulusId)

    if (stimulusIds.length > 0) {
      const stimuli = await getStimuliByIds(stimulusIds)

      // Attach resolved stimuli to questions
      for (const question of Object.values(questionsMap)) {
        if (question.stimulusId && !question.stimulus && stimuli[question.stimulusId]) {
          question.stimulus = stimuli[question.stimulusId]
        }
      }
    }

    // Attach questions to test
    test.questions = questionsMap

    return test
  } catch (error) {
    logError('apTestService.getTestWithQuestions', { testId }, error)
    throw error
  }
}

/**
 * Fetch test with questions for student test-taking (NO answer keys)
 * @param {string} testId - Test document ID
 * @returns {Promise<Object>} Test object with questions (correctAnswers stripped)
 */
export async function getTestForStudent(testId) {
  try {
    // Get test document
    const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
    if (!testDoc.exists()) {
      throw new Error('Test not found')
    }
    const test = { id: testDoc.id, ...testDoc.data() }

    // Get all questions for this test
    const questionsQuery = query(
      collection(db, COLLECTIONS.QUESTIONS),
      where('testId', '==', testId)
    )
    const questionsSnap = await getDocs(questionsQuery)

    const questionsMap = {}
    questionsSnap.forEach((docSnap) => {
      const data = docSnap.data()
      // Defense-in-depth: strip answer keys even though they should
      // already be moved to ap_answer_keys collection
      const { correctAnswers, correctAnswer, explanation, ...safeData } = data
      questionsMap[docSnap.id] = { id: docSnap.id, ...safeData }
    })

    // Resolve stimulus references
    const stimulusIds = Object.values(questionsMap)
      .filter((q) => q.stimulusId && !q.stimulus)
      .map((q) => q.stimulusId)

    if (stimulusIds.length > 0) {
      const stimuli = await getStimuliByIds(stimulusIds)

      for (const question of Object.values(questionsMap)) {
        if (question.stimulusId && !question.stimulus && stimuli[question.stimulusId]) {
          question.stimulus = stimuli[question.stimulusId]
        }
      }
    }

    test.questions = questionsMap
    return test
  } catch (error) {
    logError('apTestService.getTestForStudent', { testId }, error)
    throw error
  }
}

/**
 * Fetch test metadata only (no questions) for dashboard display
 * @param {string} testId - Test document ID
 * @returns {Promise<Object>} Test metadata
 */
export async function getTestMeta(testId) {
  try {
    const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
    if (!testDoc.exists()) {
      return null
    }
    return { id: testDoc.id, ...testDoc.data() }
  } catch (error) {
    logError('apTestService.getTestMeta', { testId }, error)
    throw error
  }
}

/**
 * Get assignment details for a student/test combination
 * @param {string} testId - Test ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Assignment or null
 */
export async function getAssignment(testId, userId) {
  try {
    const assignmentsQuery = query(
      collection(db, COLLECTIONS.ASSIGNMENTS),
      where('testId', '==', testId),
      where('studentIds', 'array-contains', userId)
    )
    const assignmentsSnap = await getDocs(assignmentsQuery)

    if (assignmentsSnap.empty) {
      return null
    }

    const doc = assignmentsSnap.docs[0]
    return { id: doc.id, ...doc.data() }
  } catch (error) {
    logError('apTestService.getAssignment', { testId, userId }, error)
    throw error
  }
}

/**
 * Get question by ID
 * @param {string} questionId - Question document ID
 * @returns {Promise<Object|null>} Question object or null
 */
export async function getQuestion(questionId) {
  try {
    const questionDoc = await getDoc(doc(db, COLLECTIONS.QUESTIONS, questionId))
    if (!questionDoc.exists()) {
      return null
    }
    return { id: questionDoc.id, ...questionDoc.data() }
  } catch (error) {
    logError('apTestService.getQuestion', { questionId }, error)
    throw error
  }
}

/**
 * Check if a user can access a test
 * Returns access info including assignment ID if applicable
 * @param {string} testId - Test ID to check access for
 * @param {string} userId - User ID checking access
 * @returns {Promise<{allowed: boolean, reason: string, assignmentId?: string}>}
 */
export async function canAccessTest(testId, userId) {
  try {
    // Check if test is published (publicly available)
    const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
    if (!testDoc.exists()) {
      return { allowed: false, reason: 'not_found' }
    }

    if (testDoc.data().isPublished) {
      return { allowed: true, reason: 'public' }
    }

    // Check if user is assigned to this test
    const assignment = await getAssignment(testId, userId)
    if (assignment) {
      return { allowed: true, reason: 'assigned', assignmentId: assignment.id }
    }

    return { allowed: false, reason: 'unauthorized' }
  } catch (error) {
    logError('apTestService.canAccessTest', { testId, userId }, error)
    return { allowed: false, reason: 'error' }
  }
}
