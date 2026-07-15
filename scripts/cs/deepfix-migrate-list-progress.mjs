/**
 * P5 · FND-3 — THE one-time migration: class_progress → list_progress (REVIEWED DRAFT)
 * =====================================================================================
 * Collapses every `users/{uid}/class_progress/{classId}_{listId}` into ONE
 * `users/{uid}/list_progress/{listId}` per (student, list). The LAST consolidation —
 * after it there is no second doc to re-split (FIX_PLAN.md Phase P5 · FND-3;
 * inv_I6_foundation.md §2; PLAN_list_progress_persist.md §8).
 *
 * STATUS: DRAFT — `--dry` only until David authorizes. A `--commit` run is a CS EVENT:
 *   SUPPORT_RUNBOOK CS entry + change_action_log row + OFF-PEAK window + watch window
 *   + post-flip catch-up (`--catchup`) + sweep/census before & after (X5).
 *   This script is the SINGLE audited canonical writer; the three-flag cutover
 *   (completeSession target flip / resolveListProgress write-capable / LIST_PROGRESS_CANONICAL)
 *   is a SEPARATE, bundled deploy step — this script does NOT flip flags.
 *
 * THE MERGE RULE (I-6 §2.1 = persist §8, adopted verbatim):
 *   TWI  = anchor-validated max totalWordsIntroduced across sources. Anchor = the
 *          student+list max passed-new `newWordEndIndex` + 1 — the SAME semantics as the
 *          live recon `getMostRecentPassedNewTest` (db.js:3239, LIST_SCOPED_RECON branch:
 *          passed==true, sessionType=='new', integer nwei>=0, ORDER BY nwei DESC,
 *          submittedAt DESC tie-break). Anchorless/forged highs → QUARANTINE the pair
 *          (never zero, never auto-promote, move NOTHING).
 *   CSD  = max PLAUSIBLE currentStudyDay across EVERY source doc [C4-1] — each doc
 *          screened against ITS OWN anchor-derived day (v3 MED), NOT the max-twi
 *          winner's anchor. See THE CSD-PLAUSIBILITY SCREEN below.
 *   Ancillary (interventionLevel/recentSessions/stats/streakDays/lastStudyDate) from the
 *          max-twi winner (tie-break: max twi → max csd → newest lastSessionAt).
 *   programStartDate = min() across sources; lastSessionAt = max() (shared truth);
 *   drop progressSnapshot / blindSpot fields / classId (winner's classId kept as informational
 *   `lastActiveClassId` — persist §4 [F3]); stamp `migratedAt` + `migratedFrom`.
 *
 * THE MANDATORY CSD-PLAUSIBILITY SCREEN (FIX_PLAN P5 amendment / Codex+verifier fold #5):
 *   PRIMARY, DURABLE evidence for a legitimate csd−anchorDay gap = the count of DISTINCT
 *   post-anchor REVIEW DAYS (day-granular, list-scoped: ONE per `studyDay` regardless of class —
 *   the SAME unit as csd, so a dual-enrolled student's same-day reviews across two classes count
 *   ONCE and never inflate the ceiling), over review ATTEMPTS with `submittedAt > anchor.submittedAt`
 *   and SAME student+list lineage (see LINEAGE below). Attempts are the permanent ledger — one
 *   exists for every review-only completion. EXCLUDED (FINAL-FOLD-C · carry F-4): attempts flagged
 *   `autoCompleted:true` — the client/server "no review available" auto-markers are stand-ins, NOT
 *   durable student review evidence, so they must not legitimise a pumped csd (parity with
 *   foundation.js countPostAnchorReviewDays). The `reviewOnlyDay:true` session marker is NOT used
 *   either: it lives only on ephemeral `session_states` (overwritten each session) and is
 *   DELIBERATELY not on the durable summary (studyService.js:1448-1455, verified 2026-07-13) —
 *   using it would undercount and re-quarantine long-recovering students.
 *   A csd is plausible up to max(anchorDay + evidencedReviewDays + slack,
 *   implausibleStudyDayThreshold) — beyond that → quarantine (default) or exclude-from-max
 *   (`--csd-mode=exclude`, persist §8's letter; quarantine is the conservative default
 *   because [C7-2] requires the quarantine set == 0 pre-flip anyway).
 *
 * LINEAGE, made CONCRETE (Codex r2 carryforward #2 — not prose):
 *   An attempt `a` belongs to the (student U, list L) lineage IFF
 *     a.studentId === U                       (query-enforced at fetch)
 *     AND lineageListId(a) === L
 *   where lineageListId(a) = a.listId when it is a non-empty string, ELSE the <listId>
 *   segment parsed from a canonical testId `vocaboost_test_<classId>_<listId>_<new|review>`
 *   (fallback occurrences are counted in the report). An attempt belongs to source doc D's
 *   CLASS lineage IFF additionally lineageClassId(a) === D.classId (a.classId primary,
 *   same testId fallback; `no_class` never matches). NOTHING else — no name matching, no
 *   docId heuristics, no adoption of unattributable attempts.
 *
 * POPULATIONS handled (CENSUS2 F-3 / scan_F3_dualenroll.json, classification parity with
 * scripts/cs/deepfix-census2.mjs):
 *   36 LIVE-STRAND      → TWI jumps to the cross-class anchor (the manual carry, automated)
 *   6  divergent        → fast doc wins twi; slow doc's day survives via max-plausible CSD
 *   72 stale-2nd-enroll → collapse; latent re-strand path becomes unrepresentable
 *   22+5 benign         → trivial collapse
 *   ~633 single-doc     → 1:1 re-key (byte-equivalent except path + dropped fields;
 *                          anchor promotions reported)
 *
 * HARD-ASSERT ACCEPTANCE (computed in --dry, re-checked before any --commit write):
 *   A1 0 twi regressions per (student,list)      A2 0 csd regressions per (student,list)
 *   A3 dual-enroll signature after == 0           A4 NOBODY moves H→B (F-4 partition)
 *   A5 hand-patched values SURVIVE (manual-pass anchors are valid → anchor-max keeps them)
 *   A6 every student with N>1 consecutive review-only days PASSES the CSD screen on
 *      review-attempt evidence ALONE               A7 divergent max-csd survives own-anchor screen
 *   A8 zero pre-existing canonical docs (the resolver wrote none pre-flip)
 *   invalidAnchor ≈ 0 (reported). F-4 H/P/B before/after = the program metric.
 *
 * IDEMPOTENCY / REVERSIBILITY (persist §8 [V8]/[C3-4]; FIX_PLAN v3 F4-4 honest reversibility):
 *   - `migratedAt` stamped INTO each collapsed legacy doc; stamped docs are never re-migrated.
 *   - An existing list_progress is only overwritten if the new ANCHOR-VALIDATED twi is >= the
 *     existing one (never wall-clock "newer").
 *   - Legacy class_progress docs are RETAINED (P7 deletes later). Backups (source docs +
 *     any pre-existing canonical) → dsg-edits/srv_validate/list_progress_backups/{uid}_{listId}.json
 *   - Rollback is a clean restore ONLY before the first post-flip completion; after that it
 *     is restore + reconcile (run the watch window; keep `--catchup` ready).
 *   - `--catchup`: delta pass for legacy docs with lastSessionAt > migratedAt (a flag-off
 *     client advanced a stamped doc) — non-demoting merge of position + ancillary union.
 *
 * USAGE (from /app; reads scripts/serviceAccountKey.json — gitignored, never commit):
 *   NODE_PATH=/app/node_modules node scripts/cs/deepfix-migrate-list-progress.mjs [cohortRegex=26SM] [flags]
 *     --dry                    default; NO Firestore writes (write guard throws). Writes the
 *                              per-student diff report to dsg-edits/srv_validate/ (local only).
 *     --commit --confirm-migrate=<cohortRegex>
 *                              guarded writes; the confirm value MUST equal the active cohort
 *                              regex (or ALL with --all). Backups written first, per pair.
 *     --catchup --confirm-migrate=<...>   post-flip delta pass (see above).
 *     --all                    no cohort filter (EXT scope needs David's decision — §7.2).
 *     --slack=7                CSD screen slack days.  --csd-mode=quarantine|exclude
 *     --limit=N --uid=<uid>    dry-run sampling / single-student debug.
 *     --backup                 also write local backup files during --dry.
 *   25WT REHEARSAL FIRST (idempotent re-run + flag-off post-migration write → --catchup).
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// ───────────────────────────── args + mode guards ─────────────────────────────
const argv = process.argv.slice(2);
const positional = argv.filter(a => !a.startsWith('--'));
const opt = new Map(argv.filter(a => a.startsWith('--')).map(a => {
  const i = a.indexOf('='); return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
}));
const ALL = opt.has('all');
const COHORT_RE = ALL ? null : new RegExp(positional[0] || '26SM', 'i');
const COHORT_LABEL = ALL ? 'ALL' : COHORT_RE.source;
const MODE = opt.has('commit') ? 'commit' : (opt.has('catchup') ? 'catchup' : 'dry');
const SLACK = Number(opt.get('slack') ?? 7);                    // studyTypes.js:220 default
const LIMIT = opt.has('limit') ? Number(opt.get('limit')) : null;
const ONLY_UID = opt.get('uid') || null;
const CSD_MODE = opt.get('csd-mode') || 'quarantine';           // quarantine | exclude
const ALLOW_CALENDAR_RESCUE = opt.has('diagnostic-calendar-rescue'); // INSPECTION ONLY — loosens CSD screen; never a commit default (P5-2)
const DIAGNOSTIC_ONLY = opt.has('diagnostic-only');             // allow exit 0 with quarantine>0 for inspection (P5-3); DEFAULT fails
const DRY_BACKUP = opt.has('backup');
const BK_DIR = '/app/dsg-edits/srv_validate/list_progress_backups';
const OUT_DIR = opt.get('out-dir') || '/app/dsg-edits/srv_validate';
const MIGRATION_VERSION = 'P5-FND-3-v1';
const DAY_WORDS = 80; // F-3 parity: census2 (deepfix-census2.mjs:77) uses a fixed 80-word one-day lag

if (!['quarantine', 'exclude'].includes(CSD_MODE)) { console.error(`bad --csd-mode=${CSD_MODE}`); process.exit(1); }
if (MODE !== 'dry' && (ALLOW_CALENDAR_RESCUE || DIAGNOSTIC_ONLY)) {
  console.error('REFUSED: --diagnostic-calendar-rescue / --diagnostic-only are INSPECTION-ONLY and cannot be used with --commit/--catchup.');
  process.exit(1);
}
if (MODE !== 'dry') {
  const confirm = opt.get('confirm-migrate');
  if (confirm !== COHORT_LABEL) {
    console.error(`REFUSED: --${MODE} requires --confirm-migrate=${COHORT_LABEL} (exactly the active cohort scope).`);
    console.error('This is a David-authorized CS event: SUPPORT_RUNBOOK entry + change_action_log row,');
    console.error('OFF-PEAK window, fresh Phase-0-style audit re-run, sweep/census BEFORE, 25WT rehearsal done.');
    process.exit(1);
  }
}
const WRITES_ENABLED = MODE !== 'dry';
function guardWrite(what) { if (!WRITES_ENABLED) throw new Error(`WRITE BLOCKED (${MODE} mode): ${what}`); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url), 'utf8'))) });
const db = admin.firestore();
const nowTs = () => admin.firestore.Timestamp.now();

// ───────────────────────────── small helpers ─────────────────────────────
const tsSec = v => (v == null) ? null
  : (typeof v.seconds === 'number') ? v.seconds
  : (typeof v._seconds === 'number') ? v._seconds
  : (v instanceof Date) ? Math.floor(v.getTime() / 1000)
  : (typeof v.toDate === 'function') ? Math.floor(v.toDate().getTime() / 1000) : null;
const toDate = v => v?.toDate?.() ?? (v ? new Date(v) : null);
const iso = v => { const s = tsSec(v); return s == null ? null : new Date(s * 1000).toISOString(); };
const short = u => (u || '').slice(0, 8);
const validNwei = a => Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex >= 0; // db.js integer+range rule

// replicated from src/types/studyTypes.js:159 + :215 (keep in sync — same replication as
// dsg-edits/srv_validate/list_progress_audit.mjs Phase-0 script)
function calculateExpectedStudyDay(programStartDate, studyDaysPerWeek = 5) {
  if (!programStartDate) return 1;
  const start = new Date(programStartDate); const today = new Date();
  today.setHours(0, 0, 0, 0); start.setHours(0, 0, 0, 0);
  const daysElapsed = Math.floor((today - start) / 86400000);
  if (daysElapsed < 0) return 1;
  if (studyDaysPerWeek >= 7) return daysElapsed + 1;
  let studyDays = 0; const cur = new Date(start);
  for (let i = 0; i <= daysElapsed; i++) {
    const dow = cur.getDay();
    if (!(studyDaysPerWeek <= 5 && (dow === 0 || dow === 6))) studyDays++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, studyDays);
}
function implausibleStudyDayThreshold({ programStartDate, studyDaysPerWeek = 5, totalWordsIntroduced = 0, dailyPace, slack = SLACK } = {}) {
  const calendarCeil = programStartDate ? calculateExpectedStudyDay(programStartDate, studyDaysPerWeek) : null;
  const twiCeil = (dailyPace && dailyPace > 0) ? Math.ceil((totalWordsIntroduced || 0) / dailyPace) : null;
  if (calendarCeil == null && twiCeil == null) return null;
  return Math.max(calendarCeil ?? 0, twiCeil ?? 0) + slack;
}

// ── LINEAGE (concrete — header contract). testId parse: Firestore auto-IDs contain no '_',
//    so `vocaboost_test_<classId>_<listId>_<type>` splits unambiguously on non-underscore runs.
const TESTID_RE = /^vocaboost_test_([^_]+)_([^_]+)_(new|review)/;
let lineageFallbacks = 0;
function lineageOf(a) {
  let classId = (typeof a.classId === 'string' && a.classId && a.classId !== 'no_class') ? a.classId : null;
  let listId = (typeof a.listId === 'string' && a.listId) ? a.listId : null;
  if (!classId || !listId) {
    const m = TESTID_RE.exec(a.testId || '');
    if (m) { if (!classId) classId = m[1]; if (!listId) listId = m[2]; lineageFallbacks++; }
  }
  return { classId, listId };
}
const isManualAttempt = a => a.manualOverride === true || /_manual\b|manual$/.test(a.id || ''); // census2:55 parity

// ───────────────────────────── load classes / lists / progress ─────────────────────────────
console.log(`P5 FND-3 migration [${MODE.toUpperCase()}] cohort=/${COHORT_LABEL}/i slack=${SLACK} csd-mode=${CSD_MODE} v=${MIGRATION_VERSION}`);
if (MODE === 'commit') console.log('⚠ COMMIT MODE — verify: off-peak window, fresh Phase-0 audit, sweep/census BEFORE done, 25WT rehearsed.\n');

const classesSnap = await db.collection('classes').get();
const classes = new Map(); // classId → {name, cohort, assignments, studentIds:Set}
classesSnap.forEach(d => {
  const c = d.data();
  classes.set(d.id, {
    name: c.name || '(unnamed)',
    cohort: ALL ? true : COHORT_RE.test(c.name || ''),
    assignments: c.assignments || {},
    studentIds: new Set(c.studentIds || []),
  });
});

// all legacy progress docs (collectionGroup: includes docs under dropped classes — I-6 §2.1)
const cpSnap = await db.collectionGroup('class_progress').get();
const byUser = new Map(); // uid → Map(listId → [source])
let orphanDocs = 0;
cpSnap.forEach(d => {
  const p = d.data();
  const uid = d.ref.parent.parent.id;
  const listId = p.listId || (d.id.includes('_') ? d.id.split('_').slice(1).join('_') : null);
  const classId = p.classId || (d.id.includes('_') ? d.id.split('_')[0] : null);
  if (!listId || !classId) { orphanDocs++; return; }
  if (!byUser.has(uid)) byUser.set(uid, new Map());
  const m = byUser.get(uid); if (!m.has(listId)) m.set(listId, []);
  m.get(listId).push({ ref: d.ref, docId: d.id, classId, listId, raw: p,
    csd: p.currentStudyDay || 0, twi: p.totalWordsIntroduced || 0,
    migratedAt: p.migratedAt ?? null, lastSessionAtSec: tsSec(p.lastSessionAt) ?? 0 });
});

// pre-existing canonical docs (acceptance A8: the resolver wrote NONE pre-flip).
// FOREIGN = any list_progress doc NOT stamped by this migration — our own docs from a prior
// run are expected on idempotent re-runs and are NOT an A8 violation.
const lpSnap = await db.collectionGroup('list_progress').get();
const existingCanonical = new Map(); // `${uid}|${listId}` → {ref, data}
let foreignCanonical = 0;
lpSnap.forEach(d => {
  const data = d.data();
  existingCanonical.set(`${d.ref.parent.parent.id}|${d.id}`, { ref: d.ref, data });
  if (data?.migrationVersion !== MIGRATION_VERSION) foreignCanonical++;
});

// list sizes (wall detection)
const listIds = new Set(); byUser.forEach(m => m.forEach((_, lid) => listIds.add(lid)));
const listSizes = {};
for (const lid of listIds) { const d = await db.collection('lists').doc(lid).get(); listSizes[lid] = d.exists ? (d.data().wordCount || 0) : 0; }

// pair enumeration + cohort scope (pair in scope if ANY source doc's class matches the cohort)
let pairs = [];
for (const [uid, m] of byUser) for (const [listId, docs] of m) {
  if (ONLY_UID && uid !== ONLY_UID) continue;
  const inCohort = docs.some(s => classes.get(s.classId)?.cohort);
  if (!ALL && !inCohort) continue;
  pairs.push({ uid, listId, docs });
}
if (LIMIT) pairs = pairs.slice(0, LIMIT);
console.log(`classes=${classes.size} | class_progress docs=${cpSnap.size} (orphan ${orphanDocs}) | pre-existing list_progress=${lpSnap.size}`);
console.log(`(student,list) pairs in scope: ${pairs.length} (multi-doc: ${pairs.filter(p => p.docs.length > 1).length})\n`);

// ───────────────────────────── per-pair computation ─────────────────────────────
const attemptsCache = new Map();
async function getAttempts(uid) {
  if (!attemptsCache.has(uid)) {
    const snap = await db.collection('attempts').where('studentId', '==', uid).get();
    attemptsCache.set(uid, snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }
  return attemptsCache.get(uid);
}

// [FINAL-FOLD-C · carry F-6] reset-epoch tombstone read — parity with the F-6 anchor readers
// (foundation getResetAtServer / db.js getMostRecentPassedNewTest). At migration time the tombstone
// (written ONLY by the dormant server resetProgress; SERVER_RESET_PROGRESS_ENABLED=false — so it does
// NOT exist in today's tree, making the read byte-equivalent) lives in the PRE-P5 location
// users/{uid}/progress_meta/{listId}; LIST_PROGRESS_CANONICAL flips WITH this migration, so pre-flip
// the legacy reset branch wrote there. Attempts with submittedAt < resetAt belong to the reset-away
// progression and MUST be excluded from the anchor so a pre-epoch straggler can't re-promote twi
// ("reset un-resets", F-6). Any read miss/denial → null → no exclusion (byte-equivalent).
const resetMetaCache = new Map(); // `${uid}|${listId}` → { resetAt, resetEpoch } | null
async function getResetMeta(uid, listId) {
  const key = `${uid}|${listId}`;
  if (!resetMetaCache.has(key)) {
    let meta = null;
    try {
      const s = await db.collection('users').doc(uid).collection('progress_meta').doc(listId).get();
      if (s.exists) { const d = s.data() || {}; if (d.resetAt != null) meta = { resetAt: d.resetAt, resetEpoch: d.resetEpoch ?? null }; }
    } catch { /* missing/denied → no tombstone → no exclusion */ }
    resetMetaCache.set(key, meta);
  }
  return resetMetaCache.get(key);
}

