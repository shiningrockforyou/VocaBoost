/**
 * CS — Create Teacher Invite (deepfix P6 · FND-4, F4-3 provisioning)
 *
 * Purpose: mint a single-use teacher-invite code. Post-P6, the Firestore rules
 * deny any client from creating or updating a user doc with role:'teacher'
 * (C-28/#1b closed) — the ONLY way a real teacher gets the role is:
 *   1. David runs THIS script (Admin SDK) → it prints a one-time code;
 *   2. the new teacher signs up (as a student, like everyone) and redeems the
 *      code (Signup.jsx invite field → `provisionTeacher` callable), which
 *      flips their role server-side and stamps roleProvisioning provenance.
 *
 * Storage: teacher_invites/{sha256(code)} — the PLAINTEXT code is printed once
 * here and never stored. Clients can neither read nor write teacher_invites
 * (rules: allow read, write: if false).
 *
 * Usage:
 *   NODE_PATH=/app/node_modules node scripts/cs/create-teacher-invite.mjs "<note: who is this for>" [expiresDays=14] [--dry]
 *   NODE_PATH=/app/node_modules node scripts/cs/create-teacher-invite.mjs --revoke <inviteId>
 *
 * Log every mint/revoke as a CS event in SUPPORT_RUNBOOK.md (provisioning a
 * teacher is a data intervention).
 */
import admin from 'firebase-admin';
import { createHash, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json','utf8'))) });
const db = admin.firestore();

const args = process.argv.slice(2);

// --revoke mode: mark an existing invite unusable (by docId = sha256 hash).
if (args[0] === '--revoke') {
  const inviteId = args[1];
  if (!inviteId || !/^[0-9a-f]{64}$/.test(inviteId)) {
    console.error('usage: node scripts/cs/create-teacher-invite.mjs --revoke <inviteId (64-hex sha256)>');
    process.exit(1);
  }
  const ref = db.doc(`teacher_invites/${inviteId}`);
  const snap = await ref.get();
  if (!snap.exists) { console.error('no invite doc', inviteId); process.exit(1); }
  const d = snap.data();
  if (d.usedBy) { console.error(`already redeemed by uid=${d.usedBy} at ${d.usedAt?.toDate?.()} — revoke is a no-op for role state; use CS triage for the account itself.`); }
  await ref.update({ revoked: true, revokedAt: admin.firestore.Timestamp.now() });
  console.log('revoked', inviteId);
  process.exit(0);
}

const note = args[0];
const dry = args.includes('--dry');
const expiresDays = Number(args[1] && !args[1].startsWith('--') ? args[1] : 14);
if (!note || note.startsWith('--')) {
  console.error('usage: node scripts/cs/create-teacher-invite.mjs "<note: who is this for>" [expiresDays=14] [--dry]');
  process.exit(1);
}
if (!Number.isFinite(expiresDays) || expiresDays <= 0 || expiresDays > 365) {
  console.error('expiresDays must be 1-365');
  process.exit(1);
}

// 32 bytes → 32-char base32 code (crockford alphabet, no ambiguous chars; one
// byte per char = 5 bits/char, 160 bits total — unguessable via the callable),
// grouped for readability.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const raw = randomBytes(32);
let code = '';
for (let i = 0; i < 32; i++) code += ALPHABET[raw[i] % 32];
code = code.match(/.{1,8}/g).join('-'); // XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX

// MUST match functions/index.js hashInviteCode (sha256 of the TRIMMED code).
const inviteId = createHash('sha256').update(code.trim(), 'utf8').digest('hex');
const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

const doc = {
  createdBy: 'admin-script:create-teacher-invite',
  createdAt: admin.firestore.Timestamp.now(),
  note,
  expiresAt,
  usedBy: null,
  usedAt: null,
  revoked: false,
};

if (dry) {
  console.log('[dry] would create teacher_invites/' + inviteId, doc);
  console.log('[dry] code (NOT stored):', code);
  process.exit(0);
}

const existing = await db.doc(`teacher_invites/${inviteId}`).get();
if (existing.exists) { console.error('hash collision?! rerun.'); process.exit(1); }
await db.doc(`teacher_invites/${inviteId}`).set(doc);

console.log('Teacher invite created.');
console.log('  inviteId (stored, for --revoke):', inviteId);
console.log('  note:', note, '| expires:', expiresAt.toDate().toISOString());
console.log('');
console.log('  INVITE CODE (hand to the teacher — shown ONCE, not stored):');
console.log('  ' + code);
console.log('');
console.log('Remember: append a CS-' + new Date().toISOString().slice(0,10) + ' entry to SUPPORT_RUNBOOK.md.');
process.exit(0);
