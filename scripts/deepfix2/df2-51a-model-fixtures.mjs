#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-a — PURE fixtures for `src/utils/pastDayAuthority.js`
 * (no Firebase, no network, no Vite, no emulator)
 * ============================================================================
 * Exercises the REAL module directly under plain node, plus a static
 * GREP-PROOF (brief-mandated) that the module carries zero firebase/
 * firestore/react imports — comments stripped FIRST, learning from
 * `dashboard-df2-33-fixtures.mjs`'s own header note that a whole-file
 * substring scan false-positives on the module's own prose (this file's
 * header legitimately NAMES "firebase"/"Firestore"/"react" while explaining
 * why the module has none).
 *
 *   C1  attempts-side: `isLiveAttempt` / `originalAttemptsForDay` /
 *       `bestOriginalPass` (the `type:"retest"` exclusion, earliest-wins tie
 *       -break, F3's `hasNewHalf` predicate).
 *   C2  visits-side: `visitsForDay` / `summarizeDayVisits` (PIP-CANON — the
 *       cross-visit-must-not-pair invariant, finding F4).
 *   C3  `bookmarkedDayForList` (H6 scalar extraction, edge cases).
 *   C4  `deriveDayState` (the five-way precedence) + `derivePips` (the F3
 *       dashed pip) in isolation.
 *   C5  `deriveDayRow` / `derivePastDays` / `deriveTodayRow` — the full
 *       composition: both-halves, no-new-half, bookmark precedence,
 *       untouched, re-completed, cross-visit non-pairing, today-exclusion,
 *       Day-1 asymmetry, retest-vs-original, empty/missing inputs.
 *   C6  `canRetestTyped` (presentation-only cap predicate).
 *   C7  enum shape (`DAY_STATES`/`PIP_STATES` frozen, exact literals).
 *   C8  GREP-PROOF: zero import/require statements, no case-insensitive
 *       firebase/firestore/react substring in the module's CODE (comments
 *       stripped).
 *
 * Run: node scripts/deepfix2/df2-51a-model-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51a-model-pure.json
 * (DF2_51A_MODEL_PURE_RECEIPT env redirects the receipt for the mutant
 * driver, same audit-fixed idiom as dashboard-df2-33-fixtures.mjs /
 * dashboard-streak-authority-fixtures.mjs — a mutant run must never clobber
 * the canonical pure evidence.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  DAY_STATES, PIP_STATES,
  isLiveAttempt, originalAttemptsForDay, bestOriginalPass,
  visitsForDay, summarizeDayVisits,
  bookmarkedDayForList,
  deriveDayState, derivePips,
  deriveDayRow, derivePastDays, deriveTodayRow,
  canRetestTyped,
} from "../../src/utils/pastDayAuthority.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

// ===========================================================================
// C1 — attempts-side
// ===========================================================================
CASE("C1.1 — isLiveAttempt: absence of `type` reads as LIVE");
{
  checkTrue("no type field -> live", isLiveAttempt({ studyDay: 1, sessionType: 'new' }));
  checkTrue("type undefined -> live", isLiveAttempt({ type: undefined }));
  checkTrue("type null -> live", isLiveAttempt({ type: null }));
  check("type 'retest' -> NOT live", isLiveAttempt({ type: 'retest' }), false);
  check("null attempt -> not live (defensive)", isLiveAttempt(null), false);
  check("undefined attempt -> not live (defensive)", isLiveAttempt(undefined), false);
}

CASE("C1.2 — originalAttemptsForDay: studyDay match + live-only filter");
{
  const attempts = [
    { studyDay: 3, sessionType: 'new', passed: true, id: 'a' },
    { studyDay: 3, sessionType: 'review', passed: true, id: 'b' },
    { studyDay: 4, sessionType: 'new', passed: true, id: 'wrong-day' },
    { studyDay: 3, sessionType: 'review', passed: true, type: 'retest', id: 'rerun-not-original' },
  ];
  const got = originalAttemptsForDay(attempts, 3).map((a) => a.id);
  check("exactly the 2 live day-3 attempts (retest excluded, other day excluded)", got, ['a', 'b']);
  check("null attempts -> []", originalAttemptsForDay(null, 3), []);
  check("undefined attempts -> []", originalAttemptsForDay(undefined, 3), []);
}

