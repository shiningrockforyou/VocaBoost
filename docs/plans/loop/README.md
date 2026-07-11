# Plan-review loop — Claude ⇄ Codex, auto until convergence

An automated iterate-until-clean loop for hardening a plan: Claude authors a plan, Codex reviews it,
Claude verifies Codex's claims against the real code **and** runs a 3-agent audit, revises, and hands
back — round after round — until **both sides find nothing** on an unchanged plan.

## Why it's built this way (the honest constraints, resolved)
Facts from probing the actual setup decided the design:
1. **No WSL↔Windows interop, no Docker** from Claude's side (`WSLInterop` absent, no `docker`/socket) →
   Claude *cannot* launch Codex. So a host-side watcher launches the Codex Docker worker.
2. **`/app` is a `9p/drvfs` mount of the Windows `C:\` drive** (== Codex's `/repo` and `/out` mounts) →
   the files Claude writes and the files Codex reads are the *same physical files*. `baton.json` is a
   native shared channel — no git sync.
3. **Codex runs headless-but-WARM in Docker** via `codex exec` (round 1) / `codex exec resume --last`
   (later, warm — keeps plan + prior reviews + codebase exploration, so no cold re-grep that would burn
   a light Codex plan). Auth persists in a Docker volume (`codex login` once). No live TUI, no SendKeys.
4. **Docker mounts enforce the write-scope hard:** `/repo:ro` (whole repo read-only) + `/out:rw` (the
   one writable dir). Codex physically cannot modify `plan.md` or source — the container is the sandbox.

The asymmetry that makes it fully automatic:
- **Claude self-wakes natively** — a backgrounded bash waiter exits on its turn and the harness
  re-invokes Claude. No tmux, no external trigger for Claude.
- **Codex has no self-wake** → the host `watch-and-run.ps1` runs the Docker worker once per turn.
  Codex writes its review and flips `turnOwner` itself; Claude's waiter then wakes.

## Files
```
docs/plans/loop/
  README.md                       ← this file
  lib/
    baton.mjs                     ← the turn token (turnOwner/instruction schema; BOM-tolerant) — node, no deps
    baton-watch.sh                ← Claude's background auto-wake waiter (polls turnOwner)
    CODEX_STANDING_INSTRUCTIONS.md← the protocol; embedded into round-1's baton `instruction`
    CLAUDE_ROUND_SOP.md           ← Claude's deterministic per-round procedure
    verify-sandbox.mjs            ← Claude's independent FS check of the sandbox probe
  docker-codex/                   ← Codex's Docker worker (built by Codex; Claude reads, never runs)
    Dockerfile build.ps1 login.ps1 status.ps1 run-once.ps1 resume-last.ps1
    watch-and-run.ps1             ← host watcher: on turnOwner=codex, runs run-once/resume-last
  <slug>/                         ← one dir per plan under review (created at kickoff)
    plan.md                       ← the living plan (Claude owns; Codex sees it at /repo/... READ-ONLY)
    rounds/
      r01_claude_response.md      ← Claude writes: accepted/REJECTED-w-evidence + 3-agent synthesis
    codex-out/  (== Docker /out)  ← Codex's ONLY writable dir (enforced by the /out:rw mount)
      baton.json                  ← { turnOwner, instruction, codexStatus, round, state, maxRounds, ... }
      reviews/
        r01_codex_review.md       ← Codex writes; ends with `VERDICT blockers=.. high=.. med=.. nits=..`
      last_message.md             ← codex exec -o (final assistant message)
    CONVERGED.md                  ← written when both sides clean on an unchanged plan
```

## baton.json  (at `<slug>/codex-out/baton.json` == Docker `/out/baton.json`)
```json
{ "turnOwner":"codex|claude", "task":"plan-review", "repoRoot":"/repo",
  "instruction":"<Claude authors the per-turn task here, in /repo & /out paths>",
  "codexStatus":null, "codexLastReview":null,
  "slug":"...", "round":1, "maxRounds":8, "state":"running|converged|failed|stalled",
  "cleanStreak":0, "revision":0, "updatedBy":"...", "updatedAt":"ISO", "note":"..." }
