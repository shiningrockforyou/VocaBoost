import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS } from '../utils/apTypes'
import { logError, logDebug } from '../utils/logError'
import { withTimeout, TIMEOUTS } from '../utils/withTimeout'

/**
 * useDuplicateTabGuard - Detect duplicate tabs using BroadcastChannel + Firestore
 *
 * Two-phase protocol:
 * 1. New tab sends SESSION_QUERY to ask if any tab is already active
 * 2. Existing active tab responds with SESSION_ACTIVE
 * 3. New tab sees the response and shows the DuplicateTabModal (isInvalidated=true)
 * 4. If user clicks "Use This Tab", takeControl() broadcasts SESSION_CLAIMED to invalidate others
 *
 * If no response within 1s, the new tab assumes it's the only one and claims silently.
 *
 * @param {string} sessionId - Current session ID
 * @returns {Object} Guard state and methods
 */
export function useDuplicateTabGuard(sessionId, { onSessionQuery } = {}) {
  // Generate unique instance token for this tab
  const instanceToken = useMemo(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }, [])

  const [isInvalidated, setIsInvalidated] = useState(false)
  const channelRef = useRef(null)
  const claimTimeoutRef = useRef(null)
  const isActiveRef = useRef(false) // Whether this tab has claimed the session
  const onSessionQueryRef = useRef(onSessionQuery)
  useEffect(() => { onSessionQueryRef.current = onSessionQuery }, [onSessionQuery])

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
      isActiveRef.current = true
      return true
    } catch (error) {
      logError('useDuplicateTabGuard.claimSession', { sessionId }, error)
      return false
    }
  }, [sessionId, instanceToken])

  // Take control of the session (from modal — user explicitly chose "Use This Tab")
  const takeControl = useCallback(async () => {
    setIsInvalidated(false)

    // Notify other tabs they are now invalidated
    if (channelRef.current) {
      channelRef.current.postMessage({
        type: 'SESSION_CLAIMED',
        token: instanceToken,
      })
    }

    // Claim in Firestore (best-effort, non-blocking)
    claimSession().catch(err => {
      logError('useDuplicateTabGuard.takeControl', { sessionId }, err)
    })

    return true
  }, [claimSession, instanceToken, sessionId])

  // Set up BroadcastChannel for same-browser detection
  useEffect(() => {
    if (!sessionId) return

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channelRef.current = new BroadcastChannel(`ap_session_${sessionId}`)

        channelRef.current.onmessage = (event) => {
          const { type, token } = event.data

          if (type === 'SESSION_CLAIMED' && token !== instanceToken) {
            // Another tab has taken control — we are invalidated
            logDebug('useDuplicateTabGuard', 'Another tab claimed session', event.data)
            isActiveRef.current = false
            setIsInvalidated(true)
          }

          if (type === 'SESSION_QUERY' && token !== instanceToken && isActiveRef.current) {
            // A new tab is asking if anyone is active — respond to block it
            logDebug('useDuplicateTabGuard', 'Responding to query from new tab')
            channelRef.current.postMessage({
              type: 'SESSION_ACTIVE',
              token: instanceToken,
            })
            // Fire-and-forget flush — human latency on Tab 2 gives seconds of margin
            onSessionQueryRef.current?.()
          }

          if (type === 'SESSION_ACTIVE' && token !== instanceToken && !isActiveRef.current) {
            // An existing tab responded — we (the new tab) should be blocked
            logDebug('useDuplicateTabGuard', 'Existing tab is active, blocking this tab')
            if (claimTimeoutRef.current) {
              clearTimeout(claimTimeoutRef.current)
              claimTimeoutRef.current = null
            }
            setIsInvalidated(true)
          }
        }

        // Phase 1: Ask if any tab is already active
        channelRef.current.postMessage({
          type: 'SESSION_QUERY',
          token: instanceToken,
        })

        // Phase 2: If no response within 1s, assume we're the only tab and claim
        claimTimeoutRef.current = setTimeout(() => {
          if (!isActiveRef.current) {
            logDebug('useDuplicateTabGuard', 'No other tab responded, claiming session')
            channelRef.current.postMessage({
              type: 'SESSION_CLAIMED',
              token: instanceToken,
            })
            claimSession()
          }
        }, 1000)
      } catch (error) {
        logError('useDuplicateTabGuard.broadcastChannel', { sessionId }, error)
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

  // beforeunload — no-op (keep session token for refresh resume)
  useEffect(() => {
    const handleBeforeUnload = () => {}
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [sessionId])

  return {
    instanceToken,
    isInvalidated,
    takeControl,
  }
}

export default useDuplicateTabGuard