// anchor semantics — db.js:3239 getMostRecentPassedNewTest (LIST_SCOPED_RECON) parity:
// max integer nwei (>=0), tie-break latest submittedAt. Enumerating ALL attempts here makes
// the client's paginate-past-floats loop unnecessary — Number.isInteger gives the same terminal pick.
function pickAnchor(pool) {
  let best = null;
  for (const a of pool) {
    if (!best || a.newWordEndIndex > best.newWordEndIndex
      || (a.newWordEndIndex === best.newWordEndIndex && (tsSec(a.submittedAt) ?? 0) > (tsSec(best.submittedAt) ?? 0))) best = a;
  }
  return best;
}

// THE CSD-PLAUSIBILITY SCREEN — evidence counter (header contract). Day-granular, list-scoped:
// one durable review-day per `studyDay`, the SAME unit as csd. [FINAL-FOLD-C · N-3] the old
// `dedupe` Set (keyed classId|listId|studyDay) was built and NEVER read — removed; the operative
// key is `studyDay` (via `days`), so the code now matches the header's one-per-studyDay contract.
function evidencedReviewDays(attempts, listId, afterSec) {
  const days = new Set();
  for (const a of attempts) {
    if (a.sessionType !== 'review') continue;
    if (a.autoCompleted === true) continue;                    // [FINAL-FOLD-C · carry F-4] auto "no-review" markers are NOT durable evidence (parity with foundation countPostAnchorReviewDays)
    const lin = lineageOf(a);
    if (lin.listId !== listId) continue;                       // same student+list lineage
    if (!Number.isFinite(a.studyDay)) continue;
    if (afterSec != null && !((tsSec(a.submittedAt) ?? -1) > afterSec)) continue; // post-anchor
    days.add(a.studyDay);                                       // capped ONE per studyDay (day-granular)
  }
  return days.size;
}

