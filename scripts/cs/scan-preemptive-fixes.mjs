/**
 * CS — Pre-emptive server-side fix census (READ-ONLY). No writes.
 *
 * Classifies every STARTED 26SM student who needs a data fix to use the app today into buckets:
 *   1 RESET CANDIDATES — finished BOTH Ascent (twi>=1600) AND Summit (twi>=800)
 *   2 finished-list dead-end WITH a next (higher, unfinished) list assigned  -> advance (primaryFocus)
 *   3 finished-list dead-end with NO next list (finished top assigned list)    -> reset / review-loop bridge
 *   4 LIVE-STRAND — actively-studied doc >= 1 day (>=pace) behind own cross-class max-passed-new anchor -> carry-forward
 *   5 invalid/corrupt anchor — passed-new missing integer newWordEndIndex, or ghost/implausible csd
 *   6 permafail — 0 challenge tokens AND >=3 failed-new same day+list (14d) AND stuck
 *   7 other blocking — impossible/stuck session_state (lost-save), or throttle-#11 review-only freeze
 * Non-blocking (excluded from fix buckets, counted only): #13 undersized test.
 *
 * Anchor rule (db.js getMostRecentPassedNewTest): student+list scoped, twi = max(newWordEndIndex)+1.
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/scan-preemptive-fixes.mjs [classRegex=26SM]
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const OUT = '/app/audit/deepfix/task1/firebase';
const filter = new RegExp(process.argv[2] || '26SM', 'i');
const short = u => (u||'').slice(0,8);
const round = x => Math.round(x);
const NOW = Math.floor(Date.now()/1000), CUT14 = NOW - 14*86400, CUT7 = NOW - 7*86400;
const toSec = v => { if(!v) return 0; if(typeof v==='number') return v>1e12?Math.floor(v/1000):v; if(v._seconds) return v._seconds; if(v.toMillis) return Math.floor(v.toMillis()/1000); return 0; };
const dstr = s => s ? new Date(s*1000).toISOString().slice(0,10) : '?';

const BASE='RmNNkuLPectBlBPiLbAJ', ASC='dVliNv0p9jqZYp9rfLpN', SUM='AObYOowhLoOOHx9wW2Sq';
const SIZE={[BASE]:1200,[ASC]:1600,[SUM]:800}; const ORDER=[BASE,ASC,SUM]; const LN={[BASE]:'Base Camp',[ASC]:'Ascent',[SUM]:'Summit'};

// ---- classes / roster ----
const cs = await db.collection('classes').get();
const classInfo = {};      // classId -> {name, assigns:{listId:{pace,passThreshold}}, assignedLists:[]}
const uidClasses = {};     // uid -> Set(classNames)
const roster = new Set();
cs.forEach(d => { const c=d.data(); if(!filter.test(c.name||'')) return;
  const assigns={}; for(const[lid,a]of Object.entries(c.assignments||{})) assigns[lid]={pace:a.pace||80, passThreshold:a.passThreshold??92};
  classInfo[d.id]={ name:c.name, assigns, assignedLists:Object.keys(assigns) };
  (c.studentIds||[]).forEach(u=>{ roster.add(u); (uidClasses[u]=uidClasses[u]||new Set()).add(c.name.replace('26SM ','')); });
});
const allUids=[...roster];
console.log(`26SM classes=${Object.keys(classInfo).length} distinct students=${allUids.length}`);

// list sizes (any assigned list, not just tiers)
const allLists=new Set(); Object.values(classInfo).forEach(ci=>ci.assignedLists.forEach(l=>allLists.add(l)));
for(const l of allLists){ if(SIZE[l]!=null) continue; const d=await db.collection('lists').doc(l).get(); SIZE[l]=d.exists?(d.data().wordCount||0):0; }

// ---- auth: email/displayName/lastSignIn ----
const info={}; // uid -> {email,name,lastLoginMs}
for(let i=0;i<allUids.length;i+=100){
  const res=await auth.getUsers(allUids.slice(i,i+100).map(uid=>({uid})));
  for(const u of res.users) info[u.uid]={ email:u.email||'?', name:u.displayName||'', lastLoginMs:u.metadata?.lastSignInTime?new Date(u.metadata.lastSignInTime).getTime():0 };
}

// ---- buckets ----
const B1=[],B2=[],B3=[],B4=[],B5=[],B6=[],B7=[];
let undersized=0; const undersizedUids=new Set();
let scanned=0, started=0, err=0, advancedPendingCount=0;
const primaryBucket={}; // uid -> bucket number (for exclusive summary)

for(const uid of allUids){ scanned++; if(scanned%150===0) console.error(`  ...${scanned}/${allUids.length}`);
 try{
  const userDoc=(await db.collection('users').doc(uid).get()).data()||{};
  const name = info[uid]?.name || userDoc.profile?.displayName || userDoc.displayName || '?';
  const email = info[uid]?.email || userDoc.email || '?';
  const pfList=userDoc.settings?.primaryFocusListId||null, pfClass=userDoc.settings?.primaryFocusClassId||null;

  // class_progress docs in 26SM
  const cpDocs=(await db.collection('users').doc(uid).collection('class_progress').get()).docs
    .map(d=>({id:d.id,...d.data()})).filter(p=>classInfo[p.classId]);
  const startedHere = cpDocs.some(p=>(p.currentStudyDay||0)>0 || (p.totalWordsIntroduced||0)>0);
  if(!startedHere) continue; started++;

  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  const lastActivity=at.reduce((m,a)=>Math.max(m,toSec(a.submittedAt)),0);

  // per-list rollups
  const perList={}; // listId -> {maxTwi,maxCsd, anchorTwi,anchorDay, docs:[{classId,cls,csd,twi,lastAct,pace,threshold}]}
  const listsSeen=new Set([...cpDocs.map(p=>p.listId), ...at.map(a=>a.listId)].filter(Boolean));
  for(const L of listsSeen){
    const docs=cpDocs.filter(p=>p.listId===L).map(p=>{
      const lastAct=at.filter(a=>a.classId===p.classId && a.listId===L).reduce((m,a)=>Math.max(m,toSec(a.submittedAt)),0);
      return { classId:p.classId, cls:(classInfo[p.classId]?.name||'').replace('26SM ',''),
        csd:p.currentStudyDay||0, twi:p.totalWordsIntroduced||0, lastAct,
        pace:classInfo[p.classId]?.assigns?.[L]?.pace||80, threshold:classInfo[p.classId]?.assigns?.[L]?.passThreshold??92,
        recentSessions:p.recentSessions||[], interventionLevel:p.interventionLevel||0 };
    });
    const passedNew=at.filter(a=>a.listId===L && a.sessionType==='new' && a.passed===true && Number.isInteger(a.newWordEndIndex));
    const anchorNwei=passedNew.length?Math.max(...passedNew.map(a=>a.newWordEndIndex)):null;
    const anchorAtt=anchorNwei!=null?passedNew.find(a=>a.newWordEndIndex===anchorNwei):null;
    const anchorClasses=new Set(passedNew.filter(a=>a.newWordEndIndex===anchorNwei).map(a=>a.classId));
    const maxTwi=docs.length?Math.max(...docs.map(d=>d.twi)):0;
    const maxCsd=docs.length?Math.max(...docs.map(d=>d.csd)):0;
    perList[L]={ maxTwi, maxCsd, anchorTwi:anchorNwei!=null?anchorNwei+1:null, anchorDay:anchorAtt?anchorAtt.studyDay:null,
      anchorCls:anchorAtt?anchorAtt.classId:null, anchorClasses:[...anchorClasses], numDocs:docs.length,
      docs, finished: SIZE[L]>0 && maxTwi>=SIZE[L], hasBadAnchorNew: at.some(a=>a.listId===L && a.sessionType==='new' && a.passed===true && !(Number.isInteger(a.newWordEndIndex)&&a.newWordEndIndex>=0)) };
  }

  // ---- determine ACTIVE (class,list): primaryFocus -> most-recent-activity doc -> greatest twi ----
  const startedDocs=cpDocs.filter(p=>(p.currentStudyDay||0)>0||(p.totalWordsIntroduced||0)>0)
    .map(p=>({...p, lastAct:at.filter(a=>a.classId===p.classId&&a.listId===p.listId).reduce((m,a)=>Math.max(m,toSec(a.submittedAt)),0)}));
  let active = (pfList&&pfClass) ? startedDocs.find(p=>p.classId===pfClass&&p.listId===pfList) : null;
  // If pinned (primaryFocus) to a list that is ASSIGNED, NOT finished, but not yet started → the student has been
  // advanced/pinned and will start that list on next load (batch-advance pattern) → NOT blocked. Don't treat their
  // old finished list as their "active" list.
  const pinnedAssigned = pfList && pfClass && classInfo[pfClass]?.assignedLists?.includes(pfList);
  const advancedPending = !active && !!pinnedAssigned && !(perList[pfList]?.finished);
  if(advancedPending) advancedPendingCount++;
  if(!active) active = startedDocs.slice().sort((a,b)=> (b.lastAct-a.lastAct) || ((b.totalWordsIntroduced||0)-(a.totalWordsIntroduced||0)))[0];
  const aL=active.listId, aCls=active.classId, aClsN=(classInfo[aCls]?.name||'').replace('26SM ','');
  const aCsd=active.currentStudyDay||0, aTwi=active.totalWordsIntroduced||0, aSize=SIZE[aL]||0;
  const aPace=classInfo[aCls]?.assigns?.[aL]?.pace||80;
  const revs=(active.recentSessions||[]).map(s=>s.reviewScore).filter(x=>x!=null).slice(-3);
  const interv=revs.length<3?(active.interventionLevel||0):Math.min(1,Math.max(0,(0.75-revs.reduce((a,b)=>a+b,0)/revs.length)/0.45));
  const wordsRemaining=aSize-aTwi;
  const newWordCount=Math.min(round(aPace*(1-interv)), wordsRemaining);
  const frozen = newWordCount<=0;
  const frozenKind = frozen ? (wordsRemaining<=0?'listEnd':'throttle') : null;

  // next-list availability (assigned & unfinished, higher than active) across the student's classes
  const myAssigned=new Set(); for(const p of startedDocs){ (classInfo[p.classId]?.assignedLists||[]).forEach(l=>myAssigned.add(l)); }
  const tierFinished = ORDER.filter(l=>perList[l]?.finished);
  const highestFinishedIdx = tierFinished.length?Math.max(...tierFinished.map(l=>ORDER.indexOf(l))):-1;
  // next = first higher tier that is assigned somewhere & not finished
  let nextList=null;
  for(let i=Math.max(highestFinishedIdx+1, ORDER.indexOf(aL)+1); i<ORDER.length; i++){ if(myAssigned.has(ORDER[i]) && !perList[ORDER[i]]?.finished){ nextList=ORDER[i]; break; } }

  const flags=[];

  // ---- Bucket 5: invalid / corrupt anchor ----
  let invReason=null;
  for(const L of listsSeen){ if(perList[L]?.hasBadAnchorNew){ invReason=`passed-new on ${LN[L]||short(L)} missing integer newWordEndIndex`; break; } }
  // ghost progress: started doc with csd>0 but zero matching attempts
  if(!invReason){ for(const p of startedDocs){ const n=at.filter(a=>a.classId===p.classId&&a.listId===p.listId).length; if((p.currentStudyDay||0)>0 && n===0 && at.filter(a=>a.listId===p.listId).length===0){ invReason=`ghost progress ${LN[p.listId]||short(p.listId)} csd=${p.currentStudyDay} but 0 attempts`; break; } } }
  // implausible csd
  if(!invReason){ for(const p of startedDocs){ const csd=p.currentStudyDay||0, twi=p.totalWordsIntroduced||0; if((twi>0&&csd>twi/1+7)||(twi===0&&csd>7)){ /* twi is words not days; guard */ } const days=twi>0?Math.ceil(twi/(classInfo[p.classId]?.assigns?.[p.listId]?.pace||80)):0; if(twi===0&&csd>7){ invReason=`implausible csd=${csd} twi=0`; break; } if(twi>0 && csd>days+7){ invReason=`implausible csd=${csd} vs ~${days} days (twi=${twi})`; break; } } }
  if(invReason){ flags.push(5); B5.push({uid:short(uid),fullUid:uid,name,email,cls:aClsN,reason:invReason,lastActivity:dstr(lastActivity)}); }

  // ---- Bucket 6: permafail ----
  const hist=userDoc.challenges?.history||userDoc.challengeHistory||[];
  let activeRej=0; hist.forEach(h=>{ if((h.status)==='rejected' && toSec(h.replenishAt)>NOW) activeRej++; });
  const tokens=Math.max(0,5-activeRej);
  const failedNew=at.filter(a=>a.sessionType==='new'&&a.passed!==true&&toSec(a.submittedAt)>=CUT14);
  const byDL={}; failedNew.forEach(a=>{const k=`${a.listId}|${a.studyDay}`;byDL[k]=(byDL[k]||0)+1;});
  const maxStreak=Object.values(byDL).length?Math.max(...Object.values(byDL)):0;
  if(tokens===0 && maxStreak>=3){ const worst=Object.entries(byDL).sort((a,b)=>b[1]-a[1])[0];
    flags.push(6); B6.push({uid:short(uid),fullUid:uid,name,email,cls:aClsN,tokens,activeRej,maxStreak,worst:worst?.[0],lastActivity:dstr(lastActivity)}); }

  // ---- Bucket 7: impossible/stuck session_state (lost-save) OR throttle-#11 ----
  let stuckReason=null;
  const ssDoc=await db.collection('users').doc(uid).collection('session_states').doc(`${aCls}_${aL}`).get();
  if(ssDoc.exists){ const s=ssDoc.data();
    if(s.phase==='review-study' && s.newWordsTestPassed===false){
      const day=s.sessionConfig?.dayNumber || aCsd+1;
      const hasNewPass=at.some(a=>a.listId===aL && a.sessionType==='new' && a.studyDay===day && a.passed===true);
      if(!hasNewPass && wordsRemaining>0) stuckReason=`impossible session: review-study but new-test not passed (day ${day}, no anchor) — lost-save family`;
    }
  }
  if(!stuckReason && frozen && frozenKind==='throttle' && !advancedPending) stuckReason=`throttle #11: interv=${interv.toFixed(2)} -> newWordCount=0 review-only freeze (csd=${aCsd} twi=${aTwi}/${aSize})`;
  if(stuckReason){ flags.push(7); B7.push({uid:short(uid),fullUid:uid,name,email,cls:aClsN,kind:stuckReason.startsWith('impossible')?'stuckSession':'throttle11',detail:stuckReason,lastActivity:dstr(lastActivity)}); }

  // ---- Bucket 4: LIVE-STRAND — active doc >= 1 day behind their CROSS-CLASS max-passed-new anchor.
  // Same-class lag of ~1 day is benign reconciliation lag (twi trails the latest anchor until next load,
  // self-heals via non-demoting max) — so require the anchor be earned in a DIFFERENT class (true carry gap),
  // or (same-class) a lag of >=2 days which a single load can't explain.
  const aAnchorTwi=perList[aL]?.anchorTwi, aAnchorCls=perList[aL]?.anchorCls, aNumDocs=perList[aL]?.numDocs||1;
  const aLag = aAnchorTwi!=null ? aAnchorTwi - aTwi : 0;
  const crossClass = aAnchorCls && aAnchorCls!==aCls;
  if(aAnchorTwi!=null && wordsRemaining>0 && ((crossClass && aLag>=aPace) || (!crossClass && aLag>=2*aPace))){
    const recentDays=new Set(at.filter(a=>a.classId===aCls&&a.listId===aL&&toSec(a.submittedAt)>=CUT7).map(a=>dstr(toSec(a.submittedAt))));
    flags.push(4); B4.push({uid:short(uid),fullUid:uid,name,email,activeCls:aClsN,list:LN[aL]||short(aL),
      anchorTwi:aAnchorTwi,anchorDay:perList[aL]?.anchorDay,anchorCls:(classInfo[aAnchorCls]?.name||'').replace('26SM ',''),
      crossClass, dualEnroll:aNumDocs>1, activeTwi:aTwi,lag:aLag,
      recentDaysBehind:recentDays.size,lastActivity:dstr(lastActivity),
      recentLogin:info[uid]?.lastLoginMs?dstr(Math.floor(info[uid].lastLoginMs/1000)):'?'}); }

  // ---- Bucket 1 / 2 / 3: finished-list situations ----
  const finishedAsc=perList[ASC]?.finished||false, finishedSum=perList[SUM]?.finished||false, finishedBase=perList[BASE]?.finished||false;

  if(finishedAsc && finishedSum){
    flags.push(1);
    B1.push({ uid:short(uid),fullUid:uid,name,email, classes:[...(uidClasses[uid]||[])],
      perList:{
        Base:{csd:perList[BASE]?.maxCsd||0,twi:perList[BASE]?.maxTwi||0,size:SIZE[BASE],finished:finishedBase,anchorTwi:perList[BASE]?.anchorTwi??null},
        Ascent:{csd:perList[ASC]?.maxCsd||0,twi:perList[ASC]?.maxTwi||0,size:SIZE[ASC],finished:true,anchorTwi:perList[ASC]?.anchorTwi??null},
        Summit:{csd:perList[SUM]?.maxCsd||0,twi:perList[SUM]?.maxTwi||0,size:SIZE[SUM],finished:true,anchorTwi:perList[SUM]?.anchorTwi??null},
      },
      lastActivity:dstr(lastActivity), recentLogin:info[uid]?.lastLoginMs?dstr(Math.floor(info[uid].lastLoginMs/1000)):'?',
      pinnedTo: pfList?(LN[pfList]||short(pfList)):null, activeList:LN[aL]||short(aL), frozen, frozenKind });
  }

  // Bucket 3: finished top assigned list, no next (superset incl. B1). Only if frozen(list-end) on active OR active list finished.
  const noNext = (frozen && frozenKind==='listEnd' && !nextList && !advancedPending);
  if(noNext){
    flags.push(3);
    B3.push({uid:short(uid),fullUid:uid,name,email,cls:aClsN,finishedTier:LN[aL]||short(aL),
      finishedAll:{Base:finishedBase,Ascent:finishedAsc,Summit:finishedSum},
      csd:aCsd,twi:aTwi,size:aSize,lastActivity:dstr(lastActivity),alsoBucket1:finishedAsc&&finishedSum});
  }

  // Bucket 2: finished a list, frozen(list-end) on active, but a higher unfinished list IS assigned
  if(frozen && frozenKind==='listEnd' && nextList && !advancedPending){
    flags.push(2);
    B2.push({uid:short(uid),fullUid:uid,name,email,cls:aClsN,
      finishedTier:LN[aL]||short(aL),nextList:LN[nextList],csd:aCsd,twi:aTwi,size:aSize,
      pinnedTo:pfList?(LN[pfList]||short(pfList)):null,lastActivity:dstr(lastActivity)});
  }

  // ---- non-blocking: #13 undersized new test (first attempt, non-remainder, q < 0.6*pace) ----
  for(const L of listsSeen){ const pace=classInfo[Object.keys(classInfo).find(c=>classInfo[c].assigns[L])]?.assigns?.[L]?.pace; }
  // (undersized handled lightly — count students with any small first new attempt)
  const newByDay={}; at.filter(a=>a.sessionType==='new'&&Number.isInteger(a.totalQuestions)&&a.totalQuestions>0).forEach(a=>{(newByDay[`${a.listId}|${a.studyDay}`]=newByDay[`${a.listId}|${a.studyDay}`]||[]).push(a);});
  for(const[k,arr]of Object.entries(newByDay)){ const L=k.split('|')[0]; arr.sort((a,b)=>toSec(a.submittedAt)-toSec(b.submittedAt)); const a=arr[0];
    const pace=classInfo[a.classId]?.assigns?.[L]?.pace||80; const rem=Number.isInteger(a.newWordEndIndex)&&a.newWordEndIndex>=SIZE[L]-1;
    if(!rem && a.totalQuestions<0.6*Math.min(pace,30)){ undersized++; undersizedUids.add(uid); } }

  // primary bucket (priority: 1 > 5 > 6 > 7 > 4 > 2 > 3)
  for(const b of [1,5,6,7,4,2,3]) if(flags.includes(b)){ primaryBucket[uid]=b; break; }

 }catch(e){ err++; if(err<=8) console.error(`  ERR ${short(uid)}: ${e.message}`); }
}

