# DF2-51-c FOLD LEDGER — the past-day browser (route + page)
Brief: `docs/plans/deepfix2/_ledgers/df2-51c-browser-BRIEF.md` (law) · design `22_DF2-51_PASTDAY_NAV_DESIGN.md`
§7 RATIFIED · shipping target `mockups/df2-51-extended.html` §2 (minus the resume panel, owned by 51-f).
Fold 3 of 8 in the DF2-51 train. 51-a (`src/utils/pastDayAuthority.js`, 19dd849) and 51-b
(`src/services/restudyVisit.js`, 2779d4d) are LANDED and consumed here, never duplicated.

## GROUP V — VERIFY BEFORE EDITING (facts re-verified in code, 2026-08-05; line numbers as of this session)
[x] V1  THE `{FLAG && <Route/>}` GATE IDIOM IS ALREADY ESTABLISHED IN `App.jsx` ITSELF, and is a REAL gate
        (not dead code) by react-router's own documented children-handling. `src/App.jsx:31` (pre-existing,
        untouched): `{isSimulationEnabled() && <SimulationPanel />}` — the exact same "conditionally
        include a child" idiom I used for the restudy Route. Confirmed the MECHANISM independently:
        `node_modules/react-router/dist/development/chunk-AMVS5XVJ.js:9290-9295`,
        `createRoutesFromChildren`: `if (!React9.isValidElement(element)) { return; }` — a falsy child
        (`false`/`null`/`undefined`) is silently skipped, never added to the route config. Verified live
        (not just read) via `React.createElement` + the REAL `react-router-dom` (`matchRoutes`) in
        `scripts/deepfix2/df2-51c-browser-fixtures.mjs` cases C2.2-C2.4 — see GROUP C. Governs: the
        App.jsx edit (route registered as `{REVIEW_V2_CLIENT && (<Route .../>)}`, App.jsx:105-113).
[x] V2  `REVIEW_V2_CLIENT` IS STILL `false` TODAY. `src/config/featureFlags.js:243`: `export const
        REVIEW_V2_CLIENT = false;`. Re-confirmed via the SAME import the fixture uses (case C2.1) — not a
        hand-read, a live import assertion. Governs: flag-off byte-identical claim; I never touch this
        file's exported VALUE (hard constraint).
