# DASHBOARD STREAK AUTHORITY — FOLD LEDGER (NTF-25; read the server credit when the engine owns the day)

Built from the dashboard-streak-authority scout (2026-08-04, file:line throughout). Behind `REVIEW_V2_CLIENT`
(still false), the Dashboard reads the ACCOUNT-WIDE server `streak_credits` ledger (a DIRECT client query —
rules already allow it) and derives the R2-21 streak number, instead of computing a per-list streak
client-side. The client `calculateStreak` stays the flag-off path.

**WHY NOW:** cutover-c (committed) makes `completeDay`'s partial update never write `class_progress.streakDays`
(`completion.js:715-723`, 5 fields, streakDays absent — same doc the Dashboard reads), so once the engine
owns completions the client's `streakDays` FREEZES. This fold makes the server credit the display authority.

**SCOPE + A DECISION (orchestrator):** the server ledger is ACCOUNT-WIDE — one credit per KST date per uid,
regardless of class/list (R2-21, `02_TASK_LIST.md:108` item 9, David-ratified). The client's streak is
PER-(classId,listId). So reading the server authority INHERENTLY changes the flag-on display from per-list
to account-wide. This IMPLEMENTS R2-21 (not a new product call). **`dashboard-df2-33` (sequenced
`after:dashboard-streak-authority`) owns the hero/per-list PRESENTATION unification** — this fold makes the
account-wide server streak the authority behind the flag; df2-33 settles how it's shown. CLIENT-ONLY fold
(direct read, no new callable, no functions deploy dependency).

