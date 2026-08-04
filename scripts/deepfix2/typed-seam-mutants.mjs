#!/usr/bin/env node
/**
 * ============================================================================
 * DEEPFIX2 — typed-seam-mutants.mjs: DOES THE TYPED-FIX LAP HAVE TEETH?
 * ============================================================================
 * The typed-fix-audit fold added four guards (ledger A1-A4). Fixtures prove the
 * guards FIRE; they do not prove any individual CLAUSE is load-bearing — a
 * clause could be dead code and every case would stay green. This runner removes
 * ONE clause at a time from the real source file, runs the FULL engine lap
 * against the mutated tree, and REQUIRES the lap to go RED. A mutant that
 * survives is an unasserted clause, reported as such.
 *
 * `M-A1-PREFIX-CONSUMER` removes all three cached-grade clauses at once: that is
 * literally the code this fold replaced, so its run is the pre-fix behaviour
 * measured by the post-fix fixtures.
 *
 * The runner has since taken on guards from later folds that are measured the
 * same way — currently `M-A1-UID-SCOPE-REVERT` (rv2-docid-collision A1: the
 * engine's DERIVED GLOBAL doc ids, `attempts/{id}` and `grading_jobs/{key}`,
 * are uid-scoped by one shared function in composer.js, so reverting it reverts
 * both legs at once). The name stays for continuity of the evidence file.
 *
 * MUTATION IS IN-PLACE, because the lap hard-codes /app paths and a copied tree
 * would not be the code under test. Every original is snapshotted to a temp
 * directory AND to memory, restored in `finally`, on every fatal signal, and on
 * uncaughtException; the run ends by re-hashing each file against its original
 * sha and failing LOUDLY if anything differs. The backup path is printed BEFORE
 * the first mutation so a hard kill is always recoverable by hand.
 *
 * A mutant whose anchor does not match EXACTLY ONCE is reported as
 * "NOT APPLIED" and fails the run — a stale anchor must never look like a pass.
 *
 * Usage (from /app): node scripts/deepfix2/typed-seam-mutants.mjs
 * Exit: 0 every mutant killed · 1 a mutant SURVIVED, an anchor went stale, a run
 *       errored, or a source file did not restore.
 */

import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import { join, basename } from "node:path";

const TG = "/app/functions/reviewV2/typedGrading.js";
const COMPLETION = "/app/functions/reviewV2/completion.js";
const CALLABLES = "/app/functions/reviewV2/callables.js";
const COMPOSER = "/app/functions/reviewV2/composer.js";
const LAP = "/app/scripts/deepfix2/engine-emulator-lap.mjs";
const REPORT = "/app/docs/plans/deepfix2/evidence/typed-seam-mutants.json";

const sha16 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 16);

