import admin from 'firebase-admin';
const projectId = process.env.GCLOUD_PROJECT || 'demo-vocaboost';
admin.initializeApp({ projectId });
const adb = admin.firestore();
await adb.doc('probe/adminSeed').set({ ok: true, at: Date.now() });
console.log('admin-seed-ok');

const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const email = `rest-probe-${Date.now()}@example.test`;
const signup = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'Password123!', returnSecureToken: true })
});
console.log('auth-signup-status', signup.status);
const signupJson = await signup.json();
if (!signup.ok) throw new Error(`auth signup failed: ${JSON.stringify(signupJson)}`);
const token = signupJson.idToken;
console.log('auth-token-present', !!token);

const fsBase = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`;
const readResp = await fetch(`${fsBase}/probe/adminSeed`, { headers: { authorization: `Bearer ${token}` } });
console.log('client-rest-read-status', readResp.status);
const writeResp = await fetch(`${fsBase}/probe/clientWrite?currentDocument.exists=false`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ fields: { ok: { booleanValue: true }, uid: { stringValue: signupJson.localId } } })
});
console.log('client-rest-write-status', writeResp.status);
