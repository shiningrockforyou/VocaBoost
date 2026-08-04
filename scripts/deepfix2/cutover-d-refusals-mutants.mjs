#!/usr/bin/env node
/**
 * ============================================================================
 * CUTOVER-D REFUSALS — MUTANTS (ledger C3 + C4): break the REAL code, expect RED
 * ============================================================================
 * Applies each mutant IN PLACE (with a [MUTANT marker so gate.mjs's residue
 * scan fails closed if this run dies), runs the PURE fixture suite
 * (cutover-d-refusals-fixtures.mjs — no emulator needed for either mutant),
 * and requires it to EXIT NON-ZERO. Restores the original bytes afterwards
 * and verifies sha-equality — same discipline as cutover-b-submit-mutants.mjs
 * / cutover-a-compose-mutants.mjs.
 *
 *   M-C3-MCQ-REVERT    (client, src/pages/MCQTest.jsx)
 *       reverts the A1 fix: the SUCCESSFUL grade_unusable swap goes back to
 *       `setError(out.reason)` — the exact state-collision bug V2 found
 *       (blocks behind the full-page interstitial instead of the non-blocking
 *       submitError banner). Killed by the C1 case's "OLD buggy anchor is
 *       GONE" / "ZERO occurrences of setError(out.reason)" checks.
 *
 *   M-C3-TYPED-REVERT  (client, src/pages/TypedTest.jsx)
 *       same revert, TypedTest's leg: back to bare `setError(out.reason)`
 *       (dropping gradingErrorKind:'transient' too) instead of the page's own
 *       non-blocking gradingError treatment. Killed by the C1/TypedTest case.
 *
 *   M-C4-A2-DROP       (client, src/services/reviewV2Compose.js)
 *       removes the REUSE_ANCHOR_MISMATCH entry from REFUSAL_REASONS, so the
 *       status falls through to the generic catch-all again — the exact
 *       coverage gap A2 closes. Killed by the C2 case's "reuse_anchor_mismatch
 *       is SPECIFIC — it differs from the generic reason" check.
 *
 * RUNBOOK: node scripts/deepfix2/cutover-d-refusals-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/cutover-d-refusals-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";

const MCQ_TARGET = "/app/src/pages/MCQTest.jsx";
const TYPED_TARGET = "/app/src/pages/TypedTest.jsx";
const COMPOSE_TARGET = "/app/src/services/reviewV2Compose.js";
const PURE_FIXTURE = "/app/scripts/deepfix2/cutover-d-refusals-fixtures.mjs";
const sha = (s) => createHash("sha256").update(s).digest("hex");

const MUTANTS = [
  {
    id: "M-C3-MCQ-REVERT",
    clause: "MCQTest.jsx: a SUCCESSFUL recompose renders through the non-blocking banner, not `error` (A1)",
    target: MCQ_TARGET,
    find: "                setSubmitError(out.reason)\n              } catch (swapErr) {",
    replace: "                // [MUTANT M-C3-MCQ] reverted to the pre-fix bug: error blocks behind the full-page interstitial\n                setError(out.reason)\n              } catch (swapErr) {",
  },
  {
    id: "M-C3-TYPED-REVERT",
    clause: "TypedTest.jsx: a SUCCESSFUL recompose renders through gradingError('transient'), not `error` (A1)",
    target: TYPED_TARGET,
    find: "                setGradingErrorKind('transient')\n                setGradingError(out.reason)\n              } catch (swapErr) {",
    replace: "                // [MUTANT M-C3-TYPED] reverted to the pre-fix bug: error blocks behind the full-page interstitial\n                setError(out.reason)\n              } catch (swapErr) {",
  },
  {
    id: "M-C4-A2-DROP",
    clause: "reuse_anchor_mismatch has a specific, non-generic reason (A2)",
    target: COMPOSE_TARGET,
    find: `  // A2 (cutover-d coverage gap): composer.js's same-day cross-class reuse
  // path (composer.js:358-367) refuses when this class's word-universe
  // anchor doesn't match the class that first composed the shared day — real
  // data drift, not something a reload alone reliably fixes. Same two-step
  // register as REASON_UNUSABLE_TERMINAL (reviewV2Submit.js): try reloading,
  // tell the teacher if it repeats. Student-safe — never names anchorNwei/
  // generation/the cross-class mechanism.
  [RV2.REUSE_ANCHOR_MISMATCH]:
    '오늘의 학습 세션을 준비하는 중 문제가 발생했습니다. 페이지를 새로고침한 뒤에도 반복되면 선생님께 알려 주세요. ' +
    '(There was a problem preparing today\\'s session — reload the page, and tell your teacher if it repeats.)',
`,
    replace: "  // [MUTANT M-C4] the REUSE_ANCHOR_MISMATCH entry is dropped — falls through to GENERIC again\n",
  },
];

const results = [];
let bad = 0;

for (const m of MUTANTS) {
  const original = readFileSync(m.target, "utf8");
  const originalSha = sha(original);
  if (!original.includes(m.find)) {
    console.error(`FATAL: mutant ${m.id} anchor not found in ${m.target} — the module drifted; re-anchor the mutant`);
    process.exit(2);
  }
  const mutated = original.replace(m.find, m.replace);
  if (mutated === original) { console.error(`FATAL: mutant ${m.id} produced no change`); process.exit(2); }
  writeFileSync(m.target, mutated);

  const receiptPath = `${tmpdir()}/cutover-d-pure-mutant-${m.id}.json`;
  const run = spawnSync(process.execPath, [PURE_FIXTURE], {
    encoding: "utf8",
    env: { ...process.env, CUTOVER_D_PURE_RECEIPT: receiptPath },
  });

  writeFileSync(m.target, original); // restore IMMEDIATELY, before judging
  const restoredOk = sha(readFileSync(m.target, "utf8")) === originalSha;

  const summaryMatch = (run.stdout || "").match(/PURE: (\d+) checks, (\d+) failures/);
  const killed = run.status !== 0;
  results.push({
    id: m.id, clause: m.clause, target: m.target.replace("/app/", ""),
    killed, fixtureExit: run.status,
    checks: summaryMatch ? Number(summaryMatch[1]) : null,
    failures: summaryMatch ? Number(summaryMatch[2]) : null,
    restoredOk,
  });
  if (!killed) {
    bad++;
    console.error(`✗ ${m.id} SURVIVED — the fixture did not detect it`);
    console.error(run.stdout);
    console.error(run.stderr);
  } else {
    console.log(`✓ ${m.id} killed (exit ${run.status}, ${summaryMatch ? summaryMatch[2] : "?"} red check(s))`);
  }
  if (!restoredOk) { bad++; console.error(`✗ ${m.id} RESTORE FAILED — module bytes differ from original`); }
}

// Final belt: the tree must carry no mutant residue.
for (const t of [MCQ_TARGET, TYPED_TARGET, COMPOSE_TARGET]) {
  if (readFileSync(t, "utf8").includes("[MUTANT")) {
    bad++;
    console.error(`✗ MUTANT residue left in ${t} — restore failed`);
  }
}

mkdirSync("/app/docs/plans/deepfix2/evidence/", { recursive: true });
writeFileSync("/app/docs/plans/deepfix2/evidence/cutover-d-refusals-mutants.json", JSON.stringify({
  kind: "cutover-d-refusals-mutants",
  pass: bad === 0,
  mutants: results,
  targetShas16: {
    "src/pages/MCQTest.jsx": sha(readFileSync(MCQ_TARGET, "utf8")).slice(0, 16),
    "src/pages/TypedTest.jsx": sha(readFileSync(TYPED_TARGET, "utf8")).slice(0, 16),
    "src/services/reviewV2Compose.js": sha(readFileSync(COMPOSE_TARGET, "utf8")).slice(0, 16),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ncutover-d-refusals MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, restore ${bad ? "DIRTY" : "clean"}`);
process.exit(bad ? 1 : 0);
