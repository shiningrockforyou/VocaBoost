import { forwardRef } from 'react'
import { Link } from 'react-router-dom'

/**
 * CardButton - A wrapper that makes cards act like buttons
 * 
 * Use for: List cards, class cards, any card that navigates on click
 * 
 * Features:
 * - Lifts on hover with enhanced shadow
 * - Press feedback on click
 * - Can be a Link (with `to`) or a button (with `onClick`)
 */

const CardButton = forwardRef(({
  to,
  onClick,
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = `
    block w-full text-left
    transition-all duration-200
    cursor-pointer
    hover:-translate-y-1 hover:shadow-xl
    active:translate-y-0 active:scale-[0.99] active:shadow-md
    disabled:cursor-not-allowed disabled:opacity-60 
    disabled:hover:translate-y-0 disabled:hover:shadow-none
  `.trim().replace(/\s+/g, ' ')

  const combinedClasses = `${baseClasses} ${className}`.trim()

  // Render as Link if 'to' prop is provided
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

  // Render as div with onClick
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.(e)
        }
      }}
      className={combinedClasses}
      {...props}
    >
      {children}
    </div>
  )
})

CardButton.displayName = 'CardButton'

export default CardButton

