# DF2-51-f FOLD LEDGER — Dashboard entry affordance + resume panel + end-of-list screen
Brief: `docs/plans/deepfix2/_ledgers/df2-51f-entry-BRIEF.md` (law) · design
`22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 RATIFIED · shipping wireframe
`mockups/df2-51-extended.html` §1 (entry), §2's resume panel, §4 (end-of-list).
Fold 6 of 8 in the DF2-51 train. 51-a (`src/utils/pastDayAuthority.js`, 19dd849), 51-c
(`src/pages/RestudyBrowser.jsx` + the `/restudy/:classId/:listId` route, 92bc6e0) and 51-b
(`src/services/restudyVisit.js`, 2779d4d) are LANDED and consumed here, never duplicated or
re-derived. Ran in parallel with 51-e (`src/pages/DailySessionFlow.jsx`) — disjoint; that file
was never opened for write in this session (confirmed in the report).

## GROUP V — VERIFY BEFORE EDITING (re-verified live in code this session, before the edit that depends on it)
[x] V1  **The 51-c route exists, flag-gated, unchanged.** `src/App.jsx:105-114`: `{REVIEW_V2_CLIENT &&
        (<Route path="/restudy/:classId/:listId" element={<PrivateRoute><RestudyBrowser /></PrivateRoute>} />)}`.
        Re-verified live via `grep -n "path=\"/restudy/:classId/:listId\"" src/App.jsx` → `107:`. Governs
        every `to={\`/restudy/${classId}/${listId}\`}` link this fold adds — the target route already
        exists and is itself flag-gated, so this fold's links need no route-existence check of their own.
[x] V2  **`REVIEW_V2_CLIENT` is still `false` today.** `src/config/featureFlags.js:243`: `export const
        REVIEW_V2_CLIENT = false;`. Re-verified live via `grep -n "REVIEW_V2_CLIENT" src/config/
        featureFlags.js` immediately before closing this ledger. Never opened for write (hard constraint).
[x] V3  **51-a's prescribed exports, consumed verbatim.** `src/utils/pastDayAuthority.js`: `DAY_STATES`
        (:172-178, frozen enum: `UNTOUCHED/STUDIED/TESTED/RE_COMPLETED/BOOKMARKED`), `PIP_STATES`
        (:182-186, frozen enum: `ON/OFF/NOT_APPLICABLE`), `derivePastDays({currentStudyDay, attempts,
        visits, bookmarks})` (:433, one row per day `1..csd`, never a phantom `csd+1` row). This fold
        never computes a `state` or a `pips` value itself — `resumableDay`'s memo (`Dashboard.jsx:1775`)
        reads them off `derivePastDays`'s own output only (confirmed by re-reading the memo after writing
        it: the only DAY_STATES/PIP_STATES uses are the frozen-enum comparisons `row.state ===
        DAY_STATES.STUDIED` etc., never a re-derivation).
[x] V4  **`dayStatusAuthority.js#attemptsForList` is the SAME per-list filter already imported.**
        `src/pages/Dashboard.jsx:31` already imports `attemptsForList` from `../utils/dayStatusAuthority`
        (landed by df2-33) — this fold's `resumableDay` memo reuses that SAME import for its own per-list
        attempt filtering rather than adding a second copy or importing a duplicate from elsewhere.
