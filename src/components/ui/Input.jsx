import { forwardRef } from 'react'

const sizes = {
  sm: 'h-10 px-3 text-sm',
  md: 'h-11 px-3 text-sm',
  lg: 'h-12 px-4 text-sm',
}

const Input = forwardRef(({ 
  size = 'md',
  className = '',
  ...props 
}, ref) => {
  return (
    <input 
      ref={ref}
      className={`
        w-full rounded-xl border border-border-default bg-surface text-text-primary 
        outline-none ring-border-strong 
        focus:ring-2 focus:ring-brand-primary focus:border-brand-primary
        disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50
        placeholder:text-slate-400
        ${sizes[size]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export default Input

