# Codex review — D3.5 risk-remediation triage, round 34

Target: `docs/plans/D3.5_RISK_REMEDIATION.md`  
Handoff: `docs/plans/loop/handoffs/claude_to_codex_d35_risktriage_r34.md`  
Verdict: **GAPS-FOUND**  
Bottom line: **SOUND-WITH-GAPS**

The triage is directionally right: it correctly downgrades the D3.5 audit confidence to qualified, separates auditable risks from tooling/code defects, and identifies the important seams from the report critic pass. I would not act on the doc as-is, though. Several recipes can still green-light a real risk because they do not faithfully exercise the branch they claim to exercise.

## Ranked issues

### BLOCKER — R9 recipe does not actually exercise the grandfather branch

Triage claim:

> "re-seed a throttled clone with `submittedAt` stamped before the epoch ... Drive: the same throttle escape/hold protocol as R6."

Problem:

The code path under test is `isCompletionEngagedServer(fpDayReview, FORCED_PATHWAY_GRANDFATHER_EPOCH_MS)` in `functions/foundation.js`. `fpDayReview` is the day's stored review attempt fetched at completion time. If the Playwright drive submits a fresh review, that review gets `submittedAt: serverTimestamp()` / `Timestamp.now()` after the epoch, so the grandfather branch is not exercised even if older seeded attempts are pre-epoch.

The client mirror has the same shape: `completeSessionFromTest` builds a synthetic just-submitted review with `submittedAt: Timestamp.now()`. A normal drive therefore tests the post-epoch path.

Fix:

Define an R9-specific reproduction, not "same as R6":

1. Seed a same-day review attempt for the exact anchored day with `submittedAt < 1784333239063`.
2. Ensure that attempt lacks the new `engagedReview` stamp or has the old shape the grandfather was meant to tolerate.
3. Trigger the completion/starting-phase reader that consumes that pre-existing review without replacing it with a fresh post-epoch review.
4. Assert the branch outcome against `isCompletionEngagedServer`: pre-epoch review counts engaged; post-epoch non-engaged skip does not.

If that pure UI route cannot be induced, R9 is not Playwright-determinable as written; make it a callable/unit-style characterization plus one UI smoke.

### HIGH — R4 cannot prove the June-29 nonce/HMAC outage class while grade-token enforcement/minting are off

Triage claim:

> "Browser-storage / nonce corruption ... YES ... mismatched grade-token nonce ... mirroring CS-2026-06-29."

Problem:

The live function config has `GRADE_TOKEN_ENFORCED=false` and `GRADE_TOKEN_MINT=false` in `functions/index.js`. The original June-29 outage was specifically grade/save docId divergence causing HMAC token verification rejection. With token mint/enforcement off, a Playwright poisoning test can still exercise recovery-state and attempt-id behavior, but it cannot prove the HMAC failure class is fixed or safe to re-enable.

Also, the recipe says "mismatched grade-token nonce" as if there is a grade-token storage key. The actual storage keys are in `src/utils/testRecovery.js`:

- recovery state under `testId` (`vocaboost_test_<classId>_<listId>_<type>`);
- nonce under `${testId}_nonce`;
- fallback nonce in `sessionStorage` under the same suffix;
- `dailySessionState` in `sessionStorage`;
- intentional-exit keys.

The grade token itself is returned by `gradeTypedTest`; it is not a localStorage key.

Fix:

Split R4 into two risks:

- **R4a live storage resilience:** poison actual keys (`testId`, `${testId}_nonce`, `dailySessionState`, intentional-exit key), drive MCQ and typed, assert no wrong durable progress / no duplicate advance / controlled recovery UX.
- **R4b grade-token re-enable safety:** not live-audit-determinable under current flags. Requires a staging/emulator or flag-on sandbox where `GRADE_TOKEN_MINT/ENFORCED` are enabled, then reproduce storage failure and assert server-echoed `attemptDocId` is used for save.

Do not let a green R4a clear R4b.

### HIGH — R2 fix is incomplete: current `csdImplausible` has a unit/logic defect, not only a first-list blind spot

Triage claim:

> "Extend per-list logic to `csdImplausible` in `data-integrity-sweep.mjs`."

Problem:

Moving the check into the per-list loop is necessary but insufficient. The current code checks:

```js
if ((twi > 0 && csd > twi + 7) || (twi === 0 && csd > 7)) ...
```

That compares **days** (`csd`) to **words** (`twi`). For a normal pace-80 list, a badly inflated `csd=12, twi=320` will not satisfy `12 > 327`, so the detector remains blind even after per-list movement. This directly affects R1 sizing.

Fix:

Replace the detector with a per-doc, per-list, pace-aware predicate. At minimum:

- derive or infer the list/class pace;
- compute `introducedDays = ceil(twi / pace)` or use the latest valid anchor day;
- flag `csd > introducedDays + tolerance` and `twi > listWordCount`;
- include list-end/cycling exceptions explicitly.

Then rescan 26SM before prioritizing R1.

### HIGH — R1 has an internal contradiction and needs a stricter seed rule

Triage claim:

Self-check says:

> "`live_oyk` currently sits in a colliding pre-per-tag-fix class ... RE-SEED it via the fixed per-tag seeder..."