const records = [];   // full per-pair diff rows (the --dry review artifact)
const QUAR = { TWI_EXCEEDS_ANCHOR: [], ANCHORLESS_TWI: [], CSD_IMPLAUSIBLE: [], PREEXISTING_CANONICAL_CONFLICT: [], PAIR_ERROR: [] };
const ASSERT = { twiRegressions: [], csdRegressions: [], dualSignatureAfter: [], hToB: [], pSurvival: [],
  reviewOnlyEvidence: [], divergentCsd: [],
  preexistingCanonical: foreignCanonical ? [`${foreignCanonical} FOREIGN list_progress docs (not this migration's stamp) — investigate the writer`] : [] };
const REPORT = { anchorPromotions: [], singleDocDeviations: [], csdPassedOnlyByCalendar: [], invalidAnchorPairs: [] };
let invalidAnchorAttempts = 0;
const hpb = { before: { H: 0, P: 0, B: 0 }, after: { H: 0, P: 0, B: 0 }, leftB: [], stayedB: [], moves: [] };
const perStudent = new Map(); // uid → {started, isP, sigBefore, sigAfter}

async function computePair(pair) {
  const { uid, listId, docs } = pair;
  const tag = `${short(uid)} ${short(listId)}`;
  try {
    const at = await getAttempts(uid);
    const size = listSizes[listId] || 0;

    // [FINAL-FOLD-C · carry F-6] reset-epoch: exclude pre-reset attempts from the anchor pool
    // (parity with the F-6 anchor readers). notPreReset is the identity today (no tombstone exists).
    const resetMeta = await getResetMeta(uid, listId);
    const resetSec = resetMeta ? tsSec(resetMeta.resetAt) : null;
    const notPreReset = a => resetSec == null || (tsSec(a.submittedAt) ?? 0) >= resetSec;

    // anchors (list + per-class own-anchors), invalid-anchor sizing
    const passedNew = at.filter(a => notPreReset(a) && lineageOf(a).listId === listId && a.sessionType === 'new' && a.passed === true);
    const valid = passedNew.filter(validNwei);
    const invalid = passedNew.filter(a => !validNwei(a));
    invalidAnchorAttempts += invalid.length;
    if (invalid.length) REPORT.invalidAnchorPairs.push(`${tag} ${invalid.length} passed-new w/o valid newWordEndIndex`);
    const listAnchor = pickAnchor(valid);
    const anchorTwi = listAnchor ? listAnchor.newWordEndIndex + 1 : null;
    const manualValid = valid.filter(isManualAttempt);
    const manualAnchorTwi = manualValid.length ? Math.max(...manualValid.map(a => a.newWordEndIndex + 1)) : null;

    // per-source screens
    const quarantine = [];
    const srcRows = [];
    for (const s of docs) {
      const cls = classes.get(s.classId);
      const asg = cls?.assignments?.[listId] || null;
      // own anchor (v3 MED per-doc baseline): the doc's own CLASS lineage anchor; if the class
      // never produced one, fall back to the LIST anchor (LIST_SCOPED_RECON writes csd into the
      // launched class's doc from the LIST anchor — a classless baseline would misjudge it).
      const own = pickAnchor(valid.filter(a => lineageOf(a).classId === s.classId)) || listAnchor;
      const anchorDay = own && Number.isFinite(own.studyDay) ? own.studyDay : 0;
      const afterSec = own ? tsSec(own.submittedAt) : null;
      const evDays = evidencedReviewDays(at, listId, afterSec);
      const evidCeil = anchorDay + evDays + SLACK;
      const calCeil = implausibleStudyDayThreshold({
        programStartDate: toDate(s.raw.programStartDate), studyDaysPerWeek: asg?.studyDaysPerWeek || 5,
        totalWordsIntroduced: s.twi, dailyPace: asg?.pace,
      });
      const gap = s.csd - anchorDay;
      // P5-2 fix: the DURABLE review-attempt evidence ceiling is BINDING (FIX_PLAN P5 amendment:
      // "a gap is implausible only if it exceeds anchorDay + evidenced-review-days + slack").
      // The calendar/twi ceiling (persist §8 [C4-2]) is kept ONLY for observability — it must NEVER
      // RESCUE a gap the evidence can't support (that is the calendar-rescue hole Codex flagged).
      const passesOnEvidenceAlone = s.csd <= evidCeil;
      const calendarOnly = !passesOnEvidenceAlone && calCeil != null && s.csd <= calCeil; // would-have-passed-on-calendar
      // Plausible == passes on evidence alone. (Low gaps pass trivially: evidCeil ≥ anchorDay+slack.)
      // --diagnostic-calendar-rescue re-enables the old loose ceiling for INSPECTION ONLY (never a
      // commit default; requires an explicit owner spec change per the P5-2 directive).
      const csdPlausible = ALLOW_CALENDAR_RESCUE ? (passesOnEvidenceAlone || (calCeil != null && s.csd <= calCeil)) : passesOnEvidenceAlone;
      // TWI screen — anchor-validated (never zero, never auto-promote a forged high)
      if (anchorTwi != null && s.twi > anchorTwi) quarantine.push(`TWI_EXCEEDS_ANCHOR ${s.docId}: twi=${s.twi}>anchor=${anchorTwi}`);
      if (anchorTwi == null && s.twi > 0) quarantine.push(`ANCHORLESS_TWI ${s.docId}: twi=${s.twi} ${invalid.length ? '(invalid anchors present)' : '(no passed-new at all)'}`);
      if (!csdPlausible) {
        if (CSD_MODE === 'quarantine') quarantine.push(`CSD_IMPLAUSIBLE ${s.docId}: csd=${s.csd}>evidCeil=${evidCeil} (anchorDay=${anchorDay} evDays=${evDays}${calendarOnly ? ` — calendar-only ceil=${calCeil}, NOT rescued` : ` cal=${calCeil ?? '-'}`})`);
        // exclude mode: drops this csd from the max (persist §8 letter) — still reported below
      }
      // A6 (P5-2): gap≥2 that survives ONLY via the calendar ceiling is NOT "passing on evidence
      // alone" → HARD assert failure (the pair quarantines/excludes per --csd-mode above).
      if (calendarOnly && gap >= 2)
        REPORT.csdPassedOnlyByCalendar.push(`${tag} ${s.docId} csd=${s.csd} anchorDay=${anchorDay} evDays=${evDays} evidCeil=${evidCeil} calCeil=${calCeil} — CALENDAR-ONLY (fails A6${ALLOW_CALENDAR_RESCUE ? ', rescue OVERRIDE active' : ''})`);
      if (gap >= 2 && !passesOnEvidenceAlone)
        ASSERT.reviewOnlyEvidence.push(`${tag} ${s.docId} gap=${gap} evDays=${evDays} csd=${s.csd} evidCeil=${evidCeil}${calendarOnly ? ' (calendar-only, not evidence)' : ''} — review-only recoverer not supported by durable review-attempt evidence`);
      const lastAct = at.filter(a => { const l = lineageOf(a); return l.classId === s.classId && l.listId === listId; })
        .reduce((m, a) => Math.max(m, tsSec(a.submittedAt) ?? 0), 0);
      srcRows.push({ ...s, asg, ownAnchorDay: anchorDay, evDays, evidCeil, calCeil, csdPlausible, passesOnEvidenceAlone, gap,
        lastAct: Math.max(lastAct, s.lastSessionAtSec), atWall: size > 0 && s.twi >= size,
        clsName: (cls?.name || s.classId).replace(/^26SM\s*/, '') });
    }

    // population classification (deepfix-census2.mjs:74-85 parity → scan_F3 kinds)
    let population;
    const active = srcRows.slice().sort((a, b) => b.lastAct - a.lastAct)[0];
    if (docs.length === 1) population = 'single-doc';
    else {
      const twis = srcRows.map(s => s.twi); const spread = Math.max(...twis) - Math.min(...twis);
      const allFinished = srcRows.every(s => s.atWall);
      const activeBehind = anchorTwi != null && (anchorTwi - active.twi) >= DAY_WORDS;
      const stranded = anchorTwi != null && srcRows.some(s => (anchorTwi - s.twi) >= DAY_WORDS);
      population = activeBehind ? 'LIVE-STRAND' : allFinished ? 'benign-finished'
        : spread === 0 ? 'benign-equal' : stranded ? 'stale-2nd-enroll' : 'divergent';
    }

    // MERGE (only meaningful when not quarantined)
    const plausibleCsds = srcRows.filter(s => s.csdPlausible).map(s => s.csd);
    const mergedCsd = plausibleCsds.length ? Math.max(...plausibleCsds) : 0;
    const validTwis = srcRows.filter(s => anchorTwi == null || s.twi <= anchorTwi).map(s => s.twi);
    const mergedTwi = Math.max(anchorTwi ?? 0, validTwis.length ? Math.max(...validTwis) : 0);
    // ancillary winner: max twi → max csd → newest lastSessionAt (I-6 §2.1)
    const winner = srcRows.slice().sort((a, b) => (b.twi - a.twi) || (b.csd - a.csd) || (b.lastAct - a.lastAct))[0];
    const psds = srcRows.map(s => toDate(s.raw.programStartDate)).filter(Boolean);
    const cads = srcRows.map(s => toDate(s.raw.createdAt)).filter(Boolean);
    const lastSessionAtSec = Math.max(0, ...srcRows.map(s => s.lastSessionAtSec));
    const merged = {
      listId,
      currentStudyDay: mergedCsd,
      totalWordsIntroduced: mergedTwi,
      programStartDate: psds.length ? new Date(Math.min(...psds.map(d => d.getTime()))) : null, // min()
      interventionLevel: winner.raw.interventionLevel ?? 0,
      recentSessions: winner.raw.recentSessions ?? [],
      stats: winner.raw.stats ?? { avgNewWordScore: null, avgReviewScore: null },
      streakDays: winner.raw.streakDays ?? 0,
      lastStudyDate: winner.raw.lastStudyDate ?? null,
      lastSessionAt: lastSessionAtSec ? admin.firestore.Timestamp.fromMillis(lastSessionAtSec * 1000) : null, // max() shared truth
      lastActiveClassId: winner.classId,            // informational only (persist §4 [F3]) — NOT identity
      createdAt: cads.length ? new Date(Math.min(...cads.map(d => d.getTime()))) : nowTs(),
      updatedAt: nowTs(),
      migratedAt: nowTs(),
      migratedFrom: docs.map(s => s.docId),
      migrationVersion: MIGRATION_VERSION,
      // dropped by allowlist: progressSnapshot, blindSpot*, classId (persist §2.1/§4)
    };
    // [FINAL-FOLD-C · carry F-6] carry a pre-existing reset-epoch tombstone onto the canonical doc
    // (stream-A FOLD note (c): "the migration must fold progress_meta into the canonical doc it
    // writes"), so post-P5 anchor readers keep excluding pre-reset attempts (parity with F-3, which
    // stamps resetAt/resetEpoch on the canonical doc). resetAt/resetEpoch come from progress_meta,
    // not the class_progress sources, so they are NOT in droppedFields. Absent in today's tree ⇒
    // nothing added ⇒ byte-identical merged doc.
    if (resetMeta) {
      merged.resetAt = resetMeta.resetAt;
      if (resetMeta.resetEpoch != null) merged.resetEpoch = resetMeta.resetEpoch;
    }
    const droppedFields = [...new Set(docs.flatMap(s => Object.keys(s.raw)))].filter(k =>
      !['classId', 'listId', 'currentStudyDay', 'totalWordsIntroduced', 'programStartDate', 'interventionLevel',
        'recentSessions', 'stats', 'streakDays', 'lastStudyDate', 'lastSessionAt', 'createdAt', 'updatedAt', 'migratedAt'].includes(k));

    // idempotency / pre-existing canonical
    const existing = existingCanonical.get(`${uid}|${listId}`) || null;
    let action = 'MIGRATE';
    const allStamped = docs.every(s => s.migratedAt != null);
    if (existing?.data?.migrationVersion === MIGRATION_VERSION && allStamped) action = 'SKIP_DONE';
    else if (existing?.data?.migrationVersion === MIGRATION_VERSION && !allStamped) action = 'MERGE_STRAGGLER'; // unstamped late doc → catch-up-style merge
    else if (existing && existing.data?.migrationVersion !== MIGRATION_VERSION) {
      // persist §8 [V8]: compare ANCHOR-VALIDATED twi, never wall-clock "newer", before overwriting
      if (mergedTwi >= (existing.data?.totalWordsIntroduced || 0)) action = 'MIGRATE_OVERWRITES_FOREIGN';
      else { quarantine.push(`PREEXISTING_CANONICAL_CONFLICT: existing twi=${existing.data?.totalWordsIntroduced} > merged ${mergedTwi}`); }
    }
    if (quarantine.length) action = 'SKIP_QUARANTINE';

    // ── acceptance asserts (per pair) ──
    if (action.startsWith('MIGRATE') || action === 'MERGE_STRAGGLER') {
      for (const s of srcRows) {
        if (merged.totalWordsIntroduced < s.twi) ASSERT.twiRegressions.push(`${tag} ${s.docId} ${s.twi}→${merged.totalWordsIntroduced}`);
        if (merged.currentStudyDay < s.csd && s.csdPlausible) ASSERT.csdRegressions.push(`${tag} ${s.docId} csd ${s.csd}→${merged.currentStudyDay}`);
      }
      if (anchorTwi != null && merged.totalWordsIntroduced < anchorTwi)
        ASSERT.dualSignatureAfter.push(`${tag} merged twi ${merged.totalWordsIntroduced} < anchor ${anchorTwi} (residual strand)`);
      if (population === 'divergent' && merged.currentStudyDay < Math.max(...srcRows.map(s => s.csd)))
        ASSERT.divergentCsd.push(`${tag} divergent max csd ${Math.max(...srcRows.map(s => s.csd))} did not survive (merged ${merged.currentStudyDay})`);
      if (manualAnchorTwi != null && merged.totalWordsIntroduced < manualAnchorTwi)
        ASSERT.pSurvival.push(`${tag} manual anchor twi ${manualAnchorTwi} not kept (merged ${merged.totalWordsIntroduced})`);
      if (anchorTwi != null && merged.totalWordsIntroduced > Math.max(...srcRows.map(s => s.twi)))
        REPORT.anchorPromotions.push(`${tag} [${population}] maxStored=${Math.max(...srcRows.map(s => s.twi))} → anchor=${merged.totalWordsIntroduced}`);
      if (population === 'single-doc' && (merged.totalWordsIntroduced !== docs[0].twi || merged.currentStudyDay !== docs[0].csd))
        REPORT.singleDocDeviations.push(`${tag} verbatim-deviation twi ${docs[0].twi}→${merged.totalWordsIntroduced} csd ${docs[0].csd}→${merged.currentStudyDay}`);
    } else if (action === 'SKIP_QUARANTINE') {
      if (manualAnchorTwi != null) ASSERT.pSurvival.push(`${tag} P-pair QUARANTINED (${quarantine[0]}) — manual value not migrated (legacy retained)`);
      for (const q of quarantine) {
        const key = q.split(' ')[0].replace(':', '');
        (QUAR[key] || QUAR.PAIR_ERROR).push(`${tag} [${population}] ${q}`);
      }
    }

    // H/P/B partition inputs (census2:55,74-118 parity), per student
    const st = perStudent.get(uid) || { started: false, isP: at.some(isManualAttempt), sigBefore: false, sigAfter: false };
    if (srcRows.some(s => s.csd > 0 || s.twi > 0)) st.started = true;
    if (population === 'LIVE-STRAND' || population === 'divergent') st.sigBefore = true;   // clears after
    if (active.atWall) { st.sigBefore = true; }                                            // #11 wall (before)
    if (size > 0 && merged.totalWordsIntroduced >= size) st.sigAfter = true;               // wall after (merged)
    // undersized-test signature (F-2 heuristic parity) — attempt-level: identical before & after
    const newAtts = at.filter(a => lineageOf(a).listId === listId && a.sessionType === 'new' && Number.isInteger(a.totalQuestions) && a.totalQuestions > 0);
    const byDay = {}; newAtts.forEach(a => { (byDay[a.studyDay] = byDay[a.studyDay] || []).push(a); });
    for (const arr of Object.values(byDay)) {
      arr.sort((a, b) => (tsSec(a.submittedAt) ?? 0) - (tsSec(b.submittedAt) ?? 0));
      const a = arr[0]; const tsn = classes.get(a.classId)?.assignments?.[listId]?.testSizeNew
        ?? classes.get(a.classId)?.assignments?.[listId]?.newWordCount ?? null;
      if (tsn == null) continue;
      const remainder = Number.isInteger(a.newWordEndIndex) && a.newWordEndIndex >= size - 1;
      if (!remainder && a.totalQuestions < 0.6 * tsn) { st.sigBefore = true; st.sigAfter = true; break; }
    }
    perStudent.set(uid, st);

    records.push({
      uid, listId, population, action, quarantine,
      anchor: listAnchor ? { twi: anchorTwi, classId: lineageOf(listAnchor).classId, studyDay: listAnchor.studyDay ?? null, attemptId: listAnchor.id, submittedAt: iso(listAnchor.submittedAt) } : null,
      manualAnchorTwi, invalidAnchorAttempts: invalid.length,
      before: srcRows.map(s => ({ docId: s.docId, cls: s.clsName, csd: s.csd, twi: s.twi,
        ownAnchorDay: s.ownAnchorDay, evDays: s.evDays, evidCeil: s.evidCeil, calCeil: s.calCeil,
        csdPlausible: s.csdPlausible, passesOnEvidenceAlone: s.passesOnEvidenceAlone,
        lastAct: s.lastAct ? new Date(s.lastAct * 1000).toISOString().slice(0, 10) : null,
        migratedAt: iso(s.migratedAt), atWall: s.atWall })),
      after: { csd: merged.currentStudyDay, twi: merged.totalWordsIntroduced,
        programStartDate: merged.programStartDate?.toISOString?.()?.slice(0, 10) ?? null,
        winnerDoc: winner.docId, lastActiveClassId: merged.lastActiveClassId, droppedFields },
      _merged: merged, _docs: docs, _existing: existing, // internal (stripped from the JSON report)
    });
  } catch (e) {
    QUAR.PAIR_ERROR.push(`${tag} ${e.message}`); // errored lookups move NOTHING (P5 non-regression)
    records.push({ uid, listId, population: 'ERROR', action: 'SKIP_ERROR', error: e.message });
  }
}