CASE("C1.3 — bestOriginalPass: passed-only, EARLIEST wins on a tie");
{
  const dayAttempts = [
    { sessionType: 'new', passed: false, submittedAt: 500, id: 'failed' },
    { sessionType: 'new', passed: true, submittedAt: 2000, id: 'later-pass' },
    { sessionType: 'new', passed: true, submittedAt: 1000, id: 'earlier-pass' },
  ];
  const best = bestOriginalPass(dayAttempts, 'new');
  check("earliest PASSED attempt wins over a later pass and a failed one", best.id, 'earlier-pass');
  check("no passed attempt of this type -> null (F3 signal for 'new')",
    bestOriginalPass([{ sessionType: 'new', passed: false }], 'new'), null);
  check("empty dayAttempts -> null", bestOriginalPass([], 'review'), null);
  check("wrong sessionType never matches", bestOriginalPass([{ sessionType: 'review', passed: true, submittedAt: 1 }], 'new'), null);
}

CASE("C1.4 — bestOriginalPass tolerates mixed submittedAt shapes (number/ISO string/Date/Timestamp-like)");
{
  const fakeTimestamp = { toMillis: () => 3000 };
  const dayAttempts = [
    { sessionType: 'review', passed: true, submittedAt: '2026-01-05T00:00:00.000Z', id: 'iso' }, // ~1767571200000
    { sessionType: 'review', passed: true, submittedAt: new Date(500), id: 'date' },
    { sessionType: 'review', passed: true, submittedAt: fakeTimestamp, id: 'timestamp-like' },
  ];
  check("Date(500) is earliest among the three mixed shapes", bestOriginalPass(dayAttempts, 'review').id, 'date');
}

// ===========================================================================
// C2 — visits-side (PIP-CANON, finding F4)
// ===========================================================================
CASE("C2.1 — visitsForDay: filters by day only");
{
  const visits = [{ day: 1 }, { day: 2 }, { day: 1, extra: true }];
  check("2 visits match day 1", visitsForDay(visits, 1).length, 2);
  check("null visits -> []", visitsForDay(null, 1), []);
}

CASE("C2.2 — summarizeDayVisits: no visits -> all false");
{
  check("empty array", summarizeDayVisits([]),
    { hasAnyVisit: false, hasCompletedVisit: false, reviewRecorded: false, newRecorded: false });
  check("null -> same as empty (defensive)", summarizeDayVisits(null),
    { hasAnyVisit: false, hasCompletedVisit: false, reviewRecorded: false, newRecorded: false });
}

CASE("C2.3 — summarizeDayVisits: ONE completed visit -> both recorded, reads ITS OWN fields");
{
  const dayVisits = [{ completed: true, reviewHalfAttemptId: 'r1', newHalfAttemptId: 'n1' }];
  check("completed visit -> hasCompletedVisit true, both recorded",
    summarizeDayVisits(dayVisits),
    { hasAnyVisit: true, hasCompletedVisit: true, reviewRecorded: true, newRecorded: true });
}

CASE("C2.4 — summarizeDayVisits: F4 CROSS-VISIT — halves in DIFFERENT visits must NOT pair");
{
  // Visit A (older): review half recorded, NOT completed.
  // Visit B (newer, created AFTER A): new half recorded, NOT completed.
  // Neither visit ever got BOTH fields -> the engine's own CAS (visits.js
  // :112-117) never flips `completed` for either doc. PIP-CANON must show
  // ONLY the canonical (most recent) visit's evidence, never an OR-aggregate
  // that would make this look identical to a real pairing.
  const dayVisits = [
    { completed: false, reviewHalfAttemptId: 'rev-att', newHalfAttemptId: null, createdAt: 1000 },
    { completed: false, reviewHalfAttemptId: null, newHalfAttemptId: 'new-att', createdAt: 2000 },
  ];
  const ev = summarizeDayVisits(dayVisits);
  check("hasCompletedVisit is false (no single visit has both halves)", ev.hasCompletedVisit, false);
  check("canonical (most recent) visit's evidence only: review NOT recorded", ev.reviewRecorded, false);
  check("canonical (most recent) visit's evidence only: new IS recorded", ev.newRecorded, true);
  checkTrue("NOT both recorded simultaneously (the false-pairing signal this case exists to forbid)",
    !(ev.reviewRecorded && ev.newRecorded));
}

