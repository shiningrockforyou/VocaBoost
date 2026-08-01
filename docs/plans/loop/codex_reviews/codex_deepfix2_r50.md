# Codex round 50 — bounded correction-fold verification

**Reviewed:** 2026-07-26  
**Scope:** the round-49 correction packet only  
**Round disposition:** **DONE — verification completed**  
**Plan disposition:** **NOT PRESENTABLE YET; NEEDS ONE SMALL RESIDUE FOLD**

## Executive ruling

The fold fixed r49 B1-B3 in their main locations and substantially fixed B4. It also added the missing schema deliverables, rules lineage, fairness deliverable, server-owned priority clock, restored choreography, and useful ecosystem supersession banners.

It did **not** finish the bounded packet. Three defects still permit a wrong build, and several live task/ledger instructions still contradict the post-R2 model. These are residue, not a reopened architecture: seven targeted edits plus a mechanical sweep should close the round.

## Blocking findings

### B1 — The old pre-build Playwright gate still survives in the authorization matrix

DF2-14 now correctly specifies the five stages at `02_TASK_LIST.md:95`:

implementation authorization → dark build/deploy → post-build 25WT product rehearsal → backfill go → activation go.

But the reissued authorization matrix still says:

> `DF2-14 build: the 8 contracts specced + Track A/B converged + 25WT rehearsal green`

at `02_TASK_LIST.md:300`.

That is the exact circular gate r49 B4 rejected. Replace the matrix cell with the same five-stage law as DF2-14. Also separate DF2-14’s product rehearsal from the later **container** rehearsal: `:103` says Wave 3 production exposure is DF2-14’s flip, while `:105-108` says the container remains dark until DF2-60, and DF2-34 at `:117` still labels its later matrix as the DF2-14 one-flip rehearsal. The coherent graph is:

- DF2-14 legacy-UI review/nav train and its own post-build rehearsal/flip;
- later container build and its own DF2-60/61 rehearsal/exposure.

Wave 3/DF2-34 must say which matrix belongs to which train.

### B2 — The graduation formula still disagrees at the build entry point

The normative addendum correctly uses `queueSize_effective` at `10_REVIEW_GRADUATION_REDESIGN.md:46-50`. The DF2-14 task card uses configured `queueSize` at `02_TASK_LIST.md:95`.

This matters when the active pool is smaller than the configured queue. Example: configured 60, effective queue 40, score 92, 40 correct/eligible:

- addendum: `floor(40 × .92) = 36`;
- task card: `min(floor(60 × .92), 40) = 40`.

The task card therefore graduates 100% of the effective queue. Use `queueSize_effective` at every formula site. Qualify the `91 → no pass` vector as the **default-threshold-92** vector, because a teacher can lower the threshold.

### B3 — One immutable per-day `presentedWordIds` cannot model the required retakes

The persisted queue record is described as one immutable logical-day record containing both `orderedQueueWordIds` and `presentedWordIds` (`10_:23-35`, DF2-14 at `02_:95`). But:

- the queue is frozen for the day;
- the test is a subset of the queue;
- R2-15 requires least-recently-tested rotation across consecutive tests/retakes;
- each submission must be validated against the exact set it was shown.

A single immutable `presentedWordIds` on the day queue can represent only one presentation. Mutating it breaks old-attempt validation; keeping it fixed prevents retake rotation.

Freeze two levels:

1. immutable **day queue** keyed by `{uid,classId,listId,logicalDay,resetEpoch,algorithmVersion,configVersion}` with ordered queue/pool/config data;
2. immutable **presentation/attempt record** keyed by an attempt/presentation identity with its own `presentedWordIds`, queue reference/hash, composition version, and server-issued claim.

The cross-class rule also requires `{anchor/generation}` matching (`10_:55`, DF2-14), but those fields are absent from the listed queue identity/content. Either add them to the authoritative identity/schema or define exactly where they are sourced and immutably bound. The current “H6 deliverable” list does not resolve this contradiction by itself.

## High findings

### H1 — Retired engagement logic remains in executable task cards

The post-R2 law removes engagement from completion (`DF2-10`, R2-11), yet:

- DF2-40 still instructs the migration to “apply the FIX-1 engagement gate to bestCsd” (`02_TASK_LIST.md:129`);
- DF2-46 still says to route the “engaged-paired-review reader” (`:130`).

These are future implementation instructions, not current-code history. Replace them with the final pass-aware evidence law or explicitly strike them as retired. Otherwise later work can reintroduce the mechanic DF2-10 deletes.

### H2 — The binding ledger is still not normalized

The header still says R2-1..R2-37 are “ALL BINDING” (`11_:15`), while live rows retain superseded/pending clauses:

- R2-12 still calls the final job-persistence model “PROPOSED closure [pending David’s nod]” (`:28`);
- R2-15 still calls least-recently-tested “proposed, pending nod” (`:30`) even though R2-26 seals it;
- R2-29’s body still uses unprefixed `lastFailedAt/lastCorrectAt/lastProvenAt` (`:41`);
- R2-24 still presents the universal-model interpretation as unratified and blocks card rescoping (`:45`), although R2-27 explicitly resolves it;
- R2-23 remains framed as a free-mode design decision (`:44`) after that mode was dissolved.

Mark those clauses superseded/finalized inline and point to their governing row. Historical decisions can remain, but “all binding” must mean only their surviving clauses.

### H3 — Active crosswalk/source instructions still name the dead program

These are not all exempt historical prose:

- task-list header still calls this a “free-nav mode” program (`02_:3`);
- the active reconciliation table still routes D7 through DF2-47, calls E4 the 47/42d/43 program, and lists DF2-47 as new work (`:171`, `:178`, `:185`);
- orientation still says free-nav stands on the foundation, E4 is the design track, and has an active “Free-mode pass-to-advance” row (`00_ORIENTATION.md:18`, `:44`, `:55`);
- sources still commissions a free-nav rules lineage, free-mode runbook/help/mode-awareness work (`01_SOURCES.md:32`, `:50-53`);
- ARCH §11’s active map still has the “FREE-mode gates (FUTURE, E4)” row, future `navigationMode` home, and live engagement-message row 3 (`UNIFIED_SESSION_STATE_ARCHITECTURE.md:416`, `:488-492`, `:557`).

The new banners correctly make the body of ARCH §10/§12.2 and D3.5 historical; those bannered occurrences are exempt. The lines above sit in active summaries/tables or outside the banner’s scope and must be rewritten/struck.

### H4 — Per-class disable is declared without a field/value contract

DF2-11 now says a teacher may turn one class-list’s review gate OFF (`02_:80`), and DF2-14 says the kill-switch label law applies. But the teacher UI fields named on the same card are only threshold/queue/test; the global operational config is the only named `enabled` field.

Freeze one unambiguous representation, e.g. `reviewGateEnabled` per assignment, including fallback/missing/null behavior and resolver precedence. Do not overload the global operational `enabled`, and do not silently revive the historical “threshold 0 means off” convention unless the ledger explicitly chooses it.

### H5 — The fairness/clock correction landed only in a dissolved-card row

`02_TASK_LIST.md:71` now correctly requires a mutable-pool/frozen-queue/tie simulation and server-written `lastTestedAt`. But the normative addendum still says only “least-recently-tested” (`10_:31-35`), and the ledger still describes the existing field and calls the rule pending (`11_:30`).

Copy the final authority and proof obligation onto DF2-14/10_, then normalize R2-15. A reader should not have to discover a launch-critical fairness requirement inside the tombstone for DF2-42d.

## Packet-closure matrix

| r49 item | Verdict |
|---|---|
| B1 score normalization | **Partial** — fixed in 10_, wrong effective-size variable remains on DF2-14 |
| B2 one dependency graph | **Partial** — DF2-51 moved in-train and DF2-60/61 split; Wave 3/DF2-34 still contradict the split |
| B3 named rules lineage | **Pass at plan stage** — path, protected surfaces, matrix, lineage, and dark order are named; artifact creation is correctly a pre-implementation deliverable |
| B4 five-stage gate | **Partial** — correct on DF2-14, old circular condition survives in the authorization matrix |
| H1 ledger normalization | **Partial** — several rows corrected; the contradictions in H2 remain |
| H2 live-task cleanup | **Partial** — many closures landed; H1/H3 residue remains |
| H3 ecosystem sweep | **Partial** — banners are much better; active summaries/tables still contradict them |
| H4 recoverable stratum | **Pass** |
| H5 fairness/clock | **Partial** — correct requirement added, but not in the normative launch/addendum/ledger locations |
| H6 queue schema | **Partial** — content named, but presentation cardinality and anchor/generation binding are unresolved |
| Rules/PITR/abort/soak details | **Pass** |
| Header/open-work bookkeeping | **Partial** — v5 fixed, but line 3 and authorization bookkeeping remain stale |

## Exact residue fold

1. Fix the authorization matrix and assign separate DF2-14 vs container rehearsal matrices.
2. Use `queueSize_effective` on DF2-14 and qualify the score vectors.
3. Split immutable day-queue identity from immutable per-attempt presentation identity; bind anchor/generation.
4. Remove engagement from DF2-40/46 future instructions.
5. Normalize the five remaining ledger rows.
6. Name the per-assignment disable field and resolver semantics.
7. Copy fairness/server-clock requirements onto DF2-14 and 10_, then sweep the active crosswalk/orientation/sources/ARCH rows listed above.

This remains bounded. If those exact edits land without adding new policy, the next pass can be a short closure verification rather than another program review.

