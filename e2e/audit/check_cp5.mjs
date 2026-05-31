import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';
const listId = 'aRGjnGXdU4aupiS8SlXR';

// The system log says csd calculated=1. Maybe class_progress uses listId as key
const cpByList = await db.collection('class_progress').where('studentId', '==', uid).where('listId', '==', listId).limit(5).get();
console.log('class_progress by listId:', cpByList.size);

// Try without any filters - just get all class_progress docs for uid
const cpAll = await db.collection('class_progress').limit(20).get();
console.log('Total class_progress docs:', cpAll.size);
// Check if any have our uid
const matching = cpAll.docs.filter(d => JSON.stringify(d.data()).includes(uid));
console.log('Matching with uid:', matching.length);

// Check the class doc - studentIds field
const classDoc = await db.collection('classes').doc(classId).get();
const classData = classDoc.data();
console.log('studentIds includes uid:', classData.studentIds?.includes?.(uid));

// Try the most comprehensive approach - scan class_progress 
const cpScan = await db.collection('class_progress').get();
console.log('class_progress total docs in collection:', cpScan.size);
if (cpScan.size < 50) {
  cpScan.docs.forEach(d => {
    const data = d.data();
    if (data.studentId === uid || data.userId === uid) {
      console.log('MATCH:', d.id, JSON.stringify(data).slice(0, 200));
    }
  });
}

// The system log says "applied" csd=1. This might be stored inside the class doc or elsewhere.
// Check if there's a nested object in the class doc
const studProgress = classData.studentProgress?.[uid];
const studCSD = classData.studentCSD?.[uid];
console.log('Class studentProgress for uid:', studProgress);
console.log('Class studentCSD for uid:', studCSD);

// Check lists subcollection on class 
const listSubcols = await db.collection('classes').doc(classId).listCollections();
console.log('Class subcollections:', listSubcols.map(c => c.id));

process.exit(0);
