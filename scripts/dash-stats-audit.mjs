import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const EMAIL='audit_careful_01_top@vocaboost.test';
const us=await db.collection('users').where('email','==',EMAIL).get();
if(us.empty){console.log('no user');process.exit(0);}
const uid=us.docs[0].id;
// find their active class_progress
const cps=await db.collection('users').doc(uid).collection('class_progress').get();
for(const d of cps.docs){
  const p=d.data();
  console.log(`\n=== class_progress ${d.id} ===`);
  console.log('currentStudyDay:', p.currentStudyDay, '| totalWordsIntroduced:', p.totalWordsIntroduced, '| streakDays:', p.streakDays);
  console.log('stats:', JSON.stringify(p.stats), '| lastStudyDate:', p.lastStudyDate?.toDate?.().toISOString().slice(0,10));
  console.log('recentSessions (last 3):', JSON.stringify((p.recentSessions||[]).slice(-3).map(s=>({day:s.day,nw:s.newWordScore,rev:s.reviewScore}))));
}
// what a REAL "mastered" count would be (study_states status distribution)
const ss=await db.collection('users').doc(uid).collection('study_states').get();
const byStatus={};
ss.forEach(d=>{const s=d.data().status||'?'; byStatus[s]=(byStatus[s]||0)+1;});
console.log('\n=== study_states status distribution (what real "Mastered"/"Needs review" would be) ===');
console.log('total study_states:', ss.size, '|', JSON.stringify(byStatus));
process.exit(0);