/** One clause each. `from` MUST appear exactly once in the file. */
const MUTANTS = [
  {
    id: "M-A1a-provenance-source",
    file: TG,
    why: "A1(a): without `source === reviewV2` any payload the LIVE gradeTypedTest cached under `rv2_{presentationId}` is accepted as an engine grade",
    edits: [{
      from: `  if (payload.source !== "reviewV2") return null;`,
      to: `  // [MUTANT M-A1a] engine-provenance clause removed`,
    }],
  },
  {
    id: "M-A1b-provenance-presentation",
    file: TG,
    why: "A1(b): without the presentation clause an engine grade for P1 is reusable under P2's key (cross-presentation replay)",
    edits: [{
      from: `  if (payload.presentationId !== presentationId) return null;`,
      to: `  // [MUTANT M-A1b] this-presentation clause removed`,
    }],
  },
  {
    id: "M-A2-answer-sheet-binding",
    file: TG,
    why: "A2: without the sheet clause a cached grade is reused for a DIFFERENT set of answers than the one it graded",
    edits: [{
      from: `  if (payload.answerSheetKey !== sheetKey) return null;`,
      to: `  // [MUTANT M-A2] answer-sheet clause removed`,
    }],
  },
  {
    id: "M-A1-PREFIX-CONSUMER",
    file: TG,
    why: "ALL THREE clauses removed = the code this fold replaced (`Array.isArray(payload.results)` was the whole acceptance test). The lap must go red against the pre-fix consumer, or the fixtures prove nothing about the hole.",
    edits: [
      {from: `  if (payload.source !== "reviewV2") return null;`, to: `  // [MUTANT prefix] (a) removed`},
      {from: `  if (payload.presentationId !== presentationId) return null;`, to: `  // [MUTANT prefix] (b) removed`},
      {from: `  if (payload.answerSheetKey !== sheetKey) return null;`, to: `  // [MUTANT prefix] (c) removed`},
    ],
  },
  {
    id: "M-A1-SIBLING-CALL-SITE",
    // RE-POINTED 2026-08-04: the rv2-refusal-status audit fix (F1) split the
    // `snap.exists ? … : null` ternary into an explicit `!snap.exists` early
    // return, so this anchor matched 0x and the runner reported NOT APPLIED and
    // failed the battery — exactly as designed. Worth keeping as the record: a
    // legitimate fix SILENTLY DISARMED the mutant guarding the sibling seam, and
    // only the fail-loud-on-stale-anchor rule caught it. A mutant that quietly
    // stops applying is worse than no mutant, because the run still goes green.
    file: TG,
    why: "A1, THE SECOND CALL SITE: a cached payload enters the engine at TWO seams. The clause mutants above and M-A1-PREFIX-CONSUMER all attack the SHARED PREDICATE, so they die at whichever seam a fixture happens to drive. This one reverts ONLY the `already_graded` branch (typedGrading.js:295-308) to the pre-fix `Array.isArray(payload.results)` and leaves `return_cached` (:263) and the predicate itself fully guarded — the state an accidental revert of that one branch would ship. It survived the entire lap before CASE TS existed (376/376 green), so it is the direct measure of whether the sibling seam has any evidence behind it.",
    edits: [{
      from: `      const theirs = usableCachedResults(snap.data().payload, {presentationId, sheetKey});`,
      to: `      // [MUTANT M-A1-SIBLING] second call site reverted to the PRE-FIX test\n      const theirs = Array.isArray(snap.data().payload?.results) ? snap.data().payload.results : null;`,
    }],
  },
  {
    id: "M-REFUSAL-PERMANENT-AS-TRANSIENT",
    file: TG,
    why: "rv2-refusal-status C4 — reverts BOTH permanent refusal sites (`return_cached` refused + its `already_graded` sibling) to `grading_in_progress`, i.e. the pre-split server. A `graded` job never self-clears, so that status told a conforming client (frozen contract: poll the SAME submit, never recompose) to poll FOREVER. Every C1-class assertion must notice the wrong status: TX C1/C4/C5/C11-drift pin the return_cached site, TS S1/S3 pin the sibling — both seams, so a one-seam revert cannot hide behind the other's coverage.",
    edits: [
      {
        from: `    if (results === null) return {refusal: {status: "grade_unusable"}};`,
        to: `    if (results === null) return {refusal: {status: "grading_in_progress"}}; // [MUTANT] permanent-as-transient`,
      },
      {
        from: `      if (theirs === null) return {refusal: {status: "grade_unusable"}};`,
        to: `      if (theirs === null) return {refusal: {status: "grading_in_progress"}}; // [MUTANT] permanent-as-transient`,
      },
    ],
  },
  {
    id: "M-REFUSAL-TRANSIENT-AS-UNUSABLE",
    file: TG,
    why: "rv2-refusal-status C5, the OTHER direction — the live-lease site returns `grade_unusable`. A swapped split is indistinguishable from a correct one under one-directional mutation: this direction tells the client to RECOMPOSE (a different test, a different composeKey) exactly when polling the same submit is correct and the lease is about to resolve. The §5.5 concurrent-submit control (CASE T) and the C11 lease-refusal control (CASE TX) must go red.",
    edits: [{
      from: `  if (claim.action === "in_progress") return {refusal: {status: "grading_in_progress"}};`,
      to: `  if (claim.action === "in_progress") return {refusal: {status: "grade_unusable"}}; // [MUTANT] transient-as-unusable`,
    }],
  },
  {
    id: "M-A3-wordid-presentation-binding",
    file: COMPLETION,
    why: "A3: without the fence a stored row naming a word the server never presented is counted as tested-correct and graduates",
    edits: [{
      from: `          .filter((r) => serverPresentedIds === null || serverPresentedIds.has(r.wordId))`,
      to: `          // [MUTANT M-A3] wordId↔presentation fence removed`,
    }],
  },
  {
    id: "M-A4-replay-provenance",
    file: CALLABLES,
    why: "A4: with the predicate forced true, ANY document sitting at `attempts/rv2_{presentationId}` is served back as an engine replay",
    edits: [{
      from: `function isEngineAttemptFor(stored, {uid, presentationId}) {\n  if (!stored || typeof stored !== "object") return false;`,
      to: `function isEngineAttemptFor(stored, {uid, presentationId}) {\n  return true; // [MUTANT M-A4] replay-provenance check removed\n  /* eslint-disable no-unreachable */\n  if (!stored || typeof stored !== "object") return false;`,
    }],
  },
  {
    id: "M-A1-JOBKEY-ONLY-REVERT",
    file: TG,
    why: "rv2-collision audit F4 — THE SINGLE-LEG MUTANT. M-A1-UID-SCOPE-REVERT edits the SHARED engineDocId, so it reverts BOTH legs at once and dies at whichever leg a fixture happens to reach. That is exactly the blind spot M-A1-SIBLING-CALL-SITE exists to cover elsewhere. This one reverts ONLY the typed leg's jobKey (typedGrading.js) and leaves callables.js' attemptId correctly scoped — the state a partial refactor or a bad merge would ship. The grading_jobs assertions in CASE RC must notice that the two students share a job key while holding separate attempts.",
    edits: [{
      from: `  const jobKey = engineDocId(uid, presentationId);`,
      to: `  const jobKey = \`rv2_\${presentationId}\`; // [MUTANT jobkey-only] pre-fix scheme, attemptId left scoped`,
    }],
  },
  {
    id: "M-A1-UID-SCOPE-REVERT",
    file: COMPOSER,
    // NOTE: double-quoted, NOT a template literal — `from`/`to` contain
    // `${uid}`/`${presentationId}` verbatim and must not be interpolated here.
    why: "rv2-docid-collision A1: reverts the uid scoping of the engine's DERIVED GLOBAL ids. `attempts` and `grading_jobs` are top-level while `presentationId` carries no uid and `seq` counts per user, so without the uid every student in one class+list+day+epoch derives the SAME attempt id and grading-job key — the first student lands and the second is refused (typed: `permission-denied` on the job claim). Reverting the ONE shared function reverts BOTH legs together, which is exactly the pre-fix state. The collision fixtures (lap CASE RC + CASE TR (10)) must go red.",
    edits: [{
      from: "  return `rv2_${uid}_${presentationId}`;",
      to: "  return `rv2_${presentationId}`; // [MUTANT M-A1-UID-SCOPE-REVERT] uid scoping reverted",
    }],
  },
];

