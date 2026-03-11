import { formatTimeSeconds } from '../utils/apTestConfig'

/**
 * TestTimer - Countdown timer display
 * Shows remaining time in MM:SS format
 */
export default function TestTimer({ timeRemaining }) {
  // Handle null/undefined
  if (timeRemaining == null) {
    return (
      <div className="flex items-center gap-2 text-text-muted">
        <span className="text-lg">⏱</span>
        <span className="font-mono text-lg">--:--</span>
      </div>
    )
  }

  // Determine color and urgency based on time remaining
  let colorClass = 'text-text-primary'
  let urgencyClass = ''
  if (timeRemaining <= 60) {
    // Last minute - red + pulse animation
    colorClass = 'text-error-text'
    urgencyClass = 'font-bold animate-pulse'
  } else if (timeRemaining <= 300) {
    // Last 5 minutes - warning + bold
    colorClass = 'text-warning-text'
    urgencyClass = 'font-bold'
  }

  return (
    <div className={`flex items-center gap-2 ${colorClass} ${urgencyClass}`}>
      <span className="text-lg">⏱</span>
      <span className="font-mono text-lg font-medium">
        {formatTimeSeconds(timeRemaining)}
      </span>
    </div>
  )
}
