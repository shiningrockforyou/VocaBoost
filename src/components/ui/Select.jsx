import { forwardRef } from 'react'

const sizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-3 py-2 text-sm',
  lg: 'h-12 px-4 py-2 text-sm',
}

const Select = forwardRef(({ 
  size = 'md',
  className = '',
  children,
  ...props 
}, ref) => {
  return (
    <select 
      ref={ref}
      className={`
        w-full rounded-lg border border-border-default bg-muted text-text-primary 
        outline-none ring-border-strong 
        focus:bg-surface focus:ring-2 focus:ring-brand-primary focus:border-brand-primary
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizes[size]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {children}
    </select>
  )
})

Select.displayName = 'Select'

export default Select
