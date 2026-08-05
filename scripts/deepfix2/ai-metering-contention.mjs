#!/usr/bin/env node
/**
 * ============================================================================
 * ai-metering-build — THE CONTENTION A/B: does the meter bottleneck the LIVE
 * typed path on `ai_metering/_global`?
 * ============================================================================
 * WHY THIS EXISTS. The fold's first cut read AND wrote the single
 * `ai_metering/_global` document inside EVERY claim transaction, live included.
 * The independent audit measured what that costs: 80 concurrent live claims fell
 * from 80/80 granted in ~0.1s to 2/80 granted in ~21s, the other 78 aborting on
 * lock timeout. The cap could never REFUSE a live test (decideMetering's first
 * clause guarantees that), but a live submit could FAIL with an infra error it
 * previously survived — the same outage by another door. Ledger E5 had called
 * this "well inside Firestore's tolerance" with NO measurement behind it; this
 * script is the measurement, and it is worse than the card implied.
 *
 * HONEST CAVEAT, carried from the audit: the Firestore EMULATOR locks
 * pessimistically; production Firestore retries optimistically. The absolute
 * thresholds below are therefore NOT production numbers. What IS
 * platform-independent — and what this measures as a RELATIVE A/B on one
 * engine — is whether a single-document write bottleneck exists on the live
 * path at all, against Firestore's ~1 sustained write/sec/document guidance.
 *
 * THE THREE VARIANTS, all built from REAL source text and run against the SAME
 * emulator so nothing but the claim logic differs:
 *   BASELINE       `git show <PRE_FOLD>:functions/index.js` — the claim txn as it
 *                  shipped BEFORE this fold; contains no meter at all.
 *   GLOBAL-IN-TXN  the CURRENT claim txn + an aiMetering whose
 *                  `meterGradingClaimInTxn` has its live/retest split MUTATED
 *                  away, i.e. the pre-fix behaviour reconstructed from shipped
 *                  bytes. (This is the same mutation as fixture mutant M12, so
 *                  the probe and the mutant cannot drift apart.)
 *   SHIPPED        the current code: the global counter is deferred to AFTER the
 *                  claim commits on the live leg.
 *
 * ACCEPTANCE: SHIPPED returns to BASELINE's order of magnitude — every claim
 * granted, zero rejections, at 20/50/80 concurrent LIVE claims.
 *
 * RUNBOOK:
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore \
 *     --project vocaboost-879c2 "node scripts/deepfix2/ai-metering-contention.mjs"
 * Evidence: docs/plans/deepfix2/evidence/ai-metering-contention.json
 * (AI_METERING_CONTENTION_OUT redirects it.)
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { requireEmulatorEnv, connectEmulator, sha16, writeReceipt } from "./lib/fold-harness.mjs";

requireEmulatorEnv();

const OUT = process.env.AI_METERING_CONTENTION_OUT
  || "/app/docs/plans/deepfix2/evidence/ai-metering-contention.json";
/** The commit whose functions/index.js predates this fold (verified below to
 *  contain ZERO aiMetering references — the probe refuses otherwise). */
const PRE_FOLD = process.env.AI_METERING_PRE_FOLD || "094bbbb";
const BURSTS = [20, 50, 80];

const { fnRequire, db, wipeEmulator } = connectEmulator();
const AIM = fnRequire("/app/functions/aiMetering.js");
const { FieldValue } = fnRequire("firebase-admin/firestore");
const crypto = fnRequire("crypto");

// ---- build the three claim variants from REAL source text -----------------
function extractClaim(src) {
  const m = src.match(/async function claimOrRecoverGradingJob[\s\S]*?\n\}\n/);
  if (!m) throw new Error("could not extract claimOrRecoverGradingJob");
  return m[0];
}
function buildFn(src, deps) {
  const names = Object.keys(deps);
  return new Function(...names, `return (${src});`)(...names.map((n) => deps[n]));
}
/** The closure `meterGradingClaimInTxn` needs when rebuilt from its own text. */
const METER_DEPS = {
  counterAt: AIM.counterAt, decideMetering: AIM.decideMetering, nextCounter: AIM.nextCounter,
  normalizeLimits: AIM.normalizeLimits, meterWindowKey: AIM.meterWindowKey,
  AI_METERING_COLLECTION: AIM.AI_METERING_COLLECTION, GLOBAL_METER_ID: AIM.GLOBAL_METER_ID,
};
/** Rebuild `meterGradingClaimInTxn` from SHIPPED text with N mutations, each
 *  asserted to match EXACTLY ONCE (a silent no-match would fake a clean A/B). */
