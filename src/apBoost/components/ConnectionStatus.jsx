import { useState, useEffect, useRef } from 'react'

/**
 * ConnectionStatus - Banner displayed when connection is lost
 * Shows syncing state when reconnecting, auto-dismisses "Reconnected" after 2s
 * Shows extended offline warning after 5 minutes
 */
export default function ConnectionStatus({ isConnected, isSyncing, isStorageFull }) {
  const [showReconnected, setShowReconnected] = useState(false)
  const [extendedOffline, setExtendedOffline] = useState(false)
  const [showSyncing, setShowSyncing] = useState(false)
  const wasDisconnectedRef = useRef(false)
  const offlineTimerRef = useRef(null)
  const syncingTimerRef = useRef(null)

  useEffect(() => {
    if (!isConnected) {
      wasDisconnectedRef.current = true
      setShowReconnected(false)
      // Start 5-minute timer for extended offline warning
      if (!offlineTimerRef.current) {
        offlineTimerRef.current = setTimeout(() => {
          setExtendedOffline(true)
        }, 5 * 60 * 1000)
      }
    } else {
      // Clear extended offline state on reconnect
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current)
        offlineTimerRef.current = null
      }
      setExtendedOffline(false)

      if (wasDisconnectedRef.current && !isSyncing) {
        wasDisconnectedRef.current = false
        setShowReconnected(true)
        const timer = setTimeout(() => setShowReconnected(false), 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [isConnected, isSyncing])

  // Minimum display time for syncing banner (1s)
  useEffect(() => {
    if (isSyncing) {
      setShowSyncing(true)
      if (syncingTimerRef.current) clearTimeout(syncingTimerRef.current)
    } else if (showSyncing) {
      // Keep showing for at least 1s after syncing stops
      syncingTimerRef.current = setTimeout(() => setShowSyncing(false), 1000)
    }
    return () => {
      if (syncingTimerRef.current) clearTimeout(syncingTimerRef.current)
    }
  }, [isSyncing])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current)
      }
    }
  }, [])

  // Storage full warning (highest priority)
  if (isStorageFull) {
    return (
      <div className="bg-error border-b border-error-border px-4 py-2 flex items-center justify-center gap-2">
        <span className="text-error-text text-sm">
          Local storage is full. Your progress may not be saved offline. Please submit your test soon.
        </span>
      </div>
    )
  }

  // Syncing state (with minimum display time)
  if (showSyncing) {
    return (
      <div className="bg-info border-b border-info-border px-4 py-2 flex items-center justify-center gap-2">
        <svg
          className="animate-spin h-4 w-4 text-info-text"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-info-text text-sm">Syncing your progress...</span>
      </div>
    )
  }

  // Reconnected banner (auto-dismisses)
  if (showReconnected) {
    return (
      <div className="bg-success border-b border-success-border px-4 py-2 flex items-center justify-center gap-2 transition-opacity">
        <span className="text-success-text-strong text-sm">Reconnected</span>
      </div>
    )
  }

  // Extended offline warning (higher priority than regular disconnected)
  if (!isConnected && extendedOffline) {
    return (
      <div className="bg-error border-b border-error-border px-4 py-2 flex items-center justify-center gap-2">
        <span className="text-error-text text-sm">
          You have been offline for over 5 minutes. Your progress is saved locally, but please reconnect soon to avoid data loss.
        </span>
      </div>
    )
  }

  // Disconnected state
  if (!isConnected) {
    return (
      <div className="bg-warning border-b border-warning-border px-4 py-2 flex items-center justify-center gap-2">
        <span className="text-warning-text-strong">⚠</span>
        <span className="text-warning-text-strong text-sm">
          Connection unstable - your progress is being saved locally
        </span>
      </div>
    )
  }

  return null
}
