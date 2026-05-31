/**
 * Authoritative F01 verification from Firestore review-attempt docs.
 * For each review attempt, read its `results[].wordId`, map to position + study_state,
 * and check whether any tested word was MASTERED with a future returnAt (= F01 leak).
 *
 * READ-ONLY. Run after the walk completes.
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const UID='NqqT2iXB1yMUZtiUbYd3vbWGdiu1'

const WORD_CACHE = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json','utf-8'))
const POS_BY_ID = {}
for (const w of WORD_CACHE) POS_BY_ID[w.id] = w.position

// Read all study_states (current snapshot)
const ssDocs = (await db.collection(`users/${UID}/study_states`).get()).docs
const stateById = {}
for (const d of ssDocs) {
  const data = d.data()
  stateById[d.id] = {
    status: data.status,
    returnAtMs: data.returnAt?._seconds ? data.returnAt._seconds * 1000 : null,
    wordIndex: data.wordIndex
  }
}

// Read all review attempts
const atts = (await db.collection('attempts').where('studentId','==',UID).get()).docs
const reviews = atts.filter(d => d.data().sessionType === 'review').sort((a,b) => a.data().studyDay - b.data().studyDay)

console.log(`Found ${reviews.length} review attempts`)
let totalLeaks = 0
const leakDays = []

for (const r of reviews) {
  const data = r.data()
  const day = data.studyDay
  const results = data.results || []
  const testedWordIds = results.map(x => x.wordId).filter(Boolean)
  let masteredInReview = 0
  const masteredSamples = []
  for (const wid of testedWordIds) {
    const st = stateById[wid]
    if (st && st.status === 'MASTERED') {
      // NOTE: status is the CURRENT snapshot, not at-test-time. A word MASTERED now
      // that was tested in review could indicate F01 OR could have been graduated AFTER.
      masteredInReview++
      masteredSamples.push({ wordId: wid, pos: POS_BY_ID[wid], returnAtMs: st.returnAtMs })
    }
  }
  console.log(`Day ${day} review: ${testedWordIds.length} words tested, score=${data.score}, currently-MASTERED-among-tested=${masteredInReview}`)
  if (masteredSamples.length) console.log('  samples:', JSON.stringify(masteredSamples.slice(0,3)))
  if (masteredInReview > 0) { totalLeaks++; leakDays.push(day) }
}

console.log(`\nNOTE: This uses CURRENT study_state status (post-walk), which over-counts:`)
console.log(`a word legitimately tested in review can be graduated to MASTERED AFTER that review.`)
console.log(`The authoritative F01 signal is in the per-session evidence (masteredInReviewThisDay`)
console.log(`computed at session time). leakDays(current-snapshot, upper bound): ${leakDays.join(', ') || 'none'}`)
