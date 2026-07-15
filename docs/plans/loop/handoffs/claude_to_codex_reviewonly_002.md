# Claude → Codex: DESIGN v2 — review-only day completion (round 2)

> Folded ALL of your r1 (ROD-1..5) + the r1 3-agent audit (correctness/security/UX) + David's decisions into
> `docs/plans/PLAN_review_only_day_completion.md` **v2**. Fresh 3-agent audit running in parallel; I'll
> synthesize. Verify the folds resolve your r1 findings + check the new scope. Write to
> `docs/plans/loop/codex_reviews/codex_review_reviewonly_002.md`, VERDICT (+CONVERGED-OK if clean), flip
> turnOwner→claude.

## r1 folds
- **ROD-1 → §2 + §4 (reconciled with the security review):** predicate is now
  `LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) && cfgNewWordCount === 0` — for CORRECTNESS (absent
  sessionStorage fails OPEN otherwise; Lens A) + flag-gated (non-demoting-csd guarantee). But the "re-derive
  SERVER-side" ask is DROPPED: Lens B showed the gate was never a security boundary (client code over
  student-writable class_progress/attempts; forging newWordCount:0 grants nothing a direct setDoc doesn't).
  §4 states the fix is explicitly NOT security-complete; real hardening = W3 + server-auth foundation.
- **ROD-2 → §3:** review-only session-state = `newWordScore: null` (not 0), `newWordsTestPassed: null` + a
  `reviewOnlyDay` marker → no contradictory passed:false+COMPLETE, AND fixes analytics pollution
  (avgNewWordScore, teacher "New: 0%").
- **ROD-3 → §5:** list-end branch. Both causes complete, but branched on `wordsRemaining`: throttle → recovery
  state; list-end → distinct TERMINAL "🎉 finished" screen (David's "different wording"); all-mastered/empty →
  the existing all-mastered modal (NO fake empty-day completion). Cycling (x/plan.md) adds Lap-2 later.
- **ROD-4 → §4:** stored `interventionLevel` staleness named (allocation recomputes from recentSessions).
- **ROD-5 → §8:** recovery/negative/stale-config/list-end/analytics/recon acceptance tests; cadence corrected
  (deadlock breaks after the FIRST review-only completion, ~1 review-only day, not 3).
- **NEW §6 (Lens C):** companion UX (review-only hero, recovery messaging, allocation-based count, teacher tag)
  scoped as IN-scope companions.
- **NEW §7 (David):** REQUIRED re-verification of reconciliation under review-only days × cycling — the "zero
  recon change" claim predates this fix; don't inherit it. (Counters stay monotonic; only study_state resets.)
- **Scope §9 (David): SPLIT** — review-only completion + terminal screen ship NOW (closes #11); cycling Lap-2 is
  the separate gated capstone building on this.

## claimsToCheck
1. Do §2's explicit-finite-0 + flag-gate fully resolve ROD-1's "authoritative predicate" concern given Lens B's
   "no server here" reality — i.e., is correctness-not-security the right resolution?
2. §3 session-state/analytics semantics complete + non-contradictory?
3. §5 list-end: is branching on `wordsRemaining` sufficient + correct, and is the all-mastered no-fake-day case
   handled?
4. §7 recon re-verification — is that the right scope, or does the interaction need MORE than re-verification
   (an actual design change) before this ships alongside/ahead of cycling?
5. Is the SPLIT (ship review-only completion + terminal screen now; cycling later) sound, and does anything in
   this fix pre-commit or constrain the cycling capstone's design?

## Requested: GO / CONVERGED-OK or NEEDS_FIXES (name defects).
