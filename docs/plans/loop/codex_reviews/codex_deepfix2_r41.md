# Codex review — DEEPFIX 2 program (round 41)

**Reviewed:** 2026-07-26  
**Lens:** architecture, sequencing, reconciliation fidelity, and the inherited Codex gates  
**Overall verdict: UNSOUND AS AN EXECUTABLE PROGRAM AS WRITTEN; the direction remains SOUND.**

The combined direction is coherent: review-pass first, then a client-only byte-identical extraction, then a unified
entry/exit container, then canonical/frontier/rules work, with free mode dark until its substrate exists. But the current
task list does not yet implement that direction safely. Four structural gaps must be resolved before Wave 1/2 work is
authorized:

1. Wave 3 visibly ships the container before Wave 5 builds the free branch, contradicting the declared single-train
   ship-together model.
2. A per-class forced/free mode is not reconciled with the **single student+list canonical record** when the same student
   has simultaneous same-list classes in different modes.
3. The task list omits the post-P5 server-derivation unification/twin-retirement increment, so the advertised “one
   derivation” outcome is never reached.
4. “One G-PASS predicate” is an invariant with no owning implementation task, and the free-frontier paths that must consume
   it (challenge, override/manual pass, regrade, idempotent retry) are not enumerated.

No code should start from this version of `02_TASK_LIST.md`. Revise the program, re-run the convergence panel, then begin.

---

## 1. Sequencing correctness — **UNSOUND AS WRITTEN**

### What is correct

- **G6 is preserved:** DF2-10 precedes DF2-20. This is the correct order because the review-pass gate edits the same
  predicates the extraction will move.
- **DF2-20 may precede P5:** the corrected r40 slice is client-only, calls only `initializeDailySession`, preserves the
  current config object field-for-field, excludes Dashboard/server/canonical, and keeps input assembly ordered. It does not
  require a canonical record or a functions deploy.
- **DF2-31 may precede P5** if it remains a pure client mapping of the statuses the current server already returns. It must
  not claim to change completion authority.
- The intended Wave-4 substrate order is directionally right: census/adjudication → canonical migration → scheduler →
  frontier writer → rules → soak/retirement.

### BLOCKER S1 — Wave 3 contradicts “ship together”

`02_TASK_LIST.md` makes Wave 3 a **forced-mode VISIBLE** hosting release and DF2-34 plans its rollout. Wave 5 then builds the
free branch, and Wave 6 assembles “one release train.” That cannot all be true:

- Architecture §12.1 says the deployed train contains the container **and both mode branches**.
- Wave 3 says the container replaces the live forced UI before the free branch exists.

Choose and encode one model:

- **Single-train model (matches David’s directive):** Waves 2–3 may merge and be exercised under an internal/dark
  `UNIFIED_SESSION_CONTAINER` activation gate, but the old forced UI remains live. Wave 5 adds the dark free branch. Only
  DF2-60 flips the container live and ships both branches in one deploy.
- **Container-first model:** explicitly withdraw “ship together,” deploy Wave 3 alone, and treat Wave 5 as a later release.

The current wording silently mixes the two.

### BLOCKER S2 — G-QUAR cannot depend ambiguously on the unshipped train

P5 cannot flip without a real quarantine blocking surface. DF2-40 says “DF2-32 ships it or a minimal version pre-P5,” but
under the single-train model DF2-32 is not live before Wave 6. Make a dedicated mandatory pre-P5 item:

> Build, deploy, and behaviorally verify a minimal legacy-UI G-QUAR blocking screen before DF2-40.

The later container may absorb that screen. “DF2-32 or minimal” is not a fail-closed gate.

### HIGH S3 — Wave-4 table order is backwards

DF2-41 is described as DF2-40 pre-work but is listed after DF2-40. Make the dependency executable:

`DF2-41 census/adjudication accepted → DF2-40 migration/flip → DF2-42 scheduler → DF2-43 frontier writer → DF2-44 rules`.

The 129 divergent / 27 active-in-lower-position cohort cannot be an afterthought to the migration that creates the
frontier authority.

### HIGH S4 — DF2-10’s first pin-move gate is incomplete

