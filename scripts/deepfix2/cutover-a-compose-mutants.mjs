#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-A COMPOSE — MUTANTS (C4 + C5): break the REAL module, expect RED
 * ============================================================================
 * Applies each mutant to `src/services/reviewV2Compose.js` IN PLACE (with a
 * [MUTANT marker so gate.mjs's residue scan fails closed if this run dies),
 * runs the pure fixture suite, and requires it to EXIT NON-ZERO. Restores the
 * original bytes afterwards and verifies sha-equality — same discipline as
 * typed-seam-mutants.mjs.
 *
 *   M-C4  the TEST set is sourced from the day QUEUE instead of
 *         `presentedWordIds` — killed by the ORDER case's
 *         "presented verbatim" assertion (queue order ≠ presented order by
 *         fixture construction).
 *   M-C5  `freshKey` is IGNORED — a retake reuses the stale persisted
 *         composeKey (the server would replay the OLD presentation) — killed
 *         by the C9/V5 case's "retake mints a NEW key" assertion.
 *
 * OPUS AUDIT FOLD mutants (2026-08-04) — one per fix, re-introducing the
 * exact defect the audit found:
 *   M-F3  the distractor pool is RE-NARROWED to the presented subset —
 *         killed by "originalWordPool contains the WHOLE day queue" (+ the
 *         strictly-larger and 4-option assertions).
 *   M-F2  the review range label is RE-POINTED at the dead segment values —
 *         killed by "review wordRangeStart/End is null".
 *   M-F4  the client cap is RE-ADDED to a server-composed typed set —
 *         killed by "60 served ⇒ 60 rendered" (and the 120 leg).
 *   M-F5  the invalid-day fallback is RE-SILENCED (legacy with no via, no
 *         log) — killed by "via invalid_day" + "logged exactly once".
 *
 * Run: node scripts/deepfix2/cutover-a-compose-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/cutover-a-compose-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const TARGET = fileURLToPath(new URL("../../src/services/reviewV2Compose.js", import.meta.url));
const FIXTURE = fileURLToPath(new URL("./cutover-a-compose-fixtures.mjs", import.meta.url));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M-C4-TEST-SET-FROM-QUEUE",
    clause: "the test set is presentedWordIds, verbatim (A1)",
    find: `      // VERBATIM (V3): the served order is the rendered order.
      presentedWordIds: [...presentedWordIds],
      queueWordIds: [...queueWordIds],`,
    replace: `      // [MUTANT M-C4] test set sourced from the queue instead of presentedWordIds
      presentedWordIds: [...queueWordIds],
      queueWordIds: [...queueWordIds],`,
  },
  {
    id: "M-C5-STALE-KEY-ON-RETAKE",
    clause: "a deliberate retake mints a NEW composeKey (V5)",
    find: `  const composeFn = deps.composeSessionFn ?? composeSession
  const scope = composeKeyScope({ uid, classId, listId, logicalDay, kind: 'review' })
  if (freshKey) discardComposeKey(scope, deps) // deliberate retake ⇒ NEW presentation`,
    replace: `  const composeFn = deps.composeSessionFn ?? composeSession
  const scope = composeKeyScope({ uid, classId, listId, logicalDay, kind: 'review' })
  // [MUTANT M-C5] freshKey ignored — the stale persisted key is reused on a retake`,
  },
  {
    id: "M-F3-NARROW-POOL",
    clause: "the distractor pool is the FULL pool, never the presented subset (F3)",
    find: `    originalWordPool: rv2DistractorPool({ words: rv2.words, poolWords: rv2.poolWords }),`,
    replace: `    // [MUTANT M-F3] the pool is re-narrowed to the presented subset
    originalWordPool: [...rv2.words],`,
  },
  {
    id: "M-F2-SEGMENT-RANGE-LABEL",
    clause: "the review range label is nulled — the segment is dead flag-on (F2)",
    find: `    ...(isNew ? {} : { wordRangeStart: null, wordRangeEnd: null }),`,
    replace: `    // [MUTANT M-F2] the dead segment range label survives to the review page
    ...(isNew ? {} : {}),`,
  },
  {
    id: "M-F4-RETRUNCATE-TYPED",
    clause: "a server-composed typed set is never truncated (F4)",
    find: `export function rv2ServedTypedWords(words = []) {
  return [...words]
}`,
    replace: `export function rv2ServedTypedWords(words = []) {
  // [MUTANT M-F4] the client cap is back on a server-composed set
  return [...words].slice(0, 50)
}`,
  },
  {
    id: "M-F5-SILENT-DAY-FALLBACK",
    clause: "an invalid logicalDay is an OBSERVABLE legacy outcome (F5)",
    find: `function invalidDayOutcome(logicalDay, kind, deps) {
  const log = deps.logInvalidDay ?? console.error
  log('[RV2] compose skipped — invalid logicalDay; the legacy path serves this session', {
    logicalDay: Number.isFinite(logicalDay) ? logicalDay : null,
    kind,
  })
  return {
    outcome: 'legacy',
    via: 'invalid_day',
    logicalDay: Number.isFinite(logicalDay) ? logicalDay : null,
  }
}`,
    replace: `function invalidDayOutcome(logicalDay, kind, deps) { // eslint-disable-line no-unused-vars
  // [MUTANT M-F5] the original bug: a SILENT legacy slide — no log, no named via
  return { outcome: 'legacy' }
}`,
  },
];

const original = readFileSync(TARGET, "utf8");
const originalSha = sha(original);
const results = [];
let bad = 0;

for (const m of MUTANTS) {
  if (!original.includes(m.find)) {
    console.error(`FATAL: mutant ${m.id} anchor not found — the module drifted; re-anchor the mutant`);
    process.exit(2);
  }
  const mutated = original.replace(m.find, m.replace);
  if (mutated === original) { console.error(`FATAL: mutant ${m.id} produced no change`); process.exit(2); }
  writeFileSync(TARGET, mutated);
  // Redirect the fixture's receipt so a mutant run can NEVER clobber the canonical
  // pure evidence [audit F1]. Without this the last run wins and a mutants-last
  // sequence publishes a mutant's FAILING result as the fold's receipt.
  const run = spawnSync(process.execPath, [FIXTURE], {
    encoding: "utf8",
    env: {...process.env, CUTOVER_A_PURE_RECEIPT: `${tmpdir()}/cutover-a-pure-mutant-run.json`},
  });
  writeFileSync(TARGET, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(TARGET, "utf8")) === originalSha;
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
  console.error("✗ MUTANT residue left in the module — restore failed");
}

mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/cutover-a-compose-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "cutover-a-compose-mutants",
    pass: bad === 0,
    mutants: results,
    targetSha16: originalSha.slice(0, 16),
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ncutover-a-compose MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
