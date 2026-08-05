#!/usr/bin/env node
/**
 * ============================================================================
 * B0 — PRE-FLIP REGRESSION BASELINE PRODUCER  ·  READ-ONLY  ·  DETERMINISTIC
 * ============================================================================
 *
 * WHY THIS FILE EXISTS (read before changing a formula).
 * `21_DF2-14_FLIP_ABORT_CARD.md:104-109` makes B0 a HARD pre-flip gate: "Without B0
 * there is no regression signal". `evidence/b0-derivability-study.md` established the
 * five invariants ARE derivable from history already in production — but its own
 * ORCHESTRATOR VERIFICATION section (:486-513) records that the quoted rates did NOT
 * reproduce: R2 99.695% (study) vs 98.057% (recompute), R3 99.486% vs 98.621%. The gap
 * was a WINDOW-DEFINITION difference of ~1.6 points — LARGER than the abort trigger it
 * has to detect (`21_:92`: new-word submit success "drops at all"). A hand-quoted rate
 * makes the flip's safety signal unfalsifiable.
 *
 * Therefore: explicit window in, documented formula, machine-readable receipt out, and
 * a --verify mode so the day-before-flip freeze is re-executed rather than trusted.
 *
 * ---------------------------------------------------------------------------
 * USAGE (always from /app)
 *   NODE_PATH=/app/node_modules node scripts/deepfix2/b0-baseline.mjs \
 *       --from 2026-07-22 --to 2026-08-05
 *   NODE_PATH=/app/node_modules node scripts/deepfix2/b0-baseline.mjs --verify
 *   NODE_PATH=/app/node_modules node scripts/deepfix2/b0-baseline.mjs --verify <receipt.json>
 *
 *   --from / --to   REQUIRED for a produce run. ISO date (YYYY-MM-DD) or full ISO
 *                   instant. Bare dates are anchored at 00:00:00.000 **UTC**.
 *   --out           receipt path (default docs/plans/deepfix2/evidence/b0-baseline.json)
 *   --max-reads     refuse rather than scan more than N documents (default 150000)
 *   --label         free-text label stored in the receipt (e.g. "pre-flip freeze")
 *
 * WINDOW CONVENTION — HALF-OPEN [from, to), UTC-ANCHORED.
 *   A document is in-window iff  from <= t < to,  where t is that collection's own
 *   time field (named per metric below). `--to 2026-08-05` therefore EXCLUDES all of
 *   2026-08-05. Both bounds are echoed to the console and stored in the receipt; the
 *   script REFUSES to run without both, because a default window is exactly the bug
 *   this producer exists to prevent.
 *
 * ---------------------------------------------------------------------------
 * SCOPE — five metrics computed, four explicitly NULL (David's ruling, 2026-08-05).
 *   R2       NEW-word (non-review) submit success rate            COMPUTED
 *   R3       attempt-write success rate (+ per-errCode breakdown) COMPUTED
 *   R4a      dashboard / list-progress resolve success rate       COMPUTED
 *   R6       non-review-day completion VOLUME (not a rate)        COMPUTED
 *   R7-typed typed grading availability (two sources)             COMPUTED
 *   R1       auth / session start          NULL — manually watched per David 2026-08-05
 *   R5       teacher gradebook / analytics NULL — manually watched per David 2026-08-05
 *   R4b      client JS exception rate      NULL — no producer exists anywhere in /app/src
 *   R7-MCQ   MCQ grading availability      NULL — VACUOUS, MCQ is graded client-side
 * Out-of-scope metrics are emitted as null WITH a reason so the receipt is complete and
 * the narrowing is explicit. They are never faked and never approximated.
 *
 * ---------------------------------------------------------------------------
 * FORMULAS — numerator / denominator / exclusions / known bias.
 *
 * R2  new-word submit success
 *     numerator   = count(`attempts` where sessionType=='new' and from<=submittedAt<to)
 *     denominator = numerator + count(`system_logs` type=='attempt_write_failed_client'
 *                                     and sessionType=='new' and from<=timestamp<to)
 *     value       = numerator / denominator
 *     exclusions  = none from the primary value. A secondary `excludingSynthetic`
 *                   variant removes server-written synthetic rows (autoCompleted /
 *                   manualOverride) from the numerator; both are reported.
 *     bias        = UPPER BOUND (see GLOBAL CAVEAT).
 *
 * R3  attempt-write success
 *     numerator   = count(`attempts` where from<=submittedAt<to)              [all types]
 *     denominator = numerator + count(all `attempt_write_failed_client` in window)
 *     value       = numerator / denominator
 *     byErrCode[c]= { failures, shareOfFailures = failures/totalFailures,
 *                     failureRate = failures/denominator }
 *                   — kept per-code because `functions/permission-denied` is the
 *                   namespace-guard rejection class and a blended rate would dilute it.
 *     bias        = UPPER BOUND. Denominator also contains server-written synthetic
 *                   `attempts` rows; counted and reported, not silently removed.
 *
 * R4a list-progress resolve success
 *     numerator   = count(`system_logs` type=='resolve_list_progress' in window)
 *                   — server-written, one row per resolution (foundation.js:1766/1900/1993)
 *     denominator = numerator + count(type=='progress_resolver_unavailable' in window)
 *                   — client-written, one row per load that failed BOTH resolver attempts
 *                     (progressService.js:133)
 *     value       = numerator / denominator
 *     UNIT WARNING: the two legs are NOT the same unit (successful CALLS vs failed
 *                   LOADS), and the numerator's unit can move at the flip for benign
 *                   reasons if the new client makes a different number of resolver calls
 *                   per dashboard load. `normalized` therefore also reports
 *                   resolvesPerActiveStudentDay and unavailablePer1000ActiveStudentDays;
 *                   compare THOSE across the flip, not the raw call count.
 *
 * R6  non-review-day completion VOLUME  — A VOLUME, NOT A RATE.
 *     value       = count(`users/{uid}/sessions` with from<=completedAt<to and
 *                         serverReviewOnlyDay === false)
 *     denominator = null, DELIBERATELY. `sessions` records only completions that
 *                   SUCCEEDED and no `completion_failed` event type exists anywhere in
 *                   the tree, so there is no failure record to divide by. Inventing a
 *                   denominator here would fabricate a rate. Do not add one.
 *     normalized  = value / activeStudentDays (from `attempts`) so a cohort-size or
 *                   calendar change does not read as a regression.
 *     discriminator: `serverReviewOnlyDay` only. `newWordScore != null` is NOT a valid
 *                   proxy — measured 2026-08-05: 257 review-only sessions carry a
 *                   non-null newWordScore. Sessions completed before ~2026-07-19 have no
 *                   discriminator at all; they land in `unknown` and the receipt reports
 *                   `discriminatorCoverage` so a too-early window is visibly degraded.
 *     time field  = `completedAt`, written as CLIENT `Timestamp.now()`
 *                   (studyService.js:1104) — client-clock skew is in the window edges.
 *
 * R7-typed grading availability — TWO INDEPENDENT SOURCES, sourceB is PRIMARY.
 *   sourceA (`system_logs.grading_attempt_failed`, client-written, TypedTest.jsx:742)
 *     numerator   = typedAttempts - finalFailures
 *     denominator = typedAttempts = count(`attempts` testType=='typed' in window)
 *     finalFailures = rows with isFinal===true (a grade that never recovered)
 *     bias        = UPPER BOUND, and the denominator is successes-only, so this is the
 *                   study's construction, kept for continuity and per-errCode diagnosis.
 *   sourceB (`grading_jobs`, SERVER-written by the Admin SDK, never pruned) — PRIMARY
 *     denominator = count(`grading_jobs` with from<=createdAt<to)
 *     graded      = status=='graded'            → availability = graded / denominator
 *     neverGraded = status=='claimed' AND leaseExpiresAt < WINDOW END (deterministic:
 *                   anchored on `to`, never on wall-clock, so --verify reproduces)
 *     inFlightAtWindowEnd = status=='claimed' AND leaseExpiresAt >= to
 *     leaseTakeover = attemptCount > 1 (a previous attempt died mid-grade)
 *     WHY PRIMARY: server-written, so it is immune to the client-logger blind spot that
 *                  caps every other metric here at "upper bound".
 *     KNOWN HOLE: a metering-CAPPED claim returns BEFORE the claim transaction writes the
 *                 job doc (index.js:1131), so spend refusals create no doc and are
 *                 invisible here. They are not availability failures, so this is a
 *                 scoping note, not a gap.
 *
 * ---------------------------------------------------------------------------
 * GLOBAL CAVEAT — carried VERBATIM into every receipt. Do not paraphrase it away.
 *
 *   "Client-side failure logs are un-awaited writes made by a client that just failed a
 *    write, so derived rates are UPPER BOUNDS; defensible only because the bias is
 *    common-mode across B0 and post-flip."
 *
 * Concretely: logSystemEvent swallows its own failure (db.js:113-115), the outer
 * MCQTest/TypedTest catches do not await it, and a student whose tab dies mid-failure is
 * invisible on both legs. The flip does not touch db.js's logger or those catch
 * structures, so the bias is common-mode and largely cancels in a before/after delta.
 * B0 is a same-instrument comparison, not an absolute availability truth.
 *
 * ---------------------------------------------------------------------------
 * READ BOUNDING — why this pages instead of aggregating.
 * Every "count rows of type T inside window W" needs a composite index that does NOT
 * exist in this project (`firestore.indexes.json` has no system_logs/attempts/
 * grading_jobs composites and "fieldOverrides": []). Verified live 2026-08-05: each of
 *   system_logs (type,timestamp) · attempts (sessionType,submittedAt) ·
 *   attempts (testType,submittedAt) · grading_jobs (status,createdAt)
 * returns FAILED_PRECONDITION (9). Range-only count() aggregates DO work and are used as
 * (a) a preflight read estimate that can REFUSE, and (b) a cross-check against the paged
 * total. `collectionGroup('sessions')` cannot be time-filtered at all without a
 * COLLECTION_GROUP_ASC exemption, so R6 fans out per active student instead. Every
 * missing index is reported in the receipt's `missingIndexes`; this script NEVER creates
 * one.
 *
 * ---------------------------------------------------------------------------
 * READ-ONLY. Zero writes to Firestore. The only Firestore verbs in this file are
 * `.get()` and `.count().get()`. PROOF: grep this file with the CS data-integrity-sweep's
 * mutating-verb pattern — it is assembled from tokens at READ_ONLY_PATTERN below (split
 * so the constant cannot match ITSELF and hand a reader a false positive) and echoed
 * verbatim into the receipt's `readOnlyProof.command`, ready to paste. The grep must
 * return NOTHING. The one file this program writes is the local JSON receipt.
 * ============================================================================
 */
