/**
 * AP Scoring Service
 * Handles test submission (via Cloud Function) and result retrieval
 *
 * Scoring is done server-side in the submitTest Cloud Function.
 * Students never see answer keys or scoring logic.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { db } from '../../firebase'
import { COLLECTIONS } from '../utils/apTypes'

/**
 * Submit a completed test via Cloud Function (server-side scoring)
 * @param {string} sessionId - Session ID
 * @param {Object|null} frqData - FRQ submission data { frqSubmissionType, frqUploadedFiles }
 * @returns {Promise<string>} Result document ID
 */
export async function createTestResult(sessionId, frqData = null) {
  const functions = getFunctions()
  const submitTest = httpsCallable(functions, 'submitTest')
  const response = await submitTest({ sessionId, frqData })
  return response.data.resultId
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
