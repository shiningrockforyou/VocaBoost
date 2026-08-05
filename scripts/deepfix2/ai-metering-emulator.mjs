#!/usr/bin/env node
/**
 * ============================================================================
 * ai-metering-build — EMULATOR fixtures: the REAL claim transaction, the REAL
 * engine callables, and the live-vs-retest split end to end
 * ============================================================================
 * The pure suite (ai-metering-fixtures.mjs) proves the CLAUSES against a fake
 * transaction. This suite proves the WIRING against a real Firestore: that the
 * discriminator actually travels callables.js → typedGrading.js → the claim
 * txn, that the counters really land in `ai_metering/*` inside that txn, and
 * that the refusal really comes back as DATA with zero attempt writes.
 *
 * ZERO Anthropic spend: the engine's grader is replaced by typedGrading.js's
 * emulator-only seam, and the ONE legacy-callable case uses an ALL-BLANK answer
 * sheet, which `gradeTypedTest` resolves without ever building an Anthropic
 * client (index.js: `answersForAI.length === 0` ⇒ early finishGrading).
 *
 * THE CASE THIS SUITE EXISTS FOR is E-LIVE: with the meter already over every
 * limit, a LIVE typed submit must still land an attempt. 947 students are on
 * that path.
 *
 * RUNBOOK:
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore \
 *     --project vocaboost-879c2 "node scripts/deepfix2/ai-metering-emulator.mjs"
 * Evidence: docs/plans/deepfix2/evidence/ai-metering-emulator.json
 * (AI_METERING_EMU_OUT redirects it.)
 */
import {
  requireEmulatorEnv, connectEmulator, createSeedHelpers,
  createCaseRunner, sha16, writeReceipt, finalizeRun,
} from "./lib/fold-harness.mjs";

requireEmulatorEnv();

const { fnRequire, db, Timestamp, fft, wrap, wipeEmulator } = connectEmulator();
const INDEX = fnRequire("/app/functions/index.js");
const CALL = fnRequire("/app/functions/reviewV2/callables.js");
const TG = fnRequire("/app/functions/reviewV2/typedGrading.js");
const AIM = fnRequire("/app/functions/aiMetering.js");
const { engineDocId } = fnRequire("/app/functions/reviewV2/composer.js");
const foundation = fnRequire("/app/functions/foundation.js");

const { CASE, check, checkTrue, stats } = createCaseRunner();
const { seedConfig, seedClass, seedWords, seedProgress } = createSeedHelpers({ db, Timestamp, foundation });

const OUT = process.env.AI_METERING_EMU_OUT
  || "/app/docs/plans/deepfix2/evidence/ai-metering-emulator.json";

const call = async (c, uid, data) => wrap(c)({ data, auth: uid === undefined ? undefined : { uid, token: {} } });

// ---- metering helpers (read the REAL docs the REAL txn wrote) --------------
const NOWKEY = () => AIM.meterWindowKey(Date.now());
const meterOf = async (id) => {
  const s = await db.collection("ai_metering").doc(id).get();
  return s.exists ? s.data() : null;
};
/** [contention fix] The global counter is written POST-COMMIT on the live leg,
 *  fire-and-forget. Production deliberately does not await it; a fixture must,
 *  or it asserts against a race. */
const countOf = async (id) => {
  await AIM.settleGlobalMeterWrites();
  const d = await meterOf(id);
  return d ? AIM.counterAt(d, NOWKEY()) : 0;
};
/** Force the meter into a state. Writes exactly what the txn would have. */
const setMeter = async (id, count, windowStart = NOWKEY()) =>
  db.collection("ai_metering").doc(id).set({ count, windowStart, updatedAtMs: Date.now() });
const clearMeters = async () => {
  const snap = await db.collection("ai_metering").get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
};
const attemptCount = async () => (await db.collection("attempts").get()).size;

