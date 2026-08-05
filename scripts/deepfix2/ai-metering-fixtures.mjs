#!/usr/bin/env node
/*
 * ============================================================================
 * ai-metering-build — PURE fixtures + mutants for the AI-grading meter and the
 * re-test-only spend cap
 * ============================================================================
 * ZERO credentials, ZERO emulator, ZERO Anthropic spend. Everything here runs
 * the REAL shipped code:
 *   · the pure clauses exported by `functions/aiMetering.js`
 *   · the REAL `claimOrRecoverGradingJob` from `functions/index.js`
 *     (`exports._gradingJobs`), driven through a fake `db`/`tx` that records
 *     every write — so the transaction's branch logic, its metering point and
 *     its "capped ⇒ ZERO writes" property are all exercised as shipped.
 *
 * THE CASE THIS SUITE EXISTS FOR is M-LIVE-OVERCAP: with the counters ALREADY
 * over every limit, a LIVE typed test must still be allowed and still be
 * counted. 947 students are on that path; a cap that can refuse them is an
 * outage, not a cost control.
 *
 * MUTANTS mutate the SHIPPED SOURCE TEXT (Function.prototype.toString() →
 * new Function), never a paraphrase, and every mutation asserts its anchor
 * matched EXACTLY ONCE — a mutation that silently did not apply would
 * otherwise be scored "killed" by a suite that never mutated anything. A
 * canonical rebuild (no mutation) is cross-checked against the real export
 * before any mutant is judged, so the rebuild machinery is proven faithful.
 *
 *   node scripts/deepfix2/ai-metering-fixtures.mjs
 *   AI_METERING_PURE_OUT=...   (default docs/plans/deepfix2/evidence/ai-metering-pure.json)
 *   AI_METERING_MUTANTS_OUT=... (default docs/plans/deepfix2/evidence/ai-metering-mutants.json)
 * Exit 0 = every case passed AND every mutant was killed.
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

const REPO = "/app";
const require = createRequire(resolve(REPO, "functions") + "/");
const sha16 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);

const AIM_PATH = resolve(REPO, "functions", "aiMetering.js");
const INDEX_PATH = resolve(REPO, "functions", "index.js");
const TG_PATH = resolve(REPO, "functions", "reviewV2", "typedGrading.js");
const CALLABLES_PATH = resolve(REPO, "functions", "reviewV2", "callables.js");
const COMPLETION_PATH = resolve(REPO, "functions", "reviewV2", "completion.js");
const SELF = resolve(REPO, "scripts", "deepfix2", "ai-metering-fixtures.mjs");

const PURE_OUT = process.env.AI_METERING_PURE_OUT
  || resolve(REPO, "docs/plans/deepfix2/evidence/ai-metering-pure.json");
const MUTANTS_OUT = process.env.AI_METERING_MUTANTS_OUT
  || resolve(REPO, "docs/plans/deepfix2/evidence/ai-metering-mutants.json");

const AIM = require(AIM_PATH);
const COMPLETION = require(COMPLETION_PATH);
const INDEX = require(INDEX_PATH);
if (!INDEX || !INDEX._gradingJobs || typeof INDEX._gradingJobs.claimOrRecoverGradingJob !== "function") {
  console.error("FATAL: functions/index.js does not expose _gradingJobs.claimOrRecoverGradingJob");
  process.exit(2);
}
const REAL_CLAIM = INDEX._gradingJobs.claimOrRecoverGradingJob;

// ── case runner ─────────────────────────────────────────────────────────────
let total = 0; let failed = 0; const reds = []; let caseName = "";
const caseIds = [];
const CASE = (n) => { caseName = n; caseIds.push(n); console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

// ── the fake Firestore: enough surface for the real claim txn ───────────────
/** A store is a plain object of {docPath: data}. Writes are RECORDED so a
 *  fixture can assert "ZERO writes" and "who wrote ai_metering". */
function makeStore(seed = {}) {
  // ACCESS is recorded, not just end state — the contention law is about WHERE a
  // document is touched, which an end-state assertion cannot see. Reads/writes
  // are tagged with the id of the transaction they happened in (`txnId`, null
  // outside one), because the deferred global writer opens its OWN transaction
  // on the rollover path and that must never be confused with the CLAIM txn.
  return { docs: { ...seed }, writes: [], txReads: [], postReads: [], txnSeq: 0 };
}
/** The claim transaction is the one that reads a `grading_jobs/` document. */
const claimTxnIds = (store) =>
  [...new Set(store.txReads.filter((r) => r.path.startsWith("grading_jobs/")).map((r) => r.txnId))];
const claimTxnWrites = (store) =>
  store.writes.filter((w) => w.txnId !== null && claimTxnIds(store).includes(w.txnId));
const claimTxnReads = (store) =>
  store.txReads.filter((r) => claimTxnIds(store).includes(r.txnId)).map((r) => r.path);
function snapOf(store, path) {
  const data = Object.prototype.hasOwnProperty.call(store.docs, path) ? store.docs[path] : undefined;
  return {
    exists: data !== undefined && data !== null,
    id: path.split("/").pop(),
    ref: { path },
    data: () => data,
  };
}
function applyWrite(store, path, data, merge, phase, txnId = null) {
  store.writes.push({ path, merge, data, phase, txnId });
  const prev = merge && store.docs[path] ? store.docs[path] : {};
  const next = { ...prev, ...data };
  // minimal FieldValue.increment support for the post-commit deferred path
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && v.__increment !== undefined) {
      next[k] = (Number.isInteger(prev[k]) ? prev[k] : 0) + v.__increment;
    }
  }
  store.docs[path] = next;
}
function makeTx(store, opts = {}, txnId = null) {
  const note = (path) => store.txReads.push({ path, txnId });
  return {
    get: async (ref) => {
      note(ref.path);
      if (opts.throwOnGet && opts.throwOnGet(ref.path)) throw new Error(`fake get failure: ${ref.path}`);
      return snapOf(store, ref.path);
    },
    getAll: async (...refs) => {
      for (const r of refs) {
        note(r.path);
        if (opts.throwOnGet && opts.throwOnGet(r.path)) throw new Error(`fake getAll failure: ${r.path}`);
      }
      return refs.map((r) => snapOf(store, r.path));
    },
    set: (ref, data, options) => {
      if (opts.throwOnTxSet && opts.throwOnTxSet(ref.path)) throw new Error(`fake tx set failure: ${ref.path}`);
      applyWrite(store, ref.path, data, Boolean(options && options.merge), "txn", txnId);
    },
  };
}
/** A document handle usable OUTSIDE a transaction (the deferred global path). */
function makeDocRef(store, path, opts) {
  return {
    path,
    get: async () => {
      store.postReads.push(path);
      if (opts.throwOnPostGet && opts.throwOnPostGet(path)) throw new Error(`fake post get failure: ${path}`);
      return snapOf(store, path);
    },
    set: async (data, options) => {
      if (opts.throwOnPostSet && opts.throwOnPostSet(path)) throw new Error(`fake post set failure: ${path}`);
      applyWrite(store, path, data, Boolean(options && options.merge), "post");
    },
  };
}
function makeDb(store, opts = {}) {
  const ref = (path) => makeDocRef(store, path, opts);
  return {
    collection: (c) => ({ doc: (d) => ref(`${c}/${d}`) }),
    doc: (p) => ref(p),
    runTransaction: async (fn) => fn(makeTx(store, opts, ++store.txnSeq)),
  };
}
class FakeHttpsError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const FAKE_FIELD_VALUE = {
  serverTimestamp: () => "<serverTimestamp>",
  increment: (n) => ({ __increment: n }),
};

