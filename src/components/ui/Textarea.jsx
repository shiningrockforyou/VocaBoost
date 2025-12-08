import { forwardRef } from 'react'

const Textarea = forwardRef(({ 
  className = '',
  ...props 
}, ref) => {
  return (
    <textarea 
      ref={ref}
      className={`
        w-full rounded-xl border border-border-default bg-surface px-4 py-3 text-sm text-text-primary 
        outline-none ring-border-strong 
        focus:ring-2 focus:ring-brand-primary focus:border-brand-primary
        disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50
        placeholder:text-slate-400
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'

export default Textarea

