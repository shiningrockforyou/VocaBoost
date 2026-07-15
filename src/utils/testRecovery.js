/**
 * Test Recovery Utility
 *
 * Handles saving and recovering test state for network disconnect scenarios.
 * Uses localStorage with time-limited recovery (3 minute window).
 */

const STORAGE_PREFIX = 'vocaboost_test_'
const RECOVERY_WINDOW_MS = 3 * 60 * 1000 // 3 minutes
const INTENTIONAL_EXIT_KEY = 'vocaboost_intentional_exit'
const NONCE_SUFFIX = '_nonce'

// [I-5 §2 F3] Layer 1 of the attempt-nonce store: module-level memo, keyed by testId.
// Always writable (per page load), checked FIRST — this is what guarantees that within one
// page load every getOrCreateAttemptNonce(testId) call returns the SAME nonce even when
// browser storage throws (webview/private mode). The 06-29 outage root cause was the old
// catch minting a FRESH nonce per call → grade-docId !== save-docId under enforcement.
const attemptNonceMemo = new Map()

// [I-5 §2 F4] Emit `nonce_storage_degraded` at most once per page load, and only when BOTH
// persistence layers (localStorage AND sessionStorage) fail — measures the webview/private
// population BEFORE grade-token enforcement is re-armed. Dynamic import so this pure utility
// gains no static Firebase dependency (and a failed logger can never break the nonce path).
let nonceStorageDegradedLogged = false
function logNonceStorageDegraded(testId, error) {
  if (nonceStorageDegradedLogged) return
  nonceStorageDegradedLogged = true
  import('../services/db')
    .then(({ logSystemEvent }) => logSystemEvent('nonce_storage_degraded', {
      testId,
      errName: error?.name || null,
      errMessage: String(error?.message || '').slice(0, 200),
    }, 'warning'))
    .catch(() => { /* observability only — never break the submit path */ })
}

/**
 * Generate a unique test ID
 * @param {string} classId - Class ID
 * @param {string} listId - List ID
 * @param {string} testType - 'new' or 'review'
 * @returns {string} Unique test identifier
 */
export function getTestId(classId, listId, testType) {
  return `${STORAGE_PREFIX}${classId}_${listId}_${testType}`
}

/**
 * Save test state to localStorage
 * @param {string} testId - Unique test identifier
 * @param {Object} answers - Current answers { wordId: answer }
 * @param {Array<string>} wordIds - Array of word IDs in the test
 * @param {number} currentIndex - Current question index
 */
export function saveTestState(testId, answers, wordIds, currentIndex = 0) {
  try {
    const state = {
      answers,
      wordIds,
      currentIndex,
      timestamp: Date.now(),
      expiresAt: Date.now() + RECOVERY_WINDOW_MS
    }
    localStorage.setItem(testId, JSON.stringify(state))
  } catch (error) {
    console.warn('Failed to save test state:', error)
  }
}

/**
 * Get saved test state if valid (within recovery window)
 * @param {string} testId - Unique test identifier
 * @returns {Object|null} Saved state or null if expired/not found
 */
export function getTestState(testId) {
  try {
    const stored = localStorage.getItem(testId)
    if (!stored) return null

    const state = JSON.parse(stored)

    // Check if expired
    if (Date.now() > state.expiresAt) {
      clearTestState(testId)
      return null
    }

    return state
  } catch (error) {
    console.warn('Failed to get test state:', error)
    return null
  }
}

/**
 * Clear test state from localStorage. Also clears the attempt nonce so the
 * next test launch starts a fresh attempt docId.
 * @param {string} testId - Unique test identifier
 */
export function clearTestState(testId) {
  // [I-5 §2 F3] Success-path rollover: the module memo entry MUST go too, or the next
  // attempt in the same page load would reuse the old docId. Cleared unconditionally
  // (the Map can't throw), then each storage layer independently best-effort.
  attemptNonceMemo.delete(testId)
  try {
    localStorage.removeItem(testId)
    localStorage.removeItem(testId + NONCE_SUFFIX)
  } catch (error) {
    console.warn('Failed to clear test state:', error)
  }
  try {
    sessionStorage.removeItem(testId + NONCE_SUFFIX)
  } catch {
    // sessionStorage unavailable — nothing persisted there to clear
  }
}

