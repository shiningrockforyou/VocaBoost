/**
 * CS-2026-07-13d: batch-advance list-end students (active this week, not last 6h) to their NEXT list.
 * Config-only: sets settings.primaryFocus{ListId,ClassId} to the furthest ASSIGNED list they haven't finished.
 * Finished-list progress untouched. Order: Base Camp (1200) -> Ascent (1600) -> Summit (800).
 *   node scripts/cs/batch-advance-listend.mjs            # DRY (plan only)
 *   NOW_SEC=$(date +%s) node scripts/cs/batch-advance-listend.mjs --commit
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const COMMIT = process.argv.includes('--commit');
const nowSec = Number(process.env.NOW_SEC) || Math.floor(Date.now?.()/1000) || 0;

const BASE='RmNNkuLPectBlBPiLbAJ', ASC='dVliNv0p9jqZYp9rfLpN', SUM='AObYOowhLoOOHx9wW2Sq';
const SIZE={[BASE]:1200,[ASC]:1600,[SUM]:800};
const ORDER=[BASE,ASC,SUM]; const LN={[BASE]:'BaseCamp',[ASC]:'Ascent',[SUM]:'Summit'};
const cn={}, clsAll={};
(await db.collection('classes').get()).forEach(d=>{cn[d.id]=d.data().name?.replace('26SM ','');clsAll[d.id]=d.data();});

// rebuild the TARGET set: at #11 wall (list-end, review-only next day), active in last 7d but NOT last 6h
const H6=6*3600, D7=7*86400;
const targets=[]; const seen=new Set();
for(const [cid,c] of Object.entries(clsAll)){
  if(!/26SM/i.test(c.name||'')) continue;
  for(const uid of (c.studentIds||[])){
    for(const lid of Object.keys(c.assignments||{})){
      if(!SIZE[lid]) continue;
      const key=`${uid}_${cid}_${lid}`; if(seen.has(key))continue; seen.add(key);
      const cp=await db.collection('users').doc(uid).collection('class_progress').doc(`${cid}_${lid}`).get();
      if(!cp.exists) continue; const p=cp.data();
      if((p.totalWordsIntroduced||0) < SIZE[lid]) continue; // not finished this list
      // last activity across all their attempts
      const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
      const last=at.reduce((m,a)=>Math.max(m,a.submittedAt?._seconds||0),0);
      if(!(last < nowSec-H6 && last >= nowSec-D7)) continue; // TARGET window only
      targets.push({uid,cid,cls:cn[cid],finished:lid,csd:p.currentStudyDay,last:new Date(last*1000).toISOString().slice(0,10),assigned:Object.keys(c.assignments||{}).filter(l=>SIZE[l])});
    }
  }
}
// dedup per (uid,cid): keep the record; determine next list from ALL their finished lists in that class
const byUC={}; for(const t of targets){(byUC[`${t.uid}_${t.cid}`]=byUC[`${t.uid}_${t.cid}`]||[]).push(t);}
const plan=[]; const stranded=[];
for(const [uc,recs] of Object.entries(byUC)){
  const {uid,cid,cls,assigned,last}=recs[0];
  // finished lists in this class = any assigned list with twi>=size
  const finishedSet=new Set();
  for(const lid of assigned){const cp=await db.collection('users').doc(uid).collection('class_progress').doc(`${cid}_${lid}`).get();if(cp.exists&&(cp.data().totalWordsIntroduced||0)>=SIZE[lid])finishedSet.add(lid);}
  // next = the list AFTER their HIGHEST-finished list in the progression (Base->Asc->Sum) that is assigned.
  // (NOT "first unfinished" — since all 3 lists are now assigned, an Ascent-finisher must go FORWARD to
  //  Summit, never back to Base Camp.)
  const highestIdx = Math.max(...[...finishedSet].map(l=>ORDER.indexOf(l)));
  const nextIdx = highestIdx + 1;
  const next = (nextIdx < ORDER.length && assigned.includes(ORDER[nextIdx])) ? ORDER[nextIdx] : null;
  const cur=(await db.collection('users').doc(uid).get()).data()?.settings?.primaryFocusListId;
  if(!next){stranded.push({uid,cls,last,finished:[...finishedSet].map(l=>LN[l]).join('+')});continue;}
  plan.push({uid,cid,cls,last,finished:[...finishedSet].map(l=>LN[l]).join('+'),next,nextName:LN[next],curFocus:cur?LN[cur]||cur.slice(0,6):'(none)'});
}
console.log(`\n=== BATCH-ADVANCE PLAN (target: active-7d not-6h, list-end) ===`);
console.log(`students to advance: ${plan.length} | stranded (all assigned lists finished — need deploy): ${stranded.length}\n`);
const byNext={}; plan.forEach(p=>byNext[p.nextName]=(byNext[p.nextName]||0)+1);
console.log('advance targets:', JSON.stringify(byNext));
plan.slice(0,25).forEach(p=>console.log(`   ${p.cls.padEnd(16)} finished=${p.finished.padEnd(14)} -> SET focus=${p.nextName} (was ${p.curFocus}) [${p.uid.slice(0,8)}]`));
if(plan.length>25) console.log(`   ...(${plan.length-25} more)`);
console.log(`\nSTRANDED (Summit-done / all finished — no next list):`);
stranded.forEach(s=>console.log(`   ${s.cls} finished=${s.finished} [${s.uid.slice(0,8)}]`));

if(COMMIT){
  const T=admin.firestore.Timestamp.now();
  for(const p of plan){
    const uref=db.collection('users').doc(p.uid);
    const cur=(await uref.get()).data()?.settings||{};
    await uref.set({settings:{...cur,primaryFocusListId:p.next,primaryFocusClassId:p.cid},csAdvanceNote:`CS-2026-07-13d: list-end auto-advance ${p.finished}->${p.nextName}`},{merge:true});
  }
  console.log(`\n✅ advanced ${plan.length} students. Stranded ${stranded.length} untouched.`);
}
console.log(COMMIT?'\n[COMMITTED]':'\n[DRY RUN — re-run with --commit]');
process.exit(0);