[x] V5  **`restudyVisit.js`'s own stated boundary — the resume panel READS, never mints/discards/repairs.**
        `src/services/restudyVisit.js:1-75` (module header): "the resume panel READS visit state; it must
        not mint, discard, or repair a visit". Confirmed AFTER writing: `grep -n "restudyVisit" src/pages/
        Dashboard.jsx` → zero matches. This fold's ONE read (`loadRestudyVisits`, `Dashboard.jsx:762-774`)
        calls `getDocs(collection(...))` directly against the Firestore SDK — never `restudyVisit.js`'s
        `getOrMintVisit`/`peekVisitId`/any mint path.
[x] V6  **`listFinished`'s exact derivation, reused verbatim, not re-derived.** Pre-fold location
        `Dashboard.jsx:1825` (brief's own citation, re-verified against the untouched HEAD tree via
        `git show HEAD:src/pages/Dashboard.jsx | sed -n '1825p'`): `const listFinished = !focusLapView &&
        listTotal > 0 && wordsLeft === 0`. This fold's end-of-list gate (`:2112`, post-edit) reads this
        SAME in-scope closure variable — it does not redeclare it. Byte-identity of the derivation line
        itself is a fixtured C3.2 case (pure evidence below), not just an assertion.
[x] V7  **Firestore rules permit the owner read on `restudy_visits`; no rules change needed.**
        Re-verified directly (not cited secondhand) against `firestore.rules:239-240`: `match
        /{subcollection}/{docId} { allow read: if isAuthenticated() && (isOwner(userId) ||
        isTeacher()); }` — covers EVERY `users/{uid}` subcollection, including `restudy_visits`
        (`:101-104`'s `serverOwnedSubcollections()` only narrows `create`/`update`/`delete`, at
        `:251/:257/:263` — the READ rule at `:240` has no such exclusion). This fold's read is `getDocs`
        only (V-group C4.1 grep-proof: zero `setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction`
        calls added) — satisfied trivially for the owner reading their own uid.
[x] V8  **`restudy_visits` doc schema, re-verified against the SERVER SOURCE, not just a client's usage.**
        `functions/reviewV2/visits.js:66-73` (`mintRestudyVisit`'s `txn.set`): `{uid, classId, listId, day,
        resetEpoch, createdAt, newHalfAttemptId: null, reviewHalfAttemptId: null, completed: false}` — the
        EXACT field names `pastDayAuthority.js#summarizeDayVisits`/`visitsForDay` read, and the exact
        shape this fold's `loadRestudyVisits`/`resumableDay` consume. Governs: no field renaming/mapping
        needed between the raw `getDocs` result and `derivePastDays`'s `visits` parameter.
[x] V9  **The streak-authority / df2-33 gating idiom, matched exactly (brief's own instruction).**
        `dashboard-streak-authority-fold-ledger.md` A1 + `dashboard-df2-33-fold-ledger.md` A2/A3: an inner
        loader function whose FIRST statement is `if (!REVIEW_V2_CLIENT) return` (`Dashboard.jsx:739` for
        the streak, re-verified still present, byte-identical); a render-site `REVIEW_V2_CLIENT ? <new> :
        <legacy>` or `REVIEW_V2_CLIENT && <new>`; the legacy branch left untouched inside the ternary; a
        genuinely lazy IIFE where the legacy branch has a side effect (`:1685-1744`, re-verified
        untouched). This fold's THREE new call sites (`:1873`, `:2112`, `:2413`) all use the `&&` form (no
        legacy branch exists to preserve at any of the three — every one is a NET-NEW affordance, unlike
        df2-33's day-status ternary which replaces an existing expression), and `loadRestudyVisits`
        (`:762-774`) + `resumableDay` (`:1775-1806`) each independently open with the SAME `if
        (!REVIEW_V2_CLIENT...) return`/`return null` guard — belt-and-suspenders gating, not just a single
        render-site check.
[x] V10 **Dashboard.jsx's existing loading idiom, matched, not invented.** `loadUserAttempts`
        (`:474-488`)/`loadProgressData` (`:740-799`, both pre-fold, re-verified untouched): `useState`
        data + loading, a `cancelled` flag, try/catch/finally, `console.error` on failure, degrade to a
        safe value, never throw into render. `loadRestudyVisits` (`:762-774`) mirrors this shape (cancelled
        flag from the SAME enclosing effect, try/catch, console.error, degrades to `null`) rather than
        inventing a second idiom — same discipline `RestudyBrowser.jsx`'s own loader already applied (51-c
        ledger V5).
[x] V11 **`progressData`/`userAttempts` ALREADY cover every assigned (classId,listId) pair, not just the
        focused one — this is what makes the resume panel's account-wide scope a ONE-new-read fold.**
        `loadProgressData`'s `fetchTasks` loop (`:750-761`, pre-fold, re-verified untouched) unions
        `assignedListDetails`/`assignedLists`/`assignments` keys across EVERY `studentClasses` entry —
        every enrolled class's every assigned list, not just the focused one. `fetchUserAttempts(user.uid)`
        (`:480`, pre-fold, re-verified untouched) takes no classId/listId filter — account-wide by
        construction. Governs the design choice (b) below: `resumableDay` groups the ONE new read
        (`restudyVisits`, unfiltered) by (classId,listId) and looks up `progressData[key]`/
        `attemptsForList(userAttempts, classId, listId)` for EACH group — zero additional reads beyond the
        one visits query, for every list, not just the focused one.