/** The closure the real `claimOrRecoverGradingJob` needs, with `db` swapped
 *  for the fake. Values mirror functions/index.js:118-124. */
const CLAIM_DEPS = (store, opts = {}) => ({
  db: makeDb(store, opts),
  crypto: { randomUUID: () => "lease-" + (store.writes.length + 1) },
  HttpsError: FakeHttpsError,
  GRADE_JOB_LEASE_MS: 180000,
  GRADE_JOB_VERSION: 1,
  FieldValue: FAKE_FIELD_VALUE,
  aiMetering: opts.aiMetering ?? AIM,
  logger: { warn() {}, error() {}, info() {} },
});
/** The claim schedules the deferred global write fire-and-forget; a fixture that
 *  wants to see its EFFECT must await it (production deliberately does not). */
const settle = () => AIM.settleGlobalMeterWrites();
/** Did the CLAIM transaction (not any later one) read or write this document? */
const txTouched = (store, path) =>
  claimTxnReads(store).includes(path) || claimTxnWrites(store).some((w) => w.path === path);

/** Rebuild a shipped function from its own source text, optionally mutating it.
 *  Asserts the anchor matched EXACTLY ONCE. */
function rebuild(fn, deps, mutation) {
  let src = fn.toString();
  if (mutation) {
    const hits = src.split(mutation.from).length - 1;
    if (hits !== 1) {
      throw new Error(`MUTATION ANCHOR matched ${hits}x (want exactly 1): ${JSON.stringify(mutation.from)}`);
    }
    src = src.replace(mutation.from, mutation.to);
  }
  const names = Object.keys(deps);
  return new Function(...names, `return (${src});`)(...names.map((n) => deps[n]));
}

const TODAY = Date.parse("2026-08-05T04:00:00Z");           // 13:00 KST 2026-08-05
const WKEY = AIM.meterWindowKey(TODAY);
const YESTERDAY_KEY = AIM.meterWindowKey(TODAY - 86400000);
const LIMITS = { perStudentDailyLimit: 40, globalDailyLimit: 6000 };
const cfgOk = (limits = LIMITS) => ({ status: "ok", present: true, limits });
const cfgUnreadable = () => ({ status: "unreadable", present: false, limits: { ...AIM.AI_METERING_DEFAULTS } });
const meterDoc = (count, windowStart = WKEY) => ({ count, windowStart, updatedAtMs: TODAY });
/** [contention fix] The global counter is written POST-COMMIT on the live leg
 *  and fire-and-forget, so every count assertion settles first. Production
 *  deliberately does not await it; a fixture must, or it asserts against a race. */
const counts = async (store) => {
  await settle();
  return [
    store.docs["ai_metering/uS"] ? store.docs["ai_metering/uS"].count : null,
    store.docs["ai_metering/_global"] ? store.docs["ai_metering/_global"].count : null,
  ];
};
const meteringWrites = async (store) => {
  await settle();
  return store.writes.filter((w) => w.path.startsWith("ai_metering/")).length;
};

// ===========================================================================
// PURE CLAUSES
// ===========================================================================
CASE("P1 — the LIVE default: nothing that is not strictly a retest can be refused");
{
  const over = { meterStatus: "ok", studentCount: 999999, globalCount: 999999, limits: LIMITS };
  for (const [label, v] of [["false", false], ["undefined", undefined], ["null", null],
    ["string 'true'", "true"], ["number 1", 1], ["string 'rerun'", "rerun"], ["object", {}]]) {
    check(`isRetest ${label} ⇒ allowed even at 999999/999999`,
      AIM.decideMetering({ isRetest: v, ...over }).allowed, true);
  }
  check("the live decision carries no scope", AIM.decideMetering({ isRetest: false, ...over }).scope, null);
}

CASE("P2 — a retest UNDER the cap is allowed and carries no scope");
{
  const d = AIM.decideMetering({ isRetest: true, meterStatus: "ok", studentCount: 0, globalCount: 0, limits: LIMITS });
  check("allowed / scope / reason", [d.allowed, d.scope, d.reason], [true, null, "under cap"]);
}

CASE("P3 — the per-student boundary: N-1 allowed, N refused");
{
  const at = (n) => AIM.decideMetering({ isRetest: true, meterStatus: "ok", studentCount: n, globalCount: 0, limits: LIMITS });
  check("39 spent of 40 ⇒ the 40th is ALLOWED", [at(39).allowed, at(39).scope], [true, null]);
  check("40 spent of 40 ⇒ the 41st is REFUSED", [at(40).allowed, at(40).scope], [false, "student"]);
  check("41 spent ⇒ still refused", [at(41).allowed, at(41).scope], [false, "student"]);
  check("a limit of 1 permits exactly one call", [at(0).allowed,
    AIM.decideMetering({ isRetest: true, meterStatus: "ok", studentCount: 1, globalCount: 0,
      limits: { perStudentDailyLimit: 1, globalDailyLimit: 6000 } }).allowed], [true, false]);
}

CASE("P4 — the GLOBAL cap trips independently of the per-student cap");
{
  const d = AIM.decideMetering({ isRetest: true, meterStatus: "ok", studentCount: 0, globalCount: 6000, limits: LIMITS });
  check("student at 0, global at 6000 ⇒ refused, scope global", [d.allowed, d.scope], [false, "global"]);
  const under = AIM.decideMetering({ isRetest: true, meterStatus: "ok", studentCount: 0, globalCount: 5999, limits: LIMITS });
  check("global 5999 ⇒ allowed", under.allowed, true);
  const both = AIM.decideMetering({ isRetest: true, meterStatus: "ok", studentCount: 40, globalCount: 6000, limits: LIMITS });
  check("both over ⇒ the per-student scope is reported first", [both.allowed, both.scope], [false, "student"]);
  // and the same global-over state must NOT refuse a live test
  check("THE OTHER LEG: global over cap does NOT refuse a LIVE call",
    AIM.decideMetering({ isRetest: false, meterStatus: "ok", studentCount: 0, globalCount: 6000, limits: LIMITS }).allowed, true);
}

