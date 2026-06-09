/**
 * Check who owns the class, who is the teacher for the persona, and class membership
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
const PERSONA_UID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3'
const UNKNOWN_TEACHER_ID = '9OcxdnYCCGZYOrzfs09pUTUoDOR2'

async function main() {
  // Identify the unknown teacherId
  try {
    const u = await auth.getUser(UNKNOWN_TEACHER_ID)
    console.log('Unknown teacherId user:', u.email, '/', u.displayName)
  } catch (e) {
    console.log('Could not resolve teacherId 9Ocxdn...:', e.message)
  }

  // Check class members
  const membersSnap = await db.collection(`classes/${CLASS_ID}/members`).get()
  console.log(`\nClass members (${membersSnap.docs.length}):`)
  membersSnap.docs.forEach(d => {
    console.log(`  uid=${d.id}, role=${d.data().role}, name=${d.data().displayName || d.data().name}`)
  })

  // Check class document for teacher field variations
  const classSnap = await db.doc(`classes/${CLASS_ID}`).get()
  const classData = classSnap.data()
  console.log('\nClass data keys:', Object.keys(classData))
  console.log('createdBy:', classData.createdBy)
  console.log('teacherId:', classData.teacherId)
  console.log('owner:', classData.owner)

  // Check user's class membership
  const memberSnap = await db.doc(`classes/${CLASS_ID}/members/${PERSONA_UID}`).get()
  if (memberSnap.exists) {
    console.log('\nPersona membership:', memberSnap.data())
  }

  // Also check Gradebook query - how does the gradebook fetch teacherId?
  // Let's look at what the attempt's teacherId field is
  const attemptSnap = await db.doc(`attempts/fNDvwIEDXphlv8BD4rxYygHOSvD3_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780179723493_o00czrkub`).get()
  const attemptData = attemptSnap.data()
  console.log('\nAttempt teacherId:', attemptData.teacherId)
  console.log('All keys in attempt:', Object.keys(attemptData).join(', '))

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