[x] V12 **`listTitleLookup` already exists, keyed by listId, reused for the resume panel's list name.**
        `Dashboard.jsx:425-433` (pre-fold, re-verified untouched): `const listTitleLookup = useMemo(() => {
        ... lookup[list.id] = list.title ... }, [studentClasses])`. The resume panel (`:1880`) reads
        `listTitleLookup[resumableDay.listId] || 'Vocabulary List'` — no new title derivation added, and no
        new read (mirrors the SAME ambiguity `latestTestTitle` (pre-fold) already accepts: listId-keyed,
        not classId-qualified — acceptable for a DISPLAY-only label, see the report's judgment-call list).
[x] V13 **This environment cannot parse JSX under plain Node, AND this brief's touch-list authorizes ONLY
        `Dashboard.jsx` (no new `src/**` module) — governs the fixture/mutant STRATEGY.** Re-confirmed the
        structural fact 51-a/51-c/df2-33 already established (`ls node_modules/@esbuild/` → `win32-x64`
        only; no full JSX-transform Babel plugin under `node_modules/@babel`) — `Dashboard.jsx` cannot be
        `import`ed by plain node. UNLIKE 51-c (which could extract a second file, `RestudyBrowser.
        viewModel.js`, because it OWNED a new page), this brief's touch-list is `Dashboard.jsx` + fixtures/
        ledger ONLY — no new `src/**` file is authorized. CONSEQUENCE (judgment call, see report): the
        `resumableDay` composition is fixtured via a MIRROR (line-for-line identical, built from the REAL
        `pastDayAuthority.js` exports) exercised for real, bound to the actual shipped file by TEXT
        ANCHORS on `Dashboard.jsx`'s own bytes (mirrors 51-c's C2.4 technique, applied because there is no
        importable module here to bind to directly).
