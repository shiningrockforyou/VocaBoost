#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-f — MUTANTS: break the real logic, expect the sensitive check to
 * go RED. Two families, NEITHER of which writes to disk:
 * ============================================================================
 *   MIRROR mutants (M1-M3) — a MUTATED variant of the `resumableDay` mirror
 *     (same shape as `df2-51f-entry-fixtures.mjs`'s own mirror, built from
 *     REAL `src/utils/pastDayAuthority.js` exports) is run in-process against
 *     one of the pure fixture's own scenarios; the mutant must produce the
 *     WRONG answer.
 *   TEXT-ANCHOR mutants (M4-M8) — `src/pages/Dashboard.jsx`'s bytes are read
 *     ONCE, mutated IN A JS STRING (never written back to disk), and the
 *     SAME anchor check the pure fixture's C2 group runs is re-evaluated
 *     against that in-memory copy; it must flip from green to red.
 *
 * WHY NO DISK MUTATION (a deliberate departure from
 * dashboard-df2-33-mutants.mjs / dashboard-streak-authority-mutants.mjs,
 * which DO mutate their real target files in place with a restore-and-
 * verify cycle): those targets are `dayStatusAuthority.js` / `streakAuthority
 * .js` / `streakCredits.js` — small, single-purpose modules. This fold's
 * target would be `Dashboard.jsx` itself — the file the brief explicitly
 * calls out as "on the live path for 947 students" and already carrying two
 * prior flag-gated folds' guarantees. 51-c made the identical call for
 * `App.jsx` for the identical reason ("a shared/contended file... this fold
 * does not mutate it even temporarily" — see that fold's ledger, mutant M1).
 * Dashboard.jsx is not literally shared with another IN-FLIGHT fold this
 * session, but it is this program's single highest-blast-radius file, and a
 * SIMULATED in-memory mutation proves exactly the same thing (the anchor
 * check is sensitive to the clause) with strictly less risk. Recorded here
 * as a judgment call, not a shortcut — see the fold report.
 *
 * Run: node scripts/deepfix2/df2-51f-entry-mutants.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51f-entry-mutants.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

import { DAY_STATES, PIP_STATES, derivePastDays } from "../../src/utils/pastDayAuthority.js";
import { attemptsForList } from "../../src/utils/dayStatusAuthority.js";

const results = [];
let bad = 0;

// ===========================================================================
// Shared fixture-data builders (mirrors df2-51f-entry-fixtures.mjs's own —
// small enough that duplicating rather than importing keeps each script
// independently readable; both are pinned to the SAME real pastDayAuthority.js).
// ===========================================================================
function attempt({ classId = "c1", listId = "l1", studyDay, sessionType, passed = true, submittedAt, type }) {
  return { classId, listId, studyDay, sessionType, passed, submittedAt: submittedAt ?? (1000 + studyDay), ...(type ? { type } : {}) };
}
function visit({ classId = "c1", listId = "l1", day, completed = false, reviewHalfAttemptId = null, newHalfAttemptId = null, createdAt }) {
  return { classId, listId, day, completed, reviewHalfAttemptId, newHalfAttemptId, createdAt: createdAt ?? (2000 + day) };
}
function liveDay(day, { classId = "c1", listId = "l1" } = {}) {
  return [
    attempt({ classId, listId, studyDay: day, sessionType: "new", passed: true }),
    attempt({ classId, listId, studyDay: day, sessionType: "review", passed: true }),
  ];
}
function reviewOnlyDay(day, { classId = "c1", listId = "l1" } = {}) {
  return [attempt({ classId, listId, studyDay: day, sessionType: "review", passed: true })];
}

// The CORRECT composition (identical to Dashboard.jsx / the pure fixture's mirror).
function selectResumableDayCorrect(restudyVisits, progressDataByKey, userAttempts, getPrimaryFocus) {
  const byList = new Map()
  for (const v of restudyVisits) {
    if (!v?.classId || !v?.listId) continue
    const key = `${v.classId}_${v.listId}`
    if (!byList.has(key)) byList.set(key, [])
    byList.get(key).push(v)
  }
  const candidates = []
  for (const [, visits] of byList) {
    const classId = visits[0].classId
    const listId = visits[0].listId
    const progress = progressDataByKey[`${classId}_${listId}`]
    const rows = derivePastDays({
      currentStudyDay: progress?.currentStudyDay ?? 0,
      attempts: attemptsForList(userAttempts, classId, listId),
      visits,
    })
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      const incomplete = row.state === DAY_STATES.STUDIED || row.state === DAY_STATES.TESTED
      const deadEnd = row.pips.review === PIP_STATES.ON && row.pips.new === PIP_STATES.NOT_APPLICABLE
      if (incomplete && !deadEnd) { candidates.push({ ...row, classId, listId }); break }
    }
  }
  if (candidates.length === 0) return null
  const focused = getPrimaryFocus
    && candidates.find((c) => c.classId === getPrimaryFocus.classId && c.listId === getPrimaryFocus.id)
  if (focused) return focused
  return candidates.slice().sort((a, b) => (`${a.classId}_${a.listId}` < `${b.classId}_${b.listId}` ? -1 : 1))[0]
}

