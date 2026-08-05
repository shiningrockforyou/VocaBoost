# DF2-51-b VISIT LIFECYCLE — FOLD LEDGER, **ACTIVE**

Brief: `_ledgers/df2-51b-visit-BRIEF.md`. Fold 2/8 of the DF2-51 train
(`22_DF2-51_PASTDAY_NAV_DESIGN.md` §7 RATIFIED). Runs in PARALLEL with 51-a
(`src/utils/pastDayAuthority.js`) — disjoint file sets, not touched here.

**WHAT THIS FOLD DOES:** a new client-only module, `src/services/restudyVisit.js`,
that lazily mints a restudy `visitId` at the first rerun compose, persists it in
`sessionStorage` under a `composeKeyScope`-mirroring key that ADDS `resetEpoch`,
discards it on completion/leave/refusal, and re-mints exactly once on a
visit-invalidating refusal before surrendering. **No caller exists yet** — 51-c/51-d
wire the browser UI and the actual `composeRerun`/submit calls. This fold ships dark,
exactly like 51-a: nothing calls it, so there is no flag-off-parity claim to make
(nothing renders differently either way) and no route/page is touched.

## GROUP V — VERIFY BEFORE EDITING (every citation re-read in the working tree today)

[x] V1  **The wrapper this fold calls already exists — no edit to it.**
        `src/services/reviewV2Client.js:206-209`: `export function mintVisit({classId,
        listId, day}) { return call('reviewV2MintVisit', {classId, listId, day}) }` —
        matches `22_DF2-51...md` §2's own finding ("No edit to the wrapper is
        needed"). uid is NOT a param (server derives it from `requireAuth`,
        `callables.js:903`) — my scope-key uid comes from the CALLER, not from this
        call.

[x] V2  **The server-side visitId-required-at-submit contract, exact lines (brief
        cited ~739-741; current tree has it at 748-757 — drift noted, re-anchored).**
        `functions/reviewV2/callables.js:747-758`:
        ```
        if (isRerunTxn) {
          if (typeof p.visitId !== "string" || p.visitId.length === 0) {
            return {status: "visit_invalid", reason: "rerun presentation lacks visitId"};
          }
          visitSnap = await txn.get(db.doc(`users/${uid}/restudy_visits/${p.visitId}`));
          if (!visitSnap.exists) return {status: "visit_invalid", reason: "visit missing"};
          const v = visitSnap.data();
          if (v.uid !== uid || v.classId !== p.classId || v.listId !== p.listId ||
              v.day !== p.logicalDay || v.resetEpoch !== p.resetEpoch) {
            return {status: "visit_invalid", reason: "visit tuple mismatch"};
          }
        }
        ```
        Confirms the brief's premise: a lost/mismatched `visitId` refuses the
        submit with `visit_invalid`, minting nothing — this module's whole job is
        making sure the client always has the RIGHT one in hand.

[x] V3  **`mintRestudyVisit`'s own input law, mirrored client-side.**
        `functions/reviewV2/visits.js:42-47`: requires non-empty string
        uid/classId/listId, `Number.isInteger(day) && day>=1`,
        `Number.isInteger(resetEpoch) && resetEpoch>=0`. My `isValidArgs` guard
        (restudyVisit.js) mirrors this exact shape so a malformed handle fails
        BEFORE touching storage or the network — same "fail loud on a malformed
        handle" law `reviewV2Submit.js:258-268` states for its own request.

[x] V4  **`mintRestudyVisit` has NO idempotency key — every call mints a FRESH
        doc.** `visits.js:67`: `const ref = db.collection(...).doc();` (a bare
        auto-id, no derived/replay docId like `engineDocId`/`queueDocId`
        elsewhere in the engine). This is why "same scope returns the SAME id"
        (client-side caching BEFORE minting) is load-bearing, not an optimization:
        without it, every page load/re-render that calls mint would orphan a new
        `restudy_visits` doc. Confirms the brief's B1-vs-B2 rejection reasoning
        from a second angle.

[x] V5  **The visit half-pairing CAS + the discard-trigger data source.**
        `visits.js:92-130` (`recordRerunHalfInTxn`): set-once per half (`:108-110`),
        completes+increments the SAME txn when both are set (`:112-128`). Its
        `{recorded, completedVisit}` return is persisted at
        `callables.js:824-827` (`attempt.engineResult = {..., visitHalf}`) and
        RETURNED on the `attempt_written` response itself, `callables.js:831-838`
        (`visitHalf` is a top-level key of the returned object). ⇒ the brief's
        "discard it when the visit reads `completed:true`" trigger is fed by a
        rerun submit's OWN response, never a direct Firestore read — grounds the
        brief's "No Firestore calls in this fold" constraint concretely: this
        module exposes `noteVisitCompleted(scope, visitHalf)` that a FUTURE
        caller (51-d) feeds from that response; it never calls `getDoc` itself.

