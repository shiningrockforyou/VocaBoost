#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — reset-fence-integrity-sweep.mjs (panel F2, the pre-GATE-4 check)
 * ============================================================================
 * READ-ONLY. The review panel's HIGH finding: the merged ruleset locks the six
 * label OUTPUTS, but the GATE-4 backfill DERIVES those labels from inputs that
 * were client-writable — in particular the reset fence
 * (`resetAt`/`resetEpoch`/`resetInProgress` on progress_meta / list_progress /
 * class_progress), which b1-replay-lib.mjs uses to drop pre-reset attempts. A
 * student who wrote `resetAt = now` before the backfill would have every fail
 * in their history discarded and `reviewFailCount: 0` minted as server truth.
 *
 * The merged artifact now makes those fields client-unwritable going forward.
 * This sweep measures whether any fence value exists today.
 *
 * ⚠️ CORRECTED 2026-08-03 [panel r4]: an earlier version of this docstring said
 * "the legacy branch writes no epoch", making any hit provably a client write.
 * THAT IS FALSE — the LEGACY resetProgress branch stamps
 * `resetEpoch: increment(1)` + `resetAt` onto progress_meta
 * (functions/foundation.js:2271-2273), and that branch is the LIVE one
 * (RESET_V2_ENABLED === false). So a fence value is NOT self-evidently forged:
 * it may be a legitimate legacy reset. What the sweep can still establish is the
 * ZERO case — no fence value anywhere means no forgery AND no legacy reset has
 * touched these docs. A NON-zero result requires correlating each hit with a
 * `reset_progress_server` entry in system_logs before drawing any conclusion.
 *
 * Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/reset-fence-integrity-sweep.mjs
 * Exit: 0 clean · 1 hits found (investigate; do NOT backfill until explained) · 2 error.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const key = JSON.parse(readFileSync(new URL("../serviceAccountKey.json", import.meta.url)));
initializeApp({ credential: cert(key) });
const db = getFirestore();

const FENCE = ["resetAt", "resetEpoch", "resetInProgress"];
const GROUPS = ["progress_meta", "list_progress", "class_progress"];

const report = { projectId: key.project_id, groups: {}, hits: [], scanned: 0 };

for (const group of GROUPS) {
  let scanned = 0;
  const carrying = { resetAt: 0, resetEpoch: 0, resetInProgress: 0 };
  const snap = await db.collectionGroup(group).get();
  for (const doc of snap.docs) {
    scanned++;
    const d = doc.data();
    for (const f of FENCE) {
      // A fence field counts as PRESENT only when it is actually set: a null
      // resetAt or a zero resetEpoch is the untouched default shape.
      const v = d[f];
      const present = f === "resetEpoch" ? typeof v === "number" && v > 0
        : f === "resetInProgress" ? v === true
        : v !== undefined && v !== null;
      if (present) {
        carrying[f]++;
        // uid is the doc's grandparent — RECORD THE PATH SHAPE ONLY, never a uid
        // (this receipt is committed; audit/deepfix/trackB_baselines is where
        // real uids live, and it is gitignored).
        report.hits.push({ group, field: f, docId: doc.id, value: String(v).slice(0, 40) });
      }
    }
  }
  report.groups[group] = { scanned, carrying };
  report.scanned += scanned;
  console.log(`[sweep] ${group}: ${scanned} docs · ` +
    FENCE.map((f) => `${f}=${carrying[f]}`).join(" · "));
}

const total = report.hits.length;
report.verdict = total === 0
  ? "CLEAN — no fence value exists anywhere, so no forgery AND no legacy reset has touched these docs; the GATE-4 backfill's epoch filter cannot have been pre-forged"
  : `${total} FENCE VALUE(S) FOUND — correlate EACH with a reset_progress_server entry in system_logs ` +
    `before concluding forgery; the legacy resetProgress branch writes this field legitimately`;
// Keep the committed receipt uid-free: hit doc ids are {classId}_{listId}, not uids.
writeFileSync("/app/audit/deepfix/task3/live_baseline/reset-fence-sweep-receipt.json",
  JSON.stringify({ ...report, hits: report.hits.slice(0, 50) }, null, 2) + "\n");
console.log(`\n[sweep] ${report.verdict}`);
process.exit(total === 0 ? 0 : 1);
