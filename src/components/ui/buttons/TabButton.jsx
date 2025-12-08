import { forwardRef } from 'react'

/**
 * TabButton - Tab switching button (e.g., Lists/Students/Gradebook tabs)
 * 
 * Props:
 * - active: Whether this tab is selected
 * - children: Tab text
 */

const TabButton = forwardRef(({
  active = false,
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = `
    px-4 py-2 text-sm font-semibold
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `.trim().replace(/\s+/g, ' ')

  const stateClasses = active
    ? 'border-b-2 border-brand-primary text-brand-text'
    : `text-text-secondary 
       hover:text-brand-primary hover:border-b-2 hover:border-brand-primary/30
       active:text-brand-primary`

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

TabButton.displayName = 'TabButton'

export default TabButton

