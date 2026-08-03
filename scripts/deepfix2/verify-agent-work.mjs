#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — verify-agent-work.mjs: TRUST THE DIFF, NOT THE REPORT
 * ============================================================================
 * An agent's summary is a CLAIM. `git diff` is a FACT. This compares the two,
 * and independently checks that nothing forbidden was touched.
 *
 * Three things it catches that a self-report cannot:
 *   1. files changed but NOT declared (the dangerous case — scope creep,
 *      collateral edits, an "unrelated" fix nobody reviewed);
 *   2. files declared but NOT changed (the work did not actually happen);
 *   3. any edit to a protected path, regardless of what the report says.
 *
 * Usage:
 *   node scripts/deepfix2/verify-agent-work.mjs <baseline-sha> [claimed.json] [--repo <path>]
 *     baseline-sha  the commit HEAD sat at when the agent was launched
 *     claimed.json  optional: {"filesChanged":[...]} from the agent's report.
 *                   WITHOUT it the report-vs-diff reconciliation does not run.
 *     --repo <path> the tree the agent actually worked in. REQUIRED when the
 *                   agent ran under isolation:"worktree" — otherwise this diffs
 *                   the main tree, finds nothing, and prints CLEAN while the real
 *                   changes sit in the worktree.
 * Exit: 0 clean · 1 findings (protected path, flag flip, or claims disagree)
 *       · 2 THE CHECK DID NOT RUN (missing/unresolvable baseline). 2 is NOT clean.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const repoIx = argv.indexOf("--repo");
const REPO = repoIx >= 0 ? argv[repoIx + 1] : "/app";
if (repoIx >= 0) argv.splice(repoIx, 2);
const baseline = argv[0];
if (!baseline) { console.error("usage: verify-agent-work.mjs <baseline-sha> [claimed.json]"); process.exit(2); }

