#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-f — PURE fixtures for the Dashboard entry affordance + resume panel
 * + end-of-list completion screen (no Firebase, no network, no Vite, no
 * emulator, no browser)
 * ============================================================================
 * `src/pages/Dashboard.jsx` is a React component and cannot be `import`ed by
 * plain Node in this checkout (the same structural fact `dayStatusAuthority.js`
 * and `RestudyBrowser.viewModel.js`'s own headers document: no `@esbuild/
 * linux-x64`, no full JSX-emitting Babel plugin — Node's parser fails on the
 * file's first JSX token before any export is reachable). The brief restricts
 * this fold's touch-list to `Dashboard.jsx` ONLY (no new `src/**` module), so
 * unlike 51-c's `RestudyBrowser.viewModel.js` there is no separate importable
 * file to fixture directly. This script therefore proves TWO things, bound
 * together by a text anchor (mirrors 51-c's C2.4 technique):
 *
 *   C1  THE ALGORITHM IS CORRECT — a MIRROR of Dashboard.jsx's own
 *       `resumableDay` composition (same variable names, same clause order),
 *       built from REAL `src/utils/pastDayAuthority.js` exports (imported,
 *       never reimplemented), exercised for real under plain Node.
 *   C2  THE ALGORITHM IS WHAT'S ACTUALLY SHIPPED — text anchors read
 *       `src/pages/Dashboard.jsx`'s live bytes at run time and assert the
 *       mirror's own key substrings (the dead-end formula, the loop
 *       direction, the tie-break) are present verbatim, plus that all three
 *       new render sites are gated behind `REVIEW_V2_CLIENT` exactly once
 *       each, plus that the new imports/state/effect exist.
 *   C3  FLAG-OFF / BYTE-IDENTITY PROOF — a `git diff -U0` structural check
 *       (every hunk is a pure ADD except the one declared import-line
 *       extension) PLUS substring anchors for the specific legacy
 *       expressions this fold's report calls out as untouched
 *       (`calculateStreak`, the day-status ternary, the `listFinished`
 *       derivation, both streak render sites) PLUS sha256 identity for every
 *       sibling file this fold must not touch.
 *   C4  GREP-PROOFS — no new Firestore WRITE verb; the `REVIEW_V2_CLIENT`/
 *       `listFinished`/`/restudy/` occurrence deltas match exactly what this
 *       fold's report declares, derived here, never hand-typed.
 *
 * Does NOT re-test `pastDayAuthority.js` (51-a, cite
 * docs/plans/deepfix2/evidence/df2-51a-model-pure.json, 115/0) — this fold
 * consumes its output only.
 *
 * Run: node scripts/deepfix2/df2-51f-entry-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51f-entry-pure.json
 * (DF2_51F_ENTRY_PURE_RECEIPT env redirects the receipt for the mutant
 * driver, same audit-fixed idiom as df2-51c-browser-fixtures.mjs.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import {
  DAY_STATES, PIP_STATES, derivePastDays,
} from "../../src/utils/pastDayAuthority.js";
import { attemptsForList } from "../../src/utils/dayStatusAuthority.js";
import { REVIEW_V2_CLIENT } from "../../src/config/featureFlags.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

// ===========================================================================
// FIXTURE DATA BUILDERS
// ===========================================================================
function attempt({ classId = "c1", listId = "l1", studyDay, sessionType, passed = true, submittedAt, type }) {
  return { classId, listId, studyDay, sessionType, passed, submittedAt: submittedAt ?? (1000 + studyDay), ...(type ? { type } : {}) };
}
function visit({ classId = "c1", listId = "l1", day, completed = false, reviewHalfAttemptId = null, newHalfAttemptId = null, createdAt }) {
  return { classId, listId, day, completed, reviewHalfAttemptId, newHalfAttemptId, createdAt: createdAt ?? (2000 + day) };
}
// A day with BOTH halves live-passed (so hasNewHalf is true for that day).
function liveDay(day, { classId = "c1", listId = "l1" } = {}) {
  return [
    attempt({ classId, listId, studyDay: day, sessionType: "new", passed: true }),
    attempt({ classId, listId, studyDay: day, sessionType: "review", passed: true }),
  ];
}
// A day with ONLY a review pass (no 'new' attempt at all) -> hasNewHalf FALSE
// for that day (F3) — the fixture shape the DEAD-END exclusion needs.
function reviewOnlyDay(day, { classId = "c1", listId = "l1" } = {}) {
  return [attempt({ classId, listId, studyDay: day, sessionType: "review", passed: true })];
}

// ===========================================================================
// THE MIRROR — line-for-line the SAME composition as Dashboard.jsx's
// `resumableDay` useMemo body (see the C2 text anchors below, which bind
// this mirror's own key substrings to the real file). `progressDataByKey`
// mirrors Dashboard's `progressData` shape: `{ "classId_listId": { currentStudyDay } }`.
// ===========================================================================
function selectResumableDay(restudyVisits, progressDataByKey, userAttempts, getPrimaryFocus) {
  if (!REVIEW_V2_CLIENT_TEST_ONLY_ALWAYS_TRUE || !Array.isArray(restudyVisits) || restudyVisits.length === 0) return null
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
// The mirror always runs in "flag were true" mode (Dashboard.jsx's OWN flag
// check is verified SEPARATELY in C2/C3 as a static+structural gate, per the
// design doc §7(e) doctrine that every fold in this train follows: the flag
// gate is proven at the RENDER/CALL SITE, never re-litigated inside the pure
// derivation's own test data). Named loudly so it can never be mistaken for
// the real flag.
const REVIEW_V2_CLIENT_TEST_ONLY_ALWAYS_TRUE = true;

// The resume panel's label ternary (JSX-inline in Dashboard.jsx) — mirrored
// here verbatim, bound to the real file the same way in C2.
function resumeLabel(pips) {
  return pips.review === PIP_STATES.OFF
    ? "Review half not finished"
    : pips.new === PIP_STATES.OFF
      ? "New-word half not finished"
      : "In progress"
}

// ===========================================================================
// C1 — the mirror composition, exercised for real against REAL pastDayAuthority.js
// ===========================================================================
CASE("C1.1 — no visits at all -> null");
{
  check("restudyVisits: [] -> null", selectResumableDay([], {}, [], null), null);
  check("restudyVisits: null -> null", selectResumableDay(null, {}, [], null), null);
  check("restudyVisits: undefined -> null", selectResumableDay(undefined, {}, [], null), null);
}

CASE("C1.2 — single list, a visit exists but NOTHING recorded yet (state 'studied') -> selected");
{
  const attempts = [...liveDay(1), ...liveDay(2), ...liveDay(3)];
  const visits = [visit({ day: 2 })]; // minted, nothing recorded
  const progressByKey = { c1_l1: { currentStudyDay: 3 } };
  const picked = selectResumableDay(visits, progressByKey, attempts, null);
  check("day 2 selected", picked?.day, 2);
  check("state is 'studied'", picked?.state, DAY_STATES.STUDIED);
  check("classId/listId carried on the candidate", [picked?.classId, picked?.listId], ["c1", "l1"]);
  check("label: both pips off -> 'Review half not finished'", resumeLabel(picked.pips), "Review half not finished");
}

CASE("C1.3 — review half recorded, new half open (state 'tested') -> selected, label = new-word half");
{
  const attempts = [...liveDay(1), ...liveDay(2), ...liveDay(3)];
  const visits = [visit({ day: 2, reviewHalfAttemptId: "a1" })];
  const progressByKey = { c1_l1: { currentStudyDay: 3 } };
  const picked = selectResumableDay(visits, progressByKey, attempts, null);
  check("day 2 selected", picked?.day, 2);
  check("pips.review on / pips.new off", picked?.pips, { review: PIP_STATES.ON, new: PIP_STATES.OFF });
  check("label = 'New-word half not finished'", resumeLabel(picked.pips), "New-word half not finished");
}

CASE("C1.4 — new half recorded, review half open -> selected, label = review half");
{
  const attempts = [...liveDay(1), ...liveDay(2), ...liveDay(3)];
  const visits = [visit({ day: 2, newHalfAttemptId: "a2" })];
  const progressByKey = { c1_l1: { currentStudyDay: 3 } };
  const picked = selectResumableDay(visits, progressByKey, attempts, null);
  check("day 2 selected", picked?.day, 2);
  check("pips.review off / pips.new on", picked?.pips, { review: PIP_STATES.OFF, new: PIP_STATES.ON });
  check("label = 'Review half not finished'", resumeLabel(picked.pips), "Review half not finished");
}

CASE("C1.5 — DEAD-END EXCLUSION: review recorded, new half PERMANENTLY unavailable (F3/F4) -> null");
{
  const attempts = reviewOnlyDay(1); // no 'new' attempt at all for day 1 -> hasNewHalf false
  const visits = [visit({ day: 1, reviewHalfAttemptId: "a1" })]; // review recorded
  const progressByKey = { c1_l1: { currentStudyDay: 1 } };
  const picked = selectResumableDay(visits, progressByKey, attempts, null);
  check("the day's own pips confirm the dead-end shape (sanity check via derivePastDays directly)",
    derivePastDays({ currentStudyDay: 1, attempts: attemptsForList(attempts, "c1", "l1"), visits }).map((r) => r.pips),
    [{ review: PIP_STATES.ON, new: PIP_STATES.NOT_APPLICABLE }]);
  check("excluded -> null (nothing resumable)", picked, null);
}

CASE("C1.6 — nearest-to-today respects the dead-end exclusion (does not just grab the nearest day)");
{
  // days 1,2,3,4 all live/complete (hasNewHalf true); day 5 has review-only (hasNewHalf false).
  const attempts = [...liveDay(1), ...liveDay(2), ...liveDay(3), ...liveDay(4), ...reviewOnlyDay(5)];
  const visits = [
    visit({ day: 5, reviewHalfAttemptId: "a5" }), // nearest to today, but a DEAD END
    visit({ day: 3 }),                             // earlier, genuinely resumable (studied)
  ];
  const progressByKey = { c1_l1: { currentStudyDay: 5 } };
  const picked = selectResumableDay(visits, progressByKey, attempts, null);
  check("day 3 selected, NOT day 5 (day 5 is excluded as a dead end)", picked?.day, 3);
}

CASE("C1.7 — all visited days are already re-completed -> null");
{
  const attempts = [...liveDay(1), ...liveDay(2)];
  const visits = [
    visit({ day: 1, completed: true, reviewHalfAttemptId: "a1", newHalfAttemptId: "b1" }),
    visit({ day: 2, completed: true, reviewHalfAttemptId: "a2", newHalfAttemptId: "b2" }),
  ];
  const progressByKey = { c1_l1: { currentStudyDay: 2 } };
  check("nothing resumable once every visited day is re-completed", selectResumableDay(visits, progressByKey, attempts, null), null);
}

CASE("C1.8 — malformed visit docs are skipped, never throw");
{
  const attempts = [...liveDay(1), ...liveDay(2)];
  const visits = [
    { day: 1, completed: false },      // missing classId/listId -> dropped
    null, undefined,                    // dropped
    visit({ day: 2 }),                  // well-formed -> kept
  ];
  const progressByKey = { c1_l1: { currentStudyDay: 2 } };
  checkTrue("does not throw", (() => { try { selectResumableDay(visits, progressByKey, attempts, null); return true; } catch { return false; } })());
  check("the well-formed visit still resolves normally", selectResumableDay(visits, progressByKey, attempts, null)?.day, 2);
}

CASE("C1.9 — cross-list tie-break: the FOCUSED list wins even when it is not alphabetically first");
{
  const attempts = [...liveDay(1, { classId: "c1", listId: "l1" }), ...liveDay(1, { classId: "c2", listId: "l2" })];
  const visits = [
    visit({ classId: "c1", listId: "l1", day: 1 }), // alphabetically first
    visit({ classId: "c2", listId: "l2", day: 1 }),
  ];
  const progressByKey = { c1_l1: { currentStudyDay: 1 }, c2_l2: { currentStudyDay: 1 } };
  const picked = selectResumableDay(visits, progressByKey, attempts, { classId: "c2", id: "l2" });
  check("the FOCUSED (c2,l2) candidate wins, not the alphabetically-first (c1,l1)", [picked?.classId, picked?.listId], ["c2", "l2"]);
}

CASE("C1.10 — cross-list tie-break: no focus among candidates -> alphabetically-first classId_listId wins (deterministic)");
{
  const attempts = [...liveDay(1, { classId: "c1", listId: "l1" }), ...liveDay(1, { classId: "c2", listId: "l2" })];
  const visits = [
    visit({ classId: "c2", listId: "l2", day: 1 }),
    visit({ classId: "c1", listId: "l1", day: 1 }),
  ];
  const progressByKey = { c1_l1: { currentStudyDay: 1 }, c2_l2: { currentStudyDay: 1 } };
  check("no focus -> alphabetically-first (c1,l1) wins", [selectResumableDay(visits, progressByKey, attempts, null)?.classId, selectResumableDay(visits, progressByKey, attempts, null)?.listId], ["c1", "l1"]);
  check("focus on an UNRELATED third list -> still alphabetically-first (c1,l1) wins", [selectResumableDay(visits, progressByKey, attempts, { classId: "c9", id: "l9" })?.classId, selectResumableDay(visits, progressByKey, attempts, { classId: "c9", id: "l9" })?.listId], ["c1", "l1"]);
}

CASE("C1.11 — resumeLabel: the third (defensive) branch, both pips 'on' — structurally rare, never blank");
{
  check("both on -> 'In progress' (never blank/undefined)", resumeLabel({ review: PIP_STATES.ON, new: PIP_STATES.ON }), "In progress");
}

// ===========================================================================
// C2 — TEXT ANCHORS against the REAL src/pages/Dashboard.jsx bytes (binds
// the mirror above + the flag-off gating claim to the actual shipped file,
// mirrors 51-c's C2.4 technique).
// ===========================================================================
const dashSrc = readFileSync(new URL("../../src/pages/Dashboard.jsx", import.meta.url), "utf8");
const occurrences = (s) => (dashSrc.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;

CASE("C2.1 — REVIEW_V2_CLIENT is the real, currently-shipped false constant");
{
  check("REVIEW_V2_CLIENT === false today", REVIEW_V2_CLIENT, false);
}

CASE("C2.2 — the three new imports/state exist exactly once");
{
  check("firestore import extended with collection/getDocs (getDoc/doc untouched)",
    occurrences("import { collection, doc, getDoc, getDocs } from 'firebase/firestore'"), 1);
  check("pastDayAuthority import present exactly once",
    occurrences("import { DAY_STATES, PIP_STATES, derivePastDays } from '../utils/pastDayAuthority'"), 1);
  check("restudyVisits state declared exactly once",
    occurrences("const [restudyVisits, setRestudyVisits] = useState(null)"), 1);
}

CASE("C2.3 — the account-wide visits read: gated, read-only, called exactly once");
{
  check("loadRestudyVisits defined exactly once", occurrences("const loadRestudyVisits = async () => {"), 1);
  check("loadRestudyVisits is CALLED exactly once (declaration + comment + call = 3 total occurrences of the bare name)",
    occurrences("loadRestudyVisits"), 3);
  check("the read is the getDocs(collection(...)) shape, exactly once", occurrences("await getDocs(collection(db, `users/${user.uid}/restudy_visits`))"), 1);
  checkTrue("loadRestudyVisits's flag-off short-circuit is the literal first statement in its body",
    /const loadRestudyVisits = async \(\) => \{\s*\n\s*if \(!REVIEW_V2_CLIENT\) return\s*\n\s*try \{/.test(dashSrc));
}

CASE("C2.4 — the resumableDay memo: the mirror's key substrings present verbatim in the real file");
{
  checkTrue("flag/array/empty guard, identical to the mirror's first line",
    dashSrc.includes("if (!REVIEW_V2_CLIENT || !Array.isArray(restudyVisits) || restudyVisits.length === 0) return null"));
  checkTrue("dead-end formula, identical to the mirror",
    dashSrc.includes("const deadEnd = row.pips.review === PIP_STATES.ON && row.pips.new === PIP_STATES.NOT_APPLICABLE"));
  checkTrue("incomplete formula, identical to the mirror",
    dashSrc.includes("const incomplete = row.state === DAY_STATES.STUDIED || row.state === DAY_STATES.TESTED"));
  checkTrue("nearest-to-today loop direction, identical to the mirror",
    dashSrc.includes("for (let i = rows.length - 1; i >= 0; i--) {"));
  checkTrue("focused-list-first tie-break, identical to the mirror",
    dashSrc.includes("candidates.find((c) => c.classId === getPrimaryFocus.classId && c.listId === getPrimaryFocus.id)"));
  checkTrue("alphabetical fallback tie-break, identical to the mirror",
    dashSrc.includes("candidates.slice().sort((a, b) => (`${a.classId}_${a.listId}` < `${b.classId}_${b.listId}` ? -1 : 1))[0]"));
  check("derivePastDays is called from the memo exactly once (this fold never adds a second call site)",
    (dashSrc.match(/derivePastDays\(/g) || []).length, 1);
}

CASE("C2.5 — the three render sites: each gated behind REVIEW_V2_CLIENT exactly once, each routing to /restudy/");
{
  check("entry affordance gate, exactly once", occurrences("{REVIEW_V2_CLIENT && (\n                                      <Button"), 1);
  check("resume panel gate, exactly once", occurrences("{REVIEW_V2_CLIENT && resumableDay && ("), 1);
  check("end-of-list gate, exactly once — REUSES listFinished, does not redeclare it",
    occurrences("{REVIEW_V2_CLIENT && !anyLoading && !progressHasError && getPrimaryFocus && listFinished && ("), 1);
  check("exactly 3 /restudy/ route templates added in this file (entry, resume, end-of-list)", occurrences("`/restudy/"), 3);
  checkTrue("entry affordance routes to this list's own browser", dashSrc.includes("to={`/restudy/${klass.id}/${list.id}`}"));
  checkTrue("resume panel routes to the SELECTED candidate's own list (not necessarily the focused one)",
    dashSrc.includes("to={`/restudy/${resumableDay.classId}/${resumableDay.listId}`}"));
  checkTrue("end-of-list routes to the focused list's browser", dashSrc.includes("to={`/restudy/${getPrimaryFocus.classId}/${getPrimaryFocus.id}`}"));
}

CASE("C2.6 — resumeLabel's mirror is present verbatim as the resume panel's JSX ternary");
{
  checkTrue("review-off branch text, verbatim", dashSrc.includes("? 'Review half not finished'"));
  checkTrue("new-off branch text, verbatim (nested ternary's OWN true-branch, hence '?' not ':')", dashSrc.includes("? 'New-word half not finished'"));
  checkTrue("defensive fallback text, verbatim", dashSrc.includes(": 'In progress'"));
  checkTrue("review checked BEFORE new (matches the mirror's precedence)",
    dashSrc.indexOf("resumableDay.pips.review === PIP_STATES.OFF") < dashSrc.indexOf("resumableDay.pips.new === PIP_STATES.OFF"));
}

// ===========================================================================
// C3 — FLAG-OFF / BYTE-IDENTITY: a git-diff STRUCTURAL proof (every hunk is a
// pure add except the ONE declared import-line extension) + substring
// anchors for the specific legacy expressions untouched + sha256 identity
// for every sibling file this fold must not touch.
// ===========================================================================
CASE("C3.1 — git diff STRUCTURE: every hunk against HEAD is a pure ADD, except the one declared import-line change");
{
  const diff = execFileSync("git", ["diff", "-U0", "--", "src/pages/Dashboard.jsx"], { cwd: "/app", encoding: "utf8" });
  const hunkHeaders = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)];
  checkTrue("at least one hunk exists (something changed)", hunkHeaders.length > 0);
  const removedCounts = hunkHeaders.map((m) => Number(m[2] ?? 1));
  const totalRemoved = removedCounts.reduce((a, b) => a + b, 0);
  check("exactly ONE line removed in the whole file (the import line extension)", totalRemoved, 1);
  const nonZeroRemovalHunks = removedCounts.filter((n) => n > 0).length;
  check("exactly ONE hunk removes anything at all", nonZeroRemovalHunks, 1);
  // The one removed line must be the OLD import line, and the replacement must be additive
  // (doc/getDoc preserved, collection/getDocs added) — never a behavior change to an existing import.
  checkTrue("the ONE removed line is the pre-fold firestore import", diff.includes("-import { doc, getDoc } from 'firebase/firestore'"));
  checkTrue("its replacement preserves doc/getDoc and only ADDS collection/getDocs", diff.includes("+import { collection, doc, getDoc, getDocs } from 'firebase/firestore'"));
}

CASE("C3.2 — legacy expressions this fold's report calls out as untouched, byte-identical to HEAD");
{
  const head = execFileSync("git", ["show", "HEAD:src/pages/Dashboard.jsx"], { cwd: "/app", encoding: "utf8" });
  checkTrue("listFinished derivation, byte-identical to HEAD",
    head.includes("const listFinished = !focusLapView && listTotal > 0 && wordsLeft === 0")
    && dashSrc.includes("const listFinished = !focusLapView && listTotal > 0 && wordsLeft === 0"));
  checkTrue("calculateStreak signature, byte-identical to HEAD",
    head.includes("const calculateStreak = (recentSessions, studyDaysPerWeek) => {")
    && dashSrc.includes("const calculateStreak = (recentSessions, studyDaysPerWeek) => {"));
  checkTrue("day-status ternary (df2-33), byte-identical to HEAD",
    head.includes("const dayStatus = REVIEW_V2_CLIENT\n        ? deriveListDayStatus({")
    && dashSrc.includes("const dayStatus = REVIEW_V2_CLIENT\n        ? deriveListDayStatus({"));
  checkTrue("streak hero-pill render site, byte-identical to HEAD",
    head.includes("🔥 {streakDays}-day streak") && dashSrc.includes("🔥 {streakDays}-day streak"));
  checkTrue("streak stat-tile render site, byte-identical to HEAD",
    head.includes("{streakDays} <span") && dashSrc.includes("{streakDays} <span"));
  checkTrue("Start Session / Blind Spots buttons, byte-identical to HEAD",
    head.includes("<span className=\"truncate whitespace-nowrap\">Start Session</span>")
    && dashSrc.includes("<span className=\"truncate whitespace-nowrap\">Start Session</span>")
    && head.includes("<span className=\"truncate whitespace-nowrap\">Blind Spots</span>")
    && dashSrc.includes("<span className=\"truncate whitespace-nowrap\">Blind Spots</span>"));
}

CASE("C3.3 — every sibling file this fold must not touch is sha256-identical to HEAD");
{
  const sha = (s) => createHash("sha256").update(s).digest("hex");
  const UNTOUCHED = [
    "src/utils/pastDayAuthority.js",
    "src/utils/dayStatusAuthority.js",
    "src/utils/streakAuthority.js",
    "src/services/restudyVisit.js",
    "src/services/streakCredits.js",
    "src/App.jsx",
    "src/pages/RestudyBrowser.jsx",
    "src/pages/RestudyBrowser.viewModel.js",
    "src/config/featureFlags.js",
  ];
  for (const rel of UNTOUCHED) {
    const head = execFileSync("git", ["show", `HEAD:${rel}`], { cwd: "/app", encoding: "utf8" });
    const now = readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
    check(`${rel} sha256-identical to HEAD`, sha(now), sha(head));
  }
}

// ===========================================================================
// C4 — GREP-PROOFS: numbers this fold's report cites, all derived HERE.
// ===========================================================================
CASE("C4.1 — no new Firestore WRITE verb introduced (this fold is read-only)");
{
  const writeVerbs = (dashSrc.match(/\b(setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction)\(/g) || []).length;
  const headWriteVerbs = (execFileSync("git", ["show", "HEAD:src/pages/Dashboard.jsx"], { cwd: "/app", encoding: "utf8" })
    .match(/\b(setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction)\(/g) || []).length;
  check("zero write verbs in HEAD", headWriteVerbs, 0);
  check("zero write verbs after this fold (unchanged — this fold added no write)", writeVerbs, 0);
}

CASE("C4.2 — REVIEW_V2_CLIENT / listFinished occurrence deltas match this fold's own new gate count");
{
  const head = execFileSync("git", ["show", "HEAD:src/pages/Dashboard.jsx"], { cwd: "/app", encoding: "utf8" });
  const countIn = (s, re) => (s.match(re) || []).length;
  const rvcHead = countIn(head, /REVIEW_V2_CLIENT/g);
  const rvcNow = countIn(dashSrc, /REVIEW_V2_CLIENT/g);
  // +7: 3 render-site gates + loadRestudyVisits's own gate + resumableDay's own gate + 2 comments.
  check("REVIEW_V2_CLIENT delta is +7", rvcNow - rvcHead, 7);
  const lfHead = countIn(head, /listFinished/g);
  const lfNow = countIn(dashSrc, /listFinished/g);
  // +2: the end-of-list gate's own reference + its explanatory comment (the derivation ITSELF,
  // `const listFinished = ...`, is unchanged — proven byte-identical in C3.2).
  check("listFinished delta is +2 (consumed, not redefined — C3.2 proves the definition itself is untouched)", lfNow - lfHead, 2);
}

// ===========================================================================
const evidencePath = process.env.DF2_51F_ENTRY_PURE_RECEIPT
  ? new URL(`file://${process.env.DF2_51F_ENTRY_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/df2-51f-entry-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "df2-51f-entry-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/pages/Dashboard.jsx": sha16("../../src/pages/Dashboard.jsx"),
    "src/utils/pastDayAuthority.js": sha16("../../src/utils/pastDayAuthority.js"),
    "src/utils/dayStatusAuthority.js": sha16("../../src/utils/dayStatusAuthority.js"),
    "src/config/featureFlags.js": sha16("../../src/config/featureFlags.js"),
    "scripts/deepfix2/df2-51f-entry-fixtures.mjs": sha16("./df2-51f-entry-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ndf2-51f-entry PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
