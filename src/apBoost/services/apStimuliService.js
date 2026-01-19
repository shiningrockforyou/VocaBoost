/**
 * AP Stimuli Service
 * Handles shared stimulus/passage operations: create, read, update, delete
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
import { COLLECTIONS, STIMULUS_TYPE } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * Get a single stimulus by ID
 * @param {string} stimulusId - Stimulus document ID
 * @returns {Promise<Object|null>} Stimulus object or null
 */
export async function getStimulusById(stimulusId) {
  try {
    if (!stimulusId) return null

    const stimulusRef = doc(db, COLLECTIONS.STIMULI, stimulusId)
    const stimulusSnap = await getDoc(stimulusRef)

    if (!stimulusSnap.exists()) {
      return null
    }

    return {
      id: stimulusSnap.id,
      ...stimulusSnap.data(),
    }
  } catch (error) {
    logError('apStimuliService.getStimulusById', { stimulusId }, error)
    return null
  }
}

/**
 * Get multiple stimuli by IDs (batch fetch for efficiency)
 * Deduplicates IDs and fetches each unique stimulus once
 * @param {Array<string>} stimulusIds - Array of stimulus IDs
 * @returns {Promise<Object>} Map of stimulusId -> stimulus object
 */
export async function getStimuliByIds(stimulusIds) {
  try {
    // Deduplicate and filter out falsy values
    const unique = [...new Set(stimulusIds.filter(Boolean))]
    if (unique.length === 0) return {}

    const results = {}

    // Fetch all stimuli in parallel
    await Promise.all(
      unique.map(async (id) => {
        const stimulus = await getStimulusById(id)
        if (stimulus) {
          results[id] = stimulus
        }
      })
    )

    return results
  } catch (error) {
    logError('apStimuliService.getStimuliByIds', { stimulusIds }, error)
    return {}
  }
}

/**
 * Search stimuli with filters
 * @param {Object} filters - Search filters
 * @param {string} filters.type - Stimulus type (TEXT, IMAGE, etc.)
 * @param {string} filters.tag - Filter by tag (array-contains)
 * @param {string} filters.createdBy - Filter by creator
 * @param {number} filters.limit - Max results
 * @returns {Promise<Array>} Array of stimulus objects
 */
export async function searchStimuli(filters = {}) {
  try {
    const stimuliRef = collection(db, COLLECTIONS.STIMULI)
    let constraints = []

    // Filter by type
    if (filters.type) {
      constraints.push(where('type', '==', filters.type))
    }

    // Filter by tag
    if (filters.tag) {
      constraints.push(where('tags', 'array-contains', filters.tag))
    }

    // Filter by creator
    if (filters.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy))
    }

    // Order by creation date
    constraints.push(orderBy('createdAt', 'desc'))

    // Limit results
    if (filters.limit) {
      constraints.push(limit(filters.limit))
    } else {
      constraints.push(limit(50))
    }

    const q = query(stimuliRef, ...constraints)
    const snapshot = await getDocs(q)

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    logError('apStimuliService.searchStimuli', { filters }, error)
    throw error
  }
}

/**
 * Create a new stimulus
 * @param {Object} stimulusData - Stimulus data
 * @param {string} stimulusData.type - Stimulus type (TEXT, IMAGE, PASSAGE, etc.)
 * @param {string} stimulusData.content - Content (text or URL)
 * @param {string} stimulusData.title - Optional title for citation
 * @param {string} stimulusData.source - Source attribution
 * @param {string} stimulusData.imageAlt - Alt text for images
 * @param {Array<string>} stimulusData.tags - Tags for organization
 * @param {string} stimulusData.createdBy - Creator user ID
 * @returns {Promise<string>} Created stimulus ID
 */
export async function createStimulus(stimulusData) {
  try {
    const stimuliRef = collection(db, COLLECTIONS.STIMULI)

    const newStimulus = {
      type: stimulusData.type || STIMULUS_TYPE.TEXT,
      content: stimulusData.content || '',
      title: stimulusData.title || null,
      source: stimulusData.source || null,
      imageAlt: stimulusData.imageAlt || null,
      tags: stimulusData.tags || [],
      createdBy: stimulusData.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const docRef = await addDoc(stimuliRef, newStimulus)
    return docRef.id
  } catch (error) {
    logError('apStimuliService.createStimulus', { stimulusData }, error)
    throw error
  }
}

/**
 * Update an existing stimulus
 * @param {string} stimulusId - Stimulus document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateStimulus(stimulusId, updates) {
  try {
    const stimulusRef = doc(db, COLLECTIONS.STIMULI, stimulusId)

    await updateDoc(stimulusRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    logError('apStimuliService.updateStimulus', { stimulusId, updates }, error)
    throw error
  }
}

/**
 * Delete a stimulus
 * @param {string} stimulusId - Stimulus document ID
 * @returns {Promise<void>}
 */
export async function deleteStimulus(stimulusId) {
  try {
    const stimulusRef = doc(db, COLLECTIONS.STIMULI, stimulusId)
    await deleteDoc(stimulusRef)
  } catch (error) {
    logError('apStimuliService.deleteStimulus', { stimulusId }, error)
    throw error
  }
}