// Paths no agent may touch. Edit deliberately; this is the whole point.
const PROTECTED = [
  { re: /^firestore\.rules$/, why: "the unshipped P10 cutover at the live deploy path" },
  { re: /^audit\/deepfix\/task3\//, why: "the rules artifact — a security review is in flight on it" },
  { re: /^docs\/plans\/loop\//, why: "agent coordination (batons, handoffs, reviews)" },
  { re: /^firebase\.json$/, why: "deploy configuration" },
  { re: /^scripts\/serviceAccountKey\.json$/, why: "production credentials" },
  { re: /^\.env/, why: "secrets" },
];
// Flag VALUE changes are protected even inside an allowed file.
const FLAG_FILES = [/^src\/config\/featureFlags\.js$/, /^functions\/foundation\.js$/];

const git = (...a) => execFileSync("git", ["-C", REPO, ...a], { encoding: "utf8" });
if (REPO !== "/app") console.log(`(verifying worktree ${REPO})\n`);

let changed;
try {
  changed = git("diff", "--name-only", `${baseline}..HEAD`).split("\n").filter(Boolean);
  // -uall lists every untracked FILE; without it a new directory collapses to a
  // single entry and the files inside it escape the per-file checks below.
  const dirty = git("status", "--porcelain", "-uall").split("\n").filter(Boolean)
    // A rename arrives as "old.js -> new.js"; take BOTH sides or renaming a
    // protected file evades the anchored checks below.
    .flatMap((l) => l.slice(3).trim().split(" -> ")).map((x) => x.trim()).filter(Boolean);
  changed = [...new Set([...changed, ...dirty])];
} catch (e) {
  console.error(`cannot diff from ${baseline}: ${e.message.split("\n")[0]}`);
  process.exit(2);
}

let bad = 0;
console.log(`ACTUAL CHANGES since ${baseline} (committed + working tree): ${changed.length} file(s)\n`);
for (const f of changed) console.log(`   ${f}`);

console.log("\nPROTECTED PATHS:");
const violations = [];
for (const f of changed) {
  const hit = PROTECTED.find((p) => p.re.test(f));
  if (hit) violations.push(`${f} — ${hit.why}`);
}
if (violations.length) { bad = 1; violations.forEach((v) => console.log(`  ✗ TOUCHED: ${v}`)); }
else console.log("  ✓ none touched");

// A flag VALUE flip is the single most dangerous silent change in this repo.
const flagFiles = changed.filter((f) => FLAG_FILES.some((r) => r.test(f)));
if (flagFiles.length) {
  console.log("\nFLAG VALUES (a silent flip is the most dangerous change here):");
  for (const f of flagFiles) {
    let d = "";
    try { d = git("diff", `${baseline}..HEAD`, "--", f) + git("diff", "--", f); } catch {}
    const flips = d.split("\n").filter((l) => /^[+-].*(=\s*(true|false)|ENABLED|_V2|SERVER_)/.test(l)
      && !/^[+-]{3}/.test(l) && !/^\s*[+-]\s*\/\//.test(l));
    if (flips.length) { bad = 1; console.log(`  ✗ ${f}:`); flips.forEach((l) => console.log(`      ${l.trim()}`)); }
    else console.log(`  ✓ ${f} — no value change`);
  }
}

const claimPath = argv[1];
if (claimPath && existsSync(claimPath)) {
  const claimed = (JSON.parse(readFileSync(claimPath, "utf8")).filesChanged || [])
    .map((f) => f.replace(/^\/app\//, ""));
  const undeclared = changed.filter((f) => !claimed.includes(f));
  const phantom = claimed.filter((f) => !changed.includes(f));
  console.log("\nREPORT vs DIFF:");
  if (undeclared.length) {
    bad = 1;
    console.log(`  ✗ CHANGED BUT NOT DECLARED (${undeclared.length}) — the dangerous direction:`);
    undeclared.forEach((f) => console.log(`      ${f}`));
  }
  if (phantom.length) {
    bad = 1;
    console.log(`  ✗ DECLARED BUT NOT CHANGED (${phantom.length}) — the work did not happen:`);
    phantom.forEach((f) => console.log(`      ${f}`));
  }
  if (!undeclared.length && !phantom.length) console.log("  ✓ the report matches the diff exactly");
}

// A diff can be rewritten (amend / reset / force). The reflog cannot be, from
// inside the same worktree — so it is the check on the check.
try {
  const rl = git("reflog", "--date=iso", "-40").split("\n").filter(Boolean);
  // Match the reflog ACTION field only. A first pass matched the word "reset"
  // inside commit MESSAGES ("close the delete-side reset fence") and reported
  // five ordinary commits as history rewrites.
  const rewrites = rl.filter((l) => {
    const m = l.match(/HEAD@\{[^}]+\}:\s*([^:]+):/);
    return m && /^(reset|rebase|amend|commit \(amend\))/i.test(m[1].trim());
  });
  console.log("\nHISTORY INTEGRITY (reflog):");
  if (rewrites.length) {
    console.log(`  ! ADVISORY — ${rewrites.length} history-rewriting entr(ies); this does NOT set the exit code, so confirm each was yours:`);
    rewrites.slice(0, 5).forEach((l) => console.log(`      ${l.slice(0, 110)}`));
  } else console.log("  ✓ no reset/amend/rebase in the last 40 entries");
} catch { console.log("\nHISTORY INTEGRITY: reflog unavailable"); }

// The agents' own tool-call transcripts are a SECOND independent record: they
// log what an agent DID, not what it said. Point at them.
console.log("\nSECOND RECORD — agent tool-call transcripts (what they DID, not what they claim):");
console.log("  ~/.claude/projects/-app/<session>/subagents/workflows/<run>/agent-*.jsonl");
console.log("  journal.jsonl in the same directory holds each agent's actual return value.");

console.log(`\n${bad ? "VERIFY FAILED — read the diff before believing the report" : "VERIFY CLEAN"}`);
process.exit(bad);
