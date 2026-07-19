/**
 * scripts/audit/seed-synthetic.mjs — D3.5 Part-A / Part-F seeder for SYNTHETIC broken states (no real-student source).
 * Builds a fresh 25WT sandbox student + a documented invented/edge state, every write through the SandboxGuard.
 * READ-ONLY on 26SM (reuses a real list read-only only as a reference; never writes it). Dry-run default.
 *
 *   NODE_PATH=/app/node_modules node scripts/audit/seed-synthetic.mjs [--commit] [--only=<id,id>]
 */
import { readFileSync, writeFileSync } from 'fs';
import admin from 'firebase-admin';
import { SandboxGuard, mintSandboxClassId, cleanId, SANDBOX_TEACHER_EMAIL } from './sandbox-guard.mjs';
const KEY = process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(KEY, 'utf8'))) });
const db = admin.firestore();
const { FieldValue } = admin.firestore;
const COMMIT = process.argv.includes('--commit');
const RUN = 'synth1';
const PASS = process.env.LSR_AUDIT_PW || 'AuditPass2026!';
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1]?.split(',');
const REAL_LIST = 'dVliNv0p9jqZYp9rfLpN';   // reference list (READ-ONLY reuse; never written)
const log = (...a) => console.log(...a);

/**
 * Each scenario: id, part, a `progress` overlay (class_progress fields), optional `session`, optional `attempts`.
 * These encode the DOCUMENTED broken/edge state the plan's Part-A/F rows describe.
 */
const SCENARIOS = [
  { id: 'A2_skip_hold', part: 'A', family: 'skip-hold',
    progress: { currentStudyDay: 5, totalWordsIntroduced: 400, interventionLevel: 1.0, reviewMode: true,
                recentSessions: [ { day: 3, reviewScore: 0.2 }, { day: 4, reviewScore: 0.1 }, { day: 5, reviewScore: 0.2 } ] },
    expect: 'skipped review HELD — csd/twi flat, no runaway' },
  { id: 'F1_extreme_runaway', part: 'F', family: 'readonly-safe',
    progress: { currentStudyDay: 30, totalWordsIntroduced: 400 },   // csd wildly ahead of the twi anchor
    expect: 'P4 read-only: no canonical write, quarantine_candidate logged, no crash (NOT force-demoted)' },
  { id: 'F8_canonical_anomaly', part: 'F', family: 'canonical-anomaly',
    progress: { currentStudyDay: 6, totalWordsIntroduced: 480 },
    canonicalSeed: { currentStudyDay: 6, totalWordsIntroduced: 480 },   // a users/{uid}/list_progress/{REAL_LIST} doc while CANONICAL=false
    expect: 'resolver PREFERS canonical if present → detected as boundary anomaly + documented (de-risks P5)' },
  { id: 'F4_incoherent_throttle', part: 'F', family: 'skip-hold',
    progress: { currentStudyDay: 6, totalWordsIntroduced: 480, reviewMode: true, interventionLevel: 0 },  // bits disagree
    expect: 'reconciles to a coherent state (no phantom hold)' },
];

