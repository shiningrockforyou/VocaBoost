import admin from 'firebase-admin';
const projectId = process.env.GCLOUD_PROJECT || 'demo-vocaboost';
admin.initializeApp({ projectId });
const db = admin.firestore();
await db.doc('probe/adminOnly').set({ ok: true, at: Date.now() });
const snap = await db.doc('probe/adminOnly').get();
console.log('admin-only-read', snap.exists, snap.data()?.ok === true);
