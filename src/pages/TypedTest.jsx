import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, Timestamp, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import { submitTypedTestAttempt, withRetry, logSystemEvent, getNewWordAttemptForDay } from '../services/db'
import { useSimulationContext, isSimulationEnabled } from '../hooks/useSimulation.jsx'
import {
  initializeDailySession,
  getNewWords,
  resolveSegmentWords,
  processTestResults,
  selectTestWords,
  completeSessionFromTest
} from '../services/studyService'
import { getOrCreateClassProgress, getClassProgress } from '../services/progressService'
import { SERVER_ATTEMPT_WRITE, LIST_SCOPED_RECON, RECOVERY_GUARD, FORCED_PATHWAY } from '../config/featureFlags'
import { STUDY_ALGORITHM_CONSTANTS, shuffleArray } from '../utils/studyAlgorithm'
import {
  getTestId,
  saveTestState,
  getTestState,
  clearTestState,
  getRecoveryTimeRemaining,
  markIntentionalExit,
  wasIntentionalExit,
  clearIntentionalExitFlag,
  getOrCreateAttemptNonce
} from '../utils/testRecovery'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import TestResults from '../components/TestResults.jsx'
import Watermark from '../components/Watermark.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import SessionProgressSheet from '../components/SessionProgressSheet'
import SessionHeader, { GreyedMenuIcon } from '../components/SessionHeader'
import { Button } from '../components/ui'
import { Trophy, X, LayoutGrid, TrendingUp, AlertTriangle } from 'lucide-react'
import { getSessionStep } from '../utils/sessionStepTracker'

// Hard cap for typed tests to limit AI grading costs
const MAX_TYPED_TEST_WORDS = 50

