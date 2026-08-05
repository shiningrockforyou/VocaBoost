/**
 * ============================================================================
 * DEEPFIX2 · ai-metering-build — THE AI-GRADING METER + THE RE-TEST SPEND CAP
 * ============================================================================
 * Contract (FROZEN, 15_H6_SCHEMAS_AND_CONTRACTS.md §5 + §6, implemented here —
 * not redesigned):
 *   · `ai_metering/{uid}` + `ai_metering/_global`, shape `{count, windowStart}`
 *     per period, "incremented in the grading-job claim txn"
 *   · per-job `aiCallCount` on `grading_jobs` (written by the claim txn itself,
 *     functions/index.js `claimOrRecoverGradingJob`)
 * Law R2-20: EVERY AI-grading call is metered (per student + global), the
 * grading job being the natural counting point.
 *
 * THE ONE THING THIS MODULE EXISTS TO GET RIGHT
 * ---------------------------------------------
 * COUNT EVERYTHING, ENFORCE NARROWLY. Metering (increment + record) applies to
 * every AI-grading call. REFUSAL applies ONLY to the optional re-test/rerun
 * path. A live or required typed test — a new-word test, a review test, a
 * retake — must NEVER be refused by this meter, whatever the counters say.
 * Cost control may degrade an optional feature; it may not break a student's
 * required work. 947 students are on the live typed path today.
 *
 * WHY THAT NEEDED CODE AND NOT JUST A COMMENT. The counting point named by the
 * contract (`claimOrRecoverGradingJob`) carried NO rerun/retest discriminator:
 * the `kind: "rerun"` fingerprint lived only up at reviewV2/callables.js, on the
 * presentation. A naive cap at the claim txn would therefore have refused LIVE
 * typed tests the moment the cap tripped. The discriminator is now THREADED —
 * an explicit argument from the caller that knows `kind`
 * (callables.js → typedGrading.js → claimOrRecoverGradingJob) — never inferred
 * from a doc id, a document name, or a heuristic. And it is STRICT:
 *
 *      ABSENCE OF THE DISCRIMINATOR READS AS "LIVE", NEVER AS "RETEST".
 *
 * `isRetest !== true` ⇒ allowed, full stop. undefined, null, "true", 1 and a
 * missing third argument are all LIVE. The legacy public `gradeTypedTest`
 * callable — the path 947 students use today — passes nothing at all and is
 * therefore uncappable by construction.
 *
 * FAILURE SEMANTICS (asymmetric, deliberately)
 *   · config unreadable / counter read fails ⇒ the LIVE path proceeds
 *     (fail-OPEN — required work is never blocked on an infra hiccup) and the
 *     RETEST path refuses (fail-CLOSED — an optional feature declining is
 *     cheap, an uncapped bill is not).
 *   · a counter read that fails still lets the grade run; it only skips the
 *     increment (we will not write a count we could not read). The meter
 *     under-counts during an outage rather than blocking anyone.
 *   · the increment lives in the claim txn, which runs BEFORE the grader, so an
 *     increment failure can never fail a grade that already ran.
 *
 * IDEMPOTENCY. The counters increment in the SAME transaction that claims the
 * job, and ONLY on the two branches that actually invoke the grader (a fresh
 * claim and an expired-lease takeover). `return_cached` and `in_progress` run
 * no grader and count nothing, so a retried/recovered claim of an
 * already-graded job never double-counts.
 *
 * THE WINDOW is the KST calendar day — the SAME day law already canonical in
 * this codebase (`kstDateString`, reviewV2/completion.js, which keys
 * `users/{uid}/streak_credits/{kstDate}` under R2-21). It is reused, not
 * re-implemented: there is one day law here, not two.
 *
 * WRITE POSTURE. `ai_metering/*` is server-only-written (Admin SDK bypasses
 * rules); firestore.rules already carries the `match /ai_metering/{meterId}`
 * clause (teacher-gated read, every client write denied), and
 * `system_config/ai_metering` has no rules match at all ⇒ client default-deny.
 * No rules change accompanies this module.
 */

"use strict";

