
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('/app/scripts/serviceAccountKey.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const uid = 'oAdTNIw0dlTtFf8nRiWjewvH0Cr1';
(async () => {
  const userDoc = await db.doc('users/' + uid).get();
  const classProgressSnap = await db.collection('users/' + uid + '/class_progress').get();
  const studyStatesSnap = await db.collection('users/' + uid + '/study_states').get();
  const attemptsSnap = await db.collection('attempts').where('studentId', '==', uid).orderBy('submittedAt', 'desc').limit(5).get();
  const result = {
    userDoc: userDoc.exists ? userDoc.data() : null,
    classProgress: classProgressSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    studyStates: studyStatesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    recentAttempts: attemptsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  };
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
