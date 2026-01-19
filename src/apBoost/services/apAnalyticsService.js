/**
 * AP Analytics Service
 * Handles analytics aggregation and reporting
 */
import { db } from '../../firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { COLLECTIONS } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * Get aggregated analytics data for a test
 * @param {string} testId - Test ID
 * @param {Object} filters - { classIds: string[], studentIds: string[] }
 * @returns {Promise<Object>} Analytics data
 */
export async function getTestAnalytics(testId, filters = {}) {
  try {
    // Build query for test results
    let resultsQuery = query(
      collection(db, COLLECTIONS.TEST_RESULTS),
      where('testId', '==', testId)
    )

    const resultsSnap = await getDocs(resultsQuery)
    let results = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Apply filters
    if (filters.classIds && filters.classIds.length > 0) {
      results = results.filter(r => filters.classIds.includes(r.classId))
    }

    if (filters.studentIds && filters.studentIds.length > 0) {
      results = results.filter(r => filters.studentIds.includes(r.userId))
    }

    // Get test with questions
    const testDoc = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
    const test = testDoc.exists() ? { id: testDoc.id, ...testDoc.data() } : null

    // Get questions
    const questionsQuery = query(
      collection(db, COLLECTIONS.QUESTIONS),
      where('testId', '==', testId)
    )
    const questionsSnap = await getDocs(questionsQuery)
    const questions = {}
    questionsSnap.forEach(doc => {
      questions[doc.id] = { id: doc.id, ...doc.data() }
    })

    // Calculate MCQ performance
    const mcqPerformance = calculateQuestionPerformance(results, questions)

    // Calculate FRQ performance
    const frqPerformance = calculateFRQPerformance(results, questions)

    // Calculate summary stats
    const summary = calculateSummaryStats(results)

    return {
      test,
      questions,
      results,
      mcqPerformance,
      frqPerformance,
      summary,
      totalStudents: results.length,
    }
  } catch (error) {
    logError('apAnalyticsService.getTestAnalytics', { testId, filters }, error)
    throw error
  }
}

/**
 * Calculate question performance across all students
 * @param {Array} results - Test results
 * @param {Object} questions - Questions map
 * @returns {Object} { [questionId]: { correct, total, percentage } }
 */
export function calculateQuestionPerformance(results, questions) {
  const performance = {}

  // Initialize performance for each MCQ question
  for (const [questionId, question] of Object.entries(questions)) {
    if (question.questionType === 'mcq' || !question.questionType) {
      performance[questionId] = {
        questionId,
        questionNumber: question.questionNumber || 0,
        correct: 0,
        total: 0,
        percentage: 0,
      }
    }
  }

  // Aggregate results
  for (const result of results) {
    const mcqResults = result.mcqResults || []
    for (const mcqResult of mcqResults) {
      const qId = mcqResult.questionId
      if (performance[qId]) {
        performance[qId].total++
        if (mcqResult.correct) {
          performance[qId].correct++
        }
      }
    }
  }

  // Calculate percentages
  for (const qId of Object.keys(performance)) {
    const p = performance[qId]
    p.percentage = p.total > 0 ? Math.round((p.correct / p.total) * 100) : 0
  }

  return performance
}

/**
 * Calculate response distribution for a single MCQ question
 * @param {Array} results - Test results
 * @param {string} questionId - Question ID
 * @returns {Object} { [choice]: { count, percentage } }
 */
export function calculateResponseDistribution(results, questionId) {
  const distribution = {}
  let total = 0

  // Count each response
  for (const result of results) {
    const mcqResults = result.mcqResults || []
    const mcqResult = mcqResults.find(r => r.questionId === questionId)

    if (mcqResult) {
      total++
      // Canonicalize array answers for stable bucketing (e.g., "AC" not "[object Object]")
      const answer = Array.isArray(mcqResult.studentAnswer)
        ? mcqResult.studentAnswer.slice().sort().join('')
        : mcqResult.studentAnswer || 'No Answer'
      if (!distribution[answer]) {
        distribution[answer] = { count: 0, percentage: 0 }
      }
      distribution[answer].count++
    }
  }

  // Calculate percentages
  for (const answer of Object.keys(distribution)) {
    distribution[answer].percentage = total > 0
      ? Math.round((distribution[answer].count / total) * 100)
      : 0
  }

  return {
    distribution,
    total,
  }
}

/**
 * Calculate FRQ sub-question performance
 * @param {Array} results - Test results
 * @param {Object} questions - Questions map
 * @returns {Object} { [questionId]: { overall, subQuestions: { [label]: { points, maxPoints, percentage } } } }
 */
