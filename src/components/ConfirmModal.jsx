/**
 * ConfirmModal - Reusable confirmation dialog
 *
 * Used for:
 * - Submit test confirmation
 * - Quit test confirmation
 * - Practice mode redirect notification
 * - Test recovery prompt
 */

import { Button } from './ui'

const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default', // 'default' | 'danger' | 'info'
  showCancel = true,
  children
}) => {
  if (!isOpen) return null

  const variantStyles = {
    default: {
      icon: '❓',
      confirmClass: 'bg-brand-primary hover:bg-brand-primary/90 text-white'
    },
    danger: {
      icon: '⚠️',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white'
    },
    info: {
      icon: 'ℹ️',
      confirmClass: 'bg-brand-primary hover:bg-brand-primary/90 text-white'
    },
    success: {
      icon: '✓',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white'
    }
  }

  const styles = variantStyles[variant] || variantStyles.default

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={showCancel ? onCancel : undefined}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-surface p-6 shadow-2xl">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
          <span className="text-2xl">{styles.icon}</span>
        </div>

        {/* Title */}
        <h2 className="text-center text-lg font-semibold text-text-primary">
          {title}
        </h2>

        {/* Message */}
        {message && (
          <p className="mt-2 text-center text-sm text-text-secondary">
            {message}
          </p>
        )}

        {/* Custom content */}
        {children && (
          <div className="mt-4">
            {children}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {showCancel && (
            <Button
              variant="outline"
              size="lg"
              onClick={onCancel}
              className="w-full sm:w-auto"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            variant="primary-blue"
            size="lg"
            onClick={onConfirm}
            className={`w-full sm:w-auto ${styles.confirmClass}`}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
