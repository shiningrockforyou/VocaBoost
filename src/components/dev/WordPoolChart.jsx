import { useMemo } from 'react'
import { WORD_STATUSES } from '../../utils/simulationConfig'

/**
 * Word Pool Visualization Chart
 *
 * Shows stacked area chart of word status distribution over time
 */
export default function WordPoolChart({ history, profile }) {
  // Calculate chart data
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null

    const maxDay = Math.max(...history.map(h => h.day))
    const maxWords = Math.max(...history.map(h =>
      (h[WORD_STATUSES.NEW] || 0) +
      (h[WORD_STATUSES.NEVER_TESTED] || 0) +
      (h[WORD_STATUSES.PASSED] || 0) +
      (h[WORD_STATUSES.FAILED] || 0) +
      (h[WORD_STATUSES.MASTERED] || 0) +
      (h[WORD_STATUSES.NEEDS_CHECK] || 0)
    ))

    return { maxDay, maxWords, history }
  }, [history])

  if (!chartData) {
    return (
      <div className="text-center text-gray-500 py-8">
        <div className="text-4xl mb-2">📊</div>
        <div>No data yet</div>
        <div className="text-xs mt-1">Run a simulation to see word pool changes</div>
      </div>
    )
  }

  const { maxDay, maxWords } = chartData
  const chartHeight = 200
  const chartWidth = 320

  // Status colors
  const statusColors = {
    [WORD_STATUSES.NEW]: '#6b7280',         // Gray
    [WORD_STATUSES.NEVER_TESTED]: '#9ca3af', // Light gray
    [WORD_STATUSES.PASSED]: '#22c55e',       // Green
    [WORD_STATUSES.FAILED]: '#ef4444',       // Red
    [WORD_STATUSES.MASTERED]: '#8b5cf6',     // Purple
    [WORD_STATUSES.NEEDS_CHECK]: '#f59e0b'   // Orange
  }

  // Calculate stacked areas
  const statusOrder = [
    WORD_STATUSES.MASTERED,
    WORD_STATUSES.PASSED,
    WORD_STATUSES.NEEDS_CHECK,
    WORD_STATUSES.FAILED,
    WORD_STATUSES.NEVER_TESTED,
    WORD_STATUSES.NEW
  ]

  return (
    <div className="space-y-4">
      {/* Chart Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-purple-300 font-bold">Word Pool Over Time</h3>
        <span className="text-xs text-gray-400">{profile.name}</span>
      </div>

      {/* ASCII-style Chart */}
      <div className="bg-gray-800 rounded p-3 font-mono text-xs">
        <div className="flex">
          {/* Y-axis */}
          <div className="flex flex-col justify-between text-right pr-2 text-gray-500" style={{ height: chartHeight }}>
            <span>{maxWords}</span>
            <span>{Math.round(maxWords * 0.75)}</span>
            <span>{Math.round(maxWords * 0.5)}</span>
            <span>{Math.round(maxWords * 0.25)}</span>
            <span>0</span>
          </div>

          {/* Chart Area */}
          <div className="flex-1 relative border-l border-b border-gray-600" style={{ height: chartHeight }}>
            {/* Grid lines */}
            {[0.25, 0.5, 0.75].map(ratio => (
              <div
                key={ratio}
                className="absolute w-full border-t border-gray-700"
                style={{ top: `${(1 - ratio) * 100}%` }}
              />
            ))}

            {/* Stacked bars for each day */}
            <div className="absolute inset-0 flex items-end justify-around px-1">
              {history.map((snapshot, index) => {
                const total = statusOrder.reduce((sum, status) => sum + (snapshot[status] || 0), 0)

                return (
                  <div
                    key={index}
                    className="flex flex-col-reverse"
                    style={{ height: `${(total / maxWords) * 100}%`, width: `${80 / Math.max(history.length, 1)}%` }}
                    title={`Day ${snapshot.day}: ${total} words`}
                  >
                    {statusOrder.map(status => {
                      const count = snapshot[status] || 0
                      if (count === 0) return null
                      const height = (count / total) * 100

                      return (
                        <div
                          key={status}
                          style={{
                            height: `${height}%`,
                            backgroundColor: statusColors[status],
                            minHeight: count > 0 ? 2 : 0
                          }}
                          title={`${status}: ${count}`}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between text-gray-500 pl-8 pt-1">
          <span>Day 1</span>
          {maxDay > 5 && <span>Day {Math.round(maxDay / 2)}</span>}
          <span>Day {maxDay}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {statusOrder.map(status => (
          <div key={status} className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: statusColors[status] }}
            />
            <span className="text-gray-400">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Intervention Overlay Info */}
      {history.some(h => h.interventionLevel > 0) && (
        <div className="bg-yellow-900/30 rounded p-2 text-xs">
          <span className="text-yellow-400">⚠️ Intervention detected</span>
          <div className="text-gray-400 mt-1">
            Max intervention: {Math.max(...history.map(h => Math.round((h.interventionLevel || 0) * 100)))}%
          </div>
        </div>
      )}

      {/* Latest Snapshot */}
      {history.length > 0 && (
        <div className="bg-gray-800 rounded p-3">
          <h4 className="text-gray-400 text-xs mb-2">Latest Snapshot (Day {history[history.length - 1].day})</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {statusOrder.map(status => (
              <div key={status} className="flex justify-between">
                <span className="text-gray-500">{status.slice(0, 3)}:</span>
                <span style={{ color: statusColors[status] }}>
                  {history[history.length - 1][status] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
