#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — rules-mutants.mjs: DOES THE MATRIX HAVE TEETH? (panel F7)
 * ============================================================================
 * The review panel's MEDIUM finding: the matrix's two whole-file mutation runs
 * (raw live base / repo P10 draft) prove the clause SET is load-bearing, but no
 * evidence showed that any INDIVIDUAL clause is pinned — a subtly wrong operand
 * could ship with every case still green.
 *
 * This runner mutates ONE clause at a time in the merged artifact, runs the full
 * matrix against each mutant, and REQUIRES the run to go red. A mutant that
 * stays green means that clause is unasserted — a matrix gap, reported as such.
 *
 * It also re-runs the two whole-file mutations against the CURRENT harness, so
 * every recorded number belongs to the harness that actually ships (the panel
 * caught the receipt quoting /136 totals for a 189-assertion matrix).
 *
 * READ-ONLY w.r.t. the repo: every mutant is written to a temp file.
 * Usage: NODE_PATH=/app/node_modules node scripts/deepfix2/rules-mutants.mjs
 * Exit: 0 every mutant died · 1 a mutant SURVIVED (matrix gap) or a run errored.
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MERGED = "/app/audit/deepfix/task3/live_baseline/firestore.merged.rules";
// REPOINTED AFTER THE r97 DEPLOY (2026-08-03). Both whole-file baselines used to
// be "some OTHER ruleset than the artifact", which is the only thing that makes a
// whole-file mutation meaningful. The deploy made both of them the artifact:
// `firestore.live.rules` is rewritten by fetch-live-rules.mjs (production now RUNS
// the artifact) and `/app/firestore.rules` was staged from the artifact to deploy
// it. Left alone, both runs would have scored a perfect green — and the runner
// fails closed on "a whole-file mutation stayed green", so this would have read as
// a defect rather than as a stale path. The order preserved exactly the two files
// this needs, which is what they were for.
const LIVE = "/app/audit/deepfix/task3/live_baseline/firestore.live.PRE_R79_DEPLOY.rules";
const P10 = "/app/audit/deepfix/task3/firestore.p10d.rules";
const RUNNER = "/app/scripts/deepfix2/run-rules-matrix.sh";
const MATRIX = "/app/scripts/deepfix2/rules-matrix.mjs";

const sha16 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
const base = readFileSync(MERGED, "utf8");
const scratch = mkdtempSync(join(tmpdir(), "rules-mutants-"));