// M1: the dead-end `&& !deadEnd` conjunct dropped.
function selectResumableDay_M1_noDeadEndCheck(restudyVisits, progressDataByKey, userAttempts, getPrimaryFocus) {
  const byList = new Map()
  for (const v of restudyVisits) {
    if (!v?.classId || !v?.listId) continue
    const key = `${v.classId}_${v.listId}`
    if (!byList.has(key)) byList.set(key, [])
    byList.get(key).push(v)
  }
  const candidates = []
  for (const [, visits] of byList) {
    const classId = visits[0].classId
    const listId = visits[0].listId
    const progress = progressDataByKey[`${classId}_${listId}`]
    const rows = derivePastDays({
      currentStudyDay: progress?.currentStudyDay ?? 0,
      attempts: attemptsForList(userAttempts, classId, listId),
      visits,
    })
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      const incomplete = row.state === DAY_STATES.STUDIED || row.state === DAY_STATES.TESTED
      // [MUTANT M1] the dead-end exclusion is dropped
      if (incomplete) { candidates.push({ ...row, classId, listId }); break }
    }
  }
  if (candidates.length === 0) return null
  const focused = getPrimaryFocus
    && candidates.find((c) => c.classId === getPrimaryFocus.classId && c.listId === getPrimaryFocus.id)
  if (focused) return focused
  return candidates.slice().sort((a, b) => (`${a.classId}_${a.listId}` < `${b.classId}_${b.listId}` ? -1 : 1))[0]
}

// M2: iterate earliest-first instead of nearest-to-today.
function selectResumableDay_M2_earliestFirst(restudyVisits, progressDataByKey, userAttempts, getPrimaryFocus) {
  const byList = new Map()
  for (const v of restudyVisits) {
    if (!v?.classId || !v?.listId) continue
    const key = `${v.classId}_${v.listId}`
    if (!byList.has(key)) byList.set(key, [])
    byList.get(key).push(v)
  }
  const candidates = []
  for (const [, visits] of byList) {
    const classId = visits[0].classId
    const listId = visits[0].listId
    const progress = progressDataByKey[`${classId}_${listId}`]
    const rows = derivePastDays({
      currentStudyDay: progress?.currentStudyDay ?? 0,
      attempts: attemptsForList(userAttempts, classId, listId),
      visits,
    })
    // [MUTANT M2] earliest-first instead of nearest-to-today
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const incomplete = row.state === DAY_STATES.STUDIED || row.state === DAY_STATES.TESTED
      const deadEnd = row.pips.review === PIP_STATES.ON && row.pips.new === PIP_STATES.NOT_APPLICABLE
      if (incomplete && !deadEnd) { candidates.push({ ...row, classId, listId }); break }
    }
  }
  if (candidates.length === 0) return null
  const focused = getPrimaryFocus
    && candidates.find((c) => c.classId === getPrimaryFocus.classId && c.listId === getPrimaryFocus.id)
  if (focused) return focused
  return candidates.slice().sort((a, b) => (`${a.classId}_${a.listId}` < `${b.classId}_${b.listId}` ? -1 : 1))[0]
}

