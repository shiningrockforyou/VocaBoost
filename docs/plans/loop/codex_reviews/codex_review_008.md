# Codex review 008 — Consolidated roadmap sequencing gate

Verdict: NEEDS_FIXES

The roadmap is directionally sound: it recognizes the current live state, keeps the deepfix functions dormant until P3, keeps rules cutoff after client/server cutover, and preserves the P5-before-P6 spine in the high-level roadmap. I would not give this a GO yet because the executable artifacts still contain three sequencing contradictions that can mislead the next operator.

## Findings

### HIGH — Free-navigation closure is split-brain across the roadmap and TODO

Evidence:

- `docs/design/FREE_NAVIGATION_MODEL.md:175-193` says the gate is closed as COEXISTENCE: forced per-class default now, free-navigation later as an option.
- `docs/plans/loop/handoffs/claude_to_codex_roadmap_seq_001.md` says David closed FREENAV in round 7.
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:32-51` still frames this as an open/de-facto decision that has not been formally closed.
- `docs/plans/SESSION_TODO_2026-07-17.md:20` still has A3 as re-picking the free-nav gate, and `docs/plans/SESSION_TODO_2026-07-17.md:25` still has B1 unchecked.

Risk: B1/B2/A3 are used as gates for binary throttle, rules content, and later cycling/free-nav work. Leaving them open can either stall the sequence or cause someone to re-litigate a decision that is already supposed to be closed.

Required fix: update the roadmap and session TODO so the authoritative state is: FREENAV closed as COEXISTENCE; forced class default now; free-nav is future optional work after the server-authoritative base. Mark A3/B1/B2 resolved or rename them to the remaining post-cutover follow-up only.

### HIGH — PR-3 / binary throttle before P4 is not represented as a hard D3 gate

Evidence:

- The handoff says PR-3 must flip after PR-1 and before P4, because flipping P4 under the old predicate can re-mint stuck-pairing victims.
- `docs/plans/SESSION_TODO_2026-07-17.md:36` says D3/P4 is gated on C2 live, while C3 “lands with/just before this.” That is weaker than a hard prerequisite.
- `docs/plans/SESSION_TODO_2026-07-17.md:50` puts C3 before D3 in the critical path, which conflicts with the D3 line item’s gate text.
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:63` similarly says PR-3 client flip + soak lands with/just before P4, but does not make it an unambiguous P4 gate.

Risk: an operator following the concrete D3 line can execute P4 once C2 is live, without confirming PR-3 is built, flipped, and soaked. If the handoff’s stuck-pairing claim is correct, that is unsafe.

Required fix: make D3/P4 explicitly gated on C3/PR-3 if that is the intended safety property. Suggested wording: “D3/P4 requires C2 live, C1/PR-1 live as needed by C3, and C3/PR-3 flipped + soaked; do not P4 under the old completion-throttle predicate.” If P4 is allowed without C3, the plan needs an explicit rationale and compensating check.

### HIGH — D5/R1 rules cutoff omits P5/D4 migration complete in the executable TODO

Evidence:

- `audit/deepfix/task3/DEPLOY_ORDER.md:116-128` makes P5 migration complete a hard gate for R1/P6.
- `docs/plans/CONSOLIDATED_ROADMAP_2026-07-17.md:64-65` preserves the high-level sequence P5 before R1/P6.
- `docs/plans/SESSION_TODO_2026-07-17.md:37-38` lists D4/P5, then D5/R1/P6, but D5’s own hard gates omit “D4/P5 complete.”
- `docs/plans/SESSION_TODO_2026-07-17.md:50` has D4 before D5 in the critical path, but that does not repair the missing D5 gate text.

Risk: the high-level roadmap is safe, but the line-item TODO can be executed incorrectly: R1/P6 could be attempted after M4/no-legacy-write/rules tests without explicitly verifying P5 migration acceptance.

Required fix: add D4/P5 migration complete + accepted as a hard D5 gate. The D5 gate should reference the DEPLOY_ORDER P6 precondition, including 26SM quarantine status, M4 shadow cleanliness, and migration completion.

### MEDIUM — D1 / Task 6 should be scoped as baseline deepfix certification, not future PR certification

Evidence:

- The handoff correctly says PR-1/2/3 diffs do not exist yet and need their own later review.
- `docs/plans/SESSION_TODO_2026-07-17.md:35` puts D1 before D2/P3, while C1/C2/C3 are separate roadmap-prep items.

Risk: D1 could be read as certifying the entire near-term track, including PR changes that are not built yet.

Required fix: add one sentence to D1: Task 6 closes only the current deepfix/live-baseline harness. PR-1/PR-2/PR-3 each require their own code review, evidence, and flip gate before being treated as deploy-ready.

## Answers to the sequencing questions

1. Is the interleaving correct? Almost, but not yet executable. The intended chain is sound only after the three hard-gate text fixes above.
2. Is “PR-2 folds into P3 functions redeploy → PR-3 flips before P4 → PR-1 before P5” safe? PR-2 before P4 is sound. PR-3 before P4 is sound if it is explicitly after the PR-1 predicate support it depends on. PR-1 before P5 is sound and should get its own code review/census gate.
3. Should PR-1/PR-2 get Codex review before ship? Yes. The roadmap correctly says later code diffs need their own review; D1 must not imply otherwise.
4. Does the free-nav coexistence decision hold? Yes, but the roadmap/TODO must stop treating it as open.
5. Better sequencing? Keep the current spine, but encode it as hard gates: close FREENAV in docs → PR-2 live before P4 → PR-1 support before PR-3 → PR-3 soaked before P4 → P5 complete before R1/P6.
