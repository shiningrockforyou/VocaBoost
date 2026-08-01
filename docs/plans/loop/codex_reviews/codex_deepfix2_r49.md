# Codex round 49 — DEEPFIX2 mechanical-fold verification

**Reviewed:** 2026-07-26  
**Scope:** the round-49 changed-file set, the r46 28-item fold checklist, the r48 eight-contract carry, ledger fidelity, and executable coherence  
**Round disposition:** **DONE — fold verification completed**  
**Plan disposition:** **NOT YET PRESENTABLE / NEEDS ONE BOUNDED CORRECTION FOLD**

## Executive ruling

The fold preserved the **intent** of all eight r48 contracts, and the new DF2-14 card is a major improvement over the pre-r46 plan. It is not yet an executable or owner-presentable program, however. Four contradictions can produce a wrong implementation or make the stated launch sequence impossible:

1. the graduation formula multiplies a queue size by a 0–100 score without normalizing the score;
2. the same launch UI is assigned both to DF2-14 and to tasks that build only after DF2-14;
3. the new server-owned labels are called rules-locked, but no compatible named rules artifact/deploy order exists at DF2-14;
4. DF2-14 build authorization is gated on a full 25WT rehearsal that requires the build being authorized.

The surrounding “governing” documents also retain live-looking pre-R2 instructions. This is not an unbounded redesign. A single targeted fold addressing the correction packet below, followed by one dead-vocabulary/references sweep, should be enough for a bounded second convergence.

## Blocking findings

### B1 — Graduation arithmetic has the wrong score unit

`10_REVIEW_GRADUATION_REDESIGN.md:42` and `02_TASK_LIST.md:95` define:

`min(floor(queueSize × score), |correct| + |eligible fill|)`.

Persisted attempt scores are percentages in the 0–100 domain. At score 92 and queue size 60, the written expression produces `floor(60 × 92) = 5520`; the score term therefore ceases to constrain graduation. If the intended result is 55, the formula needs an explicit normalized input, for example:

`scoreFraction = clamp(scorePercent, 0, 100) / 100`

`graduationCount = passed ? min(floor(queueSizeEffective × scoreFraction), correctCount + eligibleFillCount) : 0`

Freeze the input unit, rounding rule, treatment of malformed/missing scores, and test vectors at 91/92/100 before code. The card’s existing “units” warning on DF2-08 does not repair this separate formula.

### B2 — THE LAUNCH has two incompatible build graphs

`02_TASK_LIST.md:44-47` and DF2-14 at `:95` enroll universal navigation, the past-day browser, within-day freedom, review-first flow, recovery UI, and progression streak in the **single DF2-14 activation**. But the actual implementation homes remain later:

- DF2-20 and the container begin after DF2-14 (`:97-101`);
- Wave 3 still owns the container/exit/messaging work (`:103-117`);
- the past-day/within-day work is still assigned to later DF2-51;
- DF2-60/61 remain the later train/activation machinery.

Thus DF2-14 cannot both precede these cards and expose their behavior in its one flip. Resolve this with one explicit graph:

- either move every launch-visible implementation into the DF2-14 train (legacy UI or container, named by artifact/task); or
- narrow DF2-14 to the review redesign and amend the one-launch decision/delta set accordingly.

Do not leave the same visible feature as both a DF2-14 launch requirement and a post-DF2-14 build task. This is the largest remaining coherence defect.

### B3 — “Server-written/rules-locked” labels have no executable rules lineage

DF2-14’s surface is `functions+hosting+rules+config` and its cert claims server-owned queue/presented identity and four protected labels (`02_TASK_LIST.md:95`). Yet:

- the global invariant says named artifacts only and “no rules deploy after R3” (`:55-56`);
- no DF2-14 named rules artifact, field-level immutability clause, rules matrix, or deploy position is named;
- DF2-44, much later, still owns the final rules lineage and contains the dead free-mode coexistence clauses (`:133`).

Without a rules change at or before DF2-14, an owner client can potentially write fields the plan calls server-owned. Name the additive/lineage artifact, its exact protected fields and allowed transitions, emulator matrix, relationship to D8g R3, and dark-deploy order. Alternatively move/rewrite DF2-44 before DF2-14. “Rules-locked” is not a valid acceptance assertion until one of those paths exists.

### B4 — Build authorization depends on a post-build rehearsal

DF2-14’s gate requires Track B “rehearsed on 25WT” and the matrix also requires a green 25WT rehearsal before the DF2-14 build. The extensive Playwright rehearsal exercises the wall, force-pass, expiry/recovery, review-first flow, old bundles, and dual-class behavior—features that do not exist until DF2-14 is built.

Split the gates:

1. **implementation authorization:** Track A complete, Track B design and read-only fixture/backfill-script rehearsal converged, contracts/specs frozen;
2. **dark build/deploy:** all surfaces remain inactive;
3. **post-build 25WT product rehearsal:** the full UI and backend matrix;
4. **production backfill and activation authorization.**

The Track B script rehearsal may precede implementation; the full product rehearsal cannot.

## High findings

