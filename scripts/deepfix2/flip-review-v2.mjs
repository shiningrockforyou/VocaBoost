#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — flip-review-v2.mjs: THE R2-48 ACTIVATION TXN (+ kill/re-enable)
 * ============================================================================
 * THE SWITCH IS DAVID'S [frozen — stage (5) of DF2-14; NEVER run by an agent
 * on its own judgment]. This script exists so the transaction is EXACT, the
 * asserts are mechanical, and the receipt is durable.
 *
 * Laws (15_ §7 R2-48 + 14_ §4 choreography):
 *  - FIRST ACTIVATION = ONE audited txn writing `{enabled:true,
 *    firstEnabledAt:serverTimestamp}` TOGETHER; `firstEnabledAt` is written
 *    IFF ABSENT and NEVER cleared/moved afterward — it is the era boundary
 *    for the six label fields (THE STAMPING PREDICATE) and B3's permanent
 *    FATAL guard.
 *  - Every LATER write touches `enabled` only: --kill ⇒ enabled:false
 *    (instant, state-preserving); --reenable ⇒ enabled:true (marker must
 *    already exist; activation mode REFUSES when it does — the first
 *    activation happens once, by construction).
 *  - PRE-FLIP ASSERTS (activation): config doc exists · enabled !== true ·
 *    `rehearsalClassIds` EMPTY · NO `shadow_registry/window` doc [windows
 *    never span the flip] · a FRESH PASSING micro-lap receipt (the final
 *    B4→B1→B3→B4 cycle minutes before — bounds the custody-orphaned tail).
 *  - POST-FLIP ASSERTS: marker exists · enabled true · rehearsal list still
 *    empty · still no window doc.
 *
 * Usage (DRY-RUN by default; nothing writes without --execute):
 *   NODE_PATH=/app/node_modules node scripts/deepfix2/flip-review-v2.mjs \
 *     [--kill | --reenable] [--execute --yes-i-am-david] \
 *     [--lapReceipt <path> --lapMaxAgeMin <n=30>]
 * Activation with --execute REQUIRES --yes-i-am-david AND --lapReceipt.
 * Works against the emulator via FIRESTORE_EMULATOR_HOST (the rehearsal).
 * Exit codes: 0 ok · 2 assert/refusal · 3 post-flip verification failure.
 */

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d = null) => {
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : d;
};
const EXECUTE = has("--execute");
const MODE = has("--kill") ? "kill" : has("--reenable") ? "reenable" : "activate";
if (has("--kill") && has("--reenable")) {
  console.error("FATAL: --kill and --reenable are exclusive");
  process.exit(2);
}

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const CONFIG = "system_config/review_v2";
const WINDOW = "shadow_registry/window";

const fail = (msg) => { console.error(`ASSERT FAIL: ${msg}`); process.exit(2); };

// ---- Read current posture --------------------------------------------------
const cfgSnap = await db.doc(CONFIG).get();
if (!cfgSnap.exists) fail(`${CONFIG} absent — dark-deploy the config doc first (R2-31)`);
const cfg = cfgSnap.data();
const windowSnap = await db.doc(WINDOW).get();
console.log(`[flip] mode=${MODE} execute=${EXECUTE} emulator=${Boolean(process.env.FIRESTORE_EMULATOR_HOST)}`);
console.log(`[flip] current: enabled=${cfg.enabled} firstEnabledAt=${cfg.firstEnabledAt ? cfg.firstEnabledAt.toDate?.().toISOString?.() ?? "SET" : "null"} rehearsalClassIds=${JSON.stringify(cfg.rehearsalClassIds ?? null)} window=${windowSnap.exists}`);

