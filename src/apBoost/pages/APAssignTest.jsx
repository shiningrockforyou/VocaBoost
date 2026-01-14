import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import AssignTestModal from '../components/teacher/AssignTestModal'
import { getTestById } from '../services/apTeacherService'
import { logError } from '../utils/logError'

/**
 * APAssignTest - Full page wrapper for test assignment
 */
export default function APAssignTest() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load test data
  useEffect(() => {
    async function loadTest() {
      try {
        setLoading(true)
        const data = await getTestById(testId)
        if (!data) {
          setError('Test not found')
          return
        }
        setTest(data)
      } catch (err) {
        logError('APAssignTest.loadTest', { testId }, err)
        setError(err.message || 'Failed to load test')
      } finally {
        setLoading(false)
      }
    }

    if (testId) {
      loadTest()
    }
  }, [testId])

  // Handle close
  const handleClose = () => {
    navigate('/ap/teacher')
  }

  // Handle success
  const handleSuccess = () => {
    navigate('/ap/teacher')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-error rounded-[--radius-card] p-6 text-center">
            <p className="text-error-text-strong font-medium mb-2">Error</p>
            <p className="text-error-text mb-4">{error}</p>
            <Link
              to="/ap/teacher"
              className="text-brand-primary hover:underline"
            >
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      <APHeader />

      {/* Render the modal directly on the page */}
      {test && (
        <AssignTestModal
          test={test}
          teacherId={user?.uid}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