const POOL = 8;
for (let i = 0; i < pairs.length; i += POOL) {
  await Promise.all(pairs.slice(i, i + POOL).map(computePair));
  if ((i / POOL) % 10 === 0 && i) console.error(`  …${Math.min(i + POOL, pairs.length)}/${pairs.length} pairs`);
}

// ───────────────────────────── H/P/B before/after + summary ─────────────────────────────
for (const [uid, st] of perStudent) {
  if (!st.started) continue;
  const before = st.isP ? 'P' : st.sigBefore ? 'B' : 'H';
  const after = st.isP ? 'P' : st.sigAfter ? 'B' : 'H';
  hpb.before[before]++; hpb.after[after]++;
  if (before !== after) hpb.moves.push(`${short(uid)} ${before}→${after}`);
  if (before === 'H' && after === 'B') ASSERT.hToB.push(short(uid));
  if (before === 'B' && after === 'H') hpb.leftB.push(short(uid));
  if (before === 'B' && after === 'B') hpb.stayedB.push(short(uid));
}

const popCounts = {}; records.forEach(r => popCounts[r.population] = (popCounts[r.population] || 0) + 1);
const actionCounts = {}; records.forEach(r => actionCounts[r.action] = (actionCounts[r.action] || 0) + 1);

console.log('\n=== populations (F-3 reference: LIVE-STRAND 36 / divergent 6 / stale-2nd-enroll 72 / benign 22+5 / single ~633 — 07-13, re-verify: numbers go stale) ===');
console.log(JSON.stringify(popCounts));
console.log('actions:', JSON.stringify(actionCounts));

