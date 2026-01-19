/**
 * AP Teacher Service
 * Handles teacher-specific operations: tests, classes, assignments
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
  serverTimestamp,
} from 'firebase/firestore'
import { COLLECTIONS, GRADING_STATUS, TEST_TYPE, DEFAULT_SCORE_RANGES } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * Get all tests created by a teacher
 * @param {string} teacherId - Teacher's user ID
 * @returns {Promise<Array>} Array of test objects
 */
export async function getTeacherTests(teacherId) {
  try {
    const testsRef = collection(db, COLLECTIONS.TESTS)
    const q = query(
      testsRef,
      where('createdBy', '==', teacherId),
      orderBy('createdAt', 'desc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    logError('apTeacherService.getTeacherTests', { teacherId }, error)
    throw error
  }
}

/**
 * Create a new test
 * @param {Object} testData - Test configuration
 * @returns {Promise<string>} Created test ID
 */
export async function createTest(testData) {
  try {
    const testsRef = collection(db, COLLECTIONS.TESTS)

    const newTest = {
      title: testData.title || 'Untitled Test',
      subject: testData.subject || '',
      testType: testData.testType || TEST_TYPE.EXAM,
      sections: testData.sections || [],
      scoreRanges: testData.scoreRanges || DEFAULT_SCORE_RANGES,
      questionOrder: testData.questionOrder || 'FIXED',
      isPublished: false,
      hasFRQ: false,
      createdBy: testData.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(testsRef, newTest)
    return docRef.id
  } catch (error) {
    logError('apTeacherService.createTest', { testData }, error)
    throw error
  }
}

/**
 * Update an existing test
 * @param {string} testId - Test document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateTest(testId, updates) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)

    // Check if test has FRQ questions
    let hasFRQ = updates.hasFRQ
    if (updates.sections && hasFRQ === undefined) {
      hasFRQ = updates.sections.some(section =>
        section.sectionType === 'FRQ' || section.sectionType === 'MIXED'
      )
    }

    await updateDoc(testRef, {
      ...updates,
      hasFRQ: hasFRQ ?? false,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apTeacherService.updateTest', { testId, updates }, error)
    throw error
  }
}

/**
 * Delete a test (and its assignments)
 * @param {string} testId - Test document ID
 * @returns {Promise<void>}
 */
export async function deleteTest(testId) {
  try {
    // Delete test document
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    await deleteDoc(testRef)

    // Delete associated assignments
    const assignmentsRef = collection(db, COLLECTIONS.ASSIGNMENTS)
    const q = query(assignmentsRef, where('testId', '==', testId))
    const snapshot = await getDocs(q)

    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
    await Promise.all(deletePromises)
  } catch (error) {
    logError('apTeacherService.deleteTest', { testId }, error)
    throw error
  }
}

/**
 * Get a single test by ID
 * @param {string} testId - Test document ID
 * @returns {Promise<Object|null>} Test object or null
 */
export async function getTestById(testId) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    const testSnap = await getDoc(testRef)

    if (!testSnap.exists()) {
      return null
    }

    return {
      id: testSnap.id,
      ...testSnap.data()
    }
  } catch (error) {
    logError('apTeacherService.getTestById', { testId }, error)
    throw error
  }
}

/**
 * Get all classes for a teacher
 * @param {string} teacherId - Teacher's user ID
 * @returns {Promise<Array>} Array of class objects
 */
export async function getTeacherClasses(teacherId) {
  try {
    const classesRef = collection(db, COLLECTIONS.CLASSES)
    const q = query(
      classesRef,
      where('teacherId', '==', teacherId),
      orderBy('name', 'asc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    logError('apTeacherService.getTeacherClasses', { teacherId }, error)
    throw error
  }
}

/**
 * Get students in a class
 * @param {string} classId - Class document ID
 * @returns {Promise<Array>} Array of student user objects
 */
export async function getClassStudents(classId) {
  try {
    const classRef = doc(db, COLLECTIONS.CLASSES, classId)
    const classSnap = await getDoc(classRef)

    if (!classSnap.exists()) {
      return []
    }

    const classData = classSnap.data()
    const studentIds = classData.studentIds || []

    if (studentIds.length === 0) {
      return []
    }

    // Fetch student details
    const students = []
    for (const studentId of studentIds) {
      try {
        const userRef = doc(db, 'users', studentId)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          students.push({
            id: userSnap.id,
            ...userSnap.data()
          })
        }
      } catch {
        // Skip students that can't be fetched
      }
    }

    return students
  } catch (error) {
    logError('apTeacherService.getClassStudents', { classId }, error)
    throw error
  }
}

/**
 * Create a test assignment for classes/students
 * @param {Object} assignmentData - Assignment configuration
 * @returns {Promise<string>} Created assignment ID
 */
export async function createAssignment(assignmentData) {
  try {
    const assignmentsRef = collection(db, COLLECTIONS.ASSIGNMENTS)

    const newAssignment = {
      testId: assignmentData.testId,
      classIds: assignmentData.classIds || [],
      studentIds: assignmentData.studentIds || [],
      dueDate: assignmentData.dueDate || null,
      maxAttempts: assignmentData.maxAttempts ?? 3,
      frqSubmissionType: assignmentData.frqSubmissionType || 'TYPED',
      assignedBy: assignmentData.assignedBy,
      assignedAt: serverTimestamp(),
    }

    const docRef = await addDoc(assignmentsRef, newAssignment)
    return docRef.id
  } catch (error) {
    logError('apTeacherService.createAssignment', { assignmentData }, error)
    throw error
  }
}

/**
 * Get assignments for a test
 * @param {string} testId - Test document ID
 * @returns {Promise<Array>} Array of assignment objects
 */
export async function getTestAssignments(testId) {
  try {
    const assignmentsRef = collection(db, COLLECTIONS.ASSIGNMENTS)
    const q = query(
      assignmentsRef,
      where('testId', '==', testId),
      orderBy('assignedAt', 'desc')
    )
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    logError('apTeacherService.getTestAssignments', { testId }, error)
    throw error
  }
}

/**
 * Get count of submissions pending grading
 * @param {string} teacherId - Teacher's user ID
 * @returns {Promise<Object>} Count object { total, byTest: { testId: count } }
 */
export async function getPendingGradingCount(teacherId) {
  try {
    // Get teacher's tests
    const tests = await getTeacherTests(teacherId)
    const testIds = tests.map(t => t.id)

    if (testIds.length === 0) {
      return { total: 0, byTest: {} }
    }

    // Get results pending grading for these tests
    const resultsRef = collection(db, COLLECTIONS.TEST_RESULTS)
    const q = query(
      resultsRef,
      where('testId', 'in', testIds.slice(0, 10)), // Firestore 'in' limit
      where('gradingStatus', 'in', [GRADING_STATUS.PENDING, GRADING_STATUS.IN_PROGRESS])
    )
    const snapshot = await getDocs(q)

    const byTest = {}
    let total = 0

    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const testId = data.testId
      byTest[testId] = (byTest[testId] || 0) + 1
      total++
    })

    return { total, byTest }
  } catch (error) {
    logError('apTeacherService.getPendingGradingCount', { teacherId }, error)
    throw error
  }
}

