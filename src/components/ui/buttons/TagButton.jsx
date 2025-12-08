import { forwardRef } from 'react'

/**
 * TagButton - Smaller, subdued button for filter options/tags
 * 
 * Use for: Test type options, date presets, any secondary filter selections
 * 
 * Props:
 * - active: Whether this option is currently selected
 * - children: Button text
 */

const TagButton = forwardRef(({
  active = false,
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = `
    h-8 px-3 
    rounded-button-sm
    text-xs font-medium
    border
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `.trim().replace(/\s+/g, ' ')

  const stateClasses = active
    ? 'bg-slate-700 text-white border-slate-700'
    : `bg-muted text-text-secondary border-border-default 
       hover:bg-hover-strong hover:border-border-strong
       active:bg-active`

  const combinedClasses = `${baseClasses} ${stateClasses} ${className}`.trim().replace(/\s+/g, ' ')

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={combinedClasses}
      {...props}
    >
      {children}
    </button>
  )
})

TagButton.displayName = 'TagButton'

export default TagButton

