import { X } from 'lucide-react'
import { IconButton } from './buttons'

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

const Modal = ({ 
  isOpen, 
  onClose, 
  title,
  size = 'md',
  children,
  showCloseButton = true,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div 
        className={`
          w-full bg-surface rounded-3xl p-6 shadow-2xl
          ${sizes[size]}
        `.trim().replace(/\s+/g, ' ')}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between mb-4">
            {title && (
              <h2 className="text-xl font-heading font-bold text-slate-900">{title}</h2>
            )}
            {showCloseButton && (
              <IconButton variant="close" size="sm" onClick={onClose} aria-label="Close modal">
                <X size={18} />
              </IconButton>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export default Modal

