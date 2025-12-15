/**
 * SessionSteps Component
 *
 * Displays a vertical checklist of session steps showing progress through
 * the study flow. Used across all session screens for consistent navigation context.
 *
 * Steps:
 * - Study New Words
 * - New Words Test (95% to pass)
 * - Review Past Words (hidden on Day 1)
 * - Review Test (hidden on Day 1)
 * - Complete Session
 */

const STEP_STATUS = {
  COMPLETED: 'completed',
  CURRENT: 'current',
  LOCKED: 'locked'
}

/**
 * @param {Object} props
 * @param {string} props.currentPhase - Current phase: 'new_words' | 'new_word_test' | 'review_study' | 'review_test' | 'complete'
 * @param {boolean} props.isFirstDay - Whether this is day 1 (no review phases)
 * @param {number} props.dayNumber - Current day number
 * @param {number} props.wordRangeStart - Start of word range (e.g., 21)
 * @param {number} props.wordRangeEnd - End of word range (e.g., 30)
 * @param {number|null} props.newWordsTestScore - Score from new words test (0-1) or null
 * @param {number|null} props.reviewTestScore - Score from review test (0-1) or null
 */
export default function SessionSteps({
  currentPhase,
  isFirstDay = false,
  dayNumber = 1,
  wordRangeStart,
  wordRangeEnd,
  newWordsTestScore = null,
  reviewTestScore = null
}) {
  // Define steps based on whether it's day 1
  const steps = [
    {
      id: 'new_words',
      label: 'Study New Words',
      phase: 'new_words'
    },
    {
      id: 'new_word_test',
      label: 'New Words Test',
      sublabel: '95% to pass',
      phase: 'new_word_test',
      score: newWordsTestScore
    },
    ...(!isFirstDay ? [
      {
        id: 'review_study',
        label: 'Review Past Words',
        phase: 'review_study'
      },
      {
        id: 'review_test',
        label: 'Review Test',
        phase: 'review_test',
        score: reviewTestScore
      }
    ] : []),
    {
      id: 'complete',
      label: 'Complete Session',
      phase: 'complete'
    }
  ]

  // Phase order for determining status
  const phaseOrder = isFirstDay
    ? ['new_words', 'new_word_test', 'complete']
    : ['new_words', 'new_word_test', 'review_study', 'review_test', 'complete']

  const currentPhaseIndex = phaseOrder.indexOf(currentPhase)

  // Determine status for each step
  const getStepStatus = (step) => {
    const stepIndex = phaseOrder.indexOf(step.phase)

    if (stepIndex < currentPhaseIndex) {
      return STEP_STATUS.COMPLETED
    } else if (stepIndex === currentPhaseIndex) {
      return STEP_STATUS.CURRENT
    } else {
      return STEP_STATUS.LOCKED
    }
  }

  // Format score as percentage
  const formatScore = (score) => {
    if (score === null || score === undefined) return null
    return `${Math.round(score * 100)}%`
  }

  return (
    <div className="rounded-lg bg-surface border border-border-default p-4">
      {/* Header */}
      <div className="mb-3 pb-2 border-b border-border-muted">
        <p className="text-sm font-semibold text-text-primary">
          Day {dayNumber}
          {wordRangeStart && wordRangeEnd && (
            <span className="font-normal text-text-muted"> · Words #{wordRangeStart}–{wordRangeEnd}</span>
          )}
        </p>
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        {steps.map((step) => {
          const status = getStepStatus(step)
          const scoreText = formatScore(step.score)

          return (
            <div key={step.id} className="flex items-start gap-3">
              {/* Status icon */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                {status === STEP_STATUS.COMPLETED && (
                  <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold">✓</span>
                )}
                {status === STEP_STATUS.CURRENT && (
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-primary" />
                )}
                {status === STEP_STATUS.LOCKED && (
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-border-default bg-transparent" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${
                    status === STEP_STATUS.COMPLETED
                      ? 'text-text-secondary'
                      : status === STEP_STATUS.CURRENT
                        ? 'font-semibold text-text-primary'
                        : 'text-text-muted'
                  }`}>
                    {step.label}
                  </span>

                  {/* Score badge (if completed with score) */}
                  {status === STEP_STATUS.COMPLETED && scoreText && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {scoreText}
                    </span>
                  )}

                  {/* Current indicator */}
                  {status === STEP_STATUS.CURRENT && (
                    <span className="text-xs text-brand-text font-medium">← Current</span>
                  )}
                </div>

                {/* Sublabel (e.g., "95% to pass") */}
                {step.sublabel && status !== STEP_STATUS.COMPLETED && (
                  <p className={`text-xs mt-0.5 ${
                    status === STEP_STATUS.CURRENT ? 'text-text-muted' : 'text-text-faint'
                  }`}>
                    {step.sublabel}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
