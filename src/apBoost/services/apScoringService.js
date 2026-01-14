import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS, GRADING_STATUS, SECTION_TYPE, DEFAULT_SCORE_RANGES } from '../utils/apTypes'
import { getTestWithQuestions } from './apTestService'
import { getSession, completeSession } from './apSessionService'

/**
 * Calculate MCQ score for a section
 * @param {Object} answers - Map of questionId -> answer
 * @param {Object} questions - Map of questionId -> question object
 * @param {Object} section - Section object with questionIds
 * @returns {Object} { correct, total, points }
 */
export function calculateMCQScore(answers, questions, section) {
  let correct = 0
  let total = 0

  for (const questionId of section.questionIds || []) {
    const question = questions[questionId]
    if (!question) continue

    total++
    const studentAnswer = answers[questionId]
    const correctAnswers = question.correctAnswers || []

    if (correctAnswers.includes(studentAnswer)) {
      correct++
    }
  }

  // Apply multiplier if present
  const multiplier = section.mcqMultiplier || 1
  const points = correct * multiplier

  return { correct, total, points }
}

/**
 * Convert percentage to AP score (1-5)
 * @param {number} percentage - Score percentage (0-100)
 * @param {Object} scoreRanges - Custom score ranges or use defaults
 * @returns {number} AP score 1-5
 */
export function calculateAPScore(percentage, scoreRanges = DEFAULT_SCORE_RANGES) {
  if (percentage >= scoreRanges.ap5.min) return 5
  if (percentage >= scoreRanges.ap4.min) return 4
  if (percentage >= scoreRanges.ap3.min) return 3
  if (percentage >= scoreRanges.ap2.min) return 2
  return 1
}

/**
 * Create test result document from completed session
 * @param {string} sessionId - Session ID
 * @param {Object|null} frqData - FRQ submission data { frqSubmissionType, frqUploadedFiles }
 * @returns {Promise<string>} Result document ID
 */
export async function createTestResult(sessionId, frqData = null) {
  try {
    // Get session
    const session = await getSession(sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    // Get test with questions
    const test = await getTestWithQuestions(session.testId)
    if (!test) {
      throw new Error('Test not found')
    }

    const answers = session.answers || {}
    const sectionScores = {}
    let totalScore = 0
    let maxScore = 0
    const mcqResults = []

    // Calculate scores for each section
    for (let i = 0; i < test.sections.length; i++) {
      const section = test.sections[i]

      if (section.sectionType === SECTION_TYPE.MCQ) {
        const result = calculateMCQScore(answers, test.questions, section)
        sectionScores[i] = result
        totalScore += result.points
        maxScore += result.total * (section.mcqMultiplier || 1)

        // Build MCQ results for report card
        for (const questionId of section.questionIds || []) {
          const question = test.questions[questionId]
          if (!question) continue

          const studentAnswer = answers[questionId] || null
          const correctAnswers = question.correctAnswers || []
          const isCorrect = correctAnswers.includes(studentAnswer)

          mcqResults.push({
            questionId,
            studentAnswer,
            correctAnswer: correctAnswers[0] || 'N/A',
            correct: isCorrect,
          })
        }
      }
      // FRQ scoring would be handled separately after teacher grading
    }

    // Calculate percentage and AP score
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
    const apScore = calculateAPScore(percentage, test.scoreRanges)

    // Determine grading status
    const hasFRQ = test.sections.some(s => s.sectionType === SECTION_TYPE.FRQ || s.sectionType === SECTION_TYPE.MIXED)
    const gradingStatus = hasFRQ ? GRADING_STATUS.PENDING : GRADING_STATUS.NOT_NEEDED

    // Create result document
    const resultId = `${session.userId}_${session.testId}_${session.attemptNumber}`
    const resultData = {
      userId: session.userId,
      testId: session.testId,
      classId: session.classId || null,
      assignmentId: session.assignmentId || null,
      attemptNumber: session.attemptNumber,
      isFirstAttempt: session.attemptNumber === 1,
      sessionId: session.id,
      answers,
      score: totalScore,
      maxScore,
      percentage,
      apScore,
      sectionScores,
      mcqResults,
      // FRQ submission data
      frqSubmissionType: frqData?.frqSubmissionType || null,
      frqUploadedFiles: frqData?.frqUploadedFiles || null,
      frqAnswers: session.answers || {}, // Typed FRQ answers from session
      frqMaxPoints: 0, // Will be calculated from FRQ section questions
      frqScore: null, // Set after grading
      annotatedPdfUrl: null, // Teacher's annotated PDF
      frqGrades: null,
      gradingStatus,
      startedAt: session.startedAt,
      completedAt: serverTimestamp(),
      gradedAt: null,
    }

    await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, resultId), resultData)

    // Mark session as completed
    await completeSession(sessionId)

    return resultId
  } catch (error) {
    console.error('Error creating test result:', error)
    throw error
  }
}

/**
 * Get test result by ID
 * @param {string} resultId - Result document ID
 * @returns {Promise<Object|null>} Result object or null
 */
export async function getTestResult(resultId) {
  try {
    const resultDoc = await getDoc(doc(db, COLLECTIONS.TEST_RESULTS, resultId))
    if (!resultDoc.exists()) {
      return null
    }
    return { id: resultDoc.id, ...resultDoc.data() }
  } catch (error) {
    console.error('Error getting test result:', error)
    throw error
  }
}

/**
 * Get all results for a user/test combination
 * @param {string} testId - Test ID
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of result objects
 */
export async function getTestResults(testId, userId) {
  try {
    const resultsQuery = query(
      collection(db, COLLECTIONS.TEST_RESULTS),
      where('testId', '==', testId),
      where('userId', '==', userId)
    )
    const resultsSnap = await getDocs(resultsQuery)

    const results = []
    resultsSnap.forEach(doc => {
      results.push({ id: doc.id, ...doc.data() })
    })

    return results.sort((a, b) => a.attemptNumber - b.attemptNumber)
  } catch (error) {
    console.error('Error getting test results:', error)
    throw error
  }
}