console.log('\n=== per-student diff (quarantines + value-changing merges; FULL diff in the report file) ===');
let printed = 0;
for (const r of records) {
  if (r.action === 'SKIP_DONE') continue;
  const changed = r.before && r.before.some(b => b.csd !== r.after?.csd || b.twi !== r.after?.twi);
  if (r.action === 'SKIP_QUARANTINE' || r.action === 'SKIP_ERROR' || (changed && printed < 60)) {
    console.log(`  ${short(r.uid)} ${short(r.listId)} [${r.population}] ${r.action}`
      + (r.before ? ` ${r.before.map(b => `${b.cls}:d${b.csd}/t${b.twi}`).join(' | ')} → d${r.after.csd}/t${r.after.twi}` : ` ${r.error || ''}`)
      + (r.quarantine?.length ? `  ⚠ ${r.quarantine.join(' ; ')}` : ''));
    printed++;
  }
}

console.log('\n=== F-4 H/P/B partition (THE program metric — baseline 07-13: H=541 P=45 B=188 of 774) ===');
console.log(`  before: H=${hpb.before.H} P=${hpb.before.P} B=${hpb.before.B}   →   after: H=${hpb.after.H} P=${hpb.after.P} B=${hpb.after.B}`);
console.log(`  left B: ${hpb.leftB.length} (expect ≈ the 42 live-carry)  | stayed B: ${hpb.stayedB.length} (walls/undersized — unfreeze on the #11 deploy, not this migration)`);