CASE("C2.5 — summarizeDayVisits: a genuine completed visit wins over a NEWER empty practice visit");
{
  const dayVisits = [
    { completed: true, reviewHalfAttemptId: 'r1', newHalfAttemptId: 'n1', createdAt: 1000 },
    { completed: false, reviewHalfAttemptId: null, newHalfAttemptId: null, createdAt: 5000 }, // newer, fresh, in-progress
  ];
  check("completed visit found regardless of recency of a newer partial visit",
    summarizeDayVisits(dayVisits),
    { hasAnyVisit: true, hasCompletedVisit: true, reviewRecorded: true, newRecorded: true });
}

CASE("C2.6 — summarizeDayVisits: no completed visit, ONE partial visit -> its own evidence, single pip lit");
{
  const dayVisits = [{ completed: false, reviewHalfAttemptId: 'r1', newHalfAttemptId: null, createdAt: 1000 }];
  check("single partial visit -> review recorded, new not",
    summarizeDayVisits(dayVisits),
    { hasAnyVisit: true, hasCompletedVisit: false, reviewRecorded: true, newRecorded: false });
}

CASE("C2.7 — summarizeDayVisits: tie-break on equal/missing createdAt keeps the EARLIEST-listed");
{
  const dayVisits = [
    { completed: false, reviewHalfAttemptId: 'r1', newHalfAttemptId: null }, // createdAt missing
    { completed: false, reviewHalfAttemptId: null, newHalfAttemptId: 'n1' }, // createdAt missing
  ];
  check("both missing createdAt -> first-listed wins (deterministic)",
    summarizeDayVisits(dayVisits),
    { hasAnyVisit: true, hasCompletedVisit: false, reviewRecorded: true, newRecorded: false });
}

// ===========================================================================
// C3 — bookmarkedDayForList (H6 scalar)
// ===========================================================================
CASE("C3 — bookmarkedDayForList: exact match + every degrade-safely edge");
{
  const map = { c1_l1: 5, c1_l2: 9 };
  check("exact classId+listId match -> the day", bookmarkedDayForList(map, 'c1', 'l1'), 5);
  check("different list, same class -> different day", bookmarkedDayForList(map, 'c1', 'l2'), 9);
  check("no entry for this class/list -> null", bookmarkedDayForList(map, 'c9', 'l9'), null);
  check("restudyBookmarks null -> null", bookmarkedDayForList(null, 'c1', 'l1'), null);
  check("restudyBookmarks undefined -> null", bookmarkedDayForList(undefined, 'c1', 'l1'), null);
  check("restudyBookmarks non-object (string) -> null", bookmarkedDayForList('nope', 'c1', 'l1'), null);
  check("classId empty string -> null", bookmarkedDayForList(map, '', 'l1'), null);
  check("listId missing (undefined) -> null", bookmarkedDayForList(map, 'c1', undefined), null);
  check("stored value 0 -> null (not a valid day)", bookmarkedDayForList({ c1_l1: 0 }, 'c1', 'l1'), null);
  check("stored value negative -> null", bookmarkedDayForList({ c1_l1: -3 }, 'c1', 'l1'), null);
  check("stored value non-integer -> null", bookmarkedDayForList({ c1_l1: 2.5 }, 'c1', 'l1'), null);
  check("stored value non-number -> null", bookmarkedDayForList({ c1_l1: 'five' }, 'c1', 'l1'), null);
}

