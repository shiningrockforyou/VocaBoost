import { useState, useEffect, useCallback, useRef } from 'react'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS } from '../utils/apTypes'
import { logError, logDebug } from '../utils/logError'
import { withTimeout, TIMEOUTS } from '../utils/withTimeout'

// Heartbeat interval in milliseconds
const HEARTBEAT_INTERVAL = 15000 // 15 seconds
const MAX_FAILURES = 3

/**
 * useHeartbeat - Server ping to verify session validity
 * @param {string} sessionId - Current session ID
 * @param {string} instanceToken - Unique token for this browser instance
 * @returns {Object} Connection state
 */
export function useHeartbeat(sessionId, instanceToken) {
  const [isConnected, setIsConnected] = useState(true)
  const [failureCount, setFailureCount] = useState(0)
  const [lastHeartbeat, setLastHeartbeat] = useState(null)
  const [sessionTakenOver, setSessionTakenOver] = useState(false)
  const intervalRef = useRef(null)
  const isActiveRef = useRef(true)

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

      // Check if another tab took over
      if (sessionData.sessionToken && sessionData.sessionToken !== instanceToken) {
        logDebug('useHeartbeat.doHeartbeat', 'Session taken over by another instance')
        setSessionTakenOver(true)
        return
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

      // Success
      setIsConnected(true)
      setFailureCount(0)
      setLastHeartbeat(new Date())
      logDebug('useHeartbeat.doHeartbeat', 'Heartbeat successful')
    } catch (error) {
      logError('useHeartbeat.doHeartbeat', { sessionId }, error)
      setFailureCount(prev => {
        const newCount = prev + 1
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

  // Manual reconnect
  const reconnect = useCallback(async () => {
    setFailureCount(0)
    setIsConnected(true)
    await doHeartbeat()
  }, [doHeartbeat])

  return {
    isConnected,
    failureCount,
    lastHeartbeat,
    sessionTakenOver,
    reconnect,
  }
}

export default useHeartbeat
