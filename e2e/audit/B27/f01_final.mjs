import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf-8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()
const UID='NqqT2iXB1yMUZtiUbYd3vbWGdiu1'
const WC = JSON.parse(readFileSync('/app/e2e/audit/B27/word_position_cache.json','utf-8'))
const POS={}; for(const w of WC) POS[w.id]=w.position
const atts=(await db.collection('attempts').where('studentId','==',UID).get()).docs
const review=atts.find(d=>d.data().sessionType==='review')
const d=review.data()
const positions=d.answers.map(a=>POS[a.wordId]).filter(p=>p!=null)
const seg=[d.segmentStartIndex,d.segmentEndIndex]
const inSeg=positions.filter(p=>p>=seg[0]&&p<=seg[1])
const outSeg=positions.filter(p=>p<seg[0]||p>seg[1])
console.log('Day2 review: '+positions.length+' words, segment ['+seg[0]+','+seg[1]+']')
console.log('  in-segment:', inSeg.length, '| out-of-segment:', outSeg.length, outSeg.length?JSON.stringify(outSeg):'')
console.log('  pos min/max:', Math.min(...positions), Math.max(...positions))
console.log('F01_LEAK_OUT_OF_SEGMENT:', outSeg.length)
