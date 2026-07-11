# Claude round SOP — what I do every time baton-watch wakes me

Deterministic per-round procedure. When `baton-watch.sh` exits, the harness re-invokes me; I re-read
`baton.json` and run these steps. (On disk so I stay consistent across the many auto-woken turns.)

Topology: Codex runs in Docker — repo `/repo:ro`, output `/out:rw` (== `<slug>/codex-out`). My-side
paths (I work via `/app`): baton = `<slug>/codex-out/baton.json`; Codex reviews =
`<slug>/codex-out/reviews/rNN_codex_review.md`; my responses = `<slug>/rounds/rNN_claude_response.md`;
**my 3-agent audit = `<slug>/rounds/rNN_agents_audit.md`**; the plan = `<slug>/plan.md` (I own it).

## THE RULE (David, 2026-07-11): 3-agent audit ONCE on the initial draft; Codex each round after
The **3-agent audit** (Explore A correctness / B security / C UX) runs **once, immediately after the first
draft (v1)** — the one-time deep plan-hardening pass (matches the plan-audit skill norm). **Every
subsequent round is Codex + my code-verification only** — do NOT relaunch the 3 agents on v2, v3, … They're
redundant with Codex round-over-round and cost my budget for little marginal signal. (Historical note: early
in this loop I over-ran agents every round; corrected here.)

```
v1 draft ─► [ 3-agent audit ON v1 ]  +  [ Codex reviews v1 ]        ← agents run ONCE, here only
                    └──── both ───┘
                         ▼  verify both against code → v2
v2..vN ─► [ Codex reviews ]  (NO agents)                            ← every later round
                 ▼  verify Codex vs code (reject wrong ones) → v(N+1)
                 ▼  convergence check → stop or hand off (repeat)
```
Verification bar is unchanged: I trace every finding (Codex's, and the initial agents') to real code and
REJECT the wrong ones with evidence. I never rubber-stamp either source.

## 0. Triage the wake
Read `codex-out/baton.json`.
- `state == "stalled"` → Codex timed out (no hand-back). STOP, tell David, don't relaunch.
- `state == "converged"` / `"failed"` → finalize, tell David, stop.
- `state == "running"` and `turnOwner == "claude"` → do a round (below).
- `turnOwner == "codex"` (spurious wake) → relaunch `baton-watch.sh`, end the turn.

## 0b. Scope-violation gate (defense-in-depth)
Docker `/repo:ro` physically blocks Codex writing the repo, so this should never trip. Still verify
`plan.md` is byte-identical to what I last wrote (I keep its hash) and nothing changed outside
`codex-out/`. If either fails → **HALT** (`state=failed`), tell David, do NOT relaunch.

## 1. Collect BOTH reviews of the current version vN
- Read Codex: `codex-out/reviews/rNN_codex_review.md`; parse `VERDICT blockers=.. high=.. med=.. nits=..`
  + whether it said `CONVERGED-OK`.
- Collect my 3-agent audit of vN (launched at last hand-off): the 3 Explore results, synthesized into
  `rounds/rNN_agents_audit.md`. If the agents haven't finished yet, wait for them before proceeding —
  I must have both before editing.

## 2. Verify EVERYTHING against code — do NOT capitulate to either source
Trace **every** finding — Codex's AND my 3 agents' — to the real code (`file:line`) myself. A finding is
actioned only if it's factually true about the current code. **Agents can be wrong too**; reject a bad
agent finding with the same evidence bar as a bad Codex finding. Rubber-stamping either side defeats the
loop. (This is exactly what David asked: "verify everything, including the 3-agent results.")

## 3. Synthesize + revise the plan
Merge the *verified-true* findings from both sources, dedupe, resolve contradictions against the code.
Edit `plan.md` in place (vN → v(N+1)). Write `rounds/rNN_claude_response.md`:
- per Codex finding: **ACCEPTED** (+ what changed) or **REJECTED** (+ code evidence)
- per agent finding: **ACCEPTED** / **REJECTED** (+ evidence), grouped Blockers→High→Medium→Nits
- a one-line **plan diff summary** and my own resulting verdict count.

