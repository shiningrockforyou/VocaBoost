#!/usr/bin/env node
/*
 * ============================================================================
 * NTF-26 · LEG 3 FIXTURES — the pre-AI uniform-filler guard, in isolation
 * ============================================================================
 * WHY A SEPARATE SUITE: scripts/grader-regression.mjs calls the Anthropic API
 * directly with the extracted prompt, so it exercises leg 1 (the prompt) and
 * NEVER touches leg 3 (the code guard inside gradeTypedTest). This file is the
 * other half: PURE node, ZERO API calls, ZERO spend, no firebase credentials.
 *
 * It tests the REAL shipped helpers — `functions/index.js` exports them at
 * `exports._uniformFiller` (same deploy-inert plain-object shape as
 * `_gradingJobs`; a plain object carries no `__endpoint`, so the functions
 * runtime loader mints nothing from it). Requiring index.js under plain node
 * works (it initialises firebase-admin lazily and prints one "cold start" log
 * line to stdout — that line is expected noise, not a failure).
 *
 * MUTANTS mutate the SHIPPED SOURCE TEXT, not a paraphrase: each helper's own
 * `Function.prototype.toString()` is string-replaced and re-instantiated with
 * `new Function`. Every mutation asserts its anchor matched EXACTLY ONCE — a
 * mutation that silently did not apply would otherwise be scored "killed" by a
 * suite that never mutated anything. A canonical rebuild (no mutation) is
 * cross-checked against the real export on every case, so the rebuild
 * machinery itself is proven faithful before any mutant is judged.
 *
 *   node scripts/deepfix2/ntf26-heuristic-fixtures.mjs
 *   EVIDENCE_OUT=/path/to.json  (default docs/plans/deepfix2/evidence/ntf26-heuristic-fixtures.json)
 * Exit 0 = every case passed AND every mutant was killed. Non-zero otherwise.
 */
import { writeFileSync, readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createHash } from "crypto";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(resolve(REPO, "functions") + "/");
const INDEX = resolve(REPO, "functions", "index.js");
const SELF = resolve(REPO, "scripts", "deepfix2", "ntf26-heuristic-fixtures.mjs");
const EVIDENCE_OUT = process.env.EVIDENCE_OUT
  || resolve(REPO, "docs/plans/deepfix2/evidence/ntf26-heuristic-fixtures.json");
const sha16 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);

const surface = require(INDEX);
if (!surface || !surface._uniformFiller) {
  console.error("FAIL: functions/index.js does not export _uniformFiller");
  process.exit(2);
}
const {
  findUniformFillerGroups, normalizeUniformResponse,
  UNIFORM_FILLER_MIN_ROWS, UNIFORM_FILLER_REASONING,
} = surface._uniformFiller;

// ── row helpers ──────────────────────────────────────────────────────────────
let _id = 0;
const row = (studentResponse) => ({ wordId: `w${++_id}`, studentResponse });
const rows = (n, studentResponse) => Array.from({ length: n }, () => row(studentResponse));
/** n genuine, all-different answers — nothing that could ever group. */
const genuine = (n) => Array.from({ length: n }, (_, i) => row(`meaning number ${i + 1}`));
/** deterministic interleave so the flagged rows are scattered, not a block */
function scatter(a, b) {
  const out = []; let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length) out.push(a[i++]);
    if (j < b.length) out.push(b[j++]);
    if (j < b.length) out.push(b[j++]);
  }
  return out;
}

