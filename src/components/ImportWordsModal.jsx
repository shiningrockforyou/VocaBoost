import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Button, IconButton } from './ui'
import { batchAddWords } from '../services/db'

const ImportWordsModal = ({ isOpen, onClose, listId, onImportComplete }) => {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState([])
  const [parsedData, setParsedData] = useState([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [success, setSuccess] = useState('')

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const downloadTemplate = () => {
    const templateData = [
      {
        Word: 'abate',
        'Part of Speech': 'v.',
        'Definition (EN)': 'To become less intense or widespread.',
        'Definition (KO)': '강도나 범위가 줄어들다.',
        Sample: 'The storm suddenly abated.',
      },
      {
        Word: 'aberrant',
        'Part of Speech': 'adj.',
        'Definition (EN)': 'Deviating from the normal or typical.',
        'Definition (KO)': '정상이나 전형에서 벗어난.',
        Sample: 'His aberrant behavior concerned his friends.',
      },
      {
        Word: 'abeyance',
        'Part of Speech': 'n.',
        'Definition (EN)': 'A state of temporary disuse or suspension.',
        'Definition (KO)': '일시적으로 사용되지 않거나 중단된 상태.',
        Sample: 'The project was held in abeyance.',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Words')
    XLSX.writeFile(wb, 'vocabulary_import_template.xlsx')
  }

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0]
    if (!selectedFile) {
      return
    }

    setFile(selectedFile)
    setError('')
    setPreview([])
    setParsedData([])
    setSuccess('')

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        if (jsonData.length === 0) {
          setError('The file appears to be empty.')
          return
        }

        const normalized = jsonData.map((row) => {
          const word = row.Word || row.word || row.WORD || ''
          const sample = row.Sample || row.sample || row.SAMPLE || row['Sample Sentence'] || row['Sample sentence'] || ''

          const definitions = {}
          let primaryDefinition = ''

          Object.keys(row).forEach((key) => {
            const keyLower = key.toLowerCase()
            
            if (keyLower.includes('definition')) {
              const value = String(row[key]).trim()
              if (!value) return

              const langMatch = key.match(/\(([a-z]{2})\)/i) || key.match(/\s+([a-z]{2})$/i)
              if (langMatch) {
                const langCode = langMatch[1].toLowerCase()
                definitions[langCode] = value
                if (langCode === 'en' || !primaryDefinition) {
                  primaryDefinition = value
                }
              } else if (keyLower === 'definition' || keyLower === 'definition (en)') {
                definitions.en = value
                primaryDefinition = value
              }
            }
          })

          if (!primaryDefinition) {
            primaryDefinition = row.Definition || row.definition || row.DEFINITION || ''
            if (primaryDefinition) {
              definitions.en = String(primaryDefinition).trim()
              primaryDefinition = String(primaryDefinition).trim()
            }
          }

          const partOfSpeech =
            row.POS ||
            row.pos ||
            row['Part of Speech'] ||
            row['Part of speech'] ||
            row['part of speech'] ||
            ''

          return {
            word: String(word).trim(),
            definition: primaryDefinition,
            definitions,
            partOfSpeech: String(partOfSpeech).trim(),
            sample: String(sample).trim(),
          }
        }).filter((row) => row.word && row.definition)

        if (normalized.length === 0) {
          setError('No valid words found. Please check that your file has "Word" and "Definition" columns.')
          return
        }

        setParsedData(normalized)
        setPreview(normalized.slice(0, 5))
      } catch (err) {
        setError(`Failed to parse file: ${err.message}`)
      }
    }

    reader.onerror = () => {
      setError('Failed to read file.')
    }

    if (selectedFile.name.endsWith('.csv')) {
      reader.readAsText(selectedFile)
    } else {
      reader.readAsArrayBuffer(selectedFile)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!listId || parsedData.length === 0) {
      return
    }

    setImporting(true)
    setError('')
    setSuccess('')

    try {
      const wordsToImport = parsedData.map((row) => ({
        word: row.word || row.Word || '',
        definition: row.definition || row.Definition || row['Definition (EN)'] || '',
        definitions: row.definitions || {},
        partOfSpeech:
          row.partOfSpeech ||
          row.POS ||
          row.pos ||
          row['Part of Speech'] ||
          row['part of speech'] ||
          '',
        sampleSentence:
          row.sampleSentence ||
          row.sample ||
          row.Sample ||
          row['Sample Sentence'] ||
          row['Sample sentence'] ||
          (Array.isArray(row.samples) ? row.samples[0] : '') ||
          '',
      }))

      console.log('ImportWordsModal → Sending to DB:', wordsToImport[0])

      const result = await batchAddWords(listId, wordsToImport)
      setSuccess(`Successfully imported ${result.added} words!`)
      setTimeout(() => {
        onImportComplete?.()
        onClose()
        setFile(null)
        setPreview([])
        setParsedData([])
        setSuccess('')
      }, 1500)
    } catch (err) {
      setError(err.message ?? 'Failed to import words.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop - click to close */}
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Import Words from File</h2>
            <p className="text-sm text-slate-500">
              Upload an Excel (.xlsx, .xls) or CSV file with Word, Definition, and optional Sample columns.
            </p>
          </div>
          <IconButton variant="close" size="sm" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </IconButton>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex-1 cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border-strong bg-muted px-4 py-6 transition hover:border-blue-400 hover:bg-blue-50">
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {file ? file.name : 'Click to select file'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">.xlsx, .xls, or .csv</p>
                </div>
              </div>
            </label>
            <Button variant="outline" size="lg" onClick={downloadTemplate}>
              Download Template
            </Button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          )}

          {preview.length > 0 && (
            <div className="rounded-lg border border-border-default bg-muted p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">
                Preview (first 5 rows of {parsedData.length} total)
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead>
                    <tr className="bg-surface">
                      <th className="px-3 py-2 font-medium text-slate-600">Word</th>
                      <th className="px-3 py-2 font-medium text-slate-600">POS</th>
                      <th className="px-3 py-2 font-medium text-slate-600">Definition (EN)</th>
                      <th className="px-3 py-2 font-medium text-slate-600">Other Languages</th>
                      <th className="px-3 py-2 font-medium text-slate-600">Sample</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-surface">
                    {preview.map((row, index) => {
                      const otherLangs = Object.entries(row.definitions || {})
                        .filter(([lang]) => lang !== 'en')
                        .map(([lang, def]) => `${lang.toUpperCase()}: ${def}`)
                        .join(', ')
                      return (
                        <tr key={index}>
                          <td className="px-3 py-2 font-semibold text-slate-900">{row.word}</td>
                          <td className="px-3 py-2 text-slate-500">{row.partOfSpeech || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.definition}</td>
                          <td className="px-3 py-2 text-slate-500">{otherLangs || '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{row.sample || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="success" 
              size="lg" 
              className="flex-1" 
              onClick={handleSubmit}
              disabled={!parsedData.length || importing}
            >
              {importing ? 'Importing...' : `Import ${parsedData.length} Words`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportWordsModal

