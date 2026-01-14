/**
 * Generate Questions PDF
 * Creates a PDF of test questions for teacher reference
 */
import jsPDF from 'jspdf'

/**
 * Generate a PDF of test questions
 * @param {Object} test - Test object with sections and questions
 * @param {Object} questions - Questions map
 * @param {Object} options - { includeAnswers: boolean, includeStimuli: boolean }
 * @returns {jsPDF} PDF document
 */
export async function generateQuestionsPdf(test, questions, options = {}) {
  const { includeAnswers = false, includeStimuli = true } = options

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Helper functions
  const addText = (text, x, y, options = {}) => {
    const { fontSize = 12, fontStyle = 'normal', color = [0, 0, 0] } = options
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', fontStyle)
    doc.setTextColor(...color)
    doc.text(text, x, y)
  }

  const addWrappedText = (text, x, y, maxWidth, options = {}) => {
    const { fontSize = 11, fontStyle = 'normal', lineHeight = 5 } = options
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', fontStyle)
    const lines = doc.splitTextToSize(text, maxWidth)

    for (let i = 0; i < lines.length; i++) {
      if (y + i * lineHeight > pageHeight - 20) {
        doc.addPage()
        y = margin
      }
      doc.text(lines[i], x, y + i * lineHeight)
    }

    return y + lines.length * lineHeight
  }

  const addLine = (y, color = '#e0e0e0') => {
    doc.setDrawColor(color)
    doc.line(margin, y, pageWidth - margin, y)
  }

  const checkPageBreak = (neededSpace) => {
    if (yPos + neededSpace > pageHeight - 20) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Title page
  yPos = 60
  addText(test?.title || 'AP Practice Test', 0, yPos, { fontSize: 24, fontStyle: 'bold' })
  doc.text(test?.title || 'AP Practice Test', pageWidth / 2, yPos, { align: 'center' })

  yPos += 15
  doc.setFontSize(12)
  doc.text(includeAnswers ? 'Teacher Edition (with answers)' : 'Student Edition', pageWidth / 2, yPos, { align: 'center' })

  yPos += 30
  doc.setFontSize(11)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPos, { align: 'center' })

  // Start content on new page
  doc.addPage()
  yPos = margin

  // Process sections
  const sections = test?.sections || []
  let questionNumber = 0

  for (let sectionIdx = 0; sectionIdx < sections.length; sectionIdx++) {
    const section = sections[sectionIdx]

    // Section header
    checkPageBreak(30)
    addText(`Section ${sectionIdx + 1}: ${section.title || 'Questions'}`, margin, yPos, {
      fontSize: 16,
      fontStyle: 'bold',
    })
    yPos += 8

    if (section.timeLimit) {
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Time: ${section.timeLimit} minutes`, margin, yPos)
      doc.setTextColor(0, 0, 0)
      yPos += 5
    }

    addLine(yPos)
    yPos += 10

    // Process questions in section
    const questionIds = section.questionIds || []

    for (const questionId of questionIds) {
      const question = questions[questionId]
      if (!question) continue

      questionNumber++

      // Check page break
      checkPageBreak(50)

      // Question header
      addText(`Question ${questionNumber}`, margin, yPos, { fontSize: 12, fontStyle: 'bold' })
      if (question.questionDomain) {
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        doc.text(`Domain: ${question.questionDomain}`, margin + 80, yPos)
        doc.setTextColor(0, 0, 0)
      }
      yPos += 8

      // Stimulus (if applicable and requested)
      if (includeStimuli && question.stimulus) {
        checkPageBreak(30)
        doc.setFillColor(245, 245, 245)
        const stimulusLines = doc.splitTextToSize(question.stimulus, contentWidth - 10)
        const stimulusHeight = stimulusLines.length * 5 + 10
        doc.rect(margin, yPos, contentWidth, Math.min(stimulusHeight, 80), 'F')

        doc.setFontSize(9)
        doc.setFont('helvetica', 'italic')
        const displayLines = stimulusLines.slice(0, 15) // Limit lines
        doc.text(displayLines, margin + 5, yPos + 7)
        doc.setFont('helvetica', 'normal')
        yPos += Math.min(stimulusHeight, 80) + 5
      }

      // Question text
      checkPageBreak(20)
      doc.setFontSize(11)
      yPos = addWrappedText(question.questionText || 'No question text', margin, yPos, contentWidth)
      yPos += 5

      // Answer choices (for MCQ)
      if (question.questionType === 'mcq' || !question.questionType) {
        const choices = ['A', 'B', 'C', 'D', 'E'].slice(0, question.choiceCount || 4)

        for (const choice of choices) {
          const choiceKey = `choice${choice}`
          const choiceText = question[choiceKey]
          if (!choiceText) continue

          checkPageBreak(10)

          const isCorrect = includeAnswers && (question.correctAnswers || []).includes(choice)
          const prefix = isCorrect ? '✓ ' : '  '

          doc.setFontSize(10)
          if (isCorrect) {
            doc.setTextColor(34, 139, 34) // Green
            doc.setFont('helvetica', 'bold')
          } else {
            doc.setTextColor(0, 0, 0)
            doc.setFont('helvetica', 'normal')
          }

          doc.text(`${prefix}(${choice}) ${choiceText}`, margin + 5, yPos)
          yPos += 6
        }

        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
      }

      // Sub-questions (for FRQ)
      if (question.subQuestions && question.subQuestions.length > 0) {
        for (const sq of question.subQuestions) {
          checkPageBreak(20)
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text(`(${sq.label}) [${sq.points || 3} pts]`, margin + 5, yPos)
          yPos += 5

          if (sq.prompt) {
            doc.setFont('helvetica', 'normal')
            yPos = addWrappedText(sq.prompt, margin + 10, yPos, contentWidth - 10, { fontSize: 10 })
          }
          yPos += 5
        }
      }

      // Answer key (if showing answers)
      if (includeAnswers) {
        checkPageBreak(15)
        doc.setFontSize(9)
        doc.setTextColor(34, 139, 34)
        if (question.correctAnswers) {
          doc.text(`Answer: ${question.correctAnswers.join(', ')}`, margin, yPos)
        }
        if (question.explanation) {
          yPos += 5
          yPos = addWrappedText(`Explanation: ${question.explanation}`, margin, yPos, contentWidth, { fontSize: 9 })
        }
        doc.setTextColor(0, 0, 0)
        yPos += 5
      }

      // Space between questions
      yPos += 10
      if (yPos < pageHeight - 40) {
        addLine(yPos, '#eeeeee')
        yPos += 10
      }
    }

    // Add page break between sections
    if (sectionIdx < sections.length - 1) {
      doc.addPage()
      yPos = margin
    }
  }

  // Answer key page (if including answers)
  if (includeAnswers) {
    doc.addPage()
    yPos = margin

    addText('ANSWER KEY', margin, yPos, { fontSize: 16, fontStyle: 'bold' })
    yPos += 15

    let qNum = 0
    for (const section of sections) {
      for (const questionId of section.questionIds || []) {
        const question = questions[questionId]
        if (!question) continue
        qNum++

        checkPageBreak(10)

        const answer = question.correctAnswers?.join(', ') || '—'
        doc.setFontSize(10)
        doc.text(`${qNum}. ${answer}`, margin, yPos)

        // Move to next column if needed
        if (qNum % 2 === 0) {
          yPos += 6
        } else {
          doc.text(``, margin + 80, yPos)
        }
      }
    }
  }

  return doc
}

/**
 * Download questions as PDF
 * @param {Object} test - Test object
 * @param {Object} questions - Questions map
 * @param {Object} options - Generation options
 */
export async function downloadQuestionsPdf(test, questions, options = {}) {
  const doc = await generateQuestionsPdf(test, questions, options)
  const filename = `${test?.title?.replace(/\s+/g, '_') || 'Questions'}_${options.includeAnswers ? 'Teacher' : 'Student'}.pdf`
  doc.save(filename)
}