[x] V14 **The eslint baseline, re-run BEFORE editing, to predict the exact expected delta.** `npx eslint
        src/pages/Dashboard.jsx` on the pre-fold tree: 26 problems (25 errors, 1 warning) — 11 of the 25
        errors are PRE-EXISTING `react-hooks/rules-of-hooks` findings on hooks declared after the
        `if (isTeacher) return` early-return (`:908` pre-fold), a pattern this file already tolerates (df2-
        33's own ledger records an analogous, differently-shaped delta for its fold). Governs: this fold's
        ONE new hook call after that same early-return (`resumableDay`'s `useMemo`) is EXPECTED to add
        exactly one more instance of the SAME pre-existing finding — confirmed, not merely predicted, in
        GROUP C below (message-normalized diff, not just a count).

## GROUP A — DELTAS
[x] A1  **Entry affordance** — a "Past days" button on each list card (Column 3, alongside "Start Session"/
        "Blind Spots"), gated behind `REVIEW_V2_CLIENT`, routing to the 51-c browser. Uses the existing
        `Button` UI component (`variant="outline"`, already imported `:40` pre-fold) — no raw Tailwind, no
        new CSS, no new import beyond what A2 already adds.
        Not a closure/guard row (a net-new, purely additive affordance — no existing guard narrowed), so no
        BYPASS SET applies; GROUP C's fixtures (text-anchor C2.5 + mutant M4) are this row's proof.
        DONE: `src/pages/Dashboard.jsx:2411-2422`.
[x] A2  **Resume-where-you-left-off panel.** Three pieces:
          (i) State + read (`:358-368` state, `:749-774` `loadRestudyVisits` inside the EXISTING
              progress-loading effect, `:838` the call) — ACCOUNT-WIDE (decision, see report), one
              `getDocs(collection(db, users/{uid}/restudy_visits))` query, no `where` filter, gated
              `if (!REVIEW_V2_CLIENT) return` as its first statement (V9). Degrades to `null` on any
              failure (never throws into render — V10).
          (ii) Selection (`:1761-1806` `resumableDay` `useMemo`) — CONSUMES `derivePastDays` (V3) per
              (classId,listId) group; never computes a state/pip itself. Two judgment-call clauses,
              documented in the code and the report: a DEAD-END exclusion (F3/F4 — a day whose review is
              done but whose new half can never exist is not offered as "resumable") and a cross-list
              TIE-BREAK (focused list wins; else the alphabetically-first key, for determinism over
              Firestore's unspecified unfiltered-query doc order).
          (iii) Render (`:1869-1899`) — gated `REVIEW_V2_CLIENT && resumableDay &&`; renders NOTHING when
              there is no resumable visit (no empty shell, per the brief). Uses `Button` + existing design
              tokens only.
        BYPASS SET (not a security closure — a display feature; the brief's own fixture list stands in):
          no visits at all · a visit minted, nothing recorded ('studied') · review recorded only · new
          recorded only · the DEAD-END shape (review on, new permanently n/a) · nearest-to-today among
          MULTIPLE resumable days · dead-end nearest + resumable earlier (exclusion beats proximity) ·
          every visited day already re-completed · malformed visit docs (missing classId/listId) · the
          FOCUSED list among several candidates · no focus among several candidates (deterministic
          alphabetical fallback) · the read itself failing (degrade, not throw).
        OTHER LEG (flag-off): `REVIEW_V2_CLIENT` false ⇒ `loadRestudyVisits` returns before any read;
        `resumableDay` returns `null` before touching `restudyVisits`/`progressData`/etc.; the JSX gate's
        FIRST operand (`REVIEW_V2_CLIENT`) short-circuits regardless of `resumableDay`'s value — zero new
        reads, zero new renders, flag-off (fixtured C3.1's `git diff` structural proof + C4.1's read-only
        grep-proof).
        DONE: `src/pages/Dashboard.jsx` — state `:368`, effect `:749-774`/`:838`, memo `:1761-1806`, JSX
        `:1869-1899`. Fixtures: C1.1-C1.11 (pure, mirror-executed) + C2.2-C2.4/C2.6 (text-anchor) + mutants
        M1/M2/M3 (mirror) + M5/M6 (text-anchor).
[x] A3  **End-of-list completion screen.** Gated `REVIEW_V2_CLIENT && !anyLoading && !progressHasError &&
        getPrimaryFocus && listFinished` (`:2112`) — REUSES the pre-existing `listFinished` derivation
        (V6) rather than adding a second one, per the brief's explicit instruction. Renders a completion
        badge, heading, a short body line, and two actions: "Browse past days" (routes to 51-c's browser,
        ALWAYS offered when the gate is true) and "Start next list" (gated `CONTINUATION_LINKS &&
        getPrimaryFocus.nextListId && getPrimaryFocus.nextListTitle`, the SAME three-condition guard the
        pre-existing "Advance to…" hero button already uses at `:2089` — reused, not reinvented).
        JUDGMENT CALL (see report, F-finding): the wireframe's three illustrative stats ("Days done" /
        "Re-studies" / "Best streak") are NOT reproduced — no landed authority (`pastDayAuthority.js`,
        `dayStatusAuthority.js`, `streakAuthority.js`) supplies a "count of re-studies" or a "best
        (historical-max) streak", and computing either locally would be exactly the "computing a state...
        inside Dashboard.jsx" the brief exists to prevent. Reported as a FINDING, not fabricated.
        BYPASS SET: not a closure/guard row (a net-new additive block) — no BYPASS SET applies; the
        fixtured proof is that the gate is add-only (C2.5) and that `listFinished` itself is byte-identical
        to HEAD (C3.2 — proving "reuse, don't redefine" mechanically, not just by assertion).
        OTHER LEG (flag-off): the four-condition `&&` chain's first operand short-circuits; `listFinished`
        (and everything downstream of it, e.g. the pre-existing hero copy that ALSO reads `listFinished`)
        is untouched (C3.2).
        DONE: `src/pages/Dashboard.jsx:2108-2134`. Fixtures: C2.5 (gate text-anchor) + C3.2 (listFinished
        byte-identity) + mutants M7/M8 (text-anchor).

## GROUP C — FIXTURES + MUTANTS
[x] C1  Pure fixtures (mirror-executed against the REAL `src/utils/pastDayAuthority.js` +
        `src/utils/dayStatusAuthority.js`), plain node, no emulator, no network, no browser —
        `scripts/deepfix2/df2-51f-entry-fixtures.mjs`. RESULT (from `docs/plans/deepfix2/evidence/
        df2-51f-entry-pure.json`): **73 checks, 0 failures, `pass:true`**.
        C1.1-C1.11: every case in A2's BYPASS SET (no visits → null; 'studied' visit selected; review-only
        recorded → label "New-word half not finished"; new-only recorded → label "Review half not
        finished"; the DEAD-END exclusion (F3/F4) → null; nearest-to-today respecting the exclusion (a
        dead-end at the nearest day does not block an earlier genuinely-resumable day); all-re-completed →
        null; malformed visit docs skipped, never throw; focused-list tie-break beats the alphabetical
        fallback; no-focus deterministic alphabetical fallback; the defensive third label branch).
        C2.1-C2.6: TEXT ANCHORS binding the mirror to the REAL `Dashboard.jsx` bytes — the flag constant
        itself; the three new imports/state exist exactly once; the read is gated + read-only + called
        exactly once; the memo's six load-bearing substrings (flag/array guard, dead-end formula,
        incomplete formula, loop direction, both tie-break clauses) present verbatim; all three render
        sites gated exactly once each, each routing to `/restudy/`; the resume-label ternary's three
        branches present verbatim, review checked before new.
        C3.1-C3.3: FLAG-OFF/BYTE-IDENTITY — a `git diff -U0` STRUCTURAL proof (exactly one hunk removes
        anything, exactly one line total, and that line is the declared import-line extension — see
        below); the specific legacy expressions this ledger cites (`listFinished`, `calculateStreak`, the
        df2-33 day-status ternary, both streak render sites, Start Session/Blind Spots) byte-identical to
        HEAD; every sibling file this fold must not touch (`pastDayAuthority.js`, `dayStatusAuthority.js`,
        `streakAuthority.js`, `restudyVisit.js`, `streakCredits.js`, `App.jsx`, `RestudyBrowser.jsx`,
        `RestudyBrowser.viewModel.js`, `featureFlags.js`) sha256-identical to HEAD.
        C4.1-C4.2: GREP-PROOFS — zero Firestore WRITE verbs added (this fold is read-only); the
        `REVIEW_V2_CLIENT` occurrence delta is exactly `+7` and the `listFinished` delta is exactly `+2`
        (both asserted as exact numbers, not just "some new gates").
        Does NOT re-test `pastDayAuthority.js` (cite `df2-51a-model-pure.json`, 115/0) — this fold consumes
        its output only (brief instruction).
