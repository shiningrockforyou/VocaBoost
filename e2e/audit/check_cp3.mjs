import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';

// Check all collections and look for uid
const colsList = await db.listCollections();
console.log('All collections:');
for (const col of colsList) {
  // Search for uid in each collection
  try {
    const snap1 = await col.where('studentId', '==', uid).limit(1).get();
    const snap2 = await col.where('userId', '==', uid).limit(1).get();
    if (!snap1.empty || !snap2.empty) {
      console.log('  ', col.id, '- has student docs:', snap1.size + snap2.size);
      const d = snap1.empty ? snap2.docs[0] : snap1.docs[0];
      console.log('    sample:', JSON.stringify(d.data()).slice(0, 150));
    }
  } catch (e) {
    // skip
  }
}
process.exit(0);
