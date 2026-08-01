# Codex review — DEEPFIX 2 round 46

**Reviewed:** 2026-07-26  
**Scope:** R2 decision integrity, round-5 panel adjudication after R2-26..R2-30, and the required pre-build fold  
**Overall verdict: DECISION ROUND SUBSTANTIALLY CONSOLIDATED; MERGED ONE-LAUNCH POSTURE STILL HAS FOUR UNRESOLVED SAFETY CONTRACTS AND SIX OWNER CLARIFICATIONS.**

The later answers do resolve the panel's largest interpretation fork:

- there is one universal day-structured/free-within-the-day model;
- COEXISTENCE and G-DUE are obsolete;
- both tests gate forward day progression;
- past-day retests are pure review, label-neutral, non-advancing, and gradebook-preserving;
- pace changes are prospective;
- the day keeps the same queue until it passes;
- the rollout is one cohort-wide launch, not a pilot or two production exposures;
- the two-predicate label model is sealed, with the final `review*` field names;
- teacher force-pass is error correction only and changes grades, never word labels;
- PITR and the kill switch stay.

Those are coherent product decisions once the stale pre-answer wording is removed. The decision state is **not yet
safe to translate directly into implementation**, however. “One launch” currently conflates a product exposure
decision with a technically non-atomic deployment procedure, the backfill lacks a closed live-write cutover, the
kill-switch label semantics remain unspecified, and per-class teacher settings can mutate student+list-wide labels
across classes.

## Authorization

| Scope | Round-46 ruling |
|---|---|
| R2-26..R2-30 architecture/product consolidation | **ACCEPTED**, subject to the six explicit owner clarifications below |
| Mechanical C1 fold | **GO**, using the checklist in this review |
| Track A read-only investigations | **GO** |
| Track B plan/scripts in non-production | **GO TO DESIGN/REVIEW**, not to 26SM writes |
| DF2-14 merged-launch card | **GO TO AUTHOR**, but it must carry B1-B4 and the cached-client/queue contracts as gates |
| Production build authorization / config pre-arm / 26SM backfill / launch | **NO-GO** until the contracts and owner clarifications below close |

## Blocking findings

### B1 — BLOCKER: “one launch” is not an atomic deploy, and R2-6 activates during a partial rollout

R2-6 says to write `enabled:true` before deployment and claims the lever-reading code and lever “arrive together”
(`11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md:34`). They do not. Functions, rules, indexes, and hosting deploy as
separate artifacts; even a functions deploy updates multiple callables non-atomically. The first updated verdict
callable can observe `enabled:true` while completion, override, marker, rules, or the cached browser still runs the
old contract. Attempt-time posture stamping cannot repair a server path that does not yet understand that stamp.

This is the same substantive issue as panel F2-14/O1-11 and it survives the later “ONE launch” decision. One launch
should mean **one student-visible activation event**, not “all binaries and data become visible during one
non-atomic command.”

Required contract:

1. dark-deploy every compatible server/client/rules/index surface with `enabled:false` or an unarmed target version;
2. verify the exact callable/build/rules/index/client-version set;
3. finish the backfill and bounded final delta described in B2;
4. activate the whole cohort once through an audited config transition;
5. bind attempts/day queues to `{algorithmVersion, configVersion, clientMinVersion}`;
6. make old cached clients refresh or follow a defined compatibility path before they can submit.

This preserves David's no-pilot, all-at-once **exposure** decision. It does contradict the literal pre-set-true
mechanism in R2-6, so David must confirm the interpretation rather than the fold silently changing it.

### B2 — BLOCKER: backfill-then-launch has an unclosed live-write gap

R2-9 says backfill-then-launch (`11_:36`), R2-26 says backfill ships in the one launch (`11_:45`), and Track B3
mentions a “delta-sweep at flip” (`11_:71`). That is not yet a cutover protocol. Attempts, challenges, resets, and
teacher overrides can land after the expected-result snapshot or initial backfill and before activation. A
best-effort final scan can also race a write that commits while the scan passes its partition.