// ===========================================================================
// C4 — deriveDayState + derivePips in isolation
// ===========================================================================
CASE("C4.1 — deriveDayState: the five-way ladder, bookmark precedence FIRST");
{
  check("untouched", deriveDayState({ hasAnyVisit: false, hasCompletedVisit: false, reviewRecorded: false, newRecorded: false, bookmarked: false }), DAY_STATES.UNTOUCHED);
  check("studied (a visit exists, nothing recorded)", deriveDayState({ hasAnyVisit: true, hasCompletedVisit: false, reviewRecorded: false, newRecorded: false, bookmarked: false }), DAY_STATES.STUDIED);
  check("tested (review recorded only)", deriveDayState({ hasAnyVisit: true, hasCompletedVisit: false, reviewRecorded: true, newRecorded: false, bookmarked: false }), DAY_STATES.TESTED);
  check("tested (new recorded only)", deriveDayState({ hasAnyVisit: true, hasCompletedVisit: false, reviewRecorded: false, newRecorded: true, bookmarked: false }), DAY_STATES.TESTED);
  check("re-completed", deriveDayState({ hasAnyVisit: true, hasCompletedVisit: true, reviewRecorded: true, newRecorded: true, bookmarked: false }), DAY_STATES.RE_COMPLETED);
  check("bookmark displaces RE-COMPLETED", deriveDayState({ hasAnyVisit: true, hasCompletedVisit: true, reviewRecorded: true, newRecorded: true, bookmarked: true }), DAY_STATES.BOOKMARKED);
  check("bookmark displaces UNTOUCHED too", deriveDayState({ hasAnyVisit: false, hasCompletedVisit: false, reviewRecorded: false, newRecorded: false, bookmarked: true }), DAY_STATES.BOOKMARKED);
  check("missing args (defensive) -> untouched", deriveDayState(), DAY_STATES.UNTOUCHED);
}

CASE("C4.2 — derivePips: review is NEVER 'na'; new's 3-state ladder + evidence-outranks-hasNewHalf");
{
  check("both on", derivePips({ hasNewHalf: true, reviewRecorded: true, newRecorded: true }), { review: PIP_STATES.ON, new: PIP_STATES.ON });
  check("review off, new off (has new half, not yet retested)", derivePips({ hasNewHalf: true, reviewRecorded: false, newRecorded: false }), { review: PIP_STATES.OFF, new: PIP_STATES.OFF });
  check("F3 dashed: no new half at all, nothing recorded", derivePips({ hasNewHalf: false, reviewRecorded: false, newRecorded: false }), { review: PIP_STATES.OFF, new: PIP_STATES.NOT_APPLICABLE });
  check("review can be OFF even when new half exists and is unrecorded (never na)", derivePips({ hasNewHalf: true, reviewRecorded: false, newRecorded: true }).review, PIP_STATES.OFF);
  check("recorded evidence outranks hasNewHalf:false (defensive, engine-impossible input)", derivePips({ hasNewHalf: false, reviewRecorded: false, newRecorded: true }).new, PIP_STATES.ON);
  check("missing args (defensive) -> review off, new na", derivePips(), { review: PIP_STATES.OFF, new: PIP_STATES.NOT_APPLICABLE });
}

// ===========================================================================
// C5 — the full composition: deriveDayRow / derivePastDays / deriveTodayRow
// ===========================================================================
CASE("C5.1 — both halves, ONE visit -> re-completed + full pips (brief case 1)");
{
  const attempts = [
    { studyDay: 2, sessionType: 'new', passed: true, submittedAt: 1000 },
    { studyDay: 2, sessionType: 'review', passed: true, submittedAt: 1500 },
  ];
  const visits = [{ day: 2, completed: true, reviewHalfAttemptId: 'r', newHalfAttemptId: 'n', createdAt: 9000 }];
  const row = deriveDayRow({ day: 2, attempts, visits, bookmarkedDay: null });
  check("state re-completed", row.state, DAY_STATES.RE_COMPLETED);
  check("pips both on", row.pips, { review: PIP_STATES.ON, new: PIP_STATES.ON });
  check("studiedAt from the original new attempt", row.studiedAt, 1000);
  check("testedAt from the original review attempt", row.testedAt, 1500);
  check("canRestudy true (has new half)", row.canRestudy, true);
  check("canRetest true", row.canRetest, true);
  check("bookmarked false", row.bookmarked, false);
}