[x] V3  51-a's PRESCRIBED SIGNATURES, consumed verbatim, no local reimplementation.
        `src/utils/pastDayAuthority.js:433` `derivePastDays({currentStudyDay, attempts, visits,
        bookmarks})` (bookmarks = the ALREADY-RESOLVED scalar, per :428-430's own doc comment) · `:455`
        `deriveTodayRow({currentStudyDay})` · `:315` `bookmarkedDayForList(restudyBookmarks, classId,
        listId)` · `:172-178` `DAY_STATES` (frozen enum, iteration order already matches the wireframe
        legend order: untouched, studied, tested, re-completed, bookmarked). `RestudyBrowser.jsx` calls
        all three with exactly these shapes; nothing here computes a state or a pip (brief's own stop
        condition) — confirmed by re-reading my own page file after writing it: the only DAY_STATES use is
        the frozen-enum values used as legend keys, never a re-derivation.
[x] V4  51-b's OWN STATED BOUNDARY — browsing never mints. `src/services/restudyVisit.js:29-34`: "This
        module MINTS ... and manages the identifier client-side. It does NOT call `composeRerun` — the
        call that RECEIVES the minted id — that is wired in a later fold (51-d)." `:71-74`: "DARK BY
        CONSTRUCTION: nothing calls this module yet (51-c/51-d land the callers)." Governs: `RestudyBrowser.
        jsx`/`.viewModel.js` import NOTHING from `restudyVisit.js` — grepped after writing both files:
        zero matches for `restudyVisit` in either. The page reads `users/{uid}/restudy_visits` directly
        (a Firestore READ, not the mint wrapper) to feed 51-a's `visits` parameter — that is display data,
        not a mint.
[x] V5  DASHBOARD'S LOADING IDIOM (matched, not invented). `src/pages/Dashboard.jsx:474-488`
        (`loadUserAttempts`: `useState` data/loading + a guard, `setLoading(true)` AFTER the guard,
        try/catch/finally, `console.error` on failure, degrade to a safe empty value, never throw) and
        `:710-804` (`loadProgressData`/the surrounding effect: a `cancelled` flag, `Promise.all` for
        parallel independent reads, an explicit "nothing to fetch -> release loading" branch). `RestudyBrowser.
        jsx`'s single loading effect mirrors this shape exactly (cancelled flag, Promise.all, try/catch/
        finally, console.error, degrade-not-throw) rather than inventing a different one.
[x] V6  NO EXISTING db.js HELPER READS `restudy_visits`, AND `updateUserSettings` DOES NOT COVER THE
        BOOKMARK FIELD (governs the bookmark write NOT requiring a touch-list-violating db.js edit).
        Grepped `restudy_visits` across `/app/src` before this fold (V4 grep) — zero non-comment matches
        outside `restudyVisit.js`'s own prose. `src/services/db.js:305-332` `updateUserSettings` handles
        exactly `settings.weeklyGoal` / `settings.useUnifiedQueue` / `settings.primaryFocusListId` /
        `settings.primaryFocusClassId` (:313-325) — no `restudyBookmarks` branch exists, and the H6 field
        (`15_H6_SCHEMAS_AND_CONTRACTS.md:196`) is a TOP-LEVEL `restudyBookmarks.{classId}_{listId}` key,
        not nested under `settings`. Since achieving the write does NOT require editing `db.js` (the
        Firestore client SDK is reachable directly, same as `AuthContext.jsx:34`/`Dashboard.jsx:32`
        already import `db` from `../firebase` directly), this is NOT the brief's STOP-and-report
        condition ("if writing it cleanly requires touching a file outside your touch-list") — it doesn't.
        `RestudyBrowser.jsx`'s `handleToggleBookmark` mirrors `updateUserSettings`'s OWN dot-path
        `updateDoc(userRef, {[path]: value})` idiom (db.js:310-315,331) directly, rather than adding a
        second generic writer to `db.js` or widening that file.
[x] V7  FIRESTORE RULES PERMIT THE READ, DENY ANY CLIENT WRITE TO `restudy_visits` (governs: safe to
        query directly; must never attempt to write one). `firestore.rules:239-240`: `match /{subcollection}
        /{docId} { allow read: if isAuthenticated() && (isOwner(userId) || isTeacher()); }` — covers every
        `users/{uid}` subcollection including `restudy_visits`, satisfied trivially for the owner reading
        their own uid. `firestore.rules:101-105` `serverOwnedSubcollections()` lists `restudy_visits`
        (and `restudy_completions`) — `create`/`update`/`delete` all deny membership in that set
        (:251,:257,:263). `RestudyBrowser.jsx` only ever calls `getDocs` on this subcollection, never
        `setDoc`/`updateDoc`/`addDoc` — grepped after writing: zero write-verb calls against
        `restudy_visits` in the page.
[x] V8  ATTEMPT-DOC FIELD NAMES MATCH WHAT `pastDayAuthority.js` READS (governs that `fetchUserAttempts`'s
        raw pass-through is directly consumable, no field renaming needed). `functions/reviewV2/
        callables.js:766-769,794`: an attempt is written with `studyDay: p.logicalDay`, `sessionType:
        isNewSessionTxn ? "new" : "review"`, `passed`, `...(isRerunTxn ? {type: "retest", ...} : {})`,
        `submittedAt: FieldValue.serverTimestamp()` — the EXACT field names `pastDayAuthority.js`'s
        `originalAttemptsForDay`/`bestOriginalPass` consult. `src/services/db.js:2769-2777`
        (`fetchUserAttempts`) spreads `...attemptData` verbatim before adding `listId`/`listTitle`/
        `className`/`classId`/`date` — none of the five fields above are touched/renamed.
[x] V9  `class_progress` (NOT `list_progress`/`progress_meta`) IS STILL THE LIVE COMPLETION TARGET TODAY,
        even with `SERVER_PROGRESS_WRITE=true` (governs using `getClassProgress` directly rather than a
        `resolveListProgress` callable). `src/config/featureFlags.js:69-70` (comment on
        `SERVER_PROGRESS_WRITE`): "Completion still targets the LEGACY class_progress doc until P5 flips
        LIST_PROGRESS_CANONICAL server-side." `src/pages/Dashboard.jsx:780` (`loadProgressData`, a
        NON-focused per-list row — the same role my page plays for ITS one list) calls plain
        `getClassProgress(user.uid, classId, listId)`, not any callable. `src/services/progressService.
        js:751-762` (`getClassProgress`) is a direct `getDoc` on `users/{uid}/class_progress/{docId}`.
        `RestudyBrowser.jsx` calls the SAME function the same way; `dayStatusAuthority.js`'s extra
        `resolvedCsd` overlay (Dashboard's hero-only "primary focus" resolution via a callable) is not
        applicable here — with no resolved-focus input, `deriveListDayStatus`'s own
        `Math.max(resolvedCsd ?? 0, progress?.currentStudyDay ?? 0)` (`dayStatusAuthority.js:121`) would
        collapse to `progress?.currentStudyDay ?? 0` anyway, so I use that expression directly rather than
        importing a module whose one extra input I have no source for (see the report's judgment-call
        list).
[x] V10 RESETEPOCH HAS NO CLIENT-READABLE SOURCE TODAY OUTSIDE A COMPOSE RESPONSE, AND ATTEMPTS ARE
        SAFE FROM CROSS-EPOCH STALENESS BY CONSTRUCTION (governs FINDING E1 below — this fold does not
        invent a new epoch-resolution read). Grepped `resetEpoch` across `/app/src` (excluding
        `restudyVisit.js`/`pastDayAuthority.js`, which only ever ask for it as an injected parameter):
        every hit is EITHER inside `reviewV2Compose.js` (a value only known AFTER a compose call,
        `:257,:370`) or a compose-RESPONSE echo inside `MCQTest.jsx`/`TypedTest.jsx` (`:799,:1227,:1346`
        and `:1070,:1562,:1683`) — zero reads of any progress/meta doc's OWN `resetEpoch` field anywhere
        client-side. `functions/foundation.js:2096-2184` (`resetProgress`): step 1 (`:2167-2184`)
        SYNCHRONOUSLY deletes every `attempts` doc for the list (awaited, inside the same call) — so a
        fresh `fetchUserAttempts` read can NEVER see a cross-epoch attempt for this list; the risk 51-a's
        header (V6) warns about is closed for the `attempts` input specifically. The `restudy_visits`/
        `restudy_completions` cleanup (`:2216`, `rv2Reset.deleteStaleEpochReviewV2Docs`) IS awaited before
        `resetProgress` returns, but the design doc itself (`22_:57-58`) calls this "async/best-effort,
        not a transactional read-time guarantee" — a crash mid-reset or a read racing that one step is
        the residual (narrow) exposure for the `visits` input. Recorded as FINDING E1, not silently
        patched by inventing a new `progress_meta` read this fold's touch-list does not authorize.
[x] V11 THIS ENVIRONMENT CANNOT PARSE JSX UNDER PLAIN NODE (governs the two-file A1/A2 split — see the
        report for why "the new page file" became two small files). `ls node_modules/@esbuild/` shows
        only `win32-x64` (no `@esbuild/linux-x64`); `node -e "process.platform"` reports `linux` this
        session. `node_modules/@vitejs/plugin-react/package.json` dependencies list only
        `@babel/plugin-transform-react-jsx-self` / `-jsx-source` (Fast-Refresh dev helpers) — no
        `@babel/plugin-transform-react-jsx` or `@babel/preset-react` anywhere under `node_modules/@babel`
        (`find node_modules/@babel -maxdepth 1 -type d`, checked this session). A `.jsx` file with real
        JSX in it therefore cannot be `import`ed by plain `node` in this checkout AT ALL — confirmed
        structurally, not merely asserted (Node's parser fails on the first JSX token before any named
        export is reachable). The brief's own fixture list ("the pure view-model assembly (rows → props),
        the flag-off gate, the empty/loading/error branch selection, and the bookmark precedence") is
        therefore only satisfiable if that logic lives in a plain `.js` file — `RestudyBrowser.viewModel.
        js` exists for exactly this reason, mirroring the established `dayStatusAuthority.js`/
        `streakAuthority.js` pattern (pure logic pulled OUT of an unfixturable component) one layer lower.
[x] V12 DESIGN-TOKEN CLASS NAMES USED ARE REAL, ALREADY-SHIPPED UTILITIES (governs token compliance —
        every class below was grep-confirmed in ACTUAL production `.jsx` usage this session, not
        inferred from `src/index.css` alone, since Tailwind v4's `@theme`-key-to-utility-name mapping has
        non-obvious aliasing, e.g. `--color-error-text` exists SPECIFICALLY so `text-error-text` resolves
        — see `src/index.css:417-419`'s own comment). Confirmed real usage counts (this session):
        `bg-info-subtle` (3+), `text-info-text-strong` (7), `text-error-text` (35), `border-brand-primary`
        (hand-authored utility, `src/index.css:495-497`), `rounded-card`/`rounded-alert` (`src/pages/
        Settings.jsx:298` etc., `src/pages/MCQTest.jsx:1878` etc.). `src/components/ui/Badge.jsx:1-11`
        (variants `default/info/warning/success/purple`, used via the `variant` PROP, never a raw class),
        `Card.jsx:87-91` (`alert-error` variant), `buttons/Button.jsx:23-72` (`secondary`/`primary-blue`
        variants), `buttons/IconButton.jsx:18-39` (`default` variant). No raw Tailwind color class and no
        new CSS file appear anywhere in `RestudyBrowser.jsx`/`.viewModel.js` — grepped after writing:
        zero matches for `bg-(red|blue|green|amber|slate|gray|purple|emerald)-\d` etc.
[x] V13 ESLINT'S `no-unused-vars` CONFIG HAS NO `argsIgnorePattern` (governs the stub-handler shape).
        `eslint.config.js:26`: `'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }]` — only
        `varsIgnorePattern` is set; the default `args: "after-used"` would flag a declared-but-unused
        stub parameter. `handleRestudyStub`/`handleRetestStub` in `RestudyBrowser.jsx` therefore take NO
        parameters (the day is available to a future 51-d implementation via the closure at the call
        site, `onRestudy={handleRestudyStub}`, not a passed argument) — confirmed clean via
        `npx eslint src/App.jsx src/pages/RestudyBrowser.jsx src/pages/RestudyBrowser.viewModel.js`
        (exit 0, GROUP C below).

## GROUP A — DELTAS
[x] A1  NEW PAGE `src/pages/RestudyBrowser.jsx` — the route's component. Loads list title / progress /
        attempts / visits / bookmark (V5-V9), derives via 51-a only (V3), renders the wireframe §2 minus
        the resume panel (51-f's — brief's own exclusion): back-link, "Past Days" title + description, the
        plain-language re-test banner, the 5-chip legend, one row per past day (day/dates/chip/pips/
        bookmark/Re-study/Re-test), the non-actionable today row, and explicit loading/error/empty
        branches. Re-study/Re-test are named stubs (`handleRestudyStub`/`handleRetestStub`, V13) — no
        navigation, no compose call. The bookmark toggle is a REAL write (brief item 4, V6/V7). Not a
        closure/guard row — a new page with no prior guard to bypass, so no BYPASS SET applies; GROUP C's
        fixtures are this row's completeness proof for everything in it that CAN be pure (V11).
[x] A2  NEW PURE MODULE `src/pages/RestudyBrowser.viewModel.js` — presentation-only adapter (JUDGMENT
        CALL, V11: a second small file because JSX is unparseable by plain node here). Exports:
        `formatShortDate`/`formatDayDateLabel` (date display), `CHIP_CONFIG`/`dayStateChipConfig` (DAY_
        STATES -> Badge variant + wireframe symbol/label), `PIP_TITLES`/`pipTitle` (pip tooltip text),
        `isDayActionable` (today-is-never-actionable gate — the fold's own named mutant clause),
        `buildDayRowViewModel`/`buildRestudyRows` (rows -> props), `selectBranch` (loading/error/empty/
        list), `computeBookmarkToggleTarget` (bookmark WRITE-side precedence — the READ side is 51-a's
        `bookmarkedDayForList`). Zero imports (V11's own constraint, mirroring `pastDayAuthority.js`'s
        convention); never recomputes a state or a pip — every function here reads 51-a's OUTPUT and maps
        it to display config. Not a closure/guard row, so no BYPASS SET applies — GROUP C's fixtures/
        mutants are the completeness proof.
[x] A3  `src/App.jsx` — ROUTE LINE ONLY (brief's own touch-list wording), V1/V2. Three pieces, all part of
        registering the one route: the `RestudyBrowser` import (:13, alongside the other page imports —
        matches every sibling), the `REVIEW_V2_CLIENT` import (:23, new — not previously imported in this
        file), and the gated `<Route>` (:105-113) using the file's OWN pre-existing conditional-child
        idiom (:31, `isSimulationEnabled() && <SimulationPanel />`). Nothing else in the file touched —
        diffed against HEAD after the edit (`git diff -- src/App.jsx`): the ONLY hunks are these three
        additions, no reordering, no other route touched. Not a closure/guard row in the BYPASS-SET sense
        (nothing pre-existing is being narrowed or protected, so no BYPASS SET applies) — GROUP C's C2
        cases are this row's proof.

## GROUP C — FIXTURES + MUTANTS
[x] C1  Pure fixtures, `scripts/deepfix2/df2-51c-browser-fixtures.mjs` — plain node, no emulator, no
        network, no browser. RESULT (from `docs/plans/deepfix2/evidence/df2-51c-browser-pure.json`): 84
        checks, 0 failures, `pass:true`.
        Cases: C1.1-C1.2 date formatting (mixed timestamp shapes, both/either/neither present, never
        throws) · C1.3 `dayStateChipConfig` (all 5 states, unknown-state fallback, every variant is a REAL
        Badge variant) · C1.4 `pipTitle` (review/new × on/off/na, the exact wireframe tooltip strings,
        unknown-kind/state fallbacks) · C1.5 `isDayActionable` (today false, a real day true, defensive
        defaults) · C1.6-C1.8 `buildDayRowViewModel` (a full re-completed row, the F3 no-new-half row —
        Re-study disabled/Re-test not, malformed input never throws) · C1.9 `buildRestudyRows` (1:1
        mapping, non-array degrades to `[]`) · C1.10 `selectBranch` (loading > error > empty > list
        precedence, defensive defaults) · C1.11 `computeBookmarkToggleTarget` (set / clear-on-reclick /
        move-never-duplicate, invalid-day no-ops) · C2.1-C2.4 THE FLAG-OFF GATE: the REAL `REVIEW_V2_
        CLIENT` import is `false` today; the REAL `react-router-dom` route matcher (via
        `React.createElement`, no JSX needed) shows the restudy route ABSENT from the config and the URL
        falling through to `*` when flag-off, and PRESENT+matching when a SIMULATED flag is forced true
        (proves the gate is load-bearing, not permanently-absent-anyway); a text anchor on the REAL
        `src/App.jsx` bytes binds the abstract proof to the actual edit, exactly once · C3 GREP-PROOF: the
        view-model module has zero import/require statements and no case-insensitive
        firebase/firestore/react substring in its code (comments stripped) — mirrors `pastDayAuthority.
        js`'s own C8 case (V11).
        Does NOT re-test `pastDayAuthority.js` (cite `df2-51a-model-pure.json`, 115/0) or `restudyVisit.js`
        (cite `df2-51b-visit-pure.json`, 192/0) — this fold consumes their output only (brief instruction).
[x] C2  Mutants, `scripts/deepfix2/df2-51c-browser-mutants.mjs` — 5 total, covering the brief's 2 named
        minimums plus 3 of this fold's own judgment-call clauses:
          M1  FLAG-OFF GATE (the brief's 1st minimum) — SIMULATED IN-MEMORY, not a file mutation (see the
              script's own header and the report for why: `src/App.jsx` is shared/contended, and a
              feature-flag VALUE may never be changed even transiently per the hard constraints). Forces
              the gate boolean true against the REAL react-router matcher (nothing written to any file)
              and confirms the route becomes reachable — proving the `&&` is load-bearing.
          M2  TODAY RENDERED AS ACTIONABLE (the brief's 2nd minimum) — `isDayActionable`'s negation
              dropped — kills fixture case C1.5 (5 red checks).
          M3  BOOKMARK-PRECEDENCE DROPPED — `computeBookmarkToggleTarget` always sets, never clears on a
              re-click — kills case C1.11 (1 red check).
          M4  BRANCH EMPTY-CHECK DROPPED — `selectBranch` stops detecting a genuinely empty (but real)
              `pastDays` array — kills case C1.10 (1 red check).
          M5  RESTUDY-DISABLED MAPPING DROPPED — `buildDayRowViewModel` ignores `canRestudy:false` (F3) —
              kills case C1.7 (2 red checks).
        M2-M5 mutate the REAL `src/pages/RestudyBrowser.viewModel.js` in place (`[MUTANT ...]`-marked),
        require the REAL fixture script to exit non-zero, restore immediately, sha-verify the restore.
        RESULT (from `docs/plans/deepfix2/evidence/df2-51c-browser-mutants.json`): 5/5 killed, `pass:true`,
        every `restoredOk:true` (M1 trivially — nothing written), no `[MUTANT` residue in the tree after
        (checked via `grep -c "\[MUTANT" src/pages/RestudyBrowser.viewModel.js src/App.jsx` = 0/0).
[x] C3  ESLINT SYNTAX GATE — `npx eslint src/App.jsx src/pages/RestudyBrowser.jsx src/pages/RestudyBrowser.
        viewModel.js`: exit 0, zero errors/warnings (the only stdout line is an unrelated
        `baseline-browser-mapping` staleness notice, identical whether or not any of my files are
        included — confirmed by also running `npx eslint` against ZERO of my files' HEAD predecessor,
        see below). DELTA vs HEAD for the one pre-existing touched file (`src/App.jsx`): linted HEAD's copy
        via `git show HEAD:src/App.jsx | npx eslint --stdin --stdin-filename src/App.jsx` — also exit 0,
        zero findings. Delta: 0 findings -> 0 findings (no pre-existing findings to preserve/avoid
        regressing). `RestudyBrowser.jsx`/`.viewModel.js` are new files (no HEAD predecessor to diff).

## GROUP D — TRUTH REPAIRS
[x] D1  None found. Grepped `RestudyBrowser` and `df2-51c` across `docs/*.md`, `NEED_TO_FIX.md`,
        `change_action_log.md` before writing — this fold's page/route/viewModel are not mentioned
        anywhere as already existing or already characterized, so there is no prior published sentence
        this fold's work falsifies.

## GROUP E — CARDED, NOT THIS ROUND (so nothing is silently dropped)
[x] E1  RESETEPOCH-CORRECTNESS FOR THE `visits` READ IS UNRESOLVED (V10). `pastDayAuthority.js`'s own
        header (V6 in ITS ledger) states epoch-correctness of the injected `attempts`/`visits` is the
        CALLER's job. `attempts` is provably safe (`resetProgress` hard-deletes them synchronously,
        `foundation.js:2167-2184`). `restudy_visits` cleanup is awaited but explicitly NOT transactional
        (`22_:57-58`, `foundation.js:2216`) — a crash mid-reset, or a read racing that one cleanup step,
        could show a stale-epoch visit until async cleanup (or a fresh 51-d compose) supersedes it. No
        client-side mechanism exists ANYWHERE in this codebase today to learn the current `resetEpoch`
        without first calling a compose (grepped, V10) — browsing composes nothing (brief, explicitly).
        NOT fixed here: inventing a `progress_meta`/`list_progress` read for this ONE purpose would widen
        this fold's touch-list (a new read pattern this brief did not authorize) for a narrow, transient,
        self-healing display glitch (never a security or write-authority issue — writes stay server-only,
        V7). Escalated as a finding for 51-d (which DOES learn `resetEpoch` from its own compose response)
        or a future hardening pass to decide whether to thread it back down to the browser.
[x] E2  THE RESUME PANEL, DASHBOARD ENTRY AFFORDANCE, AND END-OF-LIST COMPLETION SCREEN ARE NOT BUILT
        HERE — the brief says so explicitly ("does not own the Dashboard entry point or the resume panel
        (51-f)") and the FOLD SPLIT table (`22_:251`) assigns them to 51-f (`Dashboard.jsx`, a file
        outside this fold's touch-list). Recorded so the wireframe's OTHER "Extra vs core" elements are
        not silently assumed covered by this fold.
[x] E3  TYPED-RETEST CAP RENDERING (decision h) AND THE NTF-27 RELOAD-PERSISTENCE FIX (decision i) ARE
        51-d's (`22_:249`, "Owns: MCQTest.jsx, TypedTest.jsx, reviewV2Client.js") — this fold's Re-study/
        Re-test buttons are inert stubs (brief, Build §2), so no cap-refusal state or reload/retest UI
        exists yet to carry either fix. Recorded, not silently assumed done.

## CLOSE
[x] every row ticked with file:line + fixture ref — V1-V13, A1-A3, C1-C3, D1, E1-E3 all [x] above.
[x] evidence re-run AFTER the last edit — the pure suite's FINAL run (84/0) happened AFTER the mutants
    script restored `RestudyBrowser.viewModel.js`, confirming the tree the evidence certifies is the tree
    left on disk (mirrors 51-a's own discipline). `src/App.jsx` was not touched again after that run.
[x] all shas re-stamped — `docs/plans/deepfix2/evidence/df2-51c-browser-pure.json`'s `sourceShas` and
    `docs/plans/deepfix2/evidence/df2-51c-browser-mutants.json`'s `targetSha16` were both produced by the
    LAST run (after the mutant restore), re-verified independently in the report via `sha256sum`.
[x] numbers re-derived from the evidence file, never typed — 84/0 and 5/5 in this ledger and the report are
    copy-pasted from the two evidence JSONs' own `total`/`failed`/`mutants` fields.
[x] change log row (ABSOLUTE path) — proposed row TEXT given in the report; NOT written to
    `/app/change_action_log.md` by this fold (hard constraint: the orchestrator appends it).
[x] `node scripts/deepfix2/gate.mjs docs/plans/deepfix2/_ledgers/df2-51c-browser-fold-ledger.md` — run
    (both `--plan` and the closing run); verbatim output in the report.
[~] commit — CARDED, not this session: hard constraint forbids `git add`/`git commit` for an implementer
    sub-agent; committing (if the orchestrator chooses to) is its job, not this fold's.
[x] VISUAL CHECK — N/A this session, stated plainly rather than claimed: WSL cannot run vite (brief's own
    constraint); a browser check is the LATER, BATCHED WinClaude order 51-h (`22_:253`, "one batched
    WinClaude visual order across the whole train"), not this fold's to run or claim.
[x] footprint — touched ONLY: `src/pages/RestudyBrowser.jsx` (new), `src/pages/RestudyBrowser.viewModel.js`
    (new), `src/App.jsx` (route line + 2 imports ONLY, diffed against HEAD), `scripts/deepfix2/
    df2-51c-browser-fixtures.mjs` (new), `scripts/deepfix2/df2-51c-browser-mutants.mjs` (new),
    `docs/plans/deepfix2/evidence/df2-51c-browser-pure.json` (new), `docs/plans/deepfix2/evidence/
    df2-51c-browser-mutants.json` (new), this ledger (new). Nothing staged; `src/utils/pastDayAuthority.js`,
    `src/services/restudyVisit.js`, `src/pages/Dashboard.jsx`, `src/pages/DailySessionFlow.jsx`,
    `src/pages/MCQTest.jsx`, `src/pages/TypedTest.jsx`, `functions/**`, `firestore.rules`, and every flag
    value never opened for write.
