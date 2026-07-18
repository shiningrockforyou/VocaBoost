// INVARIANT SUITE (roadmap A2) — the FULL 12-invariant register of domain invariants any
// consolidation MUST preserve, plus pure-function (F) checks.
// Three kinds of row: (S) static-signature (a load-bearing literal must be PRESENT — or, for
// forward-spec anchors, ABSENT — in the live source; robust, no eval, M-STATIC style),
// (C) count (a literal must appear EXACTLY n times — "sole writer" style), and
// (F) pure-function extract-and-eval (mirrors p9_assert.mjs: brace-match-extract the real
// function source from the module, eval it, assert behavior — tests the REAL code, no mirror).
// This is the safety net that gates the cutover flag flips (roadmap D2+).
// Run: node audit/deepfix/task3/invariant_assert.mjs   (exit 0 = all pass; PEND rows never fail)
//
// STATUS: full register. TRUE-invariants must hold before AND after the consolidation.
// Rows tagged [PR-x retargets] are current-state anchors the named PR intentionally revises;
// when that PR lands the row FLIPS — update it (do NOT delete the invariant — retarget it).
// PEND rows are forward-spec invariants not yet in the tree (they activate with PR-2/PR-3).

import { readFileSync } from 'node:fs';
const R = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

let pass = 0, fail = 0, pend = 0;
// S: assert `needle` is present (present=true) or absent (present=false) in file `p`.
function S(id, p, needle, why, present = true) {
  const found = R(p).includes(needle);
  const ok = found === present;
  if (ok) { pass++; console.log(`  PASS  ${id.padEnd(28)} ${why}`); }
  else { fail++; console.log(`  FAIL  ${id.padEnd(28)} ${why}\n        expected ${present ? 'PRESENT' : 'ABSENT'}: ${needle}\n        in ${p}`); }
}
// C: assert `needle` occurs EXACTLY `want` times in file `p` (sole-writer style checks).
function C(id, p, needle, want, why) {
  const n = R(p).split(needle).length - 1;
  if (n === want) { pass++; console.log(`  PASS  ${id.padEnd(28)} ${why}`); }
  else { fail++; console.log(`  FAIL  ${id.padEnd(28)} ${why}\n        expected ${want} occurrence(s) of: ${needle}\n        got ${n} in ${p}`); }
}
// PEND: forward-spec invariant not yet in the tree — logged, never fails the run.
function PEND(id, why) { pend++; console.log(`  PEND  ${id.padEnd(28)} ${why}`); }

console.log('INVARIANT REGISTER — structural (static-signature) checks\n');

// ── #1 · register #9 cross-pace protection — pairing is by POSITION range + lineage, not
// studyDay alone. [PR-1 retargets] exact-range today → the V2 tiered predicate (which KEEPS
// the class/range conjunct).
S('INV-9-pairing-range', 'src/services/db.js',
  'data.newWordEndIndex === pairing.anchorNewWordEndIndex',
  '#9: getReviewForDay pairs by exact range [PR-1 retargets to V2 — keep the class/range conjunct]');

// ── #2 · register #10 — the sanctioned NON-reconciling pre-completion read must survive
// (a naive "one reconciling reader" re-mints the self-race).
S('INV-10-nonrecon-read', 'src/pages/MCQTest.jsx',
  '? await getClassProgress(user.uid, classIdParam, listId)',
  '#10: MCQ pre-completion read is the pure non-reconciling getClassProgress under LIST_SCOPED_RECON');

// ── #3 · register #11 — review-only 3-reason gate: completion accepts a review-only day ONLY
// when a session-config reason CONFIRMS zero new words were assignable. EXACTLY three
// disjuncts (allocation.newWords<=0 / isListComplete / startPhase===REVIEW_STUDY) — matching
// the FULL assignment statement pins the reason set (a 4th reason or a dropped conjunct breaks it).
S('INV-11-reviewonly-3gate', 'src/services/studyService.js',
  `  const reviewOnlyReasonConfirmed =
    (Number.isFinite(allocationNewWords) && allocationNewWords <= 0) ||
    sessionCfg.isListComplete === true ||
    sessionCfg.startPhase === SESSION_PHASE.REVIEW_STUDY;`,
  '#11: reviewOnlyReasonConfirmed = exactly {allocation<=0, isListComplete, startPhase REVIEW_STUDY}');
