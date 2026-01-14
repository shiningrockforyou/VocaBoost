import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import GradingPanel from '../components/grading/GradingPanel'
import { getPendingGrades, getTestsForGrading, getTeacherClasses } from '../services/apGradingService'
import { GRADING_STATUS } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * Status badge component
 */
function StatusBadge({ status }) {
  const configs = {
    [GRADING_STATUS.PENDING]: {
      bg: 'bg-warning/20',
      text: 'text-warning-text-strong',
      label: 'Pending',
      icon: '⏳',
    },
    [GRADING_STATUS.IN_PROGRESS]: {
      bg: 'bg-info/20',
      text: 'text-info-text-strong',
      label: 'In Progress',
      icon: '✏️',
    },
    [GRADING_STATUS.COMPLETE]: {
      bg: 'bg-success/20',
      text: 'text-success-text',
      label: 'Complete',
      icon: '✓',
    },
  }

  const config = configs[status] || configs[GRADING_STATUS.PENDING]

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-[--radius-button] text-sm ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  )
}

/**
 * Filter dropdown component
 */
function FilterDropdown({ label, value, options, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-text-secondary text-sm">{label}:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Gradebook table row
 */
function GradebookRow({ result, onGrade, onView }) {
  const isPending = result.gradingStatus === GRADING_STATUS.PENDING || result.gradingStatus === GRADING_STATUS.IN_PROGRESS
  const completedDate = result.completedAt?.toDate?.().toLocaleDateString() || 'N/A'

  return (
    <tr className="border-b border-border-muted hover:bg-hover transition-colors">
      <td className="py-3 px-4 text-text-primary">{result.studentName}</td>
      <td className="py-3 px-4 text-text-secondary">{result.testTitle}</td>
      <td className="py-3 px-4 text-text-muted text-sm">{completedDate}</td>
      <td className="py-3 px-4">
        <StatusBadge status={result.gradingStatus} />
      </td>
      <td className="py-3 px-4 text-right">
        {isPending ? (
          <button
            onClick={() => onGrade(result.id)}
            className="px-4 py-1 rounded-[--radius-button] bg-brand-primary text-white text-sm font-medium hover:opacity-90"
          >
            Grade
          </button>
        ) : (
          <button
            onClick={() => onView(result.id)}
            className="px-4 py-1 rounded-[--radius-button] border border-border-default text-text-secondary text-sm hover:bg-hover"
          >
            View
          </button>
        )}
      </td>
    </tr>
  )
}

/**
 * APGradebook - Teacher grading list page
 */
export default function APGradebook() {
  const { user } = useAuth()

  // Data state
  const [results, setResults] = useState([])
  const [tests, setTests] = useState([])
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('pending')
  const [testFilter, setTestFilter] = useState('all')
  const [classFilter, setClassFilter] = useState('all')

  // Panel state
  const [selectedResultId, setSelectedResultId] = useState(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  // Load filter options
  useEffect(() => {
    async function loadFilters() {
      if (!user) return

      try {
        const [testsData, classesData] = await Promise.all([
          getTestsForGrading(),
          getTeacherClasses(user.uid),
        ])
        setTests(testsData)
        setClasses(classesData)
      } catch (err) {
        logError('APGradebook.loadFilters', { userId: user?.uid }, err)
      }
    }

    loadFilters()
  }, [user])

  // Load results based on filters
  useEffect(() => {
    async function loadResults() {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        const filters = {}
        if (statusFilter !== 'all') {
          if (statusFilter === 'pending') {
            filters.status = null // Will use default pending filter
          } else {
            filters.status = statusFilter
          }
        }
        if (testFilter !== 'all') {
          filters.testId = testFilter
        }
        if (classFilter !== 'all') {
          filters.classId = classFilter
        }

        const data = await getPendingGrades(user.uid, filters)
        setResults(data)
      } catch (err) {
        logError('APGradebook.loadResults', { userId: user?.uid }, err)
        setError(err.message || 'Failed to load gradebook')
      } finally {
        setLoading(false)
      }
    }

    loadResults()
  }, [user, statusFilter, testFilter, classFilter])

  // Handle grade action
  const handleGrade = (resultId) => {
    setSelectedResultId(resultId)
    setIsPanelOpen(true)
  }

  // Handle view action (same as grade for now)
  const handleView = (resultId) => {
    setSelectedResultId(resultId)
    setIsPanelOpen(true)
  }

  // Handle panel close
  const handleClosePanel = () => {
    setIsPanelOpen(false)
    setSelectedResultId(null)
  }

  // Handle save (refresh list)
  const handleSave = async () => {
    // Refresh the results list
    const filters = {}
    if (statusFilter !== 'all' && statusFilter !== 'pending') {
      filters.status = statusFilter
    }
    if (testFilter !== 'all') {
      filters.testId = testFilter
    }
    if (classFilter !== 'all') {
      filters.classId = classFilter
    }

    try {
      const data = await getPendingGrades(user.uid, filters)
      setResults(data)
    } catch (err) {
      logError('APGradebook.refresh', { userId: user?.uid }, err)
    }
  }

  // Filter options
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: GRADING_STATUS.IN_PROGRESS, label: 'In Progress' },
    { value: GRADING_STATUS.COMPLETE, label: 'Complete' },
    { value: 'all', label: 'All' },
  ]

  const testOptions = [
    { value: 'all', label: 'All Tests' },
    ...tests.map(t => ({ value: t.id, label: t.title })),
  ]

  const classOptions = [
    { value: 'all', label: 'All Classes' },
    ...classes.map(c => ({ value: c.id, label: c.name })),
  ]

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Gradebook</h1>
          <p className="text-text-secondary">
            Review and grade student FRQ submissions
          </p>
        </div>

        {/* Filters */}
        <div className="bg-surface rounded-[--radius-card] shadow-theme-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <FilterDropdown
              label="Status"
              value={statusFilter}
              options={statusOptions}
              onChange={setStatusFilter}
            />
            <FilterDropdown
              label="Test"
              value={testFilter}
              options={testOptions}
              onChange={setTestFilter}
            />
            <FilterDropdown
              label="Class"
              value={classFilter}
              options={classOptions}
              onChange={setClassFilter}
            />
          </div>
        </div>

        {/* Results table */}
        <div className="bg-surface rounded-[--radius-card] shadow-theme-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-pulse">
                <div className="h-8 bg-muted rounded w-1/3 mx-auto mb-4" />
                <div className="h-32 bg-muted rounded" />
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <div className="bg-error rounded-[--radius-alert] p-4 inline-block">
                <p className="text-error-text">{error}</p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-muted">No submissions found matching your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-default bg-muted">
                    <th className="text-left py-3 px-4 text-text-secondary font-medium">Student</th>
                    <th className="text-left py-3 px-4 text-text-secondary font-medium">Test</th>
                    <th className="text-left py-3 px-4 text-text-secondary font-medium">Submitted</th>
                    <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
                    <th className="text-right py-3 px-4 text-text-secondary font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <GradebookRow
                      key={result.id}
                      result={result}
                      onGrade={handleGrade}
                      onView={handleView}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        {!loading && !error && results.length > 0 && (
          <div className="mt-4 text-text-muted text-sm">
            Showing {results.length} submission{results.length !== 1 ? 's' : ''}
          </div>
        )}
      </main>

      {/* Grading panel */}
      {isPanelOpen && selectedResultId && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClosePanel}
          />
          <GradingPanel
            resultId={selectedResultId}
            onClose={handleClosePanel}
            onSave={handleSave}
            teacherId={user?.uid}
          />
        </>
      )}
    </div>
  )
}
