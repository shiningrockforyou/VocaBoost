// READ-ONLY batch triage: for each student, dump per-list state + recent attempts + a classification
// (THROTTLE / LIST-END / CLASS-CHANGE-RESET / LOST-SAVE / OFF-BY-ONE / CLEAN / ACCOUNT). No writes.
//   NODE_PATH=/app/node_modules node scripts/cs/batch-triage.mjs [name:email ...]
//   (no args → the default hard-coded batch below)
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore(); const auth = admin.auth();

// CLI override: `name:email` pairs (or bare emails) → triage exactly those students.
const ARGV = process.argv.slice(2).filter(Boolean);
const EMAILS = ARGV.length ? ARGV.map(a => { const i = a.lastIndexOf(':'); return i > 0 ? [a.slice(0, i), a.slice(i + 1)] : [a, a]; }) : [
  ['강라원', 'lw711.kang@gmail.com'],
  ['김지훈(new)', 'jeehoonkim@gmail.com'],
  ['김지훈(old-erased)', '05372@eis.ac.th'],
  ['조예서', '0exey.7@gmail.com'],
  ['김나연', 'nayunkim777@gmail.com'],
  ['김강훈', 'kevin8swe@gmail.com'],
  ['신동윤', 'sindongyun239@gmail.com'],
  ['신수민', 'suminshin377@gmail.com'],
  ['오윤세', 'helluuu281@gmail.com'],
];

const clsN = {}; (await db.collection('classes').get()).forEach(c => (clsN[c.id] = c.data().name));
const sizeCache = new Map();
async function listSize(l){ if(!l) return null; if(!sizeCache.has(l)){ try{ sizeCache.set(l,(await db.collection('lists').doc(l).collection('words').count().get()).data().count);}catch{sizeCache.set(l,null);} } return sizeCache.get(l); }
const f2 = x => (typeof x==='number'?x.toFixed(2):x);

for (const [name, email] of EMAILS) {
  console.log(`\n${'='.repeat(72)}\n### ${name} · ${email}`);
  let uid; try { uid=(await auth.getUserByEmail(email)).uid; } catch(e){ console.log(`  AUTH: NOT FOUND (${e.code})`); continue; }
  const u=(await db.collection('users').doc(uid).get()).data();
  if(!u){ console.log(`  users/${uid.slice(0,8)}: NO DOC (incomplete signup / account issue)`); continue; }
  console.log(`  uid ${uid.slice(0,8)} · enrolled: ${Object.keys(u.enrolledClasses||{}).map(k=>(u.enrolledClasses[k]?.name||k.slice(0,8))).join(' | ')||'NONE'}`);
  const pf=u?.settings?.primaryFocusListId; console.log(`  primaryFocus: ${(pf||'-').slice(0,8)} / class ${(u?.settings?.primaryFocusClassId||'-').slice(0,8)}`);

  const cps=(await db.collection('users').doc(uid).collection('class_progress').get()).docs;
  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>({id:d.id,...d.data()}));
  for(const cp of cps){
    const p=cp.data(); const sz=await listSize(p.listId);
    const rev=(p.recentSessions||[]).filter(s=>s.reviewScore!=null).map(s=>s.reviewScore);
    const last3=rev.slice(-3); const avg3=last3.length?last3.reduce((a,b)=>a+b,0)/last3.length:null;
    const twi=p.totalWordsIntroduced??0; const listEnd=sz!=null&&twi>=sz;
    const throttled=(p.reviewMode===true)||(avg3!=null&&avg3<0.30);
    // list-scoped attempts + anchor
    const la=at.filter(a=>a.listId===p.listId);
    const passedNew=la.filter(a=>a.sessionType==='new'&&a.passed===true).sort((a,b)=>(b.newWordEndIndex??-1)-(a.newWordEndIndex??-1))[0];
    const anchorTwi=passedNew?.newWordEndIndex!=null?passedNew.newWordEndIndex+1:null;
    const maxDay=la.reduce((m,a)=>Math.max(m,a.studyDay||0),0);
    let cls='—';
    if(listEnd) cls='LIST-END → next list';
    else if(throttled) cls='THROTTLE (review-only by design)';
    else if(anchorTwi!=null&&twi<anchorTwi) cls='UNDER-RECON (twi<anchor → reconciles up on load)';
    console.log(`  [${clsN[p.classId]||p.classId?.slice(0,8)}] list=${(p.listId||'').slice(0,8)} csd=${p.currentStudyDay} twi=${twi}/${sz} rMode=${p.reviewMode} interv=${p.interventionLevel} last3rev=[${last3.map(f2).join(',')}]avg=${avg3!=null?avg3.toFixed(2):'-'} anchorTwi=${anchorTwi} maxAttemptDay=${maxDay} → ${cls}`);
  }
  // recent attempts (all lists)
  const recent=at.sort((a,b)=>((a.submittedAt?.toMillis?.()??0)-(b.submittedAt?.toMillis?.()??0))).slice(-6);
  console.log('  recent attempts:');
  for(const a of recent){ const t=a.submittedAt?.toDate?a.submittedAt.toDate().toISOString().slice(5,16):'?'; const ans=Array.isArray(a.answers)?a.answers.filter(x=>String(x?.studentResponse??'').trim()!=='').length:0; const tot=Array.isArray(a.answers)?a.answers.length:0;
    console.log(`    ${t} ${a.sessionType}/d${a.studyDay} score=${a.score} passed=${a.passed} ans=${ans}/${tot} class=${(a.classId||'').slice(0,8)} list=${(a.listId||'').slice(0,8)} nwei=${a.newWordEndIndex??'-'}`); }
  // session_states
  const ss=(await db.collection('users').doc(uid).collection('session_states').get()).docs;
  ss.forEach(s=>{ const d=s.data(); console.log(`  session ${s.id.slice(0,20)}: phase=${d.phase} newWordsTestPassed=${d.newWordsTestPassed} reviewTestScore=${d.reviewTestScore}`); });
}
process.exit(0);
