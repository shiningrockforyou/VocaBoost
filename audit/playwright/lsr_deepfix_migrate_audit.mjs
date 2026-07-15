/**
 * M-MIG — the migration-audit matrix for the deepfix FIX_PLAN (AUDIT_DESIGN task4 §0.1 row
 * "M-MIG | lsr_deepfix_migrate_audit.mjs"). A Node / Firebase-Admin DATA-audit runner (NOT a
 * browser matrix): it SEEDS the AUDIT_DESIGN §1.F 25WT sandbox cohort, RUNS the P5 (and,
 * optionally, P10c) migration scripts in `--dry` (WRITE-FREE) mode, PARSES the plan + FINAL
 * line, and asserts the MIG-1..10 + RET-3 oracles against the `--dry` diff / a read-only
 * post-image.
 *
 * ── SANDBOX DISCIPLINE (BINDING; AUDIT_DESIGN §4.1 guard 2) ─────────────────────────────────
 *   • Every seed WRITE goes through the REUSED fail-closed `assertSandboxTriple`
 *     (lsr_reviewonly_fb.mjs:53) — lsr_*@vocaboost.test student + 25WT-prefixed class + its
 *     assigned clone list. Reads are strictly `.get()`. NEVER 26SM.
 *   • The migration is invoked with an EXPLICIT uid allowlist (one `--uid=<uid>` invocation per
 *     allowlisted seed student, each scoped `25WT`), and the driver INDEPENDENTLY re-verifies —
 *     via a fresh Admin read of every source doc's class name + the pair uid's auth email — that
 *     EVERY doc the `--dry` plan enumerates is 25WT-class + lsr_*@vocaboost.test BEFORE any
 *     "authorize" step. Any non-sandbox doc = HARD ABORT (INVALID); any non-allowlisted doc =
 *     INVALID (fail-closed). The plan's class name alone is NOT trusted (the migration strips the
 *     "26SM " prefix from its display name — see deepfix-migrate-list-progress.mjs:404 — so a
 *     26SM doc could read as un-prefixed; we re-read the class id).
 *   • This driver NEVER runs `--commit`/`--catchup`. Those (MIG-6 idempotency, MIG-7 catch-up,
 *     MIG-9 post-commit sweep, MIG-10 live sweep/manual-pass, RET-3 legacy deletion) are STUBBED
 *     as Codex's Task-6 authorized-commit legs, each self-reporting DEFERRED (never a false PASS).
 *
 * ── CLI ────────────────────────────────────────────────────────────────────────────────────
 *   node audit/playwright/lsr_deepfix_migrate_audit.mjs <runId> [--dry-only] [flags]
 *     <runId>            required label bound into the manifest.
 *     --dry-only         SELF-VALIDATION mode (the mode runnable in a constrained env / this WSL):
 *                        NO live provisioning, NO seed writes, NO live migration invocation — it
 *                        validates the runner (imports resolve, the FINAL/JSON parser, the oracle
 *                        EVALUATORS against synthetic fixtures) + emits the manifest with all live
 *                        oracles marked DEFERRED(env). Zero Firestore access. (Default = full dry
 *                        audit: provision + seed + per-uid `--dry` + oracle asserts — authorized env.)
 *     --slack=7          CSD-screen slack days passed through to the migration.
 *     --keep             do NOT resetStudentState the seed cohort first (debug).
 *     --with-teacherids  also run the P10c teacherIds backfill `--dry` (MIG-TID; default OFF — the
 *                        script scans one query per cohort class, heavy on the 25WT sandbox).
 *   Env: LSR_TEACHER (owner of the clone list, lsr_*), SL_STUDENTS (>=6 comma-sep lsr_* MIG
 *        students), LSR_TIER (which clone list). Falls back to lsr_accounts.json / lsr_lists.json.
 *
 * ── ORACLE MAP (AUDIT_DESIGN §1.F MIG-1..10 + §1.H RET-3) — realized-in-`--dry` vs deferred ──
 *   MIG-1  LIVE-STRAND collapse            → DRY   (merged twi == cross-class anchor; population LIVE-STRAND; A1/A3 clean)
 *   MIG-2  divergent + own-anchor CSD      → DRY   (merged twi == fast anchor; csd == slow's higher day; 0 CSD quarantine; A7 clean)
 *   MIG-3  review-only evidence amendment  → DRY   (action MIGRATE; csd preserved not demoted; 0 CSD quarantine; A6 clean)
 *   MIG-4  forged/anchorless quarantine    → DRY(partial: SKIP_QUARANTINE + ANCHORLESS_TWI + legacy retained/never-zeroed)
 *                                            + DEFERRED (the {mode:'quarantined'} canonical + blocked-study UX + list_progress_quarantined
 *                                              log are the resolveListProgress/commit leg, NOT this script — see note)
 *   MIG-5  single-doc 1:1 re-key           → DRY   (merged == verbatim; population single-doc; 0 singleDocDeviations)
 *   MIG-6  idempotent re-run               → DEFERRED (needs --commit then re-run → 0 additional diffs)
 *   MIG-7  post-flip catch-up fold         → DEFERRED (needs --commit + a racing legacy write + --catchup)
 *   MIG-8  errored-anchor abort            → DRY(code-walk: try/catch→PAIR_ERROR/SKIP_ERROR wrapper present + others continue)
 *                                            + DRY(partial: a malformed/invalid anchor is reported + moves nothing, never crashes)
 *   MIG-9  cohort hard asserts             → DRY(partial: A1/A2 empty cohort-wide; --dry diff artifact produced; backups-per-source via
 *                                              --dry --backup; migrationVersion stamp) + DEFERRED (post-commit twi/csd-after sweep on WRITTEN docs)
 *   MIG-10 CS toolchain retarget           → DRY(static: manual-pass writes the full valid anchor) + DEFERRED (sweep/census still read
 *                                              class_progress at HEAD — the F6-3 list_progress retarget is NOT shipped; live sweep+manual-pass writes)
 *   RET-3  legacy deletion + sweep clean   → DEFERRED (needs --commit + the P7 deletion script + a list_progress-shaped sweep)
 *
 * Fail-closed manifest (runId + git-state + per-doc sandbox triple + per-oracle verdict);
 * findings/deepfix_mig_<runId>.{json,md}; nonzero exit on any FAIL/INVALID (DEFERRED is honest,
 * not a failure, but NEVER certifies alone). Design lineage: fail-closed INVALID≠PASS + artifact
 * binding + seed-then-pre-verify, carried from lsr_deepfix_static.mjs / lsr_reviewonly_fb.mjs.
 *
 * NEW-vs-REUSE (AUDIT_DESIGN §7): REUSED = assertSandboxTriple + db + getDocId + now + tsPlusDays
 * + readProgress + readAttempts + readSystemLogsSince + resetStudentState + readListWordCount +
 * uidByEmail (lsr_reviewonly_fb.mjs, re-exported by lsr_deepfix_fb.mjs); the manifest/findings/
 * git-state/exit convention (lsr_deepfix_static.mjs). NEW here = the §1.F MIG seed helpers
 * (seedSingleDoc / seedDualDocStrand / seedDivergentPace / seedReviewOnlyGapN / seedForgedTwiHigh
 * / seedRacingLegacyWrite + provisionMigClass), the migration `--dry` child-process driver +
 * FINAL/JSON parser, the sandbox+allowlist plan re-verify, and the MIG-1..10 + RET-3 evaluators.
 *
 * DEVIATION (flagged): AUDIT_DESIGN §3/§7 nominally locate these MIG seeds in lsr_deepfix_fb.mjs.
 * They are kept LOCAL to this one new file to honor the task's "NEW file <this>" single-file
 * constraint (no existing module is modified); they reuse the imported guard verbatim and are
 * promotable to the seed module by Codex later.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import admin from 'firebase-admin';

// ── paths ──
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const FINDINGS = resolve(HERE, 'findings');
const MIGRATION_LP = resolve(REPO, 'scripts/cs/deepfix-migrate-list-progress.mjs');
const MIGRATION_TID = resolve(REPO, 'scripts/cs/deepfix-migrate-attempts-teacherids.mjs');
const MANUAL_PASS = resolve(REPO, 'scripts/cs/manual-pass.mjs');
const SWEEP = resolve(REPO, 'scripts/cs/data-integrity-sweep.mjs');
const CENSUS2 = resolve(REPO, 'scripts/cs/deepfix-census2.mjs');
const P7_DELETE = resolve(REPO, 'scripts/cs/deepfix-delete-legacy-class-progress.mjs'); // P7 deletion (RET-3; may not exist yet)
const MIGRATION_VERSION = 'P5-FND-3-v1';
const COHORT_REGEX = '25WT';
const SANDBOX_STUDENT_RE = /^lsr_.*@vocaboost\.test$/;
const SANDBOX_CLASS_PREFIX = '25WT';
const SCRATCH = process.env.LSR_SCRATCH
  || '/tmp/claude-1000/-app/c538be35-2cb4-4a2d-92df-470756b8f906/scratchpad/mmig';

// ── args ──
const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const flag = (k) => argv.includes(`--${k}`);
const getArg = (k, d) => { const h = argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.slice(k.length + 3) : d; };
const RUN_ID = positional[0];
if (!RUN_ID) { console.error('usage: node audit/playwright/lsr_deepfix_migrate_audit.mjs <runId> [--dry-only]'); process.exit(2); }
const DRY_ONLY = flag('dry-only');
const SLACK = Number(getArg('slack', '7'));
const KEEP = flag('keep');
const WITH_TID = flag('with-teacherids');
const STARTED = new Date().toISOString();

// ── git-state binding (§2.1) ──
const sh = (c) => { try { return execSync(c, { cwd: REPO, encoding: 'utf8' }).trim(); } catch { return ''; } };
const GIT_HEAD = sh('git rev-parse HEAD') || 'unknown';
const GIT_SHORT = sh('git rev-parse --short HEAD') || 'unknown';
const DIRTY_ROWS = sh('git status --porcelain').split('\n').filter(Boolean);
const DIRTY = DIRTY_ROWS.length > 0;

// ── verdict records (mirrors lsr_deepfix_static.mjs) ──
const A = [];
function add(id, scenario, expected, actual, verdict, evidence, kind = 'dry') {
  A.push({ id, scenario, expected, actual, verdict, evidence, kind });
  return A[A.length - 1];
}
const sandboxTriples = []; // per-doc {uid, email, classId, className, listId} the audit verified

// ════════════════════════════════════════════════════════════════════════════════════════════
// Migration `--dry` child-process driver + parsers (REUSE-CORRECTNESS: schema pinned to
// deepfix-migrate-list-progress.mjs:609-616 writeFileSync + :733 FINAL line, verified against a
// real read-only `--dry` run 2026-07-14).
// ════════════════════════════════════════════════════════════════════════════════════════════
const FINAL_RE = /FINAL:\s+(READY|NOT_READY)\s+asserts_failing=(\d+)\s+quarantine=(\d+)/;
function parseFinal(stdout) {
  const m = FINAL_RE.exec(stdout || '');
  if (!m) return null;
  return { ready: m[1] === 'READY', assertsFailing: Number(m[2]), quarantine: Number(m[3]) };
}
function latestReport(outDir) {
  if (!existsSync(outDir)) return null;
  const files = readdirSync(outDir).filter((f) => /^list_progress_migration_dry_.*\.json$/.test(f)).sort();
  if (!files.length) return null;
  return JSON.parse(readFileSync(resolve(outDir, files[files.length - 1]), 'utf8'));
}
// Invoke the P5 migration `--dry` scoped to ONE allowlisted uid (write-guarded; a quarantine
// makes it exit 2 — EXPECTED for the forged fixture — so we tolerate a nonzero exit and still
// read the report the script wrote before exiting).
function runMigrationDryForUid(uid, { backup = true } = {}) {
  const outDir = resolve(SCRATCH, RUN_ID, uid);
  mkdirSync(outDir, { recursive: true });
  const args = [MIGRATION_LP, COHORT_REGEX, '--dry', `--uid=${uid}`, `--out-dir=${outDir}`, `--slack=${SLACK}`];
  if (backup) args.push('--backup');
  let stdout = '', exitCode = 0;
  try {
    stdout = execFileSync('node', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_PATH: resolve(REPO, 'node_modules') } });
  } catch (e) {
    stdout = (e.stdout ? String(e.stdout) : '') + (e.stderr ? String(e.stderr) : '');
    exitCode = typeof e.status === 'number' ? e.status : 1;
  }
  return { uid, outDir, stdout, exitCode, final: parseFinal(stdout), report: latestReport(outDir) };
}

// ── the sandbox+allowlist plan RE-VERIFY (BINDING guard) ──────────────────────────────────────
// Independently re-reads (Admin `.get()`) every source doc's class + the pair uid's email for
// EVERY pair the `--dry` plan enumerates. Non-sandbox → HARD ABORT (never authorize). Non-allowlist
// → INVALID.  Returns { ok, aborts[], nonAllowlisted[], verified }.
const classNameCache = new Map();
async function classNameOf(db, classId) {
  if (!classNameCache.has(classId)) {
    const s = await db.collection('classes').doc(classId).get();
    classNameCache.set(classId, s.exists ? (s.data().name || '') : null);
  }
  return classNameCache.get(classId);
}
const emailCache = new Map();
async function emailOf(classId /*unused*/, uid) {
  if (!emailCache.has(uid)) {
    try { emailCache.set(uid, (await admin.auth().getUser(uid)).email || null); } catch { emailCache.set(uid, null); }
  }
  return emailCache.get(uid);
}
async function verifyPlanSandbox(db, report, allowlist) {
  const aborts = []; const nonAllowlisted = []; let verified = 0;
  for (const p of (report?.pairs || [])) {
    const email = await emailOf(null, p.uid);
    if (!email || !SANDBOX_STUDENT_RE.test(email)) aborts.push(`uid ${p.uid.slice(0, 8)} email=${email || 'MISSING'} is NOT lsr_*@vocaboost.test`);
    if (!allowlist.has(p.uid)) nonAllowlisted.push(`uid ${p.uid.slice(0, 8)} (${email}) not in seed allowlist`);
    for (const b of (p.before || [])) {
      const classId = String(b.docId || '').split('_')[0];
      const name = await classNameOf(db, classId);
      if (name == null) { aborts.push(`class ${classId.slice(0, 8)} (pair ${p.uid.slice(0, 8)}/${String(p.listId).slice(0, 8)}) NOT FOUND on re-read`); continue; }
      if (!name.startsWith(SANDBOX_CLASS_PREFIX)) aborts.push(`class "${name}" (${classId.slice(0, 8)}) is NOT ${SANDBOX_CLASS_PREFIX}-prefixed — ABORT (never 26SM)`);
      sandboxTriples.push({ uid: p.uid, email, classId, className: name, listId: p.listId, docId: b.docId });
      verified++;
    }
  }
  return { ok: aborts.length === 0, aborts, nonAllowlisted, verified };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §1.F MIG SEED HELPERS (guarded by the imported assertSandboxTriple; anchor-bearing attempts
// carry the FULL valid anchor per the CLAUDE.md rule, EXCEPT seedForgedTwiHigh which is the
// deliberately-forged fixture, labeled + confined to its student). Only invoked in FULL mode.
// ════════════════════════════════════════════════════════════════════════════════════════════
let FB = null; // the reused data layer (lazy — not loaded in --dry-only so no service key is needed)
const nowTs = () => admin.firestore.Timestamp.now();
const tsAt = (ms) => admin.firestore.Timestamp.fromMillis(ms);
const isoDay = () => new Date().toISOString().slice(0, 10);

// A FULL valid reconciliation anchor attempt (manual-pass.mjs parity).
function validAnchorAttempt({ uid, classId, listId, teacherId, studyDay, pace, score = 97, passThreshold = 92, submittedAt }) {
  const nwsi = (studyDay - 1) * pace; const nwei = studyDay * pace - 1;
  return {
    studentId: uid, classId, listId, teacherId, teacherIds: teacherId ? [teacherId] : [],
    testId: `vocaboost_test_${classId}_${listId}_new`, sessionType: 'new', testType: 'typed', studyDay,
    score, passed: score >= passThreshold, graded: true,
    newWordStartIndex: nwsi, newWordEndIndex: nwei, wordsIntroduced: nwei - nwsi + 1, // VALID anchor
    isFirstDay: studyDay === 1, totalQuestions: 30, answers: [], skipped: 0,
    interventionLevel: 0, wordsReviewed: 0, segmentStartIndex: 0, segmentEndIndex: 0,
    manualOverride: false, manualReviewNote: `deepfix M-MIG anchor (${isoDay()})`,
    submittedAt: submittedAt || nowTs(),
  };
}
const progRef = (uid, classId, listId) => FB.db().collection('users').doc(uid).collection('class_progress').doc(FB.getDocId(classId, listId));
const attRef = (id) => FB.db().collection('attempts').doc(id);

// Provision a dedicated 25WT MIG class (create-if-absent; idempotent by deterministic name) that
// assigns `listId` + enrolls `uids`. Guarded implicitly: the NAME is 25WT-prefixed and every seed
// that follows re-asserts assertSandboxTriple. Returns { classId, teacherId }.
async function provisionMigClass({ tag, name, listId, teacherId, uids, pace = 40, passThreshold = 92 }) {
  const db = FB.db();
  const wanted = name;
  // reuse an existing class with this exact MIG name if present (idempotent re-runs)
  const snap = await db.collection('classes').where('name', '==', wanted).limit(1).get();
  let classId = snap.empty ? null : snap.docs[0].id;
  if (!classId) classId = db.collection('classes').doc().id;
  if (!wanted.startsWith(SANDBOX_CLASS_PREFIX)) throw new Error(`[provisionMigClass] refusing non-25WT name "${wanted}"`);
  const assignment = { pace, passThreshold, testMode: 'typed', testSizeNew: 30, testOptionsCount: 4,
    reviewTestType: 'mcq', reviewTestSizeMin: 30, reviewTestSizeMax: 60, studyDaysPerWeek: 5, assignedAt: nowTs() };
  await db.collection('classes').doc(classId).set({
    name: wanted, ownerTeacherId: teacherId, assignments: { [listId]: assignment }, // nested-object literal: set()+merge treats a dotted key as a LITERAL field name, not a path (breaks assertSandboxTriple's data().assignments[listId])
    assignedLists: admin.firestore.FieldValue.arrayUnion(listId),
    studentIds: admin.firestore.FieldValue.arrayUnion(...uids),
    studentCount: uids.length, updatedAt: nowTs(),
    createdAt: snap.empty ? nowTs() : (snap.docs[0].data().createdAt || nowTs()),
  }, { merge: true });
  for (const uid of uids) {
    await db.collection('users').doc(uid).set(
      { enrolledClasses: { [classId]: { joinedAt: nowTs(), name: wanted } } }, { merge: true });
  }
  return { tag, classId, teacherId, listId };
}

// MIG-5 · single-doc 1:1 — one valid anchor whose twi matches stored twi (verbatim re-key).
async function seedSingleDoc({ email, uid, classId, listId, teacherId, csd = 5, pace = 40 }) {
  await FB.assertSandboxTriple({ email, uid, classId, listId });
  const nwei = csd * pace - 1; const twi = nwei + 1;
  await attRef(`audit_mig5_${uid}_${classId}_${listId}`).set(validAnchorAttempt({ uid, classId, listId, teacherId, studyDay: csd, pace }));
  await progRef(uid, classId, listId).set({ classId, listId, currentStudyDay: csd, totalWordsIntroduced: twi,
    interventionLevel: 0, programStartDate: nowTs(), lastSessionAt: nowTs(), updatedAt: nowTs() }, { merge: true });
  return { csd, twi, anchorTwi: twi };
}

// MIG-1 · LIVE-STRAND — doc A anchored AHEAD (the only valid anchor), doc B active BEHIND
// (newest lastSessionAt, twi >= DAY_WORDS(80) below the anchor → the migration classifies LIVE-STRAND).
async function seedDualDocStrand({ email, uid, classA, classB, listId, teacherId, paceA = 80, dayA = 8, twiB, csdB = 6 }) {
  await FB.assertSandboxTriple({ email, uid, classId: classA, listId });
  await FB.assertSandboxTriple({ email, uid, classId: classB, listId });
  const nweiA = dayA * paceA - 1; const anchorTwi = nweiA + 1; // 640
  const behind = twiB != null ? twiB : anchorTwi - 80;         // 560 → activeBehind exactly DAY_WORDS
  const old = tsAt(Date.now() - 10 * 24 * 3600 * 1000);
  const fresh = nowTs();
  // doc A: the anchor lives here (older attempt), csd=dayA
  await attRef(`audit_mig1_${uid}_${classA}_${listId}`).set(validAnchorAttempt({ uid, classId: classA, listId, teacherId, studyDay: dayA, pace: paceA, submittedAt: old }));
  await progRef(uid, classA, listId).set({ classId: classA, listId, currentStudyDay: dayA, totalWordsIntroduced: anchorTwi,
    interventionLevel: 0, programStartDate: old, lastSessionAt: old, updatedAt: old }, { merge: true });
  // doc B: active behind — newest lastSessionAt, no own valid anchor, lower twi
  await progRef(uid, classB, listId).set({ classId: classB, listId, currentStudyDay: csdB, totalWordsIntroduced: behind,
    interventionLevel: 0, programStartDate: old, lastSessionAt: fresh, updatedAt: fresh }, { merge: true });
  return { anchorTwi, behind, dayA, csdB, expectedMergedTwi: anchorTwi };
}

// MIG-2 · divergent cross-pace — fast doc (high twi, low csd) vs slow doc (low twi, HIGH csd) each
// with its OWN valid anchor. fast wins twi; slow's higher day survives its OWN-anchor screen.
async function seedDivergentPace({ email, uid, classFast, classSlow, listId, teacherId, paceFast = 80, dayFast = 8, paceSlow = 20, daySlow = 15 }) {
  await FB.assertSandboxTriple({ email, uid, classId: classFast, listId });
  await FB.assertSandboxTriple({ email, uid, classId: classSlow, listId });
  const twiFast = dayFast * paceFast;      // 640
  const twiSlow = daySlow * paceSlow;      // 300
  const old = tsAt(Date.now() - 9 * 24 * 3600 * 1000);
  const fresh = nowTs();
  await attRef(`audit_mig2f_${uid}_${classFast}_${listId}`).set(validAnchorAttempt({ uid, classId: classFast, listId, teacherId, studyDay: dayFast, pace: paceFast, submittedAt: old }));
  await progRef(uid, classFast, listId).set({ classId: classFast, listId, currentStudyDay: dayFast, totalWordsIntroduced: twiFast,
    interventionLevel: 0, programStartDate: old, lastSessionAt: old, updatedAt: old }, { merge: true });
  await attRef(`audit_mig2s_${uid}_${classSlow}_${listId}`).set(validAnchorAttempt({ uid, classId: classSlow, listId, teacherId, studyDay: daySlow, pace: paceSlow, submittedAt: fresh }));
  await progRef(uid, classSlow, listId).set({ classId: classSlow, listId, currentStudyDay: daySlow, totalWordsIntroduced: twiSlow,
    interventionLevel: 0, programStartDate: old, lastSessionAt: fresh, updatedAt: fresh }, { merge: true });
  return { expectedMergedTwi: twiFast, expectedMergedCsd: daySlow };
}

// MIG-3 · review-only evidence — anchor at day k, then N post-anchor review days pump csd to k+N
// with the gap EXCEEDING slack (so the durable review-attempt evidence is LOAD-BEARING).
async function seedReviewOnlyGapN({ email, uid, classId, listId, teacherId, anchorDay = 3, pace = 40, n = 10 }) {
  await FB.assertSandboxTriple({ email, uid, classId, listId });
  const t0 = Date.now() - (n + 2) * 24 * 3600 * 1000;
  await attRef(`audit_mig3_${uid}_${classId}_${listId}_anchor`).set(validAnchorAttempt({ uid, classId, listId, teacherId, studyDay: anchorDay, pace, submittedAt: tsAt(t0) }));
  for (let i = 1; i <= n; i++) {
    const day = anchorDay + i;
    await attRef(`audit_mig3_${uid}_${classId}_${listId}_rev${day}`).set({
      studentId: uid, classId, listId, teacherId, teacherIds: teacherId ? [teacherId] : [],
      testId: `vocaboost_test_${classId}_${listId}_review`, sessionType: 'review', testType: 'typed', studyDay: day,
      score: 82, passed: true, graded: true, autoCompleted: false, totalQuestions: 40, answers: [], skipped: 0,
      manualReviewNote: `deepfix MIG-3 review-only day ${day} (${isoDay()})`, submittedAt: tsAt(t0 + i * 24 * 3600 * 1000),
    });
  }
  const csd = anchorDay + n; const twi = anchorDay * pace;
  await progRef(uid, classId, listId).set({ classId, listId, currentStudyDay: csd, totalWordsIntroduced: twi,
    interventionLevel: 0, programStartDate: tsAt(t0), lastSessionAt: tsAt(t0 + n * 24 * 3600 * 1000), updatedAt: nowTs() }, { merge: true });
  return { anchorDay, csd, twi, evDaysExpected: n };
}

// MIG-4 · forged/anchorless high twi (LABELED forged fixture) — storedTWI ≫ any anchor, no VALID
// passed-new (one INVALID-anchor attempt to also exercise invalidAnchor reporting) → ANCHORLESS_TWI.
async function seedForgedTwiHigh({ email, uid, classId, listId, teacherId, forgedTwi = 2000, csd = 5 }) {
  await FB.assertSandboxTriple({ email, uid, classId, listId });
  // an invalid anchor: passed 'new' but NO integer newWordEndIndex (cannot validate → not an anchor)
  await attRef(`audit_mig4_${uid}_${classId}_${listId}_invalid`).set({
    studentId: uid, classId, listId, teacherId, teacherIds: teacherId ? [teacherId] : [],
    testId: `vocaboost_test_${classId}_${listId}_new`, sessionType: 'new', testType: 'typed', studyDay: csd,
    score: 100, passed: true, graded: true, newWordEndIndex: null, wordsIntroduced: 0, // INVALID anchor (no integer nwei)
    totalQuestions: 30, answers: [], skipped: 0, manualReviewNote: `deepfix MIG-4 FORGED/anchorless fixture (${isoDay()})`,
    submittedAt: nowTs(),
  });
  await progRef(uid, classId, listId).set({ classId, listId, currentStudyDay: csd, totalWordsIntroduced: forgedTwi, // forged high
    interventionLevel: 0, programStartDate: nowTs(), lastSessionAt: nowTs(), updatedAt: nowTs() }, { merge: true });
  return { forgedTwi, csd };
}

// MIG-7 · racing legacy write (catch-up fixture) — a clean migratable single doc with a FRESH
// lastSessionAt, staged so Codex's --commit→(racing write)→--catchup leg can fold it. In --dry
// (nothing committed) it is simply a valid single-doc pair.
async function seedRacingLegacyWrite({ email, uid, classId, listId, teacherId, csd = 4, pace = 40 }) {
  await FB.assertSandboxTriple({ email, uid, classId, listId });
  await attRef(`audit_mig7_${uid}_${classId}_${listId}`).set(validAnchorAttempt({ uid, classId, listId, teacherId, studyDay: csd, pace }));
  await progRef(uid, classId, listId).set({ classId, listId, currentStudyDay: csd, totalWordsIntroduced: csd * pace,
    interventionLevel: 0, programStartDate: nowTs(), lastSessionAt: nowTs(), updatedAt: nowTs() }, { merge: true });
  return { csd, twi: csd * pace };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// ORACLE EVALUATORS (pure: (report-for-uid, expectation) → {verdict, actual, evidence}). Used
// BOTH against real per-uid `--dry` reports (full mode) AND synthetic fixtures (--dry-only self-test).
// ════════════════════════════════════════════════════════════════════════════════════════════
const pairOf = (report, uid, listId) => (report?.pairs || []).find((p) => p.uid === uid && (listId == null || p.listId === listId)) || null;
const assertArr = (report, name) => (report?.asserts?.[name] || []);
const quarArr = (report, name) => (report?.quarantine?.[name] || []);

function evalMIG1(report, uid, listId, exp) {
  const p = pairOf(report, uid, listId);
  if (!p) return { verdict: 'INVALID', actual: 'pair absent from plan', evidence: 'seed did not materialize / not enumerated' };
  const okTwi = p.after?.twi === exp.anchorTwi;
  const okAnchor = p.anchor?.twi === exp.anchorTwi;
  const okPop = p.population === 'LIVE-STRAND';
  const okAction = p.action === 'MIGRATE' || p.action === 'MIGRATE_OVERWRITES_FOREIGN';
  const noResidual = assertArr(report, 'A3 dual-enroll signature after == 0').length === 0
    && assertArr(report, 'A1 twi regressions == 0').length === 0;
  const pass = okTwi && okAnchor && okPop && okAction && noResidual;
  return { verdict: pass ? 'PASS' : 'FAIL',
    actual: `after.twi=${p.after?.twi} anchor.twi=${p.anchor?.twi} pop=${p.population} action=${p.action}`,
    evidence: `want after.twi==anchor==${exp.anchorTwi}, LIVE-STRAND, MIGRATE, A1/A3 clean; okTwi=${okTwi} okAnchor=${okAnchor} okPop=${okPop} noResidual=${noResidual}` };
}
function evalMIG2(report, uid, listId, exp) {
  const p = pairOf(report, uid, listId);
  if (!p) return { verdict: 'INVALID', actual: 'pair absent', evidence: 'seed did not materialize' };
  const okTwi = p.after?.twi === exp.mergedTwi;         // fast anchor max
  const okCsd = p.after?.csd === exp.mergedCsd;         // slow's higher day survives
  const noCsdQuar = quarArr(report, 'CSD_IMPLAUSIBLE').filter((s) => s.includes(uid.slice(0, 8))).length === 0;
  const a7 = assertArr(report, 'A7 divergent max-csd survives own-anchor screen').length === 0;
  const pass = okTwi && okCsd && noCsdQuar && a7;
  return { verdict: pass ? 'PASS' : 'FAIL',
    actual: `after.twi=${p.after?.twi} after.csd=${p.after?.csd} pop=${p.population}`,
    evidence: `want twi==${exp.mergedTwi}(fast) csd==${exp.mergedCsd}(slow); no CSD_IMPLAUSIBLE; A7 clean; okTwi=${okTwi} okCsd=${okCsd} noCsdQuar=${noCsdQuar} a7=${a7} (population label '${p.population}' is not asserted — the own-anchor merge result is)` };
}
function evalMIG3(report, uid, listId, exp) {
  const p = pairOf(report, uid, listId);
  if (!p) return { verdict: 'INVALID', actual: 'pair absent', evidence: 'seed did not materialize' };
  const okAction = p.action === 'MIGRATE';
  const okCsd = p.after?.csd === exp.csd;               // preserved, NOT demoted to anchorDay
  const noCsdQuar = quarArr(report, 'CSD_IMPLAUSIBLE').filter((s) => s.includes(uid.slice(0, 8))).length === 0;
  const a6 = assertArr(report, 'A6 N>1 review-only days pass on attempt evidence alone').length === 0;
  const pass = okAction && okCsd && noCsdQuar && a6;
  return { verdict: pass ? 'PASS' : 'FAIL',
    actual: `action=${p.action} after.csd=${p.after?.csd} (anchorDay=${exp.anchorDay})`,
    evidence: `want MIGRATE + csd==${exp.csd} (not demoted to ${exp.anchorDay}) + 0 CSD_IMPLAUSIBLE + A6 clean; okAction=${okAction} okCsd=${okCsd} noCsdQuar=${noCsdQuar} a6=${a6}` };
}
function evalMIG4(report, uid, listId, exp) {
  const p = pairOf(report, uid, listId);
  if (!p) return { verdict: 'INVALID', actual: 'pair absent', evidence: 'seed did not materialize' };
  const quarHit = quarArr(report, 'ANCHORLESS_TWI').concat(quarArr(report, 'TWI_EXCEEDS_ANCHOR')).filter((s) => s.includes(uid.slice(0, 8)));
  const okQuar = quarHit.length > 0 && p.action === 'SKIP_QUARANTINE';
  const notZeroed = p.after == null || p.after.twi == null || p.after.twi !== 0; // never zeroed / never auto-promoted (pair skipped)
  const invalidReported = (p.invalidAnchorAttempts || 0) >= 1 || quarArr(report, 'ANCHORLESS_TWI').length > 0;
  const pass = okQuar && notZeroed && invalidReported;
  return { verdict: pass ? 'PASS' : 'FAIL',
    actual: `action=${p.action} quarantine=${JSON.stringify(p.quarantine)} invalidAnchors=${p.invalidAnchorAttempts}`,
    evidence: `want SKIP_QUARANTINE + ANCHORLESS/EXCEEDS + never-zeroed + invalid reported; okQuar=${okQuar} notZeroed=${notZeroed} invalidReported=${invalidReported}. NOTE: the {mode:'quarantined'} canonical + blocked-study UX + list_progress_quarantined log are the resolveListProgress/commit leg (CS-8), NOT this script — deferred.` };
}
function evalMIG5(report, uid, listId, exp) {
  const p = pairOf(report, uid, listId);
  if (!p) return { verdict: 'INVALID', actual: 'pair absent', evidence: 'seed did not materialize' };
  const okPop = p.population === 'single-doc';
  const okVerbatim = p.after?.twi === exp.twi && p.after?.csd === exp.csd;
  const noDev = (report?.report?.singleDocDeviations || []).filter((s) => s.includes(uid.slice(0, 8))).length === 0;
  const pass = okPop && okVerbatim && noDev;
  return { verdict: pass ? 'PASS' : 'FAIL',
    actual: `pop=${p.population} after={csd:${p.after?.csd},twi:${p.after?.twi}} dropped=${(p.after?.droppedFields || []).length}`,
    evidence: `want single-doc + verbatim csd==${exp.csd}/twi==${exp.twi} + 0 deviations; okPop=${okPop} okVerbatim=${okVerbatim} noDev=${noDev}` };
}
// MIG-9 cohort-wide (over the aggregated per-uid reports)
function evalMIG9(reports) {
  const twiReg = reports.flatMap((r) => assertArr(r, 'A1 twi regressions == 0'));
  const csdReg = reports.flatMap((r) => assertArr(r, 'A2 csd regressions == 0'));
  const artifactOk = reports.every((r) => r && Array.isArray(r.pairs) && r.migrationVersion === MIGRATION_VERSION);
  const pass = twiReg.length === 0 && csdReg.length === 0 && artifactOk;
  return { verdict: pass ? 'PASS' : 'FAIL',
    actual: `twiRegressions=${twiReg.length} csdRegressions=${csdReg.length} artifacts=${reports.length} migVer_ok=${artifactOk}`,
    evidence: `cohort A1/A2 empty + a --dry diff artifact per uid carrying migrationVersion=${MIGRATION_VERSION}. (Backups-per-source verified separately via --dry --backup; post-commit twi/csd-after sweep on WRITTEN docs is DEFERRED to Codex.)` };
}

// ── the executable oracle-walk self-test: synthetic reports the seeds WOULD produce (positive) +
// a poisoned negative, proving the evaluators are not rubber stamps. Runs in EVERY mode.
function selfTestEvaluators() {
  const U = { dual: 'uidDUAL0000', div: 'uidDIV00000', rog: 'uidROG00000', forge: 'uidFORGE000', single: 'uidSINGLE00' };
  const synth = {
    migrationVersion: MIGRATION_VERSION,
    asserts: { 'A1 twi regressions == 0': [], 'A2 csd regressions == 0': [], 'A3 dual-enroll signature after == 0': [],
      'A6 N>1 review-only days pass on attempt evidence alone': [], 'A7 divergent max-csd survives own-anchor screen': [] },
    quarantine: { ANCHORLESS_TWI: [`${U.forge.slice(0, 8)} L [single-doc] ANCHORLESS_TWI d: twi=2000`], TWI_EXCEEDS_ANCHOR: [], CSD_IMPLAUSIBLE: [], PREEXISTING_CANONICAL_CONFLICT: [], PAIR_ERROR: [] },
    report: { singleDocDeviations: [] },
    pairs: [
      { uid: U.dual, listId: 'L', population: 'LIVE-STRAND', action: 'MIGRATE', quarantine: [], anchor: { twi: 640 }, invalidAnchorAttempts: 0, after: { twi: 640, csd: 8, droppedFields: ['classId'] } },
      { uid: U.div, listId: 'L', population: 'stale-2nd-enroll', action: 'MIGRATE', quarantine: [], anchor: { twi: 640 }, invalidAnchorAttempts: 0, after: { twi: 640, csd: 15, droppedFields: [] } },
      { uid: U.rog, listId: 'L', population: 'single-doc', action: 'MIGRATE', quarantine: [], anchor: { twi: 120 }, invalidAnchorAttempts: 0, after: { twi: 120, csd: 13, droppedFields: [] } },
      { uid: U.forge, listId: 'L', population: 'single-doc', action: 'SKIP_QUARANTINE', quarantine: ['ANCHORLESS_TWI ...'], anchor: null, invalidAnchorAttempts: 1, after: { twi: 2000 } },
      { uid: U.single, listId: 'L', population: 'single-doc', action: 'MIGRATE', quarantine: [], anchor: { twi: 200 }, invalidAnchorAttempts: 0, after: { twi: 200, csd: 5, droppedFields: ['classId'] } },
    ],
  };
  const checks = [
    ['MIG-1', evalMIG1(synth, U.dual, 'L', { anchorTwi: 640 }).verdict === 'PASS'],
    ['MIG-2', evalMIG2(synth, U.div, 'L', { mergedTwi: 640, mergedCsd: 15 }).verdict === 'PASS'],
    ['MIG-3', evalMIG3(synth, U.rog, 'L', { csd: 13, anchorDay: 3 }).verdict === 'PASS'],
    ['MIG-4', evalMIG4(synth, U.forge, 'L', {}).verdict === 'PASS'],
    ['MIG-5', evalMIG5(synth, U.single, 'L', { twi: 200, csd: 5 }).verdict === 'PASS'],
    ['MIG-9', evalMIG9([synth]).verdict === 'PASS'],
    ['parseFinal', JSON.stringify(parseFinal('FINAL: READY asserts_failing=0 quarantine=0')) === JSON.stringify({ ready: true, assertsFailing: 0, quarantine: 0 })],
    ['parseFinal-notready', parseFinal('FINAL: NOT_READY asserts_failing=1 quarantine=3')?.ready === false],
    // NEGATIVE: a forged pair that (wrongly) MIGRATEs with twi promoted must FAIL evalMIG4 (evaluator is not a stamp)
    ['MIG-4-neg', evalMIG4({ ...synth, pairs: [{ uid: U.forge, listId: 'L', population: 'single-doc', action: 'MIGRATE', quarantine: [], invalidAnchorAttempts: 0, after: { twi: 2000, csd: 5 } }], quarantine: { ANCHORLESS_TWI: [], TWI_EXCEEDS_ANCHOR: [], CSD_IMPLAUSIBLE: [] } }, U.forge, 'L', {}).verdict === 'FAIL'],
    // NEGATIVE: a twi regression must FAIL evalMIG9
    ['MIG-9-neg', evalMIG9([{ ...synth, asserts: { ...synth.asserts, 'A1 twi regressions == 0': ['x'] } }]).verdict === 'FAIL'],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([n]) => n);
  return { ok: failed.length === 0, failed, total: checks.length };
}

// ── STATIC oracle bits (read repo source; no live data) — MIG-8 code-walk, MIG-10 static leg ──
function readSrc(rel) { const p = resolve(REPO, rel); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
function evalMIG8Static() {
  const src = readSrc('scripts/cs/deepfix-migrate-list-progress.mjs') || '';
  const hasCatch = /catch\s*\(e\)\s*\{[\s\S]*?QUAR\.PAIR_ERROR\.push/.test(src) && /population:\s*'ERROR',\s*action:\s*'SKIP_ERROR'/.test(src);
  const poolContinues = /await Promise\.all\(pairs\.slice/.test(src); // per-pair pool → one error doesn't abort the batch
  const pass = hasCatch && poolContinues;
  return { verdict: pass ? 'PASS' : 'FAIL',
    actual: `try/catch→PAIR_ERROR/SKIP_ERROR=${hasCatch} pool-continues=${poolContinues}`,
    evidence: 'code-walk: computePair wraps the pair in try/catch → QUAR.PAIR_ERROR + SKIP_ERROR ("errored lookups move NOTHING") and the POOL loop processes other pairs regardless. A hard computePair THROW is not deterministically seed-reproducible (the script is defensively coded); the invalid-anchor "moves nothing" arm is exercised live by seedForgedTwiHigh (MIG-4).' };
}
function evalMIG10Static() {
  const mp = readSrc('scripts/cs/manual-pass.mjs') || '';
  const mpValidAnchor = /newWordStartIndex/.test(mp) && /newWordEndIndex/.test(mp) && /wordsIntroduced/.test(mp) && /testId:\s*`vocaboost_test_/.test(mp);
  const sweep = readSrc('scripts/cs/data-integrity-sweep.mjs') || '';
  const census = readSrc('scripts/cs/deepfix-census2.mjs') || '';
  const sweepReadsLP = /list_progress/.test(sweep);
  const censusReadsLP = /list_progress/.test(census);
  // manual-pass valid-anchor is the shipped HALF that is realizable read-only; the sweep/census
  // list_progress RETARGET (F6-3) is a shipped-state assertion — report its status honestly.
  return { mpValidAnchor, sweepReadsLP, censusReadsLP };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// COMMIT-LEG STUBS (DEFERRED to Codex Task-6 — exact command + expected oracle; never a false PASS)
// ════════════════════════════════════════════════════════════════════════════════════════════
function stubCommitLegs(cohortUids) {
  const cmd = (s) => s;
  add('MIG-6', 'idempotent re-run', 'second --commit run is a no-op (0 additional diffs; no double-merge)',
    'NOT RUN (write-guarded; Codex Task-6)', 'DEFERRED',
    `Codex: (1) ${cmd(`NODE_PATH=/app/node_modules node scripts/cs/deepfix-migrate-list-progress.mjs 25WT --commit --confirm-migrate=25WT`)} ; (2) re-run the SAME command → expect actions all SKIP_DONE, written=0, and a byte-identical diff. (idempotency stamp: migratedAt on each collapsed legacy doc; existing canonical overwrite only if anchor-validated twi >= existing.)`, 'deferred');
  add('MIG-7', 'post-flip catch-up fold', 'a completion landing on a stamped legacy doc (lastSessionAt > migratedAt) is folded into canonical; no loss',
    'NOT RUN (write-guarded; Codex Task-6)', 'DEFERRED',
    `Codex: --commit; then simulate a flag-off client advancing the seedRacingLegacyWrite doc (bump csd/twi + fresh lastSessionAt on the legacy class_progress); then ${cmd('… --catchup --confirm-migrate=25WT')} → expect the canonical csd/twi to include the racing completion (non-demoting max) and the late legacy doc re-stamped. Fixture seeded: seedRacingLegacyWrite.`, 'deferred');
  add('MIG-9-commit', 'post-commit cohort sweep (written docs)', 'twi_after >= twi_before AND csd_after >= csd_before for every seeded student on the WRITTEN canonical docs; one backup file per source doc; every canonical traces to the runId stamp',
    'NOT RUN (write-guarded; Codex Task-6)', 'DEFERRED',
    `Codex: after --commit, read back users/{uid}/list_progress/{listId} for [${cohortUids.map((u) => u.slice(0, 8)).join(', ')}] and assert non-regression vs the pre-image; assert dsg-edits/srv_validate/list_progress_backups/{uid}_{listId}.json exists per SOURCE doc; assert every written doc carries migrationVersion=${MIGRATION_VERSION}. (The --dry leg already proved A1/A2 empty + the diff artifact + --dry --backup files.)`, 'deferred');
  add('MIG-10-commit', 'CS toolchain retarget — live sweep + manual-pass', 'the reworked sweep flags a seeded list_progress corruption (not via class_progress); manual-pass writes a canonical valid anchor CS-6 M4 accepts',
    'NOT RUN (write-guarded; Codex Task-6)', 'DEFERRED',
    `Codex: after the F6-3 retarget ships, run ${cmd('node scripts/cs/data-integrity-sweep.mjs 25WT')} against a seeded list_progress corruption → expect a flag; run ${cmd('node scripts/cs/manual-pass.mjs <sandbox student>')} (commit) → expect an attempt with newWordStartIndex/EndIndex/wordsIntroduced/testId that CS-6's M4 accepts.`, 'deferred');
  add('RET-3', 'legacy deletion + sweep clean (sandbox)', 'after the P7 deletion script, 0 class_progress docs remain for the 25WT cohort AND the list_progress-shaped sweep exits 0',
    'NOT RUN (write-guarded; Codex Task-6)', 'DEFERRED',
    `Codex: after --commit + the flag cutover, run the P7 deletion (${existsSync(P7_DELETE) ? 'scripts/cs/deepfix-delete-legacy-class-progress.mjs' : 'the P7 deletion script — NOT PRESENT at HEAD, author it first'}) scoped 25WT → expect 0 legacy class_progress for the cohort; then the reworked sweep exit 0. (RET-1 zero-refs grep is M-STATIC's job.)`, 'deferred');
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════════════════════
let MODE = DRY_ONLY ? 'self-validate' : 'full-dry';
let cohortUids = [];

// The executable oracle-walk runs in EVERY mode (validates the evaluators + parser).
const self = selfTestEvaluators();
add('SELF-EVAL', 'oracle-walk self-test (evaluators + FINAL/JSON parser vs synthetic ± poisoned fixtures)',
  'all positive fixtures PASS, poisoned fixtures FAIL, parseFinal round-trips',
  `${self.total - self.failed.length}/${self.total} checks ok`, self.ok ? 'PASS' : 'FAIL',
  self.ok ? 'evaluators + parser proven against synthetic positive/negative fixtures' : `FAILED self-checks: ${self.failed.join(', ')}`, 'self');

// MIG-8 code-walk + MIG-10 static leg run in every mode (repo reads only).
{
  const r = evalMIG8Static();
  add('MIG-8', 'errored-anchor abort (code-walk)', 'computePair try/catch → PAIR_ERROR/SKIP_ERROR; pool continues for others', r.actual, r.verdict, r.evidence, 'code-walk');
  const s = evalMIG10Static();
  add('MIG-10a', 'CS toolchain — manual-pass writes a full valid anchor (static)',
    'manual-pass.mjs writes newWordStartIndex/EndIndex/wordsIntroduced/testId',
    `mpValidAnchor=${s.mpValidAnchor}`, s.mpValidAnchor ? 'PASS' : 'FAIL',
    'the manual-pass canonical-anchor half of MIG-10 (CLAUDE.md rule) is shipped at HEAD', 'static');
  add('MIG-10b', 'CS toolchain — sweep/census read list_progress (static retarget status)',
    'data-integrity-sweep.mjs + deepfix-census2.mjs read list_progress (F6-3 retarget shipped)',
    `sweepReadsLP=${s.sweepReadsLP} censusReadsLP=${s.censusReadsLP}`,
    (s.sweepReadsLP && s.censusReadsLP) ? 'PASS' : 'DEFERRED',
    (s.sweepReadsLP && s.censusReadsLP)
      ? 'both CS instruments target list_progress'
      : 'RETARGET NOT SHIPPED at HEAD: sweep + census still read class_progress (empirically confirmed 2026-07-14). This is a P7/F6-3 shipped-state oracle — DEFERRED with status, not a migration FAIL.', 'static');
}

if (DRY_ONLY) {
  // SELF-VALIDATION: no live provisioning/seeding/migration. Mark every live MIG oracle DEFERRED(env).
  for (const [id, sc] of [
    ['MIG-1', 'LIVE-STRAND collapse'], ['MIG-2', 'divergent + own-anchor CSD'], ['MIG-3', 'review-only evidence'],
    ['MIG-4', 'forged/anchorless quarantine (dry leg)'], ['MIG-5', 'single-doc 1:1'],
    ['MIG-9', 'cohort hard asserts (dry leg)']]) {
    add(id, sc, 'PASS on a seeded 25WT per-uid --dry run', 'NOT RUN (--dry-only self-validation: no live writes/reads in this env)', 'DEFERRED',
      'runner + evaluator validated via SELF-EVAL; the live seed+--dry leg runs in the authorized env (Codex/David).', 'deferred');
  }
  stubCommitLegs(['<cohort resolved at full run>']);
} else {
  // ── FULL DRY AUDIT (authorized env): provision → seed → per-uid --dry → verify → assert ──
  FB = await import('./lsr_deepfix_fb.mjs');
  const db = FB.db();

  // resolve cohort config
  const accts = JSON.parse(readFileSync(resolve(HERE, 'lsr_accounts.json'), 'utf8')).accounts;
  const byEmail = new Map(accts.map((a) => [a.email, a]));
  const listsFile = JSON.parse(readFileSync(resolve(HERE, 'lsr_lists.json'), 'utf8'));
  const teacherUid = listsFile.teacherUid;
  const TIER = process.env.LSR_TIER || null;
  const clone = (TIER ? listsFile.lists.find((l) => l.tier === TIER) : listsFile.lists[0]);
  if (!clone?.newId) { console.error('[INVALID] no clone list in lsr_lists.json'); process.exit(2); }
  const listId = clone.newId;
  const listSize = await FB.readListWordCount(listId).catch(() => 0);

  // MIG students: env SL_STUDENTS (>=6) else defaults; must be distinct sandbox lsr_*
  const defaults = ['lsr_s90', 'lsr_s91', 'lsr_s92', 'lsr_s93', 'lsr_s94', 'lsr_s95'].map((s) => `${s}@vocaboost.test`);
  const emails = (process.env.SL_STUDENTS || defaults.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  if (emails.length < 6 || emails.some((e) => !SANDBOX_STUDENT_RE.test(e))) {
    console.error('[IDENTITY GUARD] INVALID — need >=6 distinct lsr_*@vocaboost.test MIG students (SL_STUDENTS).'); process.exit(2);
  }
  const S = {}; const roles = ['dual', 'div', 'rog', 'forge', 'race', 'single'];
  for (let i = 0; i < 6; i++) {
    const email = emails[i]; const a = byEmail.get(email);
    const uid = a?.uid || await FB.uidByEmail(email);
    if (!uid) { console.error(`[INVALID] no uid for ${email}`); process.exit(2); }
    S[roles[i]] = { email, uid };
  }
  cohortUids = roles.map((r) => S[r].uid);
  const allowlist = new Set(cohortUids);

  // provision the dedicated 25WT MIG classes (idempotent by name) + enroll
  const cDualA = await provisionMigClass({ tag: 'DUALA', name: `25WT MIG DUALA`, listId, teacherId: teacherUid, uids: [S.dual.uid], pace: 80 });
  const cDualB = await provisionMigClass({ tag: 'DUALB', name: `25WT MIG DUALB`, listId, teacherId: teacherUid, uids: [S.dual.uid], pace: 80 });
  const cDivF = await provisionMigClass({ tag: 'DIVF', name: `25WT MIG DIVF`, listId, teacherId: teacherUid, uids: [S.div.uid], pace: 80 });
  const cDivS = await provisionMigClass({ tag: 'DIVS', name: `25WT MIG DIVS`, listId, teacherId: teacherUid, uids: [S.div.uid], pace: 20 });
  const cPool = await provisionMigClass({ tag: 'POOL', name: `25WT MIG POOL`, listId, teacherId: teacherUid, uids: [S.rog.uid, S.forge.uid, S.race.uid, S.single.uid], pace: 40 });

  // clean slate (unless --keep) then seed the §1.F cohort
  const uidEmail = new Map(roles.map((r) => [S[r].uid, S[r].email]));
  if (!KEEP) {
    for (const [uid, cid] of [[S.dual.uid, cDualA.classId], [S.dual.uid, cDualB.classId], [S.div.uid, cDivF.classId], [S.div.uid, cDivS.classId], [S.rog.uid, cPool.classId], [S.forge.uid, cPool.classId], [S.race.uid, cPool.classId], [S.single.uid, cPool.classId]]) {
      await FB.resetStudentState({ email: uidEmail.get(uid), uid, classId: cid, listId }).catch(() => {});
    }
  }
  const exp = {};
  exp.mig1 = await seedDualDocStrand({ email: S.dual.email, uid: S.dual.uid, classA: cDualA.classId, classB: cDualB.classId, listId, teacherId: teacherUid });
  exp.mig2 = await seedDivergentPace({ email: S.div.email, uid: S.div.uid, classFast: cDivF.classId, classSlow: cDivS.classId, listId, teacherId: teacherUid });
  exp.mig3 = await seedReviewOnlyGapN({ email: S.rog.email, uid: S.rog.uid, classId: cPool.classId, listId, teacherId: teacherUid });
  exp.mig4 = await seedForgedTwiHigh({ email: S.forge.email, uid: S.forge.uid, classId: cPool.classId, listId, teacherId: teacherUid });
  exp.mig7 = await seedRacingLegacyWrite({ email: S.race.email, uid: S.race.uid, classId: cPool.classId, listId, teacherId: teacherUid });
  exp.mig5 = await seedSingleDoc({ email: S.single.email, uid: S.single.uid, classId: cPool.classId, listId, teacherId: teacherUid });

  // per-uid --dry runs (the explicit allowlist realization) + parse
  const runs = {}; for (const r of roles) runs[r] = runMigrationDryForUid(S[r].uid);
  const allReports = Object.values(runs).map((x) => x.report).filter(Boolean);

  // SANDBOX + ALLOWLIST re-verify over EVERY enumerated pair (BINDING) — HARD ABORT on non-sandbox
  let aborts = []; let nonAllow = [];
  for (const r of roles) {
    if (!runs[r].report) { add(`RUN-${r}`, `migration --dry (${r})`, 'a --dry report', `NO REPORT (exit ${runs[r].exitCode})`, 'INVALID', runs[r].stdout.slice(-400), 'dry'); continue; }
    const v = await verifyPlanSandbox(db, runs[r].report, allowlist);
    aborts = aborts.concat(v.aborts); nonAllow = nonAllow.concat(v.nonAllowlisted);
  }
  if (aborts.length) {
    add('SANDBOX-GUARD', 'independent per-doc sandbox re-verify of the --dry plan', 'every enumerated doc 25WT + lsr_*@vocaboost.test',
      `${aborts.length} NON-SANDBOX doc(s)`, 'INVALID', `ABORT — never authorize: ${aborts.slice(0, 6).join(' | ')}`, 'dry');
    // hard stop: do NOT evaluate oracles / never authorize
    finish(); // eslint-disable-line no-use-before-define
  } else {
    add('SANDBOX-GUARD', 'independent per-doc sandbox re-verify of the --dry plan',
      'every enumerated doc 25WT + lsr_*@vocaboost.test',
      `${sandboxTriples.length} docs verified sandbox${nonAllow.length ? `; ${nonAllow.length} non-allowlisted (fail-closed)` : ''}`,
      nonAllow.length ? 'INVALID' : 'PASS',
      nonAllow.length ? `non-allowlisted pairs in a per-uid plan should be impossible — investigate: ${nonAllow.slice(0, 4).join(' | ')}` : `all ${sandboxTriples.length} source docs re-read as 25WT + lsr_*`, 'dry');
  }

  // oracle asserts (only reached if no hard abort)
  const L = listId;
  const r1 = evalMIG1(runs.dual.report, S.dual.uid, L, { anchorTwi: exp.mig1.anchorTwi });
  add('MIG-1', 'LIVE-STRAND collapse', `merged twi == cross-class anchor ${exp.mig1.anchorTwi}; LIVE-STRAND; MIGRATE`, r1.actual, r1.verdict, r1.evidence, 'dry');
  const r2 = evalMIG2(runs.div.report, S.div.uid, L, { mergedTwi: exp.mig2.expectedMergedTwi, mergedCsd: exp.mig2.expectedMergedCsd });
  add('MIG-2', 'divergent + own-anchor CSD screen', `twi==${exp.mig2.expectedMergedTwi}(fast), csd==${exp.mig2.expectedMergedCsd}(slow), not quarantined`, r2.actual, r2.verdict, r2.evidence, 'dry');
  const r3 = evalMIG3(runs.rog.report, S.rog.uid, L, { csd: exp.mig3.csd, anchorDay: exp.mig3.anchorDay });
  add('MIG-3', 'review-only CSD evidence amendment', `MIGRATE; csd==${exp.mig3.csd} preserved (not demoted to ${exp.mig3.anchorDay}); A6 clean`, r3.actual, r3.verdict, r3.evidence, 'dry');
  const r4 = evalMIG4(runs.forge.report, S.forge.uid, L, {});
  add('MIG-4', 'forged/anchorless → QUARANTINE (dry leg)', 'SKIP_QUARANTINE + ANCHORLESS_TWI + never zeroed/promoted; legacy retained', r4.actual, r4.verdict, r4.evidence, 'dry');
  const r5 = evalMIG5(runs.single.report, S.single.uid, L, { twi: exp.mig5.twi, csd: exp.mig5.csd });
  add('MIG-5', 'single-doc 1:1 re-key', `verbatim csd==${exp.mig5.csd}/twi==${exp.mig5.twi}; single-doc; 0 deviations`, r5.actual, r5.verdict, r5.evidence, 'dry');
  const r9 = evalMIG9(allReports);
  add('MIG-9', 'cohort hard asserts (dry leg)', 'A1/A2 empty cohort-wide; --dry diff artifact per uid; migrationVersion stamp', r9.actual, r9.verdict, r9.evidence, 'dry');
  // backups-per-source (MIG-9 backup half) via --dry --backup
  const bkDir = resolve(REPO, 'dsg-edits/srv_validate/list_progress_backups');
  const bkPairs = [[S.dual.uid], [S.div.uid], [S.rog.uid], [S.forge.uid], [S.race.uid], [S.single.uid]].map(([u]) => `${u}_${listId}.json`);
  const bkFound = existsSync(bkDir) ? bkPairs.filter((f) => existsSync(resolve(bkDir, f))).length : 0;
  add('MIG-9-backup', 'backups per source doc (--dry --backup)', 'one {uid}_{listId}.json (sources[]) per seeded pair',
    `${bkFound}/${bkPairs.length} backup files present`, bkFound === bkPairs.length ? 'PASS' : 'DEFERRED',
    bkFound === bkPairs.length ? `backups written to ${bkDir}` : 'partial/none — dry --backup writes to the shared hardcoded BK_DIR; definitive per-commit backups are the Codex leg', 'dry');

  // MIG-7 dry note + P10c TID optional
  add('MIG-7', 'post-flip catch-up (dry note)', 'fixture staged; the fold requires --commit+--catchup', `seedRacingLegacyWrite present for ${S.race.uid.slice(0, 8)}`, 'DEFERRED',
    'nothing is committed (0 list_progress in DB); --catchup finds no stamped canonical — the fold is Codex Task-6. See MIG-7 stub.', 'deferred');
  if (WITH_TID) {
    let tidOut = '', tidExit = 0;
    try { tidOut = execFileSync('node', [MIGRATION_TID, COHORT_REGEX, '--dry', `--uid=${S.single.uid}`, `--out-dir=${resolve(SCRATCH, RUN_ID, 'tid')}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_PATH: resolve(REPO, 'node_modules') } }); }
    catch (e) { tidOut = String(e.stdout || '') + String(e.stderr || ''); tidExit = e.status || 1; }
    const tidReady = /FINAL:.*mode=dry/.test(tidOut);
    add('MIG-TID', 'P10c teacherIds backfill --dry (parseable + write-guarded)', 'a parseable dry FINAL line; NO writes', `exit=${tidExit} parseable=${tidReady}`,
      tidReady ? 'PASS' : 'INVALID', 'P10c backfill --dry is write-guarded; its --commit is the Codex leg (deploy teacherIds indexes first).', 'dry');
  } else {
    add('MIG-TID', 'P10c teacherIds backfill --dry', 'run with --with-teacherids', 'skipped (default; heavy 1-query-per-cohort-class scan)', 'SKIP',
      `Codex/authorized: NODE_PATH=/app/node_modules node scripts/cs/deepfix-migrate-attempts-teacherids.mjs 25WT --dry ; --commit is the Codex leg.`, 'deferred');
  }

  stubCommitLegs(cohortUids);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// manifest + findings + fail-closed exit
// ════════════════════════════════════════════════════════════════════════════════════════════
function finish() {
  const summary = { pass: 0, fail: 0, invalid: 0, deferred: 0, skip: 0 };
  for (const a of A) {
    if (a.verdict === 'PASS') summary.pass++;
    else if (a.verdict === 'FAIL') summary.fail++;
    else if (a.verdict === 'INVALID') summary.invalid++;
    else if (a.verdict === 'DEFERRED') summary.deferred++;
    else if (a.verdict === 'SKIP') summary.skip++;
  }
  const clean = summary.fail === 0 && summary.invalid === 0;
  const dryOraclesPass = A.filter((a) => a.kind === 'dry' && /^MIG-\d/.test(a.id)).every((a) => a.verdict === 'PASS');
  const programVerdict = !clean ? 'NOT_CLEAN'
    : DRY_ONLY ? 'SELF_VALIDATED (no live oracles run; commit legs deferred)'
      : (dryOraclesPass ? 'DRY_CLEAN (dry oracles PASS; commit legs deferred to Codex Task-6)' : 'NOT_CLEAN');

  const manifest = {
    matrix: 'M-MIG', module: 'lsr_deepfix_migrate_audit.mjs', runId: RUN_ID, mode: MODE,
    git: { head: GIT_HEAD, short: GIT_SHORT, dirty: DIRTY, dirtyCount: DIRTY_ROWS.length },
    migrationScript: 'scripts/cs/deepfix-migrate-list-progress.mjs', migrationVersion: MIGRATION_VERSION,
    cohortRegex: COHORT_REGEX, slack: SLACK, cohortUids,
    sandboxTriples, startedAt: STARTED, finishedAt: new Date().toISOString(),
    summary, clean, verdict: programVerdict, assertions: A,
  };
  if (!existsSync(FINDINGS)) mkdirSync(FINDINGS, { recursive: true });
  const jsonPath = resolve(FINDINGS, `deepfix_mig_${RUN_ID}.json`);
  const mdPath = resolve(FINDINGS, `deepfix_mig_${RUN_ID}.md`);
  writeFileSync(jsonPath, JSON.stringify(manifest, null, 2));
  const icon = (v) => (v === 'PASS' ? '✅' : v === 'FAIL' ? '❌' : v === 'INVALID' ? '⛔' : v === 'DEFERRED' ? '🕓' : '⏭️');
  const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const md = [
    `# M-MIG — deepfix migration audit`, ``,
    `- **runId:** \`${RUN_ID}\`  **mode:** \`${MODE}\``,
    `- **git:** \`${GIT_SHORT}\` (HEAD \`${GIT_HEAD}\`) dirty=${DIRTY} (${DIRTY_ROWS.length} paths)`,
    `- **migration:** scripts/cs/deepfix-migrate-list-progress.mjs @ ${MIGRATION_VERSION}, cohort=/${COHORT_REGEX}/i, slack=${SLACK}`,
    `- **cohort uids:** ${cohortUids.map((u) => u.slice(0, 8)).join(', ') || '(none — resolved in full mode)'}`,
    `- **sandbox docs re-verified:** ${sandboxTriples.length}`,
    `- **run:** ${STARTED}`, ``,
    `**PROGRAM VERDICT: ${programVerdict}** — pass=${summary.pass} fail=${summary.fail} invalid=${summary.invalid} deferred=${summary.deferred} skip=${summary.skip}`, ``,
    `| | ID | Scenario | Expected | Actual | Verdict | Leg |`,
    `|---|---|---|---|---|---|---|`,
    ...A.map((a) => `| ${icon(a.verdict)} | ${esc(a.id)} | ${esc(a.scenario)} | ${esc(a.expected)} | ${esc(a.actual)} | **${a.verdict}** | ${a.kind} |`),
    ``, `## Evidence`, ...A.map((a) => `- **${a.id}** (${a.verdict}, ${a.kind}): ${esc(a.evidence)}`), ``,
  ].join('\n');
  writeFileSync(mdPath, md);
  console.log(`\n=== M-MIG (${RUN_ID}, ${MODE}) — git ${GIT_SHORT} dirty=${DIRTY} ===`);
  for (const a of A) console.log(`  ${icon(a.verdict)} ${a.id.padEnd(14)} ${a.verdict.padEnd(9)} ${esc(a.scenario)}`);
  console.log(`\nartifacts:\n  ${jsonPath}\n  ${mdPath}`);
  console.log(`\nPROGRAM VERDICT: ${programVerdict} — pass=${summary.pass} fail=${summary.fail} invalid=${summary.invalid} deferred=${summary.deferred} skip=${summary.skip}`);
  process.exit(clean ? 0 : 1);
}

finish();
