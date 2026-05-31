import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const UID='NqqT2iXB1yMUZtiUbYd3vbWGdiu1'
const atts = (await db.collection('attempts').where('studentId','==',UID).get()).docs
const review = atts.find(d => d.data().sessionType === 'review')
if (!review) { console.log('no review attempt'); process.exit(0) }
const data = review.data()
console.log('Review attempt id:', review.id)
console.log('Top-level fields:', Object.keys(data).join(', '))
for (const k of Object.keys(data)) {
  const v = data[k]
  if (Array.isArray(v)) {
    console.log(`  ${k}: array[${v.length}]`)
    if (v.length) console.log('    [0]:', JSON.stringify(v[0]).substring(0, 300))
  } else if (typeof v === 'object' && v !== null && !v._seconds) {
    console.log(`  ${k}: object keys=${Object.keys(v).join(',')}`)
  } else {
    console.log(`  ${k}:`, JSON.stringify(v).substring(0, 100))
  }
}
