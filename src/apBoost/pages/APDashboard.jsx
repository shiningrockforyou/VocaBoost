import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import { getAvailableTests, getTestMeta } from '../services/apTestService'
import { getActiveSession } from '../services/apSessionService'
import { getSubjectConfig, formatTimeMinutes, calculateTotalTime } from '../utils/apTestConfig'
import { SESSION_STATUS } from '../utils/apTypes'

/**
 * Test card component
 */
function TestCard({ test, assignment, session, attemptCount, onClick }) {
  const subjectConfig = getSubjectConfig(test.subject)
  const totalTime = calculateTotalTime(test.sections || [])

  // Determine status
  let status = 'Not Started'
  let statusColor = 'bg-muted text-text-secondary'

  if (session?.status === SESSION_STATUS.IN_PROGRESS) {
    status = 'In Progress'
    statusColor = 'bg-info text-info-text'
  } else if (attemptCount > 0) {
    status = 'Completed'
    statusColor = 'bg-success text-success-text'
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface rounded-[--radius-card] shadow-theme-md p-4 border border-border-default hover:shadow-theme-lg transition-shadow"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-text-primary text-lg">{test.title}</h3>
        <span className={`text-xs px-2 py-1 rounded-[--radius-button-sm] ${statusColor}`}>
          {status}
        </span>
      </div>

      <p className="text-text-secondary text-sm mb-3">{subjectConfig.name}</p>

      <div className="flex items-center gap-4 text-text-muted text-sm">
        <span>{test.sections?.length || 0} sections</span>
        <span>{formatTimeMinutes(totalTime)}</span>
      </div>

      {assignment?.dueDate && (
        <p className="text-text-muted text-sm mt-2">
          Due: {assignment.dueDate.toDate?.().toLocaleDateString() || 'N/A'}
        </p>
      )}

      {session?.status === SESSION_STATUS.IN_PROGRESS && (
        <p className="text-info-text text-sm mt-2">
          Section {session.currentSectionIndex + 1}, Q{session.currentQuestionIndex + 1}
        </p>
      )}
    </button>
  )
}

/**
 * Loading skeleton for test cards
 */
function TestCardSkeleton() {
  return (
    <div className="bg-surface rounded-[--radius-card] shadow-theme-md p-4 border border-border-default animate-pulse">
      <div className="h-6 bg-muted rounded w-3/4 mb-2" />
      <div className="h-4 bg-muted rounded w-1/2 mb-3" />
      <div className="flex gap-4">
        <div className="h-4 bg-muted rounded w-20" />
        <div className="h-4 bg-muted rounded w-16" />
      </div>
    </div>
  )
}

export default function APDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tests, setTests] = useState([])
  const [sessions, setSessions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadTests() {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        // Fetch available tests
        const availableTests = await getAvailableTests(user.uid, user.role)
        setTests(availableTests)

        // Fetch active sessions for each test
        const sessionMap = {}
        for (const test of availableTests) {
          const session = await getActiveSession(test.id, user.uid)
          if (session) {
            sessionMap[test.id] = session
          }
        }
        setSessions(sessionMap)
      } catch (err) {
        console.error('Error loading tests:', err)
        setError('Failed to load tests. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadTests()
  }, [user])

  const handleTestClick = (test, assignment) => {
    if (assignment) {
      navigate(`/ap/test/${test.id}/assignment/${assignment.id}`)
    } else {
      navigate(`/ap/test/${test.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-text-primary mb-6">AP Practice Tests</h1>

        {error && (
          <div className="bg-error rounded-[--radius-alert] p-4 mb-6 text-error-text">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <TestCardSkeleton key={i} />
            ))}
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-lg">No tests available.</p>
            <p className="text-text-faint mt-2">
              Tests will appear here once your teacher assigns them.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tests.map((item) => (
              <TestCard
                key={item.test?.id || item.id}
                test={item.test || item}
                assignment={item.assignment}
                session={sessions[item.test?.id || item.id]}
                attemptCount={item.attemptCount || 0}
                onClick={() => handleTestClick(item.test || item, item.assignment)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