// ---- Mode-specific pre-asserts --------------------------------------------
if (MODE === "activate") {
  if (cfg.enabled === true) fail("enabled is already true — nothing to activate");
  if (cfg.firstEnabledAt != null) {
    fail("firstEnabledAt already set — this is NOT the first activation; use --reenable (the marker never moves)");
  }
  if (!Array.isArray(cfg.rehearsalClassIds) || cfg.rehearsalClassIds.length !== 0) {
    fail(`rehearsalClassIds must be EMPTY at the flip — got ${JSON.stringify(cfg.rehearsalClassIds)}`);
  }
  if (windowSnap.exists) fail("shadow_registry/window exists — windows never span the flip (teardown first)");
  if (EXECUTE) {
    if (!has("--yes-i-am-david")) {
      fail("activation is DAVID'S switch — --execute requires --yes-i-am-david");
    }
    const lapPath = val("--lapReceipt");
    if (!lapPath) fail("--execute activation requires --lapReceipt <path> (the final micro-lap, 14_ §4)");
    let lap;
    try { lap = JSON.parse(readFileSync(lapPath, "utf8")); } catch (e) { fail(`lapReceipt unreadable: ${e.message}`); }
    // THE RECEIPT SCHEMA [r70 C6 — bare {pass:true}/{failed:0} refuse]: the
    // exact artifact b-delta-cycle --receipt emits from a REAL passing chain.
    if (lap.kind !== "trackB-micro-lap" || lap.version !== 1) {
      fail("lapReceipt is not a trackB-micro-lap v1 receipt (run b-delta-cycle with --receipt)");
    }
    if (!Array.isArray(lap.stages) || lap.stages.length === 0 ||
        lap.stages[0] !== "B4" || lap.stages[lap.stages.length - 1] !== "B4") {
      fail("lapReceipt stages must start and end with a B4 verify");
    }
    if (!Number.isInteger(lap.checks) || lap.checks < 1) fail("lapReceipt checks must be a positive count");
    if (lap.failures !== 0) fail("lapReceipt failures must be exactly 0");
    if (typeof lap.runId !== "string" || lap.runId.length === 0) fail("lapReceipt lacks runId");
    if (lap.projectId !== key.project_id) {
      fail(`lapReceipt projectId ${lap.projectId} ≠ this key's ${key.project_id}`);
    }
    if (typeof lap.sourceShas !== "object" || lap.sourceShas === null ||
        Object.keys(lap.sourceShas).length < 5) {
      fail("lapReceipt lacks bound source hashes");
    }
    // Freshness from the CONTENT timestamp [C6 — mtime is touch-spoofable].
    const maxAgeMin = Number(val("--lapMaxAgeMin", "30"));
    const contentMs = Date.parse(lap.contentTimestamp ?? "");
    if (!Number.isFinite(contentMs)) fail("lapReceipt lacks a parseable contentTimestamp");
    const ageMin = (Date.now() - contentMs) / 60000;
    if (!(ageMin >= 0 && ageMin <= maxAgeMin)) {
      fail(`lapReceipt content is ${ageMin.toFixed(1)}min old (max ${maxAgeMin}, future-dated refused) — re-run the micro-lap`);
    }
    console.log(`[flip] micro-lap receipt OK (${lapPath}: ${lap.stages.join("→")}, ${lap.checks} checks, ${ageMin.toFixed(1)}min old, run ${lap.runId})`);
  }
} else if (MODE === "reenable") {
  if (cfg.firstEnabledAt == null) fail("firstEnabledAt absent — a first activation must use the activation mode");
  if (cfg.enabled === true) fail("enabled is already true");
  // Re-enable is a POSTURE decision like activation [r70 L-4]; only --kill
  // (the emergency stop) stays friction-free.
  if (EXECUTE && !has("--yes-i-am-david")) {
    fail("re-enable is DAVID'S call — --execute requires --yes-i-am-david");
  }
} else if (MODE === "kill") {
  if (cfg.enabled !== true) fail("enabled is not true — nothing to kill");
}

if (!EXECUTE) {
  console.log(`[flip] DRY-RUN OK — mode=${MODE} would ${
    MODE === "activate" ? "write {enabled:true, firstEnabledAt:serverTimestamp} TOGETHER" :
    MODE === "reenable" ? "write {enabled:true} (marker untouched)" :
    "write {enabled:false} (marker untouched)"}`);
  process.exit(0);
}

// ---- THE TXN ---------------------------------------------------------------
await db.runTransaction(async (txn) => {
  const snap = await txn.get(db.doc(CONFIG));
  if (!snap.exists) throw new Error("config vanished");
  const c = snap.data();
  if (MODE === "activate") {
    // Re-assert INSIDE the txn (the pre-check was a race-prone courtesy).
    // The no-window invariant is ATOMIC [r70 C6]: the window doc joins THIS
    // txn's read set, so a window opened between preflight and commit
    // aborts the flip instead of racing it.
    const win = await txn.get(db.doc(WINDOW));
    if (win.exists) throw new Error("shadow_registry/window appeared — windows never span the flip");
    if (c.enabled === true) throw new Error("enabled flipped concurrently");
    if (c.firstEnabledAt != null) throw new Error("marker appeared concurrently");
    if (!Array.isArray(c.rehearsalClassIds) || c.rehearsalClassIds.length !== 0) {
      throw new Error("rehearsalClassIds non-empty at txn time");
    }
    txn.update(snap.ref, {
      enabled: true,
      firstEnabledAt: FieldValue.serverTimestamp(), // TOGETHER — R2-48
    });
  } else if (MODE === "reenable") {
    if (c.firstEnabledAt == null) throw new Error("marker vanished — refuse");
    txn.update(snap.ref, {enabled: true});
  } else {
    txn.update(snap.ref, {enabled: false});
  }
}).catch((e) => { console.error(`TXN FAILED: ${e.message}`); process.exit(2); });

// ---- Post-verify -----------------------------------------------------------
const after = (await db.doc(CONFIG).get()).data();
const windowAfter = await db.doc(WINDOW).get();
const bad = [];
if (MODE !== "kill" && after.enabled !== true) bad.push("enabled not true");
if (MODE === "kill" && after.enabled !== false) bad.push("enabled not false");
if (MODE === "activate" && after.firstEnabledAt == null) bad.push("marker not written");
if (MODE !== "kill" && after.firstEnabledAt == null) bad.push("marker absent post-enable");
if (MODE === "activate" && (!Array.isArray(after.rehearsalClassIds) || after.rehearsalClassIds.length !== 0)) {
  bad.push("rehearsalClassIds not empty post-flip");
}
if (MODE === "activate" && windowAfter.exists) bad.push("window doc exists post-flip");
if (bad.length) {
  console.error(`POST-FLIP VERIFICATION FAILED: ${bad.join(" · ")}`);
  process.exit(3);
}
console.log(`[flip] ${MODE.toUpperCase()} COMPLETE — enabled=${after.enabled}, firstEnabledAt=${after.firstEnabledAt?.toDate?.().toISOString?.() ?? after.firstEnabledAt}`);
