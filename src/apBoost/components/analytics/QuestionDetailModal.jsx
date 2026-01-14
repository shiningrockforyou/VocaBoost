import { useEffect } from 'react'

/**
 * Response distribution bar
 */
function ResponseBar({ choice, percentage, count, isCorrect }) {
  return (
    <div className={`p-3 rounded-[--radius-input] ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
            ({choice})
          </span>
          {isCorrect && (
            <span className="text-green-600 text-sm">✓ Correct</span>
          )}
        </div>
        <span className="text-text-secondary text-sm">
          {count} student{count !== 1 ? 's' : ''} ({percentage}%)
        </span>
      </div>
      <div className="h-4 bg-white rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isCorrect ? 'bg-green-500' : 'bg-red-400'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

/**
 * QuestionDetailModal - Shows question details and response distribution
 */
export default function QuestionDetailModal({
  question,
  questionNumber,
  distribution = {},
  totalResponses = 0,
  onClose,
}) {
  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!question) return null

  const correctAnswers = question.correctAnswers || []
  const choices = ['A', 'B', 'C', 'D', 'E'].slice(0, question.choiceCount || 4)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
        {/* Header */}
        <div className="sticky top-0 bg-surface px-6 py-4 border-b border-border-default flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">
            Question {questionNumber}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Stimulus */}
          {question.stimulus && (
            <div className="mb-6 p-4 bg-muted rounded-[--radius-card]">
              <p className="text-text-secondary text-sm whitespace-pre-wrap">
                {question.stimulus}
              </p>
            </div>
          )}

          {/* Question text */}
          <div className="mb-6">
            <p className="text-text-primary">
              {question.questionText}
            </p>
          </div>

          {/* Response Distribution */}
          <div className="mb-6">
            <h3 className="text-text-secondary text-sm font-medium mb-3">
              Response Distribution ({totalResponses} student{totalResponses !== 1 ? 's' : ''})
            </h3>
            <div className="space-y-2">
              {choices.map(choice => {
                const data = distribution[choice] || { count: 0, percentage: 0 }
                const isCorrect = correctAnswers.includes(choice)

                return (
                  <ResponseBar
                    key={choice}
                    choice={choice}
                    percentage={data.percentage}
                    count={data.count}
                    isCorrect={isCorrect}
                  />
                )
              })}

              {/* No answer */}
              {distribution['No Answer'] && distribution['No Answer'].count > 0 && (
                <ResponseBar
                  choice="—"
                  percentage={distribution['No Answer'].percentage}
                  count={distribution['No Answer'].count}
                  isCorrect={false}
                />
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-border-default">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Correct Answer: </span>
                <span className="text-text-primary font-medium">
                  {correctAnswers.join(', ') || 'N/A'}
                </span>
              </div>
              {question.questionDomain && (
                <div>
                  <span className="text-text-muted">Domain: </span>
                  <span className="text-text-primary">{question.questionDomain}</span>
                </div>
              )}
              {question.questionTopic && (
                <div>
                  <span className="text-text-muted">Topic: </span>
                  <span className="text-text-primary">{question.questionTopic}</span>
                </div>
              )}
              {question.difficulty && (
                <div>
                  <span className="text-text-muted">Difficulty: </span>
                  <span className="text-text-primary capitalize">{question.difficulty}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
