import MCQSquare from './MCQSquare'
import { PERFORMANCE_THRESHOLDS } from '../../utils/performanceColors'

/**
 * PerformanceGrid - Grid of color-coded MCQ performance squares
 */
export default function PerformanceGrid({
  performance = {},
  questions = {},
  onQuestionClick,
}) {
  // Sort questions by number
  const sortedQuestions = Object.values(performance)
    .sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0))

  if (sortedQuestions.length === 0) {
    return (
      <div className="bg-muted rounded-[--radius-card] p-8 text-center">
        <p className="text-text-muted">No MCQ performance data available</p>
      </div>
    )
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <span className="text-text-secondary text-sm font-medium">Legend:</span>
        {PERFORMANCE_THRESHOLDS.map((threshold) => (
          <div key={threshold.min} className="flex items-center gap-1">
            <div className={`w-4 h-4 rounded ${threshold.color}`} />
            <span className="text-text-muted text-xs">
              {threshold.min === 0 ? '<50%' : `≥${threshold.min}%`} ({threshold.label})
            </span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex flex-wrap gap-2">
        {sortedQuestions.map((q, index) => (
          <MCQSquare
            key={q.questionId}
            questionNumber={index + 1}
            percentage={q.percentage}
            onClick={() => onQuestionClick?.(q.questionId)}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-border-default">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-text-muted">Total Questions: </span>
            <span className="text-text-primary font-medium">{sortedQuestions.length}</span>
          </div>
          <div>
            <span className="text-text-muted">Average: </span>
            <span className="text-text-primary font-medium">
              {sortedQuestions.length > 0
                ? Math.round(sortedQuestions.reduce((a, b) => a + b.percentage, 0) / sortedQuestions.length)
                : 0}%
            </span>
          </div>
          <div>
            <span className="text-text-muted">Lowest: </span>
            <span className="text-text-primary font-medium">
              {Math.min(...sortedQuestions.map(q => q.percentage))}%
            </span>
          </div>
          <div>
            <span className="text-text-muted">Highest: </span>
            <span className="text-text-primary font-medium">
              {Math.max(...sortedQuestions.map(q => q.percentage))}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