export function calculateFRQPerformance(results, questions) {
  const performance = {}

  // Find FRQ questions
  for (const [questionId, question] of Object.entries(questions)) {
    if (question.questionType === 'frq' || question.questionType === 'saq' || question.questionType === 'dbq') {
      performance[questionId] = {
        questionId,
        questionText: question.questionText,
        totalPoints: 0,
        totalMaxPoints: 0,
        percentage: 0,
        subQuestions: {},
        studentCount: 0,
      }

      // Initialize sub-questions
      if (question.subQuestions) {
        for (const sq of question.subQuestions) {
          performance[questionId].subQuestions[sq.label] = {
            label: sq.label,
            points: 0,
            maxPoints: sq.points || 3,
            percentage: 0,
            count: 0,
          }
        }
      }
    }
  }

  // Aggregate FRQ grades from results
  for (const result of results) {
    const frqGrades = result.frqGrades || {}

    for (const [questionId, grade] of Object.entries(frqGrades)) {
      if (!performance[questionId]) continue

      performance[questionId].studentCount++

      // Sum sub-scores
      const subScores = grade.subScores || {}
      for (const [label, score] of Object.entries(subScores)) {
        if (performance[questionId].subQuestions[label]) {
          performance[questionId].subQuestions[label].points += score
          performance[questionId].subQuestions[label].count++
        }
      }
    }
  }

  // Calculate percentages
  for (const questionId of Object.keys(performance)) {
    const q = performance[questionId]
    let totalPoints = 0
    let totalMaxPoints = 0

    for (const label of Object.keys(q.subQuestions)) {
      const sq = q.subQuestions[label]
      if (sq.count > 0) {
        sq.percentage = Math.round((sq.points / (sq.maxPoints * sq.count)) * 100)
        totalPoints += sq.points
        totalMaxPoints += sq.maxPoints * sq.count
      }
    }

    q.totalPoints = totalPoints
    q.totalMaxPoints = totalMaxPoints
    q.percentage = totalMaxPoints > 0 ? Math.round((totalPoints / totalMaxPoints) * 100) : 0
  }

  return performance
}

/**
 * Calculate summary statistics
 * @param {Array} results - Test results
 * @returns {Object} Summary stats
 */
export function calculateSummaryStats(results) {
  if (results.length === 0) {
    return {
      averageScore: 0,
      averagePercentage: 0,
      highestScore: 0,
      lowestScore: 0,
      apScoreDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    }
  }

  const scores = results.map(r => r.score || 0)
  const percentages = results.map(r => r.percentage || 0)
  const apScores = results.map(r => r.apScore || 1)

  const apScoreDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const ap of apScores) {
    apScoreDistribution[ap]++
  }

  return {
    averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    averagePercentage: Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length),
    highestScore: Math.max(...scores),
    lowestScore: Math.min(...scores),
    apScoreDistribution,
  }
}

/**
 * Get student results for a test with user info
 * @param {string} testId - Test ID
 * @param {Object} filters - { classIds: string[], studentIds: string[] }
 * @returns {Promise<Array>} Student results with user info
 */
export async function getStudentResults(testId, filters = {}) {
  try {
    // Get results
    const resultsQuery = query(
      collection(db, COLLECTIONS.TEST_RESULTS),
      where('testId', '==', testId)
    )
    const resultsSnap = await getDocs(resultsQuery)
    let results = resultsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    // Apply filters
    if (filters.classIds && filters.classIds.length > 0) {
      results = results.filter(r => filters.classIds.includes(r.classId))
    }

    if (filters.studentIds && filters.studentIds.length > 0) {
      results = results.filter(r => filters.studentIds.includes(r.userId))
    }

    // Get user info for each result
    const studentResults = []
    for (const result of results) {
      let studentName = 'Unknown Student'
      let studentEmail = ''

      if (result.userId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', result.userId))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            studentName = userData.displayName || userData.email || 'Student'
            studentEmail = userData.email || ''
          }
        } catch {
          // Ignore user fetch errors
        }
      }

      studentResults.push({
        ...result,
        studentName,
        studentEmail,
      })
    }

    // Sort by name
    studentResults.sort((a, b) => a.studentName.localeCompare(b.studentName))

    return studentResults
  } catch (error) {
    logError('apAnalyticsService.getStudentResults', { testId, filters }, error)
    throw error
  }
}

/**
 * Get classes for analytics filter
 * @param {string} teacherId - Teacher ID
 * @returns {Promise<Array>} Classes
 */
export async function getClassesForFilter(teacherId) {
  try {
    const classesQuery = query(
      collection(db, COLLECTIONS.CLASSES),
      where('teacherId', '==', teacherId)
    )
    const classesSnap = await getDocs(classesQuery)

    return classesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    logError('apAnalyticsService.getClassesForFilter', { teacherId }, error)
    throw error
  }
}

/**
 * Get students for analytics filter
 * @param {string[]} classIds - Class IDs to get students from
 * @returns {Promise<Array>} Students
 */
export async function getStudentsForFilter(classIds) {
  try {
    if (!classIds || classIds.length === 0) {
      return []
    }

    // Get students from each class
    const students = []
    const seenIds = new Set()

    for (const classId of classIds) {
      const classDoc = await getDoc(doc(db, COLLECTIONS.CLASSES, classId))
      if (classDoc.exists()) {
        const classData = classDoc.data()
        const studentIds = classData.studentIds || []

        for (const studentId of studentIds) {
          if (!seenIds.has(studentId)) {
            seenIds.add(studentId)

            // Get user info
            try {
              const userDoc = await getDoc(doc(db, 'users', studentId))
              if (userDoc.exists()) {
                const userData = userDoc.data()
                students.push({
                  id: studentId,
                  name: userData.displayName || userData.email || 'Student',
                  email: userData.email || '',
                })
              }
            } catch {
              // Ignore user fetch errors
            }
          }
        }
      }
    }

    // Sort by name
    students.sort((a, b) => a.name.localeCompare(b.name))

    return students
  } catch (error) {
    logError('apAnalyticsService.getStudentsForFilter', { classIds }, error)
    throw error
  }
}
