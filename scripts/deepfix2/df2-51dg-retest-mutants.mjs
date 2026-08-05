#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-d + 51-g — MUTANTS: break each NEW clause, prove a fixture goes RED.
 * ============================================================================
 * TWO FAMILIES, chosen per target for the same reason 51-c/51-f gave:
 *
 *  DISK mutants (M1-M4, M6-M8) — `src/services/restudyRetest.js` is THIS
 *    fold's own new, single-purpose module (nothing else imports it yet except
 *    the three call sites this fold wrote), so it is mutated IN PLACE and
 *    restored, with the restore VERIFIED by sha256 before the next mutant runs
 *    — the strongest available proof (the same technique dashboard-df2-33-
 *    mutants.mjs uses on `dayStatusAuthority.js`). A `finally` restores even
 *    if the child run throws, and the driver refuses to continue if a restore
 *    ever fails to reproduce the original sha.
 *
 *  IN-MEMORY text-anchor mutants (M5, M9) — the targets are `MCQTest.jsx` /
 *    `TypedTest.jsx`, THE live path for 947 students. 51-f made the identical
 *    call for `Dashboard.jsx`: the file's bytes are read once, mutated in a JS
 *    STRING (never written to disk), and the SAME anchor assertion the pure
 *    fixture's C4.3 group runs is re-evaluated against that copy; it must flip
 *    green → red. Same proof, strictly less risk.
 *
 * Run: node scripts/deepfix2/df2-51dg-retest-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51dg-retest-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MODULE = "/app/src/services/restudyRetest.js";
const FIXTURES = "/app/scripts/deepfix2/df2-51dg-retest-fixtures.mjs";
const RECEIPT = join(tmpdir(), `df2-51dg-mutant-receipt-${process.pid}.json`);

const sha = (s) => createHash("sha256").update(s).digest("hex");
const original = readFileSync(MODULE, "utf8");
const originalSha = sha(original);

const results = [];
let bad = 0;

/** Run the pure fixture suite against whatever is currently on disk. */
function runFixtures() {
  try {
    execFileSync("node", [FIXTURES], {
      cwd: "/app", encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DF2_51DG_PURE_RECEIPT: RECEIPT },
    });
  } catch { /* non-zero exit = reds, which is what a mutant wants */ }
  if (!existsSync(RECEIPT)) return { pass: null, failed: null, reds: ["fixture produced no receipt"] };
  const r = JSON.parse(readFileSync(RECEIPT, "utf8"));
  try { unlinkSync(RECEIPT); } catch { /* best effort */ }
  return r;
}

/**
 * @param {string} id
 * @param {string} what the clause being broken
 * @param {[string,string]} edit [find, replace] — `find` MUST occur EXACTLY once
 * @param {RegExp} expectRed a red line the mutated run must produce
 */
function diskMutant(id, what, [find, replace], expectRed) {
  const occurrences = original.split(find).length - 1;
  if (occurrences !== 1) {
    bad++;
    results.push({ id, what, ok: false, note: `anchor matched ${occurrences} times, expected exactly 1` });
    console.error(`  ✗ ${id}: anchor matched ${occurrences} times — MUTANT NOT APPLIED`);
    return;
  }
  let receipt;
  try {
    writeFileSync(MODULE, original.replace(find, replace));
    receipt = runFixtures();
  } finally {
    writeFileSync(MODULE, original);
    if (sha(readFileSync(MODULE, "utf8")) !== originalSha) {
      console.error(`  ✗✗ ${id}: RESTORE FAILED — halting`);
      process.exit(2);
    }
  }
  const reds = receipt.reds || [];
  const caught = reds.some((r) => expectRed.test(r));
  if (!caught || receipt.failed === 0) {
    bad++;
    console.error(`  ✗ ${id}: NOT CAUGHT (failed=${receipt.failed})`);
  } else {
    console.log(`  ✓ ${id}: caught — ${receipt.failed} red(s), e.g. ${reds.find((r) => expectRed.test(r))}`);
  }
  results.push({ id, what, ok: caught && receipt.failed > 0, failedChecks: receipt.failed, sampleRed: reds.find((r) => expectRed.test(r)) ?? null });
}

/**
 * @param {string} id
 * @param {string} file
 * @param {string} what
 * @param {[string,string]} edit
 * @param {(src: string) => boolean} anchorHolds the SAME assertion C4.3 makes
 */
function textMutant(id, file, what, [find, replace], anchorHolds) {
  const src = readFileSync(file, "utf8");
  const occurrences = src.split(find).length - 1;
  if (occurrences !== 1) {
    bad++;
    results.push({ id, what, ok: false, note: `anchor matched ${occurrences} times, expected exactly 1` });
    console.error(`  ✗ ${id}: anchor matched ${occurrences} times — MUTANT NOT APPLIED`);
    return;
  }
  const green = anchorHolds(src) === true;             // holds on the REAL file
  const red = anchorHolds(src.replace(find, replace)); // must fail on the mutant
  const ok = green && red === false;
  if (!ok) { bad++; console.error(`  ✗ ${id}: NOT CAUGHT (green=${green}, mutantStillGreen=${red})`); }
  else console.log(`  ✓ ${id}: caught (assertion holds on the real file, fails on the mutant)`);
  results.push({ id, what, ok, greenOnReal: green, greenOnMutant: red, diskUntouched: true });
}

