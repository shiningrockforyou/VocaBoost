/**
 * LSR acceptance — READ-ONLY preflight (Admin, separate process, BEFORE any browser).
 *
 * Codex blocker (2026-07-05): the local forward-only allocator can't guarantee a student is
 * clean, because lsr_prep.mjs / earlier runs already used the lsr_s* accounts (saved focus +
 * progress can remain), which would let TA1 pass through the saved-preference path instead of
 * testing F02's fallback. This preflight PROVES cleanliness read-only and emits an allowlist
 * that lsr_accept.mjs is the ONLY source it allocates from.
 *
 * "Clean" = NONE of: settings.primaryFocusListId set · class_progress docs · list_progress
 * docs · attempts · enrolled classes · session_states. (Codex: enrollment/session leftovers
 * from lsr_prep.mjs leave assigned lists that affect F02 selection.) NEVER writes anything.
 *
 *   NODE_PATH=/app/node_modules node audit/playwright/lsr_preflight.mjs
 *   → writes audit/playwright/lsr_clean_accounts.json {generatedAt, clean:[email…], dirty:[…]}
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, rmSync } from 'fs';

const AUD = '/app/audit/playwright';
const OUT = `${AUD}/lsr_clean_accounts.json`;
// Codex: delete the prior allowlist BEFORE reading credentials / initializing Admin — a
// missing/malformed credential (initializeApp throws) must NOT leave a stale clean list usable.
// The replacement is published ONLY after every query completes (writeFileSync at the end).
try { rmSync(OUT); } catch { /* absent */ }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const ROSTER = JSON.parse(readFileSync(`${AUD}/lsr_accounts.json`, 'utf8')).accounts;
const STUDENTS = ROSTER.filter((a) => a.role === 'student');

const clean = [];
const dirty = [];
for (const a of STUDENTS) {
  const u = db.collection('users').doc(a.uid);
  const [doc, cp, lp, at, ss] = await Promise.all([
    u.get(),
    u.collection('class_progress').limit(1).get(),
    u.collection('list_progress').limit(1).get(),
    db.collection('attempts').where('studentId', '==', a.uid).limit(1).get(),
    u.collection('session_states').limit(1).get(),
  ]);
  const data = doc.data() || {};
  const savedFocus = data.settings?.primaryFocusListId || data.primaryFocusListId || null;
  const enrolled = Object.keys(data.enrolledClasses || {}).length;
  const reasons = [];
  if (savedFocus) reasons.push(`savedFocus=${savedFocus}`);
  if (enrolled) reasons.push(`enrolled in ${enrolled} class(es)`);
  if (!cp.empty) reasons.push('has class_progress');
  if (!lp.empty) reasons.push('has list_progress');
  if (!at.empty) reasons.push('has attempts');
  if (!ss.empty) reasons.push('has session_states');
  if (reasons.length) { dirty.push({ email: a.email, reasons }); }
  else clean.push(a.email);
  console.log(`${reasons.length ? '✗' : '✓'} ${a.email}${reasons.length ? ' — ' + reasons.join(', ') : ' — CLEAN'}`);
}

// Publish ONLY now that every query has succeeded (Codex #3).
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), clean, dirty }, null, 2));
console.log(`\n${clean.length} clean / ${STUDENTS.length} students → audit/playwright/lsr_clean_accounts.json`);
if (clean.length === 0) { console.error('NO clean students — provision fresh lsr_* accounts before the acceptance run'); process.exit(1); }
process.exit(0);
