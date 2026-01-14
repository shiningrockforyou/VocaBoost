import { useState } from 'react'

/**
 * QuestionBox - Individual question/sub-question indicator in the grid
 */
function QuestionBox({ displayLabel, isAnswered, isFlagged, isCurrent, onClick }) {
  let bgClass = 'bg-surface'
  let borderClass = 'border-border-default'

  if (isAnswered) {
    bgClass = 'bg-brand-primary'
  }
  if (isFlagged) {
    borderClass = 'border-warning-ring border-2'
  }
  if (isCurrent) {
    borderClass = 'ring-2 ring-info-ring'
  }

  // Adjust size for sub-question labels (like "1a", "1b")
  const hasSubLabel = displayLabel.length > 1

  return (
    <button
      onClick={onClick}
      className={`
        ${hasSubLabel ? 'w-12' : 'w-10'} h-10 rounded-[--radius-button-sm] border flex items-center justify-center
        text-sm font-medium transition-all hover:opacity-80
        ${bgClass} ${borderClass}
        ${isAnswered ? 'text-white' : 'text-text-primary'}
      `}
    >
      {isFlagged ? '🚩' : displayLabel}
    </button>
  )
}

/**
 * Check if a navigation item is answered
 * For FRQ, check if answers[questionId][subLabel] has content
 * For MCQ, check if answers.has(questionId)
 */
function isItemAnswered(item, answers) {
  const answer = answers.get(item.questionId)
  if (!answer) return false

  // For FRQ sub-questions
  if (item.subQuestionLabel) {
    return typeof answer === 'object' && !!answer[item.subQuestionLabel]
  }

  // For MCQ or FRQ without sub-questions
  return !!answer
}

/**
 * QuestionNavigator - Bottom bar with slide-up modal navigation
 * Supports both MCQ (simple question list) and FRQ (flat sub-question list)
 */
export default function QuestionNavigator({
  // Legacy props (MCQ only)
  questions,
  currentIndex,
  totalQuestions,
  // New props (FRQ support)
  flatNavigationItems = null, // Array of { questionId, questionIndex, subQuestionLabel, displayLabel }
  currentFlatIndex = null,
  onNavigateFlatIndex = null,
  // Common props
  answers,
  flags,
  onNavigate,
  onBack,
  onNext,
  onGoToReview,
  canGoBack,
  canGoNext,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Use flat navigation items if provided (FRQ support)
  const useFlatNav = flatNavigationItems && flatNavigationItems.length > 0

  const handleNavigate = (index) => {
    if (useFlatNav && onNavigateFlatIndex) {
      onNavigateFlatIndex(index)
    } else {
      onNavigate(index)
    }
    setIsModalOpen(false)
  }

  // Compute display values
  const displayCurrentIndex = useFlatNav ? currentFlatIndex : currentIndex
  const displayTotalQuestions = useFlatNav ? flatNavigationItems.length : totalQuestions

  return (
    <>
      {/* Bottom Bar */}
      <div className="bg-surface border-t border-border-default px-4 py-3 flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={!canGoBack}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[--radius-button] text-sm
            ${canGoBack
              ? 'bg-surface border border-border-default text-text-primary hover:bg-hover'
              : 'bg-muted text-text-muted cursor-not-allowed'
            }
          `}
        >
          ← Back
        </button>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 text-text-primary hover:text-text-secondary transition-colors"
        >
          <span className="text-sm font-medium">
            Question {displayCurrentIndex + 1} of {displayTotalQuestions}
          </span>
          <span className="text-xs">▲</span>
        </button>

        <button
          onClick={onNext}
          disabled={!canGoNext}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-[--radius-button] text-sm
            ${canGoNext
              ? 'bg-surface border border-border-default text-text-primary hover:bg-hover'
              : 'bg-muted text-text-muted cursor-not-allowed'
            }
          `}
        >
          Next →
        </button>
      </div>

      {/* Slide-up Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsModalOpen(false)}
          />

          {/* Modal */}
          <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card-lg] p-6 animate-slide-up max-h-[70vh] overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">
                Question Navigator
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Question Grid - Flat navigation (FRQ support) */}
            {useFlatNav ? (
              <div className="flex flex-wrap gap-2 mb-6">
                {flatNavigationItems.map((item, idx) => {
                  const isAnswered = isItemAnswered(item, answers)
                  const isFlagged = flags.has(item.questionId)
                  const isCurrent = idx === currentFlatIndex

                  return (
                    <QuestionBox
                      key={`${item.questionId}-${item.subQuestionLabel || 'main'}`}
                      displayLabel={item.displayLabel}
                      isAnswered={isAnswered}
                      isFlagged={isFlagged}
                      isCurrent={isCurrent}
                      onClick={() => handleNavigate(idx)}
                    />
                  )
                })}
              </div>
            ) : (
              /* Legacy Question Grid (MCQ only) */
              <div className="flex flex-wrap gap-2 mb-6">
                {questions.map((questionId, idx) => {
                  const isAnswered = answers.has(questionId)
                  const isFlagged = flags.has(questionId)
                  const isCurrent = idx === currentIndex

                  return (
                    <QuestionBox
                      key={questionId}
                      displayLabel={String(idx + 1)}
                      isAnswered={isAnswered}
                      isFlagged={isFlagged}
                      isCurrent={isCurrent}
                      onClick={() => handleNavigate(idx)}
                    />
                  )
                })}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 text-text-muted text-sm mb-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-brand-primary rounded" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-surface border border-border-default rounded" />
                <span>Unanswered</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-surface border-2 border-warning-ring rounded" />
                <span>Flagged</span>
              </div>
            </div>

            {/* Go to Review */}
            <button
              onClick={() => {
                setIsModalOpen(false)
                onGoToReview()
              }}
              className="w-full py-3 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              Go to Review Screen
            </button>
          </div>
        </div>
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
