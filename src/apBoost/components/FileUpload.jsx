import { useState, useRef, useCallback } from 'react'
import { formatFileSize, validateFile } from '../services/apStorageService'

/**
 * FileUpload - Drag-and-drop file upload component
 *
 * Props:
 * - accept: string - Accepted file types (e.g., "image/*,application/pdf")
 * - multiple: boolean - Allow multiple files
 * - maxSize: number - Max file size in bytes
 * - maxFiles: number - Max number of files
 * - files: Array - Currently uploaded files [{ name, url, size, type }]
 * - onUpload: (files: File[]) => void - Called when files are selected
 * - onRemove: (index: number) => void - Called to remove a file
 * - isUploading: boolean - Show upload progress
 * - uploadProgress: number - Upload progress 0-100
 * - disabled: boolean - Disable interactions
 */
export default function FileUpload({
  accept = 'image/*,application/pdf',
  multiple = true,
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 10,
  files = [],
  onUpload,
  onRemove,
  isUploading = false,
  uploadProgress = 0,
  disabled = false,
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  // Handle drag events
  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled || isUploading) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    processFiles(droppedFiles)
  }, [disabled, isUploading, files, maxFiles, onUpload])

  // Handle file input change
  const handleFileChange = useCallback((e) => {
    const selectedFiles = Array.from(e.target.files)
    processFiles(selectedFiles)
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [files, maxFiles, onUpload])

  // Process selected files
  const processFiles = (newFiles) => {
    setError(null)

    // Check max files
    const totalFiles = files.length + newFiles.length
    if (totalFiles > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`)
      return
    }

    // Validate each file
    const validFiles = []
    for (const file of newFiles) {
      const validation = validateFile(file)
      if (!validation.valid) {
        setError(validation.error)
        return
      }
      validFiles.push(file)
    }

    if (validFiles.length > 0 && onUpload) {
      onUpload(validFiles)
    }
  }

  // Open file picker
  const openFilePicker = () => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Get file icon based on type
  const getFileIcon = (type) => {
    if (type === 'application/pdf') return 'PDF'
    if (type.startsWith('image/')) return 'IMG'
    return 'FILE'
  }

  // Check if file is an image for preview
  const isImage = (type) => type?.startsWith('image/')

  return (
    <div className="w-full">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Drop zone */}
      <div
        onClick={openFilePicker}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-[--radius-card] p-6 text-center transition-colors cursor-pointer
          ${isDragging
            ? 'border-brand-primary bg-brand-primary/10'
            : 'border-border-default hover:border-border-strong'
          }
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isUploading ? (
          <div>
            <div className="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-muted border-t-brand-primary animate-spin" />
            <p className="text-text-secondary">Uploading... {uploadProgress}%</p>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div
                className="bg-brand-primary h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-3">+</div>
            <p className="text-text-primary font-medium mb-1">
              {isDragging ? 'Drop files here' : 'Click or drag files to upload'}
            </p>
            <p className="text-text-muted text-sm">
              PDF, JPG, PNG, HEIC, WebP (max {formatFileSize(maxSize)} each)
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 p-3 bg-error rounded-[--radius-sm]">
          <p className="text-error-text text-sm">{error}</p>
        </div>
      )}

      {/* Uploaded files list */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-text-secondary text-sm font-medium">
            Uploaded Files ({files.length})
          </p>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-surface rounded-[--radius-sm] border border-border-default"
            >
              {/* Preview or icon */}
              {isImage(file.type) && file.url ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-muted rounded text-text-secondary text-xs font-medium">
                  {getFileIcon(file.type)}
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm truncate">
                  {file.originalName || file.name}
                </p>
                <p className="text-text-muted text-xs">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {file.url && (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-primary text-sm hover:underline"
                  >
                    Preview
                  </a>
                )}
                {onRemove && !disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemove(index)
                    }}
                    className="text-error-text text-sm hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add more button */}
      {files.length > 0 && files.length < maxFiles && !disabled && !isUploading && (
        <button
          onClick={openFilePicker}
          className="mt-3 w-full py-2 border border-dashed border-border-default rounded-[--radius-button] text-text-secondary hover:bg-hover text-sm"
        >
          + Add More Files
        </button>
      )}
    </div>
  )
}
