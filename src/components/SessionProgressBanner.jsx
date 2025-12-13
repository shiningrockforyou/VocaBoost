/**
 * SessionProgressBanner
 *
 * Displays the student's progress through the daily session flow.
 * Shows checkmarks for completed phases and current/upcoming phases.
 */

const SessionProgressBanner = ({
  currentPhase,
  newWordsTestScore = null,
  reviewTestScore = null,
  isFirstDay = false,
  showNextStep = true
}) => {
  // Define phases based on whether it's day 1 or not
  const phases = isFirstDay
    ? [
        { key: 'new-words-study', label: 'New Words Studied' },
        { key: 'new-words-test', label: 'New Words Test' }
      ]
    : [
        { key: 'new-words-study', label: 'New Words Studied' },
        { key: 'new-words-test', label: 'New Words Test' },
        { key: 'review-study', label: 'Review Words Studied' },
        { key: 'review-test', label: 'Review Test' }
      ]

  // Determine which phases are complete
  const getPhaseStatus = (phaseKey) => {
    const phaseOrder = {
      'new-words-study': 0,
      'new-words-test': 1,
      'review-study': 2,
      'review-test': 3,
      'complete': 4
    }

    const currentOrder = phaseOrder[currentPhase] ?? 0
    const thisOrder = phaseOrder[phaseKey] ?? 0

    if (thisOrder < currentOrder) return 'completed'
    if (thisOrder === currentOrder) return 'current'
    return 'upcoming'
  }

  // Get score display for a phase
  const getScoreDisplay = (phaseKey) => {
    if (phaseKey === 'new-words-test' && newWordsTestScore !== null) {
      return `${Math.round(newWordsTestScore * 100)}%`
    }
    if (phaseKey === 'review-test' && reviewTestScore !== null) {
      return `${Math.round(reviewTestScore * 100)}%`
    }
    return null
  }

  // Get next step message
  const getNextStep = () => {
    if (!showNextStep) return null

    switch (currentPhase) {
      case 'new-words-study':
        return 'Next: New Words Test'
      case 'new-words-test':
        return isFirstDay ? 'Complete!' : 'Next: Review Words'
      case 'review-study':
        return 'Next: Review Test'
      case 'review-test':
      case 'complete':
        return 'Session Complete!'
      default:
        return null
    }
  }

  const nextStep = getNextStep()

  return (
    <div className="rounded-xl bg-surface border border-border-default p-4 shadow-sm">
      <div className="space-y-2">
        {phases.map((phase) => {
          const status = getPhaseStatus(phase.key)
          const score = getScoreDisplay(phase.key)

          return (
            <div
              key={phase.key}
              className={`flex items-center gap-3 ${
                status === 'upcoming' ? 'opacity-40' : ''
              }`}
            >
              {/* Status icon */}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  status === 'completed'
                    ? 'bg-emerald-100 text-emerald-600'
                    : status === 'current'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {status === 'completed' ? (
                  <span>✓</span>
                ) : status === 'current' ? (
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-gray-300" />
                )}
              </div>

              {/* Label and score */}
              <div className="flex flex-1 items-center justify-between">
                <span
                  className={`text-sm ${
                    status === 'completed'
                      ? 'font-medium text-text-primary'
                      : status === 'current'
                      ? 'font-semibold text-blue-600'
                      : 'text-text-muted'
                  }`}
                >
                  {phase.label}
                </span>
                {score && (
                  <span className="text-sm font-semibold text-emerald-600">
                    {score}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Next step indicator */}
      {nextStep && (
        <div className="mt-3 pt-3 border-t border-border-default">
          <p className="text-sm text-text-muted">
            <span className="mr-1">→</span>
            {nextStep}
          </p>
        </div>
      )}
    </div>
  )
}

export default SessionProgressBanner
