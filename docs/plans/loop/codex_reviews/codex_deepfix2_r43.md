# Codex review — DEEPFIX 2 v3 final fold-verification (round 43)

**Reviewed:** 2026-07-26  
**Overall verdict: PLAN-OF-RECORD DIRECTION ACCEPTED; WAVE 0 PARTIAL GO; WAVE 1 NEEDS FIXES.**

The round-42 fold is substantially faithful. The program now has a coherent long-range architecture:

- the policy module is authored before it is adopted;
- P5 is census-first;
- server completion-policy twins are retired in a separate post-P5 increment;
- the mixed-mode record contract precedes scheduler/frontier execution;
- the frontier writer has an explicit reviewed contract and covers challenge/override/manual-pass paths;
- the migration/rules/retirement one-way doors have recovered their original gates;
- production exposure is separated from build sequencing through DECIDE-0.

That is enough to accept v3 as the forward planning spine, subject to the bounded amendments below. It is **not**
enough to authorize the whole of Wave 1. Static code verification found one authenticated bypass in the proposed
review-pass gate and two unresolved contracts that can still produce false-ready implementation.

## Authorization matrix

| Scope | Verdict | Why |
|---|---|---|
| Wave-0 documentation/design work: DF2-0H, DF2-03, DF2-42d, DF2-47/43-spec authoring | **GO** | No live-state mutation; dependencies are now honest |
| DF2-01 BlindSpot hide | **GO at its own hosting/review gate** | Named delta and retained data model are explicit |
| DF2-02a safe dead-code deletion | **GO except the dead-lever branch** | Dead-lever disposition is still David item 3 |
| DF2-04 fixture harness | **GO after DF2-03 freezes forced-mode fields** | Correct dependency is stated |
| DF2-05 remediation work | **GO per its own read-only/sandbox gates** | R7/R8 ownership is corrected |
| DF2-06 grader round 2 | **WAIT for David item 4** | Independent of the rest of Wave 0 |
| DF2-07 quick-win messaging | **NEEDS FIXES before implementation** | Its claimed entry reason object does not exist; visible hardcode inventory is incomplete |
| DF2-08 pure policy authoring | **GO after DF2-03/04, compatibility-preserving only** | No live reroute/deploy; default normalization remains separately decided |
| DF2-10 review-pass gate | **NO-GO** | Public automarker bypass + incomplete kill-switch/rollback contract |
| DF2-11 lever UI | **WAIT** | Correctly downstream/dark; do not make writable/enableable before DF2-10 cert |
| DF2-02b retake/deletion | **WAIT for DF2-10** | Correctly sequenced |
| DF2-35 teacher hold panel | **NEEDS a data contract first** | “Currently held + reason” cannot be made authoritative from the named shared UI helper alone |

DECIDE-0 does **not** block Wave 0 or Wave 1; v3 itself says it blocks Wave-3 production exposure only.

---

## 1. Round-42 correction verification

### Accepted

1. **N1 — accepted.** DF2-05 now removes R7 from the P5 gate and assigns the R8 server stamp to DF2-10.
2. **N2 — accepted.** DF2-08 authors/equality-tests only; DF2-10 is first live adoption; DF2-46 finishes consolidation.
3. **N3 — accepted in structure.** Caller inventory, verdict-flip census, explicit target-default decision, adapters,
   and legacy/null/orphan fixtures are separated from the default-OFF release.
4. **N4 — accepted.** `authoritativePassed` is provenance-typed and cannot be supplied as a trusted client input.
5. **N7 — accepted.** `review_retake_required` is a durable blocking state, not a seen-once event.
6. **N8 — accepted.** Token copy is Monday 04:00 Korea time or a localized instant, not bare “Monday.”
7. **N10 — accepted.** DF2-43 explicitly waits for DF2-46 and the scheduler authority it must affect.
8. **N11 — accepted.** DF2-46 shares pure policy primitives/`deriveCompletionDecision`; it does not route a
   transaction through the UI entry view-model.
9. **N12 — accepted.** Scheduler mode sections are provisional and must be rechecked after DF2-47.
10. **Deployment-set fold — accepted as a provisional instance.** The ten named callables include `resetProgress`
    and `version`, and §0 correctly says the final set must be re-derived from the actual diff.
11. **DECIDE-0 fold — accepted.** It controls exposure, not whether the program can build.
12. **Ecosystem seams — accepted with cleanup notes below.** The architecture supersession banner, MAP closure,
    and MASTER pointer now direct future planning to DeepFix2.

### Only partially closed

- **N5 is not closed yet.** The plan says “decide + fixture the amnesty semantics”; it does not state the expected
  behavior of a durable `passed:false` review across ON → OFF/threshold removed → ON.
- **N6 is only partially closed.** DF2-10 names `holdReason`, `throttleReviewOnly`, and `engaged`, while DF2-31 says
  it will also receive `reviewOnlyReasons`. The exact response schema is still inconsistent.
