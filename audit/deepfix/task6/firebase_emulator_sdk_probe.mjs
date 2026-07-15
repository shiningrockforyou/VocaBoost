import admin from 'firebase-admin';
import { initializeApp as initClient } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || 'demo-vocaboost';
admin.initializeApp({ projectId });
const adb = admin.firestore();
await adb.doc('probe/adminSeed').set({ ok: true, at: Date.now() });
const adminRead = await adb.doc('probe/adminSeed').get();
console.log('admin-firestore-read', adminRead.exists, adminRead.data()?.ok === true);

const app = initClient({ projectId, apiKey: 'demo-key', authDomain: `${projectId}.firebaseapp.com` });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);
const email = `probe-${Date.now()}@example.test`;
await createUserWithEmailAndPassword(auth, email, 'Password123!');
console.log('client-auth-user', !!auth.currentUser?.uid);
try {
  await getDoc(doc(db, 'probe/adminSeed'));
  console.log('client-firestore-read', 'allowed');
} catch (err) {
  console.log('client-firestore-read', 'denied-or-error', err.code || err.message);
}
try {
  await setDoc(doc(db, 'probe/clientWrite'), { uid: auth.currentUser.uid, at: Date.now() });
  console.log('client-firestore-write', 'allowed');
} catch (err) {
  console.log('client-firestore-write', 'denied-or-error', err.code || err.message);
}