Before any 26SM write, Track B must define:

- a durable high-water mark/event ordering source;
- idempotent replay keyed by attempt/adjudication/reset identity;
- how late writes after the high-water mark are dual-written or captured;
- a final barrier or bounded write freeze at activation;
- post-activation reconciliation of the last interval;
- reset/challenge/override ordering and retry semantics;
- expected-result equality at the exact activation watermark;
- explicit David authorization for the initial write **and** the activation-time delta.

Without this, the “full-history” cohort begins with a partly historical, partly prospective label state.

### B3 — BLOCKER: the kill switch can launder `reviewLastProvenAt`, or lose OFF-window evidence

Panel O1-3/O1-4 survives. Under the legacy-OFF writer, review attempts are auto-passed
(`02_TASK_LIST.md:79`). If the new label writer treats such an attempt as a passing attempt, ordinary OFF-window
correct answers stamp `reviewLastProvenAt` without proving the 92% gate and clear sticky-(b). If all label writes
stop while OFF, later re-enable misses wrong/correct evidence from the OFF interval unless a delta reconstruction
is required.

R2-28 only decides to keep the switch. It does not decide:

- whether fail/correct/proven labels write while OFF;
- whether auto-passed OFF attempts may ever count as “proven”;
- what graduation formula OFF uses;
- whether a mid-day stamped ON attempt remains ON through completion after the switch flips;
- how OFF-window events are incorporated on re-enable;
- whether an unreadable config uses last-known-good, holds, or silently falls back to OFF.

The current fail-open-to-legacy rule was designed for a default-OFF launch and is no longer conservative when ON is
the intended posture. One config document and one fail-direction contract must replace the two current contracts.

### B4 — BLOCKER: per-class teacher tuning writes shared student+list label truth

R2-26 intentionally retains a per-class-list teacher setting (`11_:45`), while the four behavioral labels live on
`users/{uid}/study_states/{wordId}` and are therefore shared by that student's list use across classes. A passing
attempt in a class set to 70 can stamp `reviewLastProvenAt` and clear fill exclusion later consumed by another class
set to 92. Queue/test-size differences can likewise produce different “same day” queues for the same student/list.

This is panel O1-8 and it is not dissolved by killing COEXISTENCE; the collision is between **class assignments**,
not navigation modes.

Before build, choose and freeze one:

1. settings are student+list-global, with a deterministic owner/source;
2. shared students use a deterministic effective posture (for example the strictest threshold and a specified
   queue/test-size resolver) across every class;
3. labels and queue identity gain a class-assignment scope, with migration and all readers updated.

The plan cannot call the gate teacher-tunable and also leave the effective shared posture undefined.

## High findings that survive the later answers

### H1 — Historical `passed:true` is not necessarily 92%-level proof

R2-3 requires full-history backfill and R2-29 defines `reviewLastProvenAt` from a correct answer on a passing
attempt. All pre-gate reviews were written `passed:true` regardless of score. Trusting that legacy boolean would
allow a low-score historical review to “prove” each word it happened to answer correctly, despite the new rule
requiring proof inside a threshold-passing test. Calling this “historically benign” is not sufficient
(`10_REVIEW_GRADUATION_REDESIGN.md:49-50`).

David must choose the historical proof law:

- recompute whether the old attempt would have passed the effective launch threshold (recommended for semantic
  consistency);
- grandfather legacy `passed:true` as proof;
- or start `reviewLastProvenAt` prospectively while still backfilling failures/correctness.

The expected-result script and wall-rate simulation must use the chosen law.

### H2 — The authoritative day queue and presented set remain undefined

R45-B1/M10 and panel F2-05/F2-06 still survive. `segment.wordIds` is client-built/pinned session state, not a
server-created immutable queue identity. Re-deriving from `(day, current ACTIVE pool)` after statuses, time,
another tab/class, reset, settings, or graduation change can produce a different set.

DF2-14 needs a server-owned immutable record (or equivalent immutable as-of proof) containing at least:

`{uid,listId,effectiveDay,resetEpoch,algorithmVersion,configVersion,poolHash,orderedQueueWordIds,presentedWordIds}`.

The server must validate exact-set composition at attempt creation and completion. It must derive
`totalQuestions` from the authoritative presented set; `functions/index.js:429` currently accepts the client
denominator. Stable ordering/ties are required for equal `lastTestedAt`, and the ordering input must become
server-authoritative rather than a client-written scheduling lever.

### H3 — The two-predicate model needs three explicit composition strata

The final labels fix the earlier symmetric/asymmetric dispute, but addendum v3 still uses the ambiguous word
“clean.” The implementable strata are:

1. **priority:** failed more recently than correct;
2. **recovered-ever-failed:** not priority, but failed more recently than proven, so random-presentation eligible
   and fill-ineligible;
3. **never-failed or proven-after-fail:** not priority and fill-eligible.

This is panel F2-02. Recovered-ever-failed words must be able to appear in the random remainder so they can obtain
passing proof; they must not graduate merely as fill. The fold must state the exact strata and deterministic
selection order.

### H4 — Force-pass cannot be described as reuse of today's `overrideAttempt`

R2-1b says the existing `overrideAttempt` surface promotes the failed review (`11_:29`). Current
`functions/foundation.js:2690+` is an anchor/manual-pass path and constructs a synthetic attempt with new-word
anchor fields; it is not yet the exact-attempt review/new grade-only resolver the decision requires. A1 correctly
recognizes that a new target resolver and consumer audit are needed.

The fold must remove wording that implies the current callable is already suitable. The implementation gate is:
exact failed-attempt identity, review/new-leg distinction, open-day match, class/list/day binding, race-safe
already-completed response, immutable teacher-edit metadata, and no word-label/graduation mutation.

### H5 — Cached clients need a hard compatibility policy

One-launch server enforcement adds queue identity, presented-set validation, new response states, label rules, and
review-first flow. An old cached client cannot necessarily submit the new proof or interpret the new hold. “Deploy
functions before client” is not enough for an all-at-once activation.

DF2-14 must specify minimum-client/build negotiation, forced refresh or a bounded compatibility adapter, service
worker/cache behavior, and a Playwright old-bundle fixture. A server must not silently weaken exact-set validation
for an old bundle after activation.

### H6 — Reset semantics contradict the “lifetime” counter/backfill scope

R2-29 calls `reviewFailCount` lifetime, while Track B1 is `resetEpoch`-scoped (`11_:69`). The fold must decide
whether a teacher reset clears:

- fail count;
- failed/correct/proven timestamps;
- priority/fill status;
- queue records and their algorithm/config identities.

This changes both pedagogy and backfill output and therefore needs David's explicit answer.

### H7 — Grading-job persistence needs a retention/access contract

R2-13 makes the grading job self-sufficient by storing submitted rows and write context (`11_:55`). That is a
sound recovery direction, but it materially expands stored student response data. DF2-12 must define owner/teacher
read policy, TTL/cleanup, terminal retention, retry ceiling, abandoned-job behavior, and audit access. David should
choose the user-visible retention window for “Try later”; the remaining access/cleanup details can be engineering
contracts.

### H8 — The review modality switch must be decided and measured

Current `getReviewTestType` switches from typed to MCQ after repeated attempts (panel O1-13). With an unlimited hard
wall and one 92% threshold, that is a material difficulty and cost change. The plan must decide whether it stays,
and evidence/Playwright must stratify typed and MCQ pass behavior. This is not dissolved by accepting the aggregate
wall rate.

## Panel adjudication

### Dissolved by R2-26..R2-30

- O2-01/O2-03/F3-01/F3-02 architecture ambiguity: COEXISTENCE is explicitly obsolete.
- O2-04/F1-06/F2-09 pilot/coexistence objections as product choices: no pilot is explicit; stale pilot text still
  needs removal.
