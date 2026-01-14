import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import { getQuestionById, createQuestion, updateQuestion } from '../services/apQuestionService'
import { QUESTION_TYPE, QUESTION_FORMAT, DIFFICULTY, CHOICE_LETTERS } from '../utils/apTypes'
import { AP_SUBJECTS } from '../utils/apTestConfig'
import { logError } from '../utils/logError'

/**
 * MCQ choice editor
 */
function ChoiceEditor({ letter, value, isCorrect, onChange, onToggleCorrect }) {
  const text = typeof value === 'string' ? value : value?.text || ''

  return (
    <div className="flex items-start gap-3 mb-3">
      <div className="pt-2">
        <input
          type="checkbox"
          checked={isCorrect}
          onChange={onToggleCorrect}
          className="w-4 h-4 rounded border-border-default text-brand-primary"
          title="Mark as correct answer"
        />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-text-secondary">{letter}.</span>
          {isCorrect && (
            <span className="text-xs text-success-text">(Correct)</span>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Choice ${letter} text...`}
          rows={2}
          className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary resize-none"
        />
      </div>
    </div>
  )
}

/**
 * FRQ sub-question editor
 */
function SubQuestionEditor({ subQuestion, index, onChange, onRemove }) {
  return (
    <div className="bg-muted rounded-[--radius-card] p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="font-medium text-text-secondary">Part ({subQuestion.label})</span>
          <input
            type="text"
            value={subQuestion.label}
            onChange={(e) => onChange({ ...subQuestion, label: e.target.value })}
            placeholder="a"
            className="w-12 px-2 py-1 text-center rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
          />
        </div>
        <button
          onClick={onRemove}
          className="text-error-text text-sm hover:underline"
        >
          Remove
        </button>
      </div>
      <textarea
        value={subQuestion.prompt || ''}
        onChange={(e) => onChange({ ...subQuestion, prompt: e.target.value })}
        placeholder="Sub-question prompt..."
        rows={3}
        className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary resize-none mb-3"
      />
      <div className="flex items-center gap-4">
        <div>
          <label className="block text-text-muted text-xs mb-1">Max Points</label>
          <input
            type="number"
            min="1"
            value={subQuestion.maxPoints || 1}
            onChange={(e) => onChange({ ...subQuestion, maxPoints: parseInt(e.target.value) || 1 })}
            className="w-20 px-2 py-1 rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
          />
        </div>
      </div>
    </div>
  )
}

/**
 * APQuestionEditor - Create/edit question
 */
export default function APQuestionEditor() {
  const { questionId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const isNew = questionId === 'new'

  // Question state
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState(QUESTION_TYPE.MCQ)
  const [format, setFormat] = useState(QUESTION_FORMAT.VERTICAL)
  const [subject, setSubject] = useState('')
  const [questionDomain, setQuestionDomain] = useState('')
  const [questionTopic, setQuestionTopic] = useState('')
  const [difficulty, setDifficulty] = useState(DIFFICULTY.MEDIUM)
  const [explanation, setExplanation] = useState('')

  // MCQ state
  const [choiceCount, setChoiceCount] = useState(4)
  const [choices, setChoices] = useState({
    A: '', B: '', C: '', D: '', E: ''
  })
  const [correctAnswers, setCorrectAnswers] = useState([])

  // FRQ state
  const [subQuestions, setSubQuestions] = useState([])

  // UI state
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Load question data
  useEffect(() => {
    async function loadQuestion() {
      if (isNew || !questionId) return

      try {
        setLoading(true)
        const question = await getQuestionById(questionId)

        if (!question) {
          setError('Question not found')
          return
        }

        setQuestionText(question.questionText || '')
        setQuestionType(question.questionType || QUESTION_TYPE.MCQ)
        setFormat(question.format || QUESTION_FORMAT.VERTICAL)
        setSubject(question.subject || '')
        setQuestionDomain(question.questionDomain || '')
        setQuestionTopic(question.questionTopic || '')
        setDifficulty(question.difficulty || DIFFICULTY.MEDIUM)
        setExplanation(question.explanation || '')

        // MCQ data
        setChoiceCount(question.choiceCount || 4)
        setChoices({
          A: question.choiceA || '',
          B: question.choiceB || '',
          C: question.choiceC || '',
          D: question.choiceD || '',
          E: question.choiceE || '',
        })
        setCorrectAnswers(question.correctAnswers || [])

        // FRQ data
        setSubQuestions(question.subQuestions || [])
      } catch (err) {
        logError('APQuestionEditor.loadQuestion', { questionId }, err)
        setError(err.message || 'Failed to load question')
      } finally {
        setLoading(false)
      }
    }

    loadQuestion()
  }, [questionId, isNew])

  // Handle choice change
  const handleChoiceChange = (letter, value) => {
    setChoices({ ...choices, [letter]: value })
  }

  // Toggle correct answer
  const handleToggleCorrect = (letter) => {
    if (questionType === QUESTION_TYPE.MCQ) {
      // Single answer
      setCorrectAnswers([letter])
    } else {
      // Multiple answers
      if (correctAnswers.includes(letter)) {
        setCorrectAnswers(correctAnswers.filter(a => a !== letter))
      } else {
        setCorrectAnswers([...correctAnswers, letter])
      }
    }
  }

  // Add sub-question
  const handleAddSubQuestion = () => {
    const nextLabel = String.fromCharCode(97 + subQuestions.length) // a, b, c, ...
    setSubQuestions([
      ...subQuestions,
      { label: nextLabel, prompt: '', maxPoints: 1 }
    ])
  }

  // Update sub-question
  const handleUpdateSubQuestion = (index, updated) => {
    const newSubs = [...subQuestions]
    newSubs[index] = updated
    setSubQuestions(newSubs)
  }

  // Remove sub-question
  const handleRemoveSubQuestion = (index) => {
    setSubQuestions(subQuestions.filter((_, i) => i !== index))
  }

  // Save question
  const handleSave = async () => {
    if (!questionText.trim()) {
      alert('Please enter question text')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const questionData = {
        questionText: questionText.trim(),
        questionType,
        format,
        subject,
        questionDomain,
        questionTopic,
        difficulty,
        explanation,
        createdBy: user?.uid,
      }

      // MCQ data
      if (questionType === QUESTION_TYPE.MCQ || questionType === QUESTION_TYPE.MCQ_MULTI) {
        questionData.choiceCount = choiceCount
        questionData.choiceA = choices.A || null
        questionData.choiceB = choices.B || null
        questionData.choiceC = choices.C || null
        questionData.choiceD = choices.D || null
        questionData.choiceE = choices.E || null
        questionData.correctAnswers = correctAnswers
        questionData.partialCredit = questionType === QUESTION_TYPE.MCQ_MULTI
      }

      // FRQ data
      if (questionType === QUESTION_TYPE.FRQ || questionType === QUESTION_TYPE.SAQ || questionType === QUESTION_TYPE.DBQ) {
        questionData.subQuestions = subQuestions.length > 0 ? subQuestions : null
      }

      if (isNew) {
        const newId = await createQuestion(questionData)
        navigate(`/ap/teacher/question/${newId}/edit`)
      } else {
        await updateQuestion(questionId, questionData)
      }

      alert('Question saved successfully')
    } catch (err) {
      logError('APQuestionEditor.save', { questionId }, err)
      setError(err.message || 'Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  const isMCQ = questionType === QUESTION_TYPE.MCQ || questionType === QUESTION_TYPE.MCQ_MULTI
  const isFRQ = questionType === QUESTION_TYPE.FRQ || questionType === QUESTION_TYPE.SAQ || questionType === QUESTION_TYPE.DBQ

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6" />
            <div className="h-32 bg-muted rounded mb-4" />
            <div className="h-48 bg-muted rounded" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/ap/teacher/questions"
              className="text-text-muted hover:text-text-primary"
            >
              Back
            </Link>
            <h1 className="text-xl font-bold text-text-primary">
              {isNew ? 'Create Question' : 'Edit Question'}
            </h1>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-error rounded-[--radius-card] p-4 mb-6">
            <p className="text-error-text">{error}</p>
          </div>
        )}

        {/* Question metadata */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-text-muted text-xs mb-1">Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              >
                <option value={QUESTION_TYPE.MCQ}>Multiple Choice</option>
                <option value={QUESTION_TYPE.MCQ_MULTI}>MCQ (Multi-Select)</option>
                <option value={QUESTION_TYPE.FRQ}>Free Response</option>
                <option value={QUESTION_TYPE.SAQ}>Short Answer</option>
                <option value={QUESTION_TYPE.DBQ}>Document-Based</option>
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              >
                <option value="">Select...</option>
                {AP_SUBJECTS.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              >
                <option value={DIFFICULTY.EASY}>Easy</option>
                <option value={DIFFICULTY.MEDIUM}>Medium</option>
                <option value={DIFFICULTY.HARD}>Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              >
                <option value={QUESTION_FORMAT.VERTICAL}>Vertical</option>
                <option value={QUESTION_FORMAT.HORIZONTAL}>Horizontal (with stimulus)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted text-xs mb-1">Domain/Unit</label>
              <input
                type="text"
                value={questionDomain}
                onChange={(e) => setQuestionDomain(e.target.value)}
                placeholder="e.g., Unit 3: Colonial America"
                className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              />
            </div>
            <div>
              <label className="block text-text-muted text-xs mb-1">Topic</label>
              <input
                type="text"
                value={questionTopic}
                onChange={(e) => setQuestionTopic(e.target.value)}
                placeholder="e.g., Causes of Revolution"
                className="w-full px-2 py-1.5 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
              />
            </div>
          </div>
        </div>

        {/* Question text */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
          <label className="block text-text-secondary text-sm font-medium mb-2">Question Text</label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Enter the question text..."
            rows={4}
            className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary resize-none"
          />
        </div>

        {/* MCQ choices */}
        {isMCQ && (
          <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-text-secondary text-sm font-medium">Answer Choices</label>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-xs">Choices:</span>
                <select
                  value={choiceCount}
                  onChange={(e) => setChoiceCount(parseInt(e.target.value))}
                  className="px-2 py-1 text-sm rounded-[--radius-input] border border-border-default bg-surface text-text-primary"
                >
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
            </div>
            {CHOICE_LETTERS.slice(0, choiceCount).map(letter => (
              <ChoiceEditor
                key={letter}
                letter={letter}
                value={choices[letter]}
                isCorrect={correctAnswers.includes(letter)}
                onChange={(value) => handleChoiceChange(letter, value)}
                onToggleCorrect={() => handleToggleCorrect(letter)}
              />
            ))}
            <p className="text-text-muted text-xs mt-2">
              Check the box next to the correct answer(s)
            </p>
          </div>
        )}

        {/* FRQ sub-questions */}
        {isFRQ && (
          <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
            <label className="block text-text-secondary text-sm font-medium mb-4">Sub-Questions</label>
            {subQuestions.map((sq, idx) => (
              <SubQuestionEditor
                key={idx}
                subQuestion={sq}
                index={idx}
                onChange={(updated) => handleUpdateSubQuestion(idx, updated)}
                onRemove={() => handleRemoveSubQuestion(idx)}
              />
            ))}
            <button
              onClick={handleAddSubQuestion}
              className="w-full py-2 border border-dashed border-border-default rounded-[--radius-button] text-text-secondary hover:bg-hover text-sm"
            >
              + Add Sub-Question
            </button>
          </div>
        )}

        {/* Explanation */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-4 mb-6">
          <label className="block text-text-secondary text-sm font-medium mb-2">
            Explanation (optional)
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explain why the correct answer is correct..."
            rows={3}
            className="w-full px-3 py-2 rounded-[--radius-input] border border-border-default bg-surface text-text-primary resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border-default">
          <button
            onClick={() => navigate('/ap/teacher/questions')}
            className="px-4 py-2 text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-[--radius-button] bg-brand-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </main>
    </div>
  )
}
