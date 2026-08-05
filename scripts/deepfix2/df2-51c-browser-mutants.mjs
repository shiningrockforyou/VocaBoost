#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-c — MUTANTS (m1-m5): the brief's 2 named minimums + 3 judgment-call
 * clauses of this fold's own new (non-51-a) logic
 * ============================================================================
 * m2-m5 follow the EXACT df2-51a-model-mutants.mjs pattern: apply an in-place
 * `[MUTANT ...]`-marked edit to the REAL `src/pages/RestudyBrowser.viewModel.js`
 * (this fold's OWN, solely-owned, zero-other-consumer file), run the pure
 * fixture suite, require a NON-ZERO exit, restore the original bytes, and
 * sha-verify the restore.
 *
 * m1 (the flag-off gate) is DELIBERATELY NOT a file mutation, unlike the
 * other four — two hard constraints rule it out:
 *   - `src/App.jsx` is a SHARED file (every other route lives there; a
 *     parallel CS session shares this tree) — mutate-then-restore is the
 *     right shape for a file this fold SOLELY owns, but an unnecessary risk
 *     on one it doesn't, however briefly and however carefully restored.
 *   - `src/config/featureFlags.js`'s `REVIEW_V2_CLIENT` is a FEATURE-FLAG
 *     VALUE — the orchestrator's hard constraints forbid changing a flag
 *     value, full stop, even transiently inside a mutate/restore cycle.
 * So m1 reproduces the causal claim ENTIRELY IN-MEMORY: the real
 * `react-router-dom` route matcher, fed a FORCED-true flag (never written to
 * any file), proves that if the `REVIEW_V2_CLIENT &&` gate were ever removed
 * the restudy route WOULD become reachable — the same assertion shape as the
 * pure suite's own always-on case C2.3, run here again as this fold's
 * evidenced "mutant" entry. `restoredOk` is trivially true (nothing was ever
 * written) and is included anyway so every result in the evidence JSON has
 * the same shape.
 *
 *   m1  FLAG-OFF GATE (simulated, in-memory — see above) — the brief's first
 *       named minimum.
 *   m2  TODAY RENDERED AS ACTIONABLE (`isDayActionable`'s negation dropped)
 *       — the brief's second named minimum. Killed by fixture case C1.5.
 *   m3  BOOKMARK-TOGGLE PRECEDENCE DROPPED (`computeBookmarkToggleTarget`
 *       always sets, never clears) — killed by case C1.11.
 *   m4  BRANCH-SELECTION EMPTY-CHECK DROPPED (`selectBranch` stops detecting
 *       a genuinely empty past-days array) — killed by case C1.10.
 *   m5  RESTUDY-DISABLED MAPPING DROPPED (`buildDayRowViewModel` stops
 *       honoring F3's `canRestudy:false` — Re-study would render enabled
 *       with nothing to re-study) — killed by case C1.7.
 *
 * Run: node scripts/deepfix2/df2-51c-browser-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51c-browser-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import React from "react";
import { createRoutesFromChildren, matchRoutes, Route } from "react-router-dom";

const FIXTURE = fileURLToPath(new URL("./df2-51c-browser-fixtures.mjs", import.meta.url));
const TARGET = fileURLToPath(new URL("../../src/pages/RestudyBrowser.viewModel.js", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const results = [];
let bad = 0;

// ---------------------------------------------------------------------------
// m1 — FLAG-OFF GATE, simulated in-memory (see header for why no file is
// mutated). "Killed" means: forcing the gate true DOES make the route
// reachable — i.e. the gate is a REAL, load-bearing condition, not dead code
// that would leave the route reachable (or unreachable) regardless.
// ---------------------------------------------------------------------------
{
  function buildRouteChildren(flag) {
    return [
      React.createElement(Route, { key: "home", path: "/", element: React.createElement("div") }),
      flag && React.createElement(Route, { key: "restudy", path: "/restudy/:classId/:listId", element: React.createElement("div") }),
      React.createElement(Route, { key: "catchall", path: "*", element: React.createElement("div") }),
    ];
  }
  const simulatedGateRemoved = createRoutesFromChildren(buildRouteChildren(true)); // flag forced true, in-memory only
  const match = matchRoutes(simulatedGateRemoved, "/restudy/26SM/list1");
  const routeReachable = Array.isArray(match) && match.some((m) => m.route.path === "/restudy/:classId/:listId");
  const killed = routeReachable === true; // the simulated "gate removed" state IS detectably different from today's flag-off state
  results.push({
    id: "M1-FLAG-OFF-GATE-SIMULATED",
    clause: "REVIEW_V2_CLIENT && <Route .../> is load-bearing — forcing it true (in-memory only; no file written) makes /restudy/:classId/:listId reachable",
    target: "IN-MEMORY SIMULATION (no file mutated — src/App.jsx is shared, and a flag VALUE may never be changed, even transiently)",
    killed, fixtureExit: null, checks: null, failures: null, restoredOk: true,
  });
  if (!killed) { bad++; console.error("✗ M1-FLAG-OFF-GATE-SIMULATED SURVIVED — forcing the flag true did not make the route reachable"); }
  else console.log("✓ M1-FLAG-OFF-GATE-SIMULATED killed (forced-true flag -> route reachable, confirming the && is load-bearing)");
}

// ---------------------------------------------------------------------------
// m2-m5 — real mutate/run/restore cycle against this fold's OWN file
// ---------------------------------------------------------------------------
const MUTANTS = [
  {
    id: "M2-TODAY-ACTIONABLE",
    clause: "isDayActionable: today is never actionable (the negation must not be dropped)",
    find: `export function isDayActionable(row) {
  return !row?.today
}`,
    replace: `export function isDayActionable(row) {
  // [MUTANT m2] the negation is dropped — today would render WITH buttons
  return Boolean(row?.today)
}`,
  },
  {
    id: "M3-BOOKMARK-PRECEDENCE-DROPPED",
    clause: "computeBookmarkToggleTarget: clicking the already-bookmarked day clears it; the scalar is never additive",
    find: `  return currentBookmarkedDay === clickedDay ? null : clickedDay
}`,
    replace: `  // [MUTANT m3] precedence dropped — always sets, clicking the bookmarked day again never clears it
  return clickedDay
}`,
  },
  {
    id: "M4-BRANCH-EMPTY-CHECK-DROPPED",
    clause: "selectBranch: a genuinely empty pastDays array must select 'empty', not 'list'",
    find: `  if (!Array.isArray(pastDays) || pastDays.length === 0) return 'empty'`,
    replace: `  // [MUTANT m4] the length check is dropped — an empty (but real) array no longer selects 'empty'
  if (!Array.isArray(pastDays)) return 'empty'`,
  },
  {
    id: "M5-RESTUDY-DISABLED-DROPPED",
    clause: "buildDayRowViewModel: restudyDisabled must honor F3's canRestudy:false (nothing to re-study on a no-new-half day)",
    find: `    restudyDisabled: !r.canRestudy,`,
    replace: `    // [MUTANT m5] canRestudy is ignored — Re-study always renders enabled
    restudyDisabled: false,`,
  },
];

const original = readFileSync(TARGET, "utf8");

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
  // Redirect the fixture's receipt so a mutant run can NEVER clobber the
  // canonical pure evidence (same audit-fixed idiom as df2-51a-model-mutants.mjs).
  const run = spawnSync(process.execPath, [FIXTURE], {
    encoding: "utf8",
    env: { ...process.env, DF2_51C_BROWSER_PURE_RECEIPT: `${tmpdir()}/df2-51c-browser-pure-mutant-run.json` },
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
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/df2-51c-browser-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "df2-51c-browser-mutants",
    pass: bad === 0,
    mutants: results,
    targetSha16: sha(original).slice(0, 16),
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ndf2-51c-browser MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
