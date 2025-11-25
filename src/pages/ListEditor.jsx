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
import { useAuth } from '../contexts/AuthContext.jsx'
import { addWordToList, createList, updateWord, deleteWord } from '../services/db'
import { db } from '../firebase'
import ImportWordsModal from '../components/ImportWordsModal.jsx'
import BackButton from '../components/BackButton.jsx'

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
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <BackButton />
        <header className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
            Vocabulary Content
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="mt-2 text-base text-slate-600">
            Create and manage lists for your classes and study sessions.
          </p>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
          <h2 className="text-xl font-semibold text-slate-900">
            {isCreateMode ? 'New List Details' : 'List Details'}
          </h2>
          <p className="text-sm text-slate-500">Set the title and description students will see.</p>
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
            <label className="block text-sm font-medium text-slate-700">
              List Title
              <input
                type="text"
                name="title"
                value={details.title}
                onChange={handleDetailChange}
                required
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                placeholder="SAT Power List"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Description
              <textarea
                name="description"
                rows={3}
                value={details.description}
                onChange={handleDetailChange}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                placeholder="Explain when and how to use this list."
              />
            </label>
            <button
              type="submit"
              disabled={savingDetails}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {isCreateMode ? 'Create List' : 'Save Changes'}
            </button>
          </form>
        </section>

        {!isCreateMode && (
          <>
            <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingId ? 'Edit Word' : 'Add a New Word'}
              </h2>
              <p className="text-sm text-slate-500">
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
                  <label className="block text-sm font-medium text-slate-700">
                    Word
                    <input
                      type="text"
                      name="word"
                      value={wordForm.word}
                      onChange={handleWordChange}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                      placeholder="Abate"
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Part of Speech
                    <select
                      name="partOfSpeech"
                      value={wordForm.partOfSpeech}
                      onChange={handleWordChange}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
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
                <label className="block text-sm font-medium text-slate-700">
                  Definition
                  <textarea
                    name="definition"
                    rows={3}
                    value={wordForm.definition}
                    onChange={handleWordChange}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                    placeholder="To become less intense or widespread."
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Sample Sentence
                  <textarea
                    name="sampleSentence"
                    rows={2}
                    value={wordForm.sampleSentence}
                    onChange={handleWordChange}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:bg-white focus:ring-2"
                    placeholder="After weeks of rain, the storm finally abated."
                  />
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Optional: Secondary Definition
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Language Code
                      <input
                        type="text"
                        name="secondaryLang"
                        value={wordForm.secondaryLang}
                        onChange={handleWordChange}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:ring-2"
                        placeholder="ko, es, fr, etc."
                        maxLength={2}
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Definition
                      <input
                        type="text"
                        name="secondaryDefinition"
                        value={wordForm.secondaryDefinition}
                        onChange={handleWordChange}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none ring-slate-300 focus:ring-2"
                        placeholder="Translation in the selected language"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={addingWord}
                    className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {addingWord
                      ? editingId
                        ? 'Updating Word…'
                        : 'Adding Word…'
                      : editingId
                        ? 'Update Word'
                        : 'Add Word'}
                  </button>
                  {editingId ? (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Cancel Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Import Words
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Words in this List</h2>
                <p className="text-sm text-slate-500">{words.length} total</p>
              </div>
              {wordsLoading ? (
                <p className="mt-4 text-sm text-slate-500">Loading words…</p>
              ) : words.length ? (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead>
                      <tr className="text-slate-500">
                        <th className="px-3 py-2 font-medium">Word</th>
                        <th className="px-3 py-2 font-medium">POS</th>
                        <th className="px-3 py-2 font-medium">Definition</th>
                        <th className="px-3 py-2 font-medium">Sample Sentence</th>
                        <th className="px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {words.map((word) => (
                        <tr key={word.id}>
                          <td className="px-3 py-2 font-semibold text-slate-900">{word.word}</td>
                          <td className="px-3 py-2 text-slate-500 italic">{word.partOfSpeech || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{word.definition}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {word.samples?.[0] ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditWord(word)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
                                title="Edit word"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteWord(word.id)}
                                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-red-600"
                                title="Delete word"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
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