console.log('\n=== QUARANTINE (never zeroed, never auto-promoted — pair skipped, legacy retained, CS triage; [C7-2] set must be 0 before commit) ===');
let quarTotal = 0;
for (const [k, arr] of Object.entries(QUAR)) { quarTotal += arr.length; console.log(`  ${k}: ${arr.length}`); arr.slice(0, 8).forEach(s => console.log('     ' + s)); }

console.log('\n=== HARD-ASSERT ACCEPTANCE ===');
const assertDefs = [
  ['A1 twi regressions == 0', ASSERT.twiRegressions],
  ['A2 csd regressions == 0', ASSERT.csdRegressions],
  ['A3 dual-enroll signature after == 0', ASSERT.dualSignatureAfter],
  ['A4 NOBODY moves H→B', ASSERT.hToB],
  ['A5 hand-patched (manual-pass) values SURVIVE', ASSERT.pSurvival],
  ['A6 N>1 review-only days pass on attempt evidence alone', ASSERT.reviewOnlyEvidence],
  ['A7 divergent max-csd survives own-anchor screen', ASSERT.divergentCsd],
  ['A8 zero pre-existing canonical docs (resolver wrote none)', ASSERT.preexistingCanonical],
];
let assertFailures = 0;
for (const [name, arr] of assertDefs) {
  console.log(`  ${arr.length === 0 ? '✓ PASS' : '✗ FAIL'} ${name}${arr.length ? ` — ${arr.length}` : ''}`);
  arr.slice(0, 6).forEach(s => console.log('       ' + s));
  assertFailures += arr.length ? 1 : 0;
}
console.log(`  invalidAnchor attempts (≈0 expected): ${invalidAnchorAttempts} across ${REPORT.invalidAnchorPairs.length} pairs`);
console.log(`  anchor promotions (twi raised to anchor): ${REPORT.anchorPromotions.length} | single-doc verbatim deviations: ${REPORT.singleDocDeviations.length}`);
console.log(`  csd passed only via calendar ceiling (gap≥2): ${REPORT.csdPassedOnlyByCalendar.length} | lineage testId-fallbacks used: ${lineageFallbacks}`);

