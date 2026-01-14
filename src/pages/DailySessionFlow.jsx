/**
 * DailySessionFlow.jsx
 *
 * Orchestrates the complete daily study session with phases:
 * New Words Study → New Words Test → Review Study → Review Test → Complete
 *
 * Key features:
 * - Session progress persists (can leave and resume)
 * - Test progress does NOT persist (exit = reset)
 * - Day 1 has no review phase
 * - PDF buttons available in study screens
 * - Blind spots shown at completion
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import Flashcard from '../components/Flashcard'
import Watermark from '../components/Watermark'
import ConfirmModal from '../components/ConfirmModal'
import SessionSummaryCard from '../components/SessionSummaryCard'
import SessionProgressSheet from '../components/SessionProgressSheet'
import SessionMenu from '../components/SessionMenu'
import SessionHeader from '../components/SessionHeader'
import DismissedWordsDrawer from '../components/DismissedWordsDrawer'
import { Button } from '../components/ui'
import { RefreshCw, ChevronLeft, ChevronRight, HelpCircle, X, ListChecks } from 'lucide-react'

// Services
import {
  initializeDailySession,
  getNewWords,
  getSegmentWords,
  buildReviewQueue,
  updateQueueTracking,
  recordSessionCompletion,
  initializeNewWordStates,
  getTodaysBatchForPDF,
  getCompleteBatchForPDF,
  graduateSegmentWords,
  returnMasteredWords
} from '../services/studyService'
import { fetchAllWords } from '../services/db'
import {
  getSessionState,
  saveSessionState,
  clearSessionState,
  SESSION_PHASE,
  getReviewTestType
} from '../services/sessionService'
import { downloadListAsPDF } from '../utils/pdfGenerator'
import { STUDY_ALGORITHM_CONSTANTS } from '../utils/studyAlgorithm'
import { buildTestConfig } from '../utils/testConfig'
import { getSessionStep } from '../utils/sessionStepTracker'
import {
  getSessionId as getLocalSessionId,
  saveSessionState as saveLocalSessionState,
  getSessionState as getLocalSessionState,
  clearSessionState as clearLocalSessionState,
  clearAllSessionStates,
  wasInTestPhase
} from '../utils/sessionRecovery'
import {
  getTestId,
  getTestState as getLocalTestState,
  wasIntentionalExit
} from '../utils/testRecovery'
import { calculateExpectedStudyDay } from '../types/studyTypes'
import { getClassProgress } from '../services/progressService'
import { useSimulationContext, isSimulationEnabled } from '../hooks/useSimulation.jsx'
import { useRef } from 'react'

// Constants
const PHASES = {
  LOADING: 'loading',
  NEW_WORDS: 'new_words',
  NEW_WORD_TEST: 'new_word_test',
  REVIEW_STUDY: 'review_study',
  REVIEW_TEST: 'review_test',
  COMPLETE: 'complete'
}

export default function DailySessionFlow() {
  const { classId, listId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Session state
  const [phase, setPhase] = useState(PHASES.LOADING)
  const [sessionConfig, setSessionConfig] = useState(null)
  const [error, setError] = useState('')
  const [listTitle, setListTitle] = useState('')

  // New words phase
  const [newWords, setNewWords] = useState([])
  const [newWordsQueue, setNewWordsQueue] = useState([])
  const [newWordsDismissed, setNewWordsDismissed] = useState(new Set())

  // New word test results
  const [newWordTestResults, setNewWordTestResults] = useState(null)
  const [newWordFailedIds, setNewWordFailedIds] = useState([])

  // Review phase
  const [reviewQueue, setReviewQueue] = useState([])
  const [reviewQueueCurrent, setReviewQueueCurrent] = useState([])
  const [reviewDismissed, setReviewDismissed] = useState(new Set())

  // Review test results
  const [reviewTestResults, setReviewTestResults] = useState(null)
  const [reviewTestAttempts, setReviewTestAttempts] = useState(0)

  // Shared flashcard state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardsReviewed, setCardsReviewed] = useState(0)

  // Assignment settings
  const [assignmentSettings, setAssignmentSettings] = useState(null)

  // Session summary
  const [sessionSummary, setSessionSummary] = useState(null)

  // PDF generation state
  const [generatingPDF, setGeneratingPDF] = useState(null)

  // Confirmation modals
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showTestConfirm, setShowTestConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showReEntryModal, setShowReEntryModal] = useState(false)
  const [showNoReviewModal, setShowNoReviewModal] = useState(false)

  // Review mode
  const [reviewMode, setReviewMode] = useState('fast')
  const [showCompleteModeModal, setShowCompleteModeModal] = useState(false)
  const [showFastModeModal, setShowFastModeModal] = useState(false)
  const [isSwitchingMode, setIsSwitchingMode] = useState(false)

  // Re-entry state (for modal)
  const [savedSessionState, setSavedSessionState] = useState(null)

  // Progress info for completion screen
  const [progressInfo, setProgressInfo] = useState(null) // { completedDays, expectedDay, difference, isOnTrack }

  // Progress sheet state
  const [showProgressSheet, setShowProgressSheet] = useState(false)

  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState(false)

  // Dismissed words drawer state
  const [showDismissedDrawer, setShowDismissedDrawer] = useState(false)
  const [dismissedWordsData, setDismissedWordsData] = useState([])

  // Card display settings (persisted to localStorage)
  const [showKoreanDef, setShowKoreanDef] = useState(() => {
    const saved = localStorage.getItem('vocaboost_showKoreanDef')
    return saved !== null ? JSON.parse(saved) : null
  })
  const [showSampleSentence, setShowSampleSentence] = useState(() => {
    const saved = localStorage.getItem('vocaboost_showSampleSentence')
    return saved !== null ? JSON.parse(saved) : null
  })
  const [showCardSettingsModal, setShowCardSettingsModal] = useState(false)

  // Local session recovery state
  const [savedLocalSessionState, setSavedLocalSessionState] = useState(null)
  const [pendingLocalRecovery, setPendingLocalRecovery] = useState(false)

  // Simulation mode integration
  const sim = useSimulationContext()
  const autoSwipeTimerRef = useRef(null)

  // Auto-swipe effect for simulation mode (flashcard study phases)
  useEffect(() => {
    if (!sim?.isAutoMode || !isSimulationEnabled()) return

    // Only auto-swipe during study phases
    const isStudyPhase = phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY
    if (!isStudyPhase) return

    // Get current queue based on phase
    const currentQueue = phase === PHASES.NEW_WORDS ? newWordsQueue : reviewQueueCurrent
    if (currentQueue.length === 0) return

    const delay = sim.speed?.cardDelay ?? 200

    autoSwipeTimerRef.current = setTimeout(() => {
      // Simulate viewing the card (flip if not flipped)
      if (!isFlipped) {
        setIsFlipped(true)
        return // Wait for next cycle to advance
      }

      // Decide if should dismiss based on profile
      const shouldDismiss = sim.shouldDismiss()

      if (shouldDismiss && phase === PHASES.NEW_WORDS) {
        // Dismiss current word
        const currentWord = currentQueue[currentIndex]
        if (currentWord) {
          setNewWordsDismissed(prev => new Set([...prev, currentWord.id]))
          setNewWordsQueue(prev => prev.filter(w => w.id !== currentWord.id))
        }
      } else if (shouldDismiss && phase === PHASES.REVIEW_STUDY) {
        // Dismiss current review word
        const currentWord = currentQueue[currentIndex]
        if (currentWord) {
          setReviewDismissed(prev => new Set([...prev, currentWord.id]))
          setReviewQueueCurrent(prev => prev.filter(w => w.id !== currentWord.id))
        }
      }

      // Advance to next card
      if (currentIndex < currentQueue.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setIsFlipped(false)
      } else {
        // Reached end of queue - trigger test
        setIsFlipped(false)
        if (phase === PHASES.NEW_WORDS) {
          setShowTestConfirm(true)
          // Auto-confirm after delay
          setTimeout(() => {
            setShowTestConfirm(false)
            goToNewWordTest()
          }, delay)
        } else if (phase === PHASES.REVIEW_STUDY) {
          setShowTestConfirm(true)
          setTimeout(() => {
            setShowTestConfirm(false)
            handleFinishReviewStudy()
          }, delay)
        }
      }

      // Track cards studied
      setCardsReviewed(prev => prev + 1)
      sim.log?.incrementCardsStudied()
    }, delay)

    return () => clearTimeout(autoSwipeTimerRef.current)
  }, [sim?.isAutoMode, phase, currentIndex, isFlipped, newWordsQueue, reviewQueueCurrent])

  // Update simulation live stats when session config changes
  useEffect(() => {
    if (!sim || !sessionConfig) return

    sim.updateLiveStats?.({
      dayNumber: sessionConfig.dayNumber,
      cardsTotal: sessionConfig.newWordCount + (sessionConfig.reviewCount || 0),
      interventionLevel: sessionConfig.interventionLevel || 0,
      adjustedPace: sessionConfig.adjustedPace || sessionConfig.newWordCount
    })
  }, [sessionConfig])

  // ============================================================
  // Browser Close Warning
  // ============================================================

  useEffect(() => {
    const isActivePhase = phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY

    const handleBeforeUnload = (e) => {
      if (isActivePhase) {
        e.preventDefault()
        e.returnValue = 'You have unsaved progress. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    if (isActivePhase) {
      window.addEventListener('beforeunload', handleBeforeUnload)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [phase])

  // ============================================================
  // Session State Persistence
  // ============================================================

  const persistSessionState = useCallback(async (updates = {}) => {
    if (!user?.uid || !classId || !listId) return

    const currentPhaseMap = {
      [PHASES.NEW_WORDS]: SESSION_PHASE.NEW_WORDS_STUDY,
      [PHASES.NEW_WORD_TEST]: SESSION_PHASE.NEW_WORDS_TEST,
      [PHASES.REVIEW_STUDY]: SESSION_PHASE.REVIEW_STUDY,
      [PHASES.REVIEW_TEST]: SESSION_PHASE.REVIEW_TEST,
      [PHASES.COMPLETE]: SESSION_PHASE.COMPLETE
    }

    try {
      await saveSessionState(user.uid, classId, listId, {
        phase: currentPhaseMap[phase] || SESSION_PHASE.NEW_WORDS_STUDY,
        currentStudyDay: sessionConfig?.dayNumber || 1,
        // Only update newWordsTestPassed if we have actual results (prevents overwriting true with false)
        ...(newWordTestResults && {
          newWordsTestPassed: newWordTestResults.score >= (sessionConfig?.retakeThreshold || 0.95),
          newWordsTestScore: newWordTestResults.score,
        }),
        reviewTestScore: reviewTestResults?.score || null,
        reviewTestAttempts,
        newWordsDismissedIds: [...newWordsDismissed],
        reviewDismissedIds: [...reviewDismissed],
        ...updates
      })
    } catch (err) {
      console.error('Failed to persist session state:', err)
    }
  }, [user?.uid, classId, listId, phase, sessionConfig, newWordTestResults, reviewTestResults, reviewTestAttempts, newWordsDismissed, reviewDismissed])

  // Auto-save on phase changes
  useEffect(() => {
    if (phase !== PHASES.LOADING) {
      persistSessionState()
    }
  }, [phase, persistSessionState])

  // Persist card display settings to localStorage
  useEffect(() => {
    if (showKoreanDef !== null) {
      localStorage.setItem('vocaboost_showKoreanDef', JSON.stringify(showKoreanDef))
    }
  }, [showKoreanDef])

  useEffect(() => {
    if (showSampleSentence !== null) {
      localStorage.setItem('vocaboost_showSampleSentence', JSON.stringify(showSampleSentence))
    }
  }, [showSampleSentence])

  // Show card settings modal on first study session (when settings are null)
  useEffect(() => {
    if (phase === PHASES.NEW_WORDS && showKoreanDef === null && showSampleSentence === null) {
      setShowCardSettingsModal(true)
    }
  }, [phase, showKoreanDef, showSampleSentence])

  // ============================================================
  // Local Session State Persistence (for crash recovery)
  // ============================================================

  useEffect(() => {
    // Only save meaningful study phase state
    if (!user?.uid || !sessionConfig?.dayNumber || pendingLocalRecovery) return
    if (phase !== PHASES.NEW_WORDS && phase !== PHASES.REVIEW_STUDY) return

    const phaseType = phase === PHASES.NEW_WORDS ? 'new' : 'review'
    const sessionId = getLocalSessionId(user.uid, classId, listId, sessionConfig.dayNumber, phaseType)

    const currentQueue = phase === PHASES.NEW_WORDS ? newWordsQueue : reviewQueueCurrent
    const currentDismissed = phase === PHASES.NEW_WORDS ? [...newWordsDismissed] : [...reviewDismissed]
    const wordPool = phase === PHASES.NEW_WORDS ? newWords : reviewQueue

    saveLocalSessionState(sessionId, {
      lastPhase: phase === PHASES.NEW_WORDS ? 'NEW_STUDY' : 'REVIEW_STUDY',
      studyQueue: currentQueue.map(w => w.id),
      dismissedWords: currentDismissed,
      currentIndex,
      isFlipped,
      testType: phaseType,
      wordPool: wordPool.map(w => ({ id: w.id, word: w.word })),
      sessionContext: {
        dayNumber: sessionConfig.dayNumber,
        phase: phaseType,
        isFirstDay: sessionConfig?.isFirstDay
      }
    })
  }, [
    user?.uid, classId, listId, sessionConfig?.dayNumber, phase,
    newWordsQueue, reviewQueueCurrent, newWordsDismissed, reviewDismissed,
    currentIndex, isFlipped, newWords, reviewQueue, pendingLocalRecovery
  ])

  // Save when entering test phase (so we can navigate back on crash)
  useEffect(() => {
    if (!user?.uid || !sessionConfig?.dayNumber || pendingLocalRecovery) return
    if (phase !== PHASES.NEW_WORD_TEST && phase !== PHASES.REVIEW_TEST) return

    const phaseType = phase === PHASES.NEW_WORD_TEST ? 'new' : 'review'
    const sessionId = getLocalSessionId(user.uid, classId, listId, sessionConfig.dayNumber, phaseType)
    const wordPool = phase === PHASES.NEW_WORD_TEST ? newWords : reviewQueue

    saveLocalSessionState(sessionId, {
      lastPhase: phase === PHASES.NEW_WORD_TEST ? 'NEW_TEST' : 'REVIEW_TEST',
      testType: phaseType,
      wordPool: wordPool.map(w => ({ id: w.id, word: w.word })),
      sessionContext: {
        dayNumber: sessionConfig.dayNumber,
        phase: phaseType,
        isFirstDay: sessionConfig?.isFirstDay
      }
    })
  }, [user?.uid, classId, listId, sessionConfig?.dayNumber, phase, newWords, reviewQueue, pendingLocalRecovery])

  // ============================================================
  // PDF Generation
  // ============================================================

  const handlePDFDownload = async (mode) => {
    if (!user?.uid || !classId || !listId || !assignmentSettings) return

    setGeneratingPDF(mode)

    try {
      let words

      if (mode === 'today') {
        words = await getTodaysBatchForPDF(user.uid, classId, listId, assignmentSettings)
      } else if (mode === 'complete') {
        words = await getCompleteBatchForPDF(user.uid, classId, listId, assignmentSettings)
      } else {
        const allWords = await fetchAllWords(listId)
        words = allWords  // position field already on documents
      }

      // Handle structured format { newWords, failedCarryover } or flat array
      const isStructured = words && !Array.isArray(words) && 'newWords' in words
      const wordCount = isStructured
        ? (words.newWords?.length || 0) + (words.failedCarryover?.length || 0)
        : (words?.length || 0)

      if (wordCount === 0) {
        alert('No words available to export.')
        return
      }

      // Normalize words while preserving structured format
      const normalizeWord = (word) => ({
        ...word,
        partOfSpeech: word?.partOfSpeech ?? word?.pos ?? word?.part_of_speech ?? '',
      })

      const normalizedWords = isStructured
        ? {
            newWords: words.newWords?.map(normalizeWord) || [],
            failedCarryover: words.failedCarryover?.map(normalizeWord) || [],
            reviewWords: words.reviewWords?.map(normalizeWord) || []
          }
        : words.map(normalizeWord)

      await downloadListAsPDF(listTitle || 'Vocabulary List', normalizedWords, mode)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF')
    } finally {
      setGeneratingPDF(null)
    }
  }

  // ============================================================
  // Helper: Load Review Queue
  // ============================================================

  const loadReviewQueue = useCallback(async (config) => {
    if (!config?.segment || !user?.uid) return

    const queue = await buildReviewQueue(
      user.uid,
      listId,
      config.segment,
      config.reviewCount,
      newWordFailedIds
    )

    setReviewQueue(queue)
    setReviewQueueCurrent(queue)
    setCurrentIndex(0)
  }, [user?.uid, listId, newWordFailedIds])

  // ============================================================
  // Mode Switch Handlers
  // ============================================================

  const handleSwitchToCompleteMode = useCallback(async () => {
    if (!sessionConfig || !user?.uid) return

    setIsSwitchingMode(true)
    setShowCompleteModeModal(false)

    try {
      if (phase === PHASES.REVIEW_STUDY && sessionConfig.segment) {
        const allWords = await getSegmentWords(
          user.uid,
          listId,
          sessionConfig.segment.startIndex,
          sessionConfig.segment.endIndex
        )
        setReviewQueue(allWords)
        setReviewQueueCurrent(allWords)
        setReviewDismissed(new Set())
        setCurrentIndex(0)
        setIsFlipped(false)
      }

      setReviewMode('complete')
    } catch (err) {
      console.error('Failed to switch to complete mode:', err)
    } finally {
      setIsSwitchingMode(false)
    }
  }, [sessionConfig, user?.uid, listId, phase])

  const handleSwitchToFastMode = useCallback(async () => {
    if (!sessionConfig || !user?.uid) return

    setIsSwitchingMode(true)
    setShowFastModeModal(false)

    try {
      if (phase === PHASES.REVIEW_STUDY && sessionConfig.segment) {
        const queue = await buildReviewQueue(
          user.uid,
          listId,
          sessionConfig.segment,
          sessionConfig.reviewCount,
          newWordFailedIds
        )
        setReviewQueue(queue)
        setReviewQueueCurrent(queue)
        setReviewDismissed(new Set())
        setCurrentIndex(0)
        setIsFlipped(false)
      }

      setReviewMode('fast')
    } catch (err) {
      console.error('Failed to switch to fast mode:', err)
    } finally {
      setIsSwitchingMode(false)
    }
  }, [sessionConfig, user?.uid, listId, phase, newWordFailedIds])

  // ============================================================
  // PHASE 0: Initialize Session
  // ============================================================

  useEffect(() => {
    // GUARD: Skip init when returning from test
    // handleReturnFromTest effect (line 1109) handles that case using sessionStorage
    if (location.state?.testCompleted) return

    if (!user?.uid || !classId || !listId) return

    const init = async () => {
      try {
        // Get class to find assignment settings
        const classRef = doc(db, 'classes', classId)
        const classSnap = await getDoc(classRef)
        if (!classSnap.exists()) {
          throw new Error('Class not found')
        }
        const classData = classSnap.data()
        const assignment = classData.assignments?.[listId]
        if (!assignment) {
          throw new Error('List not assigned to this class')
        }

        setAssignmentSettings(assignment)

        // Get list title
        const listRef = doc(db, 'lists', listId)
        const listSnap = await getDoc(listRef)
        if (listSnap.exists()) {
          setListTitle(listSnap.data().title || 'Vocabulary List')
        }

        // Check for existing session state
        const existingState = await getSessionState(user.uid, classId, listId)

        // Return any MASTERED words that have passed their 21-day period
        await returnMasteredWords(user.uid, listId)

        // Initialize session config
        const config = await initializeDailySession(
          user.uid,
          classId,
          listId,
          {
            weeklyPace: assignment.pace * (assignment.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK),
            studyDaysPerWeek: assignment.studyDaysPerWeek || STUDY_ALGORITHM_CONSTANTS.DEFAULT_STUDY_DAYS_PER_WEEK,
            testSizeNew: assignment.testSizeNew || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_NEW,
            testSizeReview: assignment.testSizeReview || STUDY_ALGORITHM_CONSTANTS.DEFAULT_TEST_SIZE_REVIEW,
            newWordRetakeThreshold: assignment.newWordRetakeThreshold || STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD
          }
        )

        setSessionConfig(config)

        // DEBUG: Log sessionConfig dayNumber
        console.log('DEBUG setSessionConfig:', {
          dayNumber: config.dayNumber,
          newWordStartIndex: config.newWordStartIndex,
          newWordCount: config.newWordCount,
          startPhase: config.startPhase
        })

        // Handle session recovery based on startPhase from attempt history
        if (config.startPhase === SESSION_PHASE.COMPLETE) {
          // Session already complete - show completion screen
          if (config.recoveredNewWordScore !== undefined) {
            setNewWordTestResults({ score: config.recoveredNewWordScore })
          }
          if (config.recoveredReviewScore !== undefined) {
            setReviewTestResults({ score: config.recoveredReviewScore })
          }
          setPhase(PHASES.COMPLETE)
          return
        }

        if (config.startPhase === SESSION_PHASE.REVIEW_STUDY) {
          // Mid-session recovery: new word test passed, need to do review
          // Load segment words for review study (reusing same logic as moveToReviewPhase)
          try {
            const segmentWords = await getSegmentWords(
              user.uid,
              listId,
              config.segment.startIndex,
              config.segment.endIndex
            )

            setReviewQueue(segmentWords)
            setReviewQueueCurrent(segmentWords)
            setReviewDismissed(new Set())
            setCurrentIndex(0)
            setIsFlipped(false)
            setCardsReviewed(0)

            if (config.recoveredNewWordScore !== undefined) {
              setNewWordTestResults({ score: config.recoveredNewWordScore })
            }

            setPhase(PHASES.REVIEW_STUDY)
            return
          } catch (err) {
            console.error('Failed to load segment words for REVIEW_STUDY recovery:', err)
            setError('Failed to load review words. Please refresh and try again.')
            return
          }
        }

        // Load new words (failed carryover words are now handled via segment review priority)
        if (config.newWordCount > 0) {
          const words = await getNewWords(
            listId,
            config.newWordStartIndex,
            config.newWordCount
          )

          setNewWords(words)
          setNewWordsQueue(words)

          await initializeNewWordStates(
            user.uid,
            listId,
            words,
            config.dayNumber
          )
        }

        // ========================================
        // Local Session Recovery Check
        // ========================================
        // Check for local session state from crash/unexpected exit

        const newSessionId = getLocalSessionId(user.uid, classId, listId, config.dayNumber, 'new')
        const reviewSessionId = getLocalSessionId(user.uid, classId, listId, config.dayNumber, 'review')
        const localNewState = getLocalSessionState(newSessionId)
        const localReviewState = getLocalSessionState(reviewSessionId)

        // Check if user was in a test phase and crashed (no intentional exit)
        const checkTestRecovery = (localState, phaseType) => {
          if (!localState || !wasInTestPhase(localState.lastPhase)) return null

          const testId = getTestId(classId, listId, phaseType)
          const testState = getLocalTestState(testId)

          // Only recover if test state exists AND user didn't intentionally leave
          if (testState && !wasIntentionalExit(testId)) {
            return { localState, testId, phaseType }
          }
          return null
        }

        // Prioritize review test recovery over new test (more likely to be recent)
        const reviewTestRecovery = checkTestRecovery(localReviewState, 'review')
        const newTestRecovery = checkTestRecovery(localNewState, 'new')
        const testRecovery = reviewTestRecovery || newTestRecovery

        if (testRecovery) {
          // Crashed during test - navigate directly back to test
          const testMode = assignment.testMode || 'mcq'
          const route = testMode === 'typed' ? '/typedtest' : '/mcqtest'

          // Store session state for return
          // Use wordPool from localStorage test state (saved when test started)
          const recoveredWordPool = testRecovery.localState?.wordPool || []
          sessionStorage.setItem('dailySessionState', JSON.stringify({
            classId,
            listId,
            dayNumber: config.dayNumber,
            phase: testRecovery.phaseType === 'new' ? PHASES.NEW_WORD_TEST : PHASES.REVIEW_TEST,
            newWords: recoveredWordPool,
            newWordTestResults: null,
            reviewQueue: [],
            sessionConfig: config,
            assignmentSettings: assignment,
            reviewTestAttempts: 0
          }))

          navigate(`${route}/${classId}/${listId}`, {
            state: {
              testType: testRecovery.phaseType,
              wordPool: testRecovery.phaseType === 'new' ? recoveredWordPool : null,
              returnPath: `/session/${classId}/${listId}`,
              sessionContext: {
                dayNumber: config.dayNumber,
                phase: testRecovery.phaseType,
                isFirstDay: config?.isFirstDay,
                listTitle,
                segment: config?.segment,
                interventionLevel: config?.interventionLevel || 0,
                wordsIntroduced: config?.newWordCount || 0,
                wordsReviewed: 0,
                newWordStartIndex: config?.newWordStartIndex ?? null,
                newWordEndIndex: config?.newWordEndIndex ?? null,
              }
            }
          })
          return // Exit init - navigating to test
        }

        // Check if user was in a study phase and has progress to recover
        const studyRecovery = localReviewState?.lastPhase === 'REVIEW_STUDY'
          ? localReviewState
          : localNewState?.lastPhase === 'NEW_STUDY'
            ? localNewState
            : null

        if (studyRecovery && studyRecovery.studyQueue?.length > 0) {
          // Has study progress - auto-restore it
          setSavedLocalSessionState(studyRecovery)
          setSessionConfig(config)
          setAssignmentSettings(assignment)
          setPendingLocalRecovery(true)
          // Auto-restore will be triggered by useEffect watching pendingLocalRecovery
        }

        // No local recovery needed - clear any stale local state and continue
        clearLocalSessionState(newSessionId)
        clearLocalSessionState(reviewSessionId)

        // Handle re-entry: check if user already completed session
        if (existingState && existingState.phase === SESSION_PHASE.COMPLETE) {
          // Day 1 has no review test - just show complete page
          if (existingState.currentStudyDay === 1) {
            setPhase(PHASES.COMPLETE)
            return
          }
          // Day 2+ with review test - show re-entry modal
          if (existingState.reviewTestScore !== null) {
            setSavedSessionState(existingState)
            setReviewTestResults({ score: existingState.reviewTestScore })
            setReviewTestAttempts(existingState.reviewTestAttempts || 0)
            setShowReEntryModal(true)
            setPhase(PHASES.COMPLETE)
            return
          }
        }

        // Restore session state if exists
        if (existingState) {
          setReviewTestAttempts(existingState.reviewTestAttempts || 0)

          if (existingState.newWordsTestScore !== null) {
            setNewWordTestResults({ score: existingState.newWordsTestScore })
          }
          if (existingState.reviewTestScore !== null) {
            setReviewTestResults({ score: existingState.reviewTestScore })
          }

          // Restore dismissed words (stored separately)
          if (existingState.newWordsDismissedIds?.length > 0) {
            setNewWordsDismissed(new Set(existingState.newWordsDismissedIds))
          }
          if (existingState.reviewDismissedIds?.length > 0) {
            setReviewDismissed(new Set(existingState.reviewDismissedIds))
          }
        }

        // Determine starting phase
        // Only restore to review phase if saved state is from the SAME day (prevents stale state from previous day)
        const isSameDay = existingState?.currentStudyDay === config.dayNumber

        if (isSameDay && (existingState?.phase === SESSION_PHASE.REVIEW_STUDY || existingState?.phase === SESSION_PHASE.REVIEW_TEST)) {
          // Resume at review phase (same day only)
          // Use full segment for study flashcards
          if (config.segment) {
            const allWords = await getSegmentWords(
              user.uid,
              listId,
              config.segment.startIndex,
              config.segment.endIndex
            )
            setReviewQueue(allWords)
            setReviewQueueCurrent(allWords)
          }
          setPhase(PHASES.REVIEW_STUDY)
        } else if (config.newWordCount > 0) {
          setPhase(PHASES.NEW_WORDS)
        } else if (config.segment) {
          // Use full segment for study flashcards (not prioritized queue)
          const allWords = await getSegmentWords(
            user.uid,
            listId,
            config.segment.startIndex,
            config.segment.endIndex
          )
          setReviewQueue(allWords)
          setReviewQueueCurrent(allWords)
          setPhase(PHASES.REVIEW_STUDY)
        } else {
          setPhase(PHASES.COMPLETE)
          // No work to do - auto-restart simulation if running
          if (sim?.isFullSimulation) {
            setTimeout(() => {
              sim.onSessionComplete()
            }, 500)
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to initialize session')
      }
    }

    init()
  }, [user?.uid, classId, listId, location.state?.testCompleted])

  // ============================================================
  // PHASE 1: New Words Study
  // ============================================================

  const currentNewWord = newWordsQueue[currentIndex]

  const handleNewWordKnowThis = () => {
    if (!currentNewWord) return
    setNewWordsDismissed(prev => new Set([...prev, currentNewWord.id]))
    setDismissedWordsData(prev => [...prev, { ...currentNewWord, phase: 'new' }])
    setNewWordsQueue(prev => prev.filter(w => w.id !== currentNewWord.id))
    setCardsReviewed(prev => prev + 1)

    if (newWordsQueue.length <= 1) {
      // All cards reviewed - prompt for test
      setShowTestConfirm(true)
    } else if (currentIndex >= newWordsQueue.length - 1) {
      setCurrentIndex(0)
    }
    setIsFlipped(false)
  }

  const handleNewWordNotSure = () => {
    if (!currentNewWord) return
    setNewWordsQueue(prev => {
      const word = prev.find(w => w.id === currentNewWord.id)
      const filtered = prev.filter(w => w.id !== currentNewWord.id)
      return [...filtered, word]
    })
    setCardsReviewed(prev => prev + 1)
    if (currentIndex >= newWordsQueue.length - 1) {
      setCurrentIndex(0)
    }
    setIsFlipped(false)
  }

  const handleNewWordReset = () => {
    setNewWordsDismissed(new Set())
    setDismissedWordsData(prev => prev.filter(w => w.phase !== 'new'))
    setNewWordsQueue([...newWords])
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  const handleNewWordPrev = () => {
    if (newWordsQueue.length === 0) return
    setCurrentIndex(prev => prev <= 0 ? newWordsQueue.length - 1 : prev - 1)
    setIsFlipped(false)
  }

  const handleNewWordNext = () => {
    if (newWordsQueue.length === 0) return
    setCurrentIndex(prev => prev >= newWordsQueue.length - 1 ? 0 : prev + 1)
    setIsFlipped(false)
  }

  const goToNewWordTest = () => {
    const testMode = assignmentSettings?.testMode || 'mcq'
    const actualMode = testMode === 'typed' ? 'typed' : 'mcq'
    navigateToTest('new', actualMode)
  }

  // ============================================================
  // PHASE 2: New Word Test Navigation
  // ============================================================

  const handleContinueToReview = async () => {
    await moveToReviewPhase()
  }

  const handleNewWordTestRetake = () => {
    const testMode = assignmentSettings?.testMode || 'mcq'
    navigateToTest('new', testMode === 'typed' ? 'typed' : 'mcq')
  }

  // ============================================================
  // PHASE 3: Review Study
  // ============================================================

  const moveToReviewPhase = async (configOverride = null) => {
    // Use override if provided (when called from handleReturnFromTest before state updates)
    const config = configOverride || sessionConfig

    if (!config?.segment) {
      // No segment - either Day 1 (no review) or missing config
      // Day 1 completion is now handled by test component, so just return
      console.warn('moveToReviewPhase: No segment available, skipping review phase')
      return
    }

    // Get segment words for study flashcards
    const segmentWords = await getSegmentWords(
      user.uid,
      listId,
      config.segment.startIndex,
      config.segment.endIndex
    )

    // Also include today's failed new words if any
    let allWords = segmentWords
    if (newWordFailedIds && newWordFailedIds.length > 0) {
      const failedWordDocs = await Promise.all(
        newWordFailedIds.map(wordId => getDoc(doc(db, 'lists', listId, 'words', wordId)))
      )
      const failedWords = failedWordDocs
        .filter(docSnap => docSnap.exists())
        .map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          studyState: { status: 'failed' }
        }))
      // Prepend failed new words so they appear first in review
      allWords = [...failedWords, ...segmentWords]
    }

    // Check if segment is empty (shouldn't happen, but safety check)
    if (allWords.length === 0) {
      setShowNoReviewModal(true)
      return
    }

    setReviewQueue(allWords)
    setReviewQueueCurrent(allWords)
    setReviewDismissed(new Set())
    setCurrentIndex(0)
    setIsFlipped(false)
    setPhase(PHASES.REVIEW_STUDY)
  }

  // Handler for empty review queue modal
  const handleNoReviewModalClose = async () => {
    setShowNoReviewModal(false)
    await completeSession()
  }

  const currentReviewWord = reviewQueueCurrent[currentIndex]

  const handleReviewKnowThis = () => {
    if (!currentReviewWord) return
    setReviewDismissed(prev => new Set([...prev, currentReviewWord.id]))
    setDismissedWordsData(prev => [...prev, { ...currentReviewWord, phase: 'review' }])
    setReviewQueueCurrent(prev => prev.filter(w => w.id !== currentReviewWord.id))
    setCardsReviewed(prev => prev + 1)

    if (reviewQueueCurrent.length <= 1) {
      setShowTestConfirm(true)
    } else if (currentIndex >= reviewQueueCurrent.length - 1) {
      setCurrentIndex(0)
    }
    setIsFlipped(false)
  }

  const handleReviewNotSure = () => {
    if (!currentReviewWord) return
    setReviewQueueCurrent(prev => {
      const word = prev.find(w => w.id === currentReviewWord.id)
      const filtered = prev.filter(w => w.id !== currentReviewWord.id)
      return [...filtered, word]
    })
    setCardsReviewed(prev => prev + 1)
    if (currentIndex >= reviewQueueCurrent.length - 1) {
      setCurrentIndex(0)
    }
    setIsFlipped(false)
  }

  const handleReviewReset = () => {
    setReviewDismissed(new Set())
    setDismissedWordsData(prev => prev.filter(w => w.phase !== 'review'))
    setReviewQueueCurrent([...reviewQueue])
    setCurrentIndex(0)
    setIsFlipped(false)
  }

  // Undo individual dismissed word
  const handleUndoDismiss = (wordId, wordPhase) => {
    const wordData = dismissedWordsData.find(w => w.id === wordId)
    if (!wordData) return

    if (wordPhase === 'new') {
      setNewWordsDismissed(prev => {
        const next = new Set(prev)
        next.delete(wordId)
        return next
      })
      setNewWordsQueue(prev => [...prev, wordData])
    } else {
      setReviewDismissed(prev => {
        const next = new Set(prev)
        next.delete(wordId)
        return next
      })
      setReviewQueueCurrent(prev => [...prev, wordData])
    }
    setDismissedWordsData(prev => prev.filter(w => w.id !== wordId))
  }

  // Restore all dismissed words for current phase
  const handleRestoreAllDismissed = () => {
    const currentPhase = phase === PHASES.NEW_WORDS ? 'new' : 'review'
    const wordsToRestore = dismissedWordsData.filter(w => w.phase === currentPhase)

    if (currentPhase === 'new') {
      setNewWordsDismissed(new Set())
      setNewWordsQueue(prev => [...prev, ...wordsToRestore])
    } else {
      setReviewDismissed(new Set())
      setReviewQueueCurrent(prev => [...prev, ...wordsToRestore])
    }
    setDismissedWordsData(prev => prev.filter(w => w.phase !== currentPhase))
    setShowDismissedDrawer(false)
  }

  const handleReviewPrev = () => {
    if (reviewQueueCurrent.length === 0) return
    setCurrentIndex(prev => prev <= 0 ? reviewQueueCurrent.length - 1 : prev - 1)
    setIsFlipped(false)
  }

  const handleReviewNext = () => {
    if (reviewQueueCurrent.length === 0) return
    setCurrentIndex(prev => prev >= reviewQueueCurrent.length - 1 ? 0 : prev + 1)
    setIsFlipped(false)
  }

  const handleFinishReviewStudy = async () => {
    const studiedIds = reviewQueue.map(w => w.id)
    await updateQueueTracking(user.uid, studiedIds)
    goToReviewTest()
  }

  const goToReviewTest = () => {
    // Use reviewTestType if set, otherwise fall back to legacy behavior
    const reviewTestType = assignmentSettings?.reviewTestType
    const actualMode = reviewTestType || getReviewTestType(reviewTestAttempts, assignmentSettings?.testMode || 'mcq')
    navigateToTest('review', actualMode)
  }

  // ============================================================
  // Test Navigation
  // ============================================================

  const navigateToTest = (testPhase, mode) => {
    const wordPool = testPhase === 'new' ? newWords : reviewQueue

    // Build context for test header
    const wordRangeStart = testPhase === 'new'
      ? (sessionConfig?.newWordStartIndex || 0) + 1
      : (sessionConfig?.segment?.startIndex || 0) + 1
    const wordRangeEnd = testPhase === 'new'
      ? (sessionConfig?.newWordEndIndex || 0) + 1
      : (sessionConfig?.segment?.endIndex || 0) + 1

    // Build complete test config (handles testSize limiting, defaults, etc.)
    const testConfig = buildTestConfig({
      assignment: assignmentSettings,
      wordPool: wordPool || [],
      testType: testPhase,
      sessionContext: {
        dayNumber: sessionConfig?.dayNumber,
        isFirstDay: sessionConfig?.isFirstDay,
        wordRangeStart,
        wordRangeEnd,
        listTitle,
        // Required for session completion from test component
        segment: sessionConfig?.segment,
        interventionLevel: sessionConfig?.interventionLevel || 0,
        wordsIntroduced: newWords?.length || 0,
        wordsReviewed: reviewQueue?.length || 0,
        // Raw indices for attempt tracking
        newWordStartIndex: sessionConfig?.newWordStartIndex ?? null,
        newWordEndIndex: sessionConfig?.newWordEndIndex ?? null,
      }
    })

    const route = mode === 'typed' ? '/typedtest' : '/mcqtest'

    // DEBUG: Check sessionConfig before saving
    console.log('DEBUG navigateToTest sessionConfig:', {
      hasSessionConfig: !!sessionConfig,
      segment: sessionConfig?.segment,
      dayNumber: sessionConfig?.dayNumber,
      isFirstDay: sessionConfig?.isFirstDay
    })

    // Store session state in sessionStorage for return
    sessionStorage.setItem('dailySessionState', JSON.stringify({
      classId,
      listId,
      dayNumber: sessionConfig?.dayNumber,
      phase: testPhase === 'new' ? PHASES.NEW_WORD_TEST : PHASES.REVIEW_TEST,
      newWords,
      newWordTestResults,
      reviewQueue,
      sessionConfig,
      assignmentSettings,
      reviewTestAttempts
    }))

    navigate(`${route}/${classId}/${listId}`, {
      state: {
        testConfig,
        returnPath: `/session/${classId}/${listId}`,
      }
    })
  }

  // Handle return from test (Study button - go back to study phase)
  useEffect(() => {
    if (!location.state?.goToStudy) return

    const handleGoToStudy = async () => {
      const savedState = sessionStorage.getItem('dailySessionState')
      if (!savedState) {
        // No saved state - restart from beginning
        navigate(`/session/${classId}/${listId}`, { replace: true })
        return
      }

      try {
        const state = JSON.parse(savedState)

        // Restore session state
        setSessionConfig(state.sessionConfig)
        setNewWords(state.newWords)
        setReviewQueue(state.reviewQueue)
        setAssignmentSettings(state.assignmentSettings)
        setReviewTestAttempts(state.reviewTestAttempts || 0)

        // Reset study queue to allow re-study
        if (location.state?.testType === 'new') {
          // Go back to new words study phase
          setNewWordsQueue([...state.newWords])
          setNewWordsDismissed(new Set())
          setCurrentIndex(0)
          setIsFlipped(false)
          setPhase(PHASES.NEW_WORDS)
        } else {
          // Go back to review study phase
          setReviewQueueCurrent([...state.reviewQueue])
          setReviewDismissed(new Set())
          setCurrentIndex(0)
          setIsFlipped(false)
          setPhase(PHASES.REVIEW_STUDY)
        }

        // Clear navigation state
        navigate(location.pathname, { replace: true, state: {} })
      } catch (err) {
        console.error('Failed to restore session state:', err)
        setError('Failed to restore session. Please start over.')
      }
    }

    handleGoToStudy()
  }, [location.state?.goToStudy, location.state?.testType, classId, listId, navigate])

  // Handle return from test (completion)
  // NOTE: Session completion (CSD increment, graduation) now happens in the test component
  // (MCQTest/TypedTest) at submit time. This effect handles UI transitions and state cleanup.
  useEffect(() => {
    if (!location.state?.testCompleted) return

    const handleReturnFromTest = async () => {
      const savedState = sessionStorage.getItem('dailySessionState')
      if (!savedState) return

      try {
        const state = JSON.parse(savedState)
        const results = location.state?.results

        // Restore session state
        setSessionConfig(state.sessionConfig)
        setNewWords(state.newWords)
        setReviewQueue(state.reviewQueue)
        setAssignmentSettings(state.assignmentSettings)
        setReviewTestAttempts(state.reviewTestAttempts || 0)
        // Restore new word test results (needed for session summary to show both scores)
        if (state.newWordTestResults) {
          setNewWordTestResults(state.newWordTestResults)
        }

        // Handle test results
        if (location.state?.testType === 'new') {
          setNewWordTestResults(results)
          setNewWordFailedIds(results?.failed || [])

          if (state.sessionConfig?.isFirstDay) {
            // Day 1: Session was already completed by test component
            // Just update UI to show completion (fetch fresh progress for display)
            const progress = await getClassProgress(user.uid, classId, listId)
            const completedDays = progress?.currentStudyDay ?? 0
            const studyDaysPerWeek = state.assignmentSettings?.studyDaysPerWeek ?? 5
            const programStartDate = progress?.programStartDate?.toDate?.() || progress?.programStartDate
            const expectedDay = calculateExpectedStudyDay(programStartDate, studyDaysPerWeek)
            const difference = completedDays - expectedDay
            setProgressInfo({
              completedDays,
              expectedDay,
              difference,
              isOnTrack: difference >= 0
            })
            setSessionSummary({
              classId,
              listId,
              dayNumber: state.sessionConfig?.dayNumber,
              newWordScore: results?.score,
              reviewScore: null,
              wordsIntroduced: state.newWords?.length || 0,
              wordsReviewed: 0,
              progress
            })
            setPhase(PHASES.COMPLETE)
          } else {
            // Day 2+: Move to review phase (session not complete yet)
            await moveToReviewPhase(state.sessionConfig)
          }
        } else {
          // Review test completed - session was already completed by test component
          setReviewTestResults(results)
          setReviewTestAttempts(prev => prev + 1)

          // Just update UI to show completion (fetch fresh progress for display)
          const progress = await getClassProgress(user.uid, classId, listId)
          const completedDays = progress?.currentStudyDay ?? 0
          const studyDaysPerWeek = state.assignmentSettings?.studyDaysPerWeek ?? 5
          const programStartDate = progress?.programStartDate?.toDate?.() || progress?.programStartDate
          const expectedDay = calculateExpectedStudyDay(programStartDate, studyDaysPerWeek)
          const difference = completedDays - expectedDay
          setProgressInfo({
            completedDays,
            expectedDay,
            difference,
            isOnTrack: difference >= 0
          })
          setSessionSummary({
            classId,
            listId,
            dayNumber: state.sessionConfig?.dayNumber,
            newWordScore: state.newWordTestResults?.score,
            reviewScore: results?.score,
            wordsIntroduced: state.newWords?.length || 0,
            wordsReviewed: state.reviewQueue?.length || 0,
            progress
          })
          setPhase(PHASES.COMPLETE)
        }

        sessionStorage.removeItem('dailySessionState')
      } catch (err) {
        console.error('Failed to restore session state:', err)
        setError('Failed to restore session. Please start over.')
      }
    }

    handleReturnFromTest()
  }, [location.state])

  // ============================================================
  // PHASE 5: Complete
  // ============================================================

  const completeSession = async (configOverride = null, newWordsOverride = null, reviewQueueOverride = null, testResults = null) => {
    try {
      // Use override if provided (when called from handleReturnFromTest before state updates)
      const config = configOverride || sessionConfig
      const wordsIntroduced = newWordsOverride || newWords
      const wordsReviewed = reviewQueueOverride || reviewQueue

      // Extract test results from unified testResults object
      const newWordScore = testResults?.newWordResults?.score ?? null
      const reviewScore = testResults?.reviewResults?.score ?? null
      const newTotal = testResults?.newWordResults?.total ?? 0
      const reviewTotal = testResults?.reviewResults?.total ?? 0
      const reviewFailed = testResults?.reviewResults?.failed || []

      // DEBUG: Log sessionConfig at completion time
      console.log('DEBUG completeSession:', {
        sessionConfigExists: !!config,
        dayNumber: config?.dayNumber,
        wordsIntroduced: wordsIntroduced.length,
        testResults: testResults ? { testType: testResults.testType, score: testResults.score } : null
      })

      const summary = {
        classId,
        listId,
        dayNumber: config?.dayNumber,
        interventionLevel: config?.interventionLevel ?? 0,
        newWordScore,
        reviewScore,
        segment: config?.segment,
        wordsIntroduced: wordsIntroduced.length,
        wordsReviewed: wordsReviewed.length,
        wordsTested: newTotal + reviewTotal
      }

      const result = await recordSessionCompletion(user.uid, summary)

      // Graduate percentage of words from segment after review test
      // Only do this if there was a review test (not Day 1)
      let graduationResult = null
      if (config?.segment && reviewScore != null) {
        graduationResult = await graduateSegmentWords(
          user.uid,
          listId,
          config.segment,
          reviewScore,
          reviewFailed
        )
        console.log(`Graduated ${graduationResult.graduated} words to MASTERED`)
      }

      setSessionSummary({
        ...summary,
        progress: result.progress,
        graduated: graduationResult?.graduated || 0
      })

      // Calculate progress info for "Next" button
      const progress = await getClassProgress(user.uid, classId, listId)
      const completedDays = progress?.currentStudyDay ?? 0
      const studyDaysPerWeek = assignmentSettings?.studyDaysPerWeek ?? 5
      const programStartDate = progress?.programStartDate?.toDate?.() || progress?.programStartDate
      const expectedDay = calculateExpectedStudyDay(programStartDate, studyDaysPerWeek)
      const difference = completedDays - expectedDay
      setProgressInfo({
        completedDays,
        expectedDay,
        difference,
        isOnTrack: difference >= 0
      })

      // Don't clear session state here - wait until user clicks "Back to Dashboard"
      // This prevents auto-restart if component re-mounts while on complete page

      setPhase(PHASES.COMPLETE)

      // If in full simulation mode, trigger next day after delay
      if (sim?.isFullSimulation) {
        setTimeout(() => {
          sim.onSessionComplete()
        }, 1000)
      }
    } catch (err) {
      setError(err.message || 'Failed to record session')
    }
  }

  // ============================================================
  // Re-entry and Move On Handlers
  // ============================================================

  const handleReEntryRetake = () => {
    setShowReEntryModal(false)
    setPhase(PHASES.REVIEW_STUDY)
  }

  const handleReEntryMoveOn = async () => {
    setShowReEntryModal(false)
    await handleMoveToNextDay()
  }

  const handleMoveToNextDay = async () => {
    try {
      // Clear session state for this list
      await clearSessionState(user.uid, classId, listId)
      // Navigate to dashboard
      navigate('/')
    } catch (err) {
      console.error('Failed to move to next day:', err)
    }
  }

  // ============================================================
  // Local Session Recovery Handlers
  // ============================================================

  const handleLocalRecoveryContinue = async () => {
    if (!savedLocalSessionState || !sessionConfig) return

    try {
      const { lastPhase, studyQueue, dismissedWords, currentIndex: savedIndex, isFlipped: savedFlipped } = savedLocalSessionState
      const phaseType = lastPhase === 'NEW_STUDY' ? 'new' : 'review'

      // Load words for the queue
      if (phaseType === 'new') {
        // Re-filter the queue based on saved word IDs
        const queueWordIds = new Set(studyQueue)
        const restoredQueue = newWords.filter(w => queueWordIds.has(w.id))
        setNewWordsQueue(restoredQueue)
        setNewWordsDismissed(new Set(dismissedWords || []))
        setPhase(PHASES.NEW_WORDS)
      } else {
        // Review phase - use full segment for study flashcards
        if (sessionConfig.segment) {
          const allWords = await getSegmentWords(
            user.uid,
            listId,
            sessionConfig.segment.startIndex,
            sessionConfig.segment.endIndex
          )
          setReviewQueue(allWords)

          // Re-filter based on saved state
          const queueWordIds = new Set(studyQueue)
          const restoredQueue = allWords.filter(w => queueWordIds.has(w.id))
          setReviewQueueCurrent(restoredQueue)
          setReviewDismissed(new Set(dismissedWords || []))
        }
        setPhase(PHASES.REVIEW_STUDY)
      }

      setCurrentIndex(Math.min(savedIndex || 0, (studyQueue?.length || 1) - 1))
      setIsFlipped(savedFlipped || false)
    } catch (err) {
      console.error('Failed to restore local session:', err)
      // Fall back to starting fresh
      handleLocalRecoveryStartFresh()
      return
    }

    setSavedLocalSessionState(null)
    setPendingLocalRecovery(false)
  }

  // Auto-restore local session when pendingLocalRecovery is set
  useEffect(() => {
    if (pendingLocalRecovery && savedLocalSessionState && sessionConfig) {
      handleLocalRecoveryContinue()
    }
  }, [pendingLocalRecovery, savedLocalSessionState, sessionConfig])

  const handleLocalRecoveryStartFresh = async () => {
    // Clear local session states
    if (user?.uid && sessionConfig?.dayNumber) {
      const newSessionId = getLocalSessionId(user.uid, classId, listId, sessionConfig.dayNumber, 'new')
      const reviewSessionId = getLocalSessionId(user.uid, classId, listId, sessionConfig.dayNumber, 'review')
      clearLocalSessionState(newSessionId)
      clearLocalSessionState(reviewSessionId)
    }

    setSavedLocalSessionState(null)
    setPendingLocalRecovery(false)

    // Re-run init by triggering effect (navigate to self)
    navigate(`/session/${classId}/${listId}`, { replace: true })
  }

  // ============================================================
  // Confirmation Handlers
  // ============================================================

  const handleQuitConfirm = () => {
    setShowQuitConfirm(false)
    navigate('/')
  }

  const handleTestConfirm = () => {
    setShowTestConfirm(false)
    if (phase === PHASES.NEW_WORDS) {
      goToNewWordTest()
    } else if (phase === PHASES.REVIEW_STUDY) {
      handleFinishReviewStudy()
    }
  }

  const handleResetConfirm = () => {
    setShowResetConfirm(false)
    if (phase === PHASES.NEW_WORDS) {
      handleNewWordReset()
    } else if (phase === PHASES.REVIEW_STUDY) {
      handleReviewReset()
    }
  }

  // Get current counts for confirmation messages
  const currentQueueLength = phase === PHASES.NEW_WORDS ? newWordsQueue.length : reviewQueueCurrent.length
  const currentDismissedCount = phase === PHASES.NEW_WORDS ? newWordsDismissed.size : reviewDismissed.size

  // ============================================================
  // RENDER
  // ============================================================

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base p-4">
        <Watermark />
        <div className="relative z-10 rounded-xl bg-error p-6 text-center">
          <p className="text-text-error">{error}</p>
          <Button onClick={() => navigate('/')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </main>
    )
  }

  if (phase === PHASES.LOADING) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base">
        <Watermark />
        <div className="relative z-10 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="mt-4 text-text-secondary">Preparing your session...</p>
        </div>

      </main>
    )
  }

  return (
    <main className="relative min-h-screen bg-base">
      <Watermark />

      {/* Header with navigation */}
      <SessionHeader
        onBack={() => setShowQuitConfirm(true)}
        backAriaLabel="Quit session"
        stepText={getSessionStep({
          phase,
          isFirstDay: sessionConfig?.isFirstDay
        }).stepText}
        onStepClick={() => setShowProgressSheet(true)}
        rightSlot={
          (phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) ? (
            <div className="flex items-center gap-1">
              {/* Help button */}
              <button
                onClick={() => setShowHelpModal(true)}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-muted transition"
                aria-label="Study help"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* Dismissed words drawer toggle */}
              {dismissedWordsData.filter(w => w.phase === (phase === PHASES.NEW_WORDS ? 'new' : 'review')).length > 0 && (
                <button
                  onClick={() => setShowDismissedDrawer(true)}
                  className="relative p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-muted transition"
                  aria-label="View dismissed words"
                >
                  <ListChecks className="w-5 h-5" />
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-brand-fill text-[10px] font-medium text-white">
                    {dismissedWordsData.filter(w => w.phase === (phase === PHASES.NEW_WORDS ? 'new' : 'review')).length}
                  </span>
                </button>
              )}

              <SessionMenu
                onSkipToTest={() => setShowTestConfirm(true)}
                onDownloadPDF={handlePDFDownload}
                onReset={() => setShowResetConfirm(true)}
                onQuit={() => setShowQuitConfirm(true)}
                showSkipToTest={currentQueueLength > 0}
                showReset={currentDismissedCount > 0}
                generatingPDF={generatingPDF}
                showReviewModeToggle={phase === PHASES.REVIEW_STUDY}
                reviewMode={reviewMode}
                onToggleReviewMode={() => {
                  if (reviewMode === 'fast') {
                    setShowCompleteModeModal(true)
                  } else {
                    setShowFastModeModal(true)
                  }
                }}
                showKoreanDef={showKoreanDef ?? true}
                onToggleKoreanDef={() => setShowKoreanDef(prev => !(prev ?? true))}
                showSampleSentence={showSampleSentence ?? true}
                onToggleSampleSentence={() => setShowSampleSentence(prev => !(prev ?? true))}
              />
            </div>
          ) : null
        }
        // Session context - shown in study phases
        sessionTitle={
          phase === PHASES.NEW_WORDS ? 'New Words Study' :
          phase === PHASES.REVIEW_STUDY ? 'Review Study' :
          undefined
        }
        dayNumber={sessionConfig?.dayNumber || 1}
        // Progress bar - shown in study phases
        progressPercent={
          (phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY)
            ? ((phase === PHASES.NEW_WORDS ? newWordsDismissed.size : reviewDismissed.size) /
               (phase === PHASES.NEW_WORDS ? newWords.length : reviewQueue.length) * 100) || 0
            : undefined
        }
        progressLabel={
          (phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY)
            ? `${phase === PHASES.NEW_WORDS ? newWordsDismissed.size : reviewDismissed.size} of ${phase === PHASES.NEW_WORDS ? newWords.length : reviewQueue.length} mastered`
            : undefined
        }
      />

      {/* Progress Sheet */}
      <SessionProgressSheet
        isOpen={showProgressSheet}
        onClose={() => setShowProgressSheet(false)}
        currentPhase={phase}
        isFirstDay={sessionConfig?.isFirstDay}
        dayNumber={sessionConfig?.dayNumber || 1}
        wordRangeStart={(sessionConfig?.newWordStartIndex || 0) + 1}
        wordRangeEnd={(sessionConfig?.newWordEndIndex || 0) + 1}
        newWordsTestScore={newWordTestResults?.score}
        reviewTestScore={reviewTestResults?.score}
        cardsRemaining={currentQueueLength}
        cardsDismissed={currentDismissedCount}
        totalCards={phase === PHASES.NEW_WORDS ? newWords.length : reviewQueue.length}
      />

      {/* Phase content */}
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8">
        {phase === PHASES.NEW_WORDS && (
          <StudyPhase
            currentWord={currentNewWord}
            currentIndex={currentIndex}
            totalCount={newWordsQueue.length}
            originalTotal={newWords.length}
            dismissedCount={newWordsDismissed.size}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
            onKnowThis={handleNewWordKnowThis}
            onNotSure={handleNewWordNotSure}
            onReadyForTest={goToNewWordTest}
            onStudyAgain={handleNewWordReset}
            onPrev={handleNewWordPrev}
            onNext={handleNewWordNext}
            showKoreanDef={showKoreanDef ?? true}
            showSampleSentence={showSampleSentence ?? true}
          />
        )}

        {phase === PHASES.NEW_WORD_TEST && (
          <div className="text-center">
            {newWordTestResults ? (
              <RetakePrompt
                results={newWordTestResults}
                threshold={sessionConfig?.retakeThreshold}
                onRetake={handleNewWordTestRetake}
                onContinue={handleContinueToReview}
                isFirstDay={sessionConfig?.isFirstDay}
              />
            ) : (
              <div className="space-y-4 mt-6">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
                <p className="text-text-secondary">Loading test...</p>
              </div>
            )}
          </div>
        )}

        {phase === PHASES.REVIEW_STUDY && (
          <StudyPhase
            currentWord={currentReviewWord}
            currentIndex={currentIndex}
            totalCount={reviewQueueCurrent.length}
            originalTotal={reviewQueue.length}
            dismissedCount={reviewDismissed.size}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped(!isFlipped)}
            onKnowThis={handleReviewKnowThis}
            onNotSure={handleReviewNotSure}
            onReadyForTest={handleFinishReviewStudy}
            onStudyAgain={handleReviewReset}
            onPrev={handleReviewPrev}
            onNext={handleReviewNext}
            showKoreanDef={showKoreanDef ?? true}
            showSampleSentence={showSampleSentence ?? true}
          />
        )}

        {phase === PHASES.COMPLETE && (
          <CompletePhase
            summary={sessionSummary}
            sessionConfig={sessionConfig}
            onDashboard={async () => {
              clearAllSessionStates(user.uid, classId, listId)
              await clearSessionState(user.uid, classId, listId)
              navigate('/')
            }}
            progressInfo={progressInfo}
          />
        )}
      </div>

      {/* Quit Confirmation */}
      <ConfirmModal
        isOpen={showQuitConfirm}
        title="Leave Study Session?"
        message="Your study progress will be saved. You can resume later."
        confirmLabel="Leave"
        cancelLabel="Keep Studying"
        onConfirm={handleQuitConfirm}
        onCancel={() => setShowQuitConfirm(false)}
        variant="warning"
      />

      {/* Ready for Test Confirmation */}
      <ConfirmModal
        isOpen={showTestConfirm}
        title="Ready for the Test?"
        message={currentQueueLength > 0
          ? `You still have ${currentQueueLength} cards remaining. If you don't pass, you can study again and retake.`
          : "If you don't pass, you can study again and retake the test."
        }
        confirmLabel="Start Test"
        cancelLabel="Keep Studying"
        onConfirm={handleTestConfirm}
        onCancel={() => setShowTestConfirm(false)}
        variant="warning"
      />

      {/* Reset Confirmation */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Progress?"
        message={`This will restore all ${currentDismissedCount} dismissed cards.`}
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        variant="warning"
      />

      {/* Re-entry Modal */}
      <ConfirmModal
        isOpen={showReEntryModal}
        title={`Resume Day ${savedSessionState?.currentStudyDay || sessionConfig?.dayNumber}?`}
        message={`You scored ${savedSessionState?.reviewTestScore ? Math.round(savedSessionState.reviewTestScore * 100) : reviewTestResults?.score ? Math.round(reviewTestResults.score * 100) : '—'}% on the review test. Would you like to retry the review test or move on to the next day?`}
        confirmLabel="Retry Review Test"
        cancelLabel="Move On to Next Day"
        onConfirm={handleReEntryRetake}
        onCancel={handleReEntryMoveOn}
        variant="info"
      />

      {/* No Review Words Modal */}
      <ConfirmModal
        isOpen={showNoReviewModal}
        title="Review Complete"
        message="No words need review today - all mastered!"
        confirmLabel="OK"
        onConfirm={handleNoReviewModalClose}
        onCancel={handleNoReviewModalClose}
        variant="success"
        showCancel={false}
      />

      {/* Complete Mode Modal */}
      <ReviewModeModal
        isOpen={showCompleteModeModal}
        mode="complete"
        wordCount={sessionConfig?.segment ? (sessionConfig.segment.endIndex - sessionConfig.segment.startIndex + 1) : 0}
        onConfirm={handleSwitchToCompleteMode}
        onCancel={() => setShowCompleteModeModal(false)}
      />

      {/* Fast Mode Modal */}
      <ReviewModeModal
        isOpen={showFastModeModal}
        mode="fast"
        wordCount={sessionConfig?.reviewCount || 0}
        onConfirm={handleSwitchToFastMode}
        onCancel={() => setShowFastModeModal(false)}
      />

      {/* Study Help Modal */}
      <StudyHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      {/* Card Settings Modal (First-time setup) */}
      {showCardSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-info-subtle">
                <svg className="w-7 h-7 text-text-info" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>

            <h3 className="text-center text-lg font-bold text-text-primary">
              Customize Your Flashcards
            </h3>
            <p className="mt-2 text-center text-sm text-text-muted">
              Choose what to show on the back of each card.
            </p>

            {/* Toggle options */}
            <div className="mt-6 space-y-4">
              {/* Korean Definition Toggle */}
              <button
                onClick={() => setShowKoreanDef(prev => !(prev ?? true))}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-muted/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">🇰🇷</span>
                  <span className="text-sm font-medium text-text-primary">Korean Definition</span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${(showKoreanDef ?? true) ? 'bg-brand-primary' : 'bg-border-strong'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform mt-0.5 ${(showKoreanDef ?? true) ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>

              {/* Sample Sentence Toggle */}
              <button
                onClick={() => setShowSampleSentence(prev => !(prev ?? true))}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-muted hover:bg-muted/80 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">💬</span>
                  <span className="text-sm font-medium text-text-primary">Sample Sentence</span>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${(showSampleSentence ?? true) ? 'bg-brand-primary' : 'bg-border-strong'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform mt-0.5 ${(showSampleSentence ?? true) ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-text-faint">
              You can change these anytime in the menu (⋮)
            </p>

            <div className="mt-6">
              <Button
                onClick={() => {
                  // Set defaults if still null
                  if (showKoreanDef === null) setShowKoreanDef(true)
                  if (showSampleSentence === null) setShowSampleSentence(true)
                  setShowCardSettingsModal(false)
                }}
                variant="primary-blue"
                size="lg"
                className="w-full"
              >
                Start Studying
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dismissed Words Drawer */}
      <DismissedWordsDrawer
        isOpen={showDismissedDrawer}
        onClose={() => setShowDismissedDrawer(false)}
        dismissedWords={dismissedWordsData.filter(w => w.phase === (phase === PHASES.NEW_WORDS ? 'new' : 'review'))}
        onRestore={handleUndoDismiss}
        onRestoreAll={handleRestoreAllDismissed}
      />
    </main>
  )
}

// ============================================================
// Sub-components
// ============================================================

function StudyPhase({
  currentWord,
  currentIndex,
  totalCount,
  originalTotal,
  dismissedCount,
  isFlipped,
  onFlip,
  onKnowThis,
  onNotSure,
  onReadyForTest,
  onStudyAgain,
  onPrev,
  onNext,
  showKoreanDef = true,
  showSampleSentence = true
}) {
  const allCardsReviewed = !currentWord

  const handleNotSure = () => {
    onNotSure()
  }

  // Visual feedback state for keyboard presses
  const [pressedButton, setPressedButton] = useState(null) // 'check' | 'notSure' | null

  // Keyboard shortcuts: Space/Up/Down = flip, X = not sure, C = check, Left/Right = navigate
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (!allCardsReviewed) onFlip()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (!allCardsReviewed && onPrev) onPrev()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (!allCardsReviewed && onNext) onNext()
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault()
        if (!allCardsReviewed) {
          setPressedButton('notSure')
          setTimeout(() => setPressedButton(null), 150)
          handleNotSure()
        }
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        if (!allCardsReviewed) {
          setPressedButton('check')
          setTimeout(() => setPressedButton(null), 150)
          onKnowThis()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [allCardsReviewed, onFlip, onKnowThis, onPrev, onNext])

  return (
    <div className="flex flex-col">
      {/* Main content area */}
      <div className="flex flex-col justify-center py-8">
        {allCardsReviewed ? (
          <div className="text-center space-y-6 py-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-subtle">
              <svg className="w-10 h-10 text-text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-text-primary">
                All cards reviewed!
              </p>
              <p className="mt-1 text-sm text-text-muted">
                You're ready to take the test.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Card counter */}
            <p className="text-center text-sm text-text-muted mb-4">
              Card {currentIndex + 1} of {totalCount}
            </p>

            {/* Navigation arrows + Flashcard */}
            <div className="flex items-center gap-2">
              {/* Left arrow */}
              <button
                onClick={onPrev}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-muted active:scale-95 transition flex-shrink-0"
                aria-label="Previous card"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              {/* Flashcard - takes majority of space */}
              <Flashcard
                word={currentWord}
                isFlipped={isFlipped}
                onFlip={onFlip}
                showKoreanDef={showKoreanDef}
                showSampleSentence={showSampleSentence}
              />

              {/* Right arrow */}
              <button
                onClick={onNext}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-muted active:scale-95 transition flex-shrink-0"
                aria-label="Next card"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="pt-5 max-w-sm mx-auto">
        {allCardsReviewed ? (
          <div className="space-y-3">
            <Button onClick={onReadyForTest} variant="primary-blue" size="lg" className="w-full">
              <span className="flex items-center justify-center gap-2">
                Take Test
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Button>
            <Button onClick={onStudyAgain} variant="outline" size="lg" className="w-full">
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Study Again
              </span>
            </Button>
          </div>
        ) : (
          <div className="flex gap-16 justify-center">
            {/* Not Sure - warning X oval */}
            <button
              onClick={handleNotSure}
              className={`w-32 h-16 rounded-full border-2 border-border-warning bg-warning text-text-warning hover:bg-warning-subtle transition flex items-center justify-center ${pressedButton === 'notSure' ? 'scale-95' : 'active:scale-95'}`}
              aria-label="Not sure, study again (X)"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* I Know This - success checkmark oval */}
            <button
              onClick={onKnowThis}
              className={`w-32 h-16 rounded-full border-2 border-border-success bg-success text-text-success hover:bg-success-subtle transition flex items-center justify-center ${pressedButton === 'check' ? 'scale-95' : 'active:scale-95'}`}
              aria-label="I know this word (C)"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function RetakePrompt({ results, threshold, onRetake, onContinue, isFirstDay }) {
  const percentage = Math.round((results?.score || 0) * 100)
  const needsRetake = (results?.score || 0) < threshold

  return (
    <div className="space-y-6 mt-6">
      <div className="rounded-xl bg-surface p-6 shadow ring-1 ring-border-default">
        <p className="text-4xl font-bold text-text-primary">{percentage}%</p>
        <p className="text-text-secondary">
          {results?.correct || 0} of {results?.total || 0} correct
        </p>
      </div>

      {needsRetake && (
        <div className="rounded-lg bg-warning p-4">
          <p className="font-medium text-text-warning-strong">
            Score below {Math.round(threshold * 100)}%
          </p>
          <p className="mt-1 text-sm text-text-warning">
            You need to score at least {Math.round(threshold * 100)}% to continue.
          </p>
        </div>
      )}

      {isFirstDay && !needsRetake && (
        <div className="rounded-lg bg-success p-4">
          <p className="font-medium text-text-success-strong">
            Great job on Day 1!
          </p>
          <p className="mt-1 text-sm text-text-success">
            Since this is your first day, you're done! Starting tomorrow, you'll also review these words.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {needsRetake ? (
          <Button onClick={onRetake} variant="primary-blue" size="lg">
            Study Again & Retake
          </Button>
        ) : (
          <Button onClick={onContinue} variant="primary-blue" size="lg">
            {isFirstDay ? 'Complete Day 1' : 'Continue to Review'}
          </Button>
        )}
      </div>
    </div>
  )
}

function CompletePhase({
  summary,
  sessionConfig,
  onDashboard,
  progressInfo
}) {
  const isFirstDay = sessionConfig?.isFirstDay

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-subtle">
          <span className="text-3xl">✓</span>
        </div>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-text-success">
          Day {summary?.dayNumber || sessionConfig?.dayNumber} Complete
        </p>
        <h2 className="mt-1 text-2xl font-bold text-text-primary">Great Job!</h2>
      </div>

      {/* Progress indicator */}
      {progressInfo && (
        <div className={`rounded-lg px-4 py-2 text-sm font-medium text-center ${
          progressInfo.isOnTrack
            ? progressInfo.difference > 0
              ? 'bg-success text-text-success-strong'
              : 'bg-info text-text-info-strong'
            : 'bg-error text-text-error-strong'
        }`}>
          {progressInfo.isOnTrack
            ? progressInfo.difference > 0
              ? `${progressInfo.difference} day${progressInfo.difference > 1 ? 's' : ''} ahead!`
              : 'On track!'
            : `${Math.abs(progressInfo.difference)} day${Math.abs(progressInfo.difference) > 1 ? 's' : ''} behind`}
        </div>
      )}

      {/* Day 1 Message */}
      {isFirstDay && (
        <div className="rounded-lg bg-info p-4">
          <p className="font-medium text-text-info-strong">
            Welcome to your first day!
          </p>
          <p className="mt-1 text-sm text-text-info">
            Starting tomorrow, you'll also review these words to help you remember them long-term.
          </p>
        </div>
      )}

      {/* Session Summary */}
      <SessionSummaryCard
        summary={summary}
        sessionConfig={sessionConfig}
      />

      {/* Action Button */}
      <div className="pt-4">
        <Button onClick={onDashboard} variant="primary" size="lg" className="w-full">
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}

function ReviewModeModal({ isOpen, mode, wordCount, onConfirm, onCancel }) {
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isComplete = mode === 'complete'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop - click to close */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
            isComplete ? 'bg-info-subtle' : 'bg-warning-subtle'
          }`}>
            <span className="text-2xl">{isComplete ? '📚' : '⚡'}</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              {isComplete ? 'Complete Review Mode' : 'Fast Review Mode'}
            </h3>
            <p className="text-sm text-text-muted">
              {isComplete ? `${wordCount} words in this segment` : `~${wordCount} priority words`}
            </p>
          </div>
        </div>

        <div className={`mb-6 rounded-lg p-4 ${
          isComplete ? 'bg-info' : 'bg-warning'
        }`}>
          {isComplete ? (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-text-info-strong">
                Review every word in the segment
              </p>
              <p className="text-text-info">
                This is more work, but leads to better retention over time.
                Recommended if you're struggling with review tests.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-text-warning-strong">
                Smart selection based on your performance
              </p>
              <p className="text-text-warning">
                If you're doing well on tests, this minimal review is sufficient.
                Focuses on words you've struggled with.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button onClick={onCancel} variant="outline" size="lg" className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant={isComplete ? 'primary-blue' : 'primary'}
            size="lg"
            className="flex-1"
          >
            {isComplete ? 'Switch to Complete' : 'Switch to Fast'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StudyHelpModal({ isOpen, onClose }) {
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - click to close */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-surface p-6 shadow-xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-text-primary">How Study Works</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Goal */}
        <div className="mb-5">
          <h4 className="font-semibold text-text-primary mb-2">Goal</h4>
          <p className="text-sm text-text-secondary">
            Review each flashcard and mark whether you know the word or need more practice.
          </p>
        </div>

        {/* Buttons */}
        <div className="mb-5">
          <h4 className="font-semibold text-text-primary mb-2">Buttons</h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-success border-2 border-border-success flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span className="text-text-secondary">You know this word. It&apos;s removed from queue.</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-warning border-2 border-border-warning flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
              <span className="text-text-secondary">You&apos;re not sure. It&apos;s shown again later.</span>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="mb-5">
          <h4 className="font-semibold text-text-primary mb-2">Keyboard Shortcuts</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted text-text-muted font-mono text-xs">Space</kbd>
              <span className="text-text-secondary">Flip card</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted text-text-muted font-mono text-xs">↑ ↓</kbd>
              <span className="text-text-secondary">Flip card</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted text-text-muted font-mono text-xs">C</kbd>
              <span className="w-6 h-6 rounded-full bg-success border border-border-success flex items-center justify-center">
                <svg className="w-3 h-3 text-text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted text-text-muted font-mono text-xs">X</kbd>
              <span className="w-6 h-6 rounded-full bg-warning border border-border-warning flex items-center justify-center">
                <svg className="w-3 h-3 text-text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-muted text-text-muted font-mono text-xs">← →</kbd>
              <span className="text-text-secondary">Browse cards</span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <h4 className="font-semibold text-text-primary mb-2">Progress Bar</h4>
          <p className="text-sm text-text-secondary">
            Shows how many words you&apos;ve marked as &quot;known.&quot; Once all cards are reviewed,
            you can take the test or study again.
          </p>
        </div>

        {/* Close button */}
        <div className="flex justify-center">
          <Button onClick={onClose} variant="primary-blue" size="lg" className="w-1/4">
            Got it
          </Button>
        </div>
      </div>
    </div>
  )
}