/** Firestore locations. The limits doc is DELIBERATELY not a sub-object of
 *  `system_config/review_v2`:
 *   (a) `resolveReviewConfig` resolves a malformed field in that doc to HOLD,
 *       so a typo'd spend limit would become a review-engine OUTAGE — the exact
 *       failure class this fold exists to prevent;
 *   (b) the LEGACY grading path has no classId/listId and cannot call
 *       `resolveReviewConfig(db, {classId, listId})` at all;
 *   (c) `system_config/review_v2` is the ACTIVATION BARRIER joined into
 *       transaction read sets — a spend knob there would serialize limit edits
 *       against engine mints. */
const AI_METERING_CONFIG_PATH = "system_config/ai_metering";
const AI_METERING_COLLECTION = "ai_metering";
const GLOBAL_METER_ID = "_global";

/**
 * DEFAULTS, NOT TRUTHS. These are what the meter uses when
 * `system_config/ai_metering` is absent or a field is malformed; the operator
 * changes them by writing that doc, not by editing this file. A limit is
 * honoured only as an integer ≥ 1 — a malformed value falls back to the default
 * (never to "unlimited", which would silently re-open the bill, and never to
 * HOLD, which would take the engine down for a config typo).
 */
const AI_METERING_DEFAULTS = Object.freeze({
  perStudentDailyLimit: 40,
  globalDailyLimit: 6000,
});

/**
 * THE REFUSAL. A distinct, NON-TRANSIENT status: polling cannot clear it (the
 * window is a KST day) and recomposing cannot clear it either (a new
 * presentation is a new job key, still capped). It is the third member of the
 * frozen typed-refusal family, beside `grading_in_progress` (transient — poll)
 * and `grade_unusable` (permanent — recompose once): this one is
 * "not now, and not by retrying" — render it and stop.
 * MCQ re-tests are unmetered and stay available, which is why the message names
 * them as the alternative.
 */
const PRACTICE_LIMIT_STATUS = "practice_limit_reached";
const PRACTICE_LIMIT_MESSAGE =
  "You've reached today's practice-grading limit — try again tomorrow, " +
  "or use a multiple-choice re-test.";

/**
 * THE WINDOW KEY — the KST calendar date, REUSING the codebase's one day law.
 * Required lazily so that adding this module to index.js's top-level requires
 * cannot reorder the reviewV2 module graph at cold start (the same idiom, and
 * the same reason, as typedGrading.js's `gradingJobs()`); node caches the
 * module, so this is a map lookup per call.
 * @param {number} nowMs
 * @returns {string} e.g. "2026-08-05"
 */
function meterWindowKey(nowMs) {
  const {kstDateString} = require("./reviewV2/completion");
  return kstDateString(nowMs);
}

/**
 * Coerce a raw config doc into usable limits. PURE.
 * @param {object|null} raw
 * @returns {{perStudentDailyLimit: number, globalDailyLimit: number}}
 */
function normalizeLimits(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const pick = (v, dflt) => (Number.isInteger(v) && v >= 1 ? v : dflt);
  return {
    perStudentDailyLimit: pick(src.perStudentDailyLimit, AI_METERING_DEFAULTS.perStudentDailyLimit),
    globalDailyLimit: pick(src.globalDailyLimit, AI_METERING_DEFAULTS.globalDailyLimit),
  };
}

/**
 * Read the limits. NON-TRANSACTIONAL by design — the caller does this OUTSIDE
 * the claim transaction so the config doc never joins the txn's read set.
 * An ABSENT doc is not an error: the doc is optional and will not exist at
 * deploy, so absent ⇒ defaults. Only a read that THREW is "unreadable", and
 * that is the only case that makes a retest refuse.
 * @param {FirebaseFirestore.Firestore} db
 * @returns {Promise<{status: "ok"|"unreadable", present: boolean,
 *   limits: {perStudentDailyLimit: number, globalDailyLimit: number},
 *   reason?: string}>}
 */
async function readMeteringConfig(db) {
  try {
    const snap = await db.doc(AI_METERING_CONFIG_PATH).get();
    return {
      status: "ok",
      present: snap.exists === true,
      limits: normalizeLimits(snap.exists ? snap.data() : null),
    };
  } catch (err) {
    return {
      status: "unreadable",
      present: false,
      limits: {...AI_METERING_DEFAULTS},
      reason: err && err.message ? err.message : String(err),
    };
  }
}