- O2-05/F2-18/F1-16 rotation-vs-G-DUE ambiguity: G-DUE is cancelled.
- O2-06 queue rotation while walled: the same queue intentionally remains until pass.
- O2-07/O2-16 retest label/grade semantics: retests are explicitly label-neutral and gradebook-preserving.
- O2-10 pace model: prospective pace is explicit.
- O1-2/O1-9 weak-student escape/toll objections as product objections: the grind is intentional and force-pass is
  error correction only. Support/workload monitoring still survives.
- F1-04/F2-08 two-production-deploy interim: R2-26 forbids that interim. The code may be built/certified in
  internal stages but has one activation.
- The old asymmetric-vs-symmetric dispute: R2-29's two predicates supersede it.

### Survives as real engineering or fold work

- O1-1 wall-rate quantification survives as a monitoring/comms/capacity baseline even though David accepts the
  wall.
- O1-3/O1-4/O1-11/F2-03/F2-14 kill-switch, config, and activation-window findings survive (B1/B3).
- O1-5/O1-6/F1-10 rehearsal, Playwright, monitoring, and abort-contract findings survive.
- O1-7 client denominator survives and is part of H2.
- O1-8 shared-posture collision survives (B4).
- O1-10 authorization for production backfill/delta survives.
- O1-12 OFF graduation/label semantics survives (B3).
- O1-13 modality switch survives (H8).
- O2-09/O2-11/O2-12/O2-13/O2-15 and the stale-values findings survive as fold cleanup, with decisions updated to
  the final answers.
- F2-02/F2-05/F2-06/F2-13/F2-16 survive (composition strata, queue identity, exact presented set, tie-break,
  quantified backfill mass).
- F2-19 survives: progression-based streak is a build change, not a verification-only note.
- F1-01..F1-03 and F1-05/F1-07..F1-20 mostly survive as mechanical fold work; F1-04 is dissolved by one launch,
  and F1-06 must be rewritten rather than retained as a pilot.

### Panel misses or insufficiently explicit points

- historical auto-pass cannot automatically mean 92%-level `reviewLastProvenAt` proof (H1);
- initial backfill and activation need a race-free watermark/barrier, not just “delta sweep” (B2);
- all-at-once activation must cover old cached clients and minimum-version negotiation (H5);
- lifetime labels conflict with `resetEpoch`-scoped reconstruction (H6);
- grading-job response retention/access is unowned (H7);
- the final global/per-assignment precedence must account for a student sharing a list across classes, not merely
  navigation-mode coexistence (B4).

## Required mechanical fold checklist

### Decision ledger and trace

1. Normalize R2-29 to the final review-prefixed names from R2-30 everywhere.
2. Mark R2-15 ordering closed (R2-26 sealed it); remove the stale open-item line at
   `12_R2_DISCUSSION_TRACE.md:80`.
3. Leave only R2-10 challenge reversal open pending A2, plus the new decisions listed below.
4. Rewrite §0 and §6: remove the old default-OFF, fixed-50%-slot, retake-cap, old config-name, and awaiting-values
   language.
5. Rewrite R2-6 as the eventual owner-approved activation choreography; do not retain the false atomic-arrival
   rationale.
6. Update Track B field names and all four derived-label calculations.
7. Expand C1 from R2-1..R2-10 to the complete R2-1..R2-30 decision set.
8. Reorder sequencing: fold and A investigations, unresolved decisions, DF2-14 contract, Track B design/review,
   rehearsal/backfill/activation. The already-run panel/r46 cannot remain described as future.

### `02_TASK_LIST.md`

9. Author one merged DF2-14 launch card with exact deploy surfaces, dark-deploy/activation boundary, dependencies,
   authorization, cert, Playwright, soak, abort, kill-switch, PITR/restore, cached-client, and rollback semantics.
10. Rewrite DF2-10/11/12 in place; do not append a second contradictory supersession tail.
11. Distinguish teacher-tunable threshold/sizes from the operational global `enabled` switch. State whether a
    teacher may disable the gate, not merely lower its threshold.
