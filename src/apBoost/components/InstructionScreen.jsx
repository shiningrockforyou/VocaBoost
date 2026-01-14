import { getSubjectConfig, formatTimeMinutes, calculateTotalTime } from '../utils/apTestConfig'
import { SESSION_STATUS } from '../utils/apTypes'

/**
 * InstructionScreen - Displayed before test starts
 * Shows test overview, section breakdown, and begin/resume button
 */
export default function InstructionScreen({
  test,
  assignment,
  existingSession,
  onBegin,
  onCancel,
}) {
  if (!test) return null

  const subjectConfig = getSubjectConfig(test.subject)
  const totalTime = calculateTotalTime(test.sections || [])
  const isResuming = existingSession?.status === SESSION_STATUS.IN_PROGRESS

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-surface rounded-[--radius-card] shadow-theme-md p-6 md:p-8">
        {/* Test title */}
        <h1 className="text-2xl font-bold text-text-primary text-center mb-2">
          {test.title}
        </h1>
        <p className="text-text-secondary text-center mb-6">
          {subjectConfig.name}
        </p>

        {/* Section breakdown */}
        <div className="border-t border-border-default pt-6 mb-6">
          <p className="text-text-primary mb-4">
            This test has {test.sections?.length || 0} section{test.sections?.length !== 1 ? 's' : ''}:
          </p>

          <div className="space-y-4">
            {test.sections?.map((section, idx) => (
              <div key={section.id || idx} className="pl-4 border-l-2 border-border-strong">
                <p className="font-medium text-text-primary">
                  Section {idx + 1}: {section.title || section.sectionType}
                </p>
                <ul className="text-text-secondary text-sm mt-1 space-y-1">
                  <li>• {section.questionIds?.length || 0} questions</li>
                  <li>• {formatTimeMinutes(section.timeLimit || 0)}</li>
                </ul>
              </div>
            ))}
          </div>

          <p className="text-text-primary mt-4 font-medium">
            Total time: {formatTimeMinutes(totalTime)}
          </p>
        </div>

        {/* Warnings */}
        <div className="bg-warning rounded-[--radius-alert] p-4 mb-6">
          <ul className="text-warning-text-strong text-sm space-y-2">
            <li>⚠ Once you begin, you cannot pause the timer.</li>
            <li>⚠ You cannot return to previous sections.</li>
          </ul>
        </div>

        {/* Resume info */}
        {isResuming && existingSession && (
          <div className="bg-info rounded-[--radius-alert] p-4 mb-6">
            <p className="text-info-text-strong text-sm">
              Resume from: Section {existingSession.currentSectionIndex + 1},
              Question {existingSession.currentQuestionIndex + 1}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onBegin}
            className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white hover:opacity-90 transition-opacity font-medium"
          >
            {isResuming ? 'Resume Test' : 'Begin Test'}
          </button>
        </div>
      </div>
    </div>
  )
}