/**
 * The count already spent in THIS window. PURE — and this is where the window
 * rollover lives: a counter stamped with any other `windowStart` is a PREVIOUS
 * day's counter and reads as 0, so the day boundary resets by construction
 * (there is no sweeper and nothing to schedule).
 * @param {object|null} data the stored `ai_metering/*` document data
 * @param {string} windowKey
 * @returns {number}
 */
function counterAt(data, windowKey) {
  if (!data || typeof data !== "object") return 0;
  if (data.windowStart !== windowKey) return 0;
  return Number.isInteger(data.count) && data.count > 0 ? data.count : 0;
}

/**
 * The document to write for one metered call. PURE. `{count, windowStart}` is
 * the frozen shape; `updatedAtMs` is additive ops metadata (a plain number, not
 * a FieldValue sentinel — sentinels do not survive a cross-module-instance
 * `instanceof` in the emulator laps).
 * @param {number} current
 * @param {string} windowKey
 * @param {number} nowMs
 */
function nextCounter(current, windowKey, nowMs) {
  return {count: current + 1, windowStart: windowKey, updatedAtMs: nowMs};
}

/**
 * ===========================================================================
 * THE CLAUSE. Everything above is plumbing; this is the decision.
 * ===========================================================================
 * Read it top to bottom — the ORDER is the safety property:
 *   1. NOT strictly a retest ⇒ ALLOWED. This clause runs before any limit is
 *      even looked at, so no counter value, no config state and no bug below it
 *      can refuse a live or required typed test.
 *   2. retest + the meter could not be read ⇒ REFUSED (fail-closed).
 *   3. retest + per-student count at or above the limit ⇒ REFUSED.
 *   4. retest + global count at or above the limit ⇒ REFUSED.
 * `>=` compares the count BEFORE this call, so a limit of N permits exactly N
 * metered calls per KST day: at 39 spent of 40 the 40th is allowed; at 40 spent
 * the 41st is refused.
 * @param {{isRetest: boolean, meterStatus: "ok"|"unreadable",
 *   studentCount: number, globalCount: number,
 *   limits: {perStudentDailyLimit: number, globalDailyLimit: number}}} input
 * @returns {{allowed: boolean, scope: string|null, reason: string}}
 */
function decideMetering({isRetest, meterStatus, studentCount, globalCount, limits}) {
  if (isRetest !== true) return {allowed: true, scope: null, reason: "live"};
  if (meterStatus !== "ok") {
    return {allowed: false, scope: "unavailable", reason: "meter unreadable"};
  }
  if (studentCount >= limits.perStudentDailyLimit) {
    return {allowed: false, scope: "student", reason: "per-student daily limit"};
  }
  if (globalCount >= limits.globalDailyLimit) {
    return {allowed: false, scope: "global", reason: "global daily limit"};
  }
  return {allowed: true, scope: null, reason: "under cap"};
}

/**
 * The transactional half: READ the two counters inside the caller's claim
 * transaction, decide, and hand back a committer. Called ONLY from the two
 * grading branches of `claimOrRecoverGradingJob`, and always BEFORE that
 * transaction's first write (Firestore requires all reads first).
 *
 * The counter read is wrapped: a read that throws must not abort a LIVE
 * student's claim, so it degrades to `meterStatus:"unreadable"` — which
 * clause 1 above ignores for live traffic and clause 2 refuses for a retest.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.Transaction} tx
 * @param {{uid: string, isRetest: boolean, config: object|null, nowMs: number}} args
 * @returns {Promise<{allowed: boolean, scope: string|null, reason: string,
 *   windowKey: string, meterStatus: string, counterStatus: string,
 *   studentCount: number, globalCount: number, commit: Function}>}
 *   `commit(tx)` applies both increments; it is a NO-OP when the counters could
 *   not be read, and the caller never calls it on a refusal (a refused call is
 *   not an AI call and must not be counted).
 */