[x] C2  Mutants, `scripts/deepfix2/df2-51f-entry-mutants.mjs` — **8 total, 8/8 killed**, covering the
        brief's 2 named minimums (M4 flag-off gate removed; M6 resume panel rendering with no visit) plus
        6 of this fold's own judgment-call clauses. TWO FAMILIES, NEITHER WRITES TO DISK (judgment call,
        see the report and the mutants file's own header for the full rationale — Dashboard.jsx is this
        program's single highest-blast-radius file, so even a restore-verified in-place mutation is
        avoided in favor of an equally-rigorous in-memory proof):
          M1  MIRROR — the dead-end `&& !deadEnd` conjunct dropped — kills the "dead-end nearest + earlier
              resumable" scenario (mutant wrongly selects the dead-end day).
          M2  MIRROR — nearest-to-today iteration reversed to earliest-first — kills the "two genuinely
              resumable days" scenario (mutant wrongly selects the earlier day).
          M3  MIRROR — the focused-list tie-break preference dropped — kills the "focused list among
              candidates" scenario (mutant wrongly falls through to the alphabetical fallback).
          M4  TEXT-ANCHOR — entry affordance's `REVIEW_V2_CLIENT &&` gate removed (**brief's 1st named
              minimum**) — the C2.5 anchor's count flips 1→0 on the in-memory mutated copy.
          M5  TEXT-ANCHOR — resume panel's `REVIEW_V2_CLIENT &&` gate removed — same anchor-count flip.
          M6  TEXT-ANCHOR — resume panel's `resumableDay &&` guard removed, flag gate left intact
              (**brief's 2nd named minimum — "resume panel rendering with no visit"**) — same flip.
          M7  TEXT-ANCHOR — end-of-list's `REVIEW_V2_CLIENT &&` gate removed — same flip.
          M8  TEXT-ANCHOR — end-of-list's `&& listFinished` guard removed (renders for an unfinished list)
              — same flip.
        M1-M3 run a MUTATED variant of the `resumableDay` mirror in-process against a fixtured scenario,
        built from the REAL `pastDayAuthority.js`, and assert the mutant's answer differs from the correct
        one. M4-M8 read `Dashboard.jsx`'s real bytes ONCE, apply the mutation to a JS STRING (the file
        handle/variable holding the on-disk bytes is never reassigned or written), and re-run the SAME
        anchor-counting logic C1's C2 group uses. A final belt check re-reads `Dashboard.jsx` from disk
        after every mutant and asserts its sha256 is IDENTICAL to the pre-run sha256 — confirmed `true`.
        RESULT (from `docs/plans/deepfix2/evidence/df2-51f-entry-mutants.json`): **8/8 killed, `pass:true`,
        `diskUntouched:true`**. `grep -c "\[MUTANT" src/pages/Dashboard.jsx` → 0 (no marker was ever
        written — there was never a write to mark).
