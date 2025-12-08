import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { addWordToList, createList, updateWord, deleteWord } from '../services/db'
import { db } from '../firebase'
import ImportWordsModal from '../components/ImportWordsModal.jsx'
import HeaderBar from '../components/HeaderBar.jsx'
import { Button, IconButton } from '../components/ui'

const ListEditor = ({ mode }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { listId } = useParams()
  const isCreateMode = mode === 'create' || !listId

  const [details, setDetails] = useState({ title: '', description: '' })
  const [detailError, setDetailError] = useState('')
  const [detailSuccess, setDetailSuccess] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)

  const [words, setWords] = useState([])
  const [wordsLoading, setWordsLoading] = useState(!isCreateMode)
  const [wordForm, setWordForm] = useState({
    word: '',
    partOfSpeech: '',
    definition: '',
    sampleSentence: '',
    secondaryLang: '',
    secondaryDefinition: '',
  })
  const [wordError, setWordError] = useState('')
  const [wordSuccess, setWordSuccess] = useState('')
  const [addingWord, setAddingWord] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const pageTitle = useMemo(
    () => (isCreateMode ? 'Create List' : `Edit ${details.title || 'List'}`),
    [isCreateMode, details.title],
  )

  useEffect(() => {
    const loadList = async () => {
      if (isCreateMode || !listId) {
        return
      }
      setWordsLoading(true)
      setDetailError('')
      try {
        const listRef = doc(db, 'lists', listId)
        const listSnap = await getDoc(listRef)
        if (!listSnap.exists()) {
          throw new Error('List not found.')
        }
        const data = listSnap.data()
        setDetails({
          title: data.title ?? '',
          description: data.description ?? '',
        })

        const wordsRef = collection(db, 'lists', listId, 'words')
        const wordsQuery = query(wordsRef, orderBy('createdAt', 'desc'))
        const wordsSnap = await getDocs(wordsQuery)
        setWords(wordsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
      } catch (err) {
        setDetailError(err.message ?? 'Unable to load this list.')
      } finally {
        setWordsLoading(false)
      }
    }

    loadList()
  }, [isCreateMode, listId])

  const reloadWords = async () => {
    if (!listId || isCreateMode) return
    setWordsLoading(true)
    try {
      const wordsRef = collection(db, 'lists', listId, 'words')
      const wordsQuery = query(wordsRef, orderBy('createdAt', 'desc'))
      const wordsSnap = await getDocs(wordsQuery)
      setWords(wordsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
    } catch (err) {
      setWordError(err.message ?? 'Unable to reload words.')
    } finally {
      setWordsLoading(false)
    }
  }

  const handleDetailChange = (event) => {
    const { name, value } = event.target
    setDetails((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateList = async (event) => {
    event.preventDefault()
    setDetailError('')
    setSavingDetails(true)
    try {
      const newList = await createList({
        title: details.title,
        description: details.description,
        ownerId: user?.uid,
      })
      setDetailSuccess('List created! Redirecting to editor…')
      setTimeout(() => {
        navigate(`/lists/${newList.id}`)
      }, 600)
    } catch (err) {
      setDetailError(err.message ?? 'Unable to create list.')
    } finally {
      setSavingDetails(false)
    }
  }

  const handleUpdateDetails = async (event) => {
    event.preventDefault()
    if (!listId) return
    setDetailError('')
    setDetailSuccess('')
    setSavingDetails(true)
    try {
      await updateDoc(doc(db, 'lists', listId), {
        title: details.title.trim(),
        description: details.description.trim(),
        updatedAt: serverTimestamp(),
      })
      setDetailSuccess('List details saved.')
    } catch (err) {
      setDetailError(err.message ?? 'Unable to save list details.')
    } finally {
      setSavingDetails(false)
    }
  }

  const handleWordChange = (event) => {
    const { name, value } = event.target
    setWordForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditWord = (word) => {
    setEditingId(word.id)
    // Extract secondary language and definition from definitions object
    const definitions = word.definitions || {}
    const secondaryLang = Object.keys(definitions).find((key) => key !== 'en') || ''
    const secondaryDefinition = secondaryLang ? definitions[secondaryLang] : ''

    setWordForm({
      word: word.word || '',
      partOfSpeech: word.partOfSpeech || '',
      definition: word.definition || definitions.en || '',
      sampleSentence: word.samples?.[0] || '',
      secondaryLang,
      secondaryDefinition,
    })
    setWordError('')
    setWordSuccess('')
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteWord = async (wordId) => {
    if (!listId || !wordId) return
    if (!window.confirm('Are you sure you want to delete this word? This action cannot be undone.')) {
      return
    }
    setWordError('')
    setWordSuccess('')
    try {
      await deleteWord(listId, wordId)
      setWordSuccess('Word deleted successfully.')
      await reloadWords()
    } catch (err) {
      setWordError(err.message ?? 'Unable to delete word.')
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setWordForm({
      word: '',
      partOfSpeech: '',
      definition: '',
      sampleSentence: '',
      secondaryLang: '',
      secondaryDefinition: '',
    })
    setWordError('')
    setWordSuccess('')
  }

  const handleAddWord = async (event) => {
    event.preventDefault()
    if (!listId) return
    setWordError('')
    setWordSuccess('')
    setAddingWord(true)
    try {
      const definitions = {}
      if (wordForm.definition) {
        definitions.en = wordForm.definition.trim()
      }
      if (wordForm.secondaryLang && wordForm.secondaryDefinition) {
        definitions[wordForm.secondaryLang.toLowerCase().trim()] = wordForm.secondaryDefinition.trim()
      }

      if (editingId) {
        // Update existing word
        await updateWord(listId, editingId, {
          ...wordForm,
          definitions,
        })
        setWordSuccess('Word updated successfully.')
      } else {
        // Add new word
        await addWordToList(listId, {
          ...wordForm,
          definitions,
        })
        setWordSuccess('Word added to list.')
      }

      setWordForm({
        word: '',
        partOfSpeech: '',
        definition: '',
        sampleSentence: '',
        secondaryLang: '',
        secondaryDefinition: '',
      })
      setEditingId(null)

      const wordsRef = collection(db, 'lists', listId, 'words')
      const wordsQuery = query(wordsRef, orderBy('createdAt', 'desc'))
      const wordsSnap = await getDocs(wordsQuery)
      setWords(wordsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
    } catch (err) {
      setWordError(err.message ?? editingId ? 'Unable to update word.' : 'Unable to add word.')
    } finally {
      setAddingWord(false)
    }
  }

  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <HeaderBar />
        <header className="rounded-2xl bg-surface p-8 shadow-lg ring-1 ring-border-default">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
            Vocabulary Content
          </p>
          <h1 className="mt-2 text-4xl font-bold text-text-primary">{pageTitle}</h1>
          <p className="mt-2 text-base text-text-secondary">
            Create and manage lists for your classes and study sessions.
          </p>
        </header>

        <section className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-border-muted">
          <h2 className="text-xl font-semibold text-text-primary">
            {isCreateMode ? 'New List Details' : 'List Details'}
          </h2>
          <p className="text-sm text-text-muted">Set the title and description students will see.</p>
          <form
            onSubmit={isCreateMode ? handleCreateList : handleUpdateDetails}
            className="mt-6 space-y-4"
          >
            {detailError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {detailError}
              </p>
            )}
            {detailSuccess && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {detailSuccess}
              </p>
            )}
            <label className="block text-sm font-medium text-text-secondary">
              List Title
              <input
                type="text"
                name="title"
                value={details.title}
                onChange={handleDetailChange}
                required
                className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                placeholder="SAT Power List"
              />
            </label>
            <label className="block text-sm font-medium text-text-secondary">
              Description
              <textarea
                name="description"
                rows={3}
                value={details.description}
                onChange={handleDetailChange}
                className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                placeholder="Explain when and how to use this list."
              />
            </label>
            <Button 
              variant="primary-blue" 
              size="lg" 
              type="submit"
              disabled={savingDetails}
            >
              {isCreateMode ? 'Create List' : 'Save Changes'}
            </Button>
          </form>
        </section>

        {!isCreateMode && (
          <>
            <section className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-border-muted">
              <h2 className="text-xl font-semibold text-text-primary">
                {editingId ? 'Edit Word' : 'Add a New Word'}
              </h2>
              <p className="text-sm text-text-muted">
                {editingId ? 'Update the word details below.' : 'Populate the list with vocabulary content.'}
              </p>
              <form onSubmit={handleAddWord} className="mt-6 space-y-4">
                {wordError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {wordError}
                  </p>
                )}
                {wordSuccess && (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {wordSuccess}
                  </p>
                )}
                <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                  <label className="block text-sm font-medium text-text-secondary">
                    Word
                    <input
                      type="text"
                      name="word"
                      value={wordForm.word}
                      onChange={handleWordChange}
                      required
                      className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                      placeholder="Abate"
                    />
                  </label>
                  <label className="block text-sm font-medium text-text-secondary">
                    Part of Speech
                    <select
                      name="partOfSpeech"
                      value={wordForm.partOfSpeech}
                      onChange={handleWordChange}
                      className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                    >
                      <option value="">—</option>
                      <option value="n.">n. (Noun)</option>
                      <option value="v.">v. (Verb)</option>
                      <option value="adj.">adj. (Adjective)</option>
                      <option value="adv.">adv. (Adverb)</option>
                      <option value="prep.">prep. (Preposition)</option>
                      <option value="conj.">conj. (Conjunction)</option>
                      <option value="pron.">pron. (Pronoun)</option>
                      <option value="interj.">interj. (Interjection)</option>
                      <option value="phrase">phrase (Phrase)</option>
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-medium text-text-secondary">
                  Definition
                  <textarea
                    name="definition"
                    rows={3}
                    value={wordForm.definition}
                    onChange={handleWordChange}
                    required
                    className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                    placeholder="To become less intense or widespread."
                  />
                </label>
                <label className="block text-sm font-medium text-text-secondary">
                  Sample Sentence
                  <textarea
                    name="sampleSentence"
                    rows={2}
                    value={wordForm.sampleSentence}
                    onChange={handleWordChange}
                    className="mt-1 w-full rounded-lg border border-border-default bg-muted px-3 py-2 text-text-primary outline-none ring-border-strong focus:bg-surface focus:ring-2"
                    placeholder="After weeks of rain, the storm finally abated."
                  />
                </label>
                <div className="rounded-lg border border-border-default bg-muted p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Optional: Secondary Definition
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-text-secondary">
                      Language Code
                      <input
                        type="text"
                        name="secondaryLang"
                        value={wordForm.secondaryLang}
                        onChange={handleWordChange}
                        className="mt-1 w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-text-primary outline-none ring-border-strong focus:ring-2"
                        placeholder="ko, es, fr, etc."
                        maxLength={2}
                      />
                    </label>
                    <label className="block text-sm font-medium text-text-secondary">
                      Definition
                      <input
                        type="text"
                        name="secondaryDefinition"
                        value={wordForm.secondaryDefinition}
                        onChange={handleWordChange}
                        className="mt-1 w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-text-primary outline-none ring-border-strong focus:ring-2"
                        placeholder="Translation in the selected language"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="success" 
                    size="lg" 
                    type="submit"
                    disabled={addingWord}
                    className="flex-1"
                  >
                    {addingWord
                      ? editingId
                        ? 'Updating Word…'
                        : 'Adding Word…'
                      : editingId
                        ? 'Update Word'
                        : 'Add Word'}
                  </Button>
                  {editingId ? (
                    <Button variant="outline" size="lg" onClick={handleCancelEdit} className="flex-1">
                      Cancel Edit
                    </Button>
                  ) : (
                    <Button variant="outline" size="lg" onClick={() => setIsImportModalOpen(true)} className="flex-1">
                      Import Words
                    </Button>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-border-muted">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-text-primary">Words in this List</h2>
                <p className="text-sm text-text-muted">{words.length} total</p>
              </div>
              {wordsLoading ? (
                <p className="mt-4 text-sm text-text-muted">Loading words…</p>
              ) : words.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-border-default text-left text-sm">
                    <thead>
                      <tr className="text-text-muted">
                        <th className="px-3 py-2 font-medium">Word</th>
                        <th className="px-3 py-2 font-medium">POS</th>
                        <th className="px-3 py-2 font-medium">Definition</th>
                        <th className="px-3 py-2 font-medium">Sample Sentence</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted">
                      {words.map((word) => (
                        <tr key={word.id}>
                          <td className="px-3 py-2 font-semibold text-text-primary">{word.word}</td>
                          <td className="px-3 py-2 text-text-muted italic">{word.partOfSpeech || '—'}</td>
                          <td className="px-3 py-2 text-text-secondary">{word.definition}</td>
                          <td className="px-3 py-2 text-text-secondary">
                            {word.samples?.[0] ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <IconButton variant="default" size="sm" onClick={() => handleEditWord(word)} title="Edit word">
                                <Pencil size={16} />
                              </IconButton>
                              <IconButton variant="danger" size="sm" onClick={() => handleDeleteWord(word.id)} title="Delete word">
                                <Trash2 size={16} />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-text-muted">
                  No words yet. Use the form above to add vocabulary entries.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      {!isCreateMode && (
        <ImportWordsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          listId={listId}
          onImportComplete={reloadWords}
        />
      )}
    </main>
  )
}

export default ListEditor