/** One targeted edit each. `from` must appear exactly once in the artifact. */
const MUTANTS = [
  {
    id: "M1-delete-operand",
    why: "the study_states erasure guard must read the EXISTING doc, not the (null) incoming one",
    from: `               && resource.data.keys().hasAny(serverLabelKeys()))`,
    to: `               && request.resource.data.keys().hasAny(serverLabelKeys()))`,
  },
  {
    id: "M2-nine-list-hole",
    why: "dropping ONE subcollection name from ONE op branch must not slip through",
    from: `      return ['review_queues', 'review_presentations', 'day_completions',`,
    to: `      return ['review_presentations', 'day_completions',`,
  },
  {
    id: "M3-hasAny-to-hasOnly",
    why: "the six-label update guard must fire on ANY label, not only on a write of all six",
    from: `               && request.resource.data.diff(resource.data).affectedKeys().hasAny(serverLabelKeys()))`,
    to: `               && request.resource.data.diff(resource.data).affectedKeys().hasOnly(serverLabelKeys()))`,
  },
  {
    id: "M4-role-guard-removed",
    why: "HARDENING B1 — without it a student self-promotes to teacher",
    from: `        (isOwner(userId)
          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])) ||`,
    to: `        isOwner(userId) ||`,
  },
  {
    id: "M5-reset-fence-removed",
    why: "HARDENING B2 — without it the backfill's epoch fence is client-forgeable",
    from: `          && !request.resource.data.diff(resource.data).affectedKeys().hasAny(resetFenceKeys());`,
    to: `          ;`,
  },
  {
    id: "M8-fence-delete-removed",
    why: "panel r3 BLOCKER — without a DELETE-side fence, delete-then-recreate clears it (the r2 shape)",
    from: `          && !resource.data.keys().hasAny(resetFenceKeys());`,
    to: `          ;`,
  },
  {
    id: "M9-fence-create-removed",
    why: "panel r3 — the fence CREATE branch carried no mutant, so it was pinned by assertion only",
    from: `          && !request.resource.data.keys().hasAny(resetFenceKeys());`,
    to: `          ;`,
  },
  {
    id: "M10-attempt-create-guard-removed",
    why: "panel r3 — the attempt CREATE override guard carried no mutant",
    from: `        && !request.resource.data.keys().hasAny(serverOnlyAttemptKeys())`,
    to: `        && true`,
  },
  {
    id: "M11-users-create-widened",
    why: "panel r3 — the users CREATE clause carried no mutant (only assertions R10/R11)",
    from: `      allow create: if isAuthenticated() && isOwner(userId);`,
    to: `      allow create: if isAuthenticated();`,
  },
  {
    id: "M7-users-delete-reopened",
    why: "panel r2 BLOCKER — an open delete branch is a two-call bypass of the role guard",
    from: `      allow delete: if false;`,
    to: `      allow delete: if isAuthenticated() && isOwner(userId);`,
  },
  {
    id: "M13-manual-docid-guard-removed",
    why: "panel r5 — the manual-anchor docId is a SYNONYM three CS consumers key on; without the guard the r4 field fix is bypassable by naming the doc",
    from: `        && !attemptId.matches('.*[Mm]anual.*');`,
    to: `        ;`,
  },
  {
    id: "M14-engine-stamps-dropped",
    // RE-POINTED [codex r78]: the four engine keys moved out of serverOnlyAttemptKeys()
    // into engineStampKeys() (which serverOnlyAttemptKeys() now .concat()s). The old
    // anchor no longer exists, and an anchor that matches 0× is reported as
    // "mutant NOT applied" — a mutant silently ceasing to test anything. Mutating the
    // single declaration now breaks the request-side create/update guards AND the
    // resource-side marked-document guard at once, which is the point of the refactor.
    // Replaced with a never-present key rather than an empty list, so the mutant tests
    // the KEY SET rather than accidentally testing empty-list evaluation.
    why: "panel r5 — resetEpoch's PRESENCE is the engine/legacy discriminator (completion.js:340); dropping the engine stamps must break create, teacher update, AND the r78 resource-side guard",
    from: `      return ['resetEpoch', 'presentationId', 'queueId', 'engineResult'];`,
    to: `      return ['__no_engine_stamp__'];`,
  },
  {
    id: "M15-engine-resource-guard-removed",
    why: "codex r78 BLOCKER — the guard is RESOURCE-side; without it an owner (or the teacher of record) replaces `answers` on an already engine-stamped attempt while every marker and the score stay intact, and completeDay maps those rows into graduation (completion.js:340, :377-379, :601-603, :716-721). M14 could never detect this: it mutates the key LIST, and before r78 there was no resource-side guard to mutate.",
    from: `        && !isEngineStampedAttempt()`,
    to: `        && true`,
  },
  {
    id: "M12-manualOverride-dropped",
    why: "panel r4 BLOCKER — dropping the LIVE marker from the shared list must break create, update AND delete",
    from: `      return ['manualOverride', 'teacherEdited', 'teacherEditedBy', 'teacherEditedAt',`,
    to: `      return ['teacherEdited', 'teacherEditedBy', 'teacherEditedAt',`,
  },
  {
    id: "M6-attempt-erasure-removed",
    why: "CLAUSE 5 + r54 — without it a MARKED attempt (manualOverride/gatePosture) stays erasable",
    from: `        && !resource.data.keys().hasAny(serverOnlyAttemptKeys());`,
    to: `        ;`,
  },
];

function runMatrix(rulesPath) {
  try {
    const out = execFileSync("bash", [RUNNER, rulesPath], {
      encoding: "utf8", timeout: 300000, stdio: ["ignore", "pipe", "pipe"],
    });
    return parse(out);
  } catch (e) {
    // A red matrix exits 1 — that is a RESULT here, not an error.
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const parsed = parse(out);
    if (parsed) return parsed;
    throw new Error(`matrix run failed to produce a verdict for ${rulesPath}: ${out.slice(-400)}`);
  }
}
function parse(out) {
  const m = out.match(/RULES MATRIX \[rules sha256 ([0-9a-f]+)\]: (\d+)\/(\d+) green/);
  if (!m) return null;
  const failed = [...out.matchAll(/^\s+✗ (.+)$/gm)].map((x) => x[1].trim());
  return { rulesSha16: m[1], pass: Number(m[2]), total: Number(m[3]), failed };
}

