import { STIMULUS_TYPE } from '../utils/apTypes'

/**
 * Stimulus renderer for FRQ
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
 * Sub-question list for FRQ
 * Shows all sub-questions with the current one highlighted
 */
function SubQuestionList({ subQuestions, currentLabel }) {
  return (
    <div className="space-y-2 mb-4 pb-4 border-b border-border-default">
      {subQuestions.map((sq) => {
        const isCurrent = sq.label === currentLabel
        return (
          <div
            key={sq.label}
            className={`
              p-3 rounded-[--radius-input] transition-colors
              ${isCurrent
                ? 'bg-brand-primary/10 border border-brand-primary'
                : 'bg-muted border border-transparent'
              }
            `}
          >
            <span className={`font-medium ${isCurrent ? 'text-brand-text' : 'text-text-secondary'}`}>
              ({sq.label})
            </span>
            {sq.prompt && (
              <span className={`ml-2 ${isCurrent ? 'text-text-primary' : 'text-text-secondary'}`}>
                {sq.prompt}
              </span>
            )}
            {sq.points && (
              <span className="text-text-muted text-sm ml-2">
                ({sq.points} pt{sq.points !== 1 ? 's' : ''})
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * FRQQuestionDisplay - Renders FRQ questions with sub-questions
 *
 * Features:
 * - Always uses HORIZONTAL layout when stimulus exists
 * - Shows full question text
 * - Highlights current sub-question
 * - Shows rubric hint (point value)
 */
export default function FRQQuestionDisplay({
  question,
  questionNumber,
  subQuestionLabel,
  stimulus,
  children, // FRQTextInput slot
}) {
  if (!question) return null

  const displayStimulus = stimulus || question.stimulus
  const subQuestions = question.subQuestions || []
  const currentSubQuestion = subQuestions.find(sq => sq.label === subQuestionLabel)

  // Calculate total points for this question
  const totalPoints = subQuestions.reduce((sum, sq) => sum + (sq.points || 0), 0)

  // FRQ always uses horizontal layout when there's a stimulus
  if (displayStimulus) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Stimulus */}
        <div className="bg-surface rounded-[--radius-card] p-4 border border-border-default overflow-auto max-h-[70vh] lg:max-h-none lg:sticky lg:top-4">
          <StimulusDisplay stimulus={displayStimulus} />
        </div>

        {/* Right column - Question and input */}
        <div className="bg-surface rounded-[--radius-card] p-4 border border-border-default">
          {/* Question header */}
          <div className="mb-4 pb-4 border-b border-border-default">
            <div className="flex items-center justify-between mb-2">
              <span className="text-text-muted text-sm">
                Question {questionNumber}
                {subQuestionLabel && <span className="font-medium">({subQuestionLabel})</span>}
              </span>
              {totalPoints > 0 && (
                <span className="text-text-muted text-sm">
                  Total: {totalPoints} points
                </span>
              )}
            </div>
            <p className="text-text-primary whitespace-pre-wrap">
              {question.questionText}
            </p>
          </div>

          {/* Sub-questions overview */}
          {subQuestions.length > 1 && (
            <SubQuestionList
              subQuestions={subQuestions}
              currentLabel={subQuestionLabel}
            />
          )}

          {/* Current sub-question prompt */}
          {currentSubQuestion && (
            <div className="mb-4 p-3 bg-info/10 rounded-[--radius-input] border border-info-ring">
              <span className="text-text-primary font-medium">
                ({currentSubQuestion.label})
              </span>
              {currentSubQuestion.prompt && (
                <p className="text-text-primary mt-1">{currentSubQuestion.prompt}</p>
              )}
              {currentSubQuestion.points && (
                <span className="text-text-muted text-sm block mt-1">
                  {currentSubQuestion.points} point{currentSubQuestion.points !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Answer input slot */}
          {children}
        </div>
      </div>
    )
  }

  // Vertical layout (no stimulus)
  return (
    <div className="bg-surface rounded-[--radius-card] p-4 md:p-6 border border-border-default">
      {/* Question header */}
      <div className="mb-4 pb-4 border-b border-border-default">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-muted text-sm">
            Question {questionNumber}
            {subQuestionLabel && <span className="font-medium ml-1">({subQuestionLabel})</span>}
          </span>
          {totalPoints > 0 && (
            <span className="text-text-muted text-sm">
              Total: {totalPoints} points
            </span>
          )}
        </div>
        <p className="text-text-primary whitespace-pre-wrap">
          {question.questionText}
        </p>
      </div>

      {/* Sub-questions overview */}
      {subQuestions.length > 1 && (
        <SubQuestionList
          subQuestions={subQuestions}
          currentLabel={subQuestionLabel}
        />
      )}

      {/* Current sub-question prompt */}
      {currentSubQuestion && (
        <div className="mb-4 p-3 bg-info/10 rounded-[--radius-input] border border-info-ring">
          <span className="text-text-primary font-medium">
            ({currentSubQuestion.label})
          </span>
          {currentSubQuestion.prompt && (
            <p className="text-text-primary mt-1">{currentSubQuestion.prompt}</p>
          )}
          {currentSubQuestion.points && (
            <span className="text-text-muted text-sm block mt-1">
              {currentSubQuestion.points} point{currentSubQuestion.points !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Answer input slot */}
      {children}
    </div>
  )
}
