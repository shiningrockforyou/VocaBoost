#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-e — PURE fixtures for the within-day Review/New-words toggle
 * (no Firebase, no network, no Vite, no emulator, no browser, no build)
 * ============================================================================
 * Two kinds of case, because `src/pages/DailySessionFlow.jsx` itself cannot
 * be `import`ed by plain node (JSX-unparseable environment — see
 * `DailySessionFlow.phaseToggle.js`'s own header, and this fold's ledger V7):
 *
 *   C1-C5  REAL EXECUTION of the pure module `DailySessionFlow.phaseToggle.js`
 *          (this fold's own, solely-owned file) — availability predicates,
 *          the selection guard, the copy shape, and a grep-proof that the
 *          module itself carries zero imports.
 *   S1-S9  STRUCTURAL grep-proofs against the REAL on-disk
 *          `DailySessionFlow.jsx` (and, for S9, the REAL `functions/
 *          foundation.js`, read-only) — the render-gate anchor, a live
 *          `REVIEW_V2_CLIENT` import, and balanced-brace-extracted function
 *          bodies asserted to contain (or never contain) specific calls.
 *          This is a text-level proof, not an execution-level one — the
 *          strongest available given the environment constraint (see the
 *          fold report for the explicit limitation this implies, deferred to
 *          the batched WinClaude visual order, 51-h).
 *
 * Run: node scripts/deepfix2/df2-51e-toggle-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51e-toggle-pure.json
 * (DF2_51E_TOGGLE_PURE_RECEIPT env redirects the receipt for the mutant
 * driver, the established idiom — a mutant run must never clobber the
 * canonical pure evidence, e.g. df2-51a-model-mutants.mjs / df2-51c-browser-
 * mutants.mjs.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  canOfferReviewPhase, canOfferNewWordsPhase,
  shouldRunPhaseToggle,
  PHASE_TOGGLE_COPY,
} from "../../src/pages/DailySessionFlow.phaseToggle.js";
import { REVIEW_V2_CLIENT } from "../../src/config/featureFlags.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

const DSF_PATH = new URL("../../src/pages/DailySessionFlow.jsx", import.meta.url);
const PHASE_TOGGLE_PATH = new URL("../../src/pages/DailySessionFlow.phaseToggle.js", import.meta.url);
const FOUNDATION_PATH = new URL("../../functions/foundation.js", import.meta.url);

// ===========================================================================
// C1 — canOfferReviewPhase
// ===========================================================================
CASE("C1 — canOfferReviewPhase: true only when a segment exists");
{
  check("real segment object -> true", canOfferReviewPhase({ segment: { wordIds: ["w1"], startIndex: 0, endIndex: 0 } }), true);
  check("segment null (Day 1 / empty slice) -> false", canOfferReviewPhase({ segment: null }), false);
  check("segment undefined -> false", canOfferReviewPhase({ segment: undefined }), false);
  check("segment key missing entirely -> false", canOfferReviewPhase({}), false);
  check("sessionConfig null -> false", canOfferReviewPhase(null), false);
  check("sessionConfig undefined -> false", canOfferReviewPhase(undefined), false);
  check("segment falsy-but-not-null (0) -> false", canOfferReviewPhase({ segment: 0 }), false);
  check("segment empty object ({}) -> true (Boolean({}) is true; segment presence is the contract, matching moveToReviewPhase's own `!config?.segment` guard)", canOfferReviewPhase({ segment: {} }), true);
}

// ===========================================================================
// C2 — canOfferNewWordsPhase
// ===========================================================================
CASE("C2 — canOfferNewWordsPhase: true only when newWordCount > 0");
{
  check("positive count -> true", canOfferNewWordsPhase({ newWordCount: 5 }), true);
  check("count 1 -> true", canOfferNewWordsPhase({ newWordCount: 1 }), true);
  check("count 0 (review-only day) -> false", canOfferNewWordsPhase({ newWordCount: 0 }), false);
  check("negative count (legacy over-introduction edge, studyService.js comment) -> false", canOfferNewWordsPhase({ newWordCount: -3 }), false);
  check("newWordCount missing -> false", canOfferNewWordsPhase({}), false);
  check("sessionConfig null -> false", canOfferNewWordsPhase(null), false);
  check("sessionConfig undefined -> false", canOfferNewWordsPhase(undefined), false);
  check("newWordCount as numeric string '5' -> true (Number() coercion)", canOfferNewWordsPhase({ newWordCount: "5" }), true);
  check("newWordCount NaN -> false", canOfferNewWordsPhase({ newWordCount: NaN }), false);
}

// ===========================================================================
// C3 — shouldRunPhaseToggle
// ===========================================================================
CASE("C3 — shouldRunPhaseToggle: available AND a real phase change, else no-op");
{
  check("available, different phase -> true", shouldRunPhaseToggle({ targetPhase: "review", activePhase: "new", available: true }), true);
  check("available, different phase (reverse) -> true", shouldRunPhaseToggle({ targetPhase: "new", activePhase: "review", available: true }), true);
  check("unavailable, different phase -> false", shouldRunPhaseToggle({ targetPhase: "review", activePhase: "new", available: false }), false);
  check("unavailable, SAME phase -> false (unavailable wins regardless)", shouldRunPhaseToggle({ targetPhase: "new", activePhase: "new", available: false }), false);
  check("available, SAME phase (redundant tap) -> false (no-op, avoid discarding this-visit review-dismiss progress)", shouldRunPhaseToggle({ targetPhase: "review", activePhase: "review", available: true }), false);
  check("available, activePhase null (no study phase active yet) -> true", shouldRunPhaseToggle({ targetPhase: "review", activePhase: null, available: true }), true);
  check("defensive default input ({}) -> false (available undefined is falsy)", shouldRunPhaseToggle(), false);
}

// ===========================================================================
// C4 — PHASE_TOGGLE_COPY
// ===========================================================================
CASE("C4 — PHASE_TOGGLE_COPY: frozen, non-empty, distinct, carries the rule's substance");
{
  checkTrue("PHASE_TOGGLE_COPY is frozen", Object.isFrozen(PHASE_TOGGLE_COPY));
  checkTrue("rule is a non-empty string", typeof PHASE_TOGGLE_COPY.rule === "string" && PHASE_TOGGLE_COPY.rule.length > 0);
  checkTrue("reviewUnavailable is a non-empty string", typeof PHASE_TOGGLE_COPY.reviewUnavailable === "string" && PHASE_TOGGLE_COPY.reviewUnavailable.length > 0);
  checkTrue("newWordsUnavailable is a non-empty string", typeof PHASE_TOGGLE_COPY.newWordsUnavailable === "string" && PHASE_TOGGLE_COPY.newWordsUnavailable.length > 0);
  checkTrue("the two disabled-reason strings are distinct", PHASE_TOGGLE_COPY.reviewUnavailable !== PHASE_TOGGLE_COPY.newWordsUnavailable);
  checkTrue("rule carries the 'order, not the requirement' substance (brief's own wireframe quote)", /order/i.test(PHASE_TOGGLE_COPY.rule));
  checkTrue("rule carries the 'both halves must finish before tomorrow' substance", /tomorrow unlocks/i.test(PHASE_TOGGLE_COPY.rule));
}

// ===========================================================================
// C5 — GREP-PROOF: the pure module has zero imports (mirrors pastDayAuthority.js#C8)
// ===========================================================================
{
  const moduleSrc = readFileSync(PHASE_TOGGLE_PATH, "utf8");
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const moduleCode = stripComments(moduleSrc);

  CASE("C5 — DailySessionFlow.phaseToggle.js has ZERO imports of anything");
  {
    const importLines = moduleSrc.split("\n").filter((l) => /^\s*import\s/.test(l));
    check("zero static import statements in the module", importLines.length, 0);
    checkTrue("zero dynamic import() calls in the module's code", !/\bimport\s*\(/.test(moduleCode));
    checkTrue("zero require() calls in the module's code", !/\brequire\s*\(/.test(moduleCode));
    checkTrue("no case-insensitive 'firebase' substring in the module's CODE (comments stripped)", !/firebase/i.test(moduleCode));
    checkTrue("no case-insensitive 'firestore' substring in the module's CODE (comments stripped)", !/firestore/i.test(moduleCode));
    checkTrue("no case-insensitive 'react' substring in the module's CODE (comments stripped)", !/react/i.test(moduleCode));
  }
}

// ===========================================================================
// STRUCTURAL cases (S1-S9) — the REAL on-disk DailySessionFlow.jsx (and, for
// S9, functions/foundation.js), read-only, text-level assertions. This file
// cannot be `import`ed by plain node (JSX) — see the module header.
// ===========================================================================
const dsfSrc = readFileSync(DSF_PATH, "utf8");

/** Balanced-brace extraction: finds `startMarker` (which MUST end with the
 *  function's own opening `{` — every call site below is written that way),
 *  and returns the substring from THAT brace through its matching `}`
 *  (inclusive). Deliberately does NOT re-search for "the first `{` at or
 *  after the marker" — a marker like `function Name({ a, b }) {` (destructured
 *  params) contains braces of its OWN before the real body brace, which a
 *  naive re-search would latch onto instead (caught by S7 going red before
 *  this fix — recorded as a fixture-script self-bug, not a claim about the
 *  edited file). Returns null if the marker is absent or its own last
 *  character is not literally `{`. */
function extractBody(source, startMarker) {
  if (!startMarker.endsWith("{")) return null;
  const idx = source.indexOf(startMarker);
  if (idx === -1) return null;
  const braceStart = idx + startMarker.length - 1;
  if (source[braceStart] !== "{") return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  return null;
}

const BANNED_CALLS_RE = /completeSession\s*\(|recordSessionCompletion\s*\(|setDoc\s*\(|updateDoc\s*\(|addDoc\s*\(|deleteDoc\s*\(|httpsCallable\s*\(/;

CASE("S1 — the render-gate anchor exists exactly once and immediately precedes <PhaseToggle");
{
  const ANCHOR = "{REVIEW_V2_CLIENT && (phase === PHASES.NEW_WORDS || phase === PHASES.REVIEW_STUDY) && (\n          <PhaseToggle";
  const occurrences = dsfSrc.split(ANCHOR).length - 1;
  check("render-gate anchor occurs exactly once", occurrences, 1);
}

CASE("S2 — REVIEW_V2_CLIENT is false today (LIVE import, not a hand-read)");
{
  check("REVIEW_V2_CLIENT === false", REVIEW_V2_CLIENT, false);
}

CASE("S3 — moveToNewWordsPhase's REAL body calls no mutation/write function, and does call setPhase(PHASES.NEW_WORDS)");
{
  const body = extractBody(dsfSrc, "const moveToNewWordsPhase = () => {");
  checkTrue("moveToNewWordsPhase body was found", body !== null);
  if (body) {
    checkTrue("body contains none of the banned mutation/write calls", !BANNED_CALLS_RE.test(body));
    checkTrue("body calls setPhase(PHASES.NEW_WORDS)", /setPhase\(PHASES\.NEW_WORDS\)/.test(body));
    checkTrue("body guards on canOfferNewWordsPhase(sessionConfig) (single-sourced, not re-derived)", /canOfferNewWordsPhase\(sessionConfig\)/.test(body));
  }
}

CASE("S4 — the two click-guard handlers call only their one expected mover, no banned call");
{
  const reviewHandler = extractBody(dsfSrc, "const handleSelectReviewPhase = () => {");
  const newWordsHandler = extractBody(dsfSrc, "const handleSelectNewWordsPhase = () => {");
  checkTrue("handleSelectReviewPhase body was found", reviewHandler !== null);
  checkTrue("handleSelectNewWordsPhase body was found", newWordsHandler !== null);
  if (reviewHandler) {
    checkTrue("handleSelectReviewPhase contains no banned mutation/write call", !BANNED_CALLS_RE.test(reviewHandler));
    checkTrue("handleSelectReviewPhase calls moveToReviewPhase()", /moveToReviewPhase\(\)/.test(reviewHandler));
    checkTrue("handleSelectReviewPhase does NOT call moveToNewWordsPhase", !/moveToNewWordsPhase/.test(reviewHandler));
  }
  if (newWordsHandler) {
    checkTrue("handleSelectNewWordsPhase contains no banned mutation/write call", !BANNED_CALLS_RE.test(newWordsHandler));
    checkTrue("handleSelectNewWordsPhase calls moveToNewWordsPhase()", /moveToNewWordsPhase\(\)/.test(newWordsHandler));
    checkTrue("handleSelectNewWordsPhase does NOT call moveToReviewPhase", !/moveToReviewPhase\(\)/.test(newWordsHandler));
  }
}

CASE("S5 — moveToReviewPhase's REAL body is BYTE-IDENTICAL to its pre-edit (HEAD) text — proves reuse, zero modification");
{
  let headSrc = null;
  try {
    headSrc = execFileSync("git", ["show", "HEAD:src/pages/DailySessionFlow.jsx"], { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
  } catch (e) {
    console.error(`  could not read HEAD copy via git show: ${e.message}`);
  }
  checkTrue("HEAD copy of DailySessionFlow.jsx was readable via git show", headSrc !== null);
  if (headSrc !== null) {
    const headBody = extractBody(headSrc, "const moveToReviewPhase = async (configOverride = null) => {");
    const liveBody = extractBody(dsfSrc, "const moveToReviewPhase = async (configOverride = null) => {");
    checkTrue("moveToReviewPhase body found in HEAD", headBody !== null);
    checkTrue("moveToReviewPhase body found in the live (edited) file", liveBody !== null);
    check("moveToReviewPhase body is byte-identical, HEAD vs live", liveBody, headBody);
  }
}

CASE("S6 — both new import lines appear exactly once");
{
  check("`Button, TabButton` import occurs exactly once", (dsfSrc.match(/import \{ Button, TabButton \} from '\.\.\/components\/ui'/g) || []).length, 1);
  check("phaseToggle module import occurs exactly once", (dsfSrc.match(/from '\.\/DailySessionFlow\.phaseToggle'/g) || []).length, 1);
}

CASE("S7 — PHASE_TOGGLE_COPY's three fields are each referenced inside PhaseToggle's JSX (wired into render, not dead code)");
{
  const phaseToggleComponent = extractBody(dsfSrc, "function PhaseToggle({ activePhase, canGoToReview, canGoToNewWords, onSelectReview, onSelectNewWords }) {");
  checkTrue("PhaseToggle component body was found", phaseToggleComponent !== null);
  if (phaseToggleComponent) {
    checkTrue("references PHASE_TOGGLE_COPY.rule", /PHASE_TOGGLE_COPY\.rule/.test(phaseToggleComponent));
    checkTrue("references PHASE_TOGGLE_COPY.reviewUnavailable", /PHASE_TOGGLE_COPY\.reviewUnavailable/.test(phaseToggleComponent));
    checkTrue("references PHASE_TOGGLE_COPY.newWordsUnavailable", /PHASE_TOGGLE_COPY\.newWordsUnavailable/.test(phaseToggleComponent));
    checkTrue("uses TabButton (the reused existing primitive, not a new control)", /<TabButton/.test(phaseToggleComponent));
  }
}

CASE("S8 — the toggle's disabled/title wiring and the click-guard's `available` input read the SAME booleans (single source)");
{
  checkTrue("canGoToReviewPhase is computed exactly once (const canGoToReviewPhase = canOfferReviewPhase(sessionConfig))", (dsfSrc.match(/const canGoToReviewPhase = canOfferReviewPhase\(sessionConfig\)/g) || []).length === 1);
  checkTrue("canGoToNewWordsPhase is computed exactly once (const canGoToNewWordsPhase = canOfferNewWordsPhase(sessionConfig))", (dsfSrc.match(/const canGoToNewWordsPhase = canOfferNewWordsPhase\(sessionConfig\)/g) || []).length === 1);
  const reviewHandler = extractBody(dsfSrc, "const handleSelectReviewPhase = () => {");
  const newWordsHandler = extractBody(dsfSrc, "const handleSelectNewWordsPhase = () => {");
  checkTrue("handleSelectReviewPhase's guard reads canGoToReviewPhase (not a re-derived value)", !!reviewHandler && /available: canGoToReviewPhase/.test(reviewHandler));
  checkTrue("handleSelectNewWordsPhase's guard reads canGoToNewWordsPhase (not a re-derived value)", !!newWordsHandler && /available: canGoToNewWordsPhase/.test(newWordsHandler));
  const renderCall = extractBody(dsfSrc, "<PhaseToggle\n            activePhase={activeTogglePhase}");
  // PhaseToggle is a self-closing JSX element (no `{}` body) — extractBody won't find a brace
  // pair for it; use a direct substring window instead.
  const renderIdx = dsfSrc.indexOf("<PhaseToggle\n            activePhase={activeTogglePhase}");
  const renderWindow = renderIdx === -1 ? "" : dsfSrc.slice(renderIdx, renderIdx + 400);
  checkTrue("the render call passes canGoToReviewPhase as canGoToReview", /canGoToReview=\{canGoToReviewPhase\}/.test(renderWindow));
  checkTrue("the render call passes canGoToNewWordsPhase as canGoToNewWords", /canGoToNewWords=\{canGoToNewWordsPhase\}/.test(renderWindow));
}

CASE("S9 — functions/foundation.js still carries the F-4 day-advance evidence-gate anchor cited in the ledger (V6), read-only, no import/execution");
{
  const foundationSrc = readFileSync(FOUNDATION_PATH, "utf8");
  checkTrue("completeSession onCall handler still present", /const completeSession = onCall\(/.test(foundationSrc));
  checkTrue("the F-4 evidence requirement (hasNewAnchor) is still present", /hasNewAnchor = !!dayNewPass && Number\.isInteger\(dayNewPass\.newWordEndIndex\)/.test(foundationSrc));
  checkTrue("the no_evidence refusal is still present", /if \(!hasNewAnchor && !reviewOnlyDay\)/.test(foundationSrc) && /status: "no_evidence"/.test(foundationSrc));
}

// ===========================================================================
const evidencePath = process.env.DF2_51E_TOGGLE_PURE_RECEIPT
  ? new URL(`file://${process.env.DF2_51E_TOGGLE_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/df2-51e-toggle-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "df2-51e-toggle-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/pages/DailySessionFlow.phaseToggle.js": sha16(PHASE_TOGGLE_PATH),
    "src/pages/DailySessionFlow.jsx": sha16(DSF_PATH),
    "scripts/deepfix2/df2-51e-toggle-fixtures.mjs": sha16(new URL(import.meta.url)),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ndf2-51e-toggle PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
