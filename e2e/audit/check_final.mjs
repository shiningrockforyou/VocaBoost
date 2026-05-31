import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';
const listId = 'aRGjnGXdU4aupiS8SlXR';

// Get the D1-09 attempt (the successful one)
const attemptId = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780261165859_odizkn6an';
const attempt = await db.collection('attempts').doc(attemptId).get();
const data = attempt.data();
console.log('D1-09 ATTEMPT:');
console.log('  score:', data.score, '/', data.totalQuestions, '(', Math.round(data.score/data.totalQuestions*100), '%)');
console.log('  passed:', data.passed);
console.log('  studyDay:', data.studyDay);
console.log('  isFirstDay:', data.isFirstDay);
console.log('  wordsIntroduced:', data.wordsIntroduced);
console.log('  newWordStartIndex:', data.newWordStartIndex);
console.log('  newWordEndIndex:', data.newWordEndIndex);
console.log('  Q1 word:', data.answers[0].word);
console.log('  Q1 correctAnswer:', data.answers[0].correctAnswer);
console.log('  Q1 studentResponse:', data.answers[0].studentResponse);
console.log('  Q1 isCorrect:', data.answers[0].isCorrect);
console.log('  ALL isCorrect:', data.answers.every(a => a.isCorrect));

// Check final class_progress (should be CSD=1)
const cpSnap = await db.collection('users').doc(uid).collection('class_progress').get();
cpSnap.docs.forEach(d => {
  console.log('\nCLASS_PROGRESS:', d.id);
  console.log('  currentStudyDay:', d.data().currentStudyDay);
  console.log('  totalWordsIntroduced:', d.data().totalWordsIntroduced);
  console.log('  streakDays:', d.data().streakDays);
  console.log('  lastStudyDate:', d.data().lastStudyDate);
});

// Check orphan docs
const orphanCols = ['sessions_draft', 'pending_sessions', 'draft_attempts'];
for (const col of orphanCols) {
  try {
    const s = await db.collection(col).where('studentId', '==', uid).limit(5).get();
    if (!s.empty) console.log('\nORPHAN found in', col, s.size, 'docs');
  } catch (e) {}
}

// Check sessions
const sessSnap = await db.collection('users').doc(uid).collection('sessions').get();
console.log('\nSESSIONS count:', sessSnap.size);
sessSnap.docs.forEach(d => {
  const d2 = d.data();
  console.log('  session:', d.id, 'day:', d2.dayNumber, 'wordsIntroduced:', d2.wordsIntroduced);
});

// All attempts count
const allAttempts = await db.collection('attempts').where('studentId', '==', uid).get();
console.log('\nTOTAL ATTEMPTS:', allAttempts.size);
allAttempts.docs.forEach(d => {
  const a = d.data();
  console.log('  attempt studyDay:', a.studyDay, 'passed:', a.passed, 'score:', a.score, '/', a.totalQuestions, 'isFirstDay:', a.isFirstDay);
});

process.exit(0);
