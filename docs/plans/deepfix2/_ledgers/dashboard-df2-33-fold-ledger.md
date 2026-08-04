# DASHBOARD-DF2-33 — FOLD LEDGER (Dashboard one-affordance: hero + per-list on ONE derivation)

Built from `_ledgers/dashboard-df2-33-BRIEF.md` (2026-08-04, file:line throughout, re-verified against the
live tree — the brief itself warns line numbers drift). Behind `REVIEW_V2_CLIENT` (still `false`), both the
Dashboard hero (Panel C) and each per-list `ListProgressStats` row derive their "Day N" number (hero also:
phase/doneToday) from ONE new pure module, `src/utils/dayStatusAuthority.js`, instead of two divergent inline
expressions. Flag-off: byte-identical BEHAVIOR (legacy expressions untouched inside the ternaries).

Predecessor: `dashboard-streak-authority` (committed `f60ebf7`) — its ledger's GROUP E row E1 ("the
account-wide-vs-per-list PRESENTATION unification → `dashboard-df2-33`") is what THIS fold closes.
`NEED_TO_FIX.md:101/106` and `WORK_QUEUE.md:38` already name df2-33 as the pending closer — this ledger does
not re-edit those docs (out of this fold's touch-list; the orchestrator folds this report into them).

## ORCHESTRATOR DECISIONS (recorded in the BRIEF; implemented here, not re-litigated)
1. READ-ONLY, dashboard-local, pure module — zero Firestore verbs, all inputs injected. `deriveSessionState`
   (DF2-20) absorbs this module later — noted as a follow-on in the module header only, not built toward.
2. Streak stays hero-only, account-wide (landed in `dashboard-streak-authority`) — nothing here touches
   streak code or adds a per-list streak.
3. No new per-list markers flag-on — `ListProgressStats` rows change ONLY the number feeding the existing
   "Day N" badge (+ its ahead/behind inputs). No done-today ticks, no phase chips on rows.
4. `determineStartingPhase` stays the phase oracle on both flag legs — this fold changes WHO CONSUMES it
   (injected as `phaseOracle`), not what it computes (`services/studyService.js` is NOT touched).

## GROUP V — VERIFY BEFORE EDITING (re-verified against the live tree, not the brief's own line numbers)
[x] V1  **The hero disease, exact citation.** `panelCState` useMemo `src/pages/Dashboard.jsx:1628-1685`.
        Non-demoting max `:1656-1662`: `resolvedMatchesFocus = SERVER_PROGRESS_WRITE && resolvedFocusCsd &&
        resolvedFocusCsd.classId === getPrimaryFocus.classId && resolvedFocusCsd.listId === getPrimaryFocus.id`
        then `currentStudyDay = resolvedMatchesFocus ? Math.max(resolvedFocusCsd.csd, progress?.currentStudyDay
        ?? 0) : (progress?.currentStudyDay ?? 0)`. Attempts filter `:1667-1669`: `(userAttempts ||
        []).filter((a) => a.classId === getPrimaryFocus.classId && a.listId === getPrimaryFocus.id)`. Phase
        `:1670`: `determineStartingPhase(listAttempts, currentStudyDay + 1).phase`. Downstream renders (`day`
        `:1788`, `phase` `:1790`, `reviewStage`/`doneToday` `:1791-1792`) all read `panelCState.*` — NO
        separate edit needed there; routing inside the memo flows through automatically (grep-confirmed only
        2 other `panelCState` consumers: `:1753` `heroLoading`, and `:1788/1790` — both downstream reads).
[x] V2  **The per-list disease, exact citation.** `ListProgressStats(:177-227)`: `completedDays =
        progress?.currentStudyDay ?? 0` (`:192`, RAW doc only — no attempts, no reconciliation), `displayDay =
        completedDays + 1` (`:204`), ahead/behind (`difference`/`isAhead`/`isBehind`/`isOnTrack`, `:197-200`)
        derived from the same raw `completedDays`. Call site `:2198-2203`: only `classId`/`listId`/
        `progressData`/`assignment` passed today — no `userAttempts`/`resolvedFocusCsd`, confirming the
        component currently has no way to reconcile even if it wanted to.
[x] V3  **`resolvedFocusCsd` can only be non-null while `SERVER_PROGRESS_WRITE` is true** (so `csdForRow`
        does not need to re-check that flag — the value it receives already encodes it). `grep -n
        "setResolvedFocusCsd" src/pages/Dashboard.jsx` → exactly 4 lines: the `useState(null)` declaration
        (`:1292`) and 3 setter calls (`:1296`,`:1307`,`:1313`), ALL three inside the `useEffect` that starts
        `if (!SERVER_PROGRESS_WRITE) return undefined` (`:1294`) — no other setter exists anywhere in the
        file. Therefore when `SERVER_PROGRESS_WRITE` is false the effect returns before any setter runs and
        `resolvedFocusCsd` stays at its initial `null` for the component's life; when true, `resolvedFocusCsd`
        is either `null` (loading/error, `:1296`/`:1313`) or `{classId, listId, csd}` with `csd` asserted
        `Number.isInteger` (`:1307`) — never a bare number/NaN. Truth table (composition `csdForRow` +
        the module's `Math.max(resolvedCsd ?? 0, ...)` vs. the original combined expression), all 4
        reachable states match exactly (`currentStudyDay` domain is always `>= 0`, matching the pre-existing
        assumption at `ListProgressStats:204`'s unguarded `completedDays + 1`, so `Math.max(0, x) === x`):
          a. flag/resolution absent (`SERVER_PROGRESS_WRITE` false, OR true-but-no-resolution yet) →
             original: raw. `csdForRow` returns null (guard fails) → module: `max(0, raw) = raw`. MATCH.
          b. `resolvedFocusCsd` present, WRONG class/list (stale from a prior focus) →
             original: raw (guard fails on class/list mismatch). `csdForRow` null (same mismatch) → raw. MATCH.
          c. `resolvedFocusCsd` present, MATCHES → original: `max(resolvedFocusCsd.csd, raw)`. `csdForRow`
             returns `resolvedFocusCsd.csd` → module: `max(csd, raw)`. MATCH.
          d. `progress` itself null/undefined (new user) → both sides `?? 0`, identical either way.
[x] V4  **`determineStartingPhase` has REAL side effects — the ternary MUST be genuinely lazy (one call per
        render, chosen by the flag), not "compute-both-then-pick".** `services/studyService.js:228-329`:
        `console.log`/`console.warn` spam on every call (`:229-231` etc.), AND on the day-1-passed
        "impossible state" branch, `logSystemEvent('impossible_phase_detected', {...})` (`:298`) which is a
        REAL FIRESTORE WRITE (`services/db.js:105-117` → `addDoc(collection(db, 'system_logs'), {...})`).
        Calling it from BOTH an unconditionally-evaluated legacy block AND the new derivation would risk a
        SECOND `system_logs` write per render in that edge case — a new behavior, and a violation of "no new
        Firestore writes". CONSEQUENCE: the hero's ternary false-branch must be an IIFE (`(() =>
        {...})()`), not a pair of already-computed values selected after the fact, so only the CHOSEN
        branch's statements execute (JS ternaries short-circuit; the codebase already uses this exact
        arrow-IIFE idiom at `:1749` for the whole hero render). For `ListProgressStats`, this is why
        `attempts: null` must mean "`phaseOracle` is never invoked" (not "invoked, result discarded") — a row
        renders ONCE PER LIST, so an unconditional call there would multiply the side effect by row count.
        Also confirmed (for the module's docstring + fixture #7): `node --input-type=module -e
        "import('/app/src/services/studyService.js').then(...).catch(e=>console.log(e.message))"` →
        `Cannot find module '/app/src/firebase'` (Node ESM requires explicit extensions on relative
        specifiers; Vite tolerates the extensionless `../firebase` this codebase uses throughout — same
        precedent `streakAuthority.js`'s header already documents for `../firebase.js` generally).
[x] V5  **Streak code is untouched by construction — disjoint line ranges.** `calculateStreak` `:42-132`,
        `panelBState` (the streak-consuming memo) `:1393-1463`, both streak render sites (`:1809` pill,
        `:1937` tile per the streak ledger — re-grepped: `🔥 {streakDays}-day streak` and `{streakDays}
        <span...days` both present, count 1 each). This fold's two edit sites are `panelCState` (`:1628-1685`)
        and `ListProgressStats` (`:177-227`) plus its call site (`:2198-2203`) — ZERO overlap with the streak
        ranges. `REVIEW_V2_CLIENT` is already imported (`:24`, landed by the streak fold) — no new import of
        the flag itself needed, only of the new module.
[x] V6  **Flag defaults, unchanged by this fold.** `config/featureFlags.js:243` `REVIEW_V2_CLIENT = false`;
        `:77` `SERVER_PROGRESS_WRITE = true` (independent flag, already on — not gated by df2-33, not
        touched). Neither value is edited by this fold (hard constraint: no feature-flag VALUE change).
[x] V7  **No other Dashboard site derives a day number or done-state (the brief's falsification grep).**
        Baseline `grep -n "currentStudyDay + 1"` (exact literal) → 2 hits pre-edit: `:202` (a COMMENT) and
        `:1670` (the real legacy expression, inside what becomes the hero's IIFE). `grep -n "phase ==="` → 2
        hits, both downstream renders (`:1791`/`:1792`), already covered by V1's "no separate edit needed"
        finding. Two OTHER `currentStudyDay` reads surveyed and confirmed OUT OF SCOPE (not a day-number/
        done-state display): (a) `handleStartSession`'s re-entry-guard `lastCompletedDay` (`:850`) — feeds
        `shouldShowReEntryModal`, a session-flow gate, not a rendered "Day N"/done chip; (b)
        `getPrimaryFocus`'s progress-candidate ranking (`:1235/:1240`) and `pickPrimaryList`'s ranking
        (`:1347/:1351`) — `currentStudyDay` used only as a SORT KEY to choose which class/list is "primary
        focus", never displayed. Neither routed (decision 3: no new markers; these aren't the "Day N" badge
        or a done-state at all).

## GROUP A — DELTAS
[x] A1  New pure module `src/utils/dayStatusAuthority.js`: `deriveListDayStatus({ progress, attempts,
        resolvedCsd, phaseOracle })` → `{ currentStudyDay, displayDay, phase, doneToday }`, plus
        `attemptsForList(attempts, classId, listId)` and `csdForRow(resolvedFocusCsd, classId, listId)`
        (the two shared predicates, V1/V3's exact filters/guard given one home). Zero imports, zero
        Firestore verbs (V4/decision 1).
        BYPASS SET (one fixture per case, brief's enumerated 7 + predicate sub-cases):
          non-demoting (raw 3/resolved 5 → 5,6) · never-demote (raw 5/resolved 4 → 5,6) · resolved
          null/undefined → raw (+ progress null → 0,1) · `attempts: null` → phase/doneToday null AND
          `phaseOracle` never invoked (call-counted, not just result-discarded) · `attempts: []` computes
          normally (oracle IS invoked) · stub-oracle passthrough (`complete`→doneToday true,
          other→doneToday false, exact `(attempts, displayDay)` call args) · `attemptsForList`
          class+list exact filter (+ null/undefined → `[]`) · `csdForRow` match/classId-mismatch/
          listId-mismatch/null-input → csd/null/null/null · REAL `determineStartingPhase` integration
          fixture: ATTEMPTED under plain node, see C-group finding (deferred to rehearsal per the brief's
          own escape hatch — V4 reproduces the exact reason it cannot load).
        DONE: `src/utils/dayStatusAuthority.js` — `npx eslint src/utils/dayStatusAuthority.js` clean (exit
        0, zero problems). Fixtures: `scripts/deepfix2/dashboard-df2-33-fixtures.mjs`, evidence
        `docs/plans/deepfix2/evidence/dashboard-df2-33-pure.json` — 71/0 (all C1/C2/C3 cases combined; see
        A2/A3/C1-C3 below for the per-group breakdown, all numbers read from that one evidence file).
        Case 7 (real-oracle integration): ATTEMPTED (`await import(".../studyService.js")`), confirmed
        it cannot load under plain node — evidence `realOracleImport: {attempted:true, loaded:false,
        error:"Cannot find module '/app/src/firebase' imported from /app/src/services/studyService.js"}`
        — DEFERRED to the rehearsal per the brief's own escape hatch, NOT counted as a failure.
[x] A2  Hero (`panelCState`) routed: `REVIEW_V2_CLIENT ? deriveListDayStatus({progress, attempts:
        attemptsForList(userAttempts, getPrimaryFocus.classId, getPrimaryFocus.id), resolvedCsd:
        csdForRow(resolvedFocusCsd, getPrimaryFocus.classId, getPrimaryFocus.id), phaseOracle:
        determineStartingPhase}) : (() => { <V1's exact legacy statements, untouched> })()`. Downstream
        `day`/`phase`/`doneToday`/`reviewStage` (`:1788-1792`) need NO edit (V1).
        OTHER LEG (flag-off): the legacy 4-statement sequence survives verbatim inside the IIFE body
        (substring-checked in the C2 fixture case, not a whole-region diff — re-indentation is
        cosmetic-only; V4 already established the IIFE wrapper is structurally required for laziness,
        not a rewrite of the statements themselves).
        DONE: `src/pages/Dashboard.jsx` panelCState memo — import `:24-28`, ternary `:1671-1708`
        (`dayStatus` decl `:1678`, true-branch `:1679-1684`, false-branch IIFE `:1685-1708`), consuming
        `return { currentStudyDay: dayStatus.currentStudyDay, phase: dayStatus.phase, error: false }`
        immediately after. Downstream render (`day`/`phase`/`doneToday`/`reviewStage`) re-grepped
        post-edit at its new absolute lines (file grew net +40 lines from this whole fold; the RELATIVE
        structure V1 described — 2 other `panelCState` consumers, no separate edit needed — re-confirmed
        unchanged by re-running the same `grep -n "panelCState"` V1 used). Fixture case: C2 in
        `scripts/deepfix2/dashboard-df2-33-fixtures.mjs` (all substring checks green in the 71/0 run).
[x] A3  `ListProgressStats` routed: new props `userAttempts`, `resolvedFocusCsd` (parent passes state it
        already holds — no new reads). `completedDays = REVIEW_V2_CLIENT ? deriveListDayStatus({progress,
        attempts: null, resolvedCsd: csdForRow(resolvedFocusCsd, classId, listId), phaseOracle:
        determineStartingPhase}).currentStudyDay : (progress?.currentStudyDay ?? 0)`; `displayDay =
        REVIEW_V2_CLIENT ? dayStatus.displayDay : (completedDays + 1)`. `attempts: null` ⇒ decision 3 (no
        phase/done-state on rows) AND ⇒ `phaseOracle` never invoked per-row (V4). Ahead/behind
        (`difference`/`isAhead`/`isBehind`/`isOnTrack`) UNTOUCHED, fed by the now-possibly-unified
        `completedDays`. Call site (`:2198-2203`) passes the two new props (parent already holds both).
        OTHER LEG (flag-off): `(progress?.currentStudyDay ?? 0)` / `(completedDays + 1)` survive verbatim.
        DONE: `src/pages/Dashboard.jsx` `ListProgressStats` (:186-248, signature :186, `dayStatus` ternary
        :204-211, `completedDays` :213, `displayDay` :225) + its call site (:2236-2243).
        Fixture case: C2 in `scripts/deepfix2/dashboard-df2-33-fixtures.mjs` (green, 71/0 run).
        ESLINT DELTA (recorded, not silently absorbed): the added `userAttempts` prop is genuinely
        UNUSED inside `ListProgressStats`'s body per decision 3/the brief's explicit `attempts: null`
        instruction (forward-wired for a later dashboard-polish fold, per the module header's DF2-20
        follow-on note) — `npx eslint src/pages/Dashboard.jsx` goes from 25→26 problems (24→25 errors, 1
        warning unchanged), the ONE new finding being exactly `'userAttempts' is defined but never used`
        at the `ListProgressStats` signature line — confirmed via a normalized before/after diff (every
        other line matches message-for-message, only line numbers shifted). Left unrenamed (no leading
        underscore) to match this file's own pre-existing convention of tolerating unused-var lint noise
        rather than suppressing it (`setError`/`userStats`/`pdfDataCache`/etc. — 13 pre-existing
        `no-unused-vars` findings already in the baseline, `grep -c "no-unused-vars"` on the pre-edit
        `npx eslint` run) — not a bug, an explained and isolated forward-wiring artifact.

## GROUP C — FIXTURES + MUTANTS
[x] C1  Pure fixtures, all of A1's bypass set, node-only (no emulator, no Vite) — mirrors
        `dashboard-streak-authority-fixtures.mjs`'s harness (same `CASE`/`check`/`checkTrue` idiom,
        evidence-JSON with `sourceShas`).
        DONE: `scripts/deepfix2/dashboard-df2-33-fixtures.mjs` — evidence
        `docs/plans/deepfix2/evidence/dashboard-df2-33-pure.json`, `pass:true, total:71, failed:0` (11
        CASE blocks: C1.1 non-demoting, C1.2 never-demote, C1.3 resolved-null/undefined ×4 sub-cases,
        C1.4 attempts:null + oracle-never-called (call-counted), C1.4b attempts:[] real value + oracle
        IS called, C1.5 stub-oracle passthrough ×2, C1.5b exact call-arg shape, C1.6 attemptsForList ×3,
        C1.6b csdForRow ×5, plus C2/C3 below in the SAME run/file). Case 7 (real oracle): see A1's DONE
        note — deferred, not counted in the 71/0.
[x] C2  FLAG-OFF PARITY static anchors (substring-based, matching the streak fold's C2 technique — a
        wrapped block's re-indentation is cosmetic, so the check targets the load-bearing sub-expressions,
        not a whole-line diff): the hero's legacy `resolvedMatchesFocus`/`Math.max(...)`/attempts-filter/
        `determineStartingPhase(listAttempts, currentStudyDay + 1).phase` substrings present verbatim
        (current tree, current file only — this fold has no HEAD to diff against beyond git); ListProgressStats'
        legacy `progress?.currentStudyDay ?? 0` / `completedDays + 1` substrings present verbatim; PLUS a
        streak-untouched cross-check (`calculateStreak` body + the streak ternary head + both render
        sites + the 3 `streakDays: 0,` branches — same technique as the streak fold's own C2, re-run here as
        a second independent confirmation since this fold edits the same file).
        DONE: same fixtures file/run (71/0 includes all C2 CASEs) — `calculateStreak` body byte-identical
        to `git show HEAD:src/pages/Dashboard.jsx` (HEAD = the streak fold's committed state, sha
        `74eb77a`), streak ternary head/render sites/3×`streakDays: 0,`/destructure line all present
        verbatim in both current and HEAD, `progressService.js`/`functions/foundation.js` sha16-identical
        to HEAD — all green, 0 reds.
[x] C3  GREP-PROOFS (brief-mandated, numbers derived from the fixture run, never hand-typed):
        `REVIEW_V2_CLIENT` occurrence count in Dashboard.jsx (before/after, delta = this fold's new
        ternaries); `currentStudyDay + 1` remaining literal-substring sites = the legacy IIFE + the
        comment + the module's own internal use, nothing else; module source
        (`dayStatusAuthority.js`) contains zero `firebase`/`firestore` substrings.
        DONE: same fixtures file/run — evidence `grepProofs`: `REVIEW_V2_CLIENT` HEAD=10 → current=17
        (delta +7 = 2 new comments + 3 real ternary sites in `ListProgressStats` + 1 comment + 1 real
        ternary site in the hero); `currentStudyDay + 1` literal substring in Dashboard.jsx UNCHANGED at
        2 (HEAD=2, current=2 — the pre-existing comment + the legacy IIFE'd call, confirmed NO new
        Dashboard.jsx site added); the module's OWN code (doc-comment prose stripped) has exactly 1 such
        site (`displayDay`'s own definition). Module purity: 0 static `import` lines, 0 dynamic
        `import()` calls, 0 `require()` calls, 0 case-insensitive `firebase`/`firestore` substrings in
        the module's CODE (prose in the header docblock legitimately names them — stripped before this
        check, the same false-positive class `dashboard-streak-authority-fixtures.mjs`'s own C3 warns
        about, hit and fixed once during this fold's own build — see the report).
[x] C4  MUTANT m1: drop the non-demoting max (`Math.max(resolvedCsd ?? 0, progress?.currentStudyDay ?? 0)`
        → `resolvedCsd ?? progress?.currentStudyDay ?? 0`, i.e. a lower resolved value WOULD demote) ⇒ the
        never-demote fixture (raw 5/resolved 4, expects 5) goes RED (actual 4).
        DONE: `scripts/deepfix2/dashboard-df2-33-mutants.mjs` M1-DROP-NON-DEMOTING-MAX — evidence
        `dashboard-df2-33-mutants.json`: `killed:true, fixtureExit:1, checks:71, failures:2,
        restoredOk:true`.
[x] C5  MUTANT m2: displayDay off-by-one (drop the `+ 1`) ⇒ the non-demoting fixture (raw 3/resolved 5,
        expects displayDay 6) goes RED (actual 5).
        DONE: same mutants file, M2-DISPLAYDAY-OFF-BY-ONE — `killed:true, fixtureExit:1, checks:71,
        failures:5, restoredOk:true`.
[x] C6  MUTANT m3: `attempts: null` treated as `[]` (delete the nullish early-return, always compute) ⇒
        the `attempts: null` fixture (expects `phase: null, doneToday: null`, oracle NOT called) goes RED
        (oracle IS called, phase/doneToday become the stub's real values).
        DONE: same mutants file, M3-ATTEMPTS-NULL-TREATED-AS-EMPTY — `killed:true, fixtureExit:1,
        checks:71, failures:5, restoredOk:true`. NOTE (methodology, worth recording): the FIRST attempt
        at this mutant used a LITERAL `phaseOracle: null` in the C1.1-C1.3 fixture cases (which pass
        `attempts: null` and don't care about phase) — under the mutant, `attempts:null` no longer
        short-circuits, so `phaseOracle(...)` WAS reached with `phaseOracle === null`, throwing an
        uncaught `TypeError` that crashed the whole fixture process before C1.4's own assertion ever ran.
        The mutant was still technically "killed" (non-zero exit) but the kill was NOT attributable to
        the intended assertion. Fixed by replacing `phaseOracle: null` with a BENIGN never-throwing stub
        (`unusedOracle`, returns a distinctive non-null marker) in every attempts:null case that doesn't
        itself test the oracle-call contract — after the fix M3 kills cleanly via 5 ordinary red
        `check()`s (C1.1's `phase null`/`doneToday null` assertions plus C1.4's 3 assertions), not a crash.
        Evidence: `docs/plans/deepfix2/evidence/dashboard-df2-33-mutants.json` — `pass:true`,
        `targetSha16` (`6677f0ee802f8106`) matches the current tree (independently recomputed, matches
        the pure evidence's `sourceShas["src/utils/dayStatusAuthority.js"]` too) — restore verified clean,
        `grep -c "MUTANT" src/utils/dayStatusAuthority.js` → 0 residue.

## GROUP D — TRUTH REPAIRS
(none — nothing this fold previously published is falsified; `NEED_TO_FIX.md:101/106` and
`WORK_QUEUE.md:38` already correctly describe df2-33 as pending. Updating those two docs to reflect
"landed" is the ORCHESTRATOR's step — both are outside this fold's touch-list.)

## GROUP E — CARDED, NOT THIS ROUND
[x] E1  **`deriveSessionState` (DF2-20) absorption.** Per orchestrator decision 1: when DF2-20 lands, it
        absorbs `dayStatusAuthority.js`. Noted as a follow-on in the new module's header comment ONLY — not
        built toward, no scaffolding added for it now.
        DONE: `src/utils/dayStatusAuthority.js:24-30` ("FOLLOW-ON (do not build toward this now):
        `deriveSessionState` (DF2-20) does not exist yet...").

## CLOSE
[x] every NON-CARDED row ticked (file:line + fixture) — V1-V7, A1-A3, C1-C6, E1 all [x]; GROUP D is "none"
    (no truth repair owed).
[x] evidence re-run AFTER the last edit — the canonical `dashboard-df2-33-pure.json` timestamp
    (final run `2026-08-04T23:40:44.348Z`) post-dates every source edit in this fold (module +
    Dashboard.jsx were both last written well before that run). The mutants run redirects its OWN
    receipt via `DASHBOARD_DF2_33_PURE_RECEIPT` so it can never clobber this canonical file — confirmed
    by re-running both scripts one final time (71/0 pure, 3/3 mutants killed, restore clean, 0 residue)
    immediately before writing this report.
[x] shas re-stamped — independently recomputed (not copy-pasted) `sha256().slice(0,16)` for all 3 files
    the evidence certifies; MATCH `dashboard-df2-33-pure.json`'s `sourceShas` exactly (see report).
[x] numbers re-derived — 71/0 (pure), 3/3 killed + restore clean (mutants), the eslint 25→26 delta, the
    REVIEW_V2_CLIENT 10→17 count, the `currentStudyDay + 1` 2/2/1 counts — every one read from a JSON file
    or a fresh command run in this session, never hand-typed into this ledger first.
[x] change log row — PROPOSED in the report (the orchestrator appends it); this fold does NOT write
    `change_action_log.md` itself (hard constraint).
[ ] VISUAL — OWED — WinClaude order (flag-OFF: Dashboard loads, hero + row Day numbers unchanged; batched;
    flag-ON verification is a separate later rehearsal order, same as the streak fold's own VISUAL row)
[~] gate.mjs (explicit ledger path): see the report for the full verbatim run + which reds are foreign/
    pre-existing (task3/cutover-b/cutover-c staleness, none of it in this fold's touch-list) vs this
    fold's own (none — LEDGER/FREEZE/MUTANT/BATON/WATCHER/LOG all green for this fold's own artifacts).
[x] commit — CONFIRMED NOT performed: `git status --porcelain` shows no staged changes, no commit made
    (hard constraint: no git commit/add in this task).
