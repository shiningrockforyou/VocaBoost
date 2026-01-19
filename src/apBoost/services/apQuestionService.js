/**
 * AP Question Service
 * Handles question bank operations: search, create, update, manage
 */
import { db } from '../../firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { COLLECTIONS, QUESTION_TYPE, DIFFICULTY } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * Search questions with filters
 * @param {Object} filters - Search filters
 * @param {string} filters.subject - AP subject
 * @param {string} filters.questionType - Question type (MCQ, FRQ, etc.)
 * @param {string} filters.difficulty - Difficulty level
 * @param {string} filters.domain - Question domain/unit
 * @param {string} filters.search - Search text
 * @param {string} filters.createdBy - Filter by creator
 * @param {string} filters.tag - Filter by tag (array-contains)
 * @param {number} filters.limit - Max results
 * @returns {Promise<Array>} Array of question objects
 */
export async function searchQuestions(filters = {}) {
  try {
    const questionsRef = collection(db, COLLECTIONS.QUESTIONS)
    let constraints = []

    // Filter by subject
    if (filters.subject) {
      constraints.push(where('subject', '==', filters.subject))
    }

    // Filter by question type
    if (filters.questionType) {
      constraints.push(where('questionType', '==', filters.questionType))
    }

    // Filter by difficulty
    if (filters.difficulty) {
      constraints.push(where('difficulty', '==', filters.difficulty))
    }

    // Filter by domain
    if (filters.domain) {
      constraints.push(where('questionDomain', '==', filters.domain))
    }

    // Filter by creator
    if (filters.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy))
    }

    // Filter by tag (uses array-contains for tags array)
    if (filters.tag) {
      constraints.push(where('tags', 'array-contains', filters.tag))
    }

    // Order by creation date
    constraints.push(orderBy('createdAt', 'desc'))

    // Limit results
    if (filters.limit) {
      constraints.push(limit(filters.limit))
    } else {
      constraints.push(limit(100))
    }

    const q = query(questionsRef, ...constraints)
    const snapshot = await getDocs(q)

    let results = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Client-side text search (Firestore doesn't support full-text search)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      results = results.filter(q =>
        q.questionText?.toLowerCase().includes(searchLower) ||
        q.questionDomain?.toLowerCase().includes(searchLower) ||
        q.questionTopic?.toLowerCase().includes(searchLower)
      )
    }

    return results
  } catch (error) {
    logError('apQuestionService.searchQuestions', { filters }, error)
    throw error
  }
}

/**
 * Get a single question by ID
 * @param {string} questionId - Question document ID
 * @returns {Promise<Object|null>} Question object or null
 */
export async function getQuestionById(questionId) {
  try {
    const questionRef = doc(db, COLLECTIONS.QUESTIONS, questionId)
    const questionSnap = await getDoc(questionRef)

    if (!questionSnap.exists()) {
      return null
    }

    return {
      id: questionSnap.id,
      ...questionSnap.data()
    }
  } catch (error) {
    logError('apQuestionService.getQuestionById', { questionId }, error)
    throw error
  }
}

/**
 * Get multiple questions by IDs
 * @param {Array<string>} questionIds - Array of question IDs
 * @returns {Promise<Array>} Array of question objects
 */
export async function getQuestionsByIds(questionIds) {
  try {
    if (!questionIds || questionIds.length === 0) {
      return []
    }

    const questions = []
    for (const id of questionIds) {
      const question = await getQuestionById(id)
      if (question) {
        questions.push(question)
      }
    }

    return questions
  } catch (error) {
    logError('apQuestionService.getQuestionsByIds', { questionIds }, error)
    throw error
  }
}

/**
 * Create a new question
 * @param {Object} questionData - Question data
 * @returns {Promise<string>} Created question ID
 */
