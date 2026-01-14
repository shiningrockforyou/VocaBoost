import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import { getTeacherTests, getTeacherClasses, getPendingGradingList } from '../services/apTeacherService'
import { logError } from '../utils/logError'

/**
 * Quick action button component
 */
function QuickActionButton({ to, icon, label, primary = false }) {
  return (
    <Link
      to={to}
      className={`
        flex items-center gap-2 px-4 py-3 rounded-[--radius-button] font-medium transition-colors
        ${primary
          ? 'bg-brand-primary text-white hover:opacity-90'
          : 'bg-surface border border-border-default text-text-primary hover:bg-hover'
        }
      `}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  )
}

/**
 * Test card for dashboard
 */
function TestCard({ test, onAssign }) {
  const mcqCount = test.sections?.reduce((acc, s) => {
    if (s.sectionType === 'MCQ') {
      return acc + (s.questionIds?.length || 0)
    }
    return acc
  }, 0) || 0

  const frqCount = test.sections?.reduce((acc, s) => {
    if (s.sectionType === 'FRQ') {
      return acc + (s.questionIds?.length || 0)
    }
    return acc
  }, 0) || 0

  const questionSummary = []
  if (mcqCount > 0) questionSummary.push(`${mcqCount} MCQ`)
  if (frqCount > 0) questionSummary.push(`${frqCount} FRQ`)

  return (
    <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 hover:shadow-theme-md transition-shadow">
      <h3 className="font-semibold text-text-primary mb-1 line-clamp-1">{test.title}</h3>
      <p className="text-text-muted text-sm mb-3">
        {questionSummary.length > 0 ? questionSummary.join(', ') : 'No questions'}
      </p>
      <div className="flex items-center gap-2">
        <Link
          to={`/ap/teacher/test/${test.id}/edit`}
          className="px-3 py-1 text-sm rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover"
        >
          Edit
        </Link>
        <button
          onClick={() => onAssign(test)}
          disabled={!test.isPublished}
          className={`
            px-3 py-1 text-sm rounded-[--radius-button]
            ${test.isPublished
              ? 'bg-brand-primary text-white hover:opacity-90'
              : 'bg-muted text-text-muted cursor-not-allowed'
            }
          `}
        >
          Assign
        </button>
      </div>
      {!test.isPublished && (
        <span className="text-xs text-warning-text mt-2 block">Draft - publish to assign</span>
      )}
    </div>
  )
}

/**
 * Class list item
 */
function ClassItem({ cls }) {
  const studentCount = cls.studentIds?.length || 0

  return (
    <div className="flex items-center justify-between py-2 border-b border-border-muted last:border-0">
      <div>
        <span className="text-text-primary">{cls.name}</span>
        {cls.period && (
          <span className="text-text-muted text-sm ml-2">Period {cls.period}</span>
        )}
      </div>
      <span className="text-text-secondary text-sm">
        {studentCount} student{studentCount !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

/**
 * Pending grading item
 */
function PendingGradingItem({ item }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border-muted last:border-0">
      <span className="text-text-secondary">
        {item.count} submission{item.count !== 1 ? 's' : ''} for {item.testTitle}
      </span>
    </div>
  )
}

/**
 * APTeacherDashboard - Teacher home page
 */
export default function APTeacherDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [tests, setTests] = useState([])
  const [classes, setClasses] = useState([])
  const [pendingGrading, setPendingGrading] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load dashboard data
  useEffect(() => {
    async function loadData() {
      if (!user) return

      try {
        setLoading(true)
        setError(null)

        const [testsData, classesData, gradingData] = await Promise.all([
          getTeacherTests(user.uid),
          getTeacherClasses(user.uid),
          getPendingGradingList(user.uid),
        ])

        setTests(testsData)
        setClasses(classesData)
        setPendingGrading(gradingData)
      } catch (err) {
        logError('APTeacherDashboard.loadData', { userId: user?.uid }, err)
        setError(err.message || 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user])

  // Handle assign button
  const handleAssign = (test) => {
    navigate(`/ap/teacher/test/${test.id}/assign`)
  }

  // Calculate total pending
  const totalPending = pendingGrading.reduce((acc, item) => acc + item.count, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6" />
            <div className="flex gap-4 mb-8">
              <div className="h-12 bg-muted rounded w-40" />
              <div className="h-12 bg-muted rounded w-40" />
              <div className="h-12 bg-muted rounded w-40" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-32 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-error rounded-[--radius-card] p-6 text-center">
            <p className="text-error-text-strong font-medium mb-2">Error loading dashboard</p>
            <p className="text-error-text">{error}</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page title */}
        <h1 className="text-2xl font-bold text-text-primary mb-6">Teacher Dashboard</h1>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <QuickActionButton
            to="/ap/teacher/test/new"
            icon="+"
            label="Create New Test"
            primary
          />
          <QuickActionButton
            to="/ap/teacher/questions"
            icon="Q"
            label="Question Bank"
          />
          <QuickActionButton
            to="/ap/gradebook"
            icon="G"
            label="Gradebook"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Tests */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-text-primary">
                  My Tests ({tests.length})
                </h2>
                <Link
                  to="/ap/teacher/tests"
                  className="text-brand-primary text-sm hover:underline"
                >
                  View All
                </Link>
              </div>

              {tests.length === 0 ? (
                <p className="text-text-muted text-center py-8">
                  No tests yet. Create your first test to get started.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {tests.slice(0, 4).map(test => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onAssign={handleAssign}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pending Grading */}
            <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
              <h2 className="font-semibold text-text-primary mb-3">
                Pending Grading ({totalPending})
              </h2>

              {pendingGrading.length === 0 ? (
                <p className="text-text-muted text-sm">No submissions to grade.</p>
              ) : (
                <>
                  <div className="mb-3">
                    {pendingGrading.slice(0, 3).map(item => (
                      <PendingGradingItem key={item.testId} item={item} />
                    ))}
                  </div>
                  <Link
                    to="/ap/gradebook"
                    className="text-brand-primary text-sm hover:underline"
                  >
                    Go to Gradebook
                  </Link>
                </>
              )}
            </div>

            {/* My Classes */}
            <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
              <h2 className="font-semibold text-text-primary mb-3">
                My Classes ({classes.length})
              </h2>

              {classes.length === 0 ? (
                <p className="text-text-muted text-sm">No classes found.</p>
              ) : (
                <div>
                  {classes.slice(0, 5).map(cls => (
                    <ClassItem key={cls.id} cls={cls} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