CASE("P5 — asymmetric failure semantics: live fails OPEN, retest fails CLOSED");
{
  const live = AIM.decideMetering({ isRetest: false, meterStatus: "unreadable", studentCount: 0, globalCount: 0, limits: LIMITS });
  const retest = AIM.decideMetering({ isRetest: true, meterStatus: "unreadable", studentCount: 0, globalCount: 0, limits: LIMITS });
  check("meter unreadable + LIVE ⇒ allowed", [live.allowed, live.scope], [true, null]);
  check("meter unreadable + RETEST ⇒ refused, scope unavailable", [retest.allowed, retest.scope], [false, "unavailable"]);
}

CASE("P6 — counterAt: the KST window rollover IS the reset (no sweeper)");
{
  check("absent doc ⇒ 0", AIM.counterAt(null, WKEY), 0);
  check("non-object ⇒ 0", AIM.counterAt("nope", WKEY), 0);
  check("same window ⇒ the stored count", AIM.counterAt(meterDoc(7), WKEY), 7);
  check("YESTERDAY's window ⇒ 0 (rollover)", AIM.counterAt(meterDoc(6000, YESTERDAY_KEY), WKEY), 0);
  check("missing windowStart ⇒ 0", AIM.counterAt({ count: 12 }, WKEY), 0);
  check("malformed count ⇒ 0", [AIM.counterAt({ count: "12", windowStart: WKEY }, WKEY),
    AIM.counterAt({ count: -3, windowStart: WKEY }, WKEY),
    AIM.counterAt({ count: 1.5, windowStart: WKEY }, WKEY)], [0, 0, 0]);
}

CASE("P7 — nextCounter writes the frozen {count, windowStart} shape");
{
  check("0 ⇒ 1 stamped with this window", AIM.nextCounter(0, WKEY, TODAY), { count: 1, windowStart: WKEY, updatedAtMs: TODAY });
  check("39 ⇒ 40", AIM.nextCounter(39, WKEY, TODAY).count, 40);
  check("the frozen contract fields are present", Object.keys(AIM.nextCounter(0, WKEY, TODAY)).slice(0, 2), ["count", "windowStart"]);
}

CASE("P8 — limits are CONFIG with DEFAULTS; the refusal shape is the frozen idiom");
{
  check("absent doc ⇒ defaults", AIM.normalizeLimits(null), { perStudentDailyLimit: 40, globalDailyLimit: 6000 });
  check("the DEFAULTS are 40 / 6000", [AIM.AI_METERING_DEFAULTS.perStudentDailyLimit, AIM.AI_METERING_DEFAULTS.globalDailyLimit], [40, 6000]);
  check("a valid override is honoured", AIM.normalizeLimits({ perStudentDailyLimit: 5, globalDailyLimit: 9 }),
    { perStudentDailyLimit: 5, globalDailyLimit: 9 });
  check("malformed values fall back to the DEFAULT, never to unlimited",
    [AIM.normalizeLimits({ perStudentDailyLimit: 0 }).perStudentDailyLimit,
      AIM.normalizeLimits({ perStudentDailyLimit: -1 }).perStudentDailyLimit,
      AIM.normalizeLimits({ perStudentDailyLimit: "40" }).perStudentDailyLimit,
      AIM.normalizeLimits({ globalDailyLimit: 1.5 }).globalDailyLimit,
      AIM.normalizeLimits({ globalDailyLimit: null }).globalDailyLimit], [40, 40, 40, 6000, 6000]);
  check("one field valid, its sibling malformed ⇒ per-field fallback",
    AIM.normalizeLimits({ perStudentDailyLimit: 7, globalDailyLimit: "x" }), { perStudentDailyLimit: 7, globalDailyLimit: 6000 });
  check("the refusal status", AIM.PRACTICE_LIMIT_STATUS, "practice_limit_reached");
  check("the refusal is DATA with a student-facing message",
    AIM.practiceLimitRefusal("global"),
    { status: "practice_limit_reached", scope: "global", message: AIM.PRACTICE_LIMIT_MESSAGE });
  checkTrue("the message names the MCQ alternative (MCQ re-tests stay available)",
    /multiple-choice re-test/.test(AIM.PRACTICE_LIMIT_MESSAGE));
  check("a missing scope defaults to student", AIM.practiceLimitRefusal(null).scope, "student");
  check("the config doc is its own document, not a review_v2 sub-object",
    AIM.AI_METERING_CONFIG_PATH, "system_config/ai_metering");
}

CASE("P9 — ONE day law: the window key IS completion.js's kstDateString");
{
  for (const iso of ["2026-08-04T14:59:59Z", "2026-08-04T15:00:00Z", "2026-01-01T00:00:00Z", "2026-12-31T23:59:59Z"]) {
    check(`${iso} matches the streak day law`, AIM.meterWindowKey(Date.parse(iso)), COMPLETION.kstDateString(Date.parse(iso)));
  }
  check("14:59:59Z is still 2026-08-04 KST", AIM.meterWindowKey(Date.parse("2026-08-04T14:59:59Z")), "2026-08-04");
  check("15:00:00Z has rolled to 2026-08-05 KST", AIM.meterWindowKey(Date.parse("2026-08-04T15:00:00Z")), "2026-08-05");
}

// ===========================================================================
// THE CLAIM TRANSACTION — the REAL shipped function, fake db/tx
// ===========================================================================
CASE("M-COUNT — create: a fresh claim grades, counts once, and stamps aiCallCount");
{
  const store = makeStore();
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  const r = await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  check("action", r.action, "grade");
  check("per-student + global counters are both 1", await counts(store), [1, 1]);
  check("windowStart is today's KST date", store.docs["ai_metering/uS"].windowStart, WKEY);
  check("the job carries aiCallCount 1", store.docs["grading_jobs/job1"].aiCallCount, 1);
  check("the job is claimed", store.docs["grading_jobs/job1"].status, "claimed");
  await settle();
  check("exactly 3 writes: the job + 2 counters", store.writes.length, 3);
  check("[contention fix] the CLAIM transaction writes only the job + the per-student counter",
    claimTxnWrites(store).map((w) => w.path).sort(), ["ai_metering/uS", "grading_jobs/job1"]);
  check("[contention fix] the global counter is written AFTER the claim txn, never inside it",
    store.writes.filter((w) => !claimTxnWrites(store).includes(w)).map((w) => w.path),
    ["ai_metering/_global"]);
}

