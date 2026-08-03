#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — seed-review-v2-config.mjs: THE DARK CONFIG DOC (deploy leg 4)
 * ============================================================================
 * Creates `system_config/review_v2` in the EXACT dark shape (15_ §7 / R2-31):
 * every surface off, no marker, no rehearsal classes. Until this doc exists
 * the resolver returns HOLD (the r48 cold-start law) — safe, but the engine
 * cannot be rehearsed, so the doc must exist before 25WT.
 *
 * WRITE-IFF-ABSENT, like the flip's marker law: if the doc already exists this
 * script REFUSES and prints it. It NEVER flips `enabled` and NEVER writes
 * `firstEnabledAt` — activation is `flip-review-v2.mjs`, and that is DAVID'S
 * switch alone.
 *
 * Usage (DRY-RUN by default):
 *   NODE_PATH=/app/node_modules node scripts/deepfix2/seed-review-v2-config.mjs [--execute]
 * Exit codes: 0 ok/dry-run · 2 refusal (already exists / malformed) · 3 post-write verify failed.
 */

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const EXECUTE = process.argv.includes("--execute");
const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();
const PATH = "system_config/review_v2";

/** THE DARK SHAPE — every field the resolver's strict schema requires. */
const DARK = {
  enabled: false,
  firstEnabledAt: null,
  rehearsalClassIds: [],
  configVersion: 1,
  threshold: 92,
  queueSize: 60,
  testSize: 30,
  minClientVersion: null,
};

const snap = await db.doc(PATH).get();
if (snap.exists) {
  console.error(`REFUSED: ${PATH} already exists — this script is write-iff-absent.`);
  console.error(JSON.stringify(snap.data(), null, 2));
  process.exit(2);
}
console.log(`[seed] ${PATH} is ABSENT. Target shape:`);
console.log(JSON.stringify(DARK, null, 2));
if (!EXECUTE) {
  console.log("[seed] DRY-RUN — nothing written. Re-run with --execute to create it.");
  process.exit(0);
}

await db.doc(PATH).create(DARK); // create() = fails if it appeared concurrently
const after = (await db.doc(PATH).get()).data();
const bad = [];
if (after.enabled !== false) bad.push("enabled is not false");
if (after.firstEnabledAt !== null) bad.push("firstEnabledAt is not null");
if (!Array.isArray(after.rehearsalClassIds) || after.rehearsalClassIds.length !== 0) {
  bad.push("rehearsalClassIds is not empty");
}
if (after.configVersion !== 1) bad.push("configVersion is not 1");
if (bad.length) {
  console.error(`POST-WRITE VERIFY FAILED: ${bad.join(" · ")}`);
  process.exit(3);
}
console.log("[seed] CREATED + VERIFIED DARK:", JSON.stringify(after));