S('INV-11-gate-guard', 'src/services/studyService.js',
  '!reviewOnlyDay && newWordAttemptPassed !== true && newWordScore < threshold',
  '#11: the explicit !reviewOnlyDay guard (not score coercion) lets the review-only day through');

// ── #4 · register #16 — two-facts (complete ≠ advances). RETARGETED (PR-3 LANDED 2026-07-17,
// FORCED_PATHWAY): hold-csd DECOUPLED "record review" from "advance day". updateClassProgress is now
// the ADVANCE writer (still welds csd+1 in one updates object — the first row still verifies that);
// recordReviewOutcome is the NEW HOLD writer that appends the review WITHOUT ever writing csd/twi.
// The pre-PR-3 ABSENT anchor below is FLIPPED to PRESENT (polarity flipped, invariant kept — never
// deleted). The TRUE post-PR-3 invariant: a THROTTLE review-only / SKIP day records WITHOUT advancing
// csd (kills the #16 runaway). Gated behind FORCED_PATHWAY; the hold writer is dormant until it flips.
S('INV-16-welded-today', 'src/services/progressService.js',
  `  const updates = {
    currentStudyDay: (current.currentStudyDay || 0) + 1,`,
  '#16 post-PR-3: updateClassProgress is the ADVANCE writer — still welds currentStudyDay+1 (the hold path is recordReviewOutcome, which never writes csd)');
S('INV-16-pr3-landed', 'src/services/progressService.js',
  'recordReviewOutcome',
  '#16 RETARGETED (PR-3 landed): recordReviewOutcome — the hold-csd writer recording a review WITHOUT advancing the day — is now PRESENT (was asserted ABSENT pre-PR-3)',
  true);

// ── #5 · non-demoting CSD + fail-closed query-error pin (a from-scratch projection loses the
// ratchet → mass demotion).
S('INV-nondemoting-csd', 'src/services/progressService.js',
  'Math.max(storedCSD, csd)',
  'csd is non-demoting: Math.max(storedCSD, csd) under LIST_SCOPED_RECON');
S('INV-lookupfail-pins', 'src/services/progressService.js',
  'reviewLookupFailed ? storedCSD',
  'an errored review lookup pins csd to storedCSD (moves nothing)');

// ── #6 · day-guard idempotency — only day===csd+1 completes (prevents duplicate double-advance).
S('INV-day-guard', 'src/services/progressService.js',
  'sessionSummary.day !== expectedDay',
  'day-guard: completion accepted only when day === currentStudyDay+1');

// ── #7 · cycling lap-reset — crossing a lap boundary DROPS the recentSessions carry and
// ZEROES stored intervention (P9 · CYC · U5 RESET), hard-gated on cycling.active.
S('INV-7-lap-boundary', 'src/services/progressService.js',
  `  const crossedLapBoundary = cycling.active === true && cycleLen > 0
    && Math.floor(twiBefore / cycleLen) < Math.floor(twiAfter / cycleLen);`,
  '#7: lap boundary = floor(twiBefore/cycleLen) < floor(twiAfter/cycleLen), gated on cycling.active');
S('INV-7-carry-drop', 'src/services/progressService.js',
  '(crossedLapBoundary ? [] : (current.recentSessions || []))',
  '#7: a crossed lap boundary drops the recentSessions carry (clean slate for intervention calc)');
S('INV-7-interv-zero', 'src/services/progressService.js',
  'interventionLevel: crossedLapBoundary ? 0 : newIntervention',
  '#7: a crossed lap boundary zeroes the stored interventionLevel (lap restarts at full pace)');