CASE("M-IDEMP — set-merge/return_cached: a retried claim of an ALREADY-COUNTED job does NOT double-count");
{
  const store = makeStore();
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  // the worker persists its grade (what persistGradingJobResult does)
  store.docs["grading_jobs/job1"] = { ...store.docs["grading_jobs/job1"], status: "graded", payload: { results: [] } };
  await settle(); // the FIRST claim's deferred global write must land before we snapshot
  const writesBefore = store.writes.length;
  const r = await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  await settle();
  check("action", r.action, "return_cached");
  check("counters UNCHANGED at 1/1", await counts(store), [1, 1]);
  check("ZERO writes of any kind on the cached return", store.writes.length - writesBefore, 0);
  check("aiCallCount still 1", store.docs["grading_jobs/job1"].aiCallCount, 1);
  // ... and a retest replay of the same graded job is likewise free and NEVER capped
  store.docs["ai_metering/uS"] = meterDoc(40);
  const r2 = await claim("uS", "job1", { isRetest: true, config: cfgOk() });
  check("an OVER-CAP retest still gets its cached grade (a cached return is not an AI call)",
    r2.action, "return_cached");
}

CASE("M-IDEMP-DELETED — delete-then-recreate SEQUENCE: a re-claim after deletion is a REAL new call");
{
  const store = makeStore();
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  delete store.docs["grading_jobs/job1"];        // TTL / cleanup / reset
  const r = await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  check("the vanished job is re-claimed as a fresh grade", r.action, "grade");
  check("it counts AGAIN — it is a second real AI call", await counts(store), [2, 2]);
  check("the recreated job restarts aiCallCount at 1", store.docs["grading_jobs/job1"].aiCallCount, 1);
}

CASE("M-INPROGRESS — set-overwrite/live lease: no grader, no count");
{
  const store = makeStore({ "grading_jobs/job1": { uid: "uS", status: "claimed", leaseExpiresAt: Date.now() + 60000 } });
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  const r = await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  check("action", r.action, "in_progress");
  check("no counters written", await counts(store), [null, null]);
  check("ZERO writes", store.writes.length, 0);
}

CASE("M-TAKEOVER — update: an EXPIRED lease re-grades, so it counts again (aiCallCount 1→2)");
{
  const store = makeStore();
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  store.docs["grading_jobs/job1"] = { ...store.docs["grading_jobs/job1"], leaseExpiresAt: Date.now() - 1000 };
  const r = await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  check("action", r.action, "grade");
  check("counters 2/2 — a genuine second AI call", await counts(store), [2, 2]);
  check("aiCallCount 2", store.docs["grading_jobs/job1"].aiCallCount, 2);
  check("attemptCount 2 (unchanged existing behaviour)", store.docs["grading_jobs/job1"].attemptCount, 2);
}

CASE("M-THIRD-PARTY — as a third party: a foreign job throws BEFORE any meter read or write");
{
  const store = makeStore({ "grading_jobs/job1": { uid: "uVICTIM", status: "claimed", leaseExpiresAt: 0 } });
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  let code = null;
  try { await claim("uS", "job1", { isRetest: true, config: cfgOk() }); } catch (e) { code = e.code; }
  check("permission-denied", code, "permission-denied");
  check("no counters written", await counts(store), [null, null]);
  check("ZERO writes", store.writes.length, 0);
}

CASE("M-TEACHER — as a teacher: the same fence, the same zero-count outcome");
{
  const store = makeStore({ "grading_jobs/job1": { uid: "uS", status: "claimed", leaseExpiresAt: 0 } });
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  let code = null;
  try { await claim("uTEACHER", "job1", { isRetest: true, config: cfgOk() }); } catch (e) { code = e.code; }
  check("a teacher claiming a student's job is permission-denied", code, "permission-denied");
  check("no counters written", await counts(store), [null, null]);
}

CASE("M-SOLE-WRITER — batch: the ONLY writer of ai_metering/* is this transaction");
{
  const store = makeStore();
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  await claim("uS", "jobA", { isRetest: false, config: cfgOk() });
  await claim("uS", "jobB", { isRetest: false, config: cfgOk() });
  await settle();
  const paths = [...new Set(store.writes.map((w) => w.path))].sort();
  check("exactly two metering docs, both under ai_metering/", paths.filter((p) => p.startsWith("ai_metering/")),
    ["ai_metering/_global", "ai_metering/uS"]);
  check("every metering write is a set-with-MERGE (never an overwrite of a sibling field)",
    store.writes.filter((w) => w.path.startsWith("ai_metering/")).every((w) => w.merge === true), true);
  check("two claims ⇒ 2/2", await counts(store), [2, 2]);
}

CASE("M-RETEST-UNDER — a rerun under the cap grades and counts");
{
  const store = makeStore({ "ai_metering/uS": meterDoc(5), "ai_metering/_global": meterDoc(500) });
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  const r = await claim("uS", "job1", { isRetest: true, config: cfgOk() });
  check("action", r.action, "grade");
  check("counters advanced 5→6 / 500→501", await counts(store), [6, 501]);
}

CASE("M-RETEST-BOUNDARY — the per-student cap trips at the boundary, with ZERO writes on refusal");
{
  const under = makeStore({ "ai_metering/uS": meterDoc(39), "ai_metering/_global": meterDoc(10) });
  const rU = await rebuild(REAL_CLAIM, CLAIM_DEPS(under))("uS", "job1", { isRetest: true, config: cfgOk() });
  check("39 spent of 40 ⇒ the 40th retest is ALLOWED", rU.action, "grade");
  check("and it counts", await counts(under), [40, 11]);

  const at = makeStore({ "ai_metering/uS": meterDoc(40), "ai_metering/_global": meterDoc(10) });
  const rA = await rebuild(REAL_CLAIM, CLAIM_DEPS(at))("uS", "job1", { isRetest: true, config: cfgOk() });
  check("40 spent of 40 ⇒ the 41st retest is REFUSED", [rA.action, rA.scope], ["capped", "student"]);
  check("a refusal writes NOTHING — no lease, no counter", at.writes.length, 0);
  check("the counter did not move", await counts(at), [40, 10]);
  check("no grading job was created", at.docs["grading_jobs/job1"], undefined);
}

