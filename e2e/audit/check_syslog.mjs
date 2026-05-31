import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';

// Check system_logs for this student
const snap = await db.collection('system_logs').where('userId', '==', uid).limit(10).get();
console.log('SYSTEM LOGS:', snap.size);
snap.docs.forEach(d => {
  console.log('\n--- LOG', d.id.slice(0, 30));
  console.log(JSON.stringify(d.data(), null, 2).slice(0, 500));
});

// Check class doc for joined students
const classDoc = await db.collection('classes').doc('LVjBTFuYE8FbPG34pVAt').get();
if (classDoc.exists) {
  const data = classDoc.data();
  console.log('\nCLASS KEYS:', JSON.stringify(Object.keys(data)));
  // Check members subcollection
  const membersSnap = await db.collection('classes').doc('LVjBTFuYE8FbPG34pVAt').collection('members').where('studentId', '==', uid).get();
  if (!membersSnap.empty) {
    console.log('Found in classes/members subcollection');
    membersSnap.docs.forEach(d => console.log(JSON.stringify(d.data()).slice(0, 200)));
  }
  const studentsSnap = await db.collection('classes').doc('LVjBTFuYE8FbPG34pVAt').collection('students').where('uid', '==', uid).get();
  if (!studentsSnap.empty) {
    console.log('Found in classes/students subcollection');
    studentsSnap.docs.forEach(d => console.log(JSON.stringify(d.data()).slice(0, 200)));
  }
  
  // Check class progress in a subcollection
  const progressSnap = await db.collection('classes').doc('LVjBTFuYE8FbPG34pVAt').collection('progress').where('studentId', '==', uid).get();
  if (!progressSnap.empty) {
    console.log('Found class progress in subcollection');
    progressSnap.docs.forEach(d => console.log(JSON.stringify(d.data(), null, 2)));
  } else {
    // Try direct doc access
    const progressDoc = await db.collection('classes').doc('LVjBTFuYE8FbPG34pVAt').collection('progress').doc(uid).get();
    if (progressDoc.exists) {
      console.log('PROGRESS DOC (by uid):', JSON.stringify(progressDoc.data(), null, 2));
    }
  }
}

process.exit(0);
