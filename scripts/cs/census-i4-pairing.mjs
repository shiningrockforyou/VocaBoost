/**
 * CS — I4 Pairing-Predicate Census (READ-ONLY, makes NO writes)
 *
 * Purpose (gates PR-1 per docs/plans/CS_2026-07-17_ROOT_CAUSE_EFFORT.md): over the 26SM cohort,
 * find the I4-stuck victims (storedCSD === anchorDay-1 with a REAL anchor-day review that fails the
 * current exact-range predicate) and measure how many DRAIN under each candidate reader predicate:
 *   P0  current  = temporal(submittedAt>=anchor) + exact-range                              [live]
 *   PA  Agent A  = temporal + engaged + (exact-range OR same-classId)
 *   PC  Agent C  = PA  +  pre-anchor legs: [anchor.nwsi, anchor.nwsi-1] stub OR null-range, same class
 *                        (drops the temporal pre-narrow for those two shapes only)
 * Ship gate: >=24/26 drained AND 0 cross-class false-pairs.
 *
 * Faithful mirror of getMostRecentPassedNewTest (db.js:3507-3609, list-scoped by max newWordEndIndex)
 * and getReviewForDay (db.js:3705-3737). Usage: node scripts/cs/census-i4-pairing.mjs [classRegex=26SM]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();
const filter = new RegExp(process.argv[2] || '26SM', 'i');
const ms = (t) => (t && typeof t.toMillis === 'function') ? t.toMillis() : (t?.toDate ? t.toDate().getTime() : 0);

// engagement predicate (mirror of isEngagedReview): >=80% answered, carve-out tq:0 / autoCompleted
const MIN_ENGAGED = 0.8;
function isEngaged(a) {
  if (a.autoCompleted === true) return true;
  const tq = a.totalQuestions;
  if (!Number.isInteger(tq) || tq === 0) return true;
  const answered = Array.isArray(a.answers)
    ? a.answers.filter(x => String(x?.studentResponse ?? '').trim() !== '').length
    : (tq - (a.skipped ?? 0));
  return answered / tq >= MIN_ENGAGED;
}

// candidate anchor-day reviews (studyDay === anchorDay). P0/PA apply temporal; PC adds pre-anchor legs.
function pairs(review, anchor, mode) {
  if (review.sessionType !== 'review' || review.studyDay !== anchor.studyDay) return false;
  const temporalOk = ms(review.submittedAt) >= ms(anchor.submittedAt);
  const exact = review.newWordStartIndex === anchor.newWordStartIndex && review.newWordEndIndex === anchor.newWordEndIndex;
  const sameClass = review.classId === anchor.classId;
  const engaged = isEngaged(review);
  if (mode === 'P0') return temporalOk && exact;
  if (mode === 'PA') return temporalOk && engaged && (exact || sameClass);
  if (mode === 'PC') {
    if (temporalOk && engaged && (exact || sameClass)) return true;
    // exact-range + same-class is definitive positional proof → pair even if the anchor was
    // refreshed by a later retake (review is temporally pre-anchor but covers the same material)
    if (exact && sameClass) return true;
    // pre-anchor legs (drop temporal): inverted [nwsi, nwsi-1] stub OR null-range, same class, engaged
    if (!sameClass || !engaged) return false;
    const invertedStub = review.newWordStartIndex === anchor.newWordStartIndex && review.newWordEndIndex === anchor.newWordStartIndex - 1;
    const nullRange = review.newWordStartIndex == null && review.newWordEndIndex == null;
    return invertedStub || nullRange;
  }
  return false;
}

// ---- cohort (mirror data-integrity-sweep.mjs selection) ----
const cs = await db.collection('classes').get();
const classes = [];
cs.forEach(d => { const c = d.data(); if (filter.test(c.name || '')) { const L = c.assignments ? Object.keys(c.assignments)[0] : null; classes.push({ id: d.id, name: c.name, listId: L, students: c.studentIds || [] }); } });
console.log(`classes /${filter.source}/i: ${classes.length} | distinct students: ${new Set(classes.flatMap(c => c.students)).size}\n`);

let started = 0, benignNoReview = 0;
const stuck = [];        // I4 victims: P0 fails, anchor-day review exists, storedCSD===anchorDay-1
const falsePairRisk = []; // cross-class review that pairs under PA/PC but not P0

for (const cls of classes) {
  if (!cls.listId) continue;
  for (const uid of cls.students) {
    const docId = `${cls.id}_${cls.listId}`;
    const cp = (await db.collection('users').doc(uid).collection('class_progress').doc(docId).get()).data();
    if (!cp || !(cp.currentStudyDay > 0)) continue;
    started++;
    const storedCSD = cp.currentStudyDay || 0;
    // list-scoped attempts for this student
    const at = (await db.collection('attempts').where('studentId', '==', uid).where('listId', '==', cls.listId).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const passedNew = at.filter(a => a.sessionType === 'new' && a.passed === true && Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex >= 0);
    if (!passedNew.length) continue;
    // anchor = max newWordEndIndex, tie submittedAt desc (db.js:3552-3553)
    const anchor = passedNew.slice().sort((a, b) => (b.newWordEndIndex - a.newWordEndIndex) || (ms(b.submittedAt) - ms(a.submittedAt)))[0];
    const anchorDay = anchor.studyDay;
    if (!(anchorDay >= 2)) continue;
    const dayReviews = at.filter(a => a.sessionType === 'review' && a.studyDay === anchorDay);
    const p0 = dayReviews.some(r => pairs(r, anchor, 'P0'));
    // benign: csd===anchorDay-1 but NO anchor-day review at all (normal mid-day) — exclude
    if (!dayReviews.length) { if (storedCSD === anchorDay - 1) benignNoReview++; continue; }
    if (p0) continue; // already pairs → not stuck
    if (storedCSD !== anchorDay - 1) continue; // not pinned at the stuck signature
    const pa = dayReviews.some(r => pairs(r, anchor, 'PA'));
    const pc = dayReviews.some(r => pairs(r, anchor, 'PC'));
    const shapes = dayReviews.map(r => {
      const pre = ms(r.submittedAt) < ms(anchor.submittedAt) ? 'pre' : 'post';
      const rg = (r.newWordStartIndex == null && r.newWordEndIndex == null) ? 'null'
        : (r.newWordStartIndex === anchor.newWordStartIndex && r.newWordEndIndex === anchor.newWordStartIndex - 1) ? 'inv[twi,twi-1]'
        : `[${r.newWordStartIndex},${r.newWordEndIndex}]`;
      return `${pre}/${rg}/${isEngaged(r) ? 'eng' : 'skip'}`;
    });
    // cross-class false-pair oracle: an anchor-day review from a DIFFERENT class that pairs under PA/PC
    const crossClassPair = dayReviews.some(r => r.classId !== anchor.classId && (pairs(r, anchor, 'PA') || pairs(r, anchor, 'PC')) && !pairs(r, anchor, 'P0'));
    if (crossClassPair) falsePairRisk.push(`${uid.slice(0, 8)} ${cls.name.slice(0, 16)} d${anchorDay}`);
    stuck.push({ uid, cls: cls.name, anchorDay, storedCSD, anchorRange: `[${anchor.newWordStartIndex},${anchor.newWordEndIndex}]`, nRev: dayReviews.length, shapes, pa, pc });
  }
}

const drainPA = stuck.filter(s => s.pa).length;
const drainPC = stuck.filter(s => s.pc).length;
const residual = stuck.filter(s => !s.pc);
console.log(`started(26SM): ${started} | benign csd==anchorDay-1 no-review (excluded): ${benignNoReview}\n`);
console.log(`=== I4-STUCK VICTIMS (P0 fails, anchor-day review exists, storedCSD===anchorDay-1): ${stuck.length} ===`);
for (const s of stuck) console.log(`  ${s.uid.slice(0, 8)} ${s.cls.slice(0, 16).padEnd(16)} d${s.anchorDay} csd${s.storedCSD} anc${s.anchorRange} rev×${s.nRev} PA:${s.pa ? 'Y' : '·'} PC:${s.pc ? 'Y' : '·'} | ${s.shapes.slice(0, 3).join(' ')}`);
console.log(`\n=== DRAIN ===`);
console.log(`  PA (same-class leg):        ${drainPA}/${stuck.length}`);
console.log(`  PC (+ pre-anchor stub leg): ${drainPC}/${stuck.length}`);
console.log(`  residual (neither drains):  ${residual.length}${residual.length ? ' → ' + residual.map(s => s.uid.slice(0, 8)).join(',') : ''}`);
console.log(`\n=== CROSS-CLASS FALSE-PAIR RISK (must be 0): ${falsePairRisk.length} ===`);
falsePairRisk.forEach(f => console.log('  ' + f));
console.log(`\nSHIP GATE: drain>=24 AND falsePairs==0 → PA:${drainPA >= 24 && !falsePairRisk.length ? 'PASS' : 'check'} PC:${drainPC >= 24 && !falsePairRisk.length ? 'PASS' : 'check'}`);
process.exit(0);