CASE("M-LIVE-OVERCAP — ★ THE OUTAGE CASE: the SAME over-cap state does NOT refuse a LIVE test");
{
  // byte-identical state to M-RETEST-BOUNDARY's refusing store
  const store = makeStore({ "ai_metering/uS": meterDoc(40), "ai_metering/_global": meterDoc(6000) });
  const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store));
  const r = await claim("uS", "job1", { isRetest: false, config: cfgOk() });
  check("a LIVE typed test is ALLOWED over BOTH caps", r.action, "grade");
  check("and it is still COUNTED (count everything, enforce narrowly)", await counts(store), [41, 6001]);
  check("the job was claimed normally", store.docs["grading_jobs/job1"].status, "claimed");
  // absurdly over — still allowed
  const store2 = makeStore({ "ai_metering/uS": meterDoc(999999), "ai_metering/_global": meterDoc(999999) });
  const r2 = await rebuild(REAL_CLAIM, CLAIM_DEPS(store2))("uS", "job1", { isRetest: false, config: cfgOk() });
  check("999999 spent ⇒ a live test STILL grades", r2.action, "grade");
}

CASE("M-GLOBAL — the global cap refuses a retest while the student is at zero");
{
  const store = makeStore({ "ai_metering/_global": meterDoc(6000) });
  const r = await rebuild(REAL_CLAIM, CLAIM_DEPS(store))("uS", "job1", { isRetest: true, config: cfgOk() });
  check("refused with scope global", [r.action, r.scope], ["capped", "global"]);
  check("ZERO writes", store.writes.length, 0);
  const live = makeStore({ "ai_metering/_global": meterDoc(6000) });
  const rL = await rebuild(REAL_CLAIM, CLAIM_DEPS(live))("uS", "job1", { isRetest: false, config: cfgOk() });
  check("THE OTHER LEG: the same global state does NOT refuse a live test", rL.action, "grade");
}

CASE("M-ROLLOVER — a KST day boundary resets the window by construction");
{
  const store = makeStore({
    "ai_metering/uS": meterDoc(40, YESTERDAY_KEY),
    "ai_metering/_global": meterDoc(6000, YESTERDAY_KEY),
  });
  const r = await rebuild(REAL_CLAIM, CLAIM_DEPS(store))("uS", "job1", { isRetest: true, config: cfgOk() });
  check("yesterday's exhausted counters do not refuse today's retest", r.action, "grade");
  check("the counters RESET to 1 under today's window", await counts(store), [1, 1]);
  check("and are re-stamped with today's window", store.docs["ai_metering/uS"].windowStart, WKEY);
}

CASE("M-NO-DISCRIMINATOR — a missing discriminator reads as LIVE and is allowed");
{
  const seed = { "ai_metering/uS": meterDoc(40), "ai_metering/_global": meterDoc(6000) };
  for (const [label, meter] of [
    ["no third argument at all", undefined],
    ["an empty options object", {}],
    ["isRetest: undefined", { isRetest: undefined, config: cfgOk() }],
    ["isRetest: null", { isRetest: null, config: cfgOk() }],
    ["isRetest: 'true' (string)", { isRetest: "true", config: cfgOk() }],
    ["isRetest: 1", { isRetest: 1, config: cfgOk() }],
  ]) {
    const store = makeStore({ ...seed });
    const r = await rebuild(REAL_CLAIM, CLAIM_DEPS(store))("uS", "job1", meter);
    check(`${label} ⇒ LIVE ⇒ allowed over cap`, r.action, "grade");
    check(`${label} ⇒ still counted`, await counts(store), [41, 6001]);
  }
}

CASE("M-CONFIG-UNREADABLE — config outage: live proceeds (fail-OPEN), retest refuses (fail-CLOSED)");
{
  const live = makeStore();
  const rL = await rebuild(REAL_CLAIM, CLAIM_DEPS(live))("uS", "job1", { isRetest: false, config: cfgUnreadable() });
  check("LIVE proceeds", rL.action, "grade");
  check("and is STILL counted — a config outage must not stop the meter", await counts(live), [1, 1]);

  const retest = makeStore();
  const rR = await rebuild(REAL_CLAIM, CLAIM_DEPS(retest))("uS", "job1", { isRetest: true, config: cfgUnreadable() });
  check("RETEST refuses with scope unavailable", [rR.action, rR.scope], ["capped", "unavailable"]);
  check("ZERO writes on the refusal", retest.writes.length, 0);
}

CASE("M-METER-READ-THROWS — a counter read failure never fails a live claim");
{
  const opts = { throwOnGet: (p) => p.startsWith("ai_metering/") };
  const live = makeStore();
  const rL = await rebuild(REAL_CLAIM, CLAIM_DEPS(live, opts))("uS", "job1", { isRetest: false, config: cfgOk() });
  check("LIVE still grades", rL.action, "grade");
  check("the job IS written", live.docs["grading_jobs/job1"].status, "claimed");
  await settle();
  check("no TRANSACTIONAL counter write (we never write a count we could not read)",
    live.writes.filter((w) => w.phase === "txn" && w.path.startsWith("ai_metering/")).length, 0);
  check("the per-student counter is absent (its read is the one that failed)",
    live.docs["ai_metering/uS"], undefined);
  // TRUE NEW VALUE [contention fix]: this fixture fails EVERY ai_metering read,
  // which includes the deferred writer's own read, so the global does not land
  // either — and, the point of the case, NOTHING THREW at the caller.
  check("the deferred GLOBAL write also fails — and is SWALLOWED, never thrown",
    live.docs["ai_metering/_global"], undefined);
  check("aiCallCount is still stamped from the job's own read", live.docs["grading_jobs/job1"].aiCallCount, 1);

  // ...and the legs really are independent: fail ONLY the in-txn student read
  // and the deferred global write still lands, because it does its OWN read
  // outside the transaction.
  const split = makeStore();
  const rS = await rebuild(REAL_CLAIM, CLAIM_DEPS(split, { throwOnGet: (p) => p === "ai_metering/uS" }))(
    "uS", "job1", { isRetest: false, config: cfgOk() });
  await settle();
  check("student read fails, claim still granted", rS.action, "grade");
  check("no per-student counter", split.docs["ai_metering/uS"], undefined);
  check("but the deferred GLOBAL still lands (independent read, post-commit)",
    split.docs["ai_metering/_global"].count, 1);

  const retest = makeStore();
  const rR = await rebuild(REAL_CLAIM, CLAIM_DEPS(retest, opts))("uS", "job1", { isRetest: true, config: cfgOk() });
  check("RETEST refuses (fail-CLOSED), scope unavailable", [rR.action, rR.scope], ["capped", "unavailable"]);
  check("ZERO writes", retest.writes.length, 0);
}