// study_states counts for reset candidates (mastery that a reset would wipe)
for(const r of B1){
  for(const [k,L] of [['Base',BASE],['Ascent',ASC],['Summit',SUM]]){
    try{ const agg=await db.collection('users').doc(r.fullUid).collection('study_states').where('listId','==',L).count().get(); r.perList[k].studyStates=agg.data().count; }catch{ r.perList[k].studyStates=null; }
  }
}

// targeted: the 5 CS-known Summit-finishers (CS-2026-07-13d) — explain any not in bucket 1
const KNOWN=['jhamsters9@gmail.com','soulkim0805@gmail.com','yuchanchon@gmail.com','gaonlee0909@gmail.com','choyoung8767@gmail.com'];
const knownDump=[];
for(const em of KNOWN){
  const us=await db.collection('users').where('email','==',em).limit(1).get(); if(us.empty){ knownDump.push({email:em,note:'no user'}); continue; }
  const uid=us.docs[0].id;
  const at=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
  const cp=(await db.collection('users').doc(uid).collection('class_progress').get()).docs.map(d=>d.data()).filter(p=>classInfo[p.classId]);
  const row={email:em,uid:short(uid),lists:{}};
  for(const[k,L]of[['Base',BASE],['Ascent',ASC],['Summit',SUM]]){
    const docs=cp.filter(p=>p.listId===L); const maxTwi=docs.length?Math.max(...docs.map(p=>p.totalWordsIntroduced||0)):0;
    const pn=at.filter(a=>a.listId===L&&a.sessionType==='new'&&a.passed===true&&Number.isInteger(a.newWordEndIndex));
    const anchorTwi=pn.length?Math.max(...pn.map(a=>a.newWordEndIndex))+1:null;
    row.lists[k]={maxTwi,size:SIZE[L],finished:maxTwi>=SIZE[L],anchorTwi,numDocs:docs.length};
  }
  knownDump.push(row);
}

