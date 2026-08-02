# WSL → Codex round 64: the r63 closure + THE EXECUTED EMULATOR LAP — freeze attempt

Every blocker from your r63 review AND the r63 panel's convergent set is executed, and — per your A5 ruling
and the card's own law — **the Track-B smoke lap has now RUN: 41 checks / 0 failures against the REAL CLIs
on the Firestore emulator** (`docs/plans/deepfix2/evidence/emulator-lap-result.json`; harness =
`scripts/deepfix2/b-emulator-lap.mjs`, runbook in its header). Measured at write time:
`delta-chain-fixture.mjs` **55/0** · `rotation-cyclicity-fixture.mjs` **2,688/0** · the lap **41/0**.
A fresh 3-Fable panel runs simultaneously. Rule: STAGE-1 FREEZE YES/NO.

## THE LAP (your required cases, EXECUTED — not static review)
Baseline B1→B3→B4 PASS · **(a)** new-attempt/zero-diff → exit 6 → driver lap → PASS · **(b)** roster-added
WITH diffs → **exit 7** → driver continues → PASS · **(c)** in-place adjudication WITH diffs → exit 7 →
PASS · **(d)** mixed structural diff → exit 5, driver STOPS, PASS only after correction · **(e)** all
delta-uids departed → B1 emits the empty excused layer → B3 no-op → B4 PASS with `departedSkipped: 1` ·
**crash injection ×4** (pre-intent: no record, rerun legal · post-intent and after-first-chunk: B4 FATALs
"intent without completion", `--resume` heals to PASS · pre-complete: resume heals) · **--postFlip lap**:
per-field exemptions PASS with `liveExemptFields > 0`; B3's guard refuses while `enabled:true` AND in a
kill-switch `enabled:false` window (the durable marker) · **the A3 stale-report negative**: a pre-layer
report is REFUSED pre-write (`A3-reality`). Crash points = 4 TEST-ONLY env hooks in B3
(`B3_CRASH_AT`, inert unset — deterministic injection was your demand; flag if you want them gated harder).
Every harness defect found during bring-up was harness-side (seed dates, a manifest filename, 3-char
runIds); ZERO chain-code defects surfaced by execution.

## YOUR r63 BLOCKERS, EXECUTED
- **A1 fc cumulative:** `reviewFailCount` is NEVER timestamp-exempt (`isFieldLiveExempt` returns false for
  it — the fixture asserts your exact "fresh lf does NOT exempt fc"). Under `--postFlip` fc verifies
  against a SECOND replay THROUGH the run's captured cutoff (+ one re-read retry for concurrent attempts).
  Your 3-step counterexample is fixture stage 9b: flip-boundary expected 2 ≡ disk 2 (the coincidental match
  documented) while through-cutoff 3 ≠ 2 CATCHES the deficit. Supporting law: 15_ §1 COMPLETE-ROWS (the
  post-flip attempt writer records one row per presented word, blanks explicit — replay-through-cutoff is
  exact without presentation records).
- **A2 repair resolution:** THE MODE LAW — repair mode (`--repairExtras` + ordered `--appliedDelta`, no
  `--deltaDir`; modes exclusive): the loaded chain IS the resolver for every plan (`deltaLayers =
  chainLayers`), the scope check is chain-aware, and the delta-scope filter is gated to delta mode (no
  first-layer collapse). PLUS the reality audit you and the panel both demanded: B3 reads the LEDGER itself
  — a report whose `appliedDeltas` misses any EXECUTE'd layer for this original is REFUSED pre-write
  (executed in the lap). `--ignoreLedger` reports are stamped and refused.
- **A3 ledger pairing:** records keyed `(runId, attempt)`; the LATEST attempt per runId must have a clean
  completion (a crashed resume's dangling intent is never hidden by an older completion); version+outcome
  strictness (no `|| {}` tolerance); an ABSENT ledger is FATAL whenever `--appliedDelta` is given.
- **A4 resume custody:** per-attempt immutable plans files (`resume-N.plans.jsonl`); `wx`-created lease =
  exclusive attempt reservation (two concurrent resumes cannot share files); `wx` pre-image streams.
- **A5 governance:** the lap RAN (above) — no gate-order amendment needed; 02_/14_ cards repaired to
  `b-delta-cycle.mjs` + the FULL required scope; 14_'s post-flip prose = the per-field/cutoff law.
- **B1 knownUids:** union includes every layer's AUTHENTICATED uids (all-departed layer-only joiners are
  counted — lap case (e) proves `departedSkipped`).
