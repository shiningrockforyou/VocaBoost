/**
 * Check ownerTeacherId for the class
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
const TA_UID = 'coJxSKLgUyXkTicsCwFigsPgfnx2'

async function main() {
  const classSnap = await db.doc(`classes/${CLASS_ID}`).get()
  const d = classSnap.data()
  console.log('ownerTeacherId:', d.ownerTeacherId)

  // Resolve ownerTeacherId
  if (d.ownerTeacherId) {
    try {
      const u = await auth.getUser(d.ownerTeacherId)
      console.log('ownerTeacherId email:', u.email, '/', u.displayName)
      console.log('Is ta@:', d.ownerTeacherId === TA_UID)
    } catch(e) {
      console.log('Error resolving ownerTeacherId:', e.message)
    }
  }

  // Check ta@'s user doc for classes they own
  const taSnap = await db.doc(`users/${TA_UID}`).get()
  if (taSnap.exists) {
    const ta = taSnap.data()
    console.log('\nta@ user doc:')
    console.log('displayName:', ta.displayName || ta.name)
    console.log('role:', ta.role)
    console.log('classes:', ta.classes || 'none')
  }

  // Check for teacher's classes collection
  const taClassesSnap = await db.collection('classes')
    .where('ownerTeacherId', '==', TA_UID)
    .get()
  console.log(`\nClasses owned by ta@ (ownerTeacherId): ${taClassesSnap.docs.length}`)
  taClassesSnap.docs.forEach(d => {
    console.log(`  ${d.id}: ${d.data().name}`)
  })

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
