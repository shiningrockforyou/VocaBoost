/**
 * CS-2026-07-15: reset the #11 THROTTLE for stuck students (David's directive: "unstick + set
 * intervention so a ≥50% next review won't throttle them").
 *
 * Mechanism: the student is frozen on a review-only day (interv→1.0 → newWordCount=0 → completion
 * gate blocks). We DON'T touch csd/twi/anchor. We reset the intervention signal so their CURRENT
 * day re-allocates NEW WORDS (review-only → normal day → deadlock gone), and calibrate so 50% is
 * the sustaining line:
 *   recentSessions → 2 baseline review entries at 0.50  +  interventionLevel = (0.75-0.50)/0.45 = 0.556
 *   → current day newWords = round(pace*0.444) (~35@80 / ~27@60); once real reviews accumulate,
 *     avg≥0.50 keeps interv≤0.556 (not throttled), avg<0.50 re-throttles.
 * Clears session_state so the day rebuilds with new words. Guard: only fixes genuinely-throttled
 * (current newWordCount<=0 AND wordsRemaining>0). Real attempts/gradebook untouched.
 *   node scripts/cs/fix-throttle-reset.mjs <email> [...] [--commit]
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth(); const T = admin.firestore.Timestamp;
const COMMIT = process.argv.includes('--commit');
const emails = process.argv.slice(2).filter(a=>a.includes('@'));
const round = x=>Math.round(x);
const TARGET_AVG = 0.50, RESET_INTERV = +((0.75-TARGET_AVG)/0.45).toFixed(4); // 0.5556
mkdirSync('/app/scripts/cs/backups_throttle', { recursive:true });
const paceOf={}, sizeCache={};
(await db.collection('classes').get()).forEach(d=>{for(const[l,a]of Object.entries(d.data().assignments||{}))paceOf[`${d.id}_${l}`]=a.pace||80;});
const size=async l=>{if(sizeCache[l]==null){const d=await db.collection('lists').doc(l).get();sizeCache[l]=d.exists?(d.data().wordCount||0):0;}return sizeCache[l];};

let fixed=0, skipped=0;
for(const email of emails){
  let uid; try{uid=(await auth.getUserByEmail(email)).uid;}catch{console.log(`${email}: NOT FOUND`);continue;}
  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  if(!at.length){console.log(`${email}: no attempts`);continue;}
  const latest=at.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m);
  const listId=latest.listId, classId=latest.classId;
  const cpRef=db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`);
  const snap=await cpRef.get(); if(!snap.exists){console.log(`${email}: no cp`);continue;}
  const p=snap.data(); const csd=p.currentStudyDay||0, twi=p.totalWordsIntroduced||0;
  const pace=paceOf[`${classId}_${listId}`]||80; const sz=await size(listId); const wr=sz-twi;
  const curRevs=(p.recentSessions||[]).map(s=>s.reviewScore).filter(x=>x!=null).slice(-3);
  const curInterv=curRevs.length<3?(p.interventionLevel||0):Math.min(1,Math.max(0,(0.75-curRevs.reduce((a,b)=>a+b,0)/curRevs.length)/0.45));
  const curNew=Math.min(round(pace*(1-curInterv)),Math.max(0,wr));
  // guard: genuinely throttled (0 new words) but words remain
  if(!(curNew<=0 && wr>0)){ console.log(`${email}: SKIP (not throttled: newWords=${curNew}, remaining=${wr}, interv=${curInterv.toFixed(2)})`); skipped++; continue; }

  const seg=[Math.max(0,twi-pace), Math.max(0,twi-1)];
  // 3 baseline review entries at 0.50 → calculateInterventionLevel = 0.556 (moderate ~44% throttle);
  // their next real review makes last-3 [0.5,0.5,R] → R>=0.50 keeps avg>=0.50 → not throttled.
  const seed=[csd-2,csd-1,csd].map(day=>({day, newWordScore:null, reviewScore:TARGET_AVG, wordsIntroduced:0, wordsReviewed:30, wordsTested:30, segmentStartIndex:seg[0], segmentEndIndex:seg[1], date:new Date()}));
  const newNew=Math.min(round(pace*(1-RESET_INTERV)),wr);
  console.log(`${email} [${classId.slice(0,8)}_${listId.slice(0,8)}] csd=${csd} twi=${twi}/${sz} pace=${pace} interv ${curInterv.toFixed(2)}→${RESET_INTERV} : day ${csd+1} newWords 0→${newNew}${COMMIT?'':'  (dry)'}`);
  if(COMMIT){
    writeFileSync(`/app/scripts/cs/backups_throttle/${uid}.json`, JSON.stringify({email,uid,cp:`${classId}_${listId}`,before:{csd,twi,interventionLevel:p.interventionLevel,recentSessions:p.recentSessions||[]}},null,2));
    await cpRef.set({ recentSessions:seed, interventionLevel:RESET_INTERV,
      csFixNote:`CS-2026-07-15: #11 throttle reset — recentSessions→0.5 baseline, interv→${RESET_INTERV} (≥50% review sustains); current day now allocates new words`, updatedAt:T.now() },{merge:true});
    const ssRef=db.collection('users').doc(uid).collection('session_states').doc(`${classId}_${listId}`);
    if((await ssRef.get()).exists) await ssRef.delete();
    fixed++;
  }
}
console.log(`\n${COMMIT?`[COMMITTED] fixed ${fixed}, skipped ${skipped}`:'[DRY RUN — add --commit]'}`);
process.exit(0);
