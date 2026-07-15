/**
 * DEEPFIX census v2 — deep per-student pass. READ-ONLY. Covers F-2/F-3/F-4/F-9/F-11 in one cohort pass.
 * Reuses the anchor rule (max newWordEndIndex passed-new, student+list scoped). No writes.
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/deepfix-census2.mjs [regex=26SM]
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();
const filter = new RegExp(process.argv[2] || '26SM', 'i');
const OUT = '/app/audit/deepfix/task1/firebase';
const short = u => (u||'').slice(0,8);

// classes + config
const cs = await db.collection('classes').get();
const classInfo = {}; // classId -> {name, lists:{listId:{pace,testSizeNew}}}
const roster26 = new Set();
cs.forEach(d=>{ const c=d.data(); if(!filter.test(c.name||'')) return;
  classInfo[d.id]={name:c.name, lists:{}}; (c.studentIds||[]).forEach(u=>roster26.add(u));
  for(const[lid,a]of Object.entries(c.assignments||{})) classInfo[d.id].lists[lid]={pace:a.pace||80, testSizeNew:a.testSizeNew ?? a.newWordCount ?? null};
});
const listSizes={}; const allLists=new Set(); Object.values(classInfo).forEach(ci=>Object.keys(ci.lists).forEach(l=>allLists.add(l)));
for(const l of allLists){const d=await db.collection('lists').doc(l).get(); listSizes[l]=d.exists?(d.data().wordCount||0):0;}
console.log(`26SM classes=${Object.keys(classInfo).length} students=${roster26.size} lists=${allLists.size}`);

const attemptsCache={};
async function getAttempts(uid){ if(!attemptsCache[uid]) attemptsCache[uid]=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>({id:d.id,...d.data()})); return attemptsCache[uid]; }
async function studyStateCount(uid,listId){ try{ const agg=await db.collection('users').doc(uid).collection('study_states').where('listId','==',listId).count().get(); return agg.data().count; }catch(e){ return null; } }

// outputs
const F2=[], F3=[], F4={H:0,P_holding:0,P_failed:0,B:0, Prows:[], Brows:[]}, F11=[];
const F9={correctnessSource:{}, writtenBy:{}, recentAttempts:0, since:null, recentSince:null, csRecent:{}, wbRecent:{}, recentCount:0};
const RECENT_CUT = Math.floor(Date.now()/1000) - 21*86400; F9.recentSince=new Date(RECENT_CUT*1000).toISOString().slice(0,10);
let scanned=0, started=0, err=0, dualCount=0;

const students=[...roster26];
for(const uid of students){ scanned++; if(scanned%150===0) console.error(`  ...${scanned}/${students.length}`);
 try{
  // this student's 26SM progress docs
  const cpSnap=await db.collection('users').doc(uid).collection('class_progress').get();
  const docs=cpSnap.docs.map(d=>d.data()).filter(p=>classInfo[p.classId]);
  if(!docs.length) continue;
  const at=await getAttempts(uid);
  const startedHere = docs.some(p=>(p.currentStudyDay||0)>0 || (p.totalWordsIntroduced||0)>0);
  if(startedHere) started++;

  // F-9 recent-attempt signals (global tally)
  for(const a of at){ const t=a.submittedAt?._seconds||0; if(t){ F9.recentAttempts++; if(!F9.since||t<F9.since)F9.since=t;
    const csrc=(a.correctnessSource===undefined?'undefined':(a.correctnessSource===null?'null':String(a.correctnessSource))); F9.correctnessSource[csrc]=(F9.correctnessSource[csrc]||0)+1;
    const wb=a.writtenBy||'(none)'; F9.writtenBy[wb]=(F9.writtenBy[wb]||0)+1;
    if(t>=RECENT_CUT){ F9.recentCount++; F9.csRecent[csrc]=(F9.csRecent[csrc]||0)+1; F9.wbRecent[wb]=(F9.wbRecent[wb]||0)+1; } } }

  // group progress docs by list
  const byList={}; docs.forEach(p=>{ (byList[p.listId]=byList[p.listId]||[]).push(p); });
  const isP = at.some(a=>a.manualOverride===true || /_manual\b|manual$/.test(a.id||''));
  let studentSignature=false;

  for(const[lid,plist]of Object.entries(byList)){
    const size=listSizes[lid]||0;
    // anchor = max nwei among passed-new on this list (any class)
    const passedNew=at.filter(a=>a.listId===lid && a.sessionType==='new' && a.passed===true && Number.isInteger(a.newWordEndIndex));
    const anchorNwei = passedNew.length? Math.max(...passedNew.map(a=>a.newWordEndIndex)) : null;
    const anchorTwi = anchorNwei!=null? anchorNwei+1 : null;
    // F-11 mastery
    const ssCount = await studyStateCount(uid, lid);
    // per-doc
    const docStates=plist.map(p=>{ const twi=p.totalWordsIntroduced||0, csd=p.currentStudyDay||0;
      const lastAct=at.filter(a=>a.classId===p.classId && a.listId===lid).reduce((m,a)=>Math.max(m,a.submittedAt?._seconds||0),0);
      return {classId:p.classId, cls:(classInfo[p.classId]?.name||'').replace('26SM ',''), csd, twi, lastAct,
        lagVsAnchor: anchorTwi!=null? anchorTwi-twi : null, atWall: size>0 && twi>=size }; });
    // the student's ACTIVE doc on this list = most recent activity
    const activeDoc = docStates.slice().sort((a,b)=>b.lastAct-a.lastAct)[0];
    // F-3 dual-enroll
    if(plist.length>1){ dualCount++;
      const twis=docStates.map(d=>d.twi); const spread=Math.max(...twis)-Math.min(...twis);
      const allFinished=docStates.every(d=>d.atWall);
      const activeBehind = anchorTwi!=null && activeDoc.lagVsAnchor>=80;   // ACTIVE doc is >=1 day behind own anchor = LIVE #12
      const strandedDocs=anchorTwi!=null? docStates.filter(d=>anchorTwi-d.twi>=80) : [];
      const kind = activeBehind ? 'LIVE-STRAND'
        : allFinished?'benign-finished' : spread===0?'benign-equal'
        : strandedDocs.length?'stale-2nd-enroll' : 'divergent';
      F3.push({uid:short(uid), fullUid:uid, listId:lid.slice(0,8), kind, spread, anchorTwi,
        activeCls:activeDoc.cls, activeTwi:activeDoc.twi, activeLag:activeDoc.lagVsAnchor,
        docs:docStates.map(d=>`${d.cls}:csd${d.csd}/twi${d.twi}${d.lastAct?'@'+new Date(d.lastAct*1000).toISOString().slice(5,10):''}`)});
      if(kind==='LIVE-STRAND'||kind==='divergent') studentSignature=true;
    }
    // #11 wall: the student's ACTIVE doc on this list finished it (twi>=size) → stuck on review-only until deploy
    if(activeDoc.atWall) studentSignature = true;
    // F-11 twi > mastery
    if(ssCount!=null){ const maxTwi=Math.max(...docStates.map(d=>d.twi)); if(maxTwi>ssCount+5){ F11.push({uid:short(uid), listId:lid.slice(0,8), maxTwi, studyStates:ssCount, overBy:maxTwi-ssCount, isP}); } }
    // signature: at wall on this list (review-only) OR stranded
    const wall = docStates.some(d=>d.atWall);
    if(wall) studentSignature = studentSignature || false; // wall alone isn't "broken" unless it's the freeze; handled in census v1. keep conservative.

    // F-2 test-size: 'new' attempts on this list, pinned to the class TAKEN under
    const newAtts = at.filter(a=>a.listId===lid && a.sessionType==='new' && Number.isInteger(a.totalQuestions) && a.totalQuestions>0);
    // detect retakes: multiple new attempts same (studyDay) — keep only the FIRST by submittedAt as "primary"
    const byDay={}; newAtts.forEach(a=>{ (byDay[a.studyDay]=byDay[a.studyDay]||[]).push(a); });
    for(const[day,arr]of Object.entries(byDay)){
      arr.sort((a,b)=>(a.submittedAt?._seconds||0)-(b.submittedAt?._seconds||0));
      arr.forEach((a,i)=>{
        const tsn = classInfo[a.classId]?.lists?.[lid]?.testSizeNew ?? null;
        if(tsn==null) return;
        const remainder = Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex>=size-1; // list-end remainder benign
        if(a.totalQuestions===tsn || remainder) return;
        const isRetake = i>0;
        const undersized = a.totalQuestions < 0.6*tsn;
        if(undersized && !isRetake){ studentSignature=true;
          F2.push({uid:short(uid), cls:(classInfo[a.classId]?.name||'').replace('26SM ',''), listId:lid.slice(0,8), day:+day, q:a.totalQuestions, exp:tsn, nwei:a.newWordEndIndex, isFirstDay:+day===1, ts:a.submittedAt?._seconds||0}); }
        else if(isRetake && a.totalQuestions!==tsn){ /* retake size variance — separate benign-ish bucket, skip for headline */ }
      });
    }
  }
  // F-4 H/P/B (started students only)
  if(startedHere){
    if(isP){ const alsoWall = docs.some(p=>{const s=listSizes[p.listId]||0; return s>0 && (p.totalWordsIntroduced||0)>=s;}); if(alsoWall) F4.P_failed++; else F4.P_holding++; F4.Prows.push({uid:short(uid), failed:alsoWall}); }
    else if(studentSignature){ F4.B++; F4.Brows.push({uid:short(uid)}); }
    else F4.H++;
  }
 }catch(e){ err++; if(err<=6) console.error(`  ERR ${short(uid)}: ${e.message}`); }
}

