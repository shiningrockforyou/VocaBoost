/**
 * DismissedWordsDrawer - Right-side drawer showing dismissed words with undo capability
 *
 * Shows during study phases only (NEW_WORDS, REVIEW_STUDY)
 * Allows individual word restoration or "Restore All"
 */

const DismissedWordsDrawer = ({
  isOpen,
  onClose,
  dismissedWords = [],
  onRestore,
  onRestoreAll
}) => {
  if (!isOpen) return null

  const count = dismissedWords.length

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Drawer Panel - slides in from right */}
      <div
        className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-surface shadow-xl flex flex-col animate-slide-in-right"
        style={{
          animation: 'slideInRight 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <h2 className="text-base font-semibold text-text-primary">
            Dismissed Words ({count})
          </h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-muted transition"
            aria-label="Close drawer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Word List */}
        <div className="flex-1 overflow-y-auto">
          {count === 0 ? (
            <div className="flex items-center justify-center h-full px-4">
              <p className="text-text-secondary text-sm text-center">
                No dismissed words yet.
                <br />
                Tap the checkmark on a word you know to dismiss it.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border-default">
              {dismissedWords.map((word) => (
                <li
                  key={word.id}
                  className="px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary truncate">
                      {word.word}
                    </p>
                    <p className="text-sm text-text-secondary line-clamp-1">
                      {word.definition}
                    </p>
                  </div>
                  <button
                    onClick={() => onRestore(word.id, word.phase)}
                    className="flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-md bg-muted text-text-primary hover:bg-muted/80 transition"
                    aria-label={`Restore ${word.word}`}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {count > 0 && (
          <div className="border-t border-border-default px-4 py-3">
            <button
              onClick={onRestoreAll}
              className="w-full py-2 px-4 text-sm font-medium rounded-lg bg-muted text-text-primary hover:bg-muted/80 transition"
            >
              Restore All ({count})
            </button>
          </div>
        )}
      </div>

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

export default DismissedWordsDrawer
