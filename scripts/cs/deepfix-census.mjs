/**
 * DEEPFIX empirical census — READ-ONLY. NO writes anywhere.
 *
 * David's 2026-07-13 directive: comprehensive analysis of every problematic live-student state
 * across 26SM, linking code findings to Firebase evidence + surfacing hand-patched students.
 *
 * Outputs:
 *   - stdout: summary counts per signature (lean).
 *   - audit/deepfix/task1/firebase/census_rows.json : full per-(student,class,list) rows for agent analysis.
 *   - audit/deepfix/task1/firebase/census_classes.json : per-class config (thresholds/testSizeNew/split-brain).
 *   - audit/deepfix/task1/firebase/syslogs.json : system_logs event tallies (deploy-state signal).
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/cs/deepfix-census.mjs [classRegex=26SM]
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const filter = new RegExp(process.argv[2] || '26SM', 'i');
const OUT = '/app/audit/deepfix/task1/firebase';
const round = (x) => Math.round(x);
const short = (u) => (u||'').slice(0,8);

// ---- Phase 0: classes + config ----
const cs = await db.collection('classes').get();
const classes = [];
const classCfg = [];
cs.forEach(d => {
  const c = d.data();
  if (!filter.test(c.name||'')) return;
  const assignments = c.assignments || {};
  const assignedLists = c.assignedLists;
  // #7 split-brain: assignments non-empty but assignedLists is [] (truthy-empty)
  const splitBrain = Array.isArray(assignedLists) && assignedLists.length === 0 && Object.keys(assignments).length > 0;
  classCfg.push({
    id: d.id, name: c.name, studentCount: (c.studentIds||[]).length,
    assignedLists: Array.isArray(assignedLists) ? assignedLists.length : assignedLists,
    assignmentCount: Object.keys(assignments).length, splitBrain,
    assignments: Object.entries(assignments).map(([lid,a]) => ({
      listId: lid, pace: a.pace, testSizeNew: a.testSizeNew ?? a.newWordCount ?? null,
      passThreshold: a.passThreshold, newWordRetakeThreshold: a.newWordRetakeThreshold,
      testMode: a.testMode ?? a.type ?? null,
      assignedAt: a.assignedAt?._seconds ? new Date(a.assignedAt._seconds*1000).toISOString().slice(0,10) : null
    }))
  });
  for (const [lid, a] of Object.entries(assignments)) {
    classes.push({ id:d.id, name:c.name, listId:lid, pace:a.pace||80, testSizeNew:a.testSizeNew ?? a.newWordCount ?? null, students:c.studentIds||[] });
  }
});
const listIds = new Set(classes.map(c=>c.listId).filter(Boolean));
const listSizes = {};
for (const l of listIds) { const d = await db.collection('lists').doc(l).get(); listSizes[l] = d.exists?(d.data().wordCount||0):0; }
const distinctStudents = new Set(classes.flatMap(c=>c.students));
console.log(`classes=/${filter.source}/i matched=${classCfg.length} | class-list pairs=${classes.length} | distinct students=${distinctStudents.size} | lists=${listIds.size}`);
console.log(`#7 split-brain classes (assignments>0 but assignedLists=[]): ${classCfg.filter(c=>c.splitBrain).length}`);
const thr = {}; classCfg.forEach(c=>c.assignments.forEach(a=>{const k=`${a.passThreshold}/${a.newWordRetakeThreshold}`;thr[k]=(thr[k]||0)+1;}));
console.log(`threshold distribution:`, JSON.stringify(thr));
writeFileSync(`${OUT}/census_classes.json`, JSON.stringify(classCfg, null, 2));

// ---- Phase 1+2: per (student,class,list) ----
const rows = [];
const sig = { reviewOnlyListEnd:0, reviewOnlyThrottle:0, twiOverList:0, twiOverMastery:0, dualEnrollSameList:0,
  invalidAnchor:0, manualPatched:0, reviewNoNewPass:0, testSizeMismatch:0, noClassAttempt:0,
  csdImplausible:0, missingPSD:0, impossibleSession:0, ghostProgress:0, csdUndercountCand:0 };
// per-student aggregation for dual-enroll (same listId across classes)
const byStudentList = {}; // uid -> listId -> [{classId,csd,twi}]

let scanned=0, started=0, err=0;
const attemptsCache = {}; // uid -> attempts[] (avoid re-querying for multi-class students)
async function getAttempts(uid){ if(!attemptsCache[uid]) attemptsCache[uid]=(await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>({id:d.id, ...d.data()})); return attemptsCache[uid]; }
const enrollments = [];
const seen = new Set();
for (const cls of classes) for (const uid of cls.students) {
  const key = `${uid}|${cls.id}|${cls.listId}`; if (seen.has(key)) continue; seen.add(key);
  enrollments.push({ uid, cls });
}
console.log(`\nscanning ${enrollments.length} distinct (student,class,list) enrollments...`);

for (const { uid, cls } of enrollments) {
  scanned++;
  if (scanned % 200 === 0) console.error(`  ...${scanned}/${enrollments.length}`);
  try {
    const cpRef = db.collection('users').doc(uid).collection('class_progress').doc(`${cls.id}_${cls.listId}`);
    const cpSnap = await cpRef.get();
    if (!cpSnap.exists) continue;
    const p = cpSnap.data();
    const csd = p.currentStudyDay||0, twi = p.totalWordsIntroduced||0;
    if (csd === 0 && twi === 0) continue;
    started++;
    const size = listSizes[cls.listId]||0;
    const wordsRemaining = size - twi;
    const revs = (p.recentSessions||[]).map(s=>s.reviewScore).filter(x=>x!=null).slice(-3);
    const interv = revs.length < 3 ? (p.interventionLevel||0) : Math.min(1, Math.max(0,(0.75 - revs.reduce((a,b)=>a+b,0)/revs.length)/0.45));
    const newWordCount = Math.min(round(cls.pace*(1-interv)), wordsRemaining);

    const row = { uid:short(uid), fullUid:uid, cls:cls.name.replace('26SM ',''), classId:cls.id, listId:cls.listId,
      csd, twi, size, pace:cls.pace, wordsRemaining, interv:+interv.toFixed(2), newWordCount, flags:[] };

    // #11 review-only freeze
    if (newWordCount <= 0) {
      if (wordsRemaining <= 0) { row.flags.push('reviewOnly:listEnd'); sig.reviewOnlyListEnd++; }
      else { row.flags.push('reviewOnly:throttle'); sig.reviewOnlyThrottle++; }
    }
    // twi over list
    if (size>0 && twi>size) { row.flags.push('twiOverList'); sig.twiOverList++; }
    // csd implausible / missing PSD
    if ((twi>0&&csd>twi+7)||(twi===0&&csd>7)) { row.flags.push('csdImplausible'); sig.csdImplausible++; }
    if (!p.programStartDate && csd>0) { row.flags.push('missingPSD'); sig.missingPSD++; }
    // dual-enroll accumulation
    (byStudentList[uid] = byStudentList[uid]||{});
    (byStudentList[uid][cls.listId] = byStudentList[uid][cls.listId]||[]).push({ classId:cls.id, cls:row.cls, csd, twi });

    // ---- attempts-based checks (per student, filtered to this class/list) ----
    const at = await getAttempts(uid);
    const fc = at.filter(a => a.classId===cls.id || a.listId===cls.listId || (a.testId||'').includes(cls.id));
    const passedNew = fc.filter(a=>a.sessionType==='new' && a.passed===true);
    // invalid anchor
    if (passedNew.some(a=>!(Number.isInteger(a.newWordEndIndex)&&a.newWordEndIndex>=0))) { row.flags.push('invalidAnchor'); sig.invalidAnchor++; }
    // hand-patched population P: manualOverride flag or manual docId
    const manualAtts = fc.filter(a=>a.manualOverride===true || /_manual\b|manual$/.test(a.id||''));
    if (manualAtts.length) { row.flags.push(`manualPatched:${manualAtts.length}`); sig.manualPatched++; row.manualDocs = manualAtts.map(a=>a.id).slice(0,4); }
    // review without a passed-new for that day (#11 artifact / benign review-only)
    const rd = new Set(fc.filter(a=>a.sessionType==='review').map(a=>a.studyDay)), np = new Set(passedNew.map(a=>a.studyDay));
    const rnn = [...rd].filter(d=>!np.has(d)&&d>1);
    if (rnn.length) { row.flags.push('reviewNoNewPass'); sig.reviewNoNewPass++; row.reviewNoNewDays = rnn.slice(0,4); }
    // no_class attempt
    if (fc.some(a=>a.classId==='no_class')) { row.flags.push('noClassAttempt'); sig.noClassAttempt++; }
    // ghost progress (csd>0 but no attempts)
    if (csd>0 && fc.length===0) { row.flags.push('ghostProgress'); sig.ghostProgress++; }
    // #13 test-size mismatch: a 'new' attempt whose totalQuestions != class testSizeNew AND not a list-end remainder
    if (cls.testSizeNew) {
      const mism = fc.filter(a=>a.sessionType==='new' && Number.isInteger(a.totalQuestions) && a.totalQuestions>0
        && a.totalQuestions !== cls.testSizeNew
        && !( (a.newWordEndIndex??-1) >= size-1 )  // exclude list-end remainder
      );
      if (mism.length) { row.flags.push('testSizeMismatch'); sig.testSizeMismatch++;
        row.testSizeMism = mism.map(a=>({day:a.studyDay,q:a.totalQuestions,exp:cls.testSizeNew})).slice(0,4); }
    }
    // last activity
    const lastSec = at.reduce((m,a)=>Math.max(m,a.submittedAt?._seconds||0),0);
    row.lastDate = lastSec ? new Date(lastSec*1000).toISOString().slice(0,10) : '?';
    row.attemptCount = fc.length;

    if (row.flags.length) rows.push(row);
  } catch (e) { err++; if (err<=5) console.error(`  ERR ${short(uid)} ${cls.id}: ${e.message}`); }
}

// dual-enroll same list (post-pass)
for (const [uid, byL] of Object.entries(byStudentList)) {
  for (const [lid, arr] of Object.entries(byL)) {
    if (arr.length > 1) {
      sig.dualEnrollSameList++;
      rows.push({ uid:short(uid), fullUid:uid, listId:lid, flags:['dualEnrollSameList'],
        dualDocs: arr.map(a=>`${a.cls}:csd${a.csd}/twi${a.twi}`) });
    }
  }
}

writeFileSync(`${OUT}/census_rows.json`, JSON.stringify(rows, null, 2));
console.log(`\nscanned=${scanned} started=${started} errors=${err} flaggedRows=${rows.length}`);
console.log('=== SIGNATURE COUNTS (started students) ===');
for (const [k,v] of Object.entries(sig)) console.log(`  ${k}: ${v}`);

// ---- Phase 3: system_logs deploy-state signal ----
try {
  const probe = await db.collection('system_logs').orderBy('timestamp','desc').limit(1).get();
  if (!probe.empty) {
    const sample = probe.docs[0].data();
    const evField = ['eventType','event','type','name'].find(f=>sample[f]!=null) || 'eventType';
    const recent = await db.collection('system_logs').orderBy('timestamp','desc').limit(4000).get();
    const tally = {};
    let oldest=null, newest=null;
    recent.forEach(d=>{ const x=d.data(); const ev=x[evField]||'?'; tally[ev]=(tally[ev]||0)+1;
      const t=x.timestamp?._seconds||0; if(t){ if(!newest||t>newest)newest=t; if(!oldest||t<oldest)oldest=t; } });
    const interesting = ['csd_anchor_invalid','csd_implausible','csd_anchor_query_error','day_guard_rejected_session_cleared',
      'impossible_phase_detected','day1_with_passed_new_test','attempt_day_fallback','attempt_day_context_invalid','review_only_completion'];
    const out = { evField, window:{from:oldest?new Date(oldest*1000).toISOString():null, to:newest?new Date(newest*1000).toISOString():null}, sampleSize:recent.size, interesting:{}, topAll:Object.entries(tally).sort((a,b)=>b[1]-a[1]).slice(0,25) };
    interesting.forEach(e=>out.interesting[e]=tally[e]||0);
    writeFileSync(`${OUT}/syslogs.json`, JSON.stringify(out, null, 2));
    console.log(`\n=== system_logs (last ${recent.size}, field='${evField}', ${out.window.from?.slice(0,10)}→${out.window.to?.slice(0,10)}) ===`);
    interesting.forEach(e=>console.log(`  ${e}: ${out.interesting[e]}`));
  } else console.log('\nsystem_logs empty');
} catch(e){ console.log('\nsystem_logs scan skipped: '+e.message); }

console.log('\nwrote census_rows.json, census_classes.json, syslogs.json to task1/firebase/');
process.exit(0);
