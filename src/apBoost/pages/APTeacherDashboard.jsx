import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
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
      <span className="text-lg flex-shrink-0">{icon}</span>
      {label}
    </Link>
  )
}

/**
 * Test card for dashboard
 */
function TestCard({ test }) {
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
        {test.isPublished ? (
          <Link
            to={`/ap/teacher/test/${test.id}/assign`}
            className="px-3 py-1 text-sm rounded-[--radius-button] bg-brand-primary text-white hover:opacity-90"
          >
            Assign
          </Link>
        ) : (
          <span className="px-3 py-1 text-sm rounded-[--radius-button] bg-muted text-text-muted cursor-not-allowed">
            Assign
          </span>
        )}
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

  // Seed data state (dev only)
  const [seeding, setSeeding] = useState(false)
  const [seedResult, setSeedResult] = useState(null)

  const handleSeedData = useCallback(async () => {
    if (seeding) return
    setSeeding(true)
    setSeedResult(null)
    try {
      const { seedFullData } = await import('../utils/seedFullData')
      const result = await seedFullData(user?.uid)
      setSeedResult({ success: true, message: `Seeded 3 tests, 55 questions (incl. 2 MCQ_MULTI, 2 with text stimuli), 5 students, 2 classes, 3 assignments, 13 results.` })
      // Reload dashboard data
      const [testsData, classesData, gradingData] = await Promise.all([
        getTeacherTests(user.uid),
        getTeacherClasses(user.uid),
        getPendingGradingList(user.uid),
      ])
      setTests(testsData)
      setClasses(classesData)
      setPendingGrading(gradingData)
    } catch (err) {
      console.error('Seed error:', err)
      const friendlyMsg = err.code === 'permission-denied'
        ? 'Seeding failed: Firestore permissions error. Make sure you are logged in as a teacher and rules are deployed.'
        : `Seeding failed: ${err.message}`
      setSeedResult({ success: false, message: friendlyMsg })
    } finally {
      setSeeding(false)
    }
  }, [user, seeding])

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
            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>}
            label="Create New Test"
            primary
          />
          <QuickActionButton
            to="/ap/teacher/questions"
            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M6 4.75A.75.75 0 016.75 4h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 4.75zM6 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75A.75.75 0 016 10zm0 5.25a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H6.75a.75.75 0 01-.75-.75zM1.99 4.75a1 1 0 011-1h.01a1 1 0 010 2h-.01a1 1 0 01-1-1zm0 5.25a1 1 0 011-1h.01a1 1 0 010 2h-.01a1 1 0 01-1-1zm1 4.25a1 1 0 100 2h.01a1 1 0 100-2h-.01z" clipRule="evenodd" /></svg>}
            label="Question Bank"
          />
          <QuickActionButton
            to="/ap/gradebook"
            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" /></svg>}
            label="Gradebook"
          />
          <QuickActionButton
            to="/ap/teacher/classes"
            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M7 8a3 3 0 100-6 3 3 0 000 6zM14.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 18a9.953 9.953 0 01-5.385-1.572zM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 00-1.588-3.755 4.502 4.502 0 015.874 2.636.818.818 0 01-.36.98A7.465 7.465 0 0114.5 16z" /></svg>}
            label="Manage Classes"
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
                  to="/ap/teacher/questions"
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

        {/* Dev: Seed Data */}
        {import.meta.env.DEV && (
          <div className="mt-8 p-4 bg-muted rounded-[--radius-card] border border-border-default">
            <h3 className="text-text-secondary text-sm font-medium mb-2">Developer Tools</h3>
            <button
              onClick={handleSeedData}
              disabled={seeding}
              className="px-4 py-2 bg-brand-primary text-white rounded-[--radius-button] text-sm hover:opacity-90 disabled:opacity-50"
            >
              {seeding ? 'Seeding...' : 'Seed Full Test Data (Micro, Macro, Calc AB)'}
            </button>
            {seedResult && (
              <p className={`mt-2 text-sm ${seedResult.success ? 'text-success-text' : 'text-error-text'}`}>
                {seedResult.message}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
