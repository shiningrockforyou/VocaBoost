import { CHOICE_LETTERS, QUESTION_TYPE } from '../utils/apTypes'

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
  const isMulti = question?.questionType === QUESTION_TYPE.MCQ_MULTI

  // Handle click for single-select (MCQ) vs multi-select (MCQ_MULTI)
  const handleSelect = (letter) => {
    if (disabled) return

    if (isMulti) {
      // Multi-select: toggle letter in array
      const current = Array.isArray(selectedAnswer) ? selectedAnswer : []
      const next = current.includes(letter)
        ? current.filter((l) => l !== letter)
        : [...current, letter]
      // Sort and dedupe
      const sorted = [...new Set(next)].sort()
      onSelect(sorted)
    } else {
      // Single-select: just pass the letter
      onSelect(letter)
    }
  }

  return (
    <div className="space-y-3">
      {choices.map((letter) => {
        const choiceText = getChoiceText(question, letter)
        if (!choiceText) return null

        // Selection check differs for MCQ vs MCQ_MULTI
        const isSelected = isMulti
          ? Array.isArray(selectedAnswer) && selectedAnswer.includes(letter)
          : selectedAnswer === letter
        const isStruckThrough = strikethroughs.has(letter)
        const choiceData = question[`choice${letter}`]
        const hasImage = choiceData?.imageUrl

        return (
          <div key={letter} className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => handleSelect(letter)}
              disabled={disabled}
              className={`
                flex-1 flex items-start gap-3 p-3 rounded-[--radius-input] border transition-all text-left
                ${isSelected
                  ? 'bg-brand-primary border-brand-primary text-white'
                  : 'bg-surface border-border-default hover:border-border-strong text-text-primary'
                }
                ${isStruckThrough ? 'opacity-[0.6]' : ''}
                ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Checkbox for MCQ_MULTI */}
              {isMulti && (
                <span
                  className={`
                    inline-flex items-center justify-center w-5 h-5 rounded-[--radius-button-sm] border-2 shrink-0
                    ${isSelected
                      ? 'bg-white border-white text-brand-primary'
                      : 'border-current opacity-60'
                    }
                  `}
                >
                  {isSelected && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
              )}

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
                <span className={isStruckThrough ? 'line-through text-text-muted' : ''}>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
