
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('/app/scripts/serviceAccountKey.json');
initializeApp({ credential: cert(sa) });
const db = getFirestore();
(async () => {
  const uid = 'EPnmY4FIXxVq19tQtxQCvE26p0F3';
  const progressSnap = await db.collection('users/' + uid + '/class_progress').get();
  const result = progressSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      currentStudyDay: data.currentStudyDay,
      streakDays: data.streakDays,
      recentSessionsCount: data.recentSessions ? data.recentSessions.length : 0,
      recentSessionsPreview: (data.recentSessions || []).slice(0, 3)
    };
  });
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
