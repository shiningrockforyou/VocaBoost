/**
 * AP Storage Service
 * Handles Firebase Storage operations for FRQ uploads
 */
import { storage } from '../../firebase'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage'
import { logError } from '../utils/logError'

// File validation constants
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB total

/**
 * Validate file before upload
 * @param {File} file - File to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateFile(file) {
  // Check file type
  if (!SUPPORTED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file format: ${file.type}. Supported: PDF, JPG, PNG, HEIC, WebP`
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File too large: ${sizeMB}MB. Maximum: 10MB`
    }
  }

  return { valid: true }
}

/**
 * Validate multiple files
 * @param {File[]} files - Files to validate
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateFiles(files) {
  // Check each file
  for (const file of files) {
    const result = validateFile(file)
    if (!result.valid) {
      return result
    }
  }

  // Check total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > MAX_TOTAL_SIZE) {
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `Total size too large: ${sizeMB}MB. Maximum: 50MB`
    }
  }

  return { valid: true }
}

/**
 * Upload FRQ answer sheet files
 * @param {string} userId - Student's user ID
 * @param {string} resultId - Test result ID
 * @param {File[]} files - Files to upload
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Array>} Array of { name, url, size, type }
 */
export async function uploadFRQAnswerSheet(userId, resultId, files, onProgress = null) {
  try {
    // Validate files
    const validation = validateFiles(files)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const uploadedFiles = []
    const totalFiles = files.length
    let completedFiles = 0

    for (const file of files) {
      // Generate unique filename
      const timestamp = Date.now()
      const ext = file.name.split('.').pop() || 'jpg'
      const filename = `page_${completedFiles + 1}_${timestamp}.${ext}`

      // Create storage reference
      const storagePath = `ap_frq_uploads/${userId}/${resultId}/${filename}`
      const storageRef = ref(storage, storagePath)

      // Upload file
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedBy: userId,
          resultId: resultId,
        }
      })

      // Get download URL
      const url = await getDownloadURL(snapshot.ref)

      uploadedFiles.push({
        name: filename,
        originalName: file.name,
        url,
        size: file.size,
        type: file.type,
        path: storagePath,
      })

      completedFiles++
      if (onProgress) {
        onProgress(Math.round((completedFiles / totalFiles) * 100))
      }
    }

    return uploadedFiles
  } catch (error) {
    logError('apStorageService.uploadFRQAnswerSheet', { userId, resultId }, error)
    throw error
  }
}

/**
 * Upload graded PDF with teacher annotations
 * @param {string} resultId - Test result ID
 * @param {File} file - PDF file with annotations
 * @param {string} teacherId - Teacher's user ID
 * @returns {Promise<string>} Download URL
 */
export async function uploadGradedPdf(resultId, file, teacherId) {
  try {
    // Validate file
    if (file.type !== 'application/pdf') {
      throw new Error('Graded file must be a PDF')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File too large. Maximum: 10MB')
    }

    // Create storage reference
    const timestamp = Date.now()
    const storagePath = `ap_frq_graded/${resultId}/graded_${timestamp}.pdf`
    const storageRef = ref(storage, storagePath)

    // Upload file
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: 'application/pdf',
      customMetadata: {
        gradedBy: teacherId,
        resultId: resultId,
      }
    })

    // Get download URL
    const url = await getDownloadURL(snapshot.ref)
    return url
  } catch (error) {
    logError('apStorageService.uploadGradedPdf', { resultId, teacherId }, error)
    throw error
  }
}

/**
 * Get download URL for a file
 * @param {string} path - Storage path
 * @returns {Promise<string>} Download URL
 */
export async function getFileDownloadUrl(path) {
  try {
    const storageRef = ref(storage, path)
    return await getDownloadURL(storageRef)
  } catch (error) {
    logError('apStorageService.getFileDownloadUrl', { path }, error)
    throw error
  }
}

/**
 * Delete an uploaded file
 * @param {string} path - Storage path
 */
export async function deleteUpload(path) {
  try {
    const storageRef = ref(storage, path)
    await deleteObject(storageRef)
  } catch (error) {
    // Ignore if file doesn't exist
    if (error.code !== 'storage/object-not-found') {
      logError('apStorageService.deleteUpload', { path }, error)
      throw error
    }
  }
}

/**
 * Delete all uploads for a result
 * @param {string} userId - User ID
 * @param {string} resultId - Result ID
 */
export async function deleteAllUploads(userId, resultId) {
  try {
    const folderRef = ref(storage, `ap_frq_uploads/${userId}/${resultId}`)
    const listResult = await listAll(folderRef)

    const deletePromises = listResult.items.map(item => deleteObject(item))
    await Promise.all(deletePromises)
  } catch (error) {
    logError('apStorageService.deleteAllUploads', { userId, resultId }, error)
    throw error
  }
}

/**
 * Get all uploaded files for a result
 * @param {string} userId - User ID
 * @param {string} resultId - Result ID
 * @returns {Promise<Array>} Array of { name, url, path }
 */
export async function getUploadedFiles(userId, resultId) {
  try {
    const folderRef = ref(storage, `ap_frq_uploads/${userId}/${resultId}`)
    const listResult = await listAll(folderRef)

    const files = await Promise.all(
      listResult.items.map(async (item) => {
        const url = await getDownloadURL(item)
        return {
          name: item.name,
          url,
          path: item.fullPath,
        }
      })
    )

    return files
  } catch (error) {
    logError('apStorageService.getUploadedFiles', { userId, resultId }, error)
    throw error
  }
}

/**
 * Get file extension from MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} Extension
 */
export function getExtensionFromMimeType(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  return map[mimeType] || 'bin'
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
