import { jsPDF } from 'jspdf'

/**
 * Generate printable PDF answer sheet for handwritten FRQ responses
 * @param {Object} test - Test object with sections and questions
 * @param {Object} student - Student info { displayName, email }
 * @param {Object} frqQuestions - Map of questionId to question data
 * @returns {Blob} PDF blob for download
 */
export async function generateAnswerSheetPdf(test, student, frqQuestions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter', // 215.9 x 279.4 mm
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - (margin * 2)

  let yPos = margin

  // Helper: Add text with word wrap
  const addWrappedText = (text, x, y, maxWidth, lineHeight = 5) => {
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, y)
    return y + (lines.length * lineHeight)
  }

  // Helper: Check if we need a new page
  const checkNewPage = (neededHeight) => {
    if (yPos + neededHeight > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Helper: Draw lined writing area
  const drawWritingArea = (startY, height, lineSpacing = 8) => {
    const boxX = margin
    const boxWidth = contentWidth

    // Draw box border
    doc.setDrawColor(200, 200, 200)
    doc.rect(boxX, startY, boxWidth, height)

    // Draw lines inside
    doc.setDrawColor(220, 220, 220)
    let lineY = startY + lineSpacing
    while (lineY < startY + height - 2) {
      doc.line(boxX + 2, lineY, boxX + boxWidth - 2, lineY)
      lineY += lineSpacing
    }

    doc.setDrawColor(0, 0, 0)
    return startY + height
  }

  // ===== PAGE 1: Header =====

  // Title
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('ANSWER SHEET', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // Test title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(test.title || 'Practice Test', pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  // Divider
  doc.setDrawColor(0, 0, 0)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 8

  // Student info fields
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')

  // Name field
  doc.text('Student Name:', margin, yPos)
  doc.line(margin + 35, yPos, margin + 120, yPos)
  if (student?.displayName) {
    doc.setFont('helvetica', 'italic')
    doc.text(student.displayName, margin + 37, yPos - 1)
    doc.setFont('helvetica', 'normal')
  }

  // Date field
  doc.text('Date:', margin + 130, yPos)
  doc.line(margin + 145, yPos, pageWidth - margin, yPos)
  yPos += 15

  // Instructions
  doc.setFontSize(10)
  doc.setFont('helvetica', 'italic')
  const instructions = 'Instructions: Write your answers clearly in the spaces provided. ' +
    'If you need additional space, continue on the back of the page and label clearly.'
  yPos = addWrappedText(instructions, margin, yPos, contentWidth, 4)
  yPos += 10
  doc.setFont('helvetica', 'normal')

  // Divider
  doc.line(margin, yPos, pageWidth - margin, yPos)
  yPos += 10

  // ===== FRQ QUESTIONS =====

  // Find FRQ sections
  const frqSections = test.sections?.filter(s =>
    s.sectionType === 'FRQ' || s.sectionType === 'MIXED'
  ) || []

  let questionNumber = 0

  for (const section of frqSections) {
    // Section header
    checkNewPage(20)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`SECTION: ${section.title || 'Free Response'}`, margin, yPos)
    yPos += 8

    const sectionQuestionIds = section.questionIds || []

    for (const questionId of sectionQuestionIds) {
      const question = frqQuestions[questionId]
      if (!question) continue

      questionNumber++

      // Check for new page before question
      checkNewPage(60)

      // Question divider
      doc.setDrawColor(100, 100, 100)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      doc.setDrawColor(0, 0, 0)
      yPos += 8

      // Question header
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')

      const totalPoints = question.subQuestions?.reduce((sum, sq) => sum + (sq.maxPoints || 0), 0) || 0
      doc.text(`QUESTION ${questionNumber}`, margin, yPos)
      if (totalPoints > 0) {
        doc.setFont('helvetica', 'normal')
        doc.text(`(${totalPoints} points)`, margin + 35, yPos)
      }
      yPos += 8

      // Stimulus (if any)
      if (question.stimulus?.content) {
        checkNewPage(40)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'italic')

        // Draw stimulus box
        doc.setFillColor(245, 245, 245)
        doc.rect(margin, yPos, contentWidth, 30, 'F')
        doc.setDrawColor(200, 200, 200)
        doc.rect(margin, yPos, contentWidth, 30)
        doc.setDrawColor(0, 0, 0)

        yPos += 5
        const stimulusText = question.stimulus.content.substring(0, 500) +
          (question.stimulus.content.length > 500 ? '...' : '')
        yPos = addWrappedText(stimulusText, margin + 3, yPos, contentWidth - 6, 4)

        if (question.stimulus.source) {
          yPos += 3
          doc.text(`— ${question.stimulus.source}`, margin + 3, yPos)
        }
        yPos += 10
        doc.setFont('helvetica', 'normal')
      }

      // Question text
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      if (question.questionText) {
        yPos = addWrappedText(question.questionText, margin, yPos, contentWidth, 5)
        yPos += 5
      }

      // Sub-questions
      const subQuestions = question.subQuestions || []

      for (const subQ of subQuestions) {
        checkNewPage(80)

        // Sub-question label and prompt
        doc.setFontSize(11)
        doc.setFont('helvetica', 'bold')
        doc.text(`(${subQ.label})`, margin, yPos)

        doc.setFont('helvetica', 'normal')
        const pointsText = subQ.maxPoints ? ` (${subQ.maxPoints} pts)` : ''
        const promptWithPoints = (subQ.prompt || '') + pointsText
        yPos = addWrappedText(promptWithPoints, margin + 10, yPos, contentWidth - 10, 5)
        yPos += 5

        // Writing area
        const writingHeight = Math.min(80, Math.max(40, (subQ.maxPoints || 3) * 15))
        yPos = drawWritingArea(yPos, writingHeight)
        yPos += 10
      }

      // If no sub-questions, add a general writing area
      if (subQuestions.length === 0) {
        checkNewPage(60)
        yPos = drawWritingArea(yPos, 60)
        yPos += 10
      }
    }
  }

  // ===== FOOTER ON LAST PAGE =====
  doc.setFontSize(9)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'End of Answer Sheet',
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  )

  // Return as blob
  return doc.output('blob')
}

/**
 * Download the generated PDF
 * @param {Object} test - Test object
 * @param {Object} student - Student info
 * @param {Object} frqQuestions - FRQ questions map
 */
export async function downloadAnswerSheetPdf(test, student, frqQuestions) {
  const blob = await generateAnswerSheetPdf(test, student, frqQuestions)

  // Create download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `answer_sheet_${test.title?.replace(/[^a-z0-9]/gi, '_') || 'test'}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default generateAnswerSheetPdf
