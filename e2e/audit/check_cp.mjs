import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';

// Try different patterns
const patterns = [
  { col: 'class_progress', field: 'studentId', val: uid },
  { col: 'class_progress', field: 'userId', val: uid },
  { col: 'student_progress', field: 'studentId', val: uid },
  { col: 'student_class', field: 'studentId', val: uid },
];

for (const p of patterns) {
  const snap = await db.collection(p.col).where(p.field, '==', p.val).limit(3).get();
  if (!snap.empty) {
    console.log(`FOUND in ${p.col}.${p.field}:`, snap.size, 'docs');
    snap.docs.forEach(d => console.log('  doc:', d.id, JSON.stringify(d.data()).slice(0, 200)));
  }
}

// Try composite doc ID
const compositeId = `${uid}_${classId}`;
const directDoc = await db.collection('class_progress').doc(compositeId).get();
if (directDoc.exists) {
  console.log('FOUND by composite ID:', compositeId);
  console.log(JSON.stringify(directDoc.data(), null, 2));
}

// Check class membership
const memberSnap = await db.collection('class_members').where('studentId', '==', uid).limit(5).get();
console.log('CLASS MEMBERS:', memberSnap.size);
memberSnap.docs.forEach(d => console.log('  member:', d.id, JSON.stringify(d.data()).slice(0, 200)));

// Check enrollments
const enrollSnap = await db.collection('enrollments').where('studentId', '==', uid).limit(5).get();
console.log('ENROLLMENTS:', enrollSnap.size);
enrollSnap.docs.forEach(d => console.log('  enroll:', d.id, JSON.stringify(d.data()).slice(0, 200)));

process.exit(0);
