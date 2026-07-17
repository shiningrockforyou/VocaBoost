/**
 * CS-2026-07-15 READ-ONLY: throttle RISK tiers across 26SM — not just already-stuck, but those
 * dangerously close. interv = clamp01((0.75 - avgLast3Review)/0.45); newWords = round(pace*(1-interv)).
 *   THROTTLED : newWords <= 0            (avg <= ~0.30) — AT the wall
 *   CLOSE     : interv >= 0.78           (avg <= ~0.40) — one low review from zero
 *   WATCH     : interv 0.55..0.78        (avg 0.40..0.51) — reported as a count
 * Also flags reset students (csFixNote) whose real post-reset reviews are dragging interv back up,
 * and whether the last-3 reviews are DECLINING (trajectory toward the wall).
 *   node scripts/cs/scan-throttle-risk.mjs [classRegex=26SM]
 */
import admin from 'firebase-admin'; import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db=admin.firestore(); const filter=new RegExp(process.argv[2]||'26SM','i');
const round=x=>Math.round(x); const NOW=Math.floor(Date.now()/1000);
const nameOf={},paceOf={},sz={};
(await db.collection('classes').get()).forEach(c=>{const x=c.data();if(filter.test(x.name||'')){nameOf[c.id]=x.name;for(const[l,a]of Object.entries(x.assignments||{}))paceOf[`${c.id}_${l}`]=a.pace||80;}});
const is26=new Set(Object.keys(nameOf));
const size=async l=>{if(sz[l]==null){const d=await db.collection('lists').doc(l).get();sz[l]=d.exists?d.data().wordCount:0;}return sz[l];};
const uids=[...new Set((await db.collection('classes').get()).docs.filter(d=>is26.has(d.id)).flatMap(d=>d.data().studentIds||[]))];

const throttled=[], close=[]; let watch=0, scanned=0;
for(const uid of uids){
  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data()).filter(a=>is26.has(a.classId));
  if(!at.length) continue;
  const latest=at.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m);
  const listId=latest.listId, classId=latest.classId;
  const cp=(await db.collection('users').doc(uid).collection('class_progress').doc(`${classId}_${listId}`).get()).data();
  if(!cp||(cp.currentStudyDay||0)===0) continue; scanned++;
  const pace=paceOf[`${classId}_${listId}`]||80, s=await size(listId), wr=s-(cp.totalWordsIntroduced||0);
  if(wr<=0) continue; // list-end, separate issue
  const revs=(cp.recentSessions||[]).map(x=>x.reviewScore).filter(x=>x!=null).slice(-3);
  if(revs.length<3) continue; // <3 → interv 0, not at risk
  const avg=revs.reduce((a,b)=>a+b,0)/3;
  const interv=Math.min(1,Math.max(0,(0.75-avg)/0.45));
  const nwc=Math.min(round(pace*(1-interv)),wr);
  if(interv<0.55) continue; // fine
  let u; try{u=(await db.collection('users').doc(uid).get()).data();}catch{u=null;}
  const declining=revs.length===3 && revs[2]<=revs[1] && revs[1]<=revs[0];
  // what one more low (0.10) review would do
  const nextLow=[revs[1],revs[2],0.10]; const avgNext=nextLow.reduce((a,b)=>a+b,0)/3;
  const intervNext=Math.min(1,Math.max(0,(0.75-avgNext)/0.45)); const nwcNext=round(pace*(1-intervNext));
  const rec={name:u?.profile?.displayName||'?',email:u?.email||'?',cls:(nameOf[classId]||'').replace('26SM ',''),
    csd:cp.currentStudyDay,pace,last3:revs.map(r=>+r.toFixed(2)),interv:+interv.toFixed(2),nwc,pct:Math.round(nwc/pace*100),
    reset:!!cp.csFixNote,declining,nwcNext};
  if(nwc<=0) throttled.push(rec);
  else if(interv>=0.78) close.push(rec);
  else watch++;
}
const fmt=r=>`  ${String(r.name).slice(0,10).padEnd(10)} ${String(r.email).padEnd(28)} ${r.cls.padEnd(16)} csd=${r.csd} last3=${JSON.stringify(r.last3)} interv=${r.interv} newWords=${r.nwc}/${r.pace}(${r.pct}%)${r.declining?' ↓DECLINING':''}${r.reset?' [reset]':''}  →1 more low review: ${r.nwcNext} new`;
console.log(`\n=== 26SM THROTTLE RISK (scanned ${scanned} started, words-remaining) ===`);
console.log(`AT the wall (throttled, 0 new): ${throttled.length}`);
throttled.sort((a,b)=>a.interv-b.interv).forEach(r=>console.log(fmt(r)));
console.log(`\nCLOSE (interv>=0.78, one low review from zero): ${close.length}`);
close.sort((a,b)=>b.interv-a.interv).forEach(r=>console.log(fmt(r)));
console.log(`\nWATCH (interv 0.55-0.78): ${watch}`);
console.log(`\n[READ-ONLY]`); process.exit(0);