// The deterministic grader (18_ §6 emulator seam) — the AI cannot run here.
let graderCalls = 0;
const verdictGrader = () => async ({ answers }) => {
  graderCalls++;
  return answers.map((a) => ({
    wordId: a.wordId,
    isCorrect: a.studentResponse === a.correctDefinition,
    reasoning: "",
  }));
};

// ===========================================================================
// SEED — one typed rehearsal class, with a completed past day for the reruns
// ===========================================================================
await wipeEmulator();
await seedConfig({ rehearsalClassIds: ["cM"], queueSize: 8, testSize: 4 });
await seedClass("cM", { listId: "LM", students: ["uM"], asg: { reviewTestType: "typed" } });
await seedWords("LM", 20);
await seedProgress("uM", "cM", "LM", { csd: 3, twi: 20 });
const common = { classId: "cM", listId: "LM", clientContractVersion: 1 };
TG._typedSeam.grade = verdictGrader();

const answersFor = (ids) => ids.map((w) => ({ wordId: w, studentResponse: `def${w.slice(1)}` }));
// frontierDay = currentStudyDay + 1 (seeded csd 3 ⇒ live day 4); day 2 is a
// completed past day, which is what the restudy visit + rerun compose need.
const composeLive = (ck) => call(CALL.reviewV2ComposeSession, "uM", { ...common, logicalDay: 4, composeKey: ck });
const submit = (pid, ans) => call(CALL.reviewV2SubmitAttempt, "uM", { presentationId: pid, answers: ans, clientContractVersion: 1 });

// A real rerun presentation (kind: "rerun" written by the SERVER at compose).
const mint = await call(CALL.reviewV2MintVisit, "uM", { ...common, day: 2 });
if (mint.status !== "visit_minted") {
  console.error(`FATAL: could not mint a restudy visit: ${JSON.stringify(mint)}`);
  process.exit(2);
}
const VISIT = mint.visitId;
const composeRerun = (ck) => call(CALL.reviewV2ComposeRerun, "uM",
  { ...common, visitedDay: 2, half: "review", composeKey: ck, visitId: VISIT });

// ===========================================================================
CASE("E-FINGERPRINT — the discriminator this fold reads is SERVER-authored");
{
  const live = await composeLive("m-live-0");
  const rerun = await composeRerun("m-rerun-0");
  check("both compose", [live.status, rerun.status], ["composed", "composed"]);
  const lp = (await db.doc(`users/uM/review_presentations/${live.presentation.presentationId}`).get()).data();
  const rp = (await db.doc(`users/uM/review_presentations/${rerun.presentation.presentationId}`).get()).data();
  check("a LIVE review presentation is kind:'live'", lp.requestFingerprint.kind, "live");
  check("a RERUN presentation is kind:'rerun'", rp.requestFingerprint.kind, "rerun");
  check("both are typed (so both reach the metered grader)", [lp.testType, rp.testType], ["typed", "typed"]);
}

// ===========================================================================
CASE("E-ENGINE-ONCE — a live typed submit counts EXACTLY once, in the claim txn");
{
  await clearMeters();
  const before = await attemptCount();
  const callsBefore = graderCalls;
  const c = await composeLive("m-once-1");
  const pid = c.presentation.presentationId;
  const r = await submit(pid, answersFor(c.presentation.presentedWordIds));
  check("the attempt lands", [r.status, r.replayed], ["attempt_written", false]);
  check("the AI grader ran once", graderCalls - callsBefore, 1);
  check("per-student counter is 1 (NOT 2 — the inner grade-only call's job leg is inert)", await countOf("uM"), 1);
  check("global counter is 1", await countOf("_global"), 1);
  check("windowStart is the KST date", (await meterOf("uM")).windowStart, NOWKEY());
  const job = (await db.collection("grading_jobs").doc(engineDocId("uM", pid)).get()).data();
  check("the job carries aiCallCount 1", job.aiCallCount, 1);
  check("one new attempt", (await attemptCount()) - before, 1);

  // REPLAY: zero grader, zero counter movement (the caller short-circuits).
  const rep = await submit(pid, answersFor(c.presentation.presentedWordIds));
  check("replay ⇒ replayed envelope", [rep.status, rep.replayed], ["attempt_written", true]);
  check("replay does NOT count", [await countOf("uM"), await countOf("_global")], [1, 1]);
  check("replay calls no grader", graderCalls - callsBefore, 1);
}