async function main() {
  const guard = new SandboxGuard(RUN);
  const scenarios = only ? SCENARIOS.filter(s => only.includes(s.id)) : SCENARIOS;
  log(`\n▶ seed-synthetic — ${COMMIT ? 'COMMIT' : 'DRY-RUN'} — ${scenarios.length} scenarios\n`);

  let teacherUid;
  try { teacherUid = (await admin.auth().getUserByEmail(SANDBOX_TEACHER_EMAIL)).uid; }
  catch { teacherUid = COMMIT ? (await admin.auth().createUser({ email: SANDBOX_TEACHER_EMAIL, password: PASS, emailVerified: true })).uid : 'DRYTEACHER'; }
  guard.registerUid(teacherUid);

  // one sandbox class for all synthetic students (assigns the reference list read-only)
  const scls = mintSandboxClassId(RUN, 1);
  guard.registerClass(scls);
  const classDoc = { name: `25WT SYNTH ${RUN}`, ownerTeacherId: teacherUid,
    joinCode: (RUN + Math.random().toString(36).slice(2, 5)).toUpperCase().slice(0, 6),
    assignedLists: [REAL_LIST], assignments: { [REAL_LIST]: { pace: 80, passThreshold: 92, newWordRetakeThreshold: 0.92, testMode: 'mcq' } },
    settings: {}, studentIds: [], studentCount: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
  guard.assertWrite({ docPath: `classes/${scls}`, uid: teacherUid, classId: scls });
  if (COMMIT) await db.collection('classes').doc(scls).set(classDoc);

  const roster = [];
  for (const s of scenarios) {
    const email = `lsr_${cleanId(s.id).toLowerCase()}@vocaboost.test`;
    let uid;
    try { uid = (await admin.auth().getUserByEmail(email)).uid; }
    catch { uid = COMMIT ? (await admin.auth().createUser({ email, password: PASS, emailVerified: true })).uid : `DRYUID_${cleanId(s.id)}`; }
    guard.registerUid(uid);

    guard.assertWrite({ docPath: `users/${uid}`, uid });
    if (COMMIT) await db.collection('users').doc(uid).set({ role: 'student', email,
      profile: { displayName: `⧉SYNTH ${s.id}` }, enrolledClasses: { [scls]: { name: classDoc.name, joinedAt: FieldValue.serverTimestamp() } },
      createdAt: FieldValue.serverTimestamp() }, { merge: true });

    guard.assertWrite({ docPath: `users/${uid}/class_progress/${scls}_${REAL_LIST}`, uid, classId: scls });
    if (COMMIT) await db.collection('users').doc(uid).collection('class_progress').doc(`${scls}_${REAL_LIST}`).set({
      ...s.progress, classId: scls, listId: REAL_LIST, csSynthetic: s.id, csExpect: s.expect, updatedAt: FieldValue.serverTimestamp() });

    // F8: seed a canonical list_progress doc under the SANDBOX uid (docId = real listId — permitted; containment = sandbox uid)
    if (s.canonicalSeed) {
      guard.assertWrite({ docPath: `users/${uid}/list_progress/${REAL_LIST}`, uid });
      if (COMMIT) await db.collection('users').doc(uid).collection('list_progress').doc(REAL_LIST).set({
        ...s.canonicalSeed, listId: REAL_LIST, csSynthetic: s.id, updatedAt: FieldValue.serverTimestamp() });
    }

    roster.push({ tag: s.id, part: s.part, family: s.family, email, uid, sandboxClassId: scls, listId: REAL_LIST,
                  seededCsd: s.progress.currentStudyDay, seededTwi: s.progress.totalWordsIntroduced, provenance: 'synthetic', expect: s.expect });
    log(`  [${s.id}] ${email} (Part ${s.part}/${s.family}) csd=${s.progress.currentStudyDay}${s.canonicalSeed ? ' +canonical-anomaly' : ''}`);
  }

  const art = guard.safetyArtifact();
  const result = { runId: RUN, at: new Date().toISOString(), committed: COMMIT, sandboxClassId: scls, roster, safety: art };
  if (COMMIT) writeFileSync('/app/audit/playwright/findings/synthetic_seed_roster.json', JSON.stringify(result, null, 2));
  log(`\n── SAFETY (S6) ── writes:${art.writeCount} sandbox-uids:${art.sandboxUids} non-sandbox:${art.writesToNonSandbox} ALL-SANDBOX:${art.allSandbox}`);
  if (!art.allSandbox) process.exit(1);
  log(`${COMMIT ? '✅ COMMITTED' : 'ℹ️  DRY-RUN OK'} — ${roster.length} synthetic students`);
  process.exit(0);
}
main().catch(e => { console.error('SEED ERROR:', e.message); process.exit(1); });