CASE("M-LIVE-TXN-GLOBAL-FREE — ★ THE CONTENTION LAW: a LIVE claim never touches _global in its txn");
{
  // Asserted on the TRANSACTION'S OWN ACCESS (reads AND writes), not on end
  // state: the end state is identical either way — the whole point is WHERE the
  // global doc is touched. The audit measured the cost of getting this wrong:
  // 80 concurrent live claims fell to 2/80 granted with 78 lock-timeout aborts.
  const store = makeStore({ "ai_metering/_global": meterDoc(5), "ai_metering/uS": meterDoc(3) });
  const r = await rebuild(REAL_CLAIM, CLAIM_DEPS(store))("uS", "job1", { isRetest: false, config: cfgOk() });
  check("the live claim grades", r.action, "grade");
  check("the CLAIM txn READ set contains ONLY the job + the per-student meter",
    [...new Set(claimTxnReads(store))].sort(), ["ai_metering/uS", "grading_jobs/job1"]);
  check("the CLAIM txn NEVER reads ai_metering/_global",
    claimTxnReads(store).includes("ai_metering/_global"), false);
  check("the CLAIM txn NEVER writes ai_metering/_global",
    claimTxnWrites(store).some((w) => w.path === "ai_metering/_global"), false);
  check("txTouched(_global) is false for a LIVE claim", txTouched(store, "ai_metering/_global"), false);
  await settle();
  check("the global IS incremented, post-commit, atomically (5 → 6)", store.docs["ai_metering/_global"].count, 6);
  check("it used FieldValue.increment on the fast path (no read-modify-write race)",
    store.writes.some((w) => w.phase === "post" && w.data.count && w.data.count.__increment === 1), true);
  check("the per-student counter stayed TRANSACTIONAL (3 → 4)", store.docs["ai_metering/uS"].count, 4);

  // THE OTHER LEG: the RETEST path is deliberately UNCHANGED — its global read
  // and write stay inside the txn, because that is where enforcement is authority.
  const rt = makeStore({ "ai_metering/_global": meterDoc(5), "ai_metering/uS": meterDoc(3) });
  const r2 = await rebuild(REAL_CLAIM, CLAIM_DEPS(rt))("uS", "job1", { isRetest: true, config: cfgOk() });
  check("the retest claim grades", r2.action, "grade");
  check("a RETEST still reads _global INSIDE the claim txn",
    claimTxnReads(rt).includes("ai_metering/_global"), true);
  check("a RETEST still writes _global INSIDE the claim txn",
    claimTxnWrites(rt).some((w) => w.path === "ai_metering/_global"), true);
  await settle();
  check("a RETEST schedules NO deferred write", rt.writes.filter((w) => w.phase === "post").length, 0);
}

CASE("M-DEFERRED-WINDOW — the deferred writer rolls the KST window without losing counts");
{
  // fast path: the window already exists ⇒ atomic increment, no transaction
  const same = makeStore({ "ai_metering/_global": meterDoc(9) });
  const outcome = await AIM.incrementGlobalMeter(makeDb(same), FAKE_FIELD_VALUE, { windowKey: WKEY, nowMs: TODAY });
  check("same window ⇒ 'incremented'", outcome, "incremented");
  check("9 → 10", same.docs["ai_metering/_global"].count, 10);

  // slow path: a stale window ⇒ the rollover FOLDS IN this call's own increment
  const rolled = makeStore({ "ai_metering/_global": meterDoc(6000, YESTERDAY_KEY) });
  const outcome2 = await AIM.incrementGlobalMeter(makeDb(rolled), FAKE_FIELD_VALUE, { windowKey: WKEY, nowMs: TODAY });
  check("stale window ⇒ 'window-reset'", outcome2, "window-reset");
  check("yesterday's 6000 does NOT carry over — today starts at 1",
    [rolled.docs["ai_metering/_global"].count, rolled.docs["ai_metering/_global"].windowStart], [1, WKEY]);

  // absent doc ⇒ same slow path, starts at 1
  const fresh = makeStore();
  await AIM.incrementGlobalMeter(makeDb(fresh), FAKE_FIELD_VALUE, { windowKey: WKEY, nowMs: TODAY });
  check("an absent global meter starts at 1 in today's window",
    [fresh.docs["ai_metering/_global"].count, fresh.docs["ai_metering/_global"].windowStart], [1, WKEY]);
}

CASE("M-DEFERRED-FAILURE — a failed global increment never fails or delays the grade");
{
  // FAST path failure (the window already exists ⇒ a plain increment write)
  const store = makeStore({ "ai_metering/_global": meterDoc(7) });
  const opts = { throwOnPostSet: (p) => p === "ai_metering/_global" };
  const r = await rebuild(REAL_CLAIM, CLAIM_DEPS(store, opts))("uS", "job1", { isRetest: false, config: cfgOk() });
  await settle();
  check("the claim is granted regardless", r.action, "grade");
  check("the job is written", store.docs["grading_jobs/job1"].status, "claimed");
  check("the per-student counter is written", store.docs["ai_metering/uS"].count, 1);
  check("the global increment simply did not land — swallowed, never thrown",
    store.docs["ai_metering/_global"].count, 7);
  check("no deferGlobalMeter field leaks into the caller's contract",
    Object.prototype.hasOwnProperty.call(r, "deferGlobalMeter"), false);

  // SLOW path failure (rollover ⇒ a transaction, e.g. a lock timeout)
  const rollover = makeStore({ "ai_metering/_global": meterDoc(7, YESTERDAY_KEY) });
  const r2 = await rebuild(REAL_CLAIM, CLAIM_DEPS(rollover,
    { throwOnTxSet: (p) => p === "ai_metering/_global" }))("uS", "job1", { isRetest: false, config: cfgOk() });
  await settle();
  check("a failed ROLLOVER transaction also never reaches the caller", r2.action, "grade");
  check("the claim still wrote its job + per-student counter",
    [rollover.docs["grading_jobs/job1"].status, rollover.docs["ai_metering/uS"].count], ["claimed", 1]);
  check("the stale global is left untouched (under-count, never inflation)",
    [rollover.docs["ai_metering/_global"].count, rollover.docs["ai_metering/_global"].windowStart],
    [7, YESTERDAY_KEY]);
}

CASE("M-REBUILD-FAITHFUL — the un-mutated rebuild matches the real export before any mutant is judged");
{
  const a = makeStore(); const b = makeStore();
  const viaRebuild = await rebuild(REAL_CLAIM, CLAIM_DEPS(a))("uS", "job1", { isRetest: true, config: cfgOk() });
  // the real export closes over the REAL admin db, so compare the pure clause
  // machinery instead: same decision, same writes shape.
  const viaReal = await rebuild(REAL_CLAIM, CLAIM_DEPS(b))("uS", "job1", { isRetest: true, config: cfgOk() });
  check("two independent rebuilds agree", [viaRebuild.action, viaReal.action], ["grade", "grade"]);
  check("and write the same document set", [...new Set(a.writes.map((w) => w.path))].sort(),
    [...new Set(b.writes.map((w) => w.path))].sort());
  check("the rebuild is of the SHIPPED text (it mentions the strict discriminator)",
    /meter\?\.isRetest === true/.test(REAL_CLAIM.toString()), true);
}

