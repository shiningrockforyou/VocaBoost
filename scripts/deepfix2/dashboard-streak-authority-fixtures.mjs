#!/usr/bin/env node
/**
 * ============================================================================
 * DASHBOARD-STREAK-AUTHORITY (NTF-25) — PURE fixtures (no Firebase, no network)
 * ============================================================================
 * Exercises the REAL `src/utils/streakAuthority.js` (the pure R2-21 walk) and
 * `src/services/streakCredits.js` (the read orchestration, via its injectable
 * `fetchDocsFn` — no live Firestore needed for THIS half), plus STATIC
 * source-text anchors proving flag-off parity (C2) and the account-wide
 * read-only contract (C3's structural half). The emulator-backed half of A2/
 * C3/C5 (the REAL query against seeded credits) lives in
 * `dashboard-streak-authority-emulator.mjs` — see that file's header for why
 * it needs an emulator and what it proves that this file cannot.
 *
 *   C1   the DERIVATION bypass set (all pure, hand-fed date arrays):
 *        fresh (credits through today) · broken (a gap, stops there, not 0) ·
 *        weekend-gap (Fri→Mon, no credit needed, continues) · stale (no
 *        recent credit ⇒ freshness gate ⇒ 0) · empty (⇒ 0) · a two-list
 *        student's merged date list ⇒ ONE account-wide number (the pure
 *        walk is list-blind BY CONSTRUCTION — it never receives
 *        classId/listId at all; see streakCredits.js/the emulator file for
 *        the read-layer proof C5's mutant actually targets) · kstDateString
 *        KST-boundary (15:00 UTC crosses into the next KST date).
 *   A2   fetchAccountStreak's ORCHESTRATION contract via an injected
 *        fetchDocsFn (no live Firestore): drops classId/listId before
 *        deriving, threads `now`, and (the C5 rehearsal) a two-list mock doc
 *        set still derives ONE account-wide number.
 *   C3   READ-ONLY structural half: streakCredits.js imports NO Firestore
 *        write verb (setDoc/updateDoc/addDoc/deleteDoc/writeBatch/
 *        runTransaction) — grep its own import list. (The behavioral half —
 *        doc count unchanged after a REAL read — is in the emulator file.)
 *   C2   FLAG-OFF PARITY static anchors on Dashboard.jsx: calculateStreak's
 *        function body byte-identical to HEAD; the legacy expression
 *        `progress.streakDays ?? calculateStreak(...)` present verbatim
 *        (now the ternary's false-branch); the branch head
 *        `REVIEW_V2_CLIENT ? serverStreak : (...)`; both render sites
 *        (`streakDays}-day streak`, `{streakDays} <span...days</span>`)
 *        present; the three `streakDays: 0,` early-return branches (V4:
 *        :1369/:1384/:1412 in the ORIGINAL ledger numbering) present exactly
 *        3 times and untouched; the destructure line byte-identical to HEAD.
 *        Also: the other 2 streakDays writers (progressService.js,
 *        foundation.js) byte-identical to HEAD (untouched, V4).
 *
 * Run: node scripts/deepfix2/dashboard-streak-authority-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/dashboard-streak-authority-pure.json
 * (DASHBOARD_STREAK_AUTHORITY_PURE_RECEIPT env redirects the receipt for the
 * mutant driver, same audit-fixed idiom as cutover-a-compose-fixtures.mjs.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

import { deriveAccountStreak, kstDateString, ACCOUNT_STREAK_QUERY_LIMIT } from "../../src/utils/streakAuthority.js";
import { fetchAccountStreak } from "../../src/services/streakCredits.js";

let total = 0; let failed = 0; const reds = []; let caseName = "";
const CASE = (n) => { caseName = n; console.log(`\n== CASE ${n}`); };
const check = (name, got, want) => {
  total++;
  const g = JSON.stringify(got); const w = JSON.stringify(want);
  if (g !== w) { failed++; reds.push(`${caseName} :: ${name} — got ${g} want ${w}`); console.error(`  RED ${name}: got ${g} want ${w}`); }
};
const checkTrue = (name, v) => check(name, Boolean(v), true);

// ===========================================================================
CASE("C1 — kstDateString mirrors completion.js's formula at the KST day boundary");
{
  // completion.js:88-90 — new Date(ms + 9*3600000).toISOString().slice(0,10).
  // Independent boundary facts (not derived via the function under test):
  // 14:59:59 UTC + 9h = 23:59:59 UTC (same calendar day); 15:00:00 UTC + 9h =
  // 00:00:00 UTC the NEXT day.
  check("14:59:59Z stays the same KST date", kstDateString(Date.parse("2026-08-04T14:59:59Z")), "2026-08-04");
  check("15:00:00Z rolls into the next KST date", kstDateString(Date.parse("2026-08-04T15:00:00Z")), "2026-08-05");
}

CASE("C1 — FRESH: credits through today (spans a weekend) → derived count");
{
  // Wed 7/29, Thu 7/30, Fri 7/31, [Sat 8/1, Sun 8/2 skipped], Mon 8/3, Tue 8/4 (= "now").
  const credits = ["2026-08-04", "2026-08-03", "2026-07-31", "2026-07-30", "2026-07-29"];
  const streak = deriveAccountStreak(credits, { now: new Date("2026-08-04T03:00:00Z") });
  check("fresh 5-day streak", streak, 5);
}

CASE("C1 — BROKEN: a gap stops the count there (not 0, not the full history)");
{
  // Tue 8/4, Mon 8/3, then a GAP (Thu 7/30 instead of the expected Fri 7/31), Wed 7/29.
  const credits = ["2026-08-04", "2026-08-03", "2026-07-30", "2026-07-29"];
  const streak = deriveAccountStreak(credits, { now: new Date("2026-08-04T03:00:00Z") });
  check("stops at the gap (2), not 0 and not 4", streak, 2);
}

CASE("C1 — WEEKEND-GAP: Fri → Mon needs no credit, the streak continues");
{
  const credits = ["2026-08-03", "2026-07-31"]; // Mon, Fri — no Sat/Sun credit
  const streak = deriveAccountStreak(credits, { now: new Date("2026-08-03T03:00:00Z") });
  check("weekend gap does not break the streak", streak, 2);
}

CASE("C1 — STALE: no recent credit ⇒ freshness gate ⇒ 0 (even with a real internal chain)");
{
  // A genuine 3-day internal chain, ~11 days before "now" — clearly stale.
  const credits = ["2026-07-24", "2026-07-23", "2026-07-22"];
  const streak = deriveAccountStreak(credits, { now: new Date("2026-08-04T03:00:00Z") });
  check("stale streak reports 0", streak, 0);
}

CASE("C1 — EMPTY: no credits → 0");
{
  check("empty ⇒ 0", deriveAccountStreak([], { now: new Date("2026-08-04T03:00:00Z") }), 0);
  check("null-safe ⇒ 0", deriveAccountStreak(null, { now: new Date("2026-08-04T03:00:00Z") }), 0);
}

CASE("C1 — TWO-LIST: the pure walk is list-blind BY CONSTRUCTION");
{
  // Conceptually: Fri 7/31 credited via list B, Mon 8/3 via list A, Tue 8/4 (today)
  // via list B again — deriveAccountStreak never receives classId/listId at all, so
  // feeding it the merged date list (exactly what the account-wide read produces)
  // yields ONE continuous number regardless of which list credited which date.
  const credits = ["2026-08-04", "2026-08-03", "2026-07-31"];
  const streak = deriveAccountStreak(credits, { now: new Date("2026-08-04T03:00:00Z") });
  check("two-list merged date list ⇒ one account-wide number (3)", streak, 3);
}

CASE("A2 — fetchAccountStreak drops classId/listId before deriving (injected fetchDocsFn, no network)");
{
  const fakeDocs = [
    { id: "2026-08-04", classId: "cB", listId: "lB", dayNumber: 9, resetEpoch: 0 },
    { id: "2026-08-03", classId: "cA", listId: "lA", dayNumber: 8, resetEpoch: 0 },
    { id: "2026-07-31", classId: "cB", listId: "lB", dayNumber: 7, resetEpoch: 0 },
  ];
  let calledWith = null;
  const streak = await fetchAccountStreak(null, "u1", {
    now: new Date("2026-08-04T03:00:00Z"),
    fetchDocsFn: async (db, uid) => { calledWith = { db, uid }; return fakeDocs; },
  });
  check("orchestration derives the SAME two-list number (3)", streak, 3);
  check("fetchDocsFn received the uid", calledWith.uid, "u1");
}

CASE("A2 — fetchAccountStreak threads `now` through to the derivation (stale via injection)");
{
  const fakeDocs = [{ id: "2026-07-24", classId: "c1", listId: "l1" }];
  const streak = await fetchAccountStreak(null, "u1", {
    now: new Date("2026-08-04T03:00:00Z"),
    fetchDocsFn: async () => fakeDocs,
  });
  check("stale via injected now ⇒ 0", streak, 0);
}

CASE("C3 — READ-ONLY (structural): streakCredits.js imports NO Firestore write verb");
{
  const src = readFileSync(new URL("../../src/services/streakCredits.js", import.meta.url), "utf8");
  // Check the ACTUAL import statement(s) from 'firebase/firestore', not the whole file — the
  // file's own doc comments legitimately NAME the write verbs as things to avoid, which would
  // false-positive a whole-file substring scan.
  const importLines = src.split("\n").filter((l) => /^import\s.*from\s+['"]firebase\/firestore['"]/.test(l));
  checkTrue("exactly one 'firebase/firestore' import line found", importLines.length === 1);
  const importBlob = importLines.join("\n");
  const writeVerbs = ["setDoc", "updateDoc", "addDoc", "deleteDoc", "writeBatch", "runTransaction", "deleteField"];
  const found = writeVerbs.filter((v) => importBlob.includes(v));
  check("no write verb in the firebase/firestore import", found, []);
  checkTrue("getDocs IS imported (the only read verb this module needs)", importBlob.includes("getDocs"));
}

// ===========================================================================
// C2 — FLAG-OFF PARITY static anchors on Dashboard.jsx (+ the OTHER 2
// streakDays writers, confirmed byte-identical to HEAD / untouched).
// ===========================================================================
const gitShow = (relPath) => execFileSync("git", ["show", `HEAD:${relPath}`], { cwd: "/app", encoding: "utf8" });
const dashSrc = readFileSync("/app/src/pages/Dashboard.jsx", "utf8");
const dashHead = gitShow("src/pages/Dashboard.jsx");

CASE("C2 — calculateStreak function body is BYTE-IDENTICAL to HEAD (untouched)");
{
  const extractFn = (text) => {
    const start = text.indexOf("const calculateStreak = (recentSessions, studyDaysPerWeek) => {");
    const end = text.indexOf("const extractListIdFromTestId = (testId = '') => {");
    checkTrue(`calculateStreak start anchor found`, start !== -1);
    checkTrue(`extractListIdFromTestId end anchor found`, end !== -1);
    return text.slice(start, end);
  };
  const currentFn = extractFn(dashSrc);
  const headFn = extractFn(dashHead);
  check("calculateStreak (+ trailing whitespace to the next fn) byte-identical", currentFn, headFn);
}

CASE("C2 — the legacy expression survives VERBATIM as the ternary's false-branch");
{
  checkTrue("legacy expression present verbatim",
    dashSrc.includes("progress.streakDays ?? calculateStreak(recentSessions, getPrimaryFocus.studyDaysPerWeek || 5)"));
}

CASE("C2 — the branch is add-only: REVIEW_V2_CLIENT ? serverStreak : (legacy)");
{
  checkTrue("ternary head present",
    dashSrc.includes("const streakDays = REVIEW_V2_CLIENT\n        ? serverStreak\n        : (progress.streakDays"));
}

CASE("C2 — both render sites byte-identical (hero pill + stat tile)");
{
  checkTrue("hero pill unchanged", dashSrc.includes('🔥 {streakDays}-day streak'));
  checkTrue("stat tile unchanged",
    dashSrc.includes('{streakDays} <span className="text-base text-text-muted font-semibold">days</span>'));
  // Same two literal substrings exist in HEAD too (proves this isn't a
  // coincidental match against NEW text — the render sites predate this fold).
  checkTrue("hero pill pre-existed at HEAD", dashHead.includes('🔥 {streakDays}-day streak'));
  checkTrue("stat tile pre-existed at HEAD", dashHead.includes('{streakDays} <span className="text-base text-text-muted font-semibold">days</span>'));
}

CASE("C2 — the three streakDays:0 early-return branches are untouched (still exactly 3)");
{
  const count = (s) => (s.match(/streakDays: 0,/g) || []).length;
  check("exactly 3 occurrences of 'streakDays: 0,' (current)", count(dashSrc), 3);
  check("exactly 3 occurrences of 'streakDays: 0,' (HEAD)", count(dashHead), 3);
}

CASE("C2 — the panelBState destructure line is BYTE-IDENTICAL to HEAD");
{
  const line = "const { totalWordsIntroduced, masteryRate, streakDays, error: panelBError, loading: panelBLoading } = panelBState";
  checkTrue("destructure line present, current", dashSrc.includes(line));
  checkTrue("destructure line present, HEAD", dashHead.includes(line));
}

CASE("C2 — the OTHER 2 streakDays writers are byte-identical to HEAD (out of scope, V4)");
{
  for (const relPath of ["src/services/progressService.js", "functions/foundation.js"]) {
    const cur = readFileSync(`/app/${relPath}`, "utf8");
    const head = gitShow(relPath);
    check(`${relPath} untouched`, sha16Str(cur), sha16Str(head));
  }
}
function sha16Str(s) { return createHash("sha256").update(s).digest("hex").slice(0, 16); }

// ===========================================================================
const evidencePath = process.env.DASHBOARD_STREAK_AUTHORITY_PURE_RECEIPT
  ? new URL(`file://${process.env.DASHBOARD_STREAK_AUTHORITY_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/dashboard-streak-authority-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "dashboard-streak-authority-pure",
  pass: failed === 0,
  total, failed, reds,
  constants: { ACCOUNT_STREAK_QUERY_LIMIT },
  sourceShas: {
    "src/utils/streakAuthority.js": sha16("../../src/utils/streakAuthority.js"),
    "src/services/streakCredits.js": sha16("../../src/services/streakCredits.js"),
    "src/pages/Dashboard.jsx": sha16("../../src/pages/Dashboard.jsx"),
    "scripts/deepfix2/dashboard-streak-authority-fixtures.mjs": sha16("./dashboard-streak-authority-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ndashboard-streak-authority PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
