import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, Timestamp, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import { submitTestAttempt, withRetry, logSystemEvent, getNewWordAttemptForDay } from '../services/db'
import { SERVER_ATTEMPT_WRITE, LIST_SCOPED_RECON } from '../config/featureFlags'
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
import { speak } from '../utils/tts'
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
import SessionHeader, { GreyedMenuIcon } from '../components/SessionHeader.jsx'
import SessionProgressSheet from '../components/SessionProgressSheet.jsx'
import { Button } from '../components/ui'
import { Trophy, X, LayoutGrid, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { getSessionStep } from '../utils/sessionStepTracker'

const MCQTest = () => {
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
  const [testWords, setTestWords] = useState([])
  const [originalWords, setOriginalWords] = useState([])
  const [answers, setAnswers] = useState({})
  const answersRef = useRef({})  // Sync copy to avoid race condition on submit
  // Tracks whether processTestResults has already committed for this mount, so
  // a Try-Again click after a transient failure does not re-increment
  // timesTestedTotal on every retry. (Refresh-then-retry still re-runs it; see
  // audit_findings_persistence.md for the follow-up.)
  const resultsProcessedRef = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState(null)
  const [testResultsData, setTestResultsData] = useState(null)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [attemptId, setAttemptId] = useState(null)
  const [currentTestType, setCurrentTestType] = useState(testTypeParam)
  const [canRetake, setCanRetake] = useState(false)
  const [retakeThreshold, setRetakeThreshold] = useState(0.95)
  const [retakeError, setRetakeError] = useState(null)
  const [optionsCount, setOptionsCount] = useState(4)
  const [showResults, setShowResults] = useState(false)
  const [configuredTestSize, setConfiguredTestSize] = useState(30)

  // Modal states
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const [savedRecoveryState, setSavedRecoveryState] = useState(null)
  const [recoveryTimeRemaining, setRecoveryTimeRemaining] = useState(null)
  const [showProgressSheet, setShowProgressSheet] = useState(false)

  // Practice mode (after passing, test doesn't save)
  const [isPracticeMode] = useState(practiceMode)

  // Test ID for recovery
  const testId = getTestId(classIdParam || classId, listId, currentTestType)

  // Simulation mode integration
  const sim = useSimulationContext()
  const autoAnswerTimerRef = useRef(null)

  // Auto-answer effect for simulation mode
  useEffect(() => {
    if (!sim?.isAutoMode || !isSimulationEnabled()) return
    if (loading || showResults || submitting) return
    if (testWords.length === 0) return

    const currentWord = testWords[currentIndex]
    if (!currentWord || answers[currentWord.id]) return // Already answered

    // Find the correct answer index
    const correctIndex = currentWord.options.findIndex(opt => opt.isCorrect)

    // Get auto-answer based on simulation profile accuracy
    const selectedIndex = sim.getAutoAnswer(correctIndex, currentWord.options.length)
    const selectedOption = currentWord.options[selectedIndex]

    // Delay based on simulation speed
    const delay = sim.speed?.testDelay ?? 100

    autoAnswerTimerRef.current = setTimeout(() => {
      // Select the answer
      handleAnswerSelect(currentWord.id, selectedOption)

      // Move to next question or submit
      if (currentIndex < testWords.length - 1) {
        setCurrentIndex(prev => prev + 1)
      } else {
        // All questions answered, auto-submit
        setTimeout(() => {
          handleSubmit()
        }, delay)
      }
    }, delay)

    return () => clearTimeout(autoAnswerTimerRef.current)
  }, [sim?.isAutoMode, currentIndex, testWords, answers, loading, showResults, submitting])

  // Browser close warning + intentional exit tracking
  useEffect(() => {
    // Warn if: answers exist AND (not submitted OR submit failed)
    const hasProgress = Object.keys(answers).length > 0 && (!showResults || submitError)

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
  }, [answers, showResults, submitError, testId])

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

  const generateQuestions = (words, numOptions = null) => {
    const effectiveOptionsCount = numOptions ?? optionsCount
    const testWordsWithOptions = words.map(word => {
      const otherWords = originalWords.length > 0
        ? originalWords.filter(w => w.id !== word.id)
        : words.filter(w => w.id !== word.id)
      const shuffledOthers = shuffleArray(otherWords)
      // Use optionsCount from assignment (optionsCount - 1 distractors + 1 correct = optionsCount total)
      const distractors = shuffledOthers.slice(0, effectiveOptionsCount - 1).map(w => ({
        wordId: w.id,
        definition: w.definition,
        isCorrect: false
      }))

      const options = shuffleArray([
        { wordId: word.id, definition: word.definition, isCorrect: true },
        ...distractors
      ])

      return {
        ...word,
        options
      }
    })

    setTestWords(testWordsWithOptions)
    setCurrentIndex(0)
    setAnswers({})
    answersRef.current = {}
    setShowResults(false)
    setCanRetake(false)
  }

  const loadTestWords = useCallback(async () => {
    if (!user?.uid || !listId) return
    setLoading(true)
    setError('')
    try {
      // PATH A: TestConfig provided (from DailySessionFlow with new flow)
      if (testConfig) {
        // All settings come from testConfig - no need to fetch or apply manually
        setOptionsCount(testConfig.testOptionsCount)
        // C-23 fail-open: only adopt a finite threshold. Setting undefined/NaN would
        // make every `score >= retakeThreshold` compare false (fail-closed verdicts).
        if (Number.isFinite(testConfig.passThresholdDecimal)) {
          setRetakeThreshold(testConfig.passThresholdDecimal)
        }
        setCurrentTestType(testConfig.testType)
        const effectiveTestSize = testConfig.testType === 'new' ? testConfig.testSizeNew : testConfig.testSizeReview
        setConfiguredTestSize(effectiveTestSize)
        setOriginalWords(testConfig.originalWordPool)
        generateQuestions(testConfig.wordsToTest, testConfig.testOptionsCount)
        setLoading(false)
        return
      }

      // PATH B: Legacy wordPool provided (backwards compatibility)
      if (wordPool && wordPool.length > 0) {
        // Apply assignment settings if provided
        const numOptions = assignmentSettings?.testOptionsCount || 4
        setOptionsCount(numOptions)
        // Resolve the pass threshold from the class doc when navigation state lacks
        // it (see TypedTest PATH B note: prevents the false "below 95%" label and a
        // UI fail-verdict that contradicts the server's pass for 92–94% scorers).
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
        setOriginalWords(wordPool)
        generateQuestions(wordPool, numOptions)
        setLoading(false)
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
      // Set MCQ options count from assignment
      setOptionsCount(assignment.testOptionsCount || 4)

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
          // P9 · CYC (§3f): config.cyclingActive routes a cycling day's VIRTUAL range through
          // the resolver (wraps at the lap boundary). Under cycling newWordCount === pace > 0,
          // so the legacy "finished list" throw below becomes unreachable — the lap-aware
          // outcome. Flag-off → cyclingActive falsy → today's legacy filter + throw exactly.
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

      setOriginalWords(wordsToTest)
      generateQuestions(wordsToTest)
    } catch (err) {
      setError(err.message || 'Failed to load test')
    } finally {
      setLoading(false)
    }
  }, [user?.uid, listId, classIdParam, currentTestType, wordPool, testConfig])

  useEffect(() => {
    loadTestWords()
  }, [loadTestWords])

  // Check for recoverable state on mount
  useEffect(() => {
    if (!testId || loading) return

    const saved = getTestState(testId)
    if (saved && Object.keys(saved.answers || {}).length > 0) {
      if (wasIntentionalExit(testId)) {
        clearTestState(testId)
        return
      }
      setSavedRecoveryState(saved)
      setRecoveryTimeRemaining(getRecoveryTimeRemaining(testId))
      setShowRecoveryPrompt(true)
    }
  }, [testId, loading])

  // Save test state on each answer (for recovery)
  useEffect(() => {
    if (!testId || testWords.length === 0 || showResults) return

    const wordIds = testWords.map(w => w.id)
    if (Object.keys(answers).length > 0) {
      saveTestState(testId, answers, wordIds, currentIndex)
    }
  }, [answers, testId, testWords, currentIndex, showResults])

  // Handle recovery - restore saved answers
  const handleRecoveryResume = () => {
    // Clear any stale intentional exit flag
    clearIntentionalExitFlag(testId)
    if (savedRecoveryState?.answers) {
      setAnswers(savedRecoveryState.answers)
      answersRef.current = { ...savedRecoveryState.answers }
      if (savedRecoveryState.currentIndex !== undefined) {
        setCurrentIndex(savedRecoveryState.currentIndex)
      }
    }
    setShowRecoveryPrompt(false)
    setSavedRecoveryState(null)
  }

  // Handle recovery - start fresh
  const handleRecoveryStartFresh = () => {
    clearTestState(testId)
    setShowRecoveryPrompt(false)
    setSavedRecoveryState(null)
  }

  const handleAnswerSelect = (wordId, option) => {
    // Update ref synchronously (for reliable submit)
    answersRef.current[wordId] = option
    // Update state for UI
    setAnswers((prev) => ({
      ...prev,
      [wordId]: option,
    }))

    // Auto-advance to next question (unless on last question)
    if (currentIndex < testWords.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }

  // Navigation functions
  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const goToNext = () => {
    if (currentIndex < testWords.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showResults || submitting) return
      if (e.key === 'ArrowLeft') {
        goToPrev()
      } else if (e.key === 'ArrowRight') {
        goToNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, testWords.length, showResults, submitting])

  const handleSubmit = async () => {
    if (submitting || !user?.uid || !listId) return

    setSubmitting(true)
    setError('')
    setSubmitError(null)

    try {
      // Build results array (read from ref for sync access).
      // NOTE: localStorage recovery is intentionally NOT cleared here. We only
      // clear after the attempt doc AND study_states writes both succeed —
      // otherwise a transient failure mid-submit loses the student's answers
      // on refresh.
      const currentAnswers = answersRef.current
      const results = testWords.map((word) => {
        const selectedOption = currentAnswers[word.id]
        return {
          wordId: word.id,
          correct: selectedOption?.isCorrect || false
        }
      })

      // DEBUG: Log all results to find the mismatch
      console.log('DEBUG MCQ Results:', {
        testWordsCount: testWords.length,
        answersCount: Object.keys(currentAnswers).length,
        results: results.map((r, i) => ({
          index: i + 1,
          wordId: r.wordId,
          correct: r.correct,
          hasAnswer: !!currentAnswers[r.wordId],
          answerIsCorrect: currentAnswers[r.wordId]?.isCorrect
        }))
      })

      if (results.length === 0) {
        setError('Please answer at least one question before submitting.')
        setSubmitting(false)
        return
      }

      // Summarize locally first — pure computation, no I/O. The same numbers
      // processTestResults would have returned, computed without touching
      // study_states yet.
      const correctCount = results.filter(r => r.correct).length
      const failedIds = results.filter(r => !r.correct).map(r => r.wordId)
      const summary = {
        score: correctCount / results.length,
        correct: correctCount,
        total: results.length,
        failed: failedIds
      }

      // Calculate score
      const score = summary.score
      const percentage = Math.round(score * 100)

      // Check if retake is available (new word test below threshold)
      if (currentTestType === 'new' && score < retakeThreshold) {
        setCanRetake(true)
      }

      // Store results for display
      const answerArray = Object.entries(answers).map(([wordId, option]) => {
        const testWord = testWords.find((w) => w.id === wordId)
        return {
          wordId,
          word: testWord?.word || '',
          correctAnswer: testWord?.definition || '',
          studentResponse: option?.definition || '',
          isCorrect: option?.isCorrect || false,
        }
      })

      // Determine if student passed (review tests always pass)
      const passed = currentTestType === 'review' ? true : summary.score >= retakeThreshold

      // C-23: authoritative verdict of the STORED attempt (server-computed under
      // SERVER_ATTEMPT_WRITE, the client-written doc's own value otherwise). Stays
      // null in practice mode — the result card then falls back to the local compare.
      let serverPassed = null

      // Submit attempt for gradebook (non-practice mode only)
      if (!isPracticeMode) {
        // Get studyDay from sessionContext, or fetch from progress if standalone test
        console.log('[DEBUG STUDYDAY] Before determining studyDay:', {
          sessionContextExists: !!sessionContext,
          sessionContextDayNumber: sessionContext?.dayNumber,
          currentStudyDay: 'will fetch if needed'
        });

        let studyDay = sessionContext?.dayNumber
        if (!studyDay && user?.uid && classIdParam && listId) {
          try {
            const { progress } = await getOrCreateClassProgress(user.uid, classIdParam, listId)
            const csd = progress.currentStudyDay || 0
            if (currentTestType === 'new') {
              // A new-word test always concerns the in-progress day.
              studyDay = csd + 1
            } else {
              // Review: if the in-progress day's new test is passed, this review
              // belongs to it (stamping the previous day would make the day
              // impossible to complete); otherwise it's a retake of the completed day.
              const nextDayNew = await getNewWordAttemptForDay(user.uid, classIdParam, listId, csd + 1)
              studyDay = (nextDayNew && nextDayNew.passed === true) ? csd + 1 : csd
            }
            logSystemEvent('attempt_day_fallback', {
              testType: currentTestType, stamped: studyDay, csd,
              classId: classIdParam, listId
            })
            console.log('[DEBUG STUDYDAY] Using derived fallback:', {
              progressCurrentStudyDay: csd,
              calculatedStudyDay: studyDay
            });
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
                  testType: 'mcq', errCode: err?.code, errMessage: String(err?.message || '').slice(0, 300),
                }, 'error')
              }
              setSubmitError('진행 정보를 불러오지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요. (Couldn\'t load your progress — please reload the page and try again.)')
              setSubmitting(false)
              return
            }
            console.error('Failed to derive studyDay from progress:', err)
          }
        } else {
          console.log('[DEBUG STUDYDAY] Using sessionContext:', {
            studyDay
          });
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

        console.log('[DEBUG STUDYDAY] Final studyDay for attempt:', studyDay);

        // [PHASE 1] Write the attempt doc FIRST.
        // - Idempotent docId from a per-session nonce so withRetry / Try-Again
        //   overwrites the same doc instead of producing duplicates.
        // - study_state mutations (processTestResults) intentionally happen
        //   AFTER this succeeds, so a failed submit cannot leave word stats
        //   ahead of the gradebook (the audit's split-brain bug).
        console.log('[SUBMIT] ═══════════════════════════════════════')
        console.log('[SUBMIT] Starting test submission with retry logic')
        const attemptNonce = getOrCreateAttemptNonce(testId)
        const attemptDocId = `${user.uid}_${testId}_${attemptNonce}`
        console.log('[SUBMIT] Test data:', {
          userId: user.uid,
          testId,
          attemptDocId,
          answerCount: answerArray.length,
          totalQuestions: testWords.length,
          studyDay,
          sessionType: currentTestType,
          passed
        })

        let result
        try {
          if (SERVER_ATTEMPT_WRITE) {
            // Durable write via Cloud Function (server scores against totalQuestions —
            // skipped count as incorrect — and persists transactionally + idempotently).
            const context = {
              studentId: user.uid, classId: classIdParam, listId, testId,
              studyDay: studyDay || null, sessionType: currentTestType, testType: 'mcq',
              attemptDocId, totalQuestions: testWords.length,
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
            const resp = await withRetry(
              () => submitVocabAttempt({ testType: 'mcq', context, attemptAnswers: answerArray }),
              { maxRetries: 3, totalTimeoutMs: 15000 },
              { userId: user.uid, classId: classIdParam, listId, studyDay, sessionType: currentTestType }
            )
            result = { id: resp.data.attemptId }
            // C-23: surface the server's verdict (returned on fresh AND idempotent writes)
            // so the result card renders the stored truth, not a client recompute.
            serverPassed = typeof resp.data.passed === 'boolean' ? resp.data.passed : null
          } else {
            result = await withRetry(
              () => submitTestAttempt(
                user.uid,
                testId,
                answerArray,
                testWords.length,
                classIdParam,
                listId,
                'mcq',
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

          console.log('[SUBMIT] ✓ Submission completed successfully, attempt ID:', result.id)
        } catch (submitErr) {
          // Attempt failed after retries — block progression, stay on page.
          // localStorage recovery is still intact (we never cleared it),
          // and study_states have NOT been mutated, so a refresh-then-retry
          // is safe.
          console.error('[SUBMIT] ✗ Submission failed after all retries:', submitErr)
          console.log('[SUBMIT] Error details:', {
            message: submitErr.message,
            code: submitErr.code,
            name: submitErr.name
          })

          // Observability: non-transient write failures bypass withRetry's log; record
          // them here so durable-write failures aren't invisible. Distinct event name so
          // it doesn't double-count withRetry's `attempt_write_failed`.
          logSystemEvent('attempt_write_failed_client', {
            userId: user.uid, classId: classIdParam, listId,
            studyDay: studyDay ?? null, sessionType: currentTestType, testType: 'mcq',
            errCode: submitErr?.code || null, errName: submitErr?.name || null,
            errMessage: String(submitErr?.message || '').slice(0, 300),
          }, 'error')

          setSubmitError('Failed to save your test results. Please try again.')
          setSubmitting(false)
          console.log('[SUBMIT] ═══════════════════════════════════════')
          return // Don't proceed - answers preserved in state and localStorage
        }

        setAttemptId(result.id)
        console.log('[SUBMIT] Set attempt ID:', result.id)

        // [PHASE 2] Now that the attempt is durable, commit study_state
        // mutations. Guard with a ref so a Try-Again click after a partial
        // failure within the same mount does not double-increment counters.
        if (!resultsProcessedRef.current) {
          try {
            await processTestResults(user.uid, results, listId)
            resultsProcessedRef.current = true
            console.log('[SUBMIT] ✓ Study states updated')
          } catch (processErr) {
            // Don't fail the whole submit — the attempt is saved.
            // Reconciliation in progressService uses attempts as the
            // authoritative anchor; study_states can be repaired later.
            console.error('[SUBMIT] processTestResults failed after attempt write:', processErr)
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
              }
              // segment, interventionLevel, wordsIntroduced, wordsReviewed
              // are now read from sessionStorage in completeSessionFromTest
            })
            // Day-2+ gate: if this day's new-word test wasn't passed, the day does NOT
            // complete. Don't present as finished — block and require a retake.
            if (completion?.requiresNewWordRetake) {
              console.warn('completeSessionFromTest: day not complete — new-word retake required')
              setSubmitError('이 날을 완료하려면 먼저 새 단어 시험을 통과해야 합니다. (Day not complete — pass the new-word test first.)')
              return
            }
            // [Codex-P1-3 / P1r4-1] Day-guard rejection: the day counter advanced elsewhere
            // and this completion did NOT apply. The attempt itself is saved — do NOT
            // present the completion as success. sessionCleared distinguishes a clean
            // rebuild from a SURVIVING stale session doc (deletion failed twice — needs
            // reload/recovery, already escalated to system_logs as error).
            if (completion?.requiresSessionRebuild) {
              console.warn('completeSessionFromTest: day-guard rejection — session rebuild required', { sessionCleared: completion?.sessionCleared })
              setSubmitError(completion?.sessionCleared
                ? '세션 정보가 갱신되었습니다. 답안은 저장되었으니, 학습 화면으로 돌아가 이어서 진행해 주세요. (Your session was refreshed — your answers are saved. Return to the study screen to continue.)'
                : '답안은 저장되었지만 세션을 초기화하지 못했습니다. 페이지를 새로고침해 주세요 — 문제가 반복되면 선생님께 알려 주세요. (Your answers are saved, but the session could not be reset. Please reload the page — tell your teacher if this repeats.)')
              return
            }
            // [deepfix F-4] Evidence-free completion refused by the server (no passed new-word
            // anchor + not a review-only day) — or an unknown status (fail-closed). The attempt
            // is saved but the day did NOT complete: block success and prompt to pass the
            // new-word test / retry, never present success.
            if (completion?.completionNotApplied) {
              console.warn('completeSessionFromTest: completion not applied — blocking success', { reason: completion?.reason })
              setSubmitError('아직 이 날을 완료할 수 없습니다. 답안은 저장되었어요. 새 단어 시험을 통과했는지 확인한 뒤 다시 시도하거나, 문제가 계속되면 페이지를 새로고침해 주세요. (This day can\'t be completed yet — your answers are saved. Make sure the new-word test was passed, then retry; reload the page if this repeats.)')
              return
            }
            console.log('Session completed successfully from MCQTest')
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
                dayNumber: sessionContext?.dayNumber ?? null, testType: 'mcq',
                errCode: completionErr?.code,
                errMessage: String(completionErr?.message || '').slice(0, 300),
              }, 'error')
              setSubmitError('앱이 업데이트되었습니다. 답안은 저장되었으니, 페이지를 새로고침한 뒤 이어서 진행해 주세요. (The app was updated — your answers are saved. Please reload the page to continue.)')
              return
            }
            // Don't fail the whole submit - attempt is already saved
          }
        }
      }

      // Safe to drop local recovery now: attempt is persisted (idempotent ID),
      // study_states are committed (or will be repaired via reconciliation if
      // processTestResults failed). Also rolls over the per-session nonce so
      // the next test launch gets a fresh attempt docId.
      clearTestState(testId)

      setTestResultsData({
        score: summary.score, // Store as decimal (0-1), not percentage
        correct: summary.correct,
        total: summary.total,
        failed: summary.failed,
        testType: currentTestType,
        answerArray,
        serverPassed // C-23: authoritative stored verdict (null in practice mode)
      })

      console.log('[SUBMIT] Showing test results to user')
      console.log('[SUBMIT] ═══════════════════════════════════════')
      setShowResults(true)
    } catch (err) {
      console.error('[SUBMIT] ✗ Error in handleSubmit:', err)
      setError(err.message || 'Failed to submit test')
    } finally {
      setSubmitting(false)
      console.log('[SUBMIT] Submission flow completed (submitting=false)')
    }
  }

  const handleRetake = async () => {
    // For new word test retakes (below threshold), use existing logic
    if (currentTestType === 'new') {
      // Reset test state
      setAnswers({})
      answersRef.current = {}
      setCurrentIndex(0)
      setShowResults(false)
      setCanRetake(false)
      setTestResultsData(null)

      // Re-shuffle words for retake - use configured test size, not full pool size
      const shuffled = selectTestWords(originalWords, configuredTestSize)
      generateQuestions(shuffled)
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
      navigate(`/mcqtest/${classIdParam}/${listId}?type=review`, {
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

  const handleFinish = () => {
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
      handleFinish()

    } catch (error) {
      console.error('[CONTINUE] Failed to clear snapshot:', error)
      // Non-critical - proceed anyway
      handleFinish()
    }
  }

  // Quit test with confirmation - always go to Dashboard
  const handleQuitConfirm = () => {
    clearTestState(testId)
    setShowQuitConfirm(false)
    navigate('/')
  }

  const handlePlayAudio = async (word) => {
    if (!word || isPlayingAudio) return
    setIsPlayingAudio(true)
    try {
      await speak(word)
    } catch (error) {
      console.error('Failed to play audio:', error)
    } finally {
      setIsPlayingAudio(false)
    }
  }

  if (loading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base">
        <Watermark />
        <div className="relative z-10">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    )
  }

  if (error && !showResults) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">Something went wrong</p>
          <p className="mt-3 text-sm text-text-muted">{error}</p>
          <Button variant="primary-blue" size="lg" onClick={loadTestWords} className="mt-6">
            Try Again
          </Button>
          <Button variant="outline" size="lg" onClick={() => navigate(returnPath || '/')} className="mt-4">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  if (showResults && testResultsData) {
    // Format data for TestResults component
    const formattedWords = testWords.map(w => ({
      id: w.id,
      word: w.word,
      definition: w.definition,
    }))

    const userAnswers = {}
    Object.entries(answers).forEach(([wordId, option]) => {
      userAnswers[wordId] = option?.definition || ''
    })

    const resultsArray = Object.entries(answers).map(([wordId, option]) => ({
      wordId,
      isCorrect: option?.isCorrect || false,
    }))

    // Calculate step numbers for SessionHeader
    const { stepNumber: resultsStepNumber, totalSteps: resultsTotalSteps, stepText: resultsStepText } = getSessionStep({
      testType: currentTestType,
      isFirstDay: sessionContext?.isFirstDay
    })

    const score = testResultsData.score // Decimal 0-1
    const scorePercent = Math.round(score * 100)
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
              {passed ? 'New Words Test Passed!' : 'Did not pass'}
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
                      disabled={submitting}
                    >
                      {submitting ? 'Loading...' : 'Try Again'}
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

      // Review Test: 4-tier system (compare percentage values)
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
          onBack={handleFinish}
          backAriaLabel="Back to session"
          stepText={resultsStepText}
          onStepClick={() => setShowProgressSheet(true)}
          rightSlot={<GreyedMenuIcon />}
          sessionTitle={currentTestType === 'new' ? 'New Words Test' : 'Review Test'}
          dayNumber={dayNumber}
        />

        {/* Scrollable content area */}
        <div className="relative z-10 flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            {/* Card 1: Results Summary */}
            {renderResultsCard()}

            {/* Card 2: Detailed results */}
            <TestResults
              testType="mcq"
              listTitle={listDetails?.title}
              words={formattedWords}
              responses={userAnswers}
              results={resultsArray}
              attemptId={attemptId}
            />
          </div>
        </div>

        <SessionProgressSheet
          isOpen={showProgressSheet}
          onClose={() => setShowProgressSheet(false)}
          currentPhase={currentTestType === 'new' ? 'new_word_test' : 'review_test'}
          isFirstDay={sessionContext?.isFirstDay}
        />
      </main>
    )
  }

  if (!testWords.length) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-base px-4">
        <Watermark />
        <div className="relative z-10 max-w-md rounded-2xl bg-surface p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-text-primary">No Test Content</p>
          <p className="mt-3 text-sm text-text-muted">No words are available for this test right now. If you just finished a test, go back and continue from the dashboard.</p>
          <Button variant="outline" size="lg" onClick={() => navigate(returnPath || '/')} className="mt-6">
            Go Back
          </Button>
        </div>
      </main>
    )
  }

  // Active Test Screen
  const currentWord = testWords[currentIndex]
  const progress = ((currentIndex + 1) / testWords.length) * 100
  const answeredCount = Object.keys(answers).length

  // Calculate step number for SessionHeader
  const { stepText } = getSessionStep({
    testType: currentTestType,
    isFirstDay: sessionContext?.isFirstDay
  })

  return (
    <main className="relative flex min-h-screen flex-col bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-900">
      <Watermark />
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* SessionHeader with step indicator and progress */}
        <SessionHeader
          onBack={() => setShowQuitConfirm(true)}
          backAriaLabel="Quit test"
          backDisabled={submitting}
          stepText={stepText}
          onStepClick={() => setShowProgressSheet(true)}
          rightSlot={<GreyedMenuIcon />}
          sessionTitle={currentTestType === 'new' ? 'New Words Test' : 'Review Test'}
          dayNumber={sessionContext?.dayNumber || 1}
          progressPercent={progress}
          progressLabel={`${answeredCount} of ${testWords.length} answered`}
        />

        {/* Practice Mode Banner */}
        {isPracticeMode && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
            <p className="text-sm font-medium text-amber-800">
              Practice Mode — This attempt won't be recorded
            </p>
          </div>
        )}

        {/* Main Content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-4 py-6">
          {/* Navigation arrows + Question Card */}
          <div className="flex items-center gap-2 w-full max-w-2xl">
            {/* Left arrow */}
            <button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-muted active:scale-95 transition flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Previous question"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>

            {/* Question Card */}
            <div className="flex-1">
              <div className="flex aspect-[2/1] flex-col items-center justify-center rounded-3xl border-2 border-border-default bg-surface p-8 shadow-xl">
                <div className="text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <h2 className="text-4xl font-bold text-text-primary md:text-5xl">{currentWord.word}</h2>
                    {currentWord.partOfSpeech && (
                      <p className="text-lg italic text-text-muted md:text-xl">({currentWord.partOfSpeech})</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePlayAudio(currentWord.word)}
                    disabled={isPlayingAudio}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-200 disabled:opacity-60"
                  >
                    {isPlayingAudio ? '🔊 Playing...' : '🔊 Play Audio'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right arrow */}
            <button
              onClick={goToNext}
              disabled={currentIndex === testWords.length - 1}
              className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-muted active:scale-95 transition flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Next question"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          </div>

          {/* Answer Grid */}
          <div
            className={`relative z-10 grid w-full max-w-2xl gap-3 ${
              currentWord.options.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
            }`}
          >
            {currentWord.options.map((option, optIndex) => {
              const isSelected = answers[currentWord.id]?.wordId === option.wordId
              return (
                <button
                  key={optIndex}
                  type="button"
                  onClick={() => handleAnswerSelect(currentWord.id, option)}
                  disabled={submitting}
                  className={`min-h-[80px] rounded-2xl border-2 p-4 text-left transition-all ${
                    isSelected
                      ? 'scale-105 border-blue-500 bg-blue-50 shadow-lg'
                      : 'border-border-default bg-surface hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md'
                  } disabled:opacity-60`}
                >
                  <span className="text-sm font-medium text-text-secondary">{option.definition}</span>
                </button>
              )
            })}
          </div>

          {/* Submit Button */}
          <div className="w-full max-w-2xl pt-4">
            <div className="flex justify-center">
              <Button
                variant="primary-blue"
                size="lg"
                className="w-1/2"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : `Submit Test (${answeredCount}/${testWords.length} answered)`}
              </Button>
            </div>
            {answeredCount < testWords.length && (
              <p className="mt-2 text-center text-sm text-amber-600">
                Unanswered questions will be marked as incorrect
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          </div>
        )}

        {submitError && (
          <div className="px-4 pb-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{submitError}</p>
                  <p className="text-xs text-red-600 mt-1">Your answers are saved locally. Please try again.</p>
                </div>
              </div>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="mt-3 w-full"
                variant="primary"
              >
                {submitting ? 'Saving...' : 'Try Again'}
              </Button>
            </div>
          </div>
        )}
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
      {submitting && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}>
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Submitting Your Test...
              </h3>
              <div className="flex justify-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-sm text-gray-600">
                Please wait while we save your results.
              </p>

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
    </main>
  )
}

export default MCQTest

