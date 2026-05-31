import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';

// Check students collection
const studDoc = await db.collection('students').doc(uid).get();
console.log('students doc exists:', studDoc.exists);
if (studDoc.exists) {
  const d = studDoc.data();
  console.log('KEYS:', Object.keys(d));
  console.log('DATA:', JSON.stringify(d).slice(0, 500));
}

// Check users collection  
const userDoc = await db.collection('users').doc(uid).get();
console.log('users doc exists:', userDoc.exists);
if (userDoc.exists) {
  const d = userDoc.data();
  console.log('KEYS:', Object.keys(d));
  console.log('DATA:', JSON.stringify(d).slice(0, 500));
  // Check for class-related progress
  const classProgress = d.classProgress?.[classId] || d.progress?.[classId] || d.studyProgress?.[classId];
  console.log('classProgress for classId:', classProgress);
}

// Check if there's a student-class-progress doc with composite id
const compositeIds = [
  `${uid}_${classId}`,
  `${classId}_${uid}`,
  `${uid}`,
];
for (const id of compositeIds) {
  try {
    const d = await db.collection('student_class_progress').doc(id).get();
    if (d.exists) console.log('student_class_progress found:', id, JSON.stringify(d.data()).slice(0, 200));
  } catch (e) {}
}

// The log says csd reconciled to 1. Check if this is reflected anywhere
// Search system_logs for any CSD updates
const sysLogsSnap = await db.collection('system_logs').where('userId', '==', uid).get();
console.log('\nAll system_logs for user:');
sysLogsSnap.docs.forEach(d => console.log('  ', JSON.stringify(d.data(), null, 2).slice(0, 400)));

// Check the students subcollection under the class's list
const listStudentDoc = await db.collection('lists').doc('aRGjnGXdU4aupiS8SlXR').collection('student_progress').doc(uid).get();
console.log('\nList student_progress exists:', listStudentDoc.exists);

process.exit(0);
