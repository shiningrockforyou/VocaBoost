# Codex review — DEEPFIX 2 v2 re-convergence (round 42)

**Reviewed:** 2026-07-26  
**Overall verdict: SOUND-WITH-GAPS. Do not authorize Wave 1 yet.**

Round 41’s structural blockers are now substantially and honestly folded. In particular, DF2-36, DF2-46, DF2-47,
DF2-43’s required writer spec, the Wave-4 reorder, the R3 hard interlock, and the restored D4/D5 gates are the right
corrections. The program has moved from “unsound as an executable plan” to a sound gated architecture.

The v2 fold nevertheless introduced or exposed several execution gaps. Three are high severity:

1. DF2-05 incorrectly makes D3.5 R7 a Wave-4 entry gate and gives R8 no functions owner.
2. DF2-08 can violate G6 and silently turn assignment-default normalization into an unapproved behavior change.
3. DF2-31 cannot distinguish the two `review_recorded` hold causes from `entryState`; the needed engagement fact is
   submit-time evidence and the server currently strips it from the return.

Fix these, plus the deployment/copy issues below, then Wave 0 and Wave 1 can be authorized at their own gates.

---

## 1. Round-41 fold verification — **SOUND-WITH-MINOR-CORRECTIONS**

### S1 / DECIDE-0 — acceptable

Yes: presenting the ship model as a David decision is acceptable. The revised Wave 3 correctly says BUILD + VALIDATE and
blocks production visibility on DECIDE-0. This resolves the executable contradiction without prejudging the product/release
choice.

Two document corrections remain:

- `00_ORIENTATION.md` §3 still says “Governing decisions (all closed)” and records “ONE release train” as closed. Change that
  row to DECIDE-0/OPEN.
- The orientation still says the register has 15 rows and that review-pass has two open sub-decisions, while v2 now has 16
  rows and only the throttle-day decision remains open.

DECIDE-0 should **not** block Wave-0 design/test work or DF2-08 preparation. It blocks Wave-3 production exposure. The
DF2-10 throttle decision blocks DF2-10 semantics, not unrelated Wave-0 work.

### S2 — resolved

DF2-36 is now a real legacy-UI, deployed, behaviorally verified, fail-closed pre-P5 gate. This is sufficient.

### S3 — resolved

The declared Wave-4 order now puts the mode contract and frontier census before P5. Keep that order machine-visible in
tracker dependencies, not only prose.

### S4 — mostly resolved; deploy-set correction required

The callable-level provenance, kill switch, server-before-client order, current-posture cert, skew check, soak, scans, and
review-specific matrix are correct additions.

However, the claimed “full no-skew set” omits two exported callables from the edited/provenance surface:

- `resetProgress` is re-exported from `foundation.js` (`functions/index.js:2182`);
- `version` must deploy from the new commit or it cannot prove the same-commit posture it is being used to attest
  (`functions/index.js:2196-2219`).

The set is therefore at least the listed eight **plus `resetProgress` and `version`**.

Also, a Firebase multi-function deploy is coordinated, not atomic: individual function deployments can partially fail.
Rewrite “atomic” as:

1. no threshold can be enabled while the deploy is incomplete;
2. deploy the complete target set;
3. verify every target’s revision/behavior, retry or roll back any partial;
4. only then expose the client lever.

The current server-first/dark-lever choreography supplies the compatibility window; name it explicitly.

### R1–R6 fold — substantially resolved

- DF2-46 correctly restores the missing post-P5 server-unification/twin-retirement increment.
- DF2-40/44 restore the original one-way-door choreography.
- DF2-44 now makes R3-last a hard dependency.
- DF2-08 is the right home for G-PASS and assignment-policy work, subject to the sequencing/default corrections below.

Move E1’s disposition from DF2-30 to DF2-46 (or a named pure `deriveCompletionDecision`). A UI container and exit-view
mapper do not themselves replace the server’s `isDayComplete → {complete, advances}` policy.

### F1–F6 fold — resolved as design gates

DF2-47 and `08_MODE_RECORD_CONTRACT.md` now block the correct dependents and cover the shared-record/mixed-mode and
cycling/frontier issues. DF2-43 now requires a proper authoritative-writer spec with challenge/override/manual-pass
advancement. DF2-42d now owns the full scheduler lifecycle and G-ENGAGED decision.

