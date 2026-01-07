/**
 * Script to list CSD (currentStudyDay) and TWI (totalWordsIntroduced) for all students
 * across all classes
 *
 * Run with: node scripts/list-student-progress.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./scripts/serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listAllStudentProgress() {
  console.log('Fetching all classes and student progress...\n');

  // Get all classes
  const classesSnap = await db.collection('classes').get();

  if (classesSnap.empty) {
    console.log('No classes found!');
    return;
  }

  console.log(`Found ${classesSnap.size} classes\n`);

  const allStudents = [];

  for (const classDoc of classesSnap.docs) {
    const classData = classDoc.data();
    const classId = classDoc.id;
    const className = classData.name || 'Unnamed Class';
    const studentIds = classData.studentIds || [];
    const assignedLists = classData.assignedLists || [];

    if (studentIds.length === 0) continue;

    // For each assigned list in the class
    for (const listId of assignedLists) {
      const progressDocId = `${classId}_${listId}`;

      // Get list name
      const listDoc = await db.collection('lists').doc(listId).get();
      const listName = listDoc.exists ? listDoc.data().title || 'Unnamed List' : 'Unknown List';

      for (const studentId of studentIds) {
        // Get student's class_progress document
        const progressRef = db.collection('users').doc(studentId)
          .collection('class_progress').doc(progressDocId);

        const progressSnap = await progressRef.get();

        // Get student name
        const userDoc = await db.collection('users').doc(studentId).get();
        const userName = userDoc.exists
          ? userDoc.data().profile?.displayName || userDoc.data().email || 'Unknown'
          : 'Unknown';

        const progress = progressSnap.exists ? progressSnap.data() : null;
        const csd = progress?.currentStudyDay ?? '-';
        const twi = progress?.totalWordsIntroduced ?? '-';

        allStudents.push({
          className,
          listName,
          userName,
          csd,
          twi
        });
      }
    }
  }

  // Sort by class name, then by CSD descending
  allStudents.sort((a, b) => {
    if (a.className !== b.className) return a.className.localeCompare(b.className);
    if (a.listName !== b.listName) return a.listName.localeCompare(b.listName);
    const aVal = typeof a.csd === 'number' ? a.csd : -1;
    const bVal = typeof b.csd === 'number' ? b.csd : -1;
    return bVal - aVal;
  });

  // Print table
  console.log('Class                | List                 | Student              | CSD | TWI');
  console.log('---------------------|----------------------|----------------------|-----|-----');

  allStudents.forEach(s => {
    const cls = s.className.substring(0, 20).padEnd(20);
    const list = s.listName.substring(0, 20).padEnd(20);
    const name = s.userName.substring(0, 20).padEnd(20);
    const csd = String(s.csd).padStart(3);
    const twi = String(s.twi).padStart(4);
    console.log(`${cls} | ${list} | ${name} | ${csd} | ${twi}`);
  });

  console.log(`\nTotal: ${allStudents.length} student-list combinations`);
}

listAllStudentProgress()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