```
Schema = Codex's Docker-worker fields (`turnOwner`/`instruction`/`codexStatus`/`codexLastReview`) +
Claude's orchestration fields. Codex edits only `turnOwner`+`codexStatus`+`codexLastReview` **in place**
(its smoke test proved it preserves the rest); Claude owns everything else and writes `instruction` at
each hand-off. Exactly one side writes per turn (strict alternation) → no write race; `revision` bumps
on every write as a change signal. Reads strip a UTF-8 BOM (PowerShell writes one).

## The round (see CLAUDE_ROUND_SOP.md / CODEX_STANDING_INSTRUCTIONS.md for the exact contracts)
1. **Claude** revises `plan.md`, writes the next `instruction`, sets `turnOwner=codex`.
2. **Codex** (Docker worker, fired by `watch-and-run.ps1`): reads `/out/baton.json`, reviews
   `/repo/…/plan.md` vs. the codebase + prior rounds → writes `/out/reviews/rNN_codex_review.md` (with
   `VERDICT` footer) → sets `turnOwner=claude`.
3. **Claude** (auto-woken): scope gate → verifies each Codex claim against code (accept or **reject w/
   evidence**) + spawns 3 parallel `Explore` agents (Correctness / Security / UX) → writes
   `rNN_claude_response.md` → revises `plan.md` → convergence check → either stop or hand off again.
4. **Converged** when Codex `blockers=0,high=0` AND the 3-agent audit has 0 blocker/high AND the plan
   didn't materially change. Hard cap `maxRounds` → `failed` with a written stalemate list.

## Security / write-scope — HARD-enforced by Docker mounts
Codex may **read the whole repo** (`/repo`) but may **write only** `/out` (== `<slug>/codex-out/`). This
is enforced by the **container mounts**, not just detection: `/repo` is bind-mounted **read-only**, `/out`
read-write. Codex physically cannot modify `plan.md`, `rounds/`, source, or git state — the write simply
fails at the OS/mount layer (verified: the smoke test read `/repo/package.json` and wrote only `/out`).
This is the exact "read repo, write one dir" policy — the strongest of the options we considered.

Defense-in-depth on top (should never fire): Claude's SOP §0b re-checks `plan.md`'s hash + anything
changed outside `codex-out/` and halts (`state=failed`) on any surprise. Note: the repo holds gitignored
secrets (`scripts/serviceAccountKey.json`, `.env`) — Codex can *read* them like any repo access; never
let the loop commit, and keep those gitignored. (`lib/verify-sandbox.mjs` + the old `_verify/` probe
matrix remain as an optional independent FS re-check; the Docker mount is the primary guarantee.)

## Operator setup
**Codex side (one-time):** `cd docs\plans\loop\docker-codex` → `.\build.ps1` → `.\login.ps1` (run
`codex login --device-auth` inside, log in to your subscription) → `.\status.ps1` shows "Logged in".
**Per loop, Codex side:** start the host watcher ONCE in its own PowerShell window:
```powershell
cd C:\Users\dmchw\vocaboost\docs\plans\loop\docker-codex
powershell -ExecutionPolicy Bypass -File .\watch-and-run.ps1
```
It polls `/out/baton.json`; on `turnOwner=codex` it runs `.\run-once.ps1` (round 1) / `.\resume-last.ps1`
(later, warm). Codex follows the baton's `instruction`, writes its review, flips `turnOwner=claude`. Stop
with Ctrl+C (it self-exits when `state≠running`).

**Claude side:** just tell Claude *what to plan* (and the `<slug>`, default `x` to match the Docker
mounts). Claude writes `plan.md`, inits the baton (`turnOwner=codex`, round 1) with the round-1
`instruction`, and launches its background waiter. From there Claude auto-continues each time Codex hands
back — no pausing. Each `rNN_claude_response.md` + a one-line chat summary keep it watchable.

## Failure modes & safety
- **Codex never hands back** → `baton-watch.sh` times out (default 30 min) → `state=stalled` → Claude
  reports and stops. `watch-and-run.ps1` also warns if the container returned without flipping `turnOwner`.
- **Wrong session on resume** (you ran another Codex job mid-loop) → `resume --last` picks newest; simplest
  fix is don't run other Codex jobs during a loop (the codex-home volume is dedicated to it).
- **Runaway rounds** → `maxRounds` cap ends it as `failed` with the open disagreements written down.
- **Disagreement, not bug** → a round can legitimately end with Claude REJECTING a Codex finding
  (documented with `file:line`); that's the design, not a failure.