- **N9 exposed a new factual error.** DF2-07 says the client already reads an entry-returned `reviewOnlyReasons`
  object. It does not.

---

## 2. Findings

### B1 — BLOCKER: `markReviewComplete` can bypass the new review-pass gate

The plan notices the automarker risk but does not specify the required server proof:

> `markReviewComplete` (automarker must not mint completion evidence for a failed review)

The current callable is student-authenticated and accepts only `{classId, listId, dayNumber}`:

- `functions/index.js:617-642` checks authentication, shape, enrollment, and list entitlement.
- It does **not** prove that the day truly had no scoreable review.
- `functions/index.js:653` calls `writeUpgradedReviewMarker`.
- `functions/foundation.js:1076-1102` writes `score:100`, `passed:true`, `autoCompleted:true`.
- `functions/foundation.js:624-625` treats an automarker/zero-question review as engaged.
- `functions/foundation.js:784-800` accepts a paired engaged review as completion evidence.

Once DF2-10 adds `passed === true` to the review readers, this marker still passes that test. Therefore an
authenticated student can:

1. submit a real scored review that fails;
2. call `markReviewComplete` directly;
3. mint a second, `passed:true` paired review marker;
4. satisfy the planned review-completion reader.

This is a structural gate bypass, not a UI-only concern.

#### Required correction

DF2-10 must choose and specify one of these server-owned designs:

1. **Preferred:** retire/disable the public marker route and let `completeSession` write the deterministic marker
   internally only after it has server-proved the no-score exemption; or
2. make `markReviewComplete` re-derive, server-side, that no scoreable review existed for this exact
   `(student,list,day,anchor)` and reject if a real review was available or a scored failed review exists.

The proof must be bound to current CSD/day guard, list, anchor range, assignment/mode, and concurrent attempts. A
client assertion such as `noReviewAvailable:true` is not proof.

#### Required tests

- scored failed review → direct `markReviewComplete` call is rejected and writes no passing marker;
- scored failed review + concurrent marker call cannot create completion evidence;
- genuine empty/all-mastered review → the server-owned no-score path writes exactly one idempotent marker;
- normal scored pass remains valid;
- gate OFF retains the explicitly chosen compatibility behavior.

Until this is carded, **DF2-10 is not implementable safely**.

### H2 — HIGH: global kill-switch and rollback-state semantics are not executable

DF2-10 names a “global kill switch” but does not define:

- its name and authoritative storage/runtime source;
- default posture;
- server/client precedence relative to per-class `reviewPassThreshold`;
- whether it can be flipped without a functions redeploy;
- how its posture is exposed by `version`;
- how a partial client/server posture mismatch fails closed.

The full-set rollback pin is a separate mechanism; it does not define an emergency runtime kill switch.

More importantly, the expected data behavior is still left as:

> durable `passed:false` review then OFF/removed/re-enabled — decide + fixture the amnesty semantics

That is the decision N5 required the plan to make. The plan must state whether:

- OFF/removal grants legacy amnesty and permits non-demoting completion;
- re-enabling can ever re-block a day already advanced while OFF;
- a still-unadvanced failed attempt becomes blocking again when re-enabled;
- cached/re-entry/session-state UI follows the same rule.

The safe default is normally: **OFF restores legacy behavior; an advance committed while OFF is never retroactively
demoted; re-enable applies only to still-unadvanced/current evidence.** Whatever policy David chooses, encode the
expected CSD/TWI/attempt/UI state for all three transitions before implementation.

### H3 — HIGH for DF2-07: the claimed entry reason contract does not exist

DF2-07 says:

> entry-returned `reviewOnlyReasons` object ... client already reads it, `studyService.js:1783`

Code says otherwise:

- `initializeDailySession` returns its object at `src/services/studyService.js:505-567`; there is no
  `reviewOnlyReasons` or discriminated `reviewOnlyReason`.
- `src/services/studyService.js:1783` defines the boolean `reviewOnlyReasonConfirmed`; it does not read an object.
- The only `reviewOnlyReasons` object is server-local in `functions/foundation.js:1390-1398`.
- Today it is returned on `completed` at `:1677-1683`, but `review_recorded` at `:1584-1590` strips it.

So the Wave-0 banner, as written, can render nothing or guess from the coarse flag.

#### Required correction

Add an explicit Wave-0 entry contract:

- derive one pure discriminated value during `initializeDailySession`, for example
  `reviewOnlyReason: 'list_complete' | 'review_resume' | 'allocation_zero' | null`;
- apply the stated precedence exactly once;
- return it in session config and consume that value in the banner;
- do not infer from `reviewOnlyDay`;
- include malformed/unknown inputs and all three reason fixtures.

If the team instead wants a server-authoritative entry reason, DF2-07 must wait for a server entry endpoint. Do not
describe a client-local derivation as already server-returned.

