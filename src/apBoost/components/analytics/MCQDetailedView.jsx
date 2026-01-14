import { getPerformanceColor } from '../../utils/performanceColors'

/**
 * Inline distribution display
 */
function InlineDistribution({ distribution = {}, correctAnswers = [] }) {
  const choices = ['A', 'B', 'C', 'D', 'E']

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {choices.map(choice => {
        const data = distribution[choice]
        if (!data) return null

        const isCorrect = correctAnswers.includes(choice)

        return (
          <span
            key={choice}
            className={`${isCorrect ? 'text-green-600 font-medium' : 'text-text-muted'}`}
          >
            {choice}: {data.percentage}%{isCorrect && ' ✓'}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Question row in detailed view
 */
function QuestionRow({
  questionNumber,
  question,
  performance,
  distribution,
  onClick,
}) {
  const colorClass = getPerformanceColor(performance?.percentage || 0)
  const correctAnswers = question?.correctAnswers || []

  return (
    <div
      onClick={onClick}
      className="p-4 border-b border-border-default hover:bg-hover cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-4">
        {/* Question number and percentage */}
        <div className={`w-12 h-12 rounded-[--radius-input] ${colorClass} text-white flex flex-col items-center justify-center shrink-0`}>
          <span className="text-xs">Q{questionNumber}</span>
          <span className="text-sm font-bold">{performance?.percentage || 0}%</span>
        </div>

        {/* Question content */}
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-sm mb-2 line-clamp-2">
            {question?.questionText || 'No question text'}
          </p>
          <InlineDistribution
            distribution={distribution}
            correctAnswers={correctAnswers}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * MCQDetailedView - Expanded list view with all question distributions
 */
export default function MCQDetailedView({
  performance = {},
  questions = {},
  distributions = {},
  onQuestionClick,
  onBackToGrid,
}) {
  // Sort questions by number
  const sortedQuestions = Object.values(performance)
    .sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0))

  if (sortedQuestions.length === 0) {
    return (
      <div className="bg-muted rounded-[--radius-card] p-8 text-center">
        <p className="text-text-muted">No MCQ data available</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-primary">
          MCQ Detailed View
        </h3>
        <button
          onClick={onBackToGrid}
          className="text-brand-primary text-sm hover:underline flex items-center gap-1"
        >
          ← Back to Grid
        </button>
      </div>

      {/* Questions list */}
      <div className="border border-border-default rounded-[--radius-card] overflow-hidden bg-surface">
        {sortedQuestions.map((p, index) => (
          <QuestionRow
            key={p.questionId}
            questionNumber={index + 1}
            question={questions[p.questionId]}
            performance={p}
            distribution={distributions[p.questionId] || {}}
            onClick={() => onQuestionClick?.(p.questionId)}
          />
        ))}
      </div>
    </div>
  )
}
