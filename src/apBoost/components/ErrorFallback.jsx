import { Link } from 'react-router-dom'

/**
 * ErrorFallback - UI shown when an error is caught by APErrorBoundary
 * Provides retry and dashboard navigation options
 */
export default function ErrorFallback({ error, onRetry }) {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="bg-surface rounded-[--radius-card] shadow-theme-md p-6 md:p-8 max-w-md text-center">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-error flex items-center justify-center">
            <span className="text-3xl">!</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Something went wrong
        </h2>

        {/* Message */}
        <p className="text-text-secondary mb-4">
          We encountered an unexpected error. Don't worry - your answers are saved locally.
        </p>

        {/* Error details (dev only) */}
        {import.meta.env.DEV && error && (
          <div className="bg-error-bg rounded-[--radius-alert] p-3 mb-4 text-left">
            <p className="text-error-text text-sm font-mono break-all">
              {error.message || String(error)}
            </p>
          </div>
        )}

        {/* Reassurance */}
        <div className="bg-info rounded-[--radius-alert] p-3 mb-6">
          <p className="text-info-text-strong text-sm">
            Your progress has been saved locally and will sync when the issue is resolved.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/ap"
            className="px-6 py-2 rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover transition-colors"
          >
            Return to Dashboard
          </Link>
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
