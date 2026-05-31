import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';

// Get full users doc - check enrolledClasses
const userDoc = await db.collection('users').doc(uid).get();
const data = userDoc.data();
console.log('enrolledClasses:', JSON.stringify(data.enrolledClasses));
console.log('stats:', JSON.stringify(data.stats));

// enrolledClasses likely has currentStudyDay per class
if (data.enrolledClasses) {
  const classInfo = data.enrolledClasses[classId] || data.enrolledClasses.find?.(c => c.classId === classId);
  console.log('classInfo for classId:', JSON.stringify(classInfo));
  
  // If array
  if (Array.isArray(data.enrolledClasses)) {
    data.enrolledClasses.forEach(c => console.log('  class:', JSON.stringify(c).slice(0, 200)));
  }
  // If object
  if (typeof data.enrolledClasses === 'object') {
    Object.entries(data.enrolledClasses).forEach(([k, v]) => {
      console.log('  key:', k, 'val:', JSON.stringify(v).slice(0, 200));
    });
  }
}
process.exit(0);