console.log("DF2-51-d/g MUTANTS\n");

console.log("M1 — the rerun compose stops attaching the visitId");
diskMutant("M1", "compose omits visitId (the engine would refuse visit_invalid; the client would never know)",
  ["result = await composeFn({ classId, listId, visitedDay, half, visitId, composeKey })",
    "result = await composeFn({ classId, listId, visitedDay, half, composeKey })"],
  /compose call carries the minted visitId/);

console.log("M2 — the spend cap is classified as TRANSIENT (pollable)");
diskMutant("M2", "practice_limit_reached joins the poll loop — a permanent refusal polled forever",
  ["    if (!isGradingInProgress(result)) break",
    "    if (!isGradingInProgress(result) && !isPracticeLimitReached(result)) break"],
  /must NOT poll on a cap|submit called exactly once|outcome/);

console.log("M3 — the cap pre-empt is applied to an MCQ class");
diskMutant("M3", "MCQ re-tests (unmetered) get hidden by a typed cap",
  ["  if (reviewTestType !== 'typed') return false\n  return !canRetestTyped({ metering, currentWindowKey })",
    "  return !canRetestTyped({ metering, currentWindowKey })"],
  /mcq \+ capped/);

console.log("M4 — a rerun recompose is routed to the LIVE compose surface");
diskMutant("M4", "grade_unusable on a rerun composes a LIVE test for a PAST day",
  ["  const composeFn = deps.composeRerunFn ?? composeRerun",
    "  const composeFn = deps.composeSessionFn ?? composeRerun"],
  /LIVE compose never used|rerun compose used once/);

console.log("M5 — a rerun reaches the legacy client study_state write");
textMutant("M5", "/app/src/pages/MCQTest.jsx", "processTestResults runs for a practice retest",
  ["if (!rv2Rerun && !resultsProcessedRef.current) {", "if (!resultsProcessedRef.current) {"],
  (src) => src.includes("if (!rv2Rerun && !resultsProcessedRef.current) {"));

console.log("M6 — the rerun testConfig is allowed to carry a dayNumber");
diskMutant("M6", "the pages' completion gate becomes reachable from a retest",
  ["  delete safeBase.dayNumber\n", ""],
  /no dayNumber/);

console.log("M7 — the reload persistence is dropped (NTF-27 regressed)");
diskMutant("M7", "the blob handle stops carrying presentedWordIds ⇒ a reload drift-rejects again",
  ["    presentedWordIds,\n    // The pool ALWAYS contains the presented set",
    "    // The pool ALWAYS contains the presented set"],
  /presented ids survive|not rebuildable/);

console.log("M8 — the composeKey is REUSED after a re-mint (V7)");
diskMutant("M8", "the retry replays a key fingerprinted to the DEAD visit ⇒ compose_key_reused",
  ["  if (remint.outcome === 'reminted') return runCompose(remint.visitId, true)",
    "  if (remint.outcome === 'reminted') return runCompose(remint.visitId, false)"],
  /DIFFERENT composeKey/);

console.log("M9 — the rerun branch falls back to the legacy submit path");
textMutant("M9", "/app/src/pages/TypedTest.jsx", "a rerun sets rv2Fallback ⇒ the legacy grade+write runs for a past day",
  ["              logSystemEvent('rv2_retest_blocked', {", "              rv2Fallback = true\n              logSystemEvent('rv2_retest_blocked', {"],
  (src) => {
    const start = src.indexOf("if (rv2Rerun) {");
    const end = src.indexOf("} else if (rv2Handle) {");
    return start > 0 && end > start && !/rv2Fallback\s*=\s*true/.test(src.slice(start, end));
  });

// Final integrity: the module on disk is byte-identical to where we started.
const finalSha = sha(readFileSync(MODULE, "utf8"));
const restored = finalSha === originalSha;
if (!restored) { bad++; console.error("  ✗ restodyRetest.js was NOT restored"); }

mkdirSync("/app/docs/plans/deepfix2/evidence", { recursive: true });
writeFileSync("/app/docs/plans/deepfix2/evidence/df2-51dg-retest-mutants.json", JSON.stringify({
  kind: "df2-51dg-retest-mutants",
  pass: bad === 0 && restored,
  total: results.length,
  caught: results.filter((r) => r.ok).length,
  uncaught: results.filter((r) => !r.ok).length,
  restored,
  moduleSha: finalSha.slice(0, 16),
  results,
  at: new Date().toISOString(),
}, null, 2));
console.log(`\nMUTANTS: ${results.filter((r) => r.ok).length}/${results.length} caught · module restored: ${restored}`);
process.exit(bad === 0 && restored ? 0 : 1);
