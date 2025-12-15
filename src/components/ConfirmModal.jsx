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

import { useEffect } from 'react'
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
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showCancel) {
        onCancel()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, showCancel, onCancel])

  if (!isOpen) return null

  // Map modal variants to Button component variants
  const variantToButtonVariant = {
    default: 'primary-blue',
    danger: 'danger',
    warning: 'warning',
    info: 'primary-blue',
    success: 'success'
  }

  const variantStyles = {
    default: { icon: '❓', iconBg: 'bg-muted' },
    danger: { icon: '⚠️', iconBg: 'bg-error-subtle' },
    warning: { icon: '⚡', iconBg: 'bg-warning-subtle' },
    info: { icon: 'ℹ️', iconBg: 'bg-info-subtle' },
    success: { icon: '✓', iconBg: 'bg-success-subtle' }
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
              className="w-full sm:w-1/4"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            variant={variantToButtonVariant[variant] || 'primary-blue'}
            size="lg"
            onClick={onConfirm}
            className="w-full sm:w-1/4"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal
