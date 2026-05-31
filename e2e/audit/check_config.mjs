import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const classDoc = await db.collection('classes').doc('LVjBTFuYE8FbPG34pVAt').get();
const data = classDoc.data();
console.log('assignments:', JSON.stringify(data.assignments));
console.log('assignedLists:', JSON.stringify(data.assignedLists));

// The attempt shows wordsIntroduced=60, newWordStartIndex=0, newWordEndIndex=59
// So pace = 60 for this class

// Also check what the test mode is
const assignment = data.assignments?.[0] || data.assignedLists?.[0];
console.log('first assignment:', JSON.stringify(assignment));

// Check session from users subcollection
const sessSnap = await db.collection('users').doc('pGqG1GT5Y3ZU5WT7e0smwqWQWdb2').collection('sessions').get();
sessSnap.docs.forEach(d => {
  const data = d.data();
  console.log('SESSION:', d.id);
  console.log('  dayNumber:', data.dayNumber, 'wordsIntroduced:', data.wordsIntroduced, 'newWordScore:', data.newWordScore);
  console.log('  wordsTested:', data.wordsTested);
});
process.exit(0);