// ── #8 · anchor validity — a passed-new anchor must carry an integer newWordEndIndex
// (CS-2026-06-21 invalid-anchor class); twi is anchor-derived (nwei+1).
S('INV-anchor-valid', 'src/services/progressService.js',
  'Number.isInteger(anchorTest.newWordEndIndex)',
  'anchor validity: newWordEndIndex must be a non-negative integer');
S('INV-twi-anchor', 'src/services/progressService.js',
  'anchorTest.newWordEndIndex + 1',
  'twi is anchor-derived (newWordEndIndex + 1)');

// ── #9 · day-1 asymmetry — day 1 has no review leg: reconciliation anchors csd=1 off a passed
// day-1 new test, and determineStartingPhase treats day-1 passed-new as an impossible state
// (COMPLETE + monitored), never a REVIEW_STUDY resume.
S('INV-day1-csd-anchor', 'src/services/progressService.js',
  'if (anchorDay === 1) {',
  '#9-day1: reconciliation day-1 branch exists (anchorDay===1 → csd=1, no review lookup)');
S('INV-day1-csd-is-1', 'src/services/progressService.js',
  'csd = 1;',
  '#9-day1: day-1 anchor sets csd = 1 directly');
S('INV-day1-impossible', 'src/services/studyService.js',
  'if (dayNumber === 1 && newTest?.passed) {',
  '#9-day1: determineStartingPhase day-1 passed-new branch (COMPLETE, not review resume)');
S('INV-day1-monitored', 'src/services/studyService.js',
  "logSystemEvent('impossible_phase_detected'",
  '#9-day1: the day-1 passed-new impossible state is logged to system_logs for monitoring');

// ── #10 · recentSessions append-cadence — recentSessions is appended ONLY by the completion
// writers (RETARGETED PR-3 2026-07-17: now TWO — updateClassProgress ADVANCE + recordReviewOutcome
// HOLD-CSD — each capped .slice(-MAX_RECENT_SESSIONS)); reconciliation still appends ZERO. The count
// row below was retargeted 1→2 (PR-3's decoupled hold writer is a legitimate second appender, NOT an
// unsanctioned one); the specific-text row still pins the ADVANCE writer's append verbatim.
S('INV-recents-append-site', 'src/services/progressService.js',
  `  const recentSessions = [...(crossedLapBoundary ? [] : (current.recentSessions || [])), sessionSummary]
    .slice(-MAX_RECENT_SESSIONS);`,
  '#10-cadence: the ADVANCE completion writer is an appender (sessionSummary + slice cap)');
C('INV-recents-append-writers', 'src/services/progressService.js',
  '.slice(-MAX_RECENT_SESSIONS)', 2,
  '#10-cadence RETARGETED (PR-3 landed): exactly TWO capped append sites — updateClassProgress (advance) + recordReviewOutcome (hold-csd); reconciliation still appends ZERO');

// ── #11 · engagement grandfather — FORWARD-SPEC (PR-2/PR-3): activates with PR-2\'s
// isEngagedReview predicate + the grandfather timestamp constant (pre-cutover sessions are
// grandfathered as engaged). Not in tree yet — pending row + absence anchor that flips on PR-2.
PEND('INV-grandfather-pending',
  'engagement grandfather: activates with PR-2 isEngagedReview + grandfather timestamp constant');
S('INV-grandfather-not-landed', 'src/services/progressService.js',
  'isEngagedReview',
  'grandfather anchor: isEngagedReview not in tree yet [PR-2 retargets: assert the predicate + constant]',
  false);

// ── #12 · session_states is display-only EXCEPT the sanctioned challenge-accept write —
// routing keys on attempts (doctrine), and the ONE sanctioned session_states phase write is
// the challenge-accept day-2+ new-pass path (guarded by isCurrentBoundary).
S('INV-attempts-doctrine', 'src/pages/DailySessionFlow.jsx',
  'ATTEMPTS ARE THE SOLE AUTHORITY',
  '#12: routing doctrine present: attempts (config.startPhase), not session_state.phase');