function rebuildMeter(mutations) {
  let src = AIM.meterGradingClaimInTxn.toString();
  for (const [from, to] of mutations) {
    const hits = src.split(from).length - 1;
    if (hits !== 1) throw new Error(`contention anchor matched ${hits}x (want 1): ${JSON.stringify(from)}`);
    src = src.replace(from, to);
  }
  const names = Object.keys(METER_DEPS);
  return new Function(...names, `return (${src});`)(...names.map((n) => METER_DEPS[n]));
}

const shippedSrc = extractClaim(readFileSync("/app/functions/index.js", "utf8"));
const baseSrc = extractClaim(execFileSync("git", ["-C", "/app", "show", `${PRE_FOLD}:functions/index.js`],
  { encoding: "utf8", maxBuffer: 1 << 28 }));
if (/aiMetering/.test(baseSrc)) {
  console.error(`FATAL: ${PRE_FOLD} already contains the meter — it is not a pre-fold baseline`);
  process.exit(2);
}
if (!/aiMetering/.test(shippedSrc)) {
  console.error("FATAL: the shipped claim has no meter — nothing to A/B");
  process.exit(2);
}

// THE PRE-FIX RECONSTRUCTION: collapse the live/retest split so BOTH legs read
// and write the global doc transactionally, exactly as the first cut did.
const globalInTxnMeter = {
  ...AIM,
  meterGradingClaimInTxn: rebuildMeter([
    // the READ split: make the live leg read the global doc transactionally again
    ["    if (retest) {\n      // ENFORCEMENT LEG", "    if (true) {\n      // ENFORCEMENT LEG"],
    // the WRITE split: make commit() write the global doc on the live leg again
    ["      if (retest) {\n        txn.set(globalRef,", "      if (true) {\n        txn.set(globalRef,"],
    // ...and stop deferring, so the reconstruction counts ONCE like the real
    // first cut did (without this it would write both transactionally AND
    // post-commit, doubling the count and misrepresenting the variant).
    ["deferredGlobal: decision.allowed && !retest ? {windowKey, nowMs} : null,",
      "deferredGlobal: null,"],
  ]),
};

const depsFor = (aiMetering) => ({
  db, crypto, HttpsError: class extends Error {},
  GRADE_JOB_LEASE_MS: 180000, GRADE_JOB_VERSION: 1, FieldValue,
  aiMetering,
  logger: { warn() {} },
});
const VARIANTS = [
  { id: "BASELINE", label: "BASELINE  (pre-fold, no meter)", fn: buildFn(baseSrc, depsFor(AIM)) },
  { id: "GLOBAL_IN_TXN", label: "GLOBAL-IN-TXN (the first cut)", fn: buildFn(shippedSrc, depsFor(globalInTxnMeter)) },
  { id: "SHIPPED", label: "SHIPPED   (global deferred)", fn: buildFn(shippedSrc, depsFor(AIM)) },
];

// ---- the burst ------------------------------------------------------------
const WK = AIM.meterWindowKey(Date.now());
/**
 * @param {boolean} coldWindow when false (the DEFAULT and the realistic case)
 *   `ai_metering/_global` already carries today's window, which is true for
 *   every call of the day except the very first. When true the burst races the
 *   once-per-KST-day rollover — measured separately and reported, never hidden.
 */
async function burst(variant, n, coldWindow = false) {
  await wipeEmulator();
  if (!coldWindow) {
    await db.collection("ai_metering").doc("_global")
      .set({count: 0, windowStart: WK, updatedAtMs: Date.now()});
  }
  const t0 = Date.now();
  // `undefined` third arg = NO discriminator = the LIVE path, exactly as the
  // legacy public callable calls it for the 947 production students.
  const res = await Promise.allSettled(
    Array.from({ length: n }, (_, i) => variant.fn(`u${i}`, `job-${variant.id}-${i}`, undefined)));
  const ms = Date.now() - t0;
  await AIM.settleGlobalMeterWrites();
  const granted = res.filter((r) => r.status === "fulfilled" && r.value.action === "grade").length;
  const rejected = res.filter((r) => r.status === "rejected").length;
  const firstRejection = res.find((r) => r.status === "rejected")?.reason?.message?.slice(0, 140) ?? null;
  const jobs = (await db.collection("grading_jobs").get()).size;
  const g = await db.collection("ai_metering").doc("_global").get();
  const globalCount = g.exists ? AIM.counterAt(g.data(), WK) : 0;
  const row = { variant: variant.id, n, coldWindow, granted, rejected, jobsWritten: jobs, globalCount, ms, firstRejection };
  console.log(`  ${variant.label.padEnd(32)} n=${String(n).padStart(2)} granted=${String(granted).padStart(2)} ` +
    `rejected=${String(rejected).padStart(2)} jobs=${String(jobs).padStart(2)} ` +
    `global=${String(globalCount).padStart(2)}${globalCount === n ? " EXACT" : "      "} ${ms}ms`);
  if (firstRejection) console.log(`      first rejection: ${firstRejection}`);
  return row;
}

