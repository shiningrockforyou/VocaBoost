# Codex review 009 — Consolidated roadmap sequencing gate

Verdict: NEEDS_FIXES

Round-8’s deployment-order findings are substantially fixed. The D3/P4 hard gate now includes C1/C2/C3, D5/P6 now explicitly requires P5 migration complete, and D1 is correctly scoped to the current deepfix/live-baseline harness only.

I am not marking GO yet because one stale FREENAV paragraph still contradicts the new closed/coexistence state. This is narrow, but it is exactly the kind of split-brain the round-8 review was trying to eliminate.

## Findings

### MEDIUM — Roadmap still says David must decide items that are now marked closed

Evidence:

- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:32` correctly says `FREENAV — CLOSED as COEXISTENCE`.
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:36` correctly says forced progression is the default, binary throttle supersedes floor throttle, free-nav is a future per-class option, and B1/B2 are resolved.
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:51` correctly says T0.3 is closed.
- `docs/plans/SESSION_TODO_2026-07-17.md:20,23-25` correctly marks A3/B1/B2 closed.
- But `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:42` still says **“What David must decide to close it”** and lists: the product fork, formal ratification of binary-vs-floor, and P8 continuation/list-end shape.

Why this matters: items (1) and (2) on line 42 are no longer open if B1/B2 are closed. Leaving that paragraph as-is reintroduces the same FREENAV split-brain: one section says the gate is closed, while the next says David must still decide how to close it.

Required fix: rewrite line 42 as a “remaining follow-up” paragraph, not a closure prerequisite. Suggested shape:

- Closed now: forced mode requires passing the segment test; binary throttle supersedes floor; free-nav is future per-class option.
- Still open: P8 continuation/list-end product shape (B4), and the detailed E4 free-nav-mode semantics after cutover.

## Previously raised round-8 issues

- HIGH-1 FREENAV split-brain: mostly fixed, but not fully because of the stale line 42 paragraph above.
- HIGH-2 PR-3/binary throttle before P4: fixed. `SESSION_TODO_2026-07-17.md:36` and `CONSOLIDATED_ROADMAP_2026-07-17.md:63` now make C3/PR-3 flipped+soaked a hard P4 gate.
- HIGH-3 P5 before R1/P6: fixed. `SESSION_TODO_2026-07-17.md:38` and `CONSOLIDATED_ROADMAP_2026-07-17.md:65` now require P5 migration complete + accepted.
- MEDIUM D1 scope: fixed. `SESSION_TODO_2026-07-17.md:34` now says D1 only closes the current deepfix/live-baseline harness, not PR-1/2/3.

## Gate answer

Do not change the sequencing spine again. The remaining required change is textual cleanup of the stale FREENAV decision paragraph. After that, this should be GO unless the edit introduces new ambiguity.
