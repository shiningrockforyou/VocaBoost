#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-11 TEACHER REVIEW-SETTINGS — MUTANTS (C4): break each validation clause
 * in the REAL src/utils/reviewSettingsAuthority.js, expect the PURE fixture
 * suite to go RED (its matching invalid C3 case), then restore + verify.
 * ============================================================================
 * Same discipline as dashboard-streak-authority-mutants.mjs: apply IN PLACE
 * with a `[MUTANT` marker (so gate.mjs's residue scan fails closed if this run
 * dies mid-way), run the fixture with a REDIRECTED receipt (never clobber the
 * canonical pure evidence), require EXIT NON-ZERO, restore the original bytes,
 * and verify sha-equality.
 *
 * One mutant per validation clause (config.js:163-192 mirror):
 *   M1 THRESHOLD-UPPER  widen reviewPassThreshold's upper bound → "101 rejected" survives
 *   M2 SIZE-UPPER       widen reviewTestSize's upper bound       → "501 rejected" survives
 *   M3 LOWER-BOUND      drop the `n < lo` guard                  → "0 rejected" survives
 *   M4 INTEGER          drop the `!Number.isInteger` guard       → "92.5 rejected" survives
 *   M5 GATE-COERCE      drop the boolean coercion                → "'yes' ⇒ false" survives
 *   M6 TYPE-ENUM        drop the mcq default                     → "'dsf' ⇒ mcq" survives
 *
 * Run: node scripts/deepfix2/df2-11-teacher-review-settings-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-11-teacher-review-settings-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const FIXTURE = fileURLToPath(new URL("./df2-11-teacher-review-settings-fixtures.mjs", import.meta.url));
const TARGET = fileURLToPath(new URL("../../src/utils/reviewSettingsAuthority.js", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M1-THRESHOLD-UPPER-WIDEN",
    clause: "reviewPassThreshold rejects > 100 (C3)",
    find: "  reviewPassThreshold: [1, 100],",
    replace: "  reviewPassThreshold: [1, 100000], // [MUTANT M1] upper bound widened",
  },
  {
    id: "M2-SIZE-UPPER-WIDEN",
    clause: "reviewTestSize rejects > 500 (C3)",
    find: "  reviewTestSize: [1, 500],",
    replace: "  reviewTestSize: [1, 500000], // [MUTANT M2] upper bound widened",
  },
  {
    id: "M3-LOWER-BOUND-DROP",
    clause: "the ints reject < 1 (C3)",
    find: "  if (!Number.isInteger(n) || n < lo || n > hi) {",
    replace: "  if (!Number.isInteger(n) || n > hi) { // [MUTANT M3] lower bound dropped",
  },
  {
    id: "M4-INTEGER-DROP",
    clause: "the ints reject non-integers (C3)",
    find: "  if (!Number.isInteger(n) || n < lo || n > hi) {",
    replace: "  if (n < lo || n > hi) { // [MUTANT M4] integer check dropped",
  },
  {
    id: "M5-GATE-COERCE-DROP",
    clause: "reviewGateEnabled coerces to a real boolean (C3)",
    find: "    return value === true",
    replace: "    return value // [MUTANT M5] gate coercion dropped",
  },
  {
    id: "M6-TYPE-ENUM-DROP",
    clause: "reviewTestType defaults anything but 'typed' to mcq (C3)",
    find: "    return value === 'typed' ? 'typed' : 'mcq'",
    replace: "    return value // [MUTANT M6] type enum default dropped",
  },
];

const original = readFileSync(TARGET, "utf8");
const results = [];
let bad = 0;

for (const m of MUTANTS) {
  if (!original.includes(m.find)) {
    console.error(`FATAL: mutant ${m.id} anchor not found in ${TARGET} — the module drifted; re-anchor the mutant`);
    process.exit(2);
  }
  const mutated = original.replace(m.find, m.replace);
  if (mutated === original) { console.error(`FATAL: mutant ${m.id} produced no change`); process.exit(2); }
  writeFileSync(TARGET, mutated);
  // Redirect the fixture's receipt so a mutant run can NEVER clobber the canonical pure evidence.
  const run = spawnSync(process.execPath, [FIXTURE], {
    encoding: "utf8",
    env: { ...process.env, DF2_11_PURE_RECEIPT: `${tmpdir()}/df2-11-teacher-review-settings-pure-mutant-run.json` },
  });
  writeFileSync(TARGET, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(TARGET, "utf8")) === sha(original);
  const summary = (run.stdout.match(/PURE: (\d+) checks, (\d+) failures/) || []).slice(1);
  const killed = run.status !== 0;
  results.push({
    id: m.id, clause: m.clause, killed,
    fixtureExit: run.status,
    checks: summary[0] ? Number(summary[0]) : null,
    failures: summary[1] ? Number(summary[1]) : null,
    restoredOk,
  });
  if (!killed) { bad++; console.error(`✗ ${m.id} SURVIVED — the fixture did not detect it`); }
  else console.log(`✓ ${m.id} killed (fixture exit ${run.status}, ${summary[1] ?? "?"} red check(s))`);
  if (!restoredOk) { bad++; console.error(`✗ ${m.id} RESTORE FAILED — module bytes differ from original`); }
}

// Final belt: the tree must carry no mutant residue.
if (readFileSync(TARGET, "utf8").includes("[MUTANT")) {
  bad++;
  console.error(`✗ MUTANT residue left in ${TARGET} — restore failed`);
}

mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/df2-11-teacher-review-settings-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "df2-11-teacher-review-settings-mutants",
    pass: bad === 0,
    mutants: results,
    targetSha16: { "src/utils/reviewSettingsAuthority.js": sha(original).slice(0, 16) },
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ndf2-11-teacher-review-settings MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