const rows = [];
for (const n of BURSTS) {
  console.log(`\n== ${n} CONCURRENT LIVE CLAIMS (steady state: the window already exists)`);
  for (const v of VARIANTS) rows.push(await burst(v, n));
}
// The once-per-KST-day rollover instant, measured and reported rather than
// assumed away. It is the only moment the deferred path takes a lock, and the
// claim path must STILL be clean because nothing awaits that write.
console.log("\n== COLD WINDOW — the once-per-day rollover instant (SHIPPED only)");
const coldRows = [];
for (const n of BURSTS) coldRows.push(await burst(VARIANTS[2], n, true));

// ---- verdict, derived only from the rows above ----------------------------
const at = (id, n) => rows.find((r) => r.variant === id && r.n === n);
const shippedClean = BURSTS.every((n) => at("SHIPPED", n).rejected === 0 && at("SHIPPED", n).granted === n);
const baselineClean = BURSTS.every((n) => at("BASELINE", n).rejected === 0 && at("BASELINE", n).granted === n);
// order of magnitude: shipped must be within 10x of baseline wall time (+50ms floor
// so a sub-100ms baseline cannot make the ratio meaningless)
const withinOrder = BURSTS.every((n) =>
  at("SHIPPED", n).ms <= Math.max(at("BASELINE", n).ms * 10, at("BASELINE", n).ms + 50));
const regressionWasReal = BURSTS.some((n) =>
  at("GLOBAL_IN_TXN", n).rejected > 0 || at("GLOBAL_IN_TXN", n).granted < n);
// the meter must still COUNT what it lets through, or the budget guard is dead
const shippedExact = BURSTS.every((n) => at("SHIPPED", n).globalCount === n);
// even at the once-a-day rollover, no CLAIM may be lost (the write is deferred)
const coldClaimsClean = coldRows.every((r) => r.rejected === 0 && r.granted === r.n);
const pass = shippedClean && baselineClean && withinOrder && shippedExact && coldClaimsClean;

console.log("\n---- VERDICT -------------------------------------------------");
console.log(`  baseline clean (all granted, 0 rejected) : ${baselineClean}`);
console.log(`  the regression is REAL and reproduced    : ${regressionWasReal}`);
console.log(`  SHIPPED clean (all granted, 0 rejected)  : ${shippedClean}`);
console.log(`  SHIPPED within an order of magnitude     : ${withinOrder}`);
console.log(`  SHIPPED counts EXACTLY (guard still real): ${shippedExact}`);
console.log(`  cold-window rollover loses no CLAIM      : ${coldClaimsClean}`);
console.log(`  RESULT: ${pass ? "PASS — the live path is no longer bottlenecked on _global" : "FAIL"}`);

writeReceipt(OUT, {
  kind: "ai-metering-contention",
  pass,
  preFoldCommit: PRE_FOLD,
  bursts: BURSTS,
  baselineClean, regressionWasReal, shippedClean, withinOrder, shippedExact, coldClaimsClean,
  rows,
  coldWindowRows: coldRows,
  note: "Firestore EMULATOR locks pessimistically; production retries optimistically. " +
    "These are RELATIVE A/B numbers on one engine, not production thresholds.",
  sourceShas: {
    "functions/aiMetering.js": sha16("/app/functions/aiMetering.js"),
    "functions/index.js": sha16("/app/functions/index.js"),
    "ai-metering-contention.mjs": sha16("/app/scripts/deepfix2/ai-metering-contention.mjs"),
  },
  at: new Date().toISOString(),
});
console.log(`  receipt: ${OUT}`);
process.exit(pass ? 0 : 1);
