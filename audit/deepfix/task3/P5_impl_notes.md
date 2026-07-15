# P5 · FND-3 — migration script implementation notes (REVIEWED DRAFT — not authorized to run live)

Deliverable: `scripts/cs/deepfix-migrate-list-progress.mjs` (660 lines, standalone Admin-SDK, LOCAL-ONLY).
Status: **DRAFT. `--dry` only.** A `--commit` is a David-authorized CS event (SUPPORT_RUNBOOK entry +
change_action_log row + off-peak window + 25WT rehearsal first). The script has NOT been committed,
deployed, or run against 26SM with writes. This note records what was implemented, what was verified
against the plan/code (per the binding verify-all-claims rule), and the open uncertainties.

## 1. The conflict rule as implemented (traced to sources)

Per (student, list), every `users/{uid}/class_progress/{classId}_{listId}` doc (INCLUDING docs under
dropped classes — collectionGroup scan, same as the Phase-0 audit script) collapses into ONE
`users/{uid}/list_progress/{listId}`:

| Component | Implementation | Traced to |
|---|---|---|
| **TWI = anchor-validated max** | `anchorTwi = max integer nwei of passed-new attempts (student+list, any class) + 1`; merged twi = `max(anchorTwi, stored twis ≤ anchorTwi)`. Stored twi **> anchor** → pair QUARANTINE `TWI_EXCEEDS_ANCHOR`; **nonzero twi with no valid anchor** → `ANCHORLESS_TWI` — never zeroed, never auto-promoted, pair skipped (legacy retained, unstamped → re-run picks it up after CS triage). | FIX_PLAN P5 Rule; I-6 §2.1; anchor semantics = `db.js:3239` `getMostRecentPassedNewTest` LIST_SCOPED_RECON branch (verified in-tree: `passed==true`, `sessionType=='new'`, `Number.isInteger(nwei) && nwei>=0`, ORDER BY nwei DESC, submittedAt DESC tie). The script enumerates ALL attempts, so the client's paginate-past-floats loop reduces to the same `Number.isInteger` terminal pick. |
| **CSD = max PLAUSIBLE across EVERY source doc** | each doc screened on **its own anchor** (see §2); merged csd = max of plausible csds. Implausible → pair quarantine (default) or excluded-from-max (`--csd-mode=exclude`, persist §8's letter — see U2). | persist §8 [C4-1]/[C4-2]; FIX_PLAN v3 MED per-doc own-anchor baseline |
| **Ancillary from max-twi winner** | `interventionLevel, recentSessions, stats, streakDays, lastStudyDate` from the winner; tie-break max twi → max csd → newest lastSessionAt. | I-6 §2.1; persist §2.1 field disposition |
| **programStartDate = min()**; `lastSessionAt = max()` (shared truth — see U4); `createdAt = min()` | as stated | persist §2.1 |
| **Dropped**: `progressSnapshot`, blindSpot fields, `classId` | canonical doc built from an explicit ALLOWLIST; winner's classId kept only as informational `lastActiveClassId`; every other legacy field name reported in `droppedFields` per pair. | persist §2.1 + §4 [F3] schema note |
| **Stamps** | `migratedAt` + `migratedFrom[]` + `migrationVersion` on the canonical; `migratedAt` + `migratedTo` INTO each collapsed legacy doc, same atomic batch. | persist §8 [V8] |

## 2. THE MANDATORY CSD-PLAUSIBILITY SCREEN (P5 amendment, adjudication #5) as implemented

- **Primary durable evidence** = count of DISTINCT post-anchor REVIEW ATTEMPTS: `sessionType=='review'`,
  same student+list lineage (§3), `submittedAt > ownAnchor.submittedAt`, deduped by
  `(classId, listId, studyDay)`, **capped one per `studyDay`** (implemented as the count of distinct
  `studyDay` values — the cap collapses cross-class same-day retakes to one).
- **The `reviewOnlyDay:true` session marker is NOT consulted** — re-verified in-tree 2026-07-13:
  `studyService.js:1448-1455` writes it only to `session_states` ("write-only marker … deliberately not
  on the summary"); the durable summary (`:1461-1472`) has no such field. Using it would undercount
  multi-day recoverers (it survives only on the LATEST session_state).
- **Per-doc own-anchor baseline (v3 MED):** each source doc's csd is judged against
  `ownAnchorDay = studyDay of the doc's own CLASS-lineage anchor` (fallback to the LIST anchor when the
  class never produced one — necessary because LIST_SCOPED_RECON writes list-anchor-derived csd into the
  launched class's doc; a classless baseline would misjudge those — see U3).
- **Ceiling** = `max(ownAnchorDay + evidencedReviewDays + slack, implausibleStudyDayThreshold(...))`
  with `slack=7` (`--slack` knob), threshold replicated verbatim from `src/types/studyTypes.js:159/:215`
  (same replication as the Phase-0 audit script — marked keep-in-sync).
- **Dry-run assertion A6:** any doc with `gap = csd − ownAnchorDay ≥ 2` (N>1 consecutive review-only
  days) that would be quarantined is an assert FAILURE; docs that pass ONLY via the calendar ceiling
  (evidence alone insufficient) are separately reported (`csdPassedOnlyByCalendar`) — see U5.
- **A7:** for every `divergent` pair, the cross-doc max csd must survive its own-anchor screen
  (merged csd == max stored) — asserted explicitly.

## 3. "SAME student/list lineage" — made CONCRETE (Codex r2 carryforward #2)

Implemented as `lineageOf(attempt)` (one function, used by anchor selection, evidence counting,
activity attribution, F-2 parity):

> An attempt `a` belongs to the (student U, list L) lineage IFF `a.studentId === U` (query-enforced at
> fetch) AND `lineageListId(a) === L`, where `lineageListId(a)` = `a.listId` when it is a non-empty
> string, ELSE the `<listId>` segment parsed from a canonical testId
> `vocaboost_test_<classId>_<listId>_<new|review>` (regex on non-underscore runs — Firestore auto-IDs
> contain no `_`). An attempt belongs to source doc D's CLASS lineage IFF additionally
> `lineageClassId(a) === D.classId` (`a.classId` primary, same testId fallback; the literal `no_class`
> never matches). NOTHING else — no name matching, no attempt-docId heuristics, no adoption of
> unattributable attempts (they simply don't count; the screen only gets MORE conservative).

testId-fallback occurrences are counted and reported (`lineageFallbacks`: 109 in the 20-pair 25WT walk —
the fallback is load-bearing for older attempts; see U6).

## 4. Populations, procedure, acceptance — as implemented

- **Population classification** replicates `deepfix-census2.mjs:74-85` exactly (fixed 80-word one-day
  lag) so the tags reconcile with `scan_F3_dualenroll.json` (36 LIVE-STRAND / 6 divergent / 72
  stale-2nd-enroll / 22+5 benign / ~633 single-doc): LIVE-STRAND → merged twi = the cross-class anchor
  (the manual carry, automated); divergent → fast doc wins twi, slow doc's day survives via
  max-plausible CSD; stale → collapse; single-doc → 1:1 re-key with anchor-promotions and any
  verbatim deviations REPORTED (the live recon would apply the same `max()` on next session).
- **`--dry` (default):** zero Firestore writes — a `guardWrite()` throws outside commit/catchup, and all
  Firestore write call-sites (verified by grep: lines 579-597, 632-642) sit inside the
  `MODE==='commit'`/`'catchup'` branches, which additionally require `--confirm-migrate=<cohort>` to
  equal the active cohort regex. Dry writes ONE local JSON report (the per-student diff for David's
  review — mode/population/action/quarantine/before→after/anchor/evidence per pair).
- **`--commit`:** refuses to write if ANY hard assert fails or quarantine > 0 ([C7-2]: set must be 0);
  per-pair local backup FIRST (`dsg-edits/srv_validate/list_progress_backups/{uid}_{listId}.json`,
  sources + any pre-existing canonical), then ONE batch per pair (canonical set + legacy stamps,
  atomic); read-back verification sample; prints the post-run checklist (three-flag cutover as a
  SEPARATE deploy step, sweep/census re-run, watch window, `--catchup`, SUPPORT_RUNBOOK/CAL rows).
  Legacy docs RETAINED (P7 deletes).
- **Idempotency:** stamped legacy + our canonical → `SKIP_DONE`; our canonical + a NEW unstamped legacy
  doc (flag-off client / CONT-A) → `MERGE_STRAGGLER` (non-demoting max, never a fresh doc); a FOREIGN
  canonical is overwritten only if the new ANCHOR-VALIDATED twi ≥ existing (persist §8 [V8]: never
  wall-clock "newer"), else `PREEXISTING_CANONICAL_CONFLICT` quarantine.
- **`--catchup`:** persist §8 [C3-4] delta pass — stamped legacy docs with
  `lastSessionAt > canonical.migratedAt` merge in non-demotingly (recentSessions union-by-day,
  streak/intervention/lastStudyDate from the newer doc, position via anchor-capped max).
- **Hard asserts (A1-A8)** computed in dry and re-checked before any commit write: 0 twi regressions,
  0 csd regressions, dual-signature-after 0, NOBODY H→B (full F-4 H/P/B before/after computed with
  census2 parity incl. the F-2 undersized signature), manual-pass values survive (their anchors are
  valid → the anchor max keeps them; a quarantined P-pair is counted as an A5 failure), review-only
  evidence (A6), divergent csd survival (A7), zero FOREIGN pre-existing canonical docs (A8 — the
  resolver wrote none pre-flip; own docs from a prior run are exempt so re-runs stay idempotent).
  `invalidAnchor` counts reported (≈0 expected). Exit code 2 on assert failure.

## 5. Validation performed (this session — read-only)

- `node --check scripts/cs/deepfix-migrate-list-progress.mjs` → **SYNTAX OK** (after fixing a `*/`
  inside the header comment).
- Write-reachability audit: grep of all `.set(/.update(/.batch(/.commit(/.delete(` sites — every
  Firestore write is inside the two guarded mode branches; dry mode cannot reach them.
- **`--dry` logic walk on 25WT (audit sandbox), `--limit=20`** — NO Firestore writes:
  populations classified (18 single-doc / 1 stale-2nd-enroll / 1 divergent), 2 `ANCHORLESS_TWI`
  quarantines correctly caught (sandbox docs with twi>0 and no passed-new), **all 8 asserts PASS**,
  H/P/B before H13/P0/B2 → after H14/P0/B1 (the stale-strand left B). Hand-traced two rows against the
  report JSON: (a) a single-doc anchor promotion `t240→t279` pins to a real anchor attempt
  (`krzZufr5…`, nwei 278, day 5) — the stored doc lagged its own anchor; identical to the live recon's
  non-demoting `max()`; (b) the divergent pair shows fast-doc twi win + per-doc own-anchor days (3 vs 2)
  + per-doc evidence counts (2 vs 1) + merged csd = max plausible — [C4-1] exactly.
- NOT validated here (needs the real rehearsal): `--commit` and `--catchup` paths have never executed
  (by design — 25WT full rehearsal incl. idempotent re-run + flag-off post-migration write is the
  procedure's next step, David-run).

## 6. Uncertainties (explicit, tagged)

- **U1 — quarantine granularity:** FIX_PLAN P5 says implausible-beyond-ceiling "→ quarantine"; persist
  §8's letter says implausible CSDs are "EXCLUDED from the max and flagged". I defaulted to
  PAIR-quarantine (conservative: never writes a possibly-wrong doc; [C7-2] requires the set to be 0
  pre-flip anyway) with `--csd-mode=exclude` available for the persist-§8 reading. David should pick.
- **U2 — TWI_EXCEEDS_ANCHOR is also pair-level** for the same reason ("quarantine, never zero, never
  auto-promote" — moving the pair while ignoring one doc's forged high would still write SOMETHING
  derived from a corrupt neighborhood). Same knob-decision as U1.
- **U3 — own-anchor fallback to the list anchor** (when a doc's class lineage has no anchor): not in
  the plan's text; added because LIST_SCOPED_RECON provably writes list-anchor-derived csd into the
  launching class's doc, so a strictly-own-class baseline would misjudge legitimate carried csds. If
  rejected, those docs would quarantine as not-computable instead — flag to the reviewer.
- **U4 — `lastSessionAt = max()` across sources** instead of the winner's: not explicitly specified
  (the §2.1 ancillary list doesn't include it); max() is the truthful shared-display value under the
  divergent case (slow doc active later than the twi winner). One-line change if David wants
  winner-verbatim.
- **U5 — RESOLVED by the P5-2 fix (Codex HIGH).** A6 now enforces "evidence alone": the durable
  review-attempt evidence ceiling `anchorDay+evDays+slack` is BINDING; the calendar/twi ceiling no
  longer rescues a gap≥2 the evidence can't support. Such docs quarantine (default) / exclude
  (`--csd-mode`) AND hard-fail A6. Consequence David must accept: a CS-patched csd with NO durable
  review-attempt trail is now surfaced for triage (not silently calendar-rescued) — the intended
  fail-closed reading. `--diagnostic-calendar-rescue` re-enables the loose ceiling for INSPECTION only
  (blocked in commit/catchup). See §8.
- **U6 — lineage testId-fallback rate (109 in a 20-pair sandbox sample)** suggests a real population of
  attempts missing explicit `classId`/`listId` fields. The fallback only ADDS evidence/anchors it can
  prove from the canonical testId shape; but the full-cohort dry run should review the rate — if 26SM
  shows a large rate, the invalidAnchor/evidence pictures depend on it.
- **U7 — the H/P/B "after" simulation** cannot see future deploys: LIVE-STRAND students whose merged twi
  lands at the list end move B(strand)→B(wall) — they "leave B" only after the #11-wall deploy, so the
  dry report separates `leftB` from `stayedB(wall)` rather than asserting the literal 42.
- **U8 — F-3 parity constant:** the one-day lag threshold is census2's fixed 80 words, not the class's
  actual pace — kept for scan_F3 reconciliation; the real pace differs for pace-60/pace-20 classes.
- **U9 — stale census numbers:** the 36/6/72 populations are 07-13 counts; the plan REQUIRES a fresh
  Phase-0-style audit + re-parameterized screen at migration time (RO deploy accelerates anchor-less
  csd growth daily). The script re-derives everything live at run time — the reference counts in the
  banner are labeled as go-stale.
- **U10 — the three-flag cutover is OUT of this script** (completeSession target flip,
  `resolveListProgress` write-capable, `LIST_PROGRESS_CANONICAL`): it is a functions deploy step
  bundled with the migration event; the script prints it as the immediate next step but cannot and
  does not flip flags. The CS-toolchain rework (sweep/census/manual-pass → list_progress, F6-3) is
  also scheduled-with-P5 and NOT part of this file.

## 7. node --check / runs ledger

| Check | Result |
|---|---|
| `node --check` (after the P5 fixes) | OK (v24.15.0) |
| Firestore-write reachability grep | writes only in guarded commit/catchup branches |
| `--dry 25WT --limit=40` | 8/8 asserts PASS, 6 ANCHORLESS_TWI quarantines caught, 0 Firestore writes; `FINAL: NOT_READY quarantine=6` → **exit 2** |
| `--diagnostic-only` | same output, exit **0** (inspection escape hatch) |
| `--commit … --diagnostic-only` | REFUSED, exit **1** (diagnostic flags blocked in commit) |
| `--catchup … ` with quarantine=6 | REFUSED CATCH-UP, exit **2** (fail-closed) |
| `--commit` / `--catchup` (write paths) | NEVER RUN with writes (David-authorized CS event; 25WT rehearsal first) |

## 8. Codex review folds (2026-07-13 — NEEDS_FIXES → 3 folded; core logic VALIDATED)

Codex validated the core migration logic (anchor selection == live semantics, anchorless quarantined,
`reviewOnlyDay` correctly unused, `--dry` write-free, backups-before-writes, U1-U4/U6-U10 accepted).
Three fail-closed-discipline holes were folded:

- **P5-1 [BLOCKER] — `--catchup` bypassed quarantine discipline.** The catch-up branch wrote
  CSD/ancillary/anchor-capped-TWI for every migration-owned record with late legacy docs WITHOUT
  checking `r.action`/`r.quarantine`, so a late doc in a quarantined pair (e.g. `CSD_IMPLAUSIBLE
  csd=999`) could promote canonical state. **Fix:** catch-up now (a) refuses ALL writes up front when
  `assertFailures>0 || quarTotal>0` (same gate as `--commit`, exit 2), and (b) per pair skips any
  `SKIP_QUARANTINE`/`SKIP_ERROR`/`r.quarantine.length` record (counted + reported). Verified: catch-up
  with quarantine=6 → `REFUSED CATCH-UP`, exit 2.
- **P5-2 [HIGH] — A6 "evidence alone" was not enforced (calendar rescue).** Plausibility used
  `csd <= max(evidCeil, calCeil)`, so a large gap could pass on the calendar ceiling alone. **Fix:** the
  durable review-attempt evidence ceiling is now BINDING (`csdPlausible = passesOnEvidenceAlone`); the
  calendar ceiling is observability-only and never rescues. A gap≥2 that would pass only on calendar now
  quarantines/excludes AND hard-fails A6. `--diagnostic-calendar-rescue` (dry inspection only, blocked in
  commit/catchup) restores the loose ceiling if an owner ever spec-changes it. (Updated U5.)
- **P5-3 [MED] — dry exit was green with quarantine>0.** `process.exit(assertFailures>0?2:0)` ignored
  the quarantine set. **Fix:** `notReady = assertFailures>0 || quarTotal>0`; exit 2 unless
  `--diagnostic-only`; plus a single unambiguous `FINAL: READY|NOT_READY asserts_failing=N quarantine=N`
  line. Verified exit 2 with quarantine=6, exit 0 under `--diagnostic-only`.

`node --check` OK after all three folds.
