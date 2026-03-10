/**
 * Script to export all typed test attempts with full answers from Firestore
 * Purpose: Analyze AI grading accuracy
 *
 * Run with: node scripts/export-typed-test-answers.js
 *
 * Output: typed_test_answers_export.json in project root
 */

import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function main() {
  console.log('Fetching all typed test attempts from Firestore...');

  const snapshot = await db.collection('attempts')
    .where('testType', '==', 'typed')
    .get();

  console.log(`Found ${snapshot.size} typed test attempts. Processing...`);

  const attempts = snapshot.docs.map(doc => {
    const data = doc.data();

    const answers = (data.answers || []).map(a => ({
      wordId: a.wordId ?? null,
      word: a.word ?? null,
      correctAnswer: a.correctAnswer ?? null,
      studentResponse: a.studentResponse ?? a.studentAnswer ?? null,
      isCorrect: a.isCorrect ?? null,
      aiReasoning: a.aiReasoning ?? null,
      challengeStatus: a.challengeStatus ?? null,
      challengeNote: a.challengeNote ?? null,
      challengeReviewedBy: a.challengeReviewedBy ?? null,
      challengeReviewedAt: a.challengeReviewedAt?.toDate?.().toISOString() ?? null,
    }));

    return {
      attemptId: doc.id,
      studentId: data.studentId ?? null,
      testId: data.testId ?? null,
      sessionType: data.sessionType ?? null,
      studyDay: data.studyDay ?? null,
      score: data.score ?? null,
      totalQuestions: data.totalQuestions ?? null,
      skipped: data.skipped ?? null,
      classId: data.classId ?? null,
      listId: data.listId ?? null,
      submittedAt: data.submittedAt?.toDate?.().toISOString() ?? null,
      answers,
    };
  });

  writeFileSync('./typed_test_answers_export.json', JSON.stringify(attempts, null, 2));
  console.log(`Exported ${attempts.length} typed test attempts to typed_test_answers_export.json`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
