const projectId = process.env.GCLOUD_PROJECT || 'demo-vocaboost';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const email = `fn-probe-${Date.now()}@example.test`;
const signup = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: 'Password123!', returnSecureToken: true })
});
console.log('auth-signup-status', signup.status);
const signupJson = await signup.json();
if (!signup.ok) throw new Error(`auth signup failed: ${JSON.stringify(signupJson)}`);
const url = `http://127.0.0.1:5001/${projectId}/us-central1/version`;
const resp = await fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${signupJson.idToken}` },
  body: JSON.stringify({ data: {} })
});
console.log('version-call-status', resp.status);
const text = await resp.text();
console.log('version-call-body-prefix', text.slice(0, 220).replace(/\s+/g, ' '));
if (!resp.ok) process.exit(2);
