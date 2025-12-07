import { Link } from 'react-router-dom'

const StudySelectionModal = ({ isOpen, onClose, classes, mode = 'study' }) => {
  if (!isOpen) {
    return null
  }

  // Collect all available lists from all classes
  const availableLists = []
  classes.forEach((klass) => {
    if (klass.assignedListDetails?.length) {
      klass.assignedListDetails.forEach((list) => {
        availableLists.push({
          id: list.id,
          title: list.title || 'Vocabulary List',
          classId: klass.id,
          className: klass.name,
          wordCount: list.wordCount || 0,
          stats: list.stats || {},
        })
      })
    }
  })

  const handleListClick = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-slate-900">
              {mode === 'study' ? 'Start Study Session' : 'Take Test'}
            </h2>
            <p className="font-body text-sm text-slate-500 mt-1">
              Select a vocabulary list to {mode === 'study' ? 'study' : 'test'}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-500 transition hover:bg-slate-100"
            aria-label="Close modal"
          >
            <svg
              className="h-5 w-5"
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

        {availableLists.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="font-body text-sm text-slate-500">
              No vocabulary lists available. Join a class to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {availableLists.map((list) => (
              <Link
                key={`${list.classId}-${list.id}`}
                to={`/${mode}/${list.id}?classId=${list.classId}`}
                onClick={handleListClick}
                className="block surface-card p-4 transition hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-heading text-base font-bold text-slate-900">
                      {list.title}
                    </h3>
                    <p className="font-body text-sm text-slate-500 mt-1">
                      {list.className}
                    </p>
                    {list.stats && (
                      <div className="mt-2 flex items-center gap-4 text-xs text-slate-600">
                        <span>
                          {list.stats.wordsLearned ?? 0} / {list.wordCount} words learned
                        </span>
                        {list.stats.due > 0 && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                            {list.stats.due} due
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span className="inline-flex items-center rounded-lg bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary">
                      {list.wordCount} words
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex items-center justify-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <span className="truncate whitespace-nowrap max-w-full">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default StudySelectionModal

