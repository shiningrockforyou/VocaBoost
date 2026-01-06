/**
 * Script to find students stuck on Day 0 for a specific class/list
 *
 * Run with: node scripts/find-stuck-students.js
 *
 * Requires: Firebase Admin SDK credentials
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin (make sure you have serviceAccountKey.json)
const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const CLASS_ID = 'LVjBTFuYE8FbPG34pVAt';
const LIST_ID = '7Is5UdS4P4a12vc6mSnp';
const PROGRESS_DOC_ID = `${CLASS_ID}_${LIST_ID}`;

async function findStuckStudents() {
  console.log(`Looking for students stuck on Day 0 in class ${CLASS_ID}...`);
  console.log(`Progress doc ID: ${PROGRESS_DOC_ID}\n`);

  // Get the class document to find all students
  const classDoc = await db.collection('classes').doc(CLASS_ID).get();

  if (!classDoc.exists) {
    console.error('Class not found!');
    return;
  }

  const classData = classDoc.data();
  const studentIds = classData.studentIds || [];

  console.log(`Found ${studentIds.length} students in class\n`);

  const stuckStudents = [];
  const noProgressStudents = [];
  const okStudents = [];

  for (const studentId of studentIds) {
    // Get student's class_progress document
    const progressRef = db.collection('users').doc(studentId)
      .collection('class_progress').doc(PROGRESS_DOC_ID);

    const progressSnap = await progressRef.get();

    // Get student name
    const userDoc = await db.collection('users').doc(studentId).get();
    const userName = userDoc.exists ? userDoc.data().profile?.displayName || userDoc.data().email : 'Unknown';

    if (!progressSnap.exists) {
      noProgressStudents.push({ studentId, userName });
    } else {
      const progress = progressSnap.data();
      const currentStudyDay = progress.currentStudyDay || 0;
      const totalWordsIntroduced = progress.totalWordsIntroduced || 0;

      if (currentStudyDay === 0) {
        stuckStudents.push({
          studentId,
          userName,
          currentStudyDay,
          totalWordsIntroduced
        });
      } else {
        okStudents.push({
          studentId,
          userName,
          currentStudyDay,
          totalWordsIntroduced
        });
      }
    }
  }

  // Report results
  console.log('=== STUDENTS STUCK ON DAY 0 ===');
  if (stuckStudents.length === 0) {
    console.log('None found!');
  } else {
    stuckStudents.forEach(s => {
      console.log(`- ${s.userName} (${s.studentId})`);
      console.log(`  currentStudyDay: ${s.currentStudyDay}, totalWordsIntroduced: ${s.totalWordsIntroduced}`);
    });
  }

  console.log('\n=== STUDENTS WITH NO PROGRESS DOC ===');
  if (noProgressStudents.length === 0) {
    console.log('None found!');
  } else {
    noProgressStudents.forEach(s => {
      console.log(`- ${s.userName} (${s.studentId})`);
    });
  }

  console.log('\n=== STUDENTS OK (Day 1+) ===');
  okStudents.forEach(s => {
    console.log(`- ${s.userName}: Day ${s.currentStudyDay}, ${s.totalWordsIntroduced} words`);
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Stuck on Day 0: ${stuckStudents.length}`);
  console.log(`No progress doc: ${noProgressStudents.length}`);
  console.log(`OK (Day 1+): ${okStudents.length}`);
  console.log(`Total students: ${studentIds.length}`);
}

findStuckStudents()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
