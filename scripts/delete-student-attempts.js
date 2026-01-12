/**
 * Delete all attempts for a specific student
 * Usage: node scripts/delete-student-attempts.js <studentId>
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteStudentAttempts(studentId) {
  console.log(`\nDeleting all attempts for studentId: ${studentId}\n`);

  const attemptsRef = db.collection('attempts');
  const query = attemptsRef.where('studentId', '==', studentId);

  try {
    const snapshot = await query.get();

    console.log(`Found ${snapshot.size} attempts to delete\n`);

    if (snapshot.size === 0) {
      console.log('No attempts found for this student.');
      return;
    }

    // Delete in batches of 500
    const batchSize = 500;
    let batch = db.batch();
    let batchCount = 0;
    let totalDeleted = 0;

    for (const doc of snapshot.docs) {
      console.log(`Queuing for deletion: ${doc.id}`);
      batch.delete(doc.ref);
      batchCount++;
      totalDeleted++;

      if (batchCount >= batchSize) {
        console.log(`\nCommitting batch of ${batchCount} deletions...`);
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      console.log(`\nCommitting final batch of ${batchCount} deletions...`);
      await batch.commit();
    }

    console.log(`\n✓ Successfully deleted ${totalDeleted} attempts for student ${studentId}`);

  } catch (err) {
    console.error('Error deleting attempts:', err);
    throw err;
  }
}

// Get studentId from command line
const studentId = process.argv[2];

if (!studentId) {
  console.error('Usage: node scripts/delete-student-attempts.js <studentId>');
  process.exit(1);
}

deleteStudentAttempts(studentId)
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFailed:', err);
    process.exit(1);
  });