[x] C3  ESLINT — `npx eslint src/pages/Dashboard.jsx`: **27 problems (26 errors, 1 warning)**, up from the
        pre-fold baseline of 26 (25 errors, 1 warning) — see V14. DELTA, verified by a MESSAGE-NORMALIZED
        diff (line:col stripped, not just a line-shifted diff — a stronger proof than a raw count, since a
        normalized diff cannot hide "one finding disappeared, a different one appeared"): ran `npx eslint`
        against BOTH the git-`HEAD` copy (via `--stdin`) and the current tree, stripped each line's
        leading `<line>:<col>` prefix, sorted, and diffed the remainder. RESULT: **zero lines present only
        in HEAD** (nothing regressed away) and **exactly one line present only in the current tree** —
        `error    React Hook "useMemo" is called conditionally. React Hooks must be called in the exact
        same order in every component render    react-hooks/rules-of-hooks` — i.e. the ONE new hook call
        V14 predicted (`resumableDay`'s `useMemo`, now at `:1775`), the same pre-existing, already-
        tolerated finding class as the file's other 11 instances (all on hooks declared after the
        `if (isTeacher) return` early-return, `:908`+ — a pre-fold structural fact, not introduced by this
        fold). No new `no-unused-vars`, no new `react-hooks/exhaustive-deps` — every dependency array
        (`loadRestudyVisits`'s enclosing effect: unchanged `[user?.uid, studentClasses, isTeacher]`;
        `resumableDay`: `[restudyVisits, progressData, userAttempts, getPrimaryFocus]`, matching every
        closure variable the memo body actually reads) is complete.

