/**
 * TA-CHALLENGE audit: Read-only preflight via Admin SDK
 * Checks audit_careful_01_core persona's attempts, tokens, CSD
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const serviceAccount = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: 'vocaboost-879c2'
})

const db = getFirestore(app)

const PERSONA_UID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3'
const PERSONA_EMAIL = 'audit_careful_01_core@vocaboost.test'
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt' // CORE OFFLINE
const CLASS_NAME = '25WT 2차 CORE OFFLINE'

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

  // Calculate available tokens (same logic as getAvailableChallengeTokens)
  const now = Date.now()
  const activeRejections = challengeHistory.filter(h => {
    if (h.status !== 'rejected') return false
    const replenishAt = h.replenishAt?.toMillis ? h.replenishAt.toMillis() : 0
    return replenishAt > now
  })
  const availableTokens = Math.max(0, 5 - activeRejections.length)
  console.log('Active rejections (within 30d):', activeRejections.length)
  console.log('Available tokens:', availableTokens, '(max 5)')

  // Print full history
  challengeHistory.forEach((h, i) => {
    const challengedAt = h.challengedAt?.toDate ? h.challengedAt.toDate().toISOString() : 'unknown'
    const replenishAt = h.replenishAt?.toDate ? h.replenishAt.toDate().toISOString() : 'unknown'
    console.log(`  [${i}] attemptId=${h.attemptId}, wordId=${h.wordId}, status=${h.status}, challengedAt=${challengedAt}, replenishAt=${replenishAt}`)
  })

  // 2. Check class_progress for CORE OFFLINE
  const progressRefs = await db.collection(`users/${PERSONA_UID}/class_progress`).get()
  console.log('\n--- Class Progress ---')
  progressRefs.forEach(doc => {
    const d = doc.data()
    console.log(`  [${doc.id}] currentStudyDay=${d.currentStudyDay}, TWI=${d.totalWordsIntroduced}, lastSessionAt=${d.lastSessionAt?.toDate?.()?.toISOString() || 'null'}`)
  })

  // 3. Check attempts for this persona in CORE OFFLINE class
  const attemptsQuery = await db.collection('attempts')
    .where('studentId', '==', PERSONA_UID)
    .where('classId', '==', CLASS_ID)
    .orderBy('completedAt', 'desc')
    .limit(10)
    .get()

  console.log('\n--- Recent Attempts (CORE OFFLINE) ---')
  console.log(`Found ${attemptsQuery.docs.length} attempts`)

  attemptsQuery.docs.forEach(doc => {
    const d = doc.data()
    const completedAt = d.completedAt?.toDate ? d.completedAt.toDate().toISOString() : 'unknown'
    const answers = d.answers || []
    const correctCount = answers.filter(a => a.isCorrect).length
    const pendingChallenges = answers.filter(a => a.challengeStatus === 'pending').length
    const acceptedChallenges = answers.filter(a => a.challengeStatus === 'accepted').length
    const incorrectNoChallengeCount = answers.filter(a => !a.isCorrect && !a.challengeStatus).length

    console.log(`\n  ID: ${doc.id}`)
    console.log(`    testId: ${d.testId || '—'}`)
    console.log(`    sessionType: ${d.sessionType}, studyDay: ${d.studyDay}`)
    console.log(`    testType: ${d.testType}`)
    console.log(`    score: ${d.score}, passed: ${d.passed}, totalQuestions: ${d.totalQuestions}`)
    console.log(`    correct: ${correctCount}/${answers.length}`)
    console.log(`    completedAt: ${completedAt}`)
    console.log(`    pendingChallenges: ${pendingChallenges}, acceptedChallenges: ${acceptedChallenges}`)
    console.log(`    incorrectUnchallenged: ${incorrectNoChallengeCount}`)

    if (incorrectNoChallengeCount > 0 && d.testType === 'typed') {
      const challengeable = answers.filter(a => !a.isCorrect && !a.challengeStatus)
      challengeable.slice(0, 3).forEach((a, i) => {
        console.log(`      Challengeable[${i}]: wordId=${a.wordId}, word="${a.word || a.englishWord}", studentResponse="${a.studentResponse || a.studentAnswer}"`)
      })
    }
  })

  // 4. Check session_states
  const sessionRefs = await db.collection(`users/${PERSONA_UID}/session_states`).get()
  console.log('\n--- Session States ---')
  sessionRefs.forEach(doc => {
    const d = doc.data()
    console.log(`  [${doc.id}] phase=${d.phase}, newWordsTestPassed=${d.newWordsTestPassed}`)
  })

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