/**
 * Get detailed pending grading list
 * @param {string} teacherId - Teacher's user ID
 * @returns {Promise<Array>} Array of { testId, testTitle, count }
 */
export async function getPendingGradingList(teacherId) {
  try {
    const { byTest } = await getPendingGradingCount(teacherId)
    const tests = await getTeacherTests(teacherId)

    const testMap = {}
    tests.forEach(t => {
      testMap[t.id] = t.title
    })

    return Object.entries(byTest).map(([testId, count]) => ({
      testId,
      testTitle: testMap[testId] || 'Unknown Test',
      count
    }))
  } catch (error) {
    logError('apTeacherService.getPendingGradingList', { teacherId }, error)
    throw error
  }
}

/**
 * Publish a test (make it available for assignments)
 * @param {string} testId - Test document ID
 * @returns {Promise<void>}
 */
export async function publishTest(testId) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    await updateDoc(testRef, {
      isPublished: true,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apTeacherService.publishTest', { testId }, error)
    throw error
  }
}

/**
 * Unpublish a test
 * @param {string} testId - Test document ID
 * @returns {Promise<void>}
 */
export async function unpublishTest(testId) {
  try {
    const testRef = doc(db, COLLECTIONS.TESTS, testId)
    await updateDoc(testRef, {
      isPublished: false,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apTeacherService.unpublishTest', { testId }, error)
    throw error
  }
}
