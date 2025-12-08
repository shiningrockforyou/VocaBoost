import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { fetchTeacherLists } from '../services/db'
import HeaderBar from '../components/HeaderBar.jsx'
import { Button, CardButton } from '../components/ui'
import { Plus } from 'lucide-react'

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
    <main className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <HeaderBar />
        <header className="rounded-2xl bg-surface p-8 shadow-lg ring-1 ring-border-default">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
                Vocabulary Lists
              </p>
              <h1 className="mt-2 text-4xl font-bold text-text-primary">List Library</h1>
              <p className="mt-2 text-base text-text-secondary">
                Manage content for your classes and study modes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" size="lg" to="/lists/new">
                <Plus size={20} />
                Create New List
              </Button>
            </div>
          </div>
          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </header>

        <section className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-border-muted">
          {loading ? (
            <p className="text-sm text-text-muted">Loading your lists...</p>
          ) : lists.length ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {lists.map((list) => (
                <li key={list.id}>
                  <CardButton 
                    to={`/lists/${list.id}`}
                    className="rounded-xl border border-border-muted bg-muted/60 p-5 transition hover:border-border-default hover:bg-surface flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-text-primary truncate">{list.title}</h3>
                        <p className="mt-1 text-sm text-text-muted line-clamp-2">{list.description || 'No description'}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm text-text-muted">{list.wordCount ?? 0} words</span>
                      </div>
                    </div>
                  </CardButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">
              You have not created any lists yet. Click &quot;Create New List&quot; to start.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

export default ListLibrary