Clean tree + David authorization + generic “re-cert behavioral suite” are necessary but not sufficient. DF2-10 touches
multiple independently deployed callables and shared source:

- `submitVocabAttempt` / `writeAttemptTxn` — initial authoritative `passed`;
- `completeSession` — `review_retake_required`, no durable completion writes;
- `reviewChallenge` and the challenge-advance primitive/callable — below→above threshold escape path;
- all server readers that treat a paired review as completion evidence.

Before implementation, add:

1. An exact callable deploy manifest and callable-level before/after provenance. “Functions pinned `0ddbb34`” is no longer
   globally true because grader/token callables have moved independently.
2. A global kill switch in addition to `reviewPassThreshold=0`; the work-item explicitly required a flag, while the task
   list currently describes only the per-class lever.
3. Deploy order: server surfaces first, then client/teacher lever; no interval where the UI can enable an unsupported
   threshold.
4. A review-pass-specific matrix: off-byte-equivalence; pass; fail/no progress/no marker/no `recentSessions`; list-end;
   no-real-review; throttle allocation-zero according to David’s decision; reload reader correctness; challenge crossing;
   idempotent retry; typed + MCQ.
5. Re-cert at the **current production flag posture**, not only the old P4 matrix.

### MEDIUM S5 — Wave 0 is not fully parallel

DF2-02 deletes `RetakePrompt` and its DSF branch while DF2-10 must decide/build the review-retake surface in the same area.
Resolve the retake-surface decision first, then delete or replace the old branch once. DF2-03 also defines the fixture
contract DF2-04 must ultimately implement; they can start together, but DF2-04 cannot be accepted before DF2-03 freezes the
state inventory.

---

## 2. Reconciliation fidelity — **SOUND-WITH-GAPS**

### Preserved correctly

- D6/P8 remains independently shippable.
- D7/P9 and D8 remain parallel tracks.
- D8’s OVR → R2a → R2 → teacherIds → P10d → R3-last chain is named.
- D9 retains the post-rules/zero-denial clocks and backup requirement.
- Review-pass G6 ordering, separate retake status, list-end-only scored-review exemption, and reader-correctness work are
  carried into Wave 1.
- The container retains G0, C1, G3–G7, A1–A5, ordered input assembly, explicit flags/epoch, timestamp normalization, and
  demote-not-delete recovery state.

### HIGH R1 — the actual server-unification increment is missing

The r40 architecture ended with:

1. client-only extraction before P5;
2. container/exit work;
3. **after canonical, port the pure policy to the server and retire the hand-maintained twins.**

`02_TASK_LIST.md` has (1) and (2), but no task for (3). DF2-43 only adds the free frontier writer. It does not rewire forced
`completeSession`, `getDayNewPass`/review pairing, anchor shadow, challenge advancement, or remove the client/server policy
twins. Therefore the program can finish while still having the root “same predicate in multiple runtimes” defect.

Add a post-P5, pre-rules/server-frontier item:

- choose the shared-package or generated-copy boundary;
- make flags, epoch, now, timestamps, and assignment policy explicit inputs;
- equality-test generated client/server artifacts;
- route forced server completion/shadow/challenge policy through it;
- re-cert the full server matrix;
- only then retire the old twins and legacy client progression writers.

This task is also where E1’s day-complete/advances dispatch belongs. DF2-30/31 are render/exit-view work and do not by
themselves absorb the server completion-policy refactor.

### HIGH R2 — “one G-PASS” has no implementation owner

The map records 12 live G-PASS sites. DF2-10 adds review semantics but its source plan mirrors expressions across
`index.js`, `foundation.js`, client config/results, and challenge paths; it does not consolidate 12→1. DF2-43 and DF2-50
then assume the single predicate already exists.

Create a named task and contract. At minimum it must specify:

- score/threshold units;
- threshold source/fallback;
- test type and navigation mode;
- authoritative persisted `passed:true` short-circuit;
- challenge/regrade/teacher-override behavior;
- how the same pure predicate is delivered to the separate CommonJS `functions/` package and the client;
- differential tests proving no thirteenth copy remains.

### MEDIUM R3 — original D4/P5 execution gates are compressed too far

“All gates travel” is not execution-proof. DF2-40 should explicitly restate:

- hydrate/carry `reviewMode`;
- apply the engagement gate to `bestCsd`;
- D3 certified/accepted and C1 live;
- clean restore is valid only until the first post-flip completion;
- quarantine set is zero before flip and before/after census is accepted.

### MEDIUM R4 — original D5/P6 choreography is incomplete in the row

DF2-44 should explicitly preserve:

- deploy `TEACHER_PROVISIONING_ENABLED` first;
- named P6 artifact, matrix, and bundle grep;
- deploy rules;
- only then flip `ANCHOR_VALIDATION_ENFORCE`;
- start the P7 clocks at that accepted cutoff.

### HIGH R5 — R3-last is noted but not enforced

DF2-44b and the parallel D8 chain can race. A comment that they “coordinate” is insufficient. Encode one hard partial order:

- either coexistence rules land before D8g and D8g’s R3 artifact incorporates them, or
- D8g is blocked until DF2-44b is final.

There may be **no rules deploy after R3** if “R3-last” remains the invariant.

### MEDIUM R6 — E3 is not equivalent to lever UI

`resolveAssignmentPolicy` was meant to consolidate default/unit drift (80/20 pace, 95/92/0.95 thresholds, legacy
assignment shapes). DF2-11/52 only add controls and validation. The program now adds two more policy fields, making a shared
resolver more—not less—important. Restore E3 as an explicit client/server policy-normalization task, or justify its removal
with an equivalent named owner and tests.

---

## 3. Ship-together model — **SOUND ONLY AFTER S1/S2 ARE FIXED**

One client train with staged activation is a good release model:

- forced behavior has a differential falsifier;
- the free branch is dark because no class is configured free;
- per-class activation follows the substrate;
- rollback is a config flip only if mode-transition state is proven lossless.

But “container works alone” is a **testability property**, not permission to deploy it early under a single-train promise.
The task list must say whether pre-Wave-6 hosting builds are internal/preview-only or production releases.

Also add build-identity binding across:

- golden/differential evidence;
- the deployed client bundle;
- the server callable set and flags;
- the rules artifact;
- the pilot configuration.

Without that, the final byte-identity claim can be stitched from different builds.

---

## 4. Free-navigation build shape — **UNSOUND UNTIL THE SHARED-RECORD POLICY IS CLOSED**

### BLOCKER F1 — per-class mode conflicts with one student+list record

P5 deliberately creates one shared `list_progress/{listId}`. `navigationMode` is per class. The program explicitly supports
a student simultaneously enrolled in forced class A and free class B on the same list, but only specifies how the Dashboard
renders the two rows.

It does not specify how the shared record behaves:

- Free B may advance `twi` after a segment pass without completing forced A’s review/day contract.
- Forced A may be mid-session against an older `csd/twi` while B advances the same canonical record.
- Forced and free writers disagree on whether `currentStudyDay`, `reviewMode`, `recentSessions`, and day guards are
  authoritative.
- Flipping a class free→forced can turn a free frontier advance into a forced #9-resume, quarantine signature, or stale
  session collision.

This is not merely a pilot rollback note or mixed-mode Dashboard UX. It is the core write-policy contract. Before DF2-42/43,
add a design gate that decides:

1. mode resolution when the same student+list has assignments in both modes;
2. whether one mode wins list-wide, or both may write;
3. canonical field semantics per mode and across transitions;
4. in-flight session invalidation/versioning on mode or frontier changes;
5. free→forced and forced→free mapping, including review debt;
6. transactional concurrency/idempotency when both classes submit.

No frontier callable can be specified safely before this is closed.

### HIGH F2 — virtual cycling position and physical frontier are conflated

Forced cycling legitimately allows `twi > list length` and uses modulo/position-array wrapping. Free mode defines
`frontier ∈ [0,N]` and `frontier=N` as list-end pure review. DF2-50 currently says `frontier (=twi)`, which breaks for any
cycled record or a future D7→free switch.

Specify a durable position model:

- physical free frontier vs virtual forced cycling position/lap;
- clipping of the last offered segment;
- no wrap in free mode unless explicitly designed;
- stable segment identity when pace changes;
- how prior attempt `newWordStartIndex/newWordEndIndex/wordsIntroduced` ranges map into the picker;
- what happens when D7 and free activation coexist.

