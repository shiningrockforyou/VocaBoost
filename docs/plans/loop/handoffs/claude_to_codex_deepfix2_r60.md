# WSL → Codex round 60: the r59 acceptance rebuild — Track B v2 · H6 closures · fixture v4 · shadow v4

Every r59 acceptance condition is executed (rows logged 2026-08-03). A fresh 3-Fable panel runs simultaneously
(the r59-era panel was killed by a usage pause and NOT resumed — your review superseded its scope).
Rule: stage-1 freeze YES/NO + shadow execution-readiness.

## THE SIX STAGE-1 CONDITIONS, EXECUTED
1. **Mutation/delta protocol [A1/A2]:** the shared lib computes an order-insensitive per-student
   `challengeDigest` (attemptId|wordId|status|reviewedAt rows — detects in-place adjudication of OLD attempts);
   B1 emits it; B3 AND B4 recompute it LIVE and recompute-the-student on mismatch; B4's verdict is the ONE
   fail-closed composite (PASS iff zeroDiff AND delta empty) and emits a HASH-BOUND delta manifest; B1 gained
   exact `--uids` + `--watermark` + `--outDir` modes; B3 consumes `--deltaManifest` (bound to the baseline
   manifest by hash).
2. **B3 v2 convergent [A3/A4/A5]:** reads every target's current fields; writes EXACT diffs only
   (expected-null ⇒ `FieldValue.delete()`); second pass = zero-write BY CONSTRUCTION with `verifiedEqual`
   reported separately; PHASE-SPLIT durability — the complete pre-image + write-plan + hashes publish in an
   immutable run manifest BEFORE any write; runIds are single-use (a reused id with an existing backup is
   FATAL).
3. **Binding [A6]:** explicit `--manifest`; probe/version/mode + JSONL AND summary hashes verified;
   `classesMatched` ≡ allowlist; baseline-uid-set ≡ live-scope (drift FATAL — no silent recompute);
   `--execute` requires mode=full. SMOKE ON RECORD: the fence FIRED against the regex-built sample baseline.
4. **One authority law [A9]:** `reviewRestingUntil` is LIVE-ONLY — the backfill seed AND the operator flag are
   DEAD (15_ §1 + 14_ §3 + 16_; the launch transient documented, David-veto flagged); the manual-override
   exception = the EXACT synthetic shape (graded:true ∧ sessionType new ∧ answers []).
5. **H6 cursor/concurrency [B2-B7]:** the SAME-DAY CROSS-CLASS law (same logicalDay ⇒ REUSE lastQueueRef's
   words, NO cursor advance — one sweep segment per logical day); EXACT cursor transitions (traversal-order
   last element; five cases incl. underflow/no-active/OFF→ON); the rerun count-query residue KILLED + a worked
   allocator first-use; the reset fence += grading finalize/force-pass/B3-writer + cleanup += review_cursors +
   compose_keys; composeKey docIds are HASHED w/ token validation; `job_quarantined` is in the §8 frozen table.
6. **Fixture v4 [B1]:** ONE wording everywhere (the two-consecutive-laps guarantee — 10_ updated); the mid-lap
   size-change leg now GENUINELY exists (size shifts every 3 days during laps): **2,683 checks, 0 failures**;
   your burst-return case remains the permanent regression; the production-composer differential stays the
   launch-gate deliverable (stage-2).
Plus [A7/A8]: B4 is TWO-SIDED (six orderBy-exists sweeps catch extra label-bearing docs) with a
`diffsTruncated` flag; the lib runs a cross-list wordId collision census and consumers ABORT on divergence.

## SHADOW v4 [your C1-C9]
zx/RUN-REGISTRY guard reconciliation (every `shadow_` predicate dead) · ONE auth scheme (passwordless + custom
tokens; ~30 Playwright exceptions) · B1 CLI flags implemented · the zero-skip/reduced-scope law · post-A export
+ per-battery restores · the containment TRIAD (the wrapper is never claimed for server-side writes) · the
monitoring two-mode split · study_states output schema · THE PERMISSION LEDGER CLOSED (B/C/E granted verbatim;
D split-ratified; the ON switch parked on David's own corrected "Agreed. Go." — win rev139-141 on record).

## RULE ON
(a) Each condition: closed or the exact miss. (b) **STAGE-1 FREEZE: YES/NO.** (c) Shadow: execution-ready?
(d) Name anything in the winclaude rev139-141 authority record you read differently.

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r60.md`; baton → turnOwner=claude, round=60,
codexStatus=review-written, codexDecision=DONE, updatedBy=codex, revision=193, codexReviewRepoPath set.
