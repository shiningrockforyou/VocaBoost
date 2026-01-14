import { useState, useEffect, useCallback } from 'react'
import { getResultForGrading, saveGrade, calculateFRQScore } from '../../services/apGradingService'
import { uploadGradedPdf } from '../../services/apStorageService'
import { GRADING_STATUS, FRQ_SUBMISSION_TYPE } from '../../utils/apTypes'
import { logError } from '../../utils/logError'
import FileUpload from '../FileUpload'

/**
 * Handwritten submission viewer
 */
function HandwrittenViewer({ files, onDownload }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  if (!files || files.length === 0) {
    return (
      <div className="bg-muted rounded-[--radius-card] p-8 text-center">
        <p className="text-text-muted">No files uploaded</p>
      </div>
    )
  }

  const currentFile = files[currentIndex]
  const isPdf = currentFile.type === 'application/pdf' || currentFile.url?.includes('.pdf')

  return (
    <div className="bg-muted rounded-[--radius-card] overflow-hidden">
      {/* Image/PDF display */}
      <div className="relative h-96 bg-black/10 flex items-center justify-center overflow-hidden">
        {isPdf ? (
          <iframe
            src={currentFile.url}
            className="w-full h-full"
            title="Uploaded PDF"
          />
        ) : (
          <img
            src={currentFile.url}
            alt={`Page ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain transition-transform"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        )}
      </div>

      {/* Controls */}
      <div className="p-3 border-t border-border-muted bg-surface">
        <div className="flex items-center justify-between">
          {/* Page navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="px-2 py-1 text-sm border border-border-default rounded hover:bg-hover disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-text-secondary text-sm">
              Page {currentIndex + 1} of {files.length}
            </span>
            <button
              onClick={() => setCurrentIndex(Math.min(files.length - 1, currentIndex + 1))}
              disabled={currentIndex === files.length - 1}
              className="px-2 py-1 text-sm border border-border-default rounded hover:bg-hover disabled:opacity-50"
            >
              Next
            </button>
          </div>

          {/* View controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(z => Math.min(3, z + 0.25))}
              className="px-2 py-1 text-sm border border-border-default rounded hover:bg-hover"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              className="px-2 py-1 text-sm border border-border-default rounded hover:bg-hover"
              title="Zoom out"
            >
              -
            </button>
            <button
              onClick={() => setRotation(r => (r + 90) % 360)}
              className="px-2 py-1 text-sm border border-border-default rounded hover:bg-hover"
              title="Rotate"
            >
              R
            </button>
            <a
              href={currentFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-sm border border-border-default rounded hover:bg-hover text-brand-primary"
              download
            >
              Download
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Score input for a sub-question
 */
function ScoreInput({ label, maxPoints, value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-text-secondary text-sm w-8">({label})</span>
      <input
        type="number"
        min="0"
        max={maxPoints}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        disabled={disabled}
        className="w-20 px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary text-center focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
      />
      <span className="text-text-muted text-sm">/ {maxPoints} pts</span>
    </div>
  )
}

/**
 * Question grading card
 */
function QuestionGradingCard({
  questionId,
  question,
  studentAnswer,
  grade,
  onGradeChange,
  disabled,
}) {
  const subQuestions = question?.subQuestions || []
  const subScores = grade?.subScores || {}
  const comment = grade?.comment || ''

  // Calculate question total
  const questionTotal = Object.values(subScores).reduce((a, b) => a + b, 0)
  const questionMaxPoints = subQuestions.reduce((sum, sq) => sum + (sq.points || 3), 0)

  const handleScoreChange = (subLabel, score) => {
    onGradeChange(questionId, {
      ...grade,
      subScores: {
        ...subScores,
        [subLabel]: score
      },
      maxPoints: questionMaxPoints
    })
  }

  const handleCommentChange = (newComment) => {
    onGradeChange(questionId, {
      ...grade,
      comment: newComment
    })
  }

  return (
    <div className="border border-border-default rounded-[--radius-card] p-4 mb-4">
      {/* Question header */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border-default">
        <h4 className="text-text-primary font-medium">
          {question?.questionText?.substring(0, 100)}...
        </h4>
        <span className={`text-sm font-medium ${questionTotal === questionMaxPoints ? 'text-success-text' : 'text-text-secondary'}`}>
          {questionTotal} / {questionMaxPoints} pts
        </span>
      </div>

      {/* Sub-questions */}
      {subQuestions.map((sq) => {
        const answer = typeof studentAnswer === 'object'
          ? studentAnswer[sq.label]
          : studentAnswer

        return (
          <div key={sq.label} className="mb-4 pb-4 border-b border-border-muted last:border-0">
            {/* Sub-question prompt */}
            <div className="mb-2">
              <span className="text-text-secondary font-medium">({sq.label})</span>
              {sq.prompt && (
                <p className="text-text-secondary text-sm mt-1">{sq.prompt}</p>
              )}
            </div>

            {/* Student answer */}
            <div className="mb-3 p-3 bg-muted rounded-[--radius-input]">
              <span className="text-text-muted text-xs uppercase tracking-wide">Student Response:</span>
              <p className="text-text-primary text-sm mt-1 whitespace-pre-wrap">
                {answer || <span className="text-text-muted italic">No response</span>}
              </p>
            </div>

            {/* Score input */}
            <ScoreInput
              label={sq.label}
              maxPoints={sq.points || 3}
              value={subScores[sq.label]}
              onChange={(score) => handleScoreChange(sq.label, score)}
              disabled={disabled}
            />
          </div>
        )
      })}

      {/* Comment */}
      <div className="mt-4">
        <label className="text-text-secondary text-sm block mb-2">
          Feedback (optional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => handleCommentChange(e.target.value)}
          disabled={disabled}
          placeholder="Add feedback for the student..."
          className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50"
          rows={3}
        />
      </div>
    </div>
  )
}

/**
 * GradingPanel - Side panel for grading FRQ responses
 */
export default function GradingPanel({
  resultId,
  onClose,
  onSave,
  teacherId,
}) {
  const [result, setResult] = useState(null)
  const [grades, setGrades] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [annotatedPdfUrl, setAnnotatedPdfUrl] = useState(null)
  const [isUploadingPdf, setIsUploadingPdf] = useState(false)

  // Load result data
  useEffect(() => {
    async function loadResult() {
      if (!resultId) return

      try {
        setLoading(true)
        setError(null)
        const data = await getResultForGrading(resultId)
        setResult(data)

        // Initialize grades from existing data or empty
        setGrades(data.frqGrades || {})
        // Load existing annotated PDF if any
        setAnnotatedPdfUrl(data.annotatedPdfUrl || null)
      } catch (err) {
        logError('GradingPanel.loadResult', { resultId }, err)
        setError(err.message || 'Failed to load result')
      } finally {
        setLoading(false)
      }
    }

    loadResult()
  }, [resultId])

  // Handle grade change for a question
  const handleGradeChange = (questionId, newGrade) => {
    setGrades(prev => ({
      ...prev,
      [questionId]: newGrade
    }))
  }

  // Save as draft
  const handleSaveDraft = async () => {
    try {
      setSaving(true)
      await saveGrade(resultId, grades, GRADING_STATUS.IN_PROGRESS, teacherId)
      onSave?.()
    } catch (err) {
      logError('GradingPanel.saveDraft', { resultId }, err)
      setError(err.message || 'Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  // Mark as complete
  const handleMarkComplete = async () => {
    try {
      setSaving(true)
      await saveGrade(resultId, grades, GRADING_STATUS.COMPLETE, teacherId, annotatedPdfUrl)
      onSave?.()
      onClose?.()
    } catch (err) {
      logError('GradingPanel.markComplete', { resultId }, err)
      setError(err.message || 'Failed to complete grading')
    } finally {
      setSaving(false)
    }
  }

  // Upload annotated PDF
  const handleAnnotatedPdfUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return

    const file = files[0]
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    try {
      setIsUploadingPdf(true)
      setError(null)
      const url = await uploadGradedPdf(resultId, file, teacherId)
      setAnnotatedPdfUrl(url)
    } catch (err) {
      logError('GradingPanel.uploadAnnotatedPdf', { resultId }, err)
      setError(err.message || 'Failed to upload annotated PDF')
    } finally {
      setIsUploadingPdf(false)
    }
  }, [resultId, teacherId])

  // Calculate total score
  const totalScore = calculateFRQScore(grades)
  const maxScore = result?.frqMaxPoints || 0

  // Check if this is a handwritten submission
  const isHandwritten = result?.frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
  const uploadedFiles = result?.frqUploadedFiles || []

  if (loading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-surface shadow-theme-xl z-50 animate-slide-in-right">
        <div className="p-6 animate-pulse">
          <div className="h-6 bg-muted rounded w-1/3 mb-4" />
          <div className="h-40 bg-muted rounded mb-4" />
          <div className="h-40 bg-muted rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-surface shadow-theme-xl z-50">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">Grading</h2>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary">✕</button>
          </div>
          <div className="bg-error rounded-[--radius-alert] p-4">
            <p className="text-error-text">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-surface shadow-theme-xl z-50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-default flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xl font-bold text-text-primary">
            Grading: {result?.studentName}
          </h2>
          <p className="text-text-secondary text-sm">
            {result?.test?.title || 'Practice Test'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-text-muted hover:text-text-primary text-xl"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Score summary */}
        <div className="bg-muted rounded-[--radius-card] p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Total FRQ Score:</span>
            <span className="text-2xl font-bold text-text-primary">
              {totalScore} / {maxScore}
            </span>
          </div>
        </div>

        {/* Handwritten submission viewer */}
        {isHandwritten && uploadedFiles.length > 0 && (
          <div className="mb-6">
            <h3 className="text-text-primary font-medium mb-3">
              Student's Handwritten Submission
            </h3>
            <HandwrittenViewer files={uploadedFiles} />
          </div>
        )}

        {/* Annotated PDF upload (for handwritten submissions) */}
        {isHandwritten && (
          <div className="mb-6 border border-border-default rounded-[--radius-card] p-4">
            <h3 className="text-text-primary font-medium mb-2">
              Upload Annotated Feedback PDF
            </h3>
            <p className="text-text-muted text-sm mb-3">
              Download the student's submission, add your annotations, and upload the graded version.
            </p>

            {annotatedPdfUrl ? (
              <div className="flex items-center gap-3 p-3 bg-success rounded-[--radius-sm]">
                <span className="text-success-text font-medium">Annotated PDF uploaded</span>
                <a
                  href={annotatedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-primary text-sm hover:underline"
                >
                  View PDF
                </a>
                <button
                  onClick={() => setAnnotatedPdfUrl(null)}
                  className="text-text-muted text-sm hover:text-text-primary ml-auto"
                >
                  Replace
                </button>
              </div>
            ) : (
              <FileUpload
                accept="application/pdf"
                multiple={false}
                maxSize={10 * 1024 * 1024}
                maxFiles={1}
                files={[]}
                onUpload={handleAnnotatedPdfUpload}
                isUploading={isUploadingPdf}
                disabled={saving}
              />
            )}
          </div>
        )}

        {/* Question grading cards */}
        {result?.frqAnswers && result?.frqQuestions && Object.entries(result.frqAnswers).map(([questionId, answer]) => (
          <QuestionGradingCard
            key={questionId}
            questionId={questionId}
            question={result.frqQuestions[questionId]}
            studentAnswer={answer}
            grade={grades[questionId]}
            onGradeChange={handleGradeChange}
            disabled={saving}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border-default flex items-center justify-between shrink-0">
        <button
          onClick={handleSaveDraft}
          disabled={saving}
          className="px-4 py-2 rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          onClick={handleMarkComplete}
          disabled={saving}
          className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Mark Complete'}
        </button>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