writeFileSync(`${OUT}/scan_F2_testsize.json`, JSON.stringify(F2,null,2));
writeFileSync(`${OUT}/scan_F3_dualenroll.json`, JSON.stringify(F3,null,2));
writeFileSync(`${OUT}/scan_F4_hpb.json`, JSON.stringify(F4,null,2));
writeFileSync(`${OUT}/scan_F9_deploystate.json`, JSON.stringify(F9,null,2));
writeFileSync(`${OUT}/scan_F11_twi_mastery.json`, JSON.stringify(F11,null,2));

console.log(`\nscanned=${scanned} started=${started} err=${err} dualEnrollDocs=${dualCount}`);
console.log(`\n=== F-2 test-size (true undersized, first-attempt, non-remainder): ${F2.length} ===`);
const f2byExp={}; F2.forEach(x=>{const k=`q${x.q}->exp${x.exp}${x.isFirstDay?' [day1]':''}`;f2byExp[k]=(f2byExp[k]||0)+1;});
console.log(JSON.stringify(f2byExp,null,1)); console.log('distinct students:', new Set(F2.map(x=>x.uid)).size, '| day-1:', F2.filter(x=>x.isFirstDay).length);
console.log(`\n=== F-3 dual-enroll (${F3.length} student-lists) by kind ===`);
const f3k={}; F3.forEach(x=>f3k[x.kind]=(f3k[x.kind]||0)+1); console.log(JSON.stringify(f3k,null,1));
console.log('STRANDED sample:'); F3.filter(x=>x.kind==='STRANDED').slice(0,8).forEach(x=>console.log('  ',x.uid,x.listId,'anchorTwi'+x.anchorTwi,x.docs.join(' | '),'strand:'+x.strandedClasses.join(',')));
console.log('divergent sample:'); F3.filter(x=>x.kind==='divergent').slice(0,6).forEach(x=>console.log('  ',x.uid,x.listId,'spread'+x.spread,x.docs.join(' | ')));
console.log(`\n=== F-4 H/P/B partition (of ${started} started) ===`);
console.log(`  H(healthy)=${F4.H}  P_holding=${F4.P_holding}  P_failed=${F4.P_failed}  B(broken-signature)=${F4.B}`);
console.log(`\n=== F-9 deploy-state — ALL ${F9.recentAttempts} attempts since ${F9.since?new Date(F9.since*1000).toISOString().slice(0,10):'?'} ===`);
console.log('  correctnessSource:', JSON.stringify(F9.correctnessSource), '| writtenBy:', JSON.stringify(F9.writtenBy));
console.log(`  RECENT (last 21d, since ${F9.recentSince}, ${F9.recentCount} attempts) → correctnessSource:`, JSON.stringify(F9.csRecent), '| writtenBy:', JSON.stringify(F9.wbRecent));
console.log('  [null correctnessSource ⇒ GRADE_TOKEN_ENFORCED OFF live; cloud-function writtenBy ⇒ SERVER_ATTEMPT_WRITE live]');
console.log(`\n=== F-11 twi>mastery: ${F11.length} student-lists (overBy>5) ===`);
F11.sort((a,b)=>b.overBy-a.overBy).slice(0,8).forEach(x=>console.log('  ',x.uid,x.listId,'twi'+x.maxTwi,'ss'+x.studyStates,'over'+x.overBy,x.isP?'[patched]':''));
console.log('\nwrote scan_F2/F3/F4/F9/F11 to task1/firebase/');
process.exit(0);
