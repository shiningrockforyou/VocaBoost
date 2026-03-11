/**
 * Centralized error logging utility for AP Boost
 *
 * Logs errors with consistent formatting and context.
 * Can be extended to send to error tracking services.
 */

/**
 * Classify error type for differentiated handling
 */
function classifyError(error) {
  if (!error) return 'unknown'
  const code = String(error?.code || '')
  const message = (error?.message || '').toLowerCase()

  if (code.startsWith('auth/') || message.includes('auth')) return 'auth'
  if (code === 'permission-denied' || message.includes('permission')) return 'permission'
  if (code === 'not-found' || message.includes('not found')) return 'not_found'
  if (code === 'unavailable' || code === 'deadline-exceeded' || message.includes('network') || message.includes('timeout') || message.includes('failed to fetch')) return 'network'
  if (code === 'resource-exhausted' || message.includes('quota') || message.includes('quotaexceeded')) return 'quota'
  if (code === 'invalid-argument' || message.includes('validation') || message.includes('required')) return 'validation'
  return 'unknown'
}

/**
 * Get a user-friendly message for an error type
 */
export function getUserMessage(errorType) {
  const messages = {
    auth: 'Authentication error. Please sign in again.',
    permission: 'You do not have permission to perform this action.',
    not_found: 'The requested resource was not found.',
    network: 'Network error. Please check your connection and try again.',
    quota: 'Service limit reached. Please try again later.',
    validation: 'Invalid input. Please check your data and try again.',
    unknown: 'Something went wrong. Please try again.',
  }
  return messages[errorType] || messages.unknown
}

/**
 * Log an error with context information
 * @param {string} functionName - Name of the function where error occurred
 * @param {Object} context - Additional context (userId, sessionId, etc.)
 * @param {Error|string} error - The error object or message
 * @returns {Object} errorInfo with type classification
 */
export function logError(functionName, context = {}, error = null) {
  const errorType = classifyError(error)
  const errorInfo = {
    function: functionName,
    context,
    type: errorType,
    message: error?.message || String(error || 'Unknown error'),
    code: error?.code || null,
    stack: error?.stack || null,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
  }

  // Console output for development
  console.error(`[APBoost:${functionName}]`, errorInfo)

  // In production, could send to:
  // - Sentry/LogRocket
  // - Firebase Crashlytics
  // - Custom error endpoint

  return errorInfo
}

/**
 * Log a warning (non-critical issue)
 * @param {string} functionName - Name of the function
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
export function logWarning(functionName, message, context = {}) {
  const warningInfo = {
    function: functionName,
    message,
    context,
    timestamp: new Date().toISOString(),
  }

  console.warn(`[APBoost:${functionName}]`, warningInfo)

  return warningInfo
}

/**
 * Log a debug message (development only)
 * @param {string} functionName - Name of the function
 * @param {string} message - Debug message
 * @param {any} data - Additional data to log
 */
export function logDebug(functionName, message, data = null) {
  if (import.meta.env.DEV) {
    console.log(`[APBoost:${functionName}]`, message, data)
  }
}

export default logError
