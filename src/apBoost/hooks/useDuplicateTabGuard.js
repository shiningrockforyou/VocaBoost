import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS } from '../utils/apTypes'
import { logError, logDebug } from '../utils/logError'
import { withTimeout, TIMEOUTS } from '../utils/withTimeout'

/**
 * useDuplicateTabGuard - Detect duplicate tabs using BroadcastChannel + Firestore
 * @param {string} sessionId - Current session ID
 * @returns {Object} Guard state and methods
 */
export function useDuplicateTabGuard(sessionId) {
  // Generate unique instance token for this tab
  const instanceToken = useMemo(() => {
    // Use crypto.randomUUID if available, fallback to custom
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }, [])

  const [isInvalidated, setIsInvalidated] = useState(false)
  const channelRef = useRef(null)
  const claimTimeoutRef = useRef(null)

  // Claim session in Firestore
  const claimSession = useCallback(async () => {
    if (!sessionId) return false

    try {
      await withTimeout(
        updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
          sessionToken: instanceToken,
          lastHeartbeat: serverTimestamp(),
        }),
        TIMEOUTS.FIRESTORE_WRITE,
        'Claim session'
      )

      logDebug('useDuplicateTabGuard.claimSession', 'Session claimed', { instanceToken })
      return true
    } catch (error) {
      logError('useDuplicateTabGuard.claimSession', { sessionId }, error)
      return false
    }
  }, [sessionId, instanceToken])

  // Take control of the session (from modal)
  const takeControl = useCallback(async () => {
    const success = await claimSession()
    if (success) {
      setIsInvalidated(false)

      // Notify other tabs
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: 'SESSION_CLAIMED',
          token: instanceToken,
        })
      }
    }
    return success
  }, [claimSession, instanceToken])

  // Set up BroadcastChannel for same-browser detection
  useEffect(() => {
    if (!sessionId) return

    // BroadcastChannel for instant same-browser detection
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channelRef.current = new BroadcastChannel(`ap_session_${sessionId}`)

        // Listen for other tabs claiming the session
        channelRef.current.onmessage = (event) => {
          if (event.data.type === 'SESSION_CLAIMED' && event.data.token !== instanceToken) {
            logDebug('useDuplicateTabGuard', 'Another tab claimed session', event.data)
            setIsInvalidated(true)
          }
        }

        // Claim session on mount (delayed slightly to let existing tabs react)
        claimTimeoutRef.current = setTimeout(() => {
          // Announce our presence
          channelRef.current.postMessage({
            type: 'SESSION_CLAIMED',
            token: instanceToken,
          })
          // Claim in Firestore
          claimSession()
        }, 500)
      } catch (error) {
        logError('useDuplicateTabGuard.broadcastChannel', { sessionId }, error)
        // Fallback to just Firestore claim
        claimSession()
      }
    } else {
      // No BroadcastChannel support, just claim session
      claimSession()
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.close()
        channelRef.current = null
      }
      if (claimTimeoutRef.current) {
        clearTimeout(claimTimeoutRef.current)
      }
    }
  }, [sessionId, instanceToken, claimSession])

  // Handle beforeunload - mark session as released
  useEffect(() => {
    const handleBeforeUnload = () => {
      // We don't clear the session token here because the user might
      // just be refreshing, and we want them to be able to resume
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sessionId])

  return {
    instanceToken,
    isInvalidated,
    takeControl,
  }
}

export default useDuplicateTabGuard