// ===========================================================================
CASE("E-LIVE — ★ THE OUTAGE CASE: over BOTH caps, a LIVE typed test still lands");
{
  await clearMeters();
  await setMeter("uM", 40);        // at the default per-student limit
  await setMeter("_global", 6000); // at the default global limit
  const before = await attemptCount();
  const c = await composeLive("m-live-overcap");
  const r = await submit(c.presentation.presentationId, answersFor(c.presentation.presentedWordIds));
  check("the live typed submit is NOT refused", r.status, "attempt_written");
  check("it wrote its attempt", (await attemptCount()) - before, 1);
  check("and it was STILL counted (count everything, enforce narrowly)",
    [await countOf("uM"), await countOf("_global")], [41, 6001]);
}

// ===========================================================================
CASE("E-RETEST — the SAME over-cap state REFUSES a rerun, as DATA, with zero writes");
{
  await clearMeters();
  await setMeter("uM", 40);
  await setMeter("_global", 10);
  const before = await attemptCount();
  const callsBefore = graderCalls;
  const c = await composeRerun("m-retest-capped");
  const pid = c.presentation.presentationId;
  const r = await submit(pid, answersFor(c.presentation.presentedWordIds));
  check("status", r.status, "practice_limit_reached");
  check("scope", r.scope, "student");
  check("a student-facing message rides on the SERVER payload", r.message, AIM.PRACTICE_LIMIT_MESSAGE);
  check("ZERO attempt writes", (await attemptCount()) - before, 0);
  check("ZERO grader calls", graderCalls - callsBefore, 0);
  check("the counter did NOT move", [await countOf("uM"), await countOf("_global")], [40, 10]);
  check("no grading job was claimed", (await db.collection("grading_jobs").doc(engineDocId("uM", pid)).get()).exists, false);

  // RECOMPOSING CANNOT ESCAPE IT: a new presentation is a new job key, still capped.
  const c2 = await composeRerun("m-retest-capped-2");
  const r2 = await submit(c2.presentation.presentationId, answersFor(c2.presentation.presentedWordIds));
  check("E-RECOMPOSE: a fresh rerun presentation is STILL capped (not a recompose loop)",
    r2.status, "practice_limit_reached");
  check("still zero attempts", (await attemptCount()) - before, 0);
}

// ===========================================================================
CASE("E-RETEST-UNDER — the same rerun, under the cap, grades and lands");
{
  await clearMeters();
  await setMeter("uM", 39);   // one call left of the default 40
  const before = await attemptCount();
  const c = await composeRerun("m-retest-under");
  const r = await submit(c.presentation.presentationId, answersFor(c.presentation.presentedWordIds));
  check("the 40th metered call of the day is ALLOWED", r.status, "attempt_written");
  check("one attempt written", (await attemptCount()) - before, 1);
  check("the counter advanced 39 → 40", await countOf("uM"), 40);
  check("the global counter also advanced", await countOf("_global"), 1);
}

// ===========================================================================
CASE("E-MCQ-RERUN — MCQ re-tests are UNMETERED and stay available over the cap");
{
  await clearMeters();
  await setMeter("uM", 999999);
  await setMeter("_global", 999999);
  await db.doc("classes/cM").update({ "assignments.LM.reviewTestType": "mcq" });
  const before = await attemptCount();
  const c = await composeRerun("m-mcq-rerun");
  check("an MCQ rerun composes", [c.status, c.presentation.testType], ["composed", "mcq"]);
  const ids = c.presentation.presentedWordIds;
  const wordSnaps = await Promise.all(ids.map((w) => db.doc(`lists/LM/words/${w}`).get()));
  const mcqAnswers = ids.map((w, i) => ({ wordId: w, studentResponse: wordSnaps[i].data().definition }));
  const r = await submit(c.presentation.presentationId, mcqAnswers);
  check("the MCQ re-test LANDS while far over every cap", r.status, "attempt_written");
  check("one attempt written", (await attemptCount()) - before, 1);
  check("and MCQ counted NOTHING (it never reaches the AI grader)",
    [await countOf("uM"), await countOf("_global")], [999999, 999999]);
  await db.doc("classes/cM").update({ "assignments.LM.reviewTestType": "typed" });
}

