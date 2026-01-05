/**
 * SegmentDebugPanel - Collapsible debug panel showing review segment data
 *
 * Displays:
 * - Segment boundaries (startIndex, endIndex)
 * - Session config (day, intervention, allocation)
 * - Word-level detail (queue words with status/priority)
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { getDebugSessionData } from '../../services/studyService'
import { WORD_STATUS } from '../../types/studyTypes'

// Status display config
const STATUS_CONFIG = {
  [WORD_STATUS.FAILED]: { label: 'FAILED', color: 'text-red-600', bg: 'bg-red-50' },
  [WORD_STATUS.PASSED]: { label: 'PASSED', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  [WORD_STATUS.NEVER_TESTED]: { label: 'NEVER', color: 'text-gray-500', bg: 'bg-gray-50' },
  [WORD_STATUS.MASTERED]: { label: 'MASTERED', color: 'text-blue-600', bg: 'bg-blue-50' },
  [WORD_STATUS.NEEDS_CHECK]: { label: 'CHECK', color: 'text-amber-600', bg: 'bg-amber-50' },
}

// Format Firestore timestamp to short date
const formatDate = (timestamp) => {
  if (!timestamp) return '—'
  const date = timestamp.toDate?.() || new Date(timestamp)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SegmentDebugPanel({ classId, listId, userId, assignment }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const handleToggle = async () => {
    if (!isExpanded && !data) {
      // First expansion - fetch data
      await fetchData()
    }
    setIsExpanded(!isExpanded)
  }

  const fetchData = async () => {
    if (!userId || !classId || !listId) return

    setLoading(true)
    setError(null)
    try {
      const result = await getDebugSessionData(userId, classId, listId, assignment)
      setData(result)
    } catch (err) {
      console.error('Debug panel fetch error:', err)
      setError(err.message || 'Failed to load debug data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async (e) => {
    e.stopPropagation()
    await fetchData()
  }

  // Get status display
  const getStatusDisplay = (status) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG[WORD_STATUS.NEVER_TESTED]
  }

  // Determine priority reason for a word
  const getPriorityReason = (word, index) => {
    if (word.status === WORD_STATUS.FAILED) {
      // Check if it's from today's new words or segment
      if (word.introducedOnDay === data?.sessionConfig?.dayNumber) {
        return "Today's failed"
      }
      return 'Segment failed'
    }
    return 'Random fill'
  }

  return (
    <div className="mt-3 border border-dashed border-border-default rounded-lg overflow-hidden">
      {/* Header - always visible */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-inset transition-colors text-left"
      >
        <span className="text-xs font-mono font-medium text-text-muted">
          Debug Panel
        </span>
        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-1 rounded hover:bg-surface transition-colors"
              title="Refresh data"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 py-3 bg-surface border-t border-border-default text-xs">
          {loading && !data && (
            <div className="flex items-center justify-center py-4">
              <RefreshCw size={16} className="animate-spin text-text-muted" />
              <span className="ml-2 text-text-muted">Loading...</span>
            </div>
          )}

          {error && (
            <div className="p-2 bg-red-50 text-red-600 rounded">
              {error}
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {/* Session Config Section */}
              <div>
                <h4 className="font-bold text-text-primary mb-2 uppercase tracking-wide">
                  Session Config
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-text-secondary">
                  <div>Day: <span className="text-text-primary font-semibold">{data.sessionConfig?.dayNumber ?? '—'}</span></div>
                  <div>Intervention: <span className="text-text-primary font-semibold">{((data.sessionConfig?.interventionLevel ?? 0) * 100).toFixed(0)}%</span></div>
                  <div>Words Introduced: <span className="text-text-primary font-semibold">{data.sessionConfig?.totalWordsIntroduced ?? 0}</span></div>
                  <div>Total List Words: <span className="text-text-primary font-semibold">{data.sessionConfig?.totalListWords ?? 0}</span></div>
                </div>
              </div>

              {/* Segment Section */}
              <div>
                <h4 className="font-bold text-text-primary mb-2 uppercase tracking-wide">
                  Segment
                </h4>
                {data.sessionConfig?.segment ? (
                  <div className="font-mono text-text-secondary">
                    <div>
                      Range: <span className="text-text-primary font-semibold">
                        #{data.sessionConfig.segment.startIndex} - #{data.sessionConfig.segment.endIndex}
                      </span>
                      <span className="text-text-muted ml-2">
                        ({data.sessionConfig.segment.endIndex - data.sessionConfig.segment.startIndex + 1} words)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-text-muted italic">No segment (Day 1)</div>
                )}
              </div>

              {/* Allocation Section */}
              <div>
                <h4 className="font-bold text-text-primary mb-2 uppercase tracking-wide">
                  Allocation
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-text-secondary">
                  <div>New Words: <span className="text-text-primary font-semibold">{data.sessionConfig?.allocation?.newWords ?? 0}</span></div>
                  <div>Review Cap: <span className="text-text-primary font-semibold">{data.sessionConfig?.allocation?.reviewCap ?? 0}</span></div>
                  <div>Review Count: <span className="text-text-primary font-semibold">{data.sessionConfig?.reviewCount ?? 0}</span></div>
                  <div>Test Size (New): <span className="text-text-primary font-semibold">{data.sessionConfig?.testSizeNew ?? 0}</span></div>
                  <div>Test Size (Review): <span className="text-text-primary font-semibold">{data.sessionConfig?.testSizeReview ?? 0}</span></div>
                </div>
              </div>

              {/* Review Queue Section */}
              <div>
                <h4 className="font-bold text-text-primary mb-2 uppercase tracking-wide">
                  Review Queue ({data.reviewQueue?.length ?? 0} words)
                </h4>
                {data.reviewQueue?.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border border-border-default rounded">
                    <table className="w-full text-left">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-2 py-1 font-medium">#</th>
                          <th className="px-2 py-1 font-medium">Word</th>
                          <th className="px-2 py-1 font-medium">Status</th>
                          <th className="px-2 py-1 font-medium">Date</th>
                          <th className="px-2 py-1 font-medium">Priority</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {data.reviewQueue.map((word, idx) => {
                          const statusConfig = getStatusDisplay(word.status || word.studyState?.status)
                          return (
                            <tr key={word.id} className="border-t border-border-default hover:bg-muted/50">
                              <td className="px-2 py-1 text-text-muted">{word.position ?? idx}</td>
                              <td className="px-2 py-1 text-text-primary font-medium truncate max-w-[100px]" title={word.word}>
                                {word.word}
                              </td>
                              <td className="px-2 py-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusConfig.color} ${statusConfig.bg}`}>
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-text-muted text-[10px]">
                                {formatDate(word.studyState?.lastTestedAt)}
                              </td>
                              <td className="px-2 py-1 text-text-muted text-[10px]">
                                {getPriorityReason(word, idx)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-text-muted italic">No words in review queue</div>
                )}
              </div>

              {/* Full Segment Words Section */}
              {data.segmentWords && data.segmentWords.length > 0 && (
                <div>
                  <h4 className="font-bold text-text-primary mb-2 uppercase tracking-wide">
                    Full Segment ({data.segmentWords.length} words)
                  </h4>
                  <div className="max-h-48 overflow-y-auto border border-border-default rounded">
                    <table className="w-full text-left">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-2 py-1 font-medium">#</th>
                          <th className="px-2 py-1 font-medium">Word</th>
                          <th className="px-2 py-1 font-medium">Status</th>
                          <th className="px-2 py-1 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {data.segmentWords.map((word, idx) => {
                          const statusConfig = getStatusDisplay(word.status || word.studyState?.status)
                          return (
                            <tr key={word.id} className="border-t border-border-default hover:bg-muted/50">
                              <td className="px-2 py-1 text-text-muted">{word.position ?? idx}</td>
                              <td className="px-2 py-1 text-text-primary font-medium truncate max-w-[120px]" title={word.word}>
                                {word.word}
                              </td>
                              <td className="px-2 py-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${statusConfig.color} ${statusConfig.bg}`}>
                                  {statusConfig.label}
                                </span>
                              </td>
                              <td className="px-2 py-1 text-text-muted text-[10px]">
                                {formatDate(word.studyState?.lastTestedAt)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Graduated Words Section - Always visible */}
              <div>
                <h4 className="font-bold text-text-primary mb-2 uppercase tracking-wide">
                  Graduated ({data.masteredWords?.length ?? 0} words)
                </h4>
                {data.masteredWords?.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border border-border-default rounded">
                    <table className="w-full text-left">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="px-2 py-1 font-medium">#</th>
                          <th className="px-2 py-1 font-medium">Word</th>
                          <th className="px-2 py-1 font-medium">Graduated</th>
                          <th className="px-2 py-1 font-medium">Returns</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {data.masteredWords.map((word) => (
                          <tr key={word.id} className="border-t border-border-default hover:bg-muted/50">
                            <td className="px-2 py-1 text-text-muted">{word.position ?? word.studyState?.wordIndex}</td>
                            <td className="px-2 py-1 text-text-primary font-medium truncate max-w-[120px]" title={word.word}>
                              {word.word}
                            </td>
                            <td className="px-2 py-1 text-blue-600 text-[10px]">
                              {formatDate(word.studyState?.masteredAt)}
                            </td>
                            <td className="px-2 py-1 text-text-muted text-[10px]">
                              {formatDate(word.studyState?.returnAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-text-muted italic text-sm">
                    No graduated words yet. Complete a review test to graduate words.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
