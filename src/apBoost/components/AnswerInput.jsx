import { CHOICE_LETTERS } from '../utils/apTypes'

/**
 * Get choice text from question
 */
function getChoiceText(question, letter) {
  const choiceKey = `choice${letter}`
  const choice = question?.[choiceKey]
  if (!choice) return null
  return typeof choice === 'string' ? choice : choice.text
}

/**
 * AnswerInput - MCQ radio button group
 * Renders answer choices A-J based on question.choiceCount
 */
export default function AnswerInput({
  question,
  selectedAnswer,
  onSelect,
  disabled = false,
  strikethroughs = new Set(),
  onStrikethrough,
}) {
  if (!question) return null

  const choiceCount = question.choiceCount || 4
  const choices = CHOICE_LETTERS.slice(0, choiceCount)

  return (
    <div className="space-y-3">
      {choices.map((letter) => {
        const choiceText = getChoiceText(question, letter)
        if (!choiceText) return null

        const isSelected = selectedAnswer === letter
        const isStruckThrough = strikethroughs.has(letter)
        const choiceData = question[`choice${letter}`]
        const hasImage = choiceData?.imageUrl

        return (
          <div key={letter} className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => !disabled && onSelect(letter)}
              disabled={disabled}
              className={`
                flex-1 flex items-start gap-3 p-3 rounded-[--radius-input] border transition-all text-left
                ${isSelected
                  ? 'bg-brand-primary border-brand-primary text-white'
                  : 'bg-surface border-border-default hover:border-border-strong text-text-primary'
                }
                ${isStruckThrough ? 'opacity-50' : ''}
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Choice letter badge */}
              <span
                className={`
                  inline-flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium shrink-0
                  ${isSelected ? 'bg-white/20 text-white' : 'bg-muted text-text-secondary'}
                `}
              >
                {letter}
              </span>

              {/* Choice content */}
              <div className="flex-1">
                <span className={isStruckThrough ? 'line-through' : ''}>
                  {choiceText}
                </span>
                {hasImage && (
                  <img
                    src={choiceData.imageUrl}
                    alt={choiceData.imageAlt || `Choice ${letter}`}
                    className="mt-2 max-w-full h-auto rounded"
                  />
                )}
              </div>
            </button>

            {/* Strikethrough button */}
            {onStrikethrough && (
              <button
                type="button"
                onClick={() => onStrikethrough(letter)}
                disabled={disabled}
                className={`
                  p-2 rounded-[--radius-button-sm] border transition-colors shrink-0
                  ${isStruckThrough
                    ? 'bg-muted border-border-strong text-text-secondary'
                    : 'bg-surface border-border-default text-text-muted hover:text-text-secondary'
                  }
                `}
                title={isStruckThrough ? 'Remove strikethrough' : 'Strike through'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