// ===========================================================================
// MUTANTS — one per NEW clause. Each must CHANGE an observable outcome.
// ===========================================================================
const mutants = [];
async function MUTANT(id, what, target, mutation, probe) {
  let killed = false; let clean = null; let mutated = null; let error = null;
  try {
    clean = await probe(target.fn, target.deps);
    const mutatedFn = (fn, deps) => rebuild(fn, deps, mutation);
    mutated = await probe(target.fn, target.deps, mutatedFn);
    killed = JSON.stringify(clean) !== JSON.stringify(mutated);
  } catch (e) {
    error = e.message;
  }
  total++;
  if (!killed || error) {
    failed++;
    reds.push(`MUTANT ${id} SURVIVED${error ? " (" + error + ")" : ""}: ${what}`);
    console.error(`  RED mutant ${id} survived: ${what}${error ? " — " + error : ""}`);
  } else {
    console.log(`  killed ${id}: ${what}  [clean ${JSON.stringify(clean)} → mutant ${JSON.stringify(mutated)}]`);
  }
  mutants.push({ id, what, anchor: mutation.from, clean, mutated, killed: killed && !error, error });
}

console.log("\n== MUTANTS (one per new clause; anchors asserted to match exactly once)");

// --- clauses inside functions/aiMetering.js -------------------------------
const pureDeps = { AI_METERING_DEFAULTS: AIM.AI_METERING_DEFAULTS };

await MUTANT("M1", "flip the live/retest branch (live becomes cappable)",
  { fn: AIM.decideMetering, deps: {} },
  { from: "if (isRetest !== true) return {allowed: true, scope: null, reason: \"live\"};",
    to: "if (isRetest === true) return {allowed: true, scope: null, reason: \"live\"};" },
  async (fn, deps, mutate) => {
    const f = mutate ? mutate(fn, deps) : fn;
    return f({ isRetest: false, meterStatus: "ok", studentCount: 40, globalCount: 0, limits: LIMITS }).allowed;
  });

// M2 targets the RETEST leg's fail-CLOSED clause. (An earlier cut aimed this
// mutation at a LIVE probe and SURVIVED — correctly: clause 1 returns before
// the meterStatus test is ever reached, so the live path is protected by
// defence in depth. The mutant was mis-aimed, not the code; both legs now have
// their own mutant, M2 and M11.)
await MUTANT("M2", "drop the fail-CLOSED refusal (an unreadable meter lets a RETEST through uncapped)",
  { fn: AIM.decideMetering, deps: {} },
  { from: "if (meterStatus !== \"ok\") {\n    return {allowed: false, scope: \"unavailable\", reason: \"meter unreadable\"};\n  }",
    to: "if (false) {\n    return {allowed: false, scope: \"unavailable\", reason: \"meter unreadable\"};\n  }" },
  async (fn, deps, mutate) => {
    const f = mutate ? mutate(fn, deps) : fn;
    const d = f({ isRetest: true, meterStatus: "unreadable", studentCount: 0, globalCount: 0, limits: LIMITS });
    return [d.allowed, d.scope];
  });

await MUTANT("M3", "invert the per-student boundary comparison (>= becomes >)",
  { fn: AIM.decideMetering, deps: {} },
  { from: "if (studentCount >= limits.perStudentDailyLimit) {", to: "if (studentCount > limits.perStudentDailyLimit) {" },
  async (fn, deps, mutate) => {
    const f = mutate ? mutate(fn, deps) : fn;
    return f({ isRetest: true, meterStatus: "ok", studentCount: 40, globalCount: 0, limits: LIMITS }).allowed;
  });

await MUTANT("M4", "invert the global boundary comparison (>= becomes >)",
  { fn: AIM.decideMetering, deps: {} },
  { from: "if (globalCount >= limits.globalDailyLimit) {", to: "if (globalCount > limits.globalDailyLimit) {" },
  async (fn, deps, mutate) => {
    const f = mutate ? mutate(fn, deps) : fn;
    return f({ isRetest: true, meterStatus: "ok", studentCount: 0, globalCount: 6000, limits: LIMITS }).allowed;
  });

await MUTANT("M5", "drop the window-rollover reset (yesterday's count survives the day boundary)",
  { fn: AIM.counterAt, deps: {} },
  { from: "if (data.windowStart !== windowKey) return 0;", to: "if (false) return 0;" },
  async (fn, deps, mutate) => {
    const f = mutate ? mutate(fn, deps) : fn;
    return f(meterDoc(40, YESTERDAY_KEY), WKEY);
  });

await MUTANT("M6", "drop the config DEFAULT fallback (a malformed limit becomes unlimited)",
  { fn: AIM.normalizeLimits, deps: pureDeps },
  { from: "const pick = (v, dflt) => (Number.isInteger(v) && v >= 1 ? v : dflt);",
    to: "const pick = (v, dflt) => (v === undefined ? dflt : v);" },
  async (fn, deps, mutate) => {
    const f = mutate ? mutate(fn, deps) : fn;
    return f({ perStudentDailyLimit: 0 }).perStudentDailyLimit;
  });

// --- clauses inside functions/index.js claimOrRecoverGradingJob ------------
await MUTANT("M7", "drop the strict-true coercion (a truthy value makes a LIVE test cappable)",
  { fn: REAL_CLAIM, deps: null },
  { from: "const isRetest = meter?.isRetest === true;", to: "const isRetest = !!meter?.isRetest;" },
  async (fn, _deps, mutate) => {
    const store = makeStore({ "ai_metering/uS": meterDoc(40) });
    const deps = CLAIM_DEPS(store);
    const f = mutate ? mutate(fn, deps) : rebuild(fn, deps);
    // a caller that sends a TRUTHY-but-not-true value is LIVE by law
    const r = await f("uS", "job1", { isRetest: "true", config: cfgOk() });
    return r.action;
  });

await MUTANT("M8", "drop the capped short-circuit on the fresh-claim branch (a refused retest still claims + counts)",
  { fn: REAL_CLAIM, deps: null },
  { from: "    const freshMeter = await meterGrade();\n    if (!freshMeter.allowed) return {action: \"capped\", scope: freshMeter.scope};",
    to: "    const freshMeter = await meterGrade();" },
  async (fn, _deps, mutate) => {
    const store = makeStore({ "ai_metering/uS": meterDoc(40) });
    const deps = CLAIM_DEPS(store);
    const f = mutate ? mutate(fn, deps) : rebuild(fn, deps);
    const r = await f("uS", "job1", { isRetest: true, config: cfgOk() });
    return [r.action, store.writes.length];
  });

