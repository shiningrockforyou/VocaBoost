/**
 * Script to export all attempts from Firestore to a flattened JSON file
 *
 * Run with: node scripts/export-attempts.js
 *
 * Output: attempts_export.json in project root
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
  console.log('Fetching all attempts from Firestore...');

  // Fetch ALL attempts (no filters)
  const snapshot = await db.collection('attempts').get();

  console.log(`Found ${snapshot.size} attempts. Processing...`);

  const attempts = snapshot.docs.map(doc => {
    const data = doc.data();

    // Flatten: include all fields except answers, convert timestamps
    return {
      attemptId: doc.id,
      studentId: data.studentId ?? null,
      testId: data.testId ?? null,
      testType: data.testType ?? null,
      sessionType: data.sessionType ?? null,
      studyDay: data.studyDay ?? null,
      score: data.score ?? null,
      graded: data.graded ?? null,
      skipped: data.skipped ?? null,
      totalQuestions: data.totalQuestions ?? null,
      credibility: data.credibility ?? null,
      retention: data.retention ?? null,
      passed: data.passed ?? null,
      submittedAt: data.submittedAt?.toDate?.().toISOString() ?? null,
      classId: data.classId ?? null,
      listId: data.listId ?? null,
      teacherId: data.teacherId ?? null,
      isFirstDay: data.isFirstDay ?? null,
      listTitle: data.listTitle ?? null,
      segmentStartIndex: data.segmentStartIndex ?? null,
      segmentEndIndex: data.segmentEndIndex ?? null,
      interventionLevel: data.interventionLevel ?? null,
      wordsIntroduced: data.wordsIntroduced ?? null,
      wordsReviewed: data.wordsReviewed ?? null,
      newWordStartIndex: data.newWordStartIndex ?? null,
      newWordEndIndex: data.newWordEndIndex ?? null,
    };
  });

  writeFileSync('./attempts_export.json', JSON.stringify(attempts, null, 2));
  console.log(`Exported ${attempts.length} attempts to attempts_export.json`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
