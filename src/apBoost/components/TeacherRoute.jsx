import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

/**
 * TeacherRoute - Wraps content that requires teacher role.
 * Must be used inside PrivateRoute (which handles auth check).
 * Redirects non-teachers to /ap dashboard.
 */
export default function TeacherRoute({ children }) {
  const { user } = useAuth()

  if (user?.role !== 'teacher') {
    return <Navigate to="/ap" replace />
  }

  return children
}
