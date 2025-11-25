import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { fetchTeacherLists } from '../services/db'

const ListLibrary = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadLists = async () => {
      if (!user?.uid) {
        return
      }
      setError('')
      setLoading(true)
      try {
        const teacherLists = await fetchTeacherLists(user.uid)
        setLists(teacherLists)
      } catch (err) {
        setError(err.message ?? 'Unable to load your lists.')
      } finally {
        setLoading(false)
      }
    }

    loadLists()
  }, [user?.uid])

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
                Vocabulary Lists
              </p>
              <h1 className="mt-2 text-4xl font-bold text-slate-900">List Library</h1>
              <p className="mt-2 text-base text-slate-600">
                Manage content for your classes and study modes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/lists/new')}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Create New List
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </header>

        <section className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-slate-100">
          {loading ? (
            <p className="text-sm text-slate-500">Loading your lists...</p>
          ) : lists.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {lists.map((list) => (
                <li
                  key={list.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-5 transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{list.title}</h3>
                      <p className="mt-1 text-sm text-slate-500 line-clamp-2">{list.description}</p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      {list.wordCount ?? 0} words
                    </span>
                  </div>
                  <Link
                    to={`/lists/${list.id}`}
                    className="mt-4 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-500"
                  >
                    Edit List →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              You have not created any lists yet. Click &quot;Create New List&quot; to start.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export default ListLibrary