// M3: the "prefer the focused list" step dropped — always falls through to the alphabetical sort.
function selectResumableDay_M3_noFocusPreference(restudyVisits, progressDataByKey, userAttempts, getPrimaryFocus) {
  const byList = new Map()
  for (const v of restudyVisits) {
    if (!v?.classId || !v?.listId) continue
    const key = `${v.classId}_${v.listId}`
    if (!byList.has(key)) byList.set(key, [])
    byList.get(key).push(v)
  }
  const candidates = []
  for (const [, visits] of byList) {
    const classId = visits[0].classId
    const listId = visits[0].listId
    const progress = progressDataByKey[`${classId}_${listId}`]
    const rows = derivePastDays({
      currentStudyDay: progress?.currentStudyDay ?? 0,
      attempts: attemptsForList(userAttempts, classId, listId),
      visits,
    })
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      const incomplete = row.state === DAY_STATES.STUDIED || row.state === DAY_STATES.TESTED
      const deadEnd = row.pips.review === PIP_STATES.ON && row.pips.new === PIP_STATES.NOT_APPLICABLE
      if (incomplete && !deadEnd) { candidates.push({ ...row, classId, listId }); break }
    }
  }
  if (candidates.length === 0) return null
  // [MUTANT M3] the focused-list preference is dropped
  return candidates.slice().sort((a, b) => (`${a.classId}_${a.listId}` < `${b.classId}_${b.listId}` ? -1 : 1))[0]
}

function killedByMirror(id, clause, correctExpected, mutantFn, scenario) {
  const [visits, progressByKey, attempts, focus] = scenario;
  const correct = selectResumableDayCorrect(visits, progressByKey, attempts, focus);
  const mutant = mutantFn(visits, progressByKey, attempts, focus);
  const correctMatchesExpected = JSON.stringify(correct?.day ? { day: correct.day, classId: correct.classId, listId: correct.listId } : correct)
    === JSON.stringify(correctExpected);
  const killed = JSON.stringify(mutant?.day ? { day: mutant.day, classId: mutant.classId, listId: mutant.listId } : mutant)
    !== JSON.stringify(correctExpected);
  const ok = correctMatchesExpected && killed;
  results.push({
    id, clause, family: "mirror", killed: ok,
    correctExpected, correctActual: correct, mutantActual: mutant,
  });
  if (!ok) { bad++; console.error(`✗ ${id} did NOT behave as expected (correctMatches=${correctMatchesExpected}, killed=${killed})`); }
  else console.log(`✓ ${id} killed (mutant produced a different, wrong answer)`);
}

// M1 scenario: reuses the pure fixture's C1.6 shape — day 5 dead-end (nearest), day 3 resumable.
{
  const attempts = [...liveDay(1), ...liveDay(2), ...liveDay(3), ...liveDay(4), ...reviewOnlyDay(5)];
  const visits = [visit({ day: 5, reviewHalfAttemptId: "a5" }), visit({ day: 3 })];
  const progressByKey = { c1_l1: { currentStudyDay: 5 } };
  killedByMirror(
    "M1-DEAD-END-EXCLUSION-DROPPED",
    "a day whose review is done but whose new half is permanently unavailable (F3/F4) is excluded (C1.6)",
    { day: 3, classId: "c1", listId: "l1" },
    selectResumableDay_M1_noDeadEndCheck,
    [visits, progressByKey, attempts, null],
  );
}