CASE("C5.2 — no new half (F3) -> dashed pip, state reaches 'tested' not stuck 'incomplete' (brief case 2)");
{
  // Day has NO passed 'new' attempt at all (a zero-new-word/list-end day) —
  // only a review attempt (LIST-END LAW: day advances on the review test alone).
  const attempts = [{ studyDay: 5, sessionType: 'review', passed: true, submittedAt: 2000 }];
  const visits = [{ day: 5, completed: false, reviewHalfAttemptId: 'r-rerun', newHalfAttemptId: null, createdAt: 1 }];
  const row = deriveDayRow({ day: 5, attempts, visits, bookmarkedDay: null });
  check("pips.new is 'na', never empty/off-as-failed", row.pips.new, PIP_STATES.NOT_APPLICABLE);
  check("pips.review IS on (the review half was re-tested)", row.pips.review, PIP_STATES.ON);
  check("state reaches TESTED (not stuck as some perpetual-incomplete state)", row.state, DAY_STATES.TESTED);
  check("canRestudy false (nothing day-specific to re-study)", row.canRestudy, false);
  check("canRetest STAYS true even though canRestudy is false (F2 — review always offerable)", row.canRetest, true);
  check("hasNewHalf false", row.hasNewHalf, false);
}

CASE("C5.3 — bookmarked day -> chip flips to bookmarked, pips stay the UNDERLYING progress (brief case 3)");
{
  const attempts = [
    { studyDay: 5, sessionType: 'new', passed: true, submittedAt: 1000 },
    { studyDay: 5, sessionType: 'review', passed: true, submittedAt: 1500 },
  ];
  const visits = [{ day: 5, completed: false, reviewHalfAttemptId: 'r', newHalfAttemptId: null, createdAt: 1 }];
  const unbookmarked = deriveDayRow({ day: 5, attempts, visits, bookmarkedDay: null });
  const bookmarked = deriveDayRow({ day: 5, attempts, visits, bookmarkedDay: 5 });
  check("without bookmark: state is the underlying tier (tested)", unbookmarked.state, DAY_STATES.TESTED);
  check("with bookmark: state flips to bookmarked", bookmarked.state, DAY_STATES.BOOKMARKED);
  check("pips are IDENTICAL bookmarked vs not (bookmark never touches pips)", bookmarked.pips, unbookmarked.pips);
  check("bookmarked flag itself is true", bookmarked.bookmarked, true);
}

CASE("C5.4 — an untouched day: original attempts exist (it's a real past day), zero visits (brief case 4)");
{
  const attempts = [
    { studyDay: 1, sessionType: 'new', passed: true, submittedAt: 1000 },
  ];
  const row = deriveDayRow({ day: 1, attempts, visits: [], bookmarkedDay: null });
  check("state untouched (no restudy activity at all)", row.state, DAY_STATES.UNTOUCHED);
  check("pips both reflect zero restudy activity (new is 'off', not 'na' — a new half DOES exist, just unrecorded)",
    row.pips, { review: PIP_STATES.OFF, new: PIP_STATES.OFF });
  check("studiedAt still populated from the ORIGINAL completion", row.studiedAt, 1000);
}

CASE("C5.5 — DAY-1 ASYMMETRY: no review phase originally -> testedAt null, state/pips unaffected");
{
  // DailySessionFlow.jsx:10 — "Day 1 has no review phase". Day 1 advances
  // purely off the new-word test; there is no original review attempt.
  const attempts = [{ studyDay: 1, sessionType: 'new', passed: true, submittedAt: 777 }];
  const row = deriveDayRow({ day: 1, attempts, visits: [], bookmarkedDay: null });
  check("testedAt is null (no original review attempt for Day 1)", row.testedAt, null);
  check("studiedAt still populated", row.studiedAt, 777);
  check("state derivation is unaffected by the missing original review (still untouched, no visits)", row.state, DAY_STATES.UNTOUCHED);
}