// ---------------------------------------------------------------------------
// SAFETY: snapshot every file we will touch, on disk and in memory, and restore
// through every exit path there is.
// ---------------------------------------------------------------------------
const FILES = [...new Set(MUTANTS.map((m) => m.file))];
const ORIGINAL = new Map();
const ORIGINAL_SHA = new Map();
const backupDir = mkdtempSync(join(tmpdir(), "typed-seam-originals-"));
mkdirSync(backupDir, {recursive: true});
for (const f of FILES) {
  const content = readFileSync(f, "utf8");
  ORIGINAL.set(f, content);
  ORIGINAL_SHA.set(f, sha16(content));
  writeFileSync(join(backupDir, basename(f)), content);
}
let restored = false;
function restoreAll() {
  for (const [f, content] of ORIGINAL) {
    try { if (readFileSync(f, "utf8") !== content) writeFileSync(f, content); } catch { /* best effort */ }
  }
  restored = true;
}
process.on("exit", restoreAll);
process.on("uncaughtException", (e) => { restoreAll(); console.error(e); process.exit(1); });
process.on("unhandledRejection", (e) => { restoreAll(); console.error(e); process.exit(1); });
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => { restoreAll(); process.exit(130); });
}
console.log(`[typed-mutants] originals backed up to ${backupDir}`);
for (const f of FILES) console.log(`   ${ORIGINAL_SHA.get(f)}  ${f}`);

// ---------------------------------------------------------------------------
const PROJECT = JSON.parse(readFileSync("/app/scripts/serviceAccountKey.json", "utf8")).project_id;
const FIREBASE = join(homedir(), "fbtools/node_modules/.bin/firebase");
const JAVA_BIN = join(homedir(), "jre/jdk-21.0.12+8-jre/bin");
const scratch = mkdtempSync(join(tmpdir(), "typed-seam-lap-"));