// ===========================================================================
CASE("E-LEGACY — the LIVE legacy callable counts, and can NEVER be capped");
{
  await clearMeters();
  await setMeter("uM", 999999);
  await setMeter("_global", 999999);
  // ALL-BLANK sheet ⇒ index.js takes the `answersForAI.length === 0` early exit,
  // so no Anthropic client is ever constructed. ZERO spend.
  const attemptDocId = "legacy-attempt-doc-1";
  const answers = [
    { wordId: "w0", word: "word0", correctDefinition: "def0", studentResponse: "" },
    { wordId: "w1", word: "word1", correctDefinition: "def1", studentResponse: "" },
  ];
  const res = await call(INDEX.gradeTypedTest, "uM", { answers, gradeContext: { attemptDocId } });
  check("the legacy grade returns results", Array.isArray(res.results), true);
  check("blank rows are failed by law", res.results.every((r) => r.isCorrect === false), true);
  check("the LEGACY path is metered", [await countOf("uM"), await countOf("_global")], [1000000, 1000000]);
  const job = (await db.collection("grading_jobs").doc(attemptDocId).get()).data();
  check("its job carries aiCallCount 1", job.aiCallCount, 1);
  check("no attempt was written (grade-only)", res.attemptWritten, undefined);

  // E-POLL: getGradingStatus is read-only — no claim, no count.
  const poll = await call(INDEX.getGradingStatus, "uM", { attemptDocId });
  check("getGradingStatus serves the cached grade", poll.status, "graded");
  check("polling counted NOTHING", [await countOf("uM"), await countOf("_global")], [1000000, 1000000]);

  // and a re-grade of the SAME attemptDocId returns the cache without counting
  const again = await call(INDEX.gradeTypedTest, "uM", { answers, gradeContext: { attemptDocId } });
  check("a retried legacy grade returns the cache", Array.isArray(again.results), true);
  check("and does NOT double-count", [await countOf("uM"), await countOf("_global")], [1000000, 1000000]);
}

// ===========================================================================
CASE("E-CONFIG — limits are CONFIG: a seeded system_config/ai_metering governs");
{
  await clearMeters();
  await db.doc(AIM.AI_METERING_CONFIG_PATH).set({ perStudentDailyLimit: 2, globalDailyLimit: 6000 });
  await setMeter("uM", 2);          // at the SEEDED limit, far under the default 40
  const before = await attemptCount();
  const c = await composeRerun("m-config-capped");
  const r = await submit(c.presentation.presentationId, answersFor(c.presentation.presentedWordIds));
  check("the seeded per-student limit of 2 refuses at 2 spent", [r.status, r.scope], ["practice_limit_reached", "student"]);
  check("zero attempts", (await attemptCount()) - before, 0);

  // the SAME state, live ⇒ allowed
  const cl = await composeLive("m-config-live");
  const rl = await submit(cl.presentation.presentationId, answersFor(cl.presentation.presentedWordIds));
  check("THE OTHER LEG: the same seeded-cap state does NOT refuse a live test", rl.status, "attempt_written");

  // a malformed limit falls back to the DEFAULT (40), not to unlimited
  await db.doc(AIM.AI_METERING_CONFIG_PATH).set({ perStudentDailyLimit: 0, globalDailyLimit: "lots" });
  await setMeter("uM", 5);
  const c2 = await composeRerun("m-config-malformed");
  const r2 = await submit(c2.presentation.presentationId, answersFor(c2.presentation.presentedWordIds));
  check("a malformed limit falls back to the default ⇒ 5 of 40 still grades", r2.status, "attempt_written");
  await db.doc(AIM.AI_METERING_CONFIG_PATH).delete();
}

