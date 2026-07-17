# Codex review — FREE-NAV DESIGN gate

Task: `FREENAV_DESIGN_GATE` round 7  
Verdict: **SOUND-WITH-CAVEATS**

## Bottom line

The revised recommendation is sound: do **not** fast-pivot to a full free-navigation rebuild now. Treat free-nav as a north-star product direction, but ship the lighter near-term gate first:

1. floor throttle-driven new-word allocation so intervention cannot create `newWords=0` review-only deadlock;
2. ship Practice Mode v2 for always-available review/study behavior without deleting the scheduler;
3. simplify day/progress authority incrementally, preserving the pass-to-advance teacher contract.

That is the lower-risk path against the actual code and live-state constraints. The original “mostly deletion / one hosting release” framing is disproven by the codebase.

## Findings

### HIGH — The throttle-floor fix is not literally one code location if it is a semantic invariant

Evidence:

- `src/utils/studyAlgorithm.js:106-111` calculates the normal session allocation with `Math.round(dailyPace * (1 - interventionLevel))`.
- `functions/foundation.js:1115-1136` duplicates the same allocation logic in dormant `completeSession` server derivation and uses `allocationZero` as one of the server-verified review-only reasons.
- `functions/foundation.js:1859-1878` duplicates the same calculation for `advanceForChallenge` day advancement.
- `src/services/db.js:3035-3042` has the legacy challenge-review progress writer using the same raw calculation.

Impact: The revised recommendation says “one line” at `studyAlgorithm.js:107`. That is probably sufficient for the current student session path while `SERVER_PROGRESS_WRITE=false`, but it is not sufficient as a durable rule across the prepared server-authoritative paths and the legacy challenge path. If the product decision is “intervention must never reduce an in-progress new-word segment to zero,” that invariant needs a named/shared helper or explicit mirrored edits in every day-advance writer before those paths are enabled.

Recommendation: keep the lighter gate, but record the throttle floor as a **multi-writer invariant**: client allocation, server `completeSession`, server `advanceForChallenge`, and legacy challenge-review path must agree, with the list-end cap still allowed to produce zero.

### MEDIUM — Floor-throttle kills throttle deadlock, not every #11/list-end wall

Evidence:

- `src/services/studyService.js:418-419` computes `wordsRemaining = totalListWords - totalWordsIntroduced` and then caps allocation through `computeCyclingAllocation(...)`.
- `src/pages/DailySessionFlow.jsx:845-858` still has a legitimate no-new-words / segment-complete terminal path when `config.newWordCount <= 0` and the review segment is empty.
- The design’s revised section correctly narrows the claim to “kills the deadlock's cause” at `docs/design/FREE_NAVIGATION_MODEL.md:124-131`, but earlier text still says the whole `#11` family, including list-end walls, becomes structurally impossible at `docs/design/FREE_NAVIGATION_MODEL.md:16-23`.

Impact: The lighter gate fixes the intervention-induced zero-new-words freeze. It does not, by itself, solve finished-list behavior, continuation, cycling, or list-end review availability. Practice Mode v2 can cover “I want to keep studying/reviewing,” but not “I need the canonical next frontier to advance past list end.”

Recommendation: in the decision memo, state the bounded claim: floor-throttle fixes **throttle zero**, Practice Mode fixes **review availability**, and continuation/cycling/list-end behavior remains a separate product path.

### MEDIUM — The current staged `firestore.rules` file is a deploy trap for any client-authoritative pivot

Evidence:

- Local `firestore.rules:186-217` makes `list_progress`, `class_progress`, and `progress_meta` server-owned by denying client writes to those subcollections.
- Local `firestore.rules:292-321` makes attempts fully server-owned (`create:false`, `update:false`, `delete:false`).
- Handoff states this P10d rules artifact is **undeployed**; current client flags show only `SERVER_ATTEMPT_WRITE=true` and `LIST_SCOPED_RECON=true`, while `SERVER_PROGRESS_WRITE=false` (`src/config/featureFlags.js:10`, `:47`, `:77`).
- Foundation server flags are all dormant (`functions/foundation.js:42-65`, `:113-125`).

Impact: The revised recommendation correctly avoids a free-nav client-authoritative pivot. A bare deploy of the current rules file would be unsafe unless all prerequisite server routes are actually live. This remains decision-changing operationally: any free-nav/progress simplification must start with a rules re-baseline, not “delete gates and deploy hosting.”

Recommendation: keep rules out of the lighter-gate release unless the exact server prerequisites are live. For free-nav north-star work, design a new rules artifact rather than reusing P10d.

### MEDIUM — Practice Mode v2 is the right pressure valve, but it must not blur gradebook/progression semantics

Evidence:

- Practice mode is already non-recorded in test surfaces: `src/pages/TypedTest.jsx` and `src/pages/MCQTest.jsx` contain practice banners and comments that `serverPassed` remains null in practice mode; the test result card falls back locally.
- Normal progress advancement is still coupled to `recordSessionCompletion` and persisted progress writes (`src/services/studyService.js:790-841`, `src/pages/DailySessionFlow.jsx:1516-1533`).

Impact: Practice Mode v2 is a good “free study” valve precisely because it avoids canonical progress. But if teachers expect practice results, or if students expect practice to advance frontier/day, it will recreate the same product fork under a different name.

Recommendation: make Practice Mode v2 explicitly non-progress, non-gradebook by default unless a teacher-visible “practice activity” surface is intentionally designed. Do not let it become a hidden second progression path.

### NOTE — The pass-to-advance fork is load-bearing, but frontier authority is the operational prerequisite

Evidence:

- The design identifies the product fork at `docs/design/FREE_NAVIGATION_MODEL.md:117-122`: whether advancing frontier requires passing the segment test at class threshold.
- The current code’s day/progress state is still class-progress based and client-written in the live path (`src/services/progressService.js:599-620`) with reconciliation layered over it (`src/services/progressService.js:253-266`).
- The server-authoritative replacement is prepared but dormant (`functions/foundation.js:42-65`, `src/config/featureFlags.js:63-77`).

Assessment: Yes, pass-to-advance is the dominant **product** fork: “yes” preserves the hagwon teacher contract; “no” changes the product into self-paced vocabulary practice. But the dominant **implementation** prerequisite is frontier authority. A free-nav model without server-owned/adjudicated frontier is not safe, regardless of whether pass-to-advance is yes or no.

## Gate answers

1. **Is the revised recommendation sound?**  
   Yes, with caveats above. It is meaningfully lighter than full free-nav and materially safer against current deployed/staged architecture. The main trap is calling the throttle fix “one line” instead of enforcing it across every progression writer.

2. **Did reviewers miss anything decision-changing?**  
   I did not find a reason to reject the revised recommendation. The new/under-emphasized point is the duplicate throttle math in server and challenge paths. That does not make the recommendation wrong; it changes the implementation checklist for item (a).

3. **Is pass-to-advance correctly identified as load-bearing?**  
   Yes for product strategy. However, frontier authority/data adjudication dominates implementation safety. Product decision first; server-owned/adjudicated frontier before any real free-nav migration.

## Final verdict

**SOUND-WITH-CAVEATS**

Proceed with the lighter near-term gate as the recommendation to David, but phrase it precisely:

- floor throttle-induced zero allocation across all progression writers;
- keep list-end/continuation/cycling separate;
- ship Practice Mode v2 as non-canonical review access;
- do not deploy P10d rules or delete reconciliation/security legs as part of this pivot;
- keep free-nav as a staged north-star that requires frontier census/adjudication, scheduler redesign, and an explicit pass-to-advance product decision.
