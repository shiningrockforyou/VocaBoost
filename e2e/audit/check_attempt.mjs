import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const snap = await db.collection('attempts').where('studentId', '==', 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2').get();
for (const d of snap.docs) {
  const data = d.data();
  console.log('ATTEMPT ID:', d.id);
  console.log('KEYS:', JSON.stringify(Object.keys(data)));
  const answers = data.answers || data.responses || data.wordResponses || data.results || data.gradedResults || [];
  if (Array.isArray(answers) && answers.length > 0) {
    console.log('ANSWERS[0] keys:', JSON.stringify(Object.keys(answers[0])));
    console.log('ANSWERS[0]:', JSON.stringify(answers[0]).slice(0, 300));
  } else {
    // Check all top-level data
    console.log('DATA (trimmed):', JSON.stringify(data).slice(0, 500));
  }
  console.log('---');
}
process.exit(0);
