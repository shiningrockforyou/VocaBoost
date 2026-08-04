#!/usr/bin/env node
/**
 * ============================================================================
 * DASHBOARD-DF2-33 — PURE fixtures (no Firebase, no network, no Vite)
 * ============================================================================
 * Exercises the REAL `src/utils/dayStatusAuthority.js` (the pure day-status
 * derivation + its two shared predicates), plus STATIC source-text anchors
 * proving flag-off parity (C2) and the brief's mandated grep-proofs (C3).
 * Mirrors `dashboard-streak-authority-fixtures.mjs`'s harness (same
 * CASE/check/checkTrue idiom, evidence-JSON with sourceShas) per the df2-33
 * BRIEF's instruction to reuse that fold's fixture conventions.
 *
 *   C1  the derivation BYPASS SET (all pure, hand-fed args) — brief's 7 named
 *       cases: non-demoting · never-demote · resolved null/undefined → raw
 *       (+ a brand-new-user progress-null sub-case) · attempts:null → phase/
 *       doneToday null AND phaseOracle never invoked (call-counted, not just
 *       discarded) · attempts:[] computes normally (oracle IS invoked) ·
 *       stub-oracle passthrough (phase/doneToday derive from the oracle's
 *       return, exact call-arg shape pinned) · attemptsForList/csdForRow
 *       predicate fixtures · a TRY at importing the REAL
 *       determineStartingPhase under plain node (case 7 — see its own CASE
 *       for the outcome; the brief's own escape hatch says defer to the
 *       rehearsal if this can't load, do NOT reimplement the oracle here).
 *   C2  FLAG-OFF PARITY static anchors on Dashboard.jsx: the hero's legacy
 *       4-statement sequence's load-bearing substrings present verbatim
 *       (substring-based, not whole-block — the IIFE wrapper this fold adds
 *       re-indents the block, which is cosmetic only, ledger A2); the
 *       ListProgressStats legacy substrings present verbatim; PLUS a
 *       streak-untouched cross-check (calculateStreak's body, the streak
 *       ternary head, both render sites, the 3 `streakDays: 0,` branches,
 *       the destructure line, and the other 2 streakDays writer files —
 *       re-verified here as an independent second confirmation since this
 *       fold edits the same file the streak fold did).
 *   C3  GREP-PROOFS (brief-mandated): REVIEW_V2_CLIENT occurrence count in
 *       Dashboard.jsx (current vs HEAD, i.e. before this fold); the literal
 *       substring `currentStudyDay + 1` remaining sites in Dashboard.jsx
 *       (must be unchanged from HEAD — the only NEW site with that exact
 *       shape lives in the module, checked separately); the module carries
 *       zero firebase/firestore imports (checked structurally: zero `import`
 *       statements AND zero case-insensitive `firebase`/`firestore`
 *       substring anywhere in the file).
 *
 * Run: node scripts/deepfix2/dashboard-df2-33-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/dashboard-df2-33-pure.json
 * (DASHBOARD_DF2_33_PURE_RECEIPT env redirects the receipt for the mutant
 * driver, same audit-fixed idiom as dashboard-streak-authority-fixtures.mjs.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import { deriveListDayStatus, attemptsForList, csdForRow } from "../../src/utils/dayStatusAuthority.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);
// A BENIGN (never-throwing) stub for cases that pass attempts:null and only
// care about the day-number math — NEVER a literal `null` for phaseOracle,
// so that IF a mutant defeats the "attempts:null -> oracle never called"
// guarantee (C1.4/m3), these cases fail with a CLEAN red check (the existing
// `phase null` assertion flips to this stub's distinctive marker) instead of
// crashing the whole suite on a `null is not a function` TypeError — a crash
// would still exit non-zero ("killed" either way), but would make the kill's
// cause murky (which case actually caught it) rather than cleanly attributed.
const unusedOracle = () => ({ phase: 'UNEXPECTED-ORACLE-CALL' });

// ===========================================================================
// C1 — the derivation BYPASS SET
// ===========================================================================
CASE("C1.1 — NON-DEMOTING: raw 3 / resolved 5 → csd 5, displayDay 6");
{
  const r = deriveListDayStatus({ progress: { currentStudyDay: 3 }, attempts: null, resolvedCsd: 5, phaseOracle: unusedOracle });
  check("currentStudyDay", r.currentStudyDay, 5);
  check("displayDay", r.displayDay, 6);
  check("phase null (attempts not supplied)", r.phase, null);
  check("doneToday null (attempts not supplied)", r.doneToday, null);
}

CASE("C1.2 — NEVER-DEMOTE: raw 5 / resolved 4 → stays 5 (not demoted), displayDay 6");
{
  const r = deriveListDayStatus({ progress: { currentStudyDay: 5 }, attempts: null, resolvedCsd: 4, phaseOracle: unusedOracle });
  check("currentStudyDay stays at the higher raw value", r.currentStudyDay, 5);
  check("displayDay", r.displayDay, 6);
}

CASE("C1.3 — resolvedCsd null/undefined → raw (+ a brand-new-user progress-null sub-case)");
{
  check("resolvedCsd null -> raw 7",
    deriveListDayStatus({ progress: { currentStudyDay: 7 }, attempts: null, resolvedCsd: null, phaseOracle: unusedOracle }).currentStudyDay, 7);
  check("resolvedCsd undefined -> raw 2",
    deriveListDayStatus({ progress: { currentStudyDay: 2 }, attempts: null, resolvedCsd: undefined, phaseOracle: unusedOracle }).currentStudyDay, 2);
  const brandNew = deriveListDayStatus({ progress: null, attempts: null, resolvedCsd: null, phaseOracle: unusedOracle });
  check("progress null (brand-new user) + resolvedCsd null -> currentStudyDay 0", brandNew.currentStudyDay, 0);
  check("progress null (brand-new user) -> displayDay 1 (Day 1)", brandNew.displayDay, 1);
  const bothUndefined = deriveListDayStatus({ progress: undefined, attempts: null, resolvedCsd: undefined, phaseOracle: unusedOracle });
  check("progress AND resolvedCsd both undefined -> currentStudyDay 0", bothUndefined.currentStudyDay, 0);
}

CASE("C1.4 — attempts:null -> phase/doneToday null AND phaseOracle is NEVER CALLED (not just discarded)");
{
  let calls = 0;
  const countingOracle = (attempts, dayNumber) => { calls++; return { phase: 'new-words-study' }; };
  const r = deriveListDayStatus({ progress: { currentStudyDay: 1 }, attempts: null, resolvedCsd: null, phaseOracle: countingOracle });
  check("phase null", r.phase, null);
  check("doneToday null", r.doneToday, null);
  check("phaseOracle call count is 0 (never invoked)", calls, 0);
}

CASE("C1.4b — attempts:[] IS a real value — computes normally, phaseOracle IS invoked");
{
  let calls = 0;
  const countingOracle = () => { calls++; return { phase: 'new-words-study' }; };
  const r = deriveListDayStatus({ progress: { currentStudyDay: 1 }, attempts: [], resolvedCsd: null, phaseOracle: countingOracle });
  check("phase real value (not null)", r.phase, 'new-words-study');
  check("doneToday real value (not null)", r.doneToday, false);
  check("phaseOracle call count is 1 (invoked once)", calls, 1);
}

CASE("C1.5 — stub oracle passthrough: phase + doneToday derive from the oracle's return");
{
  const completeOracle = () => ({ phase: 'complete' });
  const reviewOracle = () => ({ phase: 'review-study' });
  const rComplete = deriveListDayStatus({ progress: { currentStudyDay: 0 }, attempts: [{ id: 'a1' }], resolvedCsd: null, phaseOracle: completeOracle });
  check("phase passthrough (complete)", rComplete.phase, 'complete');
  check("doneToday true when phase === 'complete'", rComplete.doneToday, true);
  const rReview = deriveListDayStatus({ progress: { currentStudyDay: 0 }, attempts: [{ id: 'a1' }], resolvedCsd: null, phaseOracle: reviewOracle });
  check("phase passthrough (review-study)", rReview.phase, 'review-study');
  check("doneToday false when phase !== 'complete'", rReview.doneToday, false);
}

CASE("C1.5b — the oracle is called with EXACTLY (attempts, displayDay)");
{
  let capturedArgs = null;
  const capturingOracle = (attempts, dayNumber) => { capturedArgs = [attempts, dayNumber]; return { phase: 'new-words-study' }; };
  const attempts = [{ id: 'x' }, { id: 'y' }];
  deriveListDayStatus({ progress: { currentStudyDay: 4 }, attempts, resolvedCsd: null, phaseOracle: capturingOracle });
  check("oracle's 1st arg is the exact attempts array (identity)", capturedArgs[0] === attempts, true);
  check("oracle's 2nd arg is displayDay (currentStudyDay + 1 = 5)", capturedArgs[1], 5);
}

CASE("C1.6 — attemptsForList: filters EXACTLY by classId+listId (not just one)");
{
  const attempts = [
    { id: 'a', classId: 'c1', listId: 'l1' },
    { id: 'b', classId: 'c1', listId: 'l2' }, // same class, different list
    { id: 'c', classId: 'c2', listId: 'l1' }, // different class, same list
    { id: 'd', classId: 'c1', listId: 'l1' }, // matches
  ];
  const got = attemptsForList(attempts, 'c1', 'l1').map((a) => a.id);
  check("exactly the 2 matching both classId AND listId", got, ['a', 'd']);
  check("attemptsForList(null, ...) -> []", attemptsForList(null, 'c1', 'l1'), []);
  check("attemptsForList(undefined, ...) -> []", attemptsForList(undefined, 'c1', 'l1'), []);
}

CASE("C1.6b — csdForRow: returns the csd on an exact match, null on ANY mismatch");
{
  const resolved = { classId: 'c1', listId: 'l1', csd: 9 };
  check("exact match -> csd", csdForRow(resolved, 'c1', 'l1'), 9);
  check("classId mismatch -> null", csdForRow(resolved, 'cX', 'l1'), null);
  check("listId mismatch -> null", csdForRow(resolved, 'c1', 'lX'), null);
  check("resolvedFocusCsd null -> null", csdForRow(null, 'c1', 'l1'), null);
  check("resolvedFocusCsd undefined -> null", csdForRow(undefined, 'c1', 'l1'), null);
}

CASE("C1.7 — TRY importing the REAL determineStartingPhase under plain node (integration fixture)");
let realOracleImport = { attempted: true, loaded: false, error: null, note: null };
{
  try {
    const mod = await import("../../src/services/studyService.js");
    realOracleImport.loaded = true;
    const { determineStartingPhase } = mod;
    // Integration case the brief asks for: complete-day attempts -> doneToday true.
    const completeAttempts = [
      { studyDay: 2, sessionType: 'new', passed: true, score: 100 },
      { studyDay: 2, sessionType: 'review', passed: true, score: 100 },
    ];
    const r = deriveListDayStatus({ progress: { currentStudyDay: 1 }, attempts: completeAttempts, resolvedCsd: null, phaseOracle: determineStartingPhase });
    check("REAL oracle: complete-day attempts -> doneToday true", r.doneToday, true);
  } catch (err) {
    realOracleImport.error = err.message;
    realOracleImport.note = "studyService.js imports ../firebase.js, which reads Vite's import.meta.env; "
      + "plain node cannot load it (same precedent streakAuthority.js's header documents). Deferring this "
      + "ONE integration fixture to the rehearsal per the df2-33 BRIEF's own escape hatch — NOT re-implementing "
      + "the oracle here (oracle drift). This is a DEFERRAL, not a failure, so it is NOT counted in total/failed.";
    console.log(`  DEFERRED (not counted as a failure): ${realOracleImport.error}`);
    console.log(`  ${realOracleImport.note}`);
  }
}

// ===========================================================================
// C2 — FLAG-OFF PARITY static anchors (+ a streak-untouched cross-check)
// ===========================================================================
const gitShow = (relPath) => execFileSync("git", ["show", `HEAD:${relPath}`], { cwd: "/app", encoding: "utf8" });
const dashSrc = readFileSync("/app/src/pages/Dashboard.jsx", "utf8");
const dashHead = gitShow("src/pages/Dashboard.jsx"); // HEAD = the streak fold's committed state (pre-df2-33)

CASE("C2 — hero's legacy sequence: load-bearing substrings present VERBATIM (flag-off leg)");
{
  checkTrue("resolvedMatchesFocus guard present verbatim",
    dashSrc.includes("const resolvedMatchesFocus = SERVER_PROGRESS_WRITE"));
  checkTrue("non-demoting Math.max present verbatim",
    dashSrc.includes("Math.max(resolvedFocusCsd.csd, progress?.currentStudyDay ?? 0) // non-demoting (CSD contract)"));
  checkTrue("legacy attempts filter present verbatim",
    dashSrc.includes("(a) => a.classId === getPrimaryFocus.classId && a.listId === getPrimaryFocus.id"));
  checkTrue("legacy phase call present verbatim",
    dashSrc.includes("determineStartingPhase(listAttempts, currentStudyDay + 1).phase"));
  // Cross-check: these 4 substrings ALSO exist verbatim in HEAD (proves they are the SAME
  // pre-existing text, not a coincidental new match).
  checkTrue("guard pre-existed at HEAD", dashHead.includes("const resolvedMatchesFocus = SERVER_PROGRESS_WRITE"));
  checkTrue("Math.max pre-existed at HEAD",
    dashHead.includes("Math.max(resolvedFocusCsd.csd, progress?.currentStudyDay ?? 0) // non-demoting (CSD contract)"));
  checkTrue("filter pre-existed at HEAD",
    dashHead.includes("(a) => a.classId === getPrimaryFocus.classId && a.listId === getPrimaryFocus.id"));
  checkTrue("phase call pre-existed at HEAD",
    dashHead.includes("determineStartingPhase(listAttempts, currentStudyDay + 1).phase"));
}

CASE("C2 — the hero ternary is add-only: REVIEW_V2_CLIENT ? deriveListDayStatus(...) : (legacy IIFE)");
{
  checkTrue("hero ternary head present",
    dashSrc.includes("const dayStatus = REVIEW_V2_CLIENT\n        ? deriveListDayStatus({"));
}

CASE("C2 — ListProgressStats' legacy expressions present VERBATIM (flag-off leg)");
{
  checkTrue("completedDays flag-off leg verbatim",
    dashSrc.includes("const completedDays = REVIEW_V2_CLIENT ? dayStatus.currentStudyDay : (progress?.currentStudyDay ?? 0)"));
  checkTrue("displayDay flag-off leg verbatim",
    dashSrc.includes("const displayDay = REVIEW_V2_CLIENT ? dayStatus.displayDay : (completedDays + 1)"));
  // Ahead/behind logic completely untouched (same 4 lines as HEAD).
  for (const line of [
    "const difference = completedDays - expectedDay",
    "const isAhead = difference > 0",
    "const isBehind = difference < 0",
    "const isOnTrack = difference === 0",
  ]) {
    checkTrue(`ahead/behind line untouched, current: ${line}`, dashSrc.includes(line));
    checkTrue(`ahead/behind line untouched, HEAD: ${line}`, dashHead.includes(line));
  }
}

CASE("C2 — STREAK code untouched (independent re-confirmation of the streak fold's own C2)");
{
  const extractFn = (text) => {
    const start = text.indexOf("const calculateStreak = (recentSessions, studyDaysPerWeek) => {");
    const end = text.indexOf("const extractListIdFromTestId = (testId = '') => {");
    checkTrue("calculateStreak start anchor found", start !== -1);
    checkTrue("extractListIdFromTestId end anchor found", end !== -1);
    return text.slice(start, end);
  };
  check("calculateStreak body byte-identical to HEAD", extractFn(dashSrc), extractFn(dashHead));
  checkTrue("streak ternary head untouched",
    dashSrc.includes("const streakDays = REVIEW_V2_CLIENT\n        ? serverStreak\n        : (progress.streakDays"));
  checkTrue("hero pill render site untouched", dashSrc.includes('🔥 {streakDays}-day streak'));
  checkTrue("stat tile render site untouched",
    dashSrc.includes('{streakDays} <span className="text-base text-text-muted font-semibold">days</span>'));
  const count0 = (s) => (s.match(/streakDays: 0,/g) || []).length;
  check("exactly 3 'streakDays: 0,' occurrences (current)", count0(dashSrc), 3);
  check("exactly 3 'streakDays: 0,' occurrences (HEAD)", count0(dashHead), 3);
  const destructureLine = "const { totalWordsIntroduced, masteryRate, streakDays, error: panelBError, loading: panelBLoading } = panelBState";
  checkTrue("panelBState destructure line untouched", dashSrc.includes(destructureLine));
  for (const relPath of ["src/services/progressService.js", "functions/foundation.js"]) {
    const cur = readFileSync(`/app/${relPath}`, "utf8");
    const head = gitShow(relPath);
    check(`${relPath} untouched (sha16)`, sha16Str(cur), sha16Str(head));
  }
}
function sha16Str(s) { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

// ===========================================================================
// C3 — GREP-PROOFS (brief-mandated; numbers recorded, not hand-typed elsewhere)
// ===========================================================================
const moduleSrc = readFileSync("/app/src/utils/dayStatusAuthority.js", "utf8");
const countOccurrences = (s, needle) => s.split(needle).length - 1;
// Prose (doc comments) legitimately NAMES things like "firebase" or the
// "currentStudyDay + 1" formula for documentation — the same false-positive
// class dashboard-streak-authority-fixtures.mjs's own C3 header warns about
// for a whole-file substring scan. These two module grep-proofs are about
// CODE, so block/line comments are stripped before counting (this file has
// no "//" inside any string literal, so a plain regex strip is safe here).
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const moduleCode = stripComments(moduleSrc);

CASE("C3 — REVIEW_V2_CLIENT occurrence count in Dashboard.jsx (current vs HEAD)");
let reviewV2ClientCounts = { current: null, head: null };
{
  reviewV2ClientCounts.current = countOccurrences(dashSrc, "REVIEW_V2_CLIENT");
  reviewV2ClientCounts.head = countOccurrences(dashHead, "REVIEW_V2_CLIENT");
  checkTrue("REVIEW_V2_CLIENT appears MORE often after this fold (new ternaries added)",
    reviewV2ClientCounts.current > reviewV2ClientCounts.head);
  console.log(`  REVIEW_V2_CLIENT: HEAD=${reviewV2ClientCounts.head} current=${reviewV2ClientCounts.current} (delta=${reviewV2ClientCounts.current - reviewV2ClientCounts.head})`);
}

CASE("C3 — 'currentStudyDay + 1' literal sites in Dashboard.jsx: UNCHANGED from HEAD (legacy-only)");
let currentStudyDayPlusOneCounts = { current: null, head: null, moduleCount: null };
{
  currentStudyDayPlusOneCounts.current = countOccurrences(dashSrc, "currentStudyDay + 1");
  currentStudyDayPlusOneCounts.head = countOccurrences(dashHead, "currentStudyDay + 1");
  check("Dashboard.jsx 'currentStudyDay + 1' count unchanged from HEAD (no NEW site added — only the "
    + "pre-existing comment + the legacy IIFE'd call)", currentStudyDayPlusOneCounts.current, currentStudyDayPlusOneCounts.head);
  currentStudyDayPlusOneCounts.moduleCount = countOccurrences(moduleCode, "currentStudyDay + 1");
  checkTrue("the module's CODE (comments stripped) has exactly ONE 'currentStudyDay + 1' (displayDay's own definition)",
    currentStudyDayPlusOneCounts.moduleCount === 1);
  console.log(`  'currentStudyDay + 1': Dashboard.jsx HEAD=${currentStudyDayPlusOneCounts.head} current=${currentStudyDayPlusOneCounts.current}; module=${currentStudyDayPlusOneCounts.moduleCount}`);
}

CASE("C3 — the module has ZERO firebase/firestore imports (decision 1: pure, read-only assembly)");
{
  // "imports" means CODE that pulls in a dependency — static import statements, dynamic
  // import(), or require(). The module's own doc comments legitimately NAME "firebase"/
  // "Firestore" in prose (explaining WHY phaseOracle is injected) — scanning the whole file
  // for those words would false-positive on exactly that prose, the same class of mistake
  // dashboard-streak-authority-fixtures.mjs's C3 header already warns against. So this checks
  // actual import/require CODE sites, not the raw text.
  const importLines = moduleSrc.split("\n").filter((l) => /^\s*import\s/.test(l));
  check("zero static import statements in the module", importLines.length, 0);
  checkTrue("zero dynamic import() calls in the module's code", !/\bimport\s*\(/.test(moduleCode));
  checkTrue("zero require() calls in the module's code", !/\brequire\s*\(/.test(moduleCode));
  checkTrue("no case-insensitive 'firebase' substring in the module's CODE (comments stripped)",
    !/firebase/i.test(moduleCode));
  checkTrue("no case-insensitive 'firestore' substring in the module's CODE (comments stripped)",
    !/firestore/i.test(moduleCode));
}

// ===========================================================================
const evidencePath = process.env.DASHBOARD_DF2_33_PURE_RECEIPT
  ? new URL(`file://${process.env.DASHBOARD_DF2_33_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/dashboard-df2-33-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "dashboard-df2-33-pure",
  pass: failed === 0,
  total, failed, reds,
  grepProofs: { reviewV2ClientCounts, currentStudyDayPlusOneCounts },
  realOracleImport,
  sourceShas: {
    "src/utils/dayStatusAuthority.js": sha16("../../src/utils/dayStatusAuthority.js"),
    "src/pages/Dashboard.jsx": sha16("../../src/pages/Dashboard.jsx"),
    "scripts/deepfix2/dashboard-df2-33-fixtures.mjs": sha16("./dashboard-df2-33-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ndashboard-df2-33 PURE: ${total} checks, ${failed} failures — evidence written`);
console.log(`realOracleImport: attempted=${realOracleImport.attempted} loaded=${realOracleImport.loaded}${realOracleImport.loaded ? "" : " (deferred to rehearsal, not counted as a failure)"}`);
process.exit(failed ? 1 : 0);
