/**
 * CS — READ-ONLY sweep: cross-class CSD UNDERCOUNT (the 박혜린 / Kaila CS-2026-07-13c family).
 *
 * Signature: a student has GENUINELY COMPLETED day D on a list (a passed 'new' AND a passed
 * 'review' attempt for day D exist on that list, in ANY of their classes), but the class_progress
 * doc for the list in their ACTIVE class has currentStudyDay < D — i.e. they're credited for
 * fewer days than they've finished, so reconciliation loops them on a "Day complete!" screen and
 * they can't advance. Root cause: with LIST_SCOPED_RECON=true the anchor is furthest-position
 * (student+list), but the review-pairing that confirms the anchor day is complete fails when the
 * review lives in a different class → csd = anchorDay-1.
 *
 * Active class for a list = user.settings.primaryFocus{Class,List} if it matches a started cp on
 * that list, else the class of the student's MOST-RECENT attempt on that list.
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/sweep-crossclass-undercount.mjs [classRegex=26SM]
 * NO WRITES.
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();
const filter = new RegExp(process.argv[2] || '26SM', 'i');
const kst = (s)=> s ? new Date(s*1000+9*3600e3).toISOString().slice(0,16).replace('T',' ') : '?';
const short=(s)=>s?String(s).slice(0,8):'—';

// 26SM classes
const cs = await db.collection('classes').get();
const classNameOf = {}, is26 = new Set(); const paceOf = {};
cs.forEach(d => { const c=d.data(); if (filter.test(c.name||'')) { classNameOf[d.id]=c.name; is26.add(d.id);
  for (const [lid,a] of Object.entries(c.assignments||{})) paceOf[`${d.id}_${lid}`]=a.pace||80; }});
const allUids = [...new Set(cs.docs.filter(d=>is26.has(d.id)).flatMap(d=>d.data().studentIds||[]))];
console.log(`26SM classes: ${is26.size} | students: ${allUids.length}\n`);

const flagged = [];
let scanned = 0;
for (const uid of allUids) {
  scanned++;
  const at = (await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data())
    .filter(a => is26.has(a.classId)); // stay in-cohort
  if (!at.length) continue;
  let userDoc; try { userDoc = (await db.collection('users').doc(uid).get()).data(); } catch { userDoc=null; }
  const pfList = userDoc?.settings?.primaryFocusListId, pfClass = userDoc?.settings?.primaryFocusClassId;

  // group by list
  const lists = [...new Set(at.map(a=>a.listId).filter(Boolean))];
  for (const listId of lists) {
    const la = at.filter(a=>a.listId===listId);
    const passedNew = la.filter(a=>a.sessionType==='new' && a.passed===true);
    if (!passedNew.length) continue;
    const passedRevDays = new Set(la.filter(a=>a.sessionType==='review' && a.passed===true).map(a=>a.studyDay));
    // genuine max fully-complete day (new-pass AND review-pass both exist for that day)
    const completeDays = passedNew.map(a=>a.studyDay).filter(d=>passedRevDays.has(d));
    if (!completeDays.length) continue;
    const genuineMaxCompleteDay = Math.max(...completeDays);
    const classesOnList = new Set(passedNew.map(a=>a.classId));

    // active class for this list
    let activeClass = (pfList===listId && pfClass && is26.has(pfClass)) ? pfClass : null;
    if (!activeClass) { const newest = la.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m); activeClass = newest.classId; }
    if (!is26.has(activeClass)) continue;

    const cp = await db.collection('users').doc(uid).collection('class_progress').doc(`${activeClass}_${listId}`).get();
    if (!cp.exists) continue;
    const p = cp.data(); const csd = p.currentStudyDay||0, twi = p.totalWordsIntroduced||0;
    if (csd === 0) continue;

    if (csd < genuineMaxCompleteDay) {
      // corroborating signals
      const newestPN = passedNew.reduce((m,a)=>(a.submittedAt?._seconds||0)>(m.submittedAt?._seconds||0)?a:m);
      const maxNwei = Math.max(...passedNew.map(a=>a.newWordEndIndex??-1));
      const anchorBehind = (newestPN.newWordEndIndex??-1) < maxNwei; // newest attempt is behind their furthest (went back to redo earlier days)
      // freshness of the completing review (mid-flight vs genuinely stuck)
      const compRev = la.filter(a=>a.sessionType==='review'&&a.passed===true&&a.studyDay===genuineMaxCompleteDay)
        .reduce((m,a)=>(a.submittedAt?._seconds||0)>(m?.submittedAt?._seconds||0)?a:m,null);
      const lastAny = la.reduce((m,a)=>Math.max(m,a.submittedAt?._seconds||0),0);
      flagged.push({ uid, name:userDoc?.profile?.displayName||'?', email:userDoc?.email||'?',
        activeClass:(classNameOf[activeClass]||'?').replace('26SM ',''), listId,
        csd, genuine:genuineMaxCompleteDay, gap:genuineMaxCompleteDay-csd, twi,
        multiClass:classesOnList.size>1, anchorBehind,
        classesOnList:[...classesOnList].map(short).join('/'),
        compRevAt:compRev?.submittedAt?._seconds||0, lastAny });
    }
  }
}

// login recency for flagged
const uniqUids=[...new Set(flagged.map(f=>f.uid))]; const lastLogin={};
for (let i=0;i<uniqUids.length;i+=100){ const r=await auth.getUsers(uniqUids.slice(i,i+100).map(uid=>({uid})));
  for (const u of r.users) lastLogin[u.uid]=u.metadata?.lastSignInTime?Math.floor(new Date(u.metadata.lastSignInTime).getTime()/1000):0; }

flagged.sort((a,b)=> b.lastAny - a.lastAny);
console.log(`=== CROSS-CLASS CSD UNDERCOUNT (csd < genuine-complete-day) : ${flagged.length} findings, ${uniqUids.length} students ===`);
console.log(`   (multiClass = passed-new on >1 class on this list; anchorBehind = newest passed-new is behind their furthest → redid earlier days)\n`);
for (const f of flagged) {
  console.log(`  ${String(f.name).padEnd(12)} ${String(f.email).padEnd(32)} ${f.activeClass.padEnd(22)} list=${short(f.listId)}  csd=${f.csd}<${f.genuine} (gap ${f.gap})  ${f.multiClass?'MULTI':'single'} ${f.anchorBehind?'anchorBehind':''}  classes=${f.classesOnList}  lastAct=${kst(f.lastAny)} login=${kst(lastLogin[f.uid])}`);
}
console.log(`\nscanned ${scanned} students`);
console.log(`[done — READ-ONLY, no writes]`);
process.exit(0);