/**
 * Return a stable per-session nonce for use as part of an idempotent attempt
 * document ID. Cleared as a side effect of clearTestState (success path or
 * expiration), which rolls the docId over for the next attempt.
 *
 * Why: withRetry can replay submitTestAttempt; addDoc would create duplicates.
 * A deterministic docId like ${userId}_${testId}_${nonce} lets us use setDoc
 * so retries are no-op overwrites of identical data.
 *
 * [I-5 §2 F3] Layered memoized store (deepfix P4 · FND-2). Lookup order:
 *   1. module-level Map (always writable, single instance per page load);
 *   2. localStorage (survives tab close within the recovery window);
 *   3. sessionStorage fallback (survives refresh in-tab; available in most
 *      storage-restricted webviews).
 * On ANY storage failure the minted nonce is MEMOIZED in the Map and the same
 * value is returned on every subsequent call — the catch NEVER re-mints per
 * call (the old behavior handed the grade leg and the save leg two different
 * docIds in degraded storage: the 06-29 grade-token outage, I-5 §1).
 * Degraded-storage behavior is therefore: idempotent within the page load
 * (covers grade→save and Retry Save); non-idempotent only across a full
 * reload after a completed grade — which the server-echoed attemptDocId (F2)
 * + the server-side pre-write idempotency read already absorb.
 *
 * @param {string} testId - Unique test identifier
 * @returns {string} Stable nonce string
 */
export function getOrCreateAttemptNonce(testId) {
  // Layer 1: module memo — the authoritative in-flight value.
  const memoized = attemptNonceMemo.get(testId)
  if (memoized) return memoized

  const key = testId + NONCE_SUFFIX

  // Layer 2: localStorage (refresh-resume within the recovery window).
  let localReadError = null
  try {
    const existing = localStorage.getItem(key)
    if (existing) {
      attemptNonceMemo.set(testId, existing)
      return existing
    }
  } catch (error) {
    localReadError = error
  }

  // Layer 3: sessionStorage (in-tab refresh survival when localStorage is blocked).
  try {
    const existing = sessionStorage.getItem(key)
    if (existing) {
      attemptNonceMemo.set(testId, existing)
      return existing
    }
  } catch {
    // fall through to mint
  }

  // Mint ONCE, memoize FIRST (the Map cannot fail), then best-effort persist.
  const nonce = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  attemptNonceMemo.set(testId, nonce)

  let persisted = false
  let persistError = localReadError
  try {
    localStorage.setItem(key, nonce)
    persisted = true
  } catch (error) {
    persistError = error
  }
  if (!persisted) {
    try {
      sessionStorage.setItem(key, nonce)
      persisted = true
    } catch (error) {
      persistError = persistError || error
    }
  }
  if (!persisted) {
    console.warn('Attempt nonce not persisted (storage degraded) — memoized in-memory:', persistError)
    logNonceStorageDegraded(testId, persistError) // [F4] once per page load
  }
  return nonce
}

/**
 * Check if a test has recoverable state
 * @param {string} testId - Unique test identifier
 * @returns {boolean} True if recoverable state exists
 */
export function isTestRecoverable(testId) {
  return getTestState(testId) !== null
}

/**
 * Get time remaining for recovery in minutes
 * @param {string} testId - Unique test identifier
 * @returns {number|null} Minutes remaining or null if not recoverable
 */
export function getRecoveryTimeRemaining(testId) {
  const state = getTestState(testId)
  if (!state) return null

  const remaining = state.expiresAt - Date.now()
  return Math.max(0, Math.ceil(remaining / 60000))
}

/**
 * Validate that saved word IDs match current test
 * @param {string} testId - Unique test identifier
 * @param {Array<string>} currentWordIds - Current test word IDs
 * @returns {boolean} True if word IDs match
 */
export function validateTestState(testId, currentWordIds) {
  const state = getTestState(testId)
  if (!state) return false

  // Check if same words (order doesn't matter)
  const savedSet = new Set(state.wordIds)
  const currentSet = new Set(currentWordIds)

  if (savedSet.size !== currentSet.size) return false

  for (const id of savedSet) {
    if (!currentSet.has(id)) return false
  }

  return true
}

/**
 * Mark that user is intentionally exiting (set in beforeunload)
 * @param {string} testId - Unique test identifier
 */
export function markIntentionalExit(testId) {
  try {
    localStorage.setItem(`${INTENTIONAL_EXIT_KEY}_${testId}`, 'true')
  } catch (error) {
    console.warn('Failed to mark intentional exit:', error)
  }
}

/**
 * Check if last exit was intentional, and clear the flag
 * @param {string} testId - Unique test identifier
 * @returns {boolean} True if last exit was intentional
 */
export function wasIntentionalExit(testId) {
  try {
    const key = `${INTENTIONAL_EXIT_KEY}_${testId}`
    const wasIntentional = localStorage.getItem(key) === 'true'
    localStorage.removeItem(key) // Always clear after checking
    return wasIntentional
  } catch (error) {
    console.warn('Failed to check intentional exit:', error)
    return false
  }
}

/**
 * Clear intentional exit flag (call if user clicks "Stay" or continues)
 * @param {string} testId - Unique test identifier
 */
export function clearIntentionalExitFlag(testId) {
  try {
    localStorage.removeItem(`${INTENTIONAL_EXIT_KEY}_${testId}`)
  } catch (error) {
    console.warn('Failed to clear intentional exit flag:', error)
  }
}