## GROUP D — TRUTH REPAIRS
[x] D1  None found. Grepped `df2-51f`/`resumableDay`/`restudyVisits` (this fold's own identifiers) across
        `docs/*.md`, `NEED_TO_FIX.md`, `change_action_log.md`, `WORK_QUEUE.md` before writing — none
        appear anywhere as already-characterized/already-landed, so there is no prior published sentence
        this fold's work falsifies. The design doc's own FOLD SPLIT table (`22_:251`) already correctly
        describes this fold as pending ("6. 51-f entry + resume panel + end-of-list") — no correction owed
        there either.

## GROUP E — CARDED, NOT THIS ROUND (so nothing is silently dropped)
[x] E1  **The wireframe's illustrative end-of-list stats ("Days done" / "Re-studies" / "Best streak") are
        NOT rendered — a FINDING, per the brief's own instruction ("if the model can't supply something
        the wireframe needs, that is a FINDING to report, not a thing to compute locally").** No landed
        authority (`pastDayAuthority.js`, `dayStatusAuthority.js`, `streakAuthority.js`, `streakCredits.js`)
        exposes an aggregate "count of restudy re-studies/re-tests" or a historical-MAXIMUM streak (only a
        CURRENT streak exists, `streakAuthority.js#deriveAccountStreak`). Computing either from raw
        `userAttempts`/`restudyVisits` inside `Dashboard.jsx` would be exactly the local-derivation
        anti-pattern this brief exists to prevent (Build §, "Computing a state or pip inside Dashboard.jsx
        is the error this brief exists to prevent"). "Days done" (`panelCState.currentStudyDay`, already
        in scope) COULD have been shown safely, but was left out too — see the report's judgment-call list
        for why (avoiding a half-populated stats row reading as broken). Escalate to whichever fold next
        touches the completion screen (the container train, `02_:170`/FF2-01) or to a dedicated aggregate-
        count fold if the product wants these numbers; not implemented here.
[x] E2  **The resume panel's cross-list tie-break has no true RECENCY signal (rare edge case).** When TWO
        OR MORE different lists each have a genuinely resumable day at once, this fold prefers the
        focused list, else the alphabetically-first `classId_listId` key — DETERMINISTIC, but not
        "whichever visit was actually touched most recently". A true cross-list recency comparison would
        need each candidate's own visit `createdAt` surfaced through the selection (available on the raw
        docs already fetched — `restudyVisits[i].createdAt` — but not threaded into the `resumableDay`
        candidate object today). Left out as a deliberately bounded judgment call (see the report) rather
        than adding an unfixtured timestamp comparator under this fold's time/scope; recorded so a future
        polish pass does not have to rediscover the gap.
[x] E3  **Typed-retest cap rendering (decision h) and NTF-27 reload persistence (decision i) are 51-d's**
        (`22_:249`, "Owns: MCQTest.jsx, TypedTest.jsx, reviewV2Client.js") — this fold's three affordances
        are all NAVIGATION-only (links to the 51-c browser, or in the entry affordance's case a plain
        route link); none of them compose a rerun, submit a test, or touch AI-metering/reload state.
        Recorded so this fold is not mistaken for having touched that surface.

## CLOSE
[x] every row ticked with file:line + fixture ref — V1-V14, A1-A3, C1-C3, D1, E1-E3 all [x] above.
[x] evidence re-run AFTER the last edit — both `df2-51f-entry-fixtures.mjs` and `df2-51f-entry-mutants.mjs`
    were re-run as the LAST two commands before writing this ledger (no edit to `Dashboard.jsx` followed
    either run); the mutants run's own `diskUntouched:true` + a fresh `sha256sum` (report) independently
    re-confirm the tree the evidence certifies is the tree left on disk.
[x] all shas re-stamped — `docs/plans/deepfix2/evidence/df2-51f-entry-pure.json`'s `sourceShas` and
    `docs/plans/deepfix2/evidence/df2-51f-entry-mutants.json`'s `dashboardSha256` were both produced by
    the LAST run, independently re-verified in the report via a fresh `sha256sum`.
[x] numbers re-derived from the evidence file, never typed — 73/0 (pure), 8/8 (mutants), the 26→27 eslint
    delta (message-normalized diff, not a hand count), the `+7`/`+2` grep deltas — every one copy-derived
    from a JSON file or a command run in this session, never hand-typed into this ledger first.
[x] change log row (ABSOLUTE path) — proposed row TEXT given in the report; NOT written to
    `/app/change_action_log.md` by this fold (hard constraint: the orchestrator appends it).