// system_logs: recent csd_anchor_invalid (cross-check bucket 5)
let sysAnchorInvalid=0, sysRows=[];
try{
  const sl=await db.collection('system_logs').where('type','==','csd_anchor_invalid').limit(50).get();
  sysAnchorInvalid=sl.size; sl.forEach(d=>{const x=d.data(); sysRows.push({uid:short(x.uid||x.studentId||''),ts:dstr(toSec(x.timestamp||x.createdAt||x.at))});});
}catch(e){ sysRows.push({err:e.message}); }

const primaryCounts={}; for(const b of Object.values(primaryBucket)) primaryCounts[b]=(primaryCounts[b]||0)+1;
const OUTOBJ={ meta:{date:new Date().toISOString().slice(0,10), cohort:filter.source, classes:Object.keys(classInfo).length, students:allUids.length, started, err, advancedPending:advancedPendingCount, listSizes:{Base:SIZE[BASE],Ascent:SIZE[ASC],Summit:SIZE[SUM]}},
  counts:{ b1_resetBoth:B1.length,b2_advanceNext:B2.length,b3_noNext:B3.length,b4_liveStrand:B4.length,b5_invalidAnchor:B5.length,b6_permafail:B6.length,b7_other:B7.length,undersizedStudents:undersizedUids.size },
  primaryCounts, sysAnchorInvalid, sysRows, knownSummitFinishers:knownDump,
  B1,B2,B3,B4,B5,B6,B7 };
