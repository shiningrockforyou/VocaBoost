/**
 * CS: unstick a #11 THROTTLE-deadlock student (generic 정지수/Junseo fix). Completes their frozen
 * review-only day (csd+1) using their BEST real review score for that day → advances csd, recomputes
 * interventionLevel, clears session_state. NOTE: if reviews stay <30% avg the NEXT day re-throttles
 * (review-only) — this unsticks the immediate hard-freeze only; full fix = #11 deploy or reviews improve.
 *   node scripts/cs/fix-throttle-unstick.mjs <email> [<email> ...] [--commit]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth(); const T = admin.firestore.Timestamp;
const COMMIT = process.argv.includes('--commit');
const emails = process.argv.slice(2).filter(a=>a.includes('@'));
const round = x => Math.round(x);
const paceOf = {};
(await db.collection('classes').get()).forEach(d=>{for(const[l,a]of Object.entries(d.data().assignments||{}))paceOf[`${d.id}_${l}`]=a.pace||80;});

for (const email of emails) {
  let uid; try { uid=(await auth.getUserByEmail(email)).uid; } catch { console.log(`\n${email}: NOT FOUND`); continue; }
  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  const latest=at.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m);
  const listId=latest.listId, classId=latest.classId;
  const cpRef=db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`);
  const cp=(await cpRef.get()).data();
  const csd=cp.currentStudyDay||0, twi=cp.totalWordsIntroduced||0, pace=paceOf[`${classId}_${listId}`]||80;
  const frozenDay=csd+1;
  const frozenReviews=at.filter(a=>a.listId===listId&&a.sessionType==='review'&&a.studyDay===frozenDay);
  if(!frozenReviews.length){ console.log(`\n${email}: no review attempt on frozen day ${frozenDay} — cannot unstick this way`); continue; }
  const best=Math.max(...frozenReviews.map(a=>a.score||0))/100;

  const recent=[...(cp.recentSessions||[])];
  const entry={ day:frozenDay, newWordScore:null, reviewScore:best,
    segmentStartIndex:Math.max(0,twi-pace), segmentEndIndex:twi-1, wordsIntroduced:0, wordsReviewed:30, wordsTested:30, date:new Date() };
  const newRecent=[...recent, entry].slice(-10);
  const revs=newRecent.map(s=>s.reviewScore).filter(x=>x!=null).slice(-3);
  const avg=revs.reduce((a,b)=>a+b,0)/(revs.length||1);
  const interv=revs.length<3?0:Math.min(1,Math.max(0,(0.75-avg)/0.45));
  const nextNew=Math.min(round(pace*(1-interv)), Math.max(0,/*sizeUnknown here*/9999));
  const ssRef=db.collection('users').doc(uid).collection('session_states').doc(`${classId}_${listId}`);
  const ssExists=(await ssRef.get()).exists;

  console.log(`\n${email} [${classId.slice(0,8)}_${listId.slice(0,8)}] csd=${csd} twi=${twi} pace=${pace}`);
  console.log(`  frozen day ${frozenDay} review-only; best real d${frozenDay} review=${best.toFixed(2)} (${frozenReviews.length} attempts)`);
  console.log(`  → COMPLETE day ${frozenDay}: csd ${csd}→${frozenDay}, append review=${best.toFixed(2)}, last3=${JSON.stringify(revs.map(r=>+r.toFixed(2)))} → interv ${interv.toFixed(2)} → day ${frozenDay+1} newWords≈${round(pace*(1-interv))} ${round(pace*(1-interv))<=0?'[STILL THROTTLE — will re-stick]':''}; clear ss(${ssExists})`);
  if(COMMIT){
    await cpRef.set({ currentStudyDay:frozenDay, recentSessions:newRecent, interventionLevel:interv,
      csdFixNote:`CS-2026-07-15: #11 throttle unstick — completed frozen day ${frozenDay} review-only (best real review ${best.toFixed(2)})`, updatedAt:T.now() },{merge:true});
    if(ssExists) await ssRef.delete();
    console.log(`  ✅ csd=${frozenDay}, session cleared`);
  }
}
console.log(`\n${COMMIT?'[COMMITTED]':'[DRY RUN — add --commit]'}`);
process.exit(0);
