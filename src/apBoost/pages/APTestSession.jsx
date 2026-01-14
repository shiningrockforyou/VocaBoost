import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import APErrorBoundary from '../components/APErrorBoundary'
import ConnectionStatus from '../components/ConnectionStatus'
import DuplicateTabModal from '../components/DuplicateTabModal'
import InstructionScreen from '../components/InstructionScreen'
import QuestionDisplay from '../components/QuestionDisplay'
import AnswerInput from '../components/AnswerInput'
import FRQTextInput from '../components/FRQTextInput'
import QuestionNavigator from '../components/QuestionNavigator'
import ReviewScreen from '../components/ReviewScreen'
import TestTimer from '../components/TestTimer'
import FRQHandwrittenMode from '../components/FRQHandwrittenMode'
import { useTestSession } from '../hooks/useTestSession'
import { useAnnotations } from '../hooks/useAnnotations'
import { SESSION_STATUS, QUESTION_FORMAT, FRQ_SUBMISSION_TYPE } from '../utils/apTypes'

/**
 * Loading skeleton for test session
 */
function SessionSkeleton() {
  return (
    <div className="min-h-screen bg-base animate-pulse">
      <div className="h-14 bg-surface border-b border-border-default" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-8 bg-muted rounded w-1/2 mb-4" />
        <div className="h-64 bg-muted rounded mb-4" />
        <div className="h-48 bg-muted rounded" />
      </div>
    </div>
  )
}

/**
 * Inner test session component (wrapped by error boundary)
 */
