# Codex review — D3.5 deepfix audit report critic pass, round 33

Target: `docs/plans/D3.5_DEEPFIX_AUDIT_REPORT.md`  
Handoff: `docs/plans/loop/handoffs/claude_to_codex_d35_report_critic_r33.md`  
Verdict: **GAPS-FOUND**  
Bottom line: **QUALIFIED confidence is deserved, unqualified "15/15 across every recovery family" is not.**

I do not see evidence that the deployed D3/P4 fixes are failing. The core late tracker record supports the final operational outcome: `MASTER_TASK_TRACKER.md` ACT-118 records "Cumulative scorecard 15 PASS (11 main + 4 synthetic) / 0 FAIL after choi reclass", and ACT-119 records the 최도훈 forensic/repair. The commit SHAs in the report also match local git history (`59df732`, `26cd8ee`, `d2bb2bc`, `0ddbb34`, `6bffe1c`, `e20b532`).

The report, however, currently overstates what the evidence proves. These are report-quality gaps, but material enough that I would not sign the current wording as convergence-clean.

## Findings

### HIGH — "every recovery family" / "15/15 faithful recoveries" overstates coverage

Report claim:

> "Result: 15 PASS / 0 FAIL across every recovery family"

and:

> "The evidence: 15/15 faithful recoveries through the live UI"

Problem:

The 15 count is supported only as **11 main recovery cases + 4 synthetic cases** (`MASTER_TASK_TRACKER.md` ACT-118), not as exhaustive execution of the full D3.5 plan. The plan contains many declared rows beyond those 15, including browser-storage/nonce B23/B24, other Part-B UI/race/teacher-mutation surfaces, and the larger roster of re-derivable ticketed states. The report caveats browser-storage at the end, but still uses broader language ("every recovery family", "real broken states that generated July's tickets") that implies complete coverage.

Concrete cross-checks:

- `D3.5_RECOVERY_AUDIT_PLAN.md` includes B23/B24 browser-storage/context rows and a much broader Part-B/F matrix.
- `MASTER_TASK_TRACKER.md` ACT-118 narrows the final score to "11 main + 4 synthetic".
- `D3.5_FINDINGS.md` is older and only records 13 behaviors, also showing the report is aggregating late tracker data rather than a single canonical results table.

Fix:

Rewrite the headline as something like:

> "15 selected Tier-3 scenarios passed: 11 main recovery scenarios plus 4 synthetic adversarial boundary cases. These cover the major July progress-corruption families exercised in the audit, but do not certify unrun D3.5 rows such as browser-storage/nonce, broader race/teacher-mutation cases, or the full re-derivable roster."

### HIGH — M7 "server-path proof" is overstated for completion paths

Report claim:

> A PASS requires fresh server-only `system_logs`, "so a green UI that silently ran a legacy client path cannot read as PASS."

Problem:

`scripts/audit/assert-recovery.mjs` treats any log in `SERVER_ONLY_TYPES` as `serverProof`, including `resolve_list_progress`. But `resolve_list_progress` is emitted by the resolver on read/load. It proves a fresh server resolver read happened after the drive; it does **not** by itself prove the tested completion action was written through the server.

This matters because several PASS records use only resolver/reconcile logs as proof:

- `live_oyk`: `resolve_list_progress` only.
- `choi_a12`: `resolve_list_progress` only.
- `lostsave_bc_d6`: `resolve_list_progress` + `csd_twi_reconciled`.
- `live_lhs`: `resolve_list_progress` + `csd_twi_reconciled`.

The code itself confirms the nuance:

- `functions/foundation.js` logs `review_recorded` for hold-csd paths, which is strong action-path proof.
- Normal successful completion advance has no dedicated system log.
- `scripts/cs/scan-canonical-writepath.mjs` explicitly notes: "A successful completeSession advance emits NO system_logs event..."

So M7 is strong for hold paths that emit `review_recorded`, and useful as fresh server-resolver evidence for post-drive readback, but it is not airtight proof that every completion action avoided the legacy client path.

Fix:

Split the proof language:

- "Action-path proof" when the case has `review_recorded` / `day_guard_*` / similar completion-path logs.
- "Fresh server-resolver proof + Firestore invariant proof" when the case only has `resolve_list_progress` / `csd_twi_reconciled`.

Remove the claim that M7 alone prevents a legacy-write false positive for every PASS.

