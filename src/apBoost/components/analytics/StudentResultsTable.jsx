import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getAPScoreColor, getAPScoreTextColor } from '../../utils/performanceColors'

/**
 * Sortable header cell
 */
function SortableHeader({ label, sortKey, currentSort, currentOrder, onSort }) {
  const isActive = currentSort === sortKey
  const arrow = isActive ? (currentOrder === 'asc' ? '↑' : '↓') : ''

  return (
    <th
      className="text-left py-3 px-4 text-text-secondary font-medium cursor-pointer hover:bg-hover select-none"
      onClick={() => onSort(sortKey)}
    >
      {label} {arrow}
    </th>
  )
}

/**
 * AP Score badge
 */
function APScoreBadge({ score }) {
  const bgColor = getAPScoreColor(score)
  const textColor = getAPScoreTextColor(score)

  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${bgColor} ${textColor} font-bold text-sm`}>
      {score}
    </span>
  )
}

/**
 * StudentResultsTable - List of students with scores
 */
export default function StudentResultsTable({
  results = [],
  onStudentClick,
  onReportClick,
}) {
  const [sortKey, setSortKey] = useState('studentName')
  const [sortOrder, setSortOrder] = useState('asc')

  // Sort results
  const sortedResults = useMemo(() => {
    const sorted = [...results].sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]

      // Handle numeric values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }

      // Handle strings
      aVal = String(aVal || '').toLowerCase()
      bVal = String(bVal || '').toLowerCase()

      if (sortOrder === 'asc') {
        return aVal.localeCompare(bVal)
      } else {
        return bVal.localeCompare(aVal)
      }
    })

    return sorted
  }, [results, sortKey, sortOrder])

  // Handle sort change
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  if (results.length === 0) {
    return (
      <div className="bg-muted rounded-[--radius-card] p-8 text-center">
        <p className="text-text-muted">No student results available</p>
      </div>
    )
  }

  return (
    <div className="border border-border-default rounded-[--radius-card] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <SortableHeader
                label="Name"
                sortKey="studentName"
                currentSort={sortKey}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="Email"
                sortKey="studentEmail"
                currentSort={sortKey}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="MCQ"
                sortKey="mcqScore"
                currentSort={sortKey}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="FRQ"
                sortKey="frqScore"
                currentSort={sortKey}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="Total"
                sortKey="percentage"
                currentSort={sortKey}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <SortableHeader
                label="AP Score"
                sortKey="apScore"
                currentSort={sortKey}
                currentOrder={sortOrder}
                onSort={handleSort}
              />
              <th className="text-left py-3 px-4 text-text-secondary font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {sortedResults.map((result) => {
              // Calculate MCQ score from results
              const mcqCorrect = result.mcqResults?.filter(r => r.correct).length || 0
              const mcqTotal = result.mcqResults?.length || 0

              return (
                <tr
                  key={result.id}
                  className="border-t border-border-default hover:bg-hover"
                >
                  <td className="py-3 px-4">
                    <button
                      onClick={() => onStudentClick?.(result.userId)}
                      className="text-brand-primary hover:underline text-left"
                    >
                      {result.studentName}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-text-muted text-sm">
                    {result.studentEmail}
                  </td>
                  <td className="py-3 px-4 text-text-primary">
                    {mcqCorrect}/{mcqTotal}
                  </td>
                  <td className="py-3 px-4 text-text-primary">
                    {result.frqScore != null
                      ? `${result.frqScore}/${result.frqMaxPoints || '?'}`
                      : result.gradingStatus === 'pending'
                        ? <span className="text-warning-text">Pending</span>
                        : '—'
                    }
                  </td>
                  <td className="py-3 px-4 text-text-primary font-medium">
                    {result.percentage}%
                  </td>
                  <td className="py-3 px-4">
                    <APScoreBadge score={result.apScore || 1} />
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      to={`/ap/results/${result.id}`}
                      className="text-brand-primary hover:underline text-sm"
                      title="View Report Card"
                    >
                      View Report
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 bg-muted border-t border-border-default text-sm text-text-muted">
        Showing {sortedResults.length} student{sortedResults.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
