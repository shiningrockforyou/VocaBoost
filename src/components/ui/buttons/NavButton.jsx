import { forwardRef } from 'react'
import { Link } from 'react-router-dom'

/**
 * NavButton - Top-level navigation button for HeaderBar
 * 
 * Props:
 * - to: Route path
 * - icon: Lucide icon component
 * - active: Whether this is the current page
 * - children: Button text
 */

const NavButton = forwardRef(({ 
  to,
  icon: Icon,
  children,
  active = false,
  className = '',
  ...props 
}, ref) => {
  const baseClasses = `
    h-12 flex items-center gap-2 px-5 
    rounded-button shadow-sm font-heading font-bold
    transition-all duration-200
  `.trim().replace(/\s+/g, ' ')

  const stateClasses = active
    ? 'bg-brand-primary text-white hover:bg-brand-primary/90'
    : `bg-surface border border-border-default text-brand-text 
       hover:bg-hover hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong
       active:translate-y-0 active:scale-95`

  const combinedClasses = `${baseClasses} ${stateClasses} ${className}`.trim().replace(/\s+/g, ' ')

  return (
    <Link 
      ref={ref}
      to={to} 
      className={combinedClasses}
      {...props}
    >
      {Icon && <Icon size={20} />}
      <span>{children}</span>
    </Link>
  )
})

NavButton.displayName = 'NavButton'

export default NavButton