12. Delete/dissolve DF2-42/42d and clean every dependent gate.
13. Dissolve DF2-47/50/51/52/55 as specified; rescope DF2-53 to the universal model and surviving past-day browser
    plus within-day phase toggle.
14. Rescope DF2-60/61/34 from pilot/canary to 25WT rehearsal, cohort-wide activation, and post-activation
    monitoring.
15. Add the server-owned queue/presented identity and three-strata composition contracts to DF2-14.
16. Home force-pass on its exact-attempt resolver, metering/job recovery on DF2-12, progression-based streak on an
    explicit card, and modality-switch behavior on the gate/test card.
17. Reissue the task-scoped authorization matrix, including separate David gates for 26SM backfill and final
    activation/delta.
18. Enroll every visible launch delta: throttle removal, universal navigation, review-first, gate/wall, labels,
    composition, teacher controls, force-pass, recovery UI, streak, and past-day retest.
19. Retire engagement row 3 and every `review_not_engaged`/engaged-reader dependency.
20. Replace the obsolete pilot program exit criterion and add quantitative rehearsal/monitoring pass bars.

### Addendum, architecture, and ecosystem

21. Rewrite `10_` around the final two predicates and explicit priority/recovered/proven strata.
22. Replace client-only `segment.wordIds` pinning with the authoritative queue identity contract.
23. Freeze deterministic composition, server-derived denominator, exact presented-set validation, and label-drift
    rules.
24. Add the high-water/delta/backfill cutover, historical-proof law, reset law, and kill-switch label law.
25. Replace “bounded by construction” with a proved fairness bound under mutable pools, changing settings, and
    equal timestamps; monitor “stuck despite ≥92%” as R2-22's reopen trigger.
26. Add universal-model supersession banners and then rewrite
    `FREE_NAVIGATION_MODEL.md`, `UNIFIED_SESSION_STATE_ARCHITECTURE.md`, orientation, sources, state map,
    messaging, tracker, runbook, and all wave entry/exit text.
27. Make `11_` and `12_` governing sources, update the cohort count, and remove every stale “DECIDE-0 open,”
    default-OFF, pilot, coexistence, and G-DUE instruction.
28. Specify PITR verification plus an actual restore rehearsal/RPO/RTO; PITR enablement alone is not restore proof.

## New David decisions required

1. **Activation meaning:** may “one launch” use a dark compatible deploy/backfill followed by one cohort-wide config
   activation, or must `enabled:true` literally be present before the deploy despite partial-rollout risk?
2. **Historical proof:** should a legacy auto-passed review count as 92%-level proof, be recomputed at 92, or leave
   `reviewLastProvenAt` prospective?
3. **Shared-setting resolver:** when one student studies the same list through classes with different settings,
   which threshold/queue/test values govern the shared labels and queue?
4. **Kill-switch evidence law:** which labels write while OFF, may auto-passed OFF attempts stamp proven, what
   graduation law applies, and what happens on config-read failure/re-enable?
5. **Reset law:** are all four review labels lifetime across a teacher reset, or reset-epoch-scoped?
6. **Retake modality:** does the typed→MCQ switch after repeated attempts remain under the hard 92% wall?
7. **Pending-job retention:** how long may a student leave “submitted, not yet graded” before the job expires?
8. **R2-10:** challenge reversal remains conditional on A2, as already recorded.

Items 1-6 affect correctness or visible pedagogy and should not be guessed by the fold. Item 7 can accept an
owner-approved default if David delegates retention policy. Item 8 is not new, but remains genuinely open.

## Final ruling

The decision walk was productive and the universal model/two-predicate result is materially clearer than v3. The
right next action is the mechanical fold **plus explicit closure of B1-B4/H1-H8**, not implementation. The panel's
pre-answer architecture objections should not be carried forward as blockers, but its launch-integrity,
queue-identity, exact-set, configuration, monitoring, and fold-fidelity findings remain real.

**Round-46 decision-state check: DONE. Production authorization: NO-GO pending the contracts and owner decisions
above.**
