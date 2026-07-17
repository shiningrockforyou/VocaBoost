// READ-ONLY ship-gate verify for CS PR-1: run the SHIPPED predicate (src/utils/reviewPairing.js)
// over 26SM and confirm the census result holds — 13/14 stuck drain + 1 by-design skip retake + 0 cross-class
// false-pairs. Imports the ACTUAL shipped module (not a copy), so this certifies the code that ships.
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { reviewPairsWithAnchor, isEngagedReview } from '../../src/utils/reviewPairing.js';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const ms = t => (t && t.toMillis) ? t.toMillis() : (t?.toDate ? t.toDate().getTime() : 0);
// legacy P0 (what pairs today) — to identify the stuck set + detect NEW false-pairs
const p0 = (r, a) => r.sessionType === 'review' && r.studyDay === a.studyDay && ms(r.submittedAt) >= ms(a.submittedAt)
  && r.newWordStartIndex === a.newWordStartIndex && r.newWordEndIndex === a.newWordEndIndex;

const cs = await db.collection('classes').get();
const classes = [];
cs.forEach(d => { const c = d.data(); if (/26SM/i.test(c.name || '')) { const L = c.assignments ? Object.keys(c.assignments)[0] : null; classes.push({ id: d.id, name: c.name, listId: L, students: c.studentIds || [] }); } });

let started = 0; const stuck = []; const falsePairs = [];
for (const cls of classes) {
  if (!cls.listId) continue;
  for (const uid of cls.students) {
    const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(`${cls.id}_${cls.listId}`).get()).data();
    if (!cp || !(cp.currentStudyDay > 0)) continue;
    started++;
    const stored = cp.currentStudyDay;
    const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', cls.listId).get()).docs.map(d => d.data());
    const pn = at.filter(a => a.sessionType === 'new' && a.passed === true && Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex >= 0);
    if (!pn.length) continue;
    const anc = pn.slice().sort((a, b) => (b.newWordEndIndex - a.newWordEndIndex) || (ms(b.submittedAt) - ms(a.submittedAt)))[0];
    const day = anc.studyDay; if (!(day >= 2)) continue;
    const dayRev = at.filter(a => a.sessionType === 'review' && a.studyDay === day);
    // anchor object exactly as db.js builds it for the shipped predicate
    const A = { studyDay: day, classId: anc.classId, submittedAt: anc.submittedAt, newWordStartIndex: anc.newWordStartIndex, newWordEndIndex: anc.newWordEndIndex };
    // NEW false-pair check: any review that pairs under SHIPPED but NOT under P0, from a DIFFERENT class
    for (const r of dayRev) if (reviewPairsWithAnchor(r, A) && !p0(r, A) && r.classId !== anc.classId) falsePairs.push(`${uid.slice(0, 8)} ${cls.name.slice(0, 14)} d${day}`);
    // stuck signature: storedCSD===anchorDay-1, an anchor-day review exists, P0 fails
    if (!dayRev.length || dayRev.some(r => p0(r, A)) || stored !== day - 1) continue;
    const drains = dayRev.some(r => reviewPairsWithAnchor(r, A));
    stuck.push({ fullUid: uid, cls: cls.name.slice(0, 16), day, stored, drains, nRev: dayRev.length, engagedRev: dayRev.some(r => isEngagedReview(r)) });
  }
}
const drained = stuck.filter(s => s.drains);
const residual = stuck.filter(s => !s.drains);
console.log(`26SM started: ${started}`);
console.log(`\n=== STUCK (P0 fails, anchor-day review exists, csd===anchorDay-1): ${stuck.length} ===`);
stuck.forEach(s => console.log(`  ${s.fullUid} ${s.cls.padEnd(16)} d${s.day} csd${s.stored} rev×${s.nRev} engaged:${s.engagedRev} → ${s.drains ? 'DRAINS ✅' : 'retake (by design)'}`));
console.log(`\nDRAIN under SHIPPED reviewPairsWithAnchor: ${drained.length}/${stuck.length}`);
console.log(`Residual (not drained): ${residual.map(s => s.fullUid).join(', ') || 'none'}`);
console.log(`CROSS-CLASS FALSE-PAIRS (must be 0): ${falsePairs.length} ${falsePairs.join(' | ')}`);
// Fail-closed exact-shape ship gate (Codex PR-1 HIGH-2): assert the FULL certified shape, not just >=13.
const EXPECT_STUCK = 14, EXPECT_DRAINED = 13;
const checks = [
  [`stuck === ${EXPECT_STUCK}`, stuck.length === EXPECT_STUCK],
  [`drained === ${EXPECT_DRAINED}`, drained.length === EXPECT_DRAINED],
  [`exactly 1 residual`, residual.length === 1],
  [`residual is skip-only (no engaged anchor-day review → retake per decision #2)`, residual.length === 1 && residual[0].engagedRev === false],
  [`0 cross-class false-pairs`, falsePairs.length === 0],
];
console.log('\n=== SHIP GATE (fail-closed, exact shape) ===');
let pass = true;
for (const [label, ok] of checks) { console.log(`  ${ok ? '✅' : '❌'} ${label}`); if (!ok) pass = false; }
console.log(`\nSHIP GATE: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
process.exit(pass ? 0 : 1);
