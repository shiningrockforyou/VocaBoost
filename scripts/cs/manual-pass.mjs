/**
 * CS — Manual Pass (writes a VALID reconciliation anchor)
 *
 * Purpose: unstick a student who couldn't pass a new-word test through the app
 * (e.g. a grading failure) by writing a `passed:true` new-word attempt for a day.
 *
 * CRITICAL: a passed `new` attempt is the CSD/TWI reconciliation ANCHOR
 * (getOrCreateClassProgress -> getMostRecentPassedNewTest -> twi = newWordEndIndex+1).
 * The old ad-hoc manual scripts OMITTED newWordEndIndex, producing "invalid anchors"
 * (CS-2026-06-21). This script always writes the full anchor field set so reconciliation
 * stays correct. Derives the word range from the student's verified daily pace.
 *
 * Usage:
 *   node scripts/cs/manual-pass.mjs <email> <classId> <listId> <studyDay> <score> [--dry]
 *   (score is 0-100; pace auto-derived from the student's day-1 attempt, default 80)
 *
 * READ the value back: re-run scripts/cs/data-integrity-sweep.mjs afterward.
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();

const [email, classId, listId, dayArg, scoreArg, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry');
if (!email || !classId || !listId || !dayArg || !scoreArg) {
  console.error('usage: node scripts/cs/manual-pass.mjs <email> <classId> <listId> <studyDay> <score 0-100> [--dry]');
  process.exit(1);
}
const studyDay = Number(dayArg), score = Number(scoreArg);

const us = await db.collection('users').where('email','==',email).limit(1).get();
if (us.empty) { console.error('no user for', email); process.exit(1); }
const uid = us.docs[0].id;

// derive pace from the student's day-1 passed-new attempt (else 80/day cohort default)
const newAt = (await db.collection('attempts').where('studentId','==',uid).get()).docs
  .map(d=>d.data()).filter(a=>a.sessionType==='new'&&a.passed===true&&a.classId===classId);
const day1 = newAt.find(a=>a.studyDay===1 && Number.isInteger(a.newWordEndIndex));
const pace = day1 ? day1.newWordEndIndex + 1 : 80;
const newWordStartIndex = (studyDay - 1) * pace;
const newWordEndIndex = studyDay * pace - 1;

const c = (await db.collection('classes').doc(classId).get()).data() || {};
const listTitle = c.assignments?.[listId]?.listTitle || 'Vocabulary List';
const teacherId = c.ownerTeacherId || null;
const docId = `${uid}_${classId}_${listId}_day${studyDay}_typed_new_manual`;

const payload = {
  studentId: uid, classId, listId, teacherId,
  testId: `vocaboost_test_${classId}_${listId}_new`,   // valid testId (was missing before)
  sessionType: 'new', testType: 'typed', studyDay,
  score, passed: score >= (c.assignments?.[listId]?.passThreshold ?? 92), graded: true,
  newWordStartIndex, newWordEndIndex, wordsIntroduced: newWordEndIndex - newWordStartIndex + 1, // VALID ANCHOR
  isFirstDay: studyDay === 1, totalQuestions: 30, answers: [], skipped: 0,
  interventionLevel: 0, wordsReviewed: 0, segmentStartIndex: 0, segmentEndIndex: 0,
  credibility: 1, retention: 1,
  manualOverride: true,
  manualReviewNote: `CS manual pass (${new Date().toISOString().slice(0,10)}) — valid anchor written by scripts/cs/manual-pass.mjs`,
  submittedAt: admin.firestore.Timestamp.now(),
};
console.log(`${dry?'[DRY] ':''}manual-pass ${email} ${classId.slice(0,8)}/${listId.slice(0,8)} day${studyDay} score${score} -> nwsi=${newWordStartIndex} nwei=${newWordEndIndex} (pace ${pace}, passed=${payload.passed})`);
if (!dry) { await db.collection('attempts').doc(docId).set(payload, { merge: true }); console.log('written:', docId); }
process.exit(0);