const results = { matrixSha16: sha16(MATRIX), canonical: null, mutants: [], wholeFile: [] };

console.log(`[mutants] matrix sha16 ${results.matrixSha16}`);
console.log("[mutants] canonical run (must be fully green)…");
results.canonical = runMatrix(MERGED);
console.log(`  ${results.canonical.pass}/${results.canonical.total} (rules ${results.canonical.rulesSha16})`);
let bad = results.canonical.pass !== results.canonical.total;
if (bad) console.log("  !! the canonical artifact is not green — fix that before reading mutants");

for (const mut of MUTANTS) {
  const occurrences = base.split(mut.from).length - 1;
  if (occurrences !== 1) {
    console.log(`  !! ${mut.id}: anchor matched ${occurrences}× (expected 1) — mutant NOT applied`);
    results.mutants.push({ id: mut.id, why: mut.why, applied: false, killed: false });
    bad = true;
    continue;
  }
  const path = join(scratch, `${mut.id}.rules`);
  writeFileSync(path, base.replace(mut.from, mut.to));
  const r = runMatrix(path);
  const killed = r.pass !== r.total;
  results.mutants.push({
    id: mut.id, why: mut.why, applied: true, killed,
    pass: r.pass, total: r.total,
    // WHICH assertions died is the useful evidence — a clause is pinned by the
    // cases that notice its absence, whichever those turn out to be.
    killedBy: r.failed.slice(0, 6),
  });
  console.log(`  ${killed ? "KILLED" : "SURVIVED !!"} ${mut.id}: ${r.pass}/${r.total}` +
    (killed ? ` — first: ${r.failed[0]?.slice(0, 80)}` : ""));
  if (!killed) bad = true;
}

console.log("[mutants] whole-file runs against the CURRENT harness…");
for (const [label, path] of [["raw live base", LIVE], ["repo P10 draft", P10]]) {
  const r = runMatrix(path);
  results.wholeFile.push({
    label, rulesSha16: r.rulesSha16, pass: r.pass, total: r.total,
    failureCount: r.failed.length, failures: r.failed,
  });
  console.log(`  ${label}: ${r.pass}/${r.total} (${r.failed.length} failures)`);
  if (r.pass === r.total) { console.log("    !! a whole-file mutation stayed green"); bad = true; }
}
// The two whole-file runs can coincide on COUNT while failing for different
// reasons; the overlap is the evidence that they discriminate different things.
if (results.wholeFile.length === 2) {
  const [a, b] = results.wholeFile.map((w) => new Set(w.failures));
  const only = (x, y) => [...x].filter((f) => !y.has(f));
  results.wholeFileOverlap = {
    liveOnly: only(a, b).length, p10Only: only(b, a).length,
    shared: [...a].filter((f) => b.has(f)).length,
    p10OnlyExamples: only(b, a).slice(0, 8),
  };
  console.log(`  overlap: ${results.wholeFileOverlap.shared} shared · ` +
    `${results.wholeFileOverlap.liveOnly} live-only · ${results.wholeFileOverlap.p10Only} P10-only`);
}

// FAIL CLOSED if the harness moved under us: evidence must be reconstructable
// from the committed tree, or the numbers it certifies are unverifiable [panel r5].
const matrixNow = sha16(MATRIX);
if (matrixNow !== results.matrixSha16) {
  console.log(`\n!! matrix changed mid-run (${results.matrixSha16} -> ${matrixNow}) — re-run before publishing`);
  bad = true;
}
writeFileSync("/app/audit/deepfix/task3/live_baseline/rules-mutants-report.json",
  JSON.stringify(results, null, 2) + "\n");
console.log(`\n[mutants] ${bad ? "PROBLEM — see above" : `all ${MUTANTS.length} mutants killed; every MUTATED clause is pinned (clauses without a mutant are covered by assertion only — see the receipt)`}`);
process.exit(bad ? 1 : 0);
