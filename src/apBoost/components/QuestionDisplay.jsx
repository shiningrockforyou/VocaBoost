import { QUESTION_FORMAT, QUESTION_TYPE, STIMULUS_TYPE } from '../utils/apTypes'
import FRQQuestionDisplay from './FRQQuestionDisplay'
import PassageDisplay from './tools/PassageDisplay'

/**
 * Simple stimulus renderer (no annotation tools)
 */
function StimulusDisplay({ stimulus }) {
  if (!stimulus) return null

  const { type, content, source } = stimulus

  return (
    <div className="prose prose-sm max-w-none">
      {type === STIMULUS_TYPE.IMAGE || type === STIMULUS_TYPE.CHART ? (
        <div>
          <img
            src={content}
            alt={stimulus.imageAlt || 'Stimulus image'}
            className="max-w-full h-auto rounded-[--radius-sm]"
          />
          {source && (
            <p className="text-text-muted text-xs mt-2 italic">{source}</p>
          )}
        </div>
      ) : (
        <div>
          <div className="text-text-secondary whitespace-pre-wrap">{content}</div>
          {source && (
            <p className="text-text-muted text-xs mt-2 italic">— {source}</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * QuestionDisplay - Renders question based on format
 * VERTICAL: Single column with question text and answer choices
 * HORIZONTAL: Two columns - stimulus on left, question on right
 *
 * Annotation props (optional):
 * - highlights, onHighlight, onRemoveHighlight, highlightColor, onHighlightColorChange
 * - lineReaderEnabled, lineReaderPosition, lineReaderLines, onLineReaderToggle, onLineReaderMove, onLineReaderLinesChange
 * - onClearAnnotations
 */
export default function QuestionDisplay({
  question,
  questionNumber,
  stimulus,
  format = QUESTION_FORMAT.VERTICAL,
  subQuestionLabel = null, // For FRQ sub-questions
  // Annotation props (optional)
  highlights = [],
  onHighlight,
  onRemoveHighlight,
  highlightColor = 'yellow',
  onHighlightColorChange,
  lineReaderEnabled = false,
  lineReaderPosition = 0,
  lineReaderLines = 2,
  onLineReaderToggle,
  onLineReaderMove,
  onLineReaderLinesChange,
  onClearAnnotations,
  annotationsEnabled = false, // Master switch for annotation tools
  disabled = false,
  children, // AnswerInput slot
}) {
  if (!question) return null

  // Use question's stimulus if not passed directly
  const displayStimulus = stimulus || question.stimulus

  // Delegate to FRQQuestionDisplay for FRQ/SAQ/DBQ questions
  const frqTypes = [QUESTION_TYPE.FRQ, QUESTION_TYPE.SAQ, QUESTION_TYPE.DBQ]
  if (frqTypes.includes(question.questionType)) {
    return (
      <FRQQuestionDisplay
        question={question}
        questionNumber={questionNumber}
        subQuestionLabel={subQuestionLabel}
        stimulus={displayStimulus}
      >
        {children}
      </FRQQuestionDisplay>
    )
  }

  // Check if we should show annotation tools (HORIZONTAL layout with text stimulus)
  const isTextStimulus = displayStimulus &&
    displayStimulus.type !== STIMULUS_TYPE.IMAGE &&
    displayStimulus.type !== STIMULUS_TYPE.CHART
  const showAnnotationTools = annotationsEnabled && isTextStimulus

  // HORIZONTAL layout with stimulus
  if (format === QUESTION_FORMAT.HORIZONTAL && displayStimulus) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Stimulus (with optional annotation tools) */}
        <div className="bg-surface rounded-[--radius-card] p-4 border border-border-default overflow-auto max-h-[60vh] lg:max-h-none">
          {showAnnotationTools ? (
            <PassageDisplay
              stimulus={displayStimulus}
              highlights={highlights}
              onHighlight={onHighlight}
              onRemoveHighlight={onRemoveHighlight}
              highlightColor={highlightColor}
              onHighlightColorChange={onHighlightColorChange}
              lineReaderEnabled={lineReaderEnabled}
              lineReaderPosition={lineReaderPosition}
              lineReaderLines={lineReaderLines}
              onLineReaderToggle={onLineReaderToggle}
              onLineReaderMove={onLineReaderMove}
              onLineReaderLinesChange={onLineReaderLinesChange}
              onClearAll={onClearAnnotations}
              showToolbar={true}
              disabled={disabled}
            />
          ) : (
            <StimulusDisplay stimulus={displayStimulus} />
          )}
        </div>

        {/* Right column - Question and answers */}
        <div className="bg-surface rounded-[--radius-card] p-4 border border-border-default">
          <div className="mb-4">
            <span className="text-text-muted text-sm">Question {questionNumber}</span>
            <p className="text-text-primary mt-2 whitespace-pre-wrap">
              {question.questionText}
            </p>
          </div>
          {children}
        </div>
      </div>
    )
  }

  // VERTICAL layout (default) - annotations not shown (no stimulus panel)
  return (
    <div className="bg-surface rounded-[--radius-card] p-4 md:p-6 border border-border-default">
      {/* Question header */}
      <div className="mb-4">
        <span className="text-text-muted text-sm">Question {questionNumber}</span>
      </div>

      {/* Inline stimulus if present */}
      {displayStimulus && (
        <div className="mb-4 pb-4 border-b border-border-default">
          <StimulusDisplay stimulus={displayStimulus} />
        </div>
      )}

      {/* Question text */}
      <p className="text-text-primary mb-6 whitespace-pre-wrap">
        {question.questionText}
      </p>

      {/* Answer input slot */}
      {children}
    </div>
  )
}