// M2 scenario: two genuinely-resumable days (2 and 4, neither a dead end) — nearest-to-today (4) must win.
{
  const attempts = [...liveDay(1), ...liveDay(2), ...liveDay(3), ...liveDay(4)];
  const visits = [visit({ day: 2 }), visit({ day: 4 })];
  const progressByKey = { c1_l1: { currentStudyDay: 4 } };
  killedByMirror(
    "M2-TIE-BREAK-REVERSED",
    "nearest-to-today wins among multiple resumable days, not earliest-first",
    { day: 4, classId: "c1", listId: "l1" },
    selectResumableDay_M2_earliestFirst,
    [visits, progressByKey, attempts, null],
  );
}

// M3 scenario: reuses the pure fixture's C1.9 shape — focused (c2,l2) must win over alphabetically-first (c1,l1).
{
  const attempts = [...liveDay(1, { classId: "c1", listId: "l1" }), ...liveDay(1, { classId: "c2", listId: "l2" })];
  const visits = [visit({ classId: "c1", listId: "l1", day: 1 }), visit({ classId: "c2", listId: "l2", day: 1 })];
  const progressByKey = { c1_l1: { currentStudyDay: 1 }, c2_l2: { currentStudyDay: 1 } };
  killedByMirror(
    "M3-FOCUS-PREFERENCE-DROPPED",
    "the currently-focused list wins the cross-list tie-break, not just the alphabetical fallback (C1.9)",
    { day: 1, classId: "c2", listId: "l2" },
    selectResumableDay_M3_noFocusPreference,
    [visits, progressByKey, attempts, { classId: "c2", id: "l2" }],
  );
}

// ===========================================================================
// TEXT-ANCHOR mutants (M4-M8) — Dashboard.jsx's bytes read ONCE, mutated IN
// MEMORY ONLY (see the header for why this fold never writes to that file).
// ===========================================================================
const dashSrc = readFileSync(new URL("../../src/pages/Dashboard.jsx", import.meta.url), "utf8");
const dashSha256 = createHash("sha256").update(dashSrc).digest("hex");

function anchorFn(id, clause, needle, expectPresentOnReal) {
  const realHas = dashSrc.includes(needle);
  return { id, clause, needle, realHas, expectPresentOnReal };
}

const TEXT_MUTANTS = [
  {
    id: "M4-ENTRY-FLAG-GATE-REMOVED",
    clause: "the entry affordance is gated behind REVIEW_V2_CLIENT (brief's 1st named minimum)",
    find: "{REVIEW_V2_CLIENT && (\n                                      <Button\n                                        variant=\"outline\"\n                                        size=\"md\"\n                                        to={`/restudy/${klass.id}/${list.id}`}",
    replace: "{/* [MUTANT M4] flag-off gate removed */ true && (\n                                      <Button\n                                        variant=\"outline\"\n                                        size=\"md\"\n                                        to={`/restudy/${klass.id}/${list.id}`}",
    anchor: "{REVIEW_V2_CLIENT && (\n                                      <Button",
  },
  {
    id: "M5-RESUME-FLAG-GATE-REMOVED",
    clause: "the resume panel is gated behind REVIEW_V2_CLIENT",
    find: "{REVIEW_V2_CLIENT && resumableDay && (",
    replace: "{/* [MUTANT M5] flag-off gate removed */ resumableDay && (",
    anchor: "{REVIEW_V2_CLIENT && resumableDay && (",
  },
  {
    id: "M6-RESUME-VISIT-GUARD-REMOVED",
    clause: "the resume panel does not render with no resumable visit (brief's 2nd named minimum)",
    find: "{REVIEW_V2_CLIENT && resumableDay && (",
    replace: "{REVIEW_V2_CLIENT && (",
    anchor: "{REVIEW_V2_CLIENT && resumableDay && (",
  },
  {
    id: "M7-ENDOFLIST-FLAG-GATE-REMOVED",
    clause: "the end-of-list screen is gated behind REVIEW_V2_CLIENT",
    find: "{REVIEW_V2_CLIENT && !anyLoading && !progressHasError && getPrimaryFocus && listFinished && (",
    replace: "{/* [MUTANT M7] flag-off gate removed */ !anyLoading && !progressHasError && getPrimaryFocus && listFinished && (",
    anchor: "{REVIEW_V2_CLIENT && !anyLoading && !progressHasError && getPrimaryFocus && listFinished && (",
  },
  {
    id: "M8-ENDOFLIST-LISTFINISHED-GUARD-REMOVED",
    clause: "the end-of-list screen requires listFinished (reuses, never redefines, the existing derivation)",
    find: "{REVIEW_V2_CLIENT && !anyLoading && !progressHasError && getPrimaryFocus && listFinished && (",
    replace: "{REVIEW_V2_CLIENT && !anyLoading && !progressHasError && getPrimaryFocus && (",
    anchor: "{REVIEW_V2_CLIENT && !anyLoading && !progressHasError && getPrimaryFocus && listFinished && (",
  },
];