// ── THE CASES (the ledger C1 bypass set, one case per path) ──────────────────
function buildCases() {
  _id = 0;
  const cases = [];

  // 1 — AT the threshold: 8 identical → all 8 flagged.
  {
    const r = rows(8, "answer");
    cases.push({ id: 1, name: "8 identical → all 8 flagged", rows: r, expect: r.map((x) => x.wordId) });
  }
  // 2 — BELOW the threshold: 7 identical → untouched.  [kills mutant m1]
  {
    const r = rows(7, "answer");
    cases.push({ id: 2, name: "7 identical → untouched (below threshold)", rows: r, expect: [] });
  }
  // 3 — PARTIAL test: 8 identical scattered among 30 rows → ONLY those 8.
  {
    const filler = rows(8, "answer");
    const good = genuine(22);
    const r = scatter(filler, good);
    cases.push({ id: 3, name: "8 identical among 30 → only those 8", rows: r, expect: filler.map((x) => x.wordId) });
  }
  // 4 — NORMALIZATION: case + surrounding whitespace variants are ONE group.  [kills mutant m2]
  {
    const variants = ["answer", "Answer", "ANSWER", " answer", "answer ", "  AnSwEr  ", "\tanswer", "answer\n"];
    const r = variants.map((v) => row(v));
    cases.push({ id: 4, name: "8 case/whitespace variants group as one", rows: r, expect: r.map((x) => x.wordId) });
  }
  // 5 — BLANKS never group, however many of them there are.
  {
    const blanks = ["", "   ", "\t", "", " ", "", "\n", "  ", "", " ", "", "\t "].map((v) => row(v));
    const r = [...blanks, ...genuine(3)];
    cases.push({ id: 5, name: "12 blank/whitespace rows → nothing flagged", rows: r, expect: [] });
  }
  // 6 — TWO sub-threshold groups do not add up.
  {
    const r = [...rows(4, "answer"), ...rows(4, "test"), ...genuine(2)];
    cases.push({ id: 6, name: "4+4 two different groups → untouched", rows: r, expect: [] });
  }
  return cases;
}

const flaggedIds = (impl, caseRows) =>
  impl(caseRows).flatMap((g) => g.rows.map((x) => x.wordId)).sort();
const eq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ── rebuild-from-source (the mutation substrate) ─────────────────────────────
const CANON_SRC =
  `const UNIFORM_FILLER_MIN_ROWS = ${UNIFORM_FILLER_MIN_ROWS};\n` +
  `${normalizeUniformResponse.toString()}\n` +
  `${findUniformFillerGroups.toString()}\n` +
  `return findUniformFillerGroups;`;

/** Apply `anchor`→`repl`, REFUSING unless it matched exactly once. */
function mutate(src, anchor, repl) {
  const hits = src.split(anchor).length - 1;
  if (hits !== 1) throw new Error(`mutation anchor matched ${hits}x (expected exactly 1): ${JSON.stringify(anchor)}`);
  return src.replace(anchor, repl);
}
const instantiate = (src) => new Function(src)();

const MUTANTS = [
  {
    id: "m1", what: "threshold 8 → 2",
    anchor: `const UNIFORM_FILLER_MIN_ROWS = ${UNIFORM_FILLER_MIN_ROWS};`,
    repl: "const UNIFORM_FILLER_MIN_ROWS = 2;",
    mustBeKilledBy: [2, 6],
  },
  {
    id: "m2", what: "drop normalization (.trim().toLowerCase() → identity)",
    anchor: ".trim().toLowerCase()", repl: "",
    mustBeKilledBy: [4],
  },
];

// ── run ──────────────────────────────────────────────────────────────────────
const evidence = {
  generatedAt: new Date().toISOString(),
  suite: "ntf26-heuristic-fixtures",
  underTest: "functions/index.js exports._uniformFiller.findUniformFillerGroups",
  threshold: UNIFORM_FILLER_MIN_ROWS,
  reasoning: UNIFORM_FILLER_REASONING,
  sourceShas: { "functions/index.js": sha16(INDEX), "scripts/deepfix2/ntf26-heuristic-fixtures.mjs": sha16(SELF) },
  cases: [], rebuildCrossCheck: [], mutants: [],
};

console.log(`NTF-26 leg-3 fixtures — threshold=${UNIFORM_FILLER_MIN_ROWS}, pure, 0 API calls`);
console.log(`under test: ${INDEX} → exports._uniformFiller\n`);

let failures = 0;
console.log("CASES (real exported helper)");
for (const c of buildCases()) {
  const got = flaggedIds(findUniformFillerGroups, c.rows);
  const pass = eq(got, c.expect);
  if (!pass) failures++;
  console.log(`  [${pass ? "PASS" : "FAIL"}] case ${c.id}: ${c.name} — rows=${c.rows.length} flagged=${got.length} expected=${c.expect.length}`);
  evidence.cases.push({ id: c.id, name: c.name, rows: c.rows.length, expectedFlagged: c.expect, gotFlagged: got, pass });
}

