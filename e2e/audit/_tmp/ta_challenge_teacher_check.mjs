/**
 * Verify the teacher account and class data
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { readFileSync } from 'fs'

const serviceAccount = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
const app = initializeApp({ credential: cert(serviceAccount), projectId: 'vocaboost-879c2' })
const db = getFirestore(app)
const auth = getAuth(app)

const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt'
const TA_EMAIL = 'ta@vocaboost.com'

async function main() {
  // Look up ta@ UID
  try {
    const taUser = await auth.getUserByEmail(TA_EMAIL)
    console.log('ta@ UID:', taUser.uid)
    console.log('ta@ displayName:', taUser.displayName)

    // Verify against attempt teacherId
    const ATTEMPT_TEACHER_ID = '9OcxdnYCCGZYOrzfs09pUTUoDOR2'
    console.log('Attempt teacherId matches ta@:', taUser.uid === ATTEMPT_TEACHER_ID)
  } catch (e) {
    console.log('Error looking up ta@:', e.message)
  }

  // Check class document
  const classSnap = await db.doc(`classes/${CLASS_ID}`).get()
  if (classSnap.exists) {
    const d = classSnap.data()
    console.log('\nClass:', d.name || d.className)
    console.log('teacherId:', d.teacherId)
    const assignments = d.assignments || {}
    const listIds = Object.keys(assignments)
    console.log('Assignments:', listIds.length)
    listIds.forEach(lid => {
      const a = assignments[lid]
      console.log(`  [${lid}] passThreshold=${a.passThreshold}, pace=${a.pace}`)
    })
  } else {
    console.log('Class NOT FOUND:', CLASS_ID)
  }

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
