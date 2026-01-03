import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const FONT_CONFIGS = [
  {
    url: '/Pretendard-Regular.ttf',
    vfsName: 'Pretendard-Regular.ttf',
    family: 'Pretendard',
    style: 'normal',
  },
  {
    url: '/Pretendard-Bold.ttf',
    vfsName: 'Pretendard-Bold.ttf',
    family: 'Pretendard',
    style: 'bold',
  },
]

const fontCache = {}

const arrayBufferToBase64 = (buffer) => {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

const loadLogoImage = async () => {
  try {
    const response = await fetch('/logo.png')
    if (!response.ok) {
      throw new Error(`Logo download failed with status ${response.status}`)
    }
    const blob = await response.blob()
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    // Get image dimensions to calculate aspect ratio
    const dimensions = await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = () => resolve(null)
      img.src = base64
    })

    return { base64, dimensions }
  } catch (err) {
    console.warn('Failed to load logo image.', err)
    return null
  }
}

const loadKoreanFont = async (doc) => {
  try {
    await Promise.all(
      FONT_CONFIGS.map(async (font) => {
        if (!fontCache[font.vfsName]) {
          const response = await fetch(font.url)
          if (!response.ok) {
            throw new Error(`Font download failed with status ${response.status}`)
          }
          const buffer = await response.arrayBuffer()
          fontCache[font.vfsName] = arrayBufferToBase64(buffer)
        }
        doc.addFileToVFS(font.vfsName, fontCache[font.vfsName])
        doc.addFont(font.vfsName, font.family, font.style)
      }),
    )
    return 'Pretendard'
  } catch (err) {
    console.warn('Failed to load Pretendard font. Falling back to default font.', err)
    return 'helvetica'
  }
}

const buildDefinitionCell = (word) => {
  const parts = []

  const primaryDefinition =
    word.definition ||
    word.definitionEn ||
    word.definition_en ||
    word['Definition (EN)'] ||
    word.definitionPrimary

  if (primaryDefinition) {
    parts.push(primaryDefinition)
  }

  if (word.definitions && typeof word.definitions === 'object') {
    Object.entries(word.definitions).forEach(([lang, def]) => {
      if (!def) {
        return
      }

      const normalizedLang = lang?.toUpperCase() || '??'
      const formatted = normalizedLang === 'EN' ? def : `[${normalizedLang}] ${def}`
      if (!parts.includes(formatted)) {
        parts.push(formatted)
      }
    })
  }

  if (word.secondaryDefinition) {
    const lang = word.secondaryLang ? word.secondaryLang.toUpperCase() : '??'
    parts.push(`[${lang}] ${word.secondaryDefinition}`)
  }

  if (word.definitionKo || word.definition_ko) {
    parts.push(`[KO] ${word.definitionKo || word.definition_ko}`)
  }

  return parts.length > 0 ? parts.join('\n') : '—'
}

const buildSampleCell = (word) => {
  return word.samples?.[0] || word.sample || word.sampleSentence || word['Sample'] || '—'
}

/**
 * Convert words array to table body format
 * @param {Array} words - Array of word objects
 * @returns {Array} Table body rows
 */
const wordsToTableBody = (words) => {
  return (Array.isArray(words) ? words : Object.values(words || {})).map((word, idx) => {
    const definitionText = (word.definition || '') + (word.definitions?.ko ? `\n[KR] ${word.definitions.ko}` : '')
    const wordNumber = (word.wordIndex ?? word.index ?? idx) + 1 // 1-indexed position in master list
    return [
      wordNumber.toString(),
      word.word || word.term || '—',
      word.partOfSpeech || word.pos || '—',
      definitionText?.trim()?.length ? definitionText : buildDefinitionCell(word),
      word.samples?.[0] || word.sample || word.sampleSentence || '—',
    ]
  })
}

/**
 * Common table styles for PDF generation
 */
const getTableStyles = (fontName) => ({
  theme: 'grid',
  rowPageBreak: 'avoid', // Prevent rows from splitting across pages
  styles: {
    font: fontName,
    fontStyle: 'normal',
    cellPadding: 2.5,
    fontSize: 10,
    lineColor: [226, 232, 240],
    lineWidth: 0.1,
    textColor: [15, 23, 42],
    overflow: 'linebreak',
  },
  headStyles: {
    font: fontName,
    fontStyle: 'bold',
    fillColor: [226, 232, 240],
    textColor: [15, 23, 42],
  },
  alternateRowStyles: {
    fillColor: [248, 250, 252],
  },
  columnStyles: {
    0: { cellWidth: 'wrap', halign: 'center' }, // # - shrink to fit
    1: { cellWidth: 'wrap', fontStyle: 'bold' }, // Word - shrink to fit
    2: { cellWidth: 'wrap' }, // POS - shrink to fit
    3: { cellWidth: 'auto' }, // Definition - share remaining space
    4: { cellWidth: 'auto' }, // Sample - share remaining space
  },
})

