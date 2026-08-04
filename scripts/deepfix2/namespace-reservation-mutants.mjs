#!/usr/bin/env node
/**
 * ============================================================================
 * NAMESPACE-RESERVATION — MUTANTS (ledger C5 + C6): drop a guard, expect RED
 * ============================================================================
 * Applies each mutant to functions/index.js IN PLACE (with a [MUTANT marker so
 * gate.mjs's residue scan fails closed if this run dies), runs the G2/G3
 * emulator fixture, and requires it to EXIT NON-ZERO. Restores the original
 * bytes afterwards and verifies sha-equality — same discipline as
 * cutover-b-submit-mutants.mjs.
 *
 *   M-C5-DROP-G2  the submitVocabAttempt `^rv2_` refusal is removed → the
 *                 Admin-SDK write lands at attempts/rv2_{victim}_{pid}. Killed
 *                 by G2-DENY-CREATE (the guard no longer fires; the doc is
 *                 created) and the G2/XB deny rows.
 *   M-C6-DROP-G3  the gradeTypedTest `^rv2_` refusals are removed → the
 *                 grading-job claim seeds grading_jobs/rv2_{victim}_{pid}.
 *                 Killed by G3-DENY-WRITECTX / G3-DENY-GRADECTX / XB.
 *
 * BOTH mutate index.js. Each mutant is applied and judged independently, so a
 * DROP-G2 run still leaves G3 intact and vice-versa — the emulator fixture
 * exits non-zero as soon as ANY assertion reddens, which is the kill signal.
 *
 * RUNBOOK:
 *   PROJ=$(python3 -c "import json;print(json.load(open('scripts/serviceAccountKey.json'))['project_id'])")
 *   PATH=$HOME/jre/jdk-21.0.12+8-jre/bin:$PATH NODE_PATH=/app/node_modules \
 *     ~/fbtools/node_modules/.bin/firebase emulators:exec --only firestore --project "$PROJ" \
 *     "node scripts/deepfix2/namespace-reservation-mutants.mjs"
 * Evidence: docs/plans/deepfix2/evidence/namespace-reservation-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FATAL: FIRESTORE_EMULATOR_HOST not set — these mutants need the emulator; run inside emulators:exec");
  process.exit(2);
}

const TARGET = fileURLToPath(new URL("../../functions/index.js", import.meta.url));
const EMU_FIXTURE = fileURLToPath(new URL("./namespace-reservation-emulator.mjs", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M-C5-DROP-G2",
    clause: "submitVocabAttempt refuses a client-supplied rv2_ attemptDocId (A2)",
    edits: [{
      find: `  assertNotEngineReservedDocId(context?.attemptDocId, "context.attemptDocId");`,
      replace: `  /* [MUTANT M-C5] G2 rv2_ refusal removed */ void context;`,
    }],
  },
  {
    id: "M-C6-DROP-G3",
    clause: "gradeTypedTest refuses a client-supplied rv2_ attemptDocId on both context fields (A3)",
    edits: [{
      find: `    assertNotEngineReservedDocId(writeContext?.attemptDocId, "writeContext.attemptDocId");
    assertNotEngineReservedDocId(gradeContext?.attemptDocId, "gradeContext.attemptDocId");`,
      replace: `    /* [MUTANT M-C6] G3 rv2_ refusals removed */ void writeContext; void gradeContext;`,
    }],
  },
];

const results = [];
let bad = 0;

for (const m of MUTANTS) {
  const original = readFileSync(TARGET, "utf8");
  const originalSha = sha(original);
  let mutated = original;
  for (const e of m.edits) {
    if (!mutated.includes(e.find)) {
      console.error(`FATAL: mutant ${m.id} anchor not found — index.js drifted; re-anchor the mutant`);
      process.exit(2);
    }
    mutated = mutated.replace(e.find, e.replace);
  }
  if (mutated === original) { console.error(`FATAL: mutant ${m.id} produced no change`); process.exit(2); }
  writeFileSync(TARGET, mutated);
  const run = spawnSync(process.execPath, [EMU_FIXTURE], {
    encoding: "utf8",
    // Redirect the receipt so a mutant's FAILING run never clobbers the canonical evidence.
    env: { ...process.env, NS_EMU_RECEIPT: `${tmpdir()}/ns-emu-mutant-${m.id}.json` },
  });
  writeFileSync(TARGET, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(TARGET, "utf8")) === originalSha;
  const summary = ((run.stdout || "").match(/EMULATOR: (\d+)\/(\d+) green/) || []).slice(1);
  const killed = run.status !== 0;
  results.push({
    id: m.id, clause: m.clause, killed,
    fixtureExit: run.status,
    green: summary[0] ? Number(summary[0]) : null,
    total: summary[1] ? Number(summary[1]) : null,
    restoredOk,
  });
  if (!killed) { bad++; console.error(`✗ ${m.id} SURVIVED — the fixture did not detect it`); }
  else console.log(`✓ ${m.id} killed (emulator exit ${run.status}, ${summary[0] ?? "?"}/${summary[1] ?? "?"} green)`);
  if (!restoredOk) { bad++; console.error(`✗ ${m.id} RESTORE FAILED — index.js bytes differ from original`); }
}

// Final belt: the tree must carry no mutant residue.
if (readFileSync(TARGET, "utf8").includes("[MUTANT")) {
  bad++;
  console.error(`✗ MUTANT residue left in ${TARGET} — restore failed`);
}

mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/namespace-reservation-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "namespace-reservation-mutants",
    pass: bad === 0,
    mutants: results,
    sourceShas: { "index.js": sha(readFileSync(TARGET, "utf8")).slice(0, 16) },
    at: new Date().toISOString(),
  }, null, 2) + "\n");
console.log(`\nnamespace-reservation MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
