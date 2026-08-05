import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, Timestamp, collection, query, orderBy, getDocs } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { useAuth } from '../contexts/AuthContext.jsx'
import { db } from '../firebase'
import { submitTestAttempt, withRetry, logSystemEvent, getNewWordAttemptForDay } from '../services/db'
import { SERVER_ATTEMPT_WRITE, LIST_SCOPED_RECON, REENTRY_GUARD, RECOVERY_GUARD, FORCED_PATHWAY, REVIEW_V2_CLIENT } from '../config/featureFlags'
// CUTOVER-A COMPOSE (REVIEW_V2_CLIENT): retakes of an engine-composed test
// recompose a NEW presentation (fresh composeKey) instead of re-sampling
// locally. Dead imports while the flag is false — every use is call-site gated.
import { composeNewTestV2, composeReviewSessionV2, rv2DistractorPool, rv2TestConfigOverride } from '../services/reviewV2Compose'
// CUTOVER-B SUBMIT (REVIEW_V2_CLIENT): an engine-composed test submits
// {presentationId, answers} to reviewV2SubmitAttempt — the SERVER grades and
// writes the attempt. Dead imports while the flag is false — call-site gated.
import { rv2McqAnswers, submitAttemptV2 } from '../services/reviewV2Submit'
// CUTOVER-C COMPLETE (REVIEW_V2_CLIENT): route the test-driven day completion
// through reviewV2CompleteDay — the SERVER advances the day + graduates +
// credits the streak. Dead imports while the flag is false — call-site gated.
import { rv2CompletionAttemptIds, completeDayV2 } from '../services/reviewV2Complete'
// DF2-51-d RETEST + 51-g RELOAD (REVIEW_V2_CLIENT): a past-day re-test submits
// through the RERUN leg (its own visit, its own status census, no legacy
// fallback), and the engine handle persisted in sessionStorage now carries the
// word ids so a hard reload rebuilds THIS test (NEED_TO_FIX 27). Dead imports
// while the flag is false — every use is call-site gated.
import {
  RERUN_RECOMPOSED, isRerunSource, rerunHalfFromSource, submitRerunAttempt,
  rv2HandleFromBlob, rv2HandleFromBlobAny, rv2HandleFromTestConfig,
  rv2SessionTypeFromSource, blobWithRv2Presentation, rv2PersistableHandle,
  rebuildableHandle, LIVE_BLOB_KEY, RESTUDY_BLOB_KEY,
} from '../services/restudyRetest'
import { MIN_ENGAGED_ANSWER_RATIO } from '../utils/reviewPairing'
import { useSimulationContext, isSimulationEnabled } from '../hooks/useSimulation.jsx'
import {
  initializeDailySession,
  getNewWords,
  resolveSegmentWords,
  getSegmentWordsByIds,
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

  // DF2-51-d (flag-on only): a past-day RE-TEST is marked in the URL, not in
  // navigation state — the URL is the only carrier that survives a hard reload,
  // and it is what keeps a re-test's sessionStorage blob separate from a live
  // session's (a re-test taken mid-session must never clobber that session's
  // own recovery blob). Flag-off `isRestudyRun` is a constant false and
  // `rv2BlobKey` is the literal 'dailySessionState' this file already used.
  const isRestudyRun = REVIEW_V2_CLIENT && searchParams.get('restudy') === '1'
  const rv2BlobKey = isRestudyRun ? RESTUDY_BLOB_KEY : LIVE_BLOB_KEY

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
  // CS PR-1 · F2 (I1, REENTRY_GUARD): under-answered REVIEW submit confirm. The ref (not
  // state) carries "student confirmed" through the immediate handleSubmit re-entry so the
  // dialog can't re-fire on the confirmed pass. Dormant while REENTRY_GUARD is false.
  const [showUnderAnsweredConfirm, setShowUnderAnsweredConfirm] = useState(false)
  const underAnsweredConfirmedRef = useRef(false)

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

  // F3 (rv2Pool, flag-on only): the distractor pool must arrive as an ARGUMENT
  // for the first render — `originalWords` state has not committed yet at the
  // first PATH-A call (same-tick setState), so the state-based arm below sees
  // [] and falls back to `words` = the presented subset (N−1 distractors max).
  // rv2Pool is passed ONLY from REVIEW_V2_CLIENT-gated call sites; when null
  // (every legacy call), the original state/words fallback runs verbatim.
  const generateQuestions = (words, numOptions = null, rv2Pool = null) => {
    const effectiveOptionsCount = numOptions ?? optionsCount
    const testWordsWithOptions = words.map(word => {
      const otherWords = (rv2Pool && rv2Pool.length > 0)
        ? rv2Pool.filter(w => w.id !== word.id)
        : originalWords.length > 0
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

  // NTF-27 / decision (i) (flag-on only — the ONE call site below is gated).
  // A HARD RELOAD drops `location.state`, so PATH A is skipped, but the
  // sessionStorage blob still holds the engine handle this page will SUBMIT
  // against. Rebuild exactly that test from the ids persisted alongside the
  // handle, instead of falling through to the legacy smart selection — which
  // answers the stored presentationId with DIFFERENT words and earns the
  // server's drift-reject (functions/reviewV2/callables.js:527-529). Returns
  // false (nothing touched) whenever anything is missing, so every legacy path
  // below stays reachable exactly as today.
  const rebuildRv2FromBlob = async () => {
    let handle = null
    try {
      const blob = JSON.parse(sessionStorage.getItem(rv2BlobKey) || 'null')
      handle = rv2HandleFromBlobAny({ blob, classId: classIdParam, listId })
    } catch { return false }
    const rebuild = rebuildableHandle(handle)
    if (!rebuild) return false
    // The FULL pool is fetched (F3: rebuilding from the presented subset alone
    // would shrink MCQ options and move the guess odds); the presented set is
    // mapped out of it IN THE SERVED ORDER (V3).
    const poolWords = await getSegmentWordsByIds(user.uid, listId, rebuild.poolWordIds)
    const byId = new Map(poolWords.map((w) => [w.id, w]))
    const words = rebuild.presentedWordIds.map((id) => byId.get(id)).filter(Boolean)
    if (words.length !== rebuild.presentedWordIds.length) return false
    const half = rv2SessionTypeFromSource(handle.source)
    if (half && half !== currentTestType) setCurrentTestType(half)
    if (Number.isFinite(rebuild.testOptionsCount)) setOptionsCount(rebuild.testOptionsCount)
    if (Number.isFinite(rebuild.passThresholdDecimal)) setRetakeThreshold(rebuild.passThresholdDecimal)
    setOriginalWords(poolWords)
    generateQuestions(words, rebuild.testOptionsCount ?? null, poolWords)
    return true
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
        // F3 (flag-on only): hand the pool as the argument — state has not
        // committed on this first call, so without it the distractor draw
        // falls back to the presented subset. Legacy calls pass null and run
        // the original fallback verbatim.
        generateQuestions(
          testConfig.wordsToTest,
          testConfig.testOptionsCount,
          (REVIEW_V2_CLIENT && testConfig.rv2) ? testConfig.originalWordPool : null
        )
        // NTF-27 (flag-on, engine-composed test only): stamp the presented +
        // pool ids and the two scalars a reload would otherwise have to re-read
        // the class doc for onto the blob's handle. This is the ONLY new write
        // on PATH A, and it writes to the SAME key/field the cutover folds
        // already own (`rv2Presentation`).
        if (REVIEW_V2_CLIENT && testConfig.rv2) {
          updateRv2PresentationInBlob(rv2PersistableHandle({
            rv2: testConfig.rv2,
            words: testConfig.wordsToTest,
            poolWords: testConfig.originalWordPool,
            testOptionsCount: testConfig.testOptionsCount,
            passThresholdDecimal: testConfig.passThresholdDecimal,
          }))
        }
        setLoading(false)
        return
      }

      // NTF-27 (flag-on only): no location.state ⇒ this is a RELOAD. Rebuild
      // the engine-composed test from the blob before any legacy path runs.
      if (REVIEW_V2_CLIENT && (await rebuildRv2FromBlob())) {
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
      if (RECOVERY_GUARD) {
        // CS PR-1 · WI-4 (I6): MCQ regenerates its word sample per load, so saved answers can
        // reference words NOT in the current testWords set; restoring them wholesale inflated
        // the stored answers[] past totalQuestions (the >100% score class). INTERSECT the
        // saved answers with the current word-id set; drop an out-of-range saved index; an
        // EMPTY intersection means the sample fully regenerated → start fresh.
        const validIds = new Set(testWords.map(w => w.id))
        const filtered = {}
        for (const [wordId, option] of Object.entries(savedRecoveryState.answers)) {
          if (validIds.has(wordId)) filtered[wordId] = option
        }
        if (Object.keys(filtered).length === 0) {
          handleRecoveryStartFresh()
          return
        }
        setAnswers(filtered)
        answersRef.current = { ...filtered }
        const savedIdx = savedRecoveryState.currentIndex
        if (Number.isInteger(savedIdx) && savedIdx >= 0 && savedIdx < testWords.length) {
          setCurrentIndex(savedIdx)
        }
      } else {
        setAnswers(savedRecoveryState.answers)
        answersRef.current = { ...savedRecoveryState.answers }
        if (savedRecoveryState.currentIndex !== undefined) {
          setCurrentIndex(savedRecoveryState.currentIndex)
        }
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

    // CS PR-1 · F2 (I1): non-blocking confirm on an under-answered REVIEW submit (answered
    // below the 80% engagement bar — the same MIN_ENGAGED_ANSWER_RATIO the pairing/engagement
    // predicate uses). NEVER blocks: Confirm proceeds with the submit unchanged (skips are
    // real signal, CS-16c — a server reject was explicitly rejected). Gated under
    // REENTRY_GUARD — documented choice: F2 ships in PR-1 whose flag set is
    // {REVIEW_PAIRING_V2, REENTRY_GUARD, RECOVERY_GUARD}; F2 is display-additive like the
    // rest of the REENTRY_GUARD (I3 re-entry/display) surface, and PR-3's FORCED_PATHWAY
    // escalation supersedes it. Flag-off: no dialog, today's submit path exactly.
    if (REENTRY_GUARD && currentTestType === 'review' && !underAnsweredConfirmedRef.current
        && testWords.length > 0
        && Object.keys(answersRef.current).length < Math.ceil(MIN_ENGAGED_ANSWER_RATIO * testWords.length)) {
      setShowUnderAnsweredConfirm(true)
      return
    }

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
      // CUTOVER-B (`let`, was `const`): flag-on the engine leg overrides these
      // with the SERVER's verdict/denominator (V3) after the submit returns.
      // Flag-off nothing reassigns them — behavior byte-identical.
      let summary = {
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
      // CUTOVER-B (`let`, was `const`): flag-on the NEW-test verdict becomes the
      // SERVER's after the engine submit; the review always-passes progression
      // law is untouched (day completion is cutover-c). Flag-off: never reassigned.
      let passed = currentTestType === 'review' ? true : summary.score >= retakeThreshold

      // C-23: authoritative verdict of the STORED attempt (server-computed under
      // SERVER_ATTEMPT_WRITE, the client-written doc's own value otherwise). Stays
      // null in practice mode — the result card then falls back to the local compare.
      let serverPassed = null

      // Submit attempt for gradebook (non-practice mode only)
      if (!isPracticeMode) {
        // CUTOVER-B SUBMIT (REVIEW_V2_CLIENT): the engine presentation this
        // on-screen test was composed from — null flag-off by construction, so
        // every gate below reduces to today's condition. When present, the
        // engine leg inside the try replaces the legacy write; the studyDay
        // derivation below is legacy-context assembly only (the server derives
        // the day from its own presentation record), so it is skipped flag-on.
        const rv2Handle = REVIEW_V2_CLIENT ? getRv2SubmitHandle() : null
        // DF2-51-d: the SAME handle, when it is a RERUN. Null flag-off by
        // construction (rv2Handle is null), so every branch keyed on it below
        // reduces to today's expression.
        const rv2Rerun = isRerunSource(rv2Handle?.source) ? rv2Handle : null

        // Get studyDay from sessionContext, or fetch from progress if standalone test
        console.log('[DEBUG STUDYDAY] Before determining studyDay:', {
          sessionContextExists: !!sessionContext,
          sessionContextDayNumber: sessionContext?.dayNumber,
          currentStudyDay: 'will fetch if needed'
        });

        let studyDay = sessionContext?.dayNumber
        if (!rv2Handle && !studyDay && user?.uid && classIdParam && listId) {
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
        // CUTOVER-B: legacy-context only — flag-on the server stamps from its
        // own presentation, so the guard (and its reads/logs) is skipped.
        if (!rv2Handle && sessionContext?.dayNumber != null && user?.uid && classIdParam && listId) {
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
        //   [CUTOVER-B D1] LEGACY leg only: flag-on the engine leg below sends
        //   NO docId — the server derives it (engineDocId) and replays idempotently.
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
        // CUTOVER-C COMPLETE (REVIEW_V2_CLIENT, flag-on only): hoisted OUT of
        // the submit try below so the completion call site (~line 980) can
        // read it — completion routes through the engine ONLY when THIS
        // submission actually used the engine leg (rv2Handle && !rv2Fallback),
        // the SAME test cutover-b already uses below to skip the legacy write
        // branches. Flag-off rv2Handle is always null (line 627), so this
        // stays false for its whole lifetime — zero flag-off behavioral
        // change from the hoist.
        let rv2Fallback = false
        try {
          // CUTOVER-B SUBMIT (REVIEW_V2_CLIENT, flag-on only): ONE call,
          // {presentationId, answers} ONLY (V1) — the SERVER grades against its
          // own presentation record and the SERVER writes the attempt
          // (functions/reviewV2/callables.js reviewV2SubmitAttempt). No client
          // attemptDocId, no client totalQuestions: the client-minted nonce was
          // the 06-29 outage root cause, and the client-counted denominator is
          // the 50-answers-reads-100% bug (V3). The legacy branches below are
          // the flag-off path, byte-identical to today.
          // DF2-51-d RETEST (flag-on only): a RERUN submits through its OWN
          // leg. It cannot use the live one: that recomposes `grade_unusable`
          // into a LIVE compose for the visited day (reviewV2Submit.js:345-347)
          // and knows nothing about the visit half this submit must close
          // (functions/reviewV2/visits.js:92-130). It also never falls back to
          // the legacy write — there is no legacy restudy path, and a legacy
          // write here would mint a LIVE-looking attempt for a PAST day.
          if (rv2Rerun) {
            const out = await submitRerunAttempt({
              uid: user.uid, classId: classIdParam, listId,
              visitedDay: rv2Rerun.visitedDay,
              half: rerunHalfFromSource(rv2Rerun.source),
              resetEpoch: rv2Rerun.resetEpoch ?? 0,
              visitId: rv2Rerun.visitId,
              presentationId: rv2Rerun.presentationId,
              answers: rv2McqAnswers(testWords, currentAnswers),
            })
            if (out.outcome === 'written') {
              result = { id: out.attemptId }
              serverPassed = out.passed
              // A rerun has no progression to protect, so the SERVER's verdict
              // renders as-is for both halves (the live "review always passes"
              // law exists for day completion, which a retest never reaches —
              // functions/reviewV2/completion.js:323,455).
              passed = out.passed === true
              summary = {
                score: Number.isFinite(out.score) ? out.score / 100 : summary.score,
                correct: Number.isFinite(out.correctCount) ? out.correctCount : summary.correct,
                total: Number.isFinite(out.totalQuestions) ? out.totalQuestions : summary.total,
                failed: summary.failed
              }
              // E2: a rerun offers no in-page retake — `handleRetake` would
              // compose a LIVE test (:1215/:1327 are source-gated to the live
              // tags) or locally re-sample words the stored presentationId does
              // not know. The student re-enters from Past Days, which composes
              // a fresh rerun with a fresh compose key.
              setCanRetake(false)
            } else if (out.outcome === RERUN_RECOMPOSED) {
              // grade_unusable ⇒ the rerun adapter recomposed EXACTLY ONCE,
              // through the RERUN leg against the SAME visit. Swap the
              // on-screen test and render the reason; never an auto-resubmit.
              logSystemEvent('rv2_retest_recomposed', {
                classId: classIdParam, listId, testType: 'mcq',
                presentationId: rv2Rerun.presentationId,
              }, 'warning')
              try {
                if (out.compose.testType !== 'mcq') throw new Error('recomposed testType mismatch')
                const freshWords = await getSegmentWordsByIds(user.uid, listId, out.compose.presentedWordIds)
                if (freshWords.length !== out.compose.presentedWordIds.length) {
                  throw new Error('composed word id(s) missing from list')
                }
                const freshPool = rv2DistractorPool({ words: freshWords, poolWords: originalWords })
                updateRv2PresentationInBlob(rv2PersistableHandle({
                  rv2: {
                    presentationId: out.compose.presentationId, testType: out.compose.testType,
                    logicalDay: out.compose.visitedDay, visitedDay: out.compose.visitedDay,
                    visitId: out.compose.visitId, resetEpoch: out.compose.resetEpoch ?? null,
                    source: rv2Rerun.source,
                  },
                  words: freshWords, poolWords: freshPool,
                  testOptionsCount: optionsCount, passThresholdDecimal: retakeThreshold,
                }))
                setOriginalWords(freshPool)
                generateQuestions(freshWords, null, freshPool)
                setSubmitError(out.reason)
                // (Same non-blocking treatment as the live leg — cutover-d A1.
                // This comment also keeps the live leg's certified text anchor
                // UNIQUE in this file; that fold owns it, not this one.)
              } catch (swapErr) {
                console.error('[RV2] retest recompose swap failed:', swapErr)
                setSubmitError(out.reason)
              }
              setSubmitting(false)
              return
            } else {
              // capped (decision (h) — permanent for today: no poll, no
              // recompose) · blocked · unavailable. Render the reason and STOP;
              // the answers stay on screen and in localStorage.
              logSystemEvent('rv2_retest_blocked', {
                classId: classIdParam, listId, testType: 'mcq',
                outcome: out.outcome, status: out.status ?? null,
              }, 'error')
              setSubmitError(out.reason)
              setSubmitting(false)
              return
            }
          } else if (rv2Handle) {
            const out = await submitAttemptV2({
              uid: user.uid, classId: classIdParam, listId,
              logicalDay: rv2Handle.logicalDay,
              kind: rv2Handle.source === 'composeNewTest' ? 'new' : 'review',
              presentationId: rv2Handle.presentationId,
              answers: rv2McqAnswers(testWords, currentAnswers),
            })
            if (out.outcome === 'written') {
              result = { id: out.attemptId }
              // C-23 idiom: the stored attempt's verdict is what the card renders.
              serverPassed = out.passed
              // The engine verdict + denominator are the SERVER's (V3). Review
              // progression keeps the legacy always-pass law — day completion
              // is cutover-c and must not move here.
              passed = currentTestType === 'review' ? true : out.passed === true
              summary = {
                score: Number.isFinite(out.score) ? out.score / 100 : summary.score,
                correct: Number.isFinite(out.correctCount) ? out.correctCount : summary.correct,
                total: Number.isFinite(out.totalQuestions) ? out.totalQuestions : summary.total,
                // Per-word study display stays the local option compare — the
                // server returns no rows on the MCQ leg, and the local compare
                // uses the same canonical definitions the options were built from.
                failed: summary.failed
              }
              if (currentTestType === 'new') setCanRetake(out.passed !== true)
            } else if (out.outcome === 'recomposed') {
              // grade_unusable ⇒ the adapter recomposed EXACTLY ONCE (A2). Swap
              // the on-screen test to the fresh presentation and render the
              // reason — the student retakes; NEVER an automatic resubmit loop.
              logSystemEvent('rv2_grade_unusable_recomposed', {
                classId: classIdParam, listId, testType: 'mcq',
                presentationId: rv2Handle.presentationId,
              }, 'warning')
              try {
                if (out.compose.testType !== 'mcq') throw new Error('recomposed testType mismatch')
                const freshWords = await getSegmentWordsByIds(user.uid, listId, out.compose.presentedWordIds)
                if (freshWords.length !== out.compose.presentedWordIds.length) {
                  throw new Error('composed word id(s) missing from list')
                }
                updateRv2PresentationInBlob({
                  presentationId: out.compose.presentationId, testType: out.compose.testType,
                  logicalDay: out.compose.logicalDay, resetEpoch: out.compose.resetEpoch ?? null,
                  source: rv2Handle.source,
                })
                // F3: the fresh pool stays FULL — fresh presentation first, then
                // the existing entry pool; never the presented subset alone.
                const freshPool = rv2DistractorPool({ words: freshWords, poolWords: originalWords })
                // NTF-27 (decision (i)): re-stamp the SAME handle with the fresh
                // word ids now that the pool exists, so a HARD RELOAD after this
                // swap rebuilds the FRESH test instead of smart-selecting other
                // words against the new presentationId. Deliberately a SECOND,
                // additive write rather than an edit of the line above: that
                // line is cutover-d's certified anchor (its fixture pins the
                // blob-update → fresh-words → render-state order by that exact
                // text) and cutover-d's fold owns it, not this one.
                updateRv2PresentationInBlob(rv2PersistableHandle({
                  rv2: {
                    presentationId: out.compose.presentationId, testType: out.compose.testType,
                    logicalDay: out.compose.logicalDay, resetEpoch: out.compose.resetEpoch ?? null,
                    source: rv2Handle.source,
                  },
                  words: freshWords, poolWords: freshPool,
                  testOptionsCount: optionsCount, passThresholdDecimal: retakeThreshold,
                }))
                setOriginalWords(freshPool)
                generateQuestions(freshWords, null, freshPool)
                // A1 (cutover-d, state-collision fix): a SUCCESSFUL swap is NOT
                // `error` — `error` gates the full-page "Something went wrong"
                // interstitial (:1440, `!showResults`), which would BLOCK the
                // fresh test just rendered above, and whose OWN "Try Again"
                // rebuilds testWords from loadTestWords' STALE testConfig closure
                // (:264-293) — a later submit would then answer the NEW
                // presentationId with the OLD words (server drift-reject,
                // callables.js:527-529). submitError is this page's EXISTING
                // non-blocking inline banner (:1861) whose own retry calls
                // handleSubmit directly: testWords/originalWords are already the
                // fresh presentation (generateQuestions above) and
                // getRv2SubmitHandle() already prefers the sessionStorage blob
                // (updateRv2PresentationInBlob above), so that retry submits the
                // NEW presentationId with the NEW words — no drift, no interstitial.
                setSubmitError(out.reason)
              } catch (swapErr) {
                console.error('[RV2] recompose swap failed:', swapErr)
                setSubmitError(out.reason)
              }
              setSubmitting(false)
              return
            } else if (out.outcome === 'legacy') {
              // Engine not serving mid-session (config_hold / review_v2_dark /
              // the thrown trio): the legacy submit below serves this
              // submission — the student's answered test is preserved.
              rv2Fallback = true
            } else {
              // blocked: render the reason; answers stay in state + localStorage,
              // and a re-submit of the SAME presentation is replay-safe.
              logSystemEvent('rv2_submit_blocked', {
                classId: classIdParam, listId, testType: 'mcq',
                status: out.status ?? null,
              }, 'error')
              setSubmitError(out.reason)
              setSubmitting(false)
              return
            }
          }
          if (rv2Handle && !rv2Fallback) {
            // Engine leg above already produced `result` + the server verdict.
          } else if (SERVER_ATTEMPT_WRITE) {
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
        // DF2-51-d: a RERUN never runs the legacy client study_state write.
        // `processTestResults` sets status PASSED/FAILED + the timesTested/
        // timesCorrect counters (src/services/studyService.js:783-794) — legacy
        // progress state. A re-test is extra practice that "never changes your
        // progress" (the browser's own promise), and the SERVER already owns a
        // rerun's word labels + graduation (callables.js:797-811; a rerun
        // graduates TESTED-CORRECT ONLY — completion.js:786-787). Flag-off
        // rv2Rerun is null, so this reads exactly as today.
        if (!rv2Rerun && !resultsProcessedRef.current) {
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
            // CUTOVER-C COMPLETE (REVIEW_V2_CLIENT, flag-on only): when THIS
            // submission actually used the engine leg (rv2Handle && !rv2Fallback
            // — the SAME test cutover-b's submit branch above uses to skip the
            // legacy write, line ~826), route completion through completeDay
            // (V1: the server advances the day + graduates + credits the
            // streak; the client sends the attempt IDS it resolved from THIS
            // test flow — V2 — never a computed CSD/TWI/graduation/streak
            // value). The legacy branch below is byte-identical to today.
            if (rv2Handle && !rv2Fallback) {
              const kind = rv2Handle.source === 'composeNewTest' ? 'new' : 'review'
              // V2: the OTHER slot's id is not resolvable in-memory on a
              // new-word day completing via the review submit (the 'new' test
              // ran in an earlier, separate page mount) — resolve it BEFORE
              // the completeDay call via the SAME query completeSessionFromTest
              // already performs internally (getNewWordAttemptForDay), so both
              // ids are in hand at/before the RPC, never after.
              let dayNewTestAttemptId = null
              if (kind === 'review') {
                const dayNewAttempt = await getNewWordAttemptForDay(
                  user.uid, classIdParam, listId, sessionContext.dayNumber,
                  { listScope: LIST_SCOPED_RECON, expectedBase: sessionContext?.newWordStartIndex }
                )
                dayNewTestAttemptId = dayNewAttempt?.id ?? null
              }
              const ids = rv2CompletionAttemptIds({
                kind, attemptId: result?.id ?? null, classId: classIdParam, dayNewTestAttemptId
              })
              const out = await completeDayV2({
                classId: classIdParam, listId, logicalDay: sessionContext.dayNumber, ...ids
              })
              if (out.outcome === 'completed') {
                console.log('Session completed successfully from MCQTest (engine)', { replayed: out.replayed })
              } else if (out.outcome === 'legacy') {
                // The engine stopped serving between the submit and this
                // completion call (config_hold/review_v2_dark/the thrown
                // trio) — the attempt is already saved via the engine submit
                // leg above; completion could not run. Never silently claim
                // success.
                logSystemEvent('rv2_complete_legacy_fallback', {
                  userId: user.uid, classId: classIdParam, listId, testType: 'mcq',
                  via: out.via, status: out.status ?? null, code: out.code ?? null,
                }, 'warning')
                setSubmitError('앱이 업데이트되었습니다. 답안은 저장되었으니, 페이지를 새로고침한 뒤 이어서 진행해 주세요. (The app was updated — your answers are saved. Please reload the page to continue.)')
                return
              } else {
                // blocked: no_evidence / day_guard_rejected / reset_in_progress /
                // reset_epoch_mismatch / list_words_malformed / client_version_stale
                // / unknown — render the reason. The attempt is already saved.
                logSystemEvent('rv2_complete_blocked', {
                  userId: user.uid, classId: classIdParam, listId, testType: 'mcq',
                  status: out.status ?? null,
                }, 'error')
                setSubmitError(out.reason)
                return
              }
            } else {
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
                // answered count of THIS review (non-empty studentResponse rows, the >=80% gate) + the
                // review attempt id (recordReviewOutcome idempotency). Passed only under the flag on a
                // review submit → flag-off the call is byte-identical to today.
                ...(FORCED_PATHWAY && currentTestType === 'review' ? {
                  reviewAnswered: answerArray.filter(a => String(a?.studentResponse ?? '').trim() !== '').length,
                  // FIX 3: thread a STABLE non-null idempotency key — fall back to the deterministic
                  // attemptDocId (the exact id the attempt is written under) when result.id is null, so
                  // recordReviewOutcome's whole-window scan never misses on an absent key.
                  reviewAttemptId: result?.id ?? attemptDocId
                } : {})
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
            }
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

  // CUTOVER-B SUBMIT (flag-on only): the engine presentation this ON-SCREEN
  // test was composed from. The sessionStorage blob is preferred because
  // in-page retakes update it with the FRESH presentation while
  // location.state keeps the stale one (cutover-a built the blob handle for
  // exactly this — see updateRv2PresentationInBlob below); it also survives a
  // mid-test reload, which location.state does not. Identity-checked against
  // this page's class/list, and `source` must match the phase, so a stale
  // blob can never mis-route a submit. Returns null when no engine handle
  // exists ⇒ the legacy submit path runs (callers gate on REVIEW_V2_CLIENT).
  // DF2-51-d: the acceptance test is now the PURE, fixtured `rv2HandleFromBlob`
  // / `rv2HandleFromTestConfig` (identical clauses — identity + a source that
  // matches this phase — widened only to accept the RERUN tag for the same
  // half). Flag-off this function is never called (see its one call site).
  const getRv2SubmitHandle = () => {
    try {
      const blob = JSON.parse(sessionStorage.getItem(rv2BlobKey) || 'null')
      const h = rv2HandleFromBlob({ blob, classId: classIdParam, listId, currentTestType })
      if (h) return h
    } catch { /* absent/corrupt blob — fall through to location.state */ }
    return rv2HandleFromTestConfig({ testConfig, currentTestType })
  }

  // RV2 (flag-on only): keep the sessionStorage blob's presentation handle
  // current across in-page retakes, so the SUBMIT fold always sees the
  // presentation the on-screen test was composed from.
  const updateRv2PresentationInBlob = (rv2) => {
    try {
      const blob = JSON.parse(sessionStorage.getItem(rv2BlobKey) || 'null')
      const next = blobWithRv2Presentation(blob, rv2)
      if (next) sessionStorage.setItem(rv2BlobKey, JSON.stringify(next))
    } catch { /* blob absent/corrupt — the location.state testConfig still carries rv2 */ }
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

      // RV2: an engine-composed test retakes by COMPOSING A NEW PRESENTATION
      // (fresh composeKey — V5: a retake must differ and must not replay),
      // rendered in the served order (V3) — never a local re-sample.
      if (REVIEW_V2_CLIENT && testConfig?.rv2?.source === 'composeNewTest') {
        try {
          const res = await composeNewTestV2({
            uid: user.uid, classId: classIdParam, listId,
            logicalDay: testConfig.rv2.logicalDay,
            freshKey: true
          })
          if (res.outcome === 'composed') {
            const words = await getSegmentWordsByIds(user.uid, listId, res.presentedWordIds)
            if (words.length === res.presentedWordIds.length) {
              // F3: the retake pool stays FULL — the fresh presentation's
              // words first, then the entry pool (already full via
              // rv2TestConfigOverride) — never the presented subset alone.
              const pool = rv2DistractorPool({ words, poolWords: originalWords })
              // NTF-27: persist the retake's own word ids with the handle.
              updateRv2PresentationInBlob(rv2PersistableHandle({
                rv2: {
                  presentationId: res.presentationId, testType: res.testType,
                  logicalDay: res.logicalDay, resetEpoch: null, source: 'composeNewTest',
                },
                words, poolWords: pool,
                testOptionsCount: optionsCount, passThresholdDecimal: retakeThreshold,
              }))
              setOriginalWords(pool)
              generateQuestions(words, null, pool)
              return
            }
            console.error('[RV2] retake compose: word id(s) missing from list')
            setError('시험을 다시 만들지 못했습니다. 페이지를 새로고침해 주세요. (The retake could not be prepared — please reload the page.)')
            return
          }
          if (res.outcome === 'blocked') {
            setError(res.reason)
            return
          }
          // outcome 'legacy' (engine stopped serving mid-session): fall
          // through to the legacy re-sample of the words already on screen.
        } catch (err) {
          console.error('[RV2] retake compose failed:', err)
          setError('시험을 다시 만들지 못했습니다. 페이지를 새로고침해 주세요. (The retake could not be prepared — please reload the page.)')
          return
        }
      }

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
        // CS PR-3 · WI-1 (FORCED_PATHWAY): rewind the review-mode bit alongside csd/twi/recentSessions
        // so the retake replays in the same review-mode context. Absent when flag-off (byte-equivalent).
        ...(FORCED_PATHWAY ? { reviewMode: restoreData.reviewMode ?? null } : {}),
        progressSnapshot: null, // Clear snapshot after restore
        updatedAt: Timestamp.now()
      })

      console.log('[RETAKE] Restored progress from snapshot')

      // RV2: a review retake of an engine-composed test is a DELIBERATE
      // retake — fresh composeKey ⇒ the engine composes a NEW presentation
      // (the day queue replays day-pinned; only the presentation is new).
      // Navigating with the OLD testConfig would replay the old words.
      if (REVIEW_V2_CLIENT && sessionContext?.rv2?.source === 'composeSession') {
        const res = await composeReviewSessionV2({
          uid: user.uid, classId: classIdParam, listId,
          logicalDay: sessionContext.rv2.logicalDay,
          freshKey: true
        })
        if (res.outcome === 'composed') {
          const words = await getSegmentWordsByIds(user.uid, listId, res.presentedWordIds)
          if (words.length !== res.presentedWordIds.length) {
            throw new Error('RV2 retake: composed word id(s) missing from list')
          }
          // F2+F3: rebuild the page-bound config through the PURE override —
          // full distractor pool (fresh presentation ∪ the entry pool),
          // presented order verbatim, review range label stays nulled.
          const nextConfig = rv2TestConfigOverride({
            baseConfig: sessionContext,
            testPhase: 'review',
            rv2: {
              presentationId: res.presentationId, testType: res.testType,
              logicalDay: res.logicalDay, resetEpoch: res.resetEpoch ?? null,
              words, poolWords: sessionContext.originalWordPool,
            },
          })
          // NTF-27: persist the retake's own word ids with the handle.
          updateRv2PresentationInBlob(rv2PersistableHandle({
            rv2: nextConfig.rv2,
            words: nextConfig.wordsToTest, poolWords: nextConfig.originalWordPool,
            testOptionsCount: nextConfig.testOptionsCount,
            passThresholdDecimal: nextConfig.passThresholdDecimal,
          }))
          navigate(`/mcqtest/${classIdParam}/${listId}?type=review`, {
            state: {
              testConfig: nextConfig,
              returnPath
            }
          })
          return
        }
        if (res.outcome === 'blocked') {
          // Rendered reason on the results card (existing retakeError slot) —
          // never a silent fallback that would replay the stale presentation.
          setRetakeError(res.reason)
          setCanRetake(false)
          return
        }
        // outcome 'legacy': engine stopped serving — the legacy navigate below
        // reuses the on-screen words exactly as today.
      }

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
          retakeThreshold={retakeThreshold}
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
            <div className="rounded-alert border border-border-error bg-error px-4 py-3 text-sm text-text-error">
              {error}
            </div>
          </div>
        )}

        {submitError && (
          <div className="px-4 pb-4">
            <div className="rounded-alert border border-border-error bg-error px-4 py-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-text-error flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-error-strong">{submitError}</p>
                  <p className="text-xs text-text-error mt-1">Your answers are saved locally. Please try again.</p>
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

      {/* CS PR-1 · F2 (I1, REENTRY_GUARD): under-answered REVIEW submit confirm. N% is the
          score that WILL be recorded (correct/total — unanswered count as wrong); MCQ options
          already carry isCorrect client-side, so this exposes no new information class.
          Renders nothing while the flag is off. */}
      {REENTRY_GUARD && (
        <ConfirmModal
          isOpen={showUnderAnsweredConfirm}
          title="Submit Review Test?"
          message={`You've answered ${Object.keys(answers).length}/${testWords.length}. This will be recorded as ${testWords.length > 0 ? Math.round((testWords.filter(w => answers[w.id]?.isCorrect).length / testWords.length) * 100) : 0}% — under 80% answered it won't complete your day and low review averages switch you to review-only mode. Submit anyway?`}
          confirmLabel="Submit Anyway"
          cancelLabel="Keep Answering"
          onConfirm={() => {
            underAnsweredConfirmedRef.current = true
            setShowUnderAnsweredConfirm(false)
            handleSubmit()
          }}
          onCancel={() => setShowUnderAnsweredConfirm(false)}
          variant="warning"
        />
      )}

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
                <div className="mt-4 p-4 bg-error border border-border-error rounded-alert">
                  <p className="text-text-error-strong font-semibold mb-3">{submitError}</p>
                  <button
                    onClick={handleSubmit}
                    className="w-full px-4 py-2 bg-brand-primary text-white rounded-button hover:bg-brand-primary/90 transition-colors"
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