S('INV-12-challenge-guard', 'src/services/db.js',
  "if (isCurrentBoundary && phase === 'new' && !isFirstDay)",
  '#12: the challenge-accept phase write is guarded (current-boundary, new-pass, day 2+)');
C('INV-12-challenge-write', 'src/services/db.js',
  "phase: 'review-study',", 1,
  '#12: exactly ONE sanctioned session_states phase write in db.js (challenge-accept exception)');

// ═══ (F) PURE-FUNCTION extract-and-eval checks — mirrors p9_assert.mjs ═══
// src/utils/studyAlgorithm.js can't be imported here without Vite; extract the REAL source of
// the pure functions (plus the in-file STUDY_ALGORITHM_CONSTANTS they reference) by
// brace-matching and eval it — tests the live code; if it drifts, extraction re-reads it.
console.log('\nPURE-FUNCTION (F) checks — extracted from src/utils/studyAlgorithm.js\n');

const ALGO = R('src/utils/studyAlgorithm.js');
function extract(sig) {
  const at = ALGO.indexOf(sig);
  if (at === -1) throw new Error(`could not find ${sig}`);
  const open = ALGO.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < ALGO.length; i++) {
    if (ALGO[i] === '{') depth++;
    else if (ALGO[i] === '}') { depth--; if (depth === 0) return ALGO.slice(at, i + 1).replace(/^export\s+/, ''); }
  }
  throw new Error(`unbalanced braces for ${sig}`);
}
const src = [
  extract('export const STUDY_ALGORITHM_CONSTANTS') + ';',
  extract('export function calculateInterventionLevel'),
  extract('export function calculateDailyAllocation'),
].join('\n');
// eslint-disable-next-line no-eval
const { calculateInterventionLevel, calculateDailyAllocation } =
  (0, eval)(`(() => { ${src}\n return { calculateInterventionLevel, calculateDailyAllocation }; })()`);

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function F(name, got, want) {
  if (eq(got, want)) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
}
const s = (...scores) => scores.map(reviewScore => ({ reviewScore }));

F('F-interv: empty history → 0', calculateInterventionLevel([]), 0.0);
F('F-interv: <3 valid scores → 0 (no intervention)', calculateInterventionLevel(s(0.1, 0.1)), 0.0);
F('F-interv: null scores don\'t count toward the 3', calculateInterventionLevel([...s(0.1, 0.1), { reviewScore: null }]), 0.0);
F('F-interv: avg <= 0.30 → 1 (full pause)', calculateInterventionLevel(s(0.2, 0.3, 0.2)), 1.0);
F('F-interv: avg == 0.30 boundary → 1', calculateInterventionLevel(s(0.3, 0.3, 0.3)), 1.0);
F('F-interv: avg >= 0.75 → 0 (full pace)', calculateInterventionLevel(s(0.8, 0.9, 0.8)), 0.0);
F('F-interv: avg == 0.75 boundary → 0', calculateInterventionLevel(s(0.75, 0.75, 0.75)), 0.0);
F('F-alloc: interv 0 → newWords = pace (round(50·1))', calculateDailyAllocation(50, 0),
  { newWords: 50, reviewCap: 50, maxDaily: 50 });
F('F-alloc: interv 1 → newWords 0 (round(50·0)), review 3x', calculateDailyAllocation(50, 1),
  { newWords: 0, reviewCap: 150, maxDaily: 150 });
F('F-alloc: interv 0.5 → newWords = round(pace·(1-interv)) = 25', calculateDailyAllocation(50, 0.5),
  { newWords: 25, reviewCap: 100, maxDaily: 100 });

console.log(`\nINVARIANT SUITE: pass=${pass} fail=${fail} pending=${pend}  ${fail === 0 ? '✓ CLEAN' : '✗ FAILURES'}`);
process.exit(fail === 0 ? 0 : 1);