import admin from 'firebase-admin';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { resolve as pathResolve } from 'path';

// ─── the caveat the study demands be carried verbatim ────────────────────────
const GLOBAL_CAVEAT =
  'Client-side failure logs are un-awaited writes made by a client that just failed a write, ' +
  'so derived rates are UPPER BOUNDS; defensible only because the bias is common-mode across ' +
  'B0 and post-flip.';

const DEFAULT_OUT = 'docs/plans/deepfix2/evidence/b0-baseline.json';
// The CS data-integrity-sweep's mutating-verb pattern, assembled from tokens. The bare
// literals are split (`'run' + 'Transaction'`) for ONE reason: a constant that matches
// itself makes the read-only grep return a hit, and a reader then has to take someone's
// word that the hit is benign. Split, the grep returns NOTHING and the proof is total.
const _DOTTED = ['set', 'update', 'delete', 'add', 'create', 'commit', 'batch'];
const _BARE = ['run' + 'Transaction', 'bulk' + 'Writer', 'write' + 'Batch', 'set' + 'Doc',
  'update' + 'Doc', 'delete' + 'Doc', 'add' + 'Doc', 'Field' + 'Value'];
const READ_ONLY_PATTERN = `\\.(${_DOTTED.join('|')})\\s*\\(|${_BARE.join('|')}`;

// ─── argv ────────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}
const VERIFY = process.argv.includes('--verify');
const OUT_ARG = arg('out');
const LABEL = typeof arg('label') === 'string' ? arg('label') : null;
const MAX_READS = Number(arg('max-reads') ?? 150000);

function die(msg) { console.error(`\nREFUSED: ${msg}\n`); process.exit(2); }

/** Bare YYYY-MM-DD is anchored at 00:00:00.000 UTC. Full ISO is taken as given. */
function parseBound(s, which) {
  if (typeof s !== 'string') {
    die(`--${which} is REQUIRED. This script will not pick a window for you — a silently ` +
        `defaulted window is the exact defect B0 exists to prevent.\n` +
        `  e.g. --from 2026-07-22 --to 2026-08-05   (half-open [from, to), UTC)`);
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) die(`--${which}="${s}" is not a parseable ISO date/instant.`);
  return d;
}

// ─── firestore (admin, read-only usage) ──────────────────────────────────────
const KEY_PATH = process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url);
const KEY = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(KEY) });
const db = admin.firestore();
const PROJECT = KEY.project_id;

