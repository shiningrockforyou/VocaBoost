#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-a — MUTANTS (m1-m6): break the REAL `src/utils/pastDayAuthority.js`,
 * expect the PURE fixture suite to go RED
 * ============================================================================
 * Applies each mutant to the module IN PLACE (with a `[MUTANT ...]` marker so
 * gate.mjs's residue scan fails closed if this run dies mid-way), runs
 * `df2-51a-model-fixtures.mjs`, and requires it to EXIT NON-ZERO. Restores the
 * original bytes afterwards and verifies sha-equality — same discipline as
 * `dashboard-df2-33-mutants.mjs`.
 *
 * Covers the brief's 3 named clauses (M1/M2/M3) plus 3 of this fold's own
 * judgment-call clauses (M4/M5/M6):
 *   m1  BREAK SAME-VISIT PAIRING (PIP-CANON -> an OR-aggregate across every
 *       visit for the day) — killed by case C2.4 / C5.11 (F4 cross-visit: the
 *       mutant lights BOTH pips from two different, uncompleted visits).
 *   m2  INVERT THE TODAY-EXCLUSION (`day <= csd` -> `day <= csd + 1`, a
 *       phantom row) — killed by case C5.7 (expects exactly `csd` rows / no
 *       day `csd+1`; the mutant adds one).
 *   m3  DROP THE NO-NEW-HALF SPECIAL CASE (the `'na'` branch removed from
 *       `derivePips`) — killed by case C4.2 / C5.2 (F3 dashed pip; the mutant
 *       reports `'off'` instead of `'na'`).
 *   m4  DROP BOOKMARK PRECEDENCE (`deriveDayState` checks the progress tier
 *       BEFORE bookmark, so a bookmarked re-completed day never shows
 *       `'bookmarked'`) — killed by case C4.1 / C5.3 (bookmark-precedence).
 *   m5  DROP THE `type:"retest"` EXCLUSION (`isLiveAttempt` always returns
 *       true) — killed by case C1.2 / C5.6 (a later rerun would then
 *       overwrite `testedAt` with its own later date).
 *   m6  DROP `canRetestTyped`'s WINDOW ROLLOVER (always trusts a stale
 *       refusal) — killed by case C6 (the STALE-window case expects `true`;
 *       the mutant keeps returning `false`).
 *
 * Run: node scripts/deepfix2/df2-51a-model-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51a-model-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const FIXTURE = fileURLToPath(new URL("./df2-51a-model-fixtures.mjs", import.meta.url));
const TARGET = fileURLToPath(new URL("../../src/utils/pastDayAuthority.js", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M1-CROSS-VISIT-PAIRING",
    clause: "PIP-CANON: partial progress reads the single canonical (most recent) visit only, never an OR-aggregate across every visit for the day (finding F4)",
    find: `  let canonical = null
  let canonicalMs = -Infinity
  for (const v of list) {
    if (!v) continue
    const ms = toMillis(v.createdAt)
    if (canonical === null || ms > canonicalMs) { canonical = v; canonicalMs = ms }
  }
  return {
    hasAnyVisit: true,
    hasCompletedVisit: false,
    reviewRecorded: canonical ? canonical.reviewHalfAttemptId != null : false,
    newRecorded: canonical ? canonical.newHalfAttemptId != null : false,
  }`,
    replace: `  // [MUTANT m1] PIP-CANON defeated — an OR-aggregate across EVERY visit for
  // the day, so two different, never-paired visits can light BOTH pips.
  return {
    hasAnyVisit: true,
    hasCompletedVisit: false,
    reviewRecorded: list.some((v) => v && v.reviewHalfAttemptId != null),
    newRecorded: list.some((v) => v && v.newHalfAttemptId != null),
  }`,
  },
  {
    id: "M2-TODAY-EXCLUSION-INVERTED",
    clause: "derivePastDays never emits a phantom currentStudyDay+1 row",
    find: `  for (let day = 1; day <= csd; day++) {`,
    replace: `  // [MUTANT m2] today-exclusion inverted — a phantom currentStudyDay+1 row
  for (let day = 1; day <= csd + 1; day++) {`,
  },
  {
    id: "M3-NO-NEW-HALF-SPECIAL-CASE-DROPPED",
    clause: "F3: a day with no new-word half renders the dashed 'na' pip, not 'off'",
    find: `    new: newRecorded ? PIP_STATES.ON : (hasNewHalf ? PIP_STATES.OFF : PIP_STATES.NOT_APPLICABLE),`,
    replace: `    // [MUTANT m3] the F3 'na' special case is dropped — always on/off
    new: newRecorded ? PIP_STATES.ON : PIP_STATES.OFF,`,
  },
  {
    id: "M4-BOOKMARK-PRECEDENCE-DROPPED",
    clause: "bookmark displaces the progress chip FIRST, before the tier is even considered",
    find: `  // PRECEDENCE: bookmark displaces the progress chip (wireframe Day 5) —
  // pips are unaffected (see derivePips) — checked FIRST, returns early.
  if (bookmarked) return DAY_STATES.BOOKMARKED
  if (hasCompletedVisit) return DAY_STATES.RE_COMPLETED
  if (reviewRecorded || newRecorded) return DAY_STATES.TESTED
  if (hasAnyVisit) return DAY_STATES.STUDIED
  return DAY_STATES.UNTOUCHED`,
    replace: `  // [MUTANT m4] bookmark precedence dropped — the tier wins even when bookmarked
  if (hasCompletedVisit) return DAY_STATES.RE_COMPLETED
  if (reviewRecorded || newRecorded) return DAY_STATES.TESTED
  if (hasAnyVisit) return DAY_STATES.STUDIED
  if (bookmarked) return DAY_STATES.BOOKMARKED
  return DAY_STATES.UNTOUCHED`,
  },
  {
    id: "M5-RETEST-EXCLUSION-DROPPED",
    clause: "originalAttemptsForDay/isLiveAttempt excludes type:'retest' so a rerun can never masquerade as the original completion",
    find: `export function isLiveAttempt(a) {
  return Boolean(a) && a.type !== 'retest'
}`,
    replace: `export function isLiveAttempt(a) {
  // [MUTANT m5] the retest exclusion is dropped — everything reads as live
  return Boolean(a)
}`,
  },
  {
    id: "M6-CANRETESTTYPED-WINDOW-ROLLOVER-DROPPED",
    clause: "canRetestTyped offers typed again once the KST window has rolled over past a prior refusal",
    find: `  if (typeof currentWindowKey === 'string' && currentWindowKey.length > 0 &&
      typeof metering.windowKey === 'string' && metering.windowKey !== currentWindowKey) {
    return true
  }
  return false`,
    replace: `  // [MUTANT m6] window rollover dropped — a stale refusal is trusted forever
  return false`,
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
  // pure evidence (the same audit-fixed idiom as dashboard-df2-33-mutants.mjs /
  // dashboard-streak-authority-mutants.mjs).
  const run = spawnSync(process.execPath, [FIXTURE], {
    encoding: "utf8",
    env: { ...process.env, DF2_51A_MODEL_PURE_RECEIPT: `${tmpdir()}/df2-51a-model-pure-mutant-run.json` },
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
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/df2-51a-model-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "df2-51a-model-mutants",
    pass: bad === 0,
    mutants: results,
    targetSha16: sha(original).slice(0, 16),
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ndf2-51a-model MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