export async function createQuestion(questionData) {
  try {
    const questionsRef = collection(db, COLLECTIONS.QUESTIONS)

    const newQuestion = {
      questionText: questionData.questionText || '',
      questionType: questionData.questionType || QUESTION_TYPE.MCQ,
      format: questionData.format || 'VERTICAL',
      subject: questionData.subject || '',
      questionDomain: questionData.questionDomain || '',
      questionTopic: questionData.questionTopic || '',
      difficulty: questionData.difficulty || DIFFICULTY.MEDIUM,
      // MCQ choices
      choiceA: questionData.choiceA || null,
      choiceB: questionData.choiceB || null,
      choiceC: questionData.choiceC || null,
      choiceD: questionData.choiceD || null,
      choiceE: questionData.choiceE || null,
      choiceCount: questionData.choiceCount || 4,
      correctAnswers: questionData.correctAnswers || [],
      // FRQ sub-questions
      subQuestions: questionData.subQuestions || null,
      // Stimulus
      stimulusId: questionData.stimulusId || null,
      stimulus: questionData.stimulus || null,
      // Explanation
      explanation: questionData.explanation || '',
      // Scoring
      partialCredit: questionData.partialCredit || false,
      // Grading criteria (for FRQ/SAQ/DBQ)
      rubric: questionData.rubric || null,
      // Tags for organization/filtering
      tags: questionData.tags || [],
      // Metadata
      createdBy: questionData.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(questionsRef, newQuestion)
    return docRef.id
  } catch (error) {
    logError('apQuestionService.createQuestion', { questionData }, error)
    throw error
  }
}

/**
 * Update an existing question
 * @param {string} questionId - Question document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateQuestion(questionId, updates) {
  try {
    const questionRef = doc(db, COLLECTIONS.QUESTIONS, questionId)

    await updateDoc(questionRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apQuestionService.updateQuestion', { questionId, updates }, error)
    throw error
  }
}

/**
 * Delete a question
 * @param {string} questionId - Question document ID
 * @returns {Promise<void>}
 */
export async function deleteQuestion(questionId) {
  try {
    const questionRef = doc(db, COLLECTIONS.QUESTIONS, questionId)
    await deleteDoc(questionRef)
  } catch (error) {
    logError('apQuestionService.deleteQuestion', { questionId }, error)
    throw error
  }
}

/**
 * Add questions to a test section
 * @param {string} testId - Test document ID
 * @param {number} sectionIndex - Section index in the test
 * @param {Array<string>} questionIds - Question IDs to add
 * @returns {Promise<void>}
 */
export async function addQuestionsToSection(testId, sectionIndex, questionIds) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    const testSnap = await getDoc(testRef)

    if (!testSnap.exists()) {
      throw new Error('Test not found')
    }

    const testData = testSnap.data()
    const sections = [...(testData.sections || [])]

    if (sectionIndex < 0 || sectionIndex >= sections.length) {
      throw new Error('Invalid section index')
    }

    // Add questions to section
    const section = { ...sections[sectionIndex] }
    const existingIds = section.questionIds || []
    section.questionIds = [...existingIds, ...questionIds]
    sections[sectionIndex] = section

    await updateDoc(testRef, {
      sections,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apQuestionService.addQuestionsToSection', { testId, sectionIndex, questionIds }, error)
    throw error
  }
}

/**
 * Remove a question from a test section
 * @param {string} testId - Test document ID
 * @param {number} sectionIndex - Section index in the test
 * @param {string} questionId - Question ID to remove
 * @returns {Promise<void>}
 */
export async function removeQuestionFromSection(testId, sectionIndex, questionId) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    const testSnap = await getDoc(testRef)

    if (!testSnap.exists()) {
      throw new Error('Test not found')
    }

    const testData = testSnap.data()
    const sections = [...(testData.sections || [])]

    if (sectionIndex < 0 || sectionIndex >= sections.length) {
      throw new Error('Invalid section index')
    }

    // Remove question from section
    const section = { ...sections[sectionIndex] }
    section.questionIds = (section.questionIds || []).filter(id => id !== questionId)
    sections[sectionIndex] = section

    await updateDoc(testRef, {
      sections,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apQuestionService.removeQuestionFromSection', { testId, sectionIndex, questionId }, error)
    throw error
  }
}

/**
 * Reorder questions within a section
 * @param {string} testId - Test document ID
 * @param {number} sectionIndex - Section index
 * @param {Array<string>} newOrder - New question ID order
 * @returns {Promise<void>}
 */
export async function reorderSectionQuestions(testId, sectionIndex, newOrder) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    const testSnap = await getDoc(testRef)

    if (!testSnap.exists()) {
      throw new Error('Test not found')
    }

    const testData = testSnap.data()
    const sections = [...(testData.sections || [])]

    if (sectionIndex < 0 || sectionIndex >= sections.length) {
      throw new Error('Invalid section index')
    }

    // Update question order
    const section = { ...sections[sectionIndex] }
    section.questionIds = newOrder
    sections[sectionIndex] = section

    await updateDoc(testRef, {
      sections,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apQuestionService.reorderSectionQuestions', { testId, sectionIndex }, error)
    throw error
  }
}

/**
 * Get available subjects (unique values from questions)
 * @returns {Promise<Array<string>>} Array of subject names
 */
export async function getAvailableSubjects() {
  try {
    const questionsRef = collection(db, COLLECTIONS.QUESTIONS)
    const q = query(questionsRef, limit(500))
    const snapshot = await getDocs(q)

    const subjects = new Set()
    snapshot.docs.forEach(doc => {
      const subject = doc.data().subject
      if (subject) {
        subjects.add(subject)
      }
    })

    return Array.from(subjects).sort()
  } catch (error) {
    logError('apQuestionService.getAvailableSubjects', {}, error)
    throw error
  }
}

/**
 * Get available domains for a subject
 * @param {string} subject - Subject name
 * @returns {Promise<Array<string>>} Array of domain names
 */
export async function getAvailableDomains(subject) {
  try {
    const questionsRef = collection(db, COLLECTIONS.QUESTIONS)
    const q = query(
      questionsRef,
      where('subject', '==', subject),
      limit(500)
    )
    const snapshot = await getDocs(q)

    const domains = new Set()
    snapshot.docs.forEach(doc => {
      const domain = doc.data().questionDomain
      if (domain) {
        domains.add(domain)
      }
    })

    return Array.from(domains).sort()
  } catch (error) {
    logError('apQuestionService.getAvailableDomains', { subject }, error)
    throw error
  }
}

/**
 * Duplicate a question (for creating variants)
 * @param {string} questionId - Question to duplicate
 * @param {string} createdBy - New creator ID
 * @returns {Promise<string>} New question ID
 */
export async function duplicateQuestion(questionId, createdBy) {
  try {
    const original = await getQuestionById(questionId)
    if (!original) {
      throw new Error('Question not found')
    }

    // Remove ID and timestamps
    const { id, createdAt, updatedAt, ...questionData } = original

    return await createQuestion({
      ...questionData,
      createdBy,
    })
  } catch (error) {
    logError('apQuestionService.duplicateQuestion', { questionId, createdBy }, error)
    throw error
  }
}
