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

import { readFileSync, statSync } from "node:fs";
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
    const passed = lap.pass === true || lap.failed === 0;
    if (!passed) fail(`lapReceipt does not show a PASS (${lapPath})`);
    const maxAgeMin = Number(val("--lapMaxAgeMin", "30"));
    const ageMin = (Date.now() - statSync(lapPath).mtimeMs) / 60000;
    if (!(ageMin <= maxAgeMin)) fail(`lapReceipt is ${ageMin.toFixed(1)}min old (max ${maxAgeMin}) — re-run the micro-lap`);
    console.log(`[flip] micro-lap receipt OK (${lapPath}, ${ageMin.toFixed(1)}min old)`);
  }
} else if (MODE === "reenable") {
  if (cfg.firstEnabledAt == null) fail("firstEnabledAt absent — a first activation must use the activation mode");
  if (cfg.enabled === true) fail("enabled is already true");
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
