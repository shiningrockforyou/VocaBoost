import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const UID='NqqT2iXB1yMUZtiUbYd3vbWGdiu1'

// session_states subcollection
const ss = await db.collection(`users/${UID}/session_states`).get()
console.log('session_states docs:', ss.size)
for (const d of ss.docs) {
  const data = d.data()
  console.log('  id:', d.id)
  console.log('  keys:', Object.keys(data).join(', '))
  for (const k of Object.keys(data)) {
    let v = data[k]
    if (v && v._seconds) v = new Date(v._seconds*1000).toISOString()
    else if (Array.isArray(v)) v = `array[${v.length}]`
    else if (typeof v === 'object' && v !== null) v = 'obj{'+Object.keys(v).join(',')+'}'
    console.log(`    ${k}:`, JSON.stringify(v).substring(0,120))
  }
}

// class_progress
const cp = (await db.doc(`users/${UID}/class_progress/k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR`).get()).data()
console.log('\nclass_progress CSD:', cp.currentStudyDay, 'TWI:', cp.totalWordsIntroduced)

// NEEDS_CHECK sample
const wss = (await db.collection(`users/${UID}/study_states`).get()).docs
const nc = wss.filter(d=>d.data().status==='NEEDS_CHECK')
console.log('\nNEEDS_CHECK count:', nc.length)
if (nc[0]) {
  const d = nc[0].data()
  console.log('  sample:', JSON.stringify({wordIndex:d.wordIndex, status:d.status, masteredAt: d.masteredAt?._seconds?new Date(d.masteredAt._seconds*1000).toISOString():d.masteredAt, returnAt: d.returnAt?._seconds?new Date(d.returnAt._seconds*1000).toISOString():d.returnAt}))
}
