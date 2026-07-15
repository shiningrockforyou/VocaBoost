/**
 * B_LIST_PROGRESS_PHASE1_UI — account provisioning (Admin SDK, PRE-AUDIT ONLY).
 * Policy amendment (David, 2026-07-05): accounts THEMSELVES may be created via Admin
 * SDK; everything after login is full-UI. This script creates auth users + user docs
 * byte-matching the app's signup shape (db.js createUserDocument defaults) and NOTHING
 * else — no classes, no enrollments, no progress (those are UI-only PREP work).
 * Idempotent: existing accounts are left untouched (reported).
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_provision.mjs
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync } from 'fs';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const auth = admin.auth();
// Credentials from env / gitignored secret (Codex security finding — never hard-coded).
const PASS = process.env.LSR_AUDIT_PW
  || (() => { try { return JSON.parse(readFileSync('/app/audit/playwright/.lsr_secret.json', 'utf8')).password; } catch { return null; } })();
if (!PASS) { console.error('LSR_AUDIT_PW not set and .lsr_secret.json missing — aborting provisioning'); process.exit(2); }

// Roster size is env-configurable so the pool can grow (David 2026-07-12: provision fresh accounts as
// needed — never reset; dirty accounts stay as records). Idempotent: existing accounts are left untouched.
// TEACHER pool is env-configurable too (David 2026-07-12: 8 audit teachers for the persona expansion, to
// match the ~8-concurrent ceiling). teacher_01 keeps its original 'LSR Teacher' displayName (idempotent-
// untouched); new teachers get 'LSR Teacher NN'. Set LSR_ACCOUNT_COUNT to the CURRENT student count when
// re-running so the roster file is not truncated (idempotent re-list of existing students).
const TEACHER_COUNT = parseInt(process.env.LSR_TEACHER_COUNT || '8', 10);
const ACCOUNT_COUNT = parseInt(process.env.LSR_ACCOUNT_COUNT || '46', 10);
const ACCOUNTS = [
  ...Array.from({ length: TEACHER_COUNT }, (_, i) => ({
    email: `lsr_teacher_${String(i + 1).padStart(2, '0')}@vocaboost.test`,
    role: 'teacher',
    name: i === 0 ? 'LSR Teacher' : `LSR Teacher ${String(i + 1).padStart(2, '0')}`,
  })),
  ...Array.from({ length: ACCOUNT_COUNT }, (_, i) => ({
    email: `lsr_s${String(i + 1).padStart(2, '0')}@vocaboost.test`,
    role: 'student',
    name: `LSR Student ${String(i + 1).padStart(2, '0')}`,
  })),
];

// Exact signup shape (src/services/db.js:28-50, 191-233).
const userDoc = (email, role, displayName) => ({
  role,
  email,
  profile: { displayName, school: '', gradYear: null, gradMonth: null, calculatedGrade: null, avatarUrl: '' },
  stats: { totalWordsLearned: 0 },
  settings: { weeklyGoal: 100, useUnifiedQueue: false, primaryFocusListId: null, primaryFocusClassId: null },
  challenges: { history: [] },
  enrolledClasses: {},
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});

const out = [];
for (const a of ACCOUNTS) {
  let uid = null; let status = 'created';
  try {
    const existing = await auth.getUserByEmail(a.email).catch(() => null);
    if (existing) { uid = existing.uid; status = 'already-existed (untouched)'; }
    else {
      const u = await auth.createUser({ email: a.email, password: PASS, displayName: a.name, emailVerified: true });
      uid = u.uid;
      await db.collection('users').doc(uid).set(userDoc(a.email, a.role, a.name));
    }
  } catch (e) { status = `ERROR: ${String(e).slice(0, 120)}`; }
  out.push({ ...a, uid, status });
  console.log(`${status === 'created' ? '✅' : status.startsWith('already') ? '↺' : '❌'} ${a.email} (${a.role}) ${uid ? uid.slice(0, 8) : ''} — ${status}`);
}
writeFileSync('/app/audit/playwright/lsr_accounts.json', JSON.stringify({ createdAt: new Date().toISOString(), password: 'set via LSR_AUDIT_PW / .lsr_secret.json (not stored)', accounts: out }, null, 2));
console.log('\nroster → audit/playwright/lsr_accounts.json');
process.exit(out.some((o) => o.status.startsWith('ERROR')) ? 1 : 0);
