import { getPerformanceColor } from '../../utils/performanceColors'

/**
 * MCQSquare - Single question performance square
 * Shows question number, percentage, and color-coded background
 */
export default function MCQSquare({
  questionNumber,
  percentage,
  onClick,
}) {
  const colorClass = getPerformanceColor(percentage)

  return (
    <button
      onClick={onClick}
      className={`
        w-16 h-16 rounded-[--radius-input] flex flex-col items-center justify-center
        ${colorClass} text-white font-medium
        hover:opacity-90 hover:scale-105 transition-all cursor-pointer
        shadow-sm
      `}
      title={`Question ${questionNumber}: ${percentage}% correct`}
    >
      <span className="text-xs opacity-80">Q{questionNumber}</span>
      <span className="text-sm font-bold">{percentage}%</span>
    </button>
  )
}
