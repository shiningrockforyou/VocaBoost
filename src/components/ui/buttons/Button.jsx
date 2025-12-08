import { forwardRef } from 'react'
import { Link } from 'react-router-dom'

/**
 * Button - Standard action button component
 * 
 * Variants:
 * - primary: Orange CTA (Study Now, Create New)
 * - primary-blue: Blue CTA (Take Test, Join Class, Submit)
 * - secondary: Outlined blue (Typed Test, alternative actions)
 * - outline: Gray outlined (Cancel, Back)
 * - ghost: Minimal styling (low-emphasis actions)
 * - danger: Red destructive (Delete, Reject)
 * - success: Green positive (Accept, Confirm, Add)
 * 
 * Sizes:
 * - sm: h-8 (compact)
 * - md: h-10 (default)
 * - lg: h-12 (standard)
 * - xl: h-14 (hero)
 */

const variants = {
  primary: `
    bg-brand-accent text-white font-bold
    shadow-lg shadow-brand-accent/30
    hover:bg-brand-accent-hover hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-accent/40
    active:translate-y-0 active:scale-95 active:shadow-md
  `,
  'primary-blue': `
    bg-brand-primary text-white font-bold
    shadow-lg shadow-brand-primary/20
    hover:bg-brand-primary/90 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand-primary/30
    active:translate-y-0 active:scale-95 active:shadow-md
  `,
  secondary: `
    bg-surface text-brand-text font-bold
    border border-brand-primary shadow-sm
    hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-md hover:border-brand-primary
    active:translate-y-0 active:scale-95 active:bg-blue-100
  `,
  outline: `
    bg-surface text-text-secondary font-semibold
    border border-border-strong shadow-sm
    hover:bg-hover hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong
    active:translate-y-0 active:scale-95 active:bg-active
  `,
  ghost: `
    bg-surface text-brand-text font-bold
    border border-border-default shadow-sm
    hover:bg-hover hover:-translate-y-0.5 hover:shadow-md hover:border-border-strong
    active:translate-y-0 active:scale-95
  `,
  danger: `
    bg-red-600 text-white font-bold
    shadow-lg shadow-red-600/20
    hover:bg-red-700 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red-600/30
    active:translate-y-0 active:scale-95 active:shadow-md
  `,
  success: `
    bg-emerald-600 text-white font-bold
    shadow-lg shadow-emerald-600/20
    hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-600/30
    active:translate-y-0 active:scale-95 active:shadow-md
  `,
}

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-4 text-sm gap-2',
  xl: 'h-14 px-6 text-base gap-2',
}

const Button = forwardRef(({
  variant = 'primary',
  size = 'lg',
  to,
  href,
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = `
    inline-flex items-center justify-center rounded-button
    font-heading transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed 
    disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100
  `.trim().replace(/\s+/g, ' ')

  const variantClasses = variants[variant] || variants.primary
  const sizeClasses = sizes[size] || sizes.lg

  const combinedClasses = `${baseClasses} ${variantClasses} ${sizeClasses} ${className}`.trim().replace(/\s+/g, ' ')

  // Render as Link if 'to' prop is provided (internal navigation)
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

  // Render as anchor if 'href' prop is provided (external link)
  if (href && !disabled) {
    return (
      <a
        ref={ref}
        href={href}
        className={combinedClasses}
        {...props}
      >
        {children}
      </a>
    )
  }

  // Render as button
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

Button.displayName = 'Button'

export default Button