### MEDIUM — The cited canonical findings document is stale relative to the report

Report claim:

The report names `docs/plans/D3.5_FINDINGS.md` as one of the provenance sources.

Problem:

That file is stale in material ways:

- It says "Running total: 13 distinct validated behaviors."
- It says `choi_a12` is open and queued.
- It still frames `choi_a12` as a faithful lost-save re-drive candidate.

The later tracker entries supersede this:

- ACT-118: final 15 PASS after lost-save completion.
- ACT-119: choi reclassified to list-end and real data repaired.

Fix:

Either update `D3.5_FINDINGS.md` to the final state or add a prominent "superseded by ACT-118/ACT-119 and D3.5_DEEPFIX_AUDIT_REPORT.md" banner. Since the report presents it as provenance, leaving it stale creates an avoidable contradiction.

### MEDIUM — Universal `list_progress` empty invariant needs the F8 exception in the report

Report claim:

> "It also asserts the universal invariant that the canonical `list_progress` store stays empty pre-P5."

Problem:

That is true for normal cases, but not literally universal. The F8 canonical-anomaly scenario deliberately seeds a canonical doc and expects `canonicalDocs === 1` with no proliferation. The script has the exception:

```js
if (canonical > 0 && family !== 'canonical-anomaly') ...
```

`D3.5_FINDINGS.md` also states the exception. The report omits it in the methodology paragraph, then lists F8 as a PASS. That reads internally inconsistent.

Fix:

Change the methodology line to:

> "Normal scenarios assert canonical `list_progress` remains empty pre-P5; F8 deliberately seeds one canonical anomaly and asserts no proliferation/coherent read-only handling."

### MEDIUM — "Exact pre-fix broken state, not approximation" is too absolute

Report claim:

> "For each ticketed family we cloned a real student's exact pre-fix broken state ... not an approximation."

Problem:

The seeder is more nuanced than that. `clone-ticketed-prefix.mjs` supports:

- verbatim `cloneEverything`,
- pre-fix overlays,
- `sessionOverlay` reconstructed from CS entries,
- `sessionAbsentVerified`,
- synthetic-from-ticket cases.

The roster itself includes `provenance: "entry"` and reconstructed sessions. That is legitimate audit design, but not always "exact clone" in the ordinary sense.

Fix:

Use provenance-specific wording:

> "Where backups existed, we cloned/re-keyed the real state; where only CS evidence existed, we reconstructed the pre-fix state with explicit provenance; synthetic adversarial cases are labeled separately."

### LOW — Student-facing expectation wording should avoid global guarantees

Report claim:

> "No more runaway day-jumps"

Problem:

The audit proves the known empty/low-review and throttle/hold-csd pathways exercised by the 15 cases. It does not prove every possible concurrency, browser-storage, or unrun UI-race pathway. The report has caveats, but this section is written as a global guarantee.

Fix:

Prefer:

> "Known empty/low-review runaway paths are blocked in the exercised scenarios; already-inflated records still need CS repair; browser-storage/nonce and unrun race surfaces remain outside this certification."

## What looks accurate

- Commit SHA mapping is locally consistent with `git log`.
- `clone-ticketed-prefix.mjs` does rewrite `studentId`, `classId`, `teacherId`, `teacherIds[]`, and `testId`.
- `sandbox-guard.mjs` is fail-closed for write targets and uses the `25WT` class prefix / `lsr_` email convention described in the report.
- `manual-pass.mjs` now refuses out-of-list word ranges, matching the 최도훈 tool-hardening claim.
- `data-integrity-sweep.mjs` now checks `twiOverList` and `phantomAnchor` per actual list, matching the report's mechanism.
- The final tracker entries support the choi reclassification and the final 15 PASS / 0 FAIL rollup, provided the wording is narrowed as above.

## Answer to the handoff's bottom-line question

Is the 15 PASS / 0 FAIL confidence deserved?

**Qualified yes.** It is deserved for the 15 explicitly exercised scenarios and for the major progress-corruption mechanisms those scenarios cover. It is **not** deserved as written for "every recovery family" or as proof that all possible legacy-client/write-path/browser-storage/race false positives are excluded.

Biggest remaining risk: the report currently converts a strong representative Tier-3 audit into an exhaustive coverage claim. Fix the wording and stale provenance, and I would be comfortable with the report.
