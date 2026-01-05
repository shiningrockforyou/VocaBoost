import { useMemo } from 'react'

/**
 * Simulation Log Display Component
 *
 * Shows event log, day summaries, and issues
 */
export default function SimulationLog({ log, profile }) {
  const { daySummaries, issues, events } = log

  const summary = useMemo(() => {
    return log.generateSummary(profile.name)
  }, [log, profile.name])

  return (
    <div className="space-y-4 text-sm">
      {/* Summary Stats */}
      <div className="bg-gray-800 rounded p-3">
        <h3 className="text-purple-300 font-bold mb-2">Summary</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>Profile: <span className="text-white">{profile.name}</span></div>
          <div>Days: <span className="text-white">{summary.daysCompleted}</span></div>
          <div>Events: <span className="text-white">{summary.totalEvents}</span></div>
          <div>Pass Rate: <span className="text-green-400">{summary.passRate}%</span></div>
        </div>
        {summary.issues.total > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-700">
            <span className="text-red-400">❌ {summary.issues.errors} errors</span>
            <span className="mx-2">|</span>
            <span className="text-yellow-400">⚠️ {summary.issues.mismatches} mismatches</span>
          </div>
        )}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="bg-gray-800 rounded p-3">
          <h3 className="text-red-400 font-bold mb-2">Issues ({issues.length})</h3>
          <div className="space-y-2 max-h-40 overflow-auto">
            {issues.map(issue => (
              <div
                key={issue.id}
                className={`p-2 rounded text-xs ${
                  issue.type === 'ERROR' ? 'bg-red-900/50' : 'bg-yellow-900/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{issue.type === 'ERROR' ? '❌' : '⚠️'}</span>
                  <span className="font-mono">{issue.context?.check || issue.context?.dayNumber ? `Day ${issue.context.dayNumber}` : 'General'}</span>
                </div>
                <div className="text-gray-300 mt-1">{issue.message}</div>
                {issue.type === 'MISMATCH' && (
                  <div className="text-gray-400 mt-1">
                    Expected: {issue.expected} | Actual: {issue.actual}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day Summaries */}
      <div className="bg-gray-800 rounded p-3">
        <h3 className="text-purple-300 font-bold mb-2">Day Log</h3>
        {daySummaries.length === 0 ? (
          <div className="text-gray-500 text-xs">No days completed yet</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-auto">
            {daySummaries.map((day, index) => (
              <DaySummaryRow key={index} day={day} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div className="bg-gray-800 rounded p-3">
        <h3 className="text-purple-300 font-bold mb-2">Recent Events</h3>
        <div className="space-y-1 max-h-40 overflow-auto text-xs font-mono">
          {events.slice(-20).reverse().map(event => (
            <div key={event.id} className="flex gap-2 text-gray-400">
              <span className="text-gray-600">{new Date(event.timestamp).toLocaleTimeString()}</span>
              <span className={getEventColor(event.type)}>{event.type}</span>
              {event.data && typeof event.data === 'object' && (
                <span className="text-gray-500 truncate">
                  {JSON.stringify(event.data).slice(0, 50)}
                </span>
              )}
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-gray-500">No events yet</div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Day summary row
 */
function DaySummaryRow({ day }) {
  const testScores = day.testAttempts.map(t => `${Math.round(t.score * 100)}%`).join('→')

  return (
    <div className={`p-2 rounded text-xs ${day.issues?.length ? 'bg-yellow-900/30' : 'bg-gray-700/50'}`}>
      <div className="flex items-center justify-between">
        <span className="font-bold">Day {day.dayNumber}</span>
        <span className={day.passed ? 'text-green-400' : 'text-red-400'}>
          {day.passed ? '✓' : '✗'}
        </span>
      </div>
      <div className="text-gray-400 mt-1">
        {day.cardsStudied > 0 && <span>{day.cardsStudied} cards</span>}
        {day.testAttempts.length > 0 && (
          <span className="ml-2">Tests: {testScores}</span>
        )}
        {day.reviewScore !== null && (
          <span className="ml-2">Review: {Math.round(day.reviewScore * 100)}%</span>
        )}
        {day.graduated > 0 && (
          <span className="ml-2 text-green-400">+{day.graduated} graduated</span>
        )}
      </div>
      {day.interventionLevel > 0 && (
        <div className="text-yellow-400 mt-1">
          Intervention: {Math.round(day.interventionLevel * 100)}%
        </div>
      )}
    </div>
  )
}

/**
 * Get color for event type
 */
function getEventColor(type) {
  switch (type) {
    case 'ERROR': return 'text-red-400'
    case 'MISMATCH': return 'text-yellow-400'
    case 'DAY_COMPLETE': return 'text-green-400'
    case 'TEST_ATTEMPT': return 'text-blue-400'
    case 'GRADUATION': return 'text-purple-400'
    case 'PHASE_TRANSITION': return 'text-cyan-400'
    default: return 'text-gray-400'
  }
}