Do not solve this with an unrecorded `min(twi,N)`; that loses lap state on rollback.

### HIGH F3 — DF2-43 is too vague for an authoritative writer

“Free branch of `completeSession` or sibling callable” is not a spec. Before build, define:

- callable name and authenticated assignment/mode checks;
- immutable segment identity/range and server validation against current frontier;
- attempt ID/generation/idempotency contract;
- transaction preconditions and concurrent-submit behavior;
- authoritative `passed:true` consumption;
- list-end clipping and malformed/non-contiguous positions;
- challenge/regrade/manual-pass advancement after the original submit;
- stale client/mode-switch rejection and explicit exit status;
- canonical write fields and audit logs;
- rules and rollback interaction.

This deserves its own reviewed design artifact before implementation, not a row-level “mini-P4” description.

### HIGH F4 — challenge/override/manual pass frontier advancement is missing

The free-nav consistency contract says authoritative `passed:true` from teacher overrides, manual passes, and regrades must
advance the frontier. DF2-43 only names “segment-test pass.” Current `overrideAttempt` manufactures a day/pace-based **new**
anchor and current challenge advancement is day/phase based; neither is safe to reuse unchanged for a free segment.

Enumerate and implement these paths in the frontier contract, with the exact segment range preserved. Otherwise a student
whose failed segment is later corrected remains permanently locked despite `passed:true`.

### MEDIUM F5 — G-DUE’s recording policy is still open but absent from the decision register

`FREE_NAVIGATION_MODEL.md` leaves open whether G-ENGAGED 0.8 controls recording review outcomes in free mode. That affects
mastery, due dates, stats, and teacher analytics. Add it to the open decisions and close it before the scheduler design is
accepted.

### MEDIUM F6 — scheduler authority and write surfaces need to be explicit

DF2-42 correctly requires a design artifact, but its acceptance criteria must cover the whole lifecycle: due calculation,
review selection, answer/engagement recording, mastery/graduation/return transitions, timezone/clock injection,
idempotency, server-vs-client ownership, and rule permissions. “Seeded from the 21-day lifecycle” is a starting point, not
a scheduler contract.

---

## 5. Program gaps / corrections required

Minimum revision set before implementation:

1. Resolve the Wave-3-visible vs single-train contradiction; add an explicit container activation gate if single-train wins.
2. Add a dedicated pre-P5 G-QUAR screen deploy/verification item.
3. Reorder Wave 4 explicitly: DF2-41 before DF2-40.
4. Add the callable manifest, global kill switch, deploy choreography, and dedicated tests to DF2-10.
5. Add a post-P5 forced server-derivation unification/twin-retirement task.
6. Add an owned G-PASS consolidation task.
7. Add and close the mixed-mode same-list canonical write-policy/mode-transition design before frontier/scheduler code.
8. Add a reviewed server-frontier contract, including challenge/override/manual-pass and concurrency.
9. Resolve physical frontier vs cycling virtual position/lap and stable segment identity.
10. Make DF2-44↔D8g a hard ordering edge so R3 remains last.
11. Restore or replace `resolveAssignmentPolicy`.
12. Add the free-review G-ENGAGED decision and full G-DUE authority/lifecycle acceptance criteria.

## Direct answers to the handoff’s five questions

1. **Sequencing:** review-pass before extraction is correct; client-only extraction before P5 is correct. Wave 3/5/6
   release sequencing and Wave-4 table order are not.
2. **Reconciliation fidelity:** most named gates traveled, but the post-P5 server-unification increment is absent; D4/D5
   execution details and E3 are weakened.
3. **Ship-together:** architecturally sound as one production train with dark prework; contradicted by the current
   Wave-3-visible deployment.
4. **Free-nav build:** pass-to-advance YES is coherent, but DF2-43 is not yet an authoritative-writer specification and the
   per-class-mode/shared-record conflict is a blocker.
5. **Missing:** the mixed-mode write contract, cycling/frontier position model, server twin retirement, owned G-PASS
   consolidation, full frontier correction paths, and hard rules ordering.

**Decision:** return to program design. Do not authorize Wave 1/2 from this task list until the blockers are folded and the
six-way panel re-converges.