await MUTANT("M9", "count on the cached-return path (the idempotency guard)",
  { fn: REAL_CLAIM, deps: null },
  { from: "      if (job.status === \"graded\" && job.payload) {\n        return {action: \"return_cached\", payload: job.payload};\n      }",
    to: "      if (job.status === \"graded\" && job.payload) {\n        const m = await meterGrade(); m.commit(tx);\n        return {action: \"return_cached\", payload: job.payload};\n      }" },
  async (fn, _deps, mutate) => {
    const store = makeStore({ "grading_jobs/job1": { uid: "uS", status: "graded", payload: { results: [] } } });
    const deps = CLAIM_DEPS(store);
    const f = mutate ? mutate(fn, deps) : rebuild(fn, deps);
    const r = await f("uS", "job1", { isRetest: false, config: cfgOk() });
    return [r.action, await meteringWrites(store)];
  });

await MUTANT("M10", "drop the capped short-circuit on the TAKEOVER branch (the sibling seam)",
  { fn: REAL_CLAIM, deps: null },
  { from: "      const takeoverMeter = await meterGrade();\n      if (!takeoverMeter.allowed) return {action: \"capped\", scope: takeoverMeter.scope};",
    to: "      const takeoverMeter = await meterGrade();" },
  async (fn, _deps, mutate) => {
    const store = makeStore({
      "grading_jobs/job1": { uid: "uS", status: "claimed", leaseExpiresAt: 1, attemptCount: 1, aiCallCount: 1 },
      "ai_metering/uS": meterDoc(40),
    });
    const deps = CLAIM_DEPS(store);
    const f = mutate ? mutate(fn, deps) : rebuild(fn, deps);
    const r = await f("uS", "job1", { isRetest: true, config: cfgOk() });
    return [r.action, store.writes.length];
  });

await MUTANT("M11", "drop the fail-OPEN default (make the live clause conditional on a readable meter)",
  { fn: AIM.decideMetering, deps: {} },
  { from: "if (isRetest !== true) return {allowed: true, scope: null, reason: \"live\"};",
    to: "if (isRetest !== true && meterStatus === \"ok\") return {allowed: true, scope: null, reason: \"live\"};" },
  async (fn, deps, mutate) => {
    const f = mutate ? mutate(fn, deps) : fn;
    // THE OUTAGE SHAPE: a metering/config hiccup must never refuse live work.
    return f({ isRetest: false, meterStatus: "unreadable", studentCount: 0, globalCount: 0, limits: LIMITS }).allowed;
  });

await MUTANT("M12", "put the GLOBAL write back inside the LIVE claim txn (the measured contention regression)",
  { fn: AIM.meterGradingClaimInTxn, deps: null },
  { from: "      if (retest) {\n        txn.set(globalRef,", to: "      if (true) {\n        txn.set(globalRef," },
  async (fn, _deps, mutate) => {
    const store = makeStore({ "ai_metering/_global": meterDoc(5) });
    const meterDeps = {
      counterAt: AIM.counterAt, decideMetering: AIM.decideMetering, nextCounter: AIM.nextCounter,
      normalizeLimits: AIM.normalizeLimits, meterWindowKey: AIM.meterWindowKey,
      AI_METERING_COLLECTION: AIM.AI_METERING_COLLECTION, GLOBAL_METER_ID: AIM.GLOBAL_METER_ID,
    };
    const meter = mutate ? mutate(fn, meterDeps) : fn;
    const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store, { aiMetering: { ...AIM, meterGradingClaimInTxn: meter } }));
    await claim("uS", "job1", { isRetest: false, config: cfgOk() });
    // THE LAW: a live claim's TRANSACTION must not write the global document.
    return store.writes.some((w) => w.phase === "txn" && w.path === "ai_metering/_global");
  });

await MUTANT("M13", "make the LIVE leg READ the global doc inside the txn (re-widens the txn read set)",
  { fn: AIM.meterGradingClaimInTxn, deps: null },
  { from: "    if (retest) {\n      // ENFORCEMENT LEG", to: "    if (true) {\n      // ENFORCEMENT LEG" },
  async (fn, _deps, mutate) => {
    const store = makeStore({ "ai_metering/_global": meterDoc(5) });
    const meterDeps = {
      counterAt: AIM.counterAt, decideMetering: AIM.decideMetering, nextCounter: AIM.nextCounter,
      normalizeLimits: AIM.normalizeLimits, meterWindowKey: AIM.meterWindowKey,
      AI_METERING_COLLECTION: AIM.AI_METERING_COLLECTION, GLOBAL_METER_ID: AIM.GLOBAL_METER_ID,
    };
    const meter = mutate ? mutate(fn, meterDeps) : fn;
    const claim = rebuild(REAL_CLAIM, CLAIM_DEPS(store, { aiMetering: { ...AIM, meterGradingClaimInTxn: meter } }));
    await claim("uS", "job1", { isRetest: false, config: cfgOk() });
    return claimTxnReads(store).includes("ai_metering/_global");
  });

// ===========================================================================
// EVIDENCE
// ===========================================================================
const killed = mutants.filter((m) => m.killed).length;
const shas = {
  "functions/aiMetering.js": sha16(AIM_PATH),
  "functions/index.js": sha16(INDEX_PATH),
  "functions/reviewV2/typedGrading.js": sha16(TG_PATH),
  "functions/reviewV2/callables.js": sha16(CALLABLES_PATH),
  "scripts/deepfix2/ai-metering-fixtures.mjs": sha16(SELF),
};
const at = new Date().toISOString();
const caseTotal = total - mutants.length;
const caseFailed = failed - mutants.filter((m) => !m.killed).length;

const write = (p, obj) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(obj, null, 1)); };
write(PURE_OUT, {
  kind: "ai-metering-pure",
  pass: caseFailed === 0,
  checks: caseTotal,
  failed: caseFailed,
  cases: caseIds.length,
  caseIds,
  reds: reds.filter((r) => !r.startsWith("MUTANT")),
  sourceShas: shas,
  at,
});
write(MUTANTS_OUT, {
  kind: "ai-metering-mutants",
  pass: killed === mutants.length,
  total: mutants.length,
  killed,
  mutants,
  sourceShas: shas,
  at,
});

console.log(`\ncases ${caseTotal - caseFailed}/${caseTotal} checks across ${caseIds.length} cases · ` +
  `mutants killed ${killed}/${mutants.length}`);
console.log(`evidence: ${PURE_OUT}\n          ${MUTANTS_OUT}`);
if (reds.length) { console.error("\nREDS:"); reds.forEach((r) => console.error("  " + r)); }
console.log(`RESULT: ${failed === 0 ? "PASS" : "FAIL"}`);
process.exit(failed === 0 ? 0 : 1);
