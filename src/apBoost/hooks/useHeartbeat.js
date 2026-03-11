import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS } from '../utils/apTypes'
import { logError, logDebug } from '../utils/logError'
import { withTimeout, TIMEOUTS } from '../utils/withTimeout'

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL = 15000 // 15 seconds
const MAX_FAILURES = 2

/**
 * useHeartbeat - Server ping to verify session validity
 * @param {string} sessionId - Current session ID
 * @param {string} instanceToken - Unique token for this browser instance
 * @param {Object} options - Optional callbacks
 * @param {Function} options.onRecovery - Called when connection restores after failures
 * @returns {Object} Connection state
 */
export function useHeartbeat(sessionId, instanceToken, { onRecovery } = {}) {
  const [isConnected, setIsConnected] = useState(true)
  const [failureCount, setFailureCount] = useState(0)
  const [lastHeartbeat, setLastHeartbeat] = useState(null)
  const [sessionTakenOver, setSessionTakenOver] = useState(false)
  const intervalRef = useRef(null)
  const isActiveRef = useRef(true)
  const suppressTakeoverRef = useRef(false)
  const onRecoveryRef = useRef(onRecovery)
  const failureCountRef = useRef(0)
  onRecoveryRef.current = onRecovery

  // Perform heartbeat
  const doHeartbeat = useCallback(async () => {
    if (!sessionId || !instanceToken || !isActiveRef.current) return

    try {
      // First, check if session token matches (detect takeover)
      const sessionDoc = await withTimeout(
        getDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId)),
        TIMEOUTS.HEARTBEAT,
        'Heartbeat read'
      )

      if (!sessionDoc.exists()) {
        logError('useHeartbeat.doHeartbeat', { sessionId }, new Error('Session not found'))
        setFailureCount(prev => prev + 1)
        return
      }

      const sessionData = sessionDoc.data()

      // Check if another tab took over (skip if takeControl suppression is active)
      if (sessionData.sessionToken && sessionData.sessionToken !== instanceToken) {
        if (!suppressTakeoverRef.current) {
          logDebug('useHeartbeat.doHeartbeat', 'Session taken over by another instance')
          setSessionTakenOver(true)
          return
        }
      }

      // Update heartbeat timestamp
      await withTimeout(
        updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), {
          lastHeartbeat: serverTimestamp(),
          sessionToken: instanceToken, // Ensure our token is set
        }),
        TIMEOUTS.HEARTBEAT,
        'Heartbeat write'
      )

      // Success — detect recovery from failures
      const wasDown = failureCountRef.current > 0
      setIsConnected(true)
      setFailureCount(0)
      failureCountRef.current = 0
      setLastHeartbeat(new Date())
      logDebug('useHeartbeat.doHeartbeat', 'Heartbeat successful')

      if (wasDown && onRecoveryRef.current) {
        logDebug('useHeartbeat.doHeartbeat', 'Connection recovered, calling onRecovery')
        onRecoveryRef.current()
      }
    } catch (error) {
      logError('useHeartbeat.doHeartbeat', { sessionId }, error)
      setFailureCount(prev => {
        const newCount = prev + 1
        failureCountRef.current = newCount
        if (newCount >= MAX_FAILURES) {
          setIsConnected(false)
        }
        return newCount
      })
    }
  }, [sessionId, instanceToken])

  // Start heartbeat interval
  useEffect(() => {
    if (!sessionId || !instanceToken) return

    isActiveRef.current = true

    // Initial heartbeat
    doHeartbeat()

    // Set up interval
    intervalRef.current = setInterval(doHeartbeat, HEARTBEAT_INTERVAL)

    return () => {
      isActiveRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [sessionId, instanceToken, doHeartbeat])

  // Handle visibility change - heartbeat when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionId && instanceToken) {
        doHeartbeat()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sessionId, instanceToken, doHeartbeat])

  // Immediate heartbeat on network restore
  useEffect(() => {
    const handleOnline = () => {
      if (sessionId && instanceToken) {
        doHeartbeat()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [sessionId, instanceToken, doHeartbeat])

  // Manual reconnect
  const reconnect = useCallback(async () => {
    setFailureCount(0)
    setIsConnected(true)
    await doHeartbeat()
  }, [doHeartbeat])

  // Clear sessionTakenOver (called by takeControl in useTestSession)
  const clearSessionTakenOver = useCallback(() => {
    setSessionTakenOver(false)
    suppressTakeoverRef.current = true
    // Suppress takeover detection for two full heartbeat cycles
    // (one cycle may not be enough if React re-runs the effect during session state changes)
    setTimeout(() => {
      suppressTakeoverRef.current = false
    }, HEARTBEAT_INTERVAL * 2 + 2000)
  }, [])

  return {
    isConnected,
    failureCount,
    lastHeartbeat,
    sessionTakenOver,
    reconnect,
    clearSessionTakenOver,
  }
}

export default useHeartbeat
