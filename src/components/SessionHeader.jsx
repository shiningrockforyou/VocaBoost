import { forwardRef } from 'react'

/**
 * Reusable sticky header for study/test sessions
 * Includes: header bar, session context, and progress bar
 */
const SessionHeader = forwardRef(function SessionHeader({
  // Header bar props
  onBack,
  backAriaLabel = 'Go back',
  backDisabled = false,
  stepText,
  onStepClick,
  rightSlot = null,

  // Session context props
  sessionTitle, // e.g., "New Words Study", "Review Test"
  dayNumber, // e.g., 1

  // Progress bar props (optional - hidden if not provided)
  progressPercent, // 0-100
  progressLabel // e.g., "5 of 20 mastered" or "3 of 10 answered"
}, ref) {
  const showProgress = progressPercent !== undefined

  return (
    <div ref={ref} className="sticky top-0 z-20">
      {/* Header Bar - has background */}
      <div className="border-b border-border-default bg-surface/95 backdrop-blur-sm px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          {/* Left: Back/Quit button */}
          <button
            onClick={onBack}
            disabled={backDisabled}
            className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-muted transition disabled:opacity-50"
            aria-label={backAriaLabel}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Center: Step indicator (clickable) */}
          <button
            onClick={onStepClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 transition"
          >
            <span className="text-sm font-medium text-text-primary">
              {stepText}
            </span>
            <svg
              className="w-4 h-4 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* Right: Custom slot or spacer */}
          {rightSlot ?? <div className="w-9" />}
        </div>
      </div>

      {/* Session Context + Progress (when applicable) */}
      {(sessionTitle || showProgress) && (
        <div className="px-4 pt-3 pb-3">
          <div className="mx-auto max-w-2xl">
            {/* Session Context */}
            {sessionTitle && (
              <p className="text-base font-semibold text-brand-text text-center mb-3">
                {sessionTitle} — Day {dayNumber}
              </p>
            )}

            {/* Progress Bar */}
            {showProgress && (
              <>
                <p className="text-xs text-text-muted mb-1.5">Progress</p>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-fill transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {progressLabel && (
                  <p className="text-xs text-text-muted mt-1">{progressLabel}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

export default SessionHeader

/**
 * Greyed-out menu icon for test pages
 * Shows visual consistency with study pages but non-functional
 */
export function GreyedMenuIcon() {
  return (
    <div
      className="p-2 -mr-2 rounded-lg text-text-muted/40 cursor-not-allowed"
      aria-hidden="true"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
        />
      </svg>
    </div>
  )
}
