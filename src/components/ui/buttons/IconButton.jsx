import { forwardRef } from 'react'

/**
 * IconButton - Icon-only button component
 * 
 * Variants:
 * - default: Subtle, hover to brand-primary
 * - danger: Hover to red
 * - ghost: Minimal, hover to slate
 * - close: For modal close buttons (rounded-full)
 * 
 * Sizes:
 * - sm: h-8 w-8
 * - md: h-10 w-10
 * - lg: h-12 w-12
 */

const variants = {
  default: `
    text-text-faint 
    hover:text-brand-primary hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-md
    active:translate-y-0 active:scale-95 active:shadow-none
  `,
  danger: `
    text-text-faint 
    hover:text-red-600 hover:bg-red-50 hover:-translate-y-0.5 hover:shadow-md
    active:translate-y-0 active:scale-95 active:shadow-none
  `,
  ghost: `
    text-text-muted 
    hover:text-text-secondary hover:bg-hover-strong
    active:scale-95
  `,
  close: `
    text-text-muted rounded-full
    hover:text-text-secondary hover:bg-hover-strong
    active:scale-95
  `,
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

const IconButton = forwardRef(({
  variant = 'default',
  size = 'md',
  disabled = false,
  className = '',
  children,
  ...props
}, ref) => {
  const baseClasses = `
    inline-flex items-center justify-center 
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100
  `.trim().replace(/\s+/g, ' ')

  // Use rounded-full for close variant, rounded-button-sm for others
  const radiusClass = variant === 'close' ? '' : 'rounded-button-sm'

  const variantClasses = variants[variant] || variants.default
  const sizeClasses = sizes[size] || sizes.md

  const combinedClasses = `${baseClasses} ${radiusClass} ${variantClasses} ${sizeClasses} ${className}`.trim().replace(/\s+/g, ' ')

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

IconButton.displayName = 'IconButton'

export default IconButton