async function meterGradingClaimInTxn(db, tx, {uid, isRetest, config, nowMs}) {
  const windowKey = meterWindowKey(nowMs);
  const retest = isRetest === true;
  const limits = normalizeLimits(config && config.limits ? config.limits : null);
  const studentRef = db.collection(AI_METERING_COLLECTION).doc(uid);
  // A uid can never be "_global" (Firebase auth uids are 28-char alphanumerics),
  // so the aggregate doc cannot collide with a student doc.
  const globalRef = db.collection(AI_METERING_COLLECTION).doc(GLOBAL_METER_ID);

  let counterStatus = "ok";
  let studentCount = 0;
  let globalCount = 0;
  try {
    if (retest) {
      // ENFORCEMENT LEG: the global counter is authority here, so it is read AND
      // written INSIDE the transaction — exactness matters and rerun volume is
      // optional and low, so the contention is negligible.
      const [studentSnap, globalSnap] = await tx.getAll(studentRef, globalRef);
      studentCount = counterAt(studentSnap.exists ? studentSnap.data() : null, windowKey);
      globalCount = counterAt(globalSnap.exists ? globalSnap.data() : null, windowKey);
    } else {
      // ★ LIVE LEG — THE GLOBAL DOC IS NOT TOUCHED IN THIS TRANSACTION AT ALL.
      // [contention fix, 2026-08-05, measured by the independent audit.] Reading
      // and writing `ai_metering/_global` inside every live claim serialized all
      // 947 students' typed claims on ONE document. A/B on the emulator: 80
      // concurrent live claims went from 80/80 granted in 0.116s to 2/80 granted
      // in 21s, the other 78 aborting on lock timeout. The emulator locks
      // pessimistically and production retries optimistically, so that threshold
      // is NOT a production number — but the platform-independent fact is that a
      // single-document write bottleneck appeared on the live path where none
      // existed, against Firestore's ~1 sustained write/sec/document guidance.
      // It could never REFUSE a live test (clause 1 of decideMetering guarantees
      // that), but it could make a live submit FAIL with an infra error it used
      // to survive — which is the same outage by another door.
      // The global increment for a live call is therefore DEFERRED to AFTER the
      // claim commits (see `incrementGlobalMeter`): no lock, no read set, and
      // nothing a student ever waits on. `globalCount` stays 0 here and is
      // NEVER consulted for a live call — `decideMetering`'s first clause
      // returns before any limit is looked at.
      const studentSnap = await tx.get(studentRef);
      studentCount = counterAt(studentSnap.exists ? studentSnap.data() : null, windowKey);
    }
  } catch (err) {
    counterStatus = "unreadable";
  }
  // The CONFIG status and the COUNTER status are different failures and are
  // combined only for the refusal decision: a config outage must not stop the
  // meter from COUNTING (R2-20 counts everything), it only stops us from
  // trusting a limit — which matters solely on the retest path.
  const configStatus = config && config.status === "unreadable" ? "unreadable" : "ok";
  const meterStatus = configStatus === "ok" && counterStatus === "ok" ? "ok" : "unreadable";

  const decision = decideMetering({
    isRetest: isRetest === true,
    meterStatus,
    studentCount,
    globalCount,
    limits,
  });

  return {
    ...decision,
    windowKey,
    meterStatus,
    counterStatus,
    studentCount,
    globalCount,
    // Set ONLY on the live leg, and only when the call is actually going to
    // grade: the caller must schedule this AFTER the transaction commits.
    // Independent of `counterStatus` — a failed STUDENT read says nothing about
    // the global doc, and the deferred path does its own read.
    deferredGlobal: decision.allowed && !retest ? {windowKey, nowMs} : null,
    commit(txn) {
      if (counterStatus !== "ok") return false;
      // The per-student counter is naturally sharded — one document per student,
      // so it is not a hot spot and stays transactional on BOTH paths.
      txn.set(studentRef, nextCounter(studentCount, windowKey, nowMs), {merge: true});
      // The global counter is transactional on the ENFORCEMENT leg only.
      if (retest) {
        txn.set(globalRef, nextCounter(globalCount, windowKey, nowMs), {merge: true});
      }
      return true;
    },
  };
}