But R1 detail says:

> "No new seeding needed."

Problem:

Those cannot both be true. This is exactly the previous failure mode: a superficially valid drive can load the wrong list/class or inherit polluted class settings. Since R1 is the highest-priority behavior risk, it must use the fixed per-tag clone, not the old colliding artifact.

Fix:

Make "fresh per-tag re-seed before R1" a hard precondition. The R1 recipe should fail `INVALID_PRECONDITION` unless:

- sandbox class id is unique to this persona;
- assigned list set is exactly what the recipe expects;
- direct navigation lands on the intended `classId/listId`;
- pre-read confirms `csd=12`, `twi=320`, latest valid new anchor day 4, and no day-13/day-5 post-fix anchor exists.

### MEDIUM — R3 is auditable, but the oracle currently conflates two different race classes

Triage claim:

> "double-click ... rapid-mash ... two Playwright contexts ... Oracle: exactly one advance, exactly one anchor"

Problem:

Same-mount double click and retry should be idempotent on the same attempt doc id. Two isolated browser contexts will normally have different nonces and can create different attempt docs for the same logical day. That may be a real product risk, but it is not the same as a double-click race, and "exactly one anchor" may classify a known unshipped logical-idempotency gap as a D3/P4 regression.

Also, Playwright cannot reliably create the critical timing window by just clicking fast if React disables `submitting` quickly. It needs controlled request interleaving.

Fix:

Split R3:

- **R3a same-page submit re-entry:** double click / Enter / retry-save in one page. Oracle: one attempt doc id, one completion, one csd advance.
- **R3b two-context logical duplicate:** two contexts/devices. Oracle: decide explicitly whether duplicate attempts are allowed-but-benign or a confirmed follow-up defect. At minimum require one progress advance and no `csd+2`; if duplicate anchors are considered unacceptable, route to a deterministic logical attempt identity fix.
- Use Playwright network routing to hold one request at the completion boundary and release both requests together; plain rapid-click is insufficient evidence if it does not actually overlap requests.

### MEDIUM — R5 is feasible, but "network trace" alone is not enough to prove no client write path

Triage claim:

> "complete the day while recording browser_network_requests; confirm a Cloud Function callable (`completeSession`/`resolveListProgress`) is invoked."

Code check:

`completeSession` and `resolveListProgress` are real callables. `recordSessionCompletion` routes to `completeSession` when `SERVER_PROGRESS_WRITE=true`; `getOrCreateClassProgress` routes hydration to `resolveListProgress`.

Problem:

Seeing a callable request proves invocation, not exclusivity. The client can still perform direct Firestore writes in other paths/fallbacks (`progressService.js` legacy branch; challenge/BlindSpot surfaces; local session history writes). The test must prove no direct `class_progress` mutation happened from the client after the callable, not just that the callable was present.

Fix:

R5 oracle should require all of:

1. observed `completeSession` callable on completion;
2. observed `resolveListProgress` callable on session entry/readback;
3. no direct client write to `users/{uid}/class_progress/{classId}_{listId}` in captured Firestore traffic, or a rules/emulator denial canary proving such writes would fail;
4. Firestore readback has progress fields expected from the server response;
5. code review confirms no flag-on fallback to `updateClassProgress` for the tested page.

Keep "successful completion advance emits no server log" as the motivation, not as something the network trace by itself solves.

### MEDIUM — Missing residual risk: BlindSpotCheck / non-MCQ-Typed submit surface

Evidence:

`MASTER_TASK_TRACKER.md` ACT-134 explicitly flagged the `BlindSpotCheck` routed test surface as uncovered. `src/pages/BlindSpotCheck.jsx` still calls `processTestResults` directly from its own `handleSubmit`.

Problem:

R1-R9 focuses on MCQ/Typed/DailySession flows. If BlindSpotCheck remains a live route, it is a separate progress-mutation surface and should be represented. If it is dead/admin-only, the triage should say so and cite the route/auth condition.

Fix:

Add R10:

- classify whether BlindSpotCheck is reachable in production by students;
- if reachable, audit one pass/fail submission and verify it cannot double-apply/corrupt class_progress under D3/P4;
- if not reachable, code-review route access and mark it non-risk with evidence.

### LOW — R6 partial-score recipe needs deterministic mode constraints

Triage claim:

> "partial-score reviews — e.g. 0.40, then 0.55, then 0.72"

Problem:

This is feasible for MCQ if the harness intentionally chooses K correct and N−K incorrect answers. It is not reliably feasible for typed unless the grader answer set is deterministic enough. The doc should pin R6 to MCQ or provide a deterministic typed-answer strategy, otherwise a score-drift/failure could become an invalid audit.

Fix:

Specify MCQ-only for the threshold characterization, or require a precomputed answer map and post-grade score tolerance for typed.

## Missing risk summary

Add a BlindSpotCheck/non-standard test-route risk unless source review proves it is unreachable in production.

## Bottom line

**SOUND-WITH-GAPS.** The risk register has the right shape and should continue, but it must be revised before implementation. The single biggest way it could mislead us is R9/R4-style false clearance: a recipe runs green while never exercising the actual branch that created the residual risk.