### H4 — HIGH contract mismatch: DF2-10 and DF2-31 disagree on the exit response

DF2-10 promises:

- `holdReason`
- `throttleReviewOnly`
- `engaged`

DF2-31 says DF2-10 will also supply `reviewOnlyReasons`. Current `review_recorded` returns only:

- `status`
- `dayGuardRejected`
- `advanced`
- `reviewMode`
- `progressDay`

Define the exact server response now. At minimum, every non-advance response needs a server-owned discriminant,
nullable/unknown rules, and a status table for `review_recorded`, `review_retake_required`, `no_evidence`,
`day_guard_rejected`, `already_completed`, and `completed`. The client must never reconstruct a hold cause from stale
entry state.

This can share the same reason vocabulary as H3, but entry reason and write outcome remain distinct facts.

### M5 — MEDIUM: DF2-07’s visible threshold-copy inventory is factually incomplete

The card says the sole hardcode is `SessionProgressSheet.jsx:82` and cites `RetakePrompt:2383` as the result wall.

Actual visible sources:

- `src/components/SessionProgressSheet.jsx:82` hardcodes “95% required to pass.”
- `src/components/HelpModal.jsx:212` hardcodes “Must score 95% to continue.”
- The cited DSF `RetakePrompt` is the branch the same program classifies as unreachable/dead.
- The live result cards already derive the threshold at `MCQTest.jsx:1201` and `TypedTest.jsx:1461`.
- `SessionSteps` also hardcodes 95%, but it is dead and is correctly slated for deletion.

Add HelpModal to DF2-07(a), or intentionally replace its class-less statement with generic copy. Correct the live
result-card evidence cites so the fixture tests the UI students actually see.

### M6 — MEDIUM: the final “only remaining decisions” statement is not dependency-accurate

The v3 footer says Wave-0/1 build waits on DECIDE-0 plus register items 2/3/4. But:

- DECIDE-0 blocks Wave-3 production exposure only.
- item 2 blocks DF2-10.
- item 3 blocks only DF2-02a’s dead-lever branch.
- item 4 blocks only DF2-06.
- DF2-08’s target-default decision is required only before normalization; compatibility-preserving module authoring
  can proceed without it.
- H2’s rollback/amnesty decision also blocks DF2-10 and is not represented in the register.

Replace the wave-wide sentence with the task-scoped authorization matrix. This prevents an unrelated grader or
ship-model decision from freezing safe design work, while also preventing DF2-10 from starting without its real
decision.

### M7 — MEDIUM: R8 has an owner, but not yet a proof contract

Assigning the success stamp to DF2-10 closes the ownership gap. Before code, specify:

- emitted only after the authoritative transaction commits;
- exact event name and before/after CSD/TWI;
- student/class/list/day plus build/pin and evidence/attempt identity;
- behavior on `already_completed` retry;
- deterministic correlation or deduplication so a retry cannot manufacture two “advances”;
- tooling requires this server-only proof and fails closed on a missing/mismatched window.

Otherwise R8 can still over-credit a duplicate or unrelated log.

### M8 — MEDIUM: DF2-35 needs an authoritative roster/data contract

“Share DF2-07’s reason derivation” is not enough to build a teacher panel of **currently held students**.

`ClassDetail` currently has class attempts and `studentProgressMap`, but it does not have the individual student’s
entry session-config reason object, and quarantine is not canonical/live until the later migration. The card must
define:

- which stored/server-read facts prove each reason;
- freshness and “currently” semantics;
- unknown/error behavior (never label unknown as held);
- query/index and bounded-read strategy;
- phased behavior for quarantine before/after P5.

A safe v1 may show only reasons provable from the existing class-scoped progress/attempt data and activate quarantine
after canonical migration. Do not infer ephemeral entry state for an entire class.

### L9 — LOW: orientation status language is stale

`00_ORIENTATION.md` still says:

- status is pending the six-way convergence “before anything builds”;
- governing decisions are “all closed.”

The same file later records two completed rounds and open DECIDE-0/review sub-decisions. Update the header and section
title to distinguish closed governing architecture decisions from open execution/product decisions.

---

## 3. Plan-of-record ruling

**Yes, v3 is fit to remain the forward plan spine.** Do not revert its wave architecture or reopen the corrected
mode/migration/server-unification ordering.

**No, the requested blanket “GO for Wave-0/1 staged execution” is not warranted yet.** The correct ruling is:

1. proceed with the GO rows in the authorization matrix;
2. patch H3/M5 before DF2-07 implementation;
3. patch B1/H2/H4 and close register item 2 before DF2-10 implementation/deploy;
4. give DF2-35 a data contract before UI work;
5. keep DECIDE-0 out of Wave-0/1 gating.

The next review can be bounded to those amendments. The long-range architecture does not need another teardown.