These are not “closed solutions” yet; they are correctly placed fail-closed design gates. That is sufficient at program
level.

---

## 2. New v2 sequencing defects — **NEEDS FIXES**

### HIGH N1 — DF2-05’s Wave-4 entry gates are factually wrong

`D3.5_RISK_REMEDIATION.md` defines:

- **R7** as unowned **next-list carry-forward**, explicitly separate from P5;
- **R8** as a verdict-engine problem requiring a **functions-side success log** plus tooling changes.

The v2 row says R1/R2/R7/R8 all “size/repair the inflated pool” and are hard Wave-4 entry gates. R7 does neither. It belongs
to CONT-A/D6 ownership; making it an entry gate either creates an unrelated program block or silently assumes it closed.

R8 cannot be closed by DF2-05’s declared `scripts/sandbox` surface. It needs a function change. Assign it explicitly:

- preferably add the server-only `session_completed`/`day_advanced` success stamp during DF2-10’s already-authorized core
  pin-move, then harden the verdict tooling in DF2-05;
- otherwise create its own pre-Wave-4 functions item with full pin discipline.

R1 is also an audit→likely-code-fix item; name the implementation owner rather than leaving all R1–R16 under a generic
scripts row.

Correct Wave-4 entry gates should list only the remediation items actually required by P5, with each code owner and evidence
artifact.

### HIGH N2 — DF2-08 can violate G6

G6 says the review-pass change must precede extraction/consolidation of the same pass predicates, or the two must be
co-designed atomically. DF2-08 now comes first and says it creates “one G-PASS predicate,” delivers it to both packages, and
eliminates the default drift.

Clarify the boundary:

- DF2-08 may author and equality-test the pure module/generated copy, but **must not reroute live pass call sites or deploy
  functions before DF2-10**.
- DF2-10 is the first call-site adoption and deployment of G-PASS.
- Remaining passive/UI/server twins retire in DF2-46.

The invariant should not claim “one G-PASS as of DF2-08” while 12 sites still run. Use transitional wording:

> canonical module authored at DF2-08; authoritative writer/readers adopt at DF2-10; consolidation complete at DF2-46.

### HIGH N3 — assignment-policy normalization is not byte-identical

The current defaults genuinely differ (80/20 pace, 95 vs 92, integer vs ratio). A single resolver must select a winner, so
“kills the drift” can change pass verdicts, allocation, or orphan behavior. The original consolidation roadmap explicitly
called for a verdict-flip census.

Split or gate DF2-08:

1. inventory every caller and current fallback;
2. census records that rely on missing/legacy fields and calculate before/after verdict/allocation flips;
3. obtain the target-default decision;
4. preserve call-site compatibility adapters until that approved migration;
5. test legacy assignment/null/orphan shapes in both runtimes.

Do not smuggle this behavior change into the review-pass “default OFF = byte-identical” release.

### MEDIUM N4 — authoritative `passed:true` needs provenance

The short-circuit is valid only for a server-read, persisted authoritative attempt or an authorized override/regrade. It
must never accept client-supplied `passed:true` from a write context. Make the helper signature distinguish
`authoritativePassed` from untrusted input and test that `submitVocabAttempt` still computes the initial verdict itself.

### MEDIUM N5 — kill-switch rollback state is unspecified

After threshold-on writes a durable `passed:false` review, what happens if the global switch or class threshold is turned
off before the retake? “OFF byte-identical” may cause the failed review to become completion evidence on reload. That may be
the intended rollback amnesty, but it is stateful and must be explicit.

Add fixtures for:

- global OFF with an assignment threshold still set and an existing `passed:false` review;
- class threshold removed after a failed review;
- re-enable after that state.

---

## 3. Exit channel and messaging — **NEEDS FIXES**

### HIGH N6 — `entryState` cannot disambiguate `review_recorded`

The transaction knows both reasons:

- `throttleReviewOnly`;
- `heldEngaged` / non-engaged review.

It returns them internally at `foundation.js:1486-1491` and logs them at `:1575-1582`, but the callable response at
`:1584-1590` strips both. `entryState` can indicate allocation-zero, but engagement is determined by the review that was
just submitted. It is not an entry fact. A non-engaged review can also occur on an allocation-zero day, so inference is
ambiguous.

Choose one:

