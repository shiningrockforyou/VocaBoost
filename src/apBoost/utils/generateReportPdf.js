/**
 * Generate Report Card PDF
 * Creates a downloadable PDF of student test results
 */
import jsPDF from 'jspdf'

/**
 * Generate a PDF report card for a student
 * @param {Object} result - Test result object
 * @param {Object} test - Test metadata
 * @param {Object} student - Student info { name, email }
 * @returns {jsPDF} PDF document
 */
export async function generateReportPdf(result, test, student) {
  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Helper functions
  const addText = (text, x, y, options = {}) => {
    const { fontSize = 12, fontStyle = 'normal', align = 'left' } = options
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', fontStyle)

    if (align === 'center') {
      doc.text(text, pageWidth / 2, y, { align: 'center' })
    } else if (align === 'right') {
      doc.text(text, pageWidth - margin, y, { align: 'right' })
    } else {
      doc.text(text, x, y)
    }
  }

  const addLine = (y, color = '#e0e0e0') => {
    doc.setDrawColor(color)
    doc.line(margin, y, pageWidth - margin, y)
  }

  // Header
  addText('SCORE REPORT', 0, yPos, { fontSize: 20, fontStyle: 'bold', align: 'center' })
  yPos += 10

  addText('AP Practice Exam', 0, yPos, { fontSize: 12, align: 'center' })
  yPos += 15

  addLine(yPos)
  yPos += 10

  // Student Info
  addText('Student:', margin, yPos, { fontStyle: 'bold' })
  addText(student?.name || 'Student', margin + 40, yPos)
  yPos += 7

  addText('Test:', margin, yPos, { fontStyle: 'bold' })
  addText(test?.title || 'Practice Test', margin + 40, yPos)
  yPos += 7

  addText('Date:', margin, yPos, { fontStyle: 'bold' })
  const completedDate = result?.completedAt?.toDate?.()
    ? result.completedAt.toDate().toLocaleDateString()
    : new Date().toLocaleDateString()
  addText(completedDate, margin + 40, yPos)
  yPos += 15

  addLine(yPos)
  yPos += 15

  // AP Score (large)
  addText('AP SCORE', 0, yPos, { fontSize: 14, fontStyle: 'bold', align: 'center' })
  yPos += 15

  const apScore = result?.apScore || '—'
  addText(String(apScore), 0, yPos, { fontSize: 48, fontStyle: 'bold', align: 'center' })
  yPos += 20

  // Score range indicator
  const scoreLabel = getAPScoreLabel(apScore)
  addText(scoreLabel, 0, yPos, { fontSize: 10, align: 'center' })
  yPos += 20

  addLine(yPos)
  yPos += 15

  // Section Scores
  addText('SECTION BREAKDOWN', margin, yPos, { fontSize: 14, fontStyle: 'bold' })
  yPos += 12

  // MCQ Section
  const mcqResults = result?.mcqResults || []
  const mcqCorrect = mcqResults.filter(r => r.correct).length
  const mcqTotal = mcqResults.length
  const mcqPercentage = mcqTotal > 0 ? Math.round((mcqCorrect / mcqTotal) * 100) : 0

  addText('Multiple Choice:', margin, yPos, { fontStyle: 'bold' })
  addText(`${mcqCorrect}/${mcqTotal} (${mcqPercentage}%)`, margin + 80, yPos)
  yPos += 10

  // Draw progress bar
  const barWidth = 100
  const barHeight = 6
  doc.setFillColor(230, 230, 230)
  doc.rect(margin, yPos, barWidth, barHeight, 'F')
  doc.setFillColor(66, 133, 244) // Blue
  doc.rect(margin, yPos, (barWidth * mcqPercentage) / 100, barHeight, 'F')
  yPos += 15

  // FRQ Section (if applicable)
  if (result?.frqMaxPoints > 0) {
    const frqScore = result?.frqScore ?? '—'
    const frqMax = result?.frqMaxPoints || 0
    const frqPercentage = frqMax > 0 && typeof frqScore === 'number'
      ? Math.round((frqScore / frqMax) * 100)
      : 0

    addText('Free Response:', margin, yPos, { fontStyle: 'bold' })
    if (result?.gradingStatus === 'pending') {
      addText('Pending Grading', margin + 80, yPos)
    } else {
      addText(`${frqScore}/${frqMax} (${frqPercentage}%)`, margin + 80, yPos)
    }
    yPos += 10

    // Draw progress bar
    doc.setFillColor(230, 230, 230)
    doc.rect(margin, yPos, barWidth, barHeight, 'F')
    if (typeof frqScore === 'number') {
      doc.setFillColor(52, 168, 83) // Green
      doc.rect(margin, yPos, (barWidth * frqPercentage) / 100, barHeight, 'F')
    }
    yPos += 15
  }

  // Total
  addText('Total:', margin, yPos, { fontStyle: 'bold' })
  addText(`${result?.score || 0}/${result?.maxScore || 0} (${result?.percentage || 0}%)`, margin + 80, yPos)
  yPos += 20

  addLine(yPos)
  yPos += 15

  // MCQ Results Table
  if (mcqResults.length > 0) {
    addText('MULTIPLE CHOICE RESULTS', margin, yPos, { fontSize: 14, fontStyle: 'bold' })
    yPos += 12

    // Table headers
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Q#', margin, yPos)
    doc.text('Your Answer', margin + 20, yPos)
    doc.text('Correct', margin + 55, yPos)
    doc.text('Result', margin + 85, yPos)
    yPos += 7

    addLine(yPos)
    yPos += 5

    // Table rows
    doc.setFont('helvetica', 'normal')
    for (let i = 0; i < mcqResults.length; i++) {
      if (yPos > 270) {
        doc.addPage()
        yPos = margin
      }

      const r = mcqResults[i]
      doc.text(String(i + 1), margin, yPos)
      doc.text(r.studentAnswer || '—', margin + 20, yPos)
      doc.text(r.correctAnswer || '—', margin + 55, yPos)
      doc.text(r.correct ? '✓' : '✗', margin + 85, yPos)
      yPos += 6
    }
    yPos += 10
  }

  // FRQ Results (if graded)
  if (result?.frqGrades && Object.keys(result.frqGrades).length > 0) {
    if (yPos > 200) {
      doc.addPage()
      yPos = margin
    }

    addLine(yPos)
    yPos += 15

    addText('FREE RESPONSE RESULTS', margin, yPos, { fontSize: 14, fontStyle: 'bold' })
    yPos += 12

    Object.entries(result.frqGrades).forEach(([questionId, grade], qIdx) => {
      if (yPos > 250) {
        doc.addPage()
        yPos = margin
      }

      const questionPoints = Object.values(grade.subScores || {}).reduce((a, b) => a + b, 0)

      addText(`Question ${qIdx + 1}:`, margin, yPos, { fontStyle: 'bold' })
      addText(`${questionPoints}/${grade.maxPoints || '?'} pts`, margin + 50, yPos)
      yPos += 7

      // Sub-scores
      if (grade.subScores) {
        Object.entries(grade.subScores).forEach(([label, score]) => {
          doc.text(`  (${label}): ${score} pts`, margin, yPos)
          yPos += 5
        })
      }

      // Comment
      if (grade.comment) {
        yPos += 3
        doc.setFontSize(9)
        doc.setTextColor(100, 100, 100)
        const commentLines = doc.splitTextToSize(`Feedback: ${grade.comment}`, contentWidth - 10)
        doc.text(commentLines, margin, yPos)
        yPos += commentLines.length * 4
        doc.setTextColor(0, 0, 0)
        doc.setFontSize(10)
      }

      yPos += 8
    })
  }

  // Footer
  yPos = 280
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Generated by VocaBoost AP Practice', pageWidth / 2, yPos, { align: 'center' })
  doc.text(new Date().toLocaleString(), pageWidth / 2, yPos + 4, { align: 'center' })

  return doc
}

/**
 * Download report card as PDF
 * @param {Object} result - Test result
 * @param {Object} test - Test metadata
 * @param {Object} student - Student info
 */
export async function downloadReportPdf(result, test, student) {
  const doc = await generateReportPdf(result, test, student)
  const filename = `AP_Report_${student?.name?.replace(/\s+/g, '_') || 'Student'}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

/**
 * Get AP score label
 */
function getAPScoreLabel(score) {
  const labels = {
    5: 'Extremely well qualified',
    4: 'Well qualified',
    3: 'Qualified',
    2: 'Possibly qualified',
    1: 'No recommendation',
  }
  return labels[score] || ''
}
