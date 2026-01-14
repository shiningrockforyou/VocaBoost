import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import FilterBar from '../components/analytics/FilterBar'
import PerformanceGrid from '../components/analytics/PerformanceGrid'
import MCQDetailedView from '../components/analytics/MCQDetailedView'
import QuestionDetailModal from '../components/analytics/QuestionDetailModal'
import FRQCard from '../components/analytics/FRQCard'
import StudentResultsTable from '../components/analytics/StudentResultsTable'
import {
  getTestAnalytics,
  getStudentResults,
  getClassesForFilter,
  getStudentsForFilter,
  calculateResponseDistribution,
} from '../services/apAnalyticsService'
import { logError } from '../utils/logError'

/**
 * Summary stats card
 */
function SummaryCard({ label, value, subtext }) {
  return (
    <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
      <div className="text-text-muted text-sm">{label}</div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      {subtext && <div className="text-text-muted text-xs">{subtext}</div>}
    </div>
  )
}

/**
 * AP Score distribution chart
 */
function APScoreDistribution({ distribution }) {
  const scores = [5, 4, 3, 2, 1]
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)

  return (
    <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
      <h4 className="text-text-secondary text-sm font-medium mb-3">AP Score Distribution</h4>
      <div className="space-y-2">
        {scores.map(score => {
          const count = distribution[score] || 0
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0

          return (
            <div key={score} className="flex items-center gap-2">
              <span className="text-text-primary font-medium w-4">{score}</span>
              <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-primary transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-text-muted text-sm w-16 text-right">
                {count} ({percentage}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * APExamAnalytics - Exam analytics dashboard
 */
export default function APExamAnalytics() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Data state
  const [analytics, setAnalytics] = useState(null)
  const [studentResults, setStudentResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filter state
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [selectedClasses, setSelectedClasses] = useState([])
  const [selectedStudents, setSelectedStudents] = useState([])

  // View state
  const [mcqView, setMcqView] = useState('grid') // 'grid' | 'detailed'
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [distributions, setDistributions] = useState({})

  // Load initial data
  useEffect(() => {
    async function loadData() {
      if (!testId || !user) return

      try {
        setLoading(true)
        setError(null)

        // Load classes for filter
        const classesData = await getClassesForFilter(user.uid)
        setClasses(classesData)

        // Select all classes by default
        const allClassIds = classesData.map(c => c.id)
        setSelectedClasses(allClassIds)

        // Load students for those classes
        const studentsData = await getStudentsForFilter(allClassIds)
        setStudents(studentsData)
        setSelectedStudents(studentsData.map(s => s.id))

        // Load analytics
        const analyticsData = await getTestAnalytics(testId, {
          classIds: allClassIds,
          studentIds: studentsData.map(s => s.id),
        })
        setAnalytics(analyticsData)

        // Load student results
        const results = await getStudentResults(testId, {
          classIds: allClassIds,
          studentIds: studentsData.map(s => s.id),
        })
        setStudentResults(results)

        // Pre-calculate distributions for MCQ
        const dists = {}
        for (const questionId of Object.keys(analyticsData.mcqPerformance || {})) {
          const { distribution } = calculateResponseDistribution(results, questionId)
          dists[questionId] = distribution
        }
        setDistributions(dists)
      } catch (err) {
        logError('APExamAnalytics.loadData', { testId }, err)
        setError(err.message || 'Failed to load analytics')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [testId, user])

  // Handle class filter change
  const handleClassChange = useCallback(async (classIds) => {
    setSelectedClasses(classIds)

    // Update students based on selected classes
    const studentsData = await getStudentsForFilter(classIds)
    setStudents(studentsData)
    setSelectedStudents(studentsData.map(s => s.id))
  }, [])

  // Apply filters
  const handleApplyFilters = useCallback(async () => {
    try {
      setLoading(true)

      const analyticsData = await getTestAnalytics(testId, {
        classIds: selectedClasses,
        studentIds: selectedStudents,
      })
      setAnalytics(analyticsData)

      const results = await getStudentResults(testId, {
        classIds: selectedClasses,
        studentIds: selectedStudents,
      })
      setStudentResults(results)

      // Update distributions
      const dists = {}
      for (const questionId of Object.keys(analyticsData.mcqPerformance || {})) {
        const { distribution } = calculateResponseDistribution(results, questionId)
        dists[questionId] = distribution
      }
      setDistributions(dists)
    } catch (err) {
      logError('APExamAnalytics.applyFilters', { testId }, err)
      setError(err.message || 'Failed to apply filters')
    } finally {
      setLoading(false)
    }
  }, [testId, selectedClasses, selectedStudents])

  // Handle question click
  const handleQuestionClick = (questionId) => {
    setSelectedQuestion(questionId)
  }

  // Handle student click
  const handleStudentClick = (userId) => {
    navigate(`/ap/teacher/student/${userId}`)
  }

  if (loading && !analytics) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6" />
            <div className="h-24 bg-muted rounded mb-6" />
            <div className="h-64 bg-muted rounded mb-6" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="bg-error rounded-[--radius-card] p-6">
            <h2 className="text-xl font-semibold text-error-text-strong mb-2">
              Error Loading Analytics
            </h2>
            <p className="text-error-text mb-4">{error}</p>
            <button
              onClick={() => navigate('/ap/teacher')}
              className="bg-surface text-text-primary px-4 py-2 rounded-[--radius-button] border border-border-default hover:bg-hover"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const { test, questions, mcqPerformance, frqPerformance, summary } = analytics || {}

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Exam Analytics
            </h1>
            <p className="text-text-muted">
              {test?.title || 'Practice Test'}
            </p>
          </div>
          <button
            onClick={() => navigate('/ap/teacher')}
            className="text-text-muted hover:text-text-primary"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <FilterBar
            classes={classes}
            students={students}
            selectedClasses={selectedClasses}
            selectedStudents={selectedStudents}
            onClassChange={handleClassChange}
            onStudentChange={setSelectedStudents}
            onApply={handleApplyFilters}
          />
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Total Students"
            value={analytics?.totalStudents || 0}
          />
          <SummaryCard
            label="Average Score"
            value={`${summary?.averagePercentage || 0}%`}
            subtext={`${summary?.averageScore || 0} pts`}
          />
          <SummaryCard
            label="Highest Score"
            value={`${summary?.highestScore || 0} pts`}
          />
          <SummaryCard
            label="Lowest Score"
            value={`${summary?.lowestScore || 0} pts`}
          />
        </div>

        {/* AP Score distribution */}
        {summary?.apScoreDistribution && (
          <div className="mb-6">
            <APScoreDistribution distribution={summary.apScoreDistribution} />
          </div>
        )}

        {/* MCQ Section */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">
              Section 1: Multiple Choice Performance
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMcqView('grid')}
                className={`px-3 py-1 text-sm rounded-[--radius-button] ${
                  mcqView === 'grid'
                    ? 'bg-brand-primary text-white'
                    : 'bg-muted text-text-secondary hover:bg-hover'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setMcqView('detailed')}
                className={`px-3 py-1 text-sm rounded-[--radius-button] ${
                  mcqView === 'detailed'
                    ? 'bg-brand-primary text-white'
                    : 'bg-muted text-text-secondary hover:bg-hover'
                }`}
              >
                Detailed
              </button>
            </div>
          </div>

          {mcqView === 'grid' ? (
            <PerformanceGrid
              performance={mcqPerformance}
              questions={questions}
              onQuestionClick={handleQuestionClick}
            />
          ) : (
            <MCQDetailedView
              performance={mcqPerformance}
              questions={questions}
              distributions={distributions}
              onQuestionClick={handleQuestionClick}
              onBackToGrid={() => setMcqView('grid')}
            />
          )}
        </div>

        {/* FRQ Section */}
        {frqPerformance && Object.keys(frqPerformance).length > 0 && (
          <div className="bg-surface rounded-[--radius-card] border border-border-default p-6 mb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Section 2: Free Response Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(frqPerformance).map(([questionId, perf], index) => (
                <FRQCard
                  key={questionId}
                  questionNumber={index + 1}
                  question={questions[questionId]}
                  performance={perf}
                />
              ))}
            </div>
          </div>
        )}

        {/* Student Results */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Student Results ({studentResults.length} students)
          </h2>
          <StudentResultsTable
            results={studentResults}
            onStudentClick={handleStudentClick}
          />
        </div>
      </main>

      {/* Question Detail Modal */}
      {selectedQuestion && (
        <QuestionDetailModal
          question={questions[selectedQuestion]}
          questionNumber={
            Object.keys(mcqPerformance || {}).indexOf(selectedQuestion) + 1
          }
          distribution={distributions[selectedQuestion] || {}}
          totalResponses={analytics?.totalStudents || 0}
          onClose={() => setSelectedQuestion(null)}
        />
      )}
    </div>
  )
}