CASE("C5.6 — a LATER passing RERUN must not masquerade as the day's original completion");
{
  const attempts = [
    { studyDay: 4, sessionType: 'review', passed: true, submittedAt: 1000 }, // ORIGINAL
    { studyDay: 4, sessionType: 'review', passed: true, submittedAt: 9999, type: 'retest', visitId: 'v1' }, // A LATER RERUN
  ];
  const row = deriveDayRow({ day: 4, attempts, visits: [], bookmarkedDay: null });
  check("testedAt stays anchored to the ORIGINAL attempt's date, not the rerun's later date", row.testedAt, 1000);
}

CASE("C5.7 — derivePastDays: rows 1..currentStudyDay, no phantom currentStudyDay+1 row (brief: today excluded)");
{
  const rows = derivePastDays({ currentStudyDay: 3, attempts: [], visits: [], bookmarks: null });
  check("exactly 3 rows", rows.length, 3);
  check("days are 1,2,3 in order", rows.map((r) => r.day), [1, 2, 3]);
  checkTrue("no row for day 4 (currentStudyDay+1)", !rows.some((r) => r.day === 4));
}

CASE("C5.8 — deriveTodayRow: the explicit non-actionable row, day = csd+1");
{
  const today = deriveTodayRow({ currentStudyDay: 3 });
  check("day is csd+1", today.day, 4);
  check("today flag true", today.today, true);
  check("canRestudy false (non-actionable)", today.canRestudy, false);
  check("canRetest false (non-actionable)", today.canRetest, false);
  check("state null (no progress-chip meaning)", today.state, null);
  check("pips null (restudy-only concept)", today.pips, null);
}

CASE("C5.9 — empty/missing inputs degrade safely everywhere (brief: never throw)");
{
  check("derivePastDays() with no args at all -> []", derivePastDays(), []);
  check("derivePastDays({}) -> []", derivePastDays({}), []);
  check("derivePastDays({currentStudyDay: 0}) -> []", derivePastDays({ currentStudyDay: 0 }), []);
  check("derivePastDays({currentStudyDay: -5}) -> [] (never negative-length)", derivePastDays({ currentStudyDay: -5 }), []);
  check("derivePastDays({currentStudyDay: 'three'}) -> [] (non-integer degrades to 0)", derivePastDays({ currentStudyDay: 'three' }), []);
  const degraded = derivePastDays({ currentStudyDay: 2, attempts: null, visits: undefined, bookmarks: undefined });
  check("null/undefined attempts+visits+bookmarks still produce 2 clean untouched rows", degraded.map((r) => r.state), [DAY_STATES.UNTOUCHED, DAY_STATES.UNTOUCHED]);
  check("deriveTodayRow() with no args -> day 1", deriveTodayRow().day, 1);
  check("deriveDayRow() with no args does not throw", typeof deriveDayRow(), 'object');
  check("canRetestTyped() with no args -> true (nothing known yet)", canRetestTyped(), true);
}

CASE("C5.10 — bookmark BEYOND currentStudyDay is ignored (belt-and-braces, V5/22_:326)");
{
  const rows = derivePastDays({ currentStudyDay: 3, attempts: [], visits: [], bookmarks: 99 });
  checkTrue("no row is bookmarked (day 99 never in range 1..3)", !rows.some((r) => r.bookmarked));
  checkTrue("no row's state is 'bookmarked'", !rows.some((r) => r.state === DAY_STATES.BOOKMARKED));
}

CASE("C5.11 — F4 end-to-end through derivePastDays: cross-visit halves never render as re-completed/paired pips");
{
  const attempts = [{ studyDay: 6, sessionType: 'new', passed: true, submittedAt: 100 }];
  const visits = [
    { day: 6, completed: false, reviewHalfAttemptId: 'r', newHalfAttemptId: null, createdAt: 1 },
    { day: 6, completed: false, reviewHalfAttemptId: null, newHalfAttemptId: 'n', createdAt: 2 },
  ];
  const row = deriveDayRow({ day: 6, attempts, visits, bookmarkedDay: null });
  check("state is tested, NOT re-completed", row.state, DAY_STATES.TESTED);
  checkTrue("pips are not both 'on' (no false pairing)", !(row.pips.review === PIP_STATES.ON && row.pips.new === PIP_STATES.ON));
}

