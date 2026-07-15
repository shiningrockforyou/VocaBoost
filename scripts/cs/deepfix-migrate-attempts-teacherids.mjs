/**
 * P10c · OVR — attempts `teacherIds` backfill (the C-19 read-surface reindex) — DRAFT
 * =====================================================================================
 * David decision U1 = Option A: denormalize the authorized-teacher set onto each attempt as
 * a `teacherIds` array so the teacher gradebook can `where('teacherIds','array-contains',uid)`
 * and SEE inherited (old-teacher-stamped) attempts of a promoted student (FIX_PLAN P10
 * read-surface leg / I-10 §3-4; P10_IMPL_PLAN §1(c) / U1). This is the ONE-TIME backfill of
 * the EXISTING `attempts` collection; the going-forward stamp lives on the write paths
 * (writeAttemptTxn / writeUpgradedReviewMarker / overrideAttempt / reviewChallenge — server,
 * flag TEACHER_IDS_WRITE_ENABLED; submitTestAttempt / submitTypedTestAttempt — client, flag
 * TEACHER_IDS_READ).
 *
 * THE MEMBERSHIP SET (kept IN SYNC with functions/foundation.js computeTeacherIdsForAttempt
 * and src/services/db.js computeTeacherIdsClient — same definition in all three):
 *   teacherIds = { attempt.teacherId (the write-time STAMP, if set) }
 *              ∪ { classes/{c}.ownerTeacherId : the student is CURRENTLY enrolled in c
 *                  AND c assigns the attempt's listId (assignments[listId] OR legacy
 *                  assignedLists) }
 *   listId = attempt.listId, else parsed from a canonical/legacy testId (gradebook parse
 *            parity, db.js queryTeacherAttempts). List-scoped (NOT the broad "owns any
 *            enrolled class" union of assertOverrideAuthz) — see P10c_impl_notes U1.
 *
 * STATUS: DRAFT — `--dry` ONLY until David authorizes. A `--commit` run is a CS EVENT
 *   (SUPPORT_RUNBOOK CS entry + change_action_log row + OFF-PEAK window). This script is a
 *   DERIVED/VERIFIED writer: it only ever writes the COMPUTED union onto `teacherIds`
 *   (additive — never removes a member) + a `teacherIdsBackfilledAt` idempotency stamp; it
 *   flips NO flags and touches NO other field. The client flag TEACHER_IDS_READ / server flag
 *   TEACHER_IDS_WRITE_ENABLED cutover is a SEPARATE, David-run step. Deploy the new
 *   `teacherIds` composite indexes (firestore.indexes.json) FIRST (like the C-33 precedent).
 *
 * IDEMPOTENCY / CONFLICT RULES (P5 parity):
 *   - Re-runnable: teacherIds is written as the UNION(existing teacherIds, computed set), so a
 *     re-run is stable and NEVER demotes an existing member (a flag-on live write-stamp or a
 *     prior backfill only ADDS). `teacherIdsBackfilledAt` marks a processed doc.
 *   - SKIP a doc iff it already carries `teacherIdsBackfilledAt` AND its existing teacherIds is
 *     already a superset of the freshly computed set (nothing to add) — cheap re-run.
 *   - A doc whose computed set == existing teacherIds but has NO stamp yet (backfilledAt absent)
 *     is still stamped (backfilledAt written) so the idempotency mark is complete.
 *   - Backups (before value of teacherId + teacherIds) are written per batch BEFORE any write.
 *
 * USAGE (from /app; reads scripts/serviceAccountKey.json — gitignored, never commit):
 *   NODE_PATH=/app/node_modules node scripts/cs/deepfix-migrate-attempts-teacherids.mjs [cohortRegex=26SM] [flags]
 *     --dry                     default; NO Firestore writes (write guard throws). Writes a
 *                               local plan/report to dsg-edits/srv_validate/ (local only).
 *     --commit --confirm-teacherids=<cohortRegex>
 *                               guarded writes; the confirm value MUST equal the active cohort
 *                               regex (or ALL with --all). Backups written first, per batch.
 *     --all                     no cohort filter (EXT scope needs David's decision).
 *     --limit=N                 process only the first N in-scope attempts (dry sampling).
 *     --uid=<studentId>         restrict to one student (debug).
 *     --backup                  also write local backup files during --dry.
 *   25WT REHEARSAL FIRST (idempotent re-run check).
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// ───────────────────────────── args + mode guards ─────────────────────────────
const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--'));
const opt = new Map(argv.filter((a) => a.startsWith('--')).map((a) => {
  const i = a.indexOf('='); return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));
const ALL = opt.has('all');
const COHORT_RE = ALL ? null : new RegExp(positional[0] || '26SM', 'i');
const COHORT_LABEL = ALL ? 'ALL' : COHORT_RE.source;
const MODE = opt.has('commit') ? 'commit' : 'dry';
const LIMIT = opt.has('limit') ? Number(opt.get('limit')) : null;
const ONLY_UID = opt.get('uid') || null;
const DRY_BACKUP = opt.has('backup');
const BK_DIR = '/app/dsg-edits/srv_validate/teacherids_backups';
const OUT_DIR = opt.get('out-dir') || '/app/dsg-edits/srv_validate';
const MIGRATION_VERSION = 'P10c-TEACHERIDS-v1';
const BATCH_SIZE = 400; // < Firestore's 500-op batch limit

if (MODE === 'commit') {
  const confirm = opt.get('confirm-teacherids');
  if (confirm !== COHORT_LABEL) {
    console.error(`REFUSED: --commit requires --confirm-teacherids=${COHORT_LABEL} (exactly the active cohort scope).`);
    console.error('This is a David-authorized CS event: SUPPORT_RUNBOOK entry + change_action_log row,');
    console.error('OFF-PEAK window, teacherIds indexes deployed first, 25WT rehearsal done.');
    process.exit(1);
  }
}
const WRITES_ENABLED = MODE === 'commit';
function guardWrite(what) { if (!WRITES_ENABLED) throw new Error(`WRITE BLOCKED (${MODE} mode): ${what}`); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();
const nowTs = () => admin.firestore.Timestamp.now();

// ───────────────────────────── helpers (membership set — 3-way sync) ─────────────────────────────
const short = (u) => (u || '').slice(0, 8);
const TESTID_NEW_RE = /^vocaboost_test_[^_]+_([^_]+)_/; // vocaboost_test_<classId>_<listId>_<type>
const TESTID_OLD_RE = /^(?:test|typed)_([^_]+)_/; // legacy test_<listId>_ / typed_<listId>_
function listIdOf(a) {
  if (typeof a.listId === 'string' && a.listId) return a.listId;
  const t = a.testId || '';
  const mNew = TESTID_NEW_RE.exec(t); if (mNew) return mNew[1];
  const mOld = TESTID_OLD_RE.exec(t); if (mOld) return mOld[1];
  return null;
}

// classes: id → {name, cohort, ownerTeacherId, assignments, assignedLists}
console.log(`P10c teacherIds backfill [${MODE.toUpperCase()}] cohort=/${COHORT_LABEL}/i v=${MIGRATION_VERSION}`);
if (MODE === 'commit') console.log('⚠ COMMIT MODE — verify: off-peak window, teacherIds indexes deployed, 25WT rehearsed.\n');

const classesSnap = await db.collection('classes').get();
const classes = new Map();
classesSnap.forEach((d) => {
  const c = d.data();
  classes.set(d.id, {
    name: c.name || '(unnamed)',
    cohort: ALL ? true : COHORT_RE.test(c.name || ''),
    ownerTeacherId: c.ownerTeacherId || null,
    assignments: c.assignments || {},
    assignedLists: Array.isArray(c.assignedLists) ? c.assignedLists : [],
  });
});
const cohortClassIds = [...classes.entries()].filter(([, c]) => c.cohort).map(([id]) => id);
console.log(`classes=${classes.size} | cohort classes=${cohortClassIds.length}`);

// student enrollment cache: studentId → [classId]
const studentEnrollCache = new Map();
async function enrolledClassesOf(studentId) {
  if (!studentEnrollCache.has(studentId)) {
    const s = await db.doc(`users/${studentId}`).get();
    studentEnrollCache.set(studentId, s.exists ? Object.keys(s.data().enrolledClasses || {}) : []);
  }
  return studentEnrollCache.get(studentId);
}

// THE membership set (3-way sync — see header).
async function computeTeacherIds({ studentId, listId, stampTeacherId }) {
  const ids = new Set();
  if (stampTeacherId) ids.add(stampTeacherId);
  if (studentId) {
    for (const classId of await enrolledClassesOf(studentId)) {
      const c = classes.get(classId);
      if (!c) continue;
      const assignsList = listId != null &&
        ((c.assignments && c.assignments[listId]) || c.assignedLists.includes(listId));
      if (assignsList && c.ownerTeacherId) ids.add(c.ownerTeacherId);
    }
  }
  return [...ids].sort();
}

const sameSet = (a, b) => {
  const A = new Set(a || []); const B = new Set(b || []);
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
};
const isSuperset = (existing, computed) => {
  const E = new Set(existing || []);
  return (computed || []).every((x) => E.has(x));
};

// ───────────────────────────── scan in-scope attempts ─────────────────────────────
// Scope = attempts whose classId is a cohort class (standard CS cohort scoping). An attempt
// whose class is non-cohort but whose student is a cohort student is OUT of scope by this rule
// (documented limitation — run --all for a full reindex). One query per cohort class bounds
// the read to the cohort.
const plan = []; // {ref, id, path, studentId, listId, stampTeacherId, before, computed, merged, action}
const counts = { scanned: 0, willWrite: 0, skipNoop: 0, skipDone: 0, noListId: 0 };
const actionCounts = {};

for (const classId of cohortClassIds) {
  if (LIMIT && plan.length >= LIMIT) break;
  let snap;
  try {
    snap = await db.collection('attempts').where('classId', '==', classId).get();
  } catch (e) {
    console.error(`  attempts query failed for class ${short(classId)}: ${e.message}`);
    continue;
  }
  for (const d of snap.docs) {
    if (LIMIT && plan.length >= LIMIT) break;
    const a = d.data();
    if (ONLY_UID && a.studentId !== ONLY_UID) continue;
    counts.scanned++;
    const listId = listIdOf(a);
    if (listId == null) counts.noListId++;
    const stampTeacherId = a.teacherId || null;
    const computed = await computeTeacherIds({ studentId: a.studentId, listId, stampTeacherId });
    const existing = Array.isArray(a.teacherIds) ? a.teacherIds : null;
    const merged = [...new Set([...(existing || []), ...computed])].sort();
    const backfilled = a.teacherIdsBackfilledAt != null;

    let action;
    if (backfilled && isSuperset(existing, computed)) action = 'SKIP_DONE';
    else if (existing && sameSet(existing, merged)) action = 'WRITE_STAMP_ONLY'; // set unchanged, mark backfilledAt
    else action = 'WRITE_MERGE'; // add computed members (+ stamp)

    if (action === 'SKIP_DONE') counts.skipDone++;
    else counts.willWrite++;
    actionCounts[action] = (actionCounts[action] || 0) + 1;

    plan.push({
      ref: d.ref, id: d.id, path: d.ref.path, studentId: a.studentId, listId,
      stampTeacherId, before: existing, computed, merged, action,
    });
  }
}
console.log(`in-scope attempts: ${plan.length} (scanned ${counts.scanned}; no-listId ${counts.noListId})`);
console.log('actions:', JSON.stringify(actionCounts));
console.log(`  willWrite=${counts.willWrite} skipDone=${counts.skipDone}`);

// ───────────────────────────── sample + report (the --dry artifact) ─────────────────────────────
const sample = plan.filter((p) => p.action !== 'SKIP_DONE').slice(0, 15).map((p) => ({
  id: short(p.id), student: short(p.studentId), listId: short(p.listId || ''),
  stamp: short(p.stampTeacherId || ''), before: (p.before || []).map(short), computed: p.computed.map(short),
  merged: p.merged.map(short), action: p.action, adds: p.merged.filter((x) => !(p.before || []).includes(x)).map(short),
}));
console.log('\n=== sample (first 15 changing) ===');
for (const s of sample) {
  console.log(`  ${s.id} st=${s.student} L=${s.listId} [${s.action}] before=[${s.before.join(',')}] -> merged=[${s.merged.join(',')}]${s.adds.length ? ` (+${s.adds.join(',')})` : ''}`);
}

mkdirSync(OUT_DIR, { recursive: true });
const reportPath = `${OUT_DIR}/teacherids_backfill_${MODE}_${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(), mode: MODE, cohort: COHORT_LABEL, migrationVersion: MIGRATION_VERSION,
  cohortClasses: cohortClassIds.length, counts, actions: actionCounts, sample,
  plan: plan.map((p) => ({ id: p.id, path: p.path, studentId: p.studentId, listId: p.listId,
    stampTeacherId: p.stampTeacherId, before: p.before, computed: p.computed, merged: p.merged, action: p.action })),
}, null, 2));
console.log(`\nfull plan → ${reportPath}`);

if (DRY_BACKUP || MODE === 'commit') {
  mkdirSync(BK_DIR, { recursive: true });
}

// ───────────────────────────── COMMIT (guarded) ─────────────────────────────
let commitMismatched = 0;
if (MODE === 'commit') {
  guardWrite('teacherIds backfill commit');
  const toWrite = plan.filter((p) => p.action !== 'SKIP_DONE');
  let written = 0;
  for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
    const chunk = toWrite.slice(i, i + BATCH_SIZE);
    // backup FIRST (before-values) — restore path
    writeFileSync(`${BK_DIR}/batch_${String(i / BATCH_SIZE).padStart(4, '0')}.json`, JSON.stringify({
      backedUpAt: new Date().toISOString(), cohort: COHORT_LABEL,
      docs: chunk.map((p) => ({ path: p.path, before: { teacherId: p.stampTeacherId, teacherIds: p.before } })),
    }, null, 2));
    const batch = db.batch();
    for (const p of chunk) {
      batch.update(p.ref, { teacherIds: p.merged, teacherIdsBackfilledAt: nowTs(), teacherIdsBackfillVersion: MIGRATION_VERSION });
    }
    await batch.commit();
    written += chunk.length;
    if (written % (BATCH_SIZE * 5) === 0 || i + BATCH_SIZE >= toWrite.length) console.log(`  …${written}/${toWrite.length} written`);
  }
  // post-write verification (read back a sample)
  let verified = 0, mismatched = 0;
  for (const p of toWrite.slice(0, 25)) {
    const d = await p.ref.get();
    const ti = d.exists ? (d.data().teacherIds || []) : [];
    if (sameSet(ti, p.merged) && d.data().teacherIdsBackfilledAt != null) verified++;
    else { mismatched++; console.error(`  read-back MISMATCH ${short(p.id)}`); }
  }
  commitMismatched = mismatched;
  console.log(`\nCOMMIT complete: ${written} attempts updated | read-back ${verified} ok / ${mismatched} mismatched`);
  console.log('Backups →', BK_DIR);
  console.log('\nNOW: deploy the teacherIds indexes (if not already), then David flips TEACHER_IDS_READ +');
  console.log('TEACHER_IDS_WRITE_ENABLED at the cutover; SUPPORT_RUNBOOK CS entry + change_action_log row.');
} else {
  if (DRY_BACKUP) {
    for (let i = 0; i < plan.length; i += BATCH_SIZE) {
      const chunk = plan.slice(i, i + BATCH_SIZE);
      writeFileSync(`${BK_DIR}/dry_batch_${String(i / BATCH_SIZE).padStart(4, '0')}.json`, JSON.stringify({
        backedUpAt: new Date().toISOString(), dryRun: true,
        docs: chunk.map((p) => ({ path: p.path, before: { teacherId: p.stampTeacherId, teacherIds: p.before } })),
      }, null, 2));
    }
    console.log(`local backups → ${BK_DIR}`);
  }
  console.log(`\n[DRY] NO Firestore writes were made (write guard active). would-write=${counts.willWrite}.`);
  console.log('Next: deploy teacherIds indexes → David reviews this plan → 25WT rehearsal →');
  console.log('SUPPORT_RUNBOOK authorization → --commit --confirm-teacherids=' + COHORT_LABEL + ' (OFF-PEAK).');
}
// [deepfix FINAL-FOLD-C · F-13] Match P5's NOT_READY exit-2 discipline. D2 makes the commit-mode
// read-back a HARD precondition of the TEACHER_IDS cutover, so a run whose sampled read-back found
// a teacherIds MISMATCH is NOT a clean backfill and must exit non-zero, so a checklist keying on
// exit codes can't wave through a partial reindex. --dry is unaffected (commitMismatched stays 0).
const commitNotReady = MODE === 'commit' && commitMismatched > 0;
console.log(`\nFINAL: ${MODE === 'commit' ? (commitNotReady ? 'NOT_READY ' : 'READY ') : ''}mode=${MODE} inScope=${plan.length} willWrite=${counts.willWrite} skipDone=${counts.skipDone}${MODE === 'commit' ? ` mismatched=${commitMismatched}` : ''}`);
process.exit(commitNotReady ? 2 : 0);
