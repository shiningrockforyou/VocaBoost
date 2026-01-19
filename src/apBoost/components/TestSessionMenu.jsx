import { useState } from 'react'

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
        <div className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-[--radius-card-lg] p-6 animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-text-primary">
              {showExitConfirm ? 'Exit Test?' : 'Menu'}
            </h3>
            <button
              onClick={handleClose}
              className="text-text-muted hover:text-text-primary transition-colors text-xl"
            >
              x
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
                <span className="text-lg">Q</span>
                <span>Go to Question...</span>
              </button>
              <button
                onClick={handleExitClick}
                className="w-full py-4 px-4 rounded-[--radius-button] text-left text-error-text font-medium hover:bg-hover transition-colors flex items-center gap-3"
              >
                <span className="text-lg">x</span>
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