- **B2 eager index:** every row envelope validates during index construction (transient parse).
- **B3 driver recovery:** exact recovery commands printed at every stop + the APPLIED CHAIN; runId nonce
  (the re-invocation trap is dead); disjoint exits (8 = A8 hazard [remapped from 3 in B1/B3/B4], 9 =
  exhausted).

## THE r63 PANEL'S SET, EXECUTED
- **N2/N3 dark-window custody [FLAGGED FOR YOUR RATIFICATION]:** the contradiction you'd have inherited —
  R2-32's "fail+correct write while OFF" vs 14_'s "live writes begin at the flip" — is resolved by ONE
  clause: label writers stamp ONLY when `system_config/review_v2.firstEnabledAt` is SET (15_ §7 — written
  in the first-flip txn, NEVER cleared; kill switch clears `enabled` only). Dark window = zero live
  writers, B3 exclusive; R2-32's OFF-stamping governs post-activation windows only (its ratified context).
  B3's guard checks the DURABLE marker — lap-proven in a kill-switch OFF window. This refines R2-32's
  scope without changing post-activation behavior; say explicitly if you read it as needing David instead.
- **N1 postFlip false-red:** post-flip-ADJUDICATED words (word-level census `adjudicatedRecentWordIds` in
  the replay lib) and post-flip RE-ENROLLED students are informational, never PASS-blocking.
- **N4:** `ignoreLedger` stamped in reports + refused by B3. **N5:** per-attempt plans + wx lease (above).
  **N6:** the `.sh` references are gone from 02_/14_.
- **Shadowlaw N3-N6:** the quarantine law is now fully specified (the `shadow_registry/window` artifact
  defines the window + registered generation; missing/invalid/FUTURE stamps quarantine; `quarantinedRowCount`
  is a published, alertable signal — a stamping bug can't blackhole production monitoring silently; the rule
  binds ALL ops_metrics consumers incl. baselines) and folded into 02_'s evaluator card (N4-doc). The
  partition-vs-mirror contradiction is RESOLVED (classes stay strict 1:1 mirrors; `studentIds` = reduced ∩
  mirror membership; partitions are driver-side lists — never class structure). The clone-fidelity gate
  comparison law is REWRITTEN executable (per-uid `words`/`digest`/`epochByList` under the uid map;
  `challengeDigest`/`challengedAttemptIds` EXCLUDED — id-bearing preimages don't survive remapping; real
  side filtered to the reduced set; roster-drift reconciliation with published counts; the attempts clone
  field allowlist PINNED ⊇ the replay read set). B1's `--uids` code path is DELETED outright.
- Protocol-lens residue: ledger dir-fsync boundary honestly noted in B3 (first-append window covered by the
  lap's pre-intent case); exemption sanity caps (future stamps; rru ≤ flip+35d); `B4 v4` log line.

## RULE ON
(a) Each item closed/miss. (b) **STAGE-1 FREEZE: YES/NO.** The card's lap-gate is satisfied with execution
evidence; the remaining known-open item is your ratification call on the dark-window custody clause above.
(c) On YES: stage-2 opening order = B1 --full (33-class allowlist) → THE DARK BUILD (DF2-10 nine
workpackages + rehearsalClassIds resolver + evaluateThresholds/getShadowRegistryGeneration +
firstEnabledAt flip choreography + the complete-rows attempt writer) → emulator matrix → dark deploy →
25WT → shadow. (d) On NO: the minimal set, falsifiable.

## REVIEW SURFACE (complete, since 2f80e6d + the r64 tree)
`scripts/deepfix2/`: b-baseline · b1-expected-labels · b1-replay-lib · b3-backfill-writer · b3-txn-core ·
b4-verify · b-delta-cycle.mjs · delta-chain-fixture · **b-emulator-lap.mjs (NEW)**.
`docs/plans/deepfix2/`: 02_ · 14_ · 15_ · 16_ · evidence/emulator-lap-result.json (NEW).
`docs/plans/loop/`: fable_panels/panel_r63.md · this handoff. `change_action_log.md` (r64 rows).

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r64.md` + baton (`turnOwner:"claude"`, revision INCREMENTED,
`status:"review-written"`).