export const downloadListAsPDF = async (listTitle, words, mode = 'Full List') => {
  // Check if structured data format { newWords, failedCarryover, reviewWords } or flat array
  const isStructured = words && !Array.isArray(words) && 'newWords' in words
  const newWords = isStructured ? words.newWords : words
  const failedCarryover = isStructured ? (words.failedCarryover || []) : []
  const reviewWords = isStructured ? (words.reviewWords || []) : []

  const totalWords = (newWords?.length || 0) + failedCarryover.length + reviewWords.length

  if (!newWords || totalWords === 0) {
    alert('No words to print')
    return
  }

  try {
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    })

    // Load font and logo in parallel
    const [fontName, logoData] = await Promise.all([
      loadKoreanFont(doc),
      loadLogoImage()
    ])
    doc.setFont(fontName, 'normal')

    // Header - logo or fallback text
    if (logoData?.base64) {
      // Calculate width based on aspect ratio (fixed height of 10mm)
      const logoHeight = 10
      let logoWidth = 40 // default fallback
      if (logoData.dimensions) {
        const aspectRatio = logoData.dimensions.width / logoData.dimensions.height
        logoWidth = logoHeight * aspectRatio
      }
      doc.addImage(logoData.base64, 'PNG', 14, 12, logoWidth, logoHeight)
    } else {
      // Fallback to text if logo fails to load
      doc.setFontSize(22)
      doc.setTextColor(37, 99, 235)
      doc.text('VocaBoost', 14, 20)
    }

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(16)
    doc.text(listTitle, 14, 30)

    // Update subtitle based on mode
    let subtitle = ''
    if (mode === 'today') {
      subtitle = `Today's Study Batch • ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`
    } else if (mode === 'full') {
      subtitle = `Complete List • ${totalWords} words`
    } else if (mode === 'Daily Worksheet') {
      subtitle = `Personalized Study Queue for ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`
    }

    // Add subtitle if provided
    if (subtitle) {
      doc.setFontSize(11)
      doc.setTextColor(71, 85, 105)
      doc.text(subtitle, 14, 38)
    }

    doc.setFontSize(10)
    doc.setTextColor(71, 85, 105)
    const generatedY = subtitle ? 44 : 38
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      14,
      generatedY,
    )

    doc.setTextColor(0, 0, 0)
    doc.setFont(fontName, 'normal')

    let currentY = subtitle ? 48 : 42
    const tableStyles = getTableStyles(fontName)

    // Render new words section
    if (newWords && newWords.length > 0) {
      // Section header for structured mode
      if (isStructured) {
        doc.setFontSize(12)
        doc.setFont(fontName, 'bold')
        doc.setTextColor(37, 99, 235)
        doc.text(`Today's New Words (${newWords.length})`, 14, currentY)
        currentY += 6
        doc.setFont(fontName, 'normal')
        doc.setTextColor(0, 0, 0)
      }

      const newWordsBody = wordsToTableBody(newWords)

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Word', 'POS', 'Definition', 'Sample']],
        body: newWordsBody,
        ...tableStyles,
      })

      currentY = doc.lastAutoTable.finalY + 8
    }

    // Render failed carryover section with demarcation
    if (failedCarryover && failedCarryover.length > 0) {
      // Check if we need a new page
      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }

      // Demarcation line
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(14, currentY, 196, currentY)
      currentY += 6

      // Section header
      doc.setFontSize(12)
      doc.setFont(fontName, 'bold')
      doc.setTextColor(220, 38, 38) // Red for review/failed words
      doc.text(`Words to Review - Previous Days (${failedCarryover.length})`, 14, currentY)
      currentY += 4

      doc.setFontSize(9)
      doc.setFont(fontName, 'normal')
      doc.setTextColor(71, 85, 105)
      doc.text('These words need extra practice. Numbers show their original position in the list.', 14, currentY)
      currentY += 6

      doc.setTextColor(0, 0, 0)

      const failedBody = wordsToTableBody(failedCarryover)

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Word', 'POS', 'Definition', 'Sample']],
        body: failedBody,
        ...tableStyles,
        headStyles: {
          ...tableStyles.headStyles,
          fillColor: [254, 226, 226], // Light red background for failed words header
        },
      })

      currentY = doc.lastAutoTable.finalY + 8
    }

    // Render review words section
    if (reviewWords && reviewWords.length > 0) {
      // Check if we need a new page
      if (currentY > 250) {
        doc.addPage()
        currentY = 20
      }

      // Demarcation line
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(14, currentY, 196, currentY)
      currentY += 6

      // Section header
      doc.setFontSize(12)
      doc.setFont(fontName, 'bold')
      doc.setTextColor(34, 197, 94) // Green for review words
      doc.text(`Review Words (${reviewWords.length})`, 14, currentY)
      currentY += 4

      doc.setFontSize(9)
      doc.setFont(fontName, 'normal')
      doc.setTextColor(71, 85, 105)
      doc.text('Words from today\'s review segment for reinforcement.', 14, currentY)
      currentY += 6

      doc.setTextColor(0, 0, 0)

      const reviewBody = wordsToTableBody(reviewWords)

      autoTable(doc, {
        startY: currentY,
        head: [['#', 'Word', 'POS', 'Definition', 'Sample']],
        body: reviewBody,
        ...tableStyles,
        headStyles: {
          ...tableStyles.headStyles,
          fillColor: [220, 252, 231], // Light green background for review words header
        },
      })
    }

    const filename = `${listTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  } catch (err) {
    console.error('Error generating PDF:', err)
    alert('Failed to generate PDF. Please try again.')
  }
}
