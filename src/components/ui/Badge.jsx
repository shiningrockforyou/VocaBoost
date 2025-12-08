const variants = {
  // Matches: rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600
  default: 'bg-muted text-text-secondary',
  info: 'bg-blue-100 text-blue-800',
  // Matches success badge in gradebook
  success: 'bg-emerald-50 text-emerald-600',
  // Matches: inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-50 text-red-600',
  purple: 'bg-purple-100 text-purple-700',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
}

const shapes = {
  rounded: 'rounded-lg',
  pill: 'rounded-full',
}

const Badge = ({ 
  variant = 'default', 
  size = 'md', 
  shape = 'rounded',
  className = '',
  children, 
  ...props 
}) => {
  return (
    <span 
      className={`
        inline-flex items-center font-semibold
        ${variants[variant]} 
        ${sizes[size]}
        ${shapes[shape]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      {...props}
    >
      {children}
    </span>
  )
}

export default Badge

