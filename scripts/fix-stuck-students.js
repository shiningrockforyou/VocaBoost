/**
 * Script to fix students stuck on Day 0
 *
 * Run with: node scripts/fix-stuck-students.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt';
const LIST_ID = '7Is5UdS4P4a12vc6mSnp';
const PROGRESS_DOC_ID = `${CLASS_ID}_${LIST_ID}`;

// Students stuck on Day 0
const STUCK_STUDENTS = [
  { id: '56Htadxc1YbArnVH2tx630Ir43d2', name: 'Hyegyo Jung' },
  { id: '8McyUrRd2dZzZliNzlW4FHOVBNK2', name: 'Sungjun Yoon' },
  { id: '8Nn6jxzgfqaw4Xt8olfcSWxXVrF2', name: 'EUIGUK KIM' },
  { id: '8lAhAnZALRVTe0CvWAWFcVQg5R63', name: '이예승' },
  { id: 'HRLL0C9AaXdWnnPzsHVfJZ1oqiu2', name: 'Jimin Ban' },
  { id: 'IyJ3lg8b90ayN6BcEiJa18DlRsP2', name: 'Eunchan Lee' },
  { id: 'KQYeBKPwgvht9mIYZ4zqWOFcXDq1', name: 'Yul So' },
  { id: 'OUjjTroWm2SCRANuv3IPSP7Iwc52', name: '김해연' },
  { id: 'Qwg0tgFWO6POyAhIR2cLEdgSIvj1', name: 'Jay Oh' },
  { id: 'TgRxq6J6oJPdSX9ZV51HNithWur1', name: 'Jimin kim' },
  { id: 'Z8LEhvn4w5SdvJ1yrEsnKPrmFKU2', name: 'Hoyeong Shin' },
  { id: 'rrUYO4nuWrOr2IBDypsLryczZr82', name: 'David Lee' },
  { id: 't09Sjku5IgdZrUamuak7uGSY0DA3', name: 'sol lee' },
];

async function fixStuckStudents() {
  console.log(`Fixing ${STUCK_STUDENTS.length} students...\n`);

  for (const student of STUCK_STUDENTS) {
    const progressRef = db.collection('users').doc(student.id)
      .collection('class_progress').doc(PROGRESS_DOC_ID);

    try {
      await progressRef.update({
        currentStudyDay: 1,
        totalWordsIntroduced: 60,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`✓ Fixed ${student.name} (${student.id})`);
    } catch (err) {
      console.error(`✗ Failed to fix ${student.name}: ${err.message}`);
    }
  }

  console.log('\nDone!');
}

fixStuckStudents()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
