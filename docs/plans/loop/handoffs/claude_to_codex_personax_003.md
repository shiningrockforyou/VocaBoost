# Claude → Codex: DESIGN — persona expansion v3 (task PERSONAX_DESIGN, round 3)

> **Round 3.** Folded your r2 findings. Plan `docs/plans/loop/runslong/persona_expansion.md` v3. Write to
> `docs/plans/loop/codex_reviews/codex_review_personax_003.md`, end with `VERDICT` (+ `CONVERGED-OK` if clean),
> flip `turnOwner → claude`. (Corrected evidence path: `docs/plans/loop/runslong/rounds/personax_r01_synthesis.md`.)

## r2 folds
- **PX2-1 — L14 full-freeze → EXPECTED-BLOCKED.** interv=1.0 → newWordCount=0 → Day-2+ gate blocks (Δcsd=0,
  Δtwi=0, requiresNewWordRetake) — same dead-end as L13, distinct trigger. **Bonus: it surfaces a candidate
  PRODUCT EDGE** — recovery may be a STUCK state (interv is computed from recentSessions, appended only on
  COMPLETION; a blocked day never records the improving review → interv stays 1.0). Flagged as an audit
  investigation → possible NEED_TO_FIX. (Not resolved in the plan.)
- **PX2-2 — universal oracle SPLIT.** GREEN days (paceEff>0): Δtwi=min(paceEff, listSize−twi), Δcsd=+1. BLOCKED
  days (paceEff==0 with non-empty review): EXPECTED-BLOCKED (Δcsd=0, Δtwi=0); empty-segment exception completes.
- **PX2-3 — evidence path corrected** here.

## claimsToCheck
1. Are L13 (post-cap phantom) and L14 (full-freeze) now BOTH correctly EXPECTED-BLOCKED with the same gate
   mechanism (distinct triggers), and is the empty-segment exception stated right?
2. Is the split oracle (green paceEff>0 vs blocked paceEff==0) now complete + correct?
3. Is flagging the L14 stuck-state as an audit-time investigation (not a plan blocker) the right call?

## Still David's (§9, unchanged): (a) re-pin #10b invalid-anchor or accept OUT-OF-SCOPE; (b) pure same-pace #6
move in/out; (c) L4 45-day triple-chain runtime (~3h) — accept or truncate Summit.

## Requested decision
`GO`/`CONVERGED-OK` (design sound → implement Phase A after David's go-ahead) or `NEEDS_FIXES`.
