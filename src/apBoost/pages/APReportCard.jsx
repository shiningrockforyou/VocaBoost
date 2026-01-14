import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import { getTestResult } from '../services/apScoringService'
import { getTestMeta } from '../services/apTestService'
import { getSubjectConfig } from '../utils/apTestConfig'
import { GRADING_STATUS, FRQ_SUBMISSION_TYPE } from '../utils/apTypes'

/**
 * Score badge component
 */
function APScoreBadge({ score, isPending = false }) {
  const colors = {
    5: 'bg-success text-success-text-strong',
    4: 'bg-info text-info-text-strong',
    3: 'bg-warning text-warning-text-strong',
    2: 'bg-error-bg-subtle text-error-text-strong',
    1: 'bg-error text-error-text-strong',
  }

  if (isPending) {
    return (
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-[--radius-card] bg-muted text-text-secondary">
        <div className="text-center">
          <div className="text-xs uppercase tracking-wide opacity-75">AP Score</div>
          <div className="text-2xl font-bold">⏳</div>
          <div className="text-xs">Pending</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center justify-center w-24 h-24 rounded-[--radius-card] ${colors[score] || 'bg-muted text-text-secondary'}`}>
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide opacity-75">AP Score</div>
        <div className="text-4xl font-bold">{score || '—'}</div>
      </div>
    </div>
  )
}

/**
 * Section score bar
 */
function SectionScoreBar({ label, earned, total, percentage, isPending = false }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-text-secondary text-sm w-32 shrink-0">{label}</span>
      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
        {!isPending && (
          <div
            className="h-full bg-brand-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
      <span className="text-text-primary text-sm w-24 text-right">
        {isPending ? (
          <span className="text-text-muted">--/{total} (pending)</span>
        ) : (
          `${earned}/${total} (${percentage}%)`
        )}
      </span>
    </div>
  )
}

/**
 * MCQ Results Table
 */
function MCQResultsTable({ results }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default">
            <th className="text-left py-2 px-3 text-text-secondary font-medium">Q#</th>
            <th className="text-left py-2 px-3 text-text-secondary font-medium">Correct</th>
            <th className="text-left py-2 px-3 text-text-secondary font-medium">Your Answer</th>
            <th className="text-left py-2 px-3 text-text-secondary font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, idx) => {
            const isCorrect = result.correct
            return (
              <tr key={idx} className="border-b border-border-muted">
                <td className="py-2 px-3 text-text-primary">{idx + 1}</td>
                <td className="py-2 px-3 text-text-primary font-mono">{result.correctAnswer}</td>
                <td className="py-2 px-3 text-text-primary font-mono">
                  {result.studentAnswer || '—'}
                </td>
                <td className="py-2 px-3">
                  {isCorrect ? (
                    <span className="text-success-text">✓</span>
                  ) : (
                    <span className="text-error-text">✗</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * FRQ Submitted Answers (read-only display)
 */
function FRQSubmittedAnswers({ frqAnswers }) {
  if (!frqAnswers || Object.keys(frqAnswers).length === 0) {
    return (
      <p className="text-text-muted text-sm italic">No FRQ answers submitted.</p>
    )
  }

  return (
    <div className="space-y-4">
      {Object.entries(frqAnswers).map(([questionId, answers], qIdx) => {
        // answers can be an object { a: "...", b: "...", c: "..." } or a string
        const isSubQuestionFormat = typeof answers === 'object'

        return (
          <div key={questionId} className="border border-border-default rounded-[--radius-input] p-4">
            <h4 className="text-text-primary font-medium mb-3">Question {qIdx + 1}</h4>
            {isSubQuestionFormat ? (
              <div className="space-y-3">
                {Object.entries(answers).map(([subLabel, answer]) => (
                  <div key={subLabel}>
                    <span className="text-text-secondary text-sm font-medium">({subLabel})</span>
                    <div className="mt-1 p-3 bg-muted rounded-[--radius-input] text-text-primary text-sm whitespace-pre-wrap">
                      {answer || <span className="text-text-muted italic">No response</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-muted rounded-[--radius-input] text-text-primary text-sm whitespace-pre-wrap">
                {answers || <span className="text-text-muted italic">No response</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * FRQ Graded Results
 */
function FRQGradedResults({ frqGrades, totalPoints }) {
  if (!frqGrades || Object.keys(frqGrades).length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {Object.entries(frqGrades).map(([questionId, grade], qIdx) => (
        <div key={questionId} className="border border-border-default rounded-[--radius-input] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-text-primary font-medium">Question {qIdx + 1}</h4>
            <span className="text-text-secondary text-sm">
              {Object.values(grade.subScores || {}).reduce((a, b) => a + b, 0)} / {grade.maxPoints || '?'} pts
            </span>
          </div>

          {/* Sub-question scores */}
          {grade.subScores && (
            <div className="space-y-2 mb-3">
              {Object.entries(grade.subScores).map(([subLabel, score]) => (
                <div key={subLabel} className="flex items-center gap-2">
                  <span className="text-text-secondary text-sm">({subLabel})</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-primary"
                      style={{ width: `${(score / 3) * 100}%` }}
                    />
                  </div>
                  <span className="text-text-primary text-sm">{score} pts</span>
                </div>
              ))}
            </div>
          )}

          {/* Teacher comment */}
          {grade.comment && (
            <div className="mt-3 p-3 bg-info/10 rounded-[--radius-input]">
              <span className="text-info-text-strong text-sm font-medium">Teacher Feedback:</span>
              <p className="text-text-primary text-sm mt-1">{grade.comment}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Handwritten Submission Files Display
 */
function HandwrittenFilesSection({ files, annotatedPdfUrl, isGradingComplete }) {
  if (!files || files.length === 0) {
    return null
  }

  return (
    <div className="border border-border-default rounded-[--radius-card] p-4">
      <h4 className="text-text-primary font-medium mb-3">Handwritten Submission</h4>

      {/* Uploaded files list */}
      <div className="space-y-2 mb-4">
        {files.map((file, index) => (
          <div key={index} className="flex items-center gap-3 p-2 bg-muted rounded-[--radius-sm]">
            <span className="text-text-muted text-sm">Page {index + 1}</span>
            <span className="flex-1 text-text-primary text-sm truncate">
              {file.originalName || file.name}
            </span>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-primary text-sm hover:underline"
            >
              View
            </a>
          </div>
        ))}
      </div>

      {/* Teacher's annotated PDF */}
      {isGradingComplete && annotatedPdfUrl && (
        <div className="p-3 bg-success rounded-[--radius-sm]">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-success-text-strong font-medium">Teacher's Annotated Feedback</span>
              <p className="text-success-text text-sm mt-1">
                Your teacher has provided annotated feedback on your submission.
              </p>
            </div>
            <a
              href={annotatedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface text-brand-primary px-4 py-2 rounded-[--radius-button] border border-border-default hover:bg-hover text-sm font-medium"
              download
            >
              Download PDF
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function APReportCard() {
  const { resultId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [result, setResult] = useState(null)
  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadResult() {
      try {
        setLoading(true)
        setError(null)

        const resultData = await getTestResult(resultId)
        if (!resultData) {
          throw new Error('Result not found')
        }
        setResult(resultData)

        // Load test metadata
        const testData = await getTestMeta(resultData.testId)
        setTest(testData)
      } catch (err) {
        console.error('Error loading result:', err)
        setError(err.message || 'Failed to load results')
      } finally {
        setLoading(false)
      }
    }

    if (resultId) {
      loadResult()
    }
  }, [resultId])

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6" />
            <div className="h-24 bg-muted rounded mb-6" />
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
              Error Loading Results
            </h2>
            <p className="text-error-text mb-4">{error}</p>
            <button
              onClick={() => navigate('/ap')}
              className="bg-surface text-text-primary px-4 py-2 rounded-[--radius-button] border border-border-default hover:bg-hover"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const subjectConfig = test ? getSubjectConfig(test.subject) : null

  // Grading status
  const gradingStatus = result?.gradingStatus || GRADING_STATUS.NOT_NEEDED
  const isGradingComplete = gradingStatus === GRADING_STATUS.COMPLETE || gradingStatus === GRADING_STATUS.NOT_NEEDED
  const hasFRQ = result?.frqAnswers && Object.keys(result.frqAnswers).length > 0

  // Calculate MCQ results for display
  const mcqResults = result?.mcqResults || []
  const frqAnswers = result?.frqAnswers || {}
  const frqGrades = result?.frqGrades || {}

  // FRQ points
  const frqMaxPoints = result?.frqMaxPoints || 0
  const frqEarnedPoints = isGradingComplete ? (result?.frqScore || 0) : 0

  // Handwritten submission data
  const isHandwritten = result?.frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
  const uploadedFiles = result?.frqUploadedFiles || []
  const annotatedPdfUrl = result?.annotatedPdfUrl

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-surface rounded-[--radius-card] shadow-theme-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-text-primary text-center mb-2">
            SCORE REPORT
          </h1>

          {/* Grading status banner */}
          {hasFRQ && !isGradingComplete && (
            <div className="mb-4 p-3 bg-warning/20 rounded-[--radius-alert] flex items-center gap-2">
              <span className="text-xl">⏳</span>
              <span className="text-warning-text-strong text-sm">
                Free Response section is awaiting teacher grading. Final AP score will be calculated after grading is complete.
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between text-text-secondary text-sm mb-6">
            <div>
              <p>Student: {user?.displayName || user?.email || 'Student'}</p>
              <p>Test: {test?.title || 'AP Practice Exam'}</p>
            </div>
            <div className="text-right">
              <p>Subject: {subjectConfig?.name || 'AP Exam'}</p>
              <p>Date: {result?.completedAt?.toDate?.().toLocaleDateString() || new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* AP Score */}
          <div className="flex justify-center mb-6">
            <APScoreBadge score={result?.apScore} isPending={hasFRQ && !isGradingComplete} />
          </div>

          {/* Section scores */}
          <div className="space-y-3">
            {/* MCQ Section */}
            {result?.sectionScores && Object.entries(result.sectionScores).map(([sectionId, scores]) => (
              <SectionScoreBar
                key={sectionId}
                label={`Section ${parseInt(sectionId) + 1} (MCQ)`}
                earned={scores.correct}
                total={scores.total}
                percentage={Math.round((scores.correct / scores.total) * 100)}
              />
            ))}

            {/* FRQ Section */}
            {hasFRQ && (
              <SectionScoreBar
                label="Free Response"
                earned={frqEarnedPoints}
                total={frqMaxPoints}
                percentage={frqMaxPoints > 0 ? Math.round((frqEarnedPoints / frqMaxPoints) * 100) : 0}
                isPending={!isGradingComplete}
              />
            )}
          </div>

          {/* Total */}
          <div className="mt-4 pt-4 border-t border-border-default text-center">
            {isGradingComplete ? (
              <p className="text-text-primary">
                Total: {result?.score}/{result?.maxScore} pts ({result?.percentage}%)
              </p>
            ) : (
              <p className="text-text-muted">
                Total: Pending FRQ grading
              </p>
            )}
          </div>
        </div>

        {/* MCQ Results Table */}
        {mcqResults.length > 0 && (
          <div className="bg-surface rounded-[--radius-card] shadow-theme-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Section 1: Multiple Choice Results
            </h2>
            <MCQResultsTable results={mcqResults} />
            <p className="text-text-muted text-sm mt-4">
              MCQ Summary: {mcqResults.filter(r => r.correct).length}/{mcqResults.length} correct (
              {Math.round((mcqResults.filter(r => r.correct).length / mcqResults.length) * 100)}%)
            </p>
          </div>
        )}

        {/* FRQ Section */}
        {hasFRQ && (
          <div className="bg-surface rounded-[--radius-card] shadow-theme-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                Section 2: Free Response
              </h2>
              {!isGradingComplete && (
                <span className="flex items-center gap-1 text-warning-text-strong text-sm bg-warning/20 px-2 py-1 rounded-[--radius-button]">
                  <span>⏳</span> Awaiting Grade
                </span>
              )}
            </div>

            {/* Graded results (if complete) */}
            {isGradingComplete && Object.keys(frqGrades).length > 0 && (
              <div className="mb-6">
                <h3 className="text-text-secondary text-sm font-medium mb-3">Graded Results</h3>
                <FRQGradedResults frqGrades={frqGrades} />
              </div>
            )}

            {/* Handwritten submission files */}
            {isHandwritten && (
              <div className="mb-6">
                <HandwrittenFilesSection
                  files={uploadedFiles}
                  annotatedPdfUrl={annotatedPdfUrl}
                  isGradingComplete={isGradingComplete}
                />
              </div>
            )}

            {/* Student's submitted answers (for typed submissions) */}
            {!isHandwritten && (
              <div>
                <h3 className="text-text-secondary text-sm font-medium mb-3">Your Submitted Answers</h3>
                <FRQSubmittedAnswers frqAnswers={frqAnswers} />
              </div>
            )}

            {/* Points */}
            <div className="mt-4 pt-4 border-t border-border-default">
              <p className="text-text-secondary text-sm">
                Points: {isGradingComplete ? `${frqEarnedPoints}/${frqMaxPoints}` : `--/${frqMaxPoints} (pending)`}
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4">
          <Link
            to="/ap"
            className="bg-surface text-text-primary px-6 py-2 rounded-[--radius-button] border border-border-default hover:bg-hover transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  )
}