[~] `node scripts/deepfix2/gate.mjs --plan docs/plans/deepfix2/_ledgers/df2-51f-entry-fold-ledger.md` —
    CLEAN (0 failures, 0 warnings; verbatim in the report). `node scripts/deepfix2/gate.mjs
    docs/plans/deepfix2/_ledgers/df2-51f-entry-fold-ledger.md` — this fold's OWN checks are GREEN
    (LEDGER 32/32 ticked, MUTANT no residue, BATON idle, WATCHER alive, LOG has today's row); NUMBERS/
    CLAIMS/EVIDENCE show reds, ALL verified FOREIGN/pre-existing, none in this fold's touch-list or
    caused by this fold's edit going wrong (verbatim + the per-red breakdown in the report):
      - NUMBERS (fail) + CLAIMS (warn): `audit/deepfix/task3/live_baseline/*` and `17_DEPLOY_ORDER_
        REQUIREMENTS.md` — a pre-existing, repo-wide rules-matrix staleness that predates this session
        (`git diff --stat` against both paths is EMPTY — never touched here; file mtimes are ~41h old,
        before this session started) — the SAME class of foreign red the streak-authority fold's own
        ledger already recorded ("a pre-existing repo-wide staleness that predates this session").
      - EVIDENCE (fail), 3 receipts: (1) `cutover-c-complete-pure.json` re: `DailySessionFlow.jsx` — the
        CONCURRENT 51-e session's own in-flight edit (`git status` shows `M src/pages/DailySessionFlow.
        jsx` plus 51-e's own NEW ledger/evidence/fixture files this session; I never opened that path for
        write). (2) `dashboard-df2-33-pure.json` and (3) `dashboard-streak-authority-pure.json`, both
        re: `src/pages/Dashboard.jsx` — MY edit legitimately changed the FILE'S overall sha (added
        content), which stales any PRIOR fold's frozen sha-pin for the same shared file — a structural,
        expected consequence of sequential folds on one file (df2-33 caused the identical staleness for
        the streak-authority evidence when IT landed; both receipts' stored sha,`b756400f26501f69`,
        equals HEAD exactly, confirming they were current UNTIL this fold's edit, not already broken).
        Independently re-verified (outside my own C3.2 fixture case, via a fresh script reading BOTH
        HEAD and the current tree) that every guarantee-bearing substring those two folds actually care
        about — the day-status ternary, `calculateStreak`'s signature, both streak render sites, the
        `listFinished` derivation — is present EXACTLY ONCE in both, unchanged. Refreshing those two
        evidence files only requires RE-RUNNING their own already-existing, unmodified fixture scripts
        (`dashboard-df2-33-fixtures.mjs`, `dashboard-streak-authority-fixtures.mjs`) — a trivial, safe
        follow-up, but their evidence JSONs are not named by this brief's touch-list ("your fixtures/
        mutants... their evidence JSONs" — not df2-33's/streak-authority's), so NOT done here; flagged
        for the orchestrator instead of silently worked around.
[~] commit — CARDED, not this session: hard constraint forbids `git add`/`git commit` for an implementer
    sub-agent; committing (if the orchestrator chooses to) is its job, not this fold's.
[x] VISUAL CHECK — N/A this session, stated plainly rather than claimed: WSL cannot run vite (brief's own
    constraint, CLAUDE.md's "UI FOLDS: THE VISUAL CHECK IS A WINCLAUDE ORDER"); a browser check is the
    LATER, BATCHED WinClaude order 51-h (`22_:253`, "one batched WinClaude visual order across the whole
    train"), not this fold's to run or claim. This fold's report names the three new elements + their
    exact flag-off-absence claim for that future order to verify.
[x] footprint — touched ONLY: `src/pages/Dashboard.jsx` (edited), `scripts/deepfix2/
    df2-51f-entry-fixtures.mjs` (new), `scripts/deepfix2/df2-51f-entry-mutants.mjs` (new),
    `docs/plans/deepfix2/evidence/df2-51f-entry-pure.json` (new), `docs/plans/deepfix2/evidence/
    df2-51f-entry-mutants.json` (new), this ledger (new). Nothing staged, nothing committed.
    `src/pages/DailySessionFlow.jsx` (51-e, concurrently in flight this session) was NEVER opened for
    write here — confirmed by this session's own tool-call history, not just by `git diff` (which cannot
    distinguish "I didn't touch it" from "a concurrent session's edits happen to net to what's already
    there"). `src/utils/pastDayAuthority.js`, `src/utils/dayStatusAuthority.js`,
    `src/utils/streakAuthority.js`, `src/services/restudyVisit.js`, `src/services/streakCredits.js`,
    `src/App.jsx`, `src/pages/RestudyBrowser.jsx`, `src/pages/RestudyBrowser.viewModel.js`,
    `src/config/featureFlags.js`, `functions/**`, `firestore.rules`, and every flag value never opened
    for write — sha256-identical to HEAD, fixtured (C3.3).
