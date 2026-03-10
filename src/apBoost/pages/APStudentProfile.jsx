import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import APHeader from '../components/APHeader'
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS } from '../utils/apTypes'
import { logError } from '../utils/logError'

/**
 * APStudentProfile - Teacher view of a student's test history
 */
export default function APStudentProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [student, setStudent] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadProfile() {
      if (!userId) return
      try {
        setLoading(true)

        // Load student info
        const userSnap = await getDoc(doc(db, 'users', userId))
        if (userSnap.exists()) {
          setStudent({ id: userSnap.id, ...userSnap.data() })
        }

        // Load all test results for this student
        const resultsQuery = query(
          collection(db, COLLECTIONS.TEST_RESULTS),
          where('userId', '==', userId),
          orderBy('completedAt', 'desc')
        )
        const resultsSnap = await getDocs(resultsQuery)
        const resultsList = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

        // Load test titles for each result
        const testIds = [...new Set(resultsList.map(r => r.testId))]
        const testNames = {}
        for (const testId of testIds) {
          try {
            const testSnap = await getDoc(doc(db, COLLECTIONS.TESTS, testId))
            if (testSnap.exists()) {
              testNames[testId] = testSnap.data().title
            }
          } catch {
            // skip
          }
        }

        setResults(resultsList.map(r => ({ ...r, testTitle: testNames[r.testId] || r.testId })))
      } catch (err) {
        logError('APStudentProfile.load', { userId }, err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadProfile()
  }, [userId])

  const studentName = student?.profile?.displayName || student?.displayName || student?.email || userId
  const avgScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length)
    : null

  // Performance trend (chronological order for chart)
  const scoreTrend = useMemo(() => {
    if (results.length < 2) return []
    return [...results].reverse().map(r => ({
      label: r.testTitle?.slice(0, 15) || 'Test',
      percentage: r.percentage || 0,
      date: r.completedAt?.toDate?.().toLocaleDateString() || '',
    }))
  }, [results])

  // Domain strengths/weaknesses from all MCQ results
  const domainAnalysis = useMemo(() => {
    const domains = {}
    results.forEach(r => {
      (r.mcqResults || []).forEach(mcq => {
        const domain = mcq.questionDomain || 'Other'
        if (!domains[domain]) domains[domain] = { correct: 0, total: 0 }
        domains[domain].total++
        if (mcq.correct) domains[domain].correct++
      })
    })
    return Object.entries(domains)
      .filter(([_, s]) => s.total >= 2)
      .map(([domain, stats]) => ({
        domain,
        correct: stats.correct,
        total: stats.total,
        percentage: Math.round((stats.correct / stats.total) * 100),
      }))
      .sort((a, b) => a.percentage - b.percentage)
  }, [results])

  const strengths = domainAnalysis.filter(d => d.percentage >= 70)
  const weaknesses = domainAnalysis.filter(d => d.percentage < 50)

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <APHeader />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-6" />
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
        <button
          onClick={() => navigate(-1)}
          className="text-text-muted hover:text-text-primary text-sm mb-4 inline-block"
        >
          ← Back
        </button>

        {error && (
          <div className="bg-error rounded-[--radius-alert] p-3 mb-4">
            <p className="text-error-text text-sm">{error}</p>
          </div>
        )}

        {/* Student header */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-6 mb-6">
          <h1 className="text-2xl font-bold text-text-primary">{studentName}</h1>
          {student?.email && (
            <p className="text-text-muted text-sm">{student.email}</p>
          )}
          <div className="flex gap-6 mt-4">
            <div>
              <span className="text-text-muted text-sm">Tests Taken</span>
              <p className="text-text-primary text-xl font-bold">{results.length}</p>
            </div>
            {avgScore !== null && (
              <div>
                <span className="text-text-muted text-sm">Average Score</span>
                <p className="text-text-primary text-xl font-bold">{avgScore}%</p>
              </div>
            )}
          </div>
        </div>

        {/* Performance Trend */}
        {scoreTrend.length >= 2 && (
          <div className="bg-surface rounded-[--radius-card] border border-border-default p-6 mb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Score Trend
            </h2>
            <div className="flex items-end gap-2 h-32">
              {scoreTrend.map((point, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-text-primary text-xs font-medium">{point.percentage}%</span>
                  <div
                    className={`w-full rounded-t ${point.percentage >= 70 ? 'bg-success-text' : point.percentage >= 50 ? 'bg-warning-text-strong' : 'bg-error-text'}`}
                    style={{ height: `${Math.max(point.percentage, 5)}%` }}
                  />
                  <span className="text-text-muted text-[10px] truncate w-full text-center" title={point.label}>{point.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Domain Strengths & Weaknesses */}
        {domainAnalysis.length > 0 && (
          <div className="bg-surface rounded-[--radius-card] border border-border-default p-6 mb-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Domain Analysis
            </h2>

            {strengths.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-success-text mb-2">Strengths</h3>
                <div className="space-y-2">
                  {strengths.map(d => (
                    <div key={d.domain} className="flex items-center gap-3">
                      <span className="text-text-secondary text-sm flex-1 truncate">{d.domain}</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-success-text" style={{ width: `${d.percentage}%` }} />
                      </div>
                      <span className="text-text-primary text-sm w-16 text-right">{d.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {weaknesses.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-error-text mb-2">Needs Improvement</h3>
                <div className="space-y-2">
                  {weaknesses.map(d => (
                    <div key={d.domain} className="flex items-center gap-3">
                      <span className="text-text-secondary text-sm flex-1 truncate">{d.domain}</span>
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-error-text" style={{ width: `${d.percentage}%` }} />
                      </div>
                      <span className="text-text-primary text-sm w-16 text-right">{d.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test history */}
        <div className="bg-surface rounded-[--radius-card] border border-border-default p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">
            Test History ({results.length})
          </h2>
          {results.length === 0 ? (
            <p className="text-text-muted text-sm">No test results yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Test</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Score</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">AP</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-text-secondary font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(result => (
                    <tr key={result.id} className="border-b border-border-muted hover:bg-hover">
                      <td className="py-2 px-3 text-text-primary">
                        <Link
                          to={`/ap/results/${result.id}`}
                          className="hover:underline text-brand-primary"
                        >
                          {result.testTitle}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-text-primary">
                        {result.percentage != null ? `${result.percentage}%` : '—'}
                      </td>
                      <td className="py-2 px-3 text-text-primary font-bold">
                        {result.apScore || '—'}
                      </td>
                      <td className="py-2 px-3 text-text-muted">
                        {result.completedAt?.toDate?.().toLocaleDateString() || '—'}
                      </td>
                      <td className="py-2 px-3">
                        {result.gradingStatus === 'PENDING' ? (
                          <span className="text-warning-text-strong text-xs">Pending</span>
                        ) : (
                          <span className="text-success-text text-xs">Complete</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