// The rebuild must behave identically to the export, else a "killed" mutant proves nothing.
console.log("\nREBUILD CROSS-CHECK (Function.prototype.toString → new Function)");
const canonical = instantiate(CANON_SRC);
for (const c of buildCases()) {
  const a = flaggedIds(findUniformFillerGroups, c.rows);
  const b = flaggedIds(canonical, c.rows);
  const pass = eq(a, b);
  if (!pass) failures++;
  evidence.rebuildCrossCheck.push({ id: c.id, pass, exportFlagged: a.length, rebuiltFlagged: b.length });
  if (!pass) console.log(`  [FAIL] case ${c.id}: export flagged ${a.length}, rebuild flagged ${b.length}`);
}
console.log(`  [${evidence.rebuildCrossCheck.every((x) => x.pass) ? "PASS" : "FAIL"}] rebuild agrees with the export on all ${evidence.rebuildCrossCheck.length} cases`);

console.log("\nMUTANTS (each must be KILLED by at least one case)");
for (const mu of MUTANTS) {
  let impl = null, applyError = null;
  try { impl = instantiate(mutate(CANON_SRC, mu.anchor, mu.repl)); }
  catch (e) { applyError = e.message; }
  const killedBy = [];
  if (impl) {
    for (const c of buildCases()) {
      if (!eq(flaggedIds(impl, c.rows), c.expect)) killedBy.push(c.id);
    }
  }
  // A mutant that could not even be applied is NOT a pass — the anchor moved.
  const expectedKillers = mu.mustBeKilledBy.every((id) => killedBy.includes(id));
  const killed = !applyError && killedBy.length > 0 && expectedKillers;
  if (!killed) failures++;
  console.log(`  [${killed ? "KILLED" : "SURVIVED"}] ${mu.id} (${mu.what}) — killed by case(s) [${killedBy.join(",")}]` +
    (applyError ? ` · MUTATION DID NOT APPLY: ${applyError}` : "") +
    (!applyError && !expectedKillers ? ` · expected killers ${mu.mustBeKilledBy.join(",")} did NOT all fire` : ""));
  evidence.mutants.push({ id: mu.id, what: mu.what, applied: !applyError, applyError, killedBy, expectedKillers: mu.mustBeKilledBy, killed });
}

