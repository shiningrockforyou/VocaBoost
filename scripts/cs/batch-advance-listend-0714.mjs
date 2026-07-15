/**
 * CS-2026-07-14c: batch-advance list-end finishers to their NEXT assigned list. Config-only
 * (settings.primaryFocus{ListId,ClassId}). Refinement of CS-2026-07-13d:
 *   - window = active in last 7d (NO 6h exclusion) → also catches students stuck at the wall right now (정윤서).
 *   - writes ONLY real changes (current primaryFocus != next list) → skips the already-pinned no-ops.
 * Forward progression Base(1200)->Ascent(1600)->Summit(800). Finished progress untouched.
 *   NODE_PATH=/app/node_modules node scripts/cs/batch-advance-listend-0714.mjs [--commit]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const COMMIT = process.argv.includes('--commit');
const nowSec = Math.floor(Date.now()/1000);
const D7 = 7*86400;

const BASE='RmNNkuLPectBlBPiLbAJ', ASC='dVliNv0p9jqZYp9rfLpN', SUM='AObYOowhLoOOHx9wW2Sq';
const SIZE={[BASE]:1200,[ASC]:1600,[SUM]:800}; const ORDER=[BASE,ASC,SUM]; const LN={[BASE]:'BaseCamp',[ASC]:'Ascent',[SUM]:'Summit'};
const cn={}, clsAll={};
(await db.collection('classes').get()).forEach(d=>{cn[d.id]=d.data().name?.replace('26SM ','');clsAll[d.id]=d.data();});

// list-end finishers active in last 7d
const cand=new Set(); const info={};
for(const [cid,c] of Object.entries(clsAll)){
  if(!/26SM/i.test(c.name||'')) continue;
  for(const uid of (c.studentIds||[])){
    for(const lid of Object.keys(c.assignments||{})){
      if(!SIZE[lid]) continue;
      const cp=await db.collection('users').doc(uid).collection('class_progress').doc(`${cid}_${lid}`).get();
      if(!cp.exists||(cp.data().totalWordsIntroduced||0)<SIZE[lid]) continue; // not finished
      const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
      const last=at.reduce((m,a)=>Math.max(m,a.submittedAt?._seconds||0),0);
      if(last < nowSec-D7) continue; // active last 7d only
      const uc=`${uid}_${cid}`; cand.add(uc);
      (info[uc]=info[uc]||{uid,cid,cls:cn[cid],assigned:Object.keys(c.assignments||{}).filter(l=>SIZE[l]),last}).last=Math.max(info[uc].last||0,last);
    }
  }
}
const plan=[], noop=[], stranded=[];
for(const uc of cand){
  const {uid,cid,cls,assigned,last}=info[uc];
  const finishedSet=new Set();
  for(const lid of assigned){const cp=await db.collection('users').doc(uid).collection('class_progress').doc(`${cid}_${lid}`).get();if(cp.exists&&(cp.data().totalWordsIntroduced||0)>=SIZE[lid])finishedSet.add(lid);}
  const highestIdx=Math.max(...[...finishedSet].map(l=>ORDER.indexOf(l)));
  const next=(highestIdx+1<ORDER.length && assigned.includes(ORDER[highestIdx+1]))?ORDER[highestIdx+1]:null;
  const cur=(await db.collection('users').doc(uid).get()).data()?.settings?.primaryFocusListId;
  const rec={uid,cid,cls,finished:[...finishedSet].map(l=>LN[l]).join('+'),next,nextName:next?LN[next]:null,curFocus:cur?(LN[cur]||cur.slice(0,6)):'(none)',lastDate:new Date(last*1000).toISOString().slice(0,10)};
  if(!next){stranded.push(rec);continue;}
  if(cur===next){noop.push(rec);continue;}      // already pinned → skip
  plan.push(rec);
}
console.log(`\n=== BATCH-ADVANCE 0714 (active last 7d, real changes only) ===`);
console.log(`REAL advances: ${plan.length} | already-pinned no-ops (skipped): ${noop.length} | stranded (all lists done): ${stranded.length}\n`);
const byNext={}; plan.forEach(p=>byNext[p.nextName]=(byNext[p.nextName]||0)+1); console.log('targets:',JSON.stringify(byNext),'\n');
plan.forEach(p=>console.log(`   ${p.cls.padEnd(18)} finished=${p.finished.padEnd(14)} ${p.curFocus.padEnd(8)} -> ${p.nextName}  last=${p.lastDate} [${p.uid.slice(0,8)}]`));
console.log(`\nstranded (Summit/all done — need #11 deploy): ${stranded.map(s=>s.uid.slice(0,8)).join(', ')||'none'}`);

if(COMMIT){
  const T=admin.firestore.Timestamp.now();
  for(const p of plan){
    const uref=db.collection('users').doc(p.uid);
    const cur=(await uref.get()).data()?.settings||{};
    await uref.set({settings:{...cur,primaryFocusListId:p.next,primaryFocusClassId:p.cid},csAdvanceNote:`CS-2026-07-14c: list-end auto-advance ${p.finished}->${p.nextName}`},{merge:true});
  }
  console.log(`\n✅ advanced ${plan.length} students (config-only). no-ops & stranded untouched.`);
}
console.log(COMMIT?'\n[COMMITTED]':'\n[DRY RUN — re-run with --commit]');
process.exit(0);
