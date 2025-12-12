/**
 * PDFOptionsModal.jsx
 * 
 * Modal for selecting PDF generation options.
 */

import { Button } from './ui'

export default function PDFOptionsModal({ isOpen, onClose, onSelect, listTitle }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl ring-1 ring-border-default">
        <h3 className="text-lg font-bold text-text-primary">
          Download PDF
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          {listTitle}
        </p>
        
        <div className="mt-6 flex flex-col gap-3">
          <Button
            onClick={() => { onClose(); onSelect('today'); }}
            variant="primary-blue"
            size="lg"
            className="w-full flex flex-col items-center"
          >
            <span className="text-base">📅 Today's Batch</span>
            <span className="text-xs opacity-75 mt-1">Smart selection</span>
          </Button>
          <Button
            onClick={() => { onClose(); onSelect('full'); }}
            variant="outline"
            size="lg"
            className="w-full flex flex-col items-center"
          >
            <span className="text-base">📚 Entire List</span>
            <span className="text-xs opacity-75 mt-1">All words</span>
          </Button>
        </div>
        
        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-text-muted hover:text-text-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

