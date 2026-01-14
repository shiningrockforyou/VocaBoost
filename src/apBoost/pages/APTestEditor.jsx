import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import { getTestById, createTest, updateTest, publishTest } from '../services/apTeacherService'
import { getQuestionsByIds, removeQuestionFromSection, reorderSectionQuestions } from '../services/apQuestionService'
import { SECTION_TYPE, DEFAULT_SCORE_RANGES, TEST_TYPE } from '../utils/apTypes'
import { AP_SUBJECTS } from '../utils/apTestConfig'
import { logError } from '../utils/logError'

/**
 * Section editor component
 */
function SectionEditor({
  section,
  sectionIndex,
  questions,
  onUpdate,
  onDelete,
  onAddQuestions,
  onRemoveQuestion,
  onMoveSection,
  canMoveUp,
  canMoveDown,
}) {
  const questionCount = section.questionIds?.length || 0

  return (
    <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-4">
      {/* Section header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <input
            type="text"
            value={section.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Section Title"
            className="text-lg font-semibold bg-transparent border-none text-text-primary focus:outline-none focus:ring-0 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onMoveSection('up')}
            disabled={!canMoveUp}
            className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
            title="Move up"
          >
            <span className="text-lg">^</span>
          </button>
          <button
            onClick={() => onMoveSection('down')}
            disabled={!canMoveDown}
            className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30"
            title="Move down"
          >
            <span className="text-lg">v</span>
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-error-text hover:text-error-text-strong"
            title="Delete section"
          >
            <span className="text-lg">X</span>
          </button>
        </div>
      </div>

      {/* Section settings */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-text-muted text-xs mb-1">Type</label>
          <select
            value={section.sectionType || SECTION_TYPE.MCQ}
            onChange={(e) => onUpdate({ sectionType: e.target.value })}
            className="w-full px-2 py-1 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
          >
            <option value={SECTION_TYPE.MCQ}>Multiple Choice</option>
            <option value={SECTION_TYPE.FRQ}>Free Response</option>
            <option value={SECTION_TYPE.MIXED}>Mixed</option>
          </select>
        </div>
        <div>
          <label className="block text-text-muted text-xs mb-1">Time (min)</label>
          <input
            type="number"
            min="1"
            value={section.timeLimit || 45}
            onChange={(e) => onUpdate({ timeLimit: parseInt(e.target.value) || 45 })}
            className="w-full px-2 py-1 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
          />
        </div>
        <div>
          <label className="block text-text-muted text-xs mb-1">Multiplier</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={section.multiplier || 1.0}
            onChange={(e) => onUpdate({ multiplier: parseFloat(e.target.value) || 1.0 })}
            className="w-full px-2 py-1 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
          />
        </div>
        <div className="flex items-end">
          <span className="text-text-secondary text-sm">
            {questionCount} question{questionCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-2 mb-4">
        {questions.map((question, idx) => (
          <div
            key={question.id}
            className="flex items-center justify-between py-2 px-3 bg-muted rounded-[--radius-sm]"
          >
            <div className="flex-1 min-w-0">
              <span className="text-text-muted text-sm mr-2">{idx + 1}.</span>
              <span className="text-text-primary text-sm truncate">
                {question.questionText?.substring(0, 60)}
                {question.questionText?.length > 60 ? '...' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Link
                to={`/ap/teacher/question/${question.id}/edit`}
                className="text-brand-primary text-xs hover:underline"
              >
                Edit
              </Link>
              <button
                onClick={() => onRemoveQuestion(question.id)}
                className="text-error-text text-xs hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add questions button */}
      <button
        onClick={onAddQuestions}
        className="w-full py-2 border border-dashed border-border-default rounded-[--radius-button] text-text-secondary hover:bg-hover text-sm"
      >
        + Add Questions
      </button>
    </div>
  )
}

/**
 * Score ranges editor
 */
function ScoreRangesEditor({ scoreRanges, onChange }) {
  const handleChange = (score, field, value) => {
    const newRanges = { ...scoreRanges }
    newRanges[score] = { ...newRanges[score], [field]: parseInt(value) || 0 }
    onChange(newRanges)
  }

  return (
    <div className="bg-surface rounded-[--radius-card] border border-border-default p-4">
      <h3 className="font-semibold text-text-primary mb-4">Score Ranges</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {['ap5', 'ap4', 'ap3', 'ap2', 'ap1'].map((score) => (
          <div key={score} className="text-center">
            <div className="font-medium text-text-primary mb-2">
              AP {score.replace('ap', '')}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <input
                type="number"
                min="0"
                max="100"
                value={scoreRanges[score]?.min ?? DEFAULT_SCORE_RANGES[score].min}
                onChange={(e) => handleChange(score, 'min', e.target.value)}
                className="w-12 px-1 py-1 text-center rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              />
              <span className="text-text-muted">-</span>
              <input
                type="number"
                min="0"
                max="100"
                value={scoreRanges[score]?.max ?? DEFAULT_SCORE_RANGES[score].max}
                onChange={(e) => handleChange(score, 'max', e.target.value)}
                className="w-12 px-1 py-1 text-center rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              />
              <span className="text-text-muted">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * APTestEditor - Create/edit test with sections
 */
export default function APTestEditor() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const isNew = testId === 'new'

  // Test state
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [testType, setTestType] = useState(TEST_TYPE.EXAM)
  const [sections, setSections] = useState([])
  const [scoreRanges, setScoreRanges] = useState(DEFAULT_SCORE_RANGES)
  const [isPublished, setIsPublished] = useState(false)

  // Questions cache (loaded for display)
  const [questionsCache, setQuestionsCache] = useState({})

  // UI state
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Load test data
  useEffect(() => {
    async function loadTest() {
      if (isNew || !testId) return

      try {
        setLoading(true)
        const test = await getTestById(testId)

        if (!test) {
          setError('Test not found')
          return
        }

        setTitle(test.title || '')
        setSubject(test.subject || '')
        setTestType(test.testType || TEST_TYPE.EXAM)
        setSections(test.sections || [])
        setScoreRanges(test.scoreRanges || DEFAULT_SCORE_RANGES)
        setIsPublished(test.isPublished || false)

        // Load questions for each section
        const allQuestionIds = test.sections?.flatMap(s => s.questionIds || []) || []
        if (allQuestionIds.length > 0) {
          const questions = await getQuestionsByIds(allQuestionIds)
          const cache = {}
          questions.forEach(q => {
            cache[q.id] = q
          })
          setQuestionsCache(cache)
        }
      } catch (err) {
        logError('APTestEditor.loadTest', { testId }, err)
        setError(err.message || 'Failed to load test')
      } finally {
        setLoading(false)
      }
    }

    loadTest()
  }, [testId, isNew])

  // Add new section
  const handleAddSection = () => {
    setSections([
      ...sections,
      {
        title: `Section ${sections.length + 1}`,
        sectionType: SECTION_TYPE.MCQ,
        timeLimit: 45,
        multiplier: 1.0,
        questionIds: [],
      }
    ])
  }

  // Update section
  const handleUpdateSection = (index, updates) => {
    const newSections = [...sections]
    newSections[index] = { ...newSections[index], ...updates }
    setSections(newSections)
  }

  // Delete section
  const handleDeleteSection = (index) => {
    if (!confirm('Delete this section? Questions will be removed from the test.')) return
    setSections(sections.filter((_, i) => i !== index))
  }

  // Move section
  const handleMoveSection = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sections.length) return

    const newSections = [...sections]
    const temp = newSections[index]
    newSections[index] = newSections[newIndex]
    newSections[newIndex] = temp
    setSections(newSections)
  }

  // Add questions to section (navigate to question picker)
  const handleAddQuestions = (sectionIndex) => {
    // Save current state to session storage and navigate to question picker
    sessionStorage.setItem('testEditor_state', JSON.stringify({
      testId: isNew ? null : testId,
      title,
      subject,
      testType,
      sections,
      scoreRanges,
      targetSectionIndex: sectionIndex,
    }))
    navigate('/ap/teacher/questions?picker=true')
  }

  // Remove question from section
  const handleRemoveQuestion = async (sectionIndex, questionId) => {
    const newSections = [...sections]
    newSections[sectionIndex] = {
      ...newSections[sectionIndex],
      questionIds: (newSections[sectionIndex].questionIds || []).filter(id => id !== questionId)
    }
    setSections(newSections)

    // If not new test, persist to Firestore
    if (!isNew && testId) {
      try {
        await removeQuestionFromSection(testId, sectionIndex, questionId)
      } catch (err) {
        logError('APTestEditor.removeQuestion', { testId, sectionIndex, questionId }, err)
      }
    }
  }

  // Get questions for a section
  const getSectionQuestions = (section) => {
    return (section.questionIds || [])
      .map(id => questionsCache[id])
      .filter(Boolean)
  }

  // Save test
  const handleSave = async (publish = false) => {
    if (!title.trim()) {
      alert('Please enter a test title')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const testData = {
        title: title.trim(),
        subject,
        testType,
        sections,
        scoreRanges,
        createdBy: user?.uid,
      }

      let savedTestId = testId

      if (isNew) {
        savedTestId = await createTest(testData)
      } else {
        await updateTest(testId, testData)
      }

      if (publish && savedTestId) {
        await publishTest(savedTestId)
      }

      // Navigate back or to the created test
      navigate(`/ap/teacher/test/${savedTestId}/edit`)
    } catch (err) {
      logError('APTestEditor.save', { testId, publish }, err)
      setError(err.message || 'Failed to save test')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6" />
            <div className="h-12 bg-muted rounded mb-4" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/ap/teacher"
              className="text-text-muted hover:text-text-primary"
            >
              Back
            </Link>
            <h1 className="text-xl font-bold text-text-primary">
              {isNew ? 'Create New Test' : 'Edit Test'}
            </h1>
          </div>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 rounded-[--radius-button] border border-border-default text-text-secondary hover:bg-hover disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-error rounded-[--radius-card] p-4 mb-6">
            <p className="text-error-text">{error}</p>
          </div>
        )}

        {/* Basic info */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-secondary text-sm mb-1">Test Name</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter test name..."
                className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-text-secondary text-sm mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              >
                <option value="">Select subject...</option>
                {AP_SUBJECTS.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="mb-6">
          <h2 className="font-semibold text-text-primary mb-4">Sections</h2>

          {sections.map((section, index) => (
            <SectionEditor
              key={index}
              section={section}
              sectionIndex={index}
              questions={getSectionQuestions(section)}
              onUpdate={(updates) => handleUpdateSection(index, updates)}
              onDelete={() => handleDeleteSection(index)}
              onAddQuestions={() => handleAddQuestions(index)}
              onRemoveQuestion={(qId) => handleRemoveQuestion(index, qId)}
              onMoveSection={(dir) => handleMoveSection(index, dir)}
              canMoveUp={index > 0}
              canMoveDown={index < sections.length - 1}
            />
          ))}

          <button
            onClick={handleAddSection}
            className="w-full py-3 border border-dashed border-border-default rounded-[--radius-button] text-text-secondary hover:bg-hover"
          >
            + Add Section
          </button>
        </div>

        {/* Score ranges */}
        <div className="mb-6">
          <ScoreRangesEditor
            scoreRanges={scoreRanges}
            onChange={setScoreRanges}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border-default">
          <button
            onClick={() => navigate('/ap/teacher')}
            className="px-4 py-2 text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <div className="flex items-center gap-3">
            {isPublished && (
              <span className="text-success-text text-sm">Published</span>
            )}
            <button
              onClick={() => handleSave(true)}
              disabled={saving || sections.length === 0}
              className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save and Publish'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
