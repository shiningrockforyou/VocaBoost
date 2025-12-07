import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown, BookOpen, AlertCircle, TrendingUp, Construction, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { fetchUserAttempts } from '../services/db'

const Gradebook = () => {
  const { user, logout } = useAuth()
  
  // Sort state
  const [sortKey, setSortKey] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Logout handler
  const handleLogout = async () => {
    try {
      await logout()
    } catch (err) {
      console.error('Failed to log out', err)
    }
  }
  
  // Data state
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  
  // WIP Modal state
  const [showWipModal, setShowWipModal] = useState(false)
  
  // Check if user has seen WIP modal
  useEffect(() => {
    const hasSeen = localStorage.getItem('gradebook_wip_seen')
    if (!hasSeen) {
      setShowWipModal(true)
    }
  }, [])
  
  const handleCloseWip = () => {
    setShowWipModal(false)
    localStorage.setItem('gradebook_wip_seen', 'true')
  }

  // Fetch real attempts data
  useEffect(() => {
    const loadAttempts = async () => {
      if (!user?.uid) {
        setLoading(false)
        return
      }
      
      setLoading(true)
      try {
        const fetchedAttempts = await fetchUserAttempts(user.uid)
        
        // Transform Firestore data to match UI expectations
        const transformedAttempts = fetchedAttempts.map((attempt) => {
          // Determine word range based on totalQuestions
          // If we have list data, we could compare to list.wordCount, but for now use a simple heuristic
          const totalQuestions = attempt.totalQuestions || attempt.answers?.length || 0
          const wordRange = totalQuestions >= 50 ? 'Full List' : `Random ${totalQuestions}`
          
          return {
            id: attempt.id,
            className: attempt.className || 'Unknown Class',
            listTitle: attempt.listTitle || 'Vocabulary Test',
            wordRange,
            score: attempt.score || 0,
            totalQuestions,
            date: attempt.date || new Date(),
            // Preserve full attempt data including answers for trouble spots calculation
            answers: attempt.answers || [],
            listId: attempt.listId || null,
          }
        })
        
        setAttempts(transformedAttempts)
      } catch (err) {
        console.error('Error loading attempts:', err)
        setAttempts([])
      } finally {
        setLoading(false)
      }
    }
    
    loadAttempts()
  }, [user?.uid])

  // Calculate hero stats
  const heroStats = useMemo(() => {
    const scores = attempts.map(a => a.score)
    const totalWords = attempts.reduce((sum, a) => sum + a.totalQuestions, 0)
    
    return {
      averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      testsTaken: attempts.length,
      totalWordsTested: totalWords,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
    }
  }, [attempts])

  // Get last 7 scores for trend visualization
  const trendScores = useMemo(() => {
    const sorted = [...attempts].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 7)
    return sorted.map(a => a.score)
  }, [attempts])

  // Calculate Top 3 missed words from real attempt data
  const troubleSpots = useMemo(() => {
    // Track word error frequency (using word text as key, with wordId as fallback)
    const wordErrorCount = {}
    
    // Iterate through all attempts
    attempts.forEach((attempt) => {
      if (!attempt.answers || !Array.isArray(attempt.answers)) return
      
      // Count incorrect answers
      attempt.answers.forEach((answer) => {
        if (answer.isCorrect === false) {
          // Prefer word text if available, otherwise use wordId
          const wordKey = answer.word || answer.wordId || 'Unknown'
          wordErrorCount[wordKey] = (wordErrorCount[wordKey] || 0) + 1
        }
      })
    })
    
    // Sort by frequency (highest first) and take top 3
    const sortedWords = Object.entries(wordErrorCount)
      .sort(([, countA], [, countB]) => countB - countA)
      .slice(0, 3)
      .map(([wordKey]) => wordKey)
    
    return sortedWords
  }, [attempts])

  // Handle sorting
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  // Sort attempts
  const sortedAttempts = useMemo(() => {
    if (!sortKey) return attempts

    const sorted = [...attempts].sort((a, b) => {
      let aVal = a[sortKey]
      let bVal = b[sortKey]

      if (sortKey === 'date') {
        aVal = a.date.getTime()
        bVal = b.date.getTime()
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    return sorted
  }, [attempts, sortKey, sortDirection])

  // Format date
  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date)
  }

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600'
    if (score >= 60) return 'text-orange-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mb-4"></div>
              <p className="text-slate-600">Loading gradebook...</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-7xl">
        {/* Global Top Bar */}
        <div className="mb-8 flex items-center justify-between">
          <img src="/logo_vector.svg" alt="VocaBoost" className="w-32 md:w-48 h-auto" />
          <button
            type="button"
            onClick={handleLogout}
            className="h-12 flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Log Out
          </button>
        </div>

        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-brand-primary">My Gradebook</h1>
            <p className="font-body mt-1 text-base text-slate-500">
              Track your assessment history and performance trends.
            </p>
          </div>
          <Link
            to="/"
            className="h-12 flex items-center gap-2 px-5 bg-white border border-slate-200 rounded-xl shadow-sm text-brand-primary font-bold hover:bg-slate-50 transition-colors"
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 mb-2">Average Score</p>
            <p className="text-3xl font-bold text-brand-primary">{heroStats.averageScore}%</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 mb-2">Tests Taken</p>
            <p className="text-3xl font-bold text-brand-primary">{heroStats.testsTaken}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 mb-2">Total Words Tested</p>
            <p className="text-3xl font-bold text-brand-primary">{heroStats.totalWordsTested}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs text-slate-500 mb-2">Highest Score</p>
            <p className="text-3xl font-bold text-brand-primary">{heroStats.highestScore}%</p>
          </div>
        </div>

        {/* Insights Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Performance Trend */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-brand-primary" />
              <h2 className="font-heading text-lg font-bold text-slate-900">Performance Trend</h2>
            </div>
            <div className="flex items-end justify-between gap-2 h-32">
              {trendScores.map((score, index) => {
                const heightPercent = Math.max(10, (score / 100) * 100)
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full bg-brand-primary rounded-t-md transition-all duration-300"
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-xs text-slate-500">{score}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Trouble Spots */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h2 className="font-heading text-lg font-bold text-slate-900">Trouble Spots</h2>
            </div>
            <div className="space-y-3">
              {troubleSpots.length > 0 ? (
                troubleSpots.map((word, index) => (
                  <div key={index} className="flex items-center gap-2 text-slate-700">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span className="font-medium">{word}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">No trouble spots identified yet. Keep up the great work!</p>
              )}
            </div>
          </div>
        </div>

        {/* Gradebook Table */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mt-6">
          {/* Table Header */}
          <div className="bg-slate-50 border-b border-slate-100 p-4 grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div
              className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-brand-primary transition-colors"
              onClick={() => handleSort('className')}
            >
              Class
              {sortKey === 'className' && <ArrowUpDown className="w-3 h-3" />}
            </div>
            <div
              className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-brand-primary transition-colors"
              onClick={() => handleSort('listTitle')}
            >
              List
              {sortKey === 'listTitle' && <ArrowUpDown className="w-3 h-3" />}
            </div>
            <div className="col-span-2">Word Range</div>
            <div className="col-span-2">Raw Score</div>
            <div
              className="col-span-1 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-brand-primary transition-colors"
              onClick={() => handleSort('score')}
            >
              Percent
              {sortKey === 'score' && <ArrowUpDown className="w-3 h-3" />}
            </div>
            <div
              className="col-span-2 text-right flex items-center justify-end gap-1 cursor-pointer hover:text-brand-primary transition-colors"
              onClick={() => handleSort('date')}
            >
              Date
              {sortKey === 'date' && <ArrowUpDown className="w-3 h-3" />}
            </div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-50">
            {sortedAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="hover:bg-slate-50 border-b border-slate-50 last:border-0 p-4 grid grid-cols-12 gap-4 items-center text-sm text-slate-700 transition-colors"
              >
                <div className="col-span-2 font-medium">{attempt.className}</div>
                <div className="col-span-3">{attempt.listTitle}</div>
                <div className="col-span-2 text-slate-600">{attempt.wordRange}</div>
                <div className="col-span-2 text-slate-600">
                  {Math.round((attempt.score / 100) * attempt.totalQuestions)} / {attempt.totalQuestions}
                </div>
                <div className={`col-span-1 text-right font-bold ${getScoreColor(attempt.score)}`}>
                  {attempt.score}%
                </div>
                <div className="col-span-2 text-right text-slate-600">{formatDate(attempt.date)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WIP Modal */}
      {showWipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md shadow-2xl border border-slate-100 mx-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                <Construction className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-2xl font-heading font-bold text-slate-900 mb-3">
                Under Construction
              </h2>
              <p className="font-body text-base text-slate-600 mb-6">
                The Gradebook is currently being built. Some features like 'Trend Graphs' or 'Class Averages' may be simulating data or unavailable.
              </p>
              <button
                onClick={handleCloseWip}
                className="bg-brand-primary text-white rounded-xl py-3 px-6 w-full font-bold hover:bg-brand-primary/90 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default Gradebook