for (const m of TEXT_MUTANTS) {
  if (!dashSrc.includes(m.find)) {
    console.error(`FATAL: mutant ${m.id} anchor NOT FOUND in the real Dashboard.jsx — the file drifted; re-anchor the mutant`);
    bad++;
    results.push({ id: m.id, clause: m.clause, family: "text-anchor", killed: false, error: "anchor not found" });
    continue;
  }
  const before = (dashSrc.match(new RegExp(m.anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  const mutatedSrc = dashSrc.replace(m.find, m.replace); // IN-MEMORY ONLY — dashSrc/the real file are never reassigned/written
  if (mutatedSrc === dashSrc) {
    console.error(`FATAL: mutant ${m.id} produced no change`);
    bad++;
    results.push({ id: m.id, clause: m.clause, family: "text-anchor", killed: false, error: "no-op replace" });
    continue;
  }
  const after = (mutatedSrc.match(new RegExp(m.anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  const killed = before === 1 && after === 0;
  results.push({ id: m.id, clause: m.clause, family: "text-anchor", killed, anchorCountBefore: before, anchorCountAfter: after });
  if (!killed) { bad++; console.error(`✗ ${m.id} SURVIVED — anchor count before=${before} after=${after} (expected 1 -> 0)`); }
  else console.log(`✓ ${m.id} killed (anchor present exactly once on the real file, absent on the mutated in-memory copy)`);
}

// Belt: the REAL file on disk must be untouched by this whole run (only ever read, never written).
const dashSrcAfterRun = readFileSync(new URL("../../src/pages/Dashboard.jsx", import.meta.url), "utf8");
const dashShaAfterRun = createHash("sha256").update(dashSrcAfterRun).digest("hex");
const diskUntouched = dashShaAfterRun === dashSha256;
if (!diskUntouched) { bad++; console.error("✗ src/pages/Dashboard.jsx CHANGED ON DISK during this mutants run — this must never happen"); }
else console.log("✓ src/pages/Dashboard.jsx on disk is byte-identical before/after this run (no mutant ever touched it)");

mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../docs/plans/deepfix2/evidence/df2-51f-entry-mutants.json", import.meta.url),
  JSON.stringify({
    kind: "df2-51f-entry-mutants",
    pass: bad === 0,
    mutants: results,
    diskUntouched,
    dashboardSha256: dashSha256,
    at: new Date().toISOString(),
  }, null, 2));
console.log(`\ndf2-51f-entry MUTANTS: ${results.filter((r) => r.killed).length}/${results.length} killed, disk ${diskUntouched ? "untouched" : "MODIFIED (BUG)"}`);
process.exit(bad ? 1 : 0);
