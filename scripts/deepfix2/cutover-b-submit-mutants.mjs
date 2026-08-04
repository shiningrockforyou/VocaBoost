#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-B SUBMIT — MUTANTS (ledger C4 + C5): break the REAL code, expect RED
 * ============================================================================
 * Applies each mutant IN PLACE (with a [MUTANT marker so gate.mjs's residue
 * scan fails closed if this run dies), runs the target fixture suite, and
 * requires it to EXIT NON-ZERO. Restores the original bytes afterwards and
 * verifies sha-equality — same discipline as cutover-a-compose-mutants.mjs.
 *
 *   M-C4-UNBOUNDED-RECOMPOSE  (client, src/services/reviewV2Submit.js)
 *       the once-guard check is disabled, so EVERY grade_unusable recomposes
 *       — the looping-client defect A2 exists to prevent. Killed by the PURE
 *       C3 case ("the SECOND unusable does NOT recompose") and its whole
 *       bypass family (reload / two tabs / retry-after-automatic).
 *
 *   M-C5-DROP-IDEMPOTENCY  (server, functions/reviewV2/callables.js)
 *       the replay short-circuit is disabled AND the fenced txn.create
 *       becomes an overwriting txn.set, so a re-submit of the SAME
 *       presentation writes a SECOND time (new verdict, new submittedAt,
 *       replayed never true). Killed by the EMULATOR SB-RESUBMIT case
 *       (replayed:true · stored verdict served · submittedAt byte-identical).
 *       This leg REQUIRES the emulator: run the whole driver inside
 *       emulators:exec (the spawned fixture inherits FIRESTORE_EMULATOR_HOST).
 *
 * RUNBOOK:
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/cutover-b-submit-mutants.mjs"
 * Evidence: docs/plans/deepfix2/evidence/cutover-b-submit-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FATAL: FIRESTORE_EMULATOR_HOST not set — M-C5 needs the emulator; run the whole driver inside emulators:exec");
  process.exit(2);
}

const CLIENT_TARGET = fileURLToPath(new URL("../../src/services/reviewV2Submit.js", import.meta.url));
const SERVER_TARGET = fileURLToPath(new URL("../../functions/reviewV2/callables.js", import.meta.url));
const PURE_FIXTURE = fileURLToPath(new URL("./cutover-b-submit-fixtures.mjs", import.meta.url));
const EMU_FIXTURE = fileURLToPath(new URL("./cutover-b-submit-emulator.mjs", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M-C4-UNBOUNDED-RECOMPOSE",
    clause: "grade_unusable recomposes EXACTLY ONCE (A2/C3)",
    target: CLIENT_TARGET,
    fixture: PURE_FIXTURE,
    fixtureLabel: "PURE",
    receiptEnv: { CUTOVER_B_PURE_RECEIPT: `${tmpdir()}/cutover-b-pure-mutant-run.json` },
    summaryRe: /PURE: (\d+) checks, (\d+) failures/,
    find: `    if (recomposeUsed(guardScope, deps)) {
      return { outcome: 'blocked', status: RV2.GRADE_UNUSABLE, reason: REASON_UNUSABLE_TERMINAL }
    }`,
    replace: `    // [MUTANT M-C4] the once-guard is disabled — every unusable recomposes
    if (false && recomposeUsed(guardScope, deps)) {
      return { outcome: 'blocked', status: RV2.GRADE_UNUSABLE, reason: REASON_UNUSABLE_TERMINAL }
    }`,
  },
  {
    id: "M-C5-DROP-IDEMPOTENCY",
    clause: "a re-submit of the SAME presentation is a replay, never a second write (A1)",
    target: SERVER_TARGET,
    fixture: EMU_FIXTURE,
    fixtureLabel: "EMULATOR",
    receiptEnv: { CUTOVER_B_EMU_RECEIPT: `${tmpdir()}/cutover-b-emu-mutant-run.json` },
    summaryRe: /EMULATOR: (\d+) checks, (\d+) failures/,
    // TWO coupled edits, applied as one mutant: kill the replay short-circuit
    // and let the write overwrite.
    edits: [
      {
        find: `    if (aSnap.exists) {`,
        replace: `    if (false && aSnap.exists) { // [MUTANT M-C5] replay short-circuit disabled`,
      },
      {
        find: `    txn.create(attemptRef, attempt);`,
        replace: `    txn.set(attemptRef, attempt); // [MUTANT M-C5] fenced create became an overwrite`,
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
  if (!killed) { bad++; console.error(`✗ ${m.id} SURVIVED — the fixture did not detect it`); }
  else console.log(`✓ ${m.id} killed (${m.fixtureLabel} exit ${run.status}, ${summary[1] ?? "?"} red check(s))`);
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
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/cutover-b-submit-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "cutover-b-submit-mutants",
    pass: bad === 0,
    mutants: results,
    targetShas16: {
      "src/services/reviewV2Submit.js": sha(readFileSync(CLIENT_TARGET, "utf8")).slice(0, 16),
      "functions/reviewV2/callables.js": sha(readFileSync(SERVER_TARGET, "utf8")).slice(0, 16),
    },
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ncutover-b-submit MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