// ===========================================================================
CASE("E-ROLLOVER — yesterday's exhausted counters do not cap today");
{
  await clearMeters();
  const yesterday = AIM.meterWindowKey(Date.now() - 86400000);
  await setMeter("uM", 40, yesterday);
  await setMeter("_global", 6000, yesterday);
  const before = await attemptCount();
  const c = await composeRerun("m-rollover");
  const r = await submit(c.presentation.presentationId, answersFor(c.presentation.presentedWordIds));
  check("a retest capped YESTERDAY lands TODAY", r.status, "attempt_written");
  check("one attempt", (await attemptCount()) - before, 1);
  check("the counters reset to 1 under today's window", [await countOf("uM"), await countOf("_global")], [1, 1]);
  check("and carry today's windowStart", (await meterOf("uM")).windowStart, NOWKEY());
}

// ===========================================================================
CASE("E-SOLE-WRITER — nothing but the claim txn ever creates an ai_metering doc");
{
  await clearMeters();
  const c = await composeLive("m-sole-writer");
  await submit(c.presentation.presentationId, answersFor(c.presentation.presentedWordIds));
  await AIM.settleGlobalMeterWrites();
  const snap = await db.collection("ai_metering").get();
  check("exactly the two contract documents exist", snap.docs.map((d) => d.id).sort(), ["_global", "uM"]);
  const shapes = snap.docs.map((d) => Object.keys(d.data()).sort().join(","));
  check("both carry the frozen {count, windowStart} shape (+ additive updatedAtMs)",
    [...new Set(shapes)], ["count,updatedAtMs,windowStart"]);
}

// ===========================================================================
CASE("E-LIVE-TXN-GLOBAL-FREE — the contention law, end to end on a real Firestore");
{
  await clearMeters();
  await setMeter("_global", 5);
  await setMeter("uM", 3);
  const c = await composeLive("m-txn-global-free");
  const r = await submit(c.presentation.presentationId, answersFor(c.presentation.presentedWordIds));
  check("the live typed submit lands", r.status, "attempt_written");
  // the per-student counter moved inside the claim txn; the global moved after it
  check("per-student counter advanced transactionally (3 → 4)", await countOf("uM"), 4);
  check("global counter advanced post-commit (5 → 6)", await countOf("_global"), 6);
  // and a RETEST still moves the global INSIDE its txn
  await setMeter("uM", 0);
  const c2 = await composeRerun("m-txn-global-free-retest");
  const r2 = await submit(c2.presentation.presentationId, answersFor(c2.presentation.presentedWordIds));
  check("the rerun lands too", r2.status, "attempt_written");
  check("the rerun also advanced the global (6 → 7)", await countOf("_global"), 7);
}

TG._typedSeam.grade = null;

// ===========================================================================
const s = stats();
writeReceipt(OUT, {
  kind: "ai-metering-emulator",
  pass: s.failed === 0,
  total: s.total,
  failed: s.failed,
  reds: s.reds,
  sourceShas: {
    "functions/aiMetering.js": sha16("/app/functions/aiMetering.js"),
    "functions/index.js": sha16("/app/functions/index.js"),
    "functions/reviewV2/typedGrading.js": sha16("/app/functions/reviewV2/typedGrading.js"),
    "functions/reviewV2/callables.js": sha16("/app/functions/reviewV2/callables.js"),
    "ai-metering-emulator.mjs": sha16("/app/scripts/deepfix2/ai-metering-emulator.mjs"),
  },
  at: new Date().toISOString(),
});
console.log(`\n==== AI-METERING EMULATOR: ${s.total - s.failed}/${s.total} green (receipt: ${OUT})`);
if (s.reds.length) { console.error("REDS:"); s.reds.forEach((r) => console.error("  " + r)); }
await finalizeRun(fft, s.failed);
