/**
 * ConnectionStatus - Banner displayed when connection is lost
 * Shows syncing state when reconnecting
 */
export default function ConnectionStatus({ isConnected, isSyncing }) {
  // Don't show anything if connected and not syncing
  if (isConnected && !isSyncing) {
    return null
  }

  // Syncing state
  if (isSyncing) {
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

  // Disconnected state
  return (
    <div className="bg-warning border-b border-warning-border px-4 py-2 flex items-center justify-center gap-2">
      <span className="text-warning-text-strong">⚠</span>
      <span className="text-warning-text-strong text-sm">
        Connection unstable - your progress is being saved locally
      </span>
    </div>
  )
}