function APTestSessionInner() {
  const { testId, assignmentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // View state: 'instruction' | 'testing' | 'review' | 'frqChoice' | 'frqHandwritten'
  const [view, setView] = useState('instruction')

  // FRQ submission type and handwritten files
  const [frqSubmissionType, setFrqSubmissionType] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])

  // Use the test session hook
  const {
    session,
    test,
    loading,
    error,
    currentSection,
    currentQuestion,
    position,
    goToQuestion,
    goToFlatIndex,
    goNext,
    goPrevious,
    canGoNext,
    canGoPrevious,
    // FRQ Navigation
    flatNavigationItems,
    currentFlatIndex,
    isFRQQuestion,
    subQuestionLabel,
    // Answers
    answers,
    currentAnswer,
    setAnswer,
    flags,
    toggleFlag,
    startTest,
    submitSection,
    submitTest,
    status,
    isSubmitting,
    timeRemaining,
    // Resilience
    isConnected,
    isSyncing,
    isInvalidated,
    takeControl,
    addToQueue,
  } = useTestSession(testId, assignmentId)

  // Annotation tools (highlights, strikethroughs, line reader)
  const {
    // Highlights
    getHighlights,
    addHighlight,
    removeHighlight,
    highlightColor,
    setHighlightColor,
    // Strikethroughs
    getStrikethroughs,
    toggleStrikethrough,
    // Line reader
    lineReaderEnabled,
    lineReaderPosition,
    lineReaderLines,
    toggleLineReader,
    moveLineReader,
    setVisibleLines,
    // General
    clearAllAnnotations,
  } = useAnnotations(session?.id, addToQueue)

  // Get highlights for current question
  const currentHighlights = currentQuestion?.id ? getHighlights(currentQuestion.id) : []
  const currentStrikethroughs = currentQuestion?.id ? getStrikethroughs(currentQuestion.id) : new Set()

  // Callback to handle highlight on current question
  const handleHighlight = useCallback((range) => {
    if (currentQuestion?.id) {
      addHighlight(currentQuestion.id, range, highlightColor)
    }
  }, [currentQuestion?.id, addHighlight, highlightColor])

  // Callback to handle removing highlight
  const handleRemoveHighlight = useCallback((index) => {
    if (currentQuestion?.id) {
      removeHighlight(currentQuestion.id, index)
    }
  }, [currentQuestion?.id, removeHighlight])

  // Callback to handle strikethrough
  const handleStrikethrough = useCallback((choiceId) => {
    if (currentQuestion?.id) {
      toggleStrikethrough(currentQuestion.id, choiceId)
    }
  }, [currentQuestion?.id, toggleStrikethrough])

  // Clear annotations for current question
  const handleClearAnnotations = useCallback(() => {
    clearAllAnnotations()
  }, [clearAllAnnotations])

  // Determine if we should show instruction or resume
  useEffect(() => {
    if (session && status === SESSION_STATUS.IN_PROGRESS) {
      setView('testing')
    }
  }, [session, status])

  // Check if current section is FRQ and show choice modal
  const isFRQSection = currentSection?.type === 'frq' || currentSection?.isFRQ
  const frqQuestions = test?.questions
    ? Object.fromEntries(
        Object.entries(test.questions).filter(([_, q]) => q.type === 'frq')
      )
    : {}

  // When entering FRQ section for first time, show submission choice
  useEffect(() => {
    if (isFRQSection && view === 'testing' && frqSubmissionType === null) {
      setView('frqChoice')
    }
  }, [isFRQSection, view, frqSubmissionType])

  // Handle begin test
  const handleBegin = async () => {
    await startTest()
    setView('testing')
  }

  // Handle go to review
  const handleGoToReview = () => {
    setView('review')
  }

  // Handle return from review
  const handleReturnFromReview = () => {
    setView('testing')
  }

  // Handle submit
  const handleSubmit = async () => {
    // Include FRQ submission type and uploaded files for handwritten
    const frqData = frqSubmissionType === FRQ_SUBMISSION_TYPE.HANDWRITTEN
      ? { frqSubmissionType, frqUploadedFiles: uploadedFiles }
      : { frqSubmissionType: FRQ_SUBMISSION_TYPE.TYPED }

    const resultId = await submitTest(frqData)
    if (resultId) {
      navigate(`/ap/results/${resultId}`)
    }
  }

  // Handle FRQ submission type choice
  const handleFRQChoice = (type) => {
    setFrqSubmissionType(type)
    if (type === FRQ_SUBMISSION_TYPE.HANDWRITTEN) {
      setView('frqHandwritten')
    } else {
      setView('testing')
    }
  }

  // Handle files uploaded for handwritten submission
  const handleFilesUploaded = (files) => {
    setUploadedFiles(files)
  }

  // Handle handwritten submission complete
  const handleHandwrittenSubmit = () => {
    handleSubmit()
  }

  // Handle cancel (go back to dashboard)
  const handleCancel = () => {
    navigate('/ap')
  }

  // Handle take control (from duplicate tab modal)
  const handleTakeControl = async () => {
    await takeControl()
  }

  // Handle go to dashboard (from duplicate tab modal)
  const handleGoToDashboard = () => {
    navigate('/ap')
  }

  // Loading state
  if (loading) {
    return <SessionSkeleton />
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="bg-error rounded-[--radius-card] p-6">
            <h2 className="text-xl font-semibold text-error-text-strong mb-2">
              Error Loading Test
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

  // Instruction screen
  if (view === 'instruction') {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <InstructionScreen
          test={test}
          existingSession={session}
          onBegin={handleBegin}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  // FRQ submission type choice screen
  if (view === 'frqChoice') {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <ConnectionStatus isConnected={isConnected} isSyncing={isSyncing} />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-surface rounded-[--radius-card] border border-border-default p-6">
            <h2 className="text-xl font-bold text-text-primary text-center mb-2">
              Free Response Section
            </h2>
            <p className="text-text-muted text-center mb-8">
              Choose how you'd like to complete your free response answers:
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Typed option */}
              <button
                onClick={() => handleFRQChoice(FRQ_SUBMISSION_TYPE.TYPED)}
                className="p-6 rounded-[--radius-card] border-2 border-border-default hover:border-brand-primary text-left transition-colors group"
              >
                <div className="text-3xl mb-3">⌨️</div>
                <h3 className="font-semibold text-text-primary mb-2">
                  Type Your Answers
                </h3>
                <p className="text-text-muted text-sm">
                  Enter your responses directly using the on-screen text boxes.
                  Best for shorter answers and quick submission.
                </p>
              </button>

              {/* Handwritten option */}
              <button
                onClick={() => handleFRQChoice(FRQ_SUBMISSION_TYPE.HANDWRITTEN)}
                className="p-6 rounded-[--radius-card] border-2 border-border-default hover:border-brand-primary text-left transition-colors group"
              >
                <div className="text-3xl mb-3">✍️</div>
                <h3 className="font-semibold text-text-primary mb-2">
                  Write by Hand
                </h3>
                <p className="text-text-muted text-sm">
                  Download an answer sheet, write on paper, then scan and upload.
                  Best for math, diagrams, and longer responses.
                </p>
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-border-default text-center">
              <TestTimer timeRemaining={timeRemaining} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handwritten mode screen
  if (view === 'frqHandwritten') {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <ConnectionStatus isConnected={isConnected} isSyncing={isSyncing} />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <FRQHandwrittenMode
            test={test}
            student={user}
            session={session}
            frqQuestions={frqQuestions}
            timeRemaining={timeRemaining}
            onFilesUploaded={handleFilesUploaded}
            onSubmit={handleHandwrittenSubmit}
            isSubmitting={isSubmitting}
            disabled={isInvalidated}
          />
        </div>
      </div>
    )
  }

  // Review screen
  if (view === 'review') {
    const sectionQuestions = currentSection?.questionIds?.map((qId, idx) => ({
      id: qId,
      index: idx,
    })) || []

    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <ConnectionStatus isConnected={isConnected} isSyncing={isSyncing} />
        {isInvalidated && (
          <DuplicateTabModal
            onTakeControl={handleTakeControl}
            onGoToDashboard={handleGoToDashboard}
          />
        )}
        <ReviewScreen
          section={currentSection}
          questions={sectionQuestions}
          answers={answers}
          flags={flags}
          onGoToQuestion={(idx) => {
            goToQuestion(idx)
            setView('testing')
          }}
          onSubmit={handleSubmit}
          onCancel={handleReturnFromReview}
          isSubmitting={isSubmitting}
          isFinalSection={position.sectionIndex === (test?.sections?.length || 1) - 1}
        />
      </div>
    )
  }

  // Main test interface
  const format = currentQuestion?.format || QUESTION_FORMAT.VERTICAL

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Connection status banner */}
      <ConnectionStatus isConnected={isConnected} isSyncing={isSyncing} />

      {/* Duplicate tab modal */}
      {isInvalidated && (
        <DuplicateTabModal
          onTakeControl={handleTakeControl}
          onGoToDashboard={handleGoToDashboard}
        />
      )}

      {/* Header with timer */}
      <header className="bg-surface border-b border-border-default px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-text-secondary text-sm">
            Section {position.sectionIndex + 1} of {test?.sections?.length || 1}:{' '}
            {currentSection?.title || 'Multiple Choice'}
          </span>
        </div>
        <TestTimer timeRemaining={timeRemaining} />
      </header>

      {/* Question content */}
      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto">
          <QuestionDisplay
            question={currentQuestion}
            questionNumber={position.questionIndex + 1}
            stimulus={currentQuestion?.stimulus}
            format={format}
            subQuestionLabel={subQuestionLabel}
            // Annotation props
            annotationsEnabled={true}
            highlights={currentHighlights}
            onHighlight={handleHighlight}
            onRemoveHighlight={handleRemoveHighlight}
            highlightColor={highlightColor}
            onHighlightColorChange={setHighlightColor}
            lineReaderEnabled={lineReaderEnabled}
            lineReaderPosition={lineReaderPosition}
            lineReaderLines={lineReaderLines}
            onLineReaderToggle={toggleLineReader}
            onLineReaderMove={moveLineReader}
            onLineReaderLinesChange={setVisibleLines}
            onClearAnnotations={handleClearAnnotations}
            disabled={isSubmitting || isInvalidated}
          >
            {/* Render FRQTextInput for FRQ questions, AnswerInput for MCQ */}
            {isFRQQuestion ? (
              <FRQTextInput
                subQuestion={currentQuestion?.subQuestions?.find(sq => sq.label === subQuestionLabel)}
                value={currentAnswer || ''}
                onChange={setAnswer}
                disabled={isSubmitting || isInvalidated}
              />
            ) : (
              <AnswerInput
                question={currentQuestion}
                selectedAnswer={currentAnswer}
                onSelect={setAnswer}
                disabled={isSubmitting || isInvalidated}
                strikethroughs={currentStrikethroughs}
                onStrikethrough={handleStrikethrough}
              />
            )}
          </QuestionDisplay>

          {/* Flag button */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => toggleFlag(currentQuestion?.id)}
              disabled={isInvalidated}
              className={`flex items-center gap-2 px-3 py-2 rounded-[--radius-button] text-sm transition-colors ${
                flags.has(currentQuestion?.id)
                  ? 'bg-warning text-warning-text-strong'
                  : 'bg-surface text-text-secondary border border-border-default hover:bg-hover'
              } ${isInvalidated ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span>{flags.has(currentQuestion?.id) ? '🚩' : '⚐'}</span>
              {flags.has(currentQuestion?.id) ? 'Flagged' : 'Flag for Review'}
            </button>
          </div>
        </div>
      </main>

      {/* Bottom navigation */}
      <QuestionNavigator
        questions={currentSection?.questionIds || []}
        currentIndex={position.questionIndex}
        totalQuestions={currentSection?.questionIds?.length || 0}
        // FRQ flat navigation
        flatNavigationItems={flatNavigationItems}
        currentFlatIndex={currentFlatIndex}
        onNavigateFlatIndex={goToFlatIndex}
        // Common props
        answers={answers}
        flags={flags}
        onNavigate={goToQuestion}
        onBack={goPrevious}
        onNext={goNext}
        onGoToReview={handleGoToReview}
        canGoBack={canGoPrevious}
        canGoNext={canGoNext}
      />
    </div>
  )
}

/**
 * Main export - wrapped with error boundary
 */
export default function APTestSession() {
  return (
    <APErrorBoundary>
      <APTestSessionInner />
    </APErrorBoundary>
  )
}
