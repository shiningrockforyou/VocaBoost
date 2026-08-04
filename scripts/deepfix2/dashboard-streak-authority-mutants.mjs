#!/usr/bin/env node
/**
 * ============================================================================
 * DASHBOARD-STREAK-AUTHORITY (NTF-25) — MUTANTS (C4 + C5): break the REAL
 * modules, expect the PURE fixture suite to go RED
 * ============================================================================
 * Applies each mutant to its REAL target file IN PLACE (with a [MUTANT
 * marker so gate.mjs's residue scan fails closed if this run dies mid-way),
 * runs `dashboard-streak-authority-fixtures.mjs`, and requires it to EXIT
 * NON-ZERO. Restores the original bytes afterwards and verifies sha-equality
 * — same discipline as cutover-a-compose-mutants.mjs/typed-seam-mutants.mjs.
 *
 *   M-C4  the freshness gate is REVERSED (`src/utils/streakAuthority.js`) —
 *         a stale streak would show its internal (non-zero) count instead of
 *         0, AND a fresh streak would show 0 instead of its real count.
 *         Killed by the STALE case (0 → 3) and, redundantly, by
 *         FRESH/WEEKEND-GAP/TWO-LIST (their expected non-zero counts → 0).
 *   M-C5  the read is RE-SCOPED to one list (`src/services/streakCredits.js`
 *         — `docs.map((d) => d.id)` becomes a per-listId filter first) —
 *         killed by the A2 "drops classId/listId" TWO-LIST orchestration
 *         case (expected account-wide 3 → the filtered chain breaks at 1).
 *         This is the SAME defect class the emulator suite's E2E-TWOLIST
 *         case would also kill (real Firestore-shaped docs, real query) —
 *         the automated driver here only re-runs the PURE/mock suite (fast,
 *         no emulator boot per mutant), matching the cutover-a/b precedent.
 *
 * Run: node scripts/deepfix2/dashboard-streak-authority-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/dashboard-streak-authority-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const FIXTURE = fileURLToPath(new URL("./dashboard-streak-authority-fixtures.mjs", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M-C4-REVERSE-FRESHNESS-GATE",
    clause: "a stale streak reports 0, a fresh one reports its count (C1/C4)",
    target: fileURLToPath(new URL("../../src/utils/streakAuthority.js", import.meta.url)),
    find: `  return (mostRecent === today || mostRecent === yesterday) ? streak : 0
}`,
    replace: `  // [MUTANT M-C4] the freshness gate is reversed
  return (mostRecent === today || mostRecent === yesterday) ? 0 : streak
}`,
  },
  {
    id: "M-C5-SCOPE-TO-ONE-LIST",
    clause: "the read is account-wide, never filtered by classId/listId (A2/C5)",
    target: fileURLToPath(new URL("../../src/services/streakCredits.js", import.meta.url)),
    find: `  const docs = await run(db, uid)
  // ACCOUNT-WIDE (C5): classId/listId are on \`docs[i]\` but intentionally
  // unread past this line — only the date (the doc id) reaches the walk.
  const creditDates = docs.map((d) => d.id)`,
    replace: `  const docs = await run(db, uid)
  // [MUTANT M-C5] re-scoped to the most-recent credit's own list
  const creditDates = docs.filter((d) => d.listId === docs[0]?.listId).map((d) => d.id)`,
  },
];

const originals = new Map();
for (const m of MUTANTS) {
  if (!originals.has(m.target)) originals.set(m.target, readFileSync(m.target, "utf8"));
}
const results = [];
let bad = 0;

for (const m of MUTANTS) {
  const original = originals.get(m.target);
  if (!original.includes(m.find)) {
    console.error(`FATAL: mutant ${m.id} anchor not found in ${m.target} — the module drifted; re-anchor the mutant`);
    process.exit(2);
  }
  const mutated = original.replace(m.find, m.replace);
  if (mutated === original) { console.error(`FATAL: mutant ${m.id} produced no change`); process.exit(2); }
  writeFileSync(m.target, mutated);
  // Redirect the fixture's receipt so a mutant run can NEVER clobber the canonical
  // pure evidence (the same audit-fixed idiom as cutover-a-compose-mutants.mjs).
  const run = spawnSync(process.execPath, [FIXTURE], {
    encoding: "utf8",
    env: { ...process.env, DASHBOARD_STREAK_AUTHORITY_PURE_RECEIPT: `${tmpdir()}/dashboard-streak-authority-pure-mutant-run.json` },
  });
  writeFileSync(m.target, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(m.target, "utf8")) === sha(original);
  const summary = (run.stdout.match(/PURE: (\d+) checks, (\d+) failures/) || []).slice(1);
  const killed = run.status !== 0;
  results.push({
    id: m.id, clause: m.clause, target: m.target.replace(/^\/app\//, ""), killed,
    fixtureExit: run.status,
    checks: summary[0] ? Number(summary[0]) : null,
    failures: summary[1] ? Number(summary[1]) : null,
    restoredOk,
  });
  if (!killed) { bad++; console.error(`✗ ${m.id} SURVIVED — the fixture did not detect it`); }
  else console.log(`✓ ${m.id} killed (fixture exit ${run.status}, ${summary[1] ?? "?"} red check(s))`);
  if (!restoredOk) { bad++; console.error(`✗ ${m.id} RESTORE FAILED — module bytes differ from original`); }
}

// Final belt: the tree must carry no mutant residue in either target file.
for (const target of new Set(MUTANTS.map((m) => m.target))) {
  if (readFileSync(target, "utf8").includes("[MUTANT")) {
    bad++;
    console.error(`✗ MUTANT residue left in ${target} — restore failed`);
  }
}

mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const originalShas = Object.fromEntries(
  [...originals.entries()].map(([target, text]) => [target.replace(/^\/app\//, ""), sha(text).slice(0, 16)]),
);
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/dashboard-streak-authority-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "dashboard-streak-authority-mutants",
    pass: bad === 0,
    mutants: results,
    targetShas16: originalShas,
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ndashboard-streak-authority MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
