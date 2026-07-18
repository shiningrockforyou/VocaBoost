# Codex review — P4/D3 cutover execution verification

Verdict: NEEDS-BEHAVIORAL-SMOKE.

Ground truth: confirmed.

Rollback: not justified from the evidence currently available.

D4/P5: blocked.

## A — Ground truth verification

### 1. Git/head state

Confirmed.

- Local `HEAD` is `6bffe1c5a5275b36f346a50d85e555489148e7ea`.
- `origin/main` is the same commit.
- The D-track order is present in git:
  - `59df732` PR-1
  - `26cd8ee` D2/P3
  - `d2bb2bc` PR-3 client
  - `0ddbb34` P4 functions
  - `6bffe1c` P4 client
- `git show 6bffe1c` changes exactly one file, `src/config/featureFlags.js`, with exactly the four P4 client route flags flipped false → true:
  - `SERVER_PROGRESS_WRITE`
  - `SERVER_CHALLENGE_WRITE`
  - `SERVER_REVIEW_MARKER`
  - `SERVER_RESET_PROGRESS`

### 2. Committed posture

Confirmed from source and evidence.

Client posture at `6bffe1c`:

- the four P4 route flags are true
- `FORCED_PATHWAY=true`
- client epoch is `1784333239063`
- `LIST_PROGRESS_CANONICAL` is not a client flag and remains server-side false
- later-track client flags such as cycling/override/teacherIds remain false

Server posture from `deepfix_d3_server_gate_r37.json`:

- deployed short sha `0ddbb34`
- `FORCED_PATHWAY_ENABLED=true`
- deployed server epoch `1784333239063`
- `SERVER_COMPLETE_SESSION_ENABLED=true`
- `SERVER_RESOLVE_LIST_PROGRESS_ENABLED=true`
- `SERVER_RESET_PROGRESS_ENABLED=true`
- `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED=true`
- `LIST_PROGRESS_CANONICAL=false`
- `ANCHOR_VALIDATION_ENFORCE=false`

The functions version response also reports `dirty:true`. That does not refute the flag/sha/epoch proof, but it weakens the claim that the live bundle is fully clean-proven by sha alone. Treat it as a provenance caveat.

### 3. Order invariant

Confirmed.

Evidence shows the fail-closed server gate passed at `2026-07-18T08:37:06Z`, before the client commit/push window around `2026-07-18T08:45–08:46Z`.

This satisfies the round-21 requirement: live server `FORCED_PATHWAY_ENABLED=true` plus matching epoch was proven before routing the client to server progress writes.

### 4. Client live

Confirmed.

`deepfix_buildstamp_6bffe1c.json` reports:

- target `6bffe1c`
- build stamp short sha `6bffe1c`
- `dirty:false`
- `loadedClean:true`
- no real console errors

`deepfix_p4_diag_r37.json` also shows the app loaded and rendered a dashboard for the smoke student with no real console errors.

### 5. Worktree state

Mostly confirmed, with scope caveat.

Current code commits are clean in the sense that deployed code is represented by committed `0ddbb34` and `6bffe1c`. The working tree still contains uncommitted coordination/evidence/harness files and a few tracked audit/docs changes. I did not see an uncommitted application-code diff contradicting the executed cutover posture.

## M-CALL substitute coverage

Confirmed gap.

`deepfix_call_cert-59df732-r34.md` cannot be treated as proof of the now-live P4/PR-3 server path:

- it ran at baseline `59df732`, not deployed functions `0ddbb34`
- `git diff --stat 59df732..0ddbb34 -- functions/` shows a large intervening functions diff: `431 insertions / 22 deletions`
- its flag matrix omits `FORCED_PATHWAY_ENABLED`
- its matrix used `LIST_PROGRESS_CANONICAL=true` and `ANCHOR_VALIDATION_ENFORCE=true`, while current production posture has both false

Therefore it does not exercise the live forced-pathway hold-csd branch now made reachable by the P4 client route flip.

## Behavioral smoke adjudication

The intended 6-assertion post-cutover smoke did not run.

`deepfix_p4_smoke_r37.json` reports:

- `SMOKE_PASS:false`
- `reachedTest:false`
- pre progress doc absent
- post progress doc absent
- `csd_advanced:false`
- `twi_advanced:false`
- `completed:false`
- only `no_list_progress_write:true` held, which is vacuous because no completion occurred

That means the live routed path was not behaviorally exercised. The failure appears to be a sandbox/harness enrollment problem, not direct evidence of product regression. But as an acceptance gate, it is still a miss: the planned smoke was the acceptance instrument that justified compressing the PR-3 soak.

## B — Ruling

Decision: NEEDS-BEHAVIORAL-SMOKE.

I do not recommend immediate rollback solely from the current evidence, because:

- server-first cutover ordering held
- deployed server flags and epoch are proven
- client build is live and healthy
- rollback itself is a live change and should be reserved for evidence of runtime breakage or failed de-risk checks

But I also do not accept P4/D3 as behaviorally certified. Before proceeding beyond "deployed and under observation", the six server-path assertions must pass on live `6bffe1c` or an equivalent live build:

1. normal completion via `completeSession` advances CSD/TWI correctly
2. held-review path records `review_recorded` without advancing CSD/TWI
3. `reviewMode` is written and read back
4. `advanceForChallenge` does not advance a throttle-held day
5. DSF `dayGuardRejected` does not fire on the server path
6. no `list_progress` canonical writes while `LIST_PROGRESS_CANONICAL=false`

### Required de-risk before holding live through 26SM traffic

Yes: a read-only 26SM `system_logs` sweep since the client cutover time is required.

Minimum sweep window: since `2026-07-18T08:46Z`.

Look specifically for spikes or new instances of:

- failed-precondition from `completeSession` / `resolveListProgress` / `resetProgress` / `advanceForChallenge`
- `dayGuardRejected` / `day_guard_rejected_session_cleared`
- `csd_anchor_invalid`
- `anchor_rejected`
- `reviewonly_derivation_mismatch`
- unexpected `review_recorded` volume/payload anomalies

If the sweep is clean, it supports GO-HOLD while the behavioral smoke is fixed and rerun. If the sweep shows a live spike or student-impacting regression, rollback the four client route flags.

## C — D4/P5 gate

Confirmed blocked.

Nothing in this execution review authorizes D4/P5. P5 is a one-way migration and remains blocked until:

- D3/P4 has a passing behavioral smoke or equivalent accepted proof
- post-cutover live monitoring is clean
- a fresh P5 plan is reviewed and Codex-GO'd
- David explicitly authorizes the migration

## Final classification

Ground truth confirmed: yes.

Cutover state: deployed, but not behaviorally certified.

Decision: NEEDS-BEHAVIORAL-SMOKE.

Rollback now: no, unless read-only live telemetry shows errors/spikes or the rerun smoke fails in a way attributable to product behavior.

D4/P5: blocked.
