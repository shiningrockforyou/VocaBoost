import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const UID='NqqT2iXB1yMUZtiUbYd3vbWGdiu1'
const cp = await db.doc(`users/${UID}/class_progress/k8tzOiiwotBbtJS3uTiv_8RMews2H7C3UJUAsOBzR`).get()
const d = cp.data()
console.log('currentStudyDay:', d.currentStudyDay)
console.log('totalWordsIntroduced:', d.totalWordsIntroduced)
console.log('lastStudyDate:', d.lastStudyDate?._seconds ? new Date(d.lastStudyDate._seconds*1000).toISOString() : d.lastStudyDate)
console.log('streakDays:', d.streakDays)
console.log('recentSessions:', JSON.stringify(d.recentSessions))
// study states
const ss = (await db.collection(`users/${UID}/study_states`).get()).docs
const hist={}; for (const x of ss){const s=x.data().status||'?';hist[s]=(hist[s]||0)+1}
console.log('study_states:', JSON.stringify(hist))
const mastered = ss.filter(x=>x.data().status==='MASTERED')
console.log('MASTERED count:', mastered.length)
if (mastered[0]) console.log('  sample returnAt:', new Date(mastered[0].data().returnAt._seconds*1000).toISOString())
