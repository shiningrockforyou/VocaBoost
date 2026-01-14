/**
 * DuplicateTabModal - Modal shown when session is active in another tab
 * Blocks interaction until user makes a choice
 */
export default function DuplicateTabModal({ onTakeControl, onGoToDashboard }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-surface rounded-[--radius-card] shadow-theme-xl p-6 md:p-8 max-w-md mx-4">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-warning flex items-center justify-center">
            <span className="text-3xl">⚠</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-text-primary text-center mb-2">
          Session Active Elsewhere
        </h2>

        {/* Message */}
        <p className="text-text-secondary text-center mb-6">
          This test is already open in another browser tab.
        </p>

        <p className="text-text-muted text-sm text-center mb-6">
          To prevent data conflicts, you can only have one active session at a time.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onGoToDashboard}
            className="px-6 py-2 rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover transition-colors"
          >
            Go to Dashboard
          </button>
          <button
            onClick={onTakeControl}
            className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity"
          >
            Use This Tab
          </button>
        </div>
      </div>
    </div>
  )
}
