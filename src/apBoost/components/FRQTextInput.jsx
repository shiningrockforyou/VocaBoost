import { useRef, useEffect } from 'react'

/**
 * FRQTextInput - Auto-resizing textarea for FRQ answers
 * Features:
 * - Auto-resize as user types
 * - Character count (optional)
 * - Min/max height constraints
 * - Save on blur (with dedupe guard)
 */
export default function FRQTextInput({
  subQuestion,
  value = '',
  onChange,
  onBlur = null,
  disabled = false,
  maxLength = 10000,
  showCharCount = true,
  placeholder = 'Type your response here...',
}) {
  const textareaRef = useRef(null)
  const lastBlurValueRef = useRef(value)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    // Set height to scrollHeight, constrained by min/max
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 150), 400)
    textarea.style.height = `${newHeight}px`
  }, [value])

  const handleChange = (e) => {
    const newValue = e.target.value
    if (newValue.length <= maxLength) {
      onChange(newValue)
    }
  }

  // Blur handler with dedupe guard to avoid duplicate saves
  const handleBlur = () => {
    if (onBlur && value !== lastBlurValueRef.current) {
      onBlur(value)
      lastBlurValueRef.current = value
    }
  }

  const charCount = value?.length || 0
  const charPercentage = (charCount / maxLength) * 100

  return (
    <div className="space-y-2">
      {/* Sub-question prompt */}
      {subQuestion && (
        <div className="mb-3">
          <span className="text-text-secondary font-medium">
            ({subQuestion.label})
          </span>
          {subQuestion.prompt && (
            <p className="text-text-primary mt-1">{subQuestion.prompt}</p>
          )}
          {subQuestion.points && (
            <span className="text-text-muted text-sm ml-2">
              ({subQuestion.points} point{subQuestion.points !== 1 ? 's' : ''})
            </span>
          )}
        </div>
      )}

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={`
          w-full px-4 py-3 rounded-[--radius-input] border resize-none
          bg-surface text-text-primary placeholder-text-muted
          transition-colors
          focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
          ${disabled
            ? 'bg-muted cursor-not-allowed opacity-60'
            : 'border-border-default hover:border-border-strong'
          }
        `}
        style={{ minHeight: '150px', maxHeight: '400px' }}
      />

      {/* Character count */}
      {showCharCount && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-text-muted">
            {charCount.toLocaleString()} / {maxLength.toLocaleString()} characters
          </span>
          {charPercentage > 90 && (
            <span className={`${charPercentage >= 100 ? 'text-error-text' : 'text-warning-text'}`}>
              {charPercentage >= 100 ? 'Character limit reached' : 'Near character limit'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