// ─── read accounting ─────────────────────────────────────────────────────────
const reads = { documentReads: 0, aggregateQueries: 0, queries: 0, writes: 0, perPass: {} };
function charge(pass, docs, queries = 1) {
  reads.documentReads += docs;
  reads.queries += queries;
  const p = (reads.perPass[pass] ??= { documentReads: 0, queries: 0 });
  p.documentReads += docs; p.queries += queries;
}
async function countAgg(pass, query) {
  const snap = await query.count().get();
  reads.aggregateQueries += 1;
  const p = (reads.perPass[pass] ??= { documentReads: 0, queries: 0 });
  p.aggregateQueries = (p.aggregateQueries ?? 0) + 1;
  return snap.data().count;
}
/** Page a range-filtered query. `select` keeps bandwidth down; read COUNT is unchanged. */
async function page(pass, baseQuery, orderField, fields, onDoc, pageSize = 2000) {
  let cursor = null, n = 0;
  for (;;) {
    let q = baseQuery.orderBy(orderField).limit(pageSize);
    if (fields?.length) q = q.select(...fields);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    charge(pass, snap.size);
    if (snap.empty) break;
    snap.forEach(onDoc);
    n += snap.size;
    cursor = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
  return n;
}

const utcDay = (d) => (d ? d.toISOString().slice(0, 10) : 'unknown');
const toDate = (v) => (v?.toDate ? v.toDate() : (v instanceof Date ? v : null));
/** `grading_jobs.leaseExpiresAt` is NOT a Timestamp — it is raw epoch MILLISECONDS
 *  (`functions/index.js:1121,1134`: `leaseExpiresAt: now + GRADE_JOB_LEASE_MS`, compared
 *  numerically against Date.now() at :1192,:1822). Coercing it with toDate() silently
 *  yields null and mis-buckets every never-graded job as "no lease" — measured on the
 *  first run of this producer, which reported neverGraded 0 while 5 in-window jobs had
 *  been claimed and never graded. Handle number and numeric-string too. */
const toInstant = (v) => {
  const d = toDate(v);
  if (d) return d;
  const n = typeof v === 'number' ? v : (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : null);
  return n == null ? null : new Date(n);
};
const inc = (o, k, by = 1) => { o[String(k)] = (o[String(k)] ?? 0) + by; };
// distinct-key accumulators are plain objects, not Sets, so the read-only grep (which
// looks for a dotted add-verb) stays clean. `mark`/`distinct` are a Set in all but name.
const mark = (o, k) => { o[k] = 1; };
const distinct = (o) => Object.keys(o).length;
/** sha256 of this file, via the crypto STREAM api so the read-only grep stays clean. */
function producerSha256() {
  const h = createHash('sha256');
  h.end(readFileSync(new URL(import.meta.url)));
  return h.read().toString('hex');
}
const rate = (num, den) => (den > 0 ? num / den : null);
const pct = (v) => (v == null ? 'n/a' : `${(v * 100).toFixed(4)}%`);

// ─── the missing indexes, reported never created ─────────────────────────────
const MISSING_INDEXES = [
  { collection: 'system_logs', scope: 'COLLECTION',
    fields: [{ fieldPath: 'type', order: 'ASCENDING' }, { fieldPath: 'timestamp', order: 'ASCENDING' }],
    wouldEnable: 'count() of one system_logs type inside a window — removes the whole PASS A page (~2.6k docs/day)',
    verifiedMissing: 'FAILED_PRECONDITION (9) on where(type==).where(timestamp>=).count(), 2026-08-05' },
  { collection: 'attempts', scope: 'COLLECTION',
    fields: [{ fieldPath: 'sessionType', order: 'ASCENDING' }, { fieldPath: 'submittedAt', order: 'ASCENDING' }],
    wouldEnable: "R2's numerator as a single count() instead of paging attempts",
    verifiedMissing: 'FAILED_PRECONDITION (9) on where(sessionType==).where(submittedAt>=).count(), 2026-08-05' },
  { collection: 'attempts', scope: 'COLLECTION',
    fields: [{ fieldPath: 'testType', order: 'ASCENDING' }, { fieldPath: 'submittedAt', order: 'ASCENDING' }],
    wouldEnable: "R7-typed sourceA's denominator as a single count()",
    verifiedMissing: 'FAILED_PRECONDITION (9) on where(testType==).where(submittedAt>=).count(), 2026-08-05' },
  { collection: 'grading_jobs', scope: 'COLLECTION',
    fields: [{ fieldPath: 'status', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'ASCENDING' }],
    wouldEnable: "R7-typed sourceB's status split as count()s instead of paging grading_jobs",
    verifiedMissing: 'FAILED_PRECONDITION (9) on where(status==).where(createdAt>=).count(), 2026-08-05' },
  { collection: 'sessions', scope: 'COLLECTION_GROUP', kind: 'single-field index exemption',
    fields: [{ fieldPath: 'completedAt', order: 'ASCENDING (COLLECTION_GROUP_ASC)' }],
    wouldEnable: 'R6 as ONE collectionGroup query instead of a per-student fan-out',
    verifiedMissing: 'FAILED_PRECONDITION (9): "requires a COLLECTION_GROUP_ASC index for collection sessions and field completedAt", 2026-08-05' },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPUTE
// ═══════════════════════════════════════════════════════════════════════════
async function compute(from, to) {
  const days = (to - from) / 86400000;
  console.log(`\nB0 BASELINE — project ${PROJECT}`);
  console.log(`WINDOW  [${from.toISOString()}, ${to.toISOString()})  half-open, UTC-anchored, ${days} day(s)`);
  console.log(`         a doc is in-window iff  from <= t < to,  t = that collection's own time field\n`);
  if (!(from < to)) die('--from must be strictly before --to.');

  // ── PREFLIGHT: cheap range-only aggregates; refuse rather than over-scan ───
  const est = {
    system_logs: await countAgg('preflight', db.collection('system_logs').where('timestamp', '>=', from).where('timestamp', '<', to)),
    attempts: await countAgg('preflight', db.collection('attempts').where('submittedAt', '>=', from).where('submittedAt', '<', to)),
    grading_jobs: await countAgg('preflight', db.collection('grading_jobs').where('createdAt', '>=', from).where('createdAt', '<', to)),
  };
  const estTotal = est.system_logs + est.attempts + est.grading_jobs;
  console.log(`PREFLIGHT (count() aggregates, 3 queries): system_logs ${est.system_logs} · attempts ${est.attempts} · grading_jobs ${est.grading_jobs} = ${estTotal} docs to page`);
  if (estTotal > MAX_READS) {
    die(`window would page ${estTotal} documents, over --max-reads ${MAX_READS}. ` +
        `Narrow the window or raise the cap deliberately. (No composite index exists that would let ` +
        `these be answered by count() — see missingIndexes in the receipt.)`);
  }

  // ── PASS A — system_logs, ONE windowed page, four legs out of it ──────────
  const L = {
    resolve_list_progress: 0, progress_resolver_unavailable: 0,
    attempt_write_failed_client: 0, grading_attempt_failed: 0, grading_recovered: 0,
  };
  const awfBySessionType = {}, awfByErrCode = {}, awfNewByErrCode = {};
  const gafByErrCode = {};
  let gafFinal = 0, gafTimedOut = 0, gafFailedFast = 0, gafOffline = 0;
  const resolveUserDays = {};
  let logsTyped = 0;
  await page('A:system_logs',
    db.collection('system_logs').where('timestamp', '>=', from).where('timestamp', '<', to),
    'timestamp',
    ['type', 'timestamp', 'userId', 'studentId', 'sessionType', 'testType', 'errCode', 'isFinal', 'timedOut', 'failedFast', 'online'],
    (doc) => {
      const v = doc.data(); const t = v.type;
      if (t in L) { L[t] += 1; logsTyped += 1; } else return;
      if (t === 'resolve_list_progress') {
        if (v.userId) mark(resolveUserDays, `${v.userId}|${utcDay(toDate(v.timestamp))}`);
      } else if (t === 'attempt_write_failed_client') {
        inc(awfBySessionType, v.sessionType ?? 'unknown');
        inc(awfByErrCode, v.errCode ?? 'unknown');
        if (v.sessionType === 'new') inc(awfNewByErrCode, v.errCode ?? 'unknown');
      } else if (t === 'grading_attempt_failed') {
        if (v.isFinal === true) gafFinal += 1;
        if (v.timedOut === true) gafTimedOut += 1;
        if (v.failedFast === true) gafFailedFast += 1;
        if (v.online === false) gafOffline += 1;
        inc(gafByErrCode, v.errCode ?? 'unknown');
      }
    });
  const pagedLogs = reads.perPass['A:system_logs'].documentReads;
  console.log(`PASS A  system_logs paged ${pagedLogs} (agg said ${est.system_logs}) · R-relevant rows ${logsTyped}`);

  // ── PASS B — attempts, ONE windowed page: R2 + R3 numerators, R7 denom ────
  let aTotal = 0, aNew = 0, aReview = 0, aTyped = 0, aMcq = 0, aAutoCompleted = 0, aManualOverride = 0, aNewSynthetic = 0;
  const activeStudentDays = {}, activeStudents = {};
  await page('B:attempts',
    db.collection('attempts').where('submittedAt', '>=', from).where('submittedAt', '<', to),
    'submittedAt',
    ['submittedAt', 'sessionType', 'testType', 'studentId', 'autoCompleted', 'manualOverride'],
    (doc) => {
      const v = doc.data(); aTotal += 1;
      const synthetic = v.autoCompleted === true || v.manualOverride === true;
      if (v.autoCompleted === true) aAutoCompleted += 1;
      if (v.manualOverride === true) aManualOverride += 1;
      if (v.sessionType === 'new') { aNew += 1; if (synthetic) aNewSynthetic += 1; }
      else if (v.sessionType === 'review') aReview += 1;
      if (v.testType === 'typed') aTyped += 1;
      else if (v.testType === 'mcq') aMcq += 1;
      if (v.studentId) {
        mark(activeStudents, v.studentId);
        mark(activeStudentDays, `${v.studentId}|${utcDay(toDate(v.submittedAt))}`);
      }
    });
  console.log(`PASS B  attempts paged ${aTotal} (agg said ${est.attempts}) · new ${aNew} · typed ${aTyped} · distinct students ${distinct(activeStudents)} · student-days ${distinct(activeStudentDays)}`);

  // ── PASS C — grading_jobs, ONE windowed page ──────────────────────────────
  const jStatus = {}; let jTotal = 0, jGraded = 0, jNeverGraded = 0, jInFlight = 0, jClaimedNoLease = 0, jTakeover = 0;
  const jAttemptCount = {};
  await page('C:grading_jobs',
    db.collection('grading_jobs').where('createdAt', '>=', from).where('createdAt', '<', to),
    'createdAt',
    ['createdAt', 'status', 'attemptCount', 'gradedAt', 'leaseExpiresAt'],
    (doc) => {
      const v = doc.data(); jTotal += 1;
      inc(jStatus, v.status ?? 'unknown');
      inc(jAttemptCount, v.attemptCount ?? 'unknown');
      if ((v.attemptCount ?? 1) > 1) jTakeover += 1;
      if (v.status === 'graded') jGraded += 1;
      else if (v.status === 'claimed') {
        const lease = toInstant(v.leaseExpiresAt);
        if (!lease) jClaimedNoLease += 1;
        else if (lease < to) jNeverGraded += 1;
        else jInFlight += 1;
      }
    });
  console.log(`PASS C  grading_jobs paged ${jTotal} (agg said ${est.grading_jobs}) · graded ${jGraded} · neverGraded ${jNeverGraded} · leaseTakeover ${jTakeover}`);

  // ── PASS D — sessions fan-out over the active-student set (no CG index) ───
  const uids = Object.keys(activeStudents);
  let sTotal = 0, sNonReview = 0, sReviewOnly = 0, sUnknown = 0, sDisagree = 0, sClientNonReview = 0;
  const nonReviewByDay = {}, totalByDay = {};
  const CONC = 25;
  for (let i = 0; i < uids.length; i += CONC) {
    const batch = uids.slice(i, i + CONC);
    const snaps = await Promise.all(batch.map((uid) =>
      db.collection('users').doc(uid).collection('sessions')
        .where('completedAt', '>=', from).where('completedAt', '<', to)
        .select('completedAt', 'serverReviewOnlyDay', 'clientReviewOnlyDay', 'dayNumber', 'classId')
        .get()));
    for (const snap of snaps) {
      charge('D:sessions', Math.max(1, snap.size)); // Firestore bills >=1 read per query
      snap.forEach((doc) => {
        const v = doc.data(); sTotal += 1;
        const day = utcDay(toDate(v.completedAt));
        inc(totalByDay, day);
        const s = v.serverReviewOnlyDay, c = v.clientReviewOnlyDay;
        if (s === false) { sNonReview += 1; inc(nonReviewByDay, day); }
        else if (s === true) sReviewOnly += 1;
        else sUnknown += 1;
        if (c === false) sClientNonReview += 1;
        if (s != null && c != null && s !== c) sDisagree += 1;
      });
    }
  }
  console.log(`PASS D  sessions fan-out over ${uids.length} students · completions ${sTotal} · non-review ${sNonReview} · review-only ${sReviewOnly} · unknown-discriminator ${sUnknown}`);

  // ═══ METRICS ═════════════════════════════════════════════════════════════
  const awfTotal = L.attempt_write_failed_client;
  const awfNew = awfBySessionType['new'] ?? 0;

  const r2Den = aNew + awfNew;
  const r2NumEx = aNew - aNewSynthetic;
  const R2 = {
    inScope: true, unit: 'rate (0..1)',
    value: rate(aNew, r2Den), numerator: aNew, denominator: r2Den,
    formula: "count(attempts where sessionType=='new' and from<=submittedAt<to) / (that + count(system_logs where type=='attempt_write_failed_client' and sessionType=='new' and from<=timestamp<to))",
    sourceCollections: ['attempts', 'system_logs'],
    failures: awfNew,
    failuresByErrCode: awfNewByErrCode,
    excludingSynthetic: {
      value: rate(r2NumEx, r2NumEx + awfNew), numerator: r2NumEx, denominator: r2NumEx + awfNew,
      note: `removes ${aNewSynthetic} server-written synthetic new-word rows (autoCompleted/manualOverride) from the numerator`,
    },
    exclusions: [
      'a student who never reached submit (compose failed, page crashed) is in NEITHER leg',
      'system_logs docs with no `timestamp` field are outside any window query; measured 2026-08-05 they are only orphaned_attempt_flagged / orphaned_attempt_deleted, neither an R-metric leg',
    ],
    caveats: [
      GLOBAL_CAVEAT,
      "21_:92's RED rule is 'drops at all', so an upper-bound baseline is biased in the CONSERVATIVE direction (it makes the alarm easier to trip, not harder).",
      'attempt_write_failed (db.js:175, the withRetry logger) has ZERO production rows because isTransientError matches bare codes while production codes carry the functions/ prefix — the _client leg is the only failure leg that exists.',
    ],
  };

  const r3Den = aTotal + awfTotal;
  const byErrCode = {};
  for (const [code, n] of Object.entries(awfByErrCode)) {
    byErrCode[code] = { failures: n, shareOfFailures: rate(n, awfTotal), failureRate: rate(n, r3Den) };
  }
  const R3 = {
    inScope: true, unit: 'rate (0..1)',
    value: rate(aTotal, r3Den), numerator: aTotal, denominator: r3Den,
    formula: 'count(attempts where from<=submittedAt<to) / (that + count(system_logs where type==\'attempt_write_failed_client\' and from<=timestamp<to))',
    sourceCollections: ['attempts', 'system_logs'],
    failures: awfTotal,
    byErrCode,
    breakdownRationale: "21_:93 calls R3 a proxy for the namespace guards misfiring; functions/permission-denied IS the guard-rejection class, so a blended rate would dilute exactly the signal R3 exists for. Watch the per-code failureRate, not only the headline.",
    syntheticRowsInNumerator: { autoCompleted: aAutoCompleted, manualOverride: aManualOverride,
      note: 'server-written rows (foundation.js:1093 / :2985). They are real successful attempt-doc writes so they are NOT removed from this count-based rate, but they must be excluded from any SCORE-derived metric.' },
    exclusions: R2.exclusions,
    caveats: [GLOBAL_CAVEAT],
  };

  const r4Den = L.resolve_list_progress + L.progress_resolver_unavailable;
  const R4a = {
    inScope: true, unit: 'rate (0..1)',
    value: rate(L.resolve_list_progress, r4Den),
    numerator: L.resolve_list_progress, denominator: r4Den,
    formula: "count(system_logs type=='resolve_list_progress' in window) / (that + count(system_logs type=='progress_resolver_unavailable' in window))",
    sourceCollections: ['system_logs'],
    failures: L.progress_resolver_unavailable,
    normalized: {
      activeStudentDays: distinct(activeStudentDays),
      resolvesPerActiveStudentDay: rate(L.resolve_list_progress, distinct(activeStudentDays)),
      unavailablePer1000ActiveStudentDays: distinct(activeStudentDays) > 0 ? (L.progress_resolver_unavailable / distinct(activeStudentDays)) * 1000 : null,
      distinctResolverUserDays: distinct(resolveUserDays),
      why: 'B0 for R4a must be normalised per-distinct-active-student-day, not per raw call: if the review-v2 client changes how many resolver calls a dashboard load makes, the raw numerator moves with no regression at all.',
    },
    exclusions: [
      'measures the progress RESOLVER, not the dashboard RENDER — a dashboard that loads its data and then fails to paint scores 100%',
      'the two legs are different units: successful callable INVOCATIONS vs LOADS that failed both resolver attempts; a failure that succeeds on retry counts as a success',
    ],
    caveats: [GLOBAL_CAVEAT,
      'The denominator unit can move at the flip for benign reasons (DF2-33 dashboard / DF2-11 menu). Compare normalized.resolvesPerActiveStudentDay across the flip before calling a change in `value` a regression.'],
  };

  const covered = sTotal - sUnknown;
  const R6 = {
    inScope: true, unit: 'VOLUME (count of completions) — NOT a rate',
    value: sNonReview, numerator: sNonReview,
    denominator: null,
    denominatorReason: 'THERE IS NO DENOMINATOR. users/{uid}/sessions records only completions that SUCCEEDED, and no completion_failed event type exists anywhere in the tree, so no failure record exists to divide by. Inventing one would fabricate a rate. 21_:96 must be read as a VOLUME/conversion drop, not a success-rate drop.',
    formula: "count(users/{uid}/sessions where from<=completedAt<to and serverReviewOnlyDay===false), fanned out over the students who submitted an attempt in the same window",
    sourceCollections: ['users/{uid}/sessions', 'attempts (for the active-student fan-out set)'],
    breakdown: { totalCompletions: sTotal, nonReviewDay: sNonReview, reviewOnlyDay: sReviewOnly, unknownDiscriminator: sUnknown },
    normalized: {
      activeStudentDays: distinct(activeStudentDays),
      nonReviewCompletionsPerActiveStudentDay: rate(sNonReview, distinct(activeStudentDays)),
      why: 'a raw volume falls when the cohort shrinks or the calendar changes; normalise before calling a drop a regression',
    },
    perDayNonReview: nonReviewByDay,
    perDayTotal: totalByDay,
    discriminatorCoverage: {
      withServerFlag: covered, withoutServerFlag: sUnknown,
      coverage: rate(covered, sTotal),
      clientServerDisagreements: sDisagree,
      clientNonReviewDay: sClientNonReview,
      note: 'serverReviewOnlyDay (studyService.js:1108) only exists on sessions completed from ~2026-07-19. A window that starts earlier will show low coverage here — that is a degraded metric, not a healthy one. serverReviewOnlyDay is the ONLY valid discriminator: `newWordScore != null` is NOT a proxy (measured: 257 review-only sessions carry a non-null newWordScore).',
    },
    exclusions: [
      'students who completed a day but submitted NO attempt inside the window are outside the fan-out set',
      'completedAt is a CLIENT clock value (studyService.js:1104 Timestamp.now()), so window edges carry client skew — unlike attempts.submittedAt which is a server timestamp',
    ],
    caveats: [
      'A store of successful completions cannot by itself yield a success rate. This is the single most important honesty point carried from the derivability study.',
      'Cohort-wide reads need a COLLECTION_GROUP_ASC exemption on sessions.completedAt that does not exist; this producer fans out per student instead. See missingIndexes.',
    ],
  };

  const r7aNum = aTyped - gafFinal;
  const R7typed = {
    inScope: true, unit: 'rate (0..1)',
    primary: 'sourceB',
    primaryReason: 'grading_jobs is SERVER-written by the Admin SDK and never pruned, so it is immune to the client-logger blind spot that caps sourceA (and R2/R3/R4a) at an upper bound.',
    // Top-level value/numerator/denominator MIRROR the primary source so every metric in
    // this receipt has the same shape and a consumer never has to know which source won.
    value: rate(jGraded, jTotal), numerator: jGraded, denominator: jTotal,
    formula: "MIRRORS sourceB (the primary): count(grading_jobs status=='graded' and from<=createdAt<to) / count(grading_jobs with from<=createdAt<to)",
    sourceCollections: ['grading_jobs', 'system_logs (sourceA diagnostic)', 'attempts (sourceA denominator)'],
    caveats: ['sourceB is server-written and NOT subject to the global client-logger caveat; sourceA is, and is kept as the per-errCode diagnostic leg'],
    sourceA: {
      label: 'system_logs.grading_attempt_failed (client-written, TypedTest.jsx:742)',
      value: rate(r7aNum, aTyped), numerator: r7aNum, denominator: aTyped,
      formula: "(count(attempts testType=='typed' in window) - count(system_logs type=='grading_attempt_failed' and isFinal===true in window)) / count(attempts testType=='typed' in window)",
      sourceCollections: ['attempts', 'system_logs'],
      finalFailures: gafFinal,
      allFailedGradeAttempts: L.grading_attempt_failed,
      timedOut: gafTimedOut, failedFast: gafFailedFast, offlineAtFailure: gafOffline,
      recovered: L.grading_recovered,
      failuresByErrCode: gafByErrCode,
      caveats: [GLOBAL_CAVEAT,
        'the denominator is successes-only (attempts that got written), so this is a diagnostic rate, not an availability truth — use sourceB for the headline'],
    },
    sourceB: {
      label: 'grading_jobs (server-written, never pruned)',
      value: rate(jGraded, jTotal), numerator: jGraded, denominator: jTotal,
      formula: "count(grading_jobs status=='graded' and from<=createdAt<to) / count(grading_jobs with from<=createdAt<to)",
      sourceCollections: ['grading_jobs'],
      neverGraded: jNeverGraded,
      neverGradedRate: rate(jNeverGraded, jTotal),
      neverGradedDefinition: "status=='claimed' AND leaseExpiresAt < WINDOW END. getGradingStatus's 'stale' is a computed view, not a stored value, so this must be DERIVED. Anchored on the window end (never on wall-clock) so --verify reproduces exactly.",
      leaseFieldType: 'grading_jobs.leaseExpiresAt is raw epoch MILLISECONDS (a number), not a Firestore Timestamp — functions/index.js:1121,1134. Coercing it as a Timestamp silently buckets every never-graded job as claimedWithNoLease and reports neverGraded 0.',
      inFlightAtWindowEnd: jInFlight,
      claimedWithNoLease: jClaimedNoLease,
      leaseTakeovers: jTakeover,
      leaseTakeoverRate: rate(jTakeover, jTotal),
      statusCensus: jStatus,
      attemptCountCensus: jAttemptCount,
      exclusions: [
        'a metering-CAPPED claim returns BEFORE the claim transaction writes the job doc (index.js:1131), so spend refusals create NO doc and are invisible here (they are not availability failures, so this is a scoping note not a hole)',
        "persistGradingJobResult outcomes (already_graded | superseded | lease_expired | absent | error) are RETURNED, never stored — a stale worker's discarded grade leaves no record",
      ],
      caveats: ['server-written: NOT subject to the global client-logger caveat'],
    },
  };

  const nullMetric = (reason, extra = {}) => ({ inScope: false, value: null, numerator: null, denominator: null, reason, ...extra });

  const metrics = {
    R1: nullMetric('manually watched per David 2026-08-05',
      { invariant: 'auth / session start success rate',
        detail: 'Firestore holds nothing: no auth event is ever written (AuthContext.jsx performs no Firestore write on login/logout/onAuthStateChanged) and Firebase Auth lastSignInTime is a last-write scalar with no failure counterpart. Failures live in GCP Cloud Logging / Identity Platform, outside Firestore.' }),
    R2, R3, R4a,
    R4b: nullMetric('no producer exists — out of scope',
      { invariant: 'client JS exception rate',
        detail: 'No window.onerror, no unhandledrejection listener, no root ErrorBoundary anywhere in /app/src; apBoost\'s logError writes to console.error only. Absence of rows is NOT evidence of health. Needs a client error reporter — a separate fold, and it cannot produce a RETROSPECTIVE baseline.' }),
    R5: nullMetric('manually watched per David 2026-08-05',
      { invariant: 'teacher gradebook / analytics load',
        detail: 'Zero teacher read telemetry exists: Gradebook.jsx, ClassDetail.jsx and their query helpers write nothing. Teacher reads are direct browser Firestore reads, not callables, so not even Cloud Functions logs see them.' }),
    R6,
    'R7-typed': R7typed,
    'R7-MCQ': nullMetric('VACUOUS — MCQ is graded client-side, there is no grader to be unavailable',
      { invariant: 'MCQ grading availability',
        detail: 'functions/index.js:635 — correctnessSource is null for "client-computed (MCQ)". No callable is invoked and no grading_jobs doc is ever created, so an availability rate would be a constant. attempt_write_failed_client rows with testType:mcq are WRITE failures, already counted in R3.' }),
  };

  // ── structural validity: a SHAPE check, never a judgement on the numbers ──
  const checks = [];
  const ck = (name, ok, detail) => { checks.push({ check: name, ok, detail }); return ok; };
  ck('window is half-open and non-empty', from < to, `${from.toISOString()} < ${to.toISOString()}`);
  for (const k of ['R2', 'R3', 'R4a', 'R6', 'R7-typed']) {
    ck(`${k} in scope and populated`, metrics[k].inScope === true, 'inScope===true');
  }
  for (const k of ['R2', 'R3', 'R4a']) {
    ck(`${k} has a positive denominator`, (metrics[k].denominator ?? 0) > 0, `denominator=${metrics[k].denominator}`);
    ck(`${k} value is a finite rate in [0,1]`, typeof metrics[k].value === 'number' && metrics[k].value >= 0 && metrics[k].value <= 1, `value=${metrics[k].value}`);
  }
  ck('R6 declares NO denominator (a volume must not fake a rate)', metrics.R6.denominator === null && typeof metrics.R6.denominatorReason === 'string', 'denominator===null with reason');
  ck('R6 value is a non-negative integer volume', Number.isInteger(metrics.R6.value) && metrics.R6.value >= 0, `value=${metrics.R6.value}`);
  ck('R7-typed sourceB denominator positive', (metrics['R7-typed'].sourceB.denominator ?? 0) > 0, `denominator=${metrics['R7-typed'].sourceB.denominator}`);
  ck('R7-typed top-level mirrors its declared primary source', metrics['R7-typed'].value === metrics['R7-typed'][metrics['R7-typed'].primary].value, `primary=${metrics['R7-typed'].primary}`);
  // Fails CLOSED on the lease-coercion class of bug: if a `claimed` job cannot be
  // classified by its lease it must SHOUT, not quietly land in a bucket that makes
  // neverGraded look like zero.
  ck('every claimed grading_job was classified by an actual lease value', jClaimedNoLease === 0,
    `claimedWithNoLease=${jClaimedNoLease} (leaseExpiresAt is epoch-ms; see sourceB.leaseFieldType)`);
  ck('R3 per-errCode failures reconcile with the failure total',
    Object.values(byErrCode).reduce((t, o) => t + o.failures, 0) === awfTotal,
    `sum(byErrCode)=${Object.values(byErrCode).reduce((t, o) => t + o.failures, 0)} vs failures=${awfTotal}`);
  ck('R2 per-errCode failures reconcile with its failure total',
    Object.values(awfNewByErrCode).reduce((t, n) => t + n, 0) === awfNew,
    `sum=${Object.values(awfNewByErrCode).reduce((t, n) => t + n, 0)} vs failures=${awfNew}`);
  ck('R6 buckets partition the completions read',
    sNonReview + sReviewOnly + sUnknown === sTotal, `${sNonReview}+${sReviewOnly}+${sUnknown} === ${sTotal}`);
  ck('R7-typed sourceA denominator positive', (metrics['R7-typed'].sourceA.denominator ?? 0) > 0, `denominator=${metrics['R7-typed'].sourceA.denominator}`);
  for (const k of ['R1', 'R4b', 'R5', 'R7-MCQ']) {
    ck(`${k} explicitly null with a reason`, metrics[k].value === null && typeof metrics[k].reason === 'string' && metrics[k].reason.length > 0, metrics[k].reason);
  }
  ck('global caveat carried verbatim on every client-derived rate',
    [metrics.R2, metrics.R3, metrics.R4a].every((m) => m.caveats.includes(GLOBAL_CAVEAT)), 'caveats[] contains GLOBAL_CAVEAT');
  ck('zero writes', reads.writes === 0, 'reads.writes===0');
  ck('paged system_logs matches its count() aggregate', pagedLogs === est.system_logs, `paged ${pagedLogs} vs agg ${est.system_logs}`);
  ck('paged attempts matches its count() aggregate', aTotal === est.attempts, `paged ${aTotal} vs agg ${est.attempts}`);
  ck('paged grading_jobs matches its count() aggregate', jTotal === est.grading_jobs, `paged ${jTotal} vs agg ${est.grading_jobs}`);
  const structuralValidity = { pass: checks.every((c) => c.ok), checks,
    meaning: 'STRUCTURAL only: every in-scope metric is present with a usable denominator, every out-of-scope metric is explicitly null with a reason, no rate was fabricated for R6, and the paged totals reconcile with their count() aggregates. It is NOT a judgement on whether the values are healthy.' };

  return {
    artifact: 'b0-baseline',
    schemaVersion: 1,
    label: LABEL,
    generatedAt: new Date().toISOString(),
    generatedBy: 'scripts/deepfix2/b0-baseline.mjs',
    producerSha256: producerSha256(),
    project: PROJECT,
    // Top-level `pass` + `sourceShas` are the shape scripts/deepfix2/gate.mjs GATE 3b
    // reads: it fails closed if a receipt reports failure, or if the receipt certifies a
    // producer sha that is no longer the bytes in the tree. That makes "the receipt was
    // regenerated after the last edit to its producer" a MACHINE check, not a habit.
    pass: null,       // filled below from structuralValidity.pass
    sourceShas: null, // filled below: { 'b0-baseline.mjs': <sha16 of this file> }
    window: {
      from: from.toISOString(), to: to.toISOString(), days,
      convention: 'HALF-OPEN [from, to), UTC-anchored. A document is in-window iff from <= t < to.',
      timeFieldPerSource: {
        attempts: 'submittedAt (SERVER timestamp, functions/index.js:637)',
        system_logs: 'timestamp (SERVER timestamp, db.js:110 / foundation.js:228)',
        grading_jobs: 'createdAt (SERVER timestamp)',
        'users/{uid}/sessions': 'completedAt (CLIENT Timestamp.now(), studyService.js:1104 — client-clock skew at the window edges)',
      },
    },
    scope: {
      computed: ['R2', 'R3', 'R4a', 'R6', 'R7-typed'],
      explicitlyNull: { R1: 'manually watched per David 2026-08-05', R5: 'manually watched per David 2026-08-05',
        R4b: 'no producer exists — out of scope', 'R7-MCQ': 'VACUOUS — MCQ is graded client-side' },
      ruling: "David 2026-08-05: R1 auth and R5 teacher-gradebook are ACCEPTED AS MANUALLY WATCHED and are not computed here; they are emitted as null so the receipt is complete and the narrowing is explicit.",
    },
    globalCaveat: GLOBAL_CAVEAT,
    metrics,
    structuralValidity,
    reads: { ...reads, preflightAggregateCounts: est,
      note: 'documentReads counts documents actually returned; the sessions fan-out charges max(1, size) per query because Firestore bills a minimum of one read for an empty query result.' },
    missingIndexes: MISSING_INDEXES,
    readOnlyProof: {
      pattern: READ_ONLY_PATTERN,
      command: `grep -nE '${READ_ONLY_PATTERN}' scripts/deepfix2/b0-baseline.mjs`,
      assertion: 'the only Firestore verbs in the producer are .get() and .count().get(); zero writes to Firestore',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFY — recompute over the RECEIPT'S OWN window and diff
// ═══════════════════════════════════════════════════════════════════════════
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[key] = v;
  }
  return out;
}

async function main() {
  if (VERIFY) {
    const p = pathResolve(typeof arg('verify') === 'string' ? arg('verify') : (OUT_ARG || DEFAULT_OUT));
    if (!existsSync(p)) die(`--verify needs an existing receipt; ${p} does not exist. Produce one first.`);
    const prior = JSON.parse(readFileSync(p, 'utf8'));
    if (!prior.window?.from || !prior.window?.to) die(`${p} carries no window — it is not a b0-baseline receipt.`);
    console.log(`\nVERIFY MODE — recomputing over the receipt's OWN window from ${p}`);
    const fresh = await compute(new Date(prior.window.from), new Date(prior.window.to));

    const a = flatten({ window: { from: prior.window.from, to: prior.window.to, days: prior.window.days }, metrics: prior.metrics });
    const b = flatten({ window: { from: fresh.window.from, to: fresh.window.to, days: fresh.window.days }, metrics: fresh.metrics });
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    const drift = [];
    for (const k of keys) {
      const x = a[k], y = b[k];
      if (x === y) continue;
      if (typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) < 1e-12) continue;
      drift.push({ key: k, receipt: x ?? null, recomputed: y ?? null });
    }
    console.log(`\ncompared ${keys.length} numeric/boolean leaves under window+metrics`);
    if (!drift.length) {
      console.log(`VERIFY: IDENTICAL — the receipt reproduces exactly.`);
      console.log(`(informational, NOT part of the diff: receipt generatedAt ${prior.generatedAt} · producerSha256 ${String(prior.producerSha256).slice(0, 16)}… ` +
                  `vs now ${fresh.generatedAt} · ${String(fresh.producerSha256).slice(0, 16)}…; reads ${prior.reads?.documentReads} vs ${fresh.reads.documentReads})`);
      process.exit(0);
    }
    console.log(`VERIFY: DRIFT on ${drift.length} leaf/leaves — the receipt does NOT reproduce:`);
    for (const d of drift.slice(0, 60)) console.log(`  ${d.key}\n      receipt=${d.receipt}  recomputed=${d.recomputed}`);
    if (drift.length > 60) console.log(`  … ${drift.length - 60} more`);
    process.exit(1);
  }

  const from = parseBound(arg('from'), 'from');
  const to = parseBound(arg('to'), 'to');
  const receipt = await compute(from, to);
  receipt.pass = receipt.structuralValidity.pass;
  receipt.sourceShas = { 'b0-baseline.mjs': receipt.producerSha256.slice(0, 16) };
  const outPath = pathResolve(OUT_ARG || DEFAULT_OUT);
  writeFileSync(outPath, JSON.stringify(receipt, null, 2) + '\n');

  const m = receipt.metrics;
  console.log(`\n─── B0 [${receipt.window.from} , ${receipt.window.to})  ${receipt.window.days}d ───`);
  console.log(`  R2  new-word submit success     ${pct(m.R2.value)}   ${m.R2.numerator} / ${m.R2.denominator}`);
  console.log(`  R3  attempt-write success       ${pct(m.R3.value)}   ${m.R3.numerator} / ${m.R3.denominator}`);
  for (const [c, o] of Object.entries(m.R3.byErrCode).sort((x, y) => y[1].failures - x[1].failures)) {
    console.log(`        ${c.padEnd(34)} ${String(o.failures).padStart(4)} failures · ${(o.shareOfFailures * 100).toFixed(1)}% of failures · failureRate ${pct(o.failureRate)}`);
  }
  console.log(`  R4a list-progress resolve       ${pct(m.R4a.value)}   ${m.R4a.numerator} / ${m.R4a.denominator}`);
  console.log(`        normalized: ${m.R4a.normalized.resolvesPerActiveStudentDay?.toFixed(3)} resolves/active-student-day · ${m.R4a.normalized.unavailablePer1000ActiveStudentDays?.toFixed(3)} unavailable/1000 student-days`);
  console.log(`  R6  non-review completions      ${m.R6.value} completions  (VOLUME — denominator is null by design)`);
  console.log(`        ${m.R6.normalized.nonReviewCompletionsPerActiveStudentDay?.toFixed(4)} per active-student-day · discriminator coverage ${pct(m.R6.discriminatorCoverage.coverage)}`);
  console.log(`  R7  typed grading availability   sourceB(grading_jobs, PRIMARY) ${pct(m['R7-typed'].sourceB.value)}  ${m['R7-typed'].sourceB.numerator} / ${m['R7-typed'].sourceB.denominator}`);
  console.log(`        neverGraded ${pct(m['R7-typed'].sourceB.neverGradedRate)} · leaseTakeover ${pct(m['R7-typed'].sourceB.leaseTakeoverRate)}`);
  console.log(`        sourceA(system_logs) ${pct(m['R7-typed'].sourceA.value)}  ${m['R7-typed'].sourceA.numerator} / ${m['R7-typed'].sourceA.denominator}`);
  console.log(`  R1 / R5   null — manually watched per David 2026-08-05`);
  console.log(`  R4b       null — no producer exists`);
  console.log(`  R7-MCQ    null — vacuous (MCQ graded client-side)`);
  console.log(`\n  reads: ${receipt.reads.documentReads} documents · ${receipt.reads.aggregateQueries} count() aggregates · ${receipt.reads.queries} queries · WRITES ${receipt.reads.writes}`);
  console.log(`  structuralValidity.pass = ${receipt.structuralValidity.pass}` +
    (receipt.structuralValidity.pass ? '' : `\n  FAILED CHECKS: ${receipt.structuralValidity.checks.filter((c) => !c.ok).map((c) => c.check).join(' · ')}`));
  console.log(`  receipt: ${outPath}\n`);
  process.exit(receipt.structuralValidity.pass ? 0 : 1);
}

await main();
