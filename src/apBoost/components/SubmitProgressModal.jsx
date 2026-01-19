/**
 * SubmitProgressModal - Modal shown during test submission
 * Shows syncing progress and handles timeout state with retry
 */
export default function SubmitProgressModal({
  isVisible,
  queueLength = 0,
  isSyncing = false,
  isTimedOut = false,
  onRetry,
}) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - no click to close during submission */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl p-6 md:p-8 max-w-md mx-4">
        {isTimedOut ? (
          /* Timed out state */
          <>
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-warning flex items-center justify-center">
                <span className="text-3xl">!</span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-text-primary text-center mb-2">
              Unable to Sync
            </h2>

            {/* Message */}
            <p className="text-text-secondary text-center mb-2">
              Your answers are saved locally.
            </p>
            <p className="text-text-muted text-sm text-center mb-6">
              Please check your internet connection and try again.
            </p>

            {/* Retry button */}
            <button
              onClick={onRetry}
              className="w-full py-3 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              Keep Trying
            </button>
          </>
        ) : (
          /* Syncing state */
          <>
            {/* Spinner */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-info flex items-center justify-center">
                <svg
                  className="animate-spin h-8 w-8 text-info-text"
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
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-text-primary text-center mb-2">
              Submitting Test
            </h2>

            {/* Message */}
            <p className="text-text-secondary text-center mb-2">
              Syncing your answers...
            </p>

            {/* Queue status */}
            {(queueLength > 0 || isSyncing) && (
              <p className="text-text-muted text-sm text-center">
                {queueLength > 0
                  ? `${queueLength} item${queueLength !== 1 ? 's' : ''} remaining`
                  : 'Finalizing...'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
