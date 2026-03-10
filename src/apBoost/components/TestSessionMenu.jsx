import { useState, useEffect, useRef } from 'react'

/**
 * TestSessionMenu - Slide-up menu for test session header
 *
 * Provides access to:
 * - Go to Question (opens QuestionNavigator)
 * - Exit Test (with confirmation)
 */
export default function TestSessionMenu({
  isOpen,
  onClose,
  onOpenNavigator,
  onExit,
}) {
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const closeButtonRef = useRef(null)

  const handleExitClick = () => {
    setShowExitConfirm(true)
  }

  const handleConfirmExit = () => {
    setShowExitConfirm(false)
    onClose()
    onExit()
  }

  const handleCancelExit = () => {
    setShowExitConfirm(false)
  }

  const handleGoToQuestion = () => {
    onClose()
    onOpenNavigator()
  }

  const handleClose = () => {
    setShowExitConfirm(false)
    onClose()
  }

  // Keyboard: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      // Focus the close button on open
      closeButtonRef.current?.focus()
    }
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Slide-up Modal */}
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={handleClose}
        />

        {/* Modal */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card-lg] p-6 animate-slide-up"
          role="dialog"
          aria-modal="true"
          aria-label="Test session menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-primary">
              {showExitConfirm ? 'Exit Test?' : 'Menu'}
            </h3>
            <button
              ref={closeButtonRef}
              onClick={handleClose}
              aria-label="Close menu"
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {showExitConfirm ? (
            /* Exit Confirmation */
            <div className="space-y-4">
              <p className="text-text-secondary">
                Are you sure you want to exit? Your progress will be saved.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelExit}
                  className="flex-1 py-3 rounded-[--radius-button] border border-border-default text-text-primary font-medium hover:bg-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmExit}
                  className="flex-1 py-3 rounded-[--radius-button] bg-error text-white font-medium hover:opacity-90 transition-opacity"
                >
                  Exit Test
                </button>
              </div>
            </div>
          ) : (
            /* Menu Items */
            <div className="space-y-2">
              <button
                onClick={handleGoToQuestion}
                className="w-full py-4 px-4 rounded-[--radius-button] text-left text-text-primary font-medium hover:bg-hover transition-colors flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <span>Go to Question...</span>
              </button>
              <button
                onClick={handleExitClick}
                className="w-full py-4 px-4 rounded-[--radius-button] text-left text-error-text font-medium hover:bg-hover transition-colors flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Exit Test</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
