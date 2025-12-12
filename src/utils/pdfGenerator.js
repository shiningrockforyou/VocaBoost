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

export const downloadListAsPDF = async (listTitle, words, mode = 'Full List') => {
  if (!words || words.length === 0) {
    alert('No words to print')
    return
  }

  try {
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    })

    const fontName = await loadKoreanFont(doc)
    doc.setFont(fontName, 'normal')

    // Header
    doc.setFontSize(22)
    doc.setTextColor(37, 99, 235)
    doc.text('VocaBoost', 14, 20)

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
      subtitle = `Complete List • ${words.length} words`
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

    console.log('Raw Words Input:', words)
    const tableBody = (Array.isArray(words) ? words : Object.values(words || {})).map((word, idx) => {
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
    console.log('Mapped Table Body:', tableBody)

    doc.setFont(fontName, 'normal')

    autoTable(doc, {
      startY: subtitle ? 48 : 42,
      head: [['#', 'Word', 'POS', 'Definition', 'Sample']],
      body: tableBody,
      theme: 'grid',
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
        0: { cellWidth: 10, halign: 'center' }, // Number column - narrow, centered
        1: { cellWidth: 35, fontStyle: 'bold' }, // Word column
        2: { cellWidth: 20, fontStyle: 'normal' }, // POS column
        3: { cellWidth: 75, fontStyle: 'normal' }, // Definition column
        4: { cellWidth: 60, fontStyle: 'normal' }, // Sample column
      },
    })

    const filename = `${listTitle.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
  } catch (err) {
    console.error('Error generating PDF:', err)
    alert('Failed to generate PDF. Please try again.')
  }
}
