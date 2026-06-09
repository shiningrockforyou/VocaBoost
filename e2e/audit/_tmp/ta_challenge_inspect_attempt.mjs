/**
 * Inspect the specific attempt we'll use for challenges
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const serviceAccount = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
const app = initializeApp({ credential: cert(serviceAccount), projectId: 'vocaboost-879c2' })
const db = getFirestore(app)

const ATTEMPT_ID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780179723493_o00czrkub'
const PERSONA_UID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3'
const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'

async function main() {
  const snap = await db.doc(`attempts/${ATTEMPT_ID}`).get()
  if (!snap.exists) {
    console.log('Attempt not found!')
    process.exit(1)
  }

  const d = snap.data()
  console.log('=== Attempt Detail ===')
  console.log('studentId:', d.studentId)
  console.log('teacherId:', d.teacherId)
  console.log('classId:', d.classId)
  console.log('listId:', d.listId)
  console.log('testId:', d.testId)
  console.log('sessionType:', d.sessionType)
  console.log('studyDay:', d.studyDay)
  console.log('testType:', d.testType)
  console.log('score:', d.score)
  console.log('passed:', d.passed)
  console.log('totalQuestions:', d.totalQuestions)
  console.log('completedAt:', d.completedAt?.toDate?.()?.toISOString() || 'missing')
  console.log('\nAnswers (25):')
  const answers = d.answers || []
  answers.forEach((a, i) => {
    console.log(`  [${i}] wordId=${a.wordId}, word="${a.word || a.englishWord}", isCorrect=${a.isCorrect}, response="${a.studentResponse || a.studentAnswer}", challengeStatus=${a.challengeStatus || 'none'}`)
  })

  // Check class_progress for both formats
  console.log('\n=== Class Progress docs ===')
  const cp1 = await db.doc(`users/${PERSONA_UID}/class_progress/${CLASS_ID}`).get()
  if (cp1.exists) {
    const d1 = cp1.data()
    console.log(`[${CLASS_ID}] currentStudyDay=${d1.currentStudyDay}, TWI=${d1.totalWordsIntroduced}`)
  }

  const listId = d.listId
  if (listId) {
    const progressId = `${CLASS_ID}_${listId}`
    const cp2 = await db.doc(`users/${PERSONA_UID}/class_progress/${progressId}`).get()
    if (cp2.exists) {
      const d2 = cp2.data()
      console.log(`[${progressId}] currentStudyDay=${d2.currentStudyDay}, TWI=${d2.totalWordsIntroduced}`)
    } else {
      console.log(`[${progressId}] NOT FOUND`)
    }
  }

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