/**
 * THE DEFERRED GLOBAL INCREMENT (live leg only) — runs AFTER the claim txn has
 * committed, outside any transaction, and is never awaited by the request path.
 *
 * TWO PATHS, and the split is the whole design:
 *
 *  FAST PATH — the window is already today's (true for every call of the day
 *  except the very first): one non-transactional read + one atomic
 *  `FieldValue.increment(1)`. Neither takes a lock, neither joins a transaction
 *  read set, and increments are applied server-side so N concurrent writers
 *  compose to +N with no read-modify-write race. This is >99.99% of traffic.
 *
 *  SLOW PATH — ONCE PER KST DAY, when this is the first call of a new window:
 *  a tiny transaction that folds the rollover AND this call's own increment into
 *  a single write. It MUST be transactional, and this was measured, not assumed:
 *  a blind `{count: 1, windowStart}` reset raced itself under a burst and N
 *  concurrent first-calls-of-the-window collapsed to a count of 1 (probe: 50
 *  concurrent → globalCount 1), which would have left the global budget guard
 *  reading near-zero all day. Folding the increment into the guarded txn means a
 *  racer that arrives after the winner sees today's window, reads the REAL
 *  current count, and writes count+1 — so no increment is wiped by the reset.
 *  The contention is real but it is (a) once per day and (b) entirely off the
 *  student's path: nothing awaits this.
 *
 * ACCEPTED TRADE-OFF: this is a BUDGET GUARD, not an accounting ledger. A crash
 * between the claim commit and this write — or a slow-path racer that gives up
 * at the once-a-day rollover instant — loses a small number of increments.
 * Under-counting is the safe direction: it can only DELAY a refusal on the
 * optional rerun path. It can never refuse required work, and it never inflates.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{increment: Function}} FieldValue injected by the caller so this
 *   module takes no firebase-admin dependency and stays fixture-drivable
 * @param {{windowKey: string, nowMs: number}} deferred
 * @returns {Promise<"incremented"|"window-reset">}
 */
async function incrementGlobalMeter(db, FieldValue, {windowKey, nowMs}) {
  const ref = db.collection(AI_METERING_COLLECTION).doc(GLOBAL_METER_ID);
  const snap = await ref.get();
  if (snap.exists === true && snap.data().windowStart === windowKey) {
    await ref.set({count: FieldValue.increment(1), updatedAtMs: nowMs}, {merge: true});
    return "incremented";
  }
  await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    // 0 when the stored window is stale — the rollover IS this read.
    const current = counterAt(s.exists ? s.data() : null, windowKey);
    tx.set(ref, nextCounter(current, windowKey, nowMs), {merge: true});
  });
  return "window-reset";
}

/**
 * In-flight deferred writes. Production-inert bookkeeping (a Set that empties
 * itself); it exists so a FIXTURE or the emulator lap can await a write the
 * request path deliberately does not await — the alternative is a lap that
 * asserts against a race.
 */
const _inflightGlobalMeter = new Set();

/**
 * Fire-and-forget the deferred global increment. The error is swallowed and
 * handed to `onError` for logging: a failed global increment must never fail or
 * delay a grade that has already been claimed.
 */
function scheduleGlobalMeterIncrement(db, FieldValue, deferred, onError) {
  const p = incrementGlobalMeter(db, FieldValue, deferred)
    .catch((err) => { if (typeof onError === "function") onError(err); })
    .then(() => { _inflightGlobalMeter.delete(p); });
  _inflightGlobalMeter.add(p);
  return p;
}

/** Await every in-flight deferred write (fixtures/lap only; bounded). */
async function settleGlobalMeterWrites() {
  for (let i = 0; i < 20 && _inflightGlobalMeter.size > 0; i++) {
    await Promise.allSettled([..._inflightGlobalMeter]);
  }
}

/**
 * The DATA refusal the engine returns to the client. Carries the student-facing
 * sentence on the SERVER payload so the client leg is wording-only.
 * @param {string|null} scope "student" | "global" | "unavailable"
 */
function practiceLimitRefusal(scope) {
  return {
    status: PRACTICE_LIMIT_STATUS,
    scope: typeof scope === "string" && scope.length > 0 ? scope : "student",
    message: PRACTICE_LIMIT_MESSAGE,
  };
}

module.exports = {
  // Firestore locations + frozen names
  AI_METERING_CONFIG_PATH,
  AI_METERING_COLLECTION,
  GLOBAL_METER_ID,
  AI_METERING_DEFAULTS,
  PRACTICE_LIMIT_STATUS,
  PRACTICE_LIMIT_MESSAGE,
  // pure clauses (fixture-facing)
  meterWindowKey,
  normalizeLimits,
  counterAt,
  nextCounter,
  decideMetering,
  practiceLimitRefusal,
  // Firestore-facing
  readMeteringConfig,
  meterGradingClaimInTxn,
  incrementGlobalMeter,
  scheduleGlobalMeterIncrement,
  settleGlobalMeterWrites,
};
