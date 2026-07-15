/**
 * READ-ONLY diagnostic for two CS cases (2026-07-13). Makes NO writes.
 *   node scripts/cs/diag-reviewonly-cases.mjs
 * Case 1: ohhalyn101014@gmail.com (오하린, SAT INT B1) — list starts at 640 not 660 (Day 11, 60/day).
 * Case 2: kimdongdongsuper1@gmail.com (김동현, SAT ADV B2) — review test blocked "pass the new-word test first".
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();
const auth = admin.auth();

const EMAILS = ['ohhalyn101014@gmail.com', 'kimdongdongsuper1@gmail.com'];

const short = (s) => (s||'').slice(0,10);
const ts = (t) => { try { return t?.toDate?.().toISOString?.() || (t?._seconds ? new Date(t._seconds*1000).toISOString() : String(t)); } catch { return String(t); } };

for (const email of EMAILS) {
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('CASE:', email);
  console.log('════════════════════════════════════════════════════════════');
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch (e) { console.log('  !! no auth user:', e.message); continue; }
  const uid = user.uid;
  console.log('uid:', uid, '| name:', user.displayName || '(none)');

  // Classes this student is in
  const clsSnap = await db.collection('classes').where('studentIds','array-contains',uid).get();
  const classById = {};
  console.log('\n-- CLASSES --');
  clsSnap.forEach(d => {
    const c = d.data(); classById[d.id] = c;
    const asg = c.assignments || {};
    console.log(`  ${d.id}  name="${c.name}"`);
    for (const [lid, a] of Object.entries(asg)) {
      console.log(`      list ${lid}: pace=${a.pace} testMode=${a.testMode} thr=${a.passThreshold} testSizeNew=${a.testSizeNew} assignedAt=${ts(a.assignedAt)}`);
    }
  });

  // List sizes referenced
  const listIds = new Set();
  clsSnap.forEach(d => Object.keys(d.data().assignments||{}).forEach(l => listIds.add(l)));

  // class_progress
  console.log('\n-- CLASS_PROGRESS --');
  const cpSnap = await db.collection('users').doc(uid).collection('class_progress').get();
  for (const d of cpSnap.docs) {
    const p = d.data();
    listIds.add(p.listId);
    console.log(`  docId=${d.id}`);
    console.log(`     classId=${p.classId} listId=${p.listId} csd=${p.currentStudyDay} twi=${p.totalWordsIntroduced} interv=${p.interventionLevel} lastSessionAt=${ts(p.lastSessionAt)}`);
    const rs = p.recentSessions || [];
    console.log(`     recentSessions (${rs.length}):`);
    rs.slice(-6).forEach(s => console.log(`        day=${s.day} new=${s.newWordScore} rev=${s.reviewScore} wIntro=${s.wordsIntroduced} wRev=${s.wordsReviewed}`));
  }

  const listSizes = {};
  for (const l of listIds) { if(!l) continue; const ld = await db.collection('lists').doc(l).get(); listSizes[l] = ld.exists ? (ld.data().wordCount||0) : 'MISSING'; }
  console.log('\n-- LIST SIZES --'); for (const [l,s] of Object.entries(listSizes)) console.log(`  ${l}: ${s}`);

  // attempts
  console.log('\n-- ATTEMPTS (studentId==uid) --');
  const atSnap = await db.collection('attempts').where('studentId','==',uid).get();
  const ats = atSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  ats.sort((a,b) => (a.studyDay||0)-(b.studyDay||0) || String(a.sessionType).localeCompare(String(b.sessionType)));
  for (const a of ats) {
    console.log(`  d${a.studyDay} ${a.sessionType} passed=${a.passed} score=${a.score} nwsi=${a.newWordStartIndex} nwei=${a.newWordEndIndex} wIntro=${a.wordsIntroduced} testId=${short(a.testId)} classId=${a.classId} listId=${short(a.listId)} manual=${a.manualOverride||false} at=${ts(a.completedAt||a.createdAt)}  [${short(a.id)}]`);
  }

  // session_states
  console.log('\n-- SESSION_STATES --');
  const ssSnap = await db.collection('users').doc(uid).collection('session_states').get();
  for (const d of ssSnap.docs) {
    const s = d.data();
    const sc = s.sessionConfig || {};
    console.log(`  docId=${d.id}`);
    console.log(`     phase=${s.phase} newWordsTestScore=${s.newWordsTestScore} newWordsTestPassed=${s.newWordsTestPassed} reviewTestScore=${s.reviewTestScore} reviewOnlyDay=${s.reviewOnlyDay} updatedAt=${ts(s.updatedAt)}`);
    console.log(`     sessionConfig: dayNumber=${sc.dayNumber} newWordCount=${sc.newWordCount} startPhase=${sc.startPhase} isListComplete=${sc.isListComplete} allocation=${JSON.stringify(sc.allocation)} newWordStartIndex=${sc.newWordStartIndex} newWordEndIndex=${sc.newWordEndIndex}`);
  }
}
console.log('\n[done — READ-ONLY, no writes]');
process.exit(0);