// ===========================================================================
// C6 — canRetestTyped (presentation-only cap predicate)
// ===========================================================================
CASE("C6 — canRetestTyped: fail-toward-offering, window rollover, conservative when uncertain");
{
  check("no metering info at all -> true (offer typed)", canRetestTyped({}), true);
  check("metering present but refused:false -> true", canRetestTyped({ metering: { refused: false } }), true);
  check("refused, SAME window -> false (MCQ only)",
    canRetestTyped({ metering: { refused: true, scope: 'student', windowKey: '2026-08-05' }, currentWindowKey: '2026-08-05' }), false);
  check("refused, STALE window (day rolled over) -> true (offer typed again)",
    canRetestTyped({ metering: { refused: true, scope: 'student', windowKey: '2026-08-04' }, currentWindowKey: '2026-08-05' }), true);
  check("refused, no currentWindowKey supplied -> conservative false (keep respecting the refusal)",
    canRetestTyped({ metering: { refused: true, scope: 'global', windowKey: '2026-08-05' } }), false);
  check("refused, metering carries no windowKey at all -> conservative false",
    canRetestTyped({ metering: { refused: true, scope: 'unavailable' }, currentWindowKey: '2026-08-05' }), false);
  check("scope 'unavailable' treated the same as any other refusal (still MCQ-only, same window)",
    canRetestTyped({ metering: { refused: true, scope: 'unavailable', windowKey: 'W1' }, currentWindowKey: 'W1' }), false);
}

// ===========================================================================
// C7 — enum shape
// ===========================================================================
CASE("C7 — DAY_STATES / PIP_STATES: exact frozen literal values");
{
  check("DAY_STATES has exactly the five values", Object.values(DAY_STATES).sort(),
    ['bookmarked', 're-completed', 'studied', 'tested', 'untouched']);
  check("PIP_STATES has exactly the three values", Object.values(PIP_STATES).sort(), ['na', 'off', 'on']);
  checkTrue("DAY_STATES is frozen", Object.isFrozen(DAY_STATES));
  checkTrue("PIP_STATES is frozen", Object.isFrozen(PIP_STATES));
}

// ===========================================================================
// C8 — GREP-PROOF: zero firebase/firestore/react imports (comments stripped)
// ===========================================================================
const moduleSrc = readFileSync("/app/src/utils/pastDayAuthority.js", "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const moduleCode = stripComments(moduleSrc);

CASE("C8 — the module has ZERO imports of anything (firebase/firestore/React or otherwise)");
{
  const importLines = moduleSrc.split("\n").filter((l) => /^\s*import\s/.test(l));
  check("zero static import statements in the module", importLines.length, 0);
  checkTrue("zero dynamic import() calls in the module's code", !/\bimport\s*\(/.test(moduleCode));
  checkTrue("zero require() calls in the module's code", !/\brequire\s*\(/.test(moduleCode));
  checkTrue("no case-insensitive 'firebase' substring in the module's CODE (comments stripped)", !/firebase/i.test(moduleCode));
  checkTrue("no case-insensitive 'firestore' substring in the module's CODE (comments stripped)", !/firestore/i.test(moduleCode));
  checkTrue("no case-insensitive 'react' substring in the module's CODE (comments stripped)", !/react/i.test(moduleCode));
}

// ===========================================================================
const evidencePath = process.env.DF2_51A_MODEL_PURE_RECEIPT
  ? new URL(`file://${process.env.DF2_51A_MODEL_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/df2-51a-model-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "df2-51a-model-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/utils/pastDayAuthority.js": sha16("../../src/utils/pastDayAuthority.js"),
    "scripts/deepfix2/df2-51a-model-fixtures.mjs": sha16("./df2-51a-model-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ndf2-51a-model PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