[x] V6  **The recompose-once idiom this fold's re-mint-once must mirror, exact
        lines.** `src/services/reviewV2Submit.js`:
        - storage trio `recomposeGuardScope`/`recomposeUsed`/`markRecomposeUsed`/
          `clearRecomposeGuard`, `:104-124` (scope string, `getItem==='1'`,
          `setItem('1')`, `removeItem`).
        - mark BEFORE the remedial action, fail-closed across a crash: `:334-336`
          ("Mark BEFORE recomposing — fail-closed: a crash/reload between the
          mark and the recompose costs the automatic retry, never mints a loop").
        - the guard STAYS SET through the remedial action's own success
          (`outcome:'recomposed'`, `:353-355`) — it is cleared only by a LATER,
          SEPARATE call's success (`attempt_written`, `:304-306`), never by the
          repair action itself succeeding. My `remintVisitOnRefusal` mirrors this
          exactly: `markVisitRemintUsed` runs before `mintFresh`'s remedial
          call, and the guard is cleared only by `noteVisitCompleted`/
          `noteVisitLeft` (a later, independent signal) — never inside
          `remintVisitOnRefusal` itself.
        - `composeKeyScope`, `reviewV2Compose.js:97-99`:
          `` `rv2ck.${uid}.${classId}.${listId}.d${logicalDay}.${kind}` `` —
          **deliberately EXCLUDES resetEpoch** (`:92-96`: "the client cannot know
          it pre-compose"). My `visitScopeKey` mirrors the shape but ADDS
          `.e${resetEpoch}` per the brief's explicit law — the one deliberate
          delta from the mirrored convention, and the reason it cannot be a
          straight re-export.

[x] V7  **FINDING — `reviewV2Client.js`'s own "only 2 of 5 not-serving statuses
        arrive as data" comment is INCOMPLETE for the mint-visit path (does not
        contradict this brief; recorded per "report it, do not design around it
        silently").** `reviewV2Client.js:100-107` states `class_not_found`/
        `not_enrolled`/`list_not_assigned` are "THROWN as HttpsError" and never
        arrive as data. True for `resolveAndGate` (`callables.js:158-160`,
        throws). But `mintRestudyVisit`'s txn re-checks posture via
        `assertServableInTxn` (`visits.js:57`), and THAT function
        (`functions/reviewV2/config.js:269-271`) returns those same three
        statuses as **DATA** (`return {status:"class_not_found"}` etc.) when a
        race (un-enrolled/un-assigned between preflight and the txn) trips it
        in-txn rather than at preflight. Harmless here: `isNotServing`
        (`reviewV2Client.js:122-127`) checks Set membership across all five
        regardless of channel, and `mintFresh` (this module) calls it BEFORE
        falling through to a generic 'blocked' — so the data-channel case is
        already covered. Not fixed (out of touch-list: `reviewV2Client.js`'s
        comment is not mine to edit) — reported to the orchestrator as GROUP E.

[x] V8  **PURITY check — no react/firebase/firestore import, only the two
        established service modules.** `grep -n "^import" src/services/restudyVisit.js`
        (run AFTER the file exists, re-verified in CLOSE below) must show only
        `./reviewV2Client.js` and `./reviewV2Compose.js` — both already-existing,
        already-certified modules (their bytes stay untouched — no edit planned
        to either).

## GROUP A — DELTAS (the module to build)

[x] A1  **DONE.** **Scope keys + storage primitives.** `visitScopeKey({uid,classId,listId,
        day,resetEpoch})` → `` `rv2visit.${uid}.${classId}.${listId}.d${day}.e${resetEpoch}` ``
        (mirrors `composeKeyScope`'s shape, V6). `visitRemintGuardScope` → same
        tuple, `rv2vru.` prefix (mirrors `recomposeGuardScope`, V6) — a SEPARATE
        storage key from the visit id itself. Stored VALUE is a JSON envelope
        `{schemaVersion, visitId, uid, classId, listId, day, resetEpoch, mintedAt}`
        (tuple ECHOED alongside the id) so a structurally-valid-but-foreign/stale
        value is caught without inventing an assumption about Firestore auto-id
        shape (no such shape is frozen anywhere in the engine contract — a
        judgment call, see the report). `defaultStorage()` mirrors
        `reviewV2Compose.js`'s probe-then-memory-fallback (`:78-90`) —
        re-declared, not imported (both source modules keep theirs private,
        same as `reviewV2Submit.js` does).
        FIXTURE COVERAGE (no Firestore bypass set applies — zero writes in this
        fold; the equivalent coverage matrix is the discard-trigger set below):
          CASE "SCOPE" (shape + resetEpoch inclusion) · CASE "SCOPE ISOLATION"
          (day/list/class/resetEpoch each produce a DIFFERENT id) · CASE
          "STALE/CORRUPT" (malformed JSON / wrong tuple / old schemaVersion
          discarded, not used, self-heals).
        IMPLEMENTED: `restudyVisit.js:117-146` (scope keys), `:96-115`
        (storage), `:149-177` (envelope read/write validation).

[x] A2  **DONE.** **`peekVisitId` — read-only, NEVER mints.** Proves
        "mint-on-first-compose only (never on browse)" together with A3: a
        "browse" caller uses this and never trips the injected mint function.
        IMPLEMENTED: `restudyVisit.js:188-193`.
        BYPASS SET: N/A — a pure read, zero writes anywhere (see A3's note;
        same reasoning applies).
        FIXTURE: CASE "MINT-ON-FIRST-COMPOSE-ONLY" — including passing a spy
        `mintVisitFn` into `peekVisitId`'s (ignored) deps so a REGRESSION that
        made peek read it would be caught, not just a regression that made
        peek call its own default (mutant M6 proved this distinction: the
        first draft of this case did NOT wire the spy into peek and M6
        survived; fixed before close — see the report's judgment-call list).

[x] A3  **DONE.** **`getOrMintVisit({uid,classId,listId,day,resetEpoch}, deps)` — the lazy
        mint entrypoint.** Cache hit ⇒ `{outcome:'cached', visitId}`, ZERO network
        calls (proves "same scope returns the SAME id"). Cache miss ⇒ calls
        `deps.mintVisitFn ?? mintVisit` (V1), stores + returns
        `{outcome:'minted', visitId}` on `RV2.VISIT_MINTED`; not-serving (data OR
        thrown, V7) ⇒ `{outcome:'unavailable', ...}` (deliberately NOT 'legacy' —
        judgment call, see report: restudy has no legacy fallback path to name);
        any other refusal ⇒ `{outcome:'blocked', status, reason}` via
        `visitRefusalReason` (shared statuses reuse `reviewV2Compose.js`'s
        `refusalReasonText`, V6; `VISIT_INVALID` gets its OWN line — absent from
        `REFUSAL_REASONS`, confirmed by re-reading `reviewV2Compose.js:146-179`).
        Malformed handle (V3) ⇒ blocked `malformed_request`, storage/network
        untouched.
        BYPASS SET: N/A — this fold makes zero Firestore writes (mint is a
        callable; the doc write happens server-side, already covered by
        `mintRestudyVisit`'s own frozen contract, V3/V4). The Firestore
        create/update/delete/set-merge/etc. matrix does not apply; the
        equivalent coverage here is the OUTCOME matrix (cached/minted/
        unavailable/blocked/malformed_request), each fixtured below.
        FIXTURE: CASE "MINT-ON-FIRST-COMPOSE-ONLY" · CASE "SCOPE ISOLATION" ·
        CASE "NOT-SERVING / THROWN" · CASE "REFUSAL COPY" · CASE "VALIDATE".
        IMPLEMENTED: `restudyVisit.js:340-361` (`getOrMintVisit`), `:294-318`
        (`mintFresh`, the shared mint call shared with the remint path),
        `:281-286` (`visitRefusalReason`).

[x] A4  **DONE.** **Discard triggers — `noteVisitCompleted` / `noteVisitLeft`.**
        `noteVisitCompleted(scope-tuple, visitHalf, opts)` clears ONLY when
        `visitHalf?.completedVisit === true` (fed by the caller from a rerun
        submit's OWN response, V5 — never a `getDoc`); `noteVisitLeft`
        unconditionally clears. BOTH also clear the re-mint guard (JUDGMENT
        CALL — see report: a completed or abandoned visit closes any open
        remint incident for that scope, so a future deliberate re-entry gets a
        fresh one-shot budget rather than inheriting a stale surrender).
        BYPASS SET: N/A — no Firestore writes here either (sessionStorage
        `removeItem` only); the discard-trigger set (completed / leave /
        refusal, enumerated across A4/A5) IS this fold's coverage matrix.
        FIXTURE: CASE "COMPLETED" · CASE "LEAVE".
        IMPLEMENTED: `restudyVisit.js:240-251` (`noteVisitCompleted`),
        `:253-259` (`noteVisitLeft`).

[x] A5  **DONE.** **`remintVisitOnRefusal({...,refusalStatus}, deps)` — re-mint EXACTLY
        ONCE, mirroring V6.** Only acts on `isVisitInvalidatingStatus(status)` ∈
        {`visit_invalid`,`reset_epoch_mismatch`,`reset_in_progress`} (brief
        decision (b)'s exact three) — anything else ⇒ `{outcome:'ignored'}`,
        state untouched. On an eligible status: discard the (now-known-bad)
        stored visit unconditionally; if the guard is already used ⇒
        `{outcome:'surrendered', reason}` (own copy, `REASON_VISIT_SURRENDERED`),
        NO mint call — never loop; else mark the guard used BEFORE minting
        (V6 fail-closed order) and attempt ONE remedial mint, relabeling a
        success `'minted'→'reminted'` for caller clarity.
        BYPASS SET: N/A — same reason as A3/A4 (zero Firestore writes; the
        coverage matrix is the three eligible statuses × the guard's
        used/unused states, fixtured below).
        FIXTURE: CASE "REMINT-ON-REFUSAL" (all three eligible statuses
        individually + a non-eligible status ignored + discard-before-remint +
        mark-before-mint ordering + the second-refusal-surrenders law).
        IMPLEMENTED: `restudyVisit.js:385-410` (`remintVisitOnRefusal`),
        `:358-364` (`VISIT_INVALIDATING_STATUSES`/`isVisitInvalidatingStatus`).

[x] A6  **DONE.** **Storage never throws into a caller.** Every storage op
        (`getItem`/`setItem`/`removeItem`) wrapped try/catch, mirroring
        `reviewV2Compose.js`/`reviewV2Submit.js` exactly (V6). A throwing
        storage degrades the FEATURE (mint still round-trips the network; it
        just cannot cache, so a subsequent call in the SAME run mints again)
        without throwing OUT of `peekVisitId`/`getOrMintVisit`/
        `remintVisitOnRefusal`/the discard triggers.
        BYPASS SET: N/A — no Firestore writes; the coverage matrix is "every
        storage op, tried while it throws", fixtured below.
        FIXTURE: CASE "STORAGE DEGRADES".
        IMPLEMENTED: try/catch on every storage op throughout
        `restudyVisit.js` (`:96-108` defaultStorage probe, `:151`/`:165`
        read, `:176` write, `:207`/`:214`/`:220`/`:227` discard+guard trio).

## GROUP C — FIXTURES + MUTANTS

[x] C1  **DONE.** One pure-node CASE per A-row's fixture coverage (12 cases —
        the brief's 8 required + 4 I added: SCOPE shape, NOT-SERVING/THROWN,
        REFUSAL COPY, PURITY). Evidence:
        `docs/plans/deepfix2/evidence/df2-51b-visit-pure.json` — **192/0**
        (numbers re-derived from that file — see CLOSE).
[x] C2  **KILLED.** MUTANT M1 "drop resetEpoch from the scope key" (brief
        minimum #1) — kills CASE "SCOPE ISOLATION" (5 red checks).
[x] C3  **KILLED.** MUTANT M2 "allow unlimited re-mints" (brief minimum #2) —
        kills CASE "REMINT-ON-REFUSAL" (21 red checks — all three eligible
        statuses' surrender assertions, ×3, plus the discard-before-remint
        follow-on case).
[x] C4  **KILLED.** MUTANT M3 "a cached id survives a completed visit" (brief
        minimum #3) — kills CASE "COMPLETED" (4 red checks).
[x] C5  **KILLED.** MUTANT M4 "accept a corrupt/foreign stored envelope" (my
        addition, new clause = the JSON-envelope validation) — kills CASE
        "STALE/CORRUPT" (8 red checks).
[x] C6  **KILLED.** MUTANT M5 "a throwing storage propagates instead of
        degrading" (my addition, new clause = the try/catch degrade law) —
        kills CASE "STORAGE DEGRADES" (6 red checks — required a fixture
        robustness fix first: the case's raw `.includes`/unwrapped calls
        would have let the mutant's throw CRASH the suite instead of turning
        it red; rewritten with `safely`/`safelyAsync` wrappers, see report).
[x] C7  **KILLED.** MUTANT M6 "peek triggers a mint" (my addition, new clause
        = the read/mint separation) — kills CASE "MINT-ON-FIRST-COMPOSE-ONLY"
        (8 red checks — required a fixture fix too: the first draft never
        passed a spy `mintVisitFn` into `peekVisitId`'s deps, so the mutant's
        extra read of `deps.mintVisitFn` had nothing to trip; fixed before
        close).
        Evidence: `docs/plans/deepfix2/evidence/df2-51b-visit-mutants.json` —
        **6/6 killed, restore clean, zero `[MUTANT` residue** (re-verified by
        a fresh `grep -c "\[MUTANT" src/services/restudyVisit.js` ⇒ 0 after
        the final run — see CLOSE).

## GROUP D — TRUTH REPAIRS
N/A — first pass on a brand-new module; nothing previously published to correct.

## GROUP E — CARDED, NOT THIS ROUND
[~] E1  V7's finding (`reviewV2Client.js:100-107`'s "only 2 of 5 arrive as data"
        comment is incomplete for the mint-visit path specifically) is a
        documentation nit in a file OUTSIDE this fold's touch-list. Not fixed
        here. Reported to the orchestrator; harmless to this fold's own
        correctness (V7 shows `isNotServing` already covers it).
[~] E2  This fold has no caller and is therefore untested end-to-end against a
        REAL `mintVisit` HTTPS round-trip (only `deps.mintVisitFn` fakes are
        exercised). That integration proof belongs to 51-d, which wires the
        actual `composeRerun`/submit call sites — carded there, per the brief's
        own "No Firestore calls in this fold" boundary.

## CLOSE
[x] every row ticked with file:line + fixture ref — GROUP V (V1-V8), GROUP A
    (A1-A6), GROUP C (C1-C7) all above.
[x] evidence re-run AFTER the last edit — pure fixtures re-run as the LAST
    command of this session (`docs/plans/deepfix2/evidence/df2-51b-visit-pure.json`
    mtime post-dates `src/services/restudyVisit.js`'s mtime, both checked with
    `stat -c '%Y %n'`); the mutants driver's own restore is SHA-verified
    (`restoredOk:true` ×6 in the mutants evidence, plus an independent
    `sha256sum src/services/restudyVisit.js` cross-check against the evidence's
    recorded `targetSha16`/`sourceShas` — both `b67991631ba4fa8f`).
[x] all shas re-stamped — both evidence JSONs' `sourceShas`/`targetSha16`
    match the current tree (re-verified with a fresh sha256sum pass, not
    hand-typed — see the report's reproduction commands).
[x] numbers re-derived from the evidence file, never typed — **192 checks, 0
    failures** (`df2-51b-visit-pure.json`); **6/6 mutants killed, restore
    clean** (`df2-51b-visit-mutants.json`, per-mutant red counts 5/21/4/8/6/8
    read from that file's `mutants[].failures`, not hand-typed).
[ ] change log row (ABSOLUTE path) — TEXT ONLY in the report (see the
    implementer report's "proposed change-log row"); the brief and the
    orchestrator's standing rule both forbid this session editing
    `/app/change_action_log.md` — NOT ticked as done here, by design.
[x] `node scripts/deepfix2/gate.mjs docs/plans/deepfix2/_ledgers/df2-51b-visit-fold-ledger.md`
    — run at close; verbatim output in the implementer report. Result:
    **GATE FAILED, 2 failure(s), 3 warning(s)** — both explained, neither
    caused by this fold: (1) LEDGER fails on the ONE deliberately-open
    "change log row" above (this session may not touch
    `change_action_log.md`); (2) NUMBERS fails + CLAIMS warns on
    `audit/deepfix/task3/live_baseline/*` and `17_DEPLOY_ORDER_REQUIREMENTS.md`
    — files this fold never reads or touches; re-running gate.mjs against the
    UNRELATED, already-closed `cutover-b-submit-fold-ledger.md` reproduces
    the IDENTICAL NUMBERS/CLAIMS output, proving it is pre-existing repo-wide
    state, not something this fold introduced. LEDGER/FREEZE/EVIDENCE/MUTANT/
    BATON/WATCHER/LOG all pass or reflect session-level state this fold does
    not own.
[x] commit — ORCHESTRATOR'S. The brief forbids git here; nothing staged,
    `git status --porcelain` on every touched path shows only untracked (`??`)
    new files, zero modifications to any existing file.
[x] a concurrent session is writing to this repo — noted for the committer:
    `src/utils/pastDayAuthority.js` (51-a's file) appeared mid-session as a
    NEW untracked file; not read, not touched, not part of this fold's diff.
    Pre-existing unrelated uncommitted work also in the tree
    (`.claude/settings*.json`, `SUPPORT_RUNBOOK.md`, `change_action_log.md`,
    `scripts/cs/diag-0805-*.mjs`, `b0-baseline*`) — none of it touched here;
    stage explicitly at commit time, never `git add -A`.
