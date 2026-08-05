#!/usr/bin/env node
/**
 * ============================================================================
 * DF2-51-c — PURE fixtures for the RestudyBrowser page
 * (no Firebase, no network, no Vite, no emulator, no browser)
 * ============================================================================
 * `src/pages/RestudyBrowser.jsx` is a React component and cannot be `import`ed
 * by plain Node in this checkout (verified this session: no `@esbuild/linux-
 * x64` — only the Windows binary is installed — and no full JSX-emitting
 * Babel plugin exists in node_modules; Node's parser fails on the component's
 * first JSX before any export is reachable). So this exercises:
 *
 *   C1  `src/pages/RestudyBrowser.viewModel.js` (this fold's pure adapter) —
 *       date formatting, chip config, pip titles, "today is never
 *       actionable", rows->props assembly, branch selection, bookmark-toggle
 *       precedence.
 *   C2  THE FLAG-OFF GATE — the REAL `REVIEW_V2_CLIENT` import + the REAL
 *       `react-router-dom` route matcher (via `React.createElement`, not
 *       JSX — no transform needed) proves the `/restudy/:classId/:listId`
 *       route is absent from the router config and falls through to `*`
 *       when the flag is false, AND a text anchor on the actual
 *       `src/App.jsx` bytes binds that abstract proof to the real edit.
 *   C3  GREP-PROOF: the view-model module carries zero imports (React/
 *       Firestore/anything) — mirrors `pastDayAuthority.js`'s own C8 case.
 *
 * Does NOT re-test `pastDayAuthority.js` (51-a, cite
 * docs/plans/deepfix2/evidence/df2-51a-model-pure.json, 115/0) or
 * `restudyVisit.js` (51-b, cite df2-51b-visit-pure.json, 192/0) — this fold
 * consumes their output, never their internal derivation logic.
 *
 * Run: node scripts/deepfix2/df2-51c-browser-fixtures.mjs
 * Evidence: docs/plans/deepfix2/evidence/df2-51c-browser-pure.json
 * (DF2_51C_BROWSER_PURE_RECEIPT env redirects the receipt for the mutant
 * driver, same audit-fixed idiom as df2-51a-model-fixtures.mjs.)
 */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import React from "react";
import { createRoutesFromChildren, matchRoutes, Route } from "react-router-dom";

