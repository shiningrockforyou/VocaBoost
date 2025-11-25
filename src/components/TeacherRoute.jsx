import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

const TeacherRoute = ({ children }) => {
  const { user, initializing } = useAuth()

  if (initializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-600">Loading teacher tools…</p>
      </main>
    )
  }

  if (user?.role !== 'teacher') {
    return <Navigate to="/" replace />
  }

  return children
}

export default TeacherRoute


