---
name: opus-viable-as-fable-critic-replacement
description: Benchmark result — Opus agents can replace Fable for the multi-agent critic/convergence role
metadata: 
  node_type: memory
  type: reference
  originSessionId: 4817fc5a-d68b-443f-96c2-c94ed4b10bf5
  modified: 2026-07-20T12:50:07.999Z
---

**For the critic-pass / convergence role, Opus general-purpose agents (`subagent_type: general-purpose, model: opus`) are a viable replacement for Fable agents** — validated by a head-to-head benchmark David requested (2026-07-18) ahead of Fable sunsetting on subscription.

Setup: 3 Opus agents mirrored the 3 Fable lenses (roster / scope+safety / interaction) on **byte-identical prompts**, critiquing the D3.5 audit plan. Opus ran **cold** (no round-1/2 memory); Fable had 3 rounds of context.

Result — Opus ≥ Fable:
- **Interaction (Opus WIN):** cold, Opus-3 found the pass's biggest gaps (the plan never re-verified its own certified client fixes F01/F02/F03; the untested BlindSpotCheck route) that 3 Fable rounds missed.
- **Scope+safety (Opus WIN):** Opus-2 found the threshold **unit-error** (writing int `92` to a 0-1 ratio field → silently dead canary), join-is-detect-after-write, and an incomplete flag-posture pin; Fable-2 conceded "corrects my own spec."
- **Roster (complementary):** Fable-1 uniquely found a missing student (W3MUFXDb); Opus-1 uniquely *corrected* an error Fable-1 had propagated (정지수).

Opus grounded every claim in code (exact file:line), stayed in-lens, judged non-gaps correctly (no false positives found on verification). **Going forward, default to Opus for the critic/convergence subagent role.** Still verify every agent claim against code/live evidence — this doesn't change the never-trust-blindly rule. See [[master-task-list-is-plan-of-record]] for the convergence workflow this supports.

**Standing convergence roster (David, 2026-07-20):** a "critical convergence" / critic pass is now **1 Fable + 2 Opus + Codex + WSL (me)** = 5 entities (down from the earlier 8 = 3 Fable + 3 Opus + Codex + WinClaude). Fable reduced to 1, Opus carries the bulk — consistent with the benchmark above and Fable sunsetting. WinClaude is no longer a standing convergence member (still the deploy/live-Firestore executor). Use this composition by default when David asks for a critic pass / critical convergence, unless he specifies otherwise.
