import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import { searchQuestions, getAvailableSubjects, getAvailableDomains, addQuestionsToSection } from '../services/apQuestionService'
import { QUESTION_TYPE, DIFFICULTY } from '../utils/apTypes'
import { AP_SUBJECTS } from '../utils/apTestConfig'
import { logError } from '../utils/logError'

/**
 * Filter dropdown component
 */
function FilterSelect({ label, value, options, onChange, allLabel = 'All' }) {
  return (
    <div>
      <label className="block text-text-muted text-xs mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
      >
        <option value="">{allLabel}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

/**
 * Question row in the list
 */
function QuestionRow({ question, selected, onSelect, onPreview, isPickerMode, onAddToTest }) {
  const typeLabel = {
    [QUESTION_TYPE.MCQ]: 'MCQ',
    [QUESTION_TYPE.MCQ_MULTI]: 'MCQ-M',
    [QUESTION_TYPE.FRQ]: 'FRQ',
    [QUESTION_TYPE.SAQ]: 'SAQ',
    [QUESTION_TYPE.DBQ]: 'DBQ',
  }[question.questionType] || question.questionType

  const difficultyColors = {
    [DIFFICULTY.EASY]: 'text-success-text',
    [DIFFICULTY.MEDIUM]: 'text-warning-text',
    [DIFFICULTY.HARD]: 'text-error-text',
  }

  return (
    <div className="flex items-start gap-3 py-3 px-4 border-b border-border-muted hover:bg-hover transition-colors">
      {/* Checkbox */}
      <div className="pt-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(question.id)}
          className="w-4 h-4 rounded border-border-default text-brand-primary focus:ring-brand-primary"
        />
      </div>

      {/* Question info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 text-xs rounded bg-muted text-text-secondary">
            {typeLabel}
          </span>
          {question.questionDomain && (
            <span className="text-text-muted text-xs">
              {question.questionDomain}
            </span>
          )}
          {question.difficulty && (
            <span className={`text-xs ${difficultyColors[question.difficulty] || 'text-text-muted'}`}>
              {question.difficulty}
            </span>
          )}
        </div>
        <p className="text-text-primary text-sm line-clamp-2">
          {question.questionText}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onPreview(question)}
          className="px-2 py-1 text-xs text-brand-primary hover:underline"
        >
          Preview
        </button>
        {!isPickerMode && (
          <Link
            to={`/ap/teacher/question/${question.id}/edit`}
            className="px-2 py-1 text-xs text-text-secondary hover:underline"
          >
            Edit
          </Link>
        )}
        {isPickerMode && (
          <button
            onClick={() => onAddToTest(question.id)}
            className="px-3 py-1 text-xs bg-brand-primary text-white rounded-[--radius-button] hover:opacity-90"
          >
            Add
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Question preview modal
 */
function QuestionPreviewModal({ question, onClose }) {
  if (!question) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface rounded-[--radius-card] shadow-theme-lg w-full max-w-2xl max-h-[80vh] overflow-auto z-50">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Question Preview</h3>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary text-xl"
            >
              X
            </button>
          </div>

          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 text-xs rounded bg-muted text-text-secondary">
                {question.questionType}
              </span>
              <span className="text-text-muted text-sm">{question.questionDomain}</span>
            </div>
            <p className="text-text-primary whitespace-pre-wrap">{question.questionText}</p>
          </div>

          {/* MCQ choices */}
          {(question.questionType === QUESTION_TYPE.MCQ || question.questionType === QUESTION_TYPE.MCQ_MULTI) && (
            <div className="space-y-2 mb-4">
              {['A', 'B', 'C', 'D', 'E'].map(letter => {
                const choice = question[`choice${letter}`]
                if (!choice) return null
                const text = typeof choice === 'string' ? choice : choice.text
                const isCorrect = question.correctAnswers?.includes(letter)

                return (
                  <div
                    key={letter}
                    className={`p-2 rounded-[--radius-sm] ${isCorrect ? 'bg-success/20 border border-success' : 'bg-muted'}`}
                  >
                    <span className="font-medium mr-2">{letter}.</span>
                    <span className="text-text-primary">{text}</span>
                    {isCorrect && <span className="text-success-text ml-2 text-sm">(Correct)</span>}
                  </div>
                )
              })}
            </div>
          )}

          {/* FRQ sub-questions */}
          {question.questionType === QUESTION_TYPE.FRQ && question.subQuestions && (
            <div className="space-y-3 mb-4">
              {question.subQuestions.map((sq, idx) => (
                <div key={idx} className="p-3 bg-muted rounded-[--radius-sm]">
                  <span className="font-medium text-text-secondary">({sq.label})</span>
                  <p className="text-text-primary mt-1">{sq.prompt}</p>
                  <p className="text-text-muted text-xs mt-1">Max points: {sq.maxPoints}</p>
                </div>
              ))}
            </div>
          )}

          {/* Explanation */}
          {question.explanation && (
            <div className="mt-4 p-3 bg-info/10 rounded-[--radius-sm]">
              <span className="font-medium text-info-text-strong text-sm">Explanation:</span>
              <p className="text-text-secondary text-sm mt-1">{question.explanation}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * APQuestionBank - Browse and manage questions
 */
export default function APQuestionBank() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const isPickerMode = searchParams.get('picker') === 'true'

  // Filter state
  const [subject, setSubject] = useState('')
  const [questionType, setQuestionType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [domain, setDomain] = useState('')
  const [searchText, setSearchText] = useState('')

  // Data state
  const [questions, setQuestions] = useState([])
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Selection state
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Preview modal
  const [previewQuestion, setPreviewQuestion] = useState(null)

  // Load questions
  useEffect(() => {
    async function loadQuestions() {
      try {
        setLoading(true)
        setError(null)

        const filters = {}
        if (subject) filters.subject = subject
        if (questionType) filters.questionType = questionType
        if (difficulty) filters.difficulty = difficulty
        if (domain) filters.domain = domain
        if (searchText) filters.search = searchText

        const results = await searchQuestions(filters)
        setQuestions(results)
      } catch (err) {
        logError('APQuestionBank.loadQuestions', {}, err)
        setError(err.message || 'Failed to load questions')
      } finally {
        setLoading(false)
      }
    }

    loadQuestions()
  }, [subject, questionType, difficulty, domain, searchText])

  // Load domains when subject changes
  useEffect(() => {
    async function loadDomains() {
      if (!subject) {
        setDomains([])
        return
      }

      try {
        const results = await getAvailableDomains(subject)
        setDomains(results)
      } catch (err) {
        logError('APQuestionBank.loadDomains', { subject }, err)
      }
    }

    loadDomains()
    setDomain('') // Reset domain when subject changes
  }, [subject])

  // Toggle selection
  const handleSelect = (id) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  // Select all
  const handleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(questions.map(q => q.id)))
    }
  }

  // Add single question to test (picker mode)
  const handleAddSingleToTest = async (questionId) => {
    try {
      const savedState = sessionStorage.getItem('testEditor_state')
      if (!savedState) {
        alert('No test editor state found. Please start from the test editor.')
        return
      }

      const state = JSON.parse(savedState)
      const { testId, targetSectionIndex } = state

      if (testId) {
        // Existing test - add to Firestore
        await addQuestionsToSection(testId, targetSectionIndex, [questionId])
      } else {
        // New test - update session storage
        state.sections[targetSectionIndex].questionIds = [
          ...(state.sections[targetSectionIndex].questionIds || []),
          questionId
        ]
        sessionStorage.setItem('testEditor_state', JSON.stringify(state))
      }

      // Navigate back to test editor
      const backUrl = testId ? `/ap/teacher/test/${testId}/edit` : '/ap/teacher/test/new'
      navigate(backUrl)
    } catch (err) {
      logError('APQuestionBank.addSingleToTest', { questionId }, err)
      alert('Failed to add question: ' + err.message)
    }
  }

  // Add selected questions to test (picker mode)
  const handleAddSelectedToTest = async () => {
    if (selectedIds.size === 0) {
      alert('Please select questions to add')
      return
    }

    try {
      const savedState = sessionStorage.getItem('testEditor_state')
      if (!savedState) {
        alert('No test editor state found. Please start from the test editor.')
        return
      }

      const state = JSON.parse(savedState)
      const { testId, targetSectionIndex } = state
      const questionIds = Array.from(selectedIds)

      if (testId) {
        // Existing test - add to Firestore
        await addQuestionsToSection(testId, targetSectionIndex, questionIds)
      } else {
        // New test - update session storage
        state.sections[targetSectionIndex].questionIds = [
          ...(state.sections[targetSectionIndex].questionIds || []),
          ...questionIds
        ]
        sessionStorage.setItem('testEditor_state', JSON.stringify(state))
      }

      // Navigate back to test editor
      const backUrl = testId ? `/ap/teacher/test/${testId}/edit` : '/ap/teacher/test/new'
      navigate(backUrl)
    } catch (err) {
      logError('APQuestionBank.addSelectedToTest', {}, err)
      alert('Failed to add questions: ' + err.message)
    }
  }

  // Question type options
  const typeOptions = [
    { value: QUESTION_TYPE.MCQ, label: 'Multiple Choice' },
    { value: QUESTION_TYPE.MCQ_MULTI, label: 'MCQ (Multiple Select)' },
    { value: QUESTION_TYPE.FRQ, label: 'Free Response' },
    { value: QUESTION_TYPE.SAQ, label: 'Short Answer' },
    { value: QUESTION_TYPE.DBQ, label: 'Document-Based' },
  ]

  // Difficulty options
  const difficultyOptions = [
    { value: DIFFICULTY.EASY, label: 'Easy' },
    { value: DIFFICULTY.MEDIUM, label: 'Medium' },
    { value: DIFFICULTY.HARD, label: 'Hard' },
  ]

  // Subject options
  const subjectOptions = AP_SUBJECTS.map(s => ({ value: s.id, label: s.name }))

  // Domain options
  const domainOptions = domains.map(d => ({ value: d, label: d }))

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {isPickerMode && (
              <button
                onClick={() => navigate(-1)}
                className="text-text-muted hover:text-text-primary"
              >
                Back
              </button>
            )}
            <h1 className="text-2xl font-bold text-text-primary">
              {isPickerMode ? 'Select Questions' : 'Question Bank'}
            </h1>
          </div>
          {!isPickerMode && (
            <Link
              to="/ap/teacher/question/new"
              className="px-4 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90"
            >
              + Create Question
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <FilterSelect
              label="Subject"
              value={subject}
              options={subjectOptions}
              onChange={setSubject}
            />
            <FilterSelect
              label="Type"
              value={questionType}
              options={typeOptions}
              onChange={setQuestionType}
            />
            <FilterSelect
              label="Difficulty"
              value={difficulty}
              options={difficultyOptions}
              onChange={setDifficulty}
            />
            <FilterSelect
              label="Domain"
              value={domain}
              options={domainOptions}
              onChange={setDomain}
              allLabel={subject ? 'All Domains' : 'Select subject first'}
            />
            <div>
              <label className="block text-text-muted text-xs mb-1">Search</label>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search questions..."
                className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default overflow-hidden">
          {/* Results header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-default bg-muted">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === questions.length && questions.length > 0}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded border-border-default text-brand-primary"
              />
              <span className="text-text-secondary text-sm">
                {loading ? 'Loading...' : `Showing ${questions.length} questions`}
              </span>
            </div>
            {isPickerMode && selectedIds.size > 0 && (
              <button
                onClick={handleAddSelectedToTest}
                className="px-4 py-1.5 text-sm rounded-[--radius-button] bg-brand-primary text-white hover:opacity-90"
              >
                Add {selectedIds.size} Selected
              </button>
            )}
          </div>

          {/* Questions list */}
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-pulse">
                <div className="h-16 bg-muted rounded mb-2" />
                <div className="h-16 bg-muted rounded mb-2" />
                <div className="h-16 bg-muted rounded" />
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-error-text">{error}</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-muted">No questions found matching your filters.</p>
            </div>
          ) : (
            <div>
              {questions.map(question => (
                <QuestionRow
                  key={question.id}
                  question={question}
                  selected={selectedIds.has(question.id)}
                  onSelect={handleSelect}
                  onPreview={setPreviewQuestion}
                  isPickerMode={isPickerMode}
                  onAddToTest={handleAddSingleToTest}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Preview modal */}
      {previewQuestion && (
        <QuestionPreviewModal
          question={previewQuestion}
          onClose={() => setPreviewQuestion(null)}
        />
      )}
    </div>
  )
}