### H1 — The “binding ledger” contains simultaneously binding contradictions

`11_REDESIGN_VERIFICATION_AND_FOLD_PLAN.md` says R2-1..R2-37 are all binding, but several older rows are superseded:

- R2-1b says reuse `overrideAttempt`; r47/R2-37 requires a new exact-attempt resolver.
- R2-12/R2-14/R2-15/R2-16 contain pending or older retention, activation, composition, and unprefixed-label laws superseded by later rows.
- R2-35’s score clamp is superseded by R2-37’s impossible-record exclusion.
- R2-29 uses pre-R2-30 label names.

Keep the historical rows, but mark each superseded clause inline and point to the final governing row. “All rows binding” must mean “all non-superseded clauses,” not that contradictory clauses are simultaneously normative.

### H2 — `02_TASK_LIST.md` still contains active pre-R2 program instructions

Examples include:

- header says v4 and “free-nav mode” (`:1-5`);
- “either DECIDE-0 option” (`:49-50`);
- live G-DUE/probe dependencies in DF2-01 (`:62`);
- the live DESIGN TRACK authors dissolved DF2-47/43 and cites DF2-42d (`:72`);
- `navigationMode` remains an input to DF2-08 and a forced constant in DF2-20 (`:78`, `:101`);
- Wave 3 still says production visibility is decided by open DECIDE-0 (`:103-109`);
- DF2-34 still ends in “25WT → staged” (`:117`);
- DF2-44 still specifies free-mode coexistence clauses (`:133`);
- the open-decision register retains stale open/default-OFF/pilot/free-mode/G-DUE instructions (`:187-295`).

Historical rationale may remain only inside a clearly marked archive/history block. It cannot remain inside active task rows, gates, surfaces, or the open-decision register.

### H3 — Ecosystem supersession is too late and sometimes itself stale

The `FREE_NAVIGATION_MODEL.md` top banner is adequate. The other ecosystem files are not:

- `00_ORIENTATION.md` still opens with old free-navigation framing and ends with stale r44/register/DECIDE-0 gates.
- `01_SOURCES.md` still commissions free-mode runbook, mode-aware help/CS work, G-DUE, coexistence rules, the mode record, and frontier writer.
- `UNIFIED_SESSION_STATE_ARCHITECTURE.md:268-333` presents the obsolete two-mode architecture as live; its warning appears only at `:490`, after a reader has consumed it as instruction.
- that ARCH warning itself says DECIDE-0 is open (`:496-500`), and §12.2 still presents the obsolete free-mode/G-DUE UI as an active design.
- `12_R2_DISCUSSION_TRACE.md:95-96` still lists already-completed fold/r46 work as open.

Put a supersession banner before ARCH §10 or rewrite/archive the obsolete sections. Rewrite active orientation/source/task rows rather than relying on a warning hundreds of lines later.

### H4 — “Recovered-ever-failed” is not permanently fill-ineligible

`10_REVIEW_GRADUATION_REDESIGN.md:39-41` calls recovered-ever-failed words “permanently FILL-INELIGIBLE,” while the derived predicate makes a word fill-eligible once it earns proof later than its latest failure. The intended state is:

> currently fill-ineligible until `reviewLastProvenAt >= reviewLastFailedAt`

Retain the presentable/recoverable stratum, but remove “permanently.” Add transitions for fail → correct-but-unproven → later passing proof → fill-eligible.

### H5 — Fairness is asserted, not proved, and its clock is not authoritative

DF2-42d says fairness transferred and was “proved under mutable pools + tie-breaks” (`02_TASK_LIST.md:71`), but neither r48 nor the folded design supplies that proof. Pure day-offset rotation over a mutable active pool plus a `lastTestedAt` priority order needs a bound or simulation covering:

- pool insertions/removals and queue-size changes;
- the walled same-queue rule;
- equal/missing timestamps and the stable tie-break;
- students stuck across repeated days despite ≥92%.

Also freeze who writes `lastTestedAt`; a client-written priority clock is not authoritative scheduling evidence. Either write it server-side in the accepted-attempt transaction or define a protected server-derived equivalent.

### H6 — The r48 queue-identity contract is carried but not yet a build spec

DF2-14 carries the correct identity tuple, snapshots, source auditing, and exactly-once law. Before implementation authorization, the plan still needs to name the queue/completion document locations, creation/claim transaction, immutable fields, presented-set storage/hash format, retry response, and retention/reset cleanup. This is bounded contract authoring, not an architecture reopening.

## r46 28-item checklist

