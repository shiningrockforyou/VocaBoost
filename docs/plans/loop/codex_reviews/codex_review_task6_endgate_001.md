# Codex review — TASK6_ENDGATE round 16

Verdict: NEEDS_RERUNS

I do not approve closing Task 6 / D1 on the current evidence package.

The report is honest, but its own facts are exactly the reasons D1 is not closeable yet: no consolidated single-runId certification exists, M-WB is not clean, flag-ON M-UI is deferred, DG-2/DG-3 are not captured, and the green matrices span different git HEADs and flag states. “Audits replace soaks” supports moving validation into audits; it does not justify waiving the audit binding that proves what was tested.

## Blocking reasons

### 1. The formal cert is still open, and the cert script would reject the current set

Evidence:

- `audit/deepfix/task6/TASK6_REPORT.md:19-21` says no `DEEPFIX_AUDIT_CERT_*` exists and single-runId cert is open.
- `audit/deepfix/task6/TASK6_REPORT.md:110-137` says the strict consolidator would not certify because of missing M-WB, git-head mismatch, baseline/static mismatch, and flag-state mismatch.
- `audit/playwright/lsr_deepfix_cert.mjs:26-30` defines the cert as all six matrices present, all-clean, same bound deployment/runId family, flag-ON where required, and `M-STATIC target == shipped`.
- `audit/playwright/lsr_deepfix_cert.mjs:72-77` defines the canonical six as STATIC, UI, WB, MIG, CALL, RULES — not M-NET.
- `audit/playwright/lsr_deepfix_cert.mjs:125` says M-WB has no design-documented deferrals and crafted-precondition white-box scenarios must pass.

A report-level waiver is not the same as a bound certification artifact. If the intended policy is to waive/replace M-WB with M-NET, that policy must be encoded in the end-gate artifact or in an explicit signed waiver artifact, not left as an informal proposal in the report.

### 2. The target report is stale/inconsistent about M-STATIC

Evidence:

- The handoff says `deepfix_static_59df732-baseline` is CLEAN 41/0.
- The artifact exists and is clean: `audit/playwright/findings/deepfix_static_59df732-baseline.json` has `verdict=CLEAN`, `target=baseline`, `summary.pass=41`, `fail=0`, `invalid=0`.
- But `audit/deepfix/task6/TASK6_REPORT.md:25-37` still presents the latest M-STATIC as `NOT_CLEAN 38/3` / live discrepancy.
- `audit/deepfix/task6/TASK6_REPORT.md:50-53` says the expected clean rerun would happen / still show fail until rebased; that is now outdated by the 59df732 clean artifact.

The end-gate report cannot be the acceptance artifact while it contains a stale red/live-discrepancy narrative contradicted by the current evidence.

### 3. M-WB and flag-ON M-UI are not certified

Evidence:

- `audit/deepfix/task6/TASK6_REPORT.md:44` says flag-ON M-UI is deferred.
- `audit/deepfix/task6/TASK6_REPORT.md:45` says M-WB is NOT-CLEAN / 0 PASS.
- `audit/deepfix/task6/TASK6_REPORT.md:67-85` classifies W-* failures as harness artifacts, but that classification is not consumed by the cert script and is not a formal replacement for the canonical matrix.

I accept the analysis that these are likely harness artifacts, not product defects. I do not accept using that as an implicit D1 closure. Either repair/rerun the matrices or create an explicit waiver/substitution artifact that the end-gate can validate.

### 4. DG-2 / DG-3 are still required but not captured in this end-gate package

Evidence:

- `audit/deepfix/task6/TASK6_REPORT.md:100-101` says Codex must capture deployed `exports.version` and hosting build-stamp at the end-gate.
- This review package does not include those captured probe outputs.

If the environment that owns the live probe is WSL/WinClaude rather than this shell, that is fine, but the outputs must be recorded in the Task-6 evidence before D1 closes.

## Required path to GO

Single-runId certification is mandatory before D1 closes, unless David explicitly approves a named waiver artifact. I would accept either of these two paths:

### Path A — strict cert

Rerun/bind on the current accepted HEAD/build family:

1. M-STATIC on current HEAD, with the target required by the cert path.
2. M-CALL flag-ON emulator.
3. M-RULES emulator with non-null rules sha binding.
4. M-MIG `--dry` on the same HEAD.
5. M-UI current prod or current bound build, with required scenario coverage for the D1 scope.
6. M-WB fixed so the canonical white-box matrix is clean.
7. DG-2 and DG-3 live probes recorded.
8. Run `lsr_deepfix_cert.mjs <runId>` and produce `DEEPFIX_AUDIT_CERT_<runId>.{json,md}`.

### Path B — explicit waiver/substitution cert

If M-WB and flag-ON M-UI are being intentionally waived/deferred because post-cutover full-UI audits replace them, make that explicit and machine/audit-bound:

1. Update the certification logic or create a separate end-gate waiver artifact that records:
   - M-WB → M-NET substitution, including why W-* are harness-artifacts and which matrices cover the product behavior;
   - flag-ON M-UI deferral and exact post-cutover audit that will cover it;
   - DG-2 / DG-3 live probe outputs;
   - current-head M-STATIC clean artifact;
   - current-head bindings for CALL/RULES/MIG/UI/NET where used.
2. The waiver artifact must be explicit that this is not `lsr_deepfix_cert.mjs` strict certification.
3. David must accept that waiver as the D1 acceptance basis.

Without one of those two paths, D1 remains open.

## Exact reruns/bindings I require if choosing the rerun route

- Re-run or re-bind on current HEAD/build: `M-STATIC`, `M-CALL`, `M-RULES`, `M-MIG --dry`, and `M-UI`.
- Either re-run/fix `M-WB`, or formally replace it with `M-NET` via a documented waiver/substitution artifact.
- Capture DG-2/DG-3 live probes and rules sha.
- Produce a final `DEEPFIX_AUDIT_CERT_*` or explicit `TASK6_ENDGATE_WAIVER_*` artifact before marking D1 complete.

## What I am not disputing

- The individual green results appear real where artifacts exist.
- The W-* failures may well be harness artifacts rather than product defects.
- The 59df732 M-STATIC artifact is clean.
- PR-1/PR-2 have their own Codex GO statuses and are separate from this Task-6 end-gate.

The issue is acceptance binding, not the likely product behavior.
