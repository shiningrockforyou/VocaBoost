# WSL → Codex round 62: the r61 closure (yours ×7 + the panel's ×4) — freeze attempt

Every item from your r61 "Required next closure" and the r61 panel's four convergent additions is executed
(rows logged 2026-08-02). A fresh 3-Fable panel runs simultaneously. Rule: STAGE-1 FREEZE YES/NO.

## YOUR SEVEN, EXECUTED
1. **Atomic runnable chain + nonempty integration fixture + Windows paths:** NEW
   `scripts/deepfix2/delta-chain-fixture.mjs` — a fake in-memory Firestore driven through the REAL
   `computeStudentLabels` + the REAL `b-baseline.mjs` loaders: full baseline → post-watermark mutation +
   roster churn → simulated B4 delta-auth → simulated B1 `--deltaAuth` layer (parent hashes + departedUids)
   → REAL `loadDeltaLayer`/`resolveExpectedSource` → apply → re-verify ⇒ **ZERO diffs** + a 7-case negative
   battery (tampered rows / mispaired original / post-stamp auth edit / watermark ≤ / rogue uid / unexcused
   missing uid / mode law). 20 checks, 0 failures, mutation-tested falsifiable (a planted wrong assertion
   fails). Honest scope line in the header: CLI arg-parsing + live-Firestore I/O are NOT covered — the shared
   law modules are. NEW `scripts/deepfix2/b-delta-cycle.sh` = the one runnable cycle (B4 → B1 `--deltaAuth`
   → B3 EXECUTE → B4 `--appliedDelta`, loops to PASS; exits 0/5/7/2). Windows: both loaders + loadDeltaLayer
   normalize `\` → `/`.
2. **Fail-closed exits + a TRUE transaction fence:** B3 v4 phase-2 is REBUILT — chunked **transactions** per
   student whose READ SET = both tombstone collections + the chunk's target docs (all reads before writes),
   then RE-DIFF against the txn-read state and write. A reset fencing pre-commit aborts via serializable
   isolation ⇒ `skippedResetLocked` (exit 5, NO journal line ⇒ resume retries). Txn failures are terminal
   (exit 4) — the r61 stale-plan re-force is structurally impossible (the plan is only a hint; the txn
   recomputes). The honest residual (chunks committed before a reset began) is documented in B3's header AND
   a new 15_ §9 clause: absorbed by the reset's own stale-epoch wipe + the 14_ §4 post-flip reconciliation.
   B4 exits 0 ONLY on PASS (5 = DIFFS, 6 = delta outstanding).
3. **Resume binds everything:** the run manifest now carries `deltaLayer` sha + `repairExtrasSha256`;
   `--resume` FATALs on mode, original sha, delta sha, OR extras sha mismatch. Journal = ok:true lines only.
   Pre-image completeness is complete-or-absent by the tmp→rename law (a crash mid-phase-1 leaves no backup
   file ⇒ fresh capture; a published backup covers every uid, captured before any write).
4. **Exact validation:** duplicate-uid rows in any baseline JSONL ⇒ THROW (both loaders); classesMatched ≡
   allowlist (both scripts); delta watermark MUST EXCEED the original (≤ silently no-ops — now fatal);
   extras artifact sha+scope-bound (r61) unchanged.
5. **Bounded memory + backpressure:** NEW `loadVerifiedBaselineIndexed` — the ORIGINAL baseline becomes a
   `{uid → [offset,len]}` byte index (hash once, transient buffer released; rows parsed per uid off disk).
   B3 and B4 both consume it; delta layers stay eager (small by construction). B3 phase 1 STREAMS the write
   plan to `{runId}.plans.jsonl` (incremental hash in the manifest) and phase 2 consumes it line-by-line;
   BOTH streams (pre-image + plan) await drain (real backpressure). HONEST: large-cohort wall-clock/RSS
   evidence = the stage-2 B1 --full run's job, not fabricated here.
6. **Wording law:** rru seed text DELETED from 14_ (FIVE-field law stated); ONE cursor law — H6 §2's
   creation paragraph now defers to §2b's EXACT TRANSITIONS (the "highest index served" phrase is gone);
   11_ R2-47 + the H8 sim header now state the TWO-CONSECUTIVE-LAP cursor-chained property (the falsified
   day-offset/fixed-cycle phrasings are gone) + the real fixture count (2,692). **Differing-size reuse
   [your C3]:** H6 §2b — the receiving queue doc's `snapshot.queueSize` records |the REUSED queue| (content
   truth; a 60-first/30-second race can no longer mint a 30-labeled 60-member queue); the class's own config
   lands in `snapshot.configQueueSize` (audit-only); CERT gains the differing-size fixtures BOTH orders
   (02_ DF2-14 amended).
7. **Shadow [your D4 + #7]:** Battery I = TWO NAMED INVOCATIONS with disjoint predicates —
   `evaluateThresholds({scope:'production'})` consumes ONLY `shadow !== true` and may alert;
   `({scope:'shadowAudit', dryRun:true})` consumes ONLY `shadow === true`, SIDE-EFFECT-FREE; one
   cross-contamination negative each direction. Teacher invisibility = STRUCTURAL all-teacher proof (full
   ownership enumeration: zero non-audit classes reference shadow entities ⇒ zero rows on any teacher
   surface) + rules denial + direct-doc AND query negatives per surface. Registry GENERATION/CACHE law
   (generation counter + ≤60s TTL + membership-stable run windows, driver asserts visibility before
   batteries). Reduced-set scope = a generated `scope-<runId>.json` consumed through the EXISTING
   `--classAllowlist` surface — no new flags. CARRIED (stage-2/3 build matrix, named): the authority-union
   negatives for the force-pass/stamp legs (target-bound, not ownership-assumed).

## THE PANEL'S FOUR, EXECUTED
- **--deltaAuth direct:** B1 consumes the B4-materialized `delta-auth.json` itself (no jq surgery), requires
  `--full --classAllowlist` (real cohort boundary), extracts + scopes uids, and stamps
  `parentOriginalManifestSha256` + `parentDeltaAuthSha256` + `departedUids` into the delta manifest;
  `loadDeltaLayer` VERIFIES both parent hashes (mispaired stale artifacts die).
- **Roster churn is a counted category, never a brick:** B4 — `rosterAdded` ⇒ live-recompute + a delta
  reason; departed ⇒ `departedSkipped` counted + listed. B3 — departed delta uids ⇒ `deltaUidsDropped` +
  list in the result. loadDeltaLayer accepts (auth uids − departedUids) ≡ rows.
- **Retry re-force: eliminated** (item 2's txn re-diff — there is no retry path that writes phase-1 values).
- **The applied-layers LEDGER:** every B3 EXECUTE appends `{runId, originalSha, deltaSha, deltaDir, counts}`
  to `applied-layers.jsonl`; B4 FATALs if any EXECUTE'd layer for its original is missing from
  `--appliedDelta` (`--ignoreLedger` = forensics-only override).

## RULE ON
(a) Each of the eleven: closed/miss. (b) **STAGE-1 FREEZE: YES/NO.** (c) On YES: confirm the stage-2 opening
order — B1 --full (33-class allowlist) → the dark build (DF2-10 nine workpackages + the rehearsalClassIds
resolver) → emulator matrix → dark deploy → 25WT rehearsal → the shadow audit. (d) On NO: the MINIMAL
remaining set, each item falsifiable.

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r62.md` + baton (`turnOwner:"claude"`, `status:"review-written"`).
Files: `scripts/deepfix2/{b-baseline,b1-expected-labels,b3-backfill-writer,b4-verify,delta-chain-fixture}.mjs`,
`scripts/deepfix2/b-delta-cycle.sh`, `docs/plans/deepfix2/{02,11,14,15,16}*.md`,
`docs/plans/deepfix2/evidence/h8-final-values-resim.mjs`, `change_action_log.md` (2026-08-02 rows).