| # | Status | Verification |
|---:|:---:|---|
| 1 | **Partial** | Final `review*` names appear in DF2-14/10_, but old ledger rows and active historical text retain unprefixed vocabulary. |
| 2 | **Pass** | R2-15 is sealed; trace open-items correctly leaves only R2-10. |
| 3 | **Pass with stale residue** | Governing trace says only R2-10 is deferred, but the task register and ecosystem still look open in several places. |
| 4 | **Partial** | New launch language exists; old default-OFF/config/open-values language remains in active task rows/history presented as instruction. |
| 5 | **Pass** | R2-31 dark-deploy/backfill/one-flip choreography is carried. |
| 6 | **Pass** | Four prefixed labels and both derived predicates are present. |
| 7 | **Partial** | Ledger range reaches R2-37, but superseded clauses are not normalized, so “all binding” is false as written. |
| 8 | **Fail** | The core sequence is circular at build-vs-rehearsal and conflicts with later UI/container waves. |
| 9 | **Partial** | Merged DF2-14 is authored with most requested controls; exact rules artifact and build/activation split remain missing. |
| 10 | **Pass for DF2-10/11/12 cards** | They were substantially rewritten in place; ecosystem/task-register contradictions remain outside those rows. |
| 11 | **Pass** | Operational `enabled` is separated from teacher threshold/sizes; owner accepted shared per-assignment behavior. |
| 12 | **Partial** | DF2-42/42d are struck/dissolved, but G-DUE dependencies remain in live task/source/ARCH instructions. |
| 13 | **Partial** | Dissolution/rescope labels exist, but DESIGN TRACK, ARCH, sources, and later cards still invoke the dissolved model. |
| 14 | **Pass with cleanup** | 25WT/cohort-wide activation and monitoring are present; “staged” and old pilot language remain elsewhere. |
| 15 | **Pass in intent** | Server-owned identity and three strata are carried; H4/H5/H6 need precision. |
| 16 | **Pass** | Exact-attempt force-pass, metering/job recovery, progression streak, and modality fallback have named homes. |
| 17 | **Pass** | Backfill and activation retain separate David authorizations. |
| 18 | **Partial** | Visible deltas are enumerated on DF2-14, but B2 shows several are still built only after the launch. |
| 19 | **Partial** | Reader logic is retired in DF2-10, but engagement vocabulary survives in governing/history sources without consistent supersession marking. |
| 20 | **Partial** | New monitoring signals/pass-bar inputs exist, but the launch graph and later activation cards remain contradictory. |
| 21 | **Partial** | 10_ uses the final predicates/strata, but score units and recovered-state wording are wrong. |
| 22 | **Pass in intent** | Authoritative queue identity replaces client segment identity on DF2-14; H6 must make it executable. |
| 23 | **Partial** | Deterministic composition, server denominator, exact-set validation, and drift intent exist; formula units/fairness/provenance are not frozen. |
| 24 | **Pass in intent** | Cutover, historical exclusion, reset, and kill-switch laws are carried. |
| 25 | **Fail** | “Proved fairness” is asserted without the required proof/bound under mutable pools/settings/ties. |
| 26 | **Fail** | The ecosystem sweep is incomplete; ARCH’s warning is late and orientation/sources/task rows remain normative-looking. |
| 27 | **Partial** | Governing ranges/counts improved, but stale DECIDE-0/default-OFF/pilot/coexistence/G-DUE instructions remain. |
| 28 | **Pass at card level** | PITR verification, restore rehearsal, RPO/RTO intent, and rollback are present; the implementation artifact/runbook still needs naming before launch. |

**Result:** 10 pass/pass-in-intent, 14 partial, 4 fail. The checklist was carried broadly but not closed item-by-item.

## r48 eight-contract carry

| Contract | Carry verdict |
|---|---|
| 1. Impossible-record exclusion | **Carried faithfully** |
| 2. Class-scoped identity, cross-class evidence, exactly-once completion | **Carried faithfully; H6 must operationalize it** |
| 3. Watermark/delta/cutover | **Carried faithfully** |
| 4. Authoritative queue/presented set and server denominator | **Carried faithfully; rules/schema details remain** |
| 5. Cached-client minimum-version negotiation | **Carried faithfully** |
| 6. `resetEpoch` binding | **Carried faithfully** |
| 7. Kill-switch label law | **Carried faithfully** |
| 8. Logical expiry vs physical TTL | **Carried faithfully** |

No r48 contract was silently dropped. The defects are in arithmetic, sequencing, protection, and ecosystem fidelity around them.

## Bounded correction packet for the second convergence

1. Normalize the graduation score and add boundary vectors.
2. Replace “permanently fill-ineligible” with the actual recoverable transition law.
3. Draw one dependency graph for DF2-14, DF2-20/31/51/60/61, and move or narrow every duplicated launch-visible scope.
4. Split implementation authorization, dark build, product rehearsal, backfill go, and activation go.
5. Name the DF2-14 rules artifact/lineage, protected fields, test matrix, and deploy order.
6. Turn the queue-identity summary into an owned schema/transaction/retention spec.
7. Supply the mutable-pool fairness proof/simulation and make the scheduling clock server-authoritative.
8. Mark superseded ledger clauses inline; make only their surviving portions binding.
9. Rewrite live task/orientation/source/ARCH instructions; archive history behind banners placed before obsolete content.
10. Re-run a mechanical dead-vocabulary and dissolved-card-reference sweep, then update the v5 header/status/open-work bookkeeping.

If the next round is limited to verifying these ten edits rather than reopening product policy, the second convergence is bounded.

