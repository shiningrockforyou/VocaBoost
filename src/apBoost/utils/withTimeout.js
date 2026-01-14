/**
 * Promise timeout wrapper for AP Boost
 *
 * Wraps a promise with a timeout, rejecting if it takes too long.
 * Useful for network operations that might hang.
 */

/**
 * Wrap a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} operation - Name of the operation (for error message)
 * @returns {Promise} The original promise or timeout rejection
 */
export async function withTimeout(promise, ms, operation = 'Operation') {
  let timeoutId

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${ms}ms`))
    }, ms)
  })

  try {
    const result = await Promise.race([promise, timeout])
    clearTimeout(timeoutId)
    return result
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Default timeout values for different operations
 */
export const TIMEOUTS = {
  FIRESTORE_READ: 10000,    // 10 seconds
  FIRESTORE_WRITE: 15000,   // 15 seconds
  SESSION_LOAD: 20000,      // 20 seconds
  HEARTBEAT: 5000,          // 5 seconds
  QUEUE_FLUSH: 30000,       // 30 seconds
}

export default withTimeout