## 4. Termination check (definite, with anti-infinite-loop backstops)
Compute for THIS round on version vN:
- `codexClean`  = Codex `blockers==0 && high==0` (nits/medium DON'T block — keeps it from being too strict)
- `agentsClean` = my 3-agent synthesis has 0 verified blocker/high
- `stable`      = I made no substantive edit to `plan.md` this round (only nits/cosmetic, or none)

**CONVERGE (success)** when `codexClean && agentsClean && stable` → both independent reviews found
nothing blocking on an *unchanged* plan. Require it on **2 consecutive rounds** (`cleanStreak >= 2`) so a
one-off quiet round doesn't false-converge. → `state=converged`, write `CONVERGED.md` (final plan
pointer, round count, last two verdicts). STOP. (If clean-but-I-still-edited, that's `cleanStreak=1`;
the next round confirms.)

**STOP as stalemate (failure)** on ANY of:
- `round >= maxRounds` (default 8) — hard cap, the ultimate infinite-loop backstop.
- **Deadlock:** the same finding (same location/claim) is raised by Codex, REJECTED by me with evidence,
  and re-raised unchanged for **2 consecutive rounds** — a genuine disagreement, not progress. Don't burn
  all 8 rounds on it.
- **Non-convergence drift:** 3 consecutive rounds where blocker/high count doesn't decrease (thrashing).
Write `STALEMATE.md` with the open disagreements (both sides' positions + my code evidence). STOP, tell
David. These are failure exits that still TERMINATE — the loop can never run forever.

Nits never block convergence; medium findings are logged but also don't block (they're captured in the
plan's "open questions" for the human). Only verified blocker/high keep the loop going.

## 5. Otherwise — hand off v(N+1) to Codex (NO agents on later rounds)
1. `round++`.
2. Write the next handoff packet (`handoffs/claude_to_codex_<NNN>.md`): Objective / changed since last /
   Claims / Verification performed / Known limitations / **Questions for Codex** / Requested decision.
   Keep it a DELTA (Codex is warm — point it at what changed + named claims; don't re-send everything).
3. Flip the baton to `turnOwner=codex` (long-turn: root `baton.json`; Docker: `set-file instruction`).
4. **Relaunch `baton-watch.sh` in the background.** Codex reviews v(N+1), flips `turnOwner=claude`
   (or `done` + `codexDecision:GO`), I wake. (Agents already ran once on v1 — do NOT relaunch them.)

### Codex COST DISCIPLINE (Codex usage is scarce — David's subscription)
Codex tokens are the scarce resource; my 3-agent audit runs on MY budget, so **push all broad,
exploratory work to the agents and give Codex a SURGICAL task.** Rules:
- **Never** tell Codex to "review the whole codebase" / "search the repo for X" — the agents did that.
- Codex's instruction = "verify THESE specific claims at THESE `file:line`s; sanity-check these named
  agent findings; judge the plan's internal logic/completeness. Do NOT open-ended-search the repo."
- **Run Codex sparingly**, not every round: 3-agent audit every round; Codex on milestone / near-final
  versions (or every Nth round), where an independent external check adds the most value.
- After round 1 the Docker session is warm — keep later instructions terse; don't re-send the full
  protocol (it's already in the warm session). Round 1 (cold `run-once`) is the one unavoidably-pricey
  call; make even it as targeted as possible.
- **Pre-flight before any Codex fire:** confirm the Codex side is ready (auth + usage headroom via
  `docker-codex/status.ps1`) — a cold launch into an exhausted quota wastes a round (learned 2026-07-11).

### Authoring the `instruction` (container paths!)
Codex cwd `/out`, repo `/repo`. Example:
> "External reviewer, round N. Read `/repo/docs/plans/loop/<slug>/plan.md`, review vs the codebase under
> `/repo` (read-only). Read prior rounds: `/repo/docs/plans/loop/<slug>/rounds/` (my responses+audits) and
> `/out/reviews/`. If a prior finding of yours was REJECTED with evidence, concede or escalate with a
> stronger file:line — don't silently re-raise. Write `/out/reviews/rNN_codex_review.md` ending with
> `VERDICT blockers=.. high=.. med=.. nits=..` (+ `CONVERGED-OK` if 0/0). Then set `turnOwner="claude"`,
> `codexStatus="reviewed"`, `codexLastReview="/out/reviews/rNN_codex_review.md"`, preserving all other fields."
Round 1's instruction embeds the full protocol (`CODEX_STANDING_INSTRUCTIONS.md`); later rounds terse (warm).

## 6. Keep it visible
Auto until convergence (no pause), but every round I post a one-line summary (both verdicts + what
changed + cleanStreak) and the artifacts (`rNN_codex_review.md`, `rNN_agents_audit.md`,
`rNN_claude_response.md`) are the audit trail. Log the loop's creation once to `change_action_log.md`.
