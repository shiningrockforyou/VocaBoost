/**
 * CS-2026-07-16: set csd to the genuinely-completed day (max D with passed-new AND passed-review),
 * non-demoting — for reset students stuck off-by-one after doing review-before-new (completion never
 * fired). Handles non-clean twi (partial reset days) that fix-csd-undercount's cleanBoundary guard skips.
 *   node scripts/cs/fix-csd-to-completed.mjs <email> [...] [--commit]
 */
import admin from 'firebase-admin'; import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db=admin.firestore(); const auth=admin.auth(); const T=admin.firestore.Timestamp;
const COMMIT=process.argv.includes('--commit');
for(const email of process.argv.slice(2).filter(a=>a.includes('@'))){
  let uid; try{uid=(await auth.getUserByEmail(email)).uid;}catch{console.log(`${email}: NF`);continue;}
  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  const latest=at.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m);
  const listId=latest.listId, classId=latest.classId;
  const la=at.filter(a=>a.listId===listId);
  const pnD=new Set(la.filter(a=>a.sessionType==='new'&&a.passed).map(a=>a.studyDay));
  const prD=new Set(la.filter(a=>a.sessionType==='review'&&a.passed).map(a=>a.studyDay));
  const complete=[...pnD].filter(d=>prD.has(d));
  const genuineDay=complete.length?Math.max(...complete):0;
  const ref=db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`);
  const p=(await ref.get()).data(); const csd=p.currentStudyDay||0;
  console.log(`${email}: csd=${csd} genuineCompletedDay=${genuineDay} twi=${p.totalWordsIntroduced} → ${genuineDay>csd?`SET csd=${genuineDay}`:'no change'}`);
  if(COMMIT && genuineDay>csd){
    await ref.set({currentStudyDay:genuineDay, csdFixNote:`CS-2026-07-16: off-by-one (review-before-new after reset) — csd ${csd}→${genuineDay} (day complete: new+review)`, updatedAt:T.now()},{merge:true});
    const ss=db.collection('users').doc(uid).collection('session_states').doc(`${classId}_${listId}`);
    if((await ss.get()).exists) await ss.delete();
    console.log(`  ✅ csd=${genuineDay}, session cleared`);
  }
}
process.exit(0);
