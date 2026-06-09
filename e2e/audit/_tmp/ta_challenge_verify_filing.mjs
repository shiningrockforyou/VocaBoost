/**
 * Verify challenge was correctly filed in user doc
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const serviceAccount = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf-8'))
const app = initializeApp({ credential: cert(serviceAccount), projectId: 'vocaboost-879c2' })
const db = getFirestore(app)

const PERSONA_UID = 'fNDvwIEDXphlv8BD4rxYygHOSvD3'

async function main() {
  const userSnap = await db.doc(`users/${PERSONA_UID}`).get()
  const userData = userSnap.data()
  const challengeHistory = userData.challenges?.history || []

  console.log('=== User Challenge State Post-Filing ===')
  console.log('challenges.history entries:', challengeHistory.length)

  const now = Date.now()
  const activeRejections = challengeHistory.filter(h => {
    if (h.status !== 'rejected') return false
    const t = h.replenishAt?.toMillis ? h.replenishAt.toMillis() : 0
    return t > now
  })
  const availableTokens = Math.max(0, 5 - activeRejections.length)
  console.log('Active rejections:', activeRejections.length)
  console.log('Available tokens:', availableTokens)

  challengeHistory.forEach((h, i) => {
    const challengedAt = h.challengedAt?.toDate ? h.challengedAt.toDate().toISOString() : 'unknown'
    const replenishAt = h.replenishAt?.toDate ? h.replenishAt.toDate().toISOString() : 'unknown'
    console.log(`  [${i}] attemptId=${h.attemptId}`)
    console.log(`       wordId=${h.wordId}`)
    console.log(`       status=${h.status}`)
    console.log(`       challengedAt=${challengedAt}`)
    console.log(`       replenishAt=${replenishAt}`)
  })

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
