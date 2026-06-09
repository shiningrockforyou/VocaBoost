/**
 * TA-CHALLENGE audit: Read-only preflight via Admin SDK
 * Checks audit_careful_01_core persona's attempts, tokens, CSD
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const serviceAccount = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'vocaboost-879c2'
})

const db = getFirestore(app)

const PERSONA_UID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3'
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt' // CORE OFFLINE

async function main() {
  console.log('=== TA-CHALLENGE Preflight ===\n')

  // 1. Check user document (tokens, challenges.history)
  const userRef = db.doc(`users/${PERSONA_UID}`)
  const userSnap = await userRef.get()
  if (!userSnap.exists) {
    console.error('ERROR: User not found:', PERSONA_UID)
    process.exit(1)
  }

  const userData = userSnap.data()
  console.log('--- User Document ---')
  console.log('displayName:', userData.displayName || userData.name)
  console.log('email:', userData.email)

  const challengeHistory = userData.challenges?.history || []
  console.log('\n--- Challenge Tokens ---')
  console.log('challenges.history entries:', challengeHistory.length)

  // Calculate available tokens
  const now = Date.now()
  const activeRejections = challengeHistory.filter(h => {
    if (h.status !== 'rejected') return false
    const replenishAt = h.replenishAt?.toMillis ? h.replenishAt.toMillis() : 0
    return replenishAt > now
  })
  const availableTokens = Math.max(0, 5 - activeRejections.length)
  console.log('Active rejections (within 30d):', activeRejections.length)
  console.log('Available tokens:', availableTokens, '(max 5)')

  challengeHistory.forEach((h, i) => {
    const challengedAt = h.challengedAt?.toDate ? h.challengedAt.toDate().toISOString() : 'unknown'
    const replenishAt = h.replenishAt?.toDate ? h.replenishAt.toDate().toISOString() : 'unknown'
    console.log(`  [${i}] attemptId=${h.attemptId}, wordId=${h.wordId}, status=${h.status}, challengedAt=${challengedAt}`)
  })

  // 2. Check class_progress for CORE OFFLINE
  const progressRefs = await db.collection(`users/${PERSONA_UID}/class_progress`).get()
  console.log('\n--- Class Progress ---')
  progressRefs.forEach(docSnap => {
    const d = docSnap.data()
    console.log(`  [${docSnap.id}] currentStudyDay=${d.currentStudyDay}, TWI=${d.totalWordsIntroduced}, lastSessionAt=${d.lastSessionAt?.toDate?.()?.toISOString() || 'null'}`)
  })

  // 3. Check attempts for this persona — query by studentId only (no compound index needed)
  const attemptsQuery = await db.collection('attempts')
    .where('studentId', '==', PERSONA_UID)
    .get()

  const allAttempts = attemptsQuery.docs.map(d => ({ id: d.id, ...d.data() }))
  // Filter by classId in JS
  const coreAttempts = allAttempts.filter(a => a.classId === CLASS_ID)
  // Sort by completedAt desc
  coreAttempts.sort((a, b) => {
    const aMs = a.completedAt?.toMillis ? a.completedAt.toMillis() : 0
    const bMs = b.completedAt?.toMillis ? b.completedAt.toMillis() : 0
    return bMs - aMs
  })

  console.log(`\n--- All Attempts (CORE OFFLINE only, total=${coreAttempts.length}) ---`)

  coreAttempts.forEach(d => {
    const completedAt = d.completedAt?.toDate ? d.completedAt.toDate().toISOString() : 'unknown'
    const answers = d.answers || []
    const correctCount = answers.filter(a => a.isCorrect).length
    const pendingChallenges = answers.filter(a => a.challengeStatus === 'pending').length
    const acceptedChallenges = answers.filter(a => a.challengeStatus === 'accepted').length
    const incorrectNoChallengeCount = answers.filter(a => !a.isCorrect && !a.challengeStatus).length

    console.log(`\n  ID: ${d.id}`)
    console.log(`    testId: ${d.testId || '—'}`)
    console.log(`    sessionType: ${d.sessionType}, studyDay: ${d.studyDay}, testType: ${d.testType}`)
    console.log(`    score: ${d.score}, passed: ${d.passed}, totalQuestions: ${d.totalQuestions}`)
    console.log(`    correct: ${correctCount}/${answers.length}`)
    console.log(`    completedAt: ${completedAt}`)
    console.log(`    pendingChallenges: ${pendingChallenges}, acceptedChallenges: ${acceptedChallenges}`)
    console.log(`    incorrectUnchallenged: ${incorrectNoChallengeCount}`)

    // Show challengeable answers for typed tests
    if (d.testType === 'typed') {
      const challengeable = answers.filter(a => !a.isCorrect && !a.challengeStatus)
      challengeable.slice(0, 5).forEach((a, i) => {
        console.log(`      Challengeable[${i}]: wordId=${a.wordId}, word="${a.word || a.englishWord || '?'}", response="${a.studentResponse || a.studentAnswer || '?'}"`)
      })
    }
  })

  // 4. Session states
  const sessionRefs = await db.collection(`users/${PERSONA_UID}/session_states`).get()
  console.log('\n--- Session States ---')
  sessionRefs.forEach(docSnap => {
    const d = docSnap.data()
    console.log(`  [${docSnap.id}] phase=${d.phase}, newWordsTestPassed=${d.newWordsTestPassed}`)
  })

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
