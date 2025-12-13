/**
 * ConfirmModal - Reusable confirmation dialog
 *
 * Variants:
 * - danger: Destructive actions (quit, reset, delete) - red confirm button
 * - warning: Risky but recoverable (skip, continue without saving) - amber confirm button
 * - info: Informational prompts (recovery, practice mode) - blue confirm button
 * - success: Positive confirmations - green confirm button
 * - default: General prompts - blue confirm button
 *
 * Button order: Cancel (safe) first, Confirm (action) last
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
  variant = 'default', // 'default' | 'danger' | 'warning' | 'info' | 'success'
  showCancel = true,
  children
}) => {
  if (!isOpen) return null

  const variantStyles = {
    default: {
      icon: '❓',
      iconBg: 'bg-slate-100',
      confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    danger: {
      icon: '⚠️',
      iconBg: 'bg-red-100',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white'
    },
    warning: {
      icon: '⚡',
      iconBg: 'bg-amber-100',
      confirmClass: 'bg-amber-600 hover:bg-amber-700 text-white'
    },
    info: {
      icon: 'ℹ️',
      iconBg: 'bg-blue-100',
      confirmClass: 'bg-blue-600 hover:bg-blue-700 text-white'
    },
    success: {
      icon: '✓',
      iconBg: 'bg-emerald-100',
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
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${styles.iconBg}`}>
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
