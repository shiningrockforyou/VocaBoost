# DEEPFIX — Final whole-surface review (2 Fable + Codex) — consolidated findings

**Round 1, 2026-07-14.** 3 independent reviewers over the complete P0–P10 surface. This is the record; orchestrator
H1-verification noted per finding. **Headline: the final review found ~13 real issues that ALL survived the
per-phase Codex loop** — almost entirely in **flag-ON (P5/P9/P10) end-state territory** (nothing changes day-one
deploy behavior — the dormant-draft model holds), but several sit directly on the cutover gates and mean the
FIX_PLAN's "this cutoff closes the forgery surfaces" claims are **partially overstated as currently coded**.

## Consolidated + deduped

| # | Severity | Source | Verified | Verdict | Summary → fix |
|---|---|---|---|---|---|
| F-1 | **BLOCKER** | Codex FINAL-1 = Fable-B BLOCKER-1 | ✅ orch-confirmed | FOLD (deploy-artifact split) | ONE `firestore.rules` file carries BOTH the P6 cutoff AND the P10d claim-switch/narrowings → no safe P6-only rules deploy. Deploy@P6 → P10d ships early → teachers locked out (claims un-backfilled); deploy@P10 → P6 write-lockdown NOT enforced during P4–P9 (forgery open longer). Fix: pin stage artifacts (P6-cutoff-only → P10c additive read → P10d narrowing; `phase6_rules.patch` exists but isn't designated) + ONE global deploy-order runbook; a P6 deploy must not include P10d. |
| F-2 | **HIGH** | Fable-B HIGH-2 | ✅ orch-confirmed | FOLD (wire the intended enforce) | `ANCHOR_VALIDATION_ENFORCE` declared/exported but **consumed nowhere** (`foundation.js:74/119/842`); `validateAttemptAnchorShadow` is log-only. So the M4 backstop that was SPECIFIED to close C-31 doesn't exist — `submitVocabAttempt→writeAttemptTxn` echoes client `newWordEndIndex` with only ≥0 check → forged forward anchor survives; flipping the flag at cutover is a silent no-op while the version-probe shows "enforcing". Fix: wire the enforce branch (reject/clamp on violation, log `anchor_rejected{enforced:true}`) — complete the P3-U9-deferred design; correct the 3 docs. |
| F-3 | **HIGH** | Fable-A HIGH-1 | ✅ orch-confirmed | FOLD (P5-gate) | `resetProgress` canonical mode (`:1653-1662`) stamps only the epoch onto the canonical doc — never zeros csd/twi/recentSessions → post-P5 reset is a NO-OP that also creates the anchorless-twi>0 corruption signature the migration quarantines. Fix: write default-shape zeros (csd0/twi0/cleared/fresh programStartDate) in the same canonical set. |
| F-4 | **HIGH** | Fable-B HIGH-3 | ✅ orch-confirmed | FOLD or accept+monitor | `completeSession` day-guard (`:1033-1042`) requires only `dayNumber===csd+1` — NO attempt evidence → csd/twi pumpable test-free, and it mints the review-markers the P5 CSD-plausibility screen trusts as "durable evidence". "No worse than today" (direct class_progress write forges worse, which P6 closes) but it's the END-STATE posture. Fix: require a day-N passed `new` attempt OR a verified review-only reason inside the txn; and/or exclude autoCompleted markers from `evidencedReviewDays`. |
| F-5 | MED | Fable-A MED-2 | pending | FOLD | `overrideAttempt` day-1 pace finder (`:2287-2294`) matches on class but NOT list, no ordering, no clamp → a forged forward-jumped anchor past list size (twi 400 on a 300-word list). Fix: add `a.listId===tListId`, clamp nwei to `totalListWords−1`, and/or derive pace from the target assignment. |
| F-6 | MED | Fable-A MED-3 | ✅ (grep) | FOLD (P5-gate) | `resetEpoch` tombstone has ZERO consumers — no anchor reader excludes pre-epoch attempts; migration never folds `progress_meta` → an in-flight attempt landing after reset re-promotes twi (reset un-resets). Fix: land the epoch filter in `getListAnchor`/client anchor readers (exclude `submittedAt<resetAt`); fold `progress_meta` at P5. |
| F-7 | MED | Fable-A MED-4 | pending | FOLD (align) | Resolver hydration TWI-quarantine misses `anchorStatus==='invalid-anchor'` (`:1357-1359`) → canonicalizes an anchor-unvalidated stored twi the migration would quarantine (resolver looser than migration). Fix: second leg → `!anchor.hasValidData && stored>0`. |
| F-8 | MED | Fable-B MED-4 | pending | FOLD (1 line or doc) | Signup invite redemption has no `getIdToken(true)`; rules D3 cites a "Signup.jsx force-refresh" that doesn't exist → newly-redeemed teacher denied ~1h. Fix: `await auth.currentUser.getIdToken(true)` after redeem, or correct D3 to "accepted 1h lag". |
| F-9 | MED | Fable-B MED-5 | pending | DEFER→P7 | Challenge-token ledger trusts owner-writable `challenges.history` → self-edit for unlimited tokens (bounded: still needs teacher accept). Fix: once P7 retires the legacy client `submitChallenge`, add `challenges` to the owner-update exclusion (or server-owned ledger). |
| F-10 | MED | Fable-A MED-5 | pending | FOLD | P9 "Start over" renders only for non-cycling-served students + its handler can't restart. Fix: gate on `deriveEffectiveCycling` (finished-before-enable transition) or drop the button. |
| F-11 | LOW | Fable-B LOW-6 | pending | RESIDUAL (documented) | Server authz keyed on client-writable `enrolledClasses` → self-enroll to write attempts into any class + unlock cycling. Largely pre-existing; deepfix extended the trust. Named residual + long-term server-owned enrollment. |
| F-12 | LOW | Fable-B LOW-7 | pending | FOLD | `assertOverrideTargetAuthz` rejects legacy `assignedLists`-only assignments (siblings accept them). Fix: add the `assignedLists.includes(listId)` disjunct. |
| F-13 | LOW | Fable-B LOW-8 | pending | FOLD | Backfill scripts (`teacherids`/`claims`) exit 0 despite commit-mode read-back mismatches (unlike P5's NOT_READY exit-2). D2 makes the read-back a hard precondition → a checklist keying on exit codes passes a partial backfill. Fix: exit nonzero on `mismatched>0` (claims: also untriaged `missingAuth>0`). |
| N-1..3 | NIT | Fable-A 6/7/8 | — | FOLD (minor) | cycling proxy false-positive on over-introduction rows (ClassDetail); straddle-day lap display can invert ("Words 96–5"); migration `dedupe` set built-and-unused. |

## Both reviewers independently verified CLEAN (corroboration)
Flag-OFF byte-equivalence (all touched live paths short-circuit before their flag); the P10-1/P6-2/P6-3/P9-5/P10d
folds; the override union + target-bindings (authorized subject === written subject); the P10c additive read clause
+ indexes; the P5 migration screens + fail-closed commit/catchup gates; the P7 patch (retires only flag-dead
branches, keeps the SERVER_OVERRIDE-off hybrid); core invariants (twi monotonic/clamped, csd non-demoting, anchor
identity across getListAnchor/migration/client). — So the day-one-deploy safety + the already-folded per-phase fixes
hold; the new findings are end-state/cutover-gate hardening.

## Fold plan (partitioned by file to avoid conflicts) → then Codex delta re-review
- **A · foundation server security** (`functions/foundation.js` + `index.js`): F-2 (wire M4-enforce), F-4 (completeSession evidence), F-3 (reset canonical zero), F-6 (epoch filter + progress_meta), F-5 (override list-match+clamp), F-7 (quarantine align), F-12 (assignedLists disjunct). ← serialized (shared file).
- **B · rules/deploy-order** (`firestore.rules` + deploy-order runbook + stage artifacts): F-1.
- **C · client/scripts/misc**: F-8 (Signup), F-10 (DailySessionFlow Start-over), F-9 (defer→P7, document), F-13 (2 scripts), N-1/2 (ClassDetail/DSF display), N-3 (migration dead set). ← db.js/rules for F-9 coordinate with A/B.
- Residual: F-11 documented (not folded).
