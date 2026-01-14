import { useState, useCallback } from 'react'
import FileUpload from './FileUpload'
import TestTimer from './TestTimer'
import { downloadAnswerSheetPdf } from '../utils/generateAnswerSheetPdf'
import { uploadFRQAnswerSheet } from '../services/apStorageService'
import { logError } from '../utils/logError'

/**
 * FRQHandwrittenMode - Handwritten FRQ submission flow
 *
 * Displays instructions, PDF download, and file upload for handwritten responses.
 *
 * Props:
 * - test: Test object with FRQ questions
 * - student: Student user object
 * - session: Current session data
 * - frqQuestions: Map of questionId to question data
 * - timeRemaining: Timer value in seconds
 * - onFilesUploaded: Callback when files are uploaded successfully
 * - onSubmit: Callback to submit the test
 * - isSubmitting: Whether submission is in progress
 * - disabled: Whether interactions are disabled
 */
export default function FRQHandwrittenMode({
  test,
  student,
  session,
  frqQuestions,
  timeRemaining,
  onFilesUploaded,
  onSubmit,
  isSubmitting = false,
  disabled = false,
}) {
  // Upload state
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [downloadedPdf, setDownloadedPdf] = useState(false)
  const [error, setError] = useState(null)

  // Download answer sheet PDF
  const handleDownloadPdf = useCallback(async () => {
    try {
      setError(null)
      await downloadAnswerSheetPdf(test, student, frqQuestions)
      setDownloadedPdf(true)
    } catch (err) {
      logError('FRQHandwrittenMode.downloadPdf', { testId: test?.id }, err)
      setError('Failed to generate answer sheet. Please try again.')
    }
  }, [test, student, frqQuestions])

  // Handle file upload
  const handleUpload = useCallback(async (files) => {
    if (!session?.id || !student?.uid) {
      setError('Session not found. Please refresh the page.')
      return
    }

    try {
      setError(null)
      setIsUploading(true)
      setUploadProgress(0)

      const uploaded = await uploadFRQAnswerSheet(
        student.uid,
        session.id,
        files,
        setUploadProgress
      )

      const newFiles = [...uploadedFiles, ...uploaded]
      setUploadedFiles(newFiles)

      if (onFilesUploaded) {
        onFilesUploaded(newFiles)
      }
    } catch (err) {
      logError('FRQHandwrittenMode.upload', { sessionId: session?.id }, err)
      setError(err.message || 'Failed to upload files. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [session?.id, student?.uid, uploadedFiles, onFilesUploaded])

  // Remove uploaded file
  const handleRemoveFile = useCallback((index) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(newFiles)
    if (onFilesUploaded) {
      onFilesUploaded(newFiles)
    }
  }, [uploadedFiles, onFilesUploaded])

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (uploadedFiles.length === 0) {
      setError('Please upload your answer sheet before submitting.')
      return
    }
    if (onSubmit) {
      onSubmit()
    }
  }, [uploadedFiles, onSubmit])

  const canSubmit = uploadedFiles.length > 0 && !isSubmitting && !disabled

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-text-primary">
            Free Response (Handwritten)
          </h2>
          <TestTimer timeRemaining={timeRemaining} />
        </div>
        <p className="text-text-muted text-sm">
          Complete your answers on paper, then upload your work.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-error rounded-[--radius-card] p-4 mb-6">
          <p className="text-error-text">{error}</p>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-6">
        {/* Step 1: Download */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-semibold shrink-0">
              1
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-text-primary mb-1">
                Download your answer sheet
              </h3>
              <p className="text-text-muted text-sm mb-3">
                Click the button below to download a PDF with all questions and writing spaces.
              </p>
              <button
                onClick={handleDownloadPdf}
                disabled={disabled}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-[--radius-button] font-medium
                  ${downloadedPdf
                    ? 'bg-success text-success-text'
                    : 'bg-brand-primary text-white hover:opacity-90'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <span>D</span>
                {downloadedPdf ? 'Downloaded' : 'Download Answer Sheet PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Write */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-muted text-text-secondary flex items-center justify-center font-semibold shrink-0">
              2
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-text-primary mb-1">
                Write your answers by hand
              </h3>
              <p className="text-text-muted text-sm">
                Print the PDF and write your responses in the provided spaces.
                Write clearly and stay within the designated areas.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3: Scan */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-muted text-text-secondary flex items-center justify-center font-semibold shrink-0">
              3
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-text-primary mb-1">
                Scan or photograph your work
              </h3>
              <p className="text-text-muted text-sm">
                Use a scanner or phone camera to capture your answers.
                Ensure all text is legible and pages are in order.
              </p>
            </div>
          </div>
        </div>

        {/* Step 4: Upload */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
          <div className="flex items-start gap-4">
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center font-semibold shrink-0
              ${uploadedFiles.length > 0
                ? 'bg-success text-white'
                : 'bg-muted text-text-secondary'
              }
            `}>
              4
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-text-primary mb-1">
                Upload your completed answer sheet
              </h3>
              <p className="text-text-muted text-sm mb-3">
                Upload images or a PDF of your handwritten answers.
              </p>
              <FileUpload
                accept="image/jpeg,image/png,image/heic,image/webp,application/pdf"
                multiple={true}
                maxSize={10 * 1024 * 1024}
                maxFiles={10}
                files={uploadedFiles}
                onUpload={handleUpload}
                onRemove={handleRemoveFile}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div className="mt-8 pt-6 border-t border-border-default">
        <div className="flex items-center justify-between">
          <div className="text-text-muted text-sm">
            {uploadedFiles.length === 0 ? (
              <span>Upload your answer sheet to enable submission</span>
            ) : (
              <span className="text-success-text">
                V {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} ready
              </span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`
              px-6 py-3 rounded-[--radius-button] font-semibold
              ${canSubmit
                ? 'bg-brand-primary text-white hover:opacity-90'
                : 'bg-muted text-text-muted cursor-not-allowed'
              }
            `}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>
      </div>
    </div>
  )
}
