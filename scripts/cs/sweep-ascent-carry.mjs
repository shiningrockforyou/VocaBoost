/**
 * READ-ONLY sweep (2026-07-13): find promoted/moved students whose Ascent (dVliNv0p) progress
 * did NOT carry into their current ADV class. Makes NO writes.
 *   node scripts/cs/sweep-ascent-carry.mjs
 * Affected = student has Ascent attempts (earned anchor) but their CURRENT ADV-class Ascent
 * progress doc is BEHIND that earned anchor (or missing / 0) — i.e. cross-class carry failed.
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore(); const auth = admin.auth();

const ASC = 'dVliNv0p9jqZYp9rfLpN';
// The ADV classes to check (promotion targets). Add more names to the regex if needed.
const ADV_NAME = /미주 SAT Adv/i;

const cs = await db.collection('classes').get();
const nameById = {}; cs.forEach(d => nameById[d.id] = (d.data().name||'').replace('26SM ',''));
const nmShort = (id) => nameById[id] || id.slice(0,6);
const advClasses = [];
cs.forEach(d => { const c = d.data();
  if (ADV_NAME.test(c.name||'') && Object.keys(c.assignments||{}).includes(ASC))
    advClasses.push({ id:d.id, name:c.name, students:c.studentIds||[] }); });
console.log(`ADV classes w/ Ascent: ${advClasses.map(c=>`"${c.name}"(${c.students.length})`).join(', ')}\n`);

const rows = [];
for (const cls of advClasses) {
  for (const uid of cls.students) {
    // earned anchor across ALL classes (list-scoped), JS filter (no index)
    const at = (await db.collection('attempts').where('studentId','==',uid).get()).docs.map(d=>d.data());
    const ascAll = at.filter(a => a.listId===ASC);
    if (ascAll.length === 0) continue; // never did Ascent → not a carry case
    const passedNew = ascAll.filter(a => a.sessionType==='new' && a.passed===true && Number.isInteger(a.newWordEndIndex));
    if (passedNew.length === 0) continue;
    const anchor = passedNew.reduce((m,a)=> a.newWordEndIndex > m.newWordEndIndex ? a : m, passedNew[0]);
    const anchorDay = anchor.studyDay;
    const earnedTwi = anchor.newWordEndIndex + 1;
    const reviewOnAnchorDay = ascAll.some(a => a.sessionType==='review' && a.studyDay===anchorDay);
    const earnedCsd = anchorDay <= 1 ? 1 : (reviewOnAnchorDay ? anchorDay : anchorDay - 1);
    const anchorClass = anchor.classId;
    // most-recent Ascent attempt (any type) → the class the student is ACTIVELY using for Ascent
    const recent = ascAll.reduce((m,a)=> (a.submittedAt?._seconds||0) > (m.submittedAt?._seconds||0) ? a : m, ascAll[0]);
    const recentClass = recent.classId;
    const recentAt = recent.submittedAt?.toDate?.().toISOString?.().slice(0,10) || '?';

    // current ADV-class Ascent progress doc
    const advDoc = await db.collection('users').doc(uid).collection('class_progress').doc(`${cls.id}_${ASC}`).get();
    const docTwi = advDoc.exists ? (advDoc.data().totalWordsIntroduced||0) : 0;
    const docCsd = advDoc.exists ? (advDoc.data().currentStudyDay||0) : 0;

    // Classify. GENUINE carry-miss = ADV is the target class (anchor NOT native to ADV) and the ADV doc trails,
    // AND the student is NOT actively progressing in a NON-ADV class (recent activity is not elsewhere-and-ahead).
    if (anchorClass === cls.id) continue;               // native/already-carried into ADV → fine (홍승연)
    if (docTwi >= earnedTwi) continue;                  // ADV doc already >= earned → carried
    const activeElsewhere = recentClass !== cls.id && recentClass !== anchorClass ? recentClass
                          : (recentClass !== cls.id ? recentClass : null); // most-recent Ascent is in a non-ADV class
    const status = !advDoc.exists ? 'NOT-STARTED' : (docTwi===0 ? 'ZERO(stuck)' : 'BEHIND');
    const note = activeElsewhere ? `ACTIVE-ELSEWHERE(${nmShort(activeElsewhere)} @${recentAt})` : `ADV is recent @${recentAt}`;

    let u; try{u=await auth.getUser(uid);}catch{u={};}
    rows.push({ name:u.displayName||'?', email:u.email||'?', cls:cls.name.replace('26SM ',''),
      earned:`d${earnedCsd}/twi${earnedTwi}`, adv:`d${docCsd}/twi${docTwi}`, status, note,
      target:`csd=${earnedCsd} twi=${earnedTwi}`, uid });
  }
}

// Sort: genuine ADV-target misses first, ACTIVE-ELSEWHERE last
rows.sort((a,b)=> (a.note.startsWith('ACTIVE')?1:0) - (b.note.startsWith('ACTIVE')?1:0));
console.log(`=== ADV-class students whose Ascent doc trails their earned anchor: ${rows.length} ===`);
console.log('(GENUINE carry-miss = "ADV is recent"; ACTIVE-ELSEWHERE = progressing in another class, likely NOT a carry issue)\n');
console.log('NAME | EMAIL | ADV-CLASS | EARNED | ADV-DOC | STATUS | NOTE | RECONCILE-TARGET');
for (const r of rows) console.log(`${r.name} | ${r.email} | ${r.cls} | ${r.earned} | ${r.adv} | ${r.status} | ${r.note} | ${r.target}  [${r.uid.slice(0,8)}]`);
console.log(`\ngenuine (ADV is recent): ${rows.filter(r=>!r.note.startsWith('ACTIVE')).length} | active-elsewhere: ${rows.filter(r=>r.note.startsWith('ACTIVE')).length}`);
console.log(`[READ-ONLY — no writes]`);
process.exit(0);