// full report file (the --dry review artifact for David — local only, NOT a Firestore write)
mkdirSync(OUT_DIR, { recursive: true });
const reportPath = `${OUT_DIR}/list_progress_migration_${MODE}_${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(), mode: MODE, cohort: COHORT_LABEL, slack: SLACK, csdMode: CSD_MODE,
  migrationVersion: MIGRATION_VERSION, pairsInScope: pairs.length, populations: popCounts, actions: actionCounts,
  hpb: { before: hpb.before, after: hpb.after, leftB: hpb.leftB, stayedB: hpb.stayedB, moves: hpb.moves },
  asserts: Object.fromEntries(assertDefs.map(([n, a]) => [n, a])), quarantine: QUAR,
  invalidAnchorAttempts, lineageFallbacks, report: REPORT,
  pairs: records.map(({ _merged, _docs, _existing, ...pub }) => pub),
}, null, 2));
console.log(`\nfull per-student diff → ${reportPath}`);

// ───────────────────────────── COMMIT (guarded) ─────────────────────────────
if (MODE === 'commit') {
  if (assertFailures > 0 || quarTotal > 0) {
    console.error(`\nREFUSED TO WRITE: ${assertFailures} assert group(s) failing, quarantine=${quarTotal}.`);
    console.error('[C7-2] the quarantine set must be resolved to ZERO (CS triage) before the flip. Nothing was written.');
    process.exit(2);
  }
  guardWrite('commit pass');
  mkdirSync(BK_DIR, { recursive: true });
  let written = 0, stragglers = 0;
  for (const r of records) {
    if (!(r.action === 'MIGRATE' || r.action === 'MIGRATE_OVERWRITES_FOREIGN' || r.action === 'MERGE_STRAGGLER')) continue;
    // backup FIRST (all source docs + any pre-existing canonical) — restore path for the
    // pre-first-post-flip-completion window (FIX_PLAN v3 F4-4 honest reversibility)
    writeFileSync(`${BK_DIR}/${r.uid}_${r.listId}.json`, JSON.stringify({
      backedUpAt: new Date().toISOString(), uid: r.uid, listId: r.listId, action: r.action,
      sources: r._docs.map(s => ({ docId: s.docId, path: s.ref.path, data: s.raw })),
      existingCanonical: r._existing ? { path: r._existing.ref.path, data: r._existing.data } : null,
    }, null, 2));
    const batch = db.batch(); // atomic per pair: canonical set + legacy stamps land together
    const lpRef = db.collection('users').doc(r.uid).collection('list_progress').doc(r.listId);
    if (r.action === 'MERGE_STRAGGLER') {
      // canonical (ours) exists; merge the unstamped late doc(s) non-demotingly (max — the
      // anchor-validated merged values already include them; never demote the canonical)
      const ex = r._existing.data;
      batch.set(lpRef, { ...r._merged,
        currentStudyDay: Math.max(r._merged.currentStudyDay, ex.currentStudyDay || 0),
        totalWordsIntroduced: Math.max(r._merged.totalWordsIntroduced, ex.totalWordsIntroduced || 0),
      }, { merge: true });
      stragglers++;
    } else {
      batch.set(lpRef, r._merged);
    }
    for (const s of r._docs) {
      if (s.migratedAt != null && r.action !== 'MERGE_STRAGGLER') continue;
      batch.update(s.ref, { migratedAt: nowTs(), migratedTo: `list_progress/${r.listId}` }); // idempotency stamp [V8]
    }
    await batch.commit();
    written++;
    if (written % 100 === 0) console.log(`  …${written} pairs written`);
  }
  // post-write verification (read back a sample; full sweep/census re-run is the real X5 gate)
  let verified = 0, mismatched = 0;
  for (const r of records.filter(x => x.action.startsWith('MIGRATE')).slice(0, 25)) {
    const d = await db.collection('users').doc(r.uid).collection('list_progress').doc(r.listId).get();
    if (d.exists && d.data().totalWordsIntroduced === r.after.twi && d.data().currentStudyDay === r.after.csd) verified++;
    else { mismatched++; console.error(`  read-back MISMATCH ${short(r.uid)} ${short(r.listId)}`); }
  }
  console.log(`\nCOMMIT complete: ${written} canonical docs written (${stragglers} straggler merges) | read-back ${verified} ok / ${mismatched} mismatched`);
  console.log('Backups →', BK_DIR);
  console.log('\nNOW (X5 + FIX_PLAN P5 procedure):');
  console.log('  1. Flip the three-flag cutover (completeSession target → canonical; resolveListProgress');
  console.log('     write-capable; LIST_PROGRESS_CANONICAL) — one atomic server transition, separate deploy step.');
  console.log('  2. Re-run data-integrity-sweep + deepfix-census2 (list_progress-reworked versions — F6-3).');
  console.log('  3. WATCH window: day_guard_rejected / list_progress_quarantined / completion errors.');
  console.log('  4. Before the watch window closes: re-run with --catchup (post-flip legacy completions).');
  console.log('  5. SUPPORT_RUNBOOK CS entry + change_action_log row. Legacy docs RETAINED until P7.');
} else if (MODE === 'catchup') {
  // post-flip delta pass (persist §8 [C3-4]): stamped legacy docs a flag-off client advanced
  guardWrite('catch-up pass');
  // P5-1 fix: catch-up must obey the SAME fail-closed discipline as --commit. If the current
  // recomputation surfaces ANY failing assert or ANY quarantine, refuse to write — a late doc
  // could otherwise promote CSD/ancillary out of a pair whose current state quarantined.
  if (assertFailures > 0 || quarTotal > 0) {
    console.error(`\nREFUSED CATCH-UP: ${assertFailures} assert group(s) failing, quarantine=${quarTotal}.`);
    console.error('[C7-2] fail closed — resolve the quarantine set / asserts (CS triage) before catch-up. Nothing was written.');
    process.exit(2);
  }
  let merged = 0, skippedQuarantined = 0;
  for (const r of records) {
    if (!r._existing || r._existing.data?.migrationVersion !== MIGRATION_VERSION) continue;
    // NEVER merge late docs from a pair whose current recomputation quarantined or errored, or a
    // pair that is not a clean migration-owned action (P5-1).
    if (r.action === 'SKIP_QUARANTINE' || r.action === 'SKIP_ERROR' || (r.quarantine?.length)) { skippedQuarantined++; continue; }
    const canonMigratedAt = tsSec(r._existing.data.migratedAt) ?? 0;
    const late = r._docs.filter(s => s.migratedAt != null && s.lastSessionAtSec > canonMigratedAt);
    if (!late.length) continue;
    const ex = r._existing.data;
    const newer = late.slice().sort((a, b) => b.lastSessionAtSec - a.lastSessionAtSec)[0];
    // recentSessions union-by-day (newer doc's entry wins), position via non-demoting anchor-validated max
    const byDay = new Map((ex.recentSessions || []).map(s => [s.day, s]));
    (newer.raw.recentSessions || []).forEach(s => byDay.set(s.day, s));
    const anchorCappedTwi = r.anchor ? Math.min(Math.max(...late.map(s => s.twi)), r.anchor.twi) : 0;
    await r._existing.ref.set({
      currentStudyDay: Math.max(ex.currentStudyDay || 0, ...late.map(s => s.csd)),
      totalWordsIntroduced: Math.max(ex.totalWordsIntroduced || 0, anchorCappedTwi),
      recentSessions: [...byDay.values()].sort((a, b) => (a.day || 0) - (b.day || 0)).slice(-30),
      interventionLevel: newer.raw.interventionLevel ?? ex.interventionLevel ?? 0,
      streakDays: newer.raw.streakDays ?? ex.streakDays ?? 0,
      lastStudyDate: newer.raw.lastStudyDate ?? ex.lastStudyDate ?? null,
      lastSessionAt: admin.firestore.Timestamp.fromMillis(newer.lastSessionAtSec * 1000),
      updatedAt: nowTs(), migratedAt: nowTs(),
    }, { merge: true });
    for (const s of late) await s.ref.update({ migratedAt: nowTs() });
    merged++;
    console.log(`  catch-up ${short(r.uid)} ${short(r.listId)}: ${late.length} late legacy doc(s) merged`);
  }
  console.log(`\nCATCH-UP complete: ${merged} pairs delta-merged (ancillary union + non-demoting position); ${skippedQuarantined} pairs skipped (quarantined/errored — legacy retained for CS triage).`);
} else {
  console.log(`\n[DRY] NO Firestore writes were made (write guard active). ${DRY_BACKUP ? 'Local backups written on request.' : ''}`);
  if (DRY_BACKUP) {
    mkdirSync(BK_DIR, { recursive: true });
    for (const r of records.filter(x => x._docs)) writeFileSync(`${BK_DIR}/${r.uid}_${r.listId}.json`, JSON.stringify({
      backedUpAt: new Date().toISOString(), uid: r.uid, listId: r.listId, dryRun: true,
      sources: r._docs.map(s => ({ docId: s.docId, path: s.ref.path, data: s.raw })),
      existingCanonical: r._existing ? { path: r._existing.ref.path, data: r._existing.data } : null }, null, 2));
    console.log(`local backups → ${BK_DIR}`);
  }
  console.log('Next (FIX_PLAN P5 procedure): fresh Phase-0 audit re-run → David reviews this diff →');
  console.log('25WT rehearsal → SUPPORT_RUNBOOK authorization → --commit --confirm-migrate=' + COHORT_LABEL + ' (OFF-PEAK).');
}
// P5-3 fix: the commit precondition is asserts-pass AND quarantine=0 — the exit code must reflect
// BOTH, not just asserts. --diagnostic-only lets an inspector force exit 0 with quarantine present.
const notReady = assertFailures > 0 || quarTotal > 0;
console.log(`\nFINAL: ${notReady ? 'NOT_READY' : 'READY'} asserts_failing=${assertFailures} quarantine=${quarTotal}`
  + (notReady && DIAGNOSTIC_ONLY ? ' (--diagnostic-only: exit forced 0 for inspection)' : ''));
process.exit(notReady && !DIAGNOSTIC_ONLY ? 2 : 0);
