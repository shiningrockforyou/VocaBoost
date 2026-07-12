# PLAN — Fix NEED_TO_FIX #10 (flag-ON pre-completion reconciliation self-race) — v3 (CONVERGED)

**Slug:** fix10 · **Status:** ✅ DESIGN CONVERGED — Codex R2 `GO / CONVERGED-OK` + 3-agent fable audit
converged. v3 = v2 + Codex R2's §8 window-tightening advisory (its own suggestion). **Awaiting David's
explicit implementation go-ahead before any `src/` change** (standing rule).
**Fixes** `NEED_TO_FIX #10`. **Scope: Fix A only** (Codex F10-3 + all 3 agents). Flag-gated
(`LIST_SCOPED_RECON`) — flag-off byte-equivalent (Run L). Fix B is DEFERRED (§4). The real regression teeth
are the redesigned Playwright overlay (§8), not the app diff (which is small).

> **What changed v1→v2** (round-1 resolution log in §10): (1) Fix A is now **explicitly flag-gated** — v1's
> claim that the reconcile-write is flag-only was FACTUALLY WRONG (it isn't). (2) The create-if-missing
> fallback is **removed** (it re-introduced the race — Codex F10-1). (3) **null-path** = skip the snapshot
> persist and proceed (the `updateDoc({progressSnapshot})` write throws on a missing doc → swallowed → day
> never completes). (4) **Fix B deferred** (unsafe as specced). (5) Snapshot **reframed** as the review-retake
> rewind (not crash-recovery). (6) **Overlay redesigned** with DISCRIMINATING asserts (v1's "CSD+1/TWI+pace"
> also holds on the BROKEN build).

## 1. The bug (verified against code, all 4 reviewers concur)
On a **session-final** test completion (Day-1: `new`; Day-2+: `review` — `TypedTest.jsx:971-973`), inside
`doWriteAndFinalize`:
1. the passed attempt is written — **live path** is the `submitVocabAttempt` callable
   (`TypedTest.jsx:906-916`, since `SERVER_ATTEMPT_WRITE=true` at `featureFlags.js:10`); `submitTypedTestAttempt`
   (`:919`) is the flag-off branch. (`MCQTest.jsx` parallel.)
2. **"snapshot BEFORE completion"** via `getOrCreateClassProgress` — `TypedTest.jsx:979` (`MCQTest.jsx:718`).
   That call **reconciles from the just-written attempt and WRITES the advanced CSD/TWI**
   (`progressService.js:248-271`, `updateDoc` at :270 + `csd_twi_reconciled` log at :253). On Day 1 CSD 0→1.
   **This write is NOT flag-gated** — the flag only switches the `safeCSD` formula (:233-235); `safeTWI`
   (:236), the write (:248-271), and create-if-missing (:114-128) all run regardless of the flag.
3. `completeSessionFromTest` — `:1015` → `recordSessionCompletion` (`studyService.js:610-617`) →
   `updateClassProgress`, which re-reads fresh (`progressService.js:438`) → `expectedDay =
   current.currentStudyDay+1` no longer equals `sessionSummary.day` → day-guard rejects
   (`progressService.js:442-452`) → under the flag returns `dayGuardRejected` → the "세션 정보가 갱신되었습니다"
   rebuild screen (`TypedTest.jsx:1044-1051`).

**Flag-ON symptom** (rebuild screen) is what #10 reports. Note (out-of-scope, §9): flag-OFF the SAME race
occurs but is MASKED — the guard returns without `dayGuardRejected` (`:449-451`), completion proceeds and
presents success, but that day's `recentSessions`/`stats`/`streak` update is silently swallowed.

## 2. Root cause
The pre-completion snapshot must only **capture** current state (for the retake-rewind consumer, §5) — it
must not mutate progress. Using `getOrCreateClassProgress` for it reconciles-and-writes the advanced CSD; that
write is the sole writer between the attempt write and the guard's read, and it is what makes the very next
completion look stale. **Deterministic, same-call-stack** (Codex; Lens A/C traced it end to end).

## 3. Fix A (the fix) — non-reconciling, flag-gated snapshot read
In BOTH `TypedTest.jsx` (the `[1]`/`[2]` block at :979-1006, **inside the re-invocable `doWriteAndFinalize`
closure** — "Retry Save" re-runs it) and `MCQTest.jsx` (the parallel block at ~:718-745):

```js
if (passed && isSessionFinalTest && sessionContext?.dayNumber) {
  try {
    const progressRef = doc(db, `users/${user.uid}/class_progress`, `${classIdParam}_${listId}`);
    // [1] Snapshot current progress WITHOUT reconciling (must not advance CSD/TWI — #10).
    //     Flag-gated: flag-off keeps the exact legacy getOrCreate path (Run L byte-equivalence).
    const progress = LIST_SCOPED_RECON
      ? await getClassProgress(user.uid, classIdParam, listId)          // pure read; null iff doc missing
      : (await getOrCreateClassProgress(user.uid, classIdParam, listId)).progress;

    // [2] Persist the retake-rewind snapshot ONLY when the doc exists. A missing doc (near-impossible:
    //     concurrent reset) would make updateDoc THROW → swallowed by the catch below → completion
    //     SKIPPED → day never completes. So on null: skip the persist and let completion self-create.
    if (progress) {
      const snapshot = {
        currentStudyDay: progress.currentStudyDay ?? null,
        totalWordsIntroduced: progress.totalWordsIntroduced ?? null,
        recentSessions: progress.recentSessions ?? null,
        stats: progress.stats ?? null,
        streakDays: progress.streakDays ?? null,
        lastStudyDate: progress.lastStudyDate ?? null,
        interventionLevel: progress.interventionLevel ?? null,
        snapshotCreatedAt: Timestamp.now(),
        snapshotDayNumber: sessionContext.dayNumber
      };
      await updateDoc(progressRef, { progressSnapshot: snapshot });
    }

    // [3] Complete — UNCHANGED. updateClassProgress re-reads fresh + self-creates the doc if missing.
    const completion = await completeSessionFromTest({ /* …unchanged… */ });
    // …requiresNewWordRetake / requiresSessionRebuild branches unchanged…
  } catch (completionErr) { /* unchanged */ }
}
```
Requires importing `getClassProgress` (alongside the existing `getOrCreateClassProgress`) in both pages.

**Why it works** (Codex C1/C2/C3 + Lens A6 confirmed):
- `getClassProgress` is a pure read — `progressService.js:498-509` (`getDoc` → null or `{id,...data()}`, no
  write). So `[1]` no longer advances CSD.
- Completion **re-reads fresh** — `updateClassProgress` does its OWN `getDoc` (`:438`) and increments from
  stored CSD (`:466`); the snapshot object is never passed into completion. Day-1: stored CSD 0 →
  `expectedDay 1 === dayNumber 1` → completes 0→1. Day-2+: stored CSD N-1 → `expectedDay N === dayNumber N`
  → completes. Race eliminated in both branches; retry-save idempotent (re-run still sees un-advanced CSD).
- **`?? null` field guards** (Lens A7): a raw read of a sparse/legacy doc could put `undefined` into the
  snapshot → `updateDoc` rejects undefined (no `ignoreUndefinedProperties`; `firebase.js:42`) → throw →
  completion skipped. Guarding is cheap and flag-off-neutral (init docs have all seven fields).

**Flag-off equivalence.** The `LIST_SCOPED_RECON` gate keeps the flag-off read on `getOrCreateClassProgress`
(never returns null → `if (progress)` always true → snapshot persists exactly as today). The only textual
deltas on the flag-off path are the `if (progress)` wrapper (a no-op there) and the `?? null` guards (a no-op
for init-created docs; only changes a would-be throw on a malformed doc). Claim: flag-off is behavior-
equivalent for all real docs. *(⊳Codex: confirm this granularity is acceptable, or should `?? null` also be
flag-gated for strict byte-equivalence?)*

**DO-NOT-TOUCH** (Codex/A6/C9): the OTHER in-page `getOrCreateClassProgress` calls — `TypedTest.jsx:823`,
`MCQTest.jsx:543` (the studyDay-derivation fallback) — run BEFORE the attempt write and only when
`sessionContext.dayNumber` is absent (which also disables this completion block at `:976`). They must stay
reconciling; an implementer must NOT find-replace them.

## 4. Fix B — DEFERRED (do NOT ship in this fix)
Codex F10-3 + all 3 agents: **do not ship Fix B in the first implementation.** Fix A removes the known
same-tab self-race at the source. Fix B (make `updateClassProgress` treat `sessionSummary.day ===
current.currentStudyDay` as success) is **unsafe as specced**:
- It cannot distinguish a **benign** lost race (reconcile advanced CSD from this same day's attempt;
  completion never applied → should still append `recentSessions`/`stats`/`streak`) from a **genuine
  duplicate** finalization (another tab/device already completed day N → must apply nothing).
- Because the caller treats any non-`dayGuardRejected` return as success, a genuine duplicate would get a
  **second `sessions` record** (`studyService.js:659-672`) + a **second `graduateSegmentWords`** pass
  (`:1446-1454`); the benign case would count the day with `recentSessions`/`stats`/`streak` silently missing
  (skews `calculateInterventionLevel`, breaks streaks).
- The residual it targets is **rare/dormant**: a second concurrent surface (tab/device) reconciling in the
  ~1-3s window, or the review-retake rewind path (which is currently **UI-unreachable** — §5). Not needed to
  close #10 as filed.

**If Fix B is ever revived** (its own plan, only if a post-Fix-A test finds a residual same-day collision):
disambiguate via `current.recentSessions` — if no entry with `day === N` exists, the reconcile won the race
→ apply the non-CSD updates (append summary, recompute stats/streak) and skip ONLY the CSD/TWI increment; if
an entry for day N exists, return an explicit `alreadyComplete: true` sentinel that the caller uses to skip
the `sessions`-doc write and graduation. Add a distinct `day_guard_absorbed_same_day` log. **Never a bare
"return current".**

## 5. The snapshot is the review-retake rewind (reframed — Lens A2/C5, Codex Q3)
`progressSnapshot` is NOT crash-recovery. Its only readers are the review-retake restore in
`handleRetake` (`TypedTest.jsx:1141-1178`, `MCQTest.jsx:859-897`) — validate `snapshotDayNumber`, restore
CSD/TWI/recentSessions/stats/streak, relaunch the review. That branch is currently **UI-unreachable**
(`canRetake` set only for `currentTestType==='new'`; the review results card renders Continue only). Fix A
**improves** this consumer: today (flag-ON) the snapshot stores POST-reconcile values so a restore fails to
rewind; with Fix A it stores the correct pre-completion values. (This is why "unreconciled stored progress is
the correct snapshot value" — Codex Q3.) Latent, linked to Fix B: after a restore demotes CSD N→N-1, any
reconciling mount re-advances it (non-demoting `Math.max`) → the retake completion would guard-reject — but
that path is dormant today.

## 6. Files touched (Fix A only)
1. `src/pages/TypedTest.jsx` — flag-gated non-reconciling snapshot read + null-skip + `?? null` guards
   (inside `doWriteAndFinalize`); add `getClassProgress` import.
2. `src/pages/MCQTest.jsx` — same at the parallel block (~:718).
**No `progressService.js` change** (Fix B deferred). No new index, no migration, no flag change.

## 7. Acceptance & regression
- **Acceptance:** a fresh student completes Day-1 (new) AND Day-2+ (review), typed AND MCQ, with NO rebuild
  screen; proven by the DISCRIMINATING overlay (§8), not by CSD/TWI (which also advance on the broken build).
- **Regression (must stay green):**
  - **Run L flag-off equivalence** — flag-off path unchanged for all real docs (§3).
  - **#9 acceptance (Run S S-1/S-3)** — Fix A doesn't touch `getReviewForDay` / the Day-2+ gate / explicit-0
    `wordsIntroduced` / session-entry carry (Lens B5); keep S-1/S-3 as the guard.
  - **Review-retake rewind (dormant)** — assert at the UNIT level that the snapshot still captures
    pre-completion field shape + correct `snapshotDayNumber` (not via UI — the path is unreachable). (Replaces
    v1's untestable "crash-recovery snapshot valid" item.)
  - **Day-guard still blocks a genuine different-day stale completion** → §8 negative control.

## 8. Playwright validation (the real teeth) — redesigned per Lens C
Add to Run S-Long a **#10 regression overlay**. v1's asserts were non-discriminating (the BROKEN build also
ends at CSD+1 / TWI+pace — reconciliation writes the same finals; only `recentSessions`/`sessions`-doc
differ). Correct design:

- **Matrix (4 cells):** {Day-1 new-final, Day-2+ review-final} × {TypedTest, MCQTest}. Day-1 and Day-2+ take
  different reconcile branches (anchor-only vs `getReviewForDay`); the fix lands in two files — a Day-1-only
  or typed-only overlay is blind to a partial fix. Day-2+ review is the everyday steady state.
- **DISCRIMINATING assertions per cell** (what actually separates fixed from broken):
  1. UI: no rebuild/"session refreshed" screen; results screen reached.
  2. `recentSessions` gained exactly ONE entry with `day === N`.
  3. exactly ONE new `users/{uid}/sessions` doc for this completion.
  4. `session_states` phase == `COMPLETE`.
  5. ZERO `day_guard_rejected_session_cleared` logs for this user/list in the window.
  6. **ZERO `csd_twi_reconciled` events for this user/list in the completion window** — a RACE DETECTOR
     (catches a Fix-A regression AND survives a future Fix B), **not the sole oracle**. Asserts 1-5 above are
     the primary oracle. [Codex R2]
- **Completion-window boundary** [Codex R2]: define the window TIGHTLY — from the final attempt write to the
  completion result settling. A correct flag-ON completion emits ZERO `csd_twi_reconciled` in that window
  (`completeSessionFromTest` completes via `updateClassProgress`, not reconciliation). To avoid false-REDs,
  the window must EXCLUDE later dashboard reloads, session-entry probes, and any other intentional
  reconciliation-triggering loads — those legitimately reconcile and would false-trip assert 6.
- **Signature-pinned EXPECTED-RED** (before the fix): require the RED to assert the SPECIFIC #10 signature —
  rebuild-screen text visible AND a `day_guard_rejected_session_cleared` log AND an immediately-preceding
  `csd_twi_reconciled` for this user/list — flag-ON, N≥2 consecutive runs. Prevents a red-for-wrong-reason
  (selector/auth flake) from falsely certifying the repro. After the fix: GREEN.
- **Negative control (guard-integrity):** drive a genuine different-day STALE completion (old-tab replay
  preferred; a sandbox Firestore-seeded stale state only with owner OK, since audit Firebase is read-only) and
  assert the guard STILL fires and routes to the **recoverable** rebuild (`sessionCleared: true`), not the
  dead-end. Protects against a future Fix B silently weakening the guard.
- **Keep settle-before-navigate** — NOT because #10 needs it (the self-race is intra-handler, pre-navigation)
  but because it guards a DIFFERENT live hazard that survives Fix A: navigating/unmounting between the attempt
  write and `updateClassProgress` interrupts the completion chain → the day later "completes" via silent
  reconciliation with no `recentSessions`/`sessions` record. Rewrite the harness comment so a future cleanup
  doesn't delete it as an obsolete #10 workaround.

## 9. Out-of-scope (log as observations, NOT part of this fix)
1. **Flag-OFF silent session-summary loss** on every session-final completion where the anchor carries a valid
   `newWordEndIndex` (§1; the flag-off race is masked but loses `recentSessions`/`stats`/`streak`). Only
   matters if the flag is rolled back; candidate backlog item.
2. **Nav-interrupt silent-reconcile completion** (§8 settle rationale) — a distinct latent hazard.
3. **`impossible_phase_detected` (day1_with_passed_new_test)** — not proven related (Codex Q4); keep out of
   scope unless a later test ties it to this snapshot race.
4. **Rebuild after an EXTERNAL reset** (impl-audit Lens B): post-fix, if a teacher resets a student mid-session
   (stored CSD demoted between session build and final submit), the guard now correctly routes to the
   RECOVERABLE rebuild instead of the pre-fix accidental "re-advance rescue" (`getOrCreateClassProgress`'s
   non-demoting `Math.max`). This is the guard working AS DESIGNED — a future "rebuild after reset" report is
   NOT a #10 regression. (§8 negative control asserts exactly this.)
5. **Retake-restore null-write & TOCTOU** (impl-audit Lens A/C): the `?? null` guards mean a restored snapshot
   could write literal `null`s into live fields IF the currently UI-unreachable retake path is ever revived
   (downstream readers already coalesce `null` → default, so benign today); and a concurrent doc-delete
   between the snapshot read and its `updateDoc` would skip the persist+completion for that submit (strictly
   narrower than the pre-fix exposure). Handle both in the Fix B / retake follow-up if that path is revived.

## 10. Round-1 resolution log
| Source | Finding | v2 action |
|---|---|---|
| Codex F10-1 (blocker) / A4 / B4 / C1 | create-if-missing fallback re-introduces the race; null-path `updateDoc` throws→completion skipped | §3: removed fallback; on null skip the snapshot persist + proceed (completion self-creates) |
| Codex F10-2 (high) / A1 / B1 | flag-gate the swap; v1's "reconcile-write is flag-only" is FALSE | §1 corrected; §3 flag-gated shape |
| Codex F10-3 (med) / A3 / B3 / C2 | Fix B unsafe / not needed → Fix A only | §4 Fix B DEFERRED with safe-redesign sketch |
| A2 / C5 / Codex Q3 / (rejects B6) | snapshot = review-retake rewind, not crash-recovery; Fix A makes it more correct | §5 reframe; §7 unit-assert |
| C3 (high) | overlay "CSD+1/TWI+pace" non-discriminating | §8 discriminating asserts (recentSessions/sessions/csd_twi_reconciled) |
| C4 (med-high) | overlay needs Day-2+ review × MCQ cells | §8 4-cell matrix |
| C6 (med) | EXPECTED-RED must be signature-pinned | §8 signature-pinned RED, N≥2 |
| C7 (med) | no negative control for the guard | §8 stale-completion negative control |
| C8 (nit) / A5 | keep settle (right reason); live write is the callable | §8 rationale; §1 cites `:906-916` |
| A7 (nit) | `?? null` snapshot-field guards | §3 |
| A6 / B7 / C9 | mark `:823`/`:543` DO-NOT-TOUCH; MCQ parity; swap inside closure | §3, §6 |
| B5 | no #9/Run S regression | §7 keep S-1/S-3 gate |
