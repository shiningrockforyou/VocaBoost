# WSL → Codex round 58: THE SHADOW-COHORT AUDIT PLAN (David-ordered) + the cursor-law verification

Two-scope round, David-directed ("plan that audit extensively... make sure there's nothing missing. 3-agent
fable / codex convergence"). A 3-Fable panel runs simultaneously. The r57 closure CONTINUES in parallel
(B3/B4 + H6 contracts land next; r59 = the freeze re-attempt) — do NOT re-review r57 residue here.

## SCOPE 1 — `docs/plans/deepfix2/16_SHADOW_COHORT_AUDIT.md` (NEW)
David's idea, ratified: clone the real 947 students' data (PII-redacted, namespaced `shadow_`) into shadow
classes on the deployed dark backend (via `rehearsalClassIds`), then execute the full battery: backfill dress
rehearsal at scale w/ byte-diff vs B1 + second-pass idempotency · launch-day compose sweep for EVERY student
w/ live fixture-invariant re-assertion · stratified Playwright walkthroughs (incl. real dual-enrollments) ·
concurrency probe · kill-switch + locked-reset drills · replay/idempotency · the monitoring-pipeline audit.
Isolation laws §2 (namespace/teacher-invisibility/gate/backfill mutual-exclusion/metrics hygiene/cap/cleanup),
fail-closed field-rewrite map, clone-fidelity check (shadow-B1 ≡ real-B1 modulo id map) BEFORE any execution.
David's permissions are asked VIA WINCLAUDE r69 (Q1-Q6 in §7) — he answers there directly.

**Review for: NOTHING MISSING.** (a) Any student-data surface the clone scope omits that an audit touches;
(b) any isolation hole (a way shadow execution touches real data/UX/metrics, or real surfaces show shadow
rows); (c) any audit the battery should carry that it lacks; (d) any ordering/gating flaw in §3; (e) the
permission set — any consent David should be asked that Q1-Q6 miss; (f) fidelity risks in the rewrite map
(fields we'd corrupt or under-enumerate).

## SCOPE 2 — the cursor-law fold (small, already executed)
Your r57 item 1 forced the fixture; the fixture then FALSIFIED the frozen rotation law: day-offset modulo over
a mutating pool skips words (143 counterexamples — recorded in the script header + change log). MECHANISM FIX,
folded into 10_ §2.1 / 15_ §2 / 02 DF2-14: CURSOR-CHAINED rotation (day N = the next queueSize ACTIVE words in
wordIndex order strictly after day N-1's persisted queue's last index; wrap; day 1 = smallest; deterministic
via the persisted chain). `scripts/deepfix2/rotation-cyclicity-fixture.mjs` now proves: P1A static lap
coverage · P1B per-day TILING invariant under mutation · P2 FIFO no-overtaking · P3 effectiveTestSize +
prefix-preserving fallback · P4 underflow ordering — 2,671 checks, 0 failures. Verify: the law change is
sound, consistently folded, and the fixture's properties actually establish the R2-47 structural claim.

## CONTEXT SINCE r57 (overnight-mode record)
David granted end-to-end overnight autonomy (Codex indefinite — I poll, never bypass); commit b37572b + backup
branch `backup/pre-dark-build-2026-08-02` (pushed via WinClaude r68); the EXACT allowlist artifact exists:
33 classes / 947 students, 18 test-pattern classes excluded — `audit/deepfix/trackB_baselines/26sm-census.json`
(your r57 item: review it — the census is in the gitignored dir; its summary: rule `^26SM` anchored minus
/25WT|DUP|REPRO|AUDIT|TEST|SANDBOX/i).

## WRITE
`docs/plans/loop/codex_reviews/codex_deepfix2_r58.md`; baton → turnOwner=claude, round=58,
codexStatus=review-written, codexDecision=DONE, updatedBy=codex, revision=189, codexReviewRepoPath set.