// ── WIRING (the helper being right is not the same as it being CONNECTED) ────
// The pure cases above cannot see a wiring bug — a forgotten early return, a
// missed merge, rows sent to the AI anyway. These two call the REAL
// `gradeTypedTest` through `.run()` (the same entry `functions/reviewV2/
// typedGrading.js:146` uses), grade-ONLY (no writeContext/gradeContext, no
// listId/classId), which means:
//   · `callerMayResolveList` returns false at index.js:950 BEFORE any read ⇒ zero Firestore;
//   · `jobAttemptDocId` is null ⇒ the grading-job leg is inert ⇒ zero Firestore;
//   · both GRADE_TOKEN flags are false ⇒ no secret is touched.
// W1 (ALL rows filler) also makes ZERO Anthropic calls — it is the early-return
// exit (index.js `if (answersForAI.length === 0)`), so it is free and always runs.
// W2 (8 filler + 2 genuine) is the OTHER exit — the combinedResults merge — and it
// necessarily costs ONE small Anthropic call, so it runs ONLY when
// ANTHROPIC_API_KEY is set, and is reported as SKIPPED (not passed) otherwise.
console.log("\nWIRING (real gradeTypedTest.run — grade-only, no Firestore)");
const wireRow = (i, student) => ({
  wordId: `x${i}`, word: `word${i}`, correctDefinition: `definition ${i}`,
  koreanDefinition: `뜻${i}`, studentResponse: student,
});
async function runWiring() {
  // W1 — every non-blank row is filler ⇒ AI is never constructed, early exit.
  {
    const answers = Array.from({ length: 10 }, (_, i) => wireRow(i + 1, i % 2 ? "Answer " : "answer"));
    const res = await surface.gradeTypedTest.run({ data: { answers }, auth: { uid: "fixture-uid" } });
    const r = Array.isArray(res?.results) ? res.results : [];
    const pass = r.length === 10 &&
      r.every((x) => x.isCorrect === false && x.reasoning === UNIFORM_FILLER_REASONING) &&
      r.map((x) => x.wordId).join(",") === answers.map((a) => a.wordId).join(",");
    if (!pass) failures++;
    console.log(`  [${pass ? "PASS" : "FAIL"}] W1 all-filler early exit — ${r.length} rows returned, ` +
      `${r.filter((x) => x.isCorrect === false).length} incorrect, 0 API calls (mixed case grouped)`);
    evidence.wiring = [{ id: "W1", name: "all-filler → early return, zero AI calls", rows: 10, returned: r.length, pass }];
  }
  // W2 — the merge exit. Costs ONE Anthropic call; opt-in via the key.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("  [SKIP] W2 merge exit — set ANTHROPIC_API_KEY to run it (1 small Anthropic call)");
    evidence.wiring.push({ id: "W2", name: "8 filler + 2 genuine → merge exit", skipped: true, reason: "no ANTHROPIC_API_KEY" });
    return;
  }
  const filler = Array.from({ length: 8 }, (_, i) => wireRow(100 + i, "answer"));
  const genuineRows = [
    { wordId: "g1", word: "piano", correctDefinition: "a large keyboard musical instrument", koreanDefinition: "피아노", studentResponse: "피아노" },
    { wordId: "g2", word: "dissonance", correctDefinition: "a lack of harmony among musical notes", koreanDefinition: "불협화음", studentResponse: "불협화음" },
  ];
  const answers = [...filler.slice(0, 4), genuineRows[0], ...filler.slice(4), genuineRows[1]];
  let r = [];
  let err = null;
  try {
    const res = await surface.gradeTypedTest.run({ data: { answers }, auth: { uid: "fixture-uid" } });
    r = Array.isArray(res?.results) ? res.results : [];
  } catch (e) { err = e.message; }
  const byId = new Map(r.map((x) => [x.wordId, x]));
  const fillerOk = filler.every((f) => byId.get(f.wordId)?.isCorrect === false &&
    byId.get(f.wordId)?.reasoning === UNIFORM_FILLER_REASONING);
  const genuineOk = genuineRows.every((g) => byId.get(g.wordId)?.isCorrect === true);
  const orderOk = r.map((x) => x.wordId).join(",") === answers.map((a) => a.wordId).join(",");
  const pass = !err && r.length === 10 && fillerOk && genuineOk && orderOk;
  if (!pass) failures++;
  console.log(`  [${pass ? "PASS" : "FAIL"}] W2 merge exit — ${r.length} rows, filler-failed=${fillerOk}, ` +
    `genuine-passed=${genuineOk}, order-preserved=${orderOk}${err ? ` · ERROR ${err}` : ""}`);
  evidence.wiring.push({
    id: "W2", name: "8 filler + 2 genuine → merge exit", skipped: false, returned: r.length,
    fillerAllFailedByGuard: fillerOk, genuineAllCorrect: genuineOk, orderPreserved: orderOk, error: err, pass,
  });
}
await runWiring();

const casesPassed = evidence.cases.filter((c) => c.pass).length;
const mutantsKilled = evidence.mutants.filter((m) => m.killed).length;
evidence.totals = {
  cases: evidence.cases.length, casesPassed,
  crossChecks: evidence.rebuildCrossCheck.length,
  crossChecksPassed: evidence.rebuildCrossCheck.filter((x) => x.pass).length,
  mutants: evidence.mutants.length, mutantsKilled,
  wiring: (evidence.wiring || []).filter((w) => !w.skipped).length,
  wiringPassed: (evidence.wiring || []).filter((w) => !w.skipped && w.pass).length,
  wiringSkipped: (evidence.wiring || []).filter((w) => w.skipped).length,
};
evidence.failed = failures;
evidence.pass = failures === 0;
writeFileSync(EVIDENCE_OUT, JSON.stringify(evidence, null, 2));
console.log(`\ncases ${casesPassed}/${evidence.cases.length} · mutants killed ${mutantsKilled}/${evidence.mutants.length} · evidence: ${EVIDENCE_OUT}`);
console.log(failures === 0 ? "RESULT: PASS" : `RESULT: FAIL — ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
