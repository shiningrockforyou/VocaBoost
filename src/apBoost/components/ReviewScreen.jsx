/**
 * QuestionBox - Individual question indicator in the review grid
 */
function QuestionBox({ number, questionId, isAnswered, isFlagged, onClick }) {
  let bgClass = 'bg-surface'
  let borderClass = 'border-border-default'

  if (isAnswered) {
    bgClass = 'bg-brand-primary'
  }
  if (isFlagged) {
    borderClass = 'border-warning-ring border-2'
  }

  return (
    <button
      onClick={onClick}
      className={`
        w-10 h-10 rounded-[--radius-button-sm] border flex items-center justify-center
        text-sm font-medium transition-all hover:opacity-80
        ${bgClass} ${borderClass}
        ${isAnswered ? 'text-white' : 'text-text-primary'}
      `}
    >
      {isFlagged ? '🚩' : number}
    </button>
  )
}

/**
 * ReviewScreen - Full-page review before submit
 * Shows summary of answered/unanswered/flagged questions
 */
export default function ReviewScreen({
  section,
  questions,
  answers,
  flags,
  onGoToQuestion,
  onSubmit,
  onCancel,
  isSubmitting,
  isFinalSection,
}) {
  // Calculate statistics
  const totalQuestions = questions.length
  const answeredCount = questions.filter(q => answers.has(q.id || q)).length
  const unansweredCount = totalQuestions - answeredCount
  const flaggedCount = questions.filter(q => flags.has(q.id || q)).length

  // Get unanswered question numbers
  const unansweredQuestions = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !answers.has(q.id || q))
    .map(({ idx }) => idx + 1)

  // Get flagged question numbers
  const flaggedQuestions = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => flags.has(q.id || q))
    .map(({ idx }) => idx + 1)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-surface rounded-[--radius-card] shadow-theme-md p-6">
        {/* Header */}
        <h1 className="text-2xl font-bold text-text-primary text-center mb-6">
          Review Your Answers
        </h1>

        {/* Question Grid */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {questions.map((q, idx) => {
            const questionId = q.id || q
            const isAnswered = answers.has(questionId)
            const isFlagged = flags.has(questionId)

            return (
              <QuestionBox
                key={questionId}
                number={idx + 1}
                questionId={questionId}
                isAnswered={isAnswered}
                isFlagged={isFlagged}
                onClick={() => onGoToQuestion(idx)}
              />
            )
          })}
        </div>

        {/* Summary */}
        <div className="bg-muted rounded-[--radius-alert] p-4 mb-6">
          <h2 className="font-medium text-text-primary mb-2">Summary</h2>
          <ul className="text-text-secondary text-sm space-y-1">
            <li>• Answered: {answeredCount}/{totalQuestions}</li>
            {unansweredCount > 0 && (
              <li>
                • Unanswered: {unansweredCount} (Q{unansweredQuestions.join(', Q')})
              </li>
            )}
            {flaggedCount > 0 ? (
              <li>• Flagged: {flaggedCount} (Q{flaggedQuestions.join(', Q')})</li>
            ) : (
              <li>• Flagged: 0</li>
            )}
          </ul>
        </div>

        {/* Warning for unanswered */}
        {unansweredCount > 0 && (
          <div className="bg-warning rounded-[--radius-alert] p-4 mb-6">
            <p className="text-warning-text-strong text-sm">
              ⚠ You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-text-muted text-sm mb-6">
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

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover transition-colors disabled:opacity-50"
          >
            Return to Questions
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </>
            ) : (
              isFinalSection ? 'Submit Test' : 'Submit Section'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
