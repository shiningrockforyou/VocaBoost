import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';

// List all collections at root
const cols = await db.listCollections();
for (const col of cols) {
  const snap = await col.limit(1).get();
  if (!snap.empty) {
    const firstDoc = snap.docs[0].data();
    const hasUid = JSON.stringify(firstDoc).includes(uid);
    if (hasUid) {
      console.log('Collection with uid:', col.id);
    }
  }
}

// Specifically search for this student's data
const latestAttemptId = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2_vocaboost_test_LVjBTFuYE8FbPG34pVAt_aRGjnGXdU4aupiS8SlXR_new_1780261165859_odizkn6an';
const latestAttempt = await db.collection('attempts').doc(latestAttemptId).get();
const data = latestAttempt.data();
console.log('All attempt fields:', Object.keys(data));
console.log('isFirstDay:', data.isFirstDay);
console.log('passed:', data.passed);
console.log('studyDay:', data.studyDay);
console.log('wordsIntroduced:', data.wordsIntroduced);
console.log('wordsReviewed:', data.wordsReviewed);
console.log('newWordStartIndex:', data.newWordStartIndex);
console.log('newWordEndIndex:', data.newWordEndIndex);
console.log('segmentStartIndex:', data.segmentStartIndex);
console.log('segmentEndIndex:', data.segmentEndIndex);

process.exit(0);
