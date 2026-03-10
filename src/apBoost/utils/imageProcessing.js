/**
 * Image processing utilities for AP Boost
 * Canvas-based compression and HEIC conversion
 */

/**
 * Compress an image file using canvas
 * @param {File} file - Image file to compress
 * @param {Object} options
 * @param {number} options.maxWidth - Max width in pixels (default 2048)
 * @param {number} options.maxHeight - Max height in pixels (default 2048)
 * @param {number} options.quality - JPEG quality 0-1 (default 0.8)
 * @returns {Promise<File>} Compressed file (or original if not an image)
 */
export async function compressImage(file, { maxWidth = 2048, maxHeight = 2048, quality = 0.8 } = {}) {
  // Only compress raster images
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  // Skip if already small (< 500KB)
  if (file.size < 500 * 1024) {
    return file
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Scale down if exceeds max dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file) // Fallback to original
            return
          }

          // Only use compressed version if it's actually smaller
          if (blob.size >= file.size) {
            resolve(file)
            return
          }

          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          })
          resolve(compressed)
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // Fallback to original on error
    }

    img.src = url
  })
}

/**
 * Check if a file is HEIC/HEIF format
 */
function isHeicFile(file) {
  return file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
}

/**
 * Convert HEIC file to JPEG
 * Requires heic2any to be installed as an optional dependency.
 * If not available, returns the original file unchanged.
 * @param {File} file - HEIC file to convert
 * @returns {Promise<File>} Converted JPEG file (or original if not HEIC or heic2any unavailable)
 */
export async function convertHeicToJpeg(file) {
  if (!isHeicFile(file)) return file

  // heic2any must be installed separately — if not, skip conversion
  if (!window.__heic2any) return file

  try {
    const blob = await window.__heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    })

    const jpegName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg')
    return new File([blob], jpegName, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } catch {
    return file
  }
}

/**
 * Process an image file: convert HEIC if needed, then compress
 * @param {File} file - Image file to process
 * @param {Object} options - Compression options (passed to compressImage)
 * @returns {Promise<File>} Processed file
 */
export async function processImageFile(file, options) {
  let processed = await convertHeicToJpeg(file)
  processed = await compressImage(processed, options)
  return processed
}
