/**
 * SessionProgressSheet Component
 *
 * A bottom sheet that displays detailed session progress.
 * Triggered by clicking the step indicator in the header.
 */

import { useEffect } from 'react'
import { Button } from './ui'

const STEP_STATUS = {
  COMPLETED: 'completed',
  CURRENT: 'current',
  LOCKED: 'locked'
}

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the sheet is visible
 * @param {Function} props.onClose - Callback to close the sheet
 * @param {string} props.currentPhase - Current phase
 * @param {boolean} props.isFirstDay - Whether this is day 1
 * @param {number} props.dayNumber - Current day number
 * @param {number} props.wordRangeStart - Start of word range
 * @param {number} props.wordRangeEnd - End of word range
 * @param {number|null} props.newWordsTestScore - Score from new words test
 * @param {number|null} props.reviewTestScore - Score from review test
 * @param {number} props.cardsRemaining - Cards left to study
 * @param {number} props.cardsDismissed - Cards dismissed
 * @param {number} props.totalCards - Total cards in current phase
 */
export default function SessionProgressSheet({
  isOpen,
  onClose,
  currentPhase,
  isFirstDay = false,
  dayNumber = 1,
  wordRangeStart,
  wordRangeEnd,
  newWordsTestScore = null,
  reviewTestScore = null,
  cardsRemaining = 0,
  cardsDismissed = 0,
  totalCards = 0
}) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Define steps based on whether it's day 1
  const steps = [
    {
      id: 'new_words',
      label: 'Study New Words',
      description: 'Learn new vocabulary',
      phase: 'new_words'
    },
    {
      id: 'new_word_test',
      label: 'New Words Test',
      description: '95% required to pass',
      phase: 'new_word_test',
      score: newWordsTestScore
    },
    ...(!isFirstDay ? [
      {
        id: 'review_study',
        label: 'Review Past Words',
        description: 'Reinforce previous learning',
        phase: 'review_study'
      },
      {
        id: 'review_test',
        label: 'Review Test',
        description: 'Test your retention',
        phase: 'review_test',
        score: reviewTestScore
      }
    ] : []),
    {
      id: 'complete',
      label: 'Session Complete',
      description: 'Finish today\'s session',
      phase: 'complete'
    }
  ]

  // Phase order for determining status
  const phaseOrder = isFirstDay
    ? ['new_words', 'new_word_test', 'complete']
    : ['new_words', 'new_word_test', 'review_study', 'review_test', 'complete']

  const currentPhaseIndex = phaseOrder.indexOf(currentPhase)
  const currentStepNumber = currentPhaseIndex + 1
  const totalSteps = phaseOrder.length

  const getStepStatus = (step) => {
    const stepIndex = phaseOrder.indexOf(step.phase)
    if (stepIndex < currentPhaseIndex) return STEP_STATUS.COMPLETED
    if (stepIndex === currentPhaseIndex) return STEP_STATUS.CURRENT
    return STEP_STATUS.LOCKED
  }

  const formatScore = (score) => {
    if (score === null || score === undefined) return null
    return `${Math.round(score * 100)}%`
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl shadow-xl max-h-[85vh] overflow-hidden animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-border-default">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                Day {dayNumber} Progress
              </h2>
              {wordRangeStart && wordRangeEnd && (
                <p className="text-sm text-text-muted">
                  Words #{wordRangeStart}–{wordRangeEnd}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-brand-text">
                {currentStepNumber}/{totalSteps}
              </p>
              <p className="text-xs text-text-muted">Steps</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto max-h-[60vh]">
          {/* Current Phase Stats (if studying) */}
          {(currentPhase === 'new_words' || currentPhase === 'review_study') && totalCards > 0 && (
            <div className="mb-5 p-4 rounded-xl bg-brand-primary/5 border border-brand-primary/20">
              <p className="text-sm font-medium text-brand-text mb-2">Current Progress</p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-brand-primary/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-primary transition-all duration-300"
                      style={{ width: `${totalCards > 0 ? ((totalCards - cardsRemaining) / totalCards) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm font-semibold text-text-primary whitespace-nowrap">
                  {totalCards - cardsRemaining} / {totalCards}
                </p>
              </div>
              {cardsDismissed > 0 && (
                <p className="text-xs text-text-muted mt-2">
                  {cardsDismissed} cards dismissed
                </p>
              )}
            </div>
          )}

          {/* Steps List */}
          <div className="space-y-3">
            {steps.map((step, index) => {
              const status = getStepStatus(step)
              const scoreText = formatScore(step.score)
              const isLast = index === steps.length - 1

              return (
                <div key={step.id} className="flex gap-3">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    {/* Status circle */}
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${status === STEP_STATUS.COMPLETED
                        ? 'bg-emerald-100 dark:bg-emerald-900/30'
                        : status === STEP_STATUS.CURRENT
                          ? 'bg-brand-primary text-white'
                          : 'bg-muted border-2 border-border-default'
                      }
                    `}>
                      {status === STEP_STATUS.COMPLETED && (
                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {status === STEP_STATUS.CURRENT && (
                        <span className="text-sm font-bold">{index + 1}</span>
                      )}
                      {status === STEP_STATUS.LOCKED && (
                        <span className="text-xs font-medium text-text-muted">{index + 1}</span>
                      )}
                    </div>

                    {/* Connector line */}
                    {!isLast && (
                      <div className={`
                        w-0.5 flex-1 min-h-[24px] mt-1
                        ${status === STEP_STATUS.COMPLETED
                          ? 'bg-emerald-300 dark:bg-emerald-700'
                          : 'bg-border-default'
                        }
                      `} />
                    )}
                  </div>

                  {/* Step content */}
                  <div className={`flex-1 pb-3 ${isLast ? '' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        status === STEP_STATUS.COMPLETED
                          ? 'text-text-secondary'
                          : status === STEP_STATUS.CURRENT
                            ? 'text-text-primary'
                            : 'text-text-muted'
                      }`}>
                        {step.label}
                      </span>

                      {/* Score badge */}
                      {status === STEP_STATUS.COMPLETED && scoreText && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                          {scoreText}
                        </span>
                      )}
                    </div>

                    <p className={`text-sm mt-0.5 ${
                      status === STEP_STATUS.CURRENT ? 'text-text-muted' : 'text-text-faint'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-default bg-surface">
          <Button
            onClick={onClose}
            variant="outline"
            size="md"
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
