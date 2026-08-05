#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-e — MUTANTS (M1-M7): the brief's 2 named minimums + 5 of this
 * fold's own new clauses
 * ============================================================================
 * Two target files, both fully owned by this fold (unlike 51-c's M1, which
 * had to SIMULATE because its target for that mutant was the SHARED
 * `src/App.jsx` — `DailySessionFlow.jsx` is this fold's own named build
 * target, so every mutant below is a REAL in-place edit + restore, never a
 * simulation):
 *
 *   M1, M2, M7  mutate the REAL `src/pages/DailySessionFlow.jsx` in place,
 *               require the relevant STRUCTURAL fixture case (S1 or S3) to
 *               go red, restore immediately, sha-verify the restore.
 *   M3-M6       mutate the REAL, solely-owned
 *               `src/pages/DailySessionFlow.phaseToggle.js` in place,
 *               require the REAL pure-fixture suite (execution-based, not
 *               just text) to go red, restore immediately, sha-verify.
 *
 *   M1  FLAG-OFF GATE REMOVED (brief's 1st named minimum) — strips the
 *       `REVIEW_V2_CLIENT && ` prefix from the render-gate anchor. Killed by
 *       case S1 (the anchor text check).
 *   M2  A TOGGLE THAT ADVANCES/SUBMITS (brief's 2nd named minimum) — adds a
 *       `completeSession()` call inside moveToNewWordsPhase's body. Killed
 *       by case S3 (the banned-call check).
 *   M3  REVIEW AVAILABILITY IGNORED — canOfferReviewPhase always returns
 *       true. Killed by pure case C1.
 *   M4  NEW-WORDS AVAILABILITY IGNORED — canOfferNewWordsPhase always
 *       returns true. Killed by pure case C2.
 *   M5  CLICK-GUARD AVAILABILITY CHECK DROPPED — shouldRunPhaseToggle no
 *       longer returns false when `available` is false. Killed by pure case
 *       C3.
 *   M6  CLICK-GUARD ALREADY-ACTIVE CHECK DROPPED — shouldRunPhaseToggle no
 *       longer returns false when `targetPhase === activePhase`. Killed by
 *       pure case C3.
 *   M7  TOGGLE OFFERED ON ONLY ONE STUDY PHASE — drops the
 *       `phase === PHASES.REVIEW_STUDY` disjunct from the render gate.
 *       Killed by case S1 (the anchor text check, which pins the exact
 *       two-phase disjunction).
 *
 * Run: node scripts/deepfix2/df2-51e-toggle-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51e-toggle-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const FIXTURE = fileURLToPath(new URL("./df2-51e-toggle-fixtures.mjs", import.meta.url));
const DSF = fileURLToPath(new URL("../../src/pages/DailySessionFlow.jsx", import.meta.url));
const PHASE_TOGGLE = fileURLToPath(new URL("../../src/pages/DailySessionFlow.phaseToggle.js", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const results = [];
let bad = 0;

/** Run the REAL fixture script fresh, redirecting its receipt so a mutant
 *  run can never clobber the canonical pure evidence. Returns {status,
 *  checks, failures} parsed from its own stdout summary line. */
function runFixture() {
  const run = spawnSync(process.execPath, [FIXTURE], {
    encoding: "utf8",
    env: { ...process.env, DF2_51E_TOGGLE_PURE_RECEIPT: `${tmpdir()}/df2-51e-toggle-pure-mutant-run.json` },
  });
  const summary = (run.stdout.match(/PURE: (\d+) checks, (\d+) failures/) || []).slice(1);
  return {
    status: run.status,
    checks: summary[0] ? Number(summary[0]) : null,
    failures: summary[1] ? Number(summary[1]) : null,
  };
}

/** Apply ONE find/replace mutation to `target`, assert the anchor matches
 *  EXACTLY once (never a silent no-match, never an ambiguous multi-match),
 *  run the fixture, require it RED, restore immediately, sha-verify. */
function runMutant({ id, clause, target, find, replace }) {
  const original = readFileSync(target, "utf8");
  const occurrences = original.split(find).length - 1;
  if (occurrences !== 1) {
    console.error(`FATAL: mutant ${id} anchor matched ${occurrences} time(s) in ${target} (must be exactly 1) — re-anchor the mutant`);
    process.exit(2);
  }
  const mutated = original.replace(find, replace);
  if (mutated === original) {
    console.error(`FATAL: mutant ${id} produced no change`);
    process.exit(2);
  }
  writeFileSync(target, mutated);
  const run = runFixture();
  writeFileSync(target, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(target, "utf8")) === sha(original);
  const killed = run.status !== 0;
  results.push({
    id, clause, target: target.replace(/^\/app\//, ""), killed,
    fixtureExit: run.status, checks: run.checks, failures: run.failures, restoredOk,
  });
  if (!killed) { bad++; console.error(`✗ ${id} SURVIVED — the fixture did not detect it`); }
  else console.log(`✓ ${id} killed (fixture exit ${run.status}, ${run.failures ?? "?"} red check(s))`);
  if (!restoredOk) { bad++; console.error(`✗ ${id} RESTORE FAILED — file bytes differ from original`); }
}

// ---------------------------------------------------------------------------
// M1 — FLAG-OFF GATE REMOVED (brief's 1st named minimum) — real mutation of
// DailySessionFlow.jsx (fully owned by this fold; no simulation needed).
// ---------------------------------------------------------------------------
runMutant({
  id: "M1-FLAG-OFF-GATE-REMOVED",
  clause: "REVIEW_V2_CLIENT && ... is load-bearing on the toggle's render gate — removing the flag conjunct must be detected",
  target: DSF,
  find: "{REVIEW_V2_CLIENT && (phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) && (\n          <PhaseToggle",
  replace: "{/* [MUTANT M1] REVIEW_V2_CLIENT && stripped */ (phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) && (\n          <PhaseToggle",
});

// ---------------------------------------------------------------------------
// M2 — A TOGGLE THAT ADVANCES/SUBMITS (brief's 2nd named minimum) — real
// mutation adds a completeSession() call inside moveToNewWordsPhase.
// ---------------------------------------------------------------------------
runMutant({
  id: "M2-TOGGLE-ADVANCES-DAY",
  clause: "moveToNewWordsPhase must never call completeSession/advance the day — injecting a call must be detected",
  target: DSF,
  find: `  const moveToNewWordsPhase = () => {
    if (!canOfferNewWordsPhase(sessionConfig)) {`,
  replace: `  const moveToNewWordsPhase = () => {
    completeSession() // [MUTANT M2] a toggle must never advance the day/submit
    if (!canOfferNewWordsPhase(sessionConfig)) {`,
});

// ---------------------------------------------------------------------------
// M7 — TOGGLE OFFERED ON ONLY ONE STUDY PHASE — drops the REVIEW_STUDY
// disjunct from the render gate (the toggle would then only ever appear
// while studying new words, never while reviewing).
// ---------------------------------------------------------------------------
runMutant({
  id: "M7-ONLY-ONE-STUDY-PHASE",
  clause: "the render gate must cover BOTH study phases (NEW_WORDS and REVIEW_STUDY) — dropping either disjunct must be detected",
  target: DSF,
  find: "{REVIEW_V2_CLIENT && (phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) && (\n          <PhaseToggle",
  replace: "{REVIEW_V2_CLIENT && (phase === PHASES.NEW_WORDS /* [MUTANT M7] || phase === PHASES.REVIEW_STUDY dropped */) && (\n          <PhaseToggle",
});

// ---------------------------------------------------------------------------
// M3-M6 — real mutate/run/restore cycle against the solely-owned pure module
// ---------------------------------------------------------------------------
runMutant({
  id: "M3-REVIEW-AVAILABILITY-IGNORED",
  clause: "canOfferReviewPhase must honor `segment` — ignoring it (always offerable) must be detected",
  target: PHASE_TOGGLE,
  find: `export function canOfferReviewPhase(sessionConfig) {
  return Boolean(sessionConfig?.segment)
}`,
  replace: `export function canOfferReviewPhase(sessionConfig) {
  // [MUTANT M3] segment is ignored — review always offered, even with none
  return true
}`,
});

runMutant({
  id: "M4-NEWWORDS-AVAILABILITY-IGNORED",
  clause: "canOfferNewWordsPhase must honor `newWordCount` — ignoring it (always offerable) must be detected",
  target: PHASE_TOGGLE,
  find: `export function canOfferNewWordsPhase(sessionConfig) {
  return Number(sessionConfig?.newWordCount ?? 0) > 0
}`,
  replace: `export function canOfferNewWordsPhase(sessionConfig) {
  // [MUTANT M4] newWordCount is ignored — new words always offered, even with none
  return true
}`,
});

runMutant({
  id: "M5-CLICKGUARD-AVAILABILITY-DROPPED",
  clause: "shouldRunPhaseToggle must return false when `available` is false — dropping that check must be detected",
  target: PHASE_TOGGLE,
  find: `export function shouldRunPhaseToggle({ targetPhase, activePhase, available } = {}) {
  if (!available) return false
  if (targetPhase === activePhase) return false
  return true
}`,
  replace: `export function shouldRunPhaseToggle({ targetPhase, activePhase, available } = {}) {
  // [MUTANT M5] availability check dropped — would select an unavailable half
  if (targetPhase === activePhase) return false
  return true
}`,
});

runMutant({
  id: "M6-CLICKGUARD-ALREADY-ACTIVE-DROPPED",
  clause: "shouldRunPhaseToggle must return false when the target phase is already active — dropping that check must be detected",
  target: PHASE_TOGGLE,
  find: `export function shouldRunPhaseToggle({ targetPhase, activePhase, available } = {}) {
  if (!available) return false
  if (targetPhase === activePhase) return false
  return true
}`,
  replace: `export function shouldRunPhaseToggle({ targetPhase, activePhase, available } = {}) {
  if (!available) return false
  // [MUTANT M6] already-active check dropped — a redundant tap would re-run
  return true
}`,
});

// Final belt: neither target file may carry mutant residue.
for (const f of [DSF, PHASE_TOGGLE]) {
  if (readFileSync(f, "utf8").includes("[MUTANT")) {
    bad++;
    console.error(`✗ MUTANT residue left in ${f} — restore failed`);
  }
}

mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/df2-51e-toggle-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "df2-51e-toggle-mutants",
    pass: bad === 0,
    mutants: results,
    targetShas16: {
      "src/pages/DailySessionFlow.jsx": sha(readFileSync(DSF, "utf8")).slice(0, 16),
      "src/pages/DailySessionFlow.phaseToggle.js": sha(readFileSync(PHASE_TOGGLE, "utf8")).slice(0, 16),
    },
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ndf2-51e-toggle MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
