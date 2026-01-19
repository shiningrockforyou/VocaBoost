/**
 * AP Grading Service
 * Handles teacher grading of FRQ responses
 */
import { db } from '../../firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { COLLECTIONS, GRADING_STATUS, SECTION_TYPE } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * Build a flattened frqMultipliers map from test sections
 * @param {Array} sections - Test sections array
 * @returns {Object} Map of questionId -> multiplier
 */
function buildFrqMultipliersMap(sections) {
  const multipliers = {}
  for (const section of sections || []) {
    if (section.sectionType === SECTION_TYPE.FRQ || section.sectionType === SECTION_TYPE.MIXED) {
      if (section.frqMultipliers) {
        Object.assign(multipliers, section.frqMultipliers)
      }
    }
  }
  return multipliers
}

/**
 * Get all results pending grading for a teacher
 * @param {string} teacherId - Teacher's user ID
 * @param {Object} filters - Optional filters { testId, classId, status }
 * @returns {Promise<Array>} Array of results pending grading
 */
export async function getPendingGrades(teacherId, filters = {}) {
  try {
    const resultsRef = collection(db, COLLECTIONS.TEST_RESULTS)

    // Build query constraints
    let constraints = []

    // CRITICAL: Filter by teacherId first for teacher isolation
    // Only show results for this teacher's tests/assignments
    constraints.push(where('teacherId', '==', teacherId))

    // Filter by grading status (pending by default)
    if (filters.status) {
      constraints.push(where('gradingStatus', '==', filters.status))
    } else {
      // Default to pending grades
      constraints.push(where('gradingStatus', 'in', [GRADING_STATUS.PENDING, GRADING_STATUS.IN_PROGRESS]))
    }

    // Filter by test if specified
    if (filters.testId) {
      constraints.push(where('testId', '==', filters.testId))
    }

    // Filter by class if specified
    if (filters.classId) {
      constraints.push(where('classId', '==', filters.classId))
    }

    // Order by completion date
    constraints.push(orderBy('completedAt', 'desc'))

    const q = query(resultsRef, ...constraints)
    const snapshot = await getDocs(q)

    const results = []
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data()

      // Get student info
      let studentName = 'Unknown Student'
      if (data.studentId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', data.studentId))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            studentName = userData.displayName || userData.email || 'Student'
          }
        } catch {
          // Ignore user fetch errors
        }
      }

      // Get test info
      let testTitle = 'Practice Test'
      if (data.testId) {
        try {
          const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, data.testId))
          if (testDoc.exists()) {
            testTitle = testDoc.data().title || 'Practice Test'
          }
        } catch {
          // Ignore test fetch errors
        }
      }

      results.push({
        id: docSnap.id,
        ...data,
        studentName,
        testTitle,
      })
    }

    return results
  } catch (error) {
    logError('apGradingService.getPendingGrades', { teacherId, filters }, error)
    throw error
  }
}

/**
 * Get a single result for grading (with full question data)
 * @param {string} resultId - Result document ID
 * @returns {Promise<Object>} Result with questions and answers
 */
export async function getResultForGrading(resultId) {
  try {
    const resultRef = doc(db, COLLECTIONS.TEST_RESULTS, resultId)
    const resultSnap = await getDoc(resultRef)

    if (!resultSnap.exists()) {
      throw new Error('Result not found')
    }

    const resultData = { id: resultSnap.id, ...resultSnap.data() }

    // Get student info
    if (resultData.studentId) {
      const userDoc = await getDoc(doc(db, 'users', resultData.studentId))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        resultData.studentName = userData.displayName || userData.email || 'Student'
        resultData.studentEmail = userData.email
      }
    }

    // Get test with questions
    if (resultData.testId) {
      const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, resultData.testId))
      if (testDoc.exists()) {
        resultData.test = { id: testDoc.id, ...testDoc.data() }

        // Get FRQ questions
        const frqQuestions = {}
        if (resultData.frqAnswers) {
          for (const questionId of Object.keys(resultData.frqAnswers)) {
            const questionDoc = await getDoc(doc(db, COLLECTIONS.QUESTIONS, questionId))
            if (questionDoc.exists()) {
              frqQuestions[questionId] = { id: questionDoc.id, ...questionDoc.data() }
            }
          }
        }
        resultData.frqQuestions = frqQuestions
      }
    }

    return resultData
  } catch (error) {
    logError('apGradingService.getResultForGrading', { resultId }, error)
    throw error
  }
}

