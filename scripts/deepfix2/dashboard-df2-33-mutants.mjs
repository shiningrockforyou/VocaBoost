#!/usr/bin/env node
/**
 * ============================================================================
 * DASHBOARD-DF2-33 — MUTANTS (m1/m2/m3): break the REAL module, expect the
 * PURE fixture suite to go RED
 * ============================================================================
 * Applies each mutant to `src/utils/dayStatusAuthority.js` IN PLACE (with a
 * [MUTANT marker so gate.mjs's residue scan fails closed if this run dies
 * mid-way), runs `dashboard-df2-33-fixtures.mjs`, and requires it to EXIT
 * NON-ZERO. Restores the original bytes afterwards and verifies sha-equality
 * — same discipline as dashboard-streak-authority-mutants.mjs.
 *
 *   m1  drop the non-demoting max (`Math.max(resolvedCsd ?? 0, progress?.
 *       currentStudyDay ?? 0)` -> `resolvedCsd ?? progress?.currentStudyDay
 *       ?? 0`, i.e. a lower resolved value WOULD demote) — killed by the
 *       NEVER-DEMOTE case (C1.2: raw 5/resolved 4 expects 5, mutant gives 4).
 *   m2  displayDay off-by-one (drop the `+ 1`) — killed by the NON-DEMOTING
 *       case (C1.1: expects displayDay 6, mutant gives 5).
 *   m3  `attempts: null` treated as `[]` (delete the nullish early-return,
 *       always compute) — killed by the C1.4 case (expects phase/doneToday
 *       null AND the oracle NEVER called; mutant computes a real phase AND
 *       calls the oracle).
 *
 * Run: node scripts/deepfix2/dashboard-df2-33-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/dashboard-df2-33-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const FIXTURE = fileURLToPath(new URL("./dashboard-df2-33-fixtures.mjs", import.meta.url));
const TARGET = fileURLToPath(new URL("../../src/utils/dayStatusAuthority.js", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M1-DROP-NON-DEMOTING-MAX",
    clause: "currentStudyDay never demotes below the raw stored value (C1.1/C1.2)",
    find: `  const currentStudyDay = Math.max(resolvedCsd ?? 0, progress?.currentStudyDay ?? 0)`,
    replace: `  // [MUTANT m1] the non-demoting max is dropped — a lower resolvedCsd WOULD demote
  const currentStudyDay = resolvedCsd ?? progress?.currentStudyDay ?? 0`,
  },
  {
    id: "M2-DISPLAYDAY-OFF-BY-ONE",
    clause: "displayDay = currentStudyDay + 1 (C1.1)",
    find: `  const displayDay = currentStudyDay + 1`,
    replace: `  // [MUTANT m2] off-by-one — the +1 is dropped
  const displayDay = currentStudyDay`,
  },
  {
    id: "M3-ATTEMPTS-NULL-TREATED-AS-EMPTY",
    clause: "attempts:null is the explicit not-computed sentinel, oracle never invoked (C1.4)",
    find: `  // "not computed" sentinel: attempts nullish (null or omitted/undefined) ⇒
  // phaseOracle is never called at all (module header — avoids multiplying a
  // real side-effecting oracle's calls across N per-list rows).
  if (attempts == null) {
    return { currentStudyDay, displayDay, phase: null, doneToday: null }
  }

  const phase = phaseOracle(attempts, displayDay).phase`,
    replace: `  // [MUTANT m3] the nullish sentinel is defeated — null is silently coerced to []
  const safeAttempts = attempts || []
  const phase = phaseOracle(safeAttempts, displayDay).phase`,
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
}

for (const m of MUTANTS) {
  const mutated = original.replace(m.find, m.replace);
  if (mutated === original) { console.error(`FATAL: mutant ${m.id} produced no change`); process.exit(2); }
  writeFileSync(TARGET, mutated);
  // Redirect the fixture's receipt so a mutant run can NEVER clobber the canonical
  // pure evidence (the same audit-fixed idiom as dashboard-streak-authority-mutants.mjs).
  const run = spawnSync(process.execPath, [FIXTURE], {
    encoding: "utf8",
    env: { ...process.env, DASHBOARD_DF2_33_PURE_RECEIPT: `${tmpdir()}/dashboard-df2-33-pure-mutant-run.json` },
  });
  writeFileSync(TARGET, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(TARGET, "utf8")) === sha(original);
  const summary = (run.stdout.match(/PURE: (\d+) checks, (\d+) failures/) || []).slice(1);
  const killed = run.status !== 0;
  results.push({
    id: m.id, clause: m.clause, target: TARGET.replace(/^\/app\//, ""), killed,
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
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/dashboard-df2-33-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "dashboard-df2-33-mutants",
    pass: bad === 0,
    mutants: results,
    targetSha16: sha(original).slice(0, 16),
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ndashboard-df2-33 MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
