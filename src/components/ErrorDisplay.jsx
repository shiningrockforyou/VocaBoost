import { Button } from './ui'

/**
 * ErrorDisplay - A reusable error display component
 *
 * Can be used as:
 * - Full page error (fullPage=true): Centers on screen with background
 * - Inline error (fullPage=false): Just the card content
 *
 * @param {Object} props
 * @param {string} props.title - Error title (default: "Something went wrong")
 * @param {string} props.message - Error message to display
 * @param {Function} props.onRetry - Callback for retry button (optional)
 * @param {string} props.retryLabel - Label for retry button (default: "Try Again")
 * @param {Function} props.onBack - Callback for back button (optional)
 * @param {string} props.backLabel - Label for back button (default: "Go Back")
 * @param {boolean} props.fullPage - Whether to render as full page (default: true)
 * @param {React.ReactNode} props.children - Additional content to render
 */
const ErrorDisplay = ({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try Again',
  onBack,
  backLabel = 'Go Back',
  fullPage = true,
  children
}) => {
  const content = (
    <div className="max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      {message && (
        <p className="mt-3 text-sm text-text-muted">{message}</p>
      )}
      {children}
      <div className="mt-6 flex flex-col gap-3">
        {onRetry && (
          <Button variant="primary-blue" size="lg" onClick={onRetry} className="w-full">
            {retryLabel}
          </Button>
        )}
        {onBack && (
          <Button variant="outline" size="lg" onClick={onBack} className="w-full">
            {backLabel}
          </Button>
        )}
      </div>
    </div>
  )

  if (!fullPage) {
    return content
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-base px-4">
      <div className="relative z-10">
        {content}
      </div>
    </main>
  )
}

export default ErrorDisplay