/**
 * Save grades for a result (draft or complete)
 * @param {string} resultId - Result document ID
 * @param {Object} grades - FRQ grades { [questionId]: { subScores: { a: 2, b: 3 }, comment: "..." } }
 * @param {string} status - Grading status (IN_PROGRESS or COMPLETE)
 * @param {string} teacherId - Teacher's user ID
 * @param {string|null} annotatedPdfUrl - URL to annotated feedback PDF (for handwritten)
 * @returns {Promise<void>}
 */
export async function saveGrade(resultId, grades, status, teacherId, annotatedPdfUrl = null) {
  try {
    const resultRef = doc(db, COLLECTIONS.TEST_RESULTS, resultId)

    const updateData = {
      frqGrades: grades,
      gradingStatus: status,
      gradedBy: teacherId,
      gradedAt: serverTimestamp(),
    }

    // Include annotated PDF URL if provided (with alias for API compatibility)
    if (annotatedPdfUrl) {
      updateData.annotatedPdfUrl = annotatedPdfUrl
      updateData.frqGradedPdfUrl = annotatedPdfUrl // Alias for spec compatibility
    }

    // If complete, calculate FRQ score and update totals
    if (status === GRADING_STATUS.COMPLETE) {
      // Get current result to access testId and scores
      const resultSnap = await getDoc(resultRef)
      if (resultSnap.exists()) {
        const resultData = resultSnap.data()

        // Fetch test to get frqMultipliers from sections
        let frqMultipliers = {}
        if (resultData.testId) {
          const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, resultData.testId))
          if (testDoc.exists()) {
            const test = testDoc.data()
            frqMultipliers = buildFrqMultipliersMap(test.sections)
          }
        }

        // Calculate FRQ score with multipliers
        const frqScore = calculateFRQScore(grades, frqMultipliers)
        updateData.frqScore = frqScore

        const mcqScore = resultData.mcqScore || 0
        const mcqMaxPoints = resultData.mcqMaxPoints || 0
        const frqMaxPoints = resultData.frqMaxPoints || 0

        // Update total score and percentage
        updateData.score = mcqScore + frqScore
        updateData.maxScore = mcqMaxPoints + frqMaxPoints
        updateData.percentage = updateData.maxScore > 0
          ? Math.round((updateData.score / updateData.maxScore) * 100)
          : 0

        // Recalculate AP score with FRQ
        updateData.apScore = calculateAPScore(updateData.percentage)
      }
    }

    await updateDoc(resultRef, updateData)
  } catch (error) {
    logError('apGradingService.saveGrade', { resultId, status, teacherId }, error)
    throw error
  }
}

/**
 * Calculate total FRQ score from sub-scores with optional multipliers
 * @param {Object} grades - FRQ grades object { [questionId]: { subScores: { a: 2, b: 3 }, comment: "..." } }
 * @param {Object} frqMultipliers - Optional multipliers by questionId { [questionId]: number }
 * @returns {number} Total FRQ points (weighted by multipliers)
 */
export function calculateFRQScore(grades, frqMultipliers = {}) {
  if (!grades) return 0

  let total = 0
  for (const [questionId, questionGrade] of Object.entries(grades)) {
    if (questionGrade.subScores) {
      // Get multiplier for this question (default to 1)
      const multiplier = frqMultipliers[questionId] || 1

      // Sum sub-scores and apply multiplier
      let questionTotal = 0
      for (const score of Object.values(questionGrade.subScores)) {
        questionTotal += Number(score) || 0
      }

      total += questionTotal * multiplier
    }
  }

  return total
}

/**
 * Calculate AP score (1-5) from percentage
 * @param {number} percentage - Overall percentage
 * @returns {number} AP score 1-5
 */
export function calculateAPScore(percentage) {
  if (percentage >= 80) return 5
  if (percentage >= 65) return 4
  if (percentage >= 50) return 3
  if (percentage >= 35) return 2
  return 1
}

/**
 * Get tests available for grading (tests with FRQ sections)
 * @returns {Promise<Array>} Array of tests
 */
export async function getTestsForGrading() {
  try {
    const testsRef = collection(db, COLLECTIONS.TESTS)
    const q = query(testsRef, where('hasFRQ', '==', true))
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    logError('apGradingService.getTestsForGrading', {}, error)
    throw error
  }
}

/**
 * Get classes for a teacher
 * @param {string} teacherId - Teacher's user ID
 * @returns {Promise<Array>} Array of classes
 */
export async function getTeacherClasses(teacherId) {
  try {
    const classesRef = collection(db, COLLECTIONS.CLASSES)
    const q = query(classesRef, where('teacherId', '==', teacherId))
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    logError('apGradingService.getTeacherClasses', { teacherId }, error)
    throw error
  }
}
