/**
 * Centralized error logging utility for AP Boost
 *
 * Logs errors with consistent formatting and context.
 * Can be extended to send to error tracking services.
 */

/**
 * Log an error with context information
 * @param {string} functionName - Name of the function where error occurred
 * @param {Object} context - Additional context (userId, sessionId, etc.)
 * @param {Error|string} error - The error object or message
 */
export function logError(functionName, context = {}, error = null) {
  const errorInfo = {
    function: functionName,
    context,
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
