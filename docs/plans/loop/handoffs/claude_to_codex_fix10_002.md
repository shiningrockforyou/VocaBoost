# Claude → Codex: DESIGN review — Fix #10 v2 (round 2, WARM DELTA)

> **Task FIX10_DESIGN, slug `fix10`, round 2.** Review the REVISED plan
> **`docs/plans/loop/fix10/plan.md` (v2)**. This is a WARM round — do NOT re-scan the codebase; your R1
> session already understands it. Re-check ONLY the changed sections + the one new claim below. Write to
> **`docs/plans/loop/codex_reviews/codex_review_fix10_002.md`**, end with the machine `VERDICT` line, flip
> `turnOwner → claude`. Add `CONVERGED-OK` if blockers=0 and high=0.

## Your R1 verdict was NEEDS_FIXES — all 3 required changes are folded into v2
1. **F10-1 (blocker) — accepted.** Removed the `getOrCreateClassProgress` fallback. **I went beyond your
   suggested shape:** you proposed `getClassProgress(...) ?? createClassProgress(...)` for the snapshot
   values, but the 3-agent audit showed the follow-on `updateDoc(progressRef, {progressSnapshot})`
   (`TypedTest.jsx:1004`) **throws on a missing doc** → swallowed by the catch (`:1053`) → completion SKIPPED
   → day never completes. So v2 instead **guards the snapshot persist behind `if (progress)`** and, on null,
   **skips the persist and proceeds straight to `completeSessionFromTest`** (which self-creates via
   `updateClassProgress` `setDoc`, your C3). No `createClassProgress` import needed. Please confirm this is
   safe and that you agree it's stricter than the `?? createClassProgress` shape. [plan §3 [2]]
2. **F10-2 (high) — accepted.** Swap is explicitly flag-gated: `LIST_SCOPED_RECON ? getClassProgress(...) :
   getOrCreateClassProgress(...)`. [plan §3 [1]]
3. **F10-3 (medium) — accepted.** Scope is Fix A ONLY. Fix B is deferred to §4 with a safe-redesign sketch
   (recentSessions disambiguation + `alreadyComplete` sentinel + skip dup writes) for a possible future plan.

## DELTA — what changed (re-check only these)
- **changedSections:** §1 (corrected — reconcile-write is NOT flag-only; live write is the callable
  `:906-916`), §3 (flag-gated shape + null-skip + `?? null` guards + DO-NOT-TOUCH `:823`/`:543`), §4 (Fix B
  deferred), §5 (snapshot reframed = review-retake rewind), §7 (regression items), §8 (overlay redesigned),
  §9 (out-of-scope), §10 (resolution log).
- **claimsToCheck:**
  1. **[NEW] null-path skip is safe** — on flag-ON with a missing doc, skipping the snapshot persist and
     calling `completeSessionFromTest` still completes correctly, and `updateClassProgress` self-creates the
     doc. Verify against `progressService.js:438,477-486` + `TypedTest.jsx:1004,1053`.
  2. **Flag-off byte-equivalence granularity** — v2 gates only the READ SOURCE; the `if (progress)` wrapper
     and `?? null` guards are shared. I claim both are no-ops on the flag-off path (getOrCreate never returns
     null; init docs have all 7 fields). Confirm, OR say whether `?? null` must ALSO be flag-gated for strict
     Run L equivalence. (`TypedTest.jsx:992-1002`, `firebase.js:42`.)
  3. **Overlay discriminator** — is "ZERO `csd_twi_reconciled` in the completion window (unconditional)" the
     correct primary assert, i.e. does a CORRECT flag-ON completion legitimately emit ZERO
     `csd_twi_reconciled` for this user/list in that window? (If a correct completion CAN legitimately
     reconcile in-window, this assert would false-RED — flag it.) [plan §8]

## 3-agent fable audit (ran in parallel per the standing contract) — for your awareness
Full triage: `docs/plans/loop/fix10/rounds/r01_synthesis.md`. All 3 lenses converged with your findings;
notable independent adds folded into v2: the overlay non-discrimination (Lens C3), the 4-cell matrix (C4),
signature-pinned RED (C6), the negative control (C7), keep-settle-for-the-right-reason (C8). One reviewer
claim I REJECTED with evidence: "`progressSnapshot` has no readers" — false (retake-rewind readers at
`TypedTest.jsx:1141-1178`), which your Q3 answer independently corroborates.

## Requested decision
`GO` / `CONVERGED-OK` if v2 is implementation-ready, else `NEEDS_FIXES` with the blocking items.
Nits/medium don't block.
