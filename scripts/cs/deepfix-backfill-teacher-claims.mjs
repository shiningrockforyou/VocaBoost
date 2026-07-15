/**
 * P10d · OVR — teacher custom-CLAIM backfill (David U7 = Option A) — DRAFT (--dry ONLY)
 * =====================================================================================
 * David decision U7 = Option A: the "teacher" role is minted into the LOGIN TOKEN as a custom
 * auth claim (request.auth.token.role == 'teacher'), and the P10(d) Firestore rules narrow
 * isTeacher() to read that claim (NO per-eval user-doc get()). provisionTeacher stamps the claim
 * for every NEW teacher going forward (gated TEACHER_CLAIM_ENABLED); THIS script is the ONE-TIME
 * backfill that stamps the claim onto every EXISTING teacher (users/{uid}.role == 'teacher') so
 * they are recognized by the narrowed rules. It is a HARD DEPLOY PRECONDITION of the rules
 * narrowing (firestore.rules header D2): the narrowing must NOT deploy until this has run to
 * completion + every teacher has refreshed their token (D3).
 *
 * WHAT IT DOES (idempotent, additive):
 *   - Lists every user doc with role == 'teacher'.
 *   - For each, reads the CURRENT custom claims (Admin Auth getUser) and would set
 *     setCustomUserClaims(uid, { ...existingClaims, role: 'teacher' }) — MERGE, so any other
 *     custom claim is preserved (never wiped). A teacher already carrying role:'teacher' is a
 *     no-op SKIP.
 *   - Flags a role-doc teacher with NO Auth user (getUser → user-not-found) as MISSING_AUTH
 *     (a data anomaly to triage — never silently write).
 *
 * STATUS: DRAFT — `--dry` ONLY until David authorizes. In --dry the write guard THROWS before
 *   any setCustomUserClaims call ⇒ ZERO auth writes (write-guarded exactly like the P5 migration
 *   + the P10c teacherIds backfill). A `--commit` run is David's authorized action (a CS event:
 *   SUPPORT_RUNBOOK entry + change_action_log row) and is part of the P10 cutover, AFTER the
 *   functions deploy (provisionTeacher claim-set, TEACHER_CLAIM_ENABLED true) and BEFORE the
 *   rules narrowing deploys. It flips NO flags and touches NO Firestore doc — Auth claims only.
 *
 * IDEMPOTENCY (P5 / P10c parity):
 *   - Re-runnable: MERGE-set with role:'teacher'; a teacher already at role:'teacher' is SKIPPED.
 *   - No demotion: the script only ADDS/sets role:'teacher'; it never clears a claim.
 *
 * USAGE (from /app; reads scripts/serviceAccountKey.json — gitignored, never commit):
 *   NODE_PATH=/app/node_modules node scripts/cs/deepfix-backfill-teacher-claims.mjs [flags]
 *     --dry                         default; NO auth writes (write guard throws). Writes a local
 *                                   plan/report to dsg-edits/srv_validate/ (local only).
 *     --commit --confirm-claims=teacher-role-claims
 *                                   guarded writes; the confirm value MUST equal the fixed
 *                                   sentinel `teacher-role-claims` (forces intentionality).
 *     --uid=<userId>                restrict to one teacher (debug / targeted repair).
 *     --limit=N                     process only the first N in-scope teachers (dry sampling).
 *   25WT REHEARSAL FIRST is not applicable (claims are global, not cohort-scoped) — but a --dry
 *   run + David review of the report IS the required rehearsal before --commit.
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// ───────────────────────────── args + mode guards ─────────────────────────────
const argv = process.argv.slice(2);
const opt = new Map(argv.filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('='); return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));
const MODE = opt.has('commit') ? 'commit' : 'dry';
const ONLY_UID = opt.get('uid') || null;
const LIMIT = opt.has('limit') ? Number(opt.get('limit')) : null;
const OUT_DIR = opt.get('out-dir') || '/app/dsg-edits/srv_validate';
const MIGRATION_VERSION = 'P10d-TEACHER-CLAIMS-v1';
const CONFIRM_SENTINEL = 'teacher-role-claims';

if (MODE === 'commit') {
  const confirm = opt.get('confirm-claims');
  if (confirm !== CONFIRM_SENTINEL) {
    console.error(`REFUSED: --commit requires --confirm-claims=${CONFIRM_SENTINEL} (exact sentinel).`);
    console.error('This is a David-authorized CS event + P10 cutover step: SUPPORT_RUNBOOK entry +');
    console.error('change_action_log row; run AFTER the functions deploy (TEACHER_CLAIM_ENABLED=true)');
    console.error('and BEFORE the P10(d) rules narrowing deploys (firestore.rules header D2).');
    process.exit(1);
  }
}
const WRITES_ENABLED = MODE === 'commit';
function guardWrite(what) { if (!WRITES_ENABLED) throw new Error(`WRITE BLOCKED (${MODE} mode): ${what}`); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync('/app/scripts/serviceAccountKey.json', 'utf8'))) });
const db = admin.firestore();
const auth = admin.auth();
const short = (u) => (u || '').slice(0, 8);

console.log(`P10d teacher-claim backfill [${MODE.toUpperCase()}] v=${MIGRATION_VERSION}`);
if (MODE === 'commit') console.log('⚠ COMMIT MODE — verify: functions deploy live (TEACHER_CLAIM_ENABLED=true), --dry reviewed by David.\n');

// ───────────────────────────── scan role-doc teachers ─────────────────────────────
let teacherDocs;
if (ONLY_UID) {
  const s = await db.doc(`users/${ONLY_UID}`).get();
  teacherDocs = s.exists ? [s] : [];
} else {
  const snap = await db.collection('users').where('role', '==', 'teacher').get();
  teacherDocs = snap.docs;
}

const plan = []; // {uid, existingRole, existingClaims, action}
const counts = { scanned: 0, willSet: 0, skipAlready: 0, missingAuth: 0, notTeacher: 0 };

for (const d of teacherDocs) {
  if (LIMIT && plan.length >= LIMIT) break;
  const uid = d.id;
  const data = d.data() || {};
  if (data.role !== 'teacher') { counts.notTeacher++; continue; } // --uid guard
  counts.scanned++;

  let existingClaims = null;
  let action;
  try {
    const userRecord = await auth.getUser(uid);
    existingClaims = userRecord.customClaims || {};
    if (existingClaims.role === 'teacher') { action = 'SKIP_ALREADY'; counts.skipAlready++; }
    else { action = 'SET_CLAIM'; counts.willSet++; }
  } catch (err) {
    if (err.code === 'auth/user-not-found') { action = 'MISSING_AUTH'; counts.missingAuth++; }
    else { action = 'ERROR'; console.error(`  getUser(${short(uid)}) failed: ${err.message}`); }
  }

  plan.push({
    uid, path: d.ref.path,
    displayName: data.profile?.displayName || data.displayName || null,
    existingClaims, action,
  });
}

console.log(`role-doc teachers: ${plan.length} (scanned ${counts.scanned})`);
console.log('actions:', JSON.stringify(counts));

// ───────────────────────────── sample + report (the --dry artifact) ─────────────────────────────
console.log('\n=== plan ===');
for (const p of plan) {
  const claimStr = p.existingClaims ? JSON.stringify(p.existingClaims) : '(no auth user)';
  console.log(`  ${short(p.uid)} [${p.action}] name=${p.displayName || '?'} claims=${claimStr}`);
}
if (counts.missingAuth) {
  console.log(`\n⚠ ${counts.missingAuth} role-doc teacher(s) have NO Auth user (MISSING_AUTH) — TRIAGE, do not auto-write.`);
}

mkdirSync(OUT_DIR, { recursive: true });
const reportPath = `${OUT_DIR}/teacher_claims_backfill_${MODE}_${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(), mode: MODE, migrationVersion: MIGRATION_VERSION,
  counts, plan: plan.map((p) => ({ uid: p.uid, path: p.path, displayName: p.displayName,
    existingClaims: p.existingClaims, action: p.action })),
}, null, 2));
console.log(`\nfull plan → ${reportPath}`);

// ───────────────────────────── COMMIT (guarded) ─────────────────────────────
let commitMismatched = 0;
if (MODE === 'commit') {
  guardWrite('teacher-claim backfill commit');
  const toSet = plan.filter((p) => p.action === 'SET_CLAIM');
  let written = 0;
  for (const p of toSet) {
    // MERGE: preserve any other custom claim, only add/overwrite role.
    await auth.setCustomUserClaims(p.uid, { ...(p.existingClaims || {}), role: 'teacher' });
    written++;
    if (written % 20 === 0 || written === toSet.length) console.log(`  …${written}/${toSet.length} claims set`);
  }
  // post-write verification (read back).
  let verified = 0, mismatched = 0;
  for (const p of toSet) {
    const r = await auth.getUser(p.uid);
    if ((r.customClaims || {}).role === 'teacher') verified++;
    else { mismatched++; console.error(`  read-back MISMATCH ${short(p.uid)}`); }
  }
  commitMismatched = mismatched;
  console.log(`\nCOMMIT complete: ${written} claims set | read-back ${verified} ok / ${mismatched} mismatched`);
  console.log('\nNOW: every teacher must refresh their token (re-login or ~1h TTL) — firestore.rules header D3.');
  console.log('THEN David deploys the P10(d) rules narrowing (isTeacher()→claim). NOTHING rides along.');
} else {
  console.log(`\n[DRY] NO auth writes were made (write guard active). would-set=${counts.willSet}.`);
  console.log('Next: David reviews this plan → SUPPORT_RUNBOOK authorization →');
  console.log(`--commit --confirm-claims=${CONFIRM_SENTINEL} (P10 cutover, after the functions deploy).`);
}
// [deepfix FINAL-FOLD-C · F-13] Match P5's NOT_READY exit-2 discipline. D2 makes the commit-mode
// read-back a HARD precondition of the P10(d) rules narrowing, so a run whose read-back found a
// role-claim MISMATCH — or that still carries any untriaged MISSING_AUTH role-doc teacher (no Auth
// user; the script has no triage-ack, so any at commit is untriaged) — is NOT a clean backfill and
// must exit non-zero, so a checklist keying on exit codes can't wave through a partial backfill.
// --dry is unaffected (commitMismatched stays 0; missingAuth gates only under commit) → exit 0.
const commitNotReady = MODE === 'commit' && (commitMismatched > 0 || counts.missingAuth > 0);
console.log(`\nFINAL: ${MODE === 'commit' ? (commitNotReady ? 'NOT_READY ' : 'READY ') : ''}mode=${MODE} teachers=${plan.length} willSet=${counts.willSet} skipAlready=${counts.skipAlready} missingAuth=${counts.missingAuth}${MODE === 'commit' ? ` mismatched=${commitMismatched}` : ''}`);
process.exit(commitNotReady ? 2 : 0);
