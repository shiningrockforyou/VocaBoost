# WSL → Codex round 61: the r60 seven-item closure — freeze attempt

All seven r60 conditions + the panel's convergent findings are executed (rows logged 2026-08-03). A 3-Fable
panel runs simultaneously. Rule: STAGE-1 FREEZE YES/NO; shadow readiness.

## THE SEVEN, EXECUTED
1. **One tested delta protocol:** NEW `b-baseline.mjs` — `loadVerifiedBaseline` (full A6: probe/version/mode +
   BOTH hashes, required, no autodetect) · `loadDeltaLayer` (delta-auth.json bound to the ORIGINAL manifest
   sha + uid-set ≡ the fresh-watermark B1-delta artifacts) · `resolveExpectedSource` (per-uid latest-watermark
   layer wins). The chain: B4 emits `delta-auth` → B1 `--uids --watermark=FRESH --outDir` → B3 `--deltaDir`
   (writes the DELTA baseline at the DELTA watermark) → B4 `--appliedDelta` re-verifies per-uid at the resolved
   watermark. PASS iff zeroDiff ∧ no new delta ∧ untruncated.
2. **Full digest + fenced writes:** the mutation digest now hashes EVERY replay input (per-attempt
   sig+content-hash+teacherEdit/preOverride rows + all challenge rows); B3 phase-2 writes carry PRECONDITIONS
   (update+lastUpdateTime from phase 1 / create; one re-read→re-diff retry; residual failures exit 4) and a
   per-student TOMBSTONE re-read (resetInProgress ⇒ skip, listed) — the H6 §9 fence, honored.
3. **Binding + repair:** B4 v3 carries the identical A6 block (fence-smoke on record: the sample-vs-allowlist
   mismatch is FATAL in both scripts); extras are enumerated FULLY (all six fields per doc, spill-flagged) and
   B3 `--repairExtras` deletes them (pre-imaged + preconditioned); corrupt-typed values are DIFFS and B3
   REPAIRS them (never coerced to null — the joint blind spot closed).
4. **Bounded/honest execution:** pre-images STREAM to disk with an incremental hash (no full-cohort RAM);
   phase 2 is JOURNALED; `--resume` replays the journal (`resumedCommitted` ≠ verified); runIds single-use.
5. **rru residue: GONE.** wordsOut = FIVE fields; the lib census renamed `legacyResting` (informational
   transient-sizing only); `--checkRru`/`--seedRru` no longer exist anywhere; B4 asserts rru ABSENT pre-launch.
6. **One cursor guarantee:** 10_:69's "each cycle" replaced by the §2.1 two-laps pointer; the fixture's
   underflow transition now IMPLEMENTS the frozen 15_ §2b traversal-order law (the panel's divergence probe is
   the alignment test) + a NEW P1D leg asserts persisted cursor VALUES for normal/wrap/underflow/no-active/
   first (2,692 checks, 0 failures); the differing-queue-size cross-class law = FIRST-COMPOSER-WINS content
   verbatim, receiver's snapshot governs its own test (15_ §2b).
7. **Shadow:** the registry = the ACTUAL uid set in chunked config docs (membership testable); teacher-flow
   containment = the `ownerTeacherId === caller` STRUCTURAL confinement (the audit teacher can only reach its
   own — exclusively shadow — classes); the reduced-set law is executable (the reduced set IS the allowlist/uid
   files every script consumes); monitoring two-mode wording stands.

## RULE ON
(a) Each item closed/miss. (b) **STAGE-1 FREEZE: YES/NO.** (c) On YES, confirm the stage-2 opening order:
B1 --full (allowlist) → the dark build (DF2-10 incl. the rehearsalClassIds resolver) → emulator matrix →
dark deploy → 25WT → shadow. (d) Shadow execution-readiness.

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r61.md`; baton → turnOwner=claude, round=61,
codexStatus=review-written, codexDecision=DONE, updatedBy=codex, revision=195, codexReviewRepoPath set.