writeFileSync(`${OUT}/preemptive_fixes_scan.json`, JSON.stringify(OUTOBJ,null,2));

console.log(`\n=== PRE-EMPTIVE FIX CENSUS (26SM, ${OUTOBJ.meta.date}, READ-ONLY) ===`);
console.log(`scanned=${scanned} started=${started} err=${err} | advancedPending(already-pinned-to-unstarted-next-list, NOT blocked)=${advancedPendingCount}`);
console.log(`\nBucket counts (a student may appear in >1):`);
console.log(`  1 reset-BOTH(Asc+Sum): ${B1.length}`);
console.log(`  2 advance-next-list:   ${B2.length}`);
console.log(`  3 no-next (finished top, incl B1): ${B3.length}`);
console.log(`  4 LIVE-STRAND carry:   ${B4.length}`);
console.log(`  5 invalid anchor:      ${B5.length}`);
console.log(`  6 permafail:           ${B6.length}`);
console.log(`  7 other (stuck sess/throttle): ${B7.length}`);
console.log(`  (non-blocking) undersized-test students: ${undersizedUids.size}`);
console.log(`  system_logs csd_anchor_invalid (recent): ${sysAnchorInvalid}`);
console.log(`\nPRIMARY (exclusive) bucket counts: ${JSON.stringify(primaryCounts)}`);
console.log(`\n--- BUCKET 1 RESET CANDIDATES (finished Ascent AND Summit) ---`);
B1.forEach(r=>console.log(`  ${r.name} · ${r.email} · [${r.uid}] · ${r.classes.join(', ')}\n     Base ${r.perList.Base.twi}/${r.perList.Base.size}${r.perList.Base.finished?'✓':''}  Ascent ${r.perList.Ascent.twi}/1600✓  Summit ${r.perList.Summit.twi}/800✓  last=${r.lastActivity} pinned=${r.pinnedTo} active=${r.activeList} frozen=${r.frozen}(${r.frozenKind||'-'})`));
console.log(`\n--- B4 LIVE-STRAND refined: cross-class=${B4.filter(r=>r.crossClass).length} same-class(>=2d)=${B4.filter(r=>!r.crossClass).length} | dualEnroll=${B4.filter(r=>r.dualEnroll).length} ---`);
B4.sort((a,b)=>b.lag-a.lag).slice(0,40).forEach(r=>console.log(`  ${r.name} · ${r.email} · ${r.activeCls} · ${r.list} anchor=${r.anchorTwi}(${r.anchorCls||'?'}) active=${r.activeTwi} lag=${r.lag} xclass=${r.crossClass} dual=${r.dualEnroll} daysBehind=${r.recentDaysBehind} last=${r.lastActivity}`));
console.log(`\n--- KNOWN Summit-finishers (CS-2026-07-13d) ---`);
knownDump.forEach(r=>console.log(`  ${r.email} [${r.uid||'-'}] ${r.note||''} ${r.lists?`Base ${r.lists.Base.maxTwi}/${r.lists.Base.size}${r.lists.Base.finished?'✓':''} Ascent ${r.lists.Ascent.maxTwi}/1600${r.lists.Ascent.finished?'✓':''}(anchor ${r.lists.Ascent.anchorTwi}) Summit ${r.lists.Summit.maxTwi}/800${r.lists.Summit.finished?'✓':''}(anchor ${r.lists.Summit.anchorTwi})`:''}`));
console.log(`\nwrote ${OUT}/preemptive_fixes_scan.json`);
console.log('[READ-ONLY — zero writes]');
process.exit(0);
