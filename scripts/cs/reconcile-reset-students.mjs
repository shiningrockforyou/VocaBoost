/**
 * CS-2026-07-16: reconcile the 58 throttle-reset students back to reality now that the #11 fix is
 * DEPLOYED (David: option a). The 07-15 resets wrote SYNTHETIC recentSessions ([0.5,0.5,0.5]) → phantom
 * "records" + partial-day/off-by-one artifacts. This rebuilds recentSessions from REAL attempts (honest
 * display), recomputes interventionLevel from REAL reviews (low-retention students will throttle again —
 * but the deployed fix makes review-only days completable), sets csd non-demoting = max(csd, genuine
 * completed day), clears session_state. Backup per student.
 *   node scripts/cs/reconcile-reset-students.mjs [--commit]
 */
import admin from 'firebase-admin'; import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db=admin.firestore(); const T=admin.firestore.Timestamp;
const COMMIT=process.argv.includes('--commit');
mkdirSync('/app/scripts/cs/backups_reconcile', { recursive:true });
const civ=rs=>{const v=rs.filter(s=>s.reviewScore!=null).map(s=>s.reviewScore).slice(-3); if(v.length<3)return 0; const a=v.reduce((x,y)=>x+y,0)/v.length; return a>=0.75?0:a<=0.30?1:(0.75-a)/0.45;};

const cs=await db.collection('classes').get();
const is26=new Set(); cs.forEach(d=>{if(/26SM/i.test(d.data().name||''))is26.add(d.id);});
const uids=[...new Set(cs.docs.filter(d=>is26.has(d.id)).flatMap(d=>d.data().studentIds||[]))];

let done=0, changed=0;
console.log(`email                              | csd before→after | interv before→after | recentSessions synth→real`);
for(const uid of uids){
  const cps=(await db.collection('users').doc(uid).collection('class_progress').get()).docs;
  const target=cps.find(c=>typeof c.data().csFixNote==='string' && /throttle reset/i.test(c.data().csFixNote));
  if(!target) continue;
  const p=target.data(); const [classId,listId]=target.id.split('_').length>2 ? [target.id.slice(0,20),target.id.slice(21)] : target.id.split('_');
  // robust split: doc id = `${classId}_${listId}` where both are 20-char firebase ids
  const cid=target.id.slice(0,20), lid=target.id.slice(21);
  const u=(await db.collection('users').doc(uid).get()).data();
  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data()).filter(a=>a.listId===lid);
  // rebuild recentSessions per day from real attempts
  const days=[...new Set(at.map(a=>a.studyDay).filter(d=>d!=null))].sort((x,y)=>x-y);
  const sessions=[];
  for(const D of days){
    const nw=at.filter(a=>a.sessionType==='new'&&a.studyDay===D);
    const rv=at.filter(a=>a.sessionType==='review'&&a.studyDay===D);
    const bn=nw.length?nw.reduce((m,a)=>(a.score||0)>(m.score||0)?a:m):null;
    const br=rv.length?rv.reduce((m,a)=>(a.score||0)>(m.score||0)?a:m):null;
    if(!bn&&!br) continue;
    const nwsi=bn?.newWordStartIndex, nwei=bn?.newWordEndIndex;
    sessions.push({ day:D,
      newWordScore: bn?(bn.score||0)/100:null,
      reviewScore: br?(br.score||0)/100:null,
      wordsIntroduced: (bn&&Number.isInteger(nwsi)&&Number.isInteger(nwei))?(nwei-nwsi+1):0,
      segmentStartIndex: Number.isInteger(nwsi)?nwsi:0, segmentEndIndex: Number.isInteger(nwei)?nwei:0,
      wordsReviewed: br?.totalQuestions||0, wordsTested: br?.totalQuestions||bn?.totalQuestions||30,
      date: new Date(Math.max(bn?.submittedAt?._seconds||0, br?.submittedAt?._seconds||0)*1000) });
  }
  const recentSessions=sessions.slice(-10);
  const pnD=new Set(at.filter(a=>a.sessionType==='new'&&a.passed).map(a=>a.studyDay));
  const prD=new Set(at.filter(a=>a.sessionType==='review'&&a.passed).map(a=>a.studyDay));
  const complete=[...pnD].filter(d=>prD.has(d));
  const genuineDay=complete.length?Math.max(...complete):0;
  const csdBefore=p.currentStudyDay||0; const csdAfter=Math.max(csdBefore,genuineDay);
  const intervAfter=+civ(recentSessions).toFixed(2);
  const synthCount=(p.recentSessions||[]).filter(s=>s.reviewScore===0.5&&s.newWordScore==null).length;
  done++;
  const line=`${String(u?.email||uid.slice(0,10)).padEnd(34)} | ${csdBefore}→${csdAfter} | ${(p.interventionLevel??0).toFixed(2)}→${intervAfter} | synth${synthCount}→real${recentSessions.length}`;
  console.log(line + (csdAfter>csdBefore?'  [csd+]':''));
  if(csdAfter>csdBefore||recentSessions.length) changed++;
  if(COMMIT){
    writeFileSync(`/app/scripts/cs/backups_reconcile/${uid}.json`, JSON.stringify({uid,email:u?.email,doc:target.id,before:{csd:csdBefore,twi:p.totalWordsIntroduced,interventionLevel:p.interventionLevel,recentSessions:p.recentSessions,csFixNote:p.csFixNote}},null,2));
    const ref=db.collection('users').doc(uid).collection('class_progress').doc(target.id);
    await ref.set({ recentSessions, currentStudyDay:csdAfter, interventionLevel:intervAfter,
      csFixNote: admin.firestore.FieldValue.delete(),
      reconcileNote:`CS-2026-07-16: reconciled to reality post-#11-deploy (recentSessions rebuilt from real attempts; interv from real reviews)`, updatedAt:T.now() },{merge:true});
    const ss=db.collection('users').doc(uid).collection('session_states').doc(target.id);
    if((await ss.get()).exists) await ss.delete();
  }
}
console.log(`\n${COMMIT?'[COMMITTED]':'[DRY RUN — add --commit]'} reset students: ${done}`);
process.exit(0);
