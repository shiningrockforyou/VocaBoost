#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-C COMPLETE — MUTANTS (ledger C4 + C5): break the REAL code, expect RED
 * ============================================================================
 * Applies each mutant IN PLACE (with a [MUTANT marker so gate.mjs's residue
 * scan fails closed if this run dies), runs the target fixture suite, and
 * requires it to EXIT NON-ZERO. Restores the original bytes afterwards and
 * verifies sha-equality — same discipline as cutover-a/b's mutant drivers.
 *
 *   M-C5-INVERT-ALREADY-COMPLETED  (client, src/services/reviewV2Complete.js)
 *       drops `already_completed` from the terminal-success branch, so a
 *       loser's response falls through to the generic `blocked` catch-all
 *       instead of the day-DONE success path — the EXACT V3 inversion the
 *       ledger warns against (mapping a normal idempotent replay onto an
 *       error). Killed by the PURE fixture's "already_completed IS A
 *       TERMINAL SUCCESS" case (outcome must stay 'completed').
 *
 *   M-C4-DROP-CAS  (server, functions/reviewV2/completion.js)
 *       disables the loser's CAS short-circuit AND turns the fenced
 *       txn.create into an overwriting txn.set, so a "loser" call (the day
 *       already has a completion record) re-runs the FULL advance +
 *       graduation + streak-credit logic instead of returning
 *       already_completed — the exact "loser re-runs the advance" defect C3
 *       exists to catch. Killed by the EMULATOR fixture's CC-DUP case:
 *       replayed flips from true to false (a SECOND "fresh" completion, not
 *       a replay) and class_progress.updatedAt moves (a second advance
 *       write actually landed). This leg REQUIRES the emulator: run the
 *       whole driver inside emulators:exec (the spawned fixture inherits
 *       FIRESTORE_EMULATOR_HOST).
 *
 * RUNBOOK:
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/cutover-c-complete-mutants.mjs"
 * Evidence: docs/plans/deepfix2/evidence/cutover-c-complete-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FATAL: FIRESTORE_EMULATOR_HOST not set — M-C4 needs the emulator; run the whole driver inside emulators:exec");
  process.exit(2);
}

const CLIENT_TARGET = fileURLToPath(new URL("../../src/services/reviewV2Complete.js", import.meta.url));
const SERVER_TARGET = fileURLToPath(new URL("../../functions/reviewV2/completion.js", import.meta.url));
const PURE_FIXTURE = fileURLToPath(new URL("./cutover-c-complete-fixtures.mjs", import.meta.url));
const EMU_FIXTURE = fileURLToPath(new URL("./cutover-c-complete-emulator.mjs", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M-C5-INVERT-ALREADY-COMPLETED",
    clause: "already_completed is a TERMINAL SUCCESS, never the error path (V3)",
    target: CLIENT_TARGET,
    fixture: PURE_FIXTURE,
    fixtureLabel: "PURE",
    receiptEnv: { CUTOVER_C_PURE_RECEIPT: `${tmpdir()}/cutover-c-pure-mutant-run.json` },
    summaryRe: /PURE: (\d+) checks, (\d+) failures/,
    find: `  if (result?.status === RV2.COMPLETED || result?.status === RV2.ALREADY_COMPLETED) {
    return translateCompletedOutcome(result)
  }`,
    replace: `  // [MUTANT M-C5] already_completed no longer lands on the success path
  if (result?.status === RV2.COMPLETED) {
    return translateCompletedOutcome(result)
  }`,
  },
  {
    id: "M-C4-DROP-CAS",
    clause: "a loser (an existing completion record) re-runs NOTHING — no double advance/graduate/streak (C3)",
    target: SERVER_TARGET,
    fixture: EMU_FIXTURE,
    fixtureLabel: "EMULATOR",
    receiptEnv: { CUTOVER_C_EMU_RECEIPT: `${tmpdir()}/cutover-c-emu-mutant-run.json` },
    summaryRe: /EMULATOR: (\d+) checks, (\d+) failures/,
    // TWO coupled edits, applied as one mutant (mirrors cutover-b's M-C5):
    // disable the loser's early-return, then let the fenced create overwrite
    // instead of throwing, so the loser proceeds all the way through.
    edits: [
      {
        find: `    if (doneSnap.exists) {`,
        replace: `    if (false && doneSnap.exists) { // [MUTANT M-C4] loser CAS short-circuit disabled`,
      },
      {
        find: `    txn.create(completionRef, completion);`,
        replace: `    txn.set(completionRef, completion); // [MUTANT M-C4] fenced create became an overwrite`,
      },
    ],
  },
];

const results = [];
let bad = 0;

for (const m of MUTANTS) {
  const original = readFileSync(m.target, "utf8");
  const originalSha = sha(original);
  const edits = m.edits ?? [{ find: m.find, replace: m.replace }];
  let mutated = original;
  for (const e of edits) {
    if (!mutated.includes(e.find)) {
      console.error(`FATAL: mutant ${m.id} anchor not found — the module drifted; re-anchor the mutant`);
      process.exit(2);
    }
    mutated = mutated.replace(e.find, e.replace);
  }
  if (mutated === original) { console.error(`FATAL: mutant ${m.id} produced no change`); process.exit(2); }
  writeFileSync(m.target, mutated);
  const run = spawnSync(process.execPath, [m.fixture], {
    encoding: "utf8",
    env: { ...process.env, ...m.receiptEnv },
  });
  writeFileSync(m.target, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(m.target, "utf8")) === originalSha;
  const summary = ((run.stdout || "").match(m.summaryRe) || []).slice(1);
  const killed = run.status !== 0;
  results.push({
    id: m.id, clause: m.clause, fixture: m.fixtureLabel, killed,
    fixtureExit: run.status,
    checks: summary[0] ? Number(summary[0]) : null,
    failures: summary[1] ? Number(summary[1]) : null,
    restoredOk,
  });
  if (!killed) {
    bad++;
    console.error(`✗ ${m.id} SURVIVED — the fixture did not detect it`);
    console.error(run.stdout || run.stderr || "(no output)");
  } else console.log(`✓ ${m.id} killed (${m.fixtureLabel} exit ${run.status}, ${summary[1] ?? "?"} red check(s))`);
  if (!restoredOk) { bad++; console.error(`✗ ${m.id} RESTORE FAILED — module bytes differ from original`); }
}

// Final belt: the tree must carry no mutant residue.
for (const t of [CLIENT_TARGET, SERVER_TARGET]) {
  if (readFileSync(t, "utf8").includes("[MUTANT")) {
    bad++;
    console.error(`✗ MUTANT residue left in ${t} — restore failed`);
  }
}

mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/cutover-c-complete-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "cutover-c-complete-mutants",
    pass: bad === 0,
    mutants: results,
    targetShas16: {
      "src/services/reviewV2Complete.js": sha(readFileSync(CLIENT_TARGET, "utf8")).slice(0, 16),
      "functions/reviewV2/completion.js": sha(readFileSync(SERVER_TARGET, "utf8")).slice(0, 16),
    },
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ncutover-c-complete MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
