import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';
const listId = 'aRGjnGXdU4aupiS8SlXR';

// Try class progress from system_log: the log says csd calculated=1, applied=1
// This means the class_progress doc likely has csd=1 now or uses a different schema
// Let's look for it in classes subcollection
const progressDoc1 = await db.collection('classes').doc(classId).collection('progress').doc(uid).get();
console.log('classes/progress/uid exists:', progressDoc1.exists);
if (progressDoc1.exists) console.log(JSON.stringify(progressDoc1.data(), null, 2));

const progressDoc2 = await db.collection('classes').doc(classId).collection('student_progress').doc(uid).get();
console.log('classes/student_progress/uid exists:', progressDoc2.exists);
if (progressDoc2.exists) console.log(JSON.stringify(progressDoc2.data(), null, 2));

// Try with composite key in class_progress
const cpDirect = await db.collection('class_progress').doc(`${uid}_${classId}`).get();
console.log('class_progress/uid_classId exists:', cpDirect.exists);
if (cpDirect.exists) console.log(JSON.stringify(cpDirect.data(), null, 2));

// Check if list_progress exists
const lpSnap = await db.collection('list_progress').where('studentId', '==', uid).limit(5).get();
console.log('list_progress docs:', lpSnap.size);
lpSnap.docs.forEach(d => console.log(d.id, JSON.stringify(d.data()).slice(0, 200)));

// Check student_list_progress
const slpSnap = await db.collection('student_list_progress').where('studentId', '==', uid).limit(5).get();
console.log('student_list_progress docs:', slpSnap.size);
slpSnap.docs.forEach(d => console.log(d.id, JSON.stringify(d.data()).slice(0, 200)));

// Try classes/{classId}/list_progress
const clpSnap = await db.collection('classes').doc(classId).collection('list_progress').where('studentId', '==', uid).limit(5).get();
console.log('classes/list_progress docs:', clpSnap.size);

// What's in system_log - csd=1 was applied. Check classes/students subcollection
const studSubcol = await db.collection('classes').doc(classId).collection('students').doc(uid).get();
console.log('classes/students/uid exists:', studSubcol.exists);
if (studSubcol.exists) console.log(JSON.stringify(studSubcol.data(), null, 2));

process.exit(0);
