import { getPerformanceColor, getPerformanceInfo } from '../../utils/performanceColors'

/**
 * Sub-question performance square
 */
function SubQuestionSquare({ label, percentage, onClick }) {
  const colorClass = getPerformanceColor(percentage)

  return (
    <button
      onClick={onClick}
      className={`
        w-14 h-14 rounded-[--radius-input] flex flex-col items-center justify-center
        ${colorClass} text-white font-medium
        hover:opacity-90 hover:scale-105 transition-all cursor-pointer
        shadow-sm
      `}
      title={`Part ${label}: ${percentage}% average`}
    >
      <span className="text-xs opacity-80">{label}</span>
      <span className="text-sm font-bold">{percentage}%</span>
    </button>
  )
}

/**
 * FRQCard - FRQ question performance with nested sub-question squares
 */
export default function FRQCard({
  questionNumber,
  question,
  performance = {},
  onSubClick,
}) {
  const { percentage, subQuestions = {} } = performance
  const performanceInfo = getPerformanceInfo(percentage || 0)
  const subLabels = Object.keys(subQuestions).sort()

  return (
    <div className="border border-border-default rounded-[--radius-card] p-4 bg-surface">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="font-medium text-text-primary mb-1">
            FRQ {questionNumber}
          </h4>
          <p className="text-text-muted text-sm line-clamp-2">
            {question?.questionText?.substring(0, 100)}...
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full ${performanceInfo.color} text-white text-sm font-medium ml-4`}>
          {percentage || 0}%
        </div>
      </div>

      {/* Sub-question squares */}
      {subLabels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {subLabels.map(label => {
            const subData = subQuestions[label] || {}
            return (
              <SubQuestionSquare
                key={label}
                label={label}
                percentage={subData.percentage || 0}
                onClick={() => onSubClick?.(label)}
              />
            )
          })}
        </div>
      ) : (
        <div className="text-text-muted text-sm">
          No sub-question data available
        </div>
      )}

      {/* Stats */}
      <div className="mt-4 pt-3 border-t border-border-muted text-sm text-text-muted">
        <span>{performance.studentCount || 0} students graded</span>
      </div>
    </div>
  )
}