const TypedTest = () => {
  const { classId, listId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  
  // Get navigation state
  const {
    testConfig = null,
    returnPath = '/',
    practiceMode = false,
    // Legacy props for backwards compatibility
    testType: legacyTestType = 'review',
    wordPool: legacyWordPool = null,
    sessionContext: legacySessionContext = null,
    assignmentSettings: legacyAssignmentSettings = null
  } = location.state || {}

  // Derive values from testConfig or legacy props
  const testType = testConfig?.testType || legacyTestType
  const wordPool = testConfig?.wordsToTest || legacyWordPool
  const sessionContext = testConfig || legacySessionContext
  const assignmentSettings = legacyAssignmentSettings

  // Also check query params for backwards compatibility
  const searchParams = new URLSearchParams(location.search)
  const testTypeParam = searchParams.get('type') || testType
  const classIdParam = searchParams.get('classId') || classId

  const [listDetails, setListDetails] = useState(null)
  const [words, setWords] = useState([])
  const [originalWords, setOriginalWords] = useState([]) // Store original word list for retake
  const [responses, setResponses] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState(null)
  const inputRefs = useRef([])
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [attemptId, setAttemptId] = useState(null)
  const [currentTestType, setCurrentTestType] = useState(testTypeParam)
  const [canRetake, setCanRetake] = useState(false)
  const [retakeThreshold, setRetakeThreshold] = useState(0.95)
  const [retakeError, setRetakeError] = useState(null)
  const [showResults, setShowResults] = useState(false)
  const [testResultsData, setTestResultsData] = useState(null)
  const [configuredTestSize, setConfiguredTestSize] = useState(30)

  // Modal states
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const [savedRecoveryState, setSavedRecoveryState] = useState(null)
  const [recoveryTimeRemaining, setRecoveryTimeRemaining] = useState(null)
  const [showProgressSheet, setShowProgressSheet] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  // AI grading retry state
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [gradingError, setGradingError] = useState(null)
  // 'deterministic' (reload needed — re-submitting repeats the failure) | 'transient' (retry safe)
  const [gradingErrorKind, setGradingErrorKind] = useState('transient')
  // Tracks whether processTestResults has already committed for this mount, so
  // a Try-Again click after a transient failure does not re-increment
  // timesTestedTotal on every retry. See MCQTest for the same pattern.
  const resultsProcessedRef = useRef(false)
  // Holds the doWriteAndFinalize closure when a post-grade durable write fails, so
  // "Retry Save" re-runs the write only (never re-grading / re-billing the AI call).
  const pendingSaveRef = useRef(null)

  // Refs for scroll-based fade effect
  const headerRef = useRef(null)
  const contentRef = useRef(null)
  const questionRefs = useRef([])
  const [headerHeight, setHeaderHeight] = useState(0)
  const [questionOpacities, setQuestionOpacities] = useState([])

  // Practice mode (after passing, test doesn't save)
  const [isPracticeMode] = useState(practiceMode)

  // Test ID for recovery
  const testId = getTestId(classIdParam || classId, listId, currentTestType)

  // Simulation mode integration
  const sim = useSimulationContext()
  const autoAnswerTimerRef = useRef(null)

  // Auto-answer effect for simulation mode (typed test)
  useEffect(() => {
    if (!sim?.isAutoMode || !isSimulationEnabled()) return
    if (isLoading || showResults || isSubmitting) return
    if (words.length === 0) return

    // For typed tests, we fill in answers based on accuracy
    // Correct answer = the actual word text
    // Incorrect answer = a typo or wrong word

    const unansweredWords = words.filter(word => !responses[word.id])
    if (unansweredWords.length === 0) {
      // All answered, auto-submit
      setTimeout(() => {
        handleSubmit()
      }, sim.speed?.testDelay ?? 100)
      return
    }

    const delay = sim.speed?.testDelay ?? 100
    let answerIndex = 0

    const answerNextWord = () => {
      if (answerIndex >= unansweredWords.length) {
        // All done, submit
        setTimeout(() => {
          handleSubmit()
        }, delay)
        return
      }

      const word = unansweredWords[answerIndex]

      // Decide if this answer should be correct based on profile accuracy
      const shouldBeCorrect = Math.random() < (sim.profile?.accuracy ?? 0.75)

      let answer
      if (shouldBeCorrect) {
        // Type the correct word
        answer = word.text
      } else {
        // Type an intentionally wrong answer (add typo or use wrong word)
        const typoChance = Math.random()
        if (typoChance < 0.5 && word.text.length > 2) {
          // Add a typo
          const pos = Math.floor(Math.random() * word.text.length)
          answer = word.text.slice(0, pos) + 'x' + word.text.slice(pos + 1)
        } else {
          // Use a completely wrong word
          answer = 'wronganswer'
        }
      }

      setResponses(prev => ({ ...prev, [word.id]: answer }))
      answerIndex++

      autoAnswerTimerRef.current = setTimeout(answerNextWord, delay)
    }

    autoAnswerTimerRef.current = setTimeout(answerNextWord, delay)

    return () => clearTimeout(autoAnswerTimerRef.current)
  }, [sim?.isAutoMode, words, responses, isLoading, showResults, isSubmitting])

  // Browser close warning + intentional exit tracking
  useEffect(() => {
    // Warn if: responses exist AND (not submitted OR submit failed)
    const hasProgress = Object.keys(responses).length > 0 && (!showResults || submitError)

    const handleBeforeUnload = (e) => {
      if (hasProgress) {
        // Mark as intentional exit - if user clicks "Leave", this flag tells us
        // If user clicks "Stay", we clear it on next interaction
        markIntentionalExit(testId)
        e.preventDefault()
        e.returnValue = 'You have unsaved test progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    // Clear intentional exit flag on any user interaction (handles "Stay" case)
    const handleInteraction = () => {
      clearIntentionalExitFlag(testId)
    }

    if (hasProgress) {
      window.addEventListener('beforeunload', handleBeforeUnload)
      // Listen for user interaction to clear flag if they chose "Stay"
      window.addEventListener('click', handleInteraction, { once: true })
      window.addEventListener('keydown', handleInteraction, { once: true })
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }
  }, [responses, showResults, submitError, testId])

  const loadList = useCallback(async () => {
    if (!listId) return
    try {
      const listRef = doc(db, 'lists', listId)
      const listSnap = await getDoc(listRef)
      if (!listSnap.exists()) {
        throw new Error('List not found.')
      }
      setListDetails({ id: listSnap.id, ...listSnap.data() })
    } catch (err) {
      setError(err.message ?? 'Unable to load list.')
    }
  }, [listId])

  useEffect(() => {
    loadList()
  }, [loadList])

  const loadTestWords = useCallback(async () => {
    if (!user?.uid || !listId) return
    setIsLoading(true)
    setError('')
    try {
      // Get the effective word pool (from testConfig or legacy)
      const effectiveWordPool = testConfig?.wordsToTest || wordPool || []

      // Check for recovery state FIRST - if exists, use saved wordIds to restore exact words
      const savedState = getTestState(testId)
      const hasValidRecovery = savedState &&
        savedState.wordIds?.length > 0 &&
        !wasIntentionalExit(testId)

      if (hasValidRecovery && effectiveWordPool.length > 0) {
        // Recovery mode: restore exact words from saved state
        const wordMap = new Map(effectiveWordPool.map(w => [w.id, w]))
        const recoveredWords = savedState.wordIds
          .map(id => wordMap.get(id))
          .filter(Boolean)

        if (recoveredWords.length > 0) {
          setOriginalWords(recoveredWords)
          setWords(recoveredWords)
          // Don't reset responses - will be restored when user confirms recovery
          setResults(null)
          setShowResults(false)
          setCanRetake(false)
          setTestResultsData(null)
          inputRefs.current = new Array(recoveredWords.length)
          // Trigger recovery prompt
          setSavedRecoveryState(savedState)
          setRecoveryTimeRemaining(getRecoveryTimeRemaining(testId))
          setShowRecoveryPrompt(true)
          setIsLoading(false)
          return
        }
        // If recovery failed (words not found), fall through to normal flow
      }

      // PATH A: TestConfig provided (from DailySessionFlow with new flow)
      if (testConfig) {
        // All settings come from testConfig - already limited by testSize
        // C-23 fail-open: only adopt a finite threshold. Setting undefined/NaN would
        // make every `score >= retakeThreshold` compare false (fail-closed verdicts).
        if (Number.isFinite(testConfig.passThresholdDecimal)) {
          setRetakeThreshold(testConfig.passThresholdDecimal)
        }
        setCurrentTestType(testConfig.testType)
        const effectiveTestSize = testConfig.testType === 'new' ? testConfig.testSizeNew : testConfig.testSizeReview
        setConfiguredTestSize(effectiveTestSize)
        // Apply MAX_TYPED_TEST_WORDS cap on top of testConfig's limiting
        const cappedWords = testConfig.wordsToTest.slice(0, MAX_TYPED_TEST_WORDS)
        setOriginalWords(cappedWords)
        setWords(shuffleArray([...cappedWords]))
        setResponses({})
        setResults(null)
        setShowResults(false)
        setCanRetake(false)
        setTestResultsData(null)
        setFocusedIndex(0)
        inputRefs.current = new Array(cappedWords.length)
        setIsLoading(false)
        return
      }

      // PATH B: Legacy wordPool provided (backwards compatibility)
      if (wordPool && wordPool.length > 0) {
        // Resolve the pass threshold from the class doc when the navigation state
        // doesn't carry it. Defaulting to 95 here both mislabels the result card
        // ("Your score is below 95%") and makes the UI fail 92–94% scorers whose
        // attempts the server correctly marks passed (server reads the class doc).
        if (assignmentSettings?.passThreshold != null) {
          setRetakeThreshold((Number(assignmentSettings.passThreshold) || 95) / 100)
        } else if (classIdParam && listId) {
          try {
            const thrSnap = await getDoc(doc(db, 'classes', classIdParam))
            const thr = thrSnap.exists() ? thrSnap.data()?.assignments?.[listId]?.passThreshold : null
            setRetakeThreshold(((Number(thr) > 0 ? Number(thr) : 95)) / 100)
          } catch (thrErr) {
            console.warn('PATH B: could not resolve class passThreshold, using default', thrErr)
          }
        }
        const shuffled = shuffleArray([...wordPool])
        const cappedWords = shuffled.slice(0, MAX_TYPED_TEST_WORDS)
        setOriginalWords(cappedWords)
        setWords(cappedWords)
        setResponses({})
        setResults(null)
        setShowResults(false)
        setCanRetake(false)
        setTestResultsData(null)
        setFocusedIndex(0)
        inputRefs.current = new Array(cappedWords.length)
        setIsLoading(false)
        return
      }

      // Otherwise, use smart selection based on test type
      if (!classIdParam) {
        throw new Error('Class ID required for smart selection')
      }

      const classRef = doc(db, 'classes', classIdParam)
      const classSnap = await getDoc(classRef)
      if (!classSnap.exists()) {
        throw new Error('Class not found')
      }

      const assignment = classSnap.data()?.assignments?.[listId]
      if (!assignment) {
        throw new Error('Assignment not found')
      }

      // Set pass threshold from assignment (stored as percentage, convert to decimal)
      setRetakeThreshold((assignment.passThreshold || 95) / 100)

      const testSize = currentTestType === 'new'
        ? (assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW)
        : (assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW)
      setConfiguredTestSize(testSize)

      let wordsToTest = []

      if (currentTestType === 'new') {
        // Get today's new words
        const config = await initializeDailySession(user.uid, classIdParam, listId, {
          weeklyPace: assignment.pace * 7 || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
          studyDaysPerWeek: STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
          testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
          testSizeReview: assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW,
          newWordRetakeThreshold: STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
        })

        if (config.newWordCount > 0) {
          // P9 · CYC (§3c / Codex P9-4): config.cyclingActive (now resolved cross-class inside
          // initializeDailySession) routes a cycling day's VIRTUAL range through the resolver so
          // it wraps at the lap boundary. Under cycling newWordCount === pace > 0, so the legacy
          // "finished list" throw below is unreachable. Flag-off ⇒ cyclingActive falsy ⇒ today's
          // legacy filter + throw exactly (byte-equivalent).
          const newWords = await getNewWords(listId, config.newWordStartIndex, config.newWordCount, config.cyclingActive)
          wordsToTest = selectTestWords(newWords, testSize)
        } else {
          throw new Error('No new words available for testing')
        }
      } else {
        // Get review segment words
        const config = await initializeDailySession(user.uid, classIdParam, listId, {
          weeklyPace: assignment.pace * 7 || STUDY_ALGORITHM_CONSTANTS.DEFAULT_WEEKLY_PACE,
          studyDaysPerWeek: STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
          testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
          testSizeReview: assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW,
          newWordRetakeThreshold: STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
        })
        
        if (config.segment) {
          const segmentWords = await resolveSegmentWords(user.uid, listId, config.segment)
          wordsToTest = selectTestWords(segmentWords, testSize)
        } else {
          // Fallback: load all words if no segment (day 1)
          const wordsRef = collection(db, 'lists', listId, 'words')
          const snap = await getDocs(query(wordsRef, orderBy('position', 'asc')))
          const allWords = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          wordsToTest = selectTestWords(allWords, testSize)
        }
      }

      if (wordsToTest.length === 0) {
        throw new Error('No words available for testing.')
      }

      // Check for recovery in standalone mode
      if (hasValidRecovery) {
        const wordMap = new Map(wordsToTest.map(w => [w.id, w]))
        const recoveredWords = savedState.wordIds
          .map(id => wordMap.get(id))
          .filter(Boolean)

        if (recoveredWords.length > 0) {
          setOriginalWords(recoveredWords)
          setWords(recoveredWords)
          // Don't reset responses - will be restored when user confirms recovery
          setResults(null)
          setShowResults(false)
          setCanRetake(false)
          setTestResultsData(null)
          inputRefs.current = new Array(recoveredWords.length)
          // Trigger recovery prompt
          setSavedRecoveryState(savedState)
          setRecoveryTimeRemaining(getRecoveryTimeRemaining(testId))
          setShowRecoveryPrompt(true)
          return
        }
        // If recovery failed, fall through to normal flow
      }

      // Apply hard cap for typed tests (with randomization)
      const shuffledWords = shuffleArray([...wordsToTest])
      const cappedWords = shuffledWords.slice(0, MAX_TYPED_TEST_WORDS)
      setOriginalWords(cappedWords)
      setWords(cappedWords)
      setResponses({})
      setResults(null)
      setShowResults(false)
      setCanRetake(false)
      setTestResultsData(null)
      setFocusedIndex(0)
      inputRefs.current = new Array(cappedWords.length)
    } catch (err) {
      setError(err.message ?? 'Unable to load test.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid, listId, classIdParam, currentTestType, wordPool, testId, testConfig])

  useEffect(() => {
    loadTestWords()
  }, [loadTestWords])


  // Auto-focus first input when words load
  useEffect(() => {
    if (words.length > 0 && inputRefs.current[0] && !results) {
      inputRefs.current[0]?.focus()
    }
  }, [words.length, results])

  // Scroll to focused input
  useEffect(() => {
    if (inputRefs.current[focusedIndex] && !results) {
      inputRefs.current[focusedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [focusedIndex, results])

  // Recovery is now handled in loadTestWords to ensure words are restored before showing prompt

  // Save test state on each answer (for recovery)
  useEffect(() => {
    if (!testId || words.length === 0 || showResults) return

    const wordIds = words.map(w => w.id)
    if (Object.keys(responses).length > 0) {
      saveTestState(testId, responses, wordIds, focusedIndex)
    }
  }, [responses, testId, words, focusedIndex, showResults])

  // Measure header height after render
  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.getBoundingClientRect().height
      setHeaderHeight(height)
    }
  }, [words.length])

  // Calculate question opacities on scroll
  useEffect(() => {
    if (headerHeight === 0 || words.length === 0) return

    const calculateOpacities = () => {
      const newOpacities = questionRefs.current.map((ref) => {
        if (!ref) return 1
        const rect = ref.getBoundingClientRect()
        const questionTop = rect.top

        // Binary: visible below header, hidden at or above
        return questionTop >= headerHeight ? 1 : 0
      })
      setQuestionOpacities(newOpacities)
    }

    // Calculate initially
    calculateOpacities()

    // Listen to window scroll (page scrolls at window level, not content div)
    window.addEventListener('scroll', calculateOpacities)

    return () => {
      window.removeEventListener('scroll', calculateOpacities)
    }
  }, [headerHeight, words.length])

  // Handle recovery - restore saved answers
  const handleRecoveryResume = () => {
    // Clear any stale intentional exit flag
    clearIntentionalExitFlag(testId)
    if (savedRecoveryState?.answers) {
      if (RECOVERY_GUARD) {
        // CS PR-1 · WI-4 (I6): INTERSECT the saved responses with the CURRENT word set —
        // stale keys from a regenerated sample must not survive into the submit (the
        // rows > totalQuestions / >100% score class). Drop an out-of-range saved index;
        // an EMPTY intersection → start fresh (re-shuffle, same as declining recovery).
        const validIds = new Set(words.map(w => w.id))
        const filtered = {}
        for (const [wordId, response] of Object.entries(savedRecoveryState.answers)) {
          if (validIds.has(wordId)) filtered[wordId] = response
        }
        if (Object.keys(filtered).length === 0) {
          handleRecoveryStartFresh()
          return
        }
        setResponses(filtered)
        const savedIdx = savedRecoveryState.currentIndex
        if (Number.isInteger(savedIdx) && savedIdx >= 0 && savedIdx < words.length) {
          setFocusedIndex(savedIdx)
        }
      } else {
        setResponses(savedRecoveryState.answers)
        if (savedRecoveryState.currentIndex !== undefined) {
          setFocusedIndex(savedRecoveryState.currentIndex)
        }
      }
    }
    setShowRecoveryPrompt(false)
    setSavedRecoveryState(null)
  }

  // Handle recovery - start fresh (re-randomize words)
  const handleRecoveryStartFresh = () => {
    clearTestState(testId)
    setShowRecoveryPrompt(false)
    setSavedRecoveryState(null)
    // Re-shuffle the words for a fresh start
    const shuffled = shuffleArray([...words])
    setWords(shuffled)
    setOriginalWords(shuffled)
    setResponses({})
    setFocusedIndex(0)
    inputRefs.current = new Array(shuffled.length)
  }

  // Quit test with confirmation - always go to Dashboard
  const handleQuitConfirm = () => {
    clearTestState(testId)
    setShowQuitConfirm(false)
    navigate('/')
  }

  const handleKeyDown = (e, index) => {
    if (results || isSubmitting) return

    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault()
      const nextIndex = index + 1
      if (nextIndex < words.length) {
        setFocusedIndex(nextIndex)
        inputRefs.current[nextIndex]?.focus()
      } else {
        // Last input - show confirmation modal
        setShowSubmitConfirm(true)
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      const prevIndex = index - 1
      if (prevIndex >= 0) {
        setFocusedIndex(prevIndex)
        inputRefs.current[prevIndex]?.focus()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const nextIndex = Math.min(index + 1, words.length - 1)
      setFocusedIndex(nextIndex)
      inputRefs.current[nextIndex]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prevIndex = Math.max(index - 1, 0)
      setFocusedIndex(prevIndex)
      inputRefs.current[prevIndex]?.focus()
    }
  }

  // AI grading with retry logic + diagnostic logging (connection-error investigation).
  // Logs go to system_logs via logSystemEvent (non-blocking). No behavior change.
  // Phase 1: deterministic grade errors (malformed payload / precondition) won't be
  // fixed by re-calling — re-grading just loops. Surface a reload, don't retry.
  const isDeterministicGradeError = (code) =>
    code === 'functions/invalid-argument' || code === 'functions/failed-precondition'

  // Phase 1 recovery channel: a lost grade RESPONSE doesn't mean the server didn't grade.
  // Ask getGradingStatus by the same attemptDocId. Returns the raw status object or null.
  // Safe no-op if the server job flag is off (status:'absent') or the callable is absent.
  const fetchGradingStatus = async (attemptDocId) => {
    if (!attemptDocId) return null
    try {
      const getGradingStatus = httpsCallable(getFunctions(), 'getGradingStatus', { timeout: 15000 })
      const res = await getGradingStatus({ attemptDocId })
      return res?.data || null
    } catch { return null }
  }

  // Single-shot recovery: if the grade is already cached, return a gradeTypedTest-shaped {data}.
  const tryRecoverGrade = async (gradeContext) => {
    const status = await fetchGradingStatus(gradeContext?.attemptDocId)
    if (status?.status === 'graded' && status.payload?.results) return { data: status.payload }
    return null
  }

  // Polling recovery (Codex #3): when a concurrent worker holds a live lease ('in_progress'),
  // the grade is legitimately running under a server lease — DON'T fail or re-grade; wait for it.
  // Poll until graded ({data}) or terminal ('absent'/'stale' → caller re-submits), bounded so we
  // never hang past the server lease window.
  const pollForGrade = async (gradeContext, maxWaitMs = 150000, intervalMs = 4000) => {
    const attemptDocId = gradeContext?.attemptDocId
    if (!attemptDocId) return null
    const deadline = Date.now() + maxWaitMs
    while (Date.now() < deadline) {
      const status = await fetchGradingStatus(attemptDocId)
      if (status?.status === 'graded' && status.payload?.results) return { data: status.payload }
      if (!status || status.status === 'absent' || status.status === 'stale') return null
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    return null
  }

  const gradeWithRetry = async (answersToGrade, gradeContext = null) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY_MS = 10000  // 10 seconds
    const TIMEOUT_MS = 90000      // 90 seconds per attempt

    // Shared diagnostic context for this submission
    let payloadChars = -1
    try { payloadChars = JSON.stringify(answersToGrade).length } catch { /* ignore */ }
    const conn = (typeof navigator !== 'undefined' && navigator.connection) || {}
    const diagBase = {
      classId: classIdParam || null,
      listId: listId || null,
      testId: testId || null,
      studyDay: sessionContext?.dayNumber ?? null,
      testType: currentTestType || null,
      wordCount: Array.isArray(answersToGrade) ? answersToGrade.length : null,
      payloadChars,
      effectiveType: conn.effectiveType || null,   // '4g','3g','2g','slow-2g'
      downlinkMbps: (conn.downlink ?? null),        // approx bandwidth
      rttMs: (conn.rtt ?? null),                    // approx round-trip time
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const startedAt = Date.now()
      try {
        const functions = getFunctions()
        const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest', {
          timeout: TIMEOUT_MS
        })

        // Pass listId + classId so the server resolves canonical definitions itself
        // (server-authoritative answer key) and can authorize the resolution.
        // gradeContext (G2): lets the server mint a gradeToken binding the AI grade to this
        // attempt, so a write-failed retry can persist server-authentic isCorrect. Harmless if absent.
        const result = await gradeTypedTest({ answers: answersToGrade, listId, classId: classIdParam, gradeContext })

        // Succeeded — if it needed a retry, record that (tells us retries are saving people)
        if (attempt > 1) {
          logSystemEvent('grading_recovered', {
            ...diagBase, attempt, elapsedMs: Date.now() - startedAt,
            studentId: user?.uid || null,
          }, 'warning')
        }
        return result  // Success!

      } catch (error) {
        const elapsedMs = Date.now() - startedAt
        // The key diagnostic write — this is what we query to classify failures.
        logSystemEvent('grading_attempt_failed', {
          ...diagBase,
          studentId: user?.uid || null,
          attempt,
          isFinal: attempt === MAX_RETRIES,
          elapsedMs,
          timedOut: elapsedMs >= (TIMEOUT_MS - 1500),   // ran the full window => slow/timeout
          failedFast: elapsedMs < 2000,                 // died immediately => unreachable/offline
          online: (typeof navigator !== 'undefined') ? navigator.onLine : null,
          errCode: error?.code || null,                 // e.g. functions/deadline-exceeded, unavailable
          errName: error?.name || null,
          errMessage: String(error?.message || '').slice(0, 300),
        }, 'error')
        console.error(`Grading attempt ${attempt}/${MAX_RETRIES} failed [${error?.code || '?'}, ${elapsedMs}ms]:`, error)

        // 'aborted' = a concurrent worker holds a LIVE lease and is grading (server in_progress).
        // Wait for it (poll) rather than re-grading or failing — this is how concurrent submits
        // converge on one grade.
        if (error?.code === 'functions/aborted') {
          const polled = await pollForGrade(gradeContext)
          if (polled) {
            logSystemEvent('grading_recovered', {
              ...diagBase, attempt, via: 'poll_in_progress', studentId: user?.uid || null,
            }, 'warning')
            return polled
          }
          // poll ended terminal (stale/absent) → fall through to normal retry (will re-claim/grade)
        }

        // Recovery: the server may have graded even though THIS response was lost.
        // If a cached grade exists for this attempt, use it instead of retrying/failing.
        const recovered = await tryRecoverGrade(gradeContext)
        if (recovered) {
          logSystemEvent('grading_recovered', {
            ...diagBase, attempt, via: 'job_status', studentId: user?.uid || null,
          }, 'warning')
          return recovered
        }

        // Deterministic errors won't be fixed by re-calling — stop looping, surface a reload.
        if (isDeterministicGradeError(error?.code)) {
          throw error
        }

        // Last attempt - throw error
        if (attempt === MAX_RETRIES) {
          throw error
        }

        // Update UI to show we're retrying
        setRetryAttempt(attempt)

        // Wait 10s before retry
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }

  const handleSubmit = async () => {
    if (!user?.uid || !listId || isSubmitting || showResults) return

    setIsSubmitting(true)
    setError('')
    setSubmitError(null)
    setGradingError(null)
    setRetryAttempt(0)

    try {
      // localStorage recovery is intentionally NOT cleared here. We only clear
      // after grading + attempt + study_state writes all succeed — otherwise
      // a mid-flow failure (especially during the 90s-per-attempt AI grading
      // call) loses 15–20 minutes of typing on a refresh.

      // Prepare answers for grading
      const answersToGrade = words.map((word) => ({
        wordId: word.id,
        word: word.word,
        correctDefinition: word.definition,
        koreanDefinition: word.definitions?.ko || '',
        studentResponse: responses[word.id] || '',
      }))

      // G2: bind the grade to this attempt (deterministic attemptDocId — same nonce reused at the
      // write below) so the server can mint a gradeToken. totalQuestions = words.length to match the
      // write-time context. Used only when GRADE_TOKEN_ENFORCED is on; harmless otherwise.
      const gradeAttemptDocId = `${user.uid}_${testId}_${getOrCreateAttemptNonce(testId)}`
      const gradeContext = {
        attemptDocId: gradeAttemptDocId, classId: classIdParam, listId, testId,
        testType: 'typed', totalQuestions: words.length,
      }

      // Call Cloud Function for AI grading with retry logic
      const gradingResult = await gradeWithRetry(answersToGrade, gradeContext)

      // Build results array for processTestResults
      const resultsArray = gradingResult.data.results.map(r => ({
        wordId: r.wordId,
        correct: r.isCorrect
      }))

      // Summarize locally first (no I/O). Same numbers processTestResults
      // would have returned, computed without touching study_states yet.
      const correctCount = resultsArray.filter(r => r.correct).length
      const failedIds = resultsArray.filter(r => !r.correct).map(r => r.wordId)
      const summary = {
        score: resultsArray.length > 0 ? correctCount / resultsArray.length : 0,
        correct: correctCount,
        total: resultsArray.length,
        failed: failedIds
      }

      // C-23: authoritative verdict of the STORED attempt (server-computed under
      // SERVER_ATTEMPT_WRITE, the client-written doc's own value otherwise). Stays
      // null in practice mode — the result card then falls back to the local compare.
      let serverPassed = null

      // Show the results view. Shared by the practice path and by doWriteAndFinalize
      // (so a write retry that succeeds lands on the same results screen). Captures
      // summary + gradingResult from this handleSubmit invocation.
      const finalizeResultsView = () => {
        if (currentTestType === 'new' && summary.score < retakeThreshold) {
          setCanRetake(true)
        }
        // Safe to drop local recovery now: grading + attempt + study_states all
        // succeeded. Rolls over the per-session nonce so the next launch is fresh.
        clearTestState(testId)
        setTestResultsData({
          score: summary.score,
          correct: summary.correct,
          total: summary.total,
          failed: summary.failed,
          gradedResults: gradingResult.data.results,
          testType: currentTestType,
          serverPassed // C-23: authoritative stored verdict (null in practice mode)
        })
        setResults(gradingResult.data.results)
        setShowResults(true)
      }

      if (!isPracticeMode) {
        // Determine if student passed (review tests always pass)
        const passed = currentTestType === 'review' ? true : summary.score >= retakeThreshold

        // Get studyDay from sessionContext, or derive it if the launch lost context.
        let studyDay = sessionContext?.dayNumber
        if (!studyDay && user?.uid && classIdParam && listId) {
          try {
            const { progress } = await getOrCreateClassProgress(user.uid, classIdParam, listId)
            const csd = progress.currentStudyDay || 0
            if (currentTestType === 'new') {
              // A new-word test always concerns the in-progress day.
              studyDay = csd + 1
            } else {
              // Review: stamping the wrong day makes the in-progress day impossible to
              // complete (reconciliation requires a review attempt for day N). If the
              // in-progress day's new test is already passed, this review belongs to
              // it; otherwise it's a retake of the last completed day.
              const nextDayNew = await getNewWordAttemptForDay(user.uid, classIdParam, listId, csd + 1)
              studyDay = (nextDayNew && nextDayNew.passed === true) ? csd + 1 : csd
            }
            logSystemEvent('attempt_day_fallback', {
              testType: currentTestType, stamped: studyDay, csd,
              classId: classIdParam, listId, testId
            })
          } catch (err) {
            // [Codex P6 R1 over-deny fix] A resolver outage under SERVER_PROGRESS_WRITE now fails
            // CLOSED (typed `progress_resolver_unavailable`, already logged at source) rather than a
            // denied legacy write. Without the study day we cannot safely stamp the attempt, so
            // surface the SAME controlled reload/retry UX as the completion handler — not a raw
            // permission error. (Rare: this fallback only runs when sessionContext lost the day.)
            const isResolverDown = err?.code === 'progress_resolver_unavailable'
            const isDenied = err?.code === 'permission-denied' || err?.code === 'functions/permission-denied'
            if (isResolverDown || isDenied) {
              // [Codex P6-3] Log the RAW-denial case here too (the resolver event is already logged
              // at source) so CS observability matches the controlled UX we show.
              if (isDenied) {
                logSystemEvent('legacy_write_denied', {
                  userId: user.uid, classId: classIdParam, listId, phase: 'test-entry-studyday',
                  testType: 'typed', errCode: err?.code, errMessage: String(err?.message || '').slice(0, 300),
                }, 'error')
              }
              setGradingError('진행 정보를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.\n(Couldn\'t load your progress — please reload the page and try again.)')
              setIsSubmitting(false)
              return
            }
            console.error('Failed to derive studyDay from progress:', err)
          }
        }

        // Stale-context guard: a provided dayNumber can also be wrong (old tab /
        // restored sessionStorage). Only CSD (review retake of the completed day)
        // and CSD+1 (the in-progress day) are legitimate stamps; anything else
        // would corrupt day-completion inference. Re-derive when clearly invalid.
        if (sessionContext?.dayNumber != null && user?.uid && classIdParam && listId) {
          try {
            const cpSnap = await getDoc(doc(db, `users/${user.uid}/class_progress`, `${classIdParam}_${listId}`))
            const csdNow = cpSnap.exists() ? (cpSnap.data().currentStudyDay || 0) : 0
            if (studyDay > csdNow + 1 || studyDay < csdNow) {
              const original = studyDay
              studyDay = currentTestType === 'new' ? csdNow + 1 : csdNow + ((await getNewWordAttemptForDay(user.uid, classIdParam, listId, csdNow + 1))?.passed === true ? 1 : 0)
              logSystemEvent('attempt_day_context_invalid', {
                testType: currentTestType, provided: original, corrected: studyDay, csd: csdNow,
                classId: classIdParam, listId
              }, 'error')
            }
          } catch (e) { console.warn('stale-context day validation skipped:', e) }
        }

        // [PHASE 1] Write the attempt doc FIRST.
        // - Idempotent docId so withRetry / Try-Again overwrites the same doc
        //   instead of producing duplicates.
        // - study_state mutations happen AFTER this succeeds, so a failed
        //   submit cannot leave word stats ahead of the gradebook.
        //
        // [I-5 §2 F1, deepfix P4] SINGLE identity per submit flow: reuse the docId the grade
        // was bound to (gradeAttemptDocId, computed ONCE above before grading — mirrors
        // MCQTest's single derivation). The old second getOrCreateAttemptNonce() call here
        // could mint a DIFFERENT nonce under degraded storage → grade-docId !== save-docId
        // (the 06-29 grade-token outage signature). [F2] Prefer the SERVER-echoed id the
        // gradeToken was actually minted against (additive field on the grade-only payload,
        // P3; absent from older deployed functions → nullish falls back to the local id).
        // Divergence should be impossible after F1 — the log is the tripwire, not a handler.
        const serverEchoedAttemptDocId = gradingResult.data?.attemptDocId ?? null
        if (serverEchoedAttemptDocId && serverEchoedAttemptDocId !== gradeAttemptDocId) {
          logSystemEvent('nonce_identity_divergence', {
            userId: user.uid, classId: classIdParam, listId, testId,
            localAttemptDocId: gradeAttemptDocId,
            serverAttemptDocId: serverEchoedAttemptDocId,
          }, 'error')
        }
        const attemptDocId = serverEchoedAttemptDocId ?? gradeAttemptDocId

        // Write + finalize as a single re-runnable unit. A post-grade write failure is
        // retried via the "Retry Save" button (pendingSaveRef), which re-invokes THIS
        // closure — re-running only the durable write, never re-grading (no extra AI call).
        const doWriteAndFinalize = async () => {
        let result
        try {
          if (SERVER_ATTEMPT_WRITE) {
            // Durable write via Cloud Function (server builds the doc, scores, and
            // persists transactionally + idempotently on attemptDocId). Same nonce-id
            // so a retry/lost-response is an idempotent no-op, not a duplicate.
            const attemptAnswers = words.map((word) => {
              const g = gradingResult.data.results.find((r) => r.wordId === word.id) || {}
              return {
                wordId: word.id, word: word.word, correctAnswer: word.definition,
                studentResponse: responses[word.id] || '',
                isCorrect: g.isCorrect ?? false, aiReasoning: g.reasoning || '',
                challengeStatus: null, challengeNote: null,
                challengeReviewedBy: null, challengeReviewedAt: null,
              }
            })
            const context = {
              studentId: user.uid, classId: classIdParam, listId, testId,
              studyDay: studyDay || null, sessionType: currentTestType, testType: 'typed',
              attemptDocId, totalQuestions: words.length,
              isFirstDay: sessionContext?.isFirstDay ?? null,
              listTitle: sessionContext?.listTitle ?? null,
              segmentStartIndex: sessionContext?.segment?.startIndex ?? null,
              segmentEndIndex: sessionContext?.segment?.endIndex ?? null,
              interventionLevel: sessionContext?.interventionLevel ?? null,
              wordsIntroduced: sessionContext?.wordsIntroduced ?? null,
              wordsReviewed: sessionContext?.wordsReviewed ?? null,
              newWordStartIndex: sessionContext?.newWordStartIndex ?? null,
              newWordEndIndex: sessionContext?.newWordEndIndex ?? null,
            }
            const submitVocabAttempt = httpsCallable(getFunctions(), 'submitVocabAttempt', { timeout: 30000 })
            // G2: forward the server gradeToken so the write persists server-authentic isCorrect
            // (correctnessSource:'server-ai'); required once GRADE_TOKEN_ENFORCED is on, ignored otherwise.
            const gradeToken = gradingResult.data?.gradeToken ?? null
            const gradeTokenCreatedAt = gradingResult.data?.gradeTokenCreatedAt ?? null
            const resp = await withRetry(
              () => submitVocabAttempt({ testType: 'typed', context, attemptAnswers, gradeToken, gradeTokenCreatedAt }),
              { maxRetries: 3, totalTimeoutMs: 15000 },
              { userId: user.uid, classId: classIdParam, listId, studyDay, sessionType: currentTestType }
            )
            result = { id: resp.data.attemptId }
            // C-23: surface the server's verdict (returned on fresh AND idempotent writes)
            // so the result card renders the stored truth, not a client recompute.
            serverPassed = typeof resp.data.passed === 'boolean' ? resp.data.passed : null
          } else {
            result = await withRetry(
              () => submitTypedTestAttempt(
                user.uid,
                testId,
                words,
                responses,
                gradingResult.data.results,
                classIdParam,
                listId,
                currentTestType,
                studyDay || null,
                passed,
                sessionContext,
                attemptDocId
              ),
              { maxRetries: 3, totalTimeoutMs: 15000 },
              { userId: user.uid, classId: classIdParam, listId, studyDay, sessionType: currentTestType }
            )
            // C-23: the client-written attempt doc stores exactly this verdict — surface
            // it so the result card always matches the stored gradebook row.
            serverPassed = passed
          }
        } catch (submitErr) {
          // Attempt failed after retries — block progression, stay on page.
          // localStorage recovery is still intact; study_states untouched.
          // The grade is NOT lost: stash this closure so "Retry Save" re-runs the
          // write only (no re-grade / no extra Anthropic call).
          console.error('Failed to save test attempt:', submitErr)
          logSystemEvent('attempt_write_failed_client', {
            userId: user.uid, classId: classIdParam, listId,
            studyDay: studyDay ?? null, sessionType: currentTestType, testType: 'typed',
            errCode: submitErr?.code || null, errName: submitErr?.name || null,
            errMessage: String(submitErr?.message || '').slice(0, 300),
          }, 'error')
          pendingSaveRef.current = doWriteAndFinalize
          setSubmitError('Failed to save your test results. Please try again.')
          setIsSubmitting(false)
          return // Don't proceed - answers preserved in state and localStorage
        }

        pendingSaveRef.current = null // write succeeded — no retry pending
        setAttemptId(result.id)

        // [PHASE 2] Now commit study_state mutations. Guarded by ref so
        // Try-Again does not double-increment counters within the same mount.
        if (!resultsProcessedRef.current) {
          try {
            await processTestResults(user.uid, resultsArray, listId)
            resultsProcessedRef.current = true
          } catch (processErr) {
            // Don't fail the whole submit — attempt is saved.
            console.error('processTestResults failed after attempt write:', processErr)
          }
        }

        // Determine if this is the final test of the session
        const isSessionFinalTest = sessionContext?.isFirstDay
          ? currentTestType === 'new'      // Day 1: new test is only test
          : currentTestType === 'review'   // Day 2+: review test is last

        // Complete session at submission time (before navigation) to prevent state loss
        if (passed && isSessionFinalTest && sessionContext?.dayNumber) {
          try {
            // [1] Snapshot current progress WITHOUT reconciling (the pre-completion snapshot must NOT
            // advance CSD/TWI — NEED_TO_FIX #10). Under LIST_SCOPED_RECON, getOrCreateClassProgress
            // reconciles from the just-written attempt and writes an advanced CSD; the completion below
            // then looks stale to the day-guard → spurious "session refreshed" rebuild. getClassProgress
            // is a pure read. Flag-gated so flag-off stays behavior-equivalent (Run L).
            const progress = LIST_SCOPED_RECON
              ? await getClassProgress(user.uid, classIdParam, listId)
              : (await getOrCreateClassProgress(user.uid, classIdParam, listId)).progress;

            // [2] Persist the retake-rewind snapshot BEFORE completion — only when the doc exists. A
            // missing doc (near-impossible: concurrent reset) would make updateDoc throw → swallowed by
            // the catch below → completeSessionFromTest skipped → the day never completes. On null we skip
            // the persist and let completion self-create the doc (updateClassProgress has a setDoc path). #10
            if (progress) {
              const progressRef = doc(
                db,
                `users/${user.uid}/class_progress`,
                `${classIdParam}_${listId}`
              );

              const snapshot = {
                currentStudyDay: progress.currentStudyDay ?? null,
                totalWordsIntroduced: progress.totalWordsIntroduced ?? null,
                recentSessions: progress.recentSessions ?? null,
                stats: progress.stats ?? null,
                streakDays: progress.streakDays ?? null,
                lastStudyDate: progress.lastStudyDate ?? null,
                interventionLevel: progress.interventionLevel ?? null,
                // CS PR-3 · WI-1 (FORCED_PATHWAY): capture the review-mode bit so a retake-rewind
                // restores the review-mode context (the review outcome the retake replaces was
                // recorded under this bit). Absent when flag-off (byte-equivalent snapshot).
                ...(FORCED_PATHWAY ? { reviewMode: progress.reviewMode ?? null } : {}),
                snapshotCreatedAt: Timestamp.now(),
                snapshotDayNumber: sessionContext.dayNumber
              };

              await updateDoc(progressRef, {
                progressSnapshot: snapshot
              });

              console.log('[SNAPSHOT] Saved before completion:', {
                dayNumber: sessionContext.dayNumber,
                currentCSD: progress.currentStudyDay,
                currentTWI: progress.totalWordsIntroduced
              });
            }

            // [3] Complete session (CSD will increment)
            const completion = await completeSessionFromTest({
              userId: user.uid,
              classId: classIdParam,
              listId,
              dayNumber: sessionContext.dayNumber,
              isFirstDay: sessionContext.isFirstDay,
              testType: currentTestType,
              testResults: {
                score: summary.score,
                correct: summary.correct,
                total: summary.total,
                failed: summary.failed
              },
              // segment, interventionLevel, wordsIntroduced, wordsReviewed
              // are now read from sessionStorage in completeSessionFromTest
              // CS PR-3 · WI-1 (FORCED_PATHWAY): F3 engagement inputs for the hold-csd routing — the
              // answered count of THIS review (non-empty responses, the >=80% gate) + the review
              // attempt id (recordReviewOutcome idempotency). Passed only under the flag on a review
              // submit → flag-off the call is byte-identical to today.
              ...(FORCED_PATHWAY && currentTestType === 'review' ? {
                reviewAnswered: Object.values(responses).filter(r => String(r ?? '').trim() !== '').length,
                // FIX 3: thread a STABLE non-null idempotency key — fall back to the deterministic
                // attemptDocId (closure-captured; the exact id the attempt is written under) when
                // result.id is null, so recordReviewOutcome's whole-window scan never misses.
                reviewAttemptId: result?.id ?? attemptDocId
              } : {})
            })
            // Day-2+ gate: if this day's new-word test wasn't passed, the day does NOT
            // complete. Don't present as finished — block and require a retake.
            if (completion?.requiresNewWordRetake) {
              console.warn('completeSessionFromTest: day not complete — new-word retake required')
              setGradingError('이 날을 완료하려면 먼저 새 단어 시험을 통과해야 합니다.\n(Day not complete — pass the new-word test first.)')
              setIsSubmitting(false)
              return
            }
            // [Codex-P1-3 / P1r4-1] Day-guard rejection: the day counter advanced elsewhere
            // and this completion did NOT apply. The attempt itself is saved — do NOT
            // present the completion as success. sessionCleared distinguishes a clean
            // rebuild from a SURVIVING stale session doc (deletion failed twice — needs
            // reload/recovery, already escalated to system_logs as error).
            if (completion?.requiresSessionRebuild) {
              console.warn('completeSessionFromTest: day-guard rejection — session rebuild required', { sessionCleared: completion?.sessionCleared })
              setGradingError(completion?.sessionCleared
                ? '세션 정보가 갱신되었습니다. 답안은 저장되었으니, 학습 화면으로 돌아가 이어서 진행해 주세요.\n(Your session was refreshed — your answers are saved. Return to the study screen to continue.)'
                : '답안은 저장되었지만 세션을 초기화하지 못했습니다. 페이지를 새로고침해 주세요 — 문제가 반복되면 선생님께 알려 주세요.\n(Your answers are saved, but the session could not be reset. Please reload the page — tell your teacher if this repeats.)')
              setIsSubmitting(false)
              return
            }
            // [deepfix F-4] Evidence-free completion refused by the server (no passed new-word
            // anchor + not a review-only day) — or an unknown status (fail-closed). The attempt
            // is saved but the day did NOT complete: block the results screen and prompt to pass
            // the new-word test / retry, never present success.
            if (completion?.completionNotApplied) {
              console.warn('completeSessionFromTest: completion not applied — blocking success', { reason: completion?.reason })
              setGradingError('아직 이 날을 완료할 수 없습니다. 답안은 저장되었어요. 새 단어 시험을 통과했는지 확인한 뒤 다시 시도하거나, 문제가 계속되면 페이지를 새로고침해 주세요.\n(This day can\'t be completed yet — your answers are saved. Make sure the new-word test was passed, then retry; reload the page if this repeats.)')
              setIsSubmitting(false)
              return
            }
            console.log('Session completed successfully from TypedTest')
          } catch (completionErr) {
            console.error('Failed to complete session from test:', completionErr)
            // [deepfix P4 / persist C6-2 — DORMANT until the P6 rules cutoff] A permission-denied
            // completion is the legacy-write-cutoff signature (an old/flag-off bundle writing
            // class_progress after P6 denies it). Today's rules allow the owner write, so this
            // branch is unreachable — it ships now so the bundle that spans the cutoff already
            // carries the handler. On detection: emit the server-visible `legacy_write_denied`
            // event and BLOCK with a reload prompt (not the results screen) — the attempt is
            // saved, but nothing further will persist until the client reloads.
            if (completionErr?.code === 'permission-denied' || completionErr?.code === 'functions/permission-denied') {
              logSystemEvent('legacy_write_denied', {
                userId: user.uid, classId: classIdParam, listId,
                dayNumber: sessionContext?.dayNumber ?? null, testType: 'typed',
                errCode: completionErr?.code,
                errMessage: String(completionErr?.message || '').slice(0, 300),
              }, 'error')
              setGradingError('앱이 업데이트되었습니다. 답안은 저장되었으니, 페이지를 새로고침한 뒤 이어서 진행해 주세요.\n(The app was updated — your answers are saved. Please reload the page to continue.)')
              setIsSubmitting(false)
              return
            }
            // Don't fail the whole submit - attempt is already saved
          }
        }

        // Write + finalize succeeded — land on the results screen.
        finalizeResultsView()
        setIsSubmitting(false)
        } // end doWriteAndFinalize

        pendingSaveRef.current = null
        await doWriteAndFinalize()
        return
      }

      // Practice mode (no durable write): show results directly.
      finalizeResultsView()
    } catch (err) {
      console.error('All grading attempts failed:', err)
      // Phase 1 (#4): branch the message by error type instead of the old, misleading
      // "Your answers are saved" (no graded attempt exists when grading truly failed).
      // Deterministic → reloading rebuilds the payload (the real fix); transient → safe to retry.
      if (isDeterministicGradeError(err?.code)) {
        setGradingErrorKind('deterministic')
        setGradingError('We couldn\'t grade this submission. Please reload this page and submit again — your typed answers are kept.')
      } else {
        setGradingErrorKind('transient')
        setGradingError('We couldn\'t reach the grader. Your work is safe — tap Try Again. (If it keeps failing, reload the page and submit again.)')
      }
      // Don't clear responses or words - they're preserved for manual retry
    } finally {
      setIsSubmitting(false)
    }
  }

  // Manual retry function
  const handleRetryGrading = () => {
    setGradingError(null)
    handleSubmit() // Retry with preserved state
  }

  // Retry ONLY the durable write after a post-grade save failure. Re-invokes the
  // stashed doWriteAndFinalize closure — does NOT call handleSubmit, so grading
  // (the AI call) is never repeated. Idempotent on the stable attemptDocId.
  const handleRetrySave = () => {
    if (!pendingSaveRef.current) return
    setSubmitError(null)
    setIsSubmitting(true)
    pendingSaveRef.current()
  }

  const handleRetake = async () => {
    // For new word test retakes (below threshold), use existing logic
    if (currentTestType === 'new') {
      setResponses({})
      setFocusedIndex(0)
      setShowResults(false)
      setCanRetake(false)
      setTestResultsData(null)
      setResults(null)

      // Regenerate from original words - use configured test size, capped at MAX_TYPED_TEST_WORDS
      const shuffled = selectTestWords(originalWords, configuredTestSize)
      const cappedWords = shuffled.slice(0, MAX_TYPED_TEST_WORDS)
      setWords(cappedWords)
      inputRefs.current = new Array(cappedWords.length)
      return
    }

    // For review test retakes, restore from snapshot
    try {
      setRetakeError(null)

      const progressRef = doc(
        db,
        `users/${user.uid}/class_progress`,
        `${classIdParam}_${listId}`
      )

      // [1] Fetch current progress
      const progressSnap = await getDoc(progressRef)
      if (!progressSnap.exists()) {
        throw new Error('Progress document not found')
      }

      const progress = progressSnap.data()

      // [2] Validate snapshot exists
      if (!progress.progressSnapshot) {
        throw new Error('No snapshot found')
      }

      // [3] Validate correct day
      const expectedDay = sessionContext?.dayNumber
      if (progress.progressSnapshot.snapshotDayNumber !== expectedDay) {
        throw new Error(`Snapshot mismatch: expected day ${expectedDay}, got ${progress.progressSnapshot.snapshotDayNumber}`)
      }

      // [4] Validate recent (within 1 hour)
      const snapshotAge = Date.now() - progress.progressSnapshot.snapshotCreatedAt.toMillis()
      const ONE_HOUR = 3600000 // 1 hour in ms
      if (snapshotAge > ONE_HOUR) {
        throw new Error('Snapshot too old (>1 hour)')
      }

      console.log('[RETAKE] Snapshot validation passed:', {
        dayNumber: progress.progressSnapshot.snapshotDayNumber,
        age: `${Math.floor(snapshotAge / 1000)}s`,
        restoringCSD: progress.progressSnapshot.currentStudyDay,
        restoringTWI: progress.progressSnapshot.totalWordsIntroduced
      })

      // [5] Restore from snapshot
      const { snapshotCreatedAt, snapshotDayNumber, ...restoreData } = progress.progressSnapshot

      await updateDoc(progressRef, {
        currentStudyDay: restoreData.currentStudyDay,
        totalWordsIntroduced: restoreData.totalWordsIntroduced,
        recentSessions: restoreData.recentSessions,
        stats: restoreData.stats,
        streakDays: restoreData.streakDays,
        lastStudyDate: restoreData.lastStudyDate,
        interventionLevel: restoreData.interventionLevel,
        // CS PR-3 · WI-1 (FORCED_PATHWAY): rewind the review-mode bit alongside csd/twi/recentSessions
        // so the retake replays in the same review-mode context. Absent when flag-off (byte-equivalent).
        ...(FORCED_PATHWAY ? { reviewMode: restoreData.reviewMode ?? null } : {}),
        progressSnapshot: null, // Clear snapshot after restore
        updatedAt: Timestamp.now()
      })

      console.log('[RETAKE] Restored progress from snapshot')

      // [6] Navigate to retake (same test)
      navigate(`/typedtest/${classIdParam}/${listId}?type=review`, {
        state: {
          testConfig: sessionContext,
          returnPath
        }
      })

    } catch (error) {
      console.error('[RETAKE] Failed:', error)
      setRetakeError('Sorry, there has been an error. You cannot retake the review test.')
      setCanRetake(false)
    }
  }

  const answeredCount = Object.values(responses).filter((r) => r.trim() !== '').length


  if (isLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-muted">
        <Watermark />
        <div className="relative z-10">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    )
  }

  if (error && !showResults) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-muted px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">Something went wrong</p>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <Button variant="primary-blue" size="lg" onClick={loadTestWords} className="mt-6">
            Try Again
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate(-1)} className="mt-4">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  if (!words.length) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-muted px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">No Test Content</p>
          <p className="mt-3 text-sm text-text-muted">No words are available for this test right now. If you just finished a test, go back and continue from the dashboard.</p>
          <Button variant="outline" size="lg" onClick={() => navigate(-1)} className="mt-6">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  // Results Mode
  if (showResults && testResultsData && results) {
    const { stepNumber: resultsStepNumber, totalSteps: resultsTotalSteps, stepText: resultsStepText } = getSessionStep({
      testType: currentTestType,
      isFirstDay: sessionContext?.isFirstDay
    })

    const handleBackToSession = () => {
      if (returnPath) {
        navigate(returnPath, {
          state: {
            testCompleted: true,
            testType: currentTestType,
            results: testResultsData
          }
        })
      } else {
        navigate('/')
      }
    }

    const handleContinue = async () => {
      try {
        const progressRef = doc(
          db,
          `users/${user.uid}/class_progress`,
          `${classIdParam}_${listId}`
        )

        // Clear snapshot when student proceeds
        await updateDoc(progressRef, {
          progressSnapshot: null
        })

        console.log('[CONTINUE] Cleared snapshot')

        // Navigate to next session
        handleBackToSession()

      } catch (error) {
        console.error('[CONTINUE] Failed to clear snapshot:', error)
        // Non-critical - proceed anyway
        handleBackToSession()
      }
    }

    const score = testResultsData.score // Decimal 0-1
    const scorePercent = Math.round(score * 100) // For display
    const dayNumber = sessionContext?.dayNumber || 1

    // Render results card based on test type
    const renderResultsCard = () => {
      // New Word Test: Pass/Fail based on threshold
      if (currentTestType === 'new') {
        // C-23: trust the stored attempt's verdict when we have it (server-computed
        // against the class's real threshold). Only practice mode falls back to the
        // local compare, which fails OPEN on a non-finite threshold instead of
        // failing every score against an unresolved default.
        const passed = testResultsData.serverPassed
          ?? (Number.isFinite(retakeThreshold) ? score >= retakeThreshold : true)

        return (
          <div className={`rounded-2xl p-8 text-center shadow-xl ${
            passed
              ? 'bg-success ring-2 ring-ring-success'
              : 'bg-error ring-2 ring-ring-error'
          }`}>
            {/* Icon */}
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              passed ? 'bg-success-subtle' : 'bg-error-subtle border-2 border-white'
            }`}>
              {passed ? (
                <Trophy className="w-8 h-8 text-text-on-success" />
              ) : (
                <X className="w-8 h-8 text-text-on-error" />
              )}
            </div>

            {/* Header */}
            <h2 className={`text-xl font-bold ${passed ? 'text-text-on-success' : 'text-text-on-error'}`}>
              {passed ? `Completed Day ${dayNumber} session` : 'Did not pass'}
            </h2>

            {!passed && (
              <p className="mt-1 text-sm text-text-on-error-muted">
                Your score is below {Math.round(retakeThreshold * 100)}%
              </p>
            )}

            {/* Score */}
            <p className={`mt-4 text-4xl font-bold ${passed ? 'text-text-on-success' : 'text-text-on-error'}`}>
              {scorePercent}%
            </p>
            <p className={passed ? 'text-text-on-success-muted' : 'text-text-on-error-muted'}>
              {testResultsData.correct} of {testResultsData.total} correct
            </p>

            {/* Buttons */}
            <div className="mt-6">
              {passed ? (
                <Button
                  variant="primary-blue"
                  size="lg"
                  onClick={handleContinue}
                  className="inline-flex items-center gap-2"
                >
                  <LayoutGrid className="w-5 h-5" />
                  Continue
                </Button>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  {canRetake && (
                    <Button
                      variant="primary-blue"
                      size="lg"
                      onClick={handleRetake}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Loading...' : 'Try Again'}
                    </Button>
                  )}
                  {retakeError && (
                    <p className="text-sm text-text-on-error-muted">{retakeError}</p>
                  )}
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/')}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              )}
            </div>
          </div>
        )
      }

      // Review Test: 4-tier system
      const tier = scorePercent >= 85 ? 'excellent'
                 : scorePercent >= 70 ? 'good'
                 : scorePercent >= 50 ? 'needs-work'
                 : 'critical'

      const tierConfig = {
        excellent: {
          bg: 'bg-success ring-2 ring-ring-success',
          iconBg: 'bg-success-subtle',
          icon: <Trophy className="w-8 h-8 text-text-on-success" />,
          header: 'Great Work!',
          headerColor: 'text-text-on-success',
          subtext: "You're mastering these words",
          subtextColor: 'text-text-on-success-muted',
          scoreColor: 'text-text-on-success',
        },
        good: {
          bg: 'bg-warning ring-2 ring-ring-warning',
          iconBg: 'bg-warning-subtle',
          icon: <TrendingUp className="w-8 h-8 text-text-on-warning" />,
          header: 'Room for Improvement',
          headerColor: 'text-text-on-warning',
          subtext: 'Consider reviewing before moving on',
          subtextColor: 'text-text-on-warning-muted',
          scoreColor: 'text-text-on-warning',
        },
        'needs-work': {
          bg: 'bg-error ring-2 ring-ring-error',
          iconBg: 'bg-error-subtle border-2 border-white',
          icon: <X className="w-8 h-8 text-text-on-error" />,
          header: 'Keep Practicing',
          headerColor: 'text-text-on-error',
          subtext: 'Your score affects tomorrow\'s pacing',
          subtextColor: 'text-text-on-error-muted',
          scoreColor: 'text-text-on-error',
        },
        critical: {
          bg: 'bg-error-critical ring-2 ring-ring-error-critical',
          iconBg: 'bg-error-subtle',
          icon: <AlertTriangle className="w-8 h-8 text-white" />,
          header: 'Needs Attention',
          headerColor: 'text-white',
          subtext: 'Low scores significantly slow your progress',
          subtextColor: 'text-white/80',
          scoreColor: 'text-white',
        },
      }

      const config = tierConfig[tier]

      return (
        <div className={`rounded-2xl p-8 text-center shadow-xl ${config.bg}`}>
          {/* Icon */}
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${config.iconBg}`}>
            {config.icon}
          </div>

          {/* Header */}
          <h2 className={`text-xl font-bold ${config.headerColor}`}>
            {config.header}
          </h2>
          <p className={`mt-1 text-sm ${config.subtextColor}`}>
            {config.subtext}
          </p>

          {/* Score */}
          <p className={`mt-4 text-4xl font-bold ${config.scoreColor}`}>
            {scorePercent}%
          </p>
          <p className={config.subtextColor}>
            {testResultsData.correct} of {testResultsData.total} correct
          </p>

          {/* Buttons based on tier */}
          <div className="mt-6">
            <Button
              variant="primary"
              size="lg"
              onClick={handleContinue}
              className="inline-flex items-center gap-2"
            >
              <LayoutGrid className="w-5 h-5" />
              Continue
            </Button>
          </div>
        </div>
      )
    }

    return (
      <main className="relative flex min-h-screen flex-col bg-muted">
        <Watermark />

        <SessionHeader
          onBack={handleBackToSession}
          backAriaLabel="Back to session"
          stepText={resultsStepText}
          onStepClick={() => setShowProgressSheet(true)}
          rightSlot={<GreyedMenuIcon />}
          sessionTitle={currentTestType === 'new' ? 'New Words Test' : 'Review Test'}
          dayNumber={sessionContext?.dayNumber || 1}
        />

        {/* Scrollable content area */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            {/* Card 1: Results Summary */}
            {renderResultsCard()}

            {/* Card 2: Detailed results */}
            <TestResults
              testType="typed"
              listTitle={listDetails?.title}
              words={words}
              responses={responses}
              results={results}
              attemptId={attemptId}
            />
          </div>
        </div>

        {/* Session Progress Sheet */}
        <SessionProgressSheet
          isOpen={showProgressSheet}
          onClose={() => setShowProgressSheet(false)}
          currentPhase={currentTestType === 'new' ? 'new_word_test' : 'review_test'}
          isFirstDay={sessionContext?.isFirstDay}
        />
      </main>
    )
  }

  // Calculate step info for header pill
  const { stepText } = getSessionStep({
    testType: currentTestType,
    isFirstDay: sessionContext?.isFirstDay
  })
  const progressPercent = words.length > 0 ? (answeredCount / words.length) * 100 : 0
  const unansweredCount = words.length - answeredCount

  // Handle submit button click - show confirmation if there are unanswered questions
  const handleSubmitClick = () => {
    if (unansweredCount > 0) {
      setShowSubmitConfirm(true)
    } else {
      handleSubmit()
    }
  }

  // Test Mode
  return (
    <main className="relative flex min-h-screen flex-col bg-muted">
      <Watermark />

      {/* Sticky Header with session context + progress */}
      <SessionHeader
        ref={headerRef}
        onBack={() => setShowQuitConfirm(true)}
        backAriaLabel="Quit test"
        backDisabled={isSubmitting}
        stepText={stepText}
        onStepClick={() => setShowProgressSheet(true)}
        rightSlot={<GreyedMenuIcon />}
        // Session context
        sessionTitle={currentTestType === 'new' ? 'New Words Test' : 'Review Test'}
        dayNumber={sessionContext?.dayNumber || 1}
        // Progress bar
        progressPercent={progressPercent}
        progressLabel={`${answeredCount} of ${words.length} answered`}
      />

      {/* Session Progress Sheet */}
      <SessionProgressSheet
        isOpen={showProgressSheet}
        onClose={() => setShowProgressSheet(false)}
        currentPhase={sessionContext?.phase === 'new' ? 'new_word_test' : 'review_test'}
        isFirstDay={sessionContext?.isFirstDay}
        dayNumber={sessionContext?.dayNumber || 1}
        wordRangeStart={sessionContext?.wordRangeStart}
        wordRangeEnd={sessionContext?.wordRangeEnd}
      />

      {/* Main Content Area */}
      <div ref={contentRef} className="relative z-10 flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <div className="mx-auto max-w-4xl">
          {/* Practice Mode Banner */}
          {isPracticeMode && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-center dark:bg-amber-900/20 dark:border-amber-800">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Practice Mode — This attempt won't be recorded
              </p>
            </div>
          )}

          {/* Words List */}
          <div className="space-y-4">
            {words.map((word, index) => (
              <div
                key={word.id}
                ref={(el) => (questionRefs.current[index] = el)}
                className="flex flex-col gap-2 rounded-xl bg-surface p-4 shadow-sm ring-1 ring-border-default"
                style={{ opacity: questionOpacities[index] ?? 1 }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex w-8 shrink-0 items-center justify-center text-sm font-semibold text-text-secondary">
                    {index + 1}.
                  </span>
                  <span className="font-medium text-text-primary">{word.word}</span>
                  {word.partOfSpeech && (
                    <span className="text-sm italic text-text-muted">({word.partOfSpeech})</span>
                  )}
                </div>
                <input
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  value={responses[word.id] || ''}
                  onChange={(e) =>
                    setResponses((prev) => ({
                      ...prev,
                      [word.id]: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onFocus={() => setFocusedIndex(index)}
                  placeholder="Type your definition..."
                  disabled={isSubmitting || results !== null}
                  className="ml-11 rounded-lg border border-border-default bg-muted px-4 py-3 text-text-primary outline-none ring-border-strong transition focus:bg-surface focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Footer with Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 px-4 py-4">
        <div className="mx-auto max-w-4xl flex justify-center">
          <Button
            variant="primary-blue"
            size="lg"
            onClick={handleSubmitClick}
            disabled={isSubmitting || answeredCount === 0}
          >
            {isSubmitting ? 'Grading...' : 'Submit Test'}
          </Button>
        </div>
      </div>

      {/* Quit Confirmation Modal */}
      <ConfirmModal
        isOpen={showQuitConfirm}
        title="Quit Test?"
        message="Are you sure you want to quit? All progress on this test will be lost."
        confirmLabel="Quit"
        cancelLabel="Continue Test"
        onConfirm={handleQuitConfirm}
        onCancel={() => setShowQuitConfirm(false)}
        variant="danger"
      />

      {/* Submit Confirmation Modal */}
      <ConfirmModal
        isOpen={showSubmitConfirm}
        title="Submit Test?"
        message={unansweredCount > 0
          ? `Are you sure you want to submit? There ${unansweredCount === 1 ? 'is' : 'are'} ${unansweredCount} question${unansweredCount === 1 ? '' : 's'} you still have not answered.`
          : 'Are you sure you want to submit your answers?'}
        confirmLabel="Submit"
        cancelLabel="Go Back"
        onConfirm={() => {
          setShowSubmitConfirm(false)
          handleSubmit()
        }}
        onCancel={() => setShowSubmitConfirm(false)}
        variant="warning"
      />

      {/* Recovery Prompt Modal */}
      <ConfirmModal
        isOpen={showRecoveryPrompt}
        title="Resume Previous Test?"
        message={`You have an unfinished test from ${recoveryTimeRemaining || 'a few'} minutes ago. Would you like to resume where you left off?`}
        confirmLabel="Resume"
        cancelLabel="Start Fresh"
        onConfirm={handleRecoveryResume}
        onCancel={handleRecoveryStartFresh}
        variant="info"
      />

      {/* Submission Overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}>
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4">
            <div className="text-center">
              {retryAttempt === 0 ? (
                <>
                  <h3 className="text-xl font-bold text-gray-800 mb-4">
                    Grading Your Test...
                  </h3>
                  <div className="flex justify-center mb-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    Please wait while we grade your answers with AI.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex justify-center mb-4">
                    <AlertTriangle className="text-yellow-500 h-12 w-12" />
                  </div>
                  <h3 className="text-xl font-bold text-yellow-700 mb-4">
                    Connection Issue
                  </h3>
                  <p className="text-sm text-yellow-600 mb-2">
                    Retrying in 10 seconds...
                  </p>
                  <p className="text-xs text-gray-500">
                    (Attempt {retryAttempt}/3)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Write-failure modal: grading succeeded but the durable save failed. Standalone
          (NOT nested in the isSubmitting modal — that was the bug that hid it) so it
          actually renders. "Retry Save" re-runs the write only, never re-grades. */}
      {submitError && !isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}>
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="text-yellow-500 h-12 w-12" />
              </div>
              <h3 className="text-xl font-bold text-yellow-700 mb-4">
                Couldn&apos;t Save Your Results
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                {submitError} Your answers are safe — this only retries saving (it won&apos;t re-grade).
              </p>
              <button
                onClick={handleRetrySave}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Retry Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grading Error with Manual Retry */}
      {gradingError && !isSubmitting && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}>
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="text-red-500 h-12 w-12" />
              </div>
              <h3 className="text-xl font-bold text-red-700 mb-4">
                {gradingErrorKind === 'deterministic' ? 'Couldn’t Grade — Please Reload' : 'Grading Didn’t Go Through'}
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                {gradingError}
              </p>
              {gradingErrorKind === 'deterministic' ? (
                // Re-submitting the same payload repeats the failure (Codex #5) — reload rebuilds it.
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Reload Page
                </button>
              ) : (
                <button
                  onClick={handleRetryGrading}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default TypedTest