1. Preferred: while DF2-10 already moves `completeSession`, return an explicit server-owned `holdReason`,
   `throttleReviewOnly`, and `engaged` in the response; certify response-only compatibility.
2. Or expand `deriveWriteOutcomeView` to accept trusted `submissionEvidence.reviewEngaged` in addition to
   `lastWriteOutcome` and `entryState`.

Do not ship copy that guesses row 2 vs row 3.

### MEDIUM N7 — row 16 must not use a seen marker

DF2-32 classifies rows 4/14/15/16 as seen-marker events. `review_retake_required` is a blocking state that must remain visible
on reload and every failed retry until the student passes or the gate is disabled. A seen marker may suppress the only
explanation for the wall.

Split mixed rows:

- frontier-advanced = one-time event;
- segment/review retake-required = durable outcome/state message;
- backlog nudge = re-derived state, not a one-time event.

### MEDIUM N8 — “resets every Monday” is not timezone-safe

The authoritative boundary is Monday 04:00 KST (`functions/index.js:661-675`). In much of North America that occurs on
Sunday; in other zones “Monday” lacks an exact time. Removing “4 AM KST” makes the statement less accurate, not more.

Use either:

- “resets weekly at Monday 4:00 AM Korea time,” with a localized equivalent where practical; or
- display the next reset instant in the viewer’s local timezone.

The current DF2-07(d) copy would recreate timing tickets outside Korea.

### MEDIUM N9 — quick-win reason copy needs the same oracle discipline

DF2-07 precedes the unified `reviewOnlyReason` field. The current config exposes enough ingredients to derive the three
reasons, but the quick-win implementation must use the exact existing split:

- throttle allocation-zero;
- list-end;
- review-study resume.

Give DF2-07 its own per-reason fixtures and explicit source mapping. Do not defer that safeguard only to DF2-32.

---

## 4. Wave-4/5 dependency tightening — **SOUND-WITH-GAPS**

### MEDIUM N10 — DF2-43’s row omits two declared prerequisites

The Wave-4 order places DF2-46 and DF2-42 before DF2-43, but DF2-43’s explicit gate list names only DF2-40/41/47. Add:

- DF2-46 accepted/deployed;
- DF2-42 scheduler authority/lifecycle accepted to the extent the frontier writer records scheduler-affecting outcomes.

### MEDIUM N11 — DF2-46 must share policy, not force a UI VM into a transaction

The server completion transaction and client entry derivation have different outputs and side effects. Phrase DF2-46 as
sharing pure policy primitives or a named `deriveCompletionDecision`, while `deriveSessionState` remains the entry VM and
`deriveWriteOutcomeView` remains the exit renderer. Do not route a transactional writer through an entry-oriented UI object
merely to satisfy “one derivation.”

### LOW N12 — DF2-42d needs a reconciliation pass after DF2-47

Early scheduler design is useful and does not require P5, but its final acceptance must be rechecked against the chosen
mixed-mode record contract, because mode resolution controls who records review/mastery outcomes. Add a post-DF2-47
compatibility check before DF2-42 build.

---

## 5. Build-authorization answer

### Wave 0

Authorize **document/test work** after this fold:

- DF2-03;
- DF2-04 preparation (acceptance still waits on DF2-03);
- DF2-42d design;
- safe dead-code verification/deletion subject to its existing retake hold.

DF2-07 production quick wins should wait for N8/N9. DF2-05 needs N1’s ownership correction before it can be treated as a
Wave-4 gate.

### Wave 1

Do **not** authorize DF2-08/10 from v2 yet. Authorization requires:

1. the DF2-08 no-reroute/co-design boundary;
2. the assignment-default verdict-flip census and decision;
3. authoritative-pass provenance;
4. corrected callable target set (`resetProgress`, `version`) and partial-deploy handling;
5. the stateful kill-switch rollback decision/tests;
6. the DF2-10 throttle-day decision;
7. N6’s explicit hold-reason channel included in the already-moving server contract.

DECIDE-0 is not a Wave-1 blocker; it is a Wave-3 production-exposure decision.

## Final

The v2 program is no longer structurally unsound. Its major safety gates are now in the right places. Fold the twelve
corrections above and re-run the panel once more. Expected next verdict after a faithful fold: **GO for Wave-0/1 staged
execution**, with later waves still blocked on their named design/one-way-door gates.
