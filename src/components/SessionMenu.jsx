/**
 * SessionMenu Component
 *
 * A dropdown menu for session actions (PDF download, skip to test, reset, quit).
 * Triggered by the kebab menu icon in the header.
 */

import { useState, useRef, useEffect } from 'react'

/**
 * @param {Object} props
 * @param {Function} props.onSkipToTest - Callback for skip to test action
 * @param {Function} props.onDownloadPDF - Callback for PDF download (receives 'today' | 'full')
 * @param {Function} props.onReset - Callback for reset progress
 * @param {Function} props.onQuit - Callback for quit session
 * @param {boolean} props.showSkipToTest - Whether to show skip to test option
 * @param {boolean} props.showReset - Whether to show reset option
 * @param {string|null} props.generatingPDF - Currently generating PDF mode
 * @param {boolean} props.showReviewModeToggle - Whether to show review mode toggle
 * @param {'fast'|'complete'} props.reviewMode - Current review mode
 * @param {Function} props.onToggleReviewMode - Callback to toggle review mode
 * @param {boolean} props.showKoreanDef - Whether Korean definition is shown
 * @param {Function} props.onToggleKoreanDef - Callback to toggle Korean definition
 * @param {boolean} props.showSampleSentence - Whether sample sentence is shown
 * @param {Function} props.onToggleSampleSentence - Callback to toggle sample sentence
 */
export default function SessionMenu({
  onSkipToTest,
  onDownloadPDF,
  onReset,
  onQuit,
  showSkipToTest = true,
  showReset = false,
  generatingPDF = null,
  showReviewModeToggle = false,
  reviewMode = 'fast',
  onToggleReviewMode,
  showKoreanDef = true,
  onToggleKoreanDef,
  showSampleSentence = true,
  onToggleSampleSentence
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleAction = (callback) => {
    setIsOpen(false)
    callback?.()
  }

  return (
    <div className="relative">
      {/* Menu trigger button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-muted transition"
        aria-label="Session menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface border border-border-default shadow-lg z-50 overflow-hidden animate-fade-in"
          >
            {/* Skip to Test */}
            {showSkipToTest && (
              <button
                onClick={() => handleAction(onSkipToTest)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted transition"
              >
                <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                <span className="text-sm font-medium text-text-primary">Skip to Test</span>
              </button>
            )}

            {/* Divider */}
            {showSkipToTest && <div className="h-px bg-border-default" />}

            {/* PDF Downloads */}
            <div className="py-1">
              <p className="px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">
                Download PDF
              </p>
              <button
                onClick={() => handleAction(() => onDownloadPDF?.('today'))}
                disabled={generatingPDF !== null}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-muted transition disabled:opacity-50"
              >
                {generatingPDF === 'today' ? (
                  <span className="w-5 h-5 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                  </span>
                ) : (
                  <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                <span className="text-sm text-text-primary">Today's Words</span>
              </button>
              <button
                onClick={() => handleAction(() => onDownloadPDF?.('full'))}
                disabled={generatingPDF !== null}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-muted transition disabled:opacity-50"
              >
                {generatingPDF === 'full' ? (
                  <span className="w-5 h-5 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                  </span>
                ) : (
                  <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                <span className="text-sm text-text-primary">Full List</span>
              </button>
            </div>

            {/* Review Mode Toggle */}
            {showReviewModeToggle && (
              <>
                <div className="h-px bg-border-default" />
                <button
                  onClick={() => handleAction(onToggleReviewMode)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted transition"
                >
                  {reviewMode === 'fast' ? (
                    <>
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      <div>
                        <span className="text-sm font-medium text-text-primary block">Complete Review Mode</span>
                        <span className="text-xs text-text-muted">Review all words in segment</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <div>
                        <span className="text-sm font-medium text-text-primary block">Fast Review Mode</span>
                        <span className="text-xs text-text-muted">Focus on priority words</span>
                      </div>
                    </>
                  )}
                </button>
              </>
            )}

            {/* Card Display Options */}
            <div className="h-px bg-border-default" />
            <div className="py-1">
              <p className="px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">
                Card Display
              </p>
              {/* Korean Definition Toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleKoreanDef?.(); }}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted transition"
              >
                <span className="text-sm text-text-primary">Korean Definition</span>
                <div className={`w-10 h-6 rounded-full transition-colors ${showKoreanDef ? 'bg-brand-primary' : 'bg-border-strong'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform mt-0.5 ${showKoreanDef ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
              {/* Sample Sentence Toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSampleSentence?.(); }}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted transition"
              >
                <span className="text-sm text-text-primary">Sample Sentence</span>
                <div className={`w-10 h-6 rounded-full transition-colors ${showSampleSentence ? 'bg-brand-primary' : 'bg-border-strong'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform mt-0.5 ${showSampleSentence ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>

            {/* Divider */}
            <div className="h-px bg-border-default" />

            {/* Reset (if applicable) */}
            {showReset && (
              <>
                <button
                  onClick={() => handleAction(onReset)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted transition"
                >
                  <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="text-sm font-medium text-text-primary">Reset Progress</span>
                </button>
                <div className="h-px bg-border-default" />
              </>
            )}

            {/* Quit */}
            <button
              onClick={() => handleAction(onQuit)}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">Quit Session</span>
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
      `}</style>
    </div>
  )
}