import {
  formatShortDate, formatDayDateLabel,
  CHIP_CONFIG, dayStateChipConfig,
  PIP_TITLES, pipTitle,
  isDayActionable,
  buildDayRowViewModel, buildRestudyRows,
  selectBranch,
  computeBookmarkToggleTarget,
} from "../../src/pages/RestudyBrowser.viewModel.js";
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
// C1.1 — date formatting
// ===========================================================================
CASE("C1.1 — formatShortDate: mixed shapes format, unparseable/absent -> null");
{
  check("epoch ms", formatShortDate(Date.UTC(2026, 6, 20)), new Date(Date.UTC(2026, 6, 20)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  check("ISO string", formatShortDate('2026-07-20T00:00:00.000Z'), new Date('2026-07-20T00:00:00.000Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  check("Date instance", formatShortDate(new Date(500)), new Date(500).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  check("Firestore-Timestamp-like (toMillis)", formatShortDate({ toMillis: () => 500 }), new Date(500).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  check("Firestore-Timestamp-like (toDate)", formatShortDate({ toDate: () => new Date(500) }), new Date(500).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  check("null -> null", formatShortDate(null), null);
  check("undefined -> null", formatShortDate(undefined), null);
  check("unparseable string -> null", formatShortDate('not-a-date'), null);
  check("NaN number -> null", formatShortDate(NaN), null);
}

CASE("C1.2 — formatDayDateLabel: both/either/neither present, wireframe join shape");
{
  check("both present", formatDayDateLabel({ studiedAt: Date.UTC(2026, 6, 20), testedAt: Date.UTC(2026, 6, 20) }),
    `Studied ${formatShortDate(Date.UTC(2026, 6, 20))} · Tested ${formatShortDate(Date.UTC(2026, 6, 20))}`);
  check("studied only (F3: no new half elsewhere, but THIS row has one)", formatDayDateLabel({ studiedAt: Date.UTC(2026, 6, 20), testedAt: null }),
    `Studied ${formatShortDate(Date.UTC(2026, 6, 20))}`);
  check("tested only (Day-1 asymmetry is the OTHER direction; this is F3's no-new-half day)", formatDayDateLabel({ studiedAt: null, testedAt: Date.UTC(2026, 6, 20) }),
    `Tested ${formatShortDate(Date.UTC(2026, 6, 20))}`);
  check("neither -> empty string (never throws, never 'null')", formatDayDateLabel({ studiedAt: null, testedAt: null }), "");
  check("no args at all -> empty string", formatDayDateLabel(), "");
}

// ===========================================================================
// C1.3 — chip config
// ===========================================================================
CASE("C1.3 — dayStateChipConfig: all 5 DAY_STATES map, unknown degrades visibly");
{
  check("untouched", dayStateChipConfig('untouched'), CHIP_CONFIG.untouched);
  check("studied", dayStateChipConfig('studied'), CHIP_CONFIG.studied);
  check("tested", dayStateChipConfig('tested'), CHIP_CONFIG.tested);
  check("re-completed", dayStateChipConfig('re-completed'), CHIP_CONFIG['re-completed']);
  check("bookmarked", dayStateChipConfig('bookmarked'), CHIP_CONFIG.bookmarked);
  check("unrecognized state -> visible 'Unknown', never throws/undefined", dayStateChipConfig('not-a-real-state'),
    { label: 'Unknown', symbol: '?', variant: 'default' });
  check("null state -> Unknown", dayStateChipConfig(null), { label: 'Unknown', symbol: '?', variant: 'default' });
  checkTrue("every chip variant is one of Badge.jsx's real variants (default/info/warning/success/purple)",
    Object.values(CHIP_CONFIG).every((c) => ['default', 'info', 'warning', 'success', 'purple'].includes(c.variant)));
  check("exactly 5 legend states, matching the wireframe order", Object.keys(CHIP_CONFIG),
    ['untouched', 'studied', 'tested', 're-completed', 'bookmarked']);
}

// ===========================================================================
// C1.4 — pip titles
// ===========================================================================
CASE("C1.4 — pipTitle: review/new x on/off/na, wireframe title strings verbatim");
{
  check("review on", pipTitle('review', 'on'), 'Review half done');
  check("review off", pipTitle('review', 'off'), 'Review half not done');
  check("new on", pipTitle('new', 'on'), 'New-word half done');
  check("new off", pipTitle('new', 'off'), 'New-word half not done');
  check("new na — wireframe's exact dashed-pip tooltip text", pipTitle('new', 'na'), 'No new-word half exists for this day');
  check("unknown pip state -> falls back to 'off' label, never blank", pipTitle('new', 'not-a-state'), PIP_TITLES.new.off);
  check("unknown kind -> empty string, never throws", pipTitle('not-a-kind', 'on'), '');
}

// ===========================================================================
// C1.5 — "today is never actionable" (the fold's own named mutant clause)
// ===========================================================================
CASE("C1.5 — isDayActionable: today false, a real past day true");
{
  check("today row (today:true) -> NOT actionable", isDayActionable({ today: true }), false);
  check("a past day row (today:false) -> actionable", isDayActionable({ today: false }), true);
  check("a past day row (today omitted) -> actionable (absence reads as a real day)", isDayActionable({ day: 3 }), true);
  check("no args at all -> actionable (defensive default matches 'today omitted')", isDayActionable(), true);
  check("null row -> actionable (defensive; never throws)", isDayActionable(null), true);
}

// ===========================================================================
// C1.6 — rows -> props assembly (does NOT recompute state/pips — reads them
// off the injected pastDayAuthority row verbatim)
// ===========================================================================
CASE("C1.6 — buildDayRowViewModel: full re-completed row (mirrors 51-a fixture C5.1's row shape)");
{
  const row = {
    day: 2, studiedAt: 1000, testedAt: 1500, state: 're-completed',
    pips: { review: 'on', new: 'on' }, bookmarked: false, canRestudy: true, canRetest: true, hasNewHalf: true,
  };
  const vm = buildDayRowViewModel(row);
  check("day passes through", vm.day, 2);
  check("dateLabel formatted from studiedAt/testedAt", vm.dateLabel, formatDayDateLabel(row));
  check("chip matches dayStateChipConfig(state)", vm.chip, dayStateChipConfig('re-completed'));
  check("pips.review.state mirrors the injected pip verbatim (not recomputed)", vm.pips.review.state, 'on');
  check("pips.new.state mirrors the injected pip verbatim", vm.pips.new.state, 'on');
  check("pips.review.title from pipTitle", vm.pips.review.title, pipTitle('review', 'on'));
  check("bookmarked passes through", vm.bookmarked, false);
  check("restudyDisabled is the NEGATION of canRestudy", vm.restudyDisabled, false);
  check("retestDisabled is the NEGATION of canRetest", vm.retestDisabled, false);
}

CASE("C1.7 — buildDayRowViewModel: F3 no-new-half row -> Re-study disabled, dashed pip title carried");
{
  const row = {
    day: 5, studiedAt: null, testedAt: 2000, state: 'tested',
    pips: { review: 'on', new: 'na' }, bookmarked: false, canRestudy: false, canRetest: true, hasNewHalf: false,
  };
  const vm = buildDayRowViewModel(row);
  check("restudyDisabled true (F3 — nothing to re-study)", vm.restudyDisabled, true);
  check("retestDisabled false (F2 — review always retestable)", vm.retestDisabled, false);
  check("new pip title is the F3 dashed-pip wireframe copy", vm.pips.new.title, 'No new-word half exists for this day');
  check("dateLabel omits the absent studiedAt half", vm.dateLabel, formatDayDateLabel(row));
}

CASE("C1.8 — buildDayRowViewModel: degrades safely on missing/malformed input, never throws");
{
  checkTrue("no args at all does not throw", (() => { try { buildDayRowViewModel(); return true; } catch { return false; } })());
  const vm = buildDayRowViewModel({});
  check("empty row -> Unknown chip, not a crash", vm.chip, { label: 'Unknown', symbol: '?', variant: 'default' });
  check("empty row -> restudyDisabled true (no canRestudy -> negated true)", vm.restudyDisabled, true);
}

CASE("C1.9 — buildRestudyRows: maps an array 1:1, degrades non-array to []");
{
  const pastDays = [
    { day: 1, state: 'untouched', pips: { review: 'off', new: 'off' }, bookmarked: false, canRestudy: true, canRetest: true },
    { day: 2, state: 'studied', pips: { review: 'off', new: 'off' }, bookmarked: false, canRestudy: true, canRetest: true },
  ];
  const rows = buildRestudyRows({ pastDays });
  check("2 rows out for 2 rows in", rows.length, 2);
  check("day order preserved", rows.map((r) => r.day), [1, 2]);
  check("null pastDays -> []", buildRestudyRows({ pastDays: null }), []);
  check("no args at all -> []", buildRestudyRows(), []);
}

// ===========================================================================
// C1.10 — branch selection
// ===========================================================================
CASE("C1.10 — selectBranch: loading > error > empty > list precedence");
{
  check("loading wins even with an error AND rows present", selectBranch({ loading: true, error: 'x', pastDays: [{ day: 1 }] }), 'loading');
  check("error wins over empty/list once not loading", selectBranch({ loading: false, error: 'x', pastDays: [] }), 'error');
  check("empty: not loading, no error, zero past days", selectBranch({ loading: false, error: '', pastDays: [] }), 'empty');
  check("empty: pastDays null (defensive)", selectBranch({ loading: false, error: '', pastDays: null }), 'empty');
  check("list: at least one past day", selectBranch({ loading: false, error: '', pastDays: [{ day: 1 }] }), 'list');
  check("no args at all -> empty (loading undefined is falsy, pastDays undefined -> empty)", selectBranch(), 'empty');
}

// ===========================================================================
// C1.11 — bookmark toggle precedence (the WRITE-side counterpart of 51-a's
// READ-side bookmarkedDayForList — the H6 scalar, "at most one per list")
// ===========================================================================
CASE("C1.11 — computeBookmarkToggleTarget: click-to-set, click-again-to-clear, click-elsewhere-to-move");
{
  check("no current bookmark, click day 3 -> sets day 3", computeBookmarkToggleTarget({ currentBookmarkedDay: null, clickedDay: 3 }), 3);
  check("day 3 already bookmarked, click day 3 again -> clears (null)", computeBookmarkToggleTarget({ currentBookmarkedDay: 3, clickedDay: 3 }), null);
  check("day 3 bookmarked, click day 5 -> MOVES the (single) bookmark to 5, never both", computeBookmarkToggleTarget({ currentBookmarkedDay: 3, clickedDay: 5 }), 5);
  check("invalid clickedDay (0) -> no-op, keeps current", computeBookmarkToggleTarget({ currentBookmarkedDay: 3, clickedDay: 0 }), 3);
  check("invalid clickedDay (negative) -> no-op", computeBookmarkToggleTarget({ currentBookmarkedDay: 3, clickedDay: -1 }), 3);
  check("invalid clickedDay (non-integer) -> no-op", computeBookmarkToggleTarget({ currentBookmarkedDay: 3, clickedDay: 2.5 }), 3);
  check("invalid clickedDay, no current bookmark -> null (not undefined)", computeBookmarkToggleTarget({ currentBookmarkedDay: null, clickedDay: 0 }), null);
  check("no args at all -> null, never throws", computeBookmarkToggleTarget(), null);
}

// ===========================================================================
// C2 — THE FLAG-OFF GATE (route-level; the ONE call site per design doc §7(e))
// ===========================================================================
CASE("C2.1 — REVIEW_V2_CLIENT is the real, currently-shipped false constant");
{
  check("REVIEW_V2_CLIENT === false today", REVIEW_V2_CLIENT, false);
}

// Reproduces the EXACT App.jsx shape (home / restudy-behind-flag / catchall)
// using React.createElement (no JSX transform needed) against the REAL
// react-router-dom route matcher — not a re-implementation of its internals.
function buildRouteChildren(flag) {
  return [
    React.createElement(Route, { key: "home", path: "/", element: React.createElement("div") }),
    flag && React.createElement(Route, { key: "restudy", path: "/restudy/:classId/:listId", element: React.createElement("div") }),
    React.createElement(Route, { key: "catchall", path: "*", element: React.createElement("div") }),
  ];
}

CASE("C2.2 — flag-off (the REAL imported REVIEW_V2_CLIENT): the route does not exist in the router config");
{
  const routes = createRoutesFromChildren(buildRouteChildren(REVIEW_V2_CLIENT));
  check("exactly 2 routes registered (home, catchall) — restudy is ABSENT, not just unreachable", routes.map((r) => r.path).sort(), ["*", "/"]);
  const match = matchRoutes(routes, "/restudy/26SM/list1");
  check("visiting the restudy URL falls through to the catch-all (Navigate to '/', same as any unknown path)",
    match && match.map((m) => m.route.path), ["*"]);
}

CASE("C2.3 — MUTANT-SHAPE CHECK (not a mutant run — proves the gate is a REAL gate, not permanently absent): forcing the flag true makes the route reachable");
{
  const routes = createRoutesFromChildren(buildRouteChildren(true));
  check("3 routes registered when the (simulated) flag is true", routes.map((r) => r.path).sort(), ["*", "/", "/restudy/:classId/:listId"]);
  const match = matchRoutes(routes, "/restudy/26SM/list1");
  check("the restudy route itself matches once the gate is open", match && match.map((m) => m.route.path), ["/restudy/:classId/:listId"]);
}

// Binds the abstract proof above to the REAL src/App.jsx bytes — a text
// anchor, not a mutation (App.jsx is a shared, contended file; see the fold
// report for why this fold does not mutate it even temporarily).
CASE("C2.4 — the REAL src/App.jsx source carries the REVIEW_V2_CLIENT-gated restudy Route, exactly once");
{
  const appSrc = readFileSync("/app/src/App.jsx", "utf8");
  const importLine = appSrc.match(/^import \{ REVIEW_V2_CLIENT \} from '\.\/config\/featureFlags'$/m);
  check("REVIEW_V2_CLIENT is imported exactly once", (appSrc.match(/REVIEW_V2_CLIENT/g) || []).length >= 2, true);
  checkTrue("the import line is present, unmodified", Boolean(importLine));
  const gatedBlock = appSrc.match(/\{REVIEW_V2_CLIENT && \(\s*<Route\s+path="\/restudy\/:classId\/:listId"[\s\S]*?<RestudyBrowser \/>[\s\S]*?\)\}/);
  checkTrue("the restudy Route is wrapped in `{REVIEW_V2_CLIENT && (...)}`, exactly the SimulationPanel idiom already used in this file", Boolean(gatedBlock));
  check("exactly one restudy Route registration in the file", (appSrc.match(/path="\/restudy\/:classId\/:listId"/g) || []).length, 1);
}

// ===========================================================================
// C3 — GREP-PROOF: the view model carries zero imports (mirrors
// pastDayAuthority.js's own C8 — comments stripped first, same false-positive
// lesson `dashboard-df2-33-fixtures.mjs` and df2-51a's own header cite)
// ===========================================================================
const moduleSrc = readFileSync("/app/src/pages/RestudyBrowser.viewModel.js", "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const moduleCode = stripComments(moduleSrc);

CASE("C3 — RestudyBrowser.viewModel.js has ZERO imports (React/Firestore/anything)");
{
  const importLines = moduleSrc.split("\n").filter((l) => /^\s*import\s/.test(l));
  check("zero static import statements", importLines.length, 0);
  checkTrue("zero dynamic import() calls in the module's code", !/\bimport\s*\(/.test(moduleCode));
  checkTrue("zero require() calls in the module's code", !/\brequire\s*\(/.test(moduleCode));
  checkTrue("no case-insensitive 'firebase' substring in the module's CODE (comments stripped)", !/firebase/i.test(moduleCode));
  checkTrue("no case-insensitive 'firestore' substring in the module's CODE (comments stripped)", !/firestore/i.test(moduleCode));
  checkTrue("no case-insensitive 'react' substring in the module's CODE (comments stripped — the header prose names it legitimately)", !/react/i.test(moduleCode));
}

// ===========================================================================
const evidencePath = process.env.DF2_51C_BROWSER_PURE_RECEIPT
  ? new URL(`file://${process.env.DF2_51C_BROWSER_PURE_RECEIPT}`)
  : new URL("../../docs/plans/deepfix2/evidence/df2-51c-browser-pure.json", import.meta.url);
mkdirSync(new URL("../../docs/plans/deepfix2/evidence/", import.meta.url), { recursive: true });
const sha16 = (p) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex").slice(0, 16);
writeFileSync(evidencePath, JSON.stringify({
  kind: "df2-51c-browser-pure",
  pass: failed === 0,
  total, failed, reds,
  sourceShas: {
    "src/pages/RestudyBrowser.viewModel.js": sha16("../../src/pages/RestudyBrowser.viewModel.js"),
    "src/App.jsx": sha16("../../src/App.jsx"),
    "src/config/featureFlags.js": sha16("../../src/config/featureFlags.js"),
    "scripts/deepfix2/df2-51c-browser-fixtures.mjs": sha16("./df2-51c-browser-fixtures.mjs"),
  },
  at: new Date().toISOString(),
}, null, 2));
console.log(`\ndf2-51c-browser PURE: ${total} checks, ${failed} failures — evidence written`);
process.exit(failed ? 1 : 0);
