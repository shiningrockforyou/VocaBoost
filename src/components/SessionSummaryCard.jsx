/**
 * SessionSummaryCard
 *
 * Displays a summary of what the student accomplished in their session.
 * Shows new words studied, test scores, words graduated, and overall progress.
 */

function SummaryRow({ label, value, highlight = false, icon = null }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-text-muted">{label}</span>
      <span className={`font-medium flex items-center gap-1 ${highlight ? 'text-emerald-600' : 'text-text-primary'}`}>
        {icon && <span>{icon}</span>}
        {value}
      </span>
    </div>
  )
}

function SessionSummaryCard({ summary, sessionConfig }) {
  // Use fresh TWI from progress (updated by completeSessionFromTest) with fallback to sessionConfig
  const totalWordsIntroduced = summary?.progress?.totalWordsIntroduced ?? sessionConfig?.totalWordsIntroduced ?? 0
  const progressPercent = sessionConfig?.totalListWords > 0
    ? Math.min(100, (totalWordsIntroduced / sessionConfig.totalListWords) * 100)
    : 0

  return (
    <div className="rounded-xl bg-surface border border-border-default p-5 shadow-sm">
      <h3 className="font-semibold text-text-primary mb-4">Session Summary</h3>

      <div className="space-y-3">
        {/* New Words Studied */}
        {sessionConfig?.newWordCount > 0 && (
          <SummaryRow
            label="New Words Studied"
            value={sessionConfig.newWordCount}
          />
        )}

        {/* New Word Test Score */}
        {summary?.newWordScore != null && (
          <SummaryRow
            label="New Word Test"
            value={`${Math.round(summary.newWordScore * 100)}%`}
            highlight={summary.newWordScore >= 0.7}
          />
        )}

        {/* Review Words */}
        {sessionConfig?.reviewCount > 0 && (
          <SummaryRow
            label="Words Reviewed"
            value={sessionConfig.reviewCount}
          />
        )}

        {/* Review Test Score */}
        {summary?.reviewScore != null && (
          <SummaryRow
            label="Review Test"
            value={`${Math.round(summary.reviewScore * 100)}%`}
            highlight={summary.reviewScore >= 0.7}
          />
        )}

        {/* Words Graduated */}
        {summary?.graduated > 0 && (
          <SummaryRow
            label="Words Mastered"
            value={summary.graduated}
            highlight={true}
          />
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-4 pt-4 border-t border-border-default">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-text-muted">Total Progress</span>
          <span className="font-medium text-text-primary">
            {totalWordsIntroduced} / {sessionConfig?.totalListWords ?? 0}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default SessionSummaryCard