/** Run the FULL engine lap once. Returns {exit, pass, total, reds, crashed}. */
function runLap(label) {
  const receipt = join(scratch, `${label}.json`);
  const res = spawnSync(FIREBASE,
      ["emulators:exec", "--only", "firestore", "--project", PROJECT,
        "node scripts/deepfix2/engine-emulator-lap.mjs"],
      {
        cwd: "/app",
        env: {
          ...process.env,
          PATH: `${JAVA_BIN}:${process.env.PATH}`,
          NODE_PATH: "/app/node_modules",
          ENGINE_LAP_RECEIPT: receipt,
        },
        encoding: "utf8", timeout: 1200000, maxBuffer: 256 * 1024 * 1024,
      });
  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const m = out.match(/==== ENGINE LAP v3: (\d+)\/(\d+) green/);
  const summaryReds = [...out.matchAll(/^RED: (.+)$/gm)].map((x) => x[1].trim());
  // The `RED: …` list is printed only by the END-OF-RUN summary, so a lap that
  // CRASHES reported "killed by nothing" — the least useful evidence there is,
  // exactly when you most want to know which assertion noticed first. Fall back
  // to the in-run lines (`  RED <name>: got … want …`, console.error'd by
  // `check` as each one fails), which are present either way.
  const inRunReds = [...out.matchAll(/^ {2}RED (.+)$/gm)].map((x) => x[1].trim());
  const reds = summaryReds.length > 0 ? summaryReds : inRunReds;
  return {
    exit: res.status,
    pass: m ? Number(m[1]) : null,
    total: m ? Number(m[2]) : null,
    // The lap can also die before printing a summary (an unhandled throw from a
    // fixture's own precondition). That is still a red run, but a DIFFERENT
    // kind, so it is labelled rather than silently merged.
    crashed: m === null,
    reds,
    tail: m === null ? out.slice(-900) : null,
  };
}

const results = {kind: "typed-seam-mutants", at: new Date().toISOString(), canonical: null, mutants: []};
let bad = false;

console.log("[typed-mutants] canonical run (must be fully green)…");
results.canonical = runLap("canonical");
console.log(`  ${results.canonical.pass}/${results.canonical.total} exit=${results.canonical.exit}`);
if (results.canonical.crashed || results.canonical.exit !== 0 ||
    results.canonical.pass !== results.canonical.total) {
  console.log("  !! the canonical lap is not green — fix that before reading any mutant");
  bad = true;
}

for (const mut of MUTANTS) {
  const base = ORIGINAL.get(mut.file);
  let mutated = base;
  let anchorProblem = null;
  for (const e of mut.edits) {
    const n = mutated.split(e.from).length - 1;
    if (n !== 1) { anchorProblem = `anchor matched ${n}× (expected 1): ${e.from.slice(0, 70)}`; break; }
    mutated = mutated.replace(e.from, e.to);
  }
  if (anchorProblem) {
    // LOUD, never a silent skip: a stale anchor means the mutant stopped testing
    // anything the moment the code moved.
    console.log(`  !! ${mut.id}: NOT APPLIED — ${anchorProblem}`);
    results.mutants.push({id: mut.id, file: mut.file, why: mut.why, applied: false, killed: false, anchorProblem});
    bad = true;
    continue;
  }
  writeFileSync(mut.file, mutated);
  let r;
  try {
    r = runLap(mut.id);
  } finally {
    writeFileSync(mut.file, base);
  }
  const killed = r.exit !== 0;
  results.mutants.push({
    id: mut.id, file: mut.file, why: mut.why, applied: true, killed,
    mode: r.crashed ? "crash" : "red-assertions",
    exit: r.exit, pass: r.pass, total: r.total,
    // WHICH assertions died is the evidence that the clause is pinned by the
    // fixtures that claim to pin it.
    killedBy: r.reds.slice(0, 8), redCount: r.reds.length,
    tail: r.tail,
  });
  console.log(`  ${killed ? "KILLED" : "SURVIVED !!"} ${mut.id}: ` +
    (r.crashed ? `lap crashed (exit ${r.exit})` : `${r.pass}/${r.total}, ${r.reds.length} red`) +
    (killed && r.reds[0] ? ` — first: ${r.reds[0].slice(0, 90)}` : ""));
  if (!killed) bad = true;
}

// FAIL CLOSED on the tree: every mutated file must be byte-identical to how we
// found it, or the numbers above describe a tree nobody can reproduce.
restoreAll();
for (const f of FILES) {
  const now = sha16(readFileSync(f, "utf8"));
  if (now !== ORIGINAL_SHA.get(f)) {
    console.log(`\n!! ${f} did NOT restore (${ORIGINAL_SHA.get(f)} -> ${now}). Original is at ${join(backupDir, basename(f))}`);
    bad = true;
  }
}
results.lapSha16 = sha16(readFileSync(LAP, "utf8"));
results.sourceShas = Object.fromEntries(FILES.map((f) => [f, sha16(readFileSync(f, "utf8"))]));
results.pass = !bad;
writeFileSync(REPORT, JSON.stringify(results, null, 2) + "\n");
console.log(`\n[typed-mutants] ${bad ? "PROBLEM — see above" : `all ${MUTANTS.length} mutants killed`} (report: ${REPORT})`);
console.log(restored ? "[typed-mutants] tree restored" : "[typed-mutants] !! tree NOT restored");
process.exit(bad ? 1 : 0);
