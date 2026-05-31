import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('/app/scripts/serviceAccountKey.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const uid = 'pGqG1GT5Y3ZU5WT7e0smwqWQWdb2';
const classId = 'LVjBTFuYE8FbPG34pVAt';

// Check users/{uid}/class_progress
const cpSnap = await db.collection('users').doc(uid).collection('class_progress').get();
console.log('users/class_progress docs:', cpSnap.size);
cpSnap.docs.forEach(d => console.log('  id:', d.id, 'data:', JSON.stringify(d.data(), null, 2)));

// Check users/{uid}/session_states
const ssSnap = await db.collection('users').doc(uid).collection('session_states').limit(5).get();
console.log('\nusers/session_states docs:', ssSnap.size);
ssSnap.docs.forEach(d => console.log('  id:', d.id, 'data:', JSON.stringify(d.data()).slice(0, 200)));

// Check users/{uid}/study_states
const studySnap = await db.collection('users').doc(uid).collection('study_states').limit(5).get();
console.log('\nusers/study_states docs:', studySnap.size);
studySnap.docs.forEach(d => console.log('  id:', d.id, 'data:', JSON.stringify(d.data()).slice(0, 200)));

// Check sessions
const sessSnap = await db.collection('users').doc(uid).collection('sessions').limit(5).get();
console.log('\nusers/sessions docs:', sessSnap.size);
sessSnap.docs.forEach(d => console.log('  id:', d.id, 'data:', JSON.stringify(d.data()).slice(0, 200)));

process.exit(0);