## GROUP V — VERIFY BEFORE EDITING
[x] V1  **How the Dashboard reads/displays streak today** (scout §1). `calculateStreak`
        (`Dashboard.jsx:38-123`, PER-(classId,listId): inputs `recentSessions`+`studyDaysPerWeek`; weekend-skip
        if `studyDaysPerWeek<=5`; freshness gate :99-119 ⇒ 0 if the last session isn't today/yesterday).
        Consumed ONCE at `:1399`: `progress.streakDays ?? calculateStreak(...)` inside `panelBState` useMemo
        (:1355-1416); `progress` is the FOCUSED (classId,listId). Displayed at exactly 2 sites: hero pill
        (:1809), stat tile (:1937). No other consumer (grep-confirmed).
[x] V2  **The server ledger + the ACCOUNT-WIDE cardinality (the key fact).** `users/{uid}/streak_credits/
        {kstDate}` = `{classId,listId,dayNumber,resetEpoch,createdAt}` (`completion.js:745-748`; frozen
        `15_H6_SCHEMAS_AND_CONTRACTS.md:192`). `kstDate` = UTC+9 `YYYY-MM-DD` (`completion.js:87-89`),
        lexicographic=chronological. **ONE credit per date per UID** (create-if-absent, :744) — a second
        completion the same date (ANY class/list) is skipped ⇒ ONE account-wide streak. Weekend-skip is a
        READ-TIME computation, NOT stored (:53-58). Only the boolean `streakCredited` reaches the client today
        (`reviewV2Complete.js:215`); no length is derived anywhere yet.
[x] V3  **The read path + the derivation (both new).** Rules ALREADY allow a direct client read:
        `streak_credits` is server-owned for WRITES only (`firestore.rules:249-268`); the generic
        `allow read: if isAuthenticated() && (isOwner||isTeacher)` (`:239`) is not restricted ⇒ NO rules
        change. DECISION: a DIRECT client query (the ledger is the authority; the client presents) — not a new
        callable (avoids a functions deploy). Derivation (new helper): query `streak_credits` ordered by
        `documentId()` desc, bounded `limit`, walk backward with FIXED Sat/Sun skip (R2-21 has no
        `studyDaysPerWeek`) + the SAME freshness gate `calculateStreak` applies (`:99-119`).
[x] V4  **Flag-off parity — and the THREE OTHER streakDays writers to leave alone** (scout §4). `calculateStreak`
        + the `:1399` expression + the `streakDays:0` branches (:1369/:1384/:1412) + the destructure (:1419) +
        both render sites BYTE-IDENTICAL flag-off. Also DO NOT touch the other `streakDays` writers: legacy
        `updateClassProgress`/`recordReviewOutcome` (`progressService.js`) and the `SERVER_PROGRESS_WRITE`
        mirror (`foundation.js:400-432`) — out of scope.
[x] V5  **READ-ONLY obligation.** The streak read must be STRICTLY read-only — no writes from a dashboard
        render (the ordered-write pipeline must never run from a display). Scout confirmed Dashboard.jsx is
        already read-only re progress (only `persistFocus` + class/list CRUD; imports pure-read `getClassProgress`).
        Whatever reads `streak_credits` must not reach `completeDay`/the completion txn.

## GROUP A — DELTAS
[x] A1  Behind `REVIEW_V2_CLIENT`, read the account-wide server streak + derive the R2-21 number; branch the
        display at `:1399`: `REVIEW_V2_CLIENT ? serverStreak : (progress.streakDays ?? calculateStreak(...))`.
        Add the read + a `serverStreak`/loading state to the progress-loading effect (`:677-746`), keyed on
        `uid` (account-wide, NOT the per-(classId,listId) loop), joining the `panelBState` deps.
        BYPASS SET (one fixture each for the DERIVATION, which is a pure fn): fresh account-wide streak
        (credits through today) → derived count · a broken streak (a gap) → stops at the gap · weekend gap
        (Fri→Mon, no credit needed) → continues · a STALE streak (no recent credit) → freshness gate ⇒ 0 ·
        no credits → 0 · a two-list student → ONE account-wide number flag-on (not per-focus).
        OTHER LEG: flag-off, `calculateStreak` + the `:1399` expression + the render byte-identical.
        DONE: `src/pages/Dashboard.jsx` — import (:23-24), `serverStreak`/`serverStreakLoading` state
        (:334-335), `loadServerStreak` in the progress-loading effect (:705-717, called :781), the
        loading gate + branch in `panelBState` (:1435-1446), deps (:1463). Derivation:
        `src/utils/streakAuthority.js#deriveAccountStreak`. BYPASS SET fixtured in
        `scripts/deepfix2/dashboard-streak-authority-fixtures.mjs` (C1 cases: fresh/broken/weekend-gap/
        stale/empty/two-list, 32/32 green) + OTHER LEG static anchors (C2 cases, same file/run).
[x] A2  The READ itself (the Firestore query), gated behind the flag and read-only. Fixture the query shape
        (ordered by docId desc, limit) against seeded credits (emulator or a mock); assert it never writes.
        DONE: `src/services/streakCredits.js#fetchCreditDocs`/`fetchAccountStreak` — `db` injected (never
        `../firebase.js`), no `classId`/`listId` filter. Query shape: STATIC anchor (QS-DESC-STATIC, pure
        fixtures) + LIVE against a real rules-enforced emulator for everything the local Firestore emulator
        can execute (`dashboard-streak-authority-emulator.mjs`, 9/9 green — see that file's header for the
        ONE sub-claim, "desc" itself, the LOCAL emulator cannot execute, and why that is a tooling gap, not
        a code defect). Read-only: structural (C3 in the pure fixtures) + behavioral (READ-ONLY case,
        emulator fixtures).

## GROUP C — FIXTURES + MUTANTS
[x] C1  Pure fixtures for the derivation (A1 bypass rows: fresh/broken/weekend/stale/empty — the R2-21 walk +
        freshness), no emulator needed (a pure fn over credit docIds + a "today").
        DONE: `scripts/deepfix2/dashboard-streak-authority-fixtures.mjs` (all 6 named cases + a
        `kstDateString` KST-boundary case + the two-list case) — evidence
        `docs/plans/deepfix2/evidence/dashboard-streak-authority-pure.json` (32/32, `pass:true`).
[x] C2  FLAG-OFF PARITY: `calculateStreak` path byte-identical; the branch is add-only at `:1399`.
        DONE: static anchors in the same pure-fixtures run — `calculateStreak`'s function body
        byte-identical to HEAD, the legacy expression present verbatim, both render sites unchanged, the
        three `streakDays: 0,` branches untouched (3 in current == 3 at HEAD), the destructure line
        byte-identical to HEAD, AND the other 2 `streakDays` writers (`progressService.js`,
        `functions/foundation.js`) sha-identical to HEAD (untouched, out of scope).
[x] C3  The read (A2) against seeded `streak_credits` — the account-wide (per-uid, not per-list) shape;
        assert read-only (no writes).
        DONE: structural half (no write verb in `streakCredits.js`'s own `firebase/firestore` import line)
        in the pure fixtures; behavioral half (doc count unchanged across a real read) in the emulator
        fixtures' READ-ONLY case.
[x] C4  MUTANT: reverse the freshness gate (a stale streak shows non-zero) ⇒ the stale fixture goes red.
        DONE: `scripts/deepfix2/dashboard-streak-authority-mutants.mjs` M-C4 — killed (7 red checks),
        restore verified clean. Evidence `docs/plans/deepfix2/evidence/dashboard-streak-authority-mutants.json`.
[x] C5  MUTANT: make the derivation per-list (filter by classId/listId) ⇒ the two-list account-wide fixture
        goes red (pins the account-wide cardinality).
        DONE: same mutants run, M-C5 (targets `streakCredits.js`, since the pure derivation never receives
        `classId`/`listId` at all — see that file's header for why the mutant necessarily lives at the READ
        layer) — killed (1 red check), restore verified clean.

## GROUP D — TRUTH REPAIRS
[x] D1  NTF-25 says "grep streak_credits in src/ returns NOTHING" — this fold makes the Dashboard read it
        flag-on. Correct NTF-25 (and any 10_/dashboard comment) at source when this lands.
        DONE: NEED_TO_FIX.md item 25 line 101 corrected (grep now returns streakCredits.js +
        streakAuthority.js + the Dashboard.jsx call site; two-authorities RESOLVED behind the flag,
        latent until the flip; E1/E2 named as remaining flag-on/rehearsal work). Verified truthful:
        `grep -rn "streak_credits" src/` returns exactly those 3 files (orchestrator, post-fold).

## GROUP E — CARDED, NOT THIS ROUND
[ ] E1  **The account-wide-vs-per-list PRESENTATION unification → `dashboard-df2-33`** (scout §3 open question,
        `WORK_QUEUE.md:37`, "the first concrete instance"). This fold makes the account-wide server streak the
        authority; df2-33 settles the hero + per-list display (whether/how per-list streaks are shown, since
        the server has only one). Do NOT redesign the presentation here.
[ ] E2  **Epoch/reset can hole the account-wide streak** (scout §2/gotcha d): a per-list reset deletes credits
        tagged with THAT list's `listId` (`reset.js:44-54`) but the streak is account-wide ⇒ an undesigned
        hole. Nothing reads the ledger today, so it's latent; card it — belongs with the reset/epoch design.

## CLOSE
[x] every NON-CARDED row ticked (file:line + fixture) — V1-V5, A1-A2, C1-C5, D1 all [x]; E1/E2 CARDED
    (GROUP E, "not this round"), VISUAL owed (below).
[x] evidence re-run after last edit — orchestrator re-ran pure 32/0 + mutants 2/2 (killed, restore clean);
    emulator 9/0 from the implementer's run (needs the emulator; sourceShas MATCH).
[x] shas re-stamped — the fixtures run recomputes sourceShas at run time; MATCH the current tree.
[x] numbers re-derived — 32/0, 2/2, 9/0 read from the evidence JSONs, not hand-typed.
[x] change log row — written 2026-08-04.
[~] gate.mjs (explicit ledger path): the FOLD'S OWN checks are GREEN — FREEZE (evidence post-dates the
    last edit; sha 4d8e511b; matrix 840f59d2), MUTANT (no residue), BATON (idle/claude), WATCHER (alive),
    LOG (today's row). The reds are ALL foreign/carded, each verified out-of-footprint: LEDGER = E1/E2
    (carded) + a CLOSE-section multi-checkbox PARSING artifact (the regex matches `[ ] <word>` fragments);
    NUMBERS/CLAIMS/EVIDENCE = `audit/deepfix/task3/*`, `17_DEPLOY_ORDER_REQUIREMENTS.md`,
    `engine-lap-result.json` — none in this fold (a pre-existing repo-wide staleness that predates this
    session, git-history-confirmed). A fully-green gate is impossible until that separate pre-deploy
    staleness clears; this fold does not touch any of it.
[x] commit
[x] **VISUAL CHECK** — CLOSED CLEAN, win order 103 TASK 1 (2026-08-04): the Dashboard LOADS FULLY flag-off
    (the new `streakCredits`/`streakAuthority` imports don't break mount) AND the streak renders UNCHANGED
    ("1-day streak" pill + "1 days" tile, a real styled number, no NaN/undefined); 0 console errors. Flag-ON
    display is df2-33's + the rehearsal's (account-wide number is dead until the flip). 25WT. See winclaude_103.md.
[x] concurrent session shares the repo — stage explicitly (Dashboard.jsx + 2 new src + 3 fixtures + 3
    evidence + ledger + NEED_TO_FIX + WORK_QUEUE + change log; NOT .claude/*, NOT the win baton).
[x] implementer PAIRED with independent verification — orchestrator LEVEL-4 re-execution (the strongest
    rung, stronger than an auditor's level-2 diff read): re-ran the evidence, confirmed `calculateStreak`
    BYTE-IDENTICAL to HEAD, the branch add-only, `REVIEW_V2_CLIENT` still false, nothing staged, baton idle.
    Proportionate for a flag-gated CLIENT-ONLY fold whose flag-off path is mechanically byte-identical and
    whose flag-on derivation is fixture+mutant-pinned AND gets independently exercised at the rehearsal.
    (A separate auditor agent would verify LESS than this re-execution; the live-surface runtime risk is
    covered by the owed WinClaude visual check, which is independent.)
