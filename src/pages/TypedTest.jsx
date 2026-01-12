import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, Timestamp, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import { submitTypedTestAttempt, withRetry } from '../services/db'
import { useSimulationContext, isSimulationEnabled } from '../hooks/useSimulation.jsx'
import {
  initializeDailySession,
  getNewWords,
  getSegmentWords,
  processTestResults,
  selectTestWords,
  completeSessionFromTest
} from '../services/studyService'
import { getOrCreateClassProgress } from '../services/progressService'
import { STUDY_ALGORITHM_CONSTANTS, shuffleArray } from '../utils/studyAlgorithm'
import {
  getTestId,
  saveTestState,
  getTestState,
  clearTestState,
  getRecoveryTimeRemaining,
  markIntentionalExit,
  wasIntentionalExit,
  clearIntentionalExitFlag
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
        setRetakeThreshold(testConfig.passThresholdDecimal)
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
        // Apply assignment settings if provided
        if (assignmentSettings) {
          setRetakeThreshold((assignmentSettings.passThreshold || 95) / 100)
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
          const newWords = await getNewWords(listId, config.newWordStartIndex, config.newWordCount)
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
          const segmentWords = await getSegmentWords(
            user.uid,
            listId,
            config.segment.startIndex,
            config.segment.endIndex
          )
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
      setResponses(savedRecoveryState.answers)
      if (savedRecoveryState.currentIndex !== undefined) {
        setFocusedIndex(savedRecoveryState.currentIndex)
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

  // AI grading with retry logic
  const gradeWithRetry = async (answersToGrade) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY_MS = 10000  // 10 seconds
    const TIMEOUT_MS = 90000      // 90 seconds per attempt

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const functions = getFunctions()
        const gradeTypedTest = httpsCallable(functions, 'gradeTypedTest', {
          timeout: TIMEOUT_MS
        })

        const result = await gradeTypedTest({ answers: answersToGrade })
        return result  // Success!

      } catch (error) {
        console.error(`Grading attempt ${attempt}/${MAX_RETRIES} failed:`, error)

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
      // Clear saved test state
      clearTestState(testId)

      // Prepare answers for grading
      const answersToGrade = words.map((word) => ({
        wordId: word.id,
        word: word.word,
        correctDefinition: word.definition,
        koreanDefinition: word.definitions?.ko || '',
        studentResponse: responses[word.id] || '',
      }))

      // Call Cloud Function for AI grading with retry logic
      const gradingResult = await gradeWithRetry(answersToGrade)

      // Build results array for processTestResults
      const resultsArray = gradingResult.data.results.map(r => ({
        wordId: r.wordId,
        correct: r.isCorrect
      }))

      // Process test results (updates word statuses) - skip if practice mode
      let summary
      if (isPracticeMode) {
        // Calculate score locally without saving
        const correct = resultsArray.filter(r => r.correct).length
        summary = {
          score: correct / resultsArray.length,
          correct,
          total: resultsArray.length,
          failed: resultsArray.filter(r => !r.correct).map(r => r.wordId)
        }
      } else {
        summary = await processTestResults(user.uid, resultsArray, listId)

        // Determine if student passed (review tests always pass)
        const passed = currentTestType === 'review' ? true : summary.score >= retakeThreshold

        // Get studyDay from sessionContext, or fetch from progress if standalone test
        let studyDay = sessionContext?.dayNumber
        if (!studyDay && user?.uid && classIdParam && listId) {
          try {
            const { progress } = await getOrCreateClassProgress(user.uid, classIdParam, listId)
            // For standalone tests (retakes, direct navigation), use currentStudyDay as-is
            // DO NOT increment - only DailySessionFlow increments via sessionContext
            studyDay = progress.currentStudyDay || 0
          } catch (err) {
            console.error('Failed to fetch studyDay from progress:', err)
          }
        }

        // GATE: Attempt MUST succeed before any progression
        // Uses retry with exponential backoff for transient failures
        let result
        try {
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
              sessionContext
            ),
            { maxRetries: 3, totalTimeoutMs: 15000 },
            { userId: user.uid, classId: classIdParam, listId, studyDay, sessionType: currentTestType }
          )
        } catch (submitErr) {
          // Attempt failed after retries - block progression, stay on page
          console.error('Failed to save test attempt:', submitErr)
          setSubmitError('Failed to save your test results. Please try again.')
          setIsSubmitting(false)
          return // Don't proceed - answers preserved in state
        }

        setAttemptId(result.id)

        // Determine if this is the final test of the session
        const isSessionFinalTest = sessionContext?.isFirstDay
          ? currentTestType === 'new'      // Day 1: new test is only test
          : currentTestType === 'review'   // Day 2+: review test is last

        // Complete session at submission time (before navigation) to prevent state loss
        if (passed && isSessionFinalTest && sessionContext?.dayNumber) {
          try {
            // [1] Fetch current progress
            const { progress } = await getOrCreateClassProgress(
              user.uid,
              classIdParam,
              listId
            );

            // [2] Take snapshot BEFORE completion
            const progressRef = doc(
              db,
              `users/${user.uid}/class_progress`,
              `${classIdParam}_${listId}`
            );

            const snapshot = {
              currentStudyDay: progress.currentStudyDay,
              totalWordsIntroduced: progress.totalWordsIntroduced,
              recentSessions: progress.recentSessions,
              stats: progress.stats,
              streakDays: progress.streakDays,
              lastStudyDate: progress.lastStudyDate,
              interventionLevel: progress.interventionLevel,
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

            // [3] Complete session (CSD will increment)
            await completeSessionFromTest({
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
              }
              // segment, interventionLevel, wordsIntroduced, wordsReviewed
              // are now read from sessionStorage in completeSessionFromTest
            })
            console.log('Session completed successfully from TypedTest')
          } catch (completionErr) {
            console.error('Failed to complete session from test:', completionErr)
            // Don't fail the whole submit - attempt is already saved
          }
        }
      }

      // Check if retake available
      if (currentTestType === 'new' && summary.score < retakeThreshold) {
        setCanRetake(true)
      }

      // Store for display
      setTestResultsData({
        score: summary.score, // Store as decimal (0-1), not percentage
        correct: summary.correct,
        total: summary.total,
        failed: summary.failed,
        gradedResults: gradingResult.data.results, // Include detailed grading for review
        testType: currentTestType
      })

      setResults(gradingResult.data.results)
      setShowResults(true)
    } catch (err) {
      console.error('All grading attempts failed:', err)
      setGradingError('Failed to grade test after 3 attempts. Your answers are saved.')
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
        progressSnapshot: null, // Clear snapshot after restore
        updatedAt: Timestamp.now()
      })

      console.log('[RETAKE] Restored progress from snapshot')

      // [6] Navigate to retake (same test)
      navigate(`/typed-test/${classIdParam}/${listId}?type=review`, {
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
          <p className="mt-3 text-sm text-text-muted">Your teacher hasn't assigned enough words yet.</p>
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
        const passed = score >= retakeThreshold

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
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/')}
                >
                  Go to Dashboard
                </Button>
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

              {submitError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-semibold mb-3">{submitError}</p>
                  <button
                    onClick={handleSubmit}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Retry Submission
                  </button>
                </div>
              )}
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
                Grading Failed
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                {gradingError}
              </p>
              <button
                onClick={handleRetryGrading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default TypedTest

