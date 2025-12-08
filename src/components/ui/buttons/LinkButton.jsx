import { forwardRef } from 'react'
import { Link } from 'react-router-dom'

/**
 * LinkButton - Inline text-style action button
 * 
 * Use for: "View Details", "Challenge", inline actions within content
 * 
 * Variants:
 * - default: Blue text
 * - danger: Red text
 * - muted: Slate text
 */

const variants = {
  default: `
    text-brand-text bg-blue-50
    hover:text-brand-primary hover:bg-blue-100
    active:bg-blue-200
  `,
  danger: `
    text-red-600 bg-red-50
    hover:text-red-700 hover:bg-red-100
    active:bg-red-200
  `,
  muted: `
    text-text-secondary bg-muted
    hover:text-text-primary hover:bg-hover-strong
    active:bg-active
  `,
}

const LinkButton = forwardRef(({
  variant = 'default',
  to,
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = `
    inline-flex items-center gap-1.5
    px-3 py-1.5 rounded-button-sm
    text-sm font-semibold
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `.trim().replace(/\s+/g, ' ')

  const variantClasses = variants[variant] || variants.default

  const combinedClasses = `${baseClasses} ${variantClasses} ${className}`.trim().replace(/\s+/g, ' ')

  // Render as Link if 'to' prop provided
  if (to && !disabled) {
    return (
      <Link
        ref={ref}
        to={to}
        className={combinedClasses}
        {...props}
      >
        {children}
      </Link>
    )
  }

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

LinkButton.displayName = 'LinkButton'

export default LinkButton

