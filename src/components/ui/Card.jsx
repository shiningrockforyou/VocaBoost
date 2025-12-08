import { forwardRef } from 'react'

/**
 * Card - Standardized card container component
 * 
 * Variants:
 * - section: Large page sections (My Classes, My Lists)
 * - header: Page headers with prominent shadow
 * - content: Standard content cards (list items, class cards)
 * - modal: Modal/dialog containers
 * - inset: Nested/subtle cards within other cards
 * - stat: Small stat/info display cards
 * - alert-error: Error message cards
 * - alert-success: Success message cards
 * - alert-warning: Warning message cards
 * - empty: Empty state placeholders
 * 
 * Sizes (padding):
 * - sm: p-4
 * - md: p-5 (default)
 * - lg: p-6
 * - xl: p-8
 */

const Card = forwardRef(({
  variant = 'content',
  size,
  className = '',
  children,
  ...props
}, ref) => {
  
  // Base classes (applied to all variants unless overridden)
  const baseClasses = 'transition-all'
  
  // Variant-specific classes (using semantic tokens)
  const variantClasses = {
    // Large page sections
    section: `
      bg-surface 
      border border-border-default 
      rounded-card-lg 
      shadow-theme-sm
    `,
    
    // Page headers
    header: `
      bg-surface 
      border border-border-default
      rounded-card 
      shadow-theme-lg
    `,
    
    // Standard content cards
    content: `
      bg-surface 
      border border-border-default 
      rounded-card
      hover:shadow-theme-md 
      hover:border-brand-primary/30
    `,
    
    // Modal dialogs
    modal: `
      bg-surface 
      rounded-modal 
      shadow-theme-2xl
    `,
    
    // Nested/subtle cards
    inset: `
      bg-muted 
      border border-border-muted 
      rounded-card
    `,
    
    // Stat/info cards
    stat: `
      bg-surface 
      border border-border-default 
      rounded-card 
      shadow-theme-sm 
      hover:shadow-theme-md
    `,
    
    // Alert variants
    'alert-error': `
      bg-accent-red 
      border border-red-200 
      rounded-alert
    `,
    
    'alert-success': `
      bg-accent-green 
      border border-emerald-200 
      rounded-alert
    `,
    
    'alert-warning': `
      bg-accent-amber 
      border border-amber-200 
      rounded-alert
    `,
    
    'alert-info': `
      bg-accent-blue 
      border border-blue-200 
      rounded-alert
    `,
    
    // Empty states
    empty: `
      bg-muted 
      border border-dashed border-border-strong 
      rounded-card 
      text-center
    `,
  }
  
  // Size classes (padding)
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
    xl: 'p-8',
  }
  
  // Default sizes per variant
  const defaultSizes = {
    section: 'lg',    // p-6
    header: 'xl',     // p-8
    content: 'md',    // p-5
    modal: 'lg',      // p-6
    inset: 'sm',      // p-4
    stat: 'sm',       // p-4
    'alert-error': null,   // px-3 py-2 (custom)
    'alert-success': null, // px-3 py-2 (custom)
    'alert-warning': null, // px-3 py-2 (custom)
    'alert-info': null,    // px-3 py-2 (custom)
    empty: 'xl',      // p-8
  }
  
  // Alert variants get custom padding
  const alertPadding = 'px-4 py-3'
  const isAlert = variant.startsWith('alert-')
  
  // Determine final size
  const finalSize = size || defaultSizes[variant]
  const paddingClass = isAlert 
    ? alertPadding 
    : (finalSize ? sizeClasses[finalSize] : '')
  
  // Combine classes
  const combinedClasses = `
    ${baseClasses}
    ${variantClasses[variant] || variantClasses.content}
    ${paddingClass}
    ${className}
  `.trim().replace(/\s+/g, ' ')

  return (
    <div
      ref={ref}
      className={combinedClasses}
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'

export default Card
